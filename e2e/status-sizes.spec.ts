import { expect, test } from "@playwright/test";
import { box, contrastInSitu, openStory, storyRoot } from "./helpers";
import { STORY } from "./story-ids";

/**
 * `StatusPill` and `StateChip` sizes, measured. `md` (the default) is
 * the bigger, M3-chip register the owner asked for; `sm` is the dense one
 * every pill used to be, kept for table rows.
 */

test.describe("status sizes", () => {
  test("StatusPill md is a 32px chip with an 18px glyph and a 14px label; sm stays dense", async ({
    page,
  }) => {
    await openStory(page, STORY.statusPillSizes);
    const rows = storyRoot(page).locator(":scope > div > div");
    const md = rows.nth(0).locator("span[title]").first();
    const sm = rows.nth(1).locator("span[title]").first();

    const mdBox = await box(md);
    expect(mdBox.height, "md: M3's 32dp chip").toBeCloseTo(32, 0);
    const mdGlyph = await box(md.locator("svg"));
    expect([mdGlyph.width, mdGlyph.height]).toEqual([18, 18]);
    expect(await md.evaluate((el) => getComputedStyle(el).fontSize), "md: label-large").toBe(
      "14px",
    );

    const smBox = await box(sm);
    expect(smBox.height, "sm: the dense pill").toBeLessThan(24);
    expect([(await box(sm.locator("svg"))).width]).toEqual([14]);
    expect(await sm.evaluate((el) => getComputedStyle(el).fontSize)).toBe("12px");

    // The bigger label is still the hue's own foreground on the hue's own
    // tint, so it keeps the contrast `contrast.test.ts` holds it to.
    const pills = await rows.nth(0).locator("span[title]").all();
    expect(pills.length, "every hue is measured").toBeGreaterThanOrEqual(8);
    for (const pill of pills) {
      const label = pill.locator("span").first();
      const { worst } = await contrastInSitu(page, label);
      expect(worst, "md label contrast on its own tint").toBeGreaterThanOrEqual(4.5);
    }
  });

  test("md is the default: a pill rendered with no size is the 32px chip", async ({ page }) => {
    await openStory(page, STORY.statusPillQuietVersusLoud);
    // The second row is the loud states, rendered with no `size` prop.
    const loud = storyRoot(page)
      .locator(":scope > div > div")
      .nth(1)
      .locator("span[title]")
      .first();
    expect((await box(loud)).height, "a default loud pill is 32px").toBeCloseTo(32, 0);
  });

  test("StateChip md is 28px tall with a 14px label; sm stays dense", async ({ page }) => {
    await openStory(page, STORY.stateChipSizes);
    const rows = storyRoot(page).locator(":scope > div > div");
    const md = rows.nth(0).locator("span").first();
    const sm = rows.nth(1).locator("span").first();
    expect((await box(md)).height).toBeCloseTo(28, 0);
    expect(await md.evaluate((el) => getComputedStyle(el).fontSize)).toBe("14px");
    expect((await box(sm)).height).toBeLessThan(24);
    expect(await sm.evaluate((el) => getComputedStyle(el).fontSize)).toBe("12px");
  });
});
