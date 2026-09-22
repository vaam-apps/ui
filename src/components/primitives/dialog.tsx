"use client";

import {
  DialogBackdrop,
  DialogPanel,
  Dialog as HeadlessDialog,
  DialogDescription as HeadlessDialogDescription,
  DialogTitle as HeadlessDialogTitle,
} from "@headlessui/react";
import { X } from "lucide-react";
import {
  type ComponentPropsWithoutRef,
  createContext,
  type ElementType,
  type MouseEvent,
  type ReactNode,
  useContext,
  useState,
} from "react";
import { cn } from "../../lib/cn";
import { PRESS_SHAPE_MORPH } from "../../lib/press-shape";

interface DialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}
const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext(component: string): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (ctx === null) {
    throw new Error(`<${component} /> must be rendered inside <Dialog>.`);
  }
  return ctx;
}

/**
 * Note the `| undefined` on the optional props below. This package
 * compiles under `exactOptionalPropertyTypes`, where a bare `open?:
 * boolean` means "you may omit this key" and NOT "you may pass
 * `undefined`" — so the ordinary controlled pattern,
 * `const [open, setOpen] = useState<boolean>()` followed by `open={open}`,
 * was a type error here (see `Select` in `select.tsx` for the same rule
 * spelled out in full, including where it was found).
 */
export interface DialogProps {
  open?: boolean | undefined;
  defaultOpen?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  children: ReactNode;
}

/**
 * D3: Radix `Dialog` → Headless UI `Dialog`/`DialogPanel`/`DialogTitle`/`DialogBackdrop`.
 *
 * `Dialog` itself is **not** a Headless UI component — it's a plain context
 * provider. Headless UI's own `Dialog` only wraps the modal
 * backdrop/panel (`DialogContent` below) and is controlled-only
 * (`open`/`onClose`); it has no equivalent to Radix's `Dialog.Trigger`,
 * which rendered in place (outside any portal) and could itself drive an
 * *uncontrolled* open state. Two real consumers need both shapes:
 * `providers-screen.tsx`'s edit dialog is fully controlled
 * (`open={selectedId !== null}`, no `DialogTrigger` at all), while the
 * gallery's demo dialog is uncontrolled, opened by its own in-place
 * `DialogTrigger`. This root supplies the open/close plumbing for both,
 * the same controlled/uncontrolled duality `Select` (D17) uses.
 */
export function Dialog({ open, defaultOpen = false, onOpenChange, children }: DialogProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const currentOpen = isControlled ? open : internalOpen;

  function setOpen(next: boolean) {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  }

  return (
    <DialogContext.Provider value={{ open: currentOpen, setOpen }}>
      {children}
    </DialogContext.Provider>
  );
}

type TriggerProps<T extends ElementType> = { as?: T } & Omit<ComponentPropsWithoutRef<T>, "as">;

/**
 * Renders in place, not portaled — `as` selects the rendered element/component,
 * matching Headless UI's own polymorphism convention rather than Radix's
 * `asChild` (D4 already retired that pattern for `Button`; this is the
 * identical call applied to a trigger). Replaces
 * `<DialogTrigger asChild><Button variant="secondary">…</Button></DialogTrigger>`
 * with `<DialogTrigger as={Button} variant="secondary">…</DialogTrigger>`
 * (the gallery's own only consumer, updated in this same change).
 */
export function DialogTrigger<T extends ElementType = "button">({
  as,
  onClick,
  ...props
}: TriggerProps<T>) {
  const { setOpen } = useDialogContext("DialogTrigger");
  const Component = (as ?? "button") as ElementType;
  return (
    <Component
      // `type="button"` unless the caller is rendering a non-button tag.
      //
      // This was `as === undefined ? "button" : undefined`, which is the
      // one case it needed to cover and one it missed: `as={Button}`
      // renders a `<button>` with no `type`, and HTML's default for that
      // is `submit`. So `<DialogTrigger as={Button}>` inside a `<form>`
      // **submitted the form** on its way to opening the dialog — the
      // most natural way to write it, and silent.
      //
      // Any component could render a button, so the test is inverted:
      // only an intrinsic tag that is definitely not a button (`a`,
      // `div`) gets no `type`. `{...props}` still spreads after this, so
      // a caller who genuinely wants a submit can say so.
      type={typeof Component === "string" && Component !== "button" ? undefined : "button"}
      onClick={(event: MouseEvent) => {
        (onClick as ((e: MouseEvent) => void) | undefined)?.(event);
        setOpen(true);
      }}
      {...props}
    />
  );
}

