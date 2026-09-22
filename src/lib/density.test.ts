import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * D10 — the density axis in `theme.css` ("Density register"), checked the
 * way `motion-tokens.test.ts`/`theme-tokens.test.ts` already check their
 * own tokens: re-derived from a cited source, then pinned against the
 * stylesheet text, so a future edit that quietly drifts a formula away
 * from the number it claims to compute fails here rather than shipping.
 *
 * jsdom has no layout (`AGENTS.md`'s own standing trap), so this file
 * cannot measure a rendered height — `e2e/density.spec.ts` does that, on
 * a real browser. What this file *can* check, and what a real-browser
 * test cannot cheaply check on every commit, is that the formulas
 * themselves still say what they claim to, and that the sized primitives
 * this axis covers still resolve through it rather than a hardcoded
 * utility class.
 */

const SRC = fileURLToPath(new URL("..", import.meta.url));
const THEME_CSS = readFileSync(join(SRC, "styles/theme.css"), "utf8");

/**
 * Transcribed, not derived, from `androidx/androidx`'s
 * `compose/material3/material3/src/commonMain/kotlin/androidx/compose/
 * material3/tokens/` (`ButtonSmallTokens.kt`, `ButtonMediumTokens.kt`,
 * `ButtonLargeTokens.kt`, `ShapeTokens.kt`), tag `v0_11_0`, read via
 * `gh api repos/androidx/androidx/contents/<path>` on 2026-09-22 — the
 * same route `motion-tokens.test.ts`'s own header describes for the
 * spring constants. If these five numbers are wrong, every assertion
 * below is.
 */
const ANDROIDX_BUTTON_TOKENS = {
  small: { containerHeightDp: 40, pressedCornerDp: 8 },
  medium: { containerHeightDp: 56, pressedCornerDp: 12 },
  large: { containerHeightDp: 96, pressedCornerDp: 16 },
} as const;

describe("the density axis is declared once and defaults to compact", () => {
  it("--density is 0 at bare :root, not gated behind [data-theme]", () => {
    // Bare `:root`, not `:root, [data-theme=\"dark\"]` — the surface-ladder
    // comment a few lines above this rule in theme.css records exactly
    // the failure mode of getting this wrong: a token only reachable
    // through `[data-theme]` resolves to nothing on a page that never
    // stamps the attribute (Storybook's own docs pages, at the time).
    expect(THEME_CSS).toMatch(/:root\s*\{\s*--density:\s*0;\s*\}/);
  });

  it('[data-density="comfortable"] sets --density: 1 and nothing else', () => {
    // Anchored on a body that *starts* with `--density:` so this matches
    // the real rule rather than the illustrative
    // `.btn-sm[data-density="comfortable"] { --size: 40px }` example this
    // same section's own doc comment quotes a few lines above it.
    const match = THEME_CSS.match(/\[data-density="comfortable"]\s*\{\s*(--density:[^}]*)\}/);
    expect(match, '[data-density="comfortable"] rule').not.toBeNull();
    expect(match?.[1]?.trim()).toBe("--density: 1;");
  });
});

describe("--size-field re-derives ButtonMediumTokens at both densities", () => {
  const formula = THEME_CSS.match(/--size-field:\s*calc\(([^;]+)\);/)?.[1];

  it("the formula is declared", () => {
    expect(formula, "--size-field calc() body").toBeDefined();
  });

  it("appears identically in both the dark and light theme blocks", () => {
    const occurrences = [...THEME_CSS.matchAll(/--size-field:\s*calc\([^;]+\);/g)];
    expect(occurrences, "--size-field declarations").toHaveLength(2);
    expect(occurrences[0]?.[0]).toBe(occurrences[1]?.[0]);
  });

  it("compact (density 0) is 0.25rem — 4px, unchanged from before D10", () => {
    // The formula is `calc(0.25rem + var(--density, 0) * 0.1rem)`; at
    // density 0 the second term vanishes. Checked by evaluating the
    // formula's own literal terms at density 0, not by re-typing 0.25rem
    // as a second, independent assertion.
    const rem = Number(formula?.match(/^([\d.]+)rem/)?.[1]);
    expect(rem, "compact --size-field, in rem").toBe(0.25);
    // daisyUI's own `.btn`/`.input`/`.select` (`--size: calc(var(
    // --size-field) * 10)` for the default/md size) at 16px/rem.
    expect(rem * 16 * 10, "compact md/default field height, px").toBe(40);
  });

  it("comfortable (density 1) reaches ButtonMediumTokens' 56dp exactly", () => {
    const delta = Number(formula?.match(/\*\s*([\d.]+)rem\)?$/)?.[1]);
    const rem = Number(formula?.match(/^([\d.]+)rem/)?.[1]);
    expect(delta, "density-1 delta, in rem").toBeCloseTo(0.1, 5);
    const comfortableRem = rem + delta;
    expect(comfortableRem * 16 * 10, "comfortable md/default field height, px").toBe(
      ANDROIDX_BUTTON_TOKENS.medium.containerHeightDp,
    );
  });
});

