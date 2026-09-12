import { expect, test } from "@playwright/test";
import { box, openStory, paintedFillRatio, settleTransitions, storyRoot } from "./helpers";
import { STORY } from "./story-ids";

/**
 * Shapes and sizes, measured off the render.
 *
 * Everything here was once asserted from a class string instead, and the
 * class string was right while the render was wrong — `button.tsx`'s own
 * comment records `rounded-field` (12px) silently defeating
 * `.btn-circle`'s radius on a control whose class list said `btn-circle`,
 * and `side-nav.tsx`'s records a 16×32px tap target under a comment
 * claiming 40px. So nothing below reads `className`.
 */

test.describe('Button size="icon" is a circle', () => {
  test("its box is square and every corner radius reaches the half-width", async ({ page }) => {
    await openStory(page, STORY.buttonSizes);
    const icon = storyRoot(page).getByRole("button", { name: "Icon button" });
    const rect = await box(icon);

    // A circle needs a square box first: `border-radius: 9999px` on a
    // 64×32 box is a stadium, not a circle.
    expect(rect.width, "icon button width").toBe(rect.height);

    const radii = await icon.evaluate((el) => {
      const style = getComputedStyle(el);
      return [
        style.borderTopLeftRadius,
        style.borderTopRightRadius,
        style.borderBottomLeftRadius,
        style.borderBottomRightRadius,
      ].map((value) => Number.parseFloat(value));
    });
    for (const radius of radii) {
      expect(radius, `corner radius against a ${rect.width}px box`).toBeGreaterThanOrEqual(
        rect.width / 2,
      );
    }
  });

  test("the pixels it paints cover a disc, not a rounded square", async ({ page }) => {
    await openStory(page, STORY.buttonSizes);
    const icon = storyRoot(page).getByRole("button", { name: "Icon button" });
    const ratio = await paintedFillRatio(page, await box(icon));

    // π/4 = 0.7854 for a disc; 0.879 for the 12px-radius square this
    // component actually shipped, twice; 1.0 for a plain square. The
    // glyph is darker than the fill on a dark ground, which costs a
    // couple of percent, hence the asymmetric window.
    expect(ratio, "fraction of the button's box that is painted").toBeGreaterThan(0.7);
    expect(ratio, "fraction of the button's box that is painted").toBeLessThan(0.82);
  });
});

test.describe("tap targets on the phone-width nav", () => {
  test("every control in the bottom rail is at least 44×44", async ({ page }) => {
    await openStory(page, STORY.sideNavInAShell, { width: 375, height: 720 });
    const rail = page.locator('[data-floating-rail-axis="horizontal"]');
    await expect(rail).toBeVisible();

    const controls = rail.locator("a, button");
    const count = await controls.count();
    // Four destination slots plus the overflow menu — the number
    // `HORIZONTAL_RAIL_SLOTS` exists to guarantee at this width.
    expect(count, "controls in the bottom rail").toBe(5);

    for (let index = 0; index < count; index += 1) {
      const rect = await box(controls.nth(index));
      expect(rect.width, `control ${index} width`).toBeGreaterThanOrEqual(44);
      expect(rect.height, `control ${index} height`).toBeGreaterThanOrEqual(44);
    }
  });

  test("every control in the vertical rail clears the 24px floor", async ({ page }) => {
    await openStory(page, STORY.sideNavInAShell, { width: 900, height: 700 });
    const rail = page.locator("[data-floating-rail]:not([data-floating-rail-axis])");
    await expect(rail).toBeVisible();

    const links = rail.locator("a");
    const count = await links.count();
    expect(count, "links in the vertical rail").toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      const rect = await box(links.nth(index));
      // WCAG 2.2 §2.5.8, the floor rather than the 44px ideal: this band
      // starts at 640px and is a pointer surface as often as a touch one.
      expect(rect.width, `rail link ${index} width`).toBeGreaterThanOrEqual(24);
      expect(rect.height, `rail link ${index} height`).toBeGreaterThanOrEqual(24);
    }
  });
});

test("the dialog's close button is a real target, not just an icon", async ({ page }) => {
  await openStory(page, STORY.dialogScrollingBody);
  await storyRoot(page).getByRole("button", { name: "Open tall dialog" }).click();
  // By attribute, not by accessible name: the footer's own `DialogClose`
  // button is *also* named "Close", and the one this test is about is
  // the icon in the corner.
  const close = page.locator('button[aria-label="Close"]');
  await expect(close).toBeVisible();
  // The panel enters from `scale-95`, so an immediate measurement reads
  // 95% of every dimension — 22.8px for this button, which is a fact
  // about the transition rather than about the control.
  await settleTransitions(page);

  const rect = await box(close);
  // `dialog.tsx` grows a 16px icon with `-m-1 p-1` precisely so this is
  // bigger than the glyph. 24 is WCAG 2.2 §2.5.8's floor.
  expect(rect.width, "close button width").toBeGreaterThanOrEqual(24);
  expect(rect.height, "close button height").toBeGreaterThanOrEqual(24);
});
