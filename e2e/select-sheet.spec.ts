import { expect, type Page, test } from "@playwright/test";
import {
  box,
  contrastRatio,
  openStory,
  paintedColors,
  parseColor,
  settleTransitions,
  storyRoot,
} from "./helpers";
import { STORY } from "./story-ids";

/**
 * Below 640px `SelectContent` is an M3 modal bottom sheet (`select.tsx`,
 * `SelectContent`'s doc); from 640px up it is the dropdown it always was.
 * The two are one element restyled by a media query, so everything that
 * distinguishes them is computed style and geometry — which is to say,
 * invisible to jsdom and to any assertion on a class string.
 *
 * Both phone stories open the sheet from their own play function.
 */

const PHONE = { width: 375, height: 812 };

async function sheetOpen(page: Page) {
  const sheet = storyRoot(page).getByRole("listbox");
  await expect(sheet).toBeVisible();
  await settleTransitions(page);
  return sheet;
}

test.describe("the phone bottom sheet", () => {
  test("sits on the bottom edge, full width, with 28px top corners and a square bottom", async ({
    page,
  }) => {
    await openStory(page, STORY.selectPhoneSheet, PHONE);
    const sheet = await sheetOpen(page);
    const rect = await box(sheet);

    expect(rect.x, "left edge").toBeCloseTo(0, 0);
    expect(rect.width, "full width").toBeCloseTo(PHONE.width, 0);
    expect(rect.y + rect.height, "bottom edge").toBeCloseTo(PHONE.height, 0);

    const radii = await sheet.evaluate((el) => {
      const s = getComputedStyle(el);
      return [
        s.borderTopLeftRadius,
        s.borderTopRightRadius,
        s.borderBottomLeftRadius,
        s.borderBottomRightRadius,
      ];
    });
    // `SheetBottomTokens.DockedContainerShape` = `CornerExtraLargeTop`.
    expect(radii).toEqual(["28px", "28px", "0px", "0px"]);
  });

  test("a long list caps at 85dvh and scrolls under a handle that stays put", async ({ page }) => {
    await openStory(page, STORY.selectPhoneSheet, PHONE);
    const sheet = await sheetOpen(page);
    const rect = await box(sheet);
    expect(rect.height, "capped at 85dvh").toBeCloseTo(PHONE.height * 0.85, 0);

    const handle = sheet.locator("[data-sheet-handle]");
    const before = await box(handle);
    // Scroll by the sheet's own scroll container. A drag handle that
    // scrolled away with the options would leave nothing to grab.
    const scrolled = await sheet.evaluate((el) => {
      el.scrollTop = 400;
      return el.scrollTop;
    });
    expect(scrolled, "the sheet itself scrolls").toBeGreaterThan(0);
    const after = await box(handle);
    expect(after.y, "handle stays at the top of the sheet").toBeCloseTo(before.y, 0);
  });

  test("a short list is only as tall as its rows, and every row is 56px", async ({ page }) => {
    await openStory(page, STORY.selectPhoneSheetShort, PHONE);
    const sheet = await sheetOpen(page);
    const options = sheet.getByRole("option");
    expect(await options.count()).toBe(3);
    for (let index = 0; index < 3; index += 1) {
      // `ListTokens.ItemOneLineContainerHeight` 56dp.
      expect((await box(options.nth(index))).height, `row ${index}`).toBeCloseTo(56, 0);
    }
    const rect = await box(sheet);
    expect(rect.height, "hugs its content").toBeLessThan(PHONE.height / 2);
  });

  test("the handle is M3's 32×4 bar inside a 48px strip", async ({ page }) => {
    await openStory(page, STORY.selectPhoneSheet, PHONE);
    const sheet = await sheetOpen(page);
    const strip = await box(sheet.locator("[data-sheet-handle]"));
    const bar = await box(sheet.locator("[data-sheet-handle] > span"));
    expect(strip.height, "22 + 4 + 22").toBeCloseTo(48, 0);
    expect(bar.width).toBeCloseTo(32, 0);
    expect(bar.height).toBeCloseTo(4, 0);
  });

  test("the selected row is filled and rounder than the rest, and its label reads on the fill", async ({
    page,
  }) => {
    await openStory(page, STORY.selectPhoneSheetShort, PHONE);
    const sheet = await sheetOpen(page);
    const fillOf = (name: string) =>
      sheet.getByRole("option", { name }).evaluate((el) => getComputedStyle(el).backgroundColor);
    // Headless UI focuses the selected row on open, and focus on it has to
    // *look* different from no focus (WCAG 2.4.7) — the reviewer found it
    // identical. Read it focused here, unfocused below.
    const focusedSelectedFill = await fillOf("Normal");
    // Headless UI focuses the selected row on open; move focus off it so
    // the fill read below is the *selected* fill and not a focus layer
    // (the base `data-focus:bg-surface-3` would otherwise stand in for a
    // missing selected fill — which is how this test once passed with the
    // fill deleted, the row reading at 1.19:1).
    await page.keyboard.press("ArrowUp");
    await expect(sheet.getByRole("option", { name: "Low" })).toHaveAttribute("data-focus", "");
    // The fill transitions; mid-flight it computes as an `oklab()` mix.
    await settleTransitions(page);
    const read = (name: string) =>
      sheet.getByRole("option", { name }).evaluate((el) => {
        const s = getComputedStyle(el);
        return { radius: s.borderTopLeftRadius, fill: s.backgroundColor, ink: s.color };
      });
    const selected = await read("Normal");
    expect(selected.radius, "CornerLarge").toBe("16px");
    const fill = parseColor(selected.fill);
    expect(fill.alpha, "the selected row is filled").toBeGreaterThan(0.99);
    expect(
      contrastRatio(parseColor(selected.ink).rgb, fill.rgb),
      "the selected label against its own fill",
    ).toBeGreaterThanOrEqual(4.5);
    expect(selected.fill, "focus on the selected row changes its fill").not.toBe(
      focusedSelectedFill,
    );
    const resting = await read("High — page the on-call operator");
    expect(resting.radius, "CornerExtraSmall").toBe("4px");
    expect(resting.fill, "a resting row has no fill").toBe("rgba(0, 0, 0, 0)");
  });

  test("arrowing up a long list never parks the focused row under the handle", async ({ page }) => {
    await openStory(page, STORY.selectPhoneSheet, PHONE);
    const sheet = await sheetOpen(page);
    const handle = await box(sheet.locator("[data-sheet-handle]"));
    await page.keyboard.press("End");
    for (let step = 0; step < 29; step += 1) {
      await page.keyboard.press("ArrowUp");
      const id = await sheet.getAttribute("aria-activedescendant");
      const row = page.locator(`[id="${id}"]`);
      // Polled: Headless UI scrolls the active row into view a frame
      // after the key, so an immediate read sees it pre-scroll. Measured
      // before `scroll-pt-12`: from step 12 on, the settled position left
      // 8px of a 56px row showing below a 48px handle.
      await expect
        .poll(async () => (await box(row)).y, {
          message: `step ${step}: focused row starts below the handle`,
        })
        .toBeGreaterThanOrEqual(handle.y + handle.height - 0.5);
    }
  });

  test("dragging the handle a little springs back; past 56px it dismisses and refocuses the trigger", async ({
    page,
  }) => {
    await openStory(page, STORY.selectPhoneSheet, PHONE);
    const sheet = await sheetOpen(page);
    const rest = await box(sheet);
    const handle = await box(sheet.locator("[data-sheet-handle]"));
    const x = handle.x + handle.width / 2;
    const y = handle.y + handle.height / 2;

    // Slow and short: under both thresholds.
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let d = 0; d <= 30; d += 5) {
      await page.mouse.move(x, y + d);
      await page.waitForTimeout(40);
    }
    const dragged = await box(sheet);
    expect(dragged.y - rest.y, "the sheet follows the pointer").toBeCloseTo(30, 0);
    await page.mouse.up();
    await settleTransitions(page);
    await expect(sheet).toBeVisible();
    expect((await box(sheet)).y, "…and springs home").toBeCloseTo(rest.y, 0);

    // Slow and long: past `BottomSheetDefaults.PositionalThreshold`.
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let d = 0; d <= 80; d += 5) {
      await page.mouse.move(x, y + d);
      await page.waitForTimeout(40);
    }
    await page.mouse.up();
    await expect(storyRoot(page).getByRole("listbox")).toHaveCount(0);
    await expect(storyRoot(page).getByRole("button", { name: "Country" })).toBeFocused();
  });

  test("a tap on the handle with a little jitter, or a drag that stops before letting go, does not dismiss", async ({
    page,
  }) => {
    await openStory(page, STORY.selectPhoneSheet, PHONE);
    const sheet = await sheetOpen(page);
    const handle = await box(sheet.locator("[data-sheet-handle]"));
    const x = handle.x + handle.width / 2;
    const y = handle.y + handle.height / 2;

    // 4px in one quick step — fast enough to read as a flick if velocity
    // were averaged over the gesture, but under the 8px touch slop.
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 4);
    await page.mouse.up();
    await settleTransitions(page);
    await expect(sheet, "a jittery tap").toBeVisible();

    // 50px in one quick move, a 150ms hold, then release: under 56px, and
    // the release velocity is zero because the pointer had stopped for
    // more than 40ms. Averaged over the gesture instead, the same drag
    // reads ~0.3px/ms — over the 0.125 flick threshold — and dismissed;
    // the move is one step precisely so that average stays high.
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 50, { steps: 2 });
    await page.waitForTimeout(150);
    await page.mouse.up();
    await settleTransitions(page);
    await expect(sheet, "a drag that paused before release").toBeVisible();
  });

  test("a tap on the dimmed page closes the sheet and activates nothing under it", async ({
    page,
  }) => {
    await openStory(page, STORY.selectPhoneSheet, PHONE);
    const sheet = await sheetOpen(page);
    // A real button under the scrim, above the sheet's top edge. With the
    // listbox's `modal` behaviour gone this click reaches it — measured:
    // `modal={false}` on `ListboxOptions` fails this test, where a tap on
    // empty page did not.
    // By text, not by role: while the sheet is open the page is `inert`,
    // which takes this button out of the accessibility tree — so a role
    // query cannot find it at all. That is the mechanism under test, seen
    // from the other side.
    const behind = storyRoot(page).locator("button", { hasText: "Behind the scrim" });
    const target = await box(behind);
    expect(target.y + target.height, "the control sits above the sheet").toBeLessThan(
      (await box(sheet)).y,
    );
    await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2);
    await expect(storyRoot(page).getByRole("listbox")).toHaveCount(0);
    await expect(storyRoot(page).getByText("taps: 0")).toBeVisible();
  });

  test("the scrim darkens the page behind the sheet", async ({ page }) => {
    // Pixels, not `box-shadow`: Tailwind composes its ring shadows ahead of
    // this one, so the computed string starts with transparent layers
    // whatever the scrim is doing — a string match proved nothing the
    // first time it was written. The trigger row, well above the sheet's
    // 85dvh, read with the sheet open and then closed.
    await openStory(page, STORY.selectPhoneSheet, PHONE);
    await sheetOpen(page);
    const behind = await box(storyRoot(page).getByRole("button", { name: "Country" }));
    const brightest = (colours: readonly (readonly [number, number, number])[]) =>
      Math.max(...colours.map(([r, g, b]) => r + g + b));
    const dimmed = brightest(await paintedColors(page, behind));
    await page.keyboard.press("Escape");
    await expect(storyRoot(page).getByRole("listbox")).toHaveCount(0);
    const clear = brightest(await paintedColors(page, behind));
    // `--scrim` is 50% black on the dark theme, so the brightest pixel
    // (the trigger's text) roughly halves. 0.75 leaves room for
    // antialiasing without accepting "no scrim at all".
    expect(dimmed, "brightest pixel behind the open sheet").toBeLessThan(clear * 0.75);
  });

  test("inside a drawer, the sheet still lands on the viewport's bottom edge", async ({ page }) => {
    await openStory(page, STORY.selectInsideADrawer, PHONE);
    await storyRoot(page).getByRole("button", { name: "Open drawer" }).click();
    const trigger = page.getByRole("button", { name: "Provider" });
    await expect(trigger).toBeVisible();
    await settleTransitions(page);
    await trigger.click();
    const sheet = page.getByRole("listbox");
    await expect(sheet).toBeVisible();
    await settleTransitions(page);
    const rect = await box(sheet);
    expect(rect.y + rect.height, "bottom edge").toBeCloseTo(PHONE.height, 0);
    expect(rect.width, "full width").toBeCloseTo(PHONE.width, 0);
    // And it is usable, which is the whole reason `portal={false}` exists.
    await sheet.getByRole("option", { name: "Twilio" }).click();
    await expect(trigger).toHaveText(/Twilio/);
  });
});

