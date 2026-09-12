import type { Meta, StoryObj } from "@storybook/react-vite";
import { InlineBanner } from "./inline-banner";
import { InlineEmptyState } from "./inline-empty-state";
import { StaleWriteBanner } from "./stale-write-banner";

const VARIANTS = ["neutral", "danger", "warning", "success", "uncertain", "plain"] as const;

const meta = {
  title: "Patterns/Banners and empty states",
  component: InlineBanner,
  tags: ["autodocs"],
  args: { children: "A standing notice." },
} satisfies Meta<typeof InlineBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * All six together. `warning` referenced colour tokens that were never
 * declared for most of this package's life, so it rendered as plain grey
 * text — invisible precisely because nothing ever showed the variants
 * side by side, where one missing fill is obvious.
 */
export const EveryVariant: Story = {
  render: () => (
    <div className="flex w-full max-w-[40rem] flex-col gap-2">
      {VARIANTS.map((variant) => (
        <InlineBanner key={variant} variant={variant}>
          {variant} — the quick brown fox jumps over the lazy dog
        </InlineBanner>
      ))}
    </div>
  ),
};

/** `warning`, not `danger`: nothing was lost. The write was refused
 * precisely so the other operator's edit survives, which is the mechanism
 * working rather than failing. Reloading resolves it. */
export const StaleWrite: Story = {
  render: () => (
    <div className="w-full max-w-[40rem]">
      <StaleWriteBanner onReload={() => undefined} />
    </div>
  ),
};

/** Empty states are inline status lines, not centred placards with an
 * illustration. `standalone` is the one exception: a screen with nothing
 * else to do may centre a single line plus one action. */
export const Empty: Story = {
  render: () => (
    <div className="flex w-full max-w-[40rem] flex-col gap-4">
      <div className="rounded-sm border border-edge bg-surface-2 px-3">
        <InlineEmptyState message="No messages match these filters." />
        <InlineEmptyState
          message="No routes configured."
          action={{ label: "Seed a catch-all", onClick: () => undefined }}
        />
      </div>
      <div className="rounded-sm border border-edge bg-surface-2">
        <InlineEmptyState
          variant="standalone"
          message="Nothing here yet."
          action={{ label: "Create the first one", onClick: () => undefined }}
        />
      </div>
    </div>
  ),
};
