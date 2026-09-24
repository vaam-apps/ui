import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  box,
  openStory,
  paintedFillRatio,
  settleTransitions,
  storyRoot,
  tapTargetSize,
} from "./helpers";
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
 * The caller is responsible for `page.mouse.up()` afterwards.
 *
 * The `:active` check is the premise, not an extra assertion. `hover()`
 * aims at the box it measured; `mouse.down()` fires at wherever the
 * pointer already is, so anything that re-lays the page out in between
 * presses the background instead — and then nothing is transitioning,
 * `settleTransitions` returns in 0ms, and the radius read below is the
 * *resting* one. On a circle that resting value is `rounded-full`'s
 * 33554400px, which reads as "the morph never fired" rather than as "the
 * press never landed": exactly how a 16px webfont reflow was
 * mis-diagnosed once (`helpers.ts`'s own `openStory` header has the
 * measurements). A missed press now says so. */
async function pressAndSettle(page: Page, target: Locator): Promise<number[]> {
  await target.hover();
  await page.mouse.down();
  expect(
    await target.evaluate((el) => el.matches(":active")),
    "the pointer press landed on the control",
  ).toBe(true);
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
 * and `src/docs/07-navigation.mdx` records the nav rail shipping a 16×32px
 * tap target under a comment claiming 40px. So nothing below reads
 * `className`.
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
  test("every control in the bottom rail is at least 48×48", async ({ page }) => {
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
      // 48, not the 44 this started at: the rail is M3's floating toolbar
      // now, and `FloatingToolbarDefaults.ContentPadding` is sized around
      // "the minimum touch target (48.dp)". `floating-toolbar.spec.ts`
      // pins the rest of its geometry.
      expect(rect.width, `control ${index} width`).toBeGreaterThanOrEqual(48);
      expect(rect.height, `control ${index} height`).toBeGreaterThanOrEqual(48);
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

/**
 * D11 — the comfortable-register tap-target floor (`theme.css`'s own
 * header on `.tap-target`), for every icon-only affordance whose glyph
 * stays visually small in both densities: a real browser is the only
 * thing that can prove the invisible `::before` overlay both a) reaches
 * 48px at comfortable and b) leaves the control's own visual box
 * untouched — jsdom has no `getComputedStyle(el, "::before")` at all
 * (`AGENTS.md`'s own standing trap), so `density.test.ts` cannot see this
 * half of D11 the way it pins D10's own formulas.
 *
 * One assertion pair per control, not a table-driven loop: each needs its
 * own story, its own way of becoming visible (several are behind a
 * trigger click), and its own visual-box pair — folding that into a
 * shared loop body would hide more than it would save. A *new* icon-only
 * affordance joins this list the same way an existing one is checked
 * here: open its story, locate it, assert `tapTargetSize` lands on 48 at
 * `comfortable` and still matches its own resting box at `compact`.
 *
 * **And then it joins `e2e/tap-targets.spec.ts` too, which is the
 * complement this block cannot be.** Everything here is a size, and a
 * size is necessary rather than sufficient: every assertion below passed
 * while `MaskedValue`'s reveal toggle was unreachable by pointer, because
 * its `CopyButton` sibling's own perfectly-sized 48px covered 16 of the
 * toggle's 20 visible pixels and won hit-testing by DOM order. Size here,
 * ownership and exclusivity there; a control needs both.
 */
/** `toMatchObject` failed on a real, sub-pixel `getBoundingClientRect()`
 * value (`24.00000762939453`) the first time this suite ran — Chromium's
 * layout is not required to land on an exact integer, so every size
 * assertion below goes through `toBeCloseTo(n, 0)` (±0.5px) instead, the
 * same tolerance `density.spec.ts` already uses for the same reason. */
function expectSize(
  actual: { width: number; height: number },
  expected: { width: number; height: number },
  label: string,
): void {
  expect(actual.width, `${label} width`).toBeCloseTo(expected.width, 0);
  expect(actual.height, `${label} height`).toBeCloseTo(expected.height, 0);
}

/**
 * `tapTargetSize` landing **on** 48 on both axes — the one assertion every
 * control below needs at `comfortable`, regardless of its own compact
 * shape.
 *
 * A floor and a ceiling, not just a floor, and the ceiling is the half
 * that was missing. This function used to be `expectFloor` and asserted
 * only `toBeGreaterThanOrEqual(48)`: raising the target from 48px to
 * **480px** left all 48 e2e tests and all 945 unit tests green, because
 * nothing anywhere objected to a target being too big. Too big is not
 * generous — a target larger than it was reserved room for is a target
 * sitting on its neighbour, which is precisely the defect
 * `tap-targets.spec.ts` exists to catch. 48 is a minimum *and* the
 * number the formula computes, so both bounds are assertable here and
 * both are asserted; `Switch`'s two axes reach it by different per-side
 * amounts (see that test's own comment) and still land on 48.
 *
 * ±0.5px for the same reason `expectSize` above carries it: Chromium's
 * layout is not required to land on an integer.
 */
function expectTapTarget(actual: { width: number; height: number }): void {
  expect(actual.width, "comfortable tap target width, floor").toBeGreaterThanOrEqual(48);
  expect(actual.height, "comfortable tap target height, floor").toBeGreaterThanOrEqual(48);
  expect(actual.width, "comfortable tap target width, ceiling").toBeLessThanOrEqual(48.5);
  expect(actual.height, "comfortable tap target height, ceiling").toBeLessThanOrEqual(48.5);
}

test.describe("D11 — comfortable tap-target floor (48dp) on icon-only affordances", () => {
  test("Checkbox: 16×16 visual box, unchanged; tap target reaches 48×48", async ({ page }) => {
    await openStory(page, STORY.checkboxAndSwitch);
    const checked = storyRoot(page).getByRole("checkbox", { name: "Checked", exact: true });
    expectSize(await box(checked), { width: 16, height: 16 }, "compact visual box");
    // Not 16×16: an absolutely-positioned pseudo-element resolves its
    // `auto` width/height against its containing block's *padding* edge,
    // not its border edge (CSS Position §4), and this host is `border`
    // (1px) — `.tap-target`'s own `--tap-border` header explains why the
    // *comfortable* number still lands on a clean 48 despite this; at
    // `density: 0` every inset is exactly `0 * (…) = 0` regardless of
    // `--tap-border`, so what's left is the bare padding-box size,
    // 16 - 2×1 = 14. This is not a regression to guard against — the
    // host's own native hit box is still its full 16×16 border box, and
    // the (here inert) overlay never shrinks it, only ever grows it.
    expectSize(await tapTargetSize(checked), { width: 14, height: 14 }, "compact tap target");

    await openStory(page, STORY.checkboxAndSwitch, { density: "comfortable" });
    const checkedComfortable = storyRoot(page).getByRole("checkbox", {
      name: "Checked",
      exact: true,
    });
    expectSize(
      await box(checkedComfortable),
      { width: 16, height: 16 },
      "comfortable visual box, unchanged",
    );
    expectTapTarget(await tapTargetSize(checkedComfortable));
  });

  test("Switch: 36×20 visual track, unchanged; tap target reaches 48×48 on both axes", async ({
    page,
  }) => {
    await openStory(page, STORY.checkboxAndSwitch);
    const toggle = storyRoot(page).getByRole("switch", { name: "Toggle" });
    expectSize(await box(toggle), { width: 36, height: 20 }, "compact visual box");
    // 36 - 2×1, 20 - 2×1 — the same padding-edge-vs-border-edge gap the
    // `Checkbox` test above explains; this host is `border` (1px) too.
    expectSize(await tapTargetSize(toggle), { width: 34, height: 18 }, "compact tap target");

    await openStory(page, STORY.checkboxAndSwitch, { density: "comfortable" });
    const toggleComfortable = storyRoot(page).getByRole("switch", { name: "Toggle" });
    expectSize(
      await box(toggleComfortable),
      { width: 36, height: 20 },
      "comfortable visual box, unchanged",
    );
    // The narrower axis (height, 20px) needs a bigger per-side expansion
    // than the wider one (width, 36px) to reach the same 48px floor —
    // exactly the case `--tap-w`/`--tap-h` (rather than one `--tap-size`)
    // exists for. `expectFloor` checks both axes independently.
    expectTapTarget(await tapTargetSize(toggleComfortable));
  });

  test("CopyButton: 20×20 visual box (default size=12), unchanged; tap target reaches 48×48", async ({
    page,
  }) => {
    await openStory(page, STORY.idsConstrained);
    const copy = storyRoot(page).getByRole("button", { name: /^Copy / });
    expectSize(await box(copy), { width: 20, height: 20 }, "compact visual box");
    // No border on this host, so the padding-box gap `Checkbox`'s own
    // comment explains does not apply — a genuine no-op at density 0.
    expectSize(await tapTargetSize(copy), { width: 20, height: 20 }, "compact tap target");

    await openStory(page, STORY.idsConstrained, { density: "comfortable" });
    const copyComfortable = storyRoot(page).getByRole("button", { name: /^Copy / });
    expectSize(
      await box(copyComfortable),
      { width: 20, height: 20 },
      "comfortable visual box, unchanged",
    );
    expectTapTarget(await tapTargetSize(copyComfortable));
  });

  test("MaskedValue's reveal toggle: 20×20 visual box, unchanged; tap target reaches 48×48", async ({
    page,
  }) => {
    await openStory(page, STORY.maskedValueDefault);
    const reveal = storyRoot(page).getByRole("button", { name: /^Reveal / });
    expectSize(await box(reveal), { width: 20, height: 20 }, "compact visual box");
    expectSize(await tapTargetSize(reveal), { width: 20, height: 20 }, "compact tap target");

    await openStory(page, STORY.maskedValueDefault, { density: "comfortable" });
    const revealComfortable = storyRoot(page).getByRole("button", { name: /^Reveal / });
    expectSize(
      await box(revealComfortable),
      { width: 20, height: 20 },
      "comfortable visual box, unchanged",
    );
    expectTapTarget(await tapTargetSize(revealComfortable));
  });

  test("DialogClose: 24×24 visual box, unchanged; tap target reaches 48×48", async ({ page }) => {
    async function openAndReturnClose(density: "compact" | "comfortable"): Promise<Locator> {
      await openStory(page, STORY.dialogScrollingBody, { density });
      await storyRoot(page).getByRole("button", { name: "Open tall dialog" }).click();
      const close = page.locator('button[aria-label="Close"]');
      await settleTransitions(page);
      return close;
    }

    const close = await openAndReturnClose("compact");
    expectSize(await box(close), { width: 24, height: 24 }, "compact visual box");
    expectSize(await tapTargetSize(close), { width: 24, height: 24 }, "compact tap target");

    const closeComfortable = await openAndReturnClose("comfortable");
    expectSize(
      await box(closeComfortable),
      { width: 24, height: 24 },
      "comfortable visual box, unchanged",
    );
    expectTapTarget(await tapTargetSize(closeComfortable));
  });

  test("Drawer's close button: 24×24 visual box, unchanged; tap target reaches 48×48", async ({
    page,
  }) => {
    async function openAndReturnClose(density: "compact" | "comfortable"): Promise<Locator> {
      await openStory(page, STORY.drawers, { density });
      await storyRoot(page).getByRole("button", { name: "Quick detail" }).click();
      const close = page.locator('button[aria-label="Close"]');
      await expect(close).toBeVisible();
      await settleTransitions(page);
      return close;
    }

    const close = await openAndReturnClose("compact");
    expectSize(await box(close), { width: 24, height: 24 }, "compact visual box");
    expectSize(await tapTargetSize(close), { width: 24, height: 24 }, "compact tap target");

    const closeComfortable = await openAndReturnClose("comfortable");
    expectSize(
      await box(closeComfortable),
      { width: 24, height: 24 },
      "comfortable visual box, unchanged",
    );
    expectTapTarget(await tapTargetSize(closeComfortable));
  });

  test("Toast's dismiss button: 24×24 visual box, unchanged; tap target reaches 48×48", async ({
    page,
  }) => {
    async function openAndReturnDismiss(density: "compact" | "comfortable"): Promise<Locator> {
      await openStory(page, STORY.toasts, { density });
      await storyRoot(page).getByRole("button", { name: "Default" }).click();
      const dismiss = page.locator('button[aria-label="Dismiss"]');
      await expect(dismiss).toBeVisible();
      return dismiss;
    }

    const dismiss = await openAndReturnDismiss("compact");
    expectSize(await box(dismiss), { width: 24, height: 24 }, "compact visual box");
    expectSize(await tapTargetSize(dismiss), { width: 24, height: 24 }, "compact tap target");

    const dismissComfortable = await openAndReturnDismiss("comfortable");
    expectSize(
      await box(dismissComfortable),
      { width: 24, height: 24 },
      "comfortable visual box, unchanged",
    );
    expectTapTarget(await tapTargetSize(dismissComfortable));
  });

  test("DatePicker's Clear button: 14×14 visual box, unchanged; tap target reaches 48×48", async ({
    page,
  }) => {
    await openStory(page, STORY.datePickerSingle);
    const clear = storyRoot(page).getByRole("button", { name: /^Clear / });
    expectSize(await box(clear), { width: 14, height: 14 }, "compact visual box");
    // No `-m-*`/`p-*` idiom on this control at all (see `date-picker.tsx`'s
    // own comment) — the pre-existing, out-of-scope-for-this-pass compact
    // gap is exactly this: a 14×14 tap target, below even WCAG 2.2
    // §2.5.8's 24px floor. Recorded here, not silently accepted: this
    // assertion is what "unchanged" means, not an endorsement.
    expectSize(await tapTargetSize(clear), { width: 14, height: 14 }, "compact tap target");

    await openStory(page, STORY.datePickerSingle, { density: "comfortable" });
    const clearComfortable = storyRoot(page).getByRole("button", { name: /^Clear / });
    expectSize(
      await box(clearComfortable),
      { width: 14, height: 14 },
      "comfortable visual box, unchanged",
    );
    expectTapTarget(await tapTargetSize(clearComfortable));
  });

  test("Calendar's prev/next nav: 28×28 visual box, unchanged; tap target reaches 48×48", async ({
    page,
  }) => {
    await openStory(page, STORY.bareCalendar);
    const prev = storyRoot(page).getByRole("button", { name: "Go to the Previous Month" });
    expectSize(await box(prev), { width: 28, height: 28 }, "compact visual box");
    expectSize(await tapTargetSize(prev), { width: 28, height: 28 }, "compact tap target");

    await openStory(page, STORY.bareCalendar, { density: "comfortable" });
    const prevComfortable = storyRoot(page).getByRole("button", {
      name: "Go to the Previous Month",
    });
    expectSize(
      await box(prevComfortable),
      { width: 28, height: 28 },
      "comfortable visual box, unchanged",
    );
    expectTapTarget(await tapTargetSize(prevComfortable));
  });
});
