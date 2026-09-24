"use client";

import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/react";
import { ArrowLeft, Check, ChevronDown, Search, X } from "lucide-react";
import {
  Children,
  createContext,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/cn";
import { omitUndefined } from "../../lib/omit-undefined";
import { notePointerDownUnderOpenSelect } from "../../lib/select-dismissal";

/**
 * D17: Radix `Select` → Headless UI `Listbox`. Flagged in the design doc as
 * "the largest single API-shape change in the whole primitives migration" —
 * but Radix `Select`'s own public shape (`Select value/onValueChange` →
 * `SelectTrigger` → `SelectValue` → `SelectContent` → `SelectItem`) is kept
 * byte-identical here, so none of this console's eleven call sites need any
 * change. That's possible because Radix `SelectValue` and Headless UI's
 * `Listbox` solve the "what does the trigger display" problem differently:
 * Radix derives it internally from whichever `SelectItem` matches the
 * current value; `Listbox` has no equivalent (`ListboxButton`'s render prop
 * only exposes the raw `value`, not a matching option's own children/label
 * — e.g. `routes-screen.tsx`'s provider select shows `provider.displayName`
 * for a `value={provider.id}`, not the id itself). `findItemLabel` below
 * replicates Radix's behaviour by walking `Select`'s own `children` tree
 * (not the DOM — `ListboxOptions` may not be mounted while closed) to find
 * the `SelectItem` whose `value` matches, and using *its* children as the
 * label. In the plain (listbox) engine, keyboard behaviour (type-ahead,
 * `Escape`, arrow-key nav) is genuinely Headless UI's own `Listbox`, not
 * reimplemented here. The searchable (combobox) engine below does take over
 * three things Headless UI leaves to a combobox whose field outlives its
 * popup — closing, focus return and modality — and says why at each one.
 *
 * # A compound component, with two engines behind it
 *
 * `Select` is a *wrapper*: every visible piece is a nested part the caller
 * composes — `SelectTrigger`, `SelectValue`, a container (`SelectContent`,
 * `SelectDropdown` or `SelectModal`), `SelectItem`, and the optional
 * `SelectSearch`, `SelectClose`, `SelectModalHandle` and `SelectEmpty`.
 * The parts describe *what* the caller wants; this file decides *how*,
 * which is what lets it be re-organised behind them — a second engine, a
 * different presentation per breakpoint, or (later) a React Native
 * implementation of the same parts, where a window-size class read in JS
 * replaces the CSS breakpoints the web uses (the web avoids reading the
 * viewport in JS only because of server rendering and hydration, which
 * native does not have).
 *
 * The engine follows from the parts. Without a `SelectSearch`, it is
 * Headless UI's `Listbox`, exactly as before. **With one, it is Headless
 * UI's `Combobox`**: once there is a text field, focus has to stay in the
 * field while the arrow keys move through the options, which is the WAI-ARIA
 * combobox pattern, not the listbox one — `Listbox` has no way to put focus
 * anywhere but its own options. The caller does not choose or see this;
 * adding a `<SelectSearch />` is the whole switch.
 */

type SelectEngine = "listbox" | "combobox";

/**
 * How a container presents its options:
 *
 * - `"auto"` (`SelectContent`) — a dropdown from `sm` up; below `sm` an M3
 *   modal bottom sheet, or with a `SelectSearch` M3's full-screen search
 *   view. Chosen by CSS media query, never by reading the viewport.
 * - `"dropdown"` (`SelectDropdown`) — the dropdown (or, searchable, M3's
 *   docked search view) at every width. The phone opt-out.
 * - `"modal"` (`SelectModal`) — the sheet (or, searchable, the full-screen
 *   view) at every width.
 */
type SelectPresentation = "auto" | "dropdown" | "modal";

interface SelectContextValue {
  engine: SelectEngine;
  /** Whether the options are showing — Headless UI's own render-prop
   * state, handed down so the parts that sit outside its elements (the
   * combobox's surface and chrome) can follow it. */
  open: boolean;
  value: string | undefined;
  itemLabel: (value: string) => ReactNode | undefined;
  /**
   * Validity wiring handed down from `Select` to `SelectTrigger`.
   *
   * `FormField` associates a control with its own hint and error by
   * cloning its **direct child** with `aria-describedby`/`aria-invalid`.
   * For a `Select` that child is `Select` itself, and the element that
   * has to carry it is `SelectTrigger`'s button — a grandchild. `Select`
   * used to destructure a closed prop list, so the cloned attribute was
   * dropped with no type error and no runtime warning.
   *
   * # `aria-describedby` cannot be threaded the same way
   *
   * Headless UI's `ListboxButton` sets `"aria-describedby"` in its *own*
   * props, from an internal `Description` context that is `undefined`
   * when no `<Description>` is present — and its render helper lets its
   * own props win over the caller's. So a value passed down here is
   * overwritten with `undefined` before it reaches the DOM. Confirmed by
   * reading `@headlessui/react/dist/components/listbox/listbox.js` (the
   * button builds `aria-describedby: useDescribedBy()` into `ourProps`)
   * and pinned by `form-field.render.test.tsx`, which asserts what each
   * control actually emits.
   *
   * `aria-invalid` is not in that set, which is why it threads fine.
   *
   * Wiring a `Select`'s description properly means adopting Headless
   * UI's own `Field`/`Description` pair in `FormField` — a real
   * architectural change, not a patch, and a maintainer's call. Until
   * then this component does not accept an `aria-describedby` it cannot
   * honour.
   */
  invalid: boolean | undefined;
  /** The search text (combobox engine only; always `""` otherwise). */
  query: string;
  setQuery: (query: string) => void;
  /** Whether `SelectItem`s hide themselves when they do not match
   * `query` — `SelectSearch`'s `filter`, `true` unless the caller filters
   * (or fetches) the items itself. */
  filtering: boolean;
  /** How many `SelectItem`s are rendered right now — what `SelectEmpty`
   * reads. Counted by the items themselves (`registerItem`), not by
   * walking `children`: an option list wrapped in the caller's own
   * component (`<CountryItems />`) is invisible to a walk of the element
   * tree, and a walk-based count once showed "No match" under three
   * matches for exactly that reason. */
  matchCount: number;
  registerItem: () => () => void;
  /** Remembers an option's label as it renders, so `SelectValue` can still
   * show it once the option is gone from `children` — a remote search
   * (`filter={false}`) whose current results leave out the selected item.
   * Measured before this: the trigger read "p2" instead of "Safaricom". */
  rememberLabel: (value: string, label: ReactNode) => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}
const SelectContext = createContext<SelectContextValue | null>(null);

function useSelectContext(component: string): SelectContextValue {
  const ctx = useContext(SelectContext);
  if (ctx === null) {
    throw new Error(`<${component} /> must be rendered inside <Select>.`);
  }
  return ctx;
}

/** `useLayoutEffect` where there is a DOM, so a count read before paint
 * never flashes a wrong empty state; `useEffect` on the server, where a
 * layout effect does nothing and React 18 warns about it. */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** `true` inside the options' own `role="listbox"` element, where only
 * options and groups may be exposed to assistive technology — what makes a
 * `SelectClose` written there a pointer-only affordance (its doc). */
const InListContext = createContext(false);

/** Set by a container for the parts inside it. */
interface PopupContextValue {
  presentation: SelectPresentation;
}
const PopupContext = createContext<PopupContextValue>({ presentation: "auto" });

type AnyElement = ReactElement<Record<string, unknown>>;

/** Visits every element in a `children` tree, depth-first. Returning
 * `false` from `visit` skips that element's own children. */
function forEachElement(node: ReactNode, visit: (element: AnyElement) => boolean | undefined) {
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return;
    const element = child as AnyElement;
    if (visit(element) === false) return;
    const nested = element.props?.children as ReactNode;
    if (nested != null) forEachElement(nested, visit);
  });
}

function findItemLabel(node: ReactNode, value: string): ReactNode | undefined {
  let found: ReactNode | undefined;
  Children.forEach(node, (child) => {
    if (found !== undefined || !isValidElement(child)) return;
    const el = child as ReactElement<{ value?: string; children?: ReactNode }>;
    if (el.type === SelectItem) {
      if (el.props.value === value) found = el.props.children;
      return;
    }
    if (el.props?.children != null) {
      found = findItemLabel(el.props.children, value);
    }
  });
  return found;
}

/** The plain text of a React node — what a `SelectItem` is searched by
 * when it has no `textValue`. */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) {
    return textOf((node as ReactElement<{ children?: ReactNode }>).props.children);
  }
  return "";
}

