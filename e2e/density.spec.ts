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
