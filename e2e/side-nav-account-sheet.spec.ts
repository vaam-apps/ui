import { createRequire } from "node:module";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { box, hitAtVisibleCentre, openStory, parseColor } from "./helpers";
import { STORY } from "./story-ids";

/**
 * `accountSlot`, reachable from the floating toolbars — vaam-apps/ui#36.
 *
 * Below 1280px the default floating `SideNav` used to render the account
 * block nowhere, so consumers pinned their own `fixed` chrome beside the
 * bottom toolbar to reach Sign out, and it collided with the toolbar. Now
 * each toolbar ends in a "More" control that opens an M3 modal sheet with
 * the account block in it (`NavSheet` in `side-nav.tsx`): a bottom sheet
 * from the phone bar, a navigation drawer from the vertical rail.
 *
 * Everything here is geometry, focus and hit-testing — where the sheet
 * lands, whether what it holds can be operated — which jsdom cannot see.
 * The three sheet stories open their sheet from their own play function;
 * a test that needs it closed closes it.
 *
 * `SideNav` in the phone story sits inside a `will-change: transform`
 * wrapper — vaul's stamp on every drawer — and the rail that opens the
 * sheet is itself `translate`d. A `fixed` sheet rendered inside either
 * would be laid out against that box instead of the viewport, so the
 * bottom-edge geometry below is also the proof that the sheet is
 * portalled out of both.
 */

const PHONE = { width: 375, height: 760 };
const TABLET = { width: 1100, height: 760 };

/** vaul animates the sheet in with a CSS *animation* (keyframes), which
 * `settleTransitions` deliberately ignores; nothing on these stories runs
 * an endless one, so waiting for all of them is safe here. */
async function settleAnimations(page: Page) {
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== "running"),
  );
}

async function openedSheet(page: Page, presentation: "bottom" | "side"): Promise<Locator> {
  const sheet = page.locator(`[data-side-nav-sheet="${presentation}"]`);
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAttribute("role", "dialog");
  await settleAnimations(page);
  return sheet;
}

/** The one "More" control a reader can see at this width — each rail has
 * its own, and CSS shows one rail at a time. */
function visibleMore(page: Page): Locator {
  return page.locator("[data-side-nav-more]:visible");
}

async function radii(target: Locator) {
  return await target.evaluate((el) => {
    const s = getComputedStyle(el);
    return [
      s.borderTopLeftRadius,
      s.borderTopRightRadius,
      s.borderBottomRightRadius,
      s.borderBottomLeftRadius,
    ];
  });
}

/** Tabs forward `presses` times, recording whether focus ever left the
 * sheet — the modal trap, measured rather than assumed. */
async function tabThrough(page: Page, sheet: Locator, presses: number) {
  const visited: string[] = [];
  for (let i = 0; i < presses; i += 1) {
    await page.keyboard.press("Tab");
    visited.push(
      await sheet.evaluate((el) => {
        const active = document.activeElement;
        if (active === null || !el.contains(active)) {
          return `OUTSIDE:${active?.tagName ?? "null"}`;
        }
        return (active.getAttribute("aria-label") ?? active.textContent ?? "").trim();
      }),
    );
  }
  return visited;
}

const AXE_PATH = createRequire(import.meta.url).resolve("axe-core/axe.min.js");

/** The rules that speak to a modal sheet's structure — its name, the
 * landmarks and lists in it, what `aria-hidden` left focusable. The whole
 * ruleset would also judge the story's filler, which is not this file's
 * subject. */
async function axeWithSheetOpen(page: Page) {
  await page.addScriptTag({ path: AXE_PATH });
  return await page.evaluate(async () => {
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
    const result = await axe.run(document, {
      runOnly: [
        "aria-dialog-name",
        "aria-hidden-focus",
        "landmark-unique",
        "region",
        "list",
        "listitem",
        "link-name",
        "button-name",
        "nested-interactive",
        "aria-allowed-attr",
        "aria-required-children",
      ],
    });
    return result.violations.map((violation) => ({
      id: violation.id,
      targets: violation.nodes.map((node) => JSON.stringify(node.target)),
    }));
  });
}

