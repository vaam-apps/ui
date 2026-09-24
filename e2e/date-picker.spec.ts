import { expect, type Locator, type Page, test } from "@playwright/test";
import { box, openStory, pseudoRect, settleTransitions, storyRoot } from "./helpers";
import { STORY } from "./story-ids";

/**
 * `DatePicker` and `DateRangePicker` (`date-picker.tsx`): M3's docked,
 * modal and full-screen date pickers, a pick staged until OK. Every test
 * reads the render — geometry, computed style, what a click does — and
 * every assertion message says what went wrong, prefixed "failed:".
 *
 * The first block is the failure this rework exists for: the previous
 * picker portalled its calendar out of a drawer, where vaul left it
 * `pointer-events: none`, and a day could not be clicked at any width.
 */

const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1280, height: 800 };

const picker = (page: Page) => page.locator("[data-date-picker]");
const valueLine = (page: Page) => storyRoot(page).getByText(/^value: /);

/** A day in the open picker, by its ISO date, in whichever tree is shown. */
const day = (page: Page, iso: string) =>
  picker(page).locator(`td[data-day="${iso}"] button:visible`);

async function open(page: Page, trigger: Locator) {
  await trigger.click();
  await expect(picker(page), "failed: the picker did not open").toBeVisible();
  await settleTransitions(page);
}

async function openDrawer(page: Page) {
  await storyRoot(page).getByRole("button", { name: "Open drawer" }).click();
  const drawer = page.getByRole("dialog", { name: "Reschedule the broadcast" });
  await expect(drawer, "failed: the drawer did not open").toBeVisible();
  await settleTransitions(page);
  return drawer;
}

test.describe("inside a drawer — the failure this rework fixes", () => {
  for (const size of [PHONE, DESKTOP]) {
    test(`a day can be picked and committed at ${size.width}px, and the drawer stays open`, async ({
      page,
    }) => {
      await openStory(page, STORY.datePickerInDrawer, size);
      const drawer = await openDrawer(page);
      await open(page, drawer.getByRole("button", { name: "Send on" }));
      await expect(
        drawer.locator("[data-date-picker]"),
        "failed: the picker is not rendered inside the drawer",
      ).toBeVisible();
      // Today's month, whatever today is: the 15th exists in every one.
      const fifteenth = picker(page).locator('td[data-day$="-15"] button:visible');
      await fifteenth.click({ timeout: 5_000 });
      await picker(page).getByRole("button", { name: "OK" }).click();
      await expect(picker(page), "failed: OK did not close the picker").toHaveCount(0);
      await expect(valueLine(page), "failed: OK did not commit the day").toHaveText(
        /^value: \d{4}-\d{2}-15$/,
      );
      await page.waitForTimeout(600);
      await expect(drawer, "failed: committing closed the drawer").toHaveAttribute(
        "data-state",
        "open",
      );
    });

    test(`Escape closes the picker, not the drawer, at ${size.width}px`, async ({ page }) => {
      await openStory(page, STORY.datePickerInDrawer, size);
      const drawer = await openDrawer(page);
      const trigger = drawer.getByRole("button", { name: "Send on" });
      await open(page, trigger);
      await page.keyboard.press("Escape");
      await expect(picker(page), "failed: Escape did not close the picker").toHaveCount(0);
      await page.waitForTimeout(600);
      await expect(drawer, "failed: Escape closed the drawer too").toHaveAttribute(
        "data-state",
        "open",
      );
      await expect(trigger, "failed: focus did not return to the trigger").toBeFocused();
      await page.keyboard.press("Escape");
      await expect(drawer, "failed: the next Escape did not close the drawer").toHaveCount(0);
    });
  }

  test("the full-screen range picker fills the window from inside the drawer", async ({ page }) => {
    await openStory(page, STORY.datePickerInDrawer, PHONE);
    const drawer = await openDrawer(page);
    await open(page, drawer.getByRole("button", { name: "Retry between" }));
    const surface = await box(picker(page));
    expect(
      [surface.x, surface.y, surface.width, surface.height],
      "failed: laid out in the drawer, not the window",
    ).toEqual([0, 0, PHONE.width, PHONE.height]);
  });

  test("a date's phone modal centres in the window from inside the drawer", async ({ page }) => {
    await openStory(page, STORY.datePickerInDrawer, PHONE);
    const drawer = await openDrawer(page);
    await open(page, drawer.getByRole("button", { name: "Send on" }));
    const modal = await box(picker(page));
    expect(modal.y + modal.height / 2, "failed: centred in the drawer, not the window").toBeCloseTo(
      PHONE.height / 2,
      0,
    );
    expect(modal.y + modal.height, "failed: the modal runs off the window").toBeLessThanOrEqual(
      PHONE.height,
    );
  });

  test("DatePickerModal centres in the window from inside the drawer", async ({ page }) => {
    await openStory(page, STORY.datePickerInDrawer, DESKTOP);
    const drawer = await openDrawer(page);
    await open(page, drawer.getByRole("button", { name: "Go live" }));
    const modal = await box(picker(page));
    expect(modal.x, "failed: centred in the drawer, not the window").toBeCloseTo(
      (DESKTOP.width - modal.width) / 2,
      0,
    );
    expect(modal.y + modal.height / 2, "failed: not centred in the window").toBeCloseTo(
      DESKTOP.height / 2,
      0,
    );
  });

  test("a press on the page beside the drawer closes the picker, not the drawer", async ({
    page,
  }) => {
    await openStory(page, STORY.datePickerInDrawer, DESKTOP);
    const drawer = await openDrawer(page);
    await open(page, drawer.getByRole("button", { name: "Send on" }));
    const side = await box(drawer);
    expect(side.x, "failed: no page beside the drawer to press").toBeGreaterThan(200);
    await page.mouse.click(side.x / 2, DESKTOP.height / 2);
    await expect(picker(page), "failed: the press did not close the picker").toHaveCount(0);
    await page.waitForTimeout(600);
    await expect(drawer, "failed: the press closed the drawer too").toHaveAttribute(
      "data-state",
      "open",
    );
  });
});

