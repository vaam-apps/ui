import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { IdDisplay } from "../data/id-display";
import { Money } from "../data/money";
import { TimestampDisplay } from "../data/timestamp-display";
import { InlineEmptyState } from "../patterns/inline-empty-state";
import { LiveRow } from "../patterns/live-row";
import { createStatusPill } from "../status/status-pill";
import { defineStatusSystem } from "../status/status-tokens";
import { Button } from "./button";
import { Skeleton } from "./skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

const ROWS = [
  { id: "cs_msg_001", to: "+237 6 77 12 34 56", cost: 1200, version: 3 },
  { id: "cs_msg_002", to: "+237 6 91 22 10 09", cost: 800, version: 2 },
  {
    id: "cs_msg_003_a_deliberately_long_client_ref",
    to: "+237 6 55 40 18 77",
    cost: 2400,
    version: 1,
  },
];

const meta = {
  title: "Primitives/Table",
  component: Table,
  tags: ["autodocs"],
  args: {},
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Status first, money right-aligned and monospaced, and one deliberately
 * over-long id — a fixture with only tidy data tests nothing about
 * overflow, which is where table layouts actually break.
 */
export const Default: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Id</TableHead>
          <TableHead hideBelow="sm">Recipient</TableHead>
          <TableHead align="end">Cost</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ROWS.map((row) => (
          <TableRow key={row.id}>
            <TableCell mono>{row.id}</TableCell>
            <TableCell hideBelow="sm" mono>
              {row.to}
            </TableCell>
            <TableCell align="end">
              <Money amount={row.cost} currency="XAF" display="none" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

/** `hideBelow` drops a column at a breakpoint rather than letting it
 * squeeze. Narrow the viewport below `sm` to see the recipient go. */
export const Selected: Story = {
  render: () => (
    <Table>
      <TableBody>
        {ROWS.map((row, i) => (
          <TableRow key={row.id} selected={i === 1}>
            <TableCell mono>{row.id}</TableCell>
            <TableCell align="end">{row.version}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

/**
 * The rule a live table has to hold: an in-place status change never
 * moves a row. `LiveRow` washes on a change and decays, and nothing else
 * resizes or reorders. Under reduced motion the wash becomes a static
 * hold — the signal must survive even when the animation may not.
 */
export const Live: Story = {
  render: function Render() {
    const [version, setVersion] = useState(1);
    return (
      <div className="flex flex-col gap-3">
        <Button size="sm" variant="secondary" onClick={() => setVersion((v) => v + 1)}>
          Simulate a state change on row 1
        </Button>
        <Table>
          <TableBody>
            <LiveRow washTrigger={version} washHue="success">
              <TableCell mono>cs_msg_001</TableCell>
              <TableCell align="end">v{version}</TableCell>
            </LiveRow>
            <TableRow>
              <TableCell mono>cs_msg_002</TableCell>
              <TableCell align="end">v2</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  },
};

const DELIVERY = defineStatusSystem({
  queued: {
    family: "in-flight",
    silhouette: "circle",
    mark: "pie-1",
    hue: "neutral",
    filled: false,
    attention: "quiet",
    label: "Queued",
    tooltip: "Accepted, not yet handed to a provider.",
  },
  delivered: {
    family: "terminal",
    silhouette: "circle",
    mark: "check",
    hue: "success",
    filled: true,
    attention: "quiet",
    label: "Delivered",
    tooltip: "The handset confirmed receipt.",
  },
  unresolved: {
    family: "unresolved",
    silhouette: "diamond",
    mark: "question",
    hue: "uncertain",
    filled: false,
    attention: "loud",
    label: "Unresolved",
    tooltip: "Handed off, no receipt ever arrived.",
  },
  failed: {
    family: "terminal",
    silhouette: "circle",
    mark: "cross",
    hue: "danger",
    filled: true,
    attention: "loud",
    label: "Failed",
    tooltip: "The provider rejected it.",
  },
});
const DeliveryPill = createStatusPill(DELIVERY);

const FULL_ROWS = [
  { id: "cs_msg_8f21c0bd4e1a9f3c77e", state: "delivered", to: "+237 6 77 12 34 56", cost: 1200 },
  { id: "cs_msg_2a904de11b7c05f9a31", state: "unresolved", to: "+237 6 91 22 10 09", cost: 800 },
  { id: "cs_msg_be177349cc2e80b4f6d", state: "failed", to: "+237 6 55 40 18 77", cost: 2400 },
  { id: "cs_msg_5d0c2e9aa41f36b8e77", state: "queued", to: "+237 6 12 88 03 41", cost: 0 },
] as const;

/**
 * What one of these actually looks like on a screen: status first,
 * identifiers monospaced and truncated from the *front* only, money
 * right-aligned, timestamps relative under a day.
 *
 * No zebra striping, on purpose. The status tints are the signal, and
 * stripes plus tints is two competing row-level patterns — the reader
 * ends up checking which one means something.
 *
 * `truncateTo={14}` rather than the default 7, and the reason is visible
 * the moment you drop it: every id in this family starts `cs_msg_`, so
 * seven characters renders four rows that read as the same record. The
 * default is tuned for a bare CUID; a prefixed id family needs enough
 * characters to get past the prefix, which is a property of the data and
 * therefore the caller's call.
 */
export const AsAScreenUsesIt: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          <TableHead>Message</TableHead>
          <TableHead hideBelow="md">Recipient</TableHead>
          <TableHead hideBelow="lg">Accepted</TableHead>
          <TableHead align="end">Cost</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {FULL_ROWS.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <DeliveryPill state={row.state} />
            </TableCell>
            <TableCell>
              <IdDisplay value={row.id} truncateTo={14} />
            </TableCell>
            <TableCell hideBelow="md" mono>
              {row.to}
            </TableCell>
            <TableCell hideBelow="lg">
              <TimestampDisplay value="2026-09-11T14:03:07Z" />
            </TableCell>
            <TableCell align="end">
              <Money amount={row.cost} currency="XAF" display="none" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

/**
 * Nothing to show. An inline status line spanning the columns — not a
 * centred placard with an illustration, and not a card. The header stays
 * put, because the *shape* of the table is still the answer to "what
 * would have been here".
 */
export const Empty: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          <TableHead>Message</TableHead>
          <TableHead align="end">Cost</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={3}>
            <InlineEmptyState message="No messages match these filters." />
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};

/** Loading, with the skeletons sized to the real cells so nothing shifts
 * when the rows land. The bars drift out of phase with each other rather
 * than pulsing in time — see `Primitives/Skeleton`. */
export const Loading: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          <TableHead>Message</TableHead>
          <TableHead hideBelow="md">Recipient</TableHead>
          <TableHead align="end">Cost</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[0, 1, 2, 3].map((i) => (
          <TableRow key={i}>
            <TableCell>
              <Skeleton className="h-4 w-20" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-28" />
            </TableCell>
            <TableCell hideBelow="md">
              <Skeleton className="h-4 w-36" />
            </TableCell>
            <TableCell align="end">
              <Skeleton className="ml-auto h-4 w-12" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

/**
 * The header sticks while the body scrolls, which is the whole reason a
 * dense table is readable at 200 rows. The focus ring is an `outline`
 * rather than a `box-shadow` specifically so it is not clipped here —
 * tab through the rows and watch the ring survive the sticky header's
 * stacking context.
 */
export const StickyHeader: Story = {
  render: () => (
    <div className="h-80 w-full overflow-y-auto rounded-sm border border-edge">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Message</TableHead>
            <TableHead align="end">Cost</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 24 }, (_, i) => {
            const row = FULL_ROWS[i % FULL_ROWS.length];
            if (row === undefined) return null;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: a synthetic, fixed-length fixture
              <TableRow key={i}>
                <TableCell>
                  <DeliveryPill state={row.state} />
                </TableCell>
                <TableCell mono>{`${row.id.slice(0, 14)}${String(i).padStart(2, "0")}`}</TableCell>
                <TableCell align="end">
                  <Money amount={row.cost} currency="XAF" display="none" />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  ),
};
