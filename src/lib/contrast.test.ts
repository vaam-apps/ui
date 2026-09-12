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
 * So the gate came before the colours. The light values in `theme.css`
 * were derived *against this test* — searched for maximum pairwise
 * separation among candidates that already cleared the bar — rather than
 * picked and then spot-checked.
 *
 * # What it does not check
 *
 * A **loud** status pill paints its foreground over `--state-*-bg`
 * composited on a surface, not over the bare surface. This file checks
 * the bare surfaces, which is the dominant case and the one the
 * `--subtle-foreground` failure lived in. `StatusPill` already documents
 * the composited case and handles it by switching text tier when loud —
 * see its own comment. Extending this to composited grounds is worth
 * doing and is not done here.
 *
 * Large-text exceptions are deliberately not modelled. Every token below
 * is used at 11–14px somewhere in the library, so the normal-text bar is
 * the right one for all of them.
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
 * must not be scanned at all.
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
 * The body of a `@plugin "daisyui/theme"` block, found by its `name:`.
 * Brace-counted rather than matched with a lazy `[^}]*`, because these
 * blocks contain no nested braces today and would silently truncate if
 * one were ever added.
 */
function daisyThemeBlock(name: string): string {
  const start = THEME_CSS.indexOf(`name: "${name}"`);
  if (start === -1) return "";
  const open = THEME_CSS.lastIndexOf("{", start);
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

/** The body of the `[data-theme="X"]` custom-property block. */
function dataThemeBlock(name: string): string {
  const marker = `[data-theme="${name}"]`;
  const start = THEME_CSS.indexOf(marker);
  if (start === -1) return "";
  const open = THEME_CSS.indexOf("{", start);
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

/** `--token: rgb(R G B / A);` — the form every status tint and aurora uses. */
function rgbaTokens(block: string): Map<string, [number, number, number, number]> {
  const found = new Map<string, [number, number, number, number]>();
  const re = /(--[a-z0-9-]+)\s*:\s*rgb\((\d+)\s+(\d+)\s+(\d+)\s*\/\s*([0-9.]+)\)\s*;/g;
  for (const m of block.matchAll(re)) {
    found.set(m[1] as string, [Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])]);
  }
  return found;
}

/** Source-over composite of a translucent tint on an opaque hex ground. */
function composite(tint: [number, number, number, number], ground: string): string {
  const bg = [0, 2, 4].map((i) => Number.parseInt(ground.replace("#", "").slice(i, i + 2), 16));
  const [r, g, b, a] = tint;
  const mixed = [r, g, b].map((c, i) => Math.round(c * a + (bg[i] as number) * (1 - a)));
  return `#${mixed.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function hexTokens(block: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of block.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    found.set(match[1] as string, match[2] as string);
  }
  return found;
}

interface Theme {
  name: string;
  surfaces: Record<string, string>;
  foregrounds: Record<string, string>;
  /** hue → its own `--state-*-bg` tint, for the *loud* pill case. */
  tints: Record<string, [number, number, number, number]>;
}

function readTheme(name: string): Theme {
  const daisy = hexTokens(daisyThemeBlock(name));
  const custom = hexTokens(dataThemeBlock(name));

  const surfaces: Record<string, string> = {};
  for (const key of ["--color-base-100", "--color-base-200", "--color-base-300"]) {
    const value = daisy.get(key);
    if (value !== undefined) surfaces[key] = value;
  }
  const surface3 = custom.get("--surface-3");
  if (surface3 !== undefined) surfaces["--surface-3"] = surface3;

  const foregrounds: Record<string, string> = {};
  const baseContent = daisy.get("--color-base-content");
  if (baseContent !== undefined) foregrounds["--color-base-content"] = baseContent;
  for (const key of ["--muted-foreground", "--subtle-foreground"]) {
    const value = custom.get(key);
    if (value !== undefined) foregrounds[key] = value;
  }
  for (const [key, value] of custom) {
    if (/^--state-[a-z]+-fg$/.test(key)) foregrounds[key] = value;
  }

  const tints: Record<string, [number, number, number, number]> = {};
  for (const [key, value] of rgbaTokens(dataThemeBlock(name))) {
    const hue = /^--state-([a-z]+)-bg$/.exec(key)?.[1];
    if (hue !== undefined) tints[hue] = value;
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

  it.each(THEMES.map((t) => t.name))("%s has all four surfaces", (name) => {
    const theme = THEMES.find((t) => t.name === name);
    expect(Object.keys(theme?.surfaces ?? {}).sort()).toEqual([
      "--color-base-100",
      "--color-base-200",
      "--color-base-300",
      "--surface-3",
    ]);
  });

  it.each(THEMES.map((t) => t.name))("%s declares all eight status foregrounds", (name) => {
    const theme = THEMES.find((t) => t.name === name);
    const states = Object.keys(theme?.foregrounds ?? {}).filter((k) => k.startsWith("--state-"));
    expect(states).toHaveLength(8);
  });

  /**
   * The three non-status foregrounds need their own roster check, and
   * `--subtle-foreground` is the reason why. `hexTokens` only matches
   * `#rrggbb`; rewrite a token as `rgb(91 99 113)` — a form this very
   * stylesheet uses for the aurora and the status tints — and it drops
   * silently out of the case list with every guard still green. The one
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