/** Case- and accent-insensitive: "cote" finds "Côte d’Ivoire". */
function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function matchesQuery(text: string, query: string): boolean {
  const wanted = normalise(query.trim());
  return wanted === "" || normalise(text).includes(wanted);
}

/**
 * Note the `| undefined` on the optional props below. This package
 * compiles under `exactOptionalPropertyTypes`, where a bare `value?:
 * string` means "you may omit this key" and NOT "you may pass
 * `undefined`" — so the ordinary controlled pattern,
 * `const [v, setV] = useState<string>()` followed by `value={v}`, is a
 * type error. Found writing this component's own story, which is the
 * first code outside the original application to use it.
 */
export interface SelectProps {
  value?: string | undefined;
  defaultValue?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  disabled?: boolean | undefined;
  /**
   * Forwarded to `SelectTrigger`'s button.
   *
   * There is deliberately **no `aria-describedby` here**, and the reason
   * is a hard constraint rather than an oversight — see
   * `SelectContextValue.invalid`.
   */
  "aria-invalid"?: boolean | undefined;
  children: ReactNode;
}

export function Select({
  value,
  defaultValue,
  onValueChange,
  disabled,
  "aria-invalid": invalid,
  children,
}: SelectProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  function handleChange(next: string) {
    if (!isControlled) setInternalValue(next);
    onValueChange?.(next);
  }

  const labelCache = useRef(new Map<string, ReactNode>());
  const rememberLabel = useCallback((key: string, label: ReactNode) => {
    labelCache.current.set(key, label);
  }, []);
  const itemLabel = useMemo(
    () => (v: string) => findItemLabel(children, v) ?? labelCache.current.get(v),
    [children],
  );

  // The parts decide the engine: a `SelectSearch` among the parts makes
  // this a combobox. Read from the element tree rather than registered on
  // mount, so the very first render already renders the right engine —
  // which is also why `SelectSearch` has to be written as a part itself,
  // not from inside a wrapper component of the caller's (it throws a clear
  // error if it is), and why adding or removing it swaps the engine and
  // remounts the popup and trigger.
  const search = useMemo(() => {
    let found: SelectSearchProps | undefined;
    forEachElement(children, (element) => {
      if (element.type === SelectSearch) found = element.props as unknown as SelectSearchProps;
      return element.type === SelectItem ? false : undefined;
    });
    return found;
  }, [children]);

  const filtering = search !== undefined && search.filter !== false;
  const [matchCount, setMatchCount] = useState(0);
  const registerItem = useCallback(() => {
    setMatchCount((count) => count + 1);
    return () => setMatchCount((count) => count - 1);
  }, []);

  const shared = {
    value: currentValue,
    itemLabel,
    invalid,
    query,
    setQuery,
    filtering,
    matchCount,
    registerItem,
    rememberLabel,
    triggerRef,
  };

  if (search !== undefined) {
    const onQueryChange = search.onQueryChange;
    return (
      <Combobox
        as="div"
        className="relative"
        value={currentValue ?? ""}
        // Headless UI hands `null` here when the field is cleared — the
        // combobox pattern's "no value" — but clearing the *search* must
        // not clear the *selection*, so `null` is ignored. `""` is not: it
        // is only ever a real option's value (`<SelectItem value="">Any
        // country</SelectItem>`), which a plain select can pick too.
        onChange={(next: string | null) => {
          if (next !== null) handleChange(next);
        }}
        {...omitUndefined({ disabled })}
      >
        {({ open }) => (
          <SelectContext.Provider value={{ ...shared, engine: "combobox", open }}>
            <ComboboxLifecycle
              open={open}
              triggerRef={triggerRef}
              onClose={() => {
                // Only when there was a search to reset: a caller fetching
                // on every `onQueryChange` should not refetch the full list
                // on every close of an untouched popup.
                if (query === "") return;
                setQuery("");
                onQueryChange?.("");
              }}
            />
            {children}
          </SelectContext.Provider>
        )}
      </Combobox>
    );
  }

  return (
    // `as="div"` + `relative`: with `SelectContent` no longer portaled
    // (see its own comment), the options position themselves against this
    // element. Headless UI's `Listbox` renders a fragment by default, which
    // would leave `absolute` resolving against whatever ancestor happened
    // to be positioned — usually the drawer, putting the dropdown in the
    // wrong place entirely.
    <Listbox
      as="div"
      className="relative"
      value={currentValue ?? ""}
      onChange={handleChange}
      {...omitUndefined({ disabled })}
    >
      {({ open }) => (
        <SelectContext.Provider value={{ ...shared, engine: "listbox", open }}>
          {children}
        </SelectContext.Provider>
      )}
    </Listbox>
  );
}

/**
 * What the combobox engine has to do on close that `Listbox` does for
 * itself. `Listbox` keeps focus on elements that outlive it (its trigger,
 * its options); the combobox's field lives *inside* the popup and unmounts
 * with it, so a selection or a tap outside would leave focus on `<body>`.
 * Focus goes back to the trigger — where `Listbox` would have left it —
 * unless it already landed somewhere real. The search text resets too, so
 * the next open starts from the whole list.
 */
function ComboboxLifecycle({
  open,
  triggerRef,
  onClose,
}: {
  open: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const wasOpen = useRef(open);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (wasOpen.current && !open) {
      onCloseRef.current();
      const active = document.activeElement;
      if (active === null || active === document.body || !active.isConnected) {
        triggerRef.current?.focus({ preventScroll: true });
      }
    }
    wasOpen.current = open;
  }, [open, triggerRef]);
  return null;
}

// Unconsumed today (grepped across `admin/`) — kept for API parity. Radix's
// `SelectGroup` had no visual treatment of its own beyond semantic
// grouping; Headless UI's `Listbox` has no equivalent, so this stays a
// plain wrapper rather than reaching for `Menu`'s `MenuSection` (a
// different component family).
export function SelectGroup({ children }: { children: ReactNode }) {
  return <fieldset className="contents border-0 p-0 m-0 min-w-0">{children}</fieldset>;
}

/**
 * # One chevron, not two — `bg-none` is the fix, and it is not cosmetic
 *
 * daisyUI's `.select` draws its own disclosure arrow in CSS, as a pair of
 * `linear-gradient` background images pinned near the trailing edge
 * (read `daisyui/components/select.css`; the rule is literally
 * `background-image: linear-gradient(45deg,#0000 50%,currentColor 50%),
 * linear-gradient(135deg,currentColor 50%,#0000 50%)` with a
 * `background-position` of `calc(100% - 20px)`). That arrow is meant for
 * a native `<select>`, which has no room for a child element.
 *
 * This trigger is a `<button>` rendering a real `ChevronDown`, so both
 * were painted: a lucide chevron and, 6px to its right, daisyUI's little
 * solid triangle. Two disclosure indicators on one control, which reads
 * as a rendering bug because it is one.
 *
 * `bg-none` removes daisyUI's. The lucide glyph is the one that stays,
 * because it is the same icon at the same weight as every other chevron
 * in the library (`DatePicker`, the nav disclosure, `Pagination`) — the
 * CSS triangle matches nothing else.
 *
 * `pe-3` goes with it. daisyUI reserves `padding-inline-end: 1.75rem` for
 * the arrow it is no longer drawing; left alone, the chevron would float
 * 28px off the right edge while the leading edge sits at 12px, which
 * looks like a mistake even to someone who cannot say why.
 *
 * No `select-bordered` here (or `input-bordered` on `DatePicker`'s
 * trigger, styled the same way). It was daisyUI v4; in v5 `.select`/
 * `.input` draw their own border via `--input-color` with nothing left
 * for a `-bordered` modifier to add. Confirmed against the installed
 * package, not assumed: `grep -rho '\b[a-z]*-bordered\b' node_modules/daisyui/`
 * returns zero matches anywhere in the compiled CSS, so the class matched
 * no selector and removing it changes nothing rendered.
 *
 * # The combobox engine's trigger is made reachable by hand
 *
 * With a `SelectSearch`, this is Headless UI's `ComboboxButton`, which
 * hard-codes `tabIndex: -1` — its combobox expects the *field* to be the
 * control you Tab to, and the button a pointer affordance beside it. Here
 * the field only exists inside the open popup, so the button is the only
 * way in, and `tabIndex={0}` cannot fix that: Headless UI's own props win
 * over the caller's (probed in jsdom: passing `tabIndex={0}` still
 * rendered `tabindex="-1"`). So the effect below sets it on the element
 * after mount. React never re-applies the `-1` — it only writes an
 * attribute when the prop *changes*, and Headless UI's never does.
 */
