import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { HUE_CLASSES, isQuietHue, type StatusHue } from "../components/status/status-tokens";
import { REGISTERED_FONT_SIZES } from "./cn";

/**
 * Tailwind's `@theme inline` only generates a utility for a token it knows
 * about. A component that writes `text-state-warning-fg` when no
 * `--color-state-warning-fg` exists therefore emits a class that matches no
 * rule — no error, no warning, no visible difference on a dark background
 * beyond the colour simply not being there.
 *
 * That has happened twice in this stylesheet's history: `--color-surface-1`
 * / `--color-surface-2` (see that file's own comment; every dialog, popover
 * and tooltip rendered transparent for months) and `--state-warning-*`
 * (`StateChip tone="warning"` and every `StaleWriteBanner` in the console).
 * Both were found by reading, long after shipping. These tests make the
 * third instance a build failure.
 */

const SRC = fileURLToPath(new URL("..", import.meta.url));
const THEME_CSS = readFileSync(join(SRC, "styles/theme.css"), "utf8");

/** Every `--color-<name>:` key declared anywhere in the stylesheet. */
const declaredColours = new Set(
  [...THEME_CSS.matchAll(/^\s*--color-([a-z0-9-]+)\s*:/gm)].map((m) => m[1] as string),
);

/** Every `--text-<step>:` key, ignoring the paired `--line-height` entries. */
const declaredFontSizes = new Set(
  [...THEME_CSS.matchAll(/^\s*--text-([a-z0-9-]+)\s*:/gm)]
    .map((m) => m[1] as string)
    .filter((step) => !step.endsWith("--line-height")),
);

/**
 * Strips block and line comments before scanning.
 *
 * Not cosmetic: `state-chip.tsx`'s own doc comment explains the pattern it
 * replaced by writing `bg-state-<tone>-bg` in prose, which a naive scan
 * reads as a reference to a token literally named `state-`. A comment is
 * documentation, not an emitted class, so it must not be scanned at all —
 * and the alternative fix (skipping tokens that contain a `<`) would have
 * silenced this one case while leaving every other prose mention to
 * produce a phantom token later.
 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) ? [path] : [];
  });
}

/**
 * Colour utilities this package's own components emit. Deliberately
 * narrowed to the token families this stylesheet owns — matching every
 * `text-*` in the tree would sweep up font sizes and daisyUI's own
 * `text-primary-content`, neither of which this file declares.
 */
const OWNED_PREFIXES = ["state-", "surface-", "edge", "muted-foreground", "subtle-foreground"];

function isOwned(token: string): boolean {
  return OWNED_PREFIXES.some((p) => (p.endsWith("-") ? token.startsWith(p) : token === p));
}

describe("theme.css declares every token the components reference", () => {
  const referenced = new Map<string, string[]>();

  for (const file of sourceFiles(join(SRC, "components"))) {
    const text = stripComments(readFileSync(file, "utf8"));
    for (const match of text.matchAll(/\b(?:bg|text|border|ring|fill|stroke)-([a-z0-9-]+)/g)) {
      const token = match[1] as string;
      if (!isOwned(token)) continue;
      const seen = referenced.get(token) ?? [];
      seen.push(file.slice(SRC.length));
      referenced.set(token, seen);
    }
  }

  it("finds tokens to check at all (guards against a regex that matches nothing)", () => {
    expect(referenced.size).toBeGreaterThan(10);
  });

  it.each([...referenced.keys()].sort())("--color-%s is declared", (token) => {
    // `border-edge` has no `-fg`/`-bg` suffix; `bg-state-danger-bg` does.
    // Both arrive here as the full token name, which is exactly the name
    // `@theme inline` must declare.
    expect(declaredColours, `referenced by ${referenced.get(token)?.join(", ")}`).toContain(token);
  });
});

describe("cn()'s registered font-size scale matches theme.css", () => {
  it("registers every declared --text-* step", () => {
    expect([...REGISTERED_FONT_SIZES].sort()).toEqual([...declaredFontSizes].sort());
  });
});

/**
 * `isQuietHue` is a hand-written list of two hue names, and the fact it
 * encodes lives in `theme.css` as four `transparent` declarations. That
 * is exactly the shape of drift this file already guards for the
 * font-size scale: a second copy of a stylesheet fact, with nothing
 * holding the two together.
 *
 * It is worth guarding because the same fact has now been got wrong four
 * times — `RadioGroup` and `ChipSelect` styled a selected state with the
 * quiet tokens and rendered no box at all, then `InlineBanner` and
 * `StateChip` did the same for a variant. Writing it down once was the
 * fix; this is what stops the fifth copy drifting from the stylesheet.
 */
describe("isQuietHue matches the hues theme.css actually declares transparent", () => {
  const hues = Object.keys(HUE_CLASSES) as StatusHue[];

  /** Hues whose *both* `-bg` and `-border` are declared `transparent`. */
  const transparentInCss = new Set(
    hues.filter((hue) =>
      ["bg", "border"].every((slot) =>
        new RegExp(`--state-${hue}-${slot}\\s*:\\s*transparent\\s*;`).test(THEME_CSS),
      ),
    ),
  );

  it("finds transparent hues to check at all", () => {
    expect(transparentInCss.size).toBeGreaterThan(0);
  });

  it.each(hues)("%s", (hue) => {
    expect(isQuietHue(hue)).toBe(transparentInCss.has(hue));
  });
});
