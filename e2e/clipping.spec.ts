import { expect, test } from "@playwright/test";
import {
  box,
  changedPixels,
  clampToViewport,
  openStory,
  pixelSignature,
  pseudoRect,
  storyRoot,
} from "./helpers";
import { STORY } from "./story-ids";

/**
 * The one failure jsdom cannot even represent: an ancestor's `overflow`
 * deleting a descendant that is, by every other measure, correct.
 *
 * `Tooltip` documents this precisely (`tooltip.tsx`, and
 * `ClippedByAScrollingAncestor` in its stories): the daisyUI bubble is an
 * absolutely positioned pseudo-element, a scrolling ancestor clips it,
 * and the component's answer is a native `title` as a **fallback**, not a
 * fix. These tests assert what the library actually does — a clipped
 * bubble and a surviving label — rather than what it would be nice for it
 * to do, because a test that asserts the nicer thing would have to be
 * skipped, and a skipped test is not a passing test.
 *
 * If the clipping is ever genuinely fixed (a portal, or CSS anchor
 * positioning), these fail — and the fix is to update this file and
 * `tooltip.stories.tsx`'s docstring together, which is the point.
 */

test("the scroller clips the bubble, and the native label survives it", async ({ page }) => {
  await openStory(page, STORY.tooltipClipped);
  const clipped = storyRoot(page).locator(".tooltip").first();
  const bubble = await pseudoRect(clipped, "::before");
  const scrollportRight = await clipped.evaluate((el) => {
    const scroller = el.closest("div.overflow-y-auto");
    if (scroller === null) throw new Error("this trigger is supposed to sit in a scroller");
    const rect = scroller.getBoundingClientRect();
    return rect.left + scroller.clientWidth;
  });

  // The bubble runs well past the scroller's edge — that is the premise,
  // and it is where the clipping happens.
  expect(bubble.x + bubble.width, "the bubble extends past the scroller").toBeGreaterThan(
    scrollportRight + 20,
  );
  const beyond = await clampToViewport(page, {
    x: scrollportRight + 2,
    y: bubble.y,
    width: bubble.x + bubble.width - scrollportRight - 2,
    height: bubble.height,
  });

  const before = await pixelSignature(page, beyond);
  await clipped.hover();
  // daisyUI delays the bubble, so "nothing painted" has to be asserted
  // *after* the pseudo-element is fully opaque — otherwise this passes by
  // being early rather than by being clipped.
  await expect
    .poll(() => clipped.evaluate((el) => getComputedStyle(el, "::before").opacity))
    .toBe("1");
  const after = await pixelSignature(page, beyond);

  expect(
    await changedPixels(page, before, after),
    "a fully opaque bubble painting nothing outside the scroller is the clipping this story documents",
  ).toBe(0);

  // The fallback that makes the clipped case survivable: the browser
  // paints a `title` outside the page entirely, where no ancestor's
  // `overflow` can reach it.
  await expect(clipped).toHaveAttribute("title", /You will still see this/);
});

test("the same tooltip outside a scroller really does paint its bubble", async ({ page }) => {
  await openStory(page, STORY.tooltipClipped);
  // The control half of the story: identical component, no scrolling
  // ancestor. Without this, the test above would also pass if `Tooltip`
  // had simply stopped rendering a bubble anywhere.
  const free = storyRoot(page).locator(".tooltip").nth(1);
  const band = await clampToViewport(page, await pseudoRect(free, "::before"));

  const before = await pixelSignature(page, band);
  await free.hover();
  await expect
    .poll(() => free.evaluate((el) => getComputedStyle(el, "::before").opacity))
    .toBe("1");
  const after = await pixelSignature(page, band);

  expect(
    await changedPixels(page, before, after),
    "the unclipped bubble has to actually paint",
  ).toBeGreaterThan(500);
});

test("the clipped bubble still grows the scroller's scrollable width", async ({ page }) => {
  await openStory(page, STORY.tooltipClipped);
  const scroller = storyRoot(page).locator("div.overflow-y-auto").first();
  const measured = await scroller.evaluate((el) => ({
    clientWidth: el.clientWidth,
    scrollWidth: el.scrollWidth,
  }));

  // The stray horizontal scrollbar, which is the *other* symptom of the
  // same cause — `side-nav.tsx` measured it as `clientWidth 40 /
  // scrollWidth 212` before it dropped `.tooltip` entirely. Asserted
  // because the story documents it as still true here, not because it is
  // desirable: it is the visible cost of keeping the styled bubble.
  expect(measured.scrollWidth).toBeGreaterThan(measured.clientWidth);
});

/**
 * The `position` prop, checked against pixels rather than against the
 * class it sets — and this one is not hypothetical.
 *
 * `Tooltip` composes its side class as `` `tooltip-${position}` ``, so
 * the strings `tooltip-bottom`, `tooltip-left` and `tooltip-right` exist
 * in no source file, and Tailwind v4 emits daisyUI component CSS only for
 * candidates its scanner has actually seen. In the `storybook-static`
 * build this task started against, the stylesheet contained `.tooltip`,
 * `.tooltip-content` and `.tooltip-open` and nothing else — all four
 * bubbles in `Positions` rendered *above* their trigger, measured, and
 * the prop did nothing. Rebuilding the same component source against the
 * current tree emits all four rules and the prop works.
 *
 * Nothing in the component decides which of those two builds you get.
 * This test is what notices.
 */
test("each bubble is painted on the side its `position` asked for", async ({ page }) => {
  await openStory(page, STORY.tooltipPositions);
  const tooltips = storyRoot(page).locator(".tooltip");
  await expect(tooltips).toHaveCount(4);

  const sides: string[] = [];
  for (let index = 0; index < 4; index += 1) {
    const tip = tooltips.nth(index);
    const host = await box(tip);
    const bubble = await pseudoRect(tip, "::before");
    if (bubble.y + bubble.height <= host.y) sides.push("top");
    else if (bubble.y >= host.y + host.height) sides.push("bottom");
    else if (bubble.x + bubble.width <= host.x) sides.push("left");
    else if (bubble.x >= host.x + host.width) sides.push("right");
    else sides.push("overlapping its trigger");
  }

  expect(sides, "the side each bubble is actually painted on").toEqual([
    "top",
    "bottom",
    "left",
    "right",
  ]);
});
