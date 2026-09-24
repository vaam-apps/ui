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
  isValidElement,
  type MouseEvent,
  type ReactNode,
  useContext,
  useState,
} from "react";
import { cn } from "../../lib/cn";
import { flattenParts } from "../../lib/parts";
import { PRESS_SHAPE_MORPH } from "../../lib/press-shape";

interface DialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}
const DialogContext = createContext<DialogContextValue | null>(null);

/**
 * Which presentation part a dialog's contents are inside. `basic` is M3's
 * basic dialog at every width (`DialogContent`); `fullscreen` is M3's
 * full-screen dialog below `sm` and the basic dialog from `sm` up
 * (`DialogFullScreen`). The chrome parts read it to decide where they sit.
 */
type DialogPresentation = "basic" | "fullscreen";
const PresentationContext = createContext<DialogPresentation>("basic");

/**
 * The props every layout and presentation part takes: a class and its
 * children, nothing DOM-only beyond them — AGENTS.md's rule for compound
 * parts, so a native implementation can share the contract (a maintainer's
 * call when this component was reworked). Before 0.3.0 these parts passed
 * every `div` attribute through.
 */
interface DialogPartProps {
  className?: string | undefined;
  children?: ReactNode;
}

/** `true` inside `DialogActions` — where a `DialogClose` is a dismiss
 * *action*, which the full-screen dialog's own close icon replaces. */
const InActionsContext = createContext(false);

/** `true` only around the close icon the surface places itself — the
 * default one, or a bare `DialogClose` lifted from among its direct parts.
 * Only that one is chrome: a bare `DialogClose` written anywhere else is an
 * icon button where it stands. Without this, one inside `DialogActions`
 * took the chrome's absolute position too and drew a second close icon on
 * top of the default — in the basic dialog's corner and in the full-screen
 * bar alike (found in review). */
const ChromeSlotContext = createContext(false);

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

/**
 * Closes the dialog — as its chrome, or as anything you render.
 *
 * **As chrome** (no children, no `as`): the icon button every dialog shows
 * unless you place your own. `DialogContent` and `DialogFullScreen` render
 * one by default; write `<DialogClose aria-label="Dismiss" />` among their
 * direct parts to replace it (it is lifted into the same spot). In the
 * basic dialog it is the ✕ in the top-right corner. In the full-screen
 * dialog below `sm` it is the top bar's leading close icon — M3's
 * full-screen dialog leads its bar with one. Written anywhere else — inside
 * `DialogActions`, or your own element — a bare `DialogClose` is a plain ✕
 * icon button where you put it, not a second chrome icon.
 *
 * **As an action** (children, or `as={Button}`): closes the dialog on
 * click and renders whatever you give it, `type="button"` unless you say
 * otherwise. Written inside `DialogActions` it is the dismiss action
 * ("Cancel"), and the full-screen dialog below `sm` hides it: its bar's
 * close icon already is that action, and M3's full-screen dialog carries
 * only the confirming one in its bar.
 */
export function DialogClose<T extends ElementType = "button">({
  as,
  onClick,
  className,
  children,
  ...props
}: TriggerProps<T>) {
  const { setOpen } = useDialogContext("DialogClose");
  const presentation = useContext(PresentationContext);
  const inActions = useContext(InActionsContext);
  const inChromeSlot = useContext(ChromeSlotContext);
  // A dismiss action, which the full-screen bar's own close icon replaces.
  const hiddenInBar = inActions && presentation === "fullscreen" && "max-sm:hidden";
  const close = (event: MouseEvent) => {
    (onClick as ((e: MouseEvent) => void) | undefined)?.(event);
    setOpen(false);
  };

  if (as === undefined && children == null) {
    const { "aria-label": ariaLabel = "Close", ...rest } = props as { "aria-label"?: string };
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={close}
        className={cn(
          inChromeSlot ? CLOSE_CHROME[presentation] : cn(CLOSE_INLINE, hiddenInBar),
          className as string | undefined,
        )}
        {...rest}
      >
        <X
          aria-hidden="true"
          strokeWidth={1.5}
          className={cn("size-4", inChromeSlot && presentation === "fullscreen" && "max-sm:size-6")}
        />
      </button>
    );
  }

  const Component = (as ?? "button") as ElementType;
  return (
    <Component
      // See `DialogTrigger` above — same trap, same fix. A close button
      // that submits the form it sits inside is worse, if anything.
      type={typeof Component === "string" && Component !== "button" ? undefined : "button"}
      onClick={close}
      className={cn(hiddenInBar, className)}
      {...props}
    >
      {children}
    </Component>
  );
}

