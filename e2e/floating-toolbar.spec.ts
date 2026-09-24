import { expect, type Locator, test } from "@playwright/test";
import { box, composite, contrastRatio, openStory, parseColor, storyRoot } from "./helpers";
import { STORY } from "./story-ids";

/**
 * `SideNav`'s floating rails are M3 Expressive's floating toolbar, and
 * every number `side-nav.tsx` cites for that — `FloatingToolbarTokens.kt`,
 * `SmallIconButtonTokens.kt`, the toolbar sample's 64dp emphasised item —
 * is a claim about a rendered box. This file is where those claims can
 * fail. Nothing here reads a class string (`geometry.spec.ts`'s own
 * header has the record of what happens when a test does).
 *
 * The toolbar portals to `document.body`, so every locator is page-wide,
 * not `storyRoot`-scoped.
 */

const horizontal = '[data-floating-rail-axis="horizontal"]';
const vertical = "[data-floating-rail]:not([data-floating-rail-axis])";

/** A toolbar item's painted container — what M3 calls the icon button's
 * container — by the `data-toolbar-item` hook rather than by DOM shape,
 * which already changed once (a `title` wrapper went in between). */
function container(target: Locator): Locator {
  return target.locator("[data-toolbar-item]");
}

test.describe("the horizontal floating toolbar, below 640px", () => {
  test("is 64px tall, fully round, unbordered, and floats 16px off the bottom edge", async ({
    page,
  }) => {
    await openStory(page, STORY.sideNavToolbarStandard, { width: 375, height: 812 });
    const bar = page.locator(horizontal);
    await expect(bar).toBeVisible();
    const rect = await box(bar);

    // `FloatingToolbarTokens.ContainerHeight` 64dp.
    expect(rect.height, "toolbar height").toBeCloseTo(64, 0);
    // `ContainerExternalPadding` 16dp. No safe-area inset in a desktop
    // browser, so `env()` resolves to 0 and this is the bare offset.
    expect(812 - (rect.y + rect.height), "offset from the bottom edge").toBeCloseTo(16, 0);
    // Centred and content-width, not stretched edge to edge.
    expect(rect.x, "left gap").toBeCloseTo(375 - (rect.x + rect.width), 0);
    expect(rect.x, "detached from the left edge").toBeGreaterThan(16);

    const radius = await bar.evaluate((el) =>
      Number.parseFloat(getComputedStyle(el).borderTopLeftRadius),
    );
    expect(radius, "fully round").toBeGreaterThanOrEqual(rect.height / 2);
    const border = await bar.evaluate((el) => getComputedStyle(el).borderTopWidth);
    expect(border, "M3's toolbar has no outline").toBe("0px");
  });

  test("every target is 48×48 around a 40px container, and the current page is a 64×40 pill", async ({
    page,
  }) => {
    await openStory(page, STORY.sideNavToolbarStandard, { width: 375, height: 812 });
    const bar = page.locator(horizontal);
    const targets = bar.locator(":scope > a, :scope > button");
    expect(await targets.count(), "four slots and the overflow menu").toBe(5);

    let current = 0;
    for (let index = 0; index < 5; index += 1) {
      const target = targets.nth(index);
      const isCurrent = (await target.getAttribute("aria-current")) === "page";
      const outer = await box(target);
      const inner = await box(container(target));
      if (isCurrent) {
        current += 1;
        // `FilledIconButton(Modifier.width(64.dp))` — the toolbar sample's
        // emphasised item — on a 40dp `SmallIconButtonTokens` height.
        expect(inner.width, "current page pill width").toBeCloseTo(64, 0);
        expect(inner.height, "current page pill height").toBeCloseTo(40, 0);
        expect(outer.width, "current page target width").toBeCloseTo(64, 0);
      } else {
        expect(inner.width, `item ${index} container`).toBeCloseTo(40, 0);
        expect(inner.height, `item ${index} container`).toBeCloseTo(40, 0);
        expect(outer.width, `item ${index} target width`).toBeCloseTo(48, 0);
      }
      // The M3 minimum touch target, on every item.
      expect(outer.height, `item ${index} target height`).toBeCloseTo(48, 0);
    }
    expect(current, "exactly one current page in the slots").toBe(1);
  });

  test("the current page is painted and the rest are not, in both colour schemes", async ({
    page,
  }) => {
    for (const id of [STORY.sideNavToolbarStandard, STORY.sideNavToolbarVibrant]) {
      await openStory(page, id, { width: 375, height: 812 });
      const bar = page.locator(horizontal);
      const barFill = await bar.evaluate((el) => getComputedStyle(el).backgroundColor);
      const current = container(bar.locator('a[aria-current="page"]'));
      const idle = container(bar.locator("a:not([aria-current])").first());
      const currentFill = await current.evaluate((el) => getComputedStyle(el).backgroundColor);
      const idleFill = await idle.evaluate((el) => getComputedStyle(el).backgroundColor);

      expect(idleFill, `${id}: an idle item has no fill of its own`).toBe("rgba(0, 0, 0, 0)");
      // A contrast, not "is it a different string": a pill at 8% of the
      // bar's own content colour is a different string and invisible —
      // the mutation that got past this test's first version. 3:1 is
      // WCAG 1.4.11's floor for a non-text indicator of state.
      const ground = parseColor(barFill).rgb;
      const pill = parseColor(currentFill);
      expect(
        contrastRatio(composite(pill.rgb, pill.alpha, ground), ground),
        `${id}: the current page's pill against the bar`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  test("the two schemes are opposite ends of the theme, not two greys", async ({ page }) => {
    await openStory(page, STORY.sideNavToolbarStandard, { width: 375, height: 812 });
    const standard = await page
      .locator(horizontal)
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    await openStory(page, STORY.sideNavToolbarVibrant, { width: 375, height: 812 });
    const vibrant = await page
      .locator(horizontal)
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    const page_ = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    // Standard is a surface step off the page; vibrant is `primary`,
    // which is the page's own foreground — the inverse of the page.
    expect(standard).not.toBe(vibrant);
    const fg = await page.evaluate(() => getComputedStyle(document.body).color);
    expect(vibrant, "vibrant is the page's foreground colour").toBe(fg);
    expect(vibrant).not.toBe(page_);
  });
});

test.describe("no elevation, in either scheme, on either axis", () => {
  /**
   * `ElevationTokens.Level0`, as androidx ships it — a maintainer's call
   * (2026-09-24) over a soft shadow; `side-nav.tsx`'s `TOOLBAR_CONTAINER`
   * has the trade-off. Every bar is checked, because a shadow can come
   * back through a scheme's own `container` classes or one rail's own
   * class list as easily as through the shared container. Tailwind
   * composes empty ring layers into `box-shadow` whenever any shadow
   * utility is present, so "every layer is transparent" is the honest
   * reading rather than `=== "none"`; `filter` is checked too, because a
   * `drop-shadow()` leaves `box-shadow` at `none`.
   */
  const flat = (shadow: string) =>
    shadow === "none" ||
    shadow.split(/,(?![^(]*\))/).every((layer) => /rgba\(0, 0, 0, 0\)/.test(layer));

  const cases = [
    {
      name: "horizontal, standard",
      story: STORY.sideNavToolbarStandard,
      width: 375,
      bar: horizontal,
    },
    {
      name: "horizontal, vibrant",
      story: STORY.sideNavToolbarVibrant,
      width: 375,
      bar: horizontal,
    },
    { name: "vertical, standard", story: STORY.sideNavInAShell, width: 900, bar: vertical },
  ];
  for (const theme of ["dark", "light"] as const) {
    for (const c of cases) {
      test(`${c.name}, ${theme} theme`, async ({ page }) => {
        await openStory(page, c.story, { width: c.width, height: 800, theme });
        const bar = page.locator(c.bar);
        await expect(bar).toBeVisible();
        const style = await bar.evaluate((el) => {
          const s = getComputedStyle(el);
          return { shadow: s.boxShadow, filter: s.filter };
        });
        expect(flat(style.shadow), `box-shadow: ${style.shadow}`).toBe(true);
        expect(style.filter, "no drop-shadow filter either").toBe("none");
      });
    }
  }
});

test.describe("the vertical floating toolbar, 640–1279px", () => {
  test("is 64px wide and floats 16px off the left edge", async ({ page }) => {
    await openStory(page, STORY.sideNavInAShell, { width: 900, height: 700 });
    const bar = page.locator(vertical);
    await expect(bar).toBeVisible();
    const rect = await box(bar);
    expect(rect.width, "toolbar width").toBeCloseTo(64, 0);
    expect(rect.x, "offset from the left edge").toBeCloseTo(16, 0);
  });

  test("the current page's pill runs along the toolbar's own axis", async ({ page }) => {
    await openStory(page, STORY.sideNavInAShell, { width: 900, height: 700 });
    const current = container(page.locator(`${vertical} a[aria-current="page"]`));
    const rect = await box(current);
    expect(rect.width, "current page pill width").toBeCloseTo(40, 0);
    expect(rect.height, "current page pill height").toBeCloseTo(64, 0);
  });
});

test.describe("a phone select sheet in a stacking context", () => {
  /**
   * The sheet is not portalled, so inside a `sticky` header its `z-50`
   * only counts within that header, and the toolbar — portalled to `body`
   * at `z-40` — painted over the sheet's bottom 80px, hiding its last
   * option (seen: "Last 7 days" under the bar). The toolbar now hides
   * itself while a sheet is open. Read as computed `visibility`, because
   * hit-testing cannot see it: the toolbar is `inert` while the listbox
   * is open, so `elementsFromPoint` skips it whether it is painted or not.
   */
  test("the toolbar steps out of the way while the sheet is open, and comes back", async ({
    page,
  }) => {
    await openStory(page, STORY.sideNavToolbarUnderASheet, { width: 375, height: 812 });
    await expect(storyRoot(page).getByRole("listbox")).toBeVisible();
    const bar = page.locator(horizontal);
    const visibility = () => bar.evaluate((el) => getComputedStyle(el).visibility);
    expect(await visibility(), "while the sheet is open").toBe("hidden");

    await page.keyboard.press("Escape");
    await expect(storyRoot(page).getByRole("listbox")).toHaveCount(0);
    expect(await visibility(), "once it has closed").toBe("visible");
  });
});
