import { autoUpdate, flip, hide, offset, shift, size, useFloating } from "@floating-ui/react-dom";
import type { CSSProperties, RefObject } from "react";

/** The shortest a dropdown shrinks to before it flips to the other side
 * of its trigger instead — a library choice: a docked search view's 56px
 * header, four of its 32px rows and the list's 8px of padding (192px,
 * measured), rounded up. */
const DROPDOWN_MIN_HEIGHT = 200;

/**
 * Where the dropdown goes: under its trigger, by Floating UI, in
 * `position: fixed`, while staying rendered inline.
 *
 * It used to be `absolute` under the trigger, which any scrolling or
 * clipping ancestor cut off — inside a `Dialog` the dropdown lived in the
 * dialog's own scrolling body, measured at 1280px: one row showing of a
 * 346px-tall search view, the rest clipped by a 156px dialog. `fixed`
 * escapes every ancestor that clips, and Floating UI resolves it against
 * the right box when an ancestor *is* a containing block — vaul stamps
 * `will-change: transform` on every drawer (AGENTS.md's trap), so inside
 * one the coordinates are the drawer's, not the viewport's. What `fixed`
 * cannot escape is an ancestor that is both: a containing block that also
 * clips (`transform`, `filter`, `backdrop-filter` or `contain`, with
 * `overflow: hidden`) clips it as it clipped `absolute` — measured, one
 * row left in a 120px `backdrop-filter` card. Nothing in this library is
 * built that way at rest — a `Dialog`'s panel is, for the length of its
 * enter transition, while `scale-95` applies — and a caller's container
 * can be. The popup
 * still renders inline, not portalled: the reason is `SelectPopup`'s
 * `portal={false}` comment in `select.tsx`, and it has not changed.
 *
 * `size` hands the trigger's width and the height available to CSS, so
 * the dropdown shrinks to fit. `flip` opens it upward when it does not fit
 * below and less than `DROPDOWN_MIN_HEIGHT` is left there — a short list
 * that fits never flips — and, checking the horizontal edges too, aligns
 * it to the trigger's right edge instead of its left when a docked search
 * view's 16rem would run off the right of the window. `shift` only acts
 * when neither alignment fits, on a window narrower than the view.
 *
 * The result goes out as custom properties, never as inline `top`/`left`:
 * below `sm` a `SelectContent` is a sheet or a full-screen view whose
 * `max-sm:` classes must win, and an inline style would beat them. The
 * classes decide whether to use the numbers; no breakpoint is read here.
 *
 * `enabled: false` returns no placement at all, for a popup its own
 * classes place at every width — a `Select`'s `SelectModal`.
 *
 * `minHeight` is that floor: `DROPDOWN_MIN_HEIGHT` by default, for a list
 * that scrolls; `"content"` for a popup that should never scroll while the
 * other side has room for all of it — a docked date picker, whose month
 * shrunk to 200px was a calendar to scroll through. The floor is then its
 * own full height (`scrollHeight`, which `max-height` does not cut).
 */
export function useDropdownPlacement(
  enabled: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  minHeight: number | "content" = DROPDOWN_MIN_HEIGHT,
) {
  const { refs, x, y, middlewareData } = useFloating({
    strategy: "fixed",
    placement: "bottom-start",
    elements: { reference: triggerRef.current },
    middleware: [
      offset(4),
      // `size` before `flip`, holding the dropdown at no less than
      // `DROPDOWN_MIN_HEIGHT`: it shrinks to the room under its trigger
      // when that room is reasonable, and flips only when it is not. With
      // `flip` first, a 346px search view flipped above a trigger that had
      // 335px under it — measured in a `Dialog` at 1280×800 — a jump for
      // 11px.
      size({
        padding: 8,
        apply({ availableHeight, elements }) {
          const least = minHeight === "content" ? elements.floating.scrollHeight : minHeight;
          const floor = Math.max(least, Math.floor(availableHeight));
          elements.floating.style.setProperty("--select-float-max-h", `${floor}px`);
        },
      }),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      // …and again once the side is settled, without the floor: when
      // neither side has `DROPDOWN_MIN_HEIGHT`, `flip` keeps the side that
      // overflows least, and the floor would then push it off the window
      // (measured: 6px past the bottom of a 420px-tall one).
      size({
        padding: 8,
        apply({ rects, availableHeight, elements }) {
          const height = Math.max(0, Math.floor(availableHeight));
          elements.floating.style.setProperty("--select-float-w", `${rects.reference.width}px`);
          elements.floating.style.setProperty("--select-float-max-h", `${height}px`);
        },
      }),
      // A trigger scrolled out of its container's view takes the dropdown
      // with it. `absolute`, the scroller used to clip the dropdown too;
      // `fixed`, it floated on over the container's own chrome — measured
      // in a drawer: the dropdown drawn over the drawer's header at y 68,
      // its trigger 100px scrolled up under it. The surface goes
      // transparent and stops taking the pointer instead (its classes,
      // on `data-reference-hidden`), and comes back when the trigger
      // does. Not `visibility: hidden`: Chromium blurs a focused element
      // that stops being rendered, and focus lands on `<body>` while the
      // popup stays open — measured in both engines, after which the next
      // Escape closed the drawer and left the popup open. Transparent, the
      // list keeps focus and still answers the keyboard, which is also what
      // a list the scroller clipped used to do.
      hide({ strategy: "referenceHidden" }),
    ],
    whileElementsMounted: autoUpdate,
  });
  // A modal is placed by its own classes at every width.
  if (!enabled) {
    return { setFloating: undefined, style: undefined, referenceHidden: undefined };
  }
  const style = { "--select-float-x": `${x}px`, "--select-float-y": `${y}px` } as CSSProperties;
  const referenceHidden = middlewareData.hide?.referenceHidden === true ? "" : undefined;
  return { setFloating: refs.setFloating, style, referenceHidden };
}
