import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

// R6 (AGENTS.md): the same three banner treatments — a neutral scope/notice
// box, a danger error box, and a plain caption-only note — were hand-rolled
// inline in every screen that needed one (`rounded-sm border border-edge
// bg-surface-2 px-3 py-2 text-caption text-muted-foreground` for "neutral",
// `border-state-danger-border bg-state-danger-bg ... text-state-danger-fg`
// for "danger"). Classes moved here verbatim, parameterised by variant, not
// redesigned. `InlineEmptyState` already set the precedent for this shape
// of extraction (a status treatment repeated per-screen, given one home) —
// this is the same move applied to a different repeated block.
//
// Not to be confused with `InlineEmptyState`: that one is for "there is
// nothing to show here" inside a list; this one is for a standing notice or
// an error above/around content that *is* showing.

export interface InlineBannerProps {
  /** `'neutral'` — a standing notice (scope, caveat). `'danger'` — an
   * error. `'warning'` — recoverable, needs attention (a stale write).
   * `'success'` — a positive confirmation (a verified audit chain).
   * `'uncertain'` — degraded or unknown, neither failure nor success (a
   * stalled live feed, a UCS-2 volume spike). `'plain'` — a caption-only
   * note with no border or fill, for something that doesn't need the
   * weight of a bordered box.
   *
   * The last three were added after the R6 factorization, not with it:
   * four route groups had hand-rolled boxes in exactly these tones because
   * the variant they needed did not exist, and the agents doing the
   * factorization were deliberately barred from editing this package. Two
   * of them flagged the gap rather than inventing a competing component,
   * which is the behaviour the constraint was for.
   *
   * `success` is quiet chrome wearing a loud variant's clothes: rendered
   * on a real page, `EveryVariant` showed five bordered boxes and a bare
   * line of green text, because `--state-success-bg`/`-border` are
   * `transparent` in `theme.css` on purpose (`success` is one of the two
   * quiet status hues — see `isQuietHue` in `../status/status-tokens`, the
   * same fact `StateChip` had to account for, and the same shape of bug
   * `RadioGroup`/`ChipSelect` had on the selection side, fixed in
   * `be63a70`). `success` now renders through the same achromatic
   * `border-edge`/`bg-surface-2` chrome as `neutral`, keeping only its
   * own `text-state-success-fg`, so it reads as a member of the same
   * family instead of a rendering bug. */
  variant?: "neutral" | "danger" | "warning" | "success" | "uncertain" | "plain";
  children: ReactNode;
  className?: string;
}

export function InlineBanner({ variant = "neutral", children, className }: InlineBannerProps) {
  return (
    <div
      className={cn(
        "text-caption",
        variant === "neutral" &&
          "rounded-sm border border-edge bg-surface-2 px-3 py-2 text-muted-foreground",
        variant === "danger" &&
          "rounded-sm border border-state-danger-border bg-state-danger-bg px-3 py-2 text-state-danger-fg",
        variant === "warning" &&
          "rounded-sm border border-state-warning-border bg-state-warning-bg px-3 py-2 text-state-warning-fg",
        // `success` draws the achromatic quiet-hue box, not its own.
        // `--state-success-bg`/`-border` are declared `transparent` on
        // purpose (see `isQuietHue` in `../status/status-tokens`), so
        // painting them here rendered a bare line of green text between
        // five bordered siblings. The classes are literal rather than a
        // call to `isQuietHue("success")`: a predicate applied to a
        // literal is a constant with an unreachable branch, and it cannot
        // deliver the "stays correct if the quiet set changes" benefit it
        // looks like it delivers, because `isQuietHue` is itself a hand-
        // written list rather than something derived from `theme.css`.
        // `StateChip` calls it on a runtime value, where it is a real check.
        variant === "success" &&
          "rounded-sm border border-edge bg-surface-2 px-3 py-2 text-state-success-fg",
        variant === "uncertain" &&
          "rounded-sm border border-state-uncertain-border bg-state-uncertain-bg px-3 py-2 text-state-uncertain-fg",
        variant === "plain" && "text-subtle-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}
