import { expect, type Page, test } from "@playwright/test";
import { box, openStory, settleTransitions, storyRoot } from "./helpers";
import { STORY } from "./story-ids";

/**
 * The compound `Select`'s searchable engine (a `SelectSearch` makes it a
 * Headless UI `Combobox`) and its two fixed containers, `SelectDropdown`
 * and `SelectModal`. `select.tsx` makes a string of claims here that only
 * a real browser can check — where focus goes after each way of closing,
 * which parts of the page are inert, what "full-screen" measures inside a
 * transformed drawer — so each one has a test that reads the render.
 */

const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1280, height: 800 };

const surface = (page: Page) => page.locator("[data-select-content]");
const field = (page: Page) => page.getByRole("combobox");

async function openedByPlay(page: Page) {
  await expect(field(page)).toBeFocused();
  await settleTransitions(page);
}

test.describe("searchable, on a phone: M3's full-screen search view", () => {
  test("covers the viewport, with a 72px header, and focus in the field", async ({ page }) => {
    await openStory(page, STORY.selectSearchablePhone, PHONE);
    await openedByPlay(page);
    const rect = await box(surface(page));
    expect([rect.x, rect.y, rect.width, rect.height]).toEqual([0, 0, PHONE.width, PHONE.height]);
    const header = await box(surface(page).locator(":scope > div").first());
    // `SearchViewTokens.FullScreenHeaderContainerHeight`.
    expect(header.height).toBeCloseTo(72, 0);
  });

  test("filters accent-insensitively and by `textValue`", async ({ page }) => {
    await openStory(page, STORY.selectSearchablePhone, PHONE);
    await openedByPlay(page);
    const options = page.getByRole("option");
    await page.keyboard.type("cote");
    await expect(options).toHaveText(["Côte d’Ivoire"]);
    await page.keyboard.press("ControlOrMeta+a");
    // "CM" is in Cameroon's `textValue`, never shown.
    await page.keyboard.type("CM");
    await expect(options).toHaveText(["Cameroon"]);
  });

  test("shows no empty state while anything matches", async ({ page }) => {
    // The count used to come from walking `children`, which cannot see
    // items rendered by the story's own `<CountryItems />` component — and
    // "No match" sat under three real matches.
    await openStory(page, STORY.selectSearchablePhone, PHONE);
    await openedByPlay(page);
    await page.keyboard.type("gu");
    await expect(page.getByRole("option")).toHaveCount(3);
    await expect(page.getByRole("status")).toHaveCount(0);
  });

  test("the clear button empties the field and keeps the view open", async ({ page }) => {
    await openStory(page, STORY.selectSearchablePhone, PHONE);
    await openedByPlay(page);
    await page.keyboard.type("gha");
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(field(page)).toHaveValue("");
    await expect(field(page)).toBeFocused();
    await expect(page.getByRole("option")).toHaveCount(30);
  });

  test("the back arrow closes it and returns focus to the trigger", async ({ page }) => {
    await openStory(page, STORY.selectSearchablePhone, PHONE);
    await openedByPlay(page);
    await page.getByRole("button", { name: "Back" }).click();
    await expect(surface(page)).toHaveCount(0);
    await expect(storyRoot(page).getByRole("button", { name: "Country" })).toBeFocused();
  });

  test("keyboard: Tab reaches the trigger, Enter opens into the field, ↓ Enter picks", async ({
    page,
  }) => {
    await openStory(page, STORY.selectSearchablePhone, PHONE);
    await openedByPlay(page);
    await page.keyboard.press("Escape");
    await expect(surface(page)).toHaveCount(0);
    const trigger = storyRoot(page).getByRole("button", { name: "Country" });
    await expect(trigger).toBeFocused();
    // Headless UI's `ComboboxButton` hard-codes `tabIndex: -1`; the
    // trigger resets it after mount, or Tab would skip it entirely.
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(field(page)).toBeFocused();
    await page.keyboard.type("gha");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(surface(page)).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(storyRoot(page).getByText("value: Ghana")).toBeVisible();
  });

  test("while open the page is inert and does not scroll; closing restores both", async ({
    page,
  }) => {
    await openStory(page, STORY.selectSearchablePhone, PHONE);
    await openedByPlay(page);
    const value = storyRoot(page).getByText(/^value:/);
    const state = () =>
      page.evaluate(() => ({
        overflow: document.documentElement.style.overflow,
        inert: [...document.querySelectorAll("[inert]")].length,
      }));
    expect(await value.evaluate((el) => el.closest("[inert]") !== null), "page text is inert").toBe(
      true,
    );
    expect((await state()).overflow).toBe("hidden");
    await page.keyboard.press("Escape");
    await expect(surface(page)).toHaveCount(0);
    expect(await state()).toEqual({ overflow: "", inert: 0 });
  });
});

