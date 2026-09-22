import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Hct, SchemeExpressive } from "@material/material-color-utilities";
import { describe, expect, it } from "vitest";

/**
 * The M3 Expressive colour investigation this file is the outcome of asked
 * three questions: is a *tinted* neutral (M3 derives surfaces from the seed
 * at low chroma, Expressive raises that chroma versus other variants) an
 * improvement over this package's surfaces, already effectively present, or
 * a status-competition risk? All three are answered by measurement below,
 * against `@material/material-color-utilities@0.4.0` — Google's own
 * implementation of the 2025 colour spec — rather than by eye.
 *
 * **Already effectively present**, is the finding. `--color-base-100/200/300`
 * and `--surface-3` were never derived from a seed — this library has no
 * seed, deliberately, per §1.3's "one accent, never a hue" — but measuring
 * them in HCT shows they already carry a small, consistent, blue-biased
 * chroma (background 3.1 up to surface-3's 7.2 in dark; 3.1 up to 6.4 in
 * light), and `--edge`'s three-step border ladder sits a tier above them
 * (8.3–10.5 dark, 6.0–11.1 light) — which is exactly the neutral vs.
 * neutral-variant relationship M3 draws (neutral-variant always carries
 * more chroma than neutral, for every variant this library ships:
 * `dynamic_scheme.js`'s `getNeutralPalette`/`getNeutralVariantPalette`,
 * `case Variant.EXPRESSIVE`, return `TonalPalette.fromHueAndChroma(hue, 8)`
 * and `(hue, 12)` respectively). The two `describe` blocks below don't
 * hardcode 8 and 12 — they build a real `SchemeExpressive` and read
 * `.neutralPalette.chroma` / `.neutralVariantPalette.chroma` off it, which
 * a spot check against three arbitrary seeds confirms is seed-independent
 * (only the *hue* — seed hue + 15° — depends on the seed; the chroma
 * budget does not), so this is the library's own stated ceiling, not a
 * number transcribed once and left to rot.
 *
 * This package's surfaces sit *under* that ceiling with room to spare
 * (7.2 of 8, 6.4 of 8) without ever having tried to hit it — a genuine,
 * if accidental, agreement with the 2025 spec's own idea of a considered
 * neutral. Deliberately **not** changed here: re-deriving the surfaces
 * from an explicit HCT seed would touch the single most pervasive colour
 * in the library for a difference the chroma numbers show is already
 * inside the budget, which is a real cost for no measured gain — see
 * `docs/design/console-redesign.md`'s own reasoning for treating a
 * shipped-colour change as the highest-risk kind of edit.
 *
 * **Not a status-competition risk**, is the other finding, and it is
 * *structural* rather than incidental: every `--state-*-fg` is chosen to
 * clear WCAG AA against every surface (`contrast.test.ts`), which forces a
 * large luminance gap between any status foreground and any surface —
 * dark surfaces sit at HCT tone 3–12, their foregrounds at 66–86; light
 * surfaces sit at 91–99, their foregrounds at 35–39. That tone gap alone
 * — before hue or chroma is even considered — is what the ΔE floor below
 * measures and guards.
 */

const THEME_CSS = readFileSync(
  fileURLToPath(new URL("../styles/theme.css", import.meta.url)),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Brace-counted block body, immune to a nested `{` — see `contrast.test.ts`,
 * which this pair of helpers duplicates rather than imports: each
 * `*-tokens.test.ts` file in this package parses `theme.css` independently
 * (`motion-tokens.test.ts` does the same), so a change to one gate's regex
 * can't silently loosen another's.
 */
function blockFrom(open: number): string {
  let depth = 0;
  for (let i = open; i < THEME_CSS.length; i += 1) {
    if (THEME_CSS[i] === "{") depth += 1;
    if (THEME_CSS[i] === "}") {
      depth -= 1;
      if (depth === 0) return THEME_CSS.slice(open, i);
    }
  }
  return "";
}

/** The body of a `@plugin "daisyui/theme"` block, found by its `name:`. */
function daisyThemeBlock(name: string): string {
  const start = THEME_CSS.indexOf(`name: "${name}"`);
  if (start === -1) return "";
  return blockFrom(THEME_CSS.lastIndexOf("{", start));
}

/** The body of the `[data-theme="X"]` custom-property block. */
function dataThemeBlock(name: string): string {
  const marker = `[data-theme="${name}"]`;
  const start = THEME_CSS.indexOf(marker);
  if (start === -1) return "";
  return blockFrom(THEME_CSS.indexOf("{", start));
}

function hexTokens(block: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const m of block.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    found.set(m[1] as string, m[2] as string);
  }
  return found;
}

function argbFromHex(hex: string): number {
  const v = hex.replace("#", "");
  return (0xff << 24) | (Number.parseInt(v, 16) & 0xffffff);
}

function chroma(hex: string): number {
  return Hct.fromInt(argbFromHex(hex) >>> 0).chroma;
}

