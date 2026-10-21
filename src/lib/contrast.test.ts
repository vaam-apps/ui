import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Every foreground token clears WCAG AA against every surface it can land
 * on, in every theme this package ships.
 *
 * # Why this exists, and why it had to come first
 *
 * `theme-tokens.test.ts` asserts that a token is **declared**. It cannot
 * assert that the value is **legible**, and that gap has already cost
 * this package a real accessibility failure: `--subtle-foreground` was
 * `#6b727d`, which measured 4.06:1 on the page and 3.40:1 on a hovered
 * row against a 4.5:1 bar, across 38 usages all at 11–12px. It shipped
 * for months and was found by an addon on a Storybook story, not by any
 * check here.
 *
 * Adding a light theme multiplies that risk by eight. Every status
 * foreground was chosen as a 300-level tint for roughly 11:1 against
 * near-black; measured against white *before* this file existed, all
 * eight landed between 1.4:1 and 2.6:1. A light palette derived by eye
 * would have shipped a status vocabulary nobody could read, and nothing
 * in the build would have said a word.
 *
 * So the gate came before the colours, and it still outranks them. The
 * palette is generated now (`scripts/generate-md3-colors.ts`, M3
 * Expressive from one seed), and where Material's own recipe would have
 * failed this file the generator departs from the recipe rather than this
 * file relaxing: the light status foregrounds sit at tone 38, not M3's 40,
 * because a loud `progress` label measured 4.46:1 at 40.
 *
 * # The case that is easy to miss
 *
 * A **loud** status pill paints its foreground over `--state-*-bg`
 * composited on a surface, not over the bare surface. That used to be a
 * stated limitation here — "extending this to composited grounds is worth
 * doing and is not done" — and it is done: the third `describe` block
 * below composites each loud fill over each surface and checks the label
 * against the result. It caught `expired` at 4.27:1 and `danger` at
 * 4.36:1, both of which cleared the bar on a bare surface, and neither of
 * which any story renders. The note is kept as history rather than
 * deleted, because the gap it describes is the reason the block exists.
 */

/**
 * Comments are stripped before anything is parsed, and that is not
 * tidiness — it is the same trap `theme-tokens.test.ts` documents for its
 * own scan, hit again here. This file's header comment contains the
 * literal string `[data-theme="dark"]` in prose; without stripping,
 * `indexOf` found *that* occurrence, brace-counted forward from the
 * wrong opening brace, and returned the daisyUI block — which declares
 * no `--surface-3`. The test failed for a reason that had nothing to do
 * with any colour. A comment is documentation, not a declaration, so it
 * must not be scanned at all. (It matters twice now: a `{` or `;` inside a
 * comment would also throw off the top-level block scan below.)
 */
const THEME_CSS = readFileSync(
  fileURLToPath(new URL("../styles/theme.css", import.meta.url)),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

const AA_NORMAL = 4.5;

function srgbToLinear(channel: number): number {
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance per WCAG 2.x. Hex only — every token here is a hex. */
function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const parts = [0, 2, 4].map((i) => Number.parseInt(value.slice(i, i + 2), 16) / 255);
  const [r, g, b] = parts.map(srgbToLinear) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The stylesheet's top-level rule blocks, in source order, with the
 * selector each one applies to. A `@plugin "daisyui/theme"` block counts as
 * `[data-theme="<name>"]`, which is what daisyUI emits it as.
 *
 * Brace-counted rather than matched with a lazy `[^}]*`, so a nested
 * block (`@layer`, `@media`) is skipped whole rather than truncating the
 * scan. Only top-level blocks can declare a theme's tokens.
 */
function topLevelBlocks(): { selectors: string[]; body: string }[] {
  const blocks: { selectors: string[]; body: string }[] = [];
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
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        const prelude = THEME_CSS.slice(preludeStart, open).trim();
        const body = THEME_CSS.slice(open + 1, i);
        const daisy = /^@plugin\s+"daisyui\/theme"$/.test(prelude)
          ? /name:\s*"([a-z]+)"/.exec(body)?.[1]
          : undefined;
        const selectors =
          daisy !== undefined
            ? [`[data-theme="${daisy}"]`]
            : prelude.startsWith("@")
              ? []
              : prelude.split(",").map((sel) => sel.trim());
        blocks.push({ selectors, body });
        preludeStart = i + 1;
      }
    }
  }
  return blocks;
}