/** Unconsumed today (grepped across `admin/`) — kept for API parity. Same
 * `as`-polymorphic shape as `DialogTrigger`. */
export function DialogClose<T extends ElementType = "button">({
  as,
  onClick,
  ...props
}: TriggerProps<T>) {
  const { setOpen } = useDialogContext("DialogClose");
  const Component = (as ?? "button") as ElementType;
  return (
    <Component
      // See `DialogTrigger` above — same trap, same fix. A close button
      // that submits the form it sits inside is worse, if anything.
      type={typeof Component === "string" && Component !== "button" ? undefined : "button"}
      onClick={(event: MouseEvent) => {
        (onClick as ((e: MouseEvent) => void) | undefined)?.(event);
        setOpen(false);
      }}
      {...props}
    />
  );
}

// Radius bumps to --radius-md here on purpose (design doc §3.5, unchanged by
// D8's radius-scale rewrite — see theme.css): a floating layer reads as
// detached from the grid beneath it.
/**
 * `DialogPanel` is a bounded `flex flex-col`, not a plain padded box.
 *
 * The panel sits in `fixed inset-0 flex items-center justify-center`, so a
 * body taller than the viewport used to overflow **both** ends at once:
 * `DialogFooter`'s buttons went off the bottom, and the close button (an
 * `absolute top-4 right-4` child of the panel) went off the top along with
 * it. Escape and backdrop-click still worked, so nothing trapped the user,
 * but every footer action was unreachable.
 *
 * The obvious fix — `overflow-y-auto` on `DialogPanel` itself — creates a
 * second bug instead of fixing the first: the close button is an
 * `absolute` child of that same element, and an absolutely positioned
 * descendant of a scrolling box scrolls *with* the box (its containing
 * block is the padding edge of the scrollport, which travels with the
 * content). The button would still be reachable, but it would travel up
 * out of view as soon as the body scrolled down — reachable at the top of
 * the scroll and gone everywhere else.
 *
 * So the scrolling element and the close button's containing block are
 * two different boxes:
 *
 * - `DialogPanel` itself never scrolls. It is `flex flex-col`,
 *   `overflow-hidden` (so the rounded corners still clip), and bounded by
 *   `max-h-[85vh]` — a cap, not a fixed height, so a short dialog sizes to
 *   its content exactly as before and never shows a scrollbar.
 * - `children` (`DialogHeader`, the caller's own content, `DialogFooter`,
 *   all flat siblings — this component has no way to tell them apart)
 *   render inside one `flex-1 min-h-0 overflow-y-auto` wrapper. `min-h-0`
 *   is required: a flex item's default `min-height: auto` refuses to
 *   shrink below its content's height, which would silently defeat the
 *   `overflow-y-auto` above it.
 * - The close button is a **sibling** of that wrapper, still a direct
 *   `absolute` child of `DialogPanel`. Its containing block never
 *   scrolls, so `top-4 right-4` stays pinned regardless of how far the
 *   body has scrolled.
 * - `DialogHeader`/`DialogFooter` stay visually pinned to the top/bottom
 *   of the *visible* panel — not just present somewhere in the scroll —
 *   via `sticky top-0`/`sticky bottom-0` declared on those two components
 *   themselves (below), each with an opaque `bg-surface-2` so scrolled
 *   content doesn't show through underneath them. Because they are
 *   ordinary flow children of the scrolling wrapper (first and last,
 *   respectively, in every real usage), sticky positioning holds them at
 *   the wrapper's own top/bottom edge without this component needing to
 *   single them out from `children`.
 *
 * Net effect: short dialogs are pixel-identical to before (auto height,
 * no scrollbar); a body taller than `85vh` scrolls internally, with the
 * header and footer — and the close button — always in reach.
 */
