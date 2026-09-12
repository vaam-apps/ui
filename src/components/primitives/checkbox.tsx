"use client";

import { Field, Checkbox as HeadlessCheckbox, Label as HeadlessLabel } from "@headlessui/react";
import { Check, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface CheckboxProps {
  checked: boolean;
  /** Omit for an uncontrolled display-only checkbox (e.g. inside a row
   * whose whole surface handles the click). */
  onCheckedChange?: ((checked: boolean) => void) | undefined;
  /** Neither on nor off — a parent whose children disagree. Rendered as a
   * dash. `checked` is still what a click toggles from. */
  indeterminate?: boolean;
  disabled?: boolean | undefined;
  /** Required when no visible `<CheckboxField>` label wraps it. */
  "aria-label"?: string | undefined;
  "aria-labelledby"?: string | undefined;
  className?: string | undefined;
}

/**
 * A checkbox, rendered as a real focusable control rather than a styled
 * `<input>`.
 *
 * Headless UI gives it `role="checkbox"`, `aria-checked`, space-to-toggle
 * and focus management; everything here is appearance. A native
 * `<input type="checkbox">` styled with `appearance-none` would be
 * equivalent for the plain case but cannot express `indeterminate`
 * without an imperative DOM write on a ref, which is how that state ends
 * up out of sync with React's own.
 */
export function Checkbox({
  checked,
  onCheckedChange,
  indeterminate = false,
  disabled,
  className,
  ...aria
}: CheckboxProps) {
  return (
    <HeadlessCheckbox
      checked={checked}
      onChange={onCheckedChange ?? (() => undefined)}
      disabled={disabled ?? false}
      indeterminate={indeterminate}
      className={cn(
        // `rounded-xs` (4px), not `rounded-selector` (8px): 8px is exactly
        // half of this 16px box, and a radius of half the box is a circle
        // — which made the checkbox and the radio the same shape. See
        // `theme.css`'s own note on `--radius-xs`. Shape is the only
        // channel that tells "pick any" from "pick one" before the user
        // clicks, so it has to survive.
        "group inline-flex size-4 shrink-0 items-center justify-center rounded-xs border border-edge-strong bg-surface-2",
        "transition-colors data-checked:border-primary data-checked:bg-primary",
        "data-indeterminate:border-primary data-indeterminate:bg-primary",
        "data-focus:outline-none data-focus:ring-1 data-focus:ring-ring",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...aria}
    >
      {indeterminate ? (
        <Minus size={12} strokeWidth={2.5} className="text-primary-content" />
      ) : (
        <Check
          size={12}
          strokeWidth={2.5}
          className="text-primary-content opacity-0 group-data-checked:opacity-100"
        />
      )}
    </HeadlessCheckbox>
  );
}

export interface CheckboxFieldProps extends Omit<CheckboxProps, "aria-label" | "aria-labelledby"> {
  label: ReactNode;
  /** One line beneath the label. */
  description?: ReactNode;
}

/**
 * A checkbox with a clickable label beside it.
 *
 * Separate from `FormField`, which stacks a label *above* a control:
 * a checkbox's label belongs on the same line and must itself be a click
 * target, which is a different layout and a different association
 * (`Field`/`Label` wiring rather than `htmlFor`).
 */
export function CheckboxField({ label, description, className, ...props }: CheckboxFieldProps) {
  return (
    <Field className={cn("flex min-w-0 items-start gap-2", className)}>
      <span className="mt-0.5">
        <Checkbox {...props} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <HeadlessLabel className="cursor-pointer text-body text-foreground data-disabled:cursor-not-allowed data-disabled:opacity-50">
          {label}
        </HeadlessLabel>
        {/* Two lines, then an ellipsis: this is the one-line explanation
            slot, and a row of settings whose boxes are all 44px tall
            except the one with a paragraph in it reads as broken rather
            than as informative. */}
        {description !== undefined && (
          <span className="line-clamp-2 text-caption text-muted-foreground">{description}</span>
        )}
      </span>
    </Field>
  );
}