/**
 * Every custom property `<html data-theme="name">` ends up with: the
 * declarations of each top-level block whose selector matches that element
 * (`:root`, `[data-theme]`, `[data-theme="name"]`), applied in source
 * order — the cascade, for the one element that matters, with every
 * selector here at the same specificity.
 *
 * This replaced two helpers that each read one block by name. They stopped
 * being enough the day the palette became a mapping: daisyUI's
 * `--color-base-100` is now `var(--md-sys-color-surface)`, declared in a
 * different block, and the library's own `--surface-3` lives in a third
 * that both themes share. A gate that only read literal hex values out of
 * the block it expected would have found no surfaces at all — and, worse,
 * a hex literal left behind in one block would have been measured while
 * the `var()` that actually wins went unchecked.
 */
function themeTokens(name: string): Map<string, string> {
  const matches = (sel: string) =>
    sel === ":root" || sel === "[data-theme]" || sel === `[data-theme="${name}"]`;
  const tokens = new Map<string, string>();
  for (const block of topLevelBlocks()) {
    if (!block.selectors.some(matches)) continue;
    for (const m of block.body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      tokens.set(m[1] as string, (m[2] as string).trim().replace(/\s+/g, " "));
    }
  }
  return tokens;
}

/** Follows `var(--x)` (with or without a fallback) to a literal value. */
function resolve(tokens: Map<string, string>, value: string | undefined, depth = 0): string {
  if (value === undefined || depth > 20) return "";
  const ref = /^var\((--[a-z0-9-]+)(?:\s*,\s*(.+))?\)$/.exec(value);
  if (ref === null) return value;
  const target = tokens.get(ref[1] as string);
  return target !== undefined
    ? resolve(tokens, target, depth + 1)
    : resolve(tokens, ref[2], depth + 1);
}

/** `rgb(R G B / A)` — the form every status tint is generated in. */
function parseRgba(value: string): [number, number, number, number] | undefined {
  const m = /^rgb\((\d+)\s+(\d+)\s+(\d+)\s*\/\s*([0-9.]+)\)$/.exec(value);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])] : undefined;
}

