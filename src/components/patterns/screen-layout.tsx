import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

// R6 (AGENTS.md): every route screen was hand-rolling the identical
// `<div className="flex flex-col gap-6">` wrapper plus a
// `<h1 className="font-medium text-foreground text-title">`/description
// `<header>` pair — confirmed by grep, ten of eleven screens under
// `frontends/apps/admin/app/*/*.tsx` had this exact pair before this file
// existed. R6's own test ("if a second route would plausibly use it, it
// belongs in `frontends/packages/ui`") is not a close call here. Extracted
// verbatim from `jobs-screen.tsx`/`workers-screen.tsx`/`opt-outs-screen.tsx`
// — same classes, not a redesign.
//
// New file, added while several route groups were being moved onto R6 in
// parallel — expect another agent's PR to add an equivalent. If both land,
// reconcile onto one of the two rather than keeping both: same shape,
// different name is worse than either alone.

export interface ScreenStackProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * The page-level vertical rhythm every screen composes its sections into.
 *
 * `min-w-0` is load-bearing rather than defensive: this is a flex
 * container, and a flex item's default `min-width: auto` means one wide
 * child — a table with a long id column, a `<pre>` full of an unwrapped
 * payload — pushes the *whole screen* wider than the viewport instead of
 * scrolling inside its own box. That is the "the page scrolls sideways
 * and nobody can see why" failure, and it is fixed once here rather than
 * per section.
 */
export function ScreenStack({ children, className, ...props }: ScreenStackProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-6", className)} {...props}>
      {children}
    </div>
  );
}

export interface ScreenHeaderProps {
  title: ReactNode;
  description?: ReactNode;
}

/**
 * A screen's own `<h1>` + one-line description, styled once.
 *
 * The description is clamped to two lines. It is documented as one line,
 * and a header that silently grows to five pushes the content below it
 * off the fold on exactly the screens whose author wrote the longest
 * description — so the slot's size is a property of the slot, not of
 * whatever prose is handed to it. The full text stays in the DOM (and in
 * the accessible name of nothing — it is ordinary content), so a reader
 * who needs it can still select or read it; it simply does not get to
 * relayout the page.
 */
export function ScreenHeader({ title, description }: ScreenHeaderProps) {
  return (
    <header className="flex min-w-0 flex-col gap-1">
      <h1 className="font-medium text-foreground text-title">{title}</h1>
      {description != null && (
        <p className="line-clamp-2 max-w-xl text-body text-muted-foreground">{description}</p>
      )}
    </header>
  );
}