export function SelectTrigger({
  id,
  className,
  children,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
  /** Accessible name for a `Select` rendered outside a `FormField` — which
   * otherwise has no way to be named, since this trigger only ever renders
   * its selected value, never a label. Purely additive; a `FormField`-
   * wrapped `Select` keeps working unchanged without either prop. */
  "aria-label"?: string | undefined;
  /** Same, pointing at an existing label element instead of inlining the
   * text. */
  "aria-labelledby"?: string | undefined;
}) {
  const { engine, invalid, triggerRef } = useSelectContext("SelectTrigger");
  useEffect(() => {
    if (engine === "combobox" && triggerRef.current !== null) triggerRef.current.tabIndex = 0;
  }, [engine, triggerRef]);
  const Button = engine === "combobox" ? ComboboxButton : ListboxButton;
  return (
    <Button
      ref={triggerRef}
      id={id}
      {...omitUndefined({ "aria-invalid": invalid })}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={cn(
        "select flex w-full items-center justify-between gap-2 bg-none pe-3 font-sans text-prose",
        className,
      )}
    >
      {/* `min-w-0` + `truncate`: `.select` is `overflow: hidden` and
          `white-space: nowrap`, so a label longer than the control used to
          be sliced off mid-glyph at the border — and it took the chevron
          with it, since a flex sibling with nothing to shrink pushes the
          icon out of the box entirely. Now it ends in an ellipsis and the
          chevron stays put. */}
      <span className="min-w-0 flex-1 truncate text-left">{children}</span>
      <ChevronDown
        size={14}
        strokeWidth={1.5}
        className="shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
    </Button>
  );
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const { value, itemLabel } = useSelectContext("SelectValue");
  if (value === undefined || value === "") {
    return <span className="text-subtle-foreground">{placeholder}</span>;
  }
  return <>{itemLabel(value) ?? value}</>;
}

/**
 * When letting go of the handle dismisses the sheet, by androidx's own
 * numbers for the same question:
 *
 * - **Distance**: 56dp — `BottomSheetDefaults.PositionalThreshold`
 *   (an internal member, declared in `SheetDefaults.kt`).
 * - **Fling**: 125dp/s — `BottomSheetDefaults.VelocityThreshold`, measured
 *   the way Compose's `VelocityTracker` measures a release: over the
 *   pointer samples from the last 100ms only (`HorizonMilliseconds`), and
 *   as zero if the pointer sat still for 40ms before lifting
 *   (`AssumePointerMoveStoppedMilliseconds`). An average over the whole
 *   gesture is not that — a slow drag that ended in a pause would still
 *   read as a flick.
 * - **Slop**: nothing counts as a drag until it has moved 8px — Android's
 *   `ViewConfiguration.TOUCH_SLOP` (8dp) — so a tap on the handle with a
 *   few pixels of jitter in it cannot read as a flick and dismiss.
 */
const SHEET_DISMISS_DISTANCE = 56;
const SHEET_DISMISS_VELOCITY = 0.125; // px per ms, i.e. 125px/s
const SHEET_VELOCITY_HORIZON = 100; // ms
const SHEET_VELOCITY_STOPPED = 40; // ms
const SHEET_TOUCH_SLOP = 8;

/** Release velocity in px/ms, `VelocityTracker`-style (see the constants
 * above): the last 100ms of samples, zero if the pointer had stopped for
 * 40ms before it lifted. */
function releaseVelocity(samples: { t: number; y: number }[], t: number, y: number): number {
  const last = samples[samples.length - 1];
  if (last === undefined || t - last.t > SHEET_VELOCITY_STOPPED) return 0;
  const first = samples.find((sample) => t - sample.t <= SHEET_VELOCITY_HORIZON) ?? last;
  return (y - first.y) / Math.max(1, t - first.t);
}

/**
 * The sheet's drag handle — M3's `DragHandle` (`SheetDefaults.kt`): a 32×4
 * bar in `OnSurfaceVariant` (`SheetBottomTokens.DockedDragHandleWidth`/
 * `Height`/`Color`), with 22dp of padding above and below it
 * (`DragHandleVerticalPadding`), so the strip a finger actually grabs is
 * 48px tall.
 *
 * A public part with a default: every sheet renders one at its top when
 * the caller did not place one, so most callers never write it. Place it
 * yourself only to control where it sits. It appears only where the
 * options are a sheet — below `sm` in `SelectContent`, at every width in
 * `SelectModal`, never in `SelectDropdown` — and a searchable select has
 * no sheet (its phone view is full-screen), so there it renders nothing.
 *
 * # It really drags
 *
 * A handle that does not move is a lie about the surface it sits on. So
 * this one follows the pointer down (never up — the sheet is already as
 * tall as its content allows) and, on release, either springs back or
 * dismisses, by androidx's own thresholds (`SHEET_DISMISS_DISTANCE` and
 * the constants beside it).
 *
 * Dismissing is a synthetic `Escape` keydown on the options element.
 * That is the only way in: Headless UI's `Listbox` has no imperative
 * close — `ListboxOptions`' render props expose `open` and nothing else,
 * and the one `close` in `listbox.js` is wired to its own button's
 * quick-release handler, not exported. Escape is also exactly the right
 * semantics, because it is what a keyboard user does to dismiss the same
 * sheet: Headless UI's handler closes the listbox *and* returns focus to
 * the trigger, both of which a drag should do too.
 *
 * It is `aria-hidden` and not a button. A keyboard or screen-reader user
 * already has Escape and cannot drag, and a focusable non-option inside a
 * `role="listbox"` would be an ARIA violation (a listbox owns options and
 * groups only).
 */
export function SelectModalHandle({ className }: { className?: string | undefined }) {
  const { engine } = useSelectContext("SelectModalHandle");
  const { presentation } = useContext(PopupContext);
  const drag = useRef<{
    id: number;
    y: number;
    sheet: HTMLElement;
    samples: { t: number; y: number }[];
  } | null>(null);

  if (engine === "combobox" || presentation === "dropdown") return null;

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const sheet = event.currentTarget.closest<HTMLElement>('[role="listbox"]');
    if (sheet === null) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      id: event.pointerId,
      y: event.clientY,
      sheet,
      samples: [{ t: event.timeStamp, y: event.clientY }],
    };
    // Follow the finger 1:1 — a spring on every pointermove would lag it.
    sheet.style.transition = "none";
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (state === null || state.id !== event.pointerId) return;
    state.samples.push({ t: event.timeStamp, y: event.clientY });
    state.sheet.style.translate = `0 ${Math.max(0, event.clientY - state.y)}px`;
  }

  function onPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (state === null || state.id !== event.pointerId) return;
    drag.current = null;
    const distance = Math.max(0, event.clientY - state.y);
    const velocity = releaseVelocity(state.samples, event.timeStamp, event.clientY);
    // Hand the transition back to the stylesheet, so a release that does
    // not dismiss springs home on `--ease-spatial` rather than snapping.
    state.sheet.style.transition = "";
    state.sheet.style.translate = "";
    const dismiss =
      distance >= SHEET_DISMISS_DISTANCE ||
      (distance >= SHEET_TOUCH_SLOP && velocity >= SHEET_DISMISS_VELOCITY);
    if (event.type === "pointerup" && dismiss) {
      state.sheet.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    }
  }

  return (
    <div
      aria-hidden="true"
      data-sheet-handle=""
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      className={cn(
        // `sticky top-0` inside the sheet's own scroll container: the
        // handle stays put while the options scroll under it, on the
        // sheet's own fill so they do not show through.
        presentation === "modal"
          ? "sticky top-0 z-10 -mx-2 flex cursor-grab touch-none justify-center bg-surface-2 py-[22px]"
          : "sticky top-0 z-10 -mx-2 hidden cursor-grab touch-none justify-center bg-surface-2 py-[22px] max-sm:flex",
        className,
      )}
    >
      <span className="h-1 w-8 rounded-full bg-muted-foreground" />
    </div>
  );
}

/**
 * Closes an open listbox *without* an Escape, for the one place an Escape
 * cannot do it: inside a `vaul` drawer.
 *
 * Radix, under vaul, listens for Escape on the document in the capture
 * phase — before the listbox's own handler — and whichever way it
 * decides, it leaves the event `defaultPrevented`: dismissing the drawer
 * calls `preventDefault()`, and a caller that declines the dismissal has
 * to call it too. Headless UI's merged handlers skip any event that is
 * already `defaultPrevented` (`utils/render.js`). So inside a drawer an
 * Escape meant for this listbox either closes the drawer with it (measured,
 * with focus left on `<body>`) or closes nothing at all — there is no
 * ordering of listeners that gives it to the listbox alone, and relying on
 * one is worse than useless: Radix re-registers its listener on re-render,
 * so its position among the document's listeners is not stable (a drag
 * dismissal passed and failed on alternate runs before this existed).
 *
 * Headless UI has no imperative close. Its Tab handler is the one other
 * key that closes the listbox — it then moves focus past the trigger,
 * which is why focus is put straight back on it. Radix ignores Tab at the
 * document, and Headless UI stops the synthetic Tab reaching Radix's
 * `FocusScope` (which traps Tab through a React handler further up).
 */
