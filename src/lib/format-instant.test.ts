import { describe, expect, it } from "vitest";
import { formatAbsolute, formatElapsed } from "./format-instant";

// The instant the offset table in the WP1 brief was verified against. Kept
// as a single constant so every zone in the table is checked against the
// exact same moment.
const INSTANT = "2026-09-11T14:03:07Z";

describe("formatAbsolute", () => {
  /**
   * `shortOffset` never zero-pads and never emits `"GMT-05:00"` (that is
   * `longOffset`'s shape) — verified per-zone against this repo's
   * Node/ICU for `INSTANT`. `formatAbsolute` must parse each shape rather
   * than string-patch it: a suffix-anchored regex (the old
   * `/^([+-])(\d)$/`) never matches a zone with a minutes component, and
   * `raw === "GMT"` never fires because modern ICU reports zero offset as
   * `"GMT+0"`, not bare `"GMT"`.
   */
  it.each([
    ["UTC", "2026-09-11 14:03:07 Z"],
    ["Africa/Douala", "2026-09-11 15:03:07 +01"],
    ["America/New_York", "2026-09-11 10:03:07 -04"],
    ["Asia/Kolkata", "2026-09-11 19:33:07 +05:30"],
    ["Asia/Kathmandu", "2026-09-11 19:48:07 +05:45"],
    ["Pacific/Marquesas", "2026-09-11 04:33:07 -09:30"],
  ])("renders %s as %s", (timezone, expected) => {
    expect(formatAbsolute(INSTANT, timezone)).toBe(expected);
  });

  it("uses the real DST offset for the instant given, not a fixed one", () => {
    expect(formatAbsolute("2026-09-11T14:03:07Z", "America/New_York")).toBe(
      "2026-09-11 10:03:07 -04",
    );
    expect(formatAbsolute("2026-01-15T14:03:07Z", "America/New_York")).toBe(
      "2026-01-15 09:03:07 -05",
    );
  });
});

describe("formatElapsed", () => {
  it("renders sub-second deltas in milliseconds", () => {
    expect(formatElapsed(0)).toBe("+0ms");
    expect(formatElapsed(999)).toBe("+999ms");
  });

  it("renders sub-minute deltas in seconds to three decimal places", () => {
    expect(formatElapsed(1000)).toBe("+1.000s");
    expect(formatElapsed(59_999)).toBe("+59.999s");
  });

  it("renders sub-hour deltas in minutes and seconds", () => {
    expect(formatElapsed(60_000)).toBe("+1m 00s");
    expect(formatElapsed(90_000)).toBe("+1m 30s");
    expect(formatElapsed(3_599_000)).toBe("+59m 59s");
  });

  it("renders hour-scale deltas in hours and minutes", () => {
    expect(formatElapsed(3_600_000)).toBe("+1h 00m");
    expect(formatElapsed(5_400_000)).toBe("+1h 30m");
  });

  /**
   * `elapsedMs` is a raw subtraction of two caller-supplied ISO strings
   * with no ordering guarantee. The old implementation assumed
   * non-negative input and rendered the nonsensical `"+-5000ms"` for an
   * out-of-order pair. The real sign is rendered instead of clamping to
   * zero, because clamping would hide an ordering bug in the caller's
   * data.
   */
  it("renders a negative delta with its real sign rather than clamping", () => {
    expect(formatElapsed(-5000)).toBe("-5.000s");
    expect(formatElapsed(-500)).toBe("-500ms");
    expect(formatElapsed(-90_000)).toBe("-1m 30s");
  });

  it("renders an em dash for a malformed elapsed value", () => {
    expect(formatElapsed(Number.NaN)).toBe("—");
  });
});