/**
 * The close icon's classes, per presentation.
 *
 * `-m-1 p-1` grows the basic dialog's ✕ to a **24×24px** hit target — a
 * 16px icon plus 4px of padding each side. This comment said 32×32px
 * until a browser measured it; 24 is exactly WCAG 2.2 §2.5.8's floor with
 * nothing to spare, and `e2e/geometry.spec.ts` pins it so it cannot
 * shrink. `rounded-full`: icon-only controls are circular in this package
 * (`button.tsx`'s `icon` size). The hover is a state layer —
 * `foreground` at 8%, M3's hover opacity (`StateTokens`), as `SelectClose`
 * uses — because the panel is `surface-3` now and a `surface-3` hover
 * fill would not show on it. Focus gets its ring from `theme.css`'s
 * global `:focus-visible`.
 *
 * `z-20`: a sibling of the scrolling wrapper, not a descendant (see
 * `DialogSurface`), painted over `DialogHeader`'s sticky `z-10`.
 *
 * `PRESS_SHAPE_MORPH` (`press-shape.ts`) folds in the M3 Expressive press
 * morph; `[--btn-press-radius:calc(24px*0.1)]` is the value it reads for a
 * fixed 24×24 box, the same 0.1 ratio `.btn-circle` uses.
 *
 * D11 (`theme.css`, `.tap-target`): absolutely positioned, so it takes the
 * `-anchored` variant — margin on a box with an inset *moves* it. `top-4
 * right-4` with `-m-1` puts the box 12px from the panel's padding edge on
 * both axes, exactly the 12px each side a 24px box needs to reach 48, and
 * `DialogHeader`'s gutter is the reservation beside it.
 *
 * Full-screen, below `sm`, it is M3's top-app-bar navigation icon
 * instead: a 48dp button with a 24dp icon (`AppBarTokens.IconSize`),
 * `LeadingSpace` 4dp from the edge, centred in the 64dp bar
 * (`AppBarSmallTokens.ContainerHeight`), so 8px from the top. At 48px it
 * is its own tap target, so `--tap-size` says 48 and the cover adds
 * nothing.
 */
/** A bare `DialogClose` anywhere but the chrome slot: the same 16px icon in
 * the same 24px circle as the drawer's in-flow close button
 * (`drawer.tsx`), with its in-flow tap target — `[--tap-rest:-4px]` against
 * `p-1`, `.tap-target` reserving the room in flow (D11). */
const CLOSE_INLINE = cn(
  "relative inline-flex shrink-0 items-center justify-center rounded-full p-1 text-subtle-foreground hover:bg-foreground/8 hover:text-foreground",
  "[--btn-press-radius:calc(24px*0.1)] [--tap-rest:-4px] [--tap-size:24px] tap-target",
  PRESS_SHAPE_MORPH,
);

const CLOSE_CHROME: Record<DialogPresentation, string> = {
  basic: cn(
    "-m-1 absolute top-4 right-4 z-20 rounded-full p-1 text-subtle-foreground hover:bg-foreground/8 hover:text-foreground",
    "[--btn-press-radius:calc(24px*0.1)] [--tap-size:24px] tap-target-anchored",
    PRESS_SHAPE_MORPH,
  ),
  fullscreen: cn(
    "-m-1 absolute top-4 right-4 z-20 rounded-full p-1 text-subtle-foreground hover:bg-foreground/8 hover:text-foreground",
    "[--btn-press-radius:calc(24px*0.1)] [--tap-size:24px] tap-target-anchored",
    PRESS_SHAPE_MORPH,
    "max-sm:top-[calc(env(safe-area-inset-top,0px)+0.5rem)] max-sm:right-auto max-sm:left-[calc(env(safe-area-inset-left,0px)+0.25rem)] max-sm:m-0 max-sm:flex max-sm:size-12 max-sm:items-center max-sm:justify-center max-sm:p-0 max-sm:text-foreground",
    "max-sm:[--btn-press-radius:calc(48px*0.1)] max-sm:[--tap-size:48px]",
  ),
};

