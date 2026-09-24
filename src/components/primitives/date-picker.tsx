"use client";

import { CalendarDays, X } from "lucide-react";
import {
  createContext,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { type DateRange, defaultDateLib, formatWeekdayName } from "react-day-picker";
import { cn } from "../../lib/cn";
import { useDropdownPlacement } from "../../lib/dropdown-placement";
import { omitUndefined } from "../../lib/omit-undefined";
import { flattenParts } from "../../lib/parts";
import { usePopupModality } from "../../lib/popup-modality";
import { notePointerDownUnderOpenSelect } from "../../lib/select-dismissal";
import { Button } from "./button";
import { Calendar } from "./calendar";

export type { DateRange };

/**
 * `2026-09-11` — ISO 8601 calendar date, no time, no zone.
 *
 * Every date this module exchanges with a caller is one of these, not a
 * `Date`. A `Date` is an instant, and an instant rendered in a different
 * zone is a different calendar day — which is how a filter for "today"
 * silently returns yesterday's rows for anyone west of the server. The
 * `Date` objects `react-day-picker` works in are confined to this file.
 */
export type IsoDate = string;

/** `Date` (local midnight) → `YYYY-MM-DD`, without going through UTC. */
export function toIsoDate(date: Date): IsoDate {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * `YYYY-MM-DD` → `Date` at *local* midnight.
 *
 * Deliberately not `new Date("2026-09-11")`, which the spec parses as
 * UTC midnight — in any negative-offset zone that is the previous day,
 * so a calendar built on it highlights the wrong cell.
 */
export function fromIsoDate(iso: IsoDate): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (match === null) return undefined;
  const [, year, month, day] = match as unknown as [string, string, string, string];
  return new Date(Number(year), Number(month) - 1, Number(day));
}

/** Two ISO dates, inclusive at both ends. `undefined` at either end means open. */
export interface IsoDateRange {
  from?: IsoDate | undefined;
  to?: IsoDate | undefined;
}

// ---------------------------------------------------------------------------
// The compound picker.
//
// `DatePicker` and `DateRangePicker` are roots that own the value; every
// visible piece is a part nested inside, as with `Select` (AGENTS.md,
// "Compound components"). The parts are shared: `DatePickerTrigger`,
// `DatePickerValue`, `DatePickerClear`, a container (`DatePickerContent`,
// `DatePickerDropdown` or `DatePickerModal`) and the container's chrome
// (`DatePickerTitle`, `DatePickerCancel`, `DatePickerConfirm`), each with a
// default so a caller rarely writes it.
//
// # A pick is staged, then confirmed
//
// M3's modal date picker commits on OK and throws the pick away on Cancel
// (`DatePickerDialog`, `DatePickerSamples.kt`: OK enabled once a date is
// selected); its full-screen range picker commits on Save. This picker
// does the same at every width, the dropdown included — a maintainer's
// call, so the phone and the desktop differ in CSS alone: behaviour that
// changed with the breakpoint would need the width read in JS, which this
// library does not do (D12, `drawer.tsx`). Tapping a day only moves the
// draft; the value changes on OK.
// ---------------------------------------------------------------------------

type PickerMode = "single" | "range";
type PickerValue = IsoDate | IsoDateRange | undefined;
type PickerPresentation = "dropdown" | "auto" | "modal";

interface PickerContextValue {
  mode: PickerMode;
  /** The committed value — what the trigger shows. */
  value: PickerValue;
  /** The pick in progress while the picker is open. */
  draft: PickerValue;
  setDraft: (next: PickerValue) => void;
  open: boolean;
  openPicker: () => void;
  closePicker: (commit: boolean) => void;
  clear: () => void;
  min: IsoDate | undefined;
  max: IsoDate | undefined;
  disabled: boolean | undefined;
  invalid: boolean | undefined;
  describedBy: string | undefined;
  triggerRef: RefObject<HTMLButtonElement | null>;
  valueId: string;
  surfaceId: string;
  titleId: string;
}

const PickerContext = createContext<PickerContextValue | null>(null);

function usePicker(component: string): PickerContextValue {
  const context = useContext(PickerContext);
  if (context === null) {
    throw new Error(`<${component} /> must be rendered inside <DatePicker> or <DateRangePicker>.`);
  }
  return context;
}

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function hasDate(value: PickerValue): boolean {
  if (value === undefined || value === "") return false;
  if (typeof value === "string") return true;
  return value.from !== undefined || value.to !== undefined;
}

/** A half-finished range is a value (`from` set, `to` open) — never `{}`. */
function normalised(value: PickerValue): PickerValue {
  return hasDate(value) ? value : undefined;
}

interface PickerRootProps {
  mode: PickerMode;
  value: PickerValue;
  onValueChange: (value: PickerValue) => void;
  min: IsoDate | undefined;
  max: IsoDate | undefined;
  disabled: boolean | undefined;
  invalid: boolean | undefined;
  describedBy: string | undefined;
  children: ReactNode;
}

function PickerRoot({
  mode,
  value,
  onValueChange,
  min,
  max,
  disabled,
  invalid,
  describedBy,
  children,
}: PickerRootProps) {
  const [open, setOpen] = useState(false);
  // The pick in progress, or `null` until the operator picks: until then
  // the draft *is* the value, so a value the caller changes while the
  // picker is open shows in it, and OK with no pick commits that value —
  // not the one the picker opened on (found in review: OK wrote back the
  // stale date over a value changed from outside).
  const [pick, setPick] = useState<{ value: PickerValue } | null>(null);
  const draft = pick === null ? value : pick.value;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const id = useId();

  const context: PickerContextValue = {
    mode,
    value,
    draft,
    setDraft: (next) => setPick({ value: next }),
    open,
    openPicker: () => {
      if (disabled === true) return;
      setPick(null);
      setOpen(true);
    },
    closePicker: (commit) => {
      if (commit) onValueChange(normalised(draft));
      setOpen(false);
      // Back to the trigger, as a menu or a listbox returns focus. Without
      // `preventScroll`, focusing a trigger scrolled out of a drawer's body
      // would scroll the body back to it.
      triggerRef.current?.focus({ preventScroll: true });
    },
    clear: () => onValueChange(undefined),
    min,
    max,
    disabled,
    invalid,
    describedBy,
    triggerRef,
    valueId: `${id}-value`,
    surfaceId: `${id}-picker`,
    titleId: `${id}-title`,
  };
  return <PickerContext.Provider value={context}>{children}</PickerContext.Provider>;
}

/**
 * Note the `| undefined` on the optional props: this package compiles under
 * `exactOptionalPropertyTypes`, so `useState<IsoDate>()` → `value={v}`
 * would otherwise be a type error (`Select` has the same rule).
 */
export interface DatePickerProps {
  value: IsoDate | undefined;
  onValueChange: (value: IsoDate | undefined) => void;
  /** Earliest selectable date, inclusive. Days before it are disabled. */
  min?: IsoDate | undefined;
  /** Latest selectable date, inclusive. Days after it are disabled. */
  max?: IsoDate | undefined;
  disabled?: boolean | undefined;
  /** Forwarded to the trigger. `FormField` associates a control with its
   * hint and error by cloning its direct child with these two; that child
   * is this root, and the element that must carry them is the trigger. */
  "aria-describedby"?: string | undefined;
  "aria-invalid"?: boolean | undefined;
  children: ReactNode;
}

/** One calendar date. The root owns the value; the parts are nested inside. */
export function DatePicker({
  value,
  onValueChange,
  min,
  max,
  disabled,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  children,
}: DatePickerProps) {
  return (
    <PickerRoot
      mode="single"
      value={value}
      onValueChange={(next) => onValueChange(typeof next === "string" ? next : undefined)}
      min={min}
      max={max}
      disabled={disabled}
      invalid={invalid}
      describedBy={describedBy}
    >
      {children}
    </PickerRoot>
  );
}

export interface DateRangePickerProps {
  value: IsoDateRange | undefined;
  onValueChange: (value: IsoDateRange | undefined) => void;
  min?: IsoDate | undefined;
  max?: IsoDate | undefined;
  disabled?: boolean | undefined;
  "aria-describedby"?: string | undefined;
  "aria-invalid"?: boolean | undefined;
  children: ReactNode;
}

/**
 * A start and end date as one control.
 *
 * Exists because the alternative — two `<input type="date">` side by side —
 * is what applications actually ship, and it cannot express the one thing
 * a range needs: that the two ends constrain each other. Here the taps
 * follow M3's rule — the first starts the range, a tap on or after the
 * start ends it, and a tap before it or on a whole range starts again — the
 * fill between the ends is visible, and a half-finished range is a value
 * (`from` set, `to` open) rather than a validation error. Save is enabled
 * once the start is set, and one tap then Save commits an open end, where
 * M3's sample waits for both: a library choice, for open-ended filters.
 */
export function DateRangePicker({
  value,
  onValueChange,
  min,
  max,
  disabled,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  children,
}: DateRangePickerProps) {
  return (
    <PickerRoot
      mode="range"
      value={value}
      onValueChange={(next) => onValueChange(typeof next === "object" ? next : undefined)}
      min={min}
      max={max}
      disabled={disabled}
      invalid={invalid}
      describedBy={describedBy}
    >
      {children}
    </PickerRoot>
  );
}

// ---------------------------------------------------------------------------
// The trigger.
// ---------------------------------------------------------------------------

/**
 * The field-looking button that opens the picker.
 *
 * A `<button>`, not an `<input>`: the value is chosen, not typed, and a
 * text input that looks editable but is not is worse than a button that
 * looks like a field. For typed entry, a plain `<Input type="date">` is the
 * browser's own and better than anything worth reimplementing here.
 *
 * Its accessible name is its label — a `FormField`'s `<label for>`, or
 * `aria-label` — and then the date it shows is added to its description,
 * so a screen-reader user hears "Send on, button, 2026-09-11". With no
 * label, the name is the shown text itself. The previous picker rendered
 * the placeholder a second time in a visually hidden span, and vpay found
 * its trigger announced as "Created between Created between" while empty.
 *
 * `DatePickerClear` written among its children is lifted out of the button
 * — a button inside a button is invalid, and browsers resolve it by
 * hoisting the inner one out and detaching its handler — and rendered
 * beside it, over the field's right end.
 */
export function DatePickerTrigger({
  id,
  className,
  children,
  "aria-label": ariaLabel,
}: {
  id?: string | undefined;
  className?: string | undefined;
  children: ReactNode;
  /** A name for a picker used outside a `FormField`. */
  "aria-label"?: string | undefined;
}) {
  const picker = usePicker("DatePickerTrigger");
  const parts = flattenParts(children);
  const clear = parts.find((part) => isValidElement(part) && part.type === DatePickerClear);
  const content = parts.filter((part) => part !== clear);
  const showClear = clear !== undefined && hasDate(picker.value) && picker.disabled !== true;

  // Named by something other than its own text? Then the shown date goes
  // into the description. Read after mount: `labels` is the DOM's answer to
  // "does a `<label for>` point here", which the render cannot know.
  const [labelled, setLabelled] = useState(ariaLabel !== undefined);
  useIsomorphicLayoutEffect(() => {
    const labels = picker.triggerRef.current?.labels;
    setLabelled(
      ariaLabel !== undefined || (labels !== undefined && labels !== null && labels.length > 0),
    );
  }, [ariaLabel, picker.triggerRef]);
  const describedBy =
    [labelled ? picker.valueId : undefined, picker.describedBy].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={cn("relative inline-flex w-full items-center", className)}>
      <button
        ref={picker.triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={picker.open}
        onClick={() => (picker.open ? picker.closePicker(false) : picker.openPicker())}
        {...omitUndefined({
          id,
          "aria-label": ariaLabel,
          "aria-controls": picker.open ? picker.surfaceId : undefined,
          "aria-describedby": describedBy,
          "aria-invalid": picker.invalid,
          disabled: picker.disabled,
        })}
        className={cn(
          "input flex w-full items-center gap-2 text-left font-sans text-prose",
          "aria-invalid:border-state-danger-border aria-invalid:text-state-danger-fg",
          "disabled:cursor-not-allowed disabled:opacity-50",
          // D11: the gutter the Clear button's *tap target* needs, not the
          // one its 14px box needs — 36px compact, 48px comfortable, where
          // that target's inner edge lands once clamped flush to the
          // field's right edge (`theme.css`'s `.tap-target-anchored`).
          showClear && "pr-[calc(2.25rem+var(--density,0)*0.75rem)]",
        )}
      >
        <CalendarDays size={14} strokeWidth={1.5} className="shrink-0 text-subtle-foreground" />
        {content}
      </button>
      {showClear && clear}
    </div>
  );
}

/**
 * The date the trigger shows: `YYYY-MM-DD` in mono, or `from → to`, or the
 * placeholder while empty. An emitted fact, so upright and mono (the type
 * voices, `theme.css`).
 *
 * `min-w-0 flex-1` with `truncate`: the trigger is a flex row, and a flex
 * item's default `min-width: auto` refuses to shrink below the text, so a
 * long label spilled past the field's border instead of ellipsizing.
 */
export function DatePickerValue({ placeholder }: { placeholder?: string | undefined }) {
  const picker = usePicker("DatePickerValue");
  const empty = !hasDate(picker.value);
  return (
    <span
      id={picker.valueId}
      className={cn(
        "min-w-0 flex-1 truncate font-mono tabular-nums",
        empty && "font-sans text-subtle-foreground",
      )}
    >
      {empty ? (placeholder ?? "") : label(picker.value)}
    </span>
  );
}

function label(value: PickerValue): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  if (value.from !== undefined && value.to !== undefined) return `${value.from} → ${value.to}`;
  if (value.from !== undefined) return `${value.from} → …`;
  if (value.to !== undefined) return `… → ${value.to}`;
  return "";
}

