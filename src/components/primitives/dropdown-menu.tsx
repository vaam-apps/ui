"use client";

import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  MenuSection,
  MenuSeparator,
} from "@headlessui/react";
import { Check } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../lib/cn";
import { omitUndefined } from "../../lib/omit-undefined";

// D3: Radix `DropdownMenu` → Headless UI `Menu`/`MenuButton`/`MenuItems`/`MenuItem`.
export const DropdownMenu = Menu;

// `MenuButton` is natively polymorphic (`as`), replacing Radix's `asChild`
// pattern (D4's same call, applied to a trigger rather than `Button`
// itself): `<DropdownMenuTrigger as={Button} variant="secondary">…`.
export const DropdownMenuTrigger = MenuButton;

// `DropdownMenuGroup`/`DropdownMenuCheckboxItem` have zero call sites in
// this codebase today (grepped across `admin/` and `packages/ui`) — kept
// for API parity rather than dropped silently, mapped onto Headless UI's
// closest equivalents.
export const DropdownMenuGroup = MenuSection;

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof MenuSeparator>) {
  return <MenuSeparator className={cn("my-1 h-px bg-edge", className)} {...props} />;
}

export function DropdownMenuContent({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof MenuItems>) {
  return (
    <MenuItems
      anchor="bottom start"
      transition
      className={cn(
        // `max-w-[min(20rem,calc(100vw-2rem))]`: an item whose label is a
        // sentence used to size the panel to the sentence, which at the
        // right-hand edge of a screen meant a menu wider than the room
        // left for it. Bounded here, truncated one level in on the item
        // (see `DropdownMenuItem`'s own comment for why "on the item"
        // itself — this component's row — does not work).
        "z-50 min-w-[180px] max-w-[min(20rem,calc(100vw-2rem))] rounded-md border border-edge bg-surface-2 p-1 shadow-[var(--shadow-popover)] [--anchor-gap:4px] focus:outline-none",
        "origin-top transition duration-100 ease-out data-closed:scale-95 data-closed:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuItem({
  className,
  children,
  ...props
}: Omit<ComponentPropsWithoutRef<"button">, "type">) {
  return (
    <MenuItem
      as="button"
      type="button"
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-body text-foreground outline-none",
        "data-focus:bg-surface-3",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...omitUndefined(props)}
    >
      {/*
       * `truncate` used to sit directly on this row (`be63a70`), with a
       * comment claiming it produced an ellipsis. Verified live, it does
       * not: `text-overflow: ellipsis` only applies to a block container,
       * this row is `display: flex`, and a flex container is not a block
       * container — its anonymous block boxes don't inherit
       * `text-overflow` either. `overflow: hidden` still applied, so the
       * label was hard-cut mid-glyph, not ellipsized (checked side by side
       * against a block element with the same class and against
       * `payload-inspector.tsx`'s row, which truncates correctly for
       * exactly the reason given below).
       *
       * Fix, one level in: `children` moves into this `<span>`, which is
       * the flex *item* — an ordinary block box in its own right, so
       * `truncate` on it works the same way it does on
       * `payload-inspector.tsx`'s `<span class="min-w-0 truncate">`.
       *
       * Chosen contract (there were two ways to do this — see the task
       * note this cites): wrap the whole `children` prop, not just a
       * child the caller marks as "the label". Every call site in this
       * repo today (`overlays.stories.tsx`) passes a bare text label with
       * no icon, and wrapping unconditionally keeps every one of them
       * working with no call-site change. The alternative — a
       * `[&>span:last-child]:truncate` selector requiring the caller to
       * wrap its own label in a `<span>` — would silently stop
       * truncating (and stop constraining width at all) every existing
       * caller, since none of them wrap their text today. The cost: an
       * icon passed before the text (e.g. `<Icon
       * className="size-4" />Label`) shares this same box, so on overflow
       * the ellipsis can eat into content after the icon rather than
       * stopping at the icon boundary — there's no live call site
       * exercising that shape to verify against, so treat an
       * icon-plus-label item as unverified until one exists and gets
       * checked at 200px like the three cases above.
       */}
      <span className="min-w-0 flex-1 truncate text-left">{children}</span>
    </MenuItem>
  );
}

/** Unconsumed today (see module doc above) — caller controls `checked`
 * itself, since Headless UI's `Menu` has no built-in checkbox-item state
 * the way Radix's `DropdownMenuCheckboxItem` did. */
/**
 * A menu row that is a real link, not a button that navigates.
 *
 * `DropdownMenuItem` hardcodes `as="button"`, which is right for a
 * command — "Requeue", "Copy id" — and wrong for a destination. A menu of
 * places the operator can go has to be made of anchors, or it silently
 * loses middle-click, ⌘-click, "open in new tab" and "copy link address":
 * four things people do with navigation without thinking, and none of
 * which a `button` with an `onClick` can be made to do.
 *
 * `SideNav`'s tiny-screen rail is the caller that forced this: it shows
 * four destinations and puts the rest behind a menu, and the ones behind
 * the menu must not be second-class links.
 *
 * Styling is deliberately identical to `DropdownMenuItem` — the two are
 * the same row to a reader, and the difference is only in what the
 * browser will let them do.
 */
export function DropdownMenuLinkItem({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"a">) {
  return (
    <MenuItem
      as="a"
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-body text-foreground outline-none",
        "data-focus:bg-surface-3",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </MenuItem>
  );
}

export function DropdownMenuCheckboxItem({
  className,
  checked = false,
  children,
  ...props
}: Omit<ComponentPropsWithoutRef<"button">, "type"> & { checked?: boolean }) {
  return (
    <MenuItem
      as="button"
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-body text-foreground outline-none",
        "data-focus:bg-surface-3",
        className,
      )}
      {...omitUndefined(props)}
    >
      {/* Fixed-size checkmark slot, deliberately *outside* the truncating
       * span below: it's rendered by this component, not passed as
       * `children`, so it never competes with the label for the same
       * overflow box. Same `truncate`-on-a-flex-row bug and fix as
       * `DropdownMenuItem` above — see its comment for the full account. */}
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        {checked && <Check size={14} strokeWidth={1.5} aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1 truncate text-left">{children}</span>
    </MenuItem>
  );
}

/**
 * **Found live, not assumed**: Headless UI's own `MenuHeading` throws the
 * identical "not inside a relevant parent" error `label.tsx`'s own module
 * doc already found for the standalone `Label` — `MenuHeading` needs a
 * `MenuSection` ancestor to supply that context (`MenuSection`'s own
 * implementation calls `useLabels()` to *create* the provider; `MenuHeading`
 * calls `useLabelContext()` to *consume* it), and every call site here
 * (matching the original Radix `DropdownMenuLabel`'s own shape) renders a
 * standalone label with no surrounding group. Radix's own `Label` was a
 * plain, non-interactive `<div>` with no roving-focus/ARIA-grouping
 * behaviour beyond being read as ordinary text inside the menu's
 * accessible tree — so a plain `<div>` here loses nothing real and avoids
 * a dependency this element doesn't actually need. Reproduced live: a real
 * "Uncaught Error: You used a <Label /> component, but it is not inside a
 * relevant parent" client-side exception, thrown the instant the gallery's
 * demo menu opened, before this fix.
 */
export function DropdownMenuLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-2 py-1.5 text-micro text-muted-foreground tracking-[0.03em]", className)}
      {...props}
    />
  );
}
