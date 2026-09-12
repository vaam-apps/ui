import type { ComponentType, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { StateMark } from "./state-mark";
import { HUE_CLASSES, type StatusMeta, type StatusSystem } from "./status-tokens";

export interface StatusPillProps {
  /** One state's presentation, e.g. `MY_STATUS_SYSTEM[state]`. */
  meta: StatusMeta;
  /** The raw enum literal, shown when `showLiteral` is set and used in the
   * accessible name. Optional: a pill for a state machine whose literals
   * are not user-facing can omit it. */
  literal?: string | undefined;
  /** Default `'auto'`: resolved from the state's own `attention` field. */
  variant?: "auto" | "quiet" | "loud";
  size?: "sm" | "md";
  /** Render the mono enum literal beside the label. True in detail views,
   * false in tables, where the label alone is enough and the literal is
   * noise repeated down the column. */
  showLiteral?: boolean;
  /** Short mono qualifier, e.g. `failed · 4xx`. */
  detail?: ReactNode;
  /** Optimistic-transition case: dimmed + dashed, held until the server
   * confirms. Never use it to mean "we think this is probably the state" —
   * only for a transition this client has itself just requested. */
  pending?: boolean;
  interactive?: boolean;
  onClick?: (() => void) | undefined;
  className?: string | undefined;
}

/**
 * The canonical status representation: glyph + label + attention
 * treatment. Typically the single most-reused component in an operator
 * console — every screen showing a state renders through it.
 *
 * Takes a [`StatusMeta`] rather than a state literal, so one
 * implementation serves every state machine in an application.
 * [`createStatusPill`] is the ergonomic wrapper; reach for this directly
 * only when the meta comes from somewhere other than a fixed table.
 */
export function StatusPill({
  meta,
  literal,
  variant = "auto",
  size = "sm",
  showLiteral = false,
  detail,
  pending = false,
  interactive = false,
  onClick,
  className,
}: StatusPillProps) {
  const resolvedVariant = variant === "auto" ? meta.attention : variant;
  const loud = resolvedVariant === "loud";
  const hue = HUE_CLASSES[meta.hue];
  const markSize = size === "md" ? 16 : 14;

  const Comp = interactive ? "button" : "span";

  return (
    <Comp
      type={interactive ? "button" : undefined}
      onClick={interactive ? onClick : undefined}
      title={meta.tooltip}
      // A non-interactive pill is an image of a state, not a label for
      // one; without `role="img"` the `aria-label` on a `<span>` is
      // ignored by several screen readers.
      role={interactive ? undefined : "img"}
      aria-label={literal === undefined ? meta.label : `${literal} — ${meta.label}`}
      className={cn(
        "inline-flex items-center gap-[5px] whitespace-nowrap align-middle",
        "text-caption",
        loud && [hue.bg, hue.border, "rounded-sm border py-0.5 pr-1.5 pl-[5px] font-medium"],
        // A dashed outline, and NOT dimming. `pending` used to be
        // `opacity-60`, which took its own text to 2.71:1 against the
        // page — below AA, and unreadable at exactly the moment a reader
        // most wants to know what is happening. Measured before changing
        // it: the opacity that keeps this text at AA is 0.90, by which
        // point the dimming conveys nothing. So the state says so with a
        // border instead, at full text contrast.
        //
        // A quiet pill has no border to dash, so it grows the same box a
        // loud one has — otherwise `pending` would be invisible on the
        // majority of pills.
        pending && "border-dashed",
        pending && !loud && "rounded-sm border border-edge-strong py-0.5 pr-1.5 pl-[5px]",
        interactive && "cursor-pointer",
        className,
      )}
    >
      <StateMark meta={meta} size={markSize} className={hue.fg} />
      <span className={loud ? hue.fg : "text-muted-foreground"}>{meta.label}</span>
      {/* `muted`, not `subtle`, once the pill is loud. A loud pill paints a
          state tint behind this text, and `--subtle-foreground` does not
          reach 4.5:1 on a tint over anything lighter than the page
          background — 4.36:1 over a card, 3.85:1 over a hovered row.
          Measured, and not fixable by nudging the token: the value that
          would clear AA on a tint is ΔE 2 from `--muted-foreground`,
          which collapses the three-tier text ladder into two. So the
          tier changes with the background instead. */}
      {showLiteral && literal !== undefined && (
        <span
          className={cn(
            "font-mono text-micro",
            loud ? "text-muted-foreground" : "text-subtle-foreground",
          )}
        >
          {literal}
        </span>
      )}
      {detail != null && (
        <span
          className={cn("font-mono", loud ? "text-muted-foreground" : "text-subtle-foreground")}
        >
          {detail}
        </span>
      )}
    </Comp>
  );
}

export type TypedStatusPillProps<S extends string> = Omit<StatusPillProps, "meta" | "literal"> & {
  state: S;
};

/**
 * Binds a [`StatusSystem`] to a pill component whose `state` prop accepts
 * exactly that system's states and nothing else.
 *
 * ```tsx
 * export const OrderStatusPill = createStatusPill(ORDER_STATUS);
 * <OrderStatusPill state="refunded" showLiteral />
 * ```
 *
 * This replaced three hand-written, near-identical pill components — one
 * per state machine — that differed only in which table they indexed and
 * had already drifted apart in small ways (one set `role="img"`, one did
 * not; one supported `interactive`, two did not). Their own doc comments
 * each argued for staying separate on the grounds that the state machines
 * genuinely differ in meaning — which is true, and is preserved here:
 * each machine still has its own table and its own component identity,
 * and `state` is still typed to one machine's literals, so a `JobState`
 * cannot be passed to an order pill. What they do not need is three
 * copies of the rendering.
 */
export function createStatusPill<S extends string>(
  system: StatusSystem<S>,
): ComponentType<TypedStatusPillProps<S>> {
  function BoundStatusPill({ state, ...props }: TypedStatusPillProps<S>) {
    return <StatusPill meta={system[state]} literal={state} {...props} />;
  }
  return BoundStatusPill;
}
