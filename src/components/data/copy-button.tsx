"use client";

import { Check, Copy } from "lucide-react";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { PRESS_SHAPE_MORPH } from "../../lib/press-shape";

export interface CopyButtonProps {
  /** The exact text put on the clipboard. Always the full, unformatted,
   * machine-readable value — never what is displayed. A truncated id or a
   * prettily-spaced phone number pasted into a query returns nothing. */
  value: string;
  /** Accessible name. Defaults to `Copy ${value}`, which is right for a
   * short id and wrong for a paragraph — pass something shorter then. */
  label?: string | undefined;
  /** Hide until the containing `.group` is hovered or this button is
   * focused. For dense tables, where a permanently visible icon on every
   * row is noise. Keyboard users always reach it: focus reveals it. */
  revealOnGroupHover?: boolean;
  size?: 12 | 14 | 16;
  className?: string | undefined;
}

const CONFIRMATION_MS = 1500;

/**
 * Copy-to-clipboard affordance: a click, then a checkmark for a moment.
 *
 * Extracted because `IdDisplay` and `MsisdnDisplay` each carried their own
 * byte-identical copy — the same `useState`, the same 1500ms timeout, the
 * same icon swap, the same class string — and any component that later
 * wanted the behaviour would have written a third.
 *
 * Two things the duplicated versions got wrong, fixed here rather than
 * copied a third time:
 *
 * - **The timeout was never cleared.** Unmounting within the confirmation
 *   window (a row scrolling out of a virtualised table, a drawer closing)
 *   left a timer that fired `setCopied` on a dead component. Now cleared
 *   on unmount, and any in-flight timer is cleared before a new one
 *   starts, so a double-click cannot end the confirmation early.
 * - **A rejected `writeText` was unhandled.** `navigator.clipboard` is
 *   unavailable on an insecure origin and can be refused by permissions
 *   policy; the bare `await` meant an unhandled rejection and a button
 *   that silently did nothing. Failure now leaves the icon unchanged,
 *   which is at least honest, and reports the reason to the console.
 */
export function CopyButton({
  value,
  label,
  revealOnGroupHover = false,
  size = 12,
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(() => {
    void navigator.clipboard.writeText(value).then(
      () => {
        setCopied(true);
        if (timer.current !== null) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), CONFIRMATION_MS);
      },
      (error: unknown) => {
        // Insecure origin, or a permissions policy that forbids it. Leave
        // the icon alone rather than claim a copy that did not happen.
        console.error("Clipboard write refused", error);
      },
    );
  }, [value]);

  // `PRESS_SHAPE_MORPH` (`press-shape.ts`) reads `--btn-press-radius`
  // rather than naming a value itself (see that file's "D10" header) —
  // every call site supplies its own box. This control's `size` prop
  // makes the box itself a runtime value (`size + 8`px, `p-1` against a
  // -4px resting margin, above),
  // so unlike the fixed-size call sites in `dialog.tsx`/`toast.tsx`/
  // `masked-value.tsx` — which can write a literal Tailwind arbitrary
  // property — this one has to compute it and set it as an inline style.
  // Same 0.1 circular ratio `.btn-circle` uses in `theme.css`, cast
  // through `CSSProperties` because that type has no index signature for
  // a custom property name.
  //
  // `--tap-size` rides the same object for the same reason (D11,
  // `theme.css`'s own header on `.tap-target`): this control's compact box
  // is already `size + 8`, which the `.tap-target` rule needs to know to
  // compute how much layout space its comfortable-register target has to
  // reserve around it.
  const pressRadiusStyle = {
    "--btn-press-radius": `calc(${size + 8}px * 0.1)`,
    "--tap-size": `${size + 8}px`,
  } as CSSProperties;

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label ?? `Copy ${value}`}
      style={pressRadiusStyle}
      className={cn(
        // `[--tap-rest:-4px] p-1 rounded-full`: same hit-area idiom as
        // the close buttons in `dialog.tsx`/`drawer.tsx`/`toast.tsx` —
        // the resting negative margin (spelled as a property rather than
        // a `-m-1` utility, because `.tap-target` writes `margin` itself;
        // it still computes to exactly -4px at compact) and the padding
        // are equal, so this grows the clickable box to
        // `size + 8`px (20/22/24px across this control's own 12/14/16px
        // `size` prop) without moving the icon or changing this element's
        // footprint in the flex row it sits in (`IdDisplay`'s and
        // `PhoneDisplay`'s `inline-flex items-center gap-1.5`: the added
        // padding pushes the box outward exactly as far as the negative
        // margin pulls it inward, so neighbouring siblings don't shift).
        // This comment said "roughly 32×32px" until the arithmetic was
        // checked while wiring D10's press-morph radius below — see
        // `pressRadiusStyle`, which needs the real number and
        // `masked-value.tsx`'s identical correction for the identical
        // reason. Previously this control had no hit-area padding at
        // all — a bare 12–16px icon, well under any reasonable tap-target
        // minimum. `rounded-full` circular, per the icon-only-controls-
        // are-circles convention in `button.tsx`.
        //
        // `PRESS_SHAPE_MORPH` (not `transition`): this used to be the bare
        // `transition` utility, chosen because `transition-colors` and
        // `transition-opacity` are the *same* tailwind-merge group (they
        // both set `transition-property`) and would have clobbered one
        // another — confirmed live, not assumed: `cn("transition-colors",
        // "transition-opacity")` resolves to just `"transition-opacity"`.
        // `PRESS_SHAPE_MORPH` (`press-shape.ts`) is the same fix widened
        // one step further: its own `transition-property` list already
        // includes `opacity` alongside `color`/`background-color`, plus
        // the M3 Expressive press morph on `border-radius` — the same
        // three-way clobber this comment used to describe, solved the same
        // way, once, in one shared place, rather than re-solved per call
        // site. Doesn't collide with the `opacity-*` utilities below for
        // the same reason `transition` didn't: those set `opacity`'s
        // *value*, this sets which properties transition and how fast.
        "relative shrink-0 rounded-full p-1 text-subtle-foreground hover:bg-surface-3 hover:text-foreground",
        // D11: see `pressRadiusStyle` above for `--tap-size`, and
        // `theme.css`'s own header on `.tap-target` for the whole rule.
        // `[--tap-rest:-4px]` is the `-m-1` this class string used to
        // carry, handed to `.tap-target` instead of written as a utility:
        // that rule sets `margin` itself (it has to — the 48dp target is
        // reserved layout space, not an overlay), so a `-m-1` beside it
        // would be a second writer of the same property. Compact is
        // unchanged by the swap, byte for byte: at `--density: 0` the
        // rule's own formula resolves to exactly `-4px`.
        "tap-target [--tap-rest:-4px]",
        PRESS_SHAPE_MORPH,
        revealOnGroupHover && "opacity-0 focus-visible:opacity-100 group-hover:opacity-100",
        className,
      )}
    >
      {copied ? (
        <Check size={size} strokeWidth={1.5} className="text-state-success-fg" />
      ) : (
        <Copy size={size} strokeWidth={1.5} />
      )}
    </button>
  );
}
