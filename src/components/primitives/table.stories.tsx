import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Money } from "../data/money";
import { LiveRow } from "../patterns/live-row";
import { Button } from "./button";
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
