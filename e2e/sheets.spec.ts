import { expect, type Locator, type Page, test } from "@playwright/test";
import { box, openStory, settleTransitions, storyRoot } from "./helpers";
import { STORY } from "./story-ids";

/**
 * Every `vaul` sheet in the library is an M3 sheet: no outline, rounded
 * where it meets the screen's interior, `surface-container-low`, and on a
 * phone M3's drag handle. The owner's report was "there's a border,
 * straight lines" — measured here as computed border widths and radii on
 * the open sheet, not as class strings.
 */

const PHONE = { width: 375, height: 812 };

/** What a CSS colour expression resolves to under the story's theme. */
async function resolve(page: Page, colour: string): Promise<string> {
  return await page.evaluate((value) => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = value;
    document.body.append(probe);
    const resolved = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return resolved;
  }, colour);
}

async function surface(target: Locator) {
  return await target.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      borders: [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth],
      radii: [
        s.borderTopLeftRadius,
        s.borderTopRightRadius,
        s.borderBottomRightRadius,
        s.borderBottomLeftRadius,
      ],
      fill: s.backgroundColor,
      shadow: s.boxShadow,
    };
  });
}

/** `--shadow-dialog` carried a `0 0 0 1px` ring: a border by other means. */
function hasHairlineRing(shadow: string): boolean {
  return /0px 0px 0px 1px/.test(shadow);
}

test.describe("M3 sheets: no outline, rounded, surface-container-low", () => {
  test("detail drawer on a phone: a bottom sheet with 28px top corners and M3's handle", async ({
    page,
  }) => {
    await openStory(page, STORY.drawers, PHONE);
    await storyRoot(page).getByRole("button", { name: "More detail" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await settleTransitions(page);

    const s = await surface(sheet);
    expect(s.borders, "no outline on any side").toEqual(["0px", "0px", "0px", "0px"]);
    expect(s.radii).toEqual(["28px", "28px", "0px", "0px"]);
    expect(s.fill).toBe(await resolve(page, "var(--md-sys-color-surface-container-low)"));
    expect(hasHairlineRing(s.shadow), `no 1px ring in the shadow: ${s.shadow}`).toBe(false);

    // The header and footer no longer draw hairlines either.
    const ruled = await sheet.evaluate(
      (el) =>
        [...el.querySelectorAll("div")].filter((d) => {
          const c = getComputedStyle(d);
          return (
            Number.parseFloat(c.borderTopWidth) > 0 || Number.parseFloat(c.borderBottomWidth) > 0
          );
        }).length,
    );
    expect(ruled, "no divider inside the sheet").toBe(0);

    const handle = sheet.locator("[data-vaul-handle]");
    const rect = await box(handle);
    expect([Math.round(rect.width), Math.round(rect.height)]).toEqual([32, 4]);
    const look = await handle.evaluate((el) => {
      const c = getComputedStyle(el);
      return { opacity: c.opacity, fill: c.backgroundColor };
    });
    expect(look.opacity, "M3's 40% handle").toBe("0.4");
    expect(look.fill).toBe(await resolve(page, "var(--md-sys-color-on-surface-variant)"));
    // Both edges read in one frame: vaul's entry is a keyframe animation
    // (not a transition `settleTransitions` waits for), and two separate
    // reads straddle frames of it.
    const gap = await handle.evaluate(
      (el) =>
        el.getBoundingClientRect().y -
        (el.closest("[role=dialog]")?.getBoundingClientRect().y ?? Number.NaN),
    );
    expect(gap, "22dp above the handle").toBeCloseTo(22, 0);
  });

  test("detail drawer on a desktop: a side sheet, 16px on the leading edge only", async ({
    page,
  }) => {
    await openStory(page, STORY.drawers);
    await storyRoot(page).getByRole("button", { name: "Quick detail" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await settleTransitions(page);
    const s = await surface(sheet);
    expect(s.borders).toEqual(["0px", "0px", "0px", "0px"]);
    expect(s.radii, "rounded where it meets the page, square at the window edge").toEqual([
      "16px",
      "0px",
      "0px",
      "16px",
    ]);
    expect(s.fill).toBe(await resolve(page, "var(--md-sys-color-surface-container-low)"));
    expect(hasHairlineRing(s.shadow)).toBe(false);
  });

  test("the generic DrawerContent: the same side sheet", async ({ page }) => {
    await openStory(page, STORY.plainDrawer);
    await storyRoot(page).getByRole("button", { name: "Open drawer" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await settleTransitions(page);
    const s = await surface(sheet);
    expect(s.borders).toEqual(["0px", "0px", "0px", "0px"]);
    expect(s.radii).toEqual(["16px", "0px", "0px", "16px"]);
    expect(s.fill).toBe(await resolve(page, "var(--md-sys-color-surface-container-low)"));
    expect(hasHairlineRing(s.shadow)).toBe(false);
  });

  test("Select's phone sheet and SideNav's account sheet are the same material", async ({
    page,
  }) => {
    await openStory(page, STORY.selectPhoneSheet, PHONE);
    const listbox = storyRoot(page).getByRole("listbox");
    await expect(listbox).toBeVisible();
    await settleTransitions(page);
    const select = await surface(listbox);
    const low = await resolve(page, "var(--md-sys-color-surface-container-low)");
    expect(select.borders).toEqual(["0px", "0px", "0px", "0px"]);
    expect(select.fill).toBe(low);
    const grip = listbox.locator("[data-sheet-handle] > span");
    expect(await grip.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      await resolve(
        page,
        "color-mix(in oklab, var(--md-sys-color-on-surface-variant) 40%, transparent)",
      ),
    );

    await openStory(page, STORY.sideNavAccountSheetPhone, PHONE);
    const nav = page.locator('[data-side-nav-sheet="bottom"]');
    await expect(nav).toBeVisible();
    await settleTransitions(page);
    const navSurface = await surface(nav);
    expect(navSurface.borders).toEqual(["0px", "0px", "0px", "0px"]);
    expect(navSurface.radii.slice(0, 2)).toEqual(["28px", "28px"]);
    expect(navSurface.fill).toBe(await resolve(page, "var(--md-sys-color-surface-container-low)"));
    expect(
      await nav.locator("[data-vaul-handle]").evaluate((el) => getComputedStyle(el).opacity),
    ).toBe("0.4");
  });
});
