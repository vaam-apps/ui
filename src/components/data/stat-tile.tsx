import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import type { StatusHue } from "../status/status-tokens";
import { HUE_CLASSES } from "../status/status-tokens";

export interface StatTileProps {
  label: ReactNode;
  /** The number itself. Pass a `Money` or a formatted string — this
   * component does no formatting, because a tile has no way to know
   * whether it is showing a count, a currency or a rate. */
  value: ReactNode;
  /** One line under the value: the comparison, the window, the caveat.
   * A bare number with no denominator is the most common way a dashboard
   * misleads, so this slot exists to make the denominator easy. */
  caption?: ReactNode;
  /** Tints the value. Leave unset unless the number's own colour carries
   * meaning — a wall of coloured tiles makes the one that matters harder
   * to find, which is the opposite of the point. */
  tone?: StatusHue | undefined;
  /** Top-right slot — a sparkline, a `StateChip`, a refresh button. */
  action?: ReactNode;
  className?: string | undefined;
}

/**
 * One headline number with its label and context.
 *
 * Borders, not shadows, and no card chrome of its own beyond a hairline:
 * tiles appear in rows of three to six, and six shadowed boxes is visual
 * noise where six outlined ones read as one instrument panel.
 *
 * `<dl>`/`<dt>`/`<dd>` rather than divs — a tile *is* a term and its
 * definition, and the semantics make a row of them navigable rather than
 * an undifferentiated wall of text to a screen reader.
 */
export function StatTile({ label, value, caption, tone, action, className }: StatTileProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-box border border-edge bg-base-300 p-4",
        className,
      )}
    >
      {/* Outside the `<dl>`, and absolutely positioned rather than a flex
          sibling of the `<dt>`. A `<dl>` may contain only `<dt>`, `<dd>`
          and `<div>`s that wrap dt/dd groups — an action button among
          them is invalid markup, which axe reports as a serious
          `definition-list` violation. Found by the a11y addon, after an
          earlier version nested the action in a header row inside the
          list. */}
      {action != null && <div className="absolute top-4 right-4">{action}</div>}
      <dl className="flex flex-col gap-1">
        <dt className={cn("text-caption text-muted-foreground", action != null && "pr-20")}>
          {label}
        </dt>
        <dd
          className={cn(
            "font-mono text-metric tabular-nums",
            tone === undefined ? "text-foreground" : HUE_CLASSES[tone].fg,
          )}
        >
          {value}
        </dd>
        {caption != null && <dd className="text-caption text-subtle-foreground">{caption}</dd>}
      </dl>
    </div>
  );
}