function closeListboxInsideDrawer(options: HTMLElement, trigger: HTMLElement | null) {
  options.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }),
  );
  trigger?.focus({ preventScroll: true });
}

/**
 * Closes the combobox engine's popup without a key at all. Headless UI's
 * `ComboboxInput` closes the combobox when it loses focus to anything that
 * is neither its options nor its button (`combobox.js`, the input's
 * `onBlur`); the popup's own surface is neither, so focusing it closes the
 * combobox, and focus then goes to the trigger. Escape would do the same
 * outside a drawer, but not inside one (`closeListboxInsideDrawer` has why),
 * and Tab is not a close here: the combobox's Tab *selects* the active
 * option. One mechanism everywhere is the one that cannot differ between
 * a drawer and a page.
 */
function closeComboboxPopup(surface: HTMLElement, trigger: HTMLElement | null) {
  const field = surface.querySelector<HTMLElement>('[role="combobox"]');
  if (field !== null && document.activeElement !== field) field.focus({ preventScroll: true });
  surface.focus({ preventScroll: true });
  trigger?.focus({ preventScroll: true });
}

/**
 * The combobox engine's modality: the page cannot scroll, and everything
 * but the trigger and the popup is `inert`.
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
 * (`html[data-select-scroll-lock]` in `theme.css`), reference-counted, so
 * it and Headless UI's inline `overflow` can come and go in any order.
 *
 * The lock also pads the page by the scrollbar it hides, as Headless UI's
 * does: without it, a page with a classic scrollbar shifted sideways by its
 * width on every open and close (measured: 488.5 → 496px).
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

function useComboboxModality(
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

/** A container's direct parts, with fragments opened up — so
 * `<><SelectSearch /><SelectEmpty /></>` is lifted into the header like the
 * same parts written bare, rather than landing inside the listbox. */
function flattenParts(node: ReactNode): ReactNode[] {
  return Children.toArray(node).flatMap((part) =>
    isValidElement(part) && part.type === Fragment
      ? flattenParts((part.props as { children?: ReactNode }).children)
      : [part],
  );
}

/**
 * The options' container, in whichever engine and presentation — shared by
 * `SelectContent`, `SelectDropdown` and `SelectModal`, whose docs say what
 * each presents.
 */
function SelectPopup({
  component,
  presentation,
  className,
  children,
}: {
  component: string;
  presentation: SelectPresentation;
  className?: string | undefined;
  children: ReactNode;
}) {
  const { engine, open, triggerRef, matchCount } = useSelectContext(component);
  const surfaceRef = useRef<HTMLElement | null>(null);
  const matchCountRef = useRef(matchCount);
  matchCountRef.current = matchCount;

  // Escape, caught at the window in the capture phase — the one listener
  // guaranteed to run before Radix's — when it is aimed at this open
  // popup or at its own trigger. The listbox engine only needs this inside
  // a vaul drawer (everywhere else Headless UI's own Escape handling is
  // left alone); the combobox engine always takes it, because its field
  // unmounts with the popup and nothing else would put focus back.
  // The sheet's drag handle dismisses with a synthetic Escape, so it goes
  // through here too. See `closeListboxInsideDrawer` for why this exists.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const surface = surfaceRef.current;
      if (surface === null || !(event.target instanceof Node)) return;
      const inField =
        engine === "combobox" &&
        event.target instanceof Element &&
        surface.contains(event.target) &&
        event.target.closest('[role="combobox"]') !== null;
      // Tab from the search field moves on, as it does from a plain
      // select's options. Headless UI's combobox Tab *selects* the active
      // option — and it makes the first option active on open — so a
      // keyboard user tabbing through a form silently filled the field
      // with "Angola" (measured). The popup is closed here instead, focus
      // parked on the trigger, and the key's default action (not
      // prevented) then moves focus on from there, either direction.
      if (inField && event.key === "Tab") {
        event.stopImmediatePropagation();
        closeComboboxPopup(surface, triggerRef.current);
        return;
      }
      // Enter with nothing to pick keeps the popup and the typed search,
      // rather than closing and throwing the search away.
      if (inField && event.key === "Enter" && matchCountRef.current === 0) {
        event.stopImmediatePropagation();
        event.preventDefault();
        return;
      }
      if (event.key !== "Escape") return;
      // Aimed at the popup, or at this select's own trigger. Headless UI
      // moves focus into the popup when it opens, but the trigger stays
      // outside the `inert` it applies, so a screen reader's cursor (or a
      // caller's `.focus()`) can be sitting on it while the popup is open
      // — and an Escape there closed the drawer along with the listbox,
      // measured in the "Inside a drawer" story at 375px and 1280px.
      const trigger = triggerRef.current;
      if (!surface.contains(event.target) && event.target !== trigger) return;
      if (engine === "listbox") {
        if (surface.closest("[data-vaul-drawer]") === null) return;
        event.stopImmediatePropagation();
        event.preventDefault();
        closeListboxInsideDrawer(surface, trigger);
        return;
      }
      event.stopImmediatePropagation();
      event.preventDefault();
      closeComboboxPopup(surface, trigger);
    }
    // And every pointer-down outside the open popup is noted, so a drawer
    // around this `Select` can tell "a tap that closes the listbox" from
    // "a tap on the drawer's own overlay" when Radix asks it a moment
    // later — see `lib/select-dismissal.ts`.
    function onPointerDown(event: PointerEvent) {
      const surface = surfaceRef.current;
      if (surface === null) return;
      if (event.target instanceof Node && surface.contains(event.target)) return;
      notePointerDownUnderOpenSelect(event);
    }
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [engine, triggerRef]);

  // The combobox popup's chrome — its header, the clear button, the back
  // arrow, the empty state — is outside the field, the button and the
  // options, which is everything Headless UI's outside-click counts as
  // "inside" (`combobox.js`). Left alone, a tap on the clear button would
  // close the whole popup. Its pointer-up (desktop) and touch-end (mobile —
  // which is what Headless UI listens to on a touch device) are stopped at
  // the window before Headless UI's document listener sees them; the tap's
  // own `click` still fires, because stopping propagation is not
  // preventing a default.
  useEffect(() => {
    if (engine !== "combobox" || !open) return;
    function guard(event: Event) {
      const surface = surfaceRef.current;
      const target = event.target;
      if (surface === null || !(target instanceof Element) || !surface.contains(target)) return;
      if (target.closest('[role="listbox"], [role="combobox"]') !== null) return;
      event.stopPropagation();
    }
    // Focus moving from the field onto the popup's own chrome — a screen
    // reader's cursor landing on "Clear search", or a caller's `.focus()` —
    // is the field's blur, which is the combobox's close: the view closed
    // before the button could be pressed (measured with `.focus()`). That
    // blur is kept from Headless UI; the one focus move inside the popup
    // that *is* a close — onto the surface itself, `closeComboboxPopup` —
    // still goes through.
    function keepOpenOnChromeFocus(event: FocusEvent) {
      const surface = surfaceRef.current;
      const next = event.relatedTarget;
      if (surface === null || !(next instanceof Node) || next === surface) return;
      if (!(event.target instanceof Element) || event.target.getAttribute("role") !== "combobox") {
        return;
      }
      if (surface.contains(event.target) && surface.contains(next)) event.stopPropagation();
    }
    window.addEventListener("pointerup", guard, true);
    window.addEventListener("touchend", guard, true);
    window.addEventListener("focusout", keepOpenOnChromeFocus, true);
    return () => {
      window.removeEventListener("pointerup", guard, true);
      window.removeEventListener("touchend", guard, true);
      window.removeEventListener("focusout", keepOpenOnChromeFocus, true);
    };
  }, [engine, open]);

  useComboboxModality(engine === "combobox" && open, surfaceRef, triggerRef);

  const parts = flattenParts(children);
  const hasOwn = (type: unknown) =>
    parts.some((part) => isValidElement(part) && part.type === type);

  if (engine === "listbox") {
    return (
      <PopupContext.Provider value={{ presentation }}>
        <ListboxOptions
          ref={surfaceRef}
          // `portal={false}` is a correctness fix, not a preference.
          //
          // Headless UI's `anchor` prop portals the options into
          // `#headlessui-portal-root`, a top-level sibling of `<body>`. Inside a
          // `vaul` drawer that is fatal: vaul's `Content` mounts a Radix
          // `FocusScope` with `trapped: true`, a document-level `focusin`
          // listener that force-refocuses back into the drawer the instant
          // focus lands outside it. The portaled listbox is outside, so its
          // enter transition stalls mid-flight and it never becomes usable.
          //
          // Measured on the live console rather than inferred — opening the
          // registration status select inside its stacked drawer gave:
          //
          //   parentChain     [..., DIV#headlessui-portal-root, BODY]
          //   insideAnyDrawer false
          //   opacity         "0"
          //   pointerEvents   "none"
          //   rect            [122, 10]   (collapsed, not four options tall)
          //
          // — byte-for-byte the signature #274 recorded for a nested Dialog.
          // #282 fixed that class for `Dialog` and never covered `Select`, so
          // every select inside a drawer has been silently unusable since.
          //
          // Rendering inline keeps the options inside the drawer's own subtree,
          // so the focus trap contains them instead of fighting them. The cost
          // is losing `anchor`'s collision detection; `top-full` + `w-full`
          // below reproduces the same "directly under the trigger, matching its
          // width" placement, which is what every call site here wants anyway.
          portal={false}
          // Marks an open `Select` for `side-nav.tsx`, whose bottom toolbar
          // hides while one is open below `sm` — see `SelectContent`'s doc.
          // The options unmount on close, so its presence alone means "open".
          data-select-content=""
          data-vaul-no-drag=""
          // No `transition`, and no `data-closed:*` classes. Headless UI's
          // transition machinery holds `data-closed` until it observes the
          // enter transition finish; inside a drawer it never does. Measured
          // after the portal fix, 1.4s after opening: `data-closed` and
          // `data-enter` both still present, `opacity: 0`, on an element that
          // was otherwise correct (inside the drawer, `pointer-events: auto`,
          // full 146px height, all four options present).
          //
          // That is the same failure mode twice now — #274's nested Dialog was
          // also a stalled enter transition, not a mispositioned element. A
          // 100ms fade on a select dropdown is not worth a second component
          // that silently does not open, so it is gone rather than debugged.
          data-select-presentation={presentation}
          className={cn(LISTBOX_SURFACE[presentation], className)}
        >
          <InListContext.Provider value={true}>
            {presentation !== "dropdown" && !hasOwn(SelectModalHandle) && <SelectModalHandle />}
            {children}
          </InListContext.Provider>
        </ListboxOptions>
      </PopupContext.Provider>
    );
  }

  if (!open) return null;

  // The combobox popup is a surface *around* the listbox, not the listbox
  // itself: the field (`role="combobox"`) and the header's buttons cannot
  // live inside a `role="listbox"`, which may own options and groups only.
  // The caller writes one flat list of parts; the header ones are lifted
  // out of it here, and everything else is the list.
  const isPart = (part: unknown, ...types: unknown[]) =>
    isValidElement(part) && types.includes(part.type);
  const header = parts.filter((part) => isPart(part, SelectSearch, SelectClose));
  const empty = parts.filter((part) => isPart(part, SelectEmpty));
  const list = parts.filter(
    (part) => !isPart(part, SelectSearch, SelectClose, SelectEmpty, SelectModalHandle),
  );
  const showDefaultClose = presentation !== "dropdown" && !hasOwn(SelectClose);
  const emptyPart = empty[0];
  const emptyText =
    (isValidElement(emptyPart)
      ? textOf((emptyPart.props as { children?: ReactNode }).children)
      : "") || "No match";

  return (
    <PopupContext.Provider value={{ presentation }}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the handler is not an interaction — it only keeps focus in the search field (see the comment on it); every control inside is a real button or the field itself. */}
      <div
        ref={(element) => {
          surfaceRef.current = element;
        }}
        // Focusable only so `closeComboboxPopup` can move focus onto it.
        tabIndex={-1}
        data-select-content=""
        data-select-presentation={presentation}
        data-vaul-no-drag=""
        className={cn(COMBOBOX_SURFACE[presentation], className)}
        // A press anywhere on the popup's chrome keeps focus in the field:
        // the field's blur *is* the combobox's close (`closeComboboxPopup`),
        // so a tap on the header, the clear button or the back arrow must
        // not move focus before its own `click` decides what happens.
        onMouseDown={(event) => {
          if (!(event.target instanceof Element)) return;
          if (event.target.closest('[role="combobox"]') === null) event.preventDefault();
        }}
      >
        <div className={COMBOBOX_HEADER[presentation]}>
          {showDefaultClose && <SelectClose />}
          {header}
        </div>
        <div className={COMBOBOX_SCROLL[presentation]}>
          <ComboboxOptions portal={false} modal={false} className="outline-none">
            <InListContext.Provider value={true}>{list}</InListContext.Provider>
          </ComboboxOptions>
          {empty.length > 0 ? empty : <SelectEmpty />}
        </div>
        {/* The one live region, mounted for as long as the popup is open
            and only its *text* changing: a region inserted already holding
            its message is not reliably announced, and `SelectEmpty` mounts
            exactly when the list empties. So the visible empty state is
            plain text, and this says it to a screen reader. */}
        <div role="status" className="sr-only">
          {matchCount === 0 ? emptyText : ""}
        </div>
      </div>
    </PopupContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Class strings, one per engine × presentation. Written out in full rather
