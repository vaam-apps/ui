import { expect, test } from "@playwright/test";
import { haloEvidence, openStory, storyRoot, tabTo } from "./helpers";
import { STORY } from "./story-ids";

/**
 * "Is the focus ring actually visible" — the question `a11y.test.tsx`'s
 * own module doc names as one it cannot answer.
 *
 * It cannot answer it for a structural reason rather than a missing
 * assertion: jsdom applies no CSS, so `:focus-visible` selects nothing,
 * `outline` is never computed and nothing is ever painted. axe's
 * `focus-order-semantics` can see the tab order; no gate in this
 * repository can see the ring.
 *
 * Each test below focuses a control the way a keyboard user does, then
 * compares the pixels *around* it before and after. That rules out both
 * ways this fails in practice: a ring whose colour matches its ground
 * (computed style looks right, nothing appears) and a ring an ancestor's
 * `overflow` clips away (both the style and the box are right, the
 * pixels are gone) — the second being a live hazard here, since the
 * floating rail and the tab strip are both scroll containers.
 */

interface Target {
  name: string;
  story: string;
  width?: number;
  locate: (page: import("@playwright/test").Page) => import("@playwright/test").Locator;
}

const TARGETS: Target[] = [
  {
    name: "a primary button",
    story: STORY.buttonVariants,
    locate: (page) => storyRoot(page).getByRole("button").first(),
  },
  {
    name: "a text input",
    story: STORY.formControls,
    locate: (page) => storyRoot(page).locator("input[type='text'], input:not([type])").first(),
  },
  {
    name: "a link inside the floating rail, which is a scroll container",
    story: STORY.sideNavInAShell,
    width: 900,
    locate: (page) => page.locator("[data-floating-rail]:not([data-floating-rail-axis]) a").first(),
  },
  {
    name: "a tab in the horizontally scrolling strip",
    story: STORY.tabsManyScrolling,
    locate: (page) => storyRoot(page).getByRole("tab").first(),
  },
];

for (const target of TARGETS) {
  test(`focus paints a visible indicator around ${target.name}`, async ({ page }) => {
    await openStory(page, target.story, target.width ? { width: target.width, height: 700 } : {});
    const control = target.locate(page);
    await expect(control).toBeVisible();

    const halo = await haloEvidence(page, control);

    // A ring is not "a few antialiased pixels": the thinnest indicator
    // this theme defines is 2px around the whole control, which covers
    // most of the band being examined. 5% is far below anything real and
    // far above nothing at all.
    expect(
      halo.changed / halo.examined,
      "fraction of the band around the control that focus repainted",
    ).toBeGreaterThan(0.05);
    // WCAG 2.2 §1.4.11: a focus indicator needs 3:1 against what it sits
    // on. Measured against the actual pixels it replaced, so a ring over
    // a surface step is judged on the step it landed on.
    expect(halo.contrast, "focus indicator against its own ground").toBeGreaterThanOrEqual(3);
  });

  test(`the focus indicator on ${target.name} is a declared outline, not a leftover`, async ({
    page,
  }) => {
    await openStory(page, target.story, target.width ? { width: target.width, height: 700 } : {});
    const control = target.locate(page);
    await expect(control).toBeVisible();

    const read = () =>
      control.evaluate((el) => {
        const style = getComputedStyle(el);
        return `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`;
      });

    const resting = await read();
    await tabTo(page, control);
    const focused = await read();

    // Compared against the resting state rather than asserted in
    // isolation: daisyUI puts a permanent, fully transparent `box-shadow`
    // on `.btn`, so "has *a* shadow" is satisfied by every button whether
    // or not it can take focus. A ring has to be something that was not
    // there a moment ago.
    expect(focused, `outline did not change on focus (${resting})`).not.toBe(resting);
    const [width, style] = focused.split(" ");
    expect(Number.parseFloat(width ?? "0"), `outline width: ${focused}`).toBeGreaterThanOrEqual(2);
    expect(style, `outline style: ${focused}`).not.toBe("none");
  });
}
