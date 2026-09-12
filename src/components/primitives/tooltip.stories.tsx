import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { Tooltip } from "./tooltip";

const meta = {
  title: "Primitives/Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
  args: { label: "Replays the last attempt.", children: <Button size="sm">Retry</Button> },
  parameters: {
    docs: {
      description: {
        component:
          "daisyUI's `.tooltip`/`data-tip`: no JS, no portal, hover and focus driven by CSS " +
          "alone. The accepted limitation is that `data-tip` is an HTML attribute rendered " +
          "through `content: attr(...)`, so the label must be a **plain string** — there is " +
          "no rich or interactive tooltip anywhere in this system. " +
          "\n\n" +
          "The other limitation is not in the API and is worth knowing before reaching for " +
          "this: the bubble is an absolutely positioned pseudo-element, so **any ancestor " +
          "that scrolls will clip it**. `SideNav`'s icon rail is exactly that case, and its " +
          "labels are native `title` attributes for exactly that reason.",
      },
    },
  },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Four sides. Pick the one with room — there is no collision detection,
 * because there is no JS to do it with. */
export const Positions: Story = {
  render: () => (
    <div className="grid place-items-center gap-10 py-10 sm:grid-cols-2">
      <Tooltip label="Above the trigger." position="top">
        <Button size="sm" variant="secondary">
          top
        </Button>
      </Tooltip>
      <Tooltip label="Below the trigger." position="bottom">
        <Button size="sm" variant="secondary">
          bottom
        </Button>
      </Tooltip>
      <Tooltip label="To the left." position="left">
        <Button size="sm" variant="secondary">
          left
        </Button>
      </Tooltip>
      <Tooltip label="To the right." position="right">
        <Button size="sm" variant="secondary">
          right
        </Button>
      </Tooltip>
    </div>
  ),
};

/**
 * A tooltip says what an action *does*; it is never where the only copy
 * that matters lives. Anything an operator must read before deciding
 * belongs on the screen — a tooltip is unreachable on a touch device and
 * invisible in a screenshot pasted into a ticket.
 */
export const OnAnIconButton: Story = {
  render: () => (
    <div className="flex items-center gap-3 py-10">
      <Tooltip label="Replay this attempt against the same provider.">
        <Button size="icon" variant="secondary" aria-label="Replay attempt">
          ⟳
        </Button>
      </Tooltip>
      <Tooltip label="Copy the full message id." position="bottom">
        <Button size="icon" variant="ghost" aria-label="Copy message id">
          ⧉
        </Button>
      </Tooltip>
    </div>
  ),
};

/**
 * The failure mode, shown rather than described. Both triggers are
 * identical; the left one sits inside a scrolling box, and its bubble is
 * clipped to nothing. Hover both.
 *
 * There is no CSS-only fix — escaping a scroll container needs a portal
 * or CSS anchor positioning — so the rule is simply: do not put a
 * `Tooltip` inside something that scrolls. Use a native `title` there,
 * which the browser paints outside the page entirely.
 */
export const ClippedByAScrollingAncestor: Story = {
  render: () => (
    <div className="flex flex-wrap items-start gap-8 py-16">
      <div className="h-24 w-40 overflow-y-auto rounded-sm border border-edge bg-surface-2 p-3">
        <Tooltip label="You will not see this." position="right">
          <Button size="sm" variant="secondary">
            In a scroller
          </Button>
        </Tooltip>
        <p className="mt-2 text-caption text-subtle-foreground">
          Scrolls, so the bubble is clipped away and the leftover width shows up as a stray
          horizontal scrollbar.
        </p>
      </div>
      <div className="h-24 w-40 rounded-sm border border-edge bg-surface-2 p-3">
        <Tooltip label="This one works." position="right">
          <Button size="sm" variant="secondary">
            Not a scroller
          </Button>
        </Tooltip>
      </div>
    </div>
  ),
};