// than assembled from prefixes because Tailwind only generates a class it
// can find *literally* in the source.
// ---------------------------------------------------------------------------

const LISTBOX_DROPDOWN =
  "absolute top-full left-0 z-50 mt-1 max-h-80 w-full min-w-[8rem] overflow-y-auto rounded-md border border-edge bg-surface-2 p-1 shadow-[var(--shadow-popover)] focus:outline-none";

const LISTBOX_SURFACE: Record<SelectPresentation, string> = {
  dropdown: LISTBOX_DROPDOWN,
  auto: cn(
    LISTBOX_DROPDOWN,
    // Below `sm`: the M3 modal bottom sheet (`SelectContent`'s doc).
    // The top corners are `SheetBottomTokens.DockedContainerShape`,
    // `CornerExtraLargeTop` (`--radius-sheet`, 28dp), the bottom edge
    // square. The fill stays `surface-2`, the one every floating
    // layer here uses — the dropdown above, and `DetailDrawerContent`'s
    // own phone sheet, which this sheet most often opens over — not
    // M3's `SurfaceContainerLow`, so that a sheet opened from a sheet
    // is the same material as the one under it. `85dvh` is this
    // library's number, not M3's — a modal sheet may grow to the top
    // inset, and a strip of scrim left above it is what says "this is a
    // sheet over the page", not a new page.
    // `max-sm:w-full` restates what `w-full` already says, on purpose:
    // a caller's `className="w-64"` is a *dropdown* width, and without
    // this it would replace `w-full` at every width and leave the
    // phone sheet 256px wide, pinned to the left edge.
    "max-sm:fixed max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:mt-0 max-sm:w-full max-sm:max-h-[85dvh]",
    "max-sm:overscroll-contain max-sm:rounded-t-sheet max-sm:rounded-b-none max-sm:border-0",
    // `scroll-pt-12` reserves the sticky handle's 48px when Headless
    // UI scrolls the active option into view (`block: "nearest"`).
    // Without it, arrowing up a long list parked the focused row
    // under the handle — measured: 8px of a 56px row left showing.
    "max-sm:scroll-pt-12",
    "max-sm:px-2 max-sm:pt-0 max-sm:pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]",
    "max-sm:shadow-[0_0_0_100vmax_var(--scrim)] max-sm:starting:shadow-[0_0_0_100vmax_transparent]",
    "max-sm:starting:translate-y-full",
    "max-sm:[transition-property:translate,box-shadow]",
    "max-sm:[transition-duration:var(--dur-spatial),var(--dur-effects)]",
    "max-sm:[transition-timing-function:var(--ease-spatial),var(--ease-effects)]",
  ),
  // The same sheet at every width. From `sm` up it stops at 640px and
  // centres: `BottomSheetDefaults.SheetMaxWidth` (`SheetDefaults.kt`),
  // M3's own cap for a modal bottom sheet on a wide window.
  modal: cn(
    "fixed inset-x-0 top-auto bottom-0 z-50 mx-auto w-full max-w-[640px] max-h-[85dvh] overflow-y-auto focus:outline-none",
    "overscroll-contain rounded-t-sheet rounded-b-none border-0 bg-surface-2 scroll-pt-12",
    "px-2 pt-0 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]",
    "shadow-[0_0_0_100vmax_var(--scrim)] starting:shadow-[0_0_0_100vmax_transparent]",
    "starting:translate-y-full",
    "[transition-property:translate,box-shadow]",
    "[transition-duration:var(--dur-spatial),var(--dur-effects)]",
    "[transition-timing-function:var(--ease-spatial),var(--ease-effects)]",
  ),
};

