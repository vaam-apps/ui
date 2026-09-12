import { describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY, themeInitScript } from "./theme-switcher";

/**
 * `themeInitScript` is a hand-written duplicate of this module's own
 * preference-resolution logic, as a single literal string, and this test
 * is what keeps the duplicate honest.
 *
 * It used to be a template literal interpolating the constants, with a
 * comment claiming that kept it in lockstep. CodeQL flagged every
 * interpolation as code construction from a non-literal — correctly: the
 * string is executed via `dangerouslySetInnerHTML`, so anything
 * interpolated into it is a script-injection sink. Nothing was
 * exploitable, because all three values are module constants, but making
 * the storage key configurable is one plausible refactor away and would
 * turn caller input into executable code.
 *
 * So the interpolation is gone and the guarantee moved here, which is the
 * stronger place for it: a comment asks the next person to remember, a
 * test fails their build.
 */
describe("themeInitScript stays in lockstep with the module's constants", () => {
  it("reads the same storage key the component writes", () => {
    expect(themeInitScript).toContain(JSON.stringify(THEME_STORAGE_KEY));
  });

  it("writes the same attribute and reads the same media query", () => {
    expect(themeInitScript).toContain('"data-theme"');
    expect(themeInitScript).toContain('"(prefers-color-scheme: dark)"');
  });

  it("resolves the same three preferences to the same two themes", () => {
    for (const token of ['"light"', '"dark"', '"system"']) {
      expect(themeInitScript).toContain(token);
    }
  });

  /**
   * The script runs before anything else on the page and must never take
   * it down — a private window, a blocked-storage policy, or a
   * `matchMedia`-less environment all have to fall through to the
   * stylesheet's own default theme rather than throw.
   */
  it("is self-contained, guarded, and syntactically valid", () => {
    expect(() => new Function(themeInitScript)).not.toThrow();
    expect(themeInitScript).toContain("try{");
    expect(themeInitScript).toContain("catch");
    expect(themeInitScript).not.toContain("import");
    expect(themeInitScript).not.toContain("require");
  });

  /**
   * Inlined into `<script>…</script>`, so a literal `</script` anywhere
   * in it would close the tag early and spill the remainder into the
   * document as markup.
   */
  it("cannot break out of the script tag it is inlined into", () => {
    expect(themeInitScript.toLowerCase()).not.toContain("</script");
  });

  /**
   * The whole point of the CodeQL fix: no dynamic construction left. If
   * someone reintroduces a template placeholder, this fails.
   */
  it("contains no unresolved interpolation", () => {
    expect(themeInitScript).not.toMatch(/\$\{/);
  });
});
