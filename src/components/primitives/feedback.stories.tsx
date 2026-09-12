import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "./button";
import { ConfirmDialog } from "./confirm-dialog";
import { Pagination } from "./pagination";
import { Progress } from "./progress";
import { Skeleton } from "./skeleton";
import { Spinner } from "./spinner";

const meta = {
  title: "Primitives/Feedback",
  component: Spinner,
  tags: ["autodocs"],
  args: {},
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** `Spinner` is for a wait whose *shape* is unknown. Where the shape is
 * known — a table, a card — `Skeleton` keeps the layout from jumping and
 * tells the reader what to expect. */
export const Waiting: Story = {
  render: () => (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-6">
        <Spinner size="xs" />
        <Spinner size="sm" />
        <Spinner size="md" />
        <Spinner size="lg" label="Loading" />
      </div>
      <div className="flex w-full max-w-80 flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  ),
};

/** A bounded, countable quantity — attempts against a budget, rows
 * processed, quota used. Never an unbounded wait: a bar creeping toward
 * a value it cannot reach is a lie, and `Spinner` is the honest option. */
export const ProgressBars: Story = {
  render: () => (
    <div className="flex w-full max-w-96 flex-col gap-3">
      <Progress value={2} max={5} label="Delivery attempts" showValue />
      <Progress value={4} max={5} tone="warning" label="Delivery attempts" showValue />
      <Progress value={5} max={5} tone="danger" label="Delivery attempts" showValue />
      <Progress value={73} label="Quota used" tone="success" />
    </div>
  ),
};

/**
 * Two position shapes, and the choice is not cosmetic. `offset` needs a
 * real total and renders `1–25 of 340`. `cursor` renders `25 shown` and
 * no page numbers, because a keyset-paged API has no honest page number
 * — inventing one produces a "Page 3 of ?" that is wrong the moment a
 * row is inserted.
 */
export const Paging: Story = {
  render: function Render() {
    const [offset, setOffset] = useState(0);
    const pageSize = 25;
    const total = 137;
    return (
      <div className="flex w-full max-w-[36rem] flex-col gap-4">
        {/* Distinct labels: three `<nav>` landmarks sharing one name is
            what a real screen with a pager above and below a table would
            also produce, and a screen-reader user cannot tell them
            apart. */}
        <Pagination
          label="Results, offset paging"
          position={{ kind: "offset", offset, pageSize, total }}
          onPrevious={offset === 0 ? undefined : () => setOffset((o) => o - pageSize)}
          onNext={() => setOffset((o) => o + pageSize)}
        />
        <Pagination
          label="Results, cursor paging"
          position={{ kind: "cursor", count: 25 }}
          onPrevious={undefined}
          onNext={() => undefined}
        />
        <Pagination
          label="Results, empty"
          position={{ kind: "cursor", count: 0 }}
          onPrevious={undefined}
          onNext={undefined}
        />
      </div>
    );
  },
};

/**
 * For an action worth interrupting someone over — and most are not. A
 * confirm that appears on every delete trains people to dismiss it
 * without reading, at which point it protects nothing and costs a click.
 * `InlineConfirm` is the right default for a row-level action.
 *
 * The caller closes it, and `busy` is a prop rather than internal state,
 * for one reason: the dialog must still be open, with its context, when
 * a write fails. A self-closing confirm reports failure through a toast
 * on a screen the operator has already been returned to.
 */
export const Confirming: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    return (
      <>
        <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
          Delete endpoint
        </Button>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          tone="destructive"
          title="Delete this endpoint?"
          description="Queued attempts for it are abandoned. This cannot be undone."
          confirmLabel="Delete endpoint"
          busy={busy}
          onConfirm={() => {
            setBusy(true);
            setTimeout(() => {
              setBusy(false);
              setOpen(false);
            }, 1200);
          }}
        />
      </>
    );
  },
};
