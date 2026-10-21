import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  argbFromHex,
  DynamicScheme,
  Hct,
  hexFromArgb,
  MaterialDynamicColors,
  Variant,
} from "@material/material-color-utilities";
import { describe, expect, it } from "vitest";
import {
  applyRegions,
  CHROME_SEPARATION_FLOOR,
  deltaE2000,
  deltaE2000Lab,
  SEED,
  STATUS_SEPARATION_FLOOR,
  schemeRoles,
  statusRoles,
  type ThemeName,
} from "../../scripts/generate-md3-colors";

/**
 * The M3 Expressive colour gate: `theme.css` *is* the generated scheme, and
 * the scheme keeps the status system legible.
 *
 * This file used to argue the opposite case — that the hand-picked
 * surfaces "happen to sit under" M3 Expressive's chroma budget, so there
 * was no need to derive them from a seed. The library now derives every
 * colour from one (`scripts/generate-md3-colors.ts`), and the questions
 * worth a gate changed with it:
 *
 * 1. **Can `theme.css` and the generator disagree?** They must not: the
 *    stylesheet is committed, the generator is what justifies it. The
 *    drift gate below re-renders the generated regions and compares them
 *    byte for byte, and — separately, so a change to the *generator* is
 *    caught too — rebuilds the M3 Expressive scheme here from scratch
 *    (`Variant.EXPRESSIVE`, spec 2025, contrast 0) and checks every
 *    shipped `--md-sys-color-*` against it.
 * 2. **Do the library's own tokens point at the roles they claim to?** The
 *    mapping (`--surface-3` → `surface-container-high`, …) is hand-written
 *    in `theme.css`; a wrong `var()` there would still produce a plausible
 *    colour. Asserted on resolved values.
 * 3. **Is colour still meaning?** Two floors, in CIEDE2000: no two status
 *    hues, and neither `primary` nor `primary-container`, closer than
 *    `STATUS_SEPARATION_FLOOR` (13); no surface or edge closer to a status
 *    hue than `CHROME_SEPARATION_FLOOR` (30). The first is new with the
 *    seed — before it the only accent was achromatic and could not collide
 *    with anything — and it is the measurement that rejected the house
 *    teal as the seed: see the last block but one.
 */

const RAW_CSS = readFileSync(
  fileURLToPath(new URL("../styles/theme.css", import.meta.url)),
  "utf8",
);
const THEME_CSS = RAW_CSS.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Every custom property `<html data-theme="name">` ends up with: the
 * declarations of each top-level block whose selector matches that element
 * (`:root`, `[data-theme]`, `[data-theme="name"]`, or a daisyUI theme
 * block of that name), in source order. Duplicated from `contrast.test.ts`
 * rather than shared, on this package's own convention: each gate parses
 * `theme.css` itself, so loosening one gate's parser cannot loosen another.
 */
function themeTokens(name: ThemeName): Map<string, string> {
  const tokens = new Map<string, string>();
  let depth = 0;
  let preludeStart = 0;
  let open = -1;
  for (let i = 0; i < THEME_CSS.length; i += 1) {
    const ch = THEME_CSS[i];
    if (ch === ";" && depth === 0) preludeStart = i + 1;
    if (ch === "{") {
      if (depth === 0) open = i;
      depth += 1;
    }
    if (ch !== "}") continue;
    depth -= 1;
    if (depth !== 0) continue;
    const prelude = THEME_CSS.slice(preludeStart, open).trim();
    const body = THEME_CSS.slice(open + 1, i);
    preludeStart = i + 1;
    const daisy = /^@plugin\s+"daisyui\/theme"$/.test(prelude)
      ? /name:\s*"([a-z]+)"/.exec(body)?.[1]
      : undefined;
    const selectors =
      daisy !== undefined ? [`[data-theme="${daisy}"]`] : prelude.split(",").map((s) => s.trim());
    const applies = selectors.some(
      (s) => s === ":root" || s === "[data-theme]" || s === `[data-theme="${name}"]`,
    );
    if (!applies) continue;
    for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      tokens.set(m[1] as string, (m[2] as string).trim());
    }
  }
  return tokens;
}

function resolver(name: ThemeName): (token: string) => string {
  const tokens = themeTokens(name);
  const resolve = (value: string | undefined, depth = 0): string => {
    if (value === undefined || depth > 20) return "";
    const ref = /^var\((--[a-z0-9-]+)\)$/.exec(value);
    return ref === null ? value : resolve(tokens.get(ref[1] as string), depth + 1);
  };
  return (token) => resolve(tokens.get(token));
}

const THEMES: ThemeName[] = ["dark", "light"];

