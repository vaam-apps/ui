import { expect, test } from "@playwright/test";
import { box, openStory, sampleBoundingClientXs, settleTransitions, storyRoot } from "./helpers";
import { STORY } from "./story-ids";

/**
 * The M3 Expressive spatial springs, measured on a real transition rather
 * than trusted from the numbers that produced it.
 *
 * `src/lib/motion-tokens.test.ts` already proves the `linear()` stops in
 * `theme.css` are the correctly-integrated spring — it re-derives them
 * from the two androidx constants and pins every stop to 3 decimal
 * places. What it cannot prove, because it never asks a browser to run
 * anything, is that Chromium's own `linear()` implementation actually
 * produces the bounce those stops describe on a real element. That is
 * this file's one job: open `Foundations/Tokens · Springs`
 * (`src/styles/tokens.stories.tsx`), trigger the transition, and sample
 * `getBoundingClientRect()` on every frame while it runs.
 *
 * `--ease-spatial-fast` (z 0.6) is the interesting case — it peaks at
 * 9.5% past its target and crosses back through it before settling,
 * which a `cubic-bezier()` cannot express at all (at most one overshoot)
 * and which is the entire reason this scheme reaches for `linear()`.
 * `--ease-spatial` (z 0.8) overshoots too, by a real but much smaller
 * 1.5% — measured below with its own lower bound, not just bounded from
 * above, because an upper-bound-only assertion is exactly the gap a
 * regression can drive through: `0` clears "less than 6" for free, so a
 * `--ease-spatial` silently falling back to `--ease-out` (the
 * `@supports` guard failing to match, the token deleted, re-aliased the
 * way its own no-bounce fallback already is) would stay green. The
 * second test's own header has the measurements that make a floor safe
 * to assert here.
 */

const TRAVEL_PX = 240;
// The `linear()` sample count is 24 stops; at 360ms that is one stop
// every 15ms, close to a single frame at 60Hz. Sampling for a full
// second after the click gives generous margin past the transition's own
// `--dur-spatial-fast` (360ms) / `--dur-spatial` (435ms) for the settled
// read to be genuinely settled, without the test depending on the
// runner's frame rate to land a sample exactly on the peak stop.
const SAMPLE_WINDOW_MS = 900;

