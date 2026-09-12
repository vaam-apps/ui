import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { HUE_CLASSES, isQuietHue, type StatusHue } from "./status-tokens";

/**
 * A compact, state-toned chip for a single word or short phrase rendered
 * *inline* — beside a table cell's value, after a label, inside a card.
 *
 * # Not `InlineBanner`, and not `Badge`
 *
 * `InlineBanner` is the full-width `px-3 py-2` notice that owns its own
 * line. Four route groups correctly refused to route these through it
 * during the R6 factorization: forcing a chip into a banner would mean
 * overriding padding and swapping `<span>` for `<div>`, which is fighting
 * the primitive rather than using it. That refusal was right, and this is
 * the component they were missing.
 *
 * `Badge` is the other near-miss: it exists, but it is built on daisyUI's
 * `badge-neutral`/`badge-outline` classes, a different visual system from
 * the `state-*` token family every status surface in this console uses.
 * A chip that must read as *success* or *danger* cannot express that
 * through `Badge` without bypassing its variants entirely.
 *
 * # Why it is shared
 *
 * Five sites across three route groups (`workers`, `routes`, `simulator`)
 * had byte-identical `rounded-sm border border-state-<tone>-border
 * bg-state-<tone>-bg px-1.5 py-0.5 text-caption text-state-<tone>-fg`
 * strings, differing only in tone. A sixth (`dashboard`) used the same
 * shape at `px-2`. They are unified here at `px-1.5`, the majority
 * spelling — a one-step spacing change on that single site, and the same
 * normalisation `DetailRow` made for the same reason: the console should
 * not render one concept two ways because two people typed a different
 * padding.
 *
 * `StatusPill` is **not** replaced by this. It maps a whole state
 * machine's variants onto a fixed vocabulary and carries a glyph; this is
 * the generic chip for everything that is state-toned but is not a state
 * machine — a capability flag, a derived verdict, a one-word qualifier.
 *
 * # Tone
 *
 * Tone comes from the shared [`StatusHue`] vocabulary rather than a second
 * private list. Before this, `StateChip` carried its own four-tone table
 * whose class strings were transcribed by hand from the same tokens
 * `HUE_CLASSES` already held — two copies of one mapping, and the chip's
 * copy was missing three of the hues, so a caller wanting `expired` or
 * `parked` had no way to ask for it and reached for `className` instead.
 *
 * # `neutral` and `success` are quiet, not broken
 *
 * `--state-neutral-bg`/`-border` and `--state-success-bg`/`-border` are
 * `transparent` in `theme.css`, on purpose: those two hues are the
 * "quiet" half of the vocabulary, meant to read as a glyph and a word so
 * a screen where most rows succeeded does not turn into a wall of green
 * boxes. `StateChip` used to paint `hue.border`/`hue.bg` unconditionally
 * for all seven tones, which is exactly the mistake `RadioGroup` and
 * `ChipSelect` made from the *selection* side (see `be63a70`'s doc
 * comment on `RadioGroup`): borrow a quiet hue for unconditional chrome
 * and get an invisible box back. Here the two quiet tones rendered as
 * bare text with no box at all, so they read as five chips and two
 * rendering bugs instead of seven chips at two weights.
 *
 * `StatusPill` already solves this, but by a different route: its
 * `attention` field is per-*state* data (a `pending` order can be quiet
 * even though `paid` is also `success`), so it gates `hue.bg`/`hue.border`
 * behind that field. `StateChip` has no per-instance attention field —
 * its `tone` *is* the hue — so "is this hue quiet" has to be a static
 * fact about the hue itself instead. That fact is [`isQuietHue`], which
 * lives in `status-tokens.ts` beside the hue table it is a property of —
 * not here, because it is not a property of this component.
 */
export type StateChipTone = StatusHue;

export interface StateChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: StateChipTone | undefined;
}

export function StateChip({ className, tone = "uncertain", ...props }: StateChipProps) {
  const hue = HUE_CLASSES[tone];
  const quiet = isQuietHue(tone);
  return (
    <span
      className={cn(
        "rounded-sm border px-1.5 py-0.5 text-caption",
        // Quiet tones borrow the same achromatic bordered surface the
        // rest of the library uses for a quiet box (`border-edge` +
        // `bg-surface-2`, the same pair `InlineBanner`'s `neutral`
        // variant already uses) instead of the hue's own transparent
        // fill/border, so the chip is still legibly a chip.
        quiet ? "border-edge bg-surface-2" : [hue.border, hue.bg],
        hue.fg,
        className,
      )}
      {...props}
    />
  );
}
