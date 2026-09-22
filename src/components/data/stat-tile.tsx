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
   * misleads, so this slot exists to make the denominator easy.
   *
   * Stays `font-sans`, deliberately not `font-italic`, and it still
   * declines under the **wider** reading of that role — italic now marks
   * any human prose written to the operator, including `FormField` hints
   * and option descriptions, not only commentary on a decision.
   *
   * The line `theme.css` draws is: could this string be a template that
   * only fills in a value the system already has? The shipped fixtures —
   * `"98.2% of 12,710 terminal"`, `"XAF, across all providers"` — are a
   * computed ratio and a currency unit. Both are exactly that, emitted
   * facts of the same register as the mono value above them, so both stay
   * upright however small and muted they are.
   *
   * Compare `StateTimeline`'s `AnnotationNode`, which is a person
   * qualifying one specific record, and stays italic. If a future caption
   * is genuinely someone's explanation, it should not flip this default —
   * pass it through a slot that says so, rather than reopening this one. */
  caption?: ReactNode;
  /** Tints the value. Leave unset unless the number's own colour carries
   * meaning — a wall of coloured tiles makes the one that matters harder
   * to find, which is the opposite of the point. */
  tone?: StatusHue | undefined;
  /** Singles this tile's value out among structurally identical peers —
   * M3 Expressive's "emphasised" type register, ported to this package's
   * own scale (see `theme.css`'s comment above the `--text-metric*`
   * tokens for the androidx source and the full reasoning). Bumps the
   * value one weight step, `font-mono`'s unweighted default (400) to
   * `font-medium` (500) — the same Regular → Medium step
   * `DisplayLargeEmphasized`/`HeadlineSmallEmphasized`/etc. take in
   * androidx's own tokens for a role at this size, applied the same way
   * `SideNav`'s active rail item already bumps to `font-medium` over its
   * unweighted siblings.
   *
   * Deliberately not `tone`: colour is reserved for status, so it is the
   * wrong tool for "this is the one to look at first" and would read as
   * a status that is not there. Leave unset on every tile in a row
   * except the one the reader should find first — a row where every
   * tile is emphasised has no emphasis, the same argument `Card`'s
   * `glow` doc makes for its own register. */
  emphasized?: boolean | undefined;
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
export function StatTile({
  label,
  value,
  caption,
  tone,
  emphasized,
  action,
  className,
}: StatTileProps) {
  return (
    <div
      className={cn(
        // `min-w-0` for the same reason `Card` carries one: tiles are laid
        // out in a grid, a grid item defaults to `min-width: auto`, and
        // the truncating label inside sets its own min-content to the
        // whole string — so without this a long label widens the track
        // and the row of tiles overflows instead of the label clipping.
        "relative flex min-w-0 flex-col rounded-box border border-edge bg-base-300 p-4",
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
      <dl className="flex min-w-0 flex-col gap-1">
        <dt
          className={cn("truncate text-caption text-muted-foreground", action != null && "pr-20")}
        >
          {label}
        </dt>
        {/* The number itself is never clamped — a truncated figure is a
            wrong figure. It gets `break-words` instead, so an
            unexpectedly long one wraps inside the tile rather than
            widening the whole row of tiles. */}
        <dd
          className={cn(
            "min-w-0 break-words font-mono text-metric tabular-nums",
            tone === undefined ? "text-foreground" : HUE_CLASSES[tone].fg,
            emphasized === true && "font-medium",
          )}
        >
          {value}
        </dd>
        {/* Two lines. Tiles sit in a grid and stretch to the tallest, so
            one long caption raises every tile in the row — the denominator
            this slot exists for is a phrase, not a paragraph.
            Sans, not italic — see the `caption` prop doc above for why
            this slot fails `--font-italic`'s own test. */}
        {caption != null && (
          <dd className="line-clamp-2 text-caption text-subtle-foreground">{caption}</dd>
        )}
      </dl>
    </div>
  );
}