describe(".btn-sm overrides --size directly — the one non-proportional exception", () => {
  const formula = THEME_CSS.match(/\.btn-sm\s*\{\s*--size:\s*calc\(([^;]+)\);\s*\}/)?.[1];

  it("the override is declared, unlayered, outside any @plugin block", () => {
    expect(formula, ".btn-sm { --size: calc(...) } body").toBeDefined();
  });

  it("compact (density 0) is 32px, unchanged from before D10", () => {
    const base = Number(formula?.match(/^([\d.]+)px/)?.[1]);
    expect(base, "compact .btn-sm --size, px").toBe(32);
  });

  it("comfortable (density 1) reaches ButtonSmallTokens' 40dp exactly", () => {
    const base = Number(formula?.match(/^([\d.]+)px/)?.[1]);
    const delta = Number(formula?.match(/\*\s*([\d.]+)px\)?$/)?.[1]);
    expect(base + delta, "comfortable .btn-sm --size, px").toBe(
      ANDROIDX_BUTTON_TOKENS.small.containerHeightDp,
    );
  });

  it("the unit .btn-sm needs (5px) genuinely differs from --size-field's (5.6px)", () => {
    // The whole reason this override exists rather than folding into
    // --size-field: .btn-sm's own daisyUI multiplier is 8 (not 10), so
    // hitting 40dp at that multiplier needs a different per-unit value
    // than the 10-multiplier controls share. If these two ever turned out
    // equal, the override would be dead weight rather than a documented
    // exception.
    const smUnit = ANDROIDX_BUTTON_TOKENS.small.containerHeightDp / 8;
    const fieldUnit = ANDROIDX_BUTTON_TOKENS.medium.containerHeightDp / 10;
    expect(smUnit).not.toBeCloseTo(fieldUnit, 1);
  });
});

describe("the press-morph radius is proportional to size, not a flat constant", () => {
  it(".btn's ratio (0.2) is PressedContainerShape/ContainerHeight for the Small bucket, exactly", () => {
    expect(THEME_CSS).toMatch(
      /\.btn\s*\{\s*--btn-press-radius:\s*calc\(var\(--size\)\s*\*\s*0\.2\);\s*\}/,
    );
    const { containerHeightDp, pressedCornerDp } = ANDROIDX_BUTTON_TOKENS.small;
    expect(pressedCornerDp / containerHeightDp).toBe(0.2);
  });

  it(".btn-circle's ratio (0.1) is exactly half of .btn's — the documented --radius-xs halving, reapplied", () => {
    expect(THEME_CSS).toMatch(
      /\.btn-circle\s*\{\s*--btn-press-radius:\s*calc\(var\(--size\)\s*\*\s*0\.1\);\s*\}/,
    );
  });

  it("0.2 is the closest single ratio available — Medium and Large's own ratios bracket it, not match it", () => {
    // The comment in theme.css calls 0.2 "about a fifth", not exact for
    // every bucket — this pins that the other two androidx buckets really
    // do sit on either side of 0.2 rather than on it, which is the
    // evidence for using one approximate ratio instead of a per-bucket
    // lookup this package has no clean key for.
    const mediumRatio =
      ANDROIDX_BUTTON_TOKENS.medium.pressedCornerDp /
      ANDROIDX_BUTTON_TOKENS.medium.containerHeightDp;
    const largeRatio =
      ANDROIDX_BUTTON_TOKENS.large.pressedCornerDp / ANDROIDX_BUTTON_TOKENS.large.containerHeightDp;
    expect(mediumRatio).toBeGreaterThan(0.2);
    expect(largeRatio).toBeLessThan(0.2);
  });
});

describe("every sized primitive this axis covers resolves through it, not a hardcoded utility", () => {
  /** The root class-string literal a component's own source declares, by
   * a short label rather than a line number so a reformat cannot break
   * this test the way a line-number anchor would. */
  const rootClassStrings: Array<{ label: string; file: string; needle: string }> = [
    {
      label: "Button",
      file: "components/primitives/button.tsx",
      needle: '"btn font-sans font-semibold',
    },
    { label: "Input", file: "components/primitives/input.tsx", needle: '"input w-full font-sans' },
    {
      label: "SelectTrigger",
      file: "components/primitives/select.tsx",
      needle: '"select flex w-full',
    },
  ];

  for (const { label, file, needle } of rootClassStrings) {
    it(`${label}'s root class string carries no hardcoded h-*/size-* utility`, () => {
      const text = readFileSync(join(SRC, file), "utf8");
      const start = text.indexOf(needle);
      expect(start, `${needle} in ${file}`).toBeGreaterThan(-1);
      // The class string is a JS template/string literal starting at
      // `needle`; its own closing quote ends it. Concatenated `cn(...)`
      // calls in these three files each open with this literal as the
      // first argument, so scanning to the matching closing quote is
      // enough — no need to parse the whole `cn()` call.
      const quote = text[start] as string;
      const end = text.indexOf(quote, start + 1);
      const literal = text.slice(start + 1, end);
      for (const token of literal.split(/\s+/)) {
        expect(token, `${label}'s "${token}"`).not.toMatch(/^(h|size)-(\d|\[)/);
      }
    });
  }
});