/** Source-over composite of a translucent tint on an opaque hex ground. */
function composite(tint: [number, number, number, number], ground: string): string {
  const bg = [0, 2, 4].map((i) => Number.parseInt(ground.replace("#", "").slice(i, i + 2), 16));
  const [r, g, b, a] = tint;
  const mixed = [r, g, b].map((c, i) => Math.round(c * a + (bg[i] as number) * (1 - a)));
  return `#${mixed.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

interface Theme {
  name: string;
  surfaces: Record<string, string>;
  foregrounds: Record<string, string>;
  /** hue → its own `--state-*-bg` tint, for the *loud* pill case. */
  tints: Record<string, [number, number, number, number]>;
}

function readTheme(name: string): Theme {
  const tokens = themeTokens(name);
  const hex = (key: string) => {
    const value = resolve(tokens, tokens.get(key));
    return HEX.test(value) ? value : undefined;
  };

  // `--surface-4` is not a ladder step of its own: it is what `surface-3`
  // becomes inside `.surface-raised` (a `Dialog`'s panel), so every
  // foreground that can land on a hover or selected fill there has to
  // clear it too.
  const surfaces: Record<string, string> = {};
  for (const key of [
    "--color-base-100",
    "--color-base-200",
    "--color-base-300",
    "--surface-3",
    "--surface-4",
  ]) {
    const value = hex(key);
    if (value !== undefined) surfaces[key] = value;
  }

  const foregrounds: Record<string, string> = {};
  for (const key of ["--color-base-content", "--muted-foreground", "--subtle-foreground"]) {
    const value = hex(key);
    if (value !== undefined) foregrounds[key] = value;
  }
  for (const key of tokens.keys()) {
    if (!/^--state-[a-z]+-fg$/.test(key)) continue;
    const value = hex(key);
    if (value !== undefined) foregrounds[key] = value;
  }

  const tints: Record<string, [number, number, number, number]> = {};
  for (const key of tokens.keys()) {
    const hue = /^--state-([a-z]+)-bg$/.exec(key)?.[1];
    const tint = hue === undefined ? undefined : parseRgba(resolve(tokens, tokens.get(key)));
    if (hue !== undefined && tint !== undefined) tints[hue] = tint;
  }

  return { name, surfaces, foregrounds, tints };
}

const THEMES = ["dark", "light"].map(readTheme).filter((t) => Object.keys(t.surfaces).length > 0);

describe("every theme declares a full set of surfaces and foregrounds", () => {
  /**
   * The **roster**, not a count. `THEMES` filters out any theme whose
   * surfaces failed to parse, and every `it.each` below iterates
   * `THEMES` — so a theme that disappears entirely is not a failing
   * theme, it is an absent one, and absence was never asserted. Deleting
   * the whole light theme left this file green: one theme still produces
   * 44 cases, comfortably over the old `> 20` floor. A floor on cases
   * cannot catch a missing theme, because the remaining theme already
   * clears it.
   */
  it("parses exactly the themes this package ships", () => {
    expect(THEMES.map((t) => t.name)).toEqual(["dark", "light"]);
  });

  it.each(THEMES.map((t) => t.name))("%s has all five surfaces", (name) => {
    const theme = THEMES.find((t) => t.name === name);
    expect(Object.keys(theme?.surfaces ?? {}).sort()).toEqual([
      "--color-base-100",
      "--color-base-200",
      "--color-base-300",
      "--surface-3",
      "--surface-4",
    ]);
  });

  it.each(THEMES.map((t) => t.name))("%s declares all eight status foregrounds", (name) => {
    const theme = THEMES.find((t) => t.name === name);
    const states = Object.keys(theme?.foregrounds ?? {}).filter((k) => k.startsWith("--state-"));
    expect(states).toHaveLength(8);
  });

  /**
   * The three non-status foregrounds need their own roster check, and
   * `--subtle-foreground` is the reason why. `readTheme` only keeps a
   * token that resolves to `#rrggbb`; rewrite one as `rgb(91 99 113)` — a
   * form this very stylesheet uses for the status tints — or point its
   * `var()` at a role that does not exist, and it drops silently out of
   * the case list with every guard still green. The one
   * token whose historical AA failure this file's header cites as its
   * reason to exist is the one that could vanish unnoticed.
   */
  it.each(THEMES.map((t) => t.name))("%s declares all three text tiers", (name) => {
    const theme = THEMES.find((t) => t.name === name);
    const tiers = Object.keys(theme?.foregrounds ?? {}).filter((k) => !k.startsWith("--state-"));
    expect(tiers.sort()).toEqual([
      "--color-base-content",
      "--muted-foreground",
      "--subtle-foreground",
    ]);
  });
});

/**
 * The dark tokens must be reachable with no `data-theme` attribute.
 *
 * daisyUI's `dark` carries `default: true`, so its own `base-*` tokens
 * apply to a bare `<html>`. Everything this stylesheet adds — the
 * surfaces, the edges, the three text tiers, every state hue — was
 * declared only under `[data-theme="dark"]`, so on a page with no
 * attribute the daisyUI half resolved and this half did not.
 *
 * Measured before fixing: `--color-base-100` came back `#0a0b0d` while
 * `--muted-foreground`, `--edge` and `--subtle-foreground` came back
 * empty. Every `text-muted-foreground` and `border-edge` on that page
 * computed to nothing, and the README explicitly promised the opposite.
 *
 * `theme-tokens.test.ts` could not catch it and still cannot: it asks
 * whether a token is *declared*, and these were. The gap is
 * reachability, so it gets its own check here.
 *
 * Asserted on the selector rather than by rendering, because rendering
 * needs a browser and this suite deliberately has none — the sibling
 * Playwright suite in `e2e/` is where a computed-value version of this
 * belongs.
 */
