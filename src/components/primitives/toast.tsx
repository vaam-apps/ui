"use client";

import { cva } from "class-variance-authority";
import { X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "../../lib/cn";
import { PRESS_SHAPE_MORPH } from "../../lib/press-shape";

/**
 * Toasts, no Radix — `dialog`/`dropdown-menu`/`select`/`tooltip`/`popover`
 * are the five primitives that need Radix's behaviour (design doc T6
 * brief); a toast is a transient, non-modal, non-focus-trapping
 * notification, so a small hand-rolled store is enough.
 *
 * For transient confirmations only ("copied", "saved", "replay queued") —
 * design doc §5.1: anything an operator must act on is inline, never a
 * toast, because a toast that expires while they're reading a payload is a
 * lost message.
 *
 * No enter/exit transition (deliberately, for now): a toast currently
 * appears and vanishes in one frame, and a survivor jumps upward when a
 * card above it expires. `toast()`/`dismissToast()` mutate `toasts`
 * synchronously and `Toaster` renders straight off that array, so an exit
 * animation needs a card to stay mounted, in a "leaving" state, for the
 * duration of its own transition *after* `dismissToast` has already run —
 * a second piece of state this module does not have today, layered on a
 * component with no way to visually check it here (this environment has
 * no browser). Doing that without seeing it animate risks exactly the
 * kind of half-done, silently-wrong motion the brief warns about, so it's
 * left undone rather than guessed at. Whoever adds it should gate it on
 * `motion-reduce:transition-none` per the same reduced-motion rule the
 * rest of the library follows.
 */

export type ToastVariant = "default" | "success" | "danger";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

type Listener = () => void;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ToastItem[] {
  return toasts;
}

export function dismissToast(id: string) {
  const next = toasts.filter((t) => t.id !== id);
  // A toast evicted by the cap keeps its own `setTimeout`, which fires up
  // to `durationMs` later for an id that is already gone. Without this
  // guard that allocated a fresh array with identical contents and
  // `emit()`ed it, re-rendering every subscriber for nothing.
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

// Deliberately unbounded growth was the previous behaviour: nothing capped
// the stack, so ten rapid `toast()` calls produced ten stacked cards —
// 600px of viewport with no ceiling.
const MAX_TOASTS = 4;

/**
 * Enqueues a toast and schedules its own expiry.
 *
 * **Caps the stack at four, dropping the oldest.** This is a deliberate
 * behaviour change, not a pre-existing limit: past four, a toast is no
 * longer something a reader can plausibly read and act on before the next
 * one lands — see the module doc's own "anything an operator must act on
 * is inline, never a toast" rule. A fifth concurrent `toast()` call now
 * silently retires the oldest card instead of growing the stack forever.
 */
export function toast(item: Omit<ToastItem, "id">): string {
  const id = crypto.randomUUID();
  const durationMs = item.durationMs ?? 4000;
  toasts = [...toasts, { ...item, id }].slice(-MAX_TOASTS);
  emit();
  if (durationMs > 0) {
    setTimeout(() => dismissToast(id), durationMs);
  }
  return id;
}

// D11: `cva()` replaces the previous `Record<ToastVariant, string>` lookup,
// same three class strings per variant, keyed identically. One deliberate
// D8 diff lives in the base string below, not here: the shared "toast card"
// classes move off `rounded-sm` (`--radius-field`, 12px) onto `rounded-box`
// (`--radius-box`, 20px) — a toast shares `--shadow-popover` with
// dialog/popover/dropdown/drawer (see `theme.css`'s own "only floating
// layers... get one [shadow]" comment), i.e. it's the same family of
// floating panel those get, not a field-scale control, and D14's own
// drawer sketch (§6.4) already uses `rounded-t-box` for exactly that
// family. `variant` classes themselves are untouched.
const toastVariants = cva(
  "pointer-events-auto rounded-box border p-3 text-body shadow-[var(--shadow-popover)]",
  {
    variants: {
      variant: {
        default: "border-edge bg-surface-2 text-foreground",
        success: "border-state-success-fg/30 bg-surface-2 text-foreground",
        danger: "border-state-danger-border bg-state-danger-bg text-state-danger-fg",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

/**
 * Mount once, near the app root. Renders the live toast stack.
 *
 * # The live region is the container, and only the container
 *
 * `role="status"` used to sit here *alongside* `aria-live="polite"`, and
 * that role carries an **implicit `aria-atomic="true"`** — so every
 * insertion or expiry re-read every toast on screen. Three rapid
 * "Copied" toasts announced as "Copied. Copied. Copied. / Copied.
 * Copied. / Copied." The fix is the explicit `aria-atomic="false"`
 * below; an explicit value always beats a role's implicit default.
 *
 * An earlier attempt also moved `role="status"` onto each card, on the
 * theory that a freshly-inserted node with its own role announces
 * itself. **That is backwards, and it made the bug worse rather than
 * better.** A live region has to be present in the accessibility tree
 * *before* its contents change for the change to be announced — a region
 * inserted already populated is the canonical non-announcement case, and
 * it is why every toast implementation mounts an empty region at the
 * root and injects into it. Worse, for a mutation inside nested live
 * regions the *nearest* region owns the announcement, so a card that is
 * its own region shadows the container that actually can announce. Range
 * of outcomes across assistive tech: "no change" to "the toast is never
 * announced at all".
 *
 * `aria-relevant` was dropped for a smaller reason: its default is
 * `"additions text"`, so removals were never announced and the attribute
 * was fixing nothing — while narrowing it to `"additions"` would have
 * *lost* the announcement if a toast's text ever mutated in place.
 */
export function Toaster() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-2"
    >
      {items.map((item) => (
        <div key={item.id} className={cn(toastVariants({ variant: item.variant ?? "default" }))}>
          <div className="flex items-start justify-between gap-2">
            {/* Two lines for the title, three for the body, both ending in
                an ellipsis. A toast is a fixed 20rem column in the corner
                of the screen; one with a paragraph in it grows upward
                over the content it is reporting on, and a stack of three
                covers half the viewport. Anything that genuinely needs
                more room than this is not a toast — see the module doc:
                anything an operator must act on belongs inline. */}
            <p className="line-clamp-2 min-w-0 font-medium">{item.title}</p>
            {/* Lucide `X` at the same 16px/1.5 stroke every other close in
                the library uses (`dialog.tsx`, `drawer.tsx`) — the literal
                `×` glyph this replaced rendered a different weight and a
                roughly 8×18px box. A -4px resting margin
                (`[--tap-rest:-4px]`, not a `-m-1` utility — `.tap-target`
                writes `margin` itself, D11) against `p-1`: the same
                hit-area idiom
                used there, growing the click target without moving the
                icon. `rounded-full` and `hover:bg-surface-3` match those
                two as well — icon-only controls are circular in this
                package (`button.tsx`'s `icon` size), and a background
                shift gives hover a signal beyond text colour alone.
                `PRESS_SHAPE_MORPH` (`press-shape.ts`) replaces the plain
                `transition-colors` this used to carry with the M3
                Expressive press morph in the same lockstep as `Button
                size="icon"` and `DialogClose`. `[--btn-press-radius:
                calc(24px*0.1)]`: same fixed-box supply `DialogClose`
                needs and for the same reason — see that file's own
                comment on `PRESS_SHAPE_MORPH`'s header. */}
            <button
              type="button"
              onClick={() => dismissToast(item.id)}
              aria-label="Dismiss"
              className={cn(
                "relative shrink-0 rounded-full p-1 text-subtle-foreground hover:bg-surface-3 hover:text-foreground",
                "[--btn-press-radius:calc(24px*0.1)]",
                // D11 (`theme.css`'s own header on `.tap-target`): in
                // normal flow like the drawer close button, so `relative`
                // (added above) gives its cover a positioning context and
                // the target is reserved as margin. `[--tap-rest:-4px]`
                // is the `-m-1` this string used to carry — see that
                // rule's header for why `margin` has exactly one writer.
                "[--tap-rest:-4px] [--tap-size:24px] tap-target",
                PRESS_SHAPE_MORPH,
              )}
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
          {item.description != null && (
            <p className="mt-1 line-clamp-3 text-caption text-muted-foreground">
              {item.description}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
