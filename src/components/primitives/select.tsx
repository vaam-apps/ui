"use client";

import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import { Check, ChevronDown } from "lucide-react";
import {
  Children,
  createContext,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useContext,
  useEffect,
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
 * label. Keyboard behaviour (type-ahead, `Escape`, arrow-key nav) is
 * genuinely Headless UI's own `Listbox`, not reimplemented here — this file
 * only adds the label-lookup Radix's `SelectValue` used to give for free.
 */

interface SelectContextValue {
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
}
const SelectContext = createContext<SelectContextValue | null>(null);

function useSelectContext(component: string): SelectContextValue {
  const ctx = useContext(SelectContext);
  if (ctx === null) {
    throw new Error(`<${component} /> must be rendered inside <Select>.`);
  }
  return ctx;
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

  function handleChange(next: string) {
    if (!isControlled) setInternalValue(next);
    onValueChange?.(next);
  }

  const itemLabel = useMemo(() => (v: string) => findItemLabel(children, v), [children]);

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
      <SelectContext.Provider value={{ value: currentValue, itemLabel, invalid }}>
        {children}
      </SelectContext.Provider>
    </Listbox>
  );
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
  const { invalid } = useSelectContext("SelectTrigger");
  return (
    <ListboxButton
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
    </ListboxButton>
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

/**
 * The drag handle at the top of the phone sheet — M3's `DragHandle`
 * (`SheetDefaults.kt`): a 32×4 bar in `OnSurfaceVariant`
 * (`SheetBottomTokens.DockedDragHandleWidth`/`Height`/`Color`), with 22dp
 * of padding above and below it (`DragHandleVerticalPadding`), so the
 * strip a finger actually grabs is 48px tall. `max-sm:` only — above
 * `sm` the options are a dropdown, which has nothing to drag.
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
function SheetHandle() {
  const drag = useRef<{
    id: number;
    y: number;
    sheet: HTMLElement;
    samples: { t: number; y: number }[];
  } | null>(null);

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

  /** Release velocity in px/ms, `VelocityTracker`-style (see the
   * constants above): the last 100ms of samples, zero if the pointer had
   * stopped for 40ms before it lifted. */
  function releaseVelocity(samples: { t: number; y: number }[], t: number, y: number): number {
    const last = samples[samples.length - 1];
    if (last === undefined || t - last.t > SHEET_VELOCITY_STOPPED) return 0;
    const first = samples.find((sample) => t - sample.t <= SHEET_VELOCITY_HORIZON) ?? last;
    return (y - first.y) / Math.max(1, t - first.t);
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
        "sticky top-0 z-10 -mx-2 hidden cursor-grab touch-none justify-center bg-surface-2 py-[22px] max-sm:flex",
      )}
    >
      <span className="h-1 w-8 rounded-full bg-muted-foreground" />
    </div>
  );
}

/**
 * The options: a dropdown under the trigger from `sm` up, and **below
 * `sm` an M3 modal bottom sheet** — the same element, restyled by a
 * `max-sm:` media query, not a second component chosen by reading the
 * viewport in JS.
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
 * Everything this file's `portal={false}` comment below says still
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
 * already true of the dropdown.
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
 * `<body>`. Two fixes, one per route: Escape is intercepted here, before
 * Radix sees it (`closeListboxInsideDrawer`); the tap is noted here and
 * declined by the drawer (`lib/select-dismissal.ts` — Radix only asks on
 * the `click` after the listbox has already closed, so "is one open now"
 * cannot answer it). Either way the listbox closes alone, focus returns
 * to its trigger, and the next Escape closes the drawer.
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
 * below records that machinery stalling half-open inside a drawer, and
 * `@starting-style` is plain CSS with nothing to stall. It animates the
 * entrance only — the options unmount on close, so there is nothing left
 * to animate out, the same as the dropdown has always done.
 */
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
function closeListboxInsideDrawer(options: HTMLElement) {
  // Found *before* closing: the trigger only carries `aria-controls`
  // while the options it points at exist.
  const trigger = document.querySelector<HTMLElement>(`[aria-controls="${options.id}"]`);
  options.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }),
  );
  trigger?.focus({ preventScroll: true });
}

