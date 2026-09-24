import { createRequire } from "node:module";
import { expect, test } from "@playwright/test";
import { box, openStory } from "./helpers";
import { STORY } from "./story-ids";

/**
 * One navigation per width, and the right one.
 *
 * `SideNav` has three shapes and no JS breakpoint: which one you get is
 * decided entirely by CSS (`hidden sm:flex`, `sm:hidden`, `xl:flex`), and
 * two of the three are portalled to `document.body`. jsdom renders all
 * three subtrees and applies none of those rules, so every band test that
 * matters has to run somewhere with media queries — `1262px` in
 * particular shipped broken two days ago, in the gap between "the
 * `1024–1279px` in-flow icon rail is deleted" and "the floating rail
 * covers that band".
 *
 * "Visible" is deliberately defined as *has a destination you can click*
 * rather than "has a box". That was originally a workaround — the in-flow
 * `<nav>` used to occupy a narrow strip below `xl`, so counting boxes
 * counted a band with nothing in it — and the strip is now fixed (see the
 * "takes no width" tests below). The definition stays, because it is the
 * better question either way: a navigation nobody can click is not a
 * navigation.
 */

interface BandExpectation {
  width: number;
  /** The one shape that carries destinations at this width. */
  shape: "bottom pill" | "floating rail" | "sidebar";
}

const BANDS: BandExpectation[] = [
  { width: 375, shape: "bottom pill" },
  { width: 900, shape: "floating rail" },
  // The band that had no navigation at all for a day: wide enough that
  // the deleted in-flow icon rail used to serve it, narrow enough that
  // the sidebar does not.
  { width: 1262, shape: "floating rail" },
  { width: 1440, shape: "sidebar" },
];

/** Every `aria-label="Primary"` nav, and how many clickable destinations
 * each one is actually showing. */
async function navigations(page: import("@playwright/test").Page) {
  return await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('nav[aria-label="Primary"]')].map((nav) => {
      const shown = (el: Element) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };
      const axis = nav.getAttribute("data-floating-rail-axis");
      return {
        shape: nav.hasAttribute("data-floating-rail")
          ? axis === "horizontal"
            ? ("bottom pill" as const)
            : ("floating rail" as const)
          : ("sidebar" as const),
        destinations: [...nav.querySelectorAll("a")].filter(shown).length,
        position: getComputedStyle(nav).position,
        rect: nav.getBoundingClientRect().toJSON() as DOMRect,
      };
    }),
  );
}

for (const { width, shape } of BANDS) {
  test(`at ${width}px the navigation is the ${shape}, and only that`, async ({ page }) => {
    await openStory(page, STORY.sideNavInAShell, { width, height: 760 });
    const navs = await navigations(page);

    const showing = navs.filter((nav) => nav.destinations > 0);
    expect(
      showing.map((nav) => nav.shape),
      "shapes showing a clickable destination",
    ).toEqual([shape]);
    // Seven destinations — top item, two groups of two, two footer rows —
    // except on the bottom pill, where four are slots and the rest move
    // behind the overflow menu by design.
    expect(showing[0]?.destinations).toBeGreaterThanOrEqual(4);
  });
}

test("below the sidebar band the rail floats over the page rather than sitting in it", async ({
  page,
}) => {
  await openStory(page, STORY.sideNavInAShell, { width: 1262, height: 760 });
  const [rail] = (await navigations(page)).filter((nav) => nav.destinations > 0);
  expect(rail?.shape).toBe("floating rail");
  // `fixed`, resolved against the viewport rather than against whatever
  // the caller wrapped `SideNav` in — the whole reason `FloatingRail` is
  // portalled to `document.body`.
  expect(rail?.position).toBe("fixed");
  expect(rail?.rect.left, "the rail hugs the left edge of the viewport").toBeLessThan(24);
});

test("the bottom pill is pinned to the bottom of a phone viewport", async ({ page }) => {
  await openStory(page, STORY.sideNavInAShell, { width: 375, height: 760 });
  const pill = page.locator('[data-floating-rail-axis="horizontal"]');
  const rect = await box(pill);
  expect(rect.y + rect.height, "the pill's bottom edge against the 760px viewport").toBeGreaterThan(
    700,
  );
  // Content-width and centred, not stretched edge to edge: "a three-item
  // nav would look like a broken five-item one".
  expect(rect.width).toBeLessThan(375 - 24);
  expect(Math.abs(rect.x + rect.width / 2 - 375 / 2), "centring error").toBeLessThan(2);
});

test("at 1440px the sidebar is in flow and the content starts after it", async ({ page }) => {
  await openStory(page, STORY.sideNavInAShell, { width: 1440, height: 760 });
  const sidebar = page.locator('nav[aria-label="Primary"]:not([data-floating-rail])');
  const rect = await box(sidebar);
  expect(rect.width, "the documented 256px sidebar").toBe(256);
  expect(await sidebar.evaluate((el) => getComputedStyle(el).position)).toBe("static");

  // In flow means the content column does not start underneath it.
  const contentLeft = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Primary"]:not([data-floating-rail])');
    const sibling = nav?.nextElementSibling;
    return sibling === null || sibling === undefined
      ? Number.NaN
      : sibling.getBoundingClientRect().left;
  });
  expect(contentLeft).toBeGreaterThanOrEqual(rect.x + rect.width);
});

