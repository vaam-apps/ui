"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type DayPickerProps } from "react-day-picker";
import { cn } from "../../lib/cn";

export type CalendarProps = DayPickerProps & { className?: string | undefined };

/**
 * The month-navigation arrows: M3's icon button — a 40dp circle with a
 * 24dp icon (`SmallIconButtonTokens`: `ContainerHeight`, `IconSize`,
 * `CornerFull`) in a 48dp touch target (`RecommendedSizeForAccessibility`,
 * `DatePicker.kt`), dimmed to 38% when unavailable
 * (`StandardIconButtonTokens.DisabledOpacity`) — grouped at the end of the
 * 56dp month row, as `MonthsNavigation` lays them out.
 *
 * In flow inside `nav`, so the in-flow `.tap-target`: at comfortable
 * density its margin spaces the pair 48px centre to centre, and its cover
 * is that reservation exactly, so the two targets meet without
 * overlapping (`theme.css`, D11). The `nav` itself is absolutely placed at
 * the top of the calendar, 12px from its end (`DatePickerHorizontalPadding`)
 * — over the caption row of the last month when two sit side by side;
 * `e2e/tap-targets.spec.ts` asserts both covers stay inside the panel.
 *
 * `aria-disabled:`, not `disabled:`: react-day-picker marks an unavailable
 * month with `aria-disabled` and `tabIndex={-1}` and never sets
 * `disabled`, so the previous `disabled:` styling matched nothing — at
 * `min` or `max` the arrow looked live and did nothing (read off
 * `components/Nav.js`, then seen in a render).
 */
const NAV_BUTTON = cn(
  "relative inline-flex size-10 items-center justify-center rounded-full",
  "text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground",
  "aria-disabled:pointer-events-none aria-disabled:opacity-38",
  "[--tap-size:40px] tap-target",
);

/**
 * The in-range band behind a range: M3's
 * `RangeSelectionActiveIndicatorContainer`, 40dp tall across the 48dp
 * row, on the cell rather than the button so consecutive days meet with
 * no gap. At either end it covers only the half toward the interior, so
 * the band runs into the end's filled circle; a range that starts and
 * ends on one day sets both halves and draws none. Two custom properties
 * rather than two `left-*` utilities because a one-day range carries both
 * classes, and two utilities setting `left` is a cascade coin-flip.
 *
 * M3 fills it with `SecondaryContainer`. This palette has one achromatic
 * accent and no secondary container (`theme.css` §1.3), so the band is a
 * 15% wash of the selection colour, which is also what it means.
 */
const RANGE_BAND =
  "before:absolute before:inset-y-1 before:left-[var(--band-start,0px)] before:right-[var(--band-end,0px)] before:bg-primary/15";

/**
 * `react-day-picker`, themed with this design system's own tokens.
 *
 * # Why the whole `classNames` map is spelled out
 *
 * `react-day-picker` ships a stylesheet (`react-day-picker/style.css`)
 * built on its own `--rdp-*` variables. Importing it would put a second,
 * independent theme in the page whose colours are set from somewhere
 * other than `theme.css` — so the first time anyone changed a surface
 * colour, the calendar would not follow, and the mismatch would be
 * invisible until someone opened a date picker.
 *
 * The stylesheet is therefore **not** imported, and every element gets a
 * class from the tokens here instead. That is more code than a handful of
 * overrides, and it is the point: there is exactly one place this
 * component's colours come from, and it is the same place every other
 * component's come from.
 *
 * # `selected` without `onSelect` is not a binding
 *
 * This component is a thin pass-through, so react-day-picker's own
 * control semantics apply unchanged: given `selected` but no `onSelect`,
 * it manages selection internally and treats `selected` as an initial
 * value. A caller who expects a controlled component gets one that
 * silently diverges from its own prop the first time someone clicks a
 * day — found exactly that way, in a gallery demo. Pass both, or neither.
 *
 * # Layout is deliberately not themed away
 *
 * The grid itself is a `<table>` and needs `border-collapse` plus fixed
 * cell sizing to stay square; those are structural, not thematic, and
 * live here rather than in a token.
 */
