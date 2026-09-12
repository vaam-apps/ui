"use client";

import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "../../lib/cn";

// cmdk is standalone (no Radix wrapper needed — it already owns its own
// keyboard nav/ARIA). Styled with the same surface-2/border-edge/radius-md
// floating-layer treatment as Popover/DropdownMenu for visual consistency.

export const CommandMenu = forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "flex w-full flex-col overflow-hidden rounded-md border border-edge bg-surface-2 text-foreground",
      className,
    )}
    {...props}
  />
));
CommandMenu.displayName = "CommandMenu";

export function CommandMenuInput(
  props: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>,
) {
  return (
    <div className="flex items-center gap-2 border-edge border-b px-3">
      <Search size={14} strokeWidth={1.5} className="shrink-0 text-subtle-foreground" />
      <CommandPrimitive.Input
        className="h-10 w-full bg-transparent text-prose outline-none placeholder:text-subtle-foreground"
        {...props}
      />
    </div>
  );
}

export const CommandMenuList = forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn("max-h-80 overflow-y-auto overflow-x-hidden p-1", className)}
    {...props}
  />
));
CommandMenuList.displayName = "CommandMenuList";

export function CommandMenuEmpty(
  props: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>,
) {
  return (
    <CommandPrimitive.Empty
      className="px-3 py-6 text-center text-body text-muted-foreground"
      {...props}
    />
  );
}

export const CommandMenuGroup = forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "text-body [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-micro [&_[cmdk-group-heading]]:text-muted-foreground",
      className,
    )}
    {...props}
  />
));
CommandMenuGroup.displayName = "CommandMenuGroup";

export const CommandMenuItem = forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      // `min-w-0`: command palettes are fed route names and record titles
      // of no fixed length, and the list is already `overflow-x-hidden`,
      // so without this a long item is simply cut off mid-word with no
      // ellipsis to say so. `truncate` itself, though, used to sit right
      // here on this row (`be63a70`) with a comment claiming it produced
      // that ellipsis — it does not: `text-overflow: ellipsis` only
      // applies to a block container, this row is `display: flex`, and a
      // flex container is not one (verified live, side by side against a
      // block element with the same class: the flex one hard-cuts
      // mid-glyph, no ellipsis, only `overflow: hidden` takes effect).
      // `min-w-0` stays here — it's what lets the label span below
      // actually shrink instead of pushing the row wide — and `truncate`
      // moves one level in, onto that span, the same fix as
      // `dropdown-menu.tsx`'s items.
      "flex min-w-0 cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-body data-[selected=true]:bg-surface-3",
      className,
    )}
    {...props}
  >
    <span className="min-w-0 flex-1 truncate text-left">{children}</span>
  </CommandPrimitive.Item>
));
CommandMenuItem.displayName = "CommandMenuItem";
