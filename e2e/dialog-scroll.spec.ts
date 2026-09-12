import { expect, type Page, test } from "@playwright/test";
import { changedPixels, openStory, pixelSignature, settleTransitions, storyRoot } from "./helpers";
import { STORY } from "./story-ids";

/**
 * The sticky header sits *flush* with its scrollport, at every scroll
 * position.
 *
 * This is the fourth bug in `playwright.config.ts`'s list, and the one
 * whose fix is a single character: `DialogHeader` is `sticky -top-6`
 * rather than `sticky top-0`, because a sticky offset is measured from
 * the scrollport's **content** edge and the wrapper it lives in is `p-6`.
 * With `top-0` the header pinned 24px below the top of the visible panel
 * and the body scrolled past, visibly, in the gap — measured live at the
 * time as "scrollport top 55px, stuck header top 79px".
 *
 * Nothing about that is visible to jsdom: `position: sticky` needs
 * layout, a scrollport and a scroll position, and jsdom has none of the
 * three. The numbers below are read off a real scrolled render.
 */

/** The panel's internal scrolling wrapper, found the way the DOM
 * describes it rather than by class name: the nearest ancestor of the
 * title that actually scrolls. */
async function dialogGeometry(page: Page, scrollTop: number | null) {
  return await page.evaluate((requested) => {
    const title = document.querySelector("h2, [id^='headlessui-dialog-title']");
    if (title === null) throw new Error("the dialog has no title to anchor on");
    let scrollport: HTMLElement | null = title.parentElement;
    while (scrollport !== null) {
      const style = getComputedStyle(scrollport);
      if (
        (style.overflowY === "auto" || style.overflowY === "scroll") &&
        scrollport.scrollHeight > scrollport.clientHeight
      ) {
        break;
      }
      scrollport = scrollport.parentElement;
    }
    if (scrollport === null) throw new Error("the dialog body does not scroll");
    if (requested !== null) {
      scrollport.scrollTop = requested === -1 ? scrollport.scrollHeight : requested;
    }
    const header = scrollport.firstElementChild;
    const footer = scrollport.lastElementChild;
    const close = document.querySelector('button[aria-label="Close"]');
    if (header === null || footer === null || close === null) throw new Error("missing furniture");
    const rect = (el: Element) => {
      const r = el.getBoundingClientRect();
      return {
        top: r.top,
        bottom: r.bottom,
        left: r.left,
        right: r.right,
        width: r.width,
        height: r.height,
      };
    };
    return {
      scrollTop: scrollport.scrollTop,
      maxScroll: scrollport.scrollHeight - scrollport.clientHeight,
      scrollport: rect(scrollport),
      header: rect(header),
      footer: rect(footer),
      close: rect(close),
      headerBackground: getComputedStyle(header as HTMLElement).backgroundColor,
    };
  }, scrollTop);
}

async function openTallDialog(page: Page) {
  await openStory(page, STORY.dialogScrollingBody);
  await storyRoot(page).getByRole("button", { name: "Open tall dialog" }).click();
  await expect(page.locator('button[aria-label="Close"]')).toBeVisible();
  await settleTransitions(page);
}

test("the sticky header stays flush with the scrollport at every scroll position", async ({
  page,
}) => {
  await openTallDialog(page);
  const initial = await dialogGeometry(page, null);
  expect(initial.maxScroll, "the story is supposed to overflow the panel").toBeGreaterThan(100);

  for (const position of [0, Math.round(initial.maxScroll / 2), -1]) {
    const at = await dialogGeometry(page, position);
    expect(
      at.header.top - at.scrollport.top,
      `header offset from the scrollport top at scrollTop ${at.scrollTop}`,
    ).toBeLessThanOrEqual(0.5);
    expect(at.header.top - at.scrollport.top).toBeGreaterThanOrEqual(-0.5);
    expect(
      at.scrollport.bottom - at.footer.bottom,
      `footer offset from the scrollport bottom at scrollTop ${at.scrollTop}`,
    ).toBeLessThanOrEqual(0.5);
  }
});

test("the header occludes the body scrolling underneath it", async ({ page }) => {
  await openTallDialog(page);
  const top = await dialogGeometry(page, 0);
  // The header's own box, minus a strip on the right where the
  // scrollbar's thumb legitimately moves.
  const clip = {
    x: top.header.left,
    y: top.header.top,
    width: top.header.width - 20,
    height: top.header.height,
  };
  const before = await pixelSignature(page, clip);
  await dialogGeometry(page, -1);
  const after = await pixelSignature(page, clip);

  // A sticky header with a transparent background is the same bug in a
  // different disguise: it stays in place while the body shows through
  // it. If nothing shows through, these two screenshots are identical.
  expect(
    await changedPixels(page, before, after),
    "pixels inside the header that changed when the body scrolled behind it",
  ).toBe(0);
  expect(top.headerBackground, "the header needs an opaque ground to occlude with").not.toBe(
    "rgba(0, 0, 0, 0)",
  );
});

test("the close button and the footer action stay reachable at the bottom of a long body", async ({
  page,
}) => {
  await openTallDialog(page);
  const bottom = await dialogGeometry(page, -1);

  // Both inside the panel's visible box rather than merely present in the
  // DOM: the original bug pushed the footer — and its only close action —
  // off the bottom with no scrollbar anywhere.
  expect(bottom.close.top).toBeGreaterThanOrEqual(bottom.scrollport.top - 24);
  expect(bottom.footer.bottom).toBeLessThanOrEqual(bottom.scrollport.bottom + 0.5);

  const footerClose = page.getByRole("button", { name: "Close", exact: true }).last();
  await expect(footerClose).toBeVisible();
  await footerClose.click();
  await expect(page.locator('button[aria-label="Close"]')).toBeHidden();
});
