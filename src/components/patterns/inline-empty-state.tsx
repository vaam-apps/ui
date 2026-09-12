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
 * `font-italic`, and it still declines under the **wider** reading of
 * that role — italic now marks any human prose written to the operator,
 * including `FormField` hints and option descriptions, not only
 * commentary on a decision.
 *
 * It declines because of the line `theme.css` draws: could this string be
 * a template that only fills in a value the system already has? "No
 * messages match these filters" is the component reporting its own state
 * — the same register as an empty table cell or a skeleton — rather than
 * a sentence a person wrote for a reader. No one is addressing anybody
 * here; the component is describing itself.
 *
 * Marking it italic would dilute the one signal the role carries
 * elsewhere rather than extend it correctly. The role means something
 * only because things like this are excluded.
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