/**
 * M3's search view (`SearchViewTokens.kt`) in its two forms: **docked**
 * under the trigger on a wide window — a 56dp header
 * (`DockedHeaderContainerHeight`) — and **full-screen** on a compact one:
 * square corners (`FullScreenContainerShape` `CornerNone`) and a 72dp
 * header (`FullScreenHeaderContainerHeight`), as M3's
 * `ExpandedFullScreenSearchBar` draws it, with a back arrow leading — the
 * `ArrowBack` "Back" that androidx's own `SearchBarSamples.kt`
 * (`SampleLeadingIcon`) puts on any expanded search bar. The docked view
 * here leads with the magnifier instead, a library choice: that sample
 * shows the magnifier on the *collapsed* bar, and a back arrow on a desktop
 * dropdown reads as navigation. Full-screen rather than a sheet on a
 * phone because a searchable picker brings up the on-screen keyboard,
 * which takes roughly half the height: a half-height sheet plus a keyboard
 * leaves almost no room for the results.
 *
 * "Full-screen" is written as *pinned to the bottom edge, `100dvh` tall*
 * rather than `inset-0`, for the reason the sheet's doc gives about
 * drawers: inside a `vaul` drawer a `fixed` element resolves against the
 * drawer, and `inset-0` there covered only the drawer — measured at 375px,
 * a 301px-tall "full screen" over the drawer's own sheet. Every drawer here
 * reaches the viewport's bottom edge below `sm`, so bottom-anchored and a
 * viewport tall is the whole screen inside one and outside one alike.
 *
 * The full-screen fill is `surface-3`, for M3's `SurfaceContainerHigh`
 * (`SearchViewTokens.ContainerColor`), one step above the `surface-2` this
 * library maps `SurfaceContainer` to; the docked view keeps `surface-2`,
 * the dropdown family's own material. It enters by rising 16px and fading
 * in, on the spatial and effects springs — a library choice: M3 expands the
 * search bar into the view, and there is no bar here to expand.
 */
const COMBOBOX_DOCKED =
  "absolute top-full left-0 z-50 mt-1 flex w-full min-w-[16rem] flex-col overflow-hidden rounded-md border border-edge bg-surface-2 shadow-[var(--shadow-popover)] outline-none";

const COMBOBOX_SURFACE: Record<SelectPresentation, string> = {
  dropdown: COMBOBOX_DOCKED,
  auto: cn(
    COMBOBOX_DOCKED,
    "max-sm:fixed max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:h-dvh max-sm:mt-0 max-sm:w-full max-sm:min-w-0 max-sm:rounded-none max-sm:border-0",
    "max-sm:bg-surface-3 max-sm:shadow-none max-sm:pt-[env(safe-area-inset-top,0px)]",
    "max-sm:starting:translate-y-4 max-sm:starting:opacity-0",
    "max-sm:[transition-property:translate,opacity]",
    "max-sm:[transition-duration:var(--dur-spatial),var(--dur-effects)]",
    "max-sm:[transition-timing-function:var(--ease-spatial),var(--ease-effects)]",
  ),
  modal: cn(
    "fixed inset-x-0 top-auto bottom-0 z-50 flex h-dvh flex-col bg-surface-3 pt-[env(safe-area-inset-top,0px)] outline-none",
    // From `sm` up the same view stops at the sheet's own width and
    // centres, with the sheet's top corners and scrim: a maintainer's call
    // (2026-09-24), so a searchable `SelectModal` on a wide window has the
    // footprint of a plain one rather than blanking the whole screen.
    "sm:mx-auto sm:max-w-[640px] sm:rounded-t-sheet",
    "sm:shadow-[0_0_0_100vmax_var(--scrim)] sm:starting:shadow-[0_0_0_100vmax_transparent]",
    "starting:translate-y-4 starting:opacity-0",
    "[transition-property:translate,opacity,box-shadow]",
    "[transition-duration:var(--dur-spatial),var(--dur-effects),var(--dur-effects)]",
    "[transition-timing-function:var(--ease-spatial),var(--ease-effects),var(--ease-effects)]",
  ),
};

const COMBOBOX_HEADER: Record<SelectPresentation, string> = {
  dropdown: "flex h-14 shrink-0 items-center gap-1 border-edge border-b px-2",
  auto: "flex h-14 shrink-0 items-center gap-1 border-edge border-b px-2 max-sm:h-[72px] max-sm:px-1",
  modal: "flex h-[72px] shrink-0 items-center gap-1 border-edge border-b px-1",
};

const COMBOBOX_SCROLL: Record<SelectPresentation, string> = {
  // `min-h-0 flex-1` so a caller's `max-h-*` on the container — which
  // lands on this engine's outer surface, not on the scrolling list as it
  // does in the plain engine — shrinks the list instead of clipping it.
  dropdown: "max-h-72 min-h-0 flex-1 overflow-y-auto p-1",
  auto: cn(
    "max-h-72 min-h-0 flex-1 overflow-y-auto p-1",
    "max-sm:max-h-none max-sm:min-h-0 max-sm:flex-1 max-sm:overscroll-contain max-sm:px-2 max-sm:pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]",
  ),
  modal:
    "min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]",
};

/**
 * The options, presented automatically: a dropdown under the trigger from
 * `sm` up, and **below `sm` an M3 modal bottom sheet** — or, with a
 * `SelectSearch`, M3's full-screen search view — the same element, restyled
 * by a `max-sm:` media query, not a second component chosen by reading the
 * viewport in JS. `SelectDropdown` and `SelectModal` are the same container
 * with the choice made for you at every width.
 *
 * # Why a sheet below `sm`
 *
 * A dropdown anchored under a trigger is a pointer idiom. On a phone it
 * opens wherever the trigger happens to be — often under the thumb's
 * reach, often half off the bottom of the screen with the rest of the
 * options behind a scroll the reader has not noticed — and every option
 * is a desktop-height row. M3's answer on a compact window is a modal
 * bottom sheet: the choices always start at the same place, the bottom
 * edge, within reach, full-width, with rows sized for a finger.
 * `sm` (640px) is Tailwind's nearest step to M3's own compact window
 * class (under 600dp) and the same line `SideNav` turns its rail on.
 *
 * # Why the same element, and why that is safe inside a drawer
 *
 * Everything the `portal={false}` comment in `SelectPopup` says still
 * holds, so the sheet cannot be portalled either: inside a `vaul` drawer
 * it would land outside the drawer's focus trap and never open. It
 * stays in the tree and turns `fixed` instead. A `fixed` element inside
 * a `vaul` drawer resolves against the drawer, not the viewport
 * (`[data-vaul-drawer]` is `will-change: transform` —
 * `SideNavProps.smallScreen`'s doc has the mechanism), which would be
 * fatal for a centred dialog and is harmless here: below `sm`, every
 * drawer in this library already reaches the viewport's bottom edge —
 * `DetailDrawerContent` is a bottom sheet there, and the generic
 * `DrawerContent` is full-height — so "the bottom of the drawer" and "the
 * bottom of the viewport" are the same line, and the sheet lands on it at
 * the drawer's width. The height is capped in `dvh`, which is
 * viewport-relative whatever the containing block. (`Dialog` is not a
 * containing block at all once open: its panel's `scale-95` is on
 * `data-closed` only.)
 *
 * # The scrim is a shadow, and that is enough
 *
 * M3 dims the page behind a modal sheet (`ScrimTokens`: `Scrim` at 32%).
 * Here it is a `100vmax` spread `box-shadow` on the sheet itself in
 * `--scrim`, which the theme already sets per mode, rather than a
 * sibling element — for the same containing-block reason: a `fixed
 * inset-0` sibling inside a drawer would only dim the drawer. A shadow
 * paints wherever it reaches.
 *
 * A shadow cannot catch a tap, and it does not need to. `ListboxOptions`
 * is `modal` by default, which in Headless UI 2.2 means two things
 * whenever it is open (`listbox.js`: `useScrollLock` and
 * `useInertOthers`, both gated on `modal && open`): the page cannot
 * scroll, and the subtree the `Select` lives in — everything but the
 * trigger and the options — is `inert`. A tap on the dimmed page
 * therefore reaches nothing — it lands on an inert subtree, activates
 * nothing underneath, and Headless UI's own outside-click handler closes
 * the sheet. That is exactly a modal scrim's behaviour, and it was
 * already true of the dropdown. (The combobox engine does the same with
 * its own `useComboboxModality`, whose doc has why.)
 *
 * **Not everything is inert, and the gap is measured, not assumed.**
 * `useInertOthers` stops climbing at `body`, so anything portalled to
 * `body` — `SideNav`'s toolbars, toasts, Headless UI's own portal root —
 * stays live. That matters for the one of those that sits where the sheet
 * does: in a stacking context of its own (a `sticky` header, an
 * `isolate`d `InstrumentPanel`, a transformed container) this sheet's
 * `z-50` only counts inside that context, `SideNav`'s bottom toolbar
 * (`body`, `z-40`) painted over the sheet's last rows, and a tap there
 * navigated. So the toolbar hides itself while this element — marked
 * `data-select-content` for exactly that — is in the document: see
 * `HorizontalRail`. A caller's own `fixed` chrome in the root stacking
 * context above `z-50` would do the same, and is theirs to manage.
 *
 * # Inside a drawer: one dismissal, not two
 *
 * Radix (under vaul) listens for Escape on the document in the capture
 * phase and for pointer-downs outside the drawer — so an Escape meant for
 * this listbox, the handle's own synthetic Escape, or a tap on the scrim
 * above the drawer each closed the *drawer* too, and focus landed on
 * `<body>`. Two fixes, one per route: Escape is intercepted before Radix
 * sees it (`closeListboxInsideDrawer`); the tap is noted and declined by
 * the drawer (`lib/select-dismissal.ts` — Radix only asks on the `click`
 * after the listbox has already closed, so "is one open now" cannot answer
 * it). Either way the listbox closes alone, focus returns to its trigger,
 * and the next Escape closes the drawer.
 *
 * `data-vaul-no-drag` keeps vaul from treating a drag on the handle, or
 * a scroll of the list, as a drag of the drawer underneath. Without it,
 * in the generic `DrawerContent` (which is not `handleOnly`), a 30px drag
 * of the handle moved the drawer 40px and the sheet 60px — twice the
 * pointer — and a long one closed the drawer.
 *
 * # Motion
 *
 * The sheet rises on `--ease-spatial`/`--dur-spatial` and the scrim
 * fades in on the effects pair, via `@starting-style` (`starting:`).
 * Not Headless UI's `transition` prop: the `portal={false}` comment
 * records that machinery stalling half-open inside a drawer, and
 * `@starting-style` is plain CSS with nothing to stall. It animates the
 * entrance only — the options unmount on close, so there is nothing left
 * to animate out, the same as the dropdown has always done.
 */
