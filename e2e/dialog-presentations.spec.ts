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
  await expect(page.getByRole("heading").first(), "failed: the dialog did not open").toBeVisible();
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
    expect(title.y, "failed: the headline sits in or above the bar").toBeGreaterThanOrEqual(64);
  });

  test("the bar's Create submits the form; the close icon closes and returns focus", async ({
    page,
  }) => {
    await openStory(page, STORY.dialogFullScreenPhone, PHONE);
    await opened(page);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(panel(page), "failed: submitting did not close the dialog").toHaveCount(0);
    await expect(
      storyRoot(page).getByText("created: https://hooks.example.com/vaam"),
      "failed: the bar's Create did not submit the form",
    ).toBeVisible();

    await storyRoot(page).getByRole("button", { name: "New endpoint" }).click();
    await opened(page);
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(panel(page), "failed: the close icon did not close the dialog").toHaveCount(0);
    await expect(
      storyRoot(page).getByRole("button", { name: "New endpoint" }),
      "failed: focus did not return to the trigger",
    ).toBeFocused();
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
  expect(
    await panel(page).evaluate((el) => getComputedStyle(el).borderTopLeftRadius),
    "failed: not M3's 28dp corners",
  ).toBe("28px");
  await expect(
    page.getByRole("button", { name: "Cancel" }),
    "failed: Cancel is hidden in the basic dialog",
  ).toBeVisible();
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
  expect(
    await panel(page).evaluate((el) => getComputedStyle(el).borderTopLeftRadius),
    "failed: not M3's 28dp corners",
  ).toBe("28px");
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
  expect(style.headlineSize, "failed: the headline is not text-title's 20px").toBe("20px");
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
  await expect(panel(page), "failed: Escape did not close the dialog").toHaveCount(0);
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
  await expect(sheet, "failed: the Select did not open").toBeVisible();
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

test.describe("a bare DialogClose among the actions is an icon action, not a second close icon", () => {
  test("below 640px, full-screen: hidden, one close icon in the bar", async ({ page }) => {
    await openStory(page, STORY.dialogCloseAmongActions, PHONE);
    await opened(page);
    await expect(
      page.getByRole("button", { name: "Discard draft" }),
      "failed: a second close icon shows in the full-screen dialog",
    ).toBeHidden();
    const close = await box(page.getByRole("button", { name: "Close", exact: true }));
    expect(
      [close.x, close.y, close.width, close.height],
      "failed: not the bar's close icon",
    ).toEqual([4, 8, 48, 48]);
  });

  test("from 640px up: a ✕ in the actions row, the dialog's own ✕ still in its corner", async ({
    page,
  }) => {
    await openStory(page, STORY.dialogCloseAmongActions, DESKTOP);
    await opened(page);
    const discard = await box(page.getByRole("button", { name: "Discard draft" }));
    const save = await box(page.getByRole("button", { name: "Save draft" }));
    expect(
      discard.y + discard.height / 2,
      "failed: the icon action is not in the actions row",
    ).toBeCloseTo(save.y + save.height / 2, 0);
    // In flow, before "Save draft" as written — a chrome-positioned ✕ would
    // sit on top of the button instead.
    expect(
      discard.x + discard.width,
      "failed: the icon action overlaps Save draft instead of standing beside it",
    ).toBeLessThanOrEqual(save.x);
    const close = await box(page.getByRole("button", { name: "Close", exact: true }));
    expect(close.y, "failed: the dialog's own ✕ left its corner").toBeLessThan(save.y - 40);
  });
});

/** Computed background of an element, and of a probe painted with a token,
 * so a fill is compared as the browser resolves it. */
async function fills(page: Page) {
  return page.evaluate(() => {
    const probe = (token: string) => {
      const el = document.createElement("div");
      el.style.background = `var(${token})`;
      document.body.append(el);
      const value = getComputedStyle(el).backgroundColor;
      el.remove();
      return value;
    };
    const radio = (name: string) => {
      const el = [...document.querySelectorAll('[role="radio"]')].find((r) =>
        r.textContent?.includes(name),
      );
      return el === undefined ? "missing" : getComputedStyle(el).backgroundColor;
    };
    const panel = document.querySelector('[id^="headlessui-dialog-panel"]') as HTMLElement;
    const header = panel.querySelector("[data-dialog-header]") as HTMLElement;
    return {
      panel: getComputedStyle(panel).backgroundColor,
      header: getComputedStyle(header).backgroundColor,
      checked: radio("JSON"),
      unchecked: radio("Form-encoded"),
      surface2: probe("--color-surface-2"),
      surface3: probe("--color-surface-3"),
      surface4: probe("--surface-4"),
      base100: probe("--color-base-100"),
    };
  });
}

test.describe("inside the dialog, surfaces step up one, so a selected fill still shows", () => {
  test("the basic dialog: the panel surface-3, a checked option surface-4 over unchecked surface-3", async ({
    page,
  }) => {
    await openStory(page, STORY.dialogFullScreenDesktop, DESKTOP);
    await opened(page);
    const f = await fills(page);
    expect(f.panel, "failed: the panel's own fill moved with the step-up").toBe(f.surface3);
    expect(f.header, "failed: the sticky header's fill does not match the panel").toBe(f.panel);
    expect(
      f.checked,
      "failed: the checked option's fill is not surface-4 — the selection does not show on the panel",
    ).toBe(f.surface4);
    expect(f.unchecked, "failed: an unchecked option is not a step under the checked one").toBe(
      f.surface3,
    );
  });

  test("full-screen on a phone: the page's own ground, no step-up", async ({ page }) => {
    await openStory(page, STORY.dialogFullScreenPhone, PHONE);
    await opened(page);
    const f = await fills(page);
    expect(f.panel, "failed: the full-screen panel is not the page's ground").toBe(f.base100);
    expect(f.checked, "failed: a checked option on the page ground is not surface-3").toBe(
      f.surface3,
    );
    expect(f.unchecked, "failed: an unchecked option on the page ground is not surface-2").toBe(
      f.surface2,
    );
  });
});

test.describe("the buttons sit M3's textPadding under the text: 16dp for a mouse", () => {
  test("straight after the header", async ({ page }) => {
    await openStory(page, STORY.dialogBasicPhone, PHONE);
    await opened(page);
    const description = await box(page.getByText("The current secret keeps verifying"));
    const button = await box(page.getByRole("button", { name: "Rotate" }));
    expect(
      button.y - (description.y + description.height),
      "failed: not 16px from the text to the buttons",
    ).toBeCloseTo(16, 0);
  });

  test("after a body", async ({ page }) => {
    await openStory(page, STORY.dialogFullScreenDesktop, DESKTOP);
    await opened(page);
    const form = await box(page.locator("#sb-endpoint-form"));
    const button = await box(page.getByRole("button", { name: "Create" }));
    expect(
      button.y - (form.y + form.height),
      "failed: not 16px from the body to the buttons",
    ).toBeCloseTo(16, 0);
  });
});

test("a basic dialog on a phone keeps its Cancel — only the full-screen bar hides it", async ({
  page,
}) => {
  await openStory(page, STORY.dialogBasicPhone, PHONE);
  await opened(page);
  await expect(
    page.getByRole("button", { name: "Cancel" }),
    "failed: the basic dialog hid its dismiss action",
  ).toBeVisible();
});

test("full-screen: a DialogClose in the body stays; only the actions' one goes", async ({
  page,
}) => {
  await openStory(page, STORY.dialogCloseAmongActions, PHONE);
  await opened(page);
  await expect(
    page.getByRole("button", { name: "Keep for later" }),
    "failed: a DialogClose outside the actions was hidden too",
  ).toBeVisible();
});

test.describe("the full-screen dialog's layout below 640px", () => {
  test("the bar's actions start clear of the close icon; the header keeps no ✕ gutter", async ({
    page,
  }) => {
    await openStory(page, STORY.dialogFullScreenPhone, PHONE);
    await opened(page);
    const style = await page.evaluate(() => {
      const panel = document.querySelector('[id^="headlessui-dialog-panel"]') as HTMLElement;
      const actions = (panel.querySelector('button[form="sb-endpoint-form"]') as HTMLElement)
        .parentElement as HTMLElement;
      const header = panel.querySelector("[data-dialog-header]") as HTMLElement;
      return {
        actionsLeft: getComputedStyle(actions).left,
        headerRight: getComputedStyle(header).paddingRight,
        headerLeft: getComputedStyle(header).paddingLeft,
      };
    });
    // 4dp + 48dp + 4dp: the close icon's leading space, its box, a gap.
    expect(style.actionsLeft, "failed: the bar's actions can run under the close icon").toBe(
      "56px",
    );
    expect(
      style.headerRight,
      "failed: the header keeps the corner ✕'s gutter although the close is in the bar",
    ).toBe(style.headerLeft);
  });

  test("scrolled to the end, the last field clears the bottom edge by the padding", async ({
    page,
  }) => {
    await openStory(page, STORY.dialogFullScreenPhone, PHONE);
    await opened(page);
    await page.evaluate(() => {
      const panel = document.querySelector('[id^="headlessui-dialog-panel"]') as HTMLElement;
      const scroller = [...panel.children].find(
        (child) => getComputedStyle(child).overflowY === "auto",
      ) as HTMLElement;
      // The story's form fits an 812px screen; a spacer ahead of it makes
      // the body scroll, or this would measure a gap nothing produced.
      const spacer = document.createElement("div");
      spacer.style.height = "1200px";
      scroller.prepend(spacer);
      scroller.scrollTop = scroller.scrollHeight;
      if (scroller.scrollTop === 0) throw new Error("the dialog body did not scroll");
    });
    const note = await box(page.getByRole("textbox", { name: "Note for the team" }));
    // 20px: a mouse's `--dialog-pad`; the safe-area inset is 0 here.
    expect(
      PHONE.height - (note.y + note.height),
      "failed: the last field is not clear of the bottom edge",
    ).toBeGreaterThanOrEqual(20 - 1);
  });
});

test("a bare DialogClose in the header is a 24px icon button, not a stretched pill", async ({
  page,
}) => {
  await openStory(page, STORY.dialogCloseAmongActions, DESKTOP);
  await opened(page);
  const icon = await box(page.getByRole("button", { name: "Close the draft" }));
  expect(
    [icon.width, icon.height],
    "failed: the header's column stretched the icon button",
  ).toEqual([24, 24]);
});

test.describe("a touchscreen gets M3's 24dp between the text and the buttons", () => {
  test.use({ hasTouch: true, isMobile: true, userAgent: devices["Pixel 5"].userAgent });
  test("straight after the header", async ({ page }) => {
    await openStory(page, STORY.dialogBasicPhone, PHONE);
    await opened(page);
    const description = await box(page.getByText("The current secret keeps verifying"));
    const button = await box(page.getByRole("button", { name: "Rotate" }));
    expect(
      button.y - (description.y + description.height),
      "failed: not 24px from the text to the buttons on touch",
    ).toBeCloseTo(24, 0);
  });
});

test("full-screen, actions straight after the header still centre in the bar", async ({ page }) => {
  await openStory(page, STORY.dialogFullScreenPhone, PHONE);
  await opened(page);
  // No body between the header and the actions: the rule that closes up
  // the header's margin for the basic dialog must not move the bar's
  // buttons.
  await page.evaluate(() => document.getElementById("sb-endpoint-form")?.remove());
  const create = await box(page.getByRole("button", { name: "Create" }));
  expect(create.y + create.height / 2, "failed: Create left the centre of the bar").toBeCloseTo(
    32,
    0,
  );
});

test("inside the dialog, surface-1 reads as surface-2 too", async ({ page }) => {
  await openStory(page, STORY.dialogFullScreenDesktop, DESKTOP);
  await opened(page);
  const result = await page.evaluate(() => {
    const paint = (parent: Element) => {
      const el = document.createElement("div");
      el.className = "bg-surface-1";
      parent.append(el);
      const value = getComputedStyle(el).backgroundColor;
      el.remove();
      return value;
    };
    const header = document.querySelector("[data-dialog-header]") as HTMLElement;
    const outside = paint(document.body);
    const inside = paint(header.parentElement as HTMLElement);
    const probe = document.createElement("div");
    probe.className = "bg-surface-2";
    document.body.append(probe);
    const surface2 = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return { outside, inside, surface2 };
  });
  expect(result.inside, "failed: surface-1 did not step up inside the dialog").toBe(
    result.surface2,
  );
  expect(result.outside, "failed: the probe did not paint surface-1 at all").not.toBe(
    result.inside,
  );
});