export function DialogContent({ className, children, ...props }: ComponentPropsWithoutRef<"div">) {
  const { open, setOpen } = useDialogContext("DialogContent");
  return (
    <HeadlessDialog open={open} onClose={setOpen} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-scrim duration-150 ease-out data-closed:opacity-0"
      />
      <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
        <DialogPanel
          transition
          className={cn(
            "relative flex max-h-[85vh] w-full max-w-[480px] flex-col overflow-hidden rounded-md border border-edge bg-surface-2 shadow-[var(--shadow-dialog)]",
            // Spatial (scale), M3 Expressive — but the *default* pair
            // (`--dur-spatial` / `--ease-spatial`, z 0.8, 1.5% overshoot),
            // not `-fast`: this panel is a full modal surface, not a
            // small local one, and the fast spring's 9.5% bounce reads
            // right on a menu but gets increasingly odd the bigger the
            // thing bouncing is. See `date-picker.tsx`'s `PANEL_CLASS` for
            // why opacity rides the same duration/easing rather than
            // getting its own. The backdrop above stays on `--ease-out` —
            // it only fades, nothing about it is spatial.
            "duration-[var(--dur-spatial)] ease-[var(--ease-spatial)] data-closed:scale-95 data-closed:opacity-0",
            className,
          )}
          {...props}
        >
          <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
          {/* `-m-1 p-1`: grows the hit target to **24×24px** — a 16px icon
              plus 4px of padding each side. This comment said 32×32px
              until a browser measured it; 24 is exactly WCAG 2.2
              §2.5.8's floor with nothing to spare, and `e2e/geometry.spec.ts`
              pins it so it cannot shrink. Without
              moving the icon itself — the button's visual position (and
              therefore the `right-4`/`top-4` offset every dialog author
              sees) is unchanged, only its padding/margin box grows to
              absorb it. Matches `drawer.tsx`'s close button, which needs
              the same fix for the same reason.

              `rounded-full`, not `rounded-sm`: icon-only controls are
              circular in this package (see `button.tsx`'s `icon` size) —
              a label-less control reads as "acts on the thing beside it",
              which a circle communicates and a rounded rectangle doesn't.
              `hover:bg-surface-3` gives the hover state something besides
              a text-colour change to register, matching the icon-button
              hover already used in `calendar.tsx`; focus already gets a
              ring for free from `theme.css`'s global `:focus-visible`
              rule, so no separate focus treatment is needed here.

              `z-20`: a sibling of the scrolling wrapper above, not a
              descendant of it (see the module doc) — painted after it in
              DOM order, which already puts it on top, but the explicit
              `z-20` keeps that true even if `DialogHeader`'s own `z-10`
              (needed so its sticky background occludes scrolled content)
              ever changes.

              `PRESS_SHAPE_MORPH` (see `press-shape.ts`) replaces the
              plain `transition-colors` this used to carry — it already
              covers `color`/`background-color`, and folds in the M3
              Expressive press morph: this circle steps to a
              size-proportional radius while held and springs back on
              release, in lockstep with `Button size="icon"` per that
              file's own comment. `[--btn-press-radius:calc(24px*0.1)]`:
              `PRESS_SHAPE_MORPH` reads that custom property rather than
              naming a value itself (see its own header, "D10"), and this
              is a fixed 24×24 box (16px icon, `-m-1 p-1` above) rather
              than a `--size`-driven `.btn`/`.btn-circle`, so this call
              site supplies it directly — the same 0.1 circular ratio
              `.btn-circle` uses in `theme.css`, applied to its own known
              box. */}
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className={cn(
              "-m-1 absolute top-4 right-4 z-20 rounded-full p-1 text-subtle-foreground hover:bg-surface-3 hover:text-foreground",
              "[--btn-press-radius:calc(24px*0.1)]",
              PRESS_SHAPE_MORPH,
            )}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </DialogPanel>
      </div>
    </HeadlessDialog>
  );
}

