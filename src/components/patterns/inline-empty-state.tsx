import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface InlineEmptyStateProps {
  message: ReactNode;
  action?: { label: string; onClick: () => void };
  /** `'standalone'` is the one exception (§5.3): a screen with nothing else
   * to do may centre a single line plus one primary action. Still no
   * illustration, still no card. */
  variant?: "inline" | "standalone";
  className?: string;
}

/**
 * Enforces the binding rule: empty states are inline status lines, not
 * centred placards. Use inside a table body (spanning all columns) or in
 * the panel where the missing list would be.
 *
 * `message` deliberately stays `font-sans` (the inherited default), not
 * `font-italic`. `--font-italic`'s test is "a person wrote this to
 * explain a decision the system made" — a `StateTimeline` annotation
 * exists because a human is qualifying one specific fact among facts.
 * "No messages match these filters" has no decision behind it and no
 * particular record to comment on: it is the component reporting its own
 * state ("here is nothing"), the same register as a table's own empty
 * cell or a loading skeleton, not commentary standing apart from
 * emitted facts. Marking it italic would dilute the one signal the role
 * carries elsewhere in this system rather than extend it correctly.
 */
export function InlineEmptyState({
  message,
  action,
  variant = "inline",
  className,
}: InlineEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 text-body text-muted-foreground",
        variant === "standalone" ? "justify-center py-16 text-center" : "py-3 text-left",
        className,
      )}
    >
      <span>{message}</span>
      {action != null && (
        <button
          type="button"
          onClick={action.onClick}
          className="text-foreground underline decoration-edge-strong underline-offset-2 hover:decoration-foreground"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
