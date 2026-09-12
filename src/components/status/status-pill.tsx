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
 *
 * # Accessible name: content, not `role="img"` + `aria-label`
 *
 * This used to render the non-interactive case as `role="img"` with a
 * synthetic `aria-label` built from `literal` + `meta.label` alone. Per
 * the `img` role's own semantics, that makes the whole subtree a single
 * opaque node — so once `detail` (e.g. `failed · 4xx`) and `showLiteral`'s
 * mono text were added, both rendered visually and were announced to
 * **nobody**: the `aria-label` never grew to include them. The `button`
 * case had the same bug in a sharper form — `aria-label` on a focusable
 * element also overrides its content-derived name outright, so an
 * `interactive` pill's `detail` was unreachable even though nothing there
 * claimed a subtree-flattening role at all.
 *
 * The fix drops `role="img"` and the synthetic `aria-label` entirely and
 * lets the pill's accessible name fall out of its actual content, the way
 * a plain `<span>`/`<button>` with visible text normally works:
 * `StateMark`'s glyph is already `aria-hidden` (see that component), the
 * visible label/`literal`/`detail` spans are read in the order they're
 * rendered, and — because `literal` is documented as always part of the
 * accessible name, not just of the visible text when `showLiteral` is
 * set — an `sr-only` span carries it on the rendered-but-not-visible path
 * below so a screen-reader user still gets it even when a sighted one
 * doesn't see it.
 *
 * This was chosen over the alternative of keeping `role="img"` and
 * folding `detail`/`literal` into a bigger `aria-label` string, because
 * `detail` is a `ReactNode` — arbitrary markup, not always a plain string
 * — and there is no reliable way to serialise arbitrary children into an
 * `aria-label` attribute. Content-based naming has no such limit: whatever
 * `detail` actually renders is simply read as text, exactly like any other
 * inline content on the page. The `role="img"` comment this replaced gave
 * a real reason for the original choice (a bare `aria-label` on a
 * non-interactive `<span>` was, at the time, ignored by some screen
 * readers) — but nothing here still depends on that: every piece of
 * meaning is now visible text content instead of an attribute some AT
 * might skip.
 *
 * `meta.tooltip` is a separate, deliberately-unresolved gap — see the
 * comment on the rendered `title` below.
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
      // `meta.tooltip` — a full sentence of what the state means — is
      // carried *only* by this native `title`, which is mouse-hover-only
      // and reaches neither keyboard nor touch users. Left as a
      // decorative, hover-only enhancement rather than surfaced through
      // `aria-describedby`, deliberately, not by omission: this is the
      // most-rendered component in an operator console, and
      // `aria-describedby` content is announced automatically alongside
      // the name, not on request — wiring the full sentence in would make
      // every screen-reader pass over a table read a paragraph per row.
      // The state itself is never solely carried by the tooltip (glyph +
      // hue + label + `detail` already say what happened, redundantly,
      // through independent channels), so nothing load-bearing depends on
      // hover. A real fix — an on-demand disclosure a keyboard/touch user
      // can actually reach, e.g. this package's own `Popover` opened on
      // focus rather than only on hover — is follow-up work, not
      // something to bolt onto every row silently.
      title={meta.tooltip}
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
      {/* The raw enum literal is part of the accessible name whether or
          not it is *visible* — `showLiteral` controls presentation, not
          whether a screen-reader user learns it. When it's already
          rendered below (`showLiteral`) this would double-announce it, so
          it only exists for the complementary case. */}
      {literal !== undefined && !showLiteral && <span className="sr-only">{literal}</span>}
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
