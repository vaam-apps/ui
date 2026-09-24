import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/**
 * D5: `@radix-ui/react-tooltip` is deleted outright, replaced by DaisyUI's
 * native `.tooltip`/`data-tip` CSS component — no JS, no portal, hover/focus
 * driven by `:hover`/`:focus` in CSS alone. Headless UI ships no Tooltip
 * equivalent, and introducing a second behaviour library (e.g.
 * `@floating-ui/react`) just to replace one Radix package with another
 * contradicts constraints 6–7.
 *
 * Since #32 `@floating-ui/react-dom` *is* a direct dependency — a
 * maintainer's call, for `Select`'s dropdown, which a `Dialog` clipped
 * (`useDropdownPlacement` in `select.tsx`). It positions; it is not a
 * behaviour library. This tooltip has not been moved onto it, so the
 * limitation below still holds; moving it is now possible, not done.
 *
 * **Accepted limitation (named explicitly in the design doc, D5):** `data-tip`
 * is a plain HTML attribute rendered via CSS `content: attr(data-tip)`, so
 * the label must be a string — no rich/interactive tooltip content anywhere
 * in this console. Nothing today needs one (`side-nav.tsx`'s own icon-rail
 * tooltips already use the identical `tooltip`/`data-tip` convention
 * directly, predating this file).
 *
 * The API collapses Radix's four-part compound
 * (`TooltipProvider`/`Tooltip`/`TooltipTrigger`/`TooltipContent`) into one
 * wrapper, since DaisyUI's mechanism needs no provider and no separate
 * trigger/content split — the trigger is just `children`.
 *
 * # `title`, in addition to `data-tip` — same bug as `SideNav`, same fix
 *
 * `.tooltip`'s bubble is an absolutely positioned pseudo-element. Any
 * scrolling ancestor clips it away on every hover while it still grows
 * that ancestor's scrollable area — this is the identical failure
 * `side-nav.tsx`'s `NavLink` doc measures and fixes for the icon rail
 * (read that comment for the numbers; it is not re-derived here), and
 * `Table`'s wrapper (`overflow-x-auto`, forced `overflow-y: auto`) is
 * exactly such an ancestor, so a `Tooltip` in a table cell hits it too.
 *
 * `SideNav` fixed its case by dropping `.tooltip` entirely and using only
 * a native `title` — the browser paints it outside the page, so nothing
 * can clip it. This component keeps `data-tip` as the primary, styled
 * experience (most callers are not inside a scroller, and the positioned
 * bubble is a better mark than the browser's own plain tooltip box) and
 * adds `title={label}` on the same element as a **fallback**: wherever
 * `.tooltip` gets clipped, `title` still carries the label through, just
 * with the browser's own delay and styling instead of this system's.
 * Where nothing clips it, both fire — the styled bubble immediately, the
 * native one after the browser's own hover delay — which reads as mildly
 * redundant but never as broken. `TableCell` and every other clipping
 * ancestor need no special-casing as a result: `Tooltip` degrades on its
 * own. See `ClippedByAScrollingAncestor` in `tooltip.stories.tsx` for the
 * clipped case, and its docstring for exactly what does and doesn't
 * survive.
 */
export interface TooltipProps {
  /** Plain text only — see the module doc above. Also becomes the native
   * `title` fallback (see "`title`, in addition to `data-tip`" above), so
   * there is no separate prop for it. */
  label: string;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
  children: ReactNode;
}

/**
 * The four side classes, written out, because a template literal is
 * invisible to Tailwind.
 *
 * This was `` `tooltip-${position}` `` — a class name that appears
 * nowhere in the source as text. Tailwind v4 generates only the
 * utilities it can *see*, so whether `tooltip-bottom` exists in the
 * output depended on whether something else in the scanned tree happened
 * to spell it. Measured in a real build where nothing did: the stylesheet
 * contained `.tooltip`, `.tooltip-content` and `.tooltip-open` and
 * nothing else, and all four bubbles in the `Positions` story rendered
 * *above* their trigger — every one of them, silently, with the prop
 * apparently accepted.
 *
 * It is the same failure the README warns consumers about for a missing
 * `@source` line: no error, no warning, just styling that is not there.
 * A lookup makes the four names literal text in this file, so they are
 * always generated and the prop cannot quietly stop working between
 * builds.
 */
const POSITION_CLASS = {
  top: "tooltip-top",
  bottom: "tooltip-bottom",
  left: "tooltip-left",
  right: "tooltip-right",
} as const satisfies Record<NonNullable<TooltipProps["position"]>, string>;

export function Tooltip({ label, position = "top", className, children }: TooltipProps) {
  return (
    <div
      className={cn("tooltip", POSITION_CLASS[position], className)}
      data-tip={label}
      title={label}
    >
      {children}
    </div>
  );
}