export function SelectContent({
  className,
  children,
}: {
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <SelectPopup component="SelectContent" presentation="auto" className={className}>
      {children}
    </SelectPopup>
  );
}

/**
 * The options as a dropdown under the trigger — or, searchable, M3's docked
 * search view — **at every width, phones included**. The opt-out from
 * `SelectContent`'s phone sheet, for the rare select that really is better
 * as a short anchored list on a phone (two or three options inline in a
 * dense form row). Most selects should stay on `SelectContent`.
 */
export function SelectDropdown({
  className,
  children,
}: {
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <SelectPopup component="SelectDropdown" presentation="dropdown" className={className}>
      {children}
    </SelectPopup>
  );
}

/**
 * The options as a modal at every width: the M3 bottom sheet (capped at
 * 640px and centred from `sm` up, `BottomSheetDefaults.SheetMaxWidth`) —
 * or, searchable, the full-screen search view. For a picker that is a
 * decision in its own right even on a desktop, and the presentation a
 * native implementation of these parts would use everywhere.
 */
export function SelectModal({
  className,
  children,
}: {
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <SelectPopup component="SelectModal" presentation="modal" className={className}>
      {children}
    </SelectPopup>
  );
}

export interface SelectItemProps {
  value: string;
  className?: string | undefined;
  children: ReactNode;
  /** The text `SelectSearch` matches this option against, *instead of*
   * the option's own text (the default). Pass it when the children are not
   * plain text (an icon and a name, a formatted number), or to make the
   * option findable by a word it does not show — and then include the
   * label too: `textValue="Cameroon CM"`, not `"CM"`. */
  textValue?: string | undefined;
}

// Row classes per presentation. A dropdown row is the dense desktop row; a
// sheet or full-screen row is an M3 Expressive list item — see the comment
// on the `auto` entry.
const ROW: Record<SelectPresentation, string> = {
  dropdown:
    "relative flex cursor-pointer items-center rounded-sm py-1.5 pr-2 pl-7 text-body text-foreground outline-none data-focus:bg-surface-3",
  auto: cn(
    "relative flex cursor-pointer items-center rounded-sm py-1.5 pr-2 pl-7 text-body text-foreground outline-none data-focus:bg-surface-3",
    // Below `sm`, a row of `SelectContent`'s bottom sheet: an M3
    // Expressive list item (`ListTokens.kt`). 56px one-line height
    // (`ItemOneLineContainerHeight`), 16px of leading and trailing
    // space, 16px label (`BodyLarge`), 12px from a 20px check to the
    // label (`ItemBetweenSpace`). The shape is the Expressive part: a
    // resting row is `CornerExtraSmall` (4px) and the selected one
    // rounds to `CornerLarge` (16px) as it fills, so the current value
    // reads as a different *object* in the list, not just a tinted row.
    // 16px is on no rung of `theme.css`'s audited radius register, and
    // deliberately so, for the same reason `--radius-sheet` is not a
    // rung: it is M3's corner for this one phone-sheet row, not a
    // console surface. It is a literal because nothing else uses it.
    //
    // The fill is `primary` — this library's one neutral accent, the
    // same pill `SideNav`'s toolbar marks the current page with —
    // where M3 reaches for a tonal container, which is a hue here and
    // would read as a status. Focus is a state layer
    // (`FocusStateLayerOpacity` 10%): the foreground over a resting
    // row, and the selected row's own content colour over its fill,
    // each written for its own case so the two rules never fight over
    // the same property — or keyboard focus on the current value would
    // look exactly like no focus at all.
    "max-sm:min-h-14 max-sm:rounded-[4px] max-sm:py-2 max-sm:pr-4 max-sm:pl-12 max-sm:text-title-sm",
    "max-sm:data-focus:not-data-selected:bg-foreground/10",
    "max-sm:data-selected:rounded-[16px] max-sm:data-selected:bg-primary max-sm:data-selected:font-medium max-sm:data-selected:text-primary-content",
    "max-sm:data-selected:data-focus:bg-[color-mix(in_oklab,var(--color-primary)_90%,var(--color-primary-content))]",
    "max-sm:[transition-property:background-color,border-radius]",
    "max-sm:[transition-duration:var(--dur-fast),var(--dur-spatial-fast)]",
    "max-sm:[transition-timing-function:var(--ease-out),var(--ease-spatial-fast)]",
  ),
  modal: cn(
    "relative flex min-h-14 cursor-pointer items-center rounded-[4px] py-2 pr-4 pl-12 text-title-sm text-foreground outline-none",
    "data-focus:not-data-selected:bg-foreground/10",
    "data-selected:rounded-[16px] data-selected:bg-primary data-selected:font-medium data-selected:text-primary-content",
    "data-selected:data-focus:bg-[color-mix(in_oklab,var(--color-primary)_90%,var(--color-primary-content))]",
    "[transition-property:background-color,border-radius]",
    "[transition-duration:var(--dur-fast),var(--dur-spatial-fast)]",
    "[transition-timing-function:var(--ease-out),var(--ease-spatial-fast)]",
  ),
};

const CHECK_SLOT: Record<SelectPresentation, string> = {
  dropdown: "absolute left-2 flex h-3.5 w-3.5 items-center justify-center",
  auto: "absolute left-2 flex h-3.5 w-3.5 items-center justify-center max-sm:left-4 max-sm:size-5",
  modal: "absolute left-4 flex size-5 items-center justify-center",
};

const CHECK_ICON: Record<SelectPresentation, string> = {
  dropdown: "",
  auto: "max-sm:size-5",
  modal: "size-5",
};

