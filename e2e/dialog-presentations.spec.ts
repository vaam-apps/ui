import { devices, expect, type Page, test } from "@playwright/test";
import { box, openStory, settleTransitions, storyRoot } from "./helpers";
import { STORY } from "./story-ids";

/**
 * `Dialog`'s two presentations (`dialog.tsx`): M3's basic dialog
 * (`DialogContent`, and `DialogFullScreen` from 640px up) and M3's
 * full-screen dialog (`DialogFullScreen` below 640px). Every test reads
 * the render — geometry, computed style, what a click does — and every
 * assertion message says what went wrong, prefixed "failed:".
 */

const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1280, height: 800 };

const panel = (page: Page) => page.locator('[id^="headlessui-dialog-panel"]');

async function opened(page: Page) {
  await expect(page.getByRole("heading").first()).toBeVisible();
  await settleTransitions(page);
}

test.describe("DialogFullScreen below 640px: M3's full-screen dialog", () => {
  test("fills the screen, square, with a 64dp bar: close leading, the confirm action trailing", async ({
    page,
  }) => {
    await openStory(page, STORY.dialogFullScreenPhone, PHONE);
    await opened(page);
    const rect = await box(panel(page));
    expect(
      [rect.x, rect.y, rect.width, rect.height],
      "failed: the full-screen dialog does not fill the screen",
    ).toEqual([0, 0, PHONE.width, PHONE.height]);
    expect(
      await panel(page).evaluate((el) => getComputedStyle(el).borderTopLeftRadius),
      "failed: the full-screen dialog has rounded corners",
    ).toBe("0px");

    // `AppBarTokens`: a 48dp icon button, `LeadingSpace` 4dp, centred in
    // the 64dp bar (`AppBarSmallTokens.ContainerHeight`).
    const close = await box(page.getByRole("button", { name: "Close", exact: true }));
    expect(
      [close.x, close.y, close.width, close.height],
      "failed: not the bar's close icon",
    ).toEqual([4, 8, 48, 48]);
    const create = await box(page.getByRole("button", { name: "Create" }));
    expect(create.y + create.height / 2, "failed: Create is not centred in the bar").toBeCloseTo(
      32,
      0,
    );
    expect(create.x + create.width, "failed: Create is not 4dp from the edge").toBeCloseTo(
      PHONE.width - 4,
      0,
    );
    await expect(
      page.getByRole("button", { name: "Cancel" }),
      "failed: the Cancel action shows beside the close icon that already is it",
    ).toBeHidden();
    const title = await box(page.getByRole("heading", { name: "New webhook endpoint" }));
    expect(title.y, "failed: the headline sits under the bar").toBeGreaterThanOrEqual(64);
  });

  test("the bar's Create submits the form; the close icon closes and returns focus", async ({
    page,
  }) => {
    await openStory(page, STORY.dialogFullScreenPhone, PHONE);
    await opened(page);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(panel(page)).toHaveCount(0);
    await expect(
      storyRoot(page).getByText("created: https://hooks.example.com/vaam"),
    ).toBeVisible();

    await storyRoot(page).getByRole("button", { name: "New endpoint" }).click();
    await opened(page);
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(panel(page)).toHaveCount(0);
    await expect(storyRoot(page).getByRole("button", { name: "New endpoint" })).toBeFocused();
  });
});

test("DialogFullScreen from 640px up is the basic dialog, actions at the foot", async ({
  page,
}) => {
  await openStory(page, STORY.dialogFullScreenDesktop, DESKTOP);
  await opened(page);
  const rect = await box(panel(page));
  // `DialogMaxWidth` 560dp, centred; `DialogTokens.ContainerShape`
  // `CornerExtraLarge`, 28dp.
  expect(rect.width, "failed: not 560px wide").toBeCloseTo(560, 0);
  expect(rect.x, "failed: not centred").toBeCloseTo((DESKTOP.width - 560) / 2, 0);
  expect(await panel(page).evaluate((el) => getComputedStyle(el).borderTopLeftRadius)).toBe("28px");
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  const create = await box(page.getByRole("button", { name: "Create" }));
  const note = await box(page.getByRole("textbox", { name: "Note for the team" }));
  expect(create.y, "failed: the actions are not below the body").toBeGreaterThan(
    note.y + note.height,
  );
  const close = await box(page.getByRole("button", { name: "Close", exact: true }));
  expect([close.width, close.height], "failed: not the basic dialog's ✕").toEqual([24, 24]);
  expect(close.x + close.width, "failed: the ✕ is not in the top-right corner").toBeGreaterThan(
    rect.x + rect.width - 40,
  );
});

test("DialogContent on a phone stays the basic dialog: centred, 16px from each side", async ({
  page,
}) => {
  await openStory(page, STORY.dialogBasicPhone, PHONE);
  await opened(page);
  const rect = await box(panel(page));
  expect(rect.x, "failed: not 16px from the left").toBeCloseTo(16, 0);
  expect(rect.width, "failed: not the screen less 16px each side").toBeCloseTo(PHONE.width - 32, 0);
  expect(rect.height, "failed: a short dialog went full-screen").toBeLessThan(PHONE.height / 2);
  expect(await panel(page).evaluate((el) => getComputedStyle(el).borderTopLeftRadius)).toBe("28px");
});

