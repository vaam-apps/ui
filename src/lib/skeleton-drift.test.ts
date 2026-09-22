import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Two properties of the skeleton's drift that a render cannot check and a
 * reader has already gotten wrong once.
 *
 * # The periods the header comment quotes
 *
 * `theme.css`'s own "skeleton's chaotic gradient" comment used to claim
 * coprime periods of 23s/31s and a 713s return-to-start, while
 * `skeleton-drift-a`/`-b` had shipped at 9s/13s (117s) since `a87a4c2`
 * widened the amplitude — the comment was never updated alongside the
 * code it describes. Nothing caught it: the numbers are prose, not a
 * declaration anything else reads. This re-derives 117s from the
 * `animation:` lines themselves rather than trusting either the comment
 * or a second hardcoded pair here, so the same drift cannot happen again
 * in either direction.
 *
 * # The default paint has no hue
 *
 * `--skeleton-tonal-*` exists so `Skeleton`'s default drift is a
 * brightness texture, not a coloured wash — the diagnostic-register
 * colour language `instrument-panel.tsx` documents, since most
 * `Skeleton`s stand in for table cells and form fields rather than a
 * scanned dashboard metric. That is a property of *which variable gets
 * mixed*, not of the resulting hex, so it is asserted structurally: every
 * `--skeleton-tonal-*` token must mix `--color-base-content` (the neutral
 * foreground) and none may mix `--aurora-*` or a `--state-*-fg`. The
 * `--skeleton-aurora-*` tokens `Skeleton`'s `instrument` prop opts into
 * are asserted the other way, so a future edit cannot quietly collapse
 * the two paints into one without a test noticing.
 */

const THEME_CSS = readFileSync(
  fileURLToPath(new URL("../styles/theme.css", import.meta.url)),
  "utf8",
);

function animationSeconds(name: string): number {
  const match = THEME_CSS.match(new RegExp(`animation:\\s*${name}\\s+(\\d+(?:\\.\\d+)?)s`));
  if (!match?.[1]) throw new Error(`no animation: declaration found for ${name}`);
  return Number(match[1]);
}

describe("the drift periods the header comment quotes are the ones that ship", () => {
  const driftA = animationSeconds("skeleton-drift-a");
  const driftB = animationSeconds("skeleton-drift-b");

  it("skeleton-drift-a and skeleton-drift-b are coprime", () => {
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    expect(gcd(driftA, driftB)).toBe(1);
  });

  it("the comment's own period and return-to-start numbers match the animation declarations", () => {
    expect(THEME_CSS).toMatch(new RegExp(`coprime periods \\(${driftA}s and ${driftB}s,`));
    expect(THEME_CSS).toMatch(
      new RegExp(`returns? to its starting arrangement every ${driftA * driftB}s`),
    );
  });
});

/** Every `--skeleton-tonal-<n>:` declaration's `color-mix` source variable. */
function tonalMixSources(): string[] {
  return [
    ...THEME_CSS.matchAll(/--skeleton-tonal-\d:\s*color-mix\(in oklab,\s*var\((--[\w-]+)\)/g),
  ].map((m) => m[1] as string);
}

/** Every `--skeleton-aurora-<n>:` declaration's `color-mix` source variable. */
function auroraMixSources(): string[] {
  return [
    ...THEME_CSS.matchAll(/--skeleton-aurora-\d:\s*color-mix\(in oklab,\s*var\((--[\w-]+)\)/g),
  ].map((m) => m[1] as string);
}

describe("the tonal drift is a neutral brightness texture, not a coloured one", () => {
  it("declares at least eight --skeleton-tonal-* stops (four per theme)", () => {
    expect(tonalMixSources().length).toBeGreaterThanOrEqual(8);
  });

  it("every --skeleton-tonal-* mixes the neutral foreground, never a hue", () => {
    for (const source of tonalMixSources()) {
      expect(source).toBe("--color-base-content");
    }
  });

  it("--skeleton-aurora-* still mixes the aurora ramp, for the instrument opt-in", () => {
    const sources = auroraMixSources();
    expect(sources.length).toBeGreaterThanOrEqual(8);
    for (const source of sources) {
      expect(source).toMatch(/^--aurora-\d$/);
    }
  });
});

describe("the geometry is shared and only the paint switches on .skeleton-instrument", () => {
  it("the default rule paints with --skeleton-tonal-*", () => {
    expect(THEME_CSS).toMatch(/\.skeleton-chaos::before\s*{[\s\S]{0,300}--skeleton-tonal-1/);
    expect(THEME_CSS).toMatch(/\.skeleton-chaos::after\s*{[\s\S]{0,300}--skeleton-tonal-3/);
  });

  it("the .skeleton-instrument modifier repaints with --skeleton-aurora-*", () => {
    expect(THEME_CSS).toMatch(
      /\.skeleton-chaos\.skeleton-instrument::before\s*{[\s\S]{0,300}--skeleton-aurora-1/,
    );
    expect(THEME_CSS).toMatch(
      /\.skeleton-chaos\.skeleton-instrument::after\s*{[\s\S]{0,300}--skeleton-aurora-3/,
    );
  });
});
