"use client";

import { X } from "lucide-react";
import { forwardRef, type ReactNode } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "../../lib/cn";

// vaul is standalone. **`direction` defaults to `"bottom"`** — vaul's, not
// ours; this comment said `"right"` for a while and the same file
// contradicts it 110 lines down, where the reasoning behind
// `QuickDetailDrawer`/`MoreDetailDrawer` fixing the prop is written out.
//
// The mismatch is not cosmetic: `DrawerContent` is CSS-positioned at the
// right edge, but vaul reads `direction` to choose its keyframes and its
// drag axis. A generic `<Drawer>` with no `direction` therefore sits on
// the right and animates and drags vertically. Pass `direction="right"`
// for a side drawer, or use the two compositions below, which fix it.
//
// This generic composition (`Drawer`/`DrawerTrigger`/`DrawerClose`/
// `DrawerContent`) is unchanged by console-redesign.md §6.4/D14 — it is
// still the right tool for a one-off drawer with no quick-vs-more
// distinction to encode (see the gallery's own "Open drawer" example).
// `QuickDetailDrawer`/`MoreDetailDrawer` below are a *second*, self-
// contained API for the specific §3 distinction; they do not replace this
// one.
export const Drawer = DrawerPrimitive.Root;
export const DrawerTrigger = DrawerPrimitive.Trigger;
export const DrawerClose = DrawerPrimitive.Close;
export const DrawerPortal = DrawerPrimitive.Portal;

export const DrawerOverlay = forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-scrim", className)}
    {...props}
  />
));
DrawerOverlay.displayName = "DrawerOverlay";

export const DrawerContent = forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-[560px] flex-col",
        "border-edge border-l bg-surface-2 shadow-[var(--shadow-dialog)]",
        className,
      )}
      {...props}
    >
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
));
DrawerContent.displayName = "DrawerContent";

/** Not previously exported — `vaul`'s `Content` renders Radix Dialog's
 * `Content` underneath (`vaul/dist/index.js` imports `@radix-ui/react-
 * dialog` directly and forwards its `Content`/`Title`/`Description`), so
 * Radix's own "DialogContent requires a DialogTitle" dev warning applies
 * here exactly as it does to `primitives/dialog.tsx`. `QuickDetailDrawer`/
 * `MoreDetailDrawer` below always render one; exported separately too for
 * any future one-off use of the generic `DrawerContent` above. */
export const DrawerTitle = forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    // `font-display`/`tracking-normal`: `theme.css`'s own doc on
    // `--font-display` names "card and dialog headings" outright, and a
    // drawer title is the same role — see `card.tsx`'s `CardHeader`
    // comment for why the tracking reset is needed (the global
    // `html { letter-spacing: -0.011em }` was tuned for the sans body
    // face, not this serif).
    className={cn(
      "font-display font-medium text-foreground text-title-sm tracking-normal",
      className,
    )}
    {...props}
  />
));
DrawerTitle.displayName = "DrawerTitle";

/** See `DrawerTitle` — same "not previously exported, Radix warns without
 * one" reasoning, for `aria-describedby` instead of the accessible name. */
export const DrawerDescription = forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-muted-foreground text-prose", className)}
    {...props}
  />
));
DrawerDescription.displayName = "DrawerDescription";

