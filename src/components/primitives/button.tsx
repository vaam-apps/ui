import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "../../lib/cn";

// daisyUI does the heavy lifting (`btn-primary`, `btn-outline`, `btn-ghost`,
// `btn-error`); the design doc's rule (§5.1) is that there is no
// "success"/"warning" button variant — those hues are reserved for status,
// so only these four exist. `btn-primary` is genuinely the achromatic
// inverse fill (§1.3: near-black on light, near-white on dark) — `neutral`
// is a *different*, deliberately quieter token (this theme's surface-3-ish
// fill, used for badges) and using it here read as a washed-out primary
// button in light theme; caught visually, not by inspection.
//
// D4/D11: rebuilt on `cva()` per docs/design/console-redesign.md §6.3 —
// `Slot`/`asChild` are gone (nothing in this repo used `<Button asChild>`,
// confirmed by grep before removing it), and `buttonVariants` is exported
// standalone so a link that must look like a button reaches for the class
// string directly: `<a className={buttonVariants({ variant: "secondary" })}>`.
// `rounded-field` in the base string is the one deliberate D8 addition —
// daisyUI's own `.btn` class already applies `--radius-field` per corner
// internally, so this doesn't change the rendered radius, only makes the
// D8 register explicit at the call site, matching §6.3's own sketch
// verbatim.
export const buttonVariants = cva("btn font-sans font-semibold rounded-field", {
  variants: {
    variant: {
      primary: "btn-primary",
      secondary: "btn-outline",
      ghost: "btn-ghost",
      destructive: "btn-error",
    },
    size: {
      sm: "btn-sm",
      md: "",
      // Circular, not `btn-square`: the convention this package follows is
      // that an icon-only control is a circle and a labelled one is
      // `rounded-field` (the rounded rectangle already applied by the base
      // string above). A circle reads as "acts on the thing beside it"; a
      // rounded rectangle reads as "this is a named action" — the shape
      // itself carries meaning, so it only pays off if every icon-only
      // control uses it, not just the ones that happen to go through this
      // component. `copy-button.tsx`/`masked-value.tsx`'s reveal toggle
      // and the `dialog`/`drawer`/`toast` close buttons are bare
      // `<button>`s for layout reasons and don't run through `cva` at all,
      // but were updated to the same `rounded-full` shape alongside this.
      // `rounded-full` is not belt-and-braces — without it this is a
      // rounded *square*, and that was shipped and reported as a circle.
      //
      // The base string above carries `rounded-field`, which is a plain
      // Tailwind utility and therefore lands **unlayered inside
      // `@layer utilities`**. daisyUI emits every component rule one
      // sublayer deeper (`@layer utilities { @layer daisyui.l1.l2.l3 { … } }`,
      // read it in `daisyui/components/button.css`), and unlayered beats a
      // nested sublayer regardless of specificity — which is exactly how
      // daisyUI guarantees Tailwind utilities win. So `rounded-field` (12px)
      // defeated `.btn-circle`'s own `border-radius`. Measured on a real
      // render: 12px shipped, and 3.35e7px the moment `rounded-field` was
      // removed from the element.
      //
      // `btn-square` never exposed this, because `.btn-square` sets no
      // radius at all — so the bug only became visible when the shape
      // changed to one that does.
      //
      // `cn()` resolves the radius group last-wins in call order and cva
      // emits base-then-variant, so `rounded-full` here beats the base.
      // It sits at the same layer as `rounded-field`, so it neither
      // outranks nor is outranked — it simply wins on order.
      icon: "btn-circle btn-sm rounded-full",
    },
  },
  defaultVariants: { variant: "primary", size: "md" },
});

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";
