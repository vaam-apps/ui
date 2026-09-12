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
 *
 * **`disabled` is hoisted out of the spread, not left in `...props`.**
 * Headless UI's `Label` has no idea what control sits beside it — read
 * live in `node_modules/@headlessui/react/dist/components/label/label.js`,
 * it renders purely from `useDisabled()`, a *context* hook, and
 * `node_modules/@headlessui/react/dist/components/field/field.js` is the
 * only thing that ever provides that context, seeded from **`Field`'s
 * own** `disabled` prop (`disabled: r = m || false`, then
 * `DisabledProvider value={r}`). A child's `disabled` prop does not run
 * back up to its parent — React data flow does not work that direction —
 * so spreading `disabled` onto only the inner `Checkbox` left `Field`
 * permanently un-disabled, and the `data-disabled:opacity-50
 * data-disabled:cursor-not-allowed` already written on the `Label` below
 * dead code: a disabled row rendered a dimmed control beside a
 * full-brightness, still-`cursor-pointer` label. Passing the same
 * `disabled` to both `Field` and `Checkbox` is the fix; there is no
 * version of this where `Field` alone would have sufficed, since
 * `Checkbox` reads its own `disabled` prop directly rather than the
 * inherited context.
 */
export function CheckboxField({
  label,
  description,
  className,
  disabled,
  ...props
}: CheckboxFieldProps) {
  return (
    <Field disabled={disabled ?? false} className={cn("flex min-w-0 items-start gap-2", className)}>
      <span className="mt-0.5">
        <Checkbox disabled={disabled} {...props} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <HeadlessLabel className="cursor-pointer text-body text-foreground data-disabled:cursor-not-allowed data-disabled:opacity-50">
          {label}
        </HeadlessLabel>
        {/* Two lines, then an ellipsis: this is the one-line explanation
            slot, and a row of settings whose boxes are all 44px tall
            except the one with a paragraph in it reads as broken rather
            than as informative.
            `data-disabled` is set by hand here, not inherited: this is a
            plain `<span>`, not a Headless UI component, so it never reads
            `useDisabled()` on its own — it only gets the attribute
            because we put it there. */}
        {description !== undefined && (
          <span
            data-disabled={disabled || undefined}
            className="line-clamp-2 text-caption text-muted-foreground data-disabled:opacity-50"
          >
            {description}
          </span>
        )}
      </span>
    </Field>
  );
}
