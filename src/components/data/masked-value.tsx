"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/cn";
import { maskSecret } from "../../lib/mask-secret";
import { PRESS_SHAPE_MORPH } from "../../lib/press-shape";
import { CopyButton } from "./copy-button";

export interface MaskedValueProps {
  /** The full value. Present in the DOM only while revealed. */
  value: string;
  /** Trailing characters left visible while masked, so the value stays
   * recognisable without being readable. `0` masks everything. */
  reveal?: number;
  /** Leading characters left visible — for a prefixed credential like
   * `whsec_…` or `sk_live_…`, where the prefix says what kind of thing it
   * is and is not itself secret. */
  prefix?: number;
  /** Allow revealing at all. `false` gives a permanently masked value with
   * no toggle — for something displayed for recognition only. */
  revealable?: boolean;
  /** Offer a copy button. Copies the full value whether or not it is
   * currently revealed — the point of masking is the screen, not the
   * clipboard. */
  copyable?: boolean;
  /** Names the value in the toggle's and copy button's accessible names,
   * e.g. `"signing secret"`. */
  label?: string;
  className?: string | undefined;
}

/**
 * A secret or sensitive value, masked by default with an explicit reveal.
 *
 * # What this is and is not
 *
 * It is a **shoulder-surfing and screen-share control**, not a security
 * boundary. Whoever renders this already received the value over the
 * wire; anyone with the session and dev tools can read it regardless.
 * Withholding data that has already crossed the wire to an authorised,
 * authenticated session would be theatre. What masking buys is real but
 * narrow: the value does not end up in a screenshot, a recording, or the
 * eyeline of the person sitting behind the operator.
 *
 * If a value must genuinely never reach the client, that is an API
 * decision — do not send it — and no component can substitute for it.
 *
 * # Why it is shared
 *
 * Both applications this package serves had hand-rolled one: a console
 * masking a webhook signing secret as `whsec_••••••••••<last 4>`, and a
 * payments dashboard rendering a masked payer reference and a TOTP
 * enrolment secret as plain text because no such component existed.
 */
export function MaskedValue({
  value,
  reveal = 4,
  prefix = 0,
  revealable = true,
  copyable = true,
  label = "value",
  className,
}: MaskedValueProps) {
  const [revealed, setRevealed] = useState(false);
  const shown = revealed ? value : maskSecret(value, prefix, reveal);

  return (
    <span className={cn("group inline-flex items-center gap-1.5", className)}>
      <span className={cn("font-mono", revealed && "select-all break-all")}>{shown}</span>
      {revealable && (
        <button
          type="button"
          onClick={() => setRevealed((previous) => !previous)}
          aria-label={revealed ? `Hide ${label}` : `Reveal ${label}`}
          aria-pressed={revealed}
          // `-m-1 p-1 rounded-full`: same hit-area idiom as `copy-button.tsx`
          // and the `dialog`/`drawer`/`toast` close buttons — negative
          // margin cancels the padding, so this grows the clickable box to
          // roughly 32×32px without moving the icon or shifting the
          // `gap-1.5` row it sits in. Previously bare, a ~12px icon with no
          // hit-area padding at all.
          //
          // This is the one place two `-m-1` controls sit next to each
          // other (this button, then `CopyButton` below, both inside the
          // same `gap-1.5` row) — worked through on paper: each pulls 4px
          // into the 6px gap, so their invisible padding boxes overlap by
          // 2px at the boundary, while the *visible* icon-to-icon spacing
          // stays exactly 6px (the padding is inset from the border box by
          // the same 4px the margin removes, so the glyph itself never
          // moves). A worst-case pointer landing on that exact 2px sliver
          // resolves to whichever button paints on top; not worth widening
          // the row's gap to chase.
          //
          // `PRESS_SHAPE_MORPH` (`press-shape.ts`) replaces the plain
          // `transition-colors` this used to carry with the M3 Expressive
          // press morph, in the same lockstep as `Button size="icon"`,
          // `DialogClose` and the toast dismiss button.
          className={cn(
            "-m-1 shrink-0 rounded-full p-1 text-subtle-foreground hover:bg-surface-3 hover:text-foreground",
            PRESS_SHAPE_MORPH,
          )}
        >
          {revealed ? <EyeOff size={12} strokeWidth={1.5} /> : <Eye size={12} strokeWidth={1.5} />}
        </button>
      )}
      {copyable && <CopyButton value={value} label={`Copy ${label}`} />}
    </span>
  );
}
