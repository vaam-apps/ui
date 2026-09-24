import { createRequire } from "node:module";
import { devices, expect, type Page, test } from "@playwright/test";
import { box, openStory, paintedColors, settleTransitions, storyRoot } from "./helpers";
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
    await expect(surface(page).getByText("No match")).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveText("");
  });

  test('says "No match" by itself, visibly and in the live region that was already there', async ({
    page,
  }) => {
    await openStory(page, STORY.selectSearchablePhone, PHONE);
    await openedByPlay(page);
    // Mounted, empty, before anything is typed: a live region inserted
    // already holding its message is not reliably announced.
    await expect(page.getByRole("status")).toHaveText("");
    await page.keyboard.type("zzzz");
    await expect(page.getByRole("status")).toHaveText("No match");
    await expect(surface(page).getByText("No match").first()).toBeVisible();
  });

  test("Enter with nothing to pick keeps the view and the search", async ({ page }) => {
    // The popup's own window listener stops the key before anything else
    // sees it, so the event is recorded by a listener registered ahead of
    // it, at page load, and read after dispatch: its default must be
    // prevented, or Enter in the field submits a surrounding `<form>`.
    await page.addInitScript(() => {
      window.addEventListener(
        "keydown",
        (event) => {
          if (event.key === "Enter") (window as { lastEnter?: Event }).lastEnter = event;
        },
        true,
      );
    });
    await openStory(page, STORY.selectSearchablePhone, PHONE);
    await openedByPlay(page);
    await page.keyboard.type("zzzz");
    await page.keyboard.press("Enter");
    await expect(surface(page)).toHaveCount(1);
    await expect(field(page)).toHaveValue("zzzz");
    expect(
      await page.evaluate(() => (window as { lastEnter?: Event }).lastEnter?.defaultPrevented),
      "Enter's default was left to the browser: a surrounding form would submit",
    ).toBe(true);
  });

  test("the field is named after its select", async ({ page }) => {
    await openStory(page, STORY.selectSearchablePhone, PHONE);
    await openedByPlay(page);
    await expect(page.getByRole("combobox", { name: "Search Country" })).toBeFocused();
  });

  test("focus moving onto Back or Clear does not close the view", async ({ page }) => {
    // A screen reader's cursor, or a caller's `.focus()`: the field's blur
    // used to be the combobox's close, and the view went before the button
    // could be pressed.
    await openStory(page, STORY.selectSearchablePhone, PHONE);
    await openedByPlay(page);
    await page.keyboard.type("gh");
    await page.getByRole("button", { name: "Clear search" }).focus();
    await expect(surface(page)).toHaveCount(1);
    await page.getByRole("button", { name: "Back" }).focus();
    await expect(surface(page)).toHaveCount(1);
    await page.keyboard.press("Enter");
    await expect(surface(page)).toHaveCount(0);
    await expect(storyRoot(page).getByRole("button", { name: "Country" })).toBeFocused();
  });

  test("Tab from Back or Clear closes the view, as Tab from the field does", async ({ page }) => {
    // Focus there is kept from closing the view (above); a Tab from there
    // used to leave the view open with focus on `<body>`, out of Escape's
    // reach.
    await openStory(page, STORY.selectSearchablePhone, PHONE);
    await openedByPlay(page);
    await page.keyboard.type("gh");
    await page.getByRole("button", { name: "Clear search" }).focus();
    await page.keyboard.press("Tab");
    await expect(surface(page)).toHaveCount(0);
    // Parked on the trigger and moved on from there, as from the field —
    // nothing follows the trigger in this story, so back is where it is.
    await page.keyboard.press("Shift+Tab");
    await expect(storyRoot(page).getByRole("button", { name: "Country" })).toBeFocused();
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
    expect(
      await page.evaluate(() => getComputedStyle(document.documentElement).overflow),
      "the page is scroll-locked",
    ).toBe("hidden");
    // Climbs to `<html>`: body-level siblings — where portals live — too.
    expect(
      await page.evaluate(() =>
        [...document.body.children].some(
          (child) =>
            child instanceof HTMLElement && child.inert && !child.contains(document.activeElement),
        ),
      ),
      "a body-level sibling of the story is inert",
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(surface(page)).toHaveCount(0);
    expect(await state()).toEqual({ overflow: "", inert: 0 });
    expect(
      await page.evaluate(() => document.documentElement.hasAttribute("data-select-scroll-lock")),
    ).toBe(false);
  });

  test("Tab from the field moves on without picking anything", async ({ page }) => {
    // Headless UI's combobox Tab selects the active option, and it makes
    // the first option active on open: this used to fill the field with
    // "Angola".
    await openStory(page, STORY.selectSearchableDesktop, DESKTOP);
    await openedByPlay(page);
    const trigger = storyRoot(page).getByRole("button", { name: "Country" });
    await page.keyboard.press("Tab");
    await expect(surface(page)).toHaveCount(0);
    await expect(storyRoot(page).getByText("value: —")).toBeVisible();
    await expect(trigger).not.toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(trigger).toBeFocused();
  });

  test("Shift+Tab from the field moves back without picking anything", async ({ page }) => {
    await openStory(page, STORY.selectSearchableDesktop, DESKTOP);
    await openedByPlay(page);
    await page.keyboard.press("Shift+Tab");
    await expect(surface(page)).toHaveCount(0);
    await expect(storyRoot(page).getByText("value: —")).toBeVisible();
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

test.describe("searchable, inside a Dialog", () => {
  async function openSelect(page: Page) {
    await openStory(page, STORY.selectSearchableInDialog, DESKTOP);
    await storyRoot(page).getByRole("button", { name: "Open dialog" }).click();
    const trigger = page.getByRole("button", { name: "Country" });
    await expect(trigger).toBeVisible();
    await settleTransitions(page);
    await trigger.click();
    await expect(field(page)).toBeFocused();
  }

  /**
   * The blocker: picking closed the select *and* the dialog in one commit,
   * the dialog's own cleanup ran first, and the select then restored the
   * inert/overflow it had snapshotted from the dialog — leaving the page
   * inert and unscrollable until a reload.
   */
  for (const how of ["the keyboard", "a click"] as const) {
    test(`a pick by ${how} that closes the dialog leaves the page alive`, async ({ page }) => {
      await openSelect(page);
      if (how === "the keyboard") {
        await page.keyboard.type("gha");
        await page.keyboard.press("Enter");
      } else {
        await page.getByRole("option", { name: "Ghana" }).click();
      }
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(storyRoot(page).getByText("value: Ghana")).toBeVisible();
      await page.waitForTimeout(600);
      const alive = await page.evaluate(() => ({
        inert: [...document.querySelectorAll("[inert]")].length,
        overflow: getComputedStyle(document.documentElement).overflow,
        lock: document.documentElement.hasAttribute("data-select-scroll-lock"),
      }));
      expect(alive).toEqual({ inert: 0, overflow: "visible", lock: false });
      // And the page answers: the dialog opens again. (Its title, not its
      // `role="dialog"` element — Headless UI's is a zero-size wrapper
      // around a fixed panel, which Playwright reports as hidden.)
      await storyRoot(page).getByRole("button", { name: "Open dialog" }).click();
      await expect(page.getByRole("heading", { name: "Choose where to send from" })).toBeVisible();
    });
  }

  test("Escape closes the select alone, and the dialog stays modal", async ({ page }) => {
    // The dialog inerted the page first; the select must leave what it did
    // not do itself. Un-inerting every sibling on close handed the page
    // back to the pointer while the dialog was still open.
    await openSelect(page);
    await page.keyboard.press("Escape");
    await expect(surface(page)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Choose where to send from" })).toBeVisible();
    expect(
      await page.evaluate(() => (document.getElementById("storybook-root") as HTMLElement).inert),
      "the dialog's inert on the page was undone by the select closing",
    ).toBe(true);
  });

  test('an option whose value is "" can be picked, and the trigger then shows it', async ({
    page,
  }) => {
    await openSelect(page);
    // Nothing is picked yet, so "Any country" is not the selected option:
    // `""` used to double as "nothing picked" and marked it selected.
    const any = page.getByRole("option", { name: "Any country" });
    await expect(any).toHaveAttribute("aria-selected", "false");
    await any.click();
    await expect(storyRoot(page).getByText("value: (any)")).toBeVisible();
    // The pick closed the dialog; reopened, the trigger reads the pick,
    // not the placeholder it used to fall back to for `""`.
    await storyRoot(page).getByRole("button", { name: "Open dialog" }).click();
    await expect(page.getByRole("button", { name: "Country" })).toHaveText("Any country");
  });

  test("a SelectClose written inside the list keeps the listbox valid (axe)", async ({ page }) => {
    await openSelect(page);
    const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
    await page.addScriptTag({ path: axePath });
    const violations = await page.evaluate(async () => {
      const axe = (
        window as unknown as {
          axe: { run: (n: Element, o: unknown) => Promise<{ violations: { id: string }[] }> };
        }
      ).axe;
      const node = document.querySelector("[data-select-content]");
      if (node === null) throw new Error("the popup is not open");
      const result = await axe.run(node, {
        runOnly: [
          "aria-required-children",
          "presentation-role-conflict",
          "aria-allowed-role",
          "aria-hidden-focus",
        ],
      });
      return result.violations.map((violation) => violation.id);
    });
    expect(violations).toEqual([]);
  });
});

test("a remote search keeps the chosen label when the results no longer include it", async ({
  page,
}) => {
  // `filter={false}` + `onQueryChange`: the caller's results replace the
  // items, and the trigger used to fall back to the raw value — here an id,
  // `prv_106`, which is why the story's values are not its names.
  await openStory(page, STORY.selectCallerFiltered, DESKTOP);
  const trigger = storyRoot(page).getByRole("button", { name: "Provider" });
  await trigger.click();
  await expect(field(page)).toBeFocused();
  await page.keyboard.type("safari");
  await expect(page.getByRole("option")).toHaveText(["Safaricom"]);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(trigger).toHaveText(/Safaricom/);
  await trigger.click();
  await page.keyboard.type("orange");
  await expect(page.getByRole("option")).toHaveText(["Orange Cameroon"]);
  await expect(trigger).toHaveText(/Safaricom/);
});

test("a searchable SelectModal on a desktop is the sheet's 640px, centred, full height", async ({
  page,
}) => {
  await openStory(page, STORY.selectSearchableModalOnDesktop, DESKTOP);
  await openedByPlay(page);
  const rect = await box(surface(page));
  expect(rect.width).toBeCloseTo(640, 0);
  expect(rect.x).toBeCloseTo((DESKTOP.width - 640) / 2, 0);
  expect(rect.y).toBeCloseTo(0, 0);
  expect(rect.height).toBeCloseTo(DESKTOP.height, 0);
  expect(await surface(page).evaluate((el) => getComputedStyle(el).borderTopLeftRadius)).toBe(
    "28px",
  );
  // And the scrim, in pixels (the sheet spec's note says why not the
  // computed `box-shadow`): the field's label, left of the 640px sheet,
  // read with the modal open and then closed.
  const label = await box(storyRoot(page).getByText("Country", { exact: true }));
  const brightest = (colours: readonly (readonly [number, number, number])[]) =>
    Math.max(...colours.map(([r, g, b]) => r + g + b));
  const dimmed = brightest(await paintedColors(page, label));
  await page.keyboard.press("Escape");
  await expect(surface(page)).toHaveCount(0);
  await settleTransitions(page);
  const clear = brightest(await paintedColors(page, label));
  expect(dimmed, "brightest pixel beside the open modal").toBeLessThan(clear * 0.75);
});

test("the vertical toolbar steps out of the way while a SelectModal is open", async ({ page }) => {
  // Its scrim is a shadow, which cannot catch a tap; the toolbar is
  // portalled to `body`, beyond the plain engine's inert — so it stayed
  // clickable, and navigable, under the scrim.
  await openStory(page, STORY.sideNavRailUnderModalSelect, { width: 900, height: 700 });
  const rail = page.locator("[data-floating-rail]:not([data-floating-rail-axis])");
  await expect(storyRoot(page).getByRole("listbox")).toBeVisible();
  expect(await rail.evaluate((el) => getComputedStyle(el).visibility)).toBe("hidden");
  await page.keyboard.press("Escape");
  await expect(storyRoot(page).getByRole("listbox")).toHaveCount(0);
  expect(await rail.evaluate((el) => getComputedStyle(el).visibility)).toBe("visible");
  // Only a modal: an ordinary dropdown beside the toolbar leaves it alone.
  await storyRoot(page).getByRole("button", { name: "Sort by" }).click();
  await expect(storyRoot(page).getByRole("listbox")).toBeVisible();
  expect(await rail.evaluate((el) => getComputedStyle(el).visibility)).toBe("visible");
});

test.describe("on a touch device", () => {
  test.use({ hasTouch: true, isMobile: true, userAgent: devices["Pixel 5"].userAgent });

  test("taps on the header, the divider and Clear keep the view open", async ({ page }) => {
    // Headless UI's outside-click listens to `touchend` on a mobile user
    // agent, and the popup's chrome is "outside" to it: the chrome's taps
    // are stopped before it. No other test runs this path.
    await openStory(page, STORY.selectSearchablePhone, PHONE);
    await openedByPlay(page);
    await page.keyboard.type("gh");
    const header = await box(surface(page).locator(":scope > div").first());
    await page.touchscreen.tap(PHONE.width / 2, header.y + header.height - 1);
    await expect(surface(page)).toHaveCount(1);
    await page.getByRole("button", { name: "Clear search" }).tap();
    await expect(surface(page)).toHaveCount(1);
    await expect(field(page)).toHaveValue("");
  });
});
