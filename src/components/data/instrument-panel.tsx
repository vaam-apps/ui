import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

/** `Omit<…, "title">` for the same reason `CardHeaderProps` does it: the
 * native `title` attribute is a string, and this slot is a `ReactNode`.
 * Widening the DOM attribute instead of shadowing it is how you end up
 * with a tooltip nobody asked for. */
export interface InstrumentPanelProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Optional heading. M3's title-large on its emphasized weight (22/28,
   * 500) in the brand face — the one step up from a `Card` title that
   * says "this is a group of figures", not "this is an item". */
  title?: ReactNode;
  /** One line under the title — the window, the source, the caveat.
   * body-medium in `--muted-foreground`; see the module doc for why
   * never `subtle`. */
  caption?: ReactNode;
  children: ReactNode;
}

/**
 * A surface for **pure data representation**: a row of metrics, a chart, a
 * headline figure and its denominator. An M3 Expressive container — the
 * `surface-container` role, the extra-large (28px) corner, 24px of
 * padding, no border, no shadow — with two of M3 Expressive's shapes
 * layered into its top-right corner.
 *
 * # Why this exists, and why it is not just a `Card`
 *
 * The library's own `StatTile` doc already describes the thing this
 * component is: *"tiles appear in rows of three to six, and six shadowed
 * boxes is visual noise where six outlined ones read as one instrument
 * panel."* That sentence names a surface the library did not have. Tiles
 * were getting the effect by repetition — six identical outlines that the
 * eye groups — which works right up until something else on the screen is
 * also outlined.
 *
 * So this is the **instrument register**, the third of three, and the
 * distinction is about what the reader is doing:
 *
 * - **Diagnostic** — tables, drawers, detail panes. You *read* these,
 *   row by row, looking for the one that is wrong. A hairline on a
 *   surface step, and nothing else competing. This is most of the library.
 * - **Floating** — popover, dialog, drawer, toast. These overlap a ground
 *   they do not know, so they get a shadow.
 * - **Instrument** — this. You *scan* it. The job is to make one number
 *   findable in a glance, and a ground that is visibly a different kind of
 *   surface does that better than a fourth kind of border.
 *
 * `Card glow` is the same register at card scale, and `Skeleton
 * instrument` is its placeholder. All three are drawn in one hue family —
 * see "The shapes carry no meaning" below.
 *
 * # What makes it M3 Expressive, and what each choice is for
 *
 * - **Containment by tone, not by line.** M3 groups with a filled
 *   container, and `surface-container` is the role for one: the same tone
 *   a `Card` sits on, told apart from it by what it lacks. No border — the
 *   hairline is what makes a `Card` an M3 *outlined* card and the
 *   diagnostic register's mark, so a panel with one would be a big card.
 *   No shadow — it does not float. `surface-container-high` was the other
 *   candidate and was not taken: it is also `--surface-3`, the hover and
 *   selected fill, so every such fill inside the panel would vanish (the
 *   trap `.surface-raised` exists for in a `Dialog`).
 * - **Shape.** The extra-large corner (`rounded-2xl`, 28px), the step M3
 *   gives its largest containers (dialogs, sheets). The `StatTile`s
 *   inside drop their own hairline and take a filled
 *   `surface-container-highest` and the large-increased corner (20px) —
 *   a nested container tones up, the M3 way of saying "inside this".
 *   Highest rather than high: two steps read as a tile in both themes
 *   where one step was a guess in light, and a hover fill inside a tile
 *   (`--surface-3`, which *is* high) still shows on it.
 * - **Emphasis by type.** The title is title-large emphasized. An
 *   `emphasized` `StatTile` inside the panel grows its figure from
 *   headline-medium (28px) to display-small (36px) on top of the weight
 *   step it already takes — M3 Expressive's hero figure, the one number
 *   the panel exists to make findable. Outside a panel the tile is
 *   unchanged.
 * - **Expressive shapes.** A 4-leaf clover over a much larger, quieter
 *   9-sided cookie, both from M3 Expressive's shape library, tucked into
 *   the top-right corner and clipped by it. They are what makes the
 *   surface read as a different kind of thing at a glance — the job the
 *   aurora mesh used to do.
 *
 * Static and not interactive: no state layer (nothing here responds to a
 * pointer), and nothing animates, so `prefers-reduced-motion` has nothing
 * to stop. A figure you are reading does not get a moving ground.
 *
 * # The shapes carry no meaning
 *
 * They are painted in the seed's own `primary-container`, mixed into the
 * container — chrome, in the one hue family this system reserves for
 * chrome. Not `secondary`/`tertiary`: Expressive rotates those toward the
 * status greens at this seed (`theme.css`'s header has the measurement).
 * No status is inferable from them, there is no per-state variant, and a
 * caller cannot tint them. The hue vocabulary stays entirely with
 * `StatusHue`. The clover rather than a whole small cookie, because a
 * scalloped disc beside a figure reads as a "verified" seal.
 *
 * The aurora mesh this replaced was drawn from the status hues, an
 * exception this file used to argue for; a primary-family shape does not
 * need the exception. `Card glow`'s halo (`--instrument-glow`) and
 * `Skeleton instrument`'s drift (`--skeleton-instrument-*`) are mixed from
 * the same two roles, `primary-container` and `primary`, so the register
 * is one colour family. The `--aurora-*` ramp, `.aurora-glow` and
 * `.aurora-mesh` are deprecated and nothing in the package renders them.
 *
 * # Why the caption tier steps up
 *
 * A shaped ground breaks the assumption every contrast check in this
 * system rests on: that a foreground sits on *one* known surface. So the
 * shapes are opaque mixes rather than transparency, and the panel has
 * exactly three grounds — container, halo, clover — which
 * `contrast.test.ts` resolves and measures. On the clover,
 * `--subtle-foreground` falls to **4.05:1 in dark and 4.28:1 in light** —
 * below the 4.5:1 AA bar — while `--muted-foreground` holds at **5.95:1
 * and 4.71:1**, and every status foreground at 5.95:1 and 4.76:1 or
 * better.
 *
 * So this component renders its own caption at `muted`, and says so here,
 * rather than documenting a rule and trusting every call site to follow
 * it. `StatusPill` makes the identical move for the identical reason when
 * a loud tint lands under its label. **Do not put `text-subtle-foreground`
 * on this surface** — it is the one tier the clover can swallow.
 * `contrast.test.ts` also asserts subtle still *fails* there, so this ban
 * is lifted the day it stops being needed rather than outliving it.
 */
export function InstrumentPanel({
  title,
  caption,
  children,
  className,
  ...props
}: InstrumentPanelProps) {
  return (
    // The fill, the clipping and both shapes are `.instrument-panel` in
    // `theme.css`: the shapes are pseudo-elements, which a utility class
    // cannot draw, and their colours are mixed from the same fill token.
    <div className={cn("instrument-panel rounded-2xl p-6", className)} {...props}>
      {(title != null || caption != null) && (
        <div className="mb-4 flex min-w-0 flex-col gap-1">
          {title != null && (
            <h3 className="truncate font-display font-medium text-foreground text-title">
              {title}
            </h3>
          )}
          {/* `muted`, not `subtle` — see the module doc. This is the tier
              swap, and it is here rather than in a guideline because a
              guideline would be followed about half the time. */}
          {caption != null && (
            <p className="line-clamp-2 text-body text-muted-foreground">{caption}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
