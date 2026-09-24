/**
 * The pointer-downs that landed outside a `Select`'s open options — the
 * ones whose job was to close *that listbox* — so a surrounding drawer can
 * tell them apart from a tap meant for the drawer itself.
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
 * Not exported from the package: it is the handshake between
 * `select.tsx` and `drawer.tsx`, nothing a consumer calls.
 */
const underOpenSelect = new WeakSet<Event>();

/** Called by `SelectContent` for every pointer-down outside its open
 * options. */
export function notePointerDownUnderOpenSelect(event: Event): void {
  underOpenSelect.add(event);
}

/** Whether `event` was a pointer-down that landed while a `Select` was
 * open, outside it — i.e. one that belonged to the listbox, not to
 * whatever was underneath. */
export function wasPointerDownUnderOpenSelect(event: Event | undefined): boolean {
  return event !== undefined && underOpenSelect.has(event);
}