/**
 * The panel, one per presentation, sharing everything below.
 *
 * # M3's basic dialog (`DialogTokens.kt`, `AlertDialog.kt`)
 *
 * - Corners `CornerExtraLarge`, 28dp: `--radius-sheet`, the same M3 token
 *   the bottom sheets wear (`theme.css` says why one value serves both).
 * - Fill `SurfaceContainerHigh`, which this library maps to `surface-3`
 *   (as the full-screen search view in `select.tsx` does). `surface-3` is
 *   also this library's hover and selected fill, so everything inside
 *   the panel reads its surfaces one step up (`surface-raised`,
 *   `theme.css`); the panel's own fill is captured as `--dialog-fill`
 *   before that shift.
 * - Width: M3 sizes the dialog to its content between 280dp and 560dp
 *   (`DialogMinWidth`/`DialogMaxWidth`, `AlertDialog.kt`'s `sizeIn`).
 *   This panel is `w-full` up to that 560, so it does not change width
 *   as its content does — a library choice. On a 320px phone the
 *   container's 16px inset leaves 288.
 * - Padding 24dp, 20dp for a precise pointer
 *   (`AlertDialogDefaults.dialogPadding`, via
 *   `shouldUsePrecisionPointerComponentSizing`), carried as
 *   `--dialog-pad` so the sticky header and actions extend to the same
 *   edge — `pointer-fine:` is the web's reading of the same question.
 * - A shadow, `--shadow-dialog`: this panel is the *floating* register
 *   (AGENTS.md), a shadow because it overlaps a ground it does not know.
 *   Not a transcription — `DialogTokens.ContainerElevation` names Level3,
 *   but Compose's `AlertDialog` draws no shadow at all (tonal elevation
 *   0). The `border` is gone; the 1px `--edge` ring `--shadow-dialog`
 *   carries is the one hairline left.
 *
 * It fades in on the effects spring and no longer scales. A `scale` makes
 * the panel a containing block for `position: fixed` descendants for as
 * long as it applies, and it clips — a `Select` opened inside during the
 * 435ms enter was placed against the half-scaled panel, then jumped
 * (measured in #32: flipped above its trigger for 360–440ms). A fade has
 * no such side effect.
 *
 * # M3's full-screen dialog, below `sm` (`DialogFullScreen`)
 *
 * The panel fills the screen with square corners on the page's own
 * `base-100` (`AppBarTokens.ContainerColor` is `Surface`), and a 64dp top
 * bar (`AppBarSmallTokens.ContainerHeight`) is reserved above the
 * scrolling body, below the top safe-area inset (a notch, a status bar in
 * a `viewport-fit=cover` web app), as the full-screen search view in
 * `select.tsx` does; the close icon, the actions and the body's last line
 * clear the insets too. Headless Chromium reports every inset as 0, so
 * the e2e suite checks the geometry without them; with them, it is not
 * measured here. The bar holds the close icon, leading, and
 * `DialogActions`, trailing — both positioned into it against this
 * panel, so neither moves in the DOM or scrolls with the body. Compose M3
 * has no full-screen dialog tokens of its own; the bar is its small top
 * app bar, a library choice.
 *
 * # Why the scrolling wrapper and the close button are siblings
 *
 * The panel sits in `fixed inset-0 flex items-center justify-center`, so a
 * body taller than the viewport used to overflow **both** ends at once:
 * the footer's buttons went off the bottom, the close button off the top.
 * `overflow-y-auto` on the panel itself would make the close button (an
 * `absolute` child of that same element) scroll *with* the content. So:
 *
 * - The panel never scrolls. It is `flex flex-col`, `overflow-hidden` (so
 *   the rounded corners clip), bounded by `max-h-[85vh]` — a cap, not a
 *   height, so a short dialog sizes to its content.
 * - The parts render inside one `flex-1 min-h-0 overflow-y-auto` wrapper.
 *   `min-h-0` is required: a flex item's `min-height: auto` refuses to
 *   shrink below its content, silently defeating the scroll.
 * - The close button is a **sibling** of that wrapper, a direct `absolute`
 *   child of the panel, so it never scrolls. `DialogActions` in the
 *   full-screen bar is `absolute` too, and since the wrapper is not
 *   positioned, its containing block is this panel as well.
 * - `DialogHeader`/`DialogActions` stay pinned to the top/bottom of the
 *   *visible* panel via `sticky`, each with an opaque fill.
 */
