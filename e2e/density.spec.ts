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
