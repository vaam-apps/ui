import { describe, expect, it } from "vitest";
import { maskSecret } from "./mask-secret";

const DOT = "•";

function countDots(masked: string): number {
  return [...masked].filter((char) => char === DOT).length;
}

describe("maskSecret", () => {
  it("uses the same dot count regardless of the hidden length", () => {
    const prefix = 2;
    const reveal = 4;
    const lengths = [10, 16, 40];
    const dotCounts = lengths.map((length) =>
      countDots(maskSecret("a".repeat(length), prefix, reveal)),
    );

    // All three secrets hide a different number of characters
    // (4, 10 and 34 respectively) — if the dot count tracked that, these
    // would differ. A fixed run means they don't.
    expect(new Set(dotCounts).size).toBe(1);
    expect(dotCounts[0]).toBeGreaterThan(0);
  });

  it("still shows the prefix and reveal characters", () => {
    const value = "whsec_abcdefghijklmnop";
    const prefix = 6;
    const reveal = 4;
    const result = maskSecret(value, prefix, reveal);

    expect(result.startsWith(value.slice(0, prefix))).toBe(true);
    expect(result.endsWith(value.slice(-reveal))).toBe(true);
  });

  it("produces no dots once reveal covers the whole value", () => {
    const value = "short";
    const result = maskSecret(value, 0, value.length);

    expect(result).toBe(value);
    expect(countDots(result)).toBe(0);
  });
});
