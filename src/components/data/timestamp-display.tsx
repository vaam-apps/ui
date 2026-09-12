"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "../../lib/cn";
import { formatAbsolute } from "../../lib/format-instant";

// A single shared 30s interval drives every `TimestampDisplay` instance's
// relative-time re-render (design doc §7.2: "a table of 200 rows must not
// run 200 timers"). Lazily started on the first mounted instance, torn
// down when the last one unmounts.

let tick = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  timer ??= setInterval(() => {
    tick += 1;
    for (const l of listeners) l();
  }, 30_000);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function useSharedTick(): number {
  return useSyncExternalStore(
    subscribe,
    () => tick,
    () => 0,
  );
}

function formatRelative(diffMs: number): string {
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

export interface TimestampDisplayProps {
  /** ISO-8601. */
  value: string;
  /**
   * Any IANA zone name, e.g. `"UTC"`, `"Africa/Douala"`, `"Asia/Kolkata"`.
   * Forwarded to the shared `formatAbsolute` (`../../lib/format-instant`)
   * — the same formatter `StateTimeline` renders its own absolute column
   * through — so the two components can't drift into two spellings of
   * the same stamp, and the UTC-offset suffix stays correct across DST
   * and for zones this component has never been told about.
   *
   * This used to be hard-coded to UTC, with a comment explaining that the
   * zone toggle lived on a consuming application's top bar. That
   * application isn't part of this repository, so the excuse didn't
   * belong in a published component's source; `timezone` is now this
   * component's own prop, same shape as `StateTimeline`'s.
   */
  timezone?: string | undefined;
  className?: string;
}

/**
 * Relative for anything under 24h (`just now`, `2m`, `47m`, `6h` — under a
 * minute reads as `"just now"` rather than `0m`), absolute otherwise —
 * design doc §7.2. Renders the absolute value on the server and on first
 * client render (so server/client markup matches and Next doesn't
 * warn/flash), then upgrades to relative once mounted, driven by the
 * shared interval above rather than its own timer.
 *
 * The absolute form is `formatAbsolute`'s — `2026-08-08 14:03:07 Z` for
 * UTC, `2026-08-08 15:03:07 +01` for `Africa/Douala` — with a space
 * before the offset. Earlier versions of this component hard-coded UTC
 * and wrote the suffix as a bare `Z` with no preceding space
 * (`…14:03:07Z`); adopting the shared formatter for timezone support
 * changes that spelling for every timestamp this component renders,
 * including existing UTC ones.
 */
export function TimestampDisplay({ value, timezone = "UTC", className }: TimestampDisplayProps) {
  useSharedTick();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const date = new Date(value);
  const absolute = formatAbsolute(value, timezone);

  if (!hydrated) {
    return (
      <span className={cn("font-mono text-subtle-foreground tabular-nums", className)}>
        {absolute}
      </span>
    );
  }

  const diffMs = Date.now() - date.getTime();
  const display = diffMs >= 0 && diffMs < 24 * 3600 * 1000 ? formatRelative(diffMs) : absolute;

  return (
    <span
      title={absolute}
      className={cn("font-mono text-subtle-foreground tabular-nums", className)}
    >
      {display}
    </span>
  );
}