/**
 * Clears the value at once — no picker, no OK — shown over the trigger's
 * right end while there is a value. Write it inside `DatePickerTrigger`;
 * leave it out for a date that must always be set. Named "Clear the date"
 * or "Clear the dates" by default, by mode, as the title and OK are.
 *
 * D11 (`theme.css`, `.tap-target`): the 14px icon's cover has to be
 * **clamped** — 8px from the field's right edge, a symmetric 48px cover
 * would end 9px outside the field, grow `document.scrollWidth` and take the
 * field's own rightmost 39px, so tapping the right end of a date field
 * cleared it instead of opening the picker (`elementFromPoint` returned
 * this button from x≈236 to 272 of a trigger ending at 272, measured).
 * `--tap-room-right:8px` stops the cover flush with the field's edge and
 * grows it inward instead; `e2e/tap-targets.spec.ts` asserts the
 * containment.
 */
export function DatePickerClear({
  "aria-label": ariaLabel,
}: {
  "aria-label"?: string | undefined;
}) {
  const picker = usePicker("DatePickerClear");
  return (
    <button
      type="button"
      onClick={picker.clear}
      aria-label={ariaLabel ?? (picker.mode === "single" ? "Clear the date" : "Clear the dates")}
      className="-translate-y-1/2 absolute top-1/2 right-2 text-subtle-foreground hover:text-foreground [--tap-room-right:8px] [--tap-size:14px] tap-target-anchored"
    >
      <X size={14} strokeWidth={1.5} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// The chrome: title, Cancel, OK, and the full-screen picker's close icon.
// Public parts with defaults — write one to relabel it; the container lifts
// it into its place.
// ---------------------------------------------------------------------------

/** The picker's heading, and its accessible name: "Select date" or "Select
 * dates" by default. Shown in a header where there is one — a date's modal,
 * and the full-screen range picker below `sm`. The docked picker, and a
 * range's modal from `sm` up (two months, no header), are still named by
 * it without showing it. */
export function DatePickerTitle({ children }: { children?: ReactNode }) {
  const picker = usePicker("DatePickerTitle");
  return (
    <span id={picker.titleId}>
      {children ?? (picker.mode === "single" ? "Select date" : "Select dates")}
    </span>
  );
}

/** Closes the picker and throws the pick away. "Cancel" by default. */
export function DatePickerCancel({ children }: { children?: ReactNode }) {
  const picker = usePicker("DatePickerCancel");
  return (
    <Button type="button" variant="ghost" size="sm" onClick={() => picker.closePicker(false)}>
      {children ?? "Cancel"}
    </Button>
  );
}

/**
 * The full-screen range picker's close icon, leading its bar: closes and
 * throws the pick away, as Cancel does where there is no bar. An X named
 * "Close" by default; write one to rename it (`aria-label`) or to replace
 * the icon with text (`children`). Only the full-screen picker has a bar,
 * so anywhere else a written one is not shown.
 */
export function DatePickerClose({
  children,
  "aria-label": ariaLabel = "Close",
}: {
  children?: ReactNode;
  "aria-label"?: string | undefined;
}) {
  const picker = usePicker("DatePickerClose");
  return (
    <button
      type="button"
      {...omitUndefined({ "aria-label": children == null ? ariaLabel : undefined })}
      onClick={() => picker.closePicker(false)}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-foreground hover:bg-foreground/8",
        children == null ? "size-12" : "h-10 px-3 font-medium text-prose",
      )}
    >
      {children ?? <X aria-hidden="true" className="size-6" strokeWidth={1.5} />}
    </button>
  );
}

