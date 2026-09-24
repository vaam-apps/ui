import { expect, type Page, test } from "@playwright/test";
import { box, openStory, settleTransitions, storyRoot } from "./helpers";
import { STORY } from "./story-ids";

/**
 * Where a `Select`'s dropdown lands from `sm` up (`useDropdownPlacement`
 * in `select.tsx`): Floating UI, `position: fixed`, rendered inline.
 *
 * It used to be `absolute` under its trigger, so any scrolling ancestor
 * clipped it — inside a `Dialog`, one row of a 346px search view showed.
 * Each test here reads the render: where the dropdown is relative to its
 * trigger, and whether its bottom edge is actually painted (a hit test
 * there lands inside it) rather than merely laid out.
 */

const DESKTOP = { width: 1280, height: 800 };
const surface = (page: Page) => page.locator("[data-select-content]");

async function openInDialog(page: Page, size: { width: number; height: number }, name: string) {
  await openStory(page, STORY.selectSearchableInDialog, size);
  await storyRoot(page).getByRole("button", { name: "Open dialog" }).click();
  const trigger = page.getByRole("button", { name });
  await expect(trigger).toBeVisible();
  await settleTransitions(page);
  await trigger.click();
  await expect(surface(page)).toBeVisible();
  await settleTransitions(page);
  return trigger;
}

/** A hit test just inside the dropdown's bottom edge lands inside it —
 * what a clipping ancestor makes false. */
async function paintedToItsBottom(page: Page) {
  return surface(page).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.bottom - 6);
    return hit !== null && element.contains(hit);
  });
}

for (const [engine, name] of [
  ["searchable", "Country"],
  ["plain", "Channel"],
] as const) {
  test(`${engine}, in a Dialog: the dropdown floats over the dialog, 4px under its trigger`, async ({
    page,
  }) => {
    const trigger = await box(await openInDialog(page, DESKTOP, name));
    const rect = await box(surface(page));
    expect(rect.y - (trigger.y + trigger.height), "4px under the trigger").toBeCloseTo(4, 0);
    expect(rect.x, "aligned with the trigger").toBeCloseTo(trigger.x, 0);
    expect(await paintedToItsBottom(page), "the dialog's body clipped the dropdown").toBe(true);
  });
}

test("with reasonable room below, it shrinks to fit there rather than flip above", async ({
  page,
}) => {
  // The docked search view is 346px tall. Pushed down the page so that
  // 228px are left under the trigger and far more above it: it stays
  // below, shorter. Flipping first would have put it above.
  await openStory(page, STORY.selectSearchableDesktop, DESKTOP);
  await page.keyboard.press("Escape");
  await expect(surface(page)).toHaveCount(0);
  await page.evaluate(() => {
    (document.getElementById("storybook-root") as HTMLElement).style.paddingTop = "480px";
  });
  const triggerLocator = storyRoot(page).getByRole("button", { name: "Country" });
  const trigger = await box(triggerLocator);
  const roomBelow = DESKTOP.height - (trigger.y + trigger.height) - 4 - 8;
  expect(roomBelow, "the setup no longer leaves 200–346px under the trigger").toBeGreaterThan(200);
  expect(roomBelow).toBeLessThan(346);
  await triggerLocator.click();
  await expect(page.getByRole("combobox")).toBeFocused();
  await settleTransitions(page);
  const rect = await box(surface(page));
  expect(rect.y, "it flipped above the trigger").toBeGreaterThan(trigger.y + trigger.height);
  expect(rect.y + rect.height, "it runs past the window's bottom edge").toBeLessThanOrEqual(
    DESKTOP.height - 8 + 1,
  );
});

test("with too little room below and enough above, it flips above its trigger", async ({
  page,
}) => {
  // 1280×420: the Channel trigger sits low in the dialog, ~110px above
  // the window's bottom edge, with ~240px above it.
  const trigger = await box(await openInDialog(page, { width: 1280, height: 420 }, "Channel"));
  const rect = await box(surface(page));
  expect(trigger.y - (rect.y + rect.height), "4px above the trigger").toBeCloseTo(4, 0);
  expect(await paintedToItsBottom(page)).toBe(true);
});

test("with too little room on either side, it stays on the window, shorter", async ({ page }) => {
  // 1280×420: the Country trigger has ~186px below and ~170px above —
  // neither side holds the 200px minimum, so it keeps the better side and
  // shrinks to it instead of running off the edge.
  const trigger = await box(await openInDialog(page, { width: 1280, height: 420 }, "Country"));
  const rect = await box(surface(page));
  expect(rect.y).toBeGreaterThan(trigger.y + trigger.height);
  expect(rect.y + rect.height, "past the window's bottom edge").toBeLessThanOrEqual(420 - 8 + 1);
  expect(await paintedToItsBottom(page)).toBe(true);
});

test("inside a drawer, whose transform makes it the containing block, it still lands under its trigger", async ({
  page,
}) => {
  // vaul stamps `will-change: transform` on the drawer, so a `fixed`
  // dropdown inside it is positioned against the drawer, 600px in from
  // the window's left edge at this width — coordinates taken from the
  // viewport would put it that far off.
  await openStory(page, STORY.selectInsideADrawer, DESKTOP);
  await storyRoot(page).getByRole("button", { name: "Open drawer" }).click();
  const triggerLocator = page.getByRole("button", { name: "Provider" });
  await expect(triggerLocator).toBeVisible();
  await settleTransitions(page);
  await triggerLocator.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await settleTransitions(page);
  const trigger = await box(triggerLocator);
  const rect = await box(surface(page));
  expect(rect.y - (trigger.y + trigger.height)).toBeCloseTo(4, 0);
  expect(rect.x).toBeCloseTo(trigger.x, 0);
  expect(rect.width).toBeCloseTo(trigger.width, 0);
});
