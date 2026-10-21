"use client";

import { Field, Label as HeadlessLabel, Switch as HeadlessSwitch } from "@headlessui/react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean | undefined;
  "aria-label"?: string | undefined;
  "aria-labelledby"?: string | undefined;
  className?: string | undefined;
}

/**
 * An on/off toggle that takes effect immediately.
 *
 * **Use a `Checkbox`, not this, inside a form with a Save button.** The
 * distinction is not cosmetic: a switch promises the change has already
 * happened, so pairing one with a Save button tells the operator two
 * contradictory things and leaves them unsure whether the toggle landed.
 * A switch belongs where the write fires on change and the UI can report
 * the result.
 *
 * **M3's switch, at this library's size.** Colours are `SwitchTokens`:
 * off, a `SurfaceContainerHighest` track with an outline and a handle in
 * the outline colour; on, a `Primary` track with an `OnPrimary` handle.
 * The outline and the off handle are `on-surface-variant` here rather
 * than M3's `outline`, the same substitution `Checkbox` makes and for the
 * same reason (`theme.css`'s `--edge-strong` note): `outline` is too close
 * to the grey status hue to ship as chrome.
 *
 * The handle grows rather than reshapes, as M3's does: `UnselectedHandle`
 * 16dp, `SelectedHandle` 24dp, `PressedHandle` 28dp, on a 32dp track. The
 * track here stays 20×36 (the dense register; the tap target is what
 * `.tap-target` grows), so the handle keeps M3's *ratios* on this
 * library's 14px selected handle: 16/24 off (9.3px), 28/24 held. It is a
 * `scale` on the handle, so it rides the same `transform` transition as
 * the travel — one spatial spring, not two.
 */
export function Switch({ checked, onCheckedChange, disabled, className, ...aria }: SwitchProps) {
  return (
    <HeadlessSwitch
      checked={checked}
      onChange={onCheckedChange}
      disabled={disabled ?? false}
      className={cn(
        "group relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-on-surface-variant bg-surface-container-highest transition-colors",
        "data-checked:border-primary data-checked:bg-primary",
        "data-focus:outline-none data-focus:ring-1 data-focus:ring-ring",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        // D11 (`theme.css`'s own header on `.tap-target`): the track is
        // 20×36 in both densities (`h-5 w-9`, unchanged by this — the
        // track's own visual size is not what's undersized, only its
        // click target is). `relative` is already on the base string
        // above, so this only adds the two axis sizes the shared rule
        // needs to compute the per-axis reservation against — the
        // narrower axis (20px) reserves 14px a side, the wider one
        // (36px) only 6px.
        // `--tap-border:1px` matches this same base string's own `border`
        // utility — see `.tap-target`'s header for why a bordered host
        // needs it to actually reach 48px.
        "tap-target [--tap-w:36px] [--tap-h:20px] [--tap-border:1px]",
        className,
      )}
      {...aria}
    >
      <span
        aria-hidden="true"
        className={cn(
          // The thumb's `translate-x` is spatial (position), so it takes
          // the M3 Expressive spring — `--dur-spatial-fast` /
          // `--ease-spatial-fast` (z 0.6, 9.5% overshoot), the "fast"
          // pair for a small, local control. This is the token scheme's
          // own signature case: a switch thumb overshooting its resting
          // position and settling back is exactly the bounce
          // `theme.css`'s comment calls out, on the control it reads
          // best on. `transition-transform` only sets `transition-property:
          // transform`, so `group-data-checked:bg-primary-content` below
          // is not animated at all — it snaps, same as before this
          // change; not touched here since it isn't spatial motion.
          "pointer-events-none ml-0.5 inline-block size-3.5 scale-[0.667] rounded-full bg-on-surface-variant transition-transform duration-[var(--dur-spatial-fast)] ease-[var(--ease-spatial-fast)]",
          "group-data-checked:translate-x-4 group-data-checked:scale-100 group-data-checked:bg-primary-content",
          "group-active:scale-[1.167] group-data-checked:group-active:scale-[1.167]",
        )}
      />
    </HeadlessSwitch>
  );
}

export interface SwitchFieldProps extends Omit<SwitchProps, "aria-label" | "aria-labelledby"> {
  label: ReactNode;
  description?: ReactNode;
}

/**
 * A switch with its label to the left, filling the available width — the
 * settings-row layout, where the labels form a readable column and the
 * controls line up on the right.
 *
 * **`disabled` is hoisted out of the spread — see `CheckboxField`'s own
 * note for why.** In short: Headless UI's `Label` renders purely from the
 * `useDisabled()` *context* hook, and only `Field`'s own `disabled` prop
 * seeds that context (confirmed by reading `field.js` and `label.js`
 * directly). Leaving `disabled` inside `...props`, bound only for
 * `Switch`, left the label beside a disabled switch at full brightness
 * with a live `cursor-pointer`. It now goes to both.
 */
export function SwitchField({
  label,
  description,
  className,
  disabled,
  ...props
}: SwitchFieldProps) {
  return (
    <Field
      disabled={disabled ?? false}
      className={cn("flex min-w-0 items-center justify-between gap-4", className)}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <HeadlessLabel className="cursor-pointer text-body text-foreground data-disabled:cursor-not-allowed data-disabled:opacity-50">
          {label}
        </HeadlessLabel>
        {/* Clamped to two lines — see `CheckboxField`'s own note. A
            settings list wants its toggles on one vertical rhythm.
            `data-disabled` is set by hand: a plain `<span>` never reads
            `useDisabled()` on its own. */}
        {description !== undefined && (
          <span
            data-disabled={disabled || undefined}
            className="line-clamp-2 text-caption text-muted-foreground data-disabled:opacity-50"
          >
            {description}
          </span>
        )}
      </span>
      <Switch disabled={disabled} {...props} />
    </Field>
  );
}