export function SelectContent({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  useSelectContext("SelectContent");
  const optionsRef = useRef<HTMLElement | null>(null);

  // Escape, caught at the window in the capture phase — the one listener
  // guaranteed to run before Radix's — but only when it is aimed at this
  // open listbox *and* the listbox is inside a vaul drawer. Everywhere
  // else Headless UI's own Escape handling is left alone. The sheet's drag
  // handle dismisses with a synthetic Escape, so it goes through here
  // too. See `closeListboxInsideDrawer` for why this exists at all.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const options = optionsRef.current;
      if (event.key !== "Escape" || options === null) return;
      if (!(event.target instanceof Node) || !options.contains(event.target)) return;
      if (options.closest("[data-vaul-drawer]") === null) return;
      event.stopImmediatePropagation();
      event.preventDefault();
      closeListboxInsideDrawer(options);
    }
    // And every pointer-down outside the open options is noted, so a
    // drawer around this `Select` can tell "a tap that closes the
    // listbox" from "a tap on the drawer's own overlay" when Radix asks it
    // a moment later — see `lib/select-dismissal.ts`.
    function onPointerDown(event: PointerEvent) {
      const options = optionsRef.current;
      if (options === null) return;
      if (event.target instanceof Node && options.contains(event.target)) return;
      notePointerDownUnderOpenSelect(event);
    }
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, []);

  return (
    <ListboxOptions
      ref={optionsRef}
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
      // hides while one is open below `sm` — see this component's doc.
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
      className={cn(
        "absolute top-full left-0 z-50 mt-1 max-h-80 w-full min-w-[8rem] overflow-y-auto rounded-md border border-edge bg-surface-2 p-1 shadow-[var(--shadow-popover)] focus:outline-none",
        // Below `sm`: the M3 modal bottom sheet (this component's doc).
        // The top corners are `SheetBottomTokens.DockedContainerShape`,
        // `CornerExtraLargeTop` (`--radius-sheet`, 28dp), the bottom edge
        // square. The fill stays `surface-2`, the one every floating
        // layer here uses — the dropdown above, and `DetailDrawerContent`'s
        // own phone sheet, which this sheet most often opens over — not
        // M3's `SurfaceContainerLow`, so that a sheet opened from a sheet
        // is the same material as the one under it. `85dvh` is this
        // library's number, not M3's — a modal
        // sheet may grow to the top inset, and a strip of scrim left
        // above it is what says "this is a sheet over the page", not a
        // new page.
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
        className,
      )}
    >
      <SheetHandle />
      {children}
    </ListboxOptions>
  );
}

export function SelectItem({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <ListboxOption
      value={value}
      className={cn(
        "relative flex cursor-pointer items-center rounded-sm py-1.5 pr-2 pl-7 text-body text-foreground outline-none",
        "data-focus:bg-surface-3",
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
        // row, and — below — the selected row's own content colour over
        // its fill, each written for its own case so the two rules never
        // fight over the same property.
        "max-sm:min-h-14 max-sm:rounded-[4px] max-sm:py-2 max-sm:pr-4 max-sm:pl-12 max-sm:text-title-sm",
        "max-sm:data-focus:not-data-selected:bg-foreground/10",
        "max-sm:data-selected:rounded-[16px] max-sm:data-selected:bg-primary max-sm:data-selected:font-medium max-sm:data-selected:text-primary-content",
        // …and the selected row's own focus: the same 10% state layer,
        // in its own content colour over its own fill — M3's rule for a
        // focused filled item — or keyboard focus on the current value
        // would look exactly like no focus at all.
        "max-sm:data-selected:data-focus:bg-[color-mix(in_oklab,var(--color-primary)_90%,var(--color-primary-content))]",
        "max-sm:[transition-property:background-color,border-radius]",
        "max-sm:[transition-duration:var(--dur-fast),var(--dur-spatial-fast)]",
        "max-sm:[transition-timing-function:var(--ease-out),var(--ease-spatial-fast)]",
        className,
      )}
    >
      {({ selected }) => (
        <>
          <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center max-sm:left-4 max-sm:size-5">
            {selected && (
              <Check size={14} strokeWidth={1.5} aria-hidden="true" className="max-sm:size-5" />
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
    </ListboxOption>
  );
}