function independentScheme(theme: ThemeName): Record<string, string> {
  const scheme = new DynamicScheme({
    sourceColorHct: Hct.fromInt(argbFromHex(SEED)),
    variant: Variant.EXPRESSIVE,
    contrastLevel: 0,
    isDark: theme === "dark",
    specVersion: "2025",
  });
  const roles: Record<string, string> = {};
  for (const color of new MaterialDynamicColors().allColors) {
    roles[color.name.replaceAll("_", "-")] = hexFromArgb(color.getArgb(scheme));
  }
  return roles;
}

describe("theme.css is the generated M3 Expressive scheme", () => {
  it("the <md3:generated> regions are byte-for-byte what the generator writes", () => {
    expect(
      applyRegions(RAW_CSS) === RAW_CSS,
      "theme.css has drifted from scripts/generate-md3-colors.ts — run `pnpm generate:colors`, " +
        "and never edit the generated regions by hand.",
    ).toBe(true);
  });

  for (const theme of THEMES) {
    /**
     * Built here from the material library directly rather than through the
     * generator, so a change to the generator's own scheme options (another
     * variant, the 2021 spec, a contrast level) fails even after the CSS has
     * been regenerated to match it.
     */
    it(`${theme}: every --md-sys-color-* role is Expressive/2025/contrast-0 from ${SEED}`, () => {
      const read = resolver(theme);
      const expected = independentScheme(theme);
      expect(Object.keys(expected).length).toBeGreaterThan(40);
      for (const [role, hex] of Object.entries(expected)) {
        expect(read(`--md-sys-color-${role}`), role).toBe(hex);
      }
    });
  }
});

describe("the library's tokens resolve to the M3 roles they are mapped onto", () => {
  const MAPPING: [token: string, role: string][] = [
    ["--color-base-100", "surface"],
    ["--color-base-200", "surface-container-low"],
    ["--color-base-300", "surface-container"],
    ["--surface-3", "surface-container-high"],
    ["--surface-4", "surface-container-highest"],
    ["--color-base-content", "on-surface"],
    ["--muted-foreground", "on-surface-variant"],
    ["--edge-subtle", "surface-container-highest"],
    ["--edge", "outline-variant"],
    ["--color-primary", "primary"],
    ["--color-primary-content", "on-primary"],
    ["--ring", "primary"],
    ["--destructive", "error"],
    ["--color-error", "error"],
  ];

  for (const theme of THEMES) {
    const read = resolver(theme);
    const roles = schemeRoles(SEED, theme);
    it.each(MAPPING)(`${theme}: %s is %s`, (token, role) => {
      expect(read(token)).toBe(roles[role]);
    });

    it(`${theme}: every --state-*-fg is its generated custom colour`, () => {
      const status = statusRoles(SEED, theme);
      expect(Object.keys(status)).toHaveLength(8);
      for (const [hue, r] of Object.entries(status)) {
        expect(read(`--state-${hue}-fg`), hue).toBe(r.base);
        expect(read(`--md-custom-color-${hue}`), hue).toBe(r.base);
        expect(read(`--md-custom-color-${hue}-container`), hue).toBe(r.container);
      }
    });
  }
});

