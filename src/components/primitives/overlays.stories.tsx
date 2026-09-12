import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "./button";
import {
  CommandMenu,
  CommandMenuEmpty,
  CommandMenuGroup,
  CommandMenuInput,
  CommandMenuItem,
  CommandMenuList,
} from "./command-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
  MoreDetailDrawer,
  QuickDetailDrawer,
} from "./drawer";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { InlineConfirm } from "./inline-confirm";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Toaster, toast } from "./toast";
import { Tooltip } from "./tooltip";

const meta = {
  title: "Primitives/Overlays",
  component: Dialog,
  tags: ["autodocs"],
  args: { children: null },
  decorators: [
    (Story) => (
      <>
        <Story />
        <Toaster />
      </>
    ),
  ],
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DialogStory: Story = {
  name: "Dialog",
  render: () => (
    <Dialog>
      <DialogTrigger as={Button}>Open dialog</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rotate the signing secret?</DialogTitle>
          <DialogDescription>
            The current secret moves to `prevSecret` and keeps verifying for 24 hours.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose as={Button} variant="ghost" size="sm">
            Cancel
          </DialogClose>
          <Button size="sm">Rotate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

/**
 * Quick vs. more. A quick drawer answers "what is this row" without
 * leaving the list; a more drawer is the full record. They are two
 * components rather than one with a `size` prop because the distinction
 * is editorial — what belongs in each — not geometric.
 */
export const Drawers: Story = {
  render: function Render() {
    const [quick, setQuick] = useState(false);
    const [more, setMore] = useState(false);
    const [confirming, setConfirming] = useState(false);
    return (
      <div className="flex flex-wrap gap-3">
        <Button size="sm" variant="secondary" onClick={() => setQuick(true)}>
          Quick detail
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setMore(true)}>
          More detail
        </Button>
        <QuickDetailDrawer
          open={quick}
          onOpenChange={setQuick}
          title="cs_msg_001"
          description="The short answer, without leaving the list."
        >
          <p className="text-body text-muted-foreground">Recipient, state, cost.</p>
        </QuickDetailDrawer>
        <MoreDetailDrawer
          open={more}
          onOpenChange={(next) => {
            setMore(next);
            if (!next) setConfirming(false);
          }}
          title="cs_msg_001"
          description="Everything the record holds."
        >
          {confirming ? (
            // An inline confirmation rendered INSTEAD of the body, not on
            // top of it: a nested overlay inside a drawer fights the
            // drawer's own focus trap and transition.
            <InlineConfirm
              title="Cancel this message?"
              description="It has not been submitted yet."
              confirmLabel="Cancel message"
              onConfirm={() => setConfirming(false)}
              onCancel={() => setConfirming(false)}
            />
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-body text-muted-foreground">Timeline, receipts, payloads.</p>
              <Button size="sm" variant="destructive" onClick={() => setConfirming(true)}>
                Cancel message
              </Button>
            </div>
          )}
        </MoreDetailDrawer>
      </div>
    );
  },
};

/** A plain drawer, for a one-off with no quick-vs-more distinction to
 * encode. `DrawerTitle` is required by the underlying dialog primitive —
 * omitting it is a runtime warning, not a type error. */
export const PlainDrawer: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button size="sm" variant="secondary">
          Open drawer
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerTitle>A plain drawer</DrawerTitle>
        <p className="mt-2 text-body text-muted-foreground">Whatever belongs here.</p>
      </DrawerContent>
    </Drawer>
  ),
};

export const MenusAndTips: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-6">
      <DropdownMenu>
        <DropdownMenuTrigger as={Button} variant="secondary" size="sm">
          Actions
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>This message</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => toast({ title: "Replayed" })}>Replay</DropdownMenuItem>
          <DropdownMenuItem onClick={() => toast({ title: "Copied" })}>Copy id</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => toast({ title: "Cancelled", variant: "danger" })}>
            Cancel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Popover>
        <PopoverTrigger as={Button} variant="ghost" size="sm">
          Popover
        </PopoverTrigger>
        <PopoverContent>
          <p className="text-body text-muted-foreground">Anchored, dismissible content.</p>
        </PopoverContent>
      </Popover>

      {/* Plain text only, by design: this is daisyUI's CSS-only tooltip
          (`content: attr(data-tip)`), not a JS-positioned portal. No rich
          content, but also no second behaviour library. */}
      <Tooltip label="Inferred from prefix — not authoritative.">
        <span className="cursor-help text-body text-muted-foreground underline decoration-dotted">
          hover me
        </span>
      </Tooltip>
    </div>
  ),
};

/**
 * A checkbox item keeps the menu open on click, which is what makes a
 * column toggle usable — closing after each pick would mean reopening
 * the menu once per column.
 */
export const MenuWithToggles: Story = {
  render: function Render() {
    const [columns, setColumns] = useState({ recipient: true, cost: true, version: false });
    return (
      <DropdownMenu>
        <DropdownMenuTrigger as={Button} variant="secondary" size="sm">
          Columns
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Show</DropdownMenuLabel>
          <DropdownMenuGroup>
            {(Object.keys(columns) as (keyof typeof columns)[]).map((key) => (
              <DropdownMenuCheckboxItem
                key={key}
                checked={columns[key]}
                onClick={() => setColumns((c) => ({ ...c, [key]: !c[key] }))}
              >
                {key}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
};

export const Toasts: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button size="sm" onClick={() => toast({ title: "Saved" })}>
        Default
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onClick={() =>
          toast({ title: "Provider seeded", description: "orange_cm", variant: "success" })
        }
      >
        Success
      </Button>
      <Button
        size="sm"
        variant="destructive"
        onClick={() =>
          toast({
            title: "Save failed",
            description: 'missing permission "provider:update"',
            variant: "danger",
          })
        }
      >
        Danger
      </Button>
    </div>
  ),
};

/** ⌘K-style palette. Nothing here binds the shortcut — that is the
 * application's decision, not the library's. */
export const Command: Story = {
  render: () => (
    <div className="w-[28rem] overflow-hidden rounded-md border border-edge bg-surface-2">
      <CommandMenu>
        <CommandMenuInput placeholder="Search messages, routes, providers…" />
        <CommandMenuList>
          <CommandMenuEmpty>No results.</CommandMenuEmpty>
          <CommandMenuGroup heading="Go to">
            <CommandMenuItem>Messages</CommandMenuItem>
            <CommandMenuItem>Routes</CommandMenuItem>
            <CommandMenuItem>Providers</CommandMenuItem>
          </CommandMenuGroup>
        </CommandMenuList>
      </CommandMenu>
    </div>
  ),
};
