import { expect, test } from "@playwright/test";
import { openStory, settleTransitions, storyRoot } from "./helpers";
import { STORY } from "./story-ids";

/**
 * A searchable `Select` locks the page's scroll while it is open, and pads
 * `<html>` by the scrollbar the lock hides (`lockScroll` in `select.tsx`,
 * `--select-scroll-gap` in `theme.css`), so the page does not shift
 * sideways on every open and close.
 *
 * Headless Chromium hides scrollbars by default, which makes that gap 0 in
 * every other spec — the padding could be deleted and nothing would
 * notice. This file launches with scrollbars shown, and first asserts
 * that the page really has one, so it cannot pass by measuring nothing.
 */
test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

test("opening a searchable select does not shift the page by the hidden scrollbar", async ({
  page,
}) => {
  await openStory(page, STORY.selectSearchableDesktop, { width: 1280, height: 800 });
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-select-content]")).toHaveCount(0);
  // A page taller than the viewport, so it has a classic scrollbar.
  await page.evaluate(() => {
    document.body.style.minHeight = "3000px";
  });
  const gutter = await page.evaluate(
    () => window.innerWidth - document.documentElement.clientWidth,
  );
  expect(gutter, "no scrollbar on the page: this test would measure nothing").toBeGreaterThan(0);

  const width = () => page.evaluate(() => document.body.getBoundingClientRect().width);
  const before = await width();
  await storyRoot(page).getByRole("button", { name: "Country" }).click();
  await expect(page.getByRole("combobox")).toBeFocused();
  await settleTransitions(page);
  expect(
    await page.evaluate(() => getComputedStyle(document.documentElement).overflow),
    "the lock is not on",
  ).toBe("hidden");
  expect(await width(), "the page widened by the scrollbar the lock hid").toBeCloseTo(before, 0);
});
