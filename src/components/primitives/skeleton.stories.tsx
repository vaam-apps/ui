import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { RouteSkeleton } from "../patterns/route-skeleton";
import { Card, CardBody, CardHeader } from "./card";
import { CheckboxField } from "./checkbox";
import { Skeleton, SkeletonText } from "./skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

const meta = {
  title: "Primitives/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
  args: {},
  parameters: {
    docs: {
      description: {
        component:
          "A placeholder for content whose shape is known but whose value has not arrived. " +
          "It drifts rather than shimmers: two oversized, very low-contrast gradient fields " +
          "moving past each other on coprime periods, with no sweep, no direction and no " +
          "shared phase between neighbours. A shimmer implies progress a placeholder cannot " +
          "know about, and a column of them beats in unison; a drift says only “still " +
          "waiting, not stuck”. Turn your OS reduced-motion setting on and reload: the " +
          "gradients stay, frozen where they stand.",
      },
    },
  },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The three shapes nearly every placeholder is made of: a bar, a block,
 * and a circle for an avatar or a glyph. Radius comes from the same
 * `--radius-field` tier as the fields they stand in for. */
export const Shapes: Story = {
  render: () => (
    <div className="flex w-full max-w-[36rem] flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
      <Skeleton className="h-28 w-full" />
    </div>
  ),
};

/**
 * The lockstep test, and the reason for the `nth-child` phase offsets in
 * `theme.css`. Every one of these mounts in the same frame; watch for a
 * few seconds and no two brighten together. Without the offsets this is
 * a column of bars pulsing in time, which is the metronome the drift
 * exists to avoid.
 */
export const AStackDoesNotPulseInTime: Story = {
  render: () => (
    <div className="flex w-full max-w-[36rem] flex-col gap-2">
      {Array.from({ length: 9 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder rows
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  ),
};

/** `SkeletonText` ends its last line short, the way real prose does. A
 * stack of equal-width bars reads as a table; an uneven one reads as a
 * paragraph before a single character of it has loaded. */
export const Paragraphs: Story = {
  render: () => (
    <div className="flex w-full max-w-[36rem] flex-col gap-6">
      <SkeletonText lines={4} />
      <SkeletonText lines={2} />
      <SkeletonText lines={1} />
    </div>
  ),
};

/**
 * The rule this component exists to make easy: the placeholder is the
 * same height as the thing replacing it, so nothing shifts when the data
 * lands. Toggle it and watch the row positions — if anything moves, the
 * skeleton was the wrong size.
 */
export const MatchesTheRealRowHeight: Story = {
  render: function Render() {
    const [loaded, setLoaded] = useState(false);
    const rows = [
      { id: "cs_msg_8f21c0b", to: "+237 6 77 12 34 56", cost: "1,200" },
      { id: "cs_msg_2a904de", to: "+237 6 91 22 10 09", cost: "800" },
      { id: "cs_msg_be17734", to: "+237 6 55 40 18 77", cost: "2,400" },
    ];
    return (
      <div className="flex w-full max-w-[40rem] flex-col gap-3">
        <CheckboxField label="Data has arrived" checked={loaded} onCheckedChange={setLoaded} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Id</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead align="end">Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell mono>{loaded ? row.id : <Skeleton className="h-4 w-28" />}</TableCell>
                <TableCell mono>{loaded ? row.to : <Skeleton className="h-4 w-36" />}</TableCell>
                <TableCell align="end" mono>
                  {loaded ? row.cost : <Skeleton className="ml-auto h-4 w-12" />}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  },
};

/** Inside a card, where the header is real and only the body is waiting.
 * `animated={false}` is the escape hatch for a placeholder sitting inside
 * something that is already moving — not a preference, and not the way to
 * serve reduced motion, which the stylesheet handles on its own. */
export const InsideACardAndStill: Story = {
  render: () => (
    <div className="flex w-full max-w-[40rem] flex-col gap-4 sm:flex-row">
      <Card className="flex-1">
        <CardHeader title="Delivery" meta="last 24h" />
        <CardBody>
          <SkeletonText lines={3} />
        </CardBody>
      </Card>
      <Card className="flex-1">
        <CardHeader title="Delivery" meta="animated={false}" />
        <CardBody>
          <SkeletonText lines={3} animated={false} />
        </CardBody>
      </Card>
    </div>
  ),
};

/**
 * The whole-screen fallback the eight `useSearchParams()` routes mount
 * behind their `<Suspense>` boundary. It is also the one place in the
 * library that *announces* the wait: `Skeleton` itself is `aria-hidden`,
 * because a dozen empty boxes read aloud is worse than silence, so this
 * carries the `role="status"` region that says "Loading" once.
 */
export const WholeRoute: Story = {
  render: () => <RouteSkeleton rows={5} />,
};
