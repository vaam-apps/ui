import { type RefObject, useEffect } from "react";

/**
 * The page's one scroll-lock count — module-level so every popup that locks
 * shares it: only the last to close lifts the lock. `usePopupModality`'s
 * doc has why it is counted.
 */
let scrollLocks = 0;

function lockScroll() {
  const html = document.documentElement;
  if (scrollLocks === 0) {
    const gap = window.innerWidth - html.clientWidth;
    html.style.setProperty("--select-scroll-gap", `${gap}px`);
    html.setAttribute("data-select-scroll-lock", "");
  }
  scrollLocks += 1;
  return () => {
    scrollLocks -= 1;
    if (scrollLocks === 0) {
      html.removeAttribute("data-select-scroll-lock");
      html.style.removeProperty("--select-scroll-gap");
    }
  };
}

/**
 * A popup's modality: the page cannot scroll, and everything but the
 * trigger and the popup is `inert`. Written for `Select`'s combobox engine
 * (`select.tsx`), whose case follows.
 *
 * `Listbox` does this for itself (`useScrollLock` + `useInertOthers`), and
 * so would `ComboboxOptions` — but its inert allowlist is the field, the
 * button and the *options*, and the combobox engine's popup is more than
 * its options: a header with a back arrow (`SelectClose`) and a clear
 * button sits beside the field. Under Headless UI's modality those would
 * be inert, and could not be tapped. So `ComboboxOptions` runs with
 * `modal={false}` and this does the same two things with the popup's own
 * surface allowed instead. It climbs to `<html>` rather than stopping at
 * `<body>` as Headless UI's does, so body-level portals — `SideNav`'s
 * toolbars, toasts — are inert too.
 *
 * # It shares the page with other modality, and only undoes its own
 *
 * The first version recorded the `inert` and `overflow` it found and wrote
 * them back on close. Inside a Headless UI `Dialog` that is fatal: the
 * dialog's own modality had already set both, and when a pick closed the
 * select *and* the dialog in one commit, the dialog's cleanup ran first and
 * this one then restored the dialog's values — measured: `#storybook-root`
 * left `inert` and `<html>` `overflow: hidden` for good, the page dead until
 * a reload. So now it never touches an element that is already inert
 * (someone else owns that), un-inerts only what it flipped itself, and
 * locks scroll with an attribute rather than an inline style
 * (`:root:not(span)[data-select-scroll-lock]` in `theme.css`, whose
 * comment says why not `html[…]`), reference-counted, so
 * it and Headless UI's inline `overflow` can come and go in any order.
 *
 * The lock also pads the page by the scrollbar it hides, as Headless UI's
 * does: without it, a page with a classic scrollbar shifted sideways by its
 * width on every open and close (measured: 488.5 → 496px).
 *
 * The attribute and `--select-scroll-gap` keep `Select`'s names whoever
 * locks; `theme.css` owns the rule that reads them.
 */
export function usePopupModality(
  active: boolean,
  surfaceRef: RefObject<HTMLElement | null>,
  triggerRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!active) return;
    const keep = [surfaceRef.current, triggerRef.current].filter(
      (element): element is HTMLElement => element !== null,
    );
    const flipped: HTMLElement[] = [];
    for (const element of keep) {
      let node: HTMLElement = element;
      while (node.parentElement !== null) {
        const parent: HTMLElement = node.parentElement;
        for (const sibling of Array.from(parent.children)) {
          if (!(sibling instanceof HTMLElement) || sibling === node || sibling.inert) continue;
          if (keep.some((kept) => sibling.contains(kept))) continue;
          sibling.inert = true;
          flipped.push(sibling);
        }
        node = parent;
      }
    }
    const unlock = lockScroll();
    return () => {
      for (const element of flipped) element.inert = false;
      unlock();
    };
  }, [active, surfaceRef, triggerRef]);
}