describe("status hues stay apart from each other and from primary", () => {
  for (const theme of THEMES) {
    const read = resolver(theme);
    const status = Object.keys(statusRoles(SEED, theme)).map(
      (hue) => [hue, read(`--state-${hue}-fg`)] as const,
    );

    it(`${theme}: reads all eight status foregrounds from theme.css`, () => {
      expect(status.filter(([, hex]) => /^#[0-9a-f]{6}$/.test(hex))).toHaveLength(8);
    });

    const pairs = status.flatMap(([a, hexA], i) =>
      status.slice(i + 1).map(([b, hexB]) => [`${a}/${b}`, hexA, hexB] as const),
    );
    it.each(pairs)(`${theme}: %s`, (_pair, a, b) => {
      const d = deltaE2000(a, b);
      expect(
        d,
        `${a} and ${b} sit ${d.toFixed(2)} apart (dE2000), under the ${STATUS_SEPARATION_FLOOR} floor ` +
          "— two states that look the same.",
      ).toBeGreaterThanOrEqual(STATUS_SEPARATION_FLOOR);
    });

    const accents = ["--color-primary", "--md-sys-color-primary-container"].flatMap((token) =>
      status.map(([hue, hex]) => [`${token} vs ${hue}`, read(token), hex] as const),
    );
    it.each(accents)(`${theme}: %s`, (_label, accent, hex) => {
      const d = deltaE2000(accent, hex);
      expect(
        d,
        `${accent} sits ${d.toFixed(2)} from the status hue ${hex}, under the ` +
          `${STATUS_SEPARATION_FLOOR} floor — a primary-coloured control that reads as a state.`,
      ).toBeGreaterThanOrEqual(STATUS_SEPARATION_FLOOR);
    });
  }
});

describe("neutral chrome never approaches a status hue", () => {
  /**
   * The floor is 30, unchanged from the gate this replaced: far more than
   * any two status hues sit from each other (`STATUS_SEPARATION_FLOOR`), so
   * a surface or edge inside it would be closer to a state than the states
   * are to each other. It is what keeps `--edge-strong` off M3's `outline`
   * (18.8 from `neutral` in dark, 12.5 in light) — see the generator.
   */
  for (const theme of THEMES) {
    const read = resolver(theme);
    const chrome = [
      "--color-base-100",
      "--color-base-200",
      "--color-base-300",
      "--surface-3",
      "--surface-4",
      "--edge-subtle",
      "--edge",
      "--edge-strong",
    ].map((token) => [token, read(token)] as const);
    const status = Object.keys(statusRoles(SEED, theme)).map(
      (hue) => [`--state-${hue}-fg`, read(`--state-${hue}-fg`)] as const,
    );

    it(`${theme} resolves every chrome token to a hex`, () => {
      for (const [token, hex] of chrome) expect(hex, token).toMatch(/^#[0-9a-f]{6}$/);
    });

    for (const [cToken, cHex] of chrome) {
      for (const [sToken, sHex] of status) {
        it(`${theme}: ${cToken} (${cHex}) vs ${sToken} (${sHex})`, () => {
          const d = deltaE2000(cHex, sHex);
          expect(
            d,
            `${cHex} sits ${d.toFixed(1)} from ${sHex} (dE2000), below the ` +
              `${CHROME_SEPARATION_FLOOR} floor — close enough to a status hue to read as a signal.`,
          ).toBeGreaterThanOrEqual(CHROME_SEPARATION_FLOOR);
        });
      }
    }
  }
});

describe("the seed: why not the house teal", () => {
  /**
   * `#0f766e` is the vaam-apps house seed (the docs hub's). Run through the
   * same generator, its light `primary` lands 5.5 from `progress` and 9.4
   * from `success`. This pins the measurement that decided the seed, so a
   * future "just use the house colour" change has to argue with a number.
   */
  const closestToPrimary = (seed: string) =>
    Math.min(
      ...THEMES.flatMap((theme) => {
        const roles = schemeRoles(seed, theme);
        return Object.values(statusRoles(seed, theme)).flatMap((r) =>
          ["primary", "primary-container"].map((role) => deltaE2000(roles[role] as string, r.base)),
        );
      }),
    );

  it("the teal puts primary under the status floor", () => {
    expect(closestToPrimary("#0f766e")).toBeLessThan(STATUS_SEPARATION_FLOOR);
  });

  it(`the shipped seed (${SEED}) clears it`, () => {
    expect(closestToPrimary(SEED)).toBeGreaterThanOrEqual(STATUS_SEPARATION_FLOOR);
  });
});

describe("the CIEDE2000 implementation matches Sharma, Wu & Dalal's test data", () => {
  /**
   * Pairs from the supplementary test data of "The CIEDE2000
   * Color-Difference Formula: Implementation Notes, Supplementary Test
   * Data, and Mathematical Observations" (Color Res. Appl. 30, 2005) —
   * chosen to cover the hue-rotation term (pairs 1–4, saturated blue), an
   * achromatic reference (7) and large differences (17–20). Every floor
   * above is only as good as this function.
   */
  const SHARMA: [
    label: string,
    a: [number, number, number],
    b: [number, number, number],
    dE: number,
  ][] = [
    ["pair 1", [50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    ["pair 2", [50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    ["pair 3", [50, 2.8361, -74.02], [50, 0, -82.7485], 3.4412],
    ["pair 4", [50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0],
    ["pair 7", [50, 0, 0], [50, -1, 2], 2.3669],
    ["pair 17", [50, 2.5, 0], [73, 25, -18], 27.1492],
    ["pair 18", [50, 2.5, 0], [61, -5, 29], 22.8977],
    ["pair 19", [50, 2.5, 0], [56, -27, -3], 31.903],
    ["pair 20", [50, 2.5, 0], [58, 24, 15], 19.4535],
  ];

  it.each(SHARMA)("%s", (_label, a, b, dE) => {
    expect(deltaE2000Lab(a, b)).toBeCloseTo(dE, 3);
    expect(deltaE2000Lab(b, a)).toBeCloseTo(dE, 3);
  });
});