export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("relative px-3 pb-2", className)}
      classNames={{
        root: "text-body text-foreground",
        // Side by side from `md`: two 336px months, their gap and the
        // panel's padding and border are 714px wide (measured, the docked
        // range), which a 640px window does not have.
        months: "flex flex-col gap-4 md:flex-row",
        // Seven 48dp columns, 336dp, and no wider than the container: a
        // table sizes itself from its columns' minimums, so without a width
        // here every column settled at `min-w-10` and the grid came out
        // 40px a day (measured: a 306px docked panel for M3's 360).
        month: "flex w-84 max-w-full flex-col",
        // M3's month row (`MonthYearHeight`, 56dp): the month and year at
        // the start in `LabelLarge`, the arrows at the end. M3's label is
        // a menu button opening a year grid; this one is text — a library
        // choice, with `min`/`max` bounding the arrows instead.
        month_caption: "flex h-14 items-center ps-3",
        caption_label: "font-medium text-prose text-muted-foreground",
        nav: "absolute top-0 right-3 flex h-14 items-center",
        button_previous: NAV_BUTTON,
        button_next: NAV_BUTTON,
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        // M3's rows are 48dp (`RecommendedSizeForAccessibility`) and seven
        // 48dp columns fill the modal's 336dp between its 12dp paddings.
        // A column may shrink to the 40dp date it holds (`basis-12
        // min-w-10`) so the grid still fits a 360px modal inset from a
        // 375px phone's edges. Weekdays and dates are `BodyLarge` (16/24),
        // `OnSurface`.
        weekday:
          "flex h-12 min-w-10 basis-12 items-center justify-center font-normal text-title-sm text-foreground",
        week: "flex",
        // Selection state lives on the CELL, not on the button inside it.
        // Read off the real DOM, not guessed: react-day-picker puts
        // `aria-selected` and `data-selected` on the `<td>` and leaves the
        // `<button>` carrying only `type`/`tabindex`/`aria-label`. An
        // earlier revision of this file styled the button with
        // `aria-selected:bg-primary` and the cell with
        // `[&:has([data-range-middle])]`, and BOTH silently matched
        // nothing — no selected day had a fill and no range had a tint.
        // Neither `tsc` nor the classNames-key test could see it: the keys
        // were all real, and the class strings were valid CSS for a DOM
        // shape that does not exist. Found by rendering it.
        day: "relative h-12 min-w-10 basis-12 p-0 text-center",
        // M3's date: a 40dp circle (`DateContainerWidth`/`Height`,
        // `CornerFull`), its state layer the same circle. The digits stay
        // mono — a date is an emitted fact here as everywhere else in the
        // library (the type voices, `theme.css`) — at M3's 16px.
        // `relative` so it paints above the cell's range band.
        day_button: cn(
          "relative mx-auto flex size-10 items-center justify-center rounded-full font-mono text-title-sm tabular-nums",
          "text-foreground transition-colors hover:bg-surface-3",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        ),
        // Fills the button from the cell's own state, which is where the
        // state actually is: `DateSelectedContainerColor` `Primary`,
        // `DateSelectedLabelTextColor` `OnPrimary`. Covers single mode
        // outright and both ends of a range; `range_middle` below
        // overrides it for the interior.
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-content [&>button]:hover:bg-primary",
        // M3's today: a 1dp `Primary` ring and a `Primary` label
        // (`DateTodayContainerOutline*`, `DateTodayLabelTextColor`). Not a
        // status hue — "today" is a calendar fact, and `Primary` here is
        // the palette's one achromatic accent — so it stays inside the
        // colour rule (`radio-group.tsx` documents the same category error
        // for selection). The label colour skips a selected today, where
        // `Primary` on the `Primary` fill would erase the digit; the ring
        // stays and is simply invisible against the fill, as in M3.
        today:
          "[&>button]:border [&>button]:border-primary [&:not([data-selected])>button]:text-primary",
        outside: "text-subtle-foreground opacity-50",
        // M3 dims a disabled day by `DisabledAlpha` (`DatePicker.kt`'s
        // default colours); 38%, the opacity its icon buttons name.
        disabled: "pointer-events-none opacity-38",
        hidden: "invisible",
        // The interior of a range: the band (`RANGE_BAND`) on the cell,
        // and the button's own fill knocked back out, its label
        // `OnSecondaryContainer` — the foreground. The `!` is load-bearing:
        // a middle day also carries `selected` above, and both rules are
        // arbitrary variants of equal specificity, so without it the
        // winner is whichever class Tailwind emits last.
        //
        // The band was once `bg-state-neutral-bg`, a real token that
        // resolves to `transparent` (`neutral` is the quiet hue and
        // deliberately has no fill), and the interior rendered as nothing.
        range_middle: cn(
          RANGE_BAND,
          "[&>button]:bg-transparent! [&>button]:text-foreground! [&>button]:hover:bg-surface-3!",
        ),
        range_start: cn(RANGE_BAND, "[--band-start:50%]"),
        range_end: cn(RANGE_BAND, "[--band-end:50%]"),
        week_number:
          "flex h-12 min-w-10 basis-12 items-center justify-center font-mono text-caption text-subtle-foreground",
        footer: "pt-2 text-caption text-muted-foreground",
        ...classNames,
      }}
      components={{
        // RDP renders one `Chevron` for both directions and flips it with
        // `orientation`; swapping in two real icons reads better than a
        // CSS rotation and keeps the stroke weight matching every other
        // icon in the system.
        // `disabled` is react-day-picker's hint to the icon, not an SVG
        // attribute; the button carries the state.
        Chevron: ({ orientation, disabled: _disabled, ...iconProps }) =>
          orientation === "left" ? (
            <ChevronLeft size={24} strokeWidth={1.5} {...iconProps} />
          ) : (
            <ChevronRight size={24} strokeWidth={1.5} {...iconProps} />
          ),
      }}
      {...props}
    />
  );
}
