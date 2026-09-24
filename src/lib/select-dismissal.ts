/**
 * The pointer-downs that landed outside a `Select`'s open options — the
 * ones whose job was to close *that listbox* — so a surrounding drawer can
 * tell them apart from a tap meant for the drawer itself. An open
 * `DatePicker` notes its own the same way (`useDismissal` in
 * `date-picker.tsx`): the same drawer, the same question.
 *
 * Why an event registry rather than "is a select open right now": Radix's
 * dismissable layer (under vaul) does not judge a pointer-down outside the
 * drawer when it happens. It dispatches `onPointerDownOutside` on the
 * **`click`** that follows — measured in `Select`'s "Inside a drawer"
 * story at 375px, for a mouse as well as a touch: pointerdown 5ms,
 * pointerup 8ms (Headless UI closes the listbox here), click and Radix's
 * `dismissableLayer.pointerDownOutside` 21ms. By the time the drawer asks,
 * the listbox is gone, so "is one open" is always "no", and a tap on the
 * sheet's scrim above the drawer closed the drawer too. The original
 * pointer-down travels with Radix's event (`detail.originalEvent`), so
 * remembering *that event* answers the question at the time it mattered.
 *
 * Not exported from the package: it is the handshake between the popups
 * (`select.tsx`, `date-picker.tsx`) and `drawer.tsx`, nothing a consumer
 * calls. The names still say "select"; both popups depend on them.
 */
const underOpenSelect = new WeakSet<Event>();

/**
 * The same answer for any Radix dismissable layer, not only this library's
 * drawer — a consumer's own Radix dialog, say. Radix decides an outside
 * press in a custom event, `dismissableLayer.pointerDownOutside`,
 * dispatched on the pressed element and cancelable, and dismisses only if
 * nothing prevented it. The event does not bubble, but its capture phase
 * still passes the window, so one listener there declines every event whose
 * original pointer-down a popup noted. Without it, found in review: a
 * Radix overlay that wraps its content (Radix's own "scrollable overlay"
 * layout) is a surface Radix never counts as intercepted, so the press that
 * closed a date picker closed the dialog too; and after a *tap*, whose
 * click is spent, Radix stayed armed and the next click — Enter on the
 * trigger — closed the dialog.
 *
 * The event name is Radix's, not a documented API. If a Radix release
 * renames it, this goes quiet and `e2e/date-picker.spec.ts`'s Radix-dialog
 * tests fail. Installed once, on the first note, and never removed: it acts
 * only on noted events, which live in a `WeakSet`.
 */
let guardingRadix = false;
function guardRadixLayers(): void {
  if (guardingRadix || typeof window === "undefined") return;
  guardingRadix = true;
  window.addEventListener(
    "dismissableLayer.pointerDownOutside",
    (event) => {
      const original = (event as CustomEvent<{ originalEvent?: Event }>).detail?.originalEvent;
      if (wasPointerDownUnderOpenSelect(original)) event.preventDefault();
    },
    true,
  );
}

/** Called by `SelectContent` for every pointer-down outside its open
 * options, and by an open date picker for every one outside it. */
export function notePointerDownUnderOpenSelect(event: Event): void {
  guardRadixLayers();
  underOpenSelect.add(event);
}

/** Whether `event` was a pointer-down that landed while a `Select` was
 * open, outside it — i.e. one that belonged to the listbox, not to
 * whatever was underneath. */
export function wasPointerDownUnderOpenSelect(event: Event | undefined): boolean {
  return event !== undefined && underOpenSelect.has(event);
}
