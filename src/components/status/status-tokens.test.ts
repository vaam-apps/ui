import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { HUE_CLASSES, type StatusHue } from "./status-tokens";

/**
 * `HUE_CLASSES` is a `Record<StatusHue, …>`, so TypeScript already refuses
 * a *missing* hue. What it cannot see is a **wrong** one, and adding a hue
 * is done by copying the block above it — so the natural mistake is an
 * entry whose key says `progress` and whose three class strings still say
 * `neutral`. That compiles, satisfies `theme-tokens.test.ts` (the neutral
 * tokens are perfectly real), renders a plausible grey, and is only
 * findable by noticing that two hues look identical.
 *
 * These tests pin the derivation instead: a hue's classes are its own
 * name, and the value behind them exists.
 */

const THEME_CSS = readFileSync(
  fileURLToPath(new URL("../../styles/theme.css", import.meta.url)),
  "utf8",
);

/**
 * Read as text rather than imported. `WASH_BG_CLASS` is module-local, and
 * `src/index.ts` re-exports `live-row` with `export *` — exporting it to
 * reach it from here would widen the package's public API for a test's
 * convenience. Scanning the source is the same thing
 * `theme-tokens.test.ts` does, for the same reason.
 */
const LIVE_ROW_TSX = readFileSync(
  fileURLToPath(new URL("../patterns/live-row.tsx", import.meta.url)),
  "utf8",
);

const HUES = Object.keys(HUE_CLASSES) as StatusHue[];

describe("HUE_CLASSES", () => {
  it("has hues to check at all (guards against an empty table)", () => {
    expect(HUES.length).toBeGreaterThan(5);
  });

  it.each(HUES)("%s names its own tokens", (hue) => {
    expect(HUE_CLASSES[hue]).toEqual({
      fg: `text-state-${hue}-fg`,
      bg: `bg-state-${hue}-bg`,
      border: `border-state-${hue}-border`,
    });
  });

  /**
   * `HUE_CLASSES` is not the only table keyed by hue — `LiveRow`'s wash
   * tint is a second one, and it is the one that proves the point. It
   * silently fell a hue behind the moment `progress` was added, and only
   * the compiler's `Record<StatusHue, string>` caught it; had it been
   * written as a plain object literal, a row washing on a transition to
   * an in-flight state would have tinted toward nothing at all.
   */
  it.each(HUES)("%s has a LiveRow wash tint naming its own token", (hue) => {
    expect(LIVE_ROW_TSX).toContain(`${hue}: "bg-state-${hue}-fg/10"`);
  });

  /**
   * The half `theme-tokens.test.ts` cannot reach. That file checks the
   * `@theme inline` aliases — `--color-state-progress-fg` — which is what
   * Tailwind needs to emit a utility at all. But every one of those
   * aliases is a `var()` onto a plain custom property declared in the
   * `[data-theme="dark"]` block, and a hue registered on the alias side
   * only resolves to nothing: Tailwind emits the class, the class sets
   * `color: var(--state-progress-fg)`, and an undefined custom property
   * on `color` computes to the inherited value. No error, and on a dark
   * page an inherited near-white reads as a deliberate choice.
   */
  it.each(HUES.flatMap((hue) => ["fg", "bg", "border"].map((slot) => [hue, slot] as const)))(
    "--state-%s-%s is declared with a value, not just aliased",
    (hue, slot) => {
      expect(THEME_CSS).toMatch(new RegExp(`^\\s*--state-${hue}-${slot}\\s*:\\s*\\S`, "m"));
    },
  );
});