// ---------------------------------------------------------------------
// QuickDetailDrawer / MoreDetailDrawer (console-redesign.md §3, D14, §5)
// ---------------------------------------------------------------------
//
// The design doc's own §6.4 sketch of this file was explicitly flagged as
// unverified ("the mechanism is now known and worth checking before this
// sketch is trusted verbatim") for two independent reasons, both checked
// directly against `vaul@1.1.2`'s compiled source
// (`node_modules/vaul/dist/index.js`) before writing this, not assumed:
//
// 1. **The `useMediaQuery` call the sketch used is gone (D12).** No JS
//    viewport read of any kind happens in this file — every breakpoint
//    switch below is a plain Tailwind `md:` variant, so both variants
//    render identically on the server and on the client's first paint.
//
// 2. **A single `vaul` `Drawer.Root` cannot itself be "bottom on phone,
//    right on desktop" — its `direction` prop is not a CSS concern.** It
//    drives real per-instance state: which axis (`translate3d(0,y,0)` vs
//    `(x,0,0)`) the built-in open/close keyframes and the live drag-follow
//    math use (`isVertical(direction)`, `getTranslate(el, direction)`,
//    throughout `dist/index.js`). The sketch never set `direction` at all
//    (it left every caller to supply it on a separately-rendered `<Drawer>`
//    Root, which — combined with `direction`'s own default of `"bottom"` —
//    means the sketch's "more details" `Content` would in practice always
//    have inherited `"bottom"` regardless of viewport anyway). Rather than
//    read the viewport to pick a direction (banned, and also the same
//    hydration-mismatch shape D12 already fixed once — a deep-linked
//    `?panel=<id>` drawer can be `open` on the very first server render,
//    per D14, so the first paint has to be right, not just eventually
//    correct after an effect), both drawers below **fix `direction` to
//    `"bottom"` unconditionally** and let plain `md:` classes handle
//    *position* — matching this file's own established, precedented
//    pattern for a responsive split that can't be one reactive value
//    (`side-nav.tsx`'s `GroupSection`: "two parallel trees... not one tree
//    whose content changes based on a JS-read viewport width").
//
//    The one real, accepted cost of fixing `direction`: `vaul`'s own
//    open/close animation (`slideFromBottom`/`slideToBottom`, a vertical
//    `translate3d`) plays at every breakpoint, including the `md:` right-
//    panel position — so the panel's *entrance motion* is vertical even
//    though its *resting position* is a right-hand edge. This was
//    deliberately not "fixed" by layering a second, horizontal CSS
//    `transition` on top keyed off `data-[state=]`: `vaul`'s animation is
//    a real `@keyframes` `animation`, which (unlike a plain `transition`)
//    correctly plays on a freshly-inserted node — Radix's `Content` isn't
//    in the DOM at all until `open`, so a competing `transition`-based
//    replacement would very likely not animate on *open* at all (no prior
//    DOM node to transition *from*) while still fighting the real
//    animation for the `transform` property. Keeping `vaul`'s own,
//    already-correct mechanism and accepting a vertical entrance for the
//    desktop panel is the smaller, more honest compromise, and it costs no
//    extra CSS (constraint 7). If this reads as wrong once seen live,
//    revisit by disabling it explicitly (`data-vaul-animate="false"` is
//    force-overridable via a prop — `Content`'s `...rest` spreads *after*
//    vaul's own default in `dist/index.js`) and shipping a real
//    `@keyframes`-based replacement, not a `transition`.
//
//    Fixing `direction` also fixes the *drag* gesture to the vertical
//    axis everywhere. Left alone, that would make a click-drag inside the
//    desktop panel (e.g. selecting text) register as a vertical swipe
//    attempt. Closed with `handleOnly` on the `Root` (drag can only start
//    from a `Drawer.Handle`) plus rendering that handle only below `md:` —
//    so desktop has no drag surface at all (pointer/click/Escape/overlay
//    close it instead), and phone keeps a real, correctly-axised drag
//    handle, which is also what §3's own mobile paragraph asks for ("...
//    with a drag handle").
//
// Both variants are otherwise identical in mechanism and differ only in
// the two things §3/D14 make load-bearing: `dimmed` (renders an
// `Overlay` and sets `vaul`'s own `modal` prop — verified live in
// `dist/index.js` that `modal` is what actually gates both the
// background `pointer-events`/scroll-lock behaviour *and*, independently,
// whether an `Overlay` should render at all; Radix's own focus trap and
// `aria-modal="true"` are unconditional either way — `vaul` never forwards
// its `modal` prop down to `@radix-ui/react-dialog`'s `Root`, which keeps
// its own default of `true` regardless. So "quick details" is visually and
// interactively lighter — no dim, background stays scrollable/clickable —
// but is exactly as keyboard-trapped and exactly as announced to a screen
// reader as "more details" is; that's a real, verified limitation of
// `vaul@1.1.2`, not a gap left open on purpose) and `contentClassName`
// (width/inset/radius/border, per D14's own two size ranges).
//
// # Below `md:`, this panel forces comfortable density — deliberately,
// regardless of the app's own `--density` setting
//
// Reported live: "drawer + select on small screens: it's cramped", on
// `Select`'s own "Inside a drawer" story at 375×812. Measured before any
// fix, at this package's `compact` default: the `SelectTrigger` 40px
// tall (14px font, 12px horizontal padding — daisyUI's own `.select`
// font-size is a flat `.875rem` regardless of `--size`, so only the
// height was ever going to move), and the footer's primary action 32px
// tall, 12px font, ~71px wide, pinned to the right edge of a 375px sheet.
// Nothing in that is a bug in the D10 density axis itself — every one of
// those numbers is `compact` doing exactly what `compact` promises
// (`theme.css`'s own "Density register": a consumer who sets nothing
// gets the pre-D10 numbers, byte-identical). The defect is that this
// *specific* panel, below `md:`, is never the thing `compact` was
// designed for.
//
// **The decision:** below `md:` (the same breakpoint this file already
// uses, two paragraphs up, to fix `direction="bottom"` unconditionally
// and to decide sheet-vs-panel with a plain CSS class rather than a
// JS viewport read), `DetailDrawerContent` sets `--density: 1` on its
// own root — `max-md:[--density:1]` below, the same custom-property
// mechanism `theme.css`'s `[data-density="comfortable"]` rule uses, just
// scoped to this element and this breakpoint instead of to a consumer's
// root. At `md:`+, the declaration is absent and `--density` resolves
// however the app's own ancestor already set it (`0`/compact by
// default) — the desktop right-hand panel is completely unaffected,
// because it is a real console surface and the app's density choice is
// exactly the one that should govern it.
//
// **Why forced rather than left to the app, or left to a breakpoint the
// app opts into:** the case against forcing it is real — a component
// silently overriding a setting the app deliberately chose is exactly
// the kind of surprise this library otherwise avoids, and `compact` is
// the *default* precisely so vpay/vsms render unchanged
// (`density.spec.ts`'s own "compact is the default" suite is the
// contract). But `direction="bottom"` above already establishes the
// precedent this leans on: below `md:`, this component is *never* the
// console panel — it is unconditionally the phone bottom sheet
// (`inset-x-0 bottom-0 rounded-t-box`, no border-radius/border/position
// left ambiguous, all reset explicitly per D12's own correction note).
// A bottom sheet on a ≤767px viewport is a touch surface by
// construction, not by the app's density choice — the thumb reaching
// this exact panel does not know or care that the surrounding console
// runs `compact` for its tables and toolbars. And the override is
// genuinely narrow: a consumer who already sets `data-density=
// "comfortable"` app-wide is unaffected (redundant, not overridden); the
// same consumer viewing this same panel at `md:`+ — its real, intended,
// desk-bound use — is unaffected (the rule never fires there). The only
// configuration this actually changes is "compact app, this panel,
// under 768px" — which per D14 is the one configuration where the panel
// has already stopped being a console drawer and started being a phone
// sheet, by the same line the rest of this file draws that distinction
// on.
//
// The middle ground the task brief itself named — "sheet opts into
// comfortable only below a breakpoint" — is what this is; the other
// middle ground, "the sheet stays neutral and the consuming app sets
// density on it," was rejected because it puts the fix in the wrong
// place: every one of this package's ~11 console call sites for
// `Select` alone would need updating to remember it, for a component
// this package already knows, from its own `md:` split, is a phone
// surface at that width. `no-dropdowns_test.dart`'s house rule in the
// sibling Flutter app — "a bottom sheet is a touch surface by
// definition" — is the same reasoning restated for a different
// component family; it is not cited as an authority over this package,
// only as the same conclusion reached independently on the other side
// of the same product.
//
// Numbers below are re-derived, not invented: `SelectTrigger` (which
// shares daisyUI's `.select`/`--size-field` scale with `Button`'s
// default/`md` size) reaches 56px — `ButtonMediumTokens.ContainerHeight`
// (`theme.css`'s own D10 citation, androidx `v0_11_0`) — the exact
// number `density.spec.ts` already pins for `density: "comfortable"`
// everywhere else in this package. The footer's own primary action is
// left as whatever size the *caller* already chose — this package's own
// convention, unanimous across every drawer/dialog footer in its
// stories, is `size="sm"` — and D10's existing `.btn-sm` formula
// (`theme.css`, reads `--density` directly, not through `--size-field`)
// already lifts it from 32px to 40px, `ButtonSmallTokens.ContainerHeight`,
// with no new mechanism needed here. `max-md:flex-col
// max-md:items-stretch` below is what actually answers the "71px
// right-aligned" half of the report: the footer row stretches whatever
// it's given edge-to-edge below `md:`, so a `size="sm"` button reaches
// the sheet's full content width instead of a target pinned to one
// corner. 44px is this package's own already-established phone
// tap-target convention (`e2e/geometry.spec.ts`, "tap targets on the
// phone-width nav": "every control in the bottom rail is at least
// 44×44") — 40px does not quite clear it, which is named rather than
// hidden: closing that last 4px would mean this component overriding a
// size the *caller* chose, the same overreach the "sheet stays neutral"
// middle ground above was weighed against, for a gap this small. The
// pre-existing 32px cleared neither 40 nor 44; a caller who wants the
// full 44px+ ideal already can, by choosing the default/`md` size for a
// footer action that matters enough to warrant it — nothing here stops
// that, it just isn't forced.
interface DetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rendered as the drawer's accessible name (`Drawer.Title`) — required,
   * not optional, because both variants always render one and Radix warns
   * loudly in dev without it. */
  title: ReactNode;
  /** Rendered as the drawer's accessible description (`Drawer.Description`).
   * Optional for the *caller* — when omitted, a screen-reader-only
   * fallback is still rendered so `aria-describedby` is always wired,
   * matching `primitives/dialog.tsx`'s own precedent of never shipping a
   * `Content` with no description at all. */
  description?: ReactNode;
  /** The scrollable body — a summary of fields, an edit form, whatever the
   * calling screen owns. This file has no opinion on it. */
  children: ReactNode;
  /** Optional sticky action row (§1.5's Polar reference: "a fixed bottom
   * action row... stays visible without the form needing to scroll"). */
  footer?: ReactNode;
  className?: string;
}

