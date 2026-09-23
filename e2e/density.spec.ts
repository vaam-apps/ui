import { expect, test } from "@playwright/test";
import { box, openStory, storyRoot } from "./helpers";
import { STORY } from "./story-ids";

/**
 * D10 — the density axis, measured on real rendered heights.
 *
 * `density.test.ts` (in `src/lib/`) proves the `calc()` formulas in
 * `theme.css` re-derive the right numbers from androidx's own tokens; it
 * cannot prove those formulas are the ones an actual `Button`/`Input`/
 * `Select` resolves through, because it never asks a browser to lay
 * anything out (jsdom has no layout at all — see `AGENTS.md`'s own trap
 * about that). This file is the other half: open each story through
 * `.storybook/preview.ts`'s real `density` toolbar global, the same
 * channel a reader actually has, and read `getBoundingClientRect()`.
 *
 * The compact-register numbers here are the load-bearing half of the
 * suite: this package's own rule is that a consumer who sets nothing gets
 * byte-identical rendering to `claude/m3-expressive`, and "byte-identical"
 * is a rendering claim a class string cannot prove — only a measurement
 * against the pre-D10 numbers can, which is exactly what `AGENTS.md`'s
 * table (Button sm/md 32/40px, Input/Select 40px) already recorded before
 * this pass started.
 */

test.describe("compact is the default — unchanged from before D10", () => {
  test("Button sm/md/icon render exactly as they did pre-D10", async ({ page }) => {
    await openStory(page, STORY.buttonSizes);
    const small = await box(storyRoot(page).getByRole("button", { name: "Small" }));
    const medium = await box(storyRoot(page).getByRole("button", { name: "Medium" }));
    const icon = await box(storyRoot(page).getByRole("button", { name: "Icon button" }));

    expect(small.height, "Button size=sm height").toBeCloseTo(32, 0);
    expect(medium.height, "Button size=md height").toBeCloseTo(40, 0);
    expect(icon.height, "Button size=icon height").toBeCloseTo(32, 0);
    expect(icon.width, "Button size=icon width").toBeCloseTo(32, 0);
  });

  test("Input and Select render exactly as they did pre-D10", async ({ page }) => {
    await openStory(page, STORY.formControls);
    const input = await box(page.locator("#sb-sender"));
    expect(input.height, "Input height").toBeCloseTo(40, 0);

    await openStory(page, STORY.selectDisabledAndScrolling);
    const select = await box(page.locator("#sb-long"));
    expect(select.height, "Select trigger height").toBeCloseTo(40, 0);
  });
});

test.describe("comfortable renders M3's real Button/field heights", () => {
  test("Button sm/md/icon match ButtonSmallTokens/ButtonMediumTokens", async ({ page }) => {
    await openStory(page, STORY.buttonSizes, { density: "comfortable" });
    const small = await box(storyRoot(page).getByRole("button", { name: "Small" }));
    const medium = await box(storyRoot(page).getByRole("button", { name: "Medium" }));
    const icon = await box(storyRoot(page).getByRole("button", { name: "Icon button" }));

    // `ButtonSmallTokens.ContainerHeight` — 40dp.
    expect(small.height, "Button size=sm height").toBeCloseTo(40, 0);
    // `ButtonMediumTokens.ContainerHeight` — 56dp.
    expect(medium.height, "Button size=md height").toBeCloseTo(56, 0);
    // `Button size="icon"` is `btn-circle btn-sm`, so it shares `.btn-sm`'s
    // own override and lands in the same 40dp bucket as its text sibling.
    expect(icon.height, "Button size=icon height").toBeCloseTo(40, 0);
    expect(icon.width, "Button size=icon width").toBeCloseTo(40, 0);
  });

  test("Input and Select both reach 56px, the default/`md` field height", async ({ page }) => {
    await openStory(page, STORY.formControls, { density: "comfortable" });
    const input = await box(page.locator("#sb-sender"));
    expect(input.height, "Input height").toBeCloseTo(56, 0);

    await openStory(page, STORY.selectDisabledAndScrolling, { density: "comfortable" });
    const select = await box(page.locator("#sb-long"));
    expect(select.height, "Select trigger height").toBeCloseTo(56, 0);
  });
});

