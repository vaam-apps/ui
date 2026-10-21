import { expect, test } from "@playwright/test";
import { contrastInSitu, openStory, storyRoot, type Theme } from "./helpers";
import { STORY } from "./story-ids";

/**
 * Contrast *in situ*, which is the half `contrast.test.ts` says it cannot
 * reach.
 *
 * That gate parses `theme.css` and measures one token against another,
 * which is the only thing a stylesheet parser can do. It is exact, and it
 * is blind to the two cases below, in opposite ways:
 *
 * - **A loud `StatusPill` on a hovered table row.** The pill's fill is a
 *   10% tint (8% in light), so what the label actually sits on is that
 *   tint over `--surface-3` over the table over the page — four
 *   composites, none of which exists as a token anywhere. Hovering
 *   changes it, measurably: 9.34:1 → 7.56:1 in dark, 6.38:1 → 5.20:1 in
 *   light, for the same pill.
 * - **`InstrumentPanel`'s caption over its shapes.** The ground is three
 *   opaque tones — container, halo, clover — which `contrast.test.ts`
 *   does resolve and measure, but only as tokens: whether the caption the
 *   component actually renders lands on them, in the tier the doc
 *   promises, is a fact about the render. The component's doc bans
 *   `--subtle-foreground` on this surface and promises
 *   `--muted-foreground` holds; this checks the shipped render agrees.
 *
 * Both are measured by painting the glyphs transparent and screenshotting
 * the text's own box, so the "background" is whatever the compositor
 * actually produced — see `contrastInSitu`.
 */

const THEMES: Theme[] = ["dark", "light"];
// WCAG 2.2 §1.4.3 for text under 18.66px, which every caption and pill
// label here is.
const AA = 4.5;

for (const theme of THEMES) {
  test(`${theme}: the InstrumentPanel title and caption clear AA on the panel`, async ({
    page,
  }) => {
    await openStory(page, STORY.instrumentPanelDashboard, { theme });
    // Whether the shapes rendered at all is `instrument-panel.spec.ts`'s
    // job; here the question is only what the text sits on.
    for (const text of ["Delivery", "Last 24 hours, across all providers"]) {
      const { worst, backdrop } = await contrastInSitu(
        page,
        storyRoot(page).getByText(text, { exact: true }),
      );
      expect(
        worst,
        `"${text}": worst pixel of ${backdrop.length} distinct ones`,
      ).toBeGreaterThanOrEqual(AA);
    }
  });

  test(`${theme}: the caption tier swap buys real contrast on the panel`, async ({ page }) => {
    await openStory(page, STORY.instrumentPanelSubtle, { theme });
    const muted = storyRoot(page).getByText("muted — what the panel renders");
    const subtle = storyRoot(page).getByText("subtle — below AA on this ground");

    const mutedRatio = (await contrastInSitu(page, muted)).worst;
    const subtleRatio = (await contrastInSitu(page, subtle)).worst;

    // The component renders `muted`, so `muted` is what has to hold.
    expect(mutedRatio, "the tier InstrumentPanel actually renders").toBeGreaterThanOrEqual(AA);
    // And the ban has to be buying something: `subtle` is the tier the
    // doc refuses on this ground. Asserted as a comparison rather than as
    // "subtle fails AA", because where `subtle` lands depends on which of
    // the three grounds it is over — on the bare container it passes, and
    // only the clover takes it under the bar (4.05 dark, 4.28 light, per
    // `contrast.test.ts`). A comparison is true at every position.
    expect(
      mutedRatio,
      `muted ${mutedRatio.toFixed(2)} vs subtle ${subtleRatio.toFixed(2)}`,
    ).toBeGreaterThan(subtleRatio);
  });

  test(`${theme}: every status pill stays legible on a hovered row`, async ({ page }) => {
    await openStory(page, STORY.tableAsAScreenUsesIt, { theme });
    const rows = storyRoot(page).locator("tbody tr");
    await expect(rows).toHaveCount(4);

    for (const label of ["Delivered", "Unresolved", "Failed", "Queued"]) {
      const row = rows.filter({ hasText: label });
      await row.hover();
      const pillLabel = row.getByText(label, { exact: true });
      const { worst } = await contrastInSitu(page, pillLabel);
      expect(worst, `"${label}" on its hovered row`).toBeGreaterThanOrEqual(AA);
    }
  });
}
