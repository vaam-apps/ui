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
 * **M3's size, not a dense one.** `SwitchTokens`: a 52×32dp track with a
 * 2dp outline, and a handle that grows rather than reshapes —
 * `UnselectedHandle` 16dp, `SelectedHandle` 24dp, `PressedHandle` 28dp.
 * This used to be a 20×36 track with M3's *ratios* scaled onto a 14px
 * handle; the owner asked for bigger toggles, and the spec's own numbers
 * are the obvious "bigger". Consumers laying switches out in a fixed-height
 * row should check it: the track is 12px taller and 16px wider than it was.
 *
 * The handle is one 24px element: `scale-[0.667]` off (16px), `scale-100`
 * on, `scale-[1.167]` held (28px). Its centre sits 16px from the track's
 * leading edge off and 16px from the trailing edge on — exactly where
 * M3 puts both (`ml-0.5` inside the 2px border is a 4px inset; 20px of
 * travel lands the 24px handle 4px from the far edge).
 *
 * # Motion
 *
 * Travel and growth (`translate`, `scale`) ride the fast spatial spring —
 * the "signature bounce" `theme.css` names a switch thumb as the case it
 * reads best on — and the handle's colour change rides the effects
 * spring in the same triad. It used to be `transition-transform` alone,
 * so the handle's grey → white swap snapped at the start of a bouncing
 * slide; one `transition-property` list carries all three now (see
 * `press-shape.ts` on why it must be one list).
 */
export function Switch({ checked, onCheckedChange, disabled, className, ...aria }: SwitchProps) {
  return (
    <HeadlessSwitch
      checked={checked}
      onChange={onCheckedChange}
      disabled={disabled ?? false}
      className={cn(
        "group relative inline-flex h-8 w-[52px] shrink-0 cursor-pointer items-center rounded-full border-2 border-on-surface-variant bg-surface-container-highest",
        "[transition-property:background-color,border-color] [transition-duration:var(--dur-effects-fast)] [transition-timing-function:var(--ease-effects)]",
        "data-checked:border-primary data-checked:bg-primary",
        "data-focus:outline-none data-focus:ring-1 data-focus:ring-ring",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        // D11 (`theme.css`'s own header on `.tap-target`): the track is
        // 32×52 in both densities (`h-8 w-[52px]`) — M3's own track,
        // already wider than the 48px target, so only the short axis
        // reserves anything (8px a side at comfortable). `relative` is
        // already on the base string above, so this only adds the two
        // axis sizes the shared rule computes the reservation against.
        // `--tap-border:2px` matches this same base string's own
        // `border-2` — see `.tap-target`'s header for why a bordered host
        // needs it to actually reach 48px.
        "tap-target [--tap-w:52px] [--tap-h:32px] [--tap-border:2px]",
        className,
      )}
      {...aria}
    >
      <span
        aria-hidden="true"
        className={cn(
          // One 24px handle, scaled to M3's 16/24/28dp (see the doc
          // comment above), on one transition list: travel and growth on
          // the fast spatial spring, colour on the effects spring.
          "pointer-events-none ml-0.5 inline-block size-6 scale-[0.667] rounded-full bg-on-surface-variant",
          "[transition-property:translate,scale,background-color]",
          "[transition-duration:var(--dur-spatial-fast),var(--dur-spatial-fast),var(--dur-effects-fast)]",
          "[transition-timing-function:var(--ease-spatial-fast),var(--ease-spatial-fast),var(--ease-effects)]",
          "group-data-checked:translate-x-5 group-data-checked:scale-100 group-data-checked:bg-primary-content",
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