/**
 * The phone-width sheet override — `drawer.tsx`'s own "Below `md:`, this
 * panel forces comfortable density" comment, on `DetailDrawerContent`.
 *
 * Reported live: "drawer + select on small screens: it's cramped", on
 * `Select`'s own "Inside a drawer" story at 375×812. Measured before any
 * fix, at this package's `compact` default: a 40px `SelectTrigger` and a
 * 32px, 12px-font, ~71px-wide footer button pinned to the sheet's right
 * edge. The suites above already prove the density *axis* re-derives the
 * right numbers when an app opts in; this proves the one thing they
 * cannot — that `DetailDrawerContent` forces comfortable on its own,
 * below `md:`, even when the app around it is explicitly `compact`, and
 * stops forcing it the moment the same panel is the `md:`+ desktop
 * right-hand panel instead of a phone bottom sheet.
 */
test.describe("a phone-width sheet forces comfortable, regardless of the app's density", () => {
  async function openDrawer(page: import("@playwright/test").Page) {
    await storyRoot(page).getByRole("button", { name: "Open drawer" }).click();
    await expect(page.getByRole("button", { name: "Register" })).toBeVisible();
  }

  test("below md:, the sheet's own Select and footer button reach comfortable sizing and full width — even though the app itself is compact", async ({
    page,
  }) => {
    // `density: "compact"` here is the whole point: `openStory` also
    // asserts `html[data-density="compact"]` below, so this proves the
    // override actually overrides an ambient setting rather than merely
    // agreeing with a default nobody set.
    await openStory(page, STORY.selectInsideADrawer, {
      density: "compact",
      width: 375,
      height: 812,
    });
    await openDrawer(page);

    const trigger = await box(page.locator("#drawer-provider"));
    // `ButtonMediumTokens.ContainerHeight` (56dp) — `--size-field`'s own
    // comfortable value, the same number `density.spec.ts` pins above.
    expect(trigger.height, "SelectTrigger height, forced comfortable").toBeCloseTo(56, 0);

    const register = await box(page.getByRole("button", { name: "Register" }));
    // `ButtonSmallTokens.ContainerHeight` (40dp) — `.btn-sm`'s own
    // density-aware formula, `theme.css`'s D10 section; the button stays
    // `size="sm"` (this package's own drawer/dialog footer convention)
    // and still reaches this from `--density` alone.
    expect(register.height, "footer button height, forced comfortable").toBeCloseTo(40, 0);
    // The footer row's own `max-md:items-stretch`: the button reaches the
    // same width as the trigger — the sheet's full content width — rather
    // than the ~71px corner target the report measured.
    expect(register.width, "footer button width matches the sheet's content width").toBeCloseTo(
      trigger.width,
      0,
    );
    expect(register.width, "footer button is no longer a ~71px corner target").toBeGreaterThan(300);

    // The override is scoped to the sheet's own subtree — the app's own
    // density, asserted by `openStory` against `html[data-density]`
    // above, is untouched by it.
    await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
  });

  test("at md:+, the same panel reads the app's own density instead — unchanged from before this fix", async ({
    page,
  }) => {
    await openStory(page, STORY.selectInsideADrawer, {
      density: "compact",
      width: 1280,
      height: 800,
    });
    await openDrawer(page);

    const trigger = await box(page.locator("#drawer-provider"));
    expect(trigger.height, "SelectTrigger height, ambient compact").toBeCloseTo(40, 0);

    const register = await box(page.getByRole("button", { name: "Register" }));
    expect(register.height, "footer button height, ambient compact").toBeCloseTo(32, 0);
    // Right-aligned, not stretched — `md:justify-end`, unchanged from
    // before this fix.
    expect(register.width, "footer button keeps its intrinsic width at md:+").toBeLessThan(120);
  });
});

