import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * `false` renders the flat `--surface-3` block with no drift at all.
   *
   * For the rare placeholder that sits *inside* something already moving
   * — a row mid-wash, a panel mid-transition — where a second motion
   * competes with the first. Everywhere else leave it on; a reader who
   * has asked for reduced motion is already served by the media query in
   * `theme.css`, and does not need each call site to decide for them.
   */
  animated?: boolean;
  /**
   * Paints the drift with the `--aurora-*` hue ramp instead of the
   * neutral default.
   *
   * `false` (the default) is the *tonal* drift: the same geometry, mixed
   * with `--color-base-content` instead of a hue, so it reads as a
   * brightness texture rather than a tint. That is the diagnostic-
   * register colour language — see `instrument-panel.tsx`'s three-
   * register doctrine — and it is what most `Skeleton`s are: table
   * cells, form fields, detail panes, all content a reader reads rather
   * than scans.
   *
   * Set it `true` only for a placeholder standing in for content that
   * will itself render inside `InstrumentPanel`/`StatTile` — a scanned
   * dashboard metric, not read prose. The hued chrome that surface is
   * built for is decorative there for the same reason `Card`'s `glow`
   * prop is opt-in rather than default: coloured chrome on every
   * placeholder makes the one inside a real instrument panel no longer
   * distinctive, and it is chrome a table cell has no business wearing.
   */
  instrument?: boolean;
}

/**
 * A placeholder for content whose *shape* is known but whose value has not
 * arrived. Match the real element's height exactly (design doc §5.2) so
 * nothing shifts when it lands — that is still the rule this component
 * exists to make easy.
 *
 * # The motion, and the rule it does not break
 *
 * The house rule was "no skeleton shimmer" (§3.8 rule 2), and it still is.
 * A shimmer is a highlight that sweeps across the block on a fixed period
 * — it reads as a progress indicator, implying the content is a knowable
 * fraction of the way through arriving, and a table of twenty of them
 * pulses in unison like a metronome. Both are the reasons the rule was
 * written, and both are properties of the *sweep*, not of movement as
 * such.
 *
 * What runs here instead is a chaotic gradient: two oversized, very
 * low-contrast gradient fields drifting past each other on coprime
 * periods, with no edge, no direction and no shared phase — see
 * `theme.css`'s own `.skeleton-chaos` block for the mechanics and the
 * numbers, including why this loop is *not* built from the M3 Expressive
 * spring tokens (`--ease-spatial`/`--ease-effects`): those describe a
 * value settling once, this is an unbroken ambient loop, and neither the
 * duration nor the shape of a spring transfers to that.
 *
 * Deliberately still a hand-rolled `<div>`, not daisyUI's `.skeleton`:
 * read `daisyui/components/skeleton.css` before reaching for it — what it
 * ships is precisely the `background-position` sweep described above.
 *
 * # Colour: tonal by default, `instrument` for the one case that isn't
 *
 * The drift is a brightness texture, not a tint — see the `instrument`
 * prop above for when the hued alternative is actually the right call.
 *
 * # Not announced
 *
 * `aria-hidden`, because a skeleton is a picture of absent content and
 * reading out a dozen empty boxes is worse than silence. The *wait*
 * still has to be announced: `RouteSkeleton` carries the `role="status"`
 * live region for the screen-level case, and any other caller standing a
 * skeleton in for real content should do the same one level up.
 *
 * Radius stays `rounded-sm` (`--radius-field`, 12px) rather than
 * `--radius-box` — this component stands in for table cells and text
 * lines across every screen, all field-scale content.
 */
export function Skeleton({
  className,
  animated = true,
  instrument = false,
  ...props
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-sm bg-surface-3",
        animated && "skeleton-chaos",
        animated && instrument && "skeleton-instrument",
        className,
      )}
      {...props}
    />
  );
}

export interface SkeletonTextProps extends Omit<SkeletonProps, "children"> {
  /** How many lines to stand in for. */
  lines?: number;
  /** Height of each line. Match the real text's line-height. */
  lineClassName?: string;
}

/**
 * A paragraph-shaped placeholder: several lines, the last one short.
 *
 * The short last line is the whole point, and it is why this is a
 * component rather than a loop at each call site. A stack of equal-width
 * bars reads as a table or a list; real prose ends mid-line, and copying
 * that is what makes a paragraph placeholder recognisable as one before
 * the text arrives.
 *
 * The widths are a fixed, hand-picked cycle rather than `Math.random()`:
 * a random width is a different value on the server and on the client,
 * which is a hydration mismatch, and it also makes every re-render
 * twitch.
 */
const LINE_WIDTHS = ["w-full", "w-[92%]", "w-[97%]", "w-[88%]"] as const;

export function SkeletonText({
  lines = 3,
  className,
  lineClassName,
  animated = true,
  instrument = false,
  ...props
}: SkeletonTextProps) {
  return (
    <div className={cn("flex w-full flex-col gap-2", className)} {...props}>
      {Array.from({ length: Math.max(lines, 1) }, (_, i) => {
        const last = i === lines - 1;
        return (
          <Skeleton
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed count of interchangeable placeholder bars, never reordered
            key={i}
            animated={animated}
            instrument={instrument}
            className={cn(
              "h-4",
              last && lines > 1 ? "w-[58%]" : LINE_WIDTHS[i % LINE_WIDTHS.length],
              lineClassName,
            )}
          />
        );
      })}
    </div>
  );
}