/**
 * The in-flow `<nav>` must take **no** width below the sidebar band.
 *
 * `side-nav.tsx` states it outright: below `xl` this element "must not
 * draw a box of its own down here", because the rails are `fixed` and a
 * caller lays out around nothing. It was drawing one anyway — three
 * wrapper `<div>`s carried `px-2` and laid out regardless of every child
 * being `display: none`. Measured before the fix: **16px wide by 510
 * tall** at 375 and 900, and 40px at 1262 where it also painted two
 * `border-t` hairlines beside the floating rail.
 *
 * jsdom cannot see this at all — no layout, no media queries — and it is
 * invisible in a screenshot at a glance, which is how a 16px strip
 * survives review. It is exactly the kind of claim a real browser is for.
 */
for (const width of [375, 900, 1262]) {
  test(`at ${width}px the in-flow nav takes no width at all`, async ({ page }) => {
    await openStory(page, STORY.sideNavInAShell, { width, height: 760 });
    const inFlow = page.locator('nav[aria-label="Primary"]:not([data-floating-rail])').first();
    // `getBoundingClientRect`, not `box()`: below `xl` this element is
    // `display: none` now (#16, the next block), which has no box at all —
    // and "no box" is the strongest form of "no width" there is.
    const measured = await inFlow.evaluate((el) => el.getBoundingClientRect().width);
    expect(
      measured,
      "the in-flow nav is laying out a box below `xl`; the rails are `fixed`, " +
        "so every pixel here is a lane taken from the caller's content for nothing",
    ).toBe(0);
  });
}

/**
 * Exactly one **exposed** `Primary` landmark at every width —
 * vaam-apps/ui#16.
 *
 * The test above proved the in-flow `<nav>` took no *width* below `xl`, and
 * that was true while the bug it sat next to stayed open: the element was
 * a zero-width `display: block` box, which is still a landmark. A screen
 * reader's landmark list — and axe's `landmark-unique` — saw two
 * `navigation "Primary"` entries at every width below 1280px: the empty
 * in-flow one and whichever rail was showing. vaam-apps/vpay suppressed
 * that rule on its Shell stories because of it (re-measured on 0.3.0: one
 * violation at 375–1279px, none from 1280px).
 *
 * "Exposed" is `checkVisibility({ visibilityProperty: true })` — no
 * `display: none` or `visibility: hidden` on it or any ancestor — not "has
 * a box". A zero-size box is exactly the case that slipped through, and
 * size is not what puts an element in the accessibility tree.
 *
 * Every class-string and jsdom check in this repo passed through all of
 * it — jsdom applies no stylesheet, so it cannot tell "hidden below `xl`"
 * from "no display utility at all below `xl`" — which is why this runs axe
 * in the real browser rather than trusting `side-nav.portal.test.tsx`'s
 * gate strings.
 *
 * The widths: one in each band — the phone pill (375), the vertical rail
 * (700 and 1100: either side of the `lg` line the old in-flow icon rail
 * used to start at) — and 1280, the first sidebar width, where the rails
 * must hand over rather than join it.
 */
const AXE_PATH = createRequire(import.meta.url).resolve("axe-core/axe.min.js");

for (const width of [375, 700, 1100, 1280]) {
  test(`at ${width}px exactly one Primary landmark is exposed (axe landmark-unique)`, async ({
    page,
  }) => {
    await openStory(page, STORY.sideNavInAShell, { width, height: 760 });

    const exposed = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("nav[aria-label]")]
        .filter((nav) => nav.checkVisibility({ visibilityProperty: true }))
        .map((nav) => nav.getAttribute("aria-label")),
    );
    // Soft, so a failure reports axe's verdict as well: the two are
    // independent measurements of the same property, and seeing both fail
    // together is what says the count is not an artefact of its own filter.
    expect
      .soft(
        exposed.filter((label) => label === "Primary"),
        '`nav[aria-label="Primary"]` elements a screen reader can reach at this width',
      )
      .toHaveLength(1);

    await page.addScriptTag({ path: AXE_PATH });
    const violations = await page.evaluate(async () => {
      const axe = (
        window as unknown as {
          axe: {
            run: (
              context: Document,
              options: unknown,
            ) => Promise<{ violations: { id: string; nodes: { target: unknown[] }[] }[] }>;
          };
        }
      ).axe;
      const result = await axe.run(document, { runOnly: ["landmark-unique"] });
      return result.violations.map((violation) => ({
        id: violation.id,
        targets: violation.nodes.map((node) => JSON.stringify(node.target)),
      }));
    });
    expect(violations).toEqual([]);
  });
}
