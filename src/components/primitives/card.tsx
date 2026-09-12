import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Wraps the card in a multi-hue aurora glow.
   *
   * For the **instrument register** only — dashboard and metric surfaces,
   * where the job is to make one number findable. Not for a card in a
   * list, a drawer, or anywhere a reader is working through rows: a glow
   * on every card is a glow on none, and this library's default is a
   * hairline for exactly that reason (see "Borders, not shadows").
   *
   * Carries no meaning. A glow is not a status, cannot be tinted per
   * state, and nothing should be inferred from its presence — the hue
   * vocabulary stays entirely with `StatusHue`.
   */
  glow?: boolean | undefined;
}

// Borders, not shadows (design doc §3.6): every card is `--shadow-none` +
// a 1px border. daisyUI's own `card` class would add `shadow-xl` under
// some presets — explicitly opted out here rather than stripped after the
// fact, since this is a hand-built component, not a generated one.
//
// D8: the previous `rounded-sm` override is dropped, not swapped for
// `rounded-box` — daisyUI's own `.card` rule already sets
// `border-radius: var(--radius-box)` (confirmed by reading
// `daisyui/components/card.css` directly), so an explicit override was
// fighting the component's own class at equal specificity for no reason.
// This *is* the deliberate D8 value change §5's inventory calls for
// ("new radius (`--radius-box`)") — the previous `rounded-sm` resolved to
// `--radius-field` (12px) once Phase 0 rewrote the alias, one tier tighter
// than the box-tier corners the reference lock (§1.1/§1.2/§1.5) shows for
// card/drawer/panel chrome.
/**
 * `min-w-0` is load-bearing, and the reason is worth spelling out because
 * the symptom appears three levels away from the cause.
 *
 * `CardHeader` truncates its title with `white-space: nowrap`, and
 * `nowrap` makes an element's **min-content width the full length of the
 * string** — `overflow: hidden` hides the text, it does not shrink the
 * box. A grid item and a flex item both default to `min-width: auto`,
 * i.e. "never shrink below min-content", so a card holding a long title
 * refused to be narrower than that title and pushed its own grid track —
 * and with it the page — wider than the viewport. Measured at 375px
 * before the fix: a `grid-cols-1` of cards laid out at 617px each, on a
 * 375px page that scrolled sideways.
 *
 * The `min-w-0` inside `CardHeader` could not help: it lets the *header's*
 * inner div shrink, but nothing had told the card itself it was allowed
 * to. This is the class of bug where a `truncate` that looks correct
 * silently does nothing.
 */
export function Card({ className, glow = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "card min-w-0 border border-edge bg-base-300",
        // `shadow-none` is a Tailwind utility and lands unlayered, so it
        // would outrank `.aurora-glow`'s `@layer components` rule and the
        // glow would silently not paint. It is emitted only when there is
        // no glow to suppress.
        glow ? "aurora-glow" : "shadow-none",
        className,
      )}
      {...props}
    />
  );
}

export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: ReactNode;
  /**
   * Heading level for `title`. Defaults to `h3`, which is right for a
   * card inside a section that already has an `h2`.
   *
   * It is a prop rather than a constant because a heading level is a
   * property of the page's outline, not of the card: a card placed
   * directly under the screen's `h1` with `h3` skips a level, which axe
   * reports as `heading-order` and a screen-reader user experiences as a
   * missing section.
   */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  /** Optional mono metadata line beneath the title. */
  meta?: ReactNode;
  /** Right-aligned slot, e.g. a row of buttons. */
  action?: ReactNode;
}

export function CardHeader({
  title,
  meta,
  action,
  headingLevel = 3,
  className,
  ...props
}: CardHeaderProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div className={cn("flex items-start justify-between gap-4 p-4", className)} {...props}>
      <div className="min-w-0">
        {/* `font-display`/`tracking-normal`: same pairing and the same
            reason as `ScreenHeader`'s `<h1>` — see that component's doc
            comment. `text-title-sm` (16px) is closer to body size than
            the screen title is, which makes the sans-tuned global
            tracking's crowding *more* visible here, not less. */}
        <Heading className="truncate font-display font-medium text-foreground text-title-sm tracking-normal">
          {title}
        </Heading>
        {meta != null && (
          <p className="mt-1 truncate font-mono text-caption text-subtle-foreground">{meta}</p>
        )}
      </div>
      {action != null && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 pb-4", className)} {...props} />;
}
