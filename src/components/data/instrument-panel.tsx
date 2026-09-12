import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

/** `Omit<…, "title">` for the same reason `CardHeaderProps` does it: the
 * native `title` attribute is a string, and this slot is a `ReactNode`.
 * Widening the DOM attribute instead of shadowing it is how you end up
 * with a tooltip nobody asked for. */
export interface InstrumentPanelProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Optional heading. Set in the display face, like every other panel
   * title in the system. */
  title?: ReactNode;
  /** One line under the title — the window, the source, the caveat. */
  caption?: ReactNode;
  children: ReactNode;
}

/**
 * A surface for **pure data representation**: a row of metrics, a chart, a
 * headline figure and its denominator. An aurora mesh ground, no border,
 * no hairline grid.
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
 * `Card glow` is the same register at card scale.
 *
 * # The mesh carries no meaning
 *
 * It is drawn from the `--aurora-*` ramp, which is bound to the system's
 * own hues so it cannot drift — but it is chrome. No status is inferable
 * from it, there is no per-state variant, and a caller cannot tint it.
 * The hue vocabulary stays entirely with `StatusHue`, which is the only
 * reason a coloured surface is safe in a system whose whole premise is
 * that colour means something.
 *
 * # Why the caption tier steps up
 *
 * A gradient ground breaks the assumption every contrast check in this
 * system rests on: that a foreground sits on *one* known surface.
 * Measured over `--surface-1` at the shipped 14% cap, worst case across
 * the four blobs, `--subtle-foreground` falls to **4.41:1 in dark and
 * 4.45:1 in light** — below the 4.5:1 AA bar — while `--muted-foreground`
 * holds at 5.29:1 and above.
 *
 * So this component renders its own caption at `muted`, and says so here,
 * rather than documenting a rule and trusting every call site to follow
 * it. `StatusPill` makes the identical move for the identical reason when
 * a loud tint lands under its label. **Do not put `text-subtle-foreground`
 * on this surface** — it is the one tier the mesh can swallow.
 */
export function InstrumentPanel({
  title,
  caption,
  children,
  className,
  ...props
}: InstrumentPanelProps) {
  return (
    <div
      className={cn(
        "aurora-mesh rounded-box bg-surface-1 p-5",
        // No border. The mesh *is* the edge — a hairline on top of it
        // reads as two competing boundaries, and the whole point of a
        // different ground is not needing one.
        className,
      )}
      {...props}
    >
      {(title != null || caption != null) && (
        <div className="mb-4 flex min-w-0 flex-col gap-1">
          {title != null && (
            <h3 className="truncate font-display font-medium text-foreground text-title-sm tracking-normal">
              {title}
            </h3>
          )}
          {/* `muted`, not `subtle` — see the module doc. This is the tier
              swap, and it is here rather than in a guideline because a
              guideline would be followed about half the time. */}
          {caption != null && (
            <p className="line-clamp-2 text-caption text-muted-foreground">{caption}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