test.describe("a sheet inside a drawer dismisses alone", () => {
  async function openInDrawer(page: Page) {
    await openStory(page, STORY.selectInsideADrawer, PHONE);
    await storyRoot(page).getByRole("button", { name: "Open drawer" }).click();
    const trigger = page.getByRole("button", { name: "Provider" });
    await expect(trigger).toBeVisible();
    await settleTransitions(page);
    await trigger.click();
    const sheet = page.getByRole("listbox");
    await expect(sheet).toBeVisible();
    await settleTransitions(page);
    return { trigger, sheet, drawer: page.getByRole("dialog") };
  }

  /**
   * Radix, under vaul, listens for Escape on the document in the capture
   * phase and for pointer-downs outside the drawer — so each of these used
   * to close the drawer along with the listbox, leaving focus on
   * `<body>` (`drawer.tsx`'s `selectIsOpen`).
   */
  test("dragging the handle away closes the sheet and leaves the drawer open", async ({ page }) => {
    const { trigger, sheet, drawer } = await openInDrawer(page);
    const handle = await box(sheet.locator("[data-sheet-handle]"));
    const x = handle.x + handle.width / 2;
    const y = handle.y + handle.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let d = 0; d <= 80; d += 5) {
      await page.mouse.move(x, y + d);
      await page.waitForTimeout(30);
    }
    await page.mouse.up();
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await page.waitForTimeout(600);
    await expect(drawer).toHaveAttribute("data-state", "open");
    await expect(trigger).toBeFocused();
  });

  test("Escape closes the sheet first, and only the next one closes the drawer", async ({
    page,
  }) => {
    const { trigger, drawer } = await openInDrawer(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(drawer).toHaveAttribute("data-state", "open");
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
  });

  test("Escape with focus on the trigger, listbox still open, closes only the listbox", async ({
    page,
  }) => {
    // Headless UI moves focus into the options on open, but the trigger is
    // left outside the `inert` it applies — a screen reader's cursor can
    // sit on it while the listbox is open. Put focus there the way that
    // cursor would, then press Escape: this used to close the drawer too.
    const { trigger, drawer } = await openInDrawer(page);
    await trigger.evaluate((el) => (el as HTMLElement).focus());
    await expect(trigger).toBeFocused();
    await expect(page.getByRole("listbox")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await page.waitForTimeout(600);
    await expect(drawer).toHaveAttribute("data-state", "open");
    await expect(trigger).toBeFocused();
  });

  test("a tap on the scrim above the drawer closes only the sheet", async ({ page }) => {
    const { drawer } = await openInDrawer(page);
    const top = await box(drawer);
    expect(top.y, "there is page above the drawer to tap").toBeGreaterThan(80);
    await page.mouse.click(PHONE.width / 2, top.y / 2);
    await expect(page.getByRole("listbox")).toHaveCount(0);
    // `data-state`, and after vaul's 500ms exit: a closing drawer is
    // still *visible* for its whole exit animation, which is how this
    // test first passed while the drawer was in fact closing — Radix
    // flips `data-state` to `closed` the moment it dismisses.
    await page.waitForTimeout(600);
    await expect(drawer).toHaveAttribute("data-state", "open");
  });

  test("in the generic drawer, dragging the sheet does not drag the drawer", async ({ page }) => {
    await openStory(page, STORY.selectInsideAPlainDrawer, PHONE);
    await storyRoot(page).getByRole("button", { name: "Open plain drawer" }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await page.getByRole("button", { name: "Country" }).click();
    const sheet = page.getByRole("listbox");
    await expect(sheet).toBeVisible();
    await settleTransitions(page);
    // vaul opens with a CSS *animation*, which `settleTransitions` does
    // not wait for, so read the drawer's resting box only once two reads
    // agree — a read mid-slide measured a 124px "drag" that never was.
    let before = await box(drawer);
    await expect
      .poll(async () => {
        const now = await box(drawer);
        const still = now.y === before.y;
        before = now;
        return still;
      })
      .toBe(true);
    const handle = await box(sheet.locator("[data-sheet-handle]"));
    const x = handle.x + handle.width / 2;
    const y = handle.y + handle.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let d = 0; d <= 30; d += 5) {
      await page.mouse.move(x, y + d);
      await page.waitForTimeout(40);
    }
    const during = await box(drawer);
    await page.mouse.up();
    expect(during.y - before.y, "the drawer did not follow the pointer").toBeCloseTo(0, 0);
  });
});

test.describe("from 640px up it is still the dropdown", () => {
  test("anchored under its trigger, no handle, no scrim", async ({ page }) => {
    await openStory(page, STORY.selectDisabledAndScrolling, { width: 1280, height: 800 });
    const trigger = storyRoot(page).getByRole("button", { name: "Timezone" });
    await trigger.click();
    const list = storyRoot(page).getByRole("listbox");
    await expect(list).toBeVisible();
    const t = await box(trigger);
    const l = await box(list);
    expect(l.y, "directly under the trigger").toBeGreaterThan(t.y + t.height - 1);
    expect(l.y - (t.y + t.height), "…with the 4px gap").toBeCloseTo(4, 0);
    expect(l.width, "matching its width").toBeCloseTo(t.width, 0);
    // Not `position`, which is `fixed` for the dropdown too now
    // (`useDropdownPlacement`): the sheet is pinned to the bottom edge.
    expect(l.y + l.height, "pinned to the bottom edge, like the sheet").toBeLessThan(800 - 1);
    await expect(list.locator("[data-sheet-handle]")).toBeHidden();
  });
});