test.describe("the M3 Expressive spatial springs, in a real browser", () => {
  test("--ease-spatial-fast exceeds its target mid-flight (the 9.5% overshoot) and settles there", async ({
    page,
  }) => {
    await openStory(page, STORY.tokensSprings);
    const selector = '[data-spring-chip="spatial-fast"]';
    const chip = storyRoot(page).locator(selector);
    const start = await box(chip);

    const [[samples]] = await Promise.all([
      sampleBoundingClientXs(page, [selector], SAMPLE_WINDOW_MS),
      storyRoot(page).getByRole("button", { name: "Replay" }).click(),
    ]);
    await settleTransitions(page);
    const settled = await box(chip);

    const travel = settled.x - start.x;
    expect(travel, "the chip actually travelled the story's 240px").toBeGreaterThan(TRAVEL_PX - 10);
    expect(travel, "the chip actually travelled the story's 240px").toBeLessThan(TRAVEL_PX + 10);

    const peakX = Math.max(...(samples ?? []));
    const overshootPercent = ((peakX - settled.x) / travel) * 100;

    // The true peak is 9.5% (`motion-tokens.test.ts`'s own
    // `overshootPercent(0.6, 800)`). rAF sampling at a real browser's
    // frame rate lands within a frame or two of it, not exactly on it,
    // so this asserts comfortably inside that number rather than pinning
    // it to unit-test precision — the thing being proved here is "a real
    // engine overshoots by a lot", not the fourth significant figure.
    // Measured directly: five local Chromium runs read 9.228–9.234%,
    // stable to within 0.01 percentage points.
    expect(overshootPercent, "peak overshoot, sampled from a real transition").toBeGreaterThan(4);
    expect(overshootPercent, "overshoot is a bounce, not runaway motion").toBeLessThan(15);

    // It has to come back — a spring that overshoots and stays
    // overshot is a bug, not a bounce.
    expect(settled.x, "settles back at the target, not at the peak").toBeLessThan(peakX - 1);
  });

  /**
   * `--ease-spatial`'s own overshoot, and the comparison against
   * `--ease-spatial-fast` that the first test's header points at.
   *
   * Both chips are sampled from *one* rAF loop, started by *one* click
   * (`sampleBoundingClientXs` given two selectors) — the only way to
   * compare their peaks without also asking whether two separately
   * triggered runs happened to sample at equivalent points in their own
   * transitions.
   *
   * This test used to assert only `overshootPercent < 6` — an upper
   * bound `0` clears for free, so it could not tell a correctly working
   * ζ=0.8 spring from `--ease-spatial` quietly regressing to no spring
   * at all. Two real assertions replace it:
   *
   * - A **lower bound** on `--ease-spatial`'s own overshoot. The true
   *   value is 1.5% on this 240px travel — about 3.6px of signal, which
   *   looked too close to plausible sampling noise to assert on without
   *   measuring first. Measured rather than guessed: five local Chromium
   *   runs read 1.4896–1.4900%, stable to within 0.001 percentage
   *   points — not the wide noise band the original comment assumed.
   *   `> 0.6` leaves more than double that margin to zero.
   * - A **comparison**: `--ease-spatial-fast`'s overshoot has to exceed
   *   `--ease-spatial`'s by a real margin. The measured gap is ~7.7
   *   percentage points (9.23 − 1.49); `> 3` catches "both curves
   *   regressed to the same thing", which the lower bound alone would
   *   not — two equal nonzero values can each individually clear a lone
   *   floor — without being anywhere near the noise floor either
   *   measurement showed on its own.
   */
  test("--ease-spatial-fast overshoots materially more than --ease-spatial — sampled from one trigger", async ({
    page,
  }) => {
    await openStory(page, STORY.tokensSprings);
    const fastSelector = '[data-spring-chip="spatial-fast"]';
    const defaultSelector = '[data-spring-chip="spatial"]';
    const fastChip = storyRoot(page).locator(fastSelector);
    const defaultChip = storyRoot(page).locator(defaultSelector);
    const fastStart = await box(fastChip);
    const defaultStart = await box(defaultChip);

    const [[fastSamples, defaultSamples]] = await Promise.all([
      sampleBoundingClientXs(page, [fastSelector, defaultSelector], SAMPLE_WINDOW_MS),
      storyRoot(page).getByRole("button", { name: "Replay" }).click(),
    ]);
    await settleTransitions(page);
    const fastSettled = await box(fastChip);
    const defaultSettled = await box(defaultChip);

    const fastTravel = fastSettled.x - fastStart.x;
    const defaultTravel = defaultSettled.x - defaultStart.x;
    expect(fastTravel, "the fast chip actually travelled the story's 240px").toBeGreaterThan(
      TRAVEL_PX - 10,
    );
    expect(defaultTravel, "the default chip actually travelled the story's 240px").toBeGreaterThan(
      TRAVEL_PX - 10,
    );

    const fastPeakX = Math.max(...(fastSamples ?? []));
    const defaultPeakX = Math.max(...(defaultSamples ?? []));
    const fastOvershootPercent = ((fastPeakX - fastSettled.x) / fastTravel) * 100;
    const defaultOvershootPercent = ((defaultPeakX - defaultSettled.x) / defaultTravel) * 100;

    expect(
      defaultOvershootPercent,
      "--ease-spatial overshoots by a real, measured amount, not by nothing",
    ).toBeGreaterThan(0.6);
    expect(defaultOvershootPercent, "--ease-spatial's overshoot stays small").toBeLessThan(6);
    expect(
      fastOvershootPercent - defaultOvershootPercent,
      "the fast curve's bounce is materially bigger than the default curve's — the two are not the same curve",
    ).toBeGreaterThan(3);
  });
});
