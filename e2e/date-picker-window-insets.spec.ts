import { expect, test } from "@playwright/test";
import { box, openStory, settleTransitions, storyRoot } from "./helpers";
import { STORY } from "./story-ids";

/**
 * `useWindowInsets` (`date-picker.tsx`) with a classic scrollbar shown.
 *
 * Where `position: fixed` resolves against something other than the
 * window, the picker measures the insets that make the window its box
 * again. The page's scroll lock then hides the scrollbar, which widens the
 * window by it — and a measurement taken before the lock centred the
 * modal off by half a scrollbar (7.5px, found in review). Headless
 * Chromium hides scrollbars by default, which makes that width 0 in every
 * other spec; this one shows them, and first asserts there is one.
 */
test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

test("a modal in a transformed container centres in the window the lock leaves", async ({
  page,
}) => {
  await openStory(page, STORY.datePickerModalDesktop, { width: 1280, height: 800 });
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-date-picker]")).toHaveCount(0);
  await page.evaluate(() => {
    document.body.style.minHeight = "3000px";
    const root = document.getElementById("storybook-root");
    if (root !== null) root.style.transform = "translateZ(0)";
  });
  const gutter = await page.evaluate(
    () => window.innerWidth - document.documentElement.clientWidth,
  );
  expect(gutter, "no scrollbar on the page: this test would measure nothing").toBeGreaterThan(0);

  await storyRoot(page).getByRole("button", { name: "Send on" }).click();
  const modal = page.locator("[data-date-picker]");
  await expect(modal).toBeVisible();
  await settleTransitions(page);
  const width = await page.evaluate(() => document.documentElement.clientWidth);
  expect(width, "the lock did not hide the scrollbar").toBe(1280);
  const rect = await box(modal);
  expect(rect.x, "failed: centred on the window with its scrollbar").toBeCloseTo(
    (width - rect.width) / 2,
    0,
  );
});
