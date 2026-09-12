import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card, CardBody, CardHeader } from "../primitives/card";
import { InstrumentPanel } from "./instrument-panel";
import { Money } from "./money";
import { StatTile } from "./stat-tile";

const meta = {
  title: "Data/InstrumentPanel",
  component: InstrumentPanel,
  tags: ["autodocs"],
  args: { children: null },
  parameters: {
    docs: {
      description: {
        component:
          "The **instrument register** — the surface for scanning rather than reading. The " +
          "library has three: a hairline for diagnostic surfaces you work through row by row, " +
          "a shadow for layers that float over a ground they do not know, and this for " +
          "dashboards, where the job is to make one number findable at a glance. The mesh " +
          "carries no meaning: it is drawn from the `--aurora-*` ramp, bound to the system's " +
          "own hues so it cannot drift, and nothing about a state can be expressed through it.",
      },
    },
  },
} satisfies Meta<typeof InstrumentPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** What it is for: a row of metrics reading as one instrument, without
 * six competing outlines doing the grouping by repetition. */
export const AsADashboard: Story = {
  render: () => (
    <InstrumentPanel
      title="Delivery"
      caption="Last 24 hours, across all providers"
      className="w-full max-w-[46rem]"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Delivered" value="12,481" caption="98.2% of 12,710 terminal" />
        <StatTile label="Unresolved" value="37" tone="uncertain" caption="Outcome never learned" />
        <StatTile
          label="Spend"
          value={<Money amount={318_420_00} currency="XAF" display="none" />}
          caption="XAF, across all providers"
        />
      </div>
    </InstrumentPanel>
  ),
};

/**
 * The tier swap, shown rather than described. Both captions are 12px on
 * the mesh; the left is `muted` (what the component renders) and the
 * right is `subtle` (what it refuses to). Measured over `--surface-1` at
 * the shipped 14% cap, `subtle` falls to 4.41:1 in dark and 4.45:1 in
 * light — below AA — while `muted` holds above 5.29:1.
 *
 * Switch the theme in the toolbar: it is worse in neither and marginal in
 * both, which is exactly the kind of "looks fine" that ships a failure.
 */
export const WhySubtleIsBanned: Story = {
  render: () => (
    <InstrumentPanel className="w-full max-w-[40rem]">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-metric text-foreground tabular-nums">12,481</span>
          <span className="text-caption text-muted-foreground">muted — what the panel renders</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-metric text-foreground tabular-nums">12,481</span>
          <span className="text-caption text-subtle-foreground">
            subtle — below AA on this ground
          </span>
        </div>
      </div>
    </InstrumentPanel>
  ),
};

/** `Card glow` is the same register at card scale. Beside a plain card,
 * the difference is the point: one is an instrument, the other is a row
 * in a list. A screen with glow on every card has it on none. */
export const GlowAndPlainTogether: Story = {
  render: () => (
    <div className="grid w-full max-w-[44rem] gap-6 sm:grid-cols-2">
      <Card glow>
        <CardHeader title="Delivery rate" meta="last 24h" />
        <CardBody>
          <p className="font-mono text-metric text-foreground tabular-nums">98.2%</p>
          <p className="mt-1 text-caption text-muted-foreground">12,481 of 12,710 terminal</p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Orange Cameroon" meta="orange_cm · direct" />
        <CardBody>
          <p className="text-body text-muted-foreground">
            A plain card — a hairline on a surface step, which is the library's default and stays
            the default.
          </p>
        </CardBody>
      </Card>
    </div>
  ),
};
