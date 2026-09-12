"use client";

import {
  type HTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/cn";

// Table conventions per design doc §6.4: sticky header on surface-1, 1px
// `border-edge-subtle` row dividers, no zebra striping (the status tints
// are the signal — zebra plus tints is noise), hover on surface-3.
//
// D16: daisyUI's real `table`/`table-pin-rows` classes sit underneath this
// file's own bespoke row/cell behaviour (constraint 7 — "DaisyUI does the
// work") rather than replacing it. Every own-authored utility class below
// is unchanged from before this PR; `table`/`table-pin-rows` are added on
// top and reconciled against three things confirmed by reading
// `daisyui/components/table.css` directly, not assumed:
//
// 1. `table-pin-rows` alone does nothing — every one of its selectors is
//    `.table :where(.table-pin-rows thead)`, i.e. it only matches when
//    `table-pin-rows` sits on the same element as `table`. Both classes go
//    on `<table>` together, never one without the other.
// 2. `.table` switches `border-collapse` to `separate`. Under the separate
//    border model a border set on `<tr>` — this file's whole row-divider
//    mechanism, `TableRow`'s `border-edge-subtle border-b` — does not
//    render at all; the CSS spec confines borders in that model to cells,
//    never rows or sections. `border-collapse!` (Tailwind v4's trailing-`!`
//    important syntax) stays on `<table>` specifically so adding
//    `.table` doesn't silently delete every row divider in this app —
//    verified live against a real render (`just demo`, `/messages`) with
//    and without the override before trusting it.
// 3. `.table` also applies its own `padding-block`/`padding-inline` to
//    every `th`/`td` via a zero-specificity-inside `:where()` selector,
//    and its own `font-size`. `TableHead`/`TableCell` keep their existing
//    `px-3`/`py-2`/`h-8` utilities unchanged, at equal selector
//    specificity to daisyUI's rule — confirmed live that the existing
//    cell padding and type scale still win, not daisyUI's defaults.
export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  /**
   * Bounds the scroll wrapper and turns it into a real vertical
   * scrollport (`max-height` + `overflow-y: auto`), e.g. `"24rem"`.
   *
   * `TableHeader`'s `sticky top-0` **requires this**. Per CSS Overflow,
   * setting `overflow-x: auto` on the wrapper below forces its computed
   * `overflow-y` from `visible` to `auto` — so that wrapper, not whatever
   * scrolls the page, is already the nearest scroll container `position:
   * sticky` measures against. Left at its default `height: auto`, it
   * never itself overflows vertically (it just grows to fit the table),
   * so there is nothing for the header to stick *to*: the whole wrapper,
   * header included, scrolls away with the page. `maxHeight` gives that
   * same box an actual bound, so it — rather than the page — is what
   * scrolls, and the sticky header has a scrollport to stay pinned
   * against. Omit it and the header **will** scroll away; that is a
   * documented, honest trade-off, not a bug (see `TableHeader`'s doc and
   * the two stories in `table.stories.tsx`).
   */
  maxHeight?: string | undefined;
  /**
   * Accessible name for the scroll wrapper, used only while the wrapper
   * is actually scrollable (see `Table`'s own doc for how that's
   * detected) — it needs a name at exactly the moment it becomes a
   * keyboard-focusable landmark, and not before.
   *
   * Left undefined in every existing story and in the `Table` used by
   * `a11y.test.tsx`'s fixture, both of which fit without overflowing: an
   * unlabelled `role="region"` is *worse* than no region at all (a
   * landmark with no name is exactly what `axe`'s `region`/`landmark-*`
   * guidance warns against — a screen-reader user gets an extra stop on
   * their landmarks list that tells them nothing). So `role="region"`
   * and `aria-label` only ever appear together, and only once the
   * wrapper is confirmed scrollable; a scrollable-but-unlabelled wrapper
   * is still made keyboard-focusable (`tabIndex={0}`) but stays a
   * roleless `<div>` rather than a landmark nobody can identify, and a
   * wrapper that isn't scrollable gets neither.
   */
  label?: string | undefined;
}

