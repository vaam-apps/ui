import type { TextareaHTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "../../lib/cn";
import { FIELD_SHAPE } from "../../lib/field-shape";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

// Shape: `FIELD_SHAPE`, as `Input` — but a multi-line box cannot be a
// stadium (its first and last lines would run into the curve), so
// `theme.css` gives `.textarea` an `extra-large` (28dp) resting corner
// instead of half a height, and the same rounded rectangle on focus.
// `py-3` with it: daisyUI's 8px block padding put the first line's
// leading glyph inside a 28px corner's curve.
//
// No `textarea-bordered`: same v4-only modifier as `input.tsx`'s own
// `input-bordered` — `grep -rho '\b[a-z]*-bordered\b' node_modules/daisyui/`
// returns zero matches in the installed daisyUI 5, whose `.textarea` rule
// draws its border unconditionally from `--input-color`. Dead class,
// zero rendered pixels changed by removing it.
//
// `aria-invalid:` overrides daisyUI's own border/colour the same way it
// does on `Input` — see that file's own note, checked the same way by
// compiling this package's real Tailwind entry through
// `@tailwindcss/node` rather than assumed: daisyUI's rules are nested one
// `@layer` deeper than a plain Tailwind utility, and an unlayered rule
// beats a layered one regardless of specificity, by design.
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "textarea w-full font-sans text-prose",
        FIELD_SHAPE,
        "py-3",
        "aria-invalid:border-state-danger-border aria-invalid:text-state-danger-fg",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