function DialogSurface({
  presentation,
  className,
  children,
}: DialogPartProps & { presentation: DialogPresentation }) {
  const { open, setOpen } = useDialogContext(
    presentation === "basic" ? "DialogContent" : "DialogFullScreen",
  );
  const fullscreen = presentation === "fullscreen";
  // A chrome `DialogClose` written among the parts replaces the default;
  // it is lifted out of the scrolling body into the chrome's own spot.
  const parts = flattenParts(children);
  const isChromeClose = (part: ReactNode) =>
    isValidElement(part) &&
    part.type === DialogClose &&
    (part.props as { as?: unknown }).as === undefined &&
    (part.props as { children?: unknown }).children == null;
  const ownClose = parts.find(isChromeClose);
  const body = parts.filter((part) => !isChromeClose(part));
  return (
    // `outline-none`: Headless UI focuses this root — a zero-height,
    // `tabindex="-1"` container — when the dialog opens, and on a
    // keyboard-driven open the global `:focus-visible` ring drew 2px
    // around it: measured, a line across the page at the root's position,
    // behind the scrim, for as long as the dialog stayed open. It is not a
    // control; focus moves on into the panel from there.
    <HeadlessDialog open={open} onClose={setOpen} className="relative z-50 outline-none">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-scrim duration-150 ease-out data-closed:opacity-0"
      />
      <div
        className={cn(
          "fixed inset-0 flex w-screen items-center justify-center p-4",
          // The panel's own fill, captured *here*: the panel's
          // `surface-raised` moves every surface token up a step for
          // everything inside it (see that utility in `theme.css`),
          // including the sticky header and actions that wear this fill.
          "[--dialog-fill:var(--color-surface-3)]",
          fullscreen && "max-sm:p-0 max-sm:[--dialog-fill:var(--color-base-100)]",
        )}
      >
        <PresentationContext.Provider value={presentation}>
          <DialogPanel
            transition
            className={cn(
              "relative flex max-h-[85vh] w-full max-w-[560px] flex-col overflow-hidden rounded-sheet bg-(--dialog-fill) shadow-[var(--shadow-dialog)]",
              // Full-screen below `sm`, the panel is the page's own ground,
              // and what is inside it reads as on a page: no shift there.
              fullscreen ? "sm:surface-raised" : "surface-raised",
              "[--dialog-pad:24px] pointer-fine:[--dialog-pad:20px]",
              "[--dialog-text-pad:24px] pointer-fine:[--dialog-text-pad:16px]",
              "duration-[var(--dur-effects)] ease-[var(--ease-effects)] data-closed:opacity-0",
              fullscreen &&
                "max-sm:h-dvh max-sm:max-h-none max-sm:max-w-none max-sm:rounded-none max-sm:shadow-none max-sm:pt-[env(safe-area-inset-top,0px)]",
              className,
            )}
          >
            {fullscreen && <div aria-hidden="true" className="h-16 shrink-0 sm:hidden" />}
            <div
              className={cn(
                "min-h-0 flex-1 overflow-y-auto p-(--dialog-pad)",
                fullscreen && "max-sm:pb-[max(var(--dialog-pad),env(safe-area-inset-bottom,0px))]",
              )}
            >
              {body}
            </div>
            <ChromeSlotContext.Provider value={true}>
              {ownClose ?? <DialogClose />}
            </ChromeSlotContext.Provider>
          </DialogPanel>
        </PresentationContext.Provider>
      </div>
    </HeadlessDialog>
  );
}