test("M3's fill and type: SurfaceContainerHigh is surface-3, the headline 20px display", async ({
  page,
}) => {
  await openStory(page, STORY.dialogBasicPhone, PHONE);
  await opened(page);
  const style = await panel(page).evaluate((el) => {
    const probe = document.createElement("div");
    probe.style.background = "var(--color-surface-3)";
    document.body.append(probe);
    const surface3 = getComputedStyle(probe).backgroundColor;
    probe.remove();
    const heading = el.querySelector("h2") as HTMLElement;
    return {
      fill: getComputedStyle(el).backgroundColor,
      surface3,
      headlineSize: getComputedStyle(heading).fontSize,
    };
  });
  expect(style.fill, "failed: the panel is not surface-3").toBe(style.surface3);
  expect(style.headlineSize).toBe("20px");
});

test.describe("padding follows the pointer: 20dp for a precise one, 24dp for touch", () => {
  test("a mouse: 20px", async ({ page }) => {
    await openStory(page, STORY.dialogBasicPhone, PHONE);
    await opened(page);
    const rect = await box(panel(page));
    const title = await box(page.getByRole("heading", { name: "Rotate the signing secret?" }));
    expect(title.x - rect.x, "failed: not AlertDialog's 20dp precise-pointer padding").toBeCloseTo(
      20,
      0,
    );
  });

  test.describe("a touchscreen", () => {
    test.use({ hasTouch: true, isMobile: true, userAgent: devices["Pixel 5"].userAgent });
    test("24px", async ({ page }) => {
      await openStory(page, STORY.dialogBasicPhone, PHONE);
      await opened(page);
      const rect = await box(panel(page));
      const title = await box(page.getByRole("heading", { name: "Rotate the signing secret?" }));
      expect(title.x - rect.x, "failed: not AlertDialog's 24dp padding").toBeCloseTo(24, 0);
    });
  });
});

test("opened from the keyboard, the dialog draws no focus ring on its own container", async ({
  page,
}) => {
  // Headless UI focuses the dialog's root, a zero-height container; the
  // global `:focus-visible` ring drew a line across the page around it.
  await openStory(page, STORY.dialogBasicPhone, PHONE);
  await opened(page);
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
  const trigger = storyRoot(page).getByRole("button", { name: "Open dialog" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await opened(page);
  const rings = await page.evaluate(() =>
    [...document.querySelectorAll('[id^="headlessui-dialog-"]:not([id*="panel"])')].map(
      (el) => getComputedStyle(el).outlineStyle,
    ),
  );
  expect(rings.length, "failed: no dialog root found").toBeGreaterThan(0);
  expect(rings, "failed: the dialog's root container draws a focus ring").toEqual(
    rings.map(() => "none"),
  );
});

test("a Select opened while the dialog is still fading in lands under its trigger", async ({
  page,
}) => {
  // A `scale` enter made the panel a containing block that clips for
  // 435ms; a Select opened in that window flipped above its trigger, then
  // jumped (#32). The panel only fades now.
  await openStory(page, STORY.selectSearchableInDialog, DESKTOP);
  await storyRoot(page).getByRole("button", { name: "Open dialog" }).click();
  const trigger = page.getByRole("button", { name: "Channel" });
  // `force`: Playwright otherwise waits for the trigger to stop moving —
  // which, under a scaling enter, is exactly the end of the transition this
  // test is about.
  await trigger.click({ force: true });
  // Both rects in one go, the frame the list appears — not after a few
  // round trips, by which time a misplaced list has corrected itself.
  const gap = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const measure = () => {
          const list = document.querySelector('[role="listbox"]');
          const trigger = document.getElementById("dialog-channel");
          if (list === null || trigger === null) {
            requestAnimationFrame(measure);
            return;
          }
          resolve(list.getBoundingClientRect().y - trigger.getBoundingClientRect().bottom);
        };
        measure();
      }),
  );
  expect(gap, "failed: not 4px under its trigger during the enter").toBeCloseTo(4, 0);
});

test("a Select in the full-screen dialog opens its phone sheet over the dialog", async ({
  page,
}) => {
  await openStory(page, STORY.dialogFullScreenPhone, PHONE);
  await opened(page);
  await page.getByRole("button", { name: "Retry policy" }).click();
  const sheet = page.getByRole("listbox");
  await expect(sheet).toBeVisible();
  await settleTransitions(page);
  const rect = await box(sheet);
  expect(rect.y + rect.height, "failed: the sheet is not on the bottom edge").toBeCloseTo(
    PHONE.height,
    0,
  );
  expect(rect.width, "failed: the sheet is not full-width").toBeCloseTo(PHONE.width, 0);
  const onTop = await sheet.evaluate((element) => {
    const r = element.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return hit !== null && element.contains(hit);
  });
  expect(onTop, "failed: the sheet is drawn under the dialog").toBe(true);
});
