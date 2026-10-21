import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

/**
 * Non-status tags only: app name, provider key, role, environment, sender
 * ID. Never use `Badge` for a message or job state — that's `StatusPill`'s
 * job (design doc §5.2); mixing them is how the status language erodes.
 *
 * D11: `cva()` replaces the previous `variant === "x" && "..."` conditional
 * chain, same classes. No `rounded-*` here: daisyUI's own `.badge` rule
 * reads `--radius-selector`, which `theme.css` maps to M3's `small`
 * corner (8px), the chip corner — a hard-coded override once fought it at
 * equal specificity.
 */
export const badgeVariants = cva("badge font-mono text-caption", {
  variants: {
    variant: {
      neutral: "badge-neutral",
      outline: "badge-outline",
    },
  },
  defaultVariants: { variant: "neutral" },
});

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