interface ThemeTokens {
  surfaces: Record<string, string>;
  edges: Record<string, string>;
  statusFg: Record<string, string>;
}

function readTheme(name: "dark" | "light"): ThemeTokens {
  const daisy = hexTokens(daisyThemeBlock(name));
  const custom = hexTokens(dataThemeBlock(name));

  const surfaces: Record<string, string> = {};
  for (const key of ["--color-base-100", "--color-base-200", "--color-base-300"]) {
    const v = daisy.get(key);
    if (v) surfaces[key] = v;
  }
  const surface3 = custom.get("--surface-3");
  if (surface3) surfaces["--surface-3"] = surface3;

  const edges: Record<string, string> = {};
  for (const key of ["--edge-subtle", "--edge", "--edge-strong"]) {
    const v = custom.get(key);
    if (v) edges[key] = v;
  }

  const statusFg: Record<string, string> = {};
  for (const [key, value] of custom) {
    if (/^--state-[a-z]+-fg$/.test(key)) statusFg[key] = value;
  }

  return { surfaces, edges, statusFg };
}

const THEMES: Record<"dark" | "light", ThemeTokens> = {
  dark: readTheme("dark"),
  light: readTheme("light"),
};

describe("re-derives M3 Expressive's neutral chroma budget from the library", () => {
  // Chroma is seed-independent for EXPRESSIVE (`getNeutralPalette`'s
  // `case Variant.EXPRESSIVE` returns a fixed literal); only hue tracks the
  // seed. Checked against three unrelated seeds so this isn't an accident
  // of the one seed chosen.
  const seeds = [Hct.from(258, 4, 20), Hct.from(10, 80, 70), Hct.from(140, 30, 50)];

  it("neutral chroma is 8 regardless of seed", () => {
    for (const seed of seeds) {
      const scheme = new SchemeExpressive(seed, true, 0);
      expect(scheme.neutralPalette.chroma).toBe(8);
    }
  });

  it("neutral-variant chroma is 12 regardless of seed", () => {
    for (const seed of seeds) {
      const scheme = new SchemeExpressive(seed, true, 0);
      expect(scheme.neutralVariantPalette.chroma).toBe(12);
    }
  });
});

describe("neutral surfaces stay inside the neutral chroma budget", () => {
  const neutralChroma = new SchemeExpressive(Hct.from(0, 0, 50), true, 0).neutralPalette.chroma;

  for (const [themeName, theme] of Object.entries(THEMES)) {
    it(`${themeName} has all four surfaces`, () => {
      expect(Object.keys(theme.surfaces).sort()).toEqual([
        "--color-base-100",
        "--color-base-200",
        "--color-base-300",
        "--surface-3",
      ]);
    });

    for (const [token, hex] of Object.entries(theme.surfaces)) {
      it(`${themeName} ${token} (${hex}) has chroma <= ${neutralChroma}`, () => {
        expect(chroma(hex)).toBeLessThanOrEqual(neutralChroma);
      });
    }
  }
});

