import type { InputHTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "../../lib/cn";
import { FIELD_SHAPE } from "../../lib/field-shape";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

// Shape: `FIELD_SHAPE` (`src/lib/field-shape.ts`) — a stadium at rest that
// pulls in to a rounded rectangle while focused, on M3 Expressive's
// spatial spring. It overrides daisyUI's own `--radius-field` corners
// (unlayered utility over a nested layer, the mechanism described below),
// and a caller's `rounded-*` still overrides it through `cn()`.
//
// No `input-bordered`: it is a daisyUI v4 modifier that v4's own `.input`
// rule needed to turn a border on at all. daisyUI 5 does not have it —
// `grep -rho '\b[a-z]*-bordered\b' node_modules/daisyui/` over the whole
// installed package returns zero matches — because v5's `.input` rule
// draws its border unconditionally, from `--input-color`, with no
// modifier class in the loop (confirmed by reading
// `daisyui/components/input.css`). The class was already dead: a
// generated stylesheet with no `.input-bordered` rule cannot style
// anything by that name, so removing it changes zero rendered pixels.
//
// `aria-invalid:` wins the cascade against daisyUI's own border/colour
// declarations even though `.input` also sets both — checked by compiling
// this package's real Tailwind entry (`.storybook/preview.css`) through
// `@tailwindcss/node`'s `compile()` and reading the emitted CSS rather
// than assuming: daisyUI nests its own rules one `@layer` deeper
// (`@layer utilities { @layer daisyui.l1.l2.l3 { .input { ... } } }`),
// while a Tailwind utility like `aria-invalid:border-state-danger-border`
// lands directly in `@layer utilities` with no further nesting. Per the
// Cascade Layers spec, an unlayered rule beats a layered one regardless of
// specificity or source order, and "unlayered relative to a *sibling*
// nested layer" is exactly what a rule one level shallower than
// `daisyui.l1.l2.l3` is — this is the mechanism that lets any Tailwind
// utility override any daisyUI component class by design, not a fluke of
// declaration order.
export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "input w-full font-sans text-prose",
      FIELD_SHAPE,
      "aria-invalid:border-state-danger-border aria-invalid:text-state-danger-fg",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
