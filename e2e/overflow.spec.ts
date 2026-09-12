import { expect, test } from "@playwright/test";
import { openStory, storyRoot } from "./helpers";
import { STORY } from "./story-ids";

/**
 * Nothing scrolls sideways that was not asked to.
 *
 * This is the library's recurring defect rather than a generic sweep:
 * `side-nav.tsx`'s own doc records `clientWidth 40 / scrollWidth 212` on
 * the icon rail, caused by a tooltip bubble nobody could see, and
 * `tooltip.stories.tsx` still demonstrates the same mechanism. A stray
 * horizontal scrollbar is invisible to jsdom twice over — it has no
 * layout to overflow and no scrollbars to grow.
 *
 * The assertion is deliberately about the **document**: a component is
 * free to scroll its own box (`Tabs` does, `Table` does), but no
 * component may make the page itself wider than the viewport.
 */

const PAGES = [
  { id: STORY.sideNavInAShell, widths: [375, 900, 1262, 1440] },
  { id: STORY.tableAsAScreenUsesIt, widths: [375, 768, 1280] },
  { id: STORY.tableDefault, widths: [375, 1280] },
  // 1280 only: this story pins its own `w-[380px]` box, so at a 375px
  // viewport the *story* is wider than the page by construction — a fact
  // about the fixture, not about `Tabs`. Its scrolling behaviour gets its
  // own test below.
  { id: STORY.tabsManyScrolling, widths: [1280] },
  { id: STORY.selectLongValues, widths: [375, 1280] },
  { id: STORY.idsConstrained, widths: [375, 1280] },
  { id: STORY.screenLayout, widths: [375, 1280] },
  { id: STORY.instrumentPanelDashboard, widths: [375, 1280] },
  { id: STORY.statusPillQuietVersusLoud, widths: [375, 1280] },
] as const;

for (const { id, widths } of PAGES) {
  for (const width of widths) {
    test(`${id} does not scroll the page sideways at ${width}px`, async ({ page }) => {
      await openStory(page, id, { width, height: 760 });
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        widest: (() => {
          // Name the culprit in the failure message rather than leaving
          // "1283 > 1280" for someone to bisect by hand.
          let worst = { selector: "", right: 0 };
          for (const el of document.querySelectorAll<HTMLElement>("#storybook-root *, body > *")) {
            const right = el.getBoundingClientRect().right;
            if (right > worst.right) {
              worst = {
                selector: `${el.tagName.toLowerCase()}.${el.className.toString().split(" ").slice(0, 3).join(".")}`,
                right,
              };
            }
          }
          return worst;
        })(),
      }));
      expect(
        overflow.scrollWidth,
        `widest element: ${overflow.widest.selector} ending at ${overflow.widest.right}px`,
      ).toBeLessThanOrEqual(overflow.clientWidth);
    });
  }
}

test("the floating rail scrolls on one axis only", async ({ page }) => {
  // A short viewport, so the rail is taller than its own `max-h-[80vh]`
  // cap and genuinely has to scroll — which is the state in which the
  // clipped-tooltip bug grew a horizontal scrollbar.
  await openStory(page, STORY.sideNavInAShell, { width: 900, height: 320 });
  const rail = page.locator("[data-floating-rail]:not([data-floating-rail-axis])");
  await expect(rail).toBeVisible();

  const measured = await rail.evaluate((el) => ({
    clientWidth: el.clientWidth,
    scrollWidth: el.scrollWidth,
    clientHeight: el.clientHeight,
    scrollHeight: el.scrollHeight,
    overflowX: getComputedStyle(el).overflowX,
  }));

  expect(measured.scrollWidth, "the rail's own horizontal overflow").toBe(measured.clientWidth);
  expect(measured.overflowX).toBe("hidden");
  expect(
    measured.scrollHeight,
    "the rail is supposed to be scrolling vertically at this height",
  ).toBeGreaterThan(measured.clientHeight);
});

test("the tab strip scrolls inside itself while the page stays put", async ({ page }) => {
  await openStory(page, STORY.tabsManyScrolling, { width: 1280, height: 760 });
  const strip = storyRoot(page).getByRole("tablist");
  // `ValueTabsList` renders the `role="tablist"` flex row *inside* a
  // separate scroll container (`wrapperClassName` documents the split),
  // so the row itself is `w-max` and never clipped — the overflow lives
  // one level up, on the element that actually scrolls.
  const measured = await strip.evaluate((el) => {
    const scroller = el.parentElement;
    if (scroller === null) throw new Error("the tablist has no scroll container");
    return {
      rowWidth: el.getBoundingClientRect().width,
      clientWidth: scroller.clientWidth,
      scrollWidth: scroller.scrollWidth,
      overflowX: getComputedStyle(scroller).overflowX,
      documentScrollWidth: document.documentElement.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
    };
  });
  expect(
    measured.scrollWidth,
    "eight tabs in a 380px box are supposed to overflow their scroller",
  ).toBeGreaterThan(measured.clientWidth);
  expect(measured.rowWidth).toBeGreaterThan(measured.clientWidth);
  expect(measured.overflowX, "the strip has to be the thing that scrolls").not.toBe("visible");
  expect(measured.documentScrollWidth).toBeLessThanOrEqual(measured.documentClientWidth);
});

test("a table too wide for a phone scrolls inside its own wrapper", async ({ page }) => {
  // `Default` rather than `AsAScreenUsesIt`: the latter hides two columns
  // below `md` and therefore *fits* at 375px (343px of table in a 343px
  // wrapper, measured), which would make this assertion vacuous. This
  // story really does overflow — 400px of table in a 343px wrapper.
  await openStory(page, STORY.tableDefault, { width: 375, height: 760 });
  const wrapper = storyRoot(page).locator("div.overflow-x-auto").first();
  const measured = await wrapper.evaluate((el) => ({
    clientWidth: el.clientWidth,
    scrollWidth: el.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    documentClientWidth: document.documentElement.clientWidth,
  }));

  expect(
    measured.scrollWidth,
    "the premise: this table does not fit a 375px phone",
  ).toBeGreaterThan(measured.clientWidth);
  // Which is fine — as long as the overflow stays inside the wrapper and
  // never reaches the page.
  expect(measured.documentScrollWidth).toBeLessThanOrEqual(measured.documentClientWidth);
});