/**
 * Whether `tabIndex`/`role="region"` apply at all is **measured, not
 * guessed from props**. The wrapper below is unconditionally
 * `overflow-x-auto`, so it *can* be horizontally scrollable purely from
 * table content being wider than its container — nothing about `Table`'s
 * own props determines that, since it depends on the caller's columns
 * and data. `maxHeight` doesn't determine vertical scrolling either, only
 * bounds it: a `maxHeight` shorter than the actual row count overflows,
 * a generous one doesn't. Gating on "was `maxHeight` passed" would
 * therefore both miss the horizontal case entirely (the one the
 * `scrollable-region-focusable` bug report was actually about) and
 * mislabel a bounded-but-short table as scrollable when it isn't. So this
 * measures the real thing — `scrollWidth`/`scrollHeight` against
 * `clientWidth`/`clientHeight`, on mount and on every resize — and only
 * a wrapper that is *actually* overflowing right now becomes a focusable
 * region. An unconditional `tabIndex={0}` on every `Table` in the app,
 * including every one that already fits, would add a tab stop nobody
 * needs to the common case to fix the uncommon one.
 *
 * `ResizeObserver` is unavailable in the `jsdom` environment
 * `a11y.test.tsx` mounts components in — guarded rather than polyfilled,
 * since jsdom's own layout is always zero anyway (`scrollWidth ===
 * clientWidth === 0`), so "not scrollable" is the correct answer there
 * regardless.
 */
function useScrollable(): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el === null || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      setScrollable(el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, scrollable];
}

export function Table({ className, maxHeight, label, ...props }: TableProps) {
  const [ref, scrollable] = useScrollable();
  const style = maxHeight ? { maxHeight, overflowY: "auto" as const } : undefined;
  const table = (
    <table
      className={cn("table table-pin-rows w-full border-collapse! text-body", className)}
      {...props}
    />
  );

  // `focus-visible:ring-1 focus-visible:ring-ring`: the same idiom
  // `calendar.tsx`'s `day_button` uses for a focusable non-form element —
  // a `tabIndex` with no visible focus state would trade one barrier
  // (unreachable by keyboard) for another (reachable, but invisible).
  const focusRing = "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  // Two literal JSX branches, not one element with `role={... ? "region"
  // : undefined}`: `aria-label` is only a valid attribute on an element
  // whose *role* supports naming, and a conditional `role` expression
  // isn't something the static, role-aware linter
  // (`lint/a11y/useAriaPropsSupportedByRole`) can resolve — it flagged
  // the div as if `role` were always absent. Each branch below is
  // internally consistent (one has both `role="region"` and
  // `aria-label`, literally; the other has neither), which is what the
  // rule can actually verify, and is also the correct semantics — see
  // the `label` prop doc above for why an unnamed region is deliberately
  // left roleless rather than given `role="region"` with no name.
  if (scrollable && label) {
    return (
      // biome-ignore lint/a11y/useSemanticElements: this has to be the `overflow-x-auto` box itself — swapping it for a bare `<section>` would rename the element the rule is complaining about, not change what it's reachable through.
      <div
        ref={ref}
        className={cn("w-full overflow-x-auto", focusRing)}
        style={style}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: axe's own `scrollable-region-focusable` rule (and WCAG 2.1.1) requires this — a scrolling container a keyboard user can't reach into is a real barrier, not a false positive here. Applied only once `scrollable` measures true (see `useScrollable`'s doc above), so a table that fits gets no extra tab stop.
        tabIndex={0}
        role="region"
        aria-label={label}
      >
        {table}
      </div>
    );
  }
  return (
    // Unlike the branch above, `tabIndex` here is a conditional
    // expression (`scrollable ? 0 : undefined`) rather than a literal
    // `0`, which is why `lint/a11y/noNoninteractiveTabindex` — suppressed
    // by name in the branch above, for the identical reason — doesn't
    // fire on this one at all: verified empirically, not assumed, since
    // a stale suppression here that no longer matches anything is a
    // biome error in its own right (`suppressions/unused`).
    <div
      ref={ref}
      className={cn("w-full overflow-x-auto", scrollable && focusRing)}
      style={style}
      tabIndex={scrollable ? 0 : undefined}
    >
      {table}
    </div>
  );
}

/**
 * `sticky top-0` **requires `Table`'s `maxHeight` prop.** Without it, the
 * wrapper `Table` renders (`overflow-x-auto`, computed `overflow-y: auto`
 * per CSS Overflow) is already the nearest scroll container — sticky
 * positioning always measures against *some* ancestor, and this one wins
 * by proximity — but at its default `height: auto` it never actually
 * overflows vertically, so it never scrolls. Whatever real scrolling
 * happens (the page, or an app-level container) happens on an ancestor
 * *further out*, and this header just travels along with the rest of the
 * wrapper as that outer thing scrolls — indistinguishable from `sticky`
 * never having been applied at all. `maxHeight` bounds the wrapper itself
 * so it is both the nearest scroll container *and* the one that actually
 * scrolls, which is what `position: sticky` needs to do anything. See
 * `table.stories.tsx`'s two sticky-header stories for both cases measured
 * live.
 */
export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "sticky top-0 z-10 bg-surface-1 [&_tr]:border-b [&_tr]:border-edge [&_tr]:bg-surface-1",
        className,
      )}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-b-0", className)} {...props} />;
}

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
}

