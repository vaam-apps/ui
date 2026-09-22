import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { box, openStory, paintedFillRatio, settleTransitions, storyRoot } from "./helpers";
import { STORY } from "./story-ids";

/** The four corner radii of `target`, in px, via `getComputedStyle` —
 * never the class string (see this file's own header). */
async function cornerRadii(target: Locator): Promise<number[]> {
  return await target.evaluate((el) => {
    const style = getComputedStyle(el);
    return [
      style.borderTopLeftRadius,
      style.borderTopRightRadius,
      style.borderBottomLeftRadius,
      style.borderBottomRightRadius,
    ].map((value) => Number.parseFloat(value));
  });
}

/** Holds the pointer down on `target` — real `:active`, not a class toggle
 * — waits out the radius transition, and hands back the settled shape.
 * The caller is responsible for `page.mouse.up()` afterwards. */
async function pressAndSettle(page: Page, target: Locator): Promise<number[]> {
  await target.hover();
  await page.mouse.down();
  await settleTransitions(page);
  return await cornerRadii(target);
}

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

/**
 * The M3 Expressive press-shape morph (`src/lib/press-shape.ts`), on a
 * real `:active` state — a class-string assertion cannot see this at all
 * (this file's own header explains why nothing here reads `className`),
 * and neither can `a11y.test.tsx`'s jsdom render, which has no
 * `getComputedStyle` cascade to answer with. Only a held pointer in a
 * real browser proves the radius actually changes and actually reverts.
 */
test.describe("the press-shape morph steps the radius down while held", () => {
  test("a text button steps from --radius-field to a fifth of its own height", async ({ page }) => {
    await openStory(page, STORY.buttonVariants);
    const button = storyRoot(page).getByRole("button", { name: "Primary" });

    const resting = await cornerRadii(button);
    for (const radius of resting) {
      // `rounded-field` — see `theme.css`'s D8 comment.
      expect(radius, "resting corner radius").toBeCloseTo(12, 0);
    }

    const pressed = await pressAndSettle(page, button);
    try {
      for (const radius of pressed) {
        // D10: no longer `--radius-selector` by name — `--btn-press-radius`
        // now computes `calc(var(--size) * 0.2)` per `theme.css`'s
        // "Density register" section, and this button's compact/`md`
        // `--size` is 40px, so 40 * 0.2 = 8, the exact same number the
        // flat constant produced here before. Compact stays
        // byte-identical; `density.spec.ts` covers the comfortable
        // register, where this button is 56px and the target is ~11.2.
        expect(radius, "pressed corner radius").toBeCloseTo(8, 0);
      }
    } finally {
      await page.mouse.up();
    }
    // The release is itself a transition (the spring bouncing back to
    // `--radius-field`), so the first paint after `mouse.up()` is still
    // mid-flight — reading immediately reads whatever frame happened to
    // land, not the settled shape. Same reasoning as this file's own
    // `settleTransitions` calls elsewhere.
    await settleTransitions(page);

    const released = await cornerRadii(button);
    for (const radius of released) {
      expect(radius, "corner radius after release").toBeCloseTo(12, 0);
    }
  });

  test("a circular icon button eases off the circle by a tenth of its height, not to a square", async ({
    page,
  }) => {
    await openStory(page, STORY.buttonSizes);
    const icon = storyRoot(page).getByRole("button", { name: "Icon button" });
    const rect = await box(icon);

    const resting = await cornerRadii(icon);
    for (const radius of resting) {
      expect(radius, "resting corner radius, against a circle").toBeGreaterThanOrEqual(
        rect.width / 2,
      );
    }

    const pressed = await pressAndSettle(page, icon);
    try {
      for (const radius of pressed) {
        // D10: this used to be 8px — a flat quarter of the 32px box, the
        // exact "becoming a square on long-press" bug report `theme.css`'s
        // "Density register" section quotes. `.btn-circle`'s own
        // `--btn-press-radius: calc(var(--size) * 0.1)` now drives it:
        // 32 * 0.1 = 3.2, a gentler proportional nudge instead of a flat
        // quarter-box step.
        expect(radius, "pressed corner radius").toBeCloseTo(3.2, 1);
        expect(radius, "pressed corner radius is no longer a circle").toBeLessThan(rect.width / 2);
      }
    } finally {
      await page.mouse.up();
    }
  });

  test("the dialog close button — PRESS_SHAPE_MORPH's shared family — morphs the same way", async ({
    page,
  }) => {
    await openStory(page, STORY.dialogScrollingBody);
    await storyRoot(page).getByRole("button", { name: "Open tall dialog" }).click();
    const close = page.locator('button[aria-label="Close"]');
    await expect(close).toBeVisible();
    await settleTransitions(page);
    const rect = await box(close);

    const resting = await cornerRadii(close);
    for (const radius of resting) {
      expect(radius, "resting corner radius, against a circle").toBeGreaterThanOrEqual(
        rect.width / 2,
      );
    }

    const pressed = await pressAndSettle(page, close);
    try {
      for (const radius of pressed) {
        // D10: `DialogClose` is a fixed 24×24 box (16px icon, `-m-1 p-1`),
        // not a `.btn-circle`, so it supplies its own
        // `--btn-press-radius: calc(24px * 0.1)` — see `dialog.tsx`'s own
        // comment on the close button. 24 * 0.1 = 2.4.
        expect(radius, "pressed corner radius").toBeCloseTo(2.4, 1);
      }
    } finally {
      await page.mouse.up();
    }
  });
});
