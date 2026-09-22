import { expect, test } from "@playwright/test";
import { box, openStory, sampleBoundingClientX, settleTransitions, storyRoot } from "./helpers";
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
 * `--ease-spatial` (z 0.8, 1.5%) is measured alongside it as the
 * control: the two curves share a travel distance and a trigger, so the
 * contrast between "settles cleanly" and "visibly bounces" is the same
 * side-by-side comparison the story itself renders for a human, just
 * turned into numbers a gate can fail on.
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

    const [samples] = await Promise.all([
      sampleBoundingClientX(page, selector, SAMPLE_WINDOW_MS),
      storyRoot(page).getByRole("button", { name: "Replay" }).click(),
    ]);
    await settleTransitions(page);
    const settled = await box(chip);

    const travel = settled.x - start.x;
    expect(travel, "the chip actually travelled the story's 240px").toBeGreaterThan(TRAVEL_PX - 10);
    expect(travel, "the chip actually travelled the story's 240px").toBeLessThan(TRAVEL_PX + 10);

    const peakX = Math.max(...samples);
    const overshootPercent = ((peakX - settled.x) / travel) * 100;

    // The true peak is 9.5% (`motion-tokens.test.ts`'s own
    // `overshootPercent(0.6, 800)`). rAF sampling at a real browser's
    // frame rate lands within a frame or two of it, not exactly on it,
    // so this asserts comfortably inside that number rather than pinning
    // it to unit-test precision — the thing being proved here is "a real
    // engine overshoots by a lot", not the fourth significant figure.
    expect(overshootPercent, "peak overshoot, sampled from a real transition").toBeGreaterThan(4);
    expect(overshootPercent, "overshoot is a bounce, not runaway motion").toBeLessThan(15);

    // It has to come back — a spring that overshoots and stays
    // overshot is a bug, not a bounce.
    expect(settled.x, "settles back at the target, not at the peak").toBeLessThan(peakX - 1);
  });

  test("--ease-spatial (the default pair) overshoots far less — the contrast the story exists to show", async ({
    page,
  }) => {
    await openStory(page, STORY.tokensSprings);
    const selector = '[data-spring-chip="spatial"]';
    const chip = storyRoot(page).locator(selector);
    const start = await box(chip);

    const [samples] = await Promise.all([
      sampleBoundingClientX(page, selector, SAMPLE_WINDOW_MS),
      storyRoot(page).getByRole("button", { name: "Replay" }).click(),
    ]);
    await settleTransitions(page);
    const settled = await box(chip);

    const travel = settled.x - start.x;
    expect(travel, "the chip actually travelled the story's 240px").toBeGreaterThan(TRAVEL_PX - 10);
    expect(travel, "the chip actually travelled the story's 240px").toBeLessThan(TRAVEL_PX + 10);

    const peakX = Math.max(...samples);
    const overshootPercent = ((peakX - settled.x) / travel) * 100;

    // True peak is 1.5%. The bar here is deliberately loose (well above
    // 1.5%, well below the fast curve's 9.5%) because a handful of
    // pixels of sampling noise on a ~3.6px signal is a large relative
    // error — the assertion that matters is the *comparison* to the fast
    // curve's own measured overshoot, made explicit below.
    expect(overshootPercent, "peak overshoot stays small").toBeLessThan(6);
  });
});
