import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

export type CardProps = HTMLAttributes<HTMLDivElement>;

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
export function Card({ className, ...props }: CardProps) {
  return (
    <div className={cn("card border border-edge bg-base-300 shadow-none", className)} {...props} />
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
        <Heading className="truncate font-medium text-foreground text-title-sm">{title}</Heading>
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