export function SelectItem({ value, className, children, textValue }: SelectItemProps) {
  const { engine, query, filtering, registerItem, rememberLabel } = useSelectContext("SelectItem");
  const { presentation } = useContext(PopupContext);
  const shown =
    engine !== "combobox" || !filtering || matchesQuery(textValue ?? textOf(children), query);
  // Counted while shown, before paint, so `SelectEmpty` never flashes —
  // and only in the searchable engine, the one that reads the count: a
  // plain select would pay a re-render per open for nothing.
  useIsomorphicLayoutEffect(
    () => (engine === "combobox" && shown ? registerItem() : undefined),
    [engine, shown, registerItem],
  );
  useIsomorphicLayoutEffect(() => {
    rememberLabel(value, children);
  }, [value, children, rememberLabel]);
  // Not matching the search: not rendered at all, so the combobox's
  // keyboard navigation skips it rather than landing on a hidden row.
  if (!shown) return null;
  const Option = engine === "combobox" ? ComboboxOption : ListboxOption;
  return (
    <Option value={value} className={cn(ROW[presentation], className)}>
      {({ selected }: { selected: boolean }) => (
        <>
          <span className={CHECK_SLOT[presentation]}>
            {selected && (
              <Check
                size={14}
                strokeWidth={1.5}
                aria-hidden="true"
                className={CHECK_ICON[presentation]}
              />
            )}
          </span>
          {/* Two lines, then an ellipsis. An option whose label is a
              sentence used to grow its own row to whatever height it
              needed, so a list of otherwise uniform rows had one tall one
              in the middle and the `max-h-80` scrollport showed a
              different number of options depending on which happened to
              be long. */}
          <span className="line-clamp-2 min-w-0">{children}</span>
        </>
      )}
    </Option>
  );
}

export interface SelectSearchProps {
  placeholder?: string | undefined;
  /** The field's accessible name. Defaults to "Search" followed by the
   * select's own name ("Search Country"), so a screen-reader user hears
   * which picker they are searching. */
  "aria-label"?: string | undefined;
  /** The clear button's accessible name. Defaults to "Clear search". */
  clearLabel?: string | undefined;
  /** Whether `SelectItem`s hide themselves when they do not match. `true`
   * by default; pass `false` when the caller filters or fetches the items
   * itself from `onQueryChange` — `SelectEmpty` then shows whenever the
   * caller renders no items at all. */
  filter?: boolean | undefined;
  /** Called with the search text as it changes, and with `""` when the
   * popup closes. */
  onQueryChange?: ((query: string) => void) | undefined;
  className?: string | undefined;
}

/**
 * An M3 search field inside the popup, and the part that turns a `Select`
 * into a searchable one (the combobox engine — see this file's header).
 * It is lifted into the popup's header wherever it is written among the
 * container's children.
 *
 * The field is M3's search view header: a leading magnifier in the docked
 * view (the back arrow takes that place full-screen), the text in
 * `BodyLarge` (16px) on a phone, and a trailing clear button once there is
 * text to clear. It carries no focus ring of its own: it is the popup's
 * only text field and has focus the whole time the popup is open, so the
 * caret is the indicator — a ring around it would only restate that.
 */
export function SelectSearch({
  placeholder,
  "aria-label": ariaLabel,
  clearLabel = "Clear search",
  onQueryChange,
  className,
}: SelectSearchProps) {
  const { engine, query, setQuery, triggerRef } = useSelectContext("SelectSearch");
  const { presentation } = useContext(PopupContext);
  const fieldRef = useRef<HTMLInputElement | null>(null);
  // Found by walking `Select`'s element tree; if it is not the combobox
  // engine, this part was written inside a component of the caller's that
  // the walk cannot see into. Headless UI would otherwise throw its own
  // "<Combobox.Input /> is missing a parent <Combobox />" on the first
  // open — a crash on a click, naming nothing the caller wrote.
  if (engine !== "combobox") {
    throw new Error(
      "<SelectSearch /> must be written directly among the parts inside <Select> — not from " +
        "inside a component of your own, which <Select> cannot see into when it decides to be " +
        "searchable.",
    );
  }
  const trigger = triggerRef.current;
  const selectName =
    trigger?.getAttribute("aria-label") ?? trigger?.labels?.[0]?.textContent?.trim() ?? "";
  const name = ariaLabel ?? (selectName === "" ? "Search" : `Search ${selectName}`);
  const update = (next: string) => {
    setQuery(next);
    onQueryChange?.(next);
  };
  return (
    <div className={cn("flex min-w-0 flex-1 items-center gap-2 ps-2", className)}>
      <Search
        size={20}
        aria-hidden="true"
        className={cn(
          "shrink-0 text-muted-foreground",
          presentation === "modal" && "hidden",
          presentation === "auto" && "max-sm:hidden",
        )}
      />
      <ComboboxInput
        ref={fieldRef}
        autoFocus
        aria-label={name}
        placeholder={placeholder}
        value={query}
        onChange={(event) => update(event.target.value)}
        className={cn(
          "h-12 min-w-0 flex-1 bg-transparent text-prose text-foreground outline-none placeholder:text-subtle-foreground",
          presentation === "modal" && "text-title-sm",
          presentation === "auto" && "max-sm:text-title-sm",
        )}
      />
      {query !== "" && (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={() => {
            update("");
            fieldRef.current?.focus({ preventScroll: true });
          }}
          className="flex size-12 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground"
        >
          <X size={20} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/**
 * Closes the popup. A public part with a default: a searchable select's
 * full-screen view leads with one as M3's back arrow whenever the caller
 * did not place their own, and a caller can add one anywhere else — a
 * "Done" at the foot of a sheet, say — with any children. The default
 * arrow is named "Back", what it shows — not "Close", which is what the
 * dialogs and drawers it opens inside already call their own buttons.
 *
 * Where it lands depends on where it is written. In a searchable select, a
 * `SelectClose` written directly among the container's parts is lifted into
 * the popup's header — replacing the default back arrow — as an ordinary
 * button. Anywhere else it sits inside the options' `role="listbox"`, which
 * may own options and groups only, so there it is `aria-hidden` and out of
 * the tab order — a redundant pointer affordance, like the drag handle;
 * keyboard and screen-reader users have Escape, which does the same thing.
 * (Measured before: a "Done" wrapped in a `<div>` inside a searchable
 * select was a focusable button in the listbox — axe
 * `aria-required-children`, critical.) That is every `SelectClose` in a
 * plain select, which has no header.
 */
export function SelectClose({
  children,
  className,
  "aria-label": ariaLabel = "Back",
}: {
  children?: ReactNode;
  className?: string | undefined;
  "aria-label"?: string | undefined;
}) {
  const { engine, triggerRef } = useSelectContext("SelectClose");
  const { presentation } = useContext(PopupContext);
  const inList = useContext(InListContext);
  const close = (button: HTMLElement) => {
    if (engine === "combobox") {
      const surface = button.closest<HTMLElement>("[data-select-content]");
      if (surface !== null) closeComboboxPopup(surface, triggerRef.current);
      return;
    }
    // The listbox engine closes on Escape; inside a drawer, `SelectPopup`'s
    // window listener takes this synthetic one before Radix can.
    button
      .closest<HTMLElement>('[role="listbox"]')
      ?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  };
  return (
    <button
      type="button"
      {...(inList
        ? { "aria-hidden": true, tabIndex: -1 }
        : omitUndefined({ "aria-label": children == null ? ariaLabel : undefined }))}
      onClick={(event) => close(event.currentTarget)}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-foreground/8",
        children == null && "size-12",
        // The default back arrow is a phone affordance: in `auto` it goes
        // away where the popup becomes a docked dropdown.
        children == null && presentation === "auto" && "sm:hidden",
        className,
      )}
    >
      {children ?? <ArrowLeft size={24} aria-hidden="true" />}
    </button>
  );
}

/**
 * What a searchable select shows when the search matches nothing. A public
 * part with a default ("No match") that every searchable popup renders on
 * its own, for a caller who wants to say more — "No country matches", or
 * an action to add one. Its text is also what the popup's live region
 * (`role="status"`, mounted for as long as the popup is open) says when
 * the list empties, so a screen-reader user typing hears it; this element
 * itself is plain text, because a region inserted already holding its
 * message is not reliably announced. A plain select, which cannot be
 * searched empty, renders nothing for it.
 */
export function SelectEmpty({ children }: { children?: ReactNode }) {
  const { engine, open, matchCount } = useSelectContext("SelectEmpty");
  const { presentation } = useContext(PopupContext);
  if (engine !== "combobox" || !open || matchCount > 0) return null;
  return (
    <div
      className={cn(
        "px-4 py-6 text-center text-body text-muted-foreground",
        presentation === "modal" && "text-prose",
        presentation === "auto" && "max-sm:text-prose",
      )}
    >
      {children ?? "No match"}
    </div>
  );
}
