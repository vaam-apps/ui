"use client";

// No `CheckboxGroup` — Headless UI 2.2.10 does not export one (checked,
// not assumed: `tsc` rejected it), so the grouping is done here.
//
// A `<fieldset>`, not `<div role="group">`. Biome's `a11y/useSemanticElements`
// is right that the native element beats the ARIA role, and it caught the
// div in CI after a local `biome check frontends` had passed — CI runs
// `pnpm biome ci .`, which is not the same command. Run CI's own.
//
// `min-w-0` because a `<fieldset>` has a UA `min-width: min-content` that a
// `<div>` does not, which would otherwise stop the chips wrapping inside a
// narrow drawer.
import { Checkbox, Field, Label } from "@headlessui/react";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/**
 * Multi-select over a small, fixed vocabulary, rendered as toggleable
 * chips.
 *
 * # Why chips rather than a text field or a multi-select
 *
 * The motivating case is OAuth scopes when provisioning a client. That
 * field was a free-text input: an operator had to already know both that
 * scopes are space-delimited *and* what the fourteen valid strings are,
 * with a typo silently producing a client that is denied at Layer 2 with
 * no hint why. Showing the vocabulary is the whole point.
 *
 * Not a `Select` with `multiple`: this renders inline with no portal and
 * no transition, so it cannot hit the focus-trap bug that made `Select`
 * unusable inside a drawer (#315). Same reasoning as `RadioGroup` — for a
 * bounded vocabulary in a drawer, the inline control is the safer one.
 *
 * Not a `<datalist>` or a tag input either: both still let a caller type
 * something outside the vocabulary, which is exactly the property being
 * removed.
 *
 * # Checked chips are achromatic, not green
 *
 * They used to be styled with the `state-success-*` trio, which is the
 * same latent bug `RadioGroup`'s own doc records in full: `success` is a
 * *quiet* status hue, so `--state-success-bg` and
 * `--state-success-border` are both declared `transparent`, and a
 * checked chip therefore rendered with no fill and no outline — less
 * present than the chips nobody had picked. Same fix, same reason:
 * selection is not a status, so it is spelled in the achromatic
 * `primary`/`surface-3` vocabulary every other checked control in this
 * library uses, and the filled box carries the signal rather than a
 * tint.
 */
export interface ChipOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Shown beneath the label — for scopes, what the scope actually permits. */
  description?: ReactNode;
}

export interface ChipSelectProps<T extends string> {
  value: readonly T[];
  onValueChange: (value: T[]) => void;
  options: readonly ChipOption<T>[];
  disabled?: boolean | undefined;
  "aria-label"?: string | undefined;
  className?: string | undefined;
}

export function ChipSelect<T extends string>({
  value,
  onValueChange,
  options,
  disabled,
  className,
  ...aria
}: ChipSelectProps<T>) {
  return (
    <fieldset className={cn("flex min-w-0 flex-wrap gap-2", className)} {...aria}>
      {options.map((option) => {
        const checked = value.includes(option.value);
        return (
          <Field key={option.value}>
            <Checkbox
              checked={checked}
              disabled={disabled ?? false}
              onChange={(next: boolean) => {
                onValueChange(
                  next ? [...value, option.value] : value.filter((v) => v !== option.value),
                );
              }}
              className={cn(
                "flex min-w-0 cursor-pointer items-start gap-2 rounded-sm border border-edge bg-surface-2 px-3 py-2 text-body text-muted-foreground transition-colors",
                "data-checked:border-edge-strong data-checked:bg-surface-3 data-checked:text-foreground",
                "data-focus:outline-none data-focus:ring-1 data-focus:ring-ring",
                "data-disabled:cursor-not-allowed data-disabled:opacity-50",
              )}
            >
              {/* Same box as the `Checkbox` primitive draws, down to the
                  radius tier — a chip is a checkbox with its label inside
                  the hit area, and two spellings of "checked" in one
                  library is one too many. */}
              <span
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-xs border transition-colors",
                  checked ? "border-primary bg-primary" : "border-edge-strong bg-surface-2",
                )}
              >
                {checked && (
                  <Check
                    className="size-3 text-primary-content"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                )}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <Label className="cursor-pointer truncate font-mono font-medium">
                  {option.label}
                </Label>
                {option.description !== undefined && (
                  // Clamped for the same reason `RadioGroup`'s is: chips
                  // wrap into rows and stretch to the tallest member, so
                  // one long description pads the whole row.
                  <span className="line-clamp-2 text-caption text-subtle-foreground">
                    {option.description}
                  </span>
                )}
              </span>
            </Checkbox>
          </Field>
        );
      })}
    </fieldset>
  );
}
