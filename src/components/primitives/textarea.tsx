import type { TextareaHTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "../../lib/cn";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

// D8: same reasoning as `input.tsx` — daisyUI's own `.textarea` rule sets
// `border-radius: var(--radius-field)` directly (confirmed by reading
// `daisyui/components/textarea.css`), so no `rounded-*` class is added
// here. The class string is unchanged; the token rewrite in Phase 0 is
// what moved the rendered radius.
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
        "aria-invalid:border-state-danger-border aria-invalid:text-state-danger-fg",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
