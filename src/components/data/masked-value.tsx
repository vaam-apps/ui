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
          // `[--tap-rest:-4px] p-1 rounded-full`: same hit-area idiom as
          // `copy-button.tsx` and the `dialog`/`drawer`/`toast` close
          // buttons — the resting negative margin (a property rather than
          // a `-m-1` utility, since `.tap-target` writes `margin` itself;
          // still -4px computed at compact) cancels the padding, so this
          // grows the clickable box to
          // 20×20px (a 12px icon plus 4px of padding each side — border-box,
          // per Tailwind's preflight reset) without moving the icon or
          // shifting the `gap-1.5` row it sits in. This comment said
          // "roughly 32×32px" until the arithmetic was checked while wiring
          // D10's press-morph radius below, which needs the real number:
          // `dialog.tsx`'s own close button carries the identical idiom at
          // a 16px icon and its comment records the same class of stale
          // claim (also corrected, to 24×24px) for the same reason.
          // Previously bare, a ~12px icon with no hit-area padding at all.
          //
          // This is the one place two of these controls sit next to each
          // other (this button, then `CopyButton` below, both inside the
          // same `gap-1.5` row), and the arithmetic here was wrong in two
          // ways for one release. Measured, in Chromium, rather than
          // worked through on paper: `gap-1.5` is 6px and each control's
          // `-m-1` pulls 4px in from *both* ends of it, so the pitch is
          // 12 + 6 = 18px while each visible box is 20px wide — the two
          // boxes do not sit "6px apart", they **overlap by 2px**, and
          // the visible icon-to-icon spacing is 6px only in the sense
          // that the glyphs are 6px apart inside boxes that already
          // touch. Confirmed live: the toggle at x = 187.64 and the copy
          // button at x = 205.64, both 20px wide.
          //
          // D11 (comfortable-only, see `theme.css`'s `.tap-target`
          // header) made that overlap a defect rather than a sliver, and
          // an earlier revision of this comment accepted it on the
          // grounds that the consequence was imprecision. It was not.
          // With a 48px cover reaching 14px past a 20px box on every
          // side, `CopyButton`'s cover spanned 191.64 → 239.64 and
          // covered **16 of this button's 20 visible pixels**; being
          // later in DOM order it won hit-testing outright, so a real
          // `page.mouse.click` at the eye glyph's own centre left the
          // value masked and **put the secret on the clipboard**. Only a
          // 4px strip at this button's left edge still worked. It reached
          // consumers who never opted into comfortable, too, because the
          // cover reads `--density` at the element and
          // `DetailDrawerContent` sets it unconditionally on a
          // phone-width sheet.
          //
          // The fix is not a smaller inset — two 20px controls whose
          // centres are 18px apart cannot both own a 48px target,
          // whatever the insets say. `.tap-target` reserves its target as
          // *margin* now, the way M3's own
          // `minimumInteractiveComponentSize()` reserves layout space, so
          // at comfortable this row's own pitch grows with the density:
          // 48px of margin box each, 6px of `gap-1.5` between them, two
          // disjoint 48px targets 54px apart centre to centre, and a row
          // that is 102px wide instead of 30px. That width is the honest
          // price of the target, and it is charged only at the density
          // that asked for it — compact still measures 30px, byte for
          // byte. `e2e/tap-targets.spec.ts` pins both halves with
          // `elementFromPoint` at each glyph's centre.
          //
          // `PRESS_SHAPE_MORPH` (`press-shape.ts`) replaces the plain
          // `transition-colors` this used to carry with the M3 Expressive
          // press morph, in the same lockstep as `Button size="icon"`,
          // `DialogClose` and the toast dismiss button.
          // `[--btn-press-radius:calc(20px*0.1)]`: this control's own
          // fixed 20×20 box (12px icon, see above) fed through the same
          // 0.1 circular ratio `.btn-circle` uses in `theme.css` —
          // `PRESS_SHAPE_MORPH` reads `--btn-press-radius` rather than
          // naming a value itself, per its own header.
          className={cn(
            "relative shrink-0 rounded-full p-1 text-subtle-foreground hover:bg-surface-3 hover:text-foreground",
            "[--btn-press-radius:calc(20px*0.1)]",
            // D11 (`theme.css`'s own header on `.tap-target`): this
            // control's own fixed 20×20 box (12px icon plus `p-1`, and
            // `[--tap-rest:-4px]` is the `-m-1` that used to be a utility
            // here — that rule writes `margin` itself, so it takes the
            // resting value as a property rather than fighting a second
            // writer for it). 20 is the same number
            // `[--btn-press-radius]` already needs. `--tap-size` tells
            // the rule how much of the 48px this box already covers, so
            // it reserves the remaining 14px a side and covers exactly
            // that — never the neighbour.
            "[--tap-rest:-4px] [--tap-size:20px] tap-target",
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