/**
 * `pr-8` reserves a gutter for the close button rendered by `DialogContent`
 * (`absolute top-4 right-4` around a 16px icon, positioned against
 * `DialogPanel`'s own padding edge). The scrolling wrapper `DialogContent`
 * renders `children` into is `p-6` (24px), so the content column already
 * ends 24px from the panel's edge, but the button's own box runs from
 * 16px to 32px inset — 8px *inside* that column with no gutter here.
 * Every existing story uses a short title, so the overlap has never
 * rendered; `ConfirmDialog`'s `max-w-sm` panel makes it more likely once a
 * title is long enough to wrap. `pr-8` (32px) puts the header's own right
 * edge safely past the button's 32px-inset extent, with room to spare.
 *
 * `sticky -top-6`, not `top-0` — and the `-6` is load-bearing. A sticky
 * offset is measured from the scrollport's **content** edge, and the
 * wrapper `DialogContent` renders `children` into is `p-6`. So `top-0`
 * pins the header 24px *below* the top of the visible scroll area,
 * leaving a 24px band above it in which the scrolled body stays visible
 * and slides past — the exact artefact the edge-extension below exists to
 * prevent, reintroduced on the one side that matters most. Measured
 * rather than reasoned about: with `top-0` the scrollport's own top was
 * 55px and the stuck header's was 79px; `-top-6` puts it at 55px, flush.
 * `DialogFooter` carries the mirrored `-bottom-6` for the same reason.
 *
 * See `DialogContent`'s module doc for the full mechanism
 * — this, not `DialogContent`, is what keeps the header at the top of the
 * *visible* panel while a tall body scrolls underneath it, since
 * `DialogContent` has no way to single header/body/footer out of its flat
 * `children`. `-mx-6 -mt-6 px-6 pt-6` extends the sticky box out to the
 * scrolling wrapper's own edges (undoing that wrapper's `p-6` on this
 * element's three outer sides, then reapplying it as this element's own
 * padding) so `bg-surface-2` actually reaches the wrapper's left/right
 * edges and top — without that, the header would still stick, but a
 * 24px-wide sliver of scrolled content would remain visible around it,
 * peeking out from the padding `DialogContent`'s wrapper never removes on
 * a `position: sticky` element (padding is not part of what `sticky`
 * anchors to the scrollport edge).
 */
export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "-mx-6 -mt-6 sticky -top-6 z-10 mb-4 flex flex-col gap-1 bg-surface-2 px-6 pt-6 pr-8",
        className,
      )}
      {...props}
    />
  );
}

/** #56: the confirm/requeue dialog's own action row. Mirrors `DialogHeader`'s
 * shape (a thin, class-composing div, not a Headless-UI-wrapped primitive —
 * a footer has no accessibility semantics either library needs to own).
 *
 * `sticky bottom-0` + the `-mx-6 -mb-6 px-6 pb-6` edge-extension: the same
 * mechanism as `DialogHeader`'s `sticky top-0`, mirrored to the bottom of
 * the scrolling wrapper `DialogContent` renders `children` into — see
 * that header's own comment and `DialogContent`'s module doc for why this
 * lives here rather than in `DialogContent` itself. */
export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "-mx-6 -mb-6 sticky -bottom-6 z-10 mt-6 flex items-center justify-end gap-2 bg-surface-2 px-6 pt-2 pb-6",
        className,
      )}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof HeadlessDialogTitle>) {
  return (
    <HeadlessDialogTitle
      // `font-display`/`tracking-normal`: `theme.css`'s own doc on
      // `--font-display` names "card and dialog headings" outright — see
      // `card.tsx`'s `CardHeader` comment for why the tracking reset is
      // needed (the global `html { letter-spacing: -0.011em }` was tuned
      // for the sans body face, not this serif).
      className={cn(
        "font-display font-medium text-foreground text-title-sm tracking-normal",
        className,
      )}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof HeadlessDialogDescription>) {
  return (
    <HeadlessDialogDescription
      className={cn("text-muted-foreground text-prose", className)}
      {...props}
    />
  );
}