export function TableRow({ className, selected = false, ...props }: TableRowProps) {
  return (
    <tr
      className={cn(
        "border-edge-subtle border-b transition-colors duration-[var(--dur-instant)] hover:bg-surface-3",
        selected && "bg-surface-3 shadow-[inset_2px_0_0_var(--color-ring)]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Responsive column visibility. `hideBelow="md"` hides the cell on
 * viewports narrower than `md` and shows it from `md` up.
 *
 * This exists because the class it replaces was the single
 * most-duplicated string in the console: `"hidden sm:table-cell"`,
 * `"hidden md:table-cell"` and `"hidden lg:table-cell"` appeared **90
 * times** as inline literals across the route-local table components.
 *
 * Worth recording how they got there, because it is a lesson about the
 * rule and not just about tables. R6's own text names
 * `const COL_ID = "hidden lg:table-cell"` in `jobs-screen.tsx` — four
 * hoisted consts — as the motivating example of a class const that must
 * not live in a view. The R6 sweep removed those four consts and, in
 * moving the markup into dumb components, re-expressed the same decision
 * as 90 inline literals. The letter of the rule was satisfied (no classes
 * in a *view* file); the thing the rule exists to prevent — one decision
 * written in many places — got 22× worse.
 *
 * A mapping table rather than an interpolated `` `hidden ${bp}:table-cell` ``
 * because Tailwind scans source text statically: a template literal
 * produces no class at all in the built CSS. The full strings must appear
 * verbatim somewhere Tailwind can see them, and this is that place.
 */
const HIDE_BELOW: Record<Breakpoint, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

export type Breakpoint = "sm" | "md" | "lg" | "xl";

export interface TableHeadProps extends Omit<ThHTMLAttributes<HTMLTableCellElement>, "align"> {
  align?: "start" | "end";
  /** Hide this column below the given breakpoint. See `HIDE_BELOW`. */
  hideBelow?: Breakpoint | undefined;
}

export function TableHead({ className, align = "start", hideBelow, ...props }: TableHeadProps) {
  return (
    <th
      className={cn(
        "h-8 whitespace-nowrap px-3 font-medium text-micro text-muted-foreground tracking-[0.03em]",
        align === "end" ? "text-right" : "text-left",
        hideBelow && HIDE_BELOW[hideBelow],
        className,
      )}
      {...props}
    />
  );
}

export interface TableCellProps extends Omit<TdHTMLAttributes<HTMLTableCellElement>, "align"> {
  align?: "start" | "end";
  mono?: boolean;
  /** Hide this column below the given breakpoint. See `HIDE_BELOW`. */
  hideBelow?: Breakpoint | undefined;
}

export function TableCell({
  className,
  align = "start",
  mono = false,
  hideBelow,
  ...props
}: TableCellProps) {
  return (
    <td
      className={cn(
        "px-3 py-2 text-body",
        align === "end" ? "text-right" : "text-left",
        mono && "font-mono tabular-nums",
        hideBelow && HIDE_BELOW[hideBelow],
        className,
      )}
      {...props}
    />
  );
}