/**
 * M3's basic dialog, at every width: centred, 28dp corners, up to 560px
 * wide. The default for anything short — a confirmation, a few fields.
 * See `DialogSurface` for the tokens.
 */
export function DialogContent(props: DialogPartProps) {
  return <DialogSurface presentation="basic" {...props} />;
}

/**
 * M3's full-screen dialog below `sm`, the basic dialog from `sm` up — for
 * a long or form-heavy dialog that a phone should give the whole screen.
 * Below `sm` a 64dp top bar leads with the close icon and carries
 * `DialogActions` trailing, a `DialogClose` among them hidden (the icon is
 * that action). Write the same parts as for `DialogContent`; only the
 * container changes. Chosen by CSS breakpoint, like `SelectContent`: a
 * native implementation would read a window-size class instead.
 */
export function DialogFullScreen(props: DialogPartProps) {
  return <DialogSurface presentation="fullscreen" {...props} />;
}

/**
 * The headline and its supporting text, held at the top of the visible
 * panel while a long body scrolls.
 *
 * M3's spacing: 16dp between the headline and what follows
 * (`AlertDialog.kt`'s `TitlePadding`), which is the `gap-4` here and the
 * `mb-4` before the body.
 *
 * The gutter on the right is the room the ✕ needs: it is `absolute` in
 * the top-right corner, and with its `-m-1 p-1` its box runs from 12px to
 * 36px in from the panel's edge. `pr-8` keeps a long headline 32px in —
 * 4px short of that box at compact, which `e2e/tap-targets.spec.ts`
 * already calls slightly optimistic; the gap to the icon itself (16–32px
 * in) is clear. D11: the gutter grows with `--density` to 48px at
 * comfortable, where the close button's *tap target* ends
 * (`theme.css`'s `.tap-target-anchored`), and that spec gates it. Written as one `calc`, not a breakpoint variant, because `--density`
 * is a subtree axis.
 *
 * `sticky -top-(--dialog-pad)`, not `top-0`: a sticky offset is measured
 * from the scrollport's *content* edge, and the wrapper is padded by
 * `--dialog-pad`, so `top-0` pinned the header that far below the visible
 * top and let the body slide past above it (measured with 24px: scrollport
 * top 55px, header 79px). The negative margins and matching padding
 * extend the opaque fill to the wrapper's edges, so no sliver of scrolled
 * content peeks out around it. `DialogActions` mirrors all of it at the
 * bottom.
 *
 * Its fill is the panel's own (`--dialog-fill`), the page's `base-100` in
 * the full-screen dialog below `sm`, where the header pins under the 64dp
 * bar rather than in the bar's title slot — a library choice that keeps
 * the headline with its supporting text.
 */