test("a caller's SelectEmpty is what the empty state says", async ({ page }) => {
  await openStory(page, STORY.selectSearchEmpty, PHONE);
  await expect(page.getByRole("status")).toContainText("No country matches");
  await expect(page.getByRole("option")).toHaveCount(0);
});

test.describe("searchable, on a desktop: M3's docked search view", () => {
  test("sits under the trigger with a 56px header and no back arrow", async ({ page }) => {
    await openStory(page, STORY.selectSearchableDesktop, DESKTOP);
    await openedByPlay(page);
    const trigger = await box(storyRoot(page).getByRole("button", { name: "Country" }));
    const rect = await box(surface(page));
    expect(rect.y - (trigger.y + trigger.height), "4px under the trigger").toBeCloseTo(4, 0);
    expect(rect.width).toBeCloseTo(trigger.width, 0);
    const header = await box(surface(page).locator(":scope > div").first());
    // `SearchViewTokens.DockedHeaderContainerHeight`.
    expect(header.height).toBeCloseTo(56, 0);
    await expect(page.getByRole("button", { name: "Back" })).toBeHidden();
  });

  test("a click outside closes it and returns focus to the trigger", async ({ page }) => {
    await openStory(page, STORY.selectSearchableDesktop, DESKTOP);
    await openedByPlay(page);
    await page.mouse.click(900, 600);
    await expect(surface(page)).toHaveCount(0);
    await expect(storyRoot(page).getByRole("button", { name: "Country" })).toBeFocused();
  });
});

test.describe("searchable, inside a drawer", () => {
  async function openInDrawer(page: Page) {
    await openStory(page, STORY.selectSearchableInDrawer, PHONE);
    await storyRoot(page).getByRole("button", { name: "Open drawer" }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await settleTransitions(page);
    const trigger = page.getByRole("button", { name: "Country" });
    await trigger.click();
    await expect(field(page)).toBeFocused();
    await settleTransitions(page);
    return { drawer, trigger };
  }

  test("full-screen means the viewport, not the drawer", async ({ page }) => {
    // `inset-0` inside vaul's transformed drawer resolved against the
    // drawer: a 301px-tall "full screen". Pinned to the bottom, `100dvh`.
    await openInDrawer(page);
    const rect = await box(surface(page));
    expect([rect.x, rect.y, rect.width, rect.height]).toEqual([0, 0, PHONE.width, PHONE.height]);
  });

  for (const how of ["Escape", "the back arrow", "picking a country"] as const) {
    test(`${how} closes the search alone`, async ({ page }) => {
      const { drawer, trigger } = await openInDrawer(page);
      if (how === "Escape") await page.keyboard.press("Escape");
      if (how === "the back arrow") await page.getByRole("button", { name: "Back" }).click();
      if (how === "picking a country") {
        await page.keyboard.type("keny");
        await page.keyboard.press("Enter");
      }
      await expect(surface(page)).toHaveCount(0);
      await page.waitForTimeout(600);
      await expect(drawer).toHaveAttribute("data-state", "open");
      await expect(trigger).toBeFocused();
    });
  }
});

test("SelectDropdown keeps the dropdown on a phone", async ({ page }) => {
  await openStory(page, STORY.selectDropdownOnPhone, PHONE);
  const list = storyRoot(page).getByRole("listbox");
  await expect(list).toBeVisible();
  expect(await list.evaluate((el) => getComputedStyle(el).position)).toBe("absolute");
  await expect(list.locator("[data-sheet-handle]")).toHaveCount(0);
});

test("SelectModal is a centred 640px sheet on a desktop, and SelectClose closes it", async ({
  page,
}) => {
  await openStory(page, STORY.selectModalOnDesktop, DESKTOP);
  const sheet = storyRoot(page).getByRole("listbox");
  await expect(sheet).toBeVisible();
  await settleTransitions(page);
  const rect = await box(sheet);
  // `BottomSheetDefaults.SheetMaxWidth`.
  expect(rect.width).toBeCloseTo(640, 0);
  expect(rect.x).toBeCloseTo((DESKTOP.width - 640) / 2, 0);
  expect(rect.y + rect.height).toBeCloseTo(DESKTOP.height, 0);
  await expect(sheet.locator("[data-sheet-handle]")).toBeVisible();
  await storyRoot(page).getByText("Done").click();
  await expect(sheet).toHaveCount(0);
  await expect(storyRoot(page).getByRole("button", { name: "Retry policy" })).toBeFocused();
});
