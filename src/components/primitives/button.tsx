import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "../../lib/cn";

// M3 Expressive's common buttons, on daisyUI's `.btn` for size and layout.
//
// Five variants. Four are M3's: `primary` is the *filled* button,
// `secondary` the *outlined*, `ghost` the *text* button and `elevated` the
// *elevated* one — the first three keep the names this package has always
// exported, so nothing a consumer wrote changes meaning, only how it looks.
// `destructive` is a filled button in `error`, M3's role for exactly that.
// There is still deliberately no success or warning button: those hues
// belong to status, and a button that borrows them erodes the status
// language wherever both appear.
//
// Colours are the spec's roles (`FilledButtonTokens`, `OutlinedButton…`,
// `TextButton…`, `ElevatedButton…` in androidx's `material3/tokens/`):
// filled is `primary` on `on-primary`; outlined an `outline-variant`
// border around an `on-surface-variant` label; text a `primary` label on
// nothing; elevated a `primary` label on `surface-container-low` at
// elevation level 1. Disabled is M3's for every variant: the label at 38%
// of `on-surface`, a container at 12% — restated per variant because the
// colour utilities above are unlayered and would otherwise outrank
// daisyUI's own (layered) disabled rule. Hover and press are M3 *state layers* — the label
// colour laid over the container at 8% and 10% (`StateTokens`) — rather
// than daisyUI's own darken-by-7%-black, which reads as a stain on a dark
// theme.
//
// M3's fifth, the *filled tonal* button, is not here, and that is a
// measurement rather than an omission: it is `secondary-container` with an
// `on-secondary-container` label, Expressive rotates `secondary` toward
// olive at this seed, and that label measured 12.98 (CIEDE2000) from the
// light theme's `success` — under the 13 that `hct-neutrals.test.ts`
// requires between any two status hues. A button that close to "delivered"
// is a status-coloured button.
//
// Shape: every M3 Expressive button is round at rest
// (`ContainerShapeRound` is `CornerFull` in `ButtonXSmallTokens`,
// `ButtonSmallTokens` and `ButtonMediumTokens`), so the base string carries
// a full corner, and squares off while held — the press shape morph.
//
// The full corner is `rounded-(--btn-rest-radius)` — half the button's own
// `--size` (`theme.css`) — and **not** `rounded-full`, which this used to
// be and which is why buttons did not visibly animate. `rounded-full` is
// `calc(infinity * 1px)`, 3.35544e+07px computed, and a spring between that
// and 8px is a spring across seven orders of magnitude: sampled frame by
// frame on a real press, the radius stayed clamped round, overshot to 0
// (square), rebounded to ~295000px (round) and only then settled — round,
// square, round, rounded in under 400ms, which reads as a glitch rather
// than a morph, and release was a one-frame snap. A finite half-height
// draws the identical stadium and interpolates as a radius.
// `e2e/button-motion.spec.ts` samples it mid-flight.
// `active:[border-radius:var(--btn-press-radius)]` steps the radius down to
// M3's `PressedContainerShape` for the control's size and density
// (`theme.css` derives `--btn-press-radius`: `small` on `sm`, `small` →
// `medium` on `md` as density goes compact → comfortable, a tenth of the
// box on the circular icon button) and springs back on release via
// `--ease-spatial-fast`/`--dur-spatial-fast`, the "signature bounce" spring.
//
// The resting radius and the `active:` rule are plain Tailwind utilities with
// no shared merge group across the `active:` modifier (see `cn.ts`'s note
// on modifier-scoped groups), so they coexist: the resting radius paints
// at rest, the `active:` rule only while held. Both are utilities, which
// matters here: daisyUI emits `.btn`'s own `border-radius` in a nested
// cascade layer, and an unlayered utility outranks it — the trap that once
// let `rounded-field` defeat `.btn-circle`.
//
// The transition is one raw property/duration/timing-function triad, not
// `transition-colors` plus a duration class, for the reason
// `src/lib/press-shape.ts` explains (one `transition-property` longhand per
// element; whichever class last sets it wins outright). Colours fade on
// M3's *effects* spring and the radius moves on the *spatial* one.
// `border-color` stays in the list because the outlined button carries its
// hover on the border; `box-shadow` joins it for the elevated button's
// lift. daisyUI's own `.2s cubic-bezier(0,0,.2,1)` is replaced outright.
//
// `buttonVariants` is exported standalone so a link that must look like a
// button reaches for the class string directly:
// `<a className={buttonVariants({ variant: "secondary" })}>`.
export const buttonVariants = cva(
  "btn font-sans font-medium rounded-(--btn-rest-radius) " +
    "active:[border-radius:var(--btn-press-radius)] " +
    "[transition-property:color,background-color,border-color,box-shadow,border-radius] " +
    "[transition-duration:var(--dur-effects-fast),var(--dur-effects-fast),var(--dur-effects-fast),var(--dur-effects-fast),var(--dur-spatial-fast)] " +
    "[transition-timing-function:var(--ease-effects),var(--ease-effects),var(--ease-effects),var(--ease-effects),var(--ease-spatial-fast)]",
  {
    variants: {
      variant: {
        primary:
          "btn-primary " +
          "hover:bg-[color-mix(in_oklab,var(--md-sys-color-on-primary)_8%,var(--md-sys-color-primary))] " +
          "active:bg-[color-mix(in_oklab,var(--md-sys-color-on-primary)_10%,var(--md-sys-color-primary))]",
        secondary:
          "border-outline-variant bg-transparent text-on-surface-variant " +
          "hover:border-outline-variant hover:bg-on-surface-variant/8 hover:text-on-surface-variant " +
          "active:bg-on-surface-variant/10 " +
          "disabled:border-on-surface/12 disabled:text-on-surface/38",
        ghost: "btn-ghost text-primary hover:bg-primary/8 hover:text-primary active:bg-primary/10",
        elevated:
          "border-transparent bg-surface-container-low text-primary " +
          "shadow-[var(--md-sys-elevation-level1)] " +
          "hover:bg-[color-mix(in_oklab,var(--md-sys-color-primary)_8%,var(--md-sys-color-surface-container-low))] " +
          "hover:shadow-[var(--md-sys-elevation-level2)] " +
          "active:bg-[color-mix(in_oklab,var(--md-sys-color-primary)_10%,var(--md-sys-color-surface-container-low))] " +
          "disabled:bg-on-surface/12 disabled:text-on-surface/38 disabled:shadow-none",
        destructive:
          "btn-error " +
          "hover:bg-[color-mix(in_oklab,var(--md-sys-color-on-error)_8%,var(--md-sys-color-error))] " +
          "active:bg-[color-mix(in_oklab,var(--md-sys-color-on-error)_10%,var(--md-sys-color-error))]",
      },
      size: {
        sm: "btn-sm",
        md: "",
        // Circular: an icon-only control is a circle and a labelled one is
        // a stadium, in this package and in M3 alike — a circle reads as
        // "acts on the thing beside it". `copy-button.tsx`/`masked-value.tsx`'s
        // reveal toggle and the `dialog`/`drawer`/`toast` close buttons are
        // bare `<button>`s for layout reasons and don't run through `cva`,
        // but share the shape.
        //
        // `btn-circle` is not belt-and-braces with the base resting radius:
        // it is what makes the box square (daisyUI sets `width` from
        // `--size`), and a rounded *square* was once shipped and reported
        // as a circle. The resting radius is restated here so `cn()` keeps
        // it last whatever a caller's `className` merges in; on a square
        // box, half of `--size` is exactly a circle.
        icon: "btn-circle btn-sm rounded-(--btn-rest-radius)",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

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