export function DialogHeader({ className, children }: DialogPartProps) {
  const presentation = useContext(PresentationContext);
  return (
    <div
      // Marks the header for `DialogActions`, which closes up the header's
      // own margin when it follows directly (see there).
      data-dialog-header=""
      className={cn(
        "sticky -top-(--dialog-pad) z-10 -mx-(--dialog-pad) -mt-(--dialog-pad) mb-4 flex flex-col gap-4 bg-(--dialog-fill) px-(--dialog-pad) pt-(--dialog-pad)",
        "pr-[calc(2rem+var(--density,0)*1rem)]",
        // Full-screen, the close icon is in the bar, not the corner: no
        // gutter to keep, so a long headline does not wrap early.
        presentation === "fullscreen" && "max-sm:pr-(--dialog-pad)",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The dialog's actions: the confirming one, and a `DialogClose` for the
 * dismissing one ("Cancel"). `DialogFooter` before 0.3.0 — renamed for
 * what it holds rather than where it sits, because in the full-screen
 * dialog it does not sit at the foot.
 *
 * In the basic dialog: end-aligned, 8dp apart (`ButtonsMainAxisSpacing`),
 * the buttons 24dp under the text above them
 * (`AlertDialogDefaults.textPadding`; 16dp for a precise pointer, as
 * `--dialog-text-pad` on the panel) — the margin is that less this row's
 * own `pt-2`, and less `DialogHeader`'s `mb-4` too when the actions follow
 * it directly — held at the bottom of the visible panel like
 * `DialogHeader` at the top. A variable rather than a `pointer-fine:mt-4`:
 * that variant is emitted after `max-sm:`, so on a phone-width window
 * driven by a mouse it pushed the full-screen bar's actions 16px down
 * (measured: "Create" at y 32–64 in a 64px bar).
 *
 * In the full-screen dialog below `sm`: moved into the top bar, trailing,
 * `TrailingSpace` 4dp from the edge (`AppBarTokens`), by position alone —
 * the element is where you wrote it, so tab order and form submission are
 * unchanged. A `DialogClose` among the actions is hidden there, since the
 * bar's close icon is that action.
 */
export function DialogActions({ className, children }: DialogPartProps) {
  const presentation = useContext(PresentationContext);
  return (
    <InActionsContext.Provider value={true}>
      <div
        className={cn(
          "sticky -bottom-(--dialog-pad) z-10 -mx-(--dialog-pad) -mb-(--dialog-pad) flex items-center justify-end gap-2 bg-(--dialog-fill) px-(--dialog-pad) pt-2 pb-(--dialog-pad)",
          // `--dialog-text-pad` from the text to the buttons: less this
          // row's own `pt-2`, and, straight after `DialogHeader`, less the
          // header's `mb-4` as well.
          "mt-[calc(var(--dialog-text-pad)-0.5rem)] [[data-dialog-header]+&]:mt-[calc(var(--dialog-text-pad)-1.5rem)]",
          presentation === "fullscreen" &&
            "max-sm:absolute max-sm:top-[env(safe-area-inset-top,0px)] max-sm:right-[env(safe-area-inset-right,0px)] max-sm:bottom-auto max-sm:z-20 max-sm:m-0 max-sm:h-16 max-sm:bg-transparent max-sm:p-0 max-sm:pr-1 max-sm:[[data-dialog-header]+&]:mt-0",
          // Clear of the leading close icon: 4dp + 48dp + 4dp. Without it
          // a long label, or three actions, ran under the close icon at
          // 320px (found in review: "Preview" from x 35, under Close's
          // 4–52). M3's bar carries one short confirming action; more
          // than fits here is the caller's to cut.
          presentation === "fullscreen" &&
            "max-sm:left-[calc(env(safe-area-inset-left,0px)+3.5rem)]",
          className,
        )}
      >
        {children}
      </div>
    </InActionsContext.Provider>
  );
}

/**
 * The headline. M3's `AlertDialog` sets it at 20/26 for a precise pointer
 * and at `HeadlineSmall`, 24/32 (`DialogTokens.HeadlineFont`), otherwise.
 * This library's type scale tops out at `text-title`, 20/28, for headings
 * in a dense console, and uses it for both — M3's size with a mouse, a
 * library choice on touch. `font-display`: `theme.css`'s own
 * doc on `--font-display` names dialog headings; `tracking-normal` undoes
 * the global tracking tuned for the sans face (see `card.tsx`).
 */
export function DialogTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof HeadlessDialogTitle>) {
  return (
    <HeadlessDialogTitle
      className={cn(
        "font-display font-medium text-foreground text-title tracking-normal",
        className,
      )}
      {...props}
    />
  );
}

/** The supporting text: M3's `BodyMedium` in `OnSurfaceVariant`
 * (`DialogTokens.SupportingText*`) — `text-prose` in `muted-foreground`. */
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
