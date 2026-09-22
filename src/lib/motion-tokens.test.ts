import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The M3 Expressive motion tokens in `theme.css` are not design choices —
 * they are a spring, integrated. This file re-derives them from the two
 * constants androidx publishes and fails when the stylesheet drifts.
 *
 * Why it has to exist: a `linear()` easing is 25 opaque numbers. Nothing
 * about `1.0941` tells a reader it is the peak of a damping-ratio-0.6
 * spring, and nothing stops the next author nudging it to 1.1 because a
 * demo looked nicer — at which point the token still animates, still looks
 * plausible, and is no longer the thing its own comment claims it is. The
 * same trap `theme-tokens.test.ts` exists for, one layer down: that file
 * asserts a token is *declared*, this one asserts a token is *correct*.
 *
 * It also pins the three percentages the comment quotes (1.5 / 9.5 / 0),
 * because those are the entire argument for using this scheme over
 * `standard()` and a comment nobody can check is a comment that rots.
 */

/**
 * `ExpressiveMotionTokens.kt` and `StandardMotionTokens.kt`, from
 * `compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/`.
 * Transcribed, not derived — if these are wrong, everything below is.
 *
 * Compose's `SpringSpec` takes no mass, so mass = 1 and omega-n =
 * sqrt(stiffness).
 */
const SPRINGS = {
  expressive: {
    "spatial-default": { damping: 0.8, stiffness: 380 },
    "spatial-fast": { damping: 0.6, stiffness: 800 },
    "spatial-slow": { damping: 0.8, stiffness: 200 },
    "effects-default": { damping: 1.0, stiffness: 1600 },
    "effects-fast": { damping: 1.0, stiffness: 3800 },
    "effects-slow": { damping: 1.0, stiffness: 800 },
  },
  standard: {
    "spatial-default": { damping: 0.9, stiffness: 700 },
    "spatial-fast": { damping: 0.9, stiffness: 1400 },
    "spatial-slow": { damping: 0.9, stiffness: 300 },
  },
} as const;

/** Unit step response of a spring at time `t` seconds. */
function stepResponse(t: number, damping: number, stiffness: number): number {
  const omega = Math.sqrt(stiffness);
  if (damping < 1) {
    const damped = omega * Math.sqrt(1 - damping * damping);
    return (
      1 -
      Math.exp(-damping * omega * t) *
        (Math.cos(damped * t) + ((damping * omega) / damped) * Math.sin(damped * t))
    );
  }
  // Critically damped. The library declares no over-damped spring.
  return 1 - (1 + omega * t) * Math.exp(-omega * t);
}

const STEP_SECONDS = 0.0005;
const SETTLE_TOLERANCE = 1e-3;
/** 0.2s of continued quiet, so a zero-crossing mid-oscillation is not "settled". */
const QUIET_STEPS = 400;

/** Seconds until the response stays inside `SETTLE_TOLERANCE` of 1 for good. */
function settleSeconds(damping: number, stiffness: number): number {
  for (let t = STEP_SECONDS; t < 5; t += STEP_SECONDS) {
    if (Math.abs(stepResponse(t, damping, stiffness) - 1) >= SETTLE_TOLERANCE) continue;
    let quiet = true;
    for (let i = 1; i <= QUIET_STEPS; i += 1) {
      if (Math.abs(stepResponse(t + i * STEP_SECONDS, damping, stiffness) - 1) < SETTLE_TOLERANCE) {
        continue;
      }
      quiet = false;
      break;
    }
    if (quiet) return t;
  }
  throw new Error(`spring ${damping}/${stiffness} never settled within 5s`);
}

/** Peak overshoot above the target, as a percentage. 0 when monotonic. */
function overshootPercent(damping: number, stiffness: number): number {
  const settle = settleSeconds(damping, stiffness);
  let peak = 0;
  for (let i = 0; i <= 2000; i += 1) {
    peak = Math.max(peak, stepResponse((i * settle) / 2000, damping, stiffness));
  }
  return Math.max(0, (peak - 1) * 100);
}

/** `linear()` stops for a spring, sampled evenly across its settling time. */
function linearStops(damping: number, stiffness: number, count = 24): number[] {
  const settle = settleSeconds(damping, stiffness);
  return Array.from({ length: count + 1 }, (_, i) =>
    stepResponse((i * settle) / count, damping, stiffness),
  );
}

const THEME_CSS = readFileSync(
  join(fileURLToPath(new URL("..", import.meta.url)), "styles/theme.css"),
  "utf8",
);

function declaredMs(token: string): number {
  const match = THEME_CSS.match(
    new RegExp(`^\\s*--${token}\\s*:\\s*(\\d+(?:\\.\\d+)?)ms\\s*;`, "m"),
  );
  if (!match?.[1]) throw new Error(`--${token} is not declared in theme.css`);
  return Number(match[1]);
}