describe("the dark theme applies without a data-theme attribute", () => {
  /** The declaration block's own selector list, comments already stripped. */
  const selector = (() => {
    const at = THEME_CSS.indexOf('[data-theme="dark"]');
    expect(at, 'no `[data-theme="dark"]` block in theme.css').toBeGreaterThan(-1);
    const lineStart = THEME_CSS.lastIndexOf("}", at) + 1;
    return THEME_CSS.slice(lineStart, THEME_CSS.indexOf("{", at)).trim();
  })();

  it("names :root alongside the attribute", () => {
    expect(
      selector,
      "The dark block must match a bare `<html>`. daisyUI's own `default: true` " +
        "makes its tokens apply there, so dropping `:root` here leaves a page " +
        "where half the theme resolves and half computes to nothing — silently.",
    ).toContain(":root");
  });

  it("still matches the explicit attribute", () => {
    expect(selector).toContain('[data-theme="dark"]');
  });

  it("does not let :root swallow the light theme", () => {
    // Equal specificity (0,1,0) each, so source order decides: the light
    // block has to come later in the file than this one.
    expect(THEME_CSS.indexOf('[data-theme="light"]')).toBeGreaterThan(
      THEME_CSS.indexOf('[data-theme="dark"]'),
    );
  });
});

describe("every foreground clears WCAG AA on every surface", () => {
  const cases = THEMES.flatMap((theme) =>
    Object.entries(theme.foregrounds).flatMap(([fgName, fg]) =>
      Object.entries(theme.surfaces).map(([bgName, bg]) => ({
        label: `${theme.name}: ${fgName} on ${bgName}`,
        fg,
        bg,
      })),
    ),
  );

  it("has cases to check", () => {
    expect(cases.length).toBeGreaterThan(20);
  });

  it.each(cases.map((c) => [c.label, c.fg, c.bg] as const))("%s", (_label, fg, bg) => {
    const measured = contrast(fg, bg);
    expect(
      Number(measured.toFixed(2)),
      `${fg} on ${bg} measures ${measured.toFixed(2)}:1, below the ${AA_NORMAL}:1 WCAG AA bar ` +
        "for normal text. Every token checked here is used at 11–14px somewhere in the library, " +
        "so the large-text exception does not apply. Darken (light theme) or lighten (dark theme) " +
        "the foreground rather than relaxing this test.",
    ).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});

/**
 * The **loud** case: a status foreground painted over its own
 * `--state-*-bg` tint, composited on each surface.
 *
 * This file originally measured bare surfaces only and said so — "a loud
 * status pill paints its foreground over `--state-*-bg` composited on a
 * surface, not over the bare surface… Extending this to composited
 * grounds is worth doing and is not done here." It was worth doing: a
 * review measured the light palette this way and found `expired` at
 * 4.27:1 and `danger` at 4.36:1 on `--surface-3`, the row-hover fill.
 * Both below AA, both invisible to the flat check, and invisible to axe
 * too because no story renders a loud pill on a hovered row.
 *
 * In dark the tint *lightens* an already-light foreground's ground and
 * the ratios stay comfortable; in light it darkens the ground under an
 * already-dark foreground, which is why the same palette logic does not
 * transfer. The quiet hues (`neutral`, `success`) declare a transparent
 * fill and so have no composited case at all — `isQuietHue` in
 * `status-tokens.ts` is the single place that fact lives.
 */
describe("loud status pills clear AA over their own tint", () => {
  const cases = THEMES.flatMap((theme) =>
    Object.entries(theme.tints).flatMap(([hue, tint]) => {
      const fg = theme.foregrounds[`--state-${hue}-fg`];
      if (fg === undefined) return [];
      return Object.entries(theme.surfaces).map(([bgName, surface]) => ({
        label: `${theme.name}: ${hue} loud on ${bgName}`,
        fg,
        ground: composite(tint, surface),
      }));
    }),
  );

  it("finds loud cases in both themes", () => {
    const themes = new Set(cases.map((c) => c.label.split(":")[0]));
    expect([...themes].sort()).toEqual(["dark", "light"]);
    expect(cases.length).toBeGreaterThan(40);
  });

  it.each(cases.map((c) => [c.label, c.fg, c.ground] as const))("%s", (_label, fg, ground) => {
    const measured = contrast(fg, ground);
    expect(
      Number(measured.toFixed(2)),
      `${fg} over its own tint (effective ground ${ground}) measures ${measured.toFixed(2)}:1, ` +
        `below ${AA_NORMAL}:1. The label in a loud pill is 12px, so the normal-text bar applies.`,
    ).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});

/**
 * `color-mix(in srgb, <a> <p>%, <b>)` of two opaque colours — the one
 * mix form `InstrumentPanel`'s ground is written in, chosen so this file
 * can follow it. `in srgb` interpolates the gamma-encoded channels, so the
 * mix is a straight per-channel lerp; `oklab` (the form the aurora ramp
 * uses) would need a colour-space round trip this file does not carry.
 * Anything else resolves to `undefined` and fails the roster check below
 * rather than dropping silently out of the case list.
 */
function resolveColour(tokens: Map<string, string>, value: string | undefined): string | undefined {
  const resolved = resolve(tokens, value);
  if (HEX.test(resolved)) return resolved;
  const mix = /^color-mix\(\s*in srgb,\s*(.+?)\s+([0-9.]+)%,\s*(.+?)\s*\)$/.exec(resolved);
  if (mix === null) return undefined;
  const a = resolveColour(tokens, mix[1]);
  const b = resolveColour(tokens, mix[3]);
  if (a === undefined || b === undefined) return undefined;
  const share = Number(mix[2]) / 100;
  const channels = (hex: string) =>
    [0, 2, 4].map((i) => Number.parseInt(hex.replace("#", "").slice(i, i + 2), 16));
  const [ca, cb] = [channels(a), channels(b)];
  const mixed = ca.map((c, i) => Math.round(c * share + (cb[i] as number) * (1 - share)));
  return `#${mixed.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * `InstrumentPanel`'s ground: the container, and the two Expressive
 * shapes painted on it (`--instrument-shape-quiet` for the cookie halo,
 * `--instrument-shape` for the clover). All three are opaque, so every
 * pixel under a caption is one of them or an antialiased edge between two
 * of them — and on these pairs every channel moves the same way, so an
 * edge pixel's luminance lies between its two ends and cannot be worse
 * than both.
 *
 * What may sit on that ground directly: the panel's own title
 * (`--color-base-content`) and caption (`--muted-foreground`), and any
 * status foreground a caller drops in loose — a `StateChip`, a toned
 * figure outside a tile. All of them must clear AA on all three.
 *
 * `--subtle-foreground` is the one tier the component's doc bans here,
 * and the last block keeps that ban honest in both directions: it asserts
 * subtle *fails* on the clover, so a future palette that lets it pass
 * turns this red and the ban gets lifted rather than outliving its
 * reason.
 */
describe("InstrumentPanel's ground holds every tier it allows", () => {
  const GROUND = ["--instrument-container", "--instrument-shape-quiet", "--instrument-shape"];
  const grounds = ["dark", "light"].map((name) => {
    const tokens = themeTokens(name);
    return {
      name,
      grounds: Object.fromEntries(
        GROUND.map((key) => [key, resolveColour(tokens, tokens.get(key))]),
      ),
      theme: THEMES.find((t) => t.name === name),
    };
  });

  it.each(grounds.map((g) => [g.name, g] as const))("%s declares all three grounds", (_n, g) => {
    for (const key of GROUND) expect(g.grounds[key], `${key} resolves to a hex`).toMatch(HEX);
  });

  const cases = grounds.flatMap((g) =>
    Object.entries(g.theme?.foregrounds ?? {})
      .filter(([fgName]) => fgName !== "--subtle-foreground")
      .flatMap(([fgName, fg]) =>
        GROUND.map((key) => ({
          label: `${g.name}: ${fgName} on ${key}`,
          fg,
          bg: g.grounds[key] ?? "",
        })),
      ),
  );

  it("has cases in both themes", () => {
    expect(cases.length).toBe(2 * 10 * GROUND.length);
  });

  it.each(cases.map((c) => [c.label, c.fg, c.bg] as const))("%s", (_label, fg, bg) => {
    const measured = contrast(fg, bg);
    expect(
      Number(measured.toFixed(2)),
      `${fg} on ${bg} measures ${measured.toFixed(2)}:1. Lower the primary-container share in ` +
        "that theme's --instrument-shape mix rather than relaxing this test.",
    ).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it.each(grounds.map((g) => [g.name, g] as const))(
    "%s: subtle still fails on the clover, so the ban is still buying something",
    (_n, g) => {
      const subtle = g.theme?.foregrounds["--subtle-foreground"] ?? "";
      const measured = contrast(subtle, g.grounds["--instrument-shape"] ?? "");
      expect(
        Number(measured.toFixed(2)),
        `--subtle-foreground now measures ${measured.toFixed(2)}:1 on the clover. If that is ` +
          "deliberate, lift the ban in instrument-panel.tsx and delete this case.",
      ).toBeLessThan(AA_NORMAL);
    },
  );
});
