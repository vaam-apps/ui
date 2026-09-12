"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { TableRow, type TableRowProps } from "../primitives/table";
import type { StatusHue } from "../status/status-tokens";

export interface LiveRowProps extends TableRowProps {
  /** Any value that changes to trigger a wash — pass the row's `@version`, an exact change key immune to clock skew. */
  washTrigger: string | number;
  /** The destination state's hue, so the wash tints toward where the row landed. */
  washHue?: StatusHue;
}

const WASH_BG_CLASS: Record<StatusHue, string> = {
  neutral: "bg-state-neutral-fg/10",
  success: "bg-state-success-fg/10",
  warning: "bg-state-warning-fg/10",
  danger: "bg-state-danger-fg/10",
  uncertain: "bg-state-uncertain-fg/10",
  expired: "bg-state-expired-fg/10",
  parked: "bg-state-parked-fg/10",
};

/**
 * The row-level half of the design doc's `LiveTable`/`LiveRow` contract
 * (§5.3, §6.5 rule 4): "in-place status change never moves a row" — this
 * wraps `TableRow` with the 240ms wash-then-decay on a status change,
 * nothing else moves or resizes. The full `LiveTable` (scroll-position-
 * dependent buffered insertion, the sticky "N new" pill, sort-mode
 * switching) is a later, screen-level task — this is the reusable unit it
 * will be built on, shipped now so the wash behaviour isn't retrofitted
 * per-screen later.
 *
 * Reduced motion (§3.8 rule 3): the wash becomes a static hold instead of
 * a timed decay — the signal must survive, only the animation may not.
 */
export function LiveRow({
  washTrigger,
  washHue = "neutral",
  className,
  children,
  ...props
}: LiveRowProps) {
  const [washing, setWashing] = useState(false);
  const previousTrigger = useRef(washTrigger);
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (previousTrigger.current === washTrigger) return;
    previousTrigger.current = washTrigger;
    setWashing(true);
    const holdMs = reducedMotion ? 1200 : 400 + 240 + 600;
    const timeout = setTimeout(() => setWashing(false), holdMs);
    return () => clearTimeout(timeout);
  }, [washTrigger, reducedMotion]);

  return (
    <TableRow
      className={cn(
        // The transition classes are unconditional — present whether or
        // not `washing` is currently true — and only the tint itself is
        // gated. Gating both together on `washing` made the *decay* edge
        // (the timeout below flipping `washing` back to `false`) land on
        // a post-change style with no `transition-colors` in it at all,
        // so nothing interpolated: the tint simply vanished on the next
        // paint instead of fading out over `--dur-state` as documented
        // above. With the transition always present, both the wash-in and
        // the wash-out animate.
        //
        // `TableRow` already carries its own `transition-colors
        // duration-[var(--dur-instant)]` (see `table.tsx`) for its hover
        // state. `cn()` (`src/lib/cn.ts`) resolves same-group utility
        // conflicts in *call order*, and `TableRow` merges its own base
        // classes ahead of the `className` it receives — this string —
        // so `duration-[var(--dur-state)]` below is applied after, and
        // wins over, `duration-[var(--dur-instant)]`.
        reducedMotion ? "transition-none" : "transition-colors ease-out",
        // Only the *duration* is gated, not the transition itself.
        //
        // Gating the whole `transition-colors` was the original bug (the
        // decay edge landed on a style with no transition, so the tint
        // blinked off). But making `duration-[var(--dur-state)]`
        // unconditional overshot: `TableRow` carries
        // `duration-[var(--dur-instant)]` for its *hover*, `cn()` resolves
        // same-group utilities last-wins, and every `LiveRow` therefore
        // hovered at 240ms while a plain `TableRow` beside it hovered at
        // 90ms — visibly inconsistent in a table holding both.
        washing && "duration-[var(--dur-state)]",
        washing && WASH_BG_CLASS[washHue],
        className,
      )}
      {...props}
    >
      {children}
    </TableRow>
  );
}
