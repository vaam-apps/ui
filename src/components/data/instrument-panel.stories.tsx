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
          "dashboards, where the job is to make one number findable at a glance. It is an M3 " +
          "Expressive container — `surface-container`, the 28px extra-large corner, 24px of " +
          "padding, no border, no shadow — with a 4-leaf clover and a 9-sided cookie from M3 " +
          "Expressive's shape library in its top-right corner. The shapes carry no meaning: " +
          "they are the seed's `primary-container`, the one hue family reserved for chrome, " +
          "and nothing about a state can be expressed through them.",
      },
    },
  },
} satisfies Meta<typeof InstrumentPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** What it is for: a row of metrics reading as one instrument, without
 * six competing outlines doing the grouping by repetition. The tiles drop
 * their hairline inside the panel and become filled nested containers.
 *
 * `Delivered` carries `emphasized` — the one number in the row a reader
 * should find first, singled out by weight and, inside a panel, by size
 * (display-small, the Expressive hero figure) rather than colour, since
 * colour here is reserved for status and this tile is not reporting
 * one. See `stat-tile.tsx`'s `emphasized` prop doc for the M3 Expressive
 * source. */
export const AsADashboard: Story = {
  render: () => (
    <InstrumentPanel
      title="Delivery"
      caption="Last 24 hours, across all providers"
      className="w-full max-w-[46rem]"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Delivered" value="12,481" caption="98.2% of 12,710 terminal" emphasized />
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
 * the panel; the left is `muted` (what the component renders) and the
 * right is `subtle` (what it refuses to), and the right one runs over the
 * shapes. On the clover, `subtle` falls to 4.05:1 in dark and 4.28:1 in
 * light — below AA — while `muted` holds 5.95:1 and 4.71:1.
 *
 * Switch the theme in the toolbar: it is marginal in both, and on the
 * bare container it even passes, which is exactly the kind of "looks
 * fine" that ships a failure the moment a caption runs into a corner.
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