test.describe("the phone bar's More sheet (375px)", () => {
  test("sits on the viewport's bottom edge, full width, with 28px top corners — from inside a will-change: transform ancestor", async ({
    page,
  }) => {
    await openStory(page, STORY.sideNavAccountSheetPhone, PHONE);
    const sheet = await openedSheet(page, "bottom");

    // The premise, checked rather than assumed: `SideNav` really is inside
    // a containing block for `fixed`, and that block is nothing like the
    // viewport — below `xl` the in-flow nav is `display: none`, so the
    // wrapper is a zero-width column — so a sheet it had captured could
    // not pass the full-width check below.
    const ancestor = page.locator("[data-transformed-ancestor]");
    expect(await ancestor.evaluate((el) => getComputedStyle(el).willChange)).toBe("transform");
    const trap = await ancestor.evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect);
    expect(trap.width, "the wrapper's own width").toBeLessThan(PHONE.width / 2);

    const rect = await box(sheet);
    expect(rect.x, "left edge").toBeCloseTo(0, 0);
    expect(rect.width, "full width").toBeCloseTo(PHONE.width, 0);
    expect(rect.y + rect.height, "bottom edge").toBeCloseTo(PHONE.height, 0);
    expect(rect.height, "at most 85dvh").toBeLessThanOrEqual(PHONE.height * 0.85 + 0.5);
    // `SheetBottomTokens.DockedContainerShape` = `CornerExtraLargeTop`.
    expect(await radii(sheet)).toEqual(["28px", "28px", "0px", "0px"]);

    // M3's drag handle, 32×4, with 22px clear above and below it
    // (`DragHandleVerticalPadding`) — below, to the first row.
    const handle = sheet.locator("[data-vaul-handle]");
    const grip = await box(handle);
    expect([grip.width, grip.height]).toEqual([32, 4]);
    expect(grip.y - rect.y, "22px above the handle").toBeCloseTo(22, 0);
    const firstRow = await box(sheet.getByRole("link").first());
    expect(firstRow.y - (grip.y + grip.height), "22px below the handle").toBeCloseTo(22, 0);
  });

  test("dims the whole viewport behind it", async ({ page }) => {
    await openStory(page, STORY.sideNavAccountSheetPhone, PHONE);
    await openedSheet(page, "bottom");
    const scrim = page.locator("[data-vaul-overlay]");
    const rect = await box(scrim);
    expect([rect.x, rect.y, rect.width, rect.height]).toEqual([0, 0, PHONE.width, PHONE.height]);
    const fill = parseColor(await scrim.evaluate((el) => getComputedStyle(el).backgroundColor));
    expect(fill.alpha, "the scrim paints something").toBeGreaterThan(0);
    expect(await scrim.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  });

  test("holds the overflow destinations, then the footer, then the account block — in that order on screen", async ({
    page,
  }) => {
    await openStory(page, STORY.sideNavAccountSheetPhone, PHONE);
    const sheet = await openedSheet(page, "bottom");

    const rows = sheet.getByRole("link");
    expect(await rows.allTextContents()).toEqual(["Routes", "Documentation", "Settings"]);
    expect(await rows.evaluateAll((els) => els.map((el) => el.getAttribute("href")))).toEqual([
      "/routes",
      "/docs",
      "/settings",
    ]);
    await expect(sheet.getByRole("link", { name: "Routes" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    // M3's navigation-drawer item: 56px tall, fully round.
    for (const row of await rows.all()) {
      const rect = await box(row);
      expect(rect.height, "row height").toBe(56);
      const [radius] = await radii(row);
      expect(Number.parseFloat(radius ?? "0"), "a full pill").toBeGreaterThanOrEqual(28);
    }

    const lastRow = await box(rows.last());
    const account = await box(sheet.locator("[data-side-nav-account]"));
    expect(account.y, "the account block starts below the last row").toBeGreaterThanOrEqual(
      lastRow.y + lastRow.height,
    );
  });

  test("the account block is reachable and operable by pointer", async ({ page }) => {
    await openStory(page, STORY.sideNavAccountSheetPhone, PHONE);
    const sheet = await openedSheet(page, "bottom");

    const signOut = sheet.getByRole("button", { name: "Sign out" });
    const rect = await box(signOut);
    expect(rect.y + rect.height, "inside the viewport").toBeLessThanOrEqual(PHONE.height);
    // Nothing — the toolbar, the scrim — sits over it at the pixel a
    // finger aims at.
    expect((await hitAtVisibleCentre(page, signOut)).control).toBe("Sign out");
    await signOut.click();
    await expect(sheet.getByRole("button", { name: "Signed out" })).toBeVisible();

    // `hitAt`'s target list has no `radio` role, so this one is asked
    // directly: the point at the option's centre belongs to that option.
    const comfortable = sheet.getByRole("radio", { name: "Comfortable" });
    const option = await box(comfortable);
    expect(
      await comfortable.evaluate(
        (el, [x, y]) =>
          document.elementFromPoint(x as number, y as number)?.closest('[role="radio"]') === el,
        [option.x + option.width / 2, option.y + option.height / 2],
      ),
      "nothing is drawn over the radio option",
    ).toBe(true);
    await comfortable.click();
    await expect(comfortable).toHaveAttribute("aria-checked", "true");
    // Operating the account block is not a dismissal.
    await expect(sheet).toBeVisible();
  });

  test("keyboard: focus starts on the sheet, stays in it, reaches every control, and Escape hands it back to More", async ({
    page,
  }) => {
    await openStory(page, STORY.sideNavAccountSheetPhone, PHONE);
    const sheet = await openedSheet(page, "bottom");

    expect(
      await sheet.evaluate((el) => document.activeElement === el),
      "focus is on the sheet itself, so reading starts at its top",
    ).toBe(true);

    // The first Tab lands on the first row, and its focus ring is drawn
    // whole: the row sits at the top of the sheet's own scroll box, which
    // would clip a ring that had no room above it.
    await page.keyboard.press("Tab");
    const first = sheet.getByRole("link", { name: "Routes" });
    await expect(first).toBeFocused();
    const ring = await first.evaluate((el) => {
      const s = getComputedStyle(el);
      // The nearest ancestor that clips: the sheet's scrolling list.
      let scroller = el.parentElement;
      while (
        scroller !== null &&
        !/auto|scroll|hidden/.test(getComputedStyle(scroller).overflowY)
      ) {
        scroller = scroller.parentElement;
      }
      const row = el.getBoundingClientRect();
      const clip = scroller?.getBoundingClientRect();
      const reach = Number.parseFloat(s.outlineWidth) + Number.parseFloat(s.outlineOffset);
      return {
        style: s.outlineStyle,
        room: clip === undefined ? Number.NaN : row.top - reach - clip.top,
      };
    });
    expect(ring.style, "a focus ring is drawn").toBe("solid");
    expect(ring.room, "the ring's top edge is inside the scroll box").toBeGreaterThanOrEqual(0);

    // Rows, then the radio group (one stop), then Sign out — and round
    // again, never out of the sheet.
    const visited = await tabThrough(page, sheet, 11);
    expect(visited.filter((stop) => stop.startsWith("OUTSIDE"))).toEqual([]);
    expect(visited.slice(0, 4)).toEqual(["Documentation", "Settings", "Compact", "Sign out"]);

    // Operable from the keyboard, not only reachable: the arrow keys move
    // the radio group, Enter presses the button.
    const compact = sheet.getByRole("radio", { name: "Compact" });
    await compact.focus();
    await page.keyboard.press("ArrowRight");
    await expect(sheet.getByRole("radio", { name: "Comfortable" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await sheet.getByRole("button", { name: "Sign out" }).focus();
    await page.keyboard.press("Enter");
    await expect(sheet.getByRole("button", { name: "Signed out" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    const more = visibleMore(page);
    await expect(more).toBeFocused();
    await expect(more).toHaveAttribute("aria-label", "More");
  });

  test("a tap on the scrim closes it", async ({ page }) => {
    await openStory(page, STORY.sideNavAccountSheetPhone, PHONE);
    const sheet = await openedSheet(page, "bottom");
    const rect = await box(sheet);
    // Above the sheet, on the dimmed page.
    await page.mouse.click(PHONE.width / 2, rect.y / 2);
    await expect(sheet).toBeHidden();
  });

  test("the More control is a full toolbar target, marked current, and the bar still fits", async ({
    page,
  }) => {
    await openStory(page, STORY.sideNavAccountSheetPhone, PHONE);
    await openedSheet(page, "bottom");
    await page.keyboard.press("Escape");
    await settleAnimations(page);

    const more = visibleMore(page);
    const target = await box(more);
    // `/routes` is behind it, so it takes the current page's 64×48 pill.
    expect([target.width, target.height]).toEqual([64, 48]);
    const pill = parseColor(
      await more
        .locator("[data-toolbar-item]")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    );
    expect(pill.alpha, "filled as the current page").toBeGreaterThan(0);

    const bar = await box(page.locator('[data-floating-rail-axis="horizontal"]'));
    expect(bar.width, "HORIZONTAL_RAIL_SLOTS' 288px").toBeLessThanOrEqual(288);
    expect(target.x + target.width, "More is inside the bar").toBeLessThanOrEqual(
      bar.x + bar.width,
    );
  });

  test("axe finds nothing structural with the sheet open", async ({ page }) => {
    await openStory(page, STORY.sideNavAccountSheetPhone, PHONE);
    await openedSheet(page, "bottom");
    expect(await axeWithSheetOpen(page)).toEqual([]);
  });
});

test("with no overflow, an accountSlot still earns the phone bar a More control, and its sheet holds only the account block", async ({
  page,
}) => {
  await openStory(page, STORY.sideNavAccountSheetNoOverflow, PHONE);
  const sheet = await openedSheet(page, "bottom");
  expect(await sheet.getByRole("link").count()).toBe(0);
  await expect(sheet.getByRole("button", { name: "Sign out" })).toBeVisible();

  await page.keyboard.press("Escape");
  await settleAnimations(page);
  const bar = page.locator('[data-floating-rail-axis="horizontal"]');
  // Three destinations in slots, and More.
  expect(await bar.getByRole("link").count()).toBe(3);
  await expect(bar.getByRole("button", { name: "More" })).toBeVisible();
});

test.describe("the vertical rail's More drawer (1100px)", () => {
  test("is M3's modal navigation drawer: the full height of the left edge, 360px wide, 16px trailing corners", async ({
    page,
  }) => {
    await openStory(page, STORY.sideNavAccountSheetRail, TABLET);
    const drawer = await openedSheet(page, "side");
    const rect = await box(drawer);
    expect([rect.x, rect.y]).toEqual([0, 0]);
    expect(rect.height, "full height").toBe(TABLET.height);
    expect(rect.width, "`NavigationDrawerTokens.ContainerWidth`").toBe(360);
    // `CornerLargeEnd`: the two trailing corners only.
    expect(await radii(drawer)).toEqual(["0px", "16px", "16px", "0px"]);
  });

  test("holds the sidebar's content, labelled — every destination, the footer, then the account block — and it all works", async ({
    page,
  }) => {
    await openStory(page, STORY.sideNavAccountSheetRail, TABLET);
    const drawer = await openedSheet(page, "side");

    expect(await drawer.getByRole("link").allTextContents()).toEqual([
      "Dashboard",
      "Composer",
      "Messages",
      "Providers",
      "Routes",
      "Documentation",
      "Settings",
    ]);
    await expect(drawer.getByRole("link", { name: "Providers" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(drawer.getByRole("list", { name: "Messaging" })).toBeVisible();
    await expect(drawer.getByRole("list", { name: "Delivery" })).toBeVisible();

    const signOut = drawer.getByRole("button", { name: "Sign out" });
    expect((await hitAtVisibleCentre(page, signOut)).control).toBe("Sign out");
    await signOut.click();
    await expect(drawer.getByRole("button", { name: "Signed out" })).toBeVisible();

    const visited = await tabThrough(page, drawer, 14);
    expect(visited.filter((stop) => stop.startsWith("OUTSIDE"))).toEqual([]);
  });

  test("More is the rail's last control, a 48px target inside it, and Escape hands focus back to it", async ({
    page,
  }) => {
    await openStory(page, STORY.sideNavAccountSheetRail, TABLET);
    const drawer = await openedSheet(page, "side");
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();

    const more = visibleMore(page);
    await expect(more).toBeFocused();
    const rail = page.locator("nav[data-floating-rail]:not([data-floating-rail-axis])");
    const lastControl = await rail.evaluate((nav) => {
      const controls = nav.querySelectorAll("a[href], button");
      return controls[controls.length - 1]?.getAttribute("aria-label") ?? null;
    });
    expect(lastControl).toBe("More");

    const target = await box(more);
    expect([target.width, target.height]).toEqual([48, 48]);
    const railBox = await box(rail);
    expect(target.x).toBeGreaterThanOrEqual(railBox.x);
    expect(target.x + target.width).toBeLessThanOrEqual(railBox.x + railBox.width);
  });

  test("axe finds nothing structural with the drawer open", async ({ page }) => {
    await openStory(page, STORY.sideNavAccountSheetRail, TABLET);
    await openedSheet(page, "side");
    expect(await axeWithSheetOpen(page)).toEqual([]);
  });
});

test.describe("unchanged where nothing was missing", () => {
  test("without an accountSlot the vertical rail gains no control", async ({ page }) => {
    await openStory(page, STORY.sideNavInAShell, TABLET);
    await expect(page.locator("nav[data-floating-rail]:visible")).toHaveCount(1);
    expect(await page.locator("[data-side-nav-more]").count()).toBe(0);
  });

  test("without an accountSlot the phone bar's overflow is still a menu of links", async ({
    page,
  }) => {
    await openStory(page, STORY.sideNavInAShell, PHONE);
    await page.getByRole("button", { name: "More destinations" }).click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    expect(await menu.getByRole("menuitem").count()).toBeGreaterThan(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("at 1440px the account block is in the sidebar, and no More control is showing", async ({
    page,
  }) => {
    await openStory(page, STORY.sideNavWithAnAccountBlock, { width: 1440, height: 760 });
    const sidebar = page.locator('nav[aria-label="Primary"]:not([data-floating-rail])');
    const signOut = sidebar.getByRole("button", { name: "Sign out" });
    await expect(signOut).toBeVisible();
    const inside = await box(sidebar);
    const rect = await box(signOut);
    expect(rect.x).toBeGreaterThanOrEqual(inside.x);
    expect(rect.x + rect.width).toBeLessThanOrEqual(inside.x + inside.width);
    await expect(visibleMore(page)).toHaveCount(0);
  });
});
