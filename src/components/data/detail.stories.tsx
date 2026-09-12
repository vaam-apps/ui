import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "../primitives/badge";
import { Card, CardBody, CardHeader } from "../primitives/card";
import { StateChip } from "../status/state-chip";
import { DetailList, DetailRow } from "./detail-row";
import { IdDisplay } from "./id-display";
import { Money } from "./money";
import { StatTile } from "./stat-tile";
import { TimestampDisplay } from "./timestamp-display";

const meta = {
  title: "Data/Detail and summary",
  component: DetailRow,
  tags: ["autodocs"],
  args: { label: "Label", children: "value" },
} satisfies Meta<typeof DetailRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Three treatments, all of which already existed on screen before they
 * were one component — `inline` for a short value, `stacked` for one too
 * long to sit beside its label, `divided` for a list that needs rules. */
export const Variants: Story = {
  render: () => (
    <div className="grid gap-8 sm:grid-cols-3">
      {(["inline", "stacked", "divided"] as const).map((variant) => (
        <div key={variant}>
          <p className="mb-2 text-micro text-subtle-foreground">{variant}</p>
          <DetailList variant={variant}>
            <DetailRow variant={variant} label="Id">
              <IdDisplay value="cs_a1b2c3d4e5f6g7h8i9j0k1l2" />
            </DetailRow>
            <DetailRow variant={variant} label="State">
              <StateChip tone="success">delivered</StateChip>
            </DetailRow>
            <DetailRow variant={variant} label="Cost">
              <Money amount={1200} currency="XAF" />
            </DetailRow>
          </DetailList>
        </div>
      ))}
    </div>
  ),
};

/**
 * Under 24 hours renders relative, older falls back to an absolute
 * ISO-ordered UTC form. Fixed literal timestamps here, never
 * `Date.now()`: a value computed at render time differs between the
 * server pass and the client's hydration, which is a real hydration
 * mismatch this component's own gallery once shipped.
 */
export const Timestamps: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <TimestampDisplay value="2026-09-11T15:57:00Z" />
      <TimestampDisplay value="2026-09-11T12:57:00Z" />
      <TimestampDisplay value="2026-01-04T09:12:31Z" />
    </div>
  ),
};

/** Borders, not shadows. Six shadowed boxes is visual noise where six
 * outlined ones read as one instrument panel. */
export const Tiles: Story = {
  render: () => (
    <div className="grid gap-3 sm:grid-cols-3">
      <StatTile label="Delivered (24h)" value="12,481" caption="98.2% of 12,710 terminal" />
      <StatTile
        label="Uncertain"
        value="37"
        tone="uncertain"
        caption="Outcome never learned — not retried"
        action={<StateChip tone="uncertain">watch</StateChip>}
      />
      <StatTile
        label="Spend (24h)"
        value={<Money amount={318_420} currency="XAF" display="none" />}
        caption="XAF, across all providers"
      />
    </div>
  ),
};

/** `Badge` is for non-status tags — an app name, a provider key, an
 * environment. Never a state: that is `StatusPill`'s job, and mixing
 * them is how the status language erodes. */
export const CardsAndBadges: Story = {
  render: () => (
    <Card className="w-[28rem]">
      <CardHeader
        title="orange-cm-primary"
        meta="provider · orange_cm"
        action={<Badge>production</Badge>}
      />
      <CardBody>
        <DetailList>
          <DetailRow label="TPS ceiling">20</DetailRow>
          <DetailRow label="Cost / segment">
            <Money amount={1200} currency="XAF" />
          </DetailRow>
        </DetailList>
      </CardBody>
    </Card>
  ),
};