/** Commits the pick and closes. "OK" for a date and "Save" for a range by
 * default — M3's own labels — enabled once there is something to commit.
 * A text button, like Cancel, as in M3's samples (`DatePickerSamples.kt`:
 * both `TextButton`s, OK `enabled` once a date is picked). */
export function DatePickerConfirm({ children }: { children?: ReactNode }) {
  const picker = usePicker("DatePickerConfirm");
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={!hasDate(picker.draft)}
      onClick={() => picker.closePicker(true)}
    >
      {children ?? (picker.mode === "single" ? "OK" : "Save")}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// The containers.
// ---------------------------------------------------------------------------

/**
 * The picker, docked under its trigger from `sm` up and M3's modal below:
 * a centred 360px dialog for a date, M3's full-screen range picker for a
 * range. Use this by default. Chosen by CSS media query, like
 * `SelectContent`.
 */
export function DatePickerContent({
  className,
  children,
}: {
  className?: string | undefined;
  children?: ReactNode;
}) {
  return (
    <PickerSurface presentation="auto" className={className} component="DatePickerContent">
      {children}
    </PickerSurface>
  );
}

/** Docked under its trigger at every width, phones included — the opt-out,
 * for a picker inline in a dense row. */
export function DatePickerDropdown({
  className,
  children,
}: {
  className?: string | undefined;
  children?: ReactNode;
}) {
  return (
    <PickerSurface presentation="dropdown" className={className} component="DatePickerDropdown">
      {children}
    </PickerSurface>
  );
}

/** M3's modal at every width: centred with a scrim from `sm` up, and below
 * `sm` the 360px dialog for a date or the full-screen range picker. */
export function DatePickerModal({
  className,
  children,
}: {
  className?: string | undefined;
  children?: ReactNode;
}) {
  return (
    <PickerSurface presentation="modal" className={className} component="DatePickerModal">
      {children}
    </PickerSurface>
  );
}

/**
 * M3's date picker sizes (`DatePickerModalTokens.kt`): the modal is 360dp
 * wide (`ContainerWidth`) with `CornerExtraLarge` corners (28dp, the
 * sheets' and dialogs' `--radius-sheet`) on `SurfaceContainerHigh`
 * (`surface-3`, with `surface-raised` so the day fills inside keep their
 * meaning — AGENTS.md); its header is 120dp tall (`HeaderContainerHeight`).
 * The docked picker is this library's dropdown material and placement
 * (`useDropdownPlacement`, as `SelectContent`'s dropdown), in
 * `surface-3` too, since M3 fills both with the same container colour.
 *
 * The full-screen range picker below `sm` is `DialogFullScreen`'s shape:
 * the page's own ground, a 64dp bar leading with a close icon and carrying
 * Save, the header, then the months stacked to scroll through.
 */
const DOCKED =
  "fixed top-(--select-float-y) left-(--select-float-x) z-50 max-h-(--select-float-max-h) overflow-y-auto rounded-md border border-edge bg-surface-3 surface-raised shadow-[var(--shadow-popover)] outline-none";

/*
 * The modal and full-screen layouts are laid out against the window, and
 * `fixed` alone does not promise that: inside a vaul drawer
 * (`will-change: transform`, AGENTS.md's trap) `inset-0` is the drawer's
 * box. Measured before this: in a bottom-sheet drawer on a 375px phone, the
 * "centred" modal centred on the drawer and put OK 400px below the bottom
 * of the window. `useWindowInsets` measures where `fixed` really resolves
 * and writes the four insets that make it the window again; they default
 * to 0, which is `inset-0` wherever `fixed` already means the window.
 */
const MODAL_SINGLE =
  "fixed top-[var(--picker-inset-top,0px)] right-[var(--picker-inset-right,0px)] bottom-[var(--picker-inset-bottom,0px)] left-[var(--picker-inset-left,0px)] z-50 m-auto h-fit max-h-[calc(100dvh-2rem)] w-[min(360px,calc(100vw-2rem))] overflow-y-auto rounded-sheet bg-surface-3 surface-raised shadow-[0_0_0_100vmax_var(--scrim)] outline-none";

const SURFACE: Record<PickerMode, Record<PickerPresentation, string>> = {
  single: {
    dropdown: cn(
      DOCKED,
      "data-reference-hidden:pointer-events-none data-reference-hidden:opacity-0",
    ),
    auto: cn(
      DOCKED,
      "sm:data-reference-hidden:pointer-events-none sm:data-reference-hidden:opacity-0",
      "max-sm:top-[var(--picker-inset-top,0px)] max-sm:right-[var(--picker-inset-right,0px)] max-sm:bottom-[var(--picker-inset-bottom,0px)] max-sm:left-[var(--picker-inset-left,0px)]",
      "max-sm:m-auto max-sm:h-fit max-sm:max-h-[calc(100dvh-2rem)] max-sm:w-[min(360px,calc(100vw-2rem))]",
      "max-sm:rounded-sheet max-sm:border-0 max-sm:shadow-[0_0_0_100vmax_var(--scrim)]",
    ),
    modal: MODAL_SINGLE,
  },
  range: {
    dropdown: cn(
      DOCKED,
      "data-reference-hidden:pointer-events-none data-reference-hidden:opacity-0",
    ),
    auto: cn(
      "fixed top-(--select-float-y) left-(--select-float-x) z-50 max-h-(--select-float-max-h) overflow-y-auto rounded-md border border-edge bg-surface-3 shadow-[var(--shadow-popover)] outline-none",
      "sm:surface-raised sm:data-reference-hidden:pointer-events-none sm:data-reference-hidden:opacity-0",
      "max-sm:top-[var(--picker-inset-top,0px)] max-sm:right-[var(--picker-inset-right,0px)] max-sm:bottom-[var(--picker-inset-bottom,0px)] max-sm:left-[var(--picker-inset-left,0px)]",
      "max-sm:flex max-sm:max-h-none max-sm:flex-col max-sm:overflow-hidden",
      "max-sm:rounded-none max-sm:border-0 max-sm:bg-base-100 max-sm:pt-[env(safe-area-inset-top,0px)] max-sm:shadow-none",
    ),
    modal: cn(
      "fixed top-[var(--picker-inset-top,0px)] right-[var(--picker-inset-right,0px)] bottom-[var(--picker-inset-bottom,0px)] left-[var(--picker-inset-left,0px)] z-50",
      "m-auto h-fit max-h-[calc(100dvh-2rem)] w-fit overflow-y-auto rounded-sheet bg-surface-3 shadow-[0_0_0_100vmax_var(--scrim)] outline-none",
      "sm:surface-raised",
      "max-sm:m-0 max-sm:flex max-sm:h-auto max-sm:max-h-none max-sm:w-auto max-sm:flex-col max-sm:overflow-hidden",
      "max-sm:rounded-none max-sm:bg-base-100 max-sm:pt-[env(safe-area-inset-top,0px)] max-sm:shadow-none",
    ),
  },
};

/**
 * Where `position: fixed` resolves for the surface, as the four insets that
 * turn it back into the window — written to the surface as
 * `--picker-inset-*` only when they are not all 0.
 *
 * Measured, not derived: a `fixed inset-0` probe beside the surface lands
 * exactly on the containing block, whatever made it one — a transform,
 * `will-change`, `filter`, `contain`, `container-type` — so there is no
 * list of CSS rules here to fall behind the platform. `useDropdownPlacement`
 * (Floating UI) does the same for the docked panel. A layout effect, so the
 * insets land before the first paint, and again on every resize.
 *
 * Only a containing block that is *not* the window gets insets, so the
 * common case keeps a plain `inset: 0` that follows the window live. Where
 * there are insets, they are measured again when `<html>` changes width:
 * the scroll lock (`usePopupModality`, an effect that runs after this one)
 * hides a classic scrollbar, and the first measurement, taken with it,
 * left a modal 7.5px off centre on a page with a 15px scrollbar (found in
 * review). A `ResizeObserver` on `<html>`'s border box sees that before
 * the first paint.
 */
function useWindowInsets(
  active: boolean,
  probeRef: RefObject<HTMLDivElement | null>,
  surfaceRef: RefObject<HTMLDivElement | null>,
) {
  useIsomorphicLayoutEffect(() => {
    const probe = probeRef.current;
    const surface = surfaceRef.current;
    if (!active || probe === null || surface === null) return;
    function measure() {
      if (probe === null || surface === null) return;
      const block = probe.getBoundingClientRect();
      const insets = {
        top: -block.top,
        right: block.right - document.documentElement.clientWidth,
        bottom: block.bottom - window.innerHeight,
        left: -block.left,
      };
      const moved = Object.values(insets).some((inset) => Math.abs(inset) > 0.5);
      for (const [side, inset] of Object.entries(insets)) {
        if (moved) surface.style.setProperty(`--picker-inset-${side}`, `${inset}px`);
        else surface.style.removeProperty(`--picker-inset-${side}`);
      }
    }
    measure();
    window.addEventListener("resize", measure);
    const observer =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    observer?.observe(document.documentElement, { box: "border-box" });
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [active, probeRef, surfaceRef]);
}

/** Where a date's header shows: in its modal (below `sm` for
 * `DatePickerContent`, at every width for `DatePickerModal`), never docked. */
const HEADER: Record<PickerPresentation, string> = {
  dropdown: "hidden",
  auto: "hidden max-sm:flex",
  modal: "flex",
};

/** Months a stacked full-screen range shows either side of the anchor
 * month (the range's start, or today) — a library choice: M3's own list
 * scrolls from 1900 to 2100, lazily, which a static list cannot. `min` and
 * `max` narrow it further. */
const STACKED_MONTHS_EACH_WAY = 12;

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

/** The full-screen range picker's months: `STACKED_MONTHS_EACH_WAY`
 * either side of `from`'s month, with that anchor and both ends kept
 * inside `min`/`max`. */
function stackedWindow(from: Date, min: Date | undefined, max: Date | undefined) {
  const lower = min === undefined ? undefined : addMonths(min, 0);
  const upper = max === undefined ? undefined : addMonths(max, 0);
  let anchor = addMonths(from, 0);
  if (upper !== undefined && anchor > upper) anchor = upper;
  if (lower !== undefined && anchor < lower) anchor = lower;
  let first = addMonths(anchor, -STACKED_MONTHS_EACH_WAY);
  let last = addMonths(anchor, STACKED_MONTHS_EACH_WAY);
  if (lower !== undefined && first < lower) first = lower;
  if (upper !== undefined && last > upper) last = upper;
  const stackedCount = Math.max(1, monthsBetween(first, last) + 1);
  const anchorIndex = Math.max(0, Math.min(stackedCount - 1, monthsBetween(first, anchor)));
  return { first, stackedCount, anchorIndex };
}

/** The chrome parts a container lifts out of its children. */
const CHROME = [DatePickerTitle, DatePickerCancel, DatePickerConfirm, DatePickerClose] as const;

function PickerSurface({
  presentation,
  className,
  children,
  component,
}: {
  presentation: PickerPresentation;
  className: string | undefined;
  children: ReactNode;
  component: string;
}) {
  const picker = usePicker(component);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const probeRef = useRef<HTMLDivElement | null>(null);
  useWindowInsets(presentation !== "dropdown" && picker.open, probeRef, surfaceRef);
  // A calendar is not a list to scroll through: docked, it flips above its
  // trigger whenever its whole height does not fit below — not only, as a
  // select's list does, when less than 200px is left there.
  const placement = useDropdownPlacement(
    presentation !== "modal" && picker.open,
    picker.triggerRef,
    "content",
  );
  usePopupModality(picker.open, surfaceRef, picker.triggerRef);
  useDismissal(picker, surfaceRef);

  if (!picker.open) return null;

  const parts = flattenParts(children);
  const own = (type: (typeof CHROME)[number]) =>
    parts.find((part) => isValidElement(part) && part.type === type) as ReactElement | undefined;
  const title = own(DatePickerTitle) ?? <DatePickerTitle />;
  const cancel = own(DatePickerCancel) ?? <DatePickerCancel />;
  const confirm = own(DatePickerConfirm) ?? <DatePickerConfirm />;
  const close = own(DatePickerClose) ?? <DatePickerClose />;
  const extra = parts.filter(
    (part) => !(isValidElement(part) && (CHROME as readonly unknown[]).includes(part.type)),
  );

  const min = picker.min === undefined ? undefined : fromIsoDate(picker.min);
  const max = picker.max === undefined ? undefined : fromIsoDate(picker.max);
  const outOfRange = [
    ...(min === undefined ? [] : [{ before: min }]),
    ...(max === undefined ? [] : [{ after: max }]),
  ];

  return (
    <>
      {presentation !== "dropdown" && (
        <div
          ref={probeRef}
          aria-hidden="true"
          className="pointer-events-none invisible fixed inset-0"
        />
      )}
      <div
        ref={(element) => {
          surfaceRef.current = element;
          placement.setFloating?.(element);
        }}
        id={picker.surfaceId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={picker.titleId}
        tabIndex={-1}
        data-date-picker=""
        data-date-picker-presentation={presentation}
        data-vaul-no-drag=""
        style={placement.style}
        {...omitUndefined({ "data-reference-hidden": placement.referenceHidden })}
        className={cn(SURFACE[picker.mode][presentation], className)}
      >
        {picker.mode === "single" ? (
          <SinglePicker
            presentation={presentation}
            title={title}
            cancel={cancel}
            confirm={confirm}
            extra={extra}
            outOfRange={outOfRange}
            min={min}
            max={max}
          />
        ) : (
          <RangePicker
            presentation={presentation}
            title={title}
            cancel={cancel}
            confirm={confirm}
            close={close}
            extra={extra}
            outOfRange={outOfRange}
            min={min}
            max={max}
          />
        )}
      </div>
    </>
  );
}

interface PickerBodyProps {
  presentation: PickerPresentation;
  title: ReactNode;
  cancel: ReactNode;
  confirm: ReactNode;
  extra: ReactNode[];
  outOfRange: ({ before: Date } | { after: Date })[];
  min: Date | undefined;
  max: Date | undefined;
}

/**
 * M3's header: the title as supporting text over the pick as the headline,
 * both `OnSurfaceVariant` (`HeaderSupportingTextFont` `LabelLarge`, 14/20
 * medium). A date's headline is `HeadlineLarge` in a 120dp header; a
 * range's is `TitleLarge` in a 128dp one, inset 64dp to clear the bar's
 * close icon (`DateRangePickerTitlePadding`), where a date's sits at 24dp
 * (`DatePickerTitlePadding`). Library choices: the headline is mono, the
 * date being an emitted fact, and a step down each — `text-metric` 28/34
 * for M3's 32/40, `text-title` 20/28 for its 22/28 — this library's scale
 * having no step at M3's sizes.
 */
function PickerHeader({
  title,
  headline,
  range,
  className,
}: {
  title: ReactNode;
  headline: string;
  range: boolean;
  className: string;
}) {
  return (
    <div
      className={cn(
        "flex-col justify-between gap-2 pt-4 pr-3 pb-3",
        range ? "h-[128px] pl-16" : "h-[120px] pl-6",
        className,
      )}
    >
      <span className="font-medium text-muted-foreground text-prose">{title}</span>
      <span
        className={cn(
          "font-mono text-muted-foreground tabular-nums",
          range ? "text-title" : "text-metric",
        )}
      >
        {headline}
      </span>
    </div>
  );
}

/**
 * The weekday initials, once, pinned above the stacked months — M3's
 * full-screen range picker draws one row over its scrolling list rather
 * than one per month. Formatted by react-day-picker's own formatter and
 * date library, so they match the grid's default (en-US, Sunday first).
 * Hidden from assistive technology: each date button already names its
 * full date.
 */
function WeekdayRow() {
  const first = defaultDateLib.startOfWeek(new Date());
  return (
    <div aria-hidden="true" className="mx-auto flex w-full max-w-[360px] shrink-0 px-3">
      {Array.from({ length: 7 }, (_, index) => {
        const day = defaultDateLib.addDays(first, index);
        return (
          <span
            key={day.getDay()}
            className="flex h-12 min-w-10 basis-12 items-center justify-center text-foreground text-title-sm"
          >
            {formatWeekdayName(day)}
          </span>
        );
      })}
    </div>
  );
}

function SinglePicker({
  presentation,
  title,
  cancel,
  confirm,
  extra,
  outOfRange,
  min,
  max,
}: PickerBodyProps) {
  const picker = usePicker("DatePicker");
  const draft = typeof picker.draft === "string" ? picker.draft : undefined;
  const selected = draft === undefined ? undefined : fromIsoDate(draft);
  return (
    <>
      <PickerHeader
        title={title}
        headline={draft ?? "—"}
        range={false}
        className={HEADER[presentation]}
      />
      {/* The header is hidden in the dropdown, but its title still names
          the dialog: `aria-labelledby` reads hidden content. */}
      <Calendar
        mode="single"
        autoFocus
        showOutsideDays={false}
        {...omitUndefined({
          selected,
          defaultMonth: selected,
          startMonth: min,
          endMonth: max,
        })}
        disabled={outOfRange}
        onSelect={(next) => picker.setDraft(next === undefined ? undefined : toIsoDate(next))}
      />
      {extra}
      <div className="flex items-center justify-end gap-2 px-3 pb-3">
        {cancel}
        {confirm}
      </div>
    </>
  );
}

function RangePicker({
  presentation,
  title,
  cancel,
  confirm,
  close,
  extra,
  outOfRange,
  min,
  max,
}: PickerBodyProps & { close: ReactNode }) {
  const picker = usePicker("DateRangePicker");
  const draft = typeof picker.draft === "object" ? picker.draft : undefined;
  const selected: DateRange | undefined =
    draft === undefined
      ? undefined
      : {
          from: draft.from === undefined ? undefined : fromIsoDate(draft.from),
          to: draft.to === undefined ? undefined : fromIsoDate(draft.to),
        };
  // M3's rule, not react-day-picker's (`DateRangePicker.kt`'s selection
  // update): with a start and no end, a tap on or after the start ends the
  // range; any other tap — before the start, or once the range is whole —
  // starts a new one. react-day-picker instead makes the first tap a
  // one-day range and *extends* a whole range from its start, so a single
  // tap and Save committed `d → d` where an open end was meant, and a
  // different start could only be had by clearing first (vpay recorded
  // the latter in its own filter tests). The ISO strings compare in
  // calendar order.
  const onSelect = (_next: DateRange | undefined, day: Date) => {
    const tapped = toIsoDate(day);
    const start = draft?.from;
    picker.setDraft(
      start !== undefined && draft?.to === undefined && tapped >= start
        ? { from: start, to: tapped }
        : { from: tapped, to: undefined },
    );
  };

  // The stacked months: fixed when the picker opens, not re-based on every
  // tap — anchored to the live draft, a tap that moved the start into
  // another month rebuilt all of them and the day jumped 200px from under
  // the finger (measured in review). The anchor is clamped into `min` /
  // `max` first: unclamped, a `max` a year before today left a window of
  // one month with no selectable day in it.
  const [{ first, stackedCount, anchorIndex }] = useState(() =>
    stackedWindow(selected?.from ?? new Date(), min, max),
  );

  // Scroll the stacked list to the anchor month when it is the one shown.
  const stackRef = useRef<HTMLDivElement | null>(null);
  useIsomorphicLayoutEffect(() => {
    const stack = stackRef.current;
    if (stack === null || stack.getClientRects().length === 0) return;
    const months = stack.querySelectorAll<HTMLElement>("[data-picker-month]");
    months[anchorIndex]?.scrollIntoView({ block: "start" });
    // Once, on open (the tree mounts with the surface); the list is the
    // user's to scroll after that.
  }, []);

  const headline = draft === undefined ? "—" : `${draft.from ?? "…"} → ${draft.to ?? "…"}`;
  // Below `sm` (auto, modal): the full-screen tree. From `sm` up, and at
  // every width in the dropdown: the compact tree. Two parallel trees, one
  // hidden by CSS, rather than one whose months change with a JS-read
  // width — `side-nav.tsx`'s precedent, and D12. Both render the same
  // draft; a hidden tree's `autoFocus` finds nothing focusable and does
  // nothing. The title lives in the full-screen header only — hidden from
  // `sm` up, still naming the dialog through `aria-labelledby`.
  const dropdown = presentation === "dropdown";

  return (
    <>
      <div className={cn("flex flex-col", !dropdown && "max-sm:hidden")}>
        <Calendar
          mode="range"
          numberOfMonths={2}
          autoFocus
          showOutsideDays={false}
          {...omitUndefined({
            selected,
            defaultMonth: selected?.from,
            startMonth: min,
            endMonth: max,
          })}
          disabled={outOfRange}
          onSelect={onSelect}
        />
        <div className="flex items-center justify-end gap-2 px-3 pb-3">
          {cancel}
          {confirm}
        </div>
      </div>
      <div className={cn("hidden min-h-0 flex-1 flex-col", !dropdown && "max-sm:flex")}>
        {/* The bar: M3's full-screen range picker (`DateRangePickerSample`)
            — a close icon leading, Save trailing — at `DialogFullScreen`'s
            64dp. */}
        <div className="flex h-16 shrink-0 items-center justify-between pr-1 pl-1">
          {close}
          {confirm}
        </div>
        <PickerHeader title={title} headline={headline} range className="flex shrink-0" />
        <WeekdayRow />
        <div
          ref={stackRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
        >
          <Calendar
            mode="range"
            numberOfMonths={stackedCount}
            autoFocus
            hideNavigation
            hideWeekdays
            showOutsideDays={false}
            month={first}
            {...omitUndefined({ selected })}
            disabled={outOfRange}
            onSelect={onSelect}
            className="mx-auto max-w-[360px]"
            // M3's month subhead in the list: `TitleSmall`,
            // `OnSurfaceVariant`, padded 24/20/8dp
            // (`CalendarMonthSubheadPadding`, `DateRangePicker.kt`).
            classNames={{
              months: "flex flex-col",
              month: "flex w-84 max-w-full flex-col",
              month_caption: "flex items-center ps-3 pt-5 pb-2",
            }}
            components={{
              Month: ({ calendarMonth: _month, displayIndex: _index, ...rest }) => (
                <div data-picker-month="" {...rest} />
              ),
            }}
          />
        </div>
      </div>
      {/* Anything else written in the container, once, after both trees. */}
      {extra}
    </>
  );
}

/**
 * Escape and a press outside close the picker without committing, and do
 * nothing else — above all, inside a drawer, they do not close the drawer
 * too.
 *
 * Escape is caught at the window in the capture phase, the one listener
 * guaranteed to run before Radix's (a vaul drawer's), and both marked
 * handled and stopped there. Either alone keeps the drawer open — Radix,
 * like Headless UI, ignores an Escape that is already `defaultPrevented`,
 * and a stopped one never reaches it — measured by removing each in turn;
 * removing both closes the drawer with the picker (`e2e/date-picker.spec.ts`).
 * The stop is kept for listeners that do not check, a caller's own
 * shortcut among them. A press outside is noted in `lib/select-dismissal.ts`
 * so a drawer around this picker can tell "the tap that closes the picker"
 * from "a tap on my own overlay" when Radix asks it on the click.
 *
 * **A press outside is spent on closing.** The picker closes on its
 * pointer-down, and the page stops being inert in the same render — so
 * the rest of that press used to land on whatever is under it. Measured in
 * review: on a touch screen, a tap on the modal's scrim closed the picker
 * *and* pressed the button beneath (a mouse was spared only because its
 * click goes to the common ancestor of down and up); and inside a
 * Headless UI `Dialog`, which judges an outside press on its pointer-up
 * (on its touch-end on mobile), the same press closed the picker and then
 * the dialog, losing the form. So the rest of the press is marked handled:
 * its pointer-up and touch-end are `preventDefault`ed — Headless UI skips
 * a handled one, and a handled touch-end makes no click at all — and its
 * click is also stopped, which is where Radix decides a touch dismissal.
 * Only the click is stopped: vaul releases a drag on the pointer-up, and a
 * drawer that never saw it would go on following the pointer.
 */
/**
 * Marks the rest of the current press handled (`useDismissal`'s doc has
 * why): its pointer-up and touch-end `preventDefault`ed, its click
 * `preventDefault`ed and stopped. Ends at that click, or — for a press
 * that makes no click (a handled touch-end, a drag) — at the next press or
 * key, or half a second after the press ends, so a later click the
 * keyboard makes is never eaten.
 */
function spendRestOfPress() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const handled = (event: Event) => {
    event.preventDefault();
    if (event.type === "click") {
      event.stopImmediatePropagation();
      done();
    } else {
      clearTimeout(timer);
      timer = setTimeout(done, 500);
    }
  };
  const options = { capture: true, passive: false } as const;
  function done() {
    clearTimeout(timer);
    for (const type of ["pointerup", "touchend", "click"]) {
      window.removeEventListener(type, handled, options);
    }
    window.removeEventListener("pointerdown", done, true);
    window.removeEventListener("keydown", done, true);
  }
  for (const type of ["pointerup", "touchend", "click"]) {
    window.addEventListener(type, handled, options);
  }
  // Registered now, so it does not fire for the pointer-down in progress:
  // a listener added during dispatch at the same target is not run.
  window.addEventListener("pointerdown", done, true);
  window.addEventListener("keydown", done, true);
}

function useDismissal(picker: PickerContextValue, surfaceRef: RefObject<HTMLDivElement | null>) {
  const { open, triggerRef, closePicker } = picker;
  const close = useRef(closePicker);
  close.current = closePicker;
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      const surface = surfaceRef.current;
      if (surface === null || !(event.target instanceof Node)) return;
      if (!surface.contains(event.target) && event.target !== triggerRef.current) return;
      if (event.key === "Escape") {
        event.stopImmediatePropagation();
        event.preventDefault();
        close.current(false);
        return;
      }
      // A dialog keeps Tab inside it: the page behind is inert, and a Tab
      // past the last control would otherwise land on the trigger, which
      // stays out of the inert. Only what Tab itself stops at counts: the
      // calendar's days are a roving `tabIndex`, one at 0 and the rest at
      // -1, and an arrow at a bound is `tabIndex={-1}` too — counted, one of
      // them was taken for the last stop and Tab walked out of the picker
      // to the page (found in review).
      if (event.key === "Tab" && surface.contains(event.target)) {
        const focusable = Array.from(
          surface.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
        const firstEl = focusable[0];
        const lastEl = focusable[focusable.length - 1];
        if (firstEl === undefined || lastEl === undefined) return;
        if (event.shiftKey && document.activeElement === firstEl) {
          event.preventDefault();
          lastEl.focus();
        } else if (!event.shiftKey && document.activeElement === lastEl) {
          event.preventDefault();
          firstEl.focus();
        }
      }
    }
    function onPointerDown(event: PointerEvent) {
      const surface = surfaceRef.current;
      if (surface === null || !(event.target instanceof Node)) return;
      if (surface.contains(event.target)) return;
      if (triggerRef.current?.contains(event.target)) return;
      notePointerDownUnderOpenSelect(event);
      spendRestOfPress();
      close.current(false);
    }
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, surfaceRef, triggerRef]);
}