describe("the edge ladder stays inside the neutral-variant chroma budget", () => {
  const neutralVariantChroma = new SchemeExpressive(Hct.from(0, 0, 50), true, 0)
    .neutralVariantPalette.chroma;

  for (const [themeName, theme] of Object.entries(THEMES)) {
    it(`${themeName} has all three edge steps`, () => {
      expect(Object.keys(theme.edges).sort()).toEqual(["--edge", "--edge-strong", "--edge-subtle"]);
    });

    for (const [token, hex] of Object.entries(theme.edges)) {
      it(`${themeName} ${token} (${hex}) has chroma <= ${neutralVariantChroma}`, () => {
        expect(chroma(hex)).toBeLessThanOrEqual(neutralVariantChroma);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// CIEDE2000, standard reference implementation (Sharma, Wu & Dalal 2005).
// `theme.css` already quotes three dE2000 figures for `--state-progress-fg`
// (32.2 against `--ring`, 25.3 against `--state-neutral-fg`, 31.0 against
// `--state-success-fg`) with no code behind them — this is that code,
// spot-checked against those exact figures below so the comment stops being
// unverifiable prose.
// ---------------------------------------------------------------------------
function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  return [0, 2, 4].map((i) => Number.parseInt(v.slice(i, i + 2), 16)) as [number, number, number];
}

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

const D65 = { x: 95.0489, y: 100.0, z: 108.884 };

function labF(t: number): number {
  const d = 6 / 29;
  return t > d ** 3 ? Math.cbrt(t) : t / (3 * d * d) + 4 / 29;
}

function hexToLab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear) as [number, number, number];
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) * 100;
  const y = (r * 0.2126729 + g * 0.7151522 + b * 0.072175) * 100;
  const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) * 100;
  const fx = labF(x / D65.x);
  const fy = labF(y / D65.y);
  const fz = labF(z / D65.z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIEDE2000 colour difference between two hex colours, kL=kC=kH=1. */
function deltaE2000(hexA: string, hexB: string): number {
  const [L1, a1, b1] = hexToLab(hexA);
  const [L2, a2, b2] = hexToLab(hexB);

  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const cBar7 = ((C1 + C2) / 2) ** 7;
  const g = 0.5 * (1 - Math.sqrt(cBar7 / (cBar7 + 25 ** 7)));

  const a1p = a1 * (1 + g);
  const a2p = a2 * (1 + g);
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);

  const hAngle = (y: number, x: number) => {
    const deg = (Math.atan2(y, x) * 180) / Math.PI;
    return deg < 0 ? deg + 360 : deg;
  };
  const h1p = C1p === 0 ? 0 : hAngle(b1, a1p);
  const h2p = C2p === 0 ? 0 : hAngle(b2, a2p);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    const diff = h2p - h1p;
    dhp = Math.abs(diff) <= 180 ? diff : diff > 180 ? diff - 360 : diff + 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * Math.PI) / 180 / 2);

  const lBarp = (L1 + L2) / 2;
  const cBarp = (C1p + C2p) / 2;
  let hBarp: number;
  if (C1p * C2p === 0) hBarp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hBarp = (h1p + h2p) / 2;
  else hBarp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;

  const t =
    1 -
    0.17 * Math.cos(((hBarp - 30) * Math.PI) / 180) +
    0.24 * Math.cos((2 * hBarp * Math.PI) / 180) +
    0.32 * Math.cos(((3 * hBarp + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * hBarp - 63) * Math.PI) / 180);

  const dTheta = 30 * Math.exp(-(((hBarp - 275) / 25) ** 2));
  const rc = 2 * Math.sqrt(cBarp ** 7 / (cBarp ** 7 + 25 ** 7));
  const sl = 1 + (0.015 * (lBarp - 50) ** 2) / Math.sqrt(20 + (lBarp - 50) ** 2);
  const sc = 1 + 0.045 * cBarp;
  const sh = 1 + 0.015 * cBarp * t;
  const rt = -Math.sin((2 * dTheta * Math.PI) / 180) * rc;

  return Math.sqrt(
    (dLp / sl) ** 2 + (dCp / sc) ** 2 + (dHp / sh) ** 2 + rt * (dCp / sc) * (dHp / sh),
  );
}

describe("the deltaE2000 implementation matches the figures theme.css already quotes", () => {
  // `--state-progress-fg`'s own comment: "the cyan gap ... is 71° of hue and
  // dE2000 32.2 from the selection ring's own #5b8def ... Nearest status
  // sibling is `neutral` at dE2000 25.3; `success` is 31.0 away".
  it("progress vs ring is ~32.2", () => {
    expect(deltaE2000("#67e8f9", "#5b8def")).toBeCloseTo(32.2, 1);
  });

  it("progress vs neutral is ~25.3", () => {
    expect(deltaE2000("#67e8f9", "#9aa1ac")).toBeCloseTo(25.3, 1);
  });

  it("progress vs success is ~31.0", () => {
    expect(deltaE2000("#67e8f9", "#4ade80")).toBeCloseTo(31.0, 1);
  });
});

describe("neutral chrome never approaches a status hue", () => {
  /**
   * The floor is 30 — comfortably under the ~46–47 minimum this suite
   * measures today (dominated by the tone gap `contrast.test.ts`'s AA gate
   * already forces, per this file's header) and comfortably over the
   * tightest separation the status hues hold *among themselves*: 8.7 in
   * dark (`neutral`/`expired`, both deliberately near-achromatic — see
   * `--state-expired-fg`'s own comment) and 13.2 in light
   * (`uncertain`/`warning`). A neutral surface or edge drifting to within
   * 30 of a status hue would be closer to that hue than the palette's own
   * least-separated pair of *status* hues ever gets to each other, which is
   * the bar for "could plausibly be misread as a signal."
   */
  const FLOOR = 30;

  for (const [themeName, theme] of Object.entries(THEMES)) {
    const neutralTokens = { ...theme.surfaces, ...theme.edges };

    it(`${themeName} has cases to check`, () => {
      expect(Object.keys(neutralTokens).length).toBeGreaterThan(0);
      expect(Object.keys(theme.statusFg).length).toBe(8);
    });

    for (const [nToken, nHex] of Object.entries(neutralTokens)) {
      for (const [sToken, sHex] of Object.entries(theme.statusFg)) {
        it(`${themeName}: ${nToken} (${nHex}) vs ${sToken} (${sHex})`, () => {
          const d = deltaE2000(nHex, sHex);
          expect(
            d,
            `${nHex} sits ${d.toFixed(1)} from ${sHex} (dE2000), below the ${FLOOR} floor — ` +
              "close enough to a status hue to risk being read as a signal.",
          ).toBeGreaterThanOrEqual(FLOOR);
        });
      }
    }
  }
});