function DetailDrawerContent({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  dimmed,
  contentClassName,
}: DetailDrawerProps & { dimmed: boolean; contentClassName: string }) {
  return (
    <DrawerPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      modal={dimmed}
      dismissible
      handleOnly
      // vaul defaults this to `false` (`onOpenAutoFocus` is pre-vented
      // unless the caller opts in) — verified in `dist/index.js`'s `Root`
      // default parameters. Without it, opening either drawer would leave
      // keyboard focus sitting on whatever triggered it instead of moving
      // into the panel, which is a real, checkable regression from plain
      // Radix `Dialog` behaviour (its own default *does* auto-focus
      // `Content`) — set explicitly so focus genuinely lands inside the
      // drawer the moment it opens, not just gets trapped there once the
      // user starts tabbing.
      autoFocus
    >
      <DrawerPrimitive.Portal>
        {dimmed && <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim" />}
        <DrawerPrimitive.Content
          className={cn(
            "fixed z-50 flex flex-col bg-surface-2 shadow-[var(--shadow-dialog)] outline-none",
            // Phone: bottom sheet.
            "inset-x-0 bottom-0 rounded-t-box border-edge border-t",
            // `md`+: right-hand panel — every sheet-only property above is
            // reset explicitly (inset, rounding, border side, max-height),
            // not just overridden by a wider max-width, per this file's
            // own D12-correction note above.
            "md:inset-x-auto md:inset-y-0 md:right-0 md:h-full md:max-h-none",
            "md:w-full md:rounded-t-none md:rounded-l-box md:border-t-0 md:border-l",
            // D10, forced: see this file's own header comment, directly
            // above `DetailDrawerProps`, for the full density decision
            // and its reasoning. `max-md:` — absent at `md:`+, so the
            // desktop right-hand panel keeps reading whatever density the
            // app itself set.
            //
            // **`--density` alone is enough now.** It used to not be:
            // `--density: 1` here always reached `.btn-sm`'s and `.btn`/
            // `.btn-circle`'s own formulas (`theme.css`'s D10 section),
            // because those are declared *on the sized element itself*
            // and re-resolve `var(--density, 0)` against whatever
            // inherits to that exact element — but `--size-field` used to
            // be declared exactly once, at the theme root
            // (`:root`/`[data-theme]`), and a CSS custom property's
            // `calc()` only ever re-evaluates where it is *declared*,
            // never per descendant just because `var(--density)` resolves
            // differently further down. That forced a second, literal
            // `max-md:[--size-field:0.35rem]` line here — measured before
            // it was added: `--density` read back as `1` on this very
            // element, and `SelectTrigger` still rendered 40px, not 56px,
            // because `.select`'s `--size: calc(var(--size-field,.25rem)
            // * 10)` was still inheriting `--size-field`'s value frozen at
            // the theme root's own `--density: 0`. `theme.css`'s own
            // "`--size-field`, corrected" comment fixed this at the
            // source — `--size-field` is now declared directly on
            // `.input`/`.select`/`.btn`, the same "declare it on the
            // sized element itself" mechanism `.btn-sm` already used — so
            // this line's own workaround is dead weight now rather than a
            // fix, and has been removed: `--density: 1` alone reaches
            // `SelectTrigger` correctly through the corrected
            // `--size-field`, verified by re-running this exact
            // measurement after the fix (56px, not 40px).
            "max-md:[--density:1]",
            contentClassName,
            className,
          )}
        >
          {/* Drag surface (D14's mobile "with a drag handle"), phone only —
              `handleOnly` on Root means dragging is only possible starting
              from this element, and it's hidden at `md:`, so desktop has
              no drag surface at all (see this file's own header comment
              for why: `direction` is fixed to "bottom", so a desktop drag
              would otherwise compute against the wrong axis).
              **`!` (Tailwind v4 important) is load-bearing here, not
              decorative — found live, not assumed:** `vaul` injects
              `[data-vaul-handle]{display:block; ...}` into a `<style>` tag
              it appends to `<head>` itself (`dist/index.js`'s own
              `__insertCSS`), at the same specificity as a plain `md:hidden`
              utility and *after* Tailwind's build-time stylesheet in
              cascade order — so a bare `md:hidden` lost the tie and the
              handle stayed visible at desktop width, confirmed by
              inspecting `getComputedStyle(...).display` in a real browser
              at 1280px before this fix, and confirmed gone after it. */}
          <DrawerPrimitive.Handle className="mt-2 shrink-0 bg-edge-strong md:hidden!" />

          <div className="flex items-start justify-between gap-3 border-edge border-b px-5 py-4">
            <div className="min-w-0">
              <DrawerTitle className="truncate">{title}</DrawerTitle>
              <DrawerDescription className={description == null ? "sr-only" : "mt-1"}>
                {description ?? "Details panel."}
              </DrawerDescription>
            </div>
            {/* `-m-1 p-1`: same hit-area fix as `dialog.tsx`'s close button
                (§ that file's own `DialogContent` comment) — grows the
                clickable box to **24×24px** — 16px icon plus 4px each side,
                not the 32×32 this said before it was measured, and
                exactly WCAG 2.2 §2.5.8's floor. `dialog.tsx` shares the
                pattern and the number. Without moving the 16px
                icon itself, so the two close buttons agree. `rounded-full`
                and the `hover:bg-surface-3` affordance agree with it too —
                see that comment for why (icon-only controls are circular;
                focus already gets a ring for free from `theme.css`). */}
            <DrawerPrimitive.Close
              aria-label="Close"
              // D11 (`theme.css`'s own header on `.tap-target`): unlike
              // `dialog.tsx`'s close button, this one is in normal flow
              // (`justify-between` row above), not `absolute` — `relative`
              // is added here so the invisible comfortable-only overlay
              // has a positioning context of its own.
              className="relative -m-1 shrink-0 rounded-full p-1 text-subtle-foreground transition-colors hover:bg-surface-3 hover:text-foreground [--tap-size:24px] tap-target"
            >
              <X size={16} strokeWidth={1.5} />
            </DrawerPrimitive.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

          {footer != null && (
            // `max-md:flex-col max-md:items-stretch`: below `md:` this
            // row is a phone bottom sheet's action area, not a console
            // toolbar — a `justify-end`-packed row leaves a primary
            // action pinned to one corner (measured live: ~71px wide, on
            // a 375px sheet, the exact "cramped" report this file's own
            // density comment above addresses the *sizing* half of).
            // `items-stretch` in a column flexes every direct child —
            // typically one primary `Button`, as `select.stories.tsx`'s
            // "Inside a drawer" story now shows — to the row's own full
            // width with no assumption about how many children `footer`
            // holds or what they are. `md:justify-end` restores the
            // packed, right-aligned console row unchanged once this is
            // genuinely the desktop panel.
            <div className="flex shrink-0 items-center gap-2 border-edge border-t px-5 py-4 max-md:flex-col max-md:items-stretch md:justify-end">
              {footer}
            </div>
          )}
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}

/**
 * **Quick details** (§3, D14) — a peek at one row's state without leaving
 * the list. Narrow (`420–480px` at `md`+), undimmed (background stays
 * legible and, per `vaul`'s own `modal={false}` behaviour verified above,
 * scrollable/clickable — matching the Mercury reference, §1.4), no route
 * ownership: the caller owns `open`/`onOpenChange` from local state (e.g.
 * "which row id is selected"), and losing it on refresh is expected and
 * fine (reopening is one click on the same row).
 *
 * Not a `Dialog`, and not for anything destructive — §1.7/§3 reserve that
 * for the centered `Dialog` primitive. This is a read-mostly summary with
 * 1–2 actions, e.g. a "View full details" link that upgrades to
 * `MoreDetailDrawer`.
 */
export function QuickDetailDrawer(props: DetailDrawerProps) {
  return (
    <DetailDrawerContent
      {...props}
      dimmed={false}
      contentClassName="max-h-[70vh] md:max-w-[440px]"
    />
  );
}

/**
 * **More details** (§3, D14) — the full record: every field, an edit
 * form, destructive actions, short nested history. Wide (`640–720px` at
 * `md`+), dimmed (modal-weight, matching the Polar reference, §1.5). The
 * *caller* is expected to own a shallow `?panel=<recordId>` route so this
 * survives refresh and is linkable (D14) — this component only owns the
 * visual/behavioural weight, never routing; pass `open` derived from that
 * query param and `onOpenChange` wired to update it.
 *
 * A destructive-confirmation step opened *from inside* this drawer uses
 * **`InlineConfirm`**, not a nested `Dialog`. This paragraph used to say
 * the opposite, citing a z-index fix; `inline-confirm.tsx` documents that
 * composition as broken for a reason no z-index reaches — vaul holds a
 * document-level focus scope while Headless UI's dialog portals to its
 * own root, so the two fight over focus and the inner dialog cannot be
 * operated. `InlineConfirm` exists precisely because of it, and the story
 * for this drawer already does it that way.
 */
export function MoreDetailDrawer(props: DetailDrawerProps) {
  return <DetailDrawerContent {...props} dimmed contentClassName="max-h-[92vh] md:max-w-[680px]" />;
}