function declaredStops(token: string): number[] {
  const match = THEME_CSS.match(new RegExp(`--${token}\\s*:\\s*linear\\(([^)]*)\\)`, "m"));
  if (!match?.[1]) throw new Error(`--${token} has no linear() declaration in theme.css`);
  return match[1]
    .split(",")
    .map((stop) => stop.trim())
    .filter((stop) => stop.length > 0)
    .map(Number);
}

describe("M3 Expressive durations are the springs' own settling times", () => {
  const cases = [
    ["dur-spatial", "spatial-default"],
    ["dur-spatial-fast", "spatial-fast"],
    ["dur-spatial-slow", "spatial-slow"],
    ["dur-effects", "effects-default"],
    ["dur-effects-fast", "effects-fast"],
    ["dur-effects-slow", "effects-slow"],
  ] as const;

  for (const [token, spring] of cases) {
    it(`--${token} matches ${spring}`, () => {
      const { damping, stiffness } = SPRINGS.expressive[spring];
      expect(declaredMs(token)).toBe(Math.round(settleSeconds(damping, stiffness) * 1000));
    });
  }
});

describe("the linear() stops are the integrated spring", () => {
  const cases = [
    ["ease-spatial", "spatial-default"],
    ["ease-spatial-fast", "spatial-fast"],
    ["ease-effects", "effects-default"],
  ] as const;

  for (const [token, spring] of cases) {
    it(`--${token} matches ${spring} at every stop`, () => {
      const { damping, stiffness } = SPRINGS.expressive[spring];
      const declared = declaredStops(token);
      const derived = linearStops(damping, stiffness);
      expect(declared).toHaveLength(derived.length);
      declared.forEach((stop, i) => {
        expect(stop).toBeCloseTo(derived[i] as number, 3);
      });
    });
  }
});

describe("three curves is a derivation, not a shortcut", () => {
  /**
   * The claim in theme.css is that a spring's normalised shape depends on
   * damping ratio alone, so one curve serves every stiffness sharing a
   * ratio. If that ever stops holding, the token set is wrong by three.
   */
  it("the two damping-0.8 spatial springs share one normalised curve", () => {
    const fromDefault = linearStops(0.8, SPRINGS.expressive["spatial-default"].stiffness);
    const fromSlow = linearStops(0.8, SPRINGS.expressive["spatial-slow"].stiffness);
    fromDefault.forEach((stop, i) => {
      expect(stop).toBeCloseTo(fromSlow[i] as number, 3);
    });
  });

  it("all three critically damped effects springs share one normalised curve", () => {
    const reference = linearStops(1.0, SPRINGS.expressive["effects-default"].stiffness);
    for (const stiffness of [
      SPRINGS.expressive["effects-fast"].stiffness,
      SPRINGS.expressive["effects-slow"].stiffness,
    ]) {
      linearStops(1.0, stiffness).forEach((stop, i) => {
        expect(stop).toBeCloseTo(reference[i] as number, 3);
      });
    }
  });
});

describe("the overshoot figures theme.css quotes", () => {
  it("damping 0.8 spatial overshoots 1.5%", () => {
    expect(overshootPercent(0.8, 380)).toBeCloseTo(1.5, 1);
  });

  it("damping 0.6 spatial overshoots 9.5% — the signature bounce", () => {
    expect(overshootPercent(0.6, 800)).toBeCloseTo(9.5, 1);
  });

  it("critically damped effects never exceed the target", () => {
    expect(overshootPercent(1.0, 1600)).toBe(0);
  });

  /**
   * The reason to install this scheme at all. If standard's spatial springs
   * ever became visibly bouncy, the token set below would be pointless
   * ceremony rather than a real difference.
   */
  it("standard's spatial springs overshoot by nothing a reader can see", () => {
    for (const spring of Object.values(SPRINGS.standard)) {
      expect(overshootPercent(spring.damping, spring.stiffness)).toBeLessThan(0.5);
    }
  });
});

describe("the linear() upgrade is guarded and has a no-bounce default", () => {
  it("declares each expressive easing as --ease-out before the @supports block", () => {
    for (const token of ["ease-spatial", "ease-spatial-fast", "ease-effects"]) {
      expect(THEME_CSS).toMatch(new RegExp(`--${token}\\s*:\\s*var\\(--ease-out\\)\\s*;`));
    }
  });

  /**
   * A custom property accepts any token stream, so an unsupporting browser
   * stores `linear(...)` happily and only fails at the use site. The
   * `@supports` wrapper is the only thing that actually gates it.
   */
  it("puts every linear() behind a linear() feature query", () => {
    const guard = THEME_CSS.indexOf("@supports (animation-timing-function: linear(0, 1))");
    expect(guard).toBeGreaterThan(-1);
    const firstUse = THEME_CSS.search(/--ease-[a-z-]+\s*:\s*linear\(/);
    expect(firstUse).toBeGreaterThan(guard);
  });
});