test.describe("inside a Dialog, a press outside closes the picker alone", () => {
  for (const size of [PHONE, DESKTOP]) {
    test(`at ${size.width}px`, async ({ page }) => {
      await openStory(page, STORY.datePickerInDialog, size);
      await storyRoot(page).getByRole("button", { name: "Open dialog" }).click();
      // The dialog's root has no box of its own; its heading is what shows.
      const dialog = page.getByRole("heading", { name: "Schedule the export" });
      await expect(dialog).toBeVisible();
      await settleTransitions(page);
      await open(page, page.getByRole("button", { name: "Export on" }));
      await page.mouse.click(5, 5);
      await expect(picker(page), "failed: the press did not close the picker").toHaveCount(0);
      await page.waitForTimeout(400);
      await expect(dialog, "failed: the press closed the dialog too").toBeVisible();
    });
  }
});

test.describe("inside a consumer's own Radix dialog", () => {
  test("a press outside closes the picker alone, and the click after it does not close the dialog", async ({
    page,
  }) => {
    await openStory(page, STORY.datePickerInRadixDialog, DESKTOP);
    await storyRoot(page).getByRole("button", { name: "Open Radix dialog" }).click();
    const dialog = page.getByRole("dialog", { name: "Pick a cut-off" });
    await expect(dialog).toBeVisible();
    await settleTransitions(page);
    const trigger = dialog.getByRole("button", { name: "Cut-off" });
    await open(page, trigger);
    await page.mouse.click(20, 20);
    await expect(picker(page), "failed: the press did not close the picker").toHaveCount(0);
    await page.waitForTimeout(300);
    await expect(dialog, "failed: the press closed the dialog").toBeVisible();
    // Radix defers an outside dismissal to the click. Hidden from it, the
    // dismissal stayed armed, and this click — Enter on the trigger —
    // closed the dialog.
    await expect(trigger, "failed: focus did not return to the trigger").toBeFocused();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    await expect(dialog, "failed: the next click closed the dialog").toBeVisible();
    await expect(picker(page), "failed: Enter did not reopen the picker").toBeVisible();
  });
});

test.describe("a pick is staged: OK commits it, everything else throws it away", () => {
  test("tapping a day moves the pick, not the value; OK commits it and returns focus", async ({
    page,
  }) => {
    await openStory(page, STORY.datePickerSingle, DESKTOP);
    const trigger = storyRoot(page).getByRole("button", { name: "Send on" });
    await open(page, trigger);
    await day(page, "2026-09-15").click();
    await expect(valueLine(page), "failed: a tap committed the day").toHaveText(
      "value: 2026-09-11",
    );
    await expect(trigger, "failed: the trigger shows the uncommitted pick").toHaveText(
      /2026-09-11/,
    );
    await picker(page).getByRole("button", { name: "OK" }).click();
    await expect(picker(page)).toHaveCount(0);
    await expect(valueLine(page), "failed: OK did not commit").toHaveText("value: 2026-09-15");
    await expect(trigger, "failed: focus did not return to the trigger").toBeFocused();
  });

  const DISMISSALS: [string, (page: Page) => Promise<void>][] = [
    ["Cancel", (page) => picker(page).getByRole("button", { name: "Cancel" }).click()],
    ["Escape", (page) => page.keyboard.press("Escape")],
    ["a press outside", (page) => page.mouse.click(1000, 600)],
  ];
  for (const [name, dismiss] of DISMISSALS) {
    test(`${name} closes the picker and throws the pick away`, async ({ page }) => {
      await openStory(page, STORY.datePickerSingle, DESKTOP);
      await open(page, storyRoot(page).getByRole("button", { name: "Send on" }));
      await day(page, "2026-09-15").click();
      await dismiss(page);
      await expect(picker(page), `failed: ${name} did not close the picker`).toHaveCount(0);
      await expect(valueLine(page), `failed: ${name} committed the pick`).toHaveText(
        "value: 2026-09-11",
      );
      await expect(
        storyRoot(page).getByRole("button", { name: "Send on" }),
        `failed: after ${name}, focus is not back on the trigger`,
      ).toBeFocused();
    });
  }

  test("OK is disabled until there is a date to commit", async ({ page }) => {
    await openStory(page, STORY.datePickerBounded, DESKTOP);
    await open(page, storyRoot(page).getByRole("button", { name: "A weekday this month" }));
    const ok = picker(page).getByRole("button", { name: "OK" });
    await expect(ok, "failed: OK is enabled with nothing picked").toBeDisabled();
    await day(page, "2026-09-10").click();
    await expect(ok, "failed: OK stayed disabled after a pick").toBeEnabled();
  });

  test("Clear empties the value at once, without opening the picker", async ({ page }) => {
    await openStory(page, STORY.datePickerSingle, DESKTOP);
    await storyRoot(page).getByRole("button", { name: "Clear the date" }).click();
    await expect(valueLine(page), "failed: Clear did not empty the value").toHaveText("value: —");
    await expect(picker(page), "failed: Clear opened the picker").toHaveCount(0);
    await expect(
      storyRoot(page).getByRole("button", { name: "Send on" }),
      "failed: the empty trigger does not show its placeholder",
    ).toHaveText(/Pick a date/);
    await expect(
      storyRoot(page).getByRole("button", { name: "Clear the date" }),
      "failed: Clear still shows with nothing to clear",
    ).toHaveCount(0);
  });
});

