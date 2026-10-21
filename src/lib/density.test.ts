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
 * material3/tokens/` (`ButtonSmallTokens.kt`, `ButtonMediumTokens.kt`),
 * first read at tag `v0_11_0` via `gh api` on 2026-09-22 and re-checked
 * against androidx-main 4611dbdb89a41bbe5d61199c155ca67da4987d81 (raw file
 * download) when the press morph moved onto the corner scale — unchanged.
 * If these two numbers are wrong, every height assertion below is.
 */
const ANDROIDX_BUTTON_TOKENS = {
  small: { containerHeightDp: 40 },
  medium: { containerHeightDp: 56 },
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

  it("is declared exactly once, shared by both themes — not duplicated per theme", () => {
    // Pre-nesting-fix, this formula lived once per `@plugin
    // "daisyui/theme"` block (two copies, pinned identical so they could
    // not drift). The fix moved it off the theme root entirely, onto the
    // consuming selectors — see theme.css's own "`--size-field`,
    // corrected" comment — which collapses the two copies into one
    // declaration that both themes share, rather than two that merely
    // agree.
    const occurrences = [...THEME_CSS.matchAll(/--size-field:\s*calc\([^;]+\);/g)];
    expect(occurrences, "--size-field declarations").toHaveLength(1);
  });

  it("is declared on .input, .select and .btn directly, not the theme root", () => {
    // The nesting fix in one assertion: a descendant's own `--density`
    // override only reaches a formula declared *on* the element that
    // needs it, so pinning this exact selector list is what would fail
    // if a future edit moved the declaration back to `:root` or an
    // `@plugin "daisyui/theme"` block, silently reintroducing the freeze
    // this file's own comment documents in detail.
    const rule = THEME_CSS.match(
      /\.input,\s*\.select,\s*\.btn\s*\{\s*--size-field:\s*calc\([^;]+\);\s*\}/,
    );
    expect(rule, ".input, .select, .btn { --size-field: calc(...) } rule").not.toBeNull();
  });

  it('is not declared inside either @plugin "daisyui/theme" block', () => {
    const themeBlockStarts = [...THEME_CSS.matchAll(/@plugin "daisyui\/theme" \{/g)];
    expect(themeBlockStarts, '@plugin "daisyui/theme" blocks').toHaveLength(2);
    for (const { index } of themeBlockStarts) {
      // Each block runs from its opening brace to the first line that is
      // only a closing brace — true for both blocks here, neither of
      // which nests a rule of its own inside it.
      const end = THEME_CSS.indexOf("\n}", index ?? 0);
      const block = THEME_CSS.slice(index ?? 0, end);
      expect(block).not.toMatch(/--size-field:\s*calc\(/);
    }
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

/**
 * The press morph's targets, transcribed from androidx-main
 * (4611dbdb89a41bbe5d61199c155ca67da4987d81, the same directory as above):
 * each bucket's `PressedContainerShape`, resolved through `ShapeTokens.kt`.
 */
const ANDROIDX_PRESSED_CORNER_DP = {
  xsmall: 8, // ButtonXSmallTokens, 32dp tall → CornerSmall
  small: 8, // ButtonSmallTokens, 40dp tall → CornerSmall
  medium: 12, // ButtonMediumTokens, 56dp tall → CornerMedium
} as const;

/**
 * Evaluates a `--btn-press-radius` declaration at a given density, in px:
 * every `var(--md-sys-shape-corner-*)` replaced by the value `theme.css`
 * itself declares for it, `var(--density, 0)` by the density. So this
 * checks the formula *and* the corner scale it reads, not a string.
 */
function pressRadius(selector: string, density: number): number {
  const rule = new RegExp(
    `\\n${selector.replace(".", "\\.")}\\s*\\{\\s*--btn-press-radius:\\s*([^;]+);`,
  );
  const value = rule.exec(THEME_CSS)?.[1];
  if (value === undefined) throw new Error(`${selector} declares no --btn-press-radius`);
  const expr = value
    .replace(/var\((--md-sys-shape-corner-[a-z-]+)\)/g, (_, name: string) => {
      const declared = new RegExp(`${name}:\\s*([0-9.]+)px;`).exec(THEME_CSS)?.[1];
      if (declared === undefined) throw new Error(`${name} is not declared`);
      return declared;
    })
    .replace(/var\(--density,\s*0\)/g, String(density))
    .replace(/^calc/, "");
  if (!/^[\d\s.+*()-]+$/.test(expr)) throw new Error(`cannot evaluate ${selector}: ${expr}`);
  return Number(new Function(`return (${expr});`)());
}

describe("the press-morph radius is M3's PressedContainerShape, per size and density", () => {
  it(".btn (md) presses to Small's corner at compact (40px) and Medium's at comfortable (56px)", () => {
    expect(pressRadius(".btn", 0)).toBe(ANDROIDX_PRESSED_CORNER_DP.small);
    expect(pressRadius(".btn", 1)).toBe(ANDROIDX_PRESSED_CORNER_DP.medium);
  });

  it(".btn-sm presses to XSmall's corner at compact (32px) and Small's at comfortable (40px)", () => {
    expect(pressRadius(".btn-sm", 0)).toBe(ANDROIDX_PRESSED_CORNER_DP.xsmall);
    expect(pressRadius(".btn-sm", 1)).toBe(ANDROIDX_PRESSED_CORNER_DP.small);
  });

  it(".btn-sm's rule comes after .btn's — the two have equal specificity and share elements", () => {
    expect(THEME_CSS.search(/\n\.btn-sm\s*\{\s*--btn-press-radius/)).toBeGreaterThan(
      THEME_CSS.search(/\n\.btn\s*\{\s*--btn-press-radius/),
    );
  });

  it(".btn-circle keeps the gentler size-proportional ratio (0.1), deliberately off-spec", () => {
    expect(THEME_CSS).toMatch(
      /\.btn-circle\s*\{\s*--btn-press-radius:\s*calc\(var\(--size\)\s*\*\s*0\.1\);\s*\}/,
    );
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
      needle: '"btn font-sans font-medium',
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