/**
 * The nesting property itself — the assertion whose *absence* is what let
 * the defect this file's header describes ship in the first place.
 *
 * Every suite above sets density at the document root (`openStory`'s own
 * `globals=density:…` channel stamps `html[data-density]`) and reads a
 * field or a button somewhere inside it. That proves the axis's numbers
 * are right; it cannot prove the axis *composes*, because a root-level
 * setting is exactly the one case `--size-field`'s old formula — declared
 * once, at the theme root — happened to get right anyway: `--density`
 * only ever needed to resolve correctly *at the root itself*, which it
 * always did.
 *
 * The gap is a **subtree**: a consumer who stamps
 * `[data-density="comfortable"]` on some element other than the document
 * root, while the root itself stays compact — `DetailDrawerContent`'s own
 * `max-md:[--density:1]` is exactly this, and `drawer.tsx`'s header
 * comment already names the live report it came from ("drawer + select on
 * small screens: it's cramped"). Before the fix in `theme.css`'s
 * "`--size-field`, corrected" comment, `Input`/`Select`/`Button`'s
 * default size did not see a subtree's own `--density` at all — they
 * inherited whatever `--size-field` had already frozen to at the root.
 *
 * This suite sets `[data-density="comfortable"]` on one `FormField`'s own
 * wrapper — a genuine subtree, not the document root — and checks three
 * things at once: the field *inside* that subtree follows (the assertion
 * that was missing), a sibling field *outside* it does not (so this is
 * really scoped nesting, not an accidental root-level flip), and the
 * document root itself is untouched (so the override is additive, not a
 * side channel back to global state).
 */
test.describe("density composes: a subtree override reaches the fields inside it", () => {
  test("a comfortable subtree lifts the Input inside it without moving a sibling Input outside it", async ({
    page,
  }) => {
    await openStory(page, STORY.formControls, { density: "compact" });

    const goodBefore = await box(page.locator("#sb-sender"));
    const badBefore = await box(page.locator("#sb-sender-bad"));
    // Both fields render compact by default — the same 40px this file's
    // "compact is the default" suite already pins elsewhere, restated
    // here as the starting point this test's own "before" numbers move
    // away from.
    expect(goodBefore.height, "#sb-sender height, before any override").toBeCloseTo(40, 0);
    expect(badBefore.height, "#sb-sender-bad height, before any override").toBeCloseTo(40, 0);

    // `#sb-sender` and `#sb-sender-bad` are sibling `FormField`s under one
    // shared `<div className="flex max-w-sm flex-col gap-4">`
    // (`form-controls.stories.tsx`'s `FieldsAndErrors` story) — setting
    // the attribute on `#sb-sender`'s own `FormField` wrapper, and not
    // any ancestor above it, is what makes this a *subtree* override
    // rather than a root-level one wearing a different selector.
    await page.evaluate(() => {
      const input = document.querySelector("#sb-sender");
      const wrapper = input?.closest("div");
      if (wrapper === null || wrapper === undefined) {
        throw new Error("#sb-sender has no wrapping div to scope the override to");
      }
      wrapper.setAttribute("data-density", "comfortable");
    });

    const goodAfter = await box(page.locator("#sb-sender"));
    const badAfter = await box(page.locator("#sb-sender-bad"));

    // The assertion this suite exists to add: a field *inside* the
    // subtree follows the override. `ButtonMediumTokens.ContainerHeight`
    // (56dp) — the same number the root-level suite above already pins
    // for `density: "comfortable"`, reached here through a subtree
    // instead of the document root.
    expect(goodAfter.height, "#sb-sender height, inside the comfortable subtree").toBeCloseTo(
      56,
      0,
    );
    // The scoping half: a sibling `FormField` outside the subtree does
    // not move. Without this, a bug that leaked the override to the
    // whole page would still pass the assertion above.
    expect(badAfter.height, "#sb-sender-bad height, outside the subtree").toBeCloseTo(40, 0);
    // The additive half: the document root itself was never touched.
    await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
  });

  test("the same subtree override lifts a Select trigger the identical way", async ({ page }) => {
    // A second control family, not just a second story of the same one —
    // `Select`'s own daisyUI multiplier (`--sl-size-mul`) is a different
    // custom property than `Input`'s (`--in-size-mul`), so this proves
    // the fix generalizes across daisyUI's own per-component multiplier
    // rather than having only been checked against one of them.
    await openStory(page, STORY.selectDisabledAndScrolling, { density: "compact" });

    const before = await box(page.locator("#sb-long"));
    expect(before.height, "#sb-long height, before any override").toBeCloseTo(40, 0);

    await page.evaluate(() => {
      const trigger = document.querySelector("#sb-long");
      trigger?.parentElement?.setAttribute("data-density", "comfortable");
    });

    const after = await box(page.locator("#sb-long"));
    expect(after.height, "#sb-long height, inside the comfortable subtree").toBeCloseTo(56, 0);
    await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
  });
});
