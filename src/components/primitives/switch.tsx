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
 */
export function Switch({ checked, onCheckedChange, disabled, className, ...aria }: SwitchProps) {
  return (
    <HeadlessSwitch
      checked={checked}
      onChange={onCheckedChange}
      disabled={disabled ?? false}
      className={cn(
        "group relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-edge-strong bg-surface-3 transition-colors",
        "data-checked:border-primary data-checked:bg-primary",
        "data-focus:outline-none data-focus:ring-1 data-focus:ring-ring",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...aria}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none ml-0.5 inline-block size-3.5 rounded-full bg-foreground transition-transform",
          "group-data-checked:translate-x-4 group-data-checked:bg-primary-content",
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