test.describe("while open, the picker is modal", () => {
  test("the rest of the page is inert and does not scroll, and both lift on close", async ({
    page,
  }) => {
    await openStory(page, STORY.datePickerSingle, DESKTOP);
    await open(page, storyRoot(page).getByRole("button", { name: "Send on" }));
    const state = () =>
      page.evaluate(() => ({
        lock: document.documentElement.hasAttribute("data-select-scroll-lock"),
        overflow: getComputedStyle(document.documentElement).overflow,
        valueInert:
          [...document.querySelectorAll("p")]
            .find((p) => p.textContent?.startsWith("value:"))
            ?.closest("[inert]") != null,
        anyInert: document.querySelectorAll("[inert]").length,
      }));
    const open_ = await state();
    expect(open_.valueInert, "failed: the page behind the picker is live").toBe(true);
    expect(open_.lock && open_.overflow === "hidden", "failed: the page still scrolls").toBe(true);
    await page.keyboard.press("Escape");
    await expect(picker(page)).toHaveCount(0);
    const closed = await state();
    expect(closed.anyInert, "failed: something was left inert").toBe(0);
    expect(closed.lock, "failed: the scroll lock was left on").toBe(false);
  });

  test("pressing the trigger while open closes it, and it stays closed", async ({ page }) => {
    await openStory(page, STORY.datePickerSingle, DESKTOP);
    const trigger = storyRoot(page).getByRole("button", { name: "Send on" });
    await open(page, trigger);
    await trigger.click();
    await page.waitForTimeout(300);
    await expect(picker(page), "failed: the press closed and reopened it").toHaveCount(0);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("docked, it flips above a trigger with too little room under it, rather than scroll", async ({
    page,
  }) => {
    await openStory(page, STORY.datePickerSingle, DESKTOP);
    await storyRoot(page)
      .locator("div")
      .first()
      .evaluate((el) => {
        (el as HTMLElement).style.paddingTop = "480px";
      });
    const trigger = storyRoot(page).getByRole("button", { name: "Send on" });
    await open(page, trigger);
    const field = await box(trigger);
    const panel = await box(picker(page));
    // Its whole height, which a shrunk panel's box would understate.
    const natural = await picker(page).evaluate((el) => el.scrollHeight);
    expect(
      DESKTOP.height - (field.y + field.height),
      "the fixture leaves room for the whole picker below: this would test nothing",
    ).toBeLessThan(natural);
    expect(panel.y + panel.height, "failed: did not open above the trigger").toBeCloseTo(
      field.y - 4,
      0,
    );
    expect(
      await picker(page).evaluate((el) => el.scrollHeight - el.clientHeight),
      "failed: the calendar scrolls inside its panel",
    ).toBeLessThanOrEqual(1);
  });
});

test.describe("DatePickerContent: docked from 640px, M3's modal below", () => {
  test("from 640px: a 360dp panel under the trigger, with no header, still named", async ({
    page,
  }) => {
    await openStory(page, STORY.datePickerSingleDocked, DESKTOP);
    await expect(picker(page)).toBeVisible();
    await settleTransitions(page);
    const trigger = await box(storyRoot(page).getByRole("button", { name: "Send on" }));
    const panel = await box(picker(page));
    expect(panel.y, "failed: not 4px under the trigger").toBeCloseTo(
      trigger.y + trigger.height + 4,
      0,
    );
    expect(panel.x, "failed: not aligned with the trigger").toBeCloseTo(trigger.x, 0);
    // Seven 48dp columns: 336dp inside M3's 360dp, 12dp either side.
    const grid = await box(picker(page).getByRole("grid"));
    expect(grid.width, "failed: the grid is not M3's 336dp").toBeCloseTo(336, 0);
    expect(grid.x - panel.x, "failed: not 12dp from the panel's start").toBeCloseTo(13, 0);
    await expect(
      picker(page).getByText("Select date"),
      "failed: the docked panel shows the modal's header",
    ).toBeHidden();
    await expect(
      page.getByRole("dialog", { name: "Select date" }),
      "failed: the hidden title no longer names the picker",
    ).toBeVisible();
  });

  test("below 640px: M3's modal — 360dp at most, centred, 28dp corners, a 120dp header", async ({
    page,
  }) => {
    for (const size of [PHONE, { width: 412, height: 915 }]) {
      await openStory(page, STORY.datePickerSinglePhone, size);
      await expect(picker(page)).toBeVisible();
      await settleTransitions(page);
      const modal = await box(picker(page));
      const width = Math.min(360, size.width - 32);
      expect(modal.width, `failed: ${size.width}px: not min(360, window − 32)`).toBeCloseTo(
        width,
        0,
      );
      expect(modal.x, `failed: ${size.width}px: not centred`).toBeCloseTo(
        (size.width - width) / 2,
        0,
      );
      expect(modal.y + modal.height / 2, `failed: ${size.width}px: not centred`).toBeCloseTo(
        size.height / 2,
        0,
      );
      expect(
        await picker(page).evaluate((el) => getComputedStyle(el).borderTopLeftRadius),
        "failed: not M3's 28dp corners",
      ).toBe("28px");
      const header = await box(
        picker(page).getByText("Select date").locator("xpath=ancestor::div[1]"),
      );
      expect(header.height, "failed: the header is not M3's 120dp").toBeCloseTo(120, 0);
      await expect(
        picker(page).getByText("2026-09-11", { exact: true }),
        "failed: the header does not show the pick as its headline",
      ).toBeVisible();
      const grid = await box(picker(page).getByRole("grid"));
      expect(grid.x + grid.width, "failed: the grid overflows the modal").toBeLessThanOrEqual(
        modal.x + modal.width - 11.5,
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(size.width);
    }
  });

  test("the modal's header follows the pick", async ({ page }) => {
    await openStory(page, STORY.datePickerSinglePhone, PHONE);
    await expect(picker(page)).toBeVisible();
    await day(page, "2026-09-15").click();
    await expect(
      picker(page).getByText("2026-09-15", { exact: true }),
      "failed: the headline did not follow the pick",
    ).toBeVisible();
  });
});

test.describe("the other two containers", () => {
  test("DatePickerDropdown stays docked on a phone", async ({ page }) => {
    await openStory(page, STORY.datePickerDropdownPhone, PHONE);
    await expect(picker(page)).toBeVisible();
    await settleTransitions(page);
    const trigger = await box(storyRoot(page).getByRole("button", { name: "Send on" }));
    const panel = await box(picker(page));
    expect(panel.y, "failed: not docked under the trigger").toBeCloseTo(
      trigger.y + trigger.height + 4,
      0,
    );
    expect(panel.x + panel.width, "failed: past the window's edge").toBeLessThanOrEqual(
      PHONE.width,
    );
    await expect(picker(page).getByText("Select date")).toBeHidden();
  });

  test("DatePickerModal is the modal on a wide window too", async ({ page }) => {
    await openStory(page, STORY.datePickerModalDesktop, DESKTOP);
    await expect(picker(page)).toBeVisible();
    await settleTransitions(page);
    const modal = await box(picker(page));
    expect(modal.width, "failed: not M3's 360dp").toBeCloseTo(360, 0);
    expect(modal.x, "failed: not centred").toBeCloseTo((DESKTOP.width - 360) / 2, 0);
    await expect(picker(page).getByText("Select date"), "failed: no header").toBeVisible();
  });
});

test.describe("DateRangePicker", () => {
  test("from 640px: two months side by side, Cancel and Save, the stacked list hidden", async ({
    page,
  }) => {
    await openStory(page, STORY.datePickerRange, DESKTOP);
    await expect(picker(page)).toBeVisible();
    await settleTransitions(page);
    const grids = picker(page).getByRole("grid").filter({ visible: true });
    await expect(grids, "failed: not two months").toHaveCount(2);
    const [first, second] = [await box(grids.nth(0)), await box(grids.nth(1))];
    expect(second.y, "failed: the months are not side by side").toBeCloseTo(first.y, 0);
    expect(second.x, "failed: the months are not side by side").toBeGreaterThan(
      first.x + first.width,
    );
    await expect(picker(page).getByRole("button", { name: "Save" })).toBeVisible();
    await expect(picker(page).getByRole("button", { name: "Cancel" })).toBeVisible();
    await expect(
      picker(page).locator("[data-picker-month]").first(),
      "failed: the full-screen list shows on a wide window",
    ).toBeHidden();
  });

  test("below 640px: M3's full-screen picker — a 64dp bar, a 128dp header, months stacked", async ({
    page,
  }) => {
    await openStory(page, STORY.datePickerRangePhone, PHONE);
    await expect(picker(page)).toBeVisible();
    await settleTransitions(page);
    const surface = await box(picker(page));
    expect(
      [surface.x, surface.y, surface.width, surface.height],
      "failed: does not fill the screen",
    ).toEqual([0, 0, PHONE.width, PHONE.height]);
    const close = await box(picker(page).getByRole("button", { name: "Close", exact: true }));
    expect(
      [close.x, close.y, close.width, close.height],
      "failed: not the bar's 48dp close icon",
    ).toEqual([4, 8, 48, 48]);
    const save = await box(picker(page).getByRole("button", { name: "Save" }));
    expect(save.y + save.height / 2, "failed: Save is not in the bar").toBeCloseTo(32, 0);
    const header = await box(
      picker(page).getByText("Select dates").locator("xpath=ancestor::div[1]"),
    );
    expect(header.height, "failed: the header is not M3's 128dp").toBeCloseTo(128, 0);
    expect(header.y, "failed: the header is not under the bar").toBeCloseTo(64, 0);
    const title = await box(picker(page).getByText("Select dates"));
    expect(title.x, "failed: the title is not inset 64dp past the close icon").toBeCloseTo(64, 0);
    await expect(
      picker(page).getByText("2026-09-03 → 2026-09-14", { exact: true }),
      "failed: the headline is not the range",
    ).toBeVisible();

    await expect(
      day(page, "2026-09-03"),
      "failed: focus did not move into the full-screen picker",
    ).toBeFocused();

    // 12 months either side of the range's start, stacked.
    await expect(picker(page).locator("[data-picker-month]")).toHaveCount(25);
    const months = picker(page).locator("[data-picker-month]");
    const [a, b] = [await box(months.nth(0)), await box(months.nth(1))];
    expect(b.y, "failed: the months are not stacked").toBeGreaterThan(a.y + a.height - 1);
    // Scrolled to the range's month, under one pinned weekday row.
    const september = await box(
      picker(page).getByText("September 2026", { exact: true }).filter({ visible: true }),
    );
    expect(september.y, "failed: the list did not open at the range's month").toBeLessThan(
      PHONE.height / 2,
    );
    expect(september.y, "failed: the list did not open at the range's month").toBeGreaterThan(
      header.y + header.height,
    );
    await expect(
      picker(page).getByText("Su", { exact: true }).filter({ visible: true }),
      "failed: not one pinned weekday row",
    ).toHaveCount(1);
  });

  test("on a phone, Save commits the pick and the close icon throws it away", async ({ page }) => {
    await openStory(page, STORY.datePickerRangePhone, PHONE);
    await expect(picker(page)).toBeVisible();
    await day(page, "2026-09-20").click();
    const headline = picker(page).getByText(/^2026-09-\d\d → /);
    await expect(headline, "failed: the headline did not follow the pick").not.toHaveText(
      "2026-09-03 → 2026-09-14",
    );
    const draft = await headline.textContent();
    await expect(valueLine(page), "failed: a tap committed the range").toHaveText(
      "value: 2026-09-03 → 2026-09-14",
    );
    await picker(page).getByRole("button", { name: "Close", exact: true }).click();
    await expect(picker(page)).toHaveCount(0);
    await expect(valueLine(page), "failed: the close icon committed the pick").toHaveText(
      "value: 2026-09-03 → 2026-09-14",
    );

    await open(page, storyRoot(page).getByRole("button", { name: "Created between" }));
    await day(page, "2026-09-20").click();
    await picker(page).getByRole("button", { name: "Save" }).click();
    await expect(picker(page)).toHaveCount(0);
    await expect(valueLine(page), "failed: Save did not commit the pick").toHaveText(
      `value: ${draft}`,
    );
  });
});

test.describe("the full-screen range list holds still", () => {
  test("a tap that moves the start to another month leaves the day under the finger", async ({
    page,
  }) => {
    await openStory(page, STORY.datePickerRangePhone, PHONE);
    await expect(picker(page)).toBeVisible();
    // Near the bottom of the list, not centred: Chromium's `focus()` centres
    // an element it has to scroll to, so a day that starts centred ends
    // centred whether or not the list re-based under it (found in review).
    const target = day(page, "2026-11-10");
    await target.evaluate((button) => {
      let list = button.parentElement;
      while (list !== null && getComputedStyle(list).overflowY !== "auto") {
        list = list.parentElement;
      }
      if (list === null) throw new Error("no scrolling list");
      const rest = list.getBoundingClientRect().bottom - 120;
      list.scrollTop += button.getBoundingClientRect().top - rest;
    });
    const before = await box(target);
    expect(before.y, "the day is not near the list's bottom").toBeGreaterThan(
      PHONE.height / 2 + 100,
    );
    await target.click();
    await settleTransitions(page);
    const after = await box(day(page, "2026-11-10"));
    expect(after.y, "failed: the list re-based and the day jumped").toBeCloseTo(before.y, 0);
    await expect(picker(page).getByText("2026-11-10 → …", { exact: true })).toBeVisible();
  });
});

test.describe("a range bounded more than a year away", () => {
  test("opens the phone list on the bound's month, focused there", async ({ page }) => {
    await openStory(page, STORY.datePickerRangeBoundedPast, PHONE);
    await expect(picker(page)).toBeVisible();
    await settleTransitions(page);
    expect(
      await page.evaluate(() => document.activeElement?.closest("td")?.getAttribute("data-day")),
      "failed: focus is not in max's month",
    ).toMatch(/^2024-12-/);
    // The list's last month, so it cannot scroll to the top: it has to be
    // wholly in view, its caption and its last day. Before, the list opened
    // on December 2023, twelve months above.
    const december = await box(
      picker(page).getByText("December 2024", { exact: true }).filter({ visible: true }),
    );
    const lastDay = await box(day(page, "2024-12-31"));
    const weekdays = await box(
      picker(page).getByText("Su", { exact: true }).filter({ visible: true }),
    );
    expect(december.y, "failed: max's month is not in view").toBeGreaterThanOrEqual(
      weekdays.y + weekdays.height - 1,
    );
    expect(lastDay.y + lastDay.height, "failed: max's month is not in view").toBeLessThanOrEqual(
      PHONE.height,
    );
  });
});

test.describe("the chrome parts", () => {
  test("the full-screen picker's close icon, title and Save take what is written", async ({
    page,
  }) => {
    await openStory(page, STORY.datePickerRangeRelabelledPhone, PHONE);
    await expect(picker(page)).toBeVisible();
    await settleTransitions(page);
    await expect(
      page.getByRole("dialog", { name: "Reporting period" }),
      "failed: DatePickerTitle did not rename the picker",
    ).toBeVisible();
    await expect(
      picker(page).getByText("Reporting period", { exact: true }),
      "failed: the header does not show the written title",
    ).toBeVisible();
    const discard = picker(page).getByRole("button", { name: "Discard the period" });
    const close = await box(discard);
    expect(
      [close.x, close.y, close.width, close.height],
      "failed: DatePickerClose is not the bar's 48dp leading icon",
    ).toEqual([4, 8, 48, 48]);
    await expect(
      picker(page)
        .getByRole("button", { name: /^(Close|Save)$/ })
        .filter({ visible: true }),
      "failed: a default rendered beside its replacement",
    ).toHaveCount(0);
    await expect(
      picker(page).getByRole("button", { name: "Apply" }).filter({ visible: true }),
    ).toHaveCount(1);

    await day(page, "2026-09-20").click();
    await discard.click();
    await expect(picker(page), "failed: DatePickerClose did not close").toHaveCount(0);
    await expect(
      storyRoot(page).getByRole("button", { name: "Reporting period" }),
      "failed: DatePickerClose committed the pick",
    ).toHaveText(/2026-09-03 → 2026-09-14/);
  });

  test("a range's Clear is named for dates, plural, by default", async ({ page }) => {
    await openStory(page, STORY.datePickerRange, DESKTOP);
    await expect(picker(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(picker(page)).toHaveCount(0);
    await expect(storyRoot(page).getByRole("button", { name: "Clear the dates" })).toBeVisible();
  });
});

test.describe("min and max", () => {
  test("disable the days outside them and the arrows at them, visibly", async ({ page }) => {
    await openStory(page, STORY.datePickerBounded, DESKTOP);
    await open(page, storyRoot(page).getByRole("button", { name: "A weekday this month" }));
    for (const iso of ["2026-09-07", "2026-09-25"]) {
      await expect(
        picker(page).locator(`td[data-day="${iso}"]`),
        `failed: ${iso} is not disabled`,
      ).toHaveAttribute("data-disabled", "true");
    }
    await expect(picker(page).locator('td[data-day="2026-09-08"]')).not.toHaveAttribute(
      "data-disabled",
    );
    // The arrows: react-day-picker marks an unavailable month with
    // `aria-disabled`, never `disabled`, so styling written against
    // `disabled:` left both looking live at a bound.
    for (const name of ["Go to the Previous Month", "Go to the Next Month"]) {
      const arrow = picker(page).getByRole("button", { name });
      await expect(arrow).toHaveAttribute("aria-disabled", "true");
      expect(
        await arrow.evaluate((el) => getComputedStyle(el).opacity),
        `failed: ${name} does not look unavailable`,
      ).toBe("0.38");
    }
  });
});

async function expectTabStaysInside(page: Page) {
  const inside = () => picker(page).evaluate((el) => el.contains(document.activeElement));
  for (const key of ["Tab", "Shift+Tab"]) {
    for (let press = 1; press <= 8; press++) {
      await page.keyboard.press(key);
      expect(await inside(), `failed: ${key} ${press} left the picker`).toBe(true);
    }
  }
}

test.describe("names, descriptions and focus", () => {
  test("the trigger is named by its label and described by its date", async ({ page }) => {
    await openStory(page, STORY.datePickerSingle, DESKTOP);
    const trigger = storyRoot(page).getByRole("button", { name: "Send on" });
    await expect(trigger, "failed: not named by its label alone").toHaveAccessibleName("Send on");
    await expect(trigger, "failed: the date is not in the description").toHaveAccessibleDescription(
      "2026-09-11",
    );
    await expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("opening focuses the picked day; Tab stays inside; closing returns focus", async ({
    page,
  }) => {
    await openStory(page, STORY.datePickerSingle, DESKTOP);
    const trigger = storyRoot(page).getByRole("button", { name: "Send on" });
    await open(page, trigger);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(
      day(page, "2026-09-11"),
      "failed: focus did not move to the picked day",
    ).toBeFocused();
    await expectTabStaysInside(page);
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  });

  test("Tab stays inside from the picker's own background", async ({ page }) => {
    // A press on no control focuses the surface itself (`tabIndex={-1}`),
    // which is no Tab stop: Shift+Tab from it walked out to the trigger.
    await openStory(page, STORY.datePickerSinglePhone, PHONE);
    await expect(picker(page)).toBeVisible();
    const surfaceFocused = () => picker(page).evaluate((el) => document.activeElement === el);
    const inside = () => picker(page).evaluate((el) => el.contains(document.activeElement));
    // Each direction from the surface, Shift+Tab first: Tab from it already
    // reached the first stop inside, in document order, and hid the leak.
    for (const key of ["Shift+Tab", "Tab"]) {
      await picker(page).getByText("Select date").click();
      expect(await surfaceFocused(), "the fixture did not focus the surface itself").toBe(true);
      await page.keyboard.press(key);
      expect(await inside(), `failed: ${key} from the surface left the picker`).toBe(true);
      expect(await surfaceFocused(), `failed: ${key} from the surface stayed on it`).toBe(false);
    }
  });

  test("Tab stays inside where days and a bound's arrows are out of the tab order", async ({
    page,
  }) => {
    // The roving day buttons and an arrow at a bound are `tabIndex={-1}`:
    // counted as the first or last stop, Tab walked out to the page.
    await openStory(page, STORY.datePickerRangePhone, PHONE);
    await expect(picker(page)).toBeVisible();
    await expectTabStaysInside(page);
    await openStory(page, STORY.datePickerBounded, DESKTOP);
    await open(page, storyRoot(page).getByRole("button", { name: "A weekday this month" }));
    await expectTabStaysInside(page);
  });

  test("written chrome replaces the defaults", async ({ page }) => {
    await openStory(page, STORY.datePickerRelabelled, DESKTOP);
    await expect(
      page.getByRole("dialog", { name: "Go-live date" }),
      "failed: DatePickerTitle did not rename the picker",
    ).toBeVisible();
    await expect(picker(page).getByRole("button", { name: "Keep current" })).toBeVisible();
    await expect(picker(page).getByRole("button", { name: "Schedule" })).toBeVisible();
    await expect(
      picker(page).getByRole("button", { name: /^(Cancel|OK)$/ }),
      "failed: a default rendered beside its replacement",
    ).toHaveCount(0);
  });
});

test.describe("today", () => {
  /**
   * Computed colours, not classes: the rule that colours today's digit is
   * written against `data-selected`, and a selector that stopped matching
   * would paint a picked today's label `Primary` on its `Primary` fill —
   * invisible — with every class-string test still green. The fill of a
   * picked day is `Primary` by definition, so it is the reference colour
   * here rather than a hard-coded value.
   */
  test("a 1dp Primary ring and label; picked, a label that reads on the fill", async ({ page }) => {
    await openStory(page, STORY.calendarToday, DESKTOP);
    const style = (calendar: string, iso: string) =>
      storyRoot(page)
        .locator(`[data-calendar="${calendar}"] td[data-day="${iso}"] button`)
        .evaluate((el) => {
          const s = getComputedStyle(el);
          return {
            fill: s.backgroundColor,
            label: s.color,
            ring: s.borderTopColor,
            ringWidth: s.borderTopWidth,
          };
        });
    const picked = await style("today-not-picked", "2026-09-11");
    const primary = picked.fill;
    expect(primary, "failed: a picked day has no fill").not.toBe("rgba(0, 0, 0, 0)");

    const today = await style("today-not-picked", "2026-09-08");
    expect(today.ringWidth, "failed: today's ring is not 1dp").toBe("1px");
    expect(today.ring, "failed: today's ring is not Primary").toBe(primary);
    expect(today.label, "failed: today's label is not Primary").toBe(primary);
    expect(today.fill, "failed: an unpicked today is filled").toBe("rgba(0, 0, 0, 0)");
    const other = await style("today-not-picked", "2026-09-09");
    expect(other.ringWidth, "failed: a day that is not today has a ring").toBe("0px");

    const pickedToday = await style("today-picked", "2026-09-08");
    expect(pickedToday.fill, "failed: a picked today is not filled").toBe(primary);
    expect(
      pickedToday.label,
      "failed: a picked today's label is the fill's own colour — invisible",
    ).not.toBe(pickedToday.fill);
    expect(pickedToday.label, "failed: not the picked label colour").toBe(picked.label);
  });
});

test.describe("Calendar's M3 geometry", () => {
  test("40dp round days in 48dp cells, and the range band between two filled ends", async ({
    page,
  }) => {
    await openStory(page, STORY.calendarRange, DESKTOP);
    const cell = (iso: string) => storyRoot(page).locator(`td[data-day="${iso}"]`);
    const button = await box(cell("2026-09-08").locator("button"));
    expect([button.width, button.height], "failed: not M3's 40dp date").toEqual([40, 40]);
    expect(
      Number.parseFloat(
        await cell("2026-09-08")
          .locator("button")
          .evaluate((el) => getComputedStyle(el).borderTopLeftRadius),
      ),
      "failed: the date is not a circle",
    ).toBeGreaterThanOrEqual(20);
    const middle = await box(cell("2026-09-08"));
    expect(middle.height, "failed: the row is not 48dp").toBeCloseTo(48, 0);

    // The band: 40dp tall, edge to edge across an interior cell, and from
    // the centre inward at either end.
    const band = await pseudoRect(cell("2026-09-08"), "::before");
    expect(band.height, "failed: the band is not 40dp").toBeCloseTo(40, 0);
    expect([band.x, band.width], "failed: the band does not span the cell").toEqual([
      middle.x,
      middle.width,
    ]);
    const start = await box(cell("2026-09-03"));
    const startBand = await pseudoRect(cell("2026-09-03"), "::before");
    expect(startBand.x, "failed: the band does not start at the centre").toBeCloseTo(
      start.x + start.width / 2,
      0,
    );
    const end = await box(cell("2026-09-14"));
    const endBand = await pseudoRect(cell("2026-09-14"), "::before");
    expect(endBand.x + endBand.width, "failed: the band does not end at the centre").toBeCloseTo(
      end.x + end.width / 2,
      0,
    );
    const fill = (locator: Locator) =>
      locator.evaluate((el) => getComputedStyle(el, "::before").backgroundColor);
    expect(await fill(cell("2026-09-08")), "failed: the band is transparent").not.toBe(
      "rgba(0, 0, 0, 0)",
    );
    expect(
      await cell("2026-09-03")
        .locator("button")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      "failed: the range's start is not filled",
    ).not.toBe("rgba(0, 0, 0, 0)");
  });
});

test.describe("on a touch screen, a tap outside is spent on closing", () => {
  test.use({ hasTouch: true, isMobile: true });

  test("a tap on the modal's scrim does not press what is under it", async ({ page }) => {
    await openStory(page, STORY.datePickerSingle, PHONE);
    // A button under where the scrim will be, in the page the picker makes
    // inert — the shape of a Submit or Delete behind an open picker.
    await storyRoot(page).evaluate((root) => {
      const probe = document.createElement("button");
      probe.type = "button";
      probe.id = "under-the-scrim";
      probe.textContent = "Under";
      probe.style.cssText = "position:fixed;left:8px;top:8px;width:80px;height:40px";
      probe.addEventListener("click", () => {
        probe.dataset.presses = String(Number(probe.dataset.presses ?? 0) + 1);
      });
      root.appendChild(probe);
    });
    const probe = page.locator("#under-the-scrim");
    await page.touchscreen.tap(
      ...(await box(storyRoot(page).getByRole("button", { name: "Send on" })).then(
        (b) => [b.x + b.width / 2, b.y + b.height / 2] as const,
      )),
    );
    await expect(picker(page)).toBeVisible();
    await settleTransitions(page);
    expect(
      await probe.evaluate((el) => el.closest("[inert]") !== null),
      "failed: the probe is not in the inert page, so this would test nothing",
    ).toBe(true);
    await page.touchscreen.tap(48, 28);
    await expect(picker(page), "failed: the tap did not close the picker").toHaveCount(0);
    await page.waitForTimeout(600);
    expect(
      await probe.getAttribute("data-presses"),
      "failed: the tap that closed the picker also pressed the button under it",
    ).toBeNull();
    // The probe does count a tap, once the picker is closed.
    await page.touchscreen.tap(48, 28);
    await expect(probe).toHaveAttribute("data-presses", "1");
  });

  test("a script's click right after the dismissing tap is not eaten", async ({ page }) => {
    await openStory(page, STORY.datePickerSingle, PHONE);
    await storyRoot(page).evaluate((root) => {
      const other = document.createElement("button");
      other.type = "button";
      other.id = "scripted";
      other.textContent = "Scripted";
      other.style.cssText = "position:fixed;right:8px;top:8px;width:80px;height:40px";
      other.addEventListener("click", () => {
        other.dataset.presses = String(Number(other.dataset.presses ?? 0) + 1);
      });
      root.appendChild(other);
    });
    await page.touchscreen.tap(
      ...(await box(storyRoot(page).getByRole("button", { name: "Send on" })).then(
        (b) => [b.x + b.width / 2, b.y + b.height / 2] as const,
      )),
    );
    await expect(picker(page)).toBeVisible();
    await settleTransitions(page);
    await page.touchscreen.tap(48, 28);
    await expect(picker(page)).toHaveCount(0);
    // Within the half-second the rest of the tap is being spent.
    await page.locator("#scripted").evaluate((el) => (el as HTMLElement).click());
    await expect(
      page.locator("#scripted"),
      "failed: a script's click was eaten as part of the tap",
    ).toHaveAttribute("data-presses", "1");
  });

  test("inside a Dialog, a tap outside closes the picker, not the dialog", async ({ page }) => {
    await openStory(page, STORY.datePickerInDialog, PHONE);
    await storyRoot(page).getByRole("button", { name: "Open dialog" }).tap();
    // The dialog's root has no box of its own; its heading is what shows.
    const dialog = page.getByRole("heading", { name: "Schedule the export" });
    await expect(dialog).toBeVisible();
    await settleTransitions(page);
    await page.getByRole("button", { name: "Export on" }).tap();
    await expect(picker(page)).toBeVisible();
    await settleTransitions(page);
    await page.touchscreen.tap(5, 5);
    await expect(picker(page), "failed: the tap did not close the picker").toHaveCount(0);
    await page.waitForTimeout(400);
    await expect(dialog, "failed: the tap closed the dialog too").toBeVisible();
  });
});
