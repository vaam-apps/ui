import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
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
  DrawerClose,
  DrawerContent,
  DrawerDescription,
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
  DropdownMenuLinkItem,
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

/**
 * Every overlay in this file is portalled out of `canvasElement` —
 * Headless UI's `Dialog` and `MenuItems` (the latter because
 * `DropdownMenuContent` passes `anchor`, which implies a portal) both
 * mount under `document.body`. So the play functions below open the thing
 * from the canvas and then look for it in `document.body`. Scoping the
 * *second* half to `canvasElement` is the way to write an interaction
 * test that finds nothing and reports success, which is worse than not
 * having written it.
 */
const body = () => within(document.body);

/**
 * The play function covers the two things a dialog is *for*, neither of
 * which is visible in a screenshot: it is modal (focus goes inside on
 * open and cannot Tab its way out), and Escape is a real dismissal that
 * puts focus back where the reader left it.
 */
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
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Open dialog" });

    await step("Nothing is open to begin with", async () => {
      await expect(body().queryByRole("dialog")).toBeNull();
    });

    await step("The trigger opens a modal dialog named by its own title", async () => {
      await userEvent.click(trigger);
      const dialog = await body().findByRole("dialog", { name: "Rotate the signing secret?" });
      await expect(dialog).toHaveAttribute("aria-modal", "true");
    });

    await step("Focus moves into the dialog", async () => {
      const dialog = body().getByRole("dialog");
      await waitFor(async () => {
        await expect(dialog.contains(document.activeElement)).toBe(true);
      });
    });

    await step("…and Tab cannot get out of it — six presses, still inside", async () => {
      const dialog = body().getByRole("dialog");
      for (let press = 0; press < 6; press++) {
        await userEvent.tab();
        await expect(dialog.contains(document.activeElement)).toBe(true);
      }
    });

    await step("All three ways out are present: Cancel, Rotate, and the close button", async () => {
      const dialog = within(body().getByRole("dialog"));
      await expect(dialog.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
      await expect(dialog.getByRole("button", { name: "Rotate" })).toBeInTheDocument();
      await expect(dialog.getByRole("button", { name: "Close" })).toBeInTheDocument();
    });

    await step("Escape closes it and returns focus to the trigger", async () => {
      await userEvent.keyboard("{Escape}");
      await waitFor(async () => {
        await expect(body().queryByRole("dialog")).toBeNull();
      });
      await expect(trigger).toHaveFocus();
    });
  },
};

/**
 * WP5 Task 2: proves `DialogHeader`'s `pr-8` gutter actually clears the
 * close button. A ~90-character title plus a three-sentence description —
 * every other dialog story here uses a short title, which is exactly why
 * this overlap went unseen until now (see `dialog.tsx`'s own
 * `DialogHeader` comment).
 */
export const DialogWithLongTitle: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger as={Button}>Open dialog</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Rotate the signing secret for every webhook endpoint currently subscribed to this
            provider?
          </DialogTitle>
          <DialogDescription>
            The current secret moves to `prevSecret` and keeps verifying for 24 hours. Any endpoint
            that has not picked up the new secret by then starts failing signature checks. This
            cannot be undone once the grace period ends.
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
 * WP5 stories brief: a body taller than the viewport.
 *
 * This story originally documented an unfixed finding — `DialogPanel` had
 * no `max-h`/`overflow-y`, so a body this tall pushed `DialogFooter` off
 * the bottom with no scrollbar anywhere, making the footer (and its only
 * close button) genuinely unreachable. `dialog.tsx` has since been fixed
 * (see `DialogContent`'s own module doc there for the mechanism: a bounded
 * `max-h-[85vh]` panel, an internal `overflow-y-auto` wrapper around
 * `children`, and `DialogHeader`/`DialogFooter` made `sticky` so they stay
 * pinned to the visible panel while the body between them scrolls) and
 * re-verified live in Storybook. This story now asserts that positively:
 * with 30 rows of body content, the header and footer stay in place and
 * the close button and "Close" action are reachable at every scroll
 * position.
 */
export const DialogWithScrollingBody: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger as={Button}>Open tall dialog</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delivery attempts</DialogTitle>
          <DialogDescription>Every attempt recorded for this message.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 30 }, (_, i) => `attempt-${i + 1}`).map((key, i) => (
            <p key={key} className="text-body text-muted-foreground">
              Attempt {i + 1}: 200 OK, 118ms
            </p>
          ))}
        </div>
        <DialogFooter>
          <DialogClose as={Button} variant="ghost" size="sm">
            Close
          </DialogClose>
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
/**
 * The generic composition, for a one-off drawer with no quick-vs-more
 * distinction to encode. `QuickDetailDrawer`/`MoreDetailDrawer` are a
 * *second*, self-contained API on top of the same primitive; they do not
 * replace this one.
 *
 * `DrawerTitle` and `DrawerDescription` are not optional decoration.
 * `vaul` renders Radix `Dialog`'s `Content` underneath, so Radix's own
 * "DialogContent requires a DialogTitle" warning applies here exactly as
 * it does to `Dialog` — and without a description there is nothing for
 * `aria-describedby` to point at.
 */
export const PlainDrawer: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button size="sm" variant="secondary">
          Open drawer
        </Button>
      </DrawerTrigger>
      <DrawerContent className="p-5">
        <DrawerTitle>A plain drawer</DrawerTitle>
        <DrawerDescription className="mt-1">
          Whatever belongs here — this composition has no opinion about it.
        </DrawerDescription>
        <div className="mt-auto flex justify-end pt-4">
          <DrawerClose asChild>
            <Button size="sm" variant="ghost">
              Close
            </Button>
          </DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  ),
};

/**
 * Commands and destinations are different rows.
 *
 * `DropdownMenuItem` is a `<button>`, which is correct for "Replay" or
 * "Cancel" — things that *happen*. `DropdownMenuLinkItem` is an `<a>`,
 * for rows that are *places*. The distinction is not cosmetic: the two
 * render identically, and only the anchor supports middle-click,
 * cmd-click, "open in new tab" and "copy link address". A menu of
 * destinations built from buttons loses all four silently, and nobody
 * files a bug about it — they just stop using the menu.
 *
 * `SideNav`'s tiny-screen rail is the caller that needed this: it shows
 * four destinations and puts the rest here, and the ones here must not
 * be worse links for having landed fifth.
 *
 * Since the two menus render identically, the play function is the only
 * place the difference is stated in a way that can fail: it opens both
 * and asserts the element *names* — `BUTTON` in the commands menu, `A`
 * with a real `href` in the destinations one. Rewrite
 * `DropdownMenuLinkItem` back to `as="button"` and this story goes red
 * while the screenshot stays pixel-identical.
 */
export const CommandsVersusDestinations: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-6">
      <DropdownMenu>
        <DropdownMenuTrigger as={Button} variant="secondary" size="sm">
          Commands
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>This message</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => toast({ title: "Replayed" })}>Replay</DropdownMenuItem>
          <DropdownMenuItem onClick={() => toast({ title: "Copied" })}>Copy id</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger as={Button} variant="secondary" size="sm">
          Destinations
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Go to</DropdownMenuLabel>
          <DropdownMenuLinkItem href="#workers">Workers</DropdownMenuLinkItem>
          <DropdownMenuLinkItem href="#opt-outs">Opt-outs</DropdownMenuLinkItem>
          <DropdownMenuLinkItem
            href="#audit"
            aria-current="page"
            className="bg-base-300 font-medium"
          >
            Audit log
          </DropdownMenuLinkItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step("The commands menu is made of buttons — things that happen", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Commands" }));
      const menu = await body().findByRole("menu");
      const rows = within(menu).getAllByRole("menuitem");
      await expect(rows.map((row) => row.tagName)).toEqual(["BUTTON", "BUTTON"]);
      await expect(rows.map((row) => row.textContent)).toEqual(["Replay", "Copy id"]);
      await userEvent.keyboard("{Escape}");
      await waitFor(async () => {
        await expect(body().queryByRole("menu")).toBeNull();
      });
    });

    await step("The destinations menu is made of anchors — places you can go", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Destinations" }));
      const menu = await body().findByRole("menu");
      const rows = within(menu).getAllByRole("menuitem");
      await expect(rows.map((row) => row.tagName)).toEqual(["A", "A", "A"]);
      // The whole reason `DropdownMenuLinkItem` exists: a real `href`, so
      // middle-click, ⌘-click and "copy link address" still work. None of
      // those are testable here — but an `<a>` without an `href` cannot do
      // any of them, and that *is*.
      await expect(rows.map((row) => row.getAttribute("href"))).toEqual([
        "#workers",
        "#opt-outs",
        "#audit",
      ]);
    });

    await step("The current page is marked in the menu, not just tinted", async () => {
      const menu = within(body().getByRole("menu"));
      await expect(menu.getByRole("menuitem", { name: "Audit log" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      const marked = menu
        .getAllByRole("menuitem")
        .filter((row) => row.getAttribute("aria-current") === "page");
      await expect(marked).toHaveLength(1);
    });

    await step("Escape closes it", async () => {
      await userEvent.keyboard("{Escape}");
      await waitFor(async () => {
        await expect(body().queryByRole("menu")).toBeNull();
      });
    });
  },
};

/**
 * The play function walks the "Actions" menu with the arrow keys.
 *
 * Headless UI's `Menu` keeps DOM focus on the menu container and moves an
 * `aria-activedescendant` pointer instead, so "which row is focused" is
 * an attribute on the menu, not `document.activeElement` — which is
 * exactly the kind of thing a play function is worth writing down for,
 * since nobody reading the markup would guess it. Note the separator is
 * skipped: four rows of markup, three stops.
 */
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
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Actions" });

    const rows = () => within(body().getByRole("menu")).getAllByRole("menuitem");
    const activeRow = () => {
      const menu = body().getByRole("menu");
      const id = menu.getAttribute("aria-activedescendant");
      return rows().find((row) => row.id === id) ?? null;
    };

    await step("Opening by click activates nothing yet", async () => {
      await userEvent.click(trigger);
      await body().findByRole("menu");
      await expect(activeRow()).toBeNull();
    });

    await step("ArrowDown lands on the first row", async () => {
      await userEvent.keyboard("{ArrowDown}");
      await expect(activeRow()).toHaveTextContent("Replay");
    });

    await step("ArrowDown again moves to the second", async () => {
      await userEvent.keyboard("{ArrowDown}");
      await expect(activeRow()).toHaveTextContent("Copy id");
    });

    await step("…and again steps over the separator to the third and last", async () => {
      await userEvent.keyboard("{ArrowDown}");
      await expect(activeRow()).toHaveTextContent("Cancel");
      await expect(rows()).toHaveLength(3);
    });

    await step("ArrowUp walks back the way it came", async () => {
      await userEvent.keyboard("{ArrowUp}");
      await expect(activeRow()).toHaveTextContent("Copy id");
    });

    await step("Escape closes the menu and returns focus to its trigger", async () => {
      await userEvent.keyboard("{Escape}");
      await waitFor(async () => {
        await expect(body().queryByRole("menu")).toBeNull();
      });
      await expect(trigger).toHaveFocus();
    });
  },
};

/**
 * A checkbox item keeps the menu open on click, which is what makes a
 * column toggle usable — closing after each pick would mean reopening
 * the menu once per column.
 *
 * That sentence is the whole story, and until now nothing checked it. The
 * play function ticks two columns in a row without reopening anything,
 * and watches each row's announced state follow.
 *
 * **The state is in the name, not in `aria-checked`, and that is the
 * fix rather than a workaround.** `DropdownMenuCheckboxItem` used to ask
 * for `role="menuitemcheckbox"` and set `aria-checked`. Neither worked:
 * Headless UI's `MenuItem` builds its own `role` into `ourProps` and
 * wins, so the DOM said `role="menuitem"` regardless — the same
 * ownership `select.tsx` records for `aria-describedby` on
 * `ListboxButton`. `aria-checked` survived onto a role that does not
 * permit it, which is invalid ARIA and reached a screen reader as
 * nothing at all. The tick was visual only, in a component whose source
 * read as though ARIA had it covered.
 *
 * So each row now carries an `sr-only` ", checked" / ", not checked"
 * after its label, which is what a real `menuitemcheckbox` would have
 * announced and does not depend on out-arguing the library. The
 * assertions below read the accessible name for that reason, and
 * `src/lib/a11y.test.tsx` pins it by effect so a future Headless UI that
 * honours the role can be adopted without rewriting them.
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
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    // Re-read each time: these rows are inside a portal the menu owns, and
    // a stale reference would keep passing against a detached node.
    // A regex, not a string: the accessible name now ends with the
    // `sr-only` state (", checked"), so an exact-string `name` match
    // would find nothing and every assertion below would throw rather
    // than pass vacuously — but a regex anchored on the label is what
    // actually expresses "the row for this column".
    const row = (name: string) =>
      within(body().getByRole("menu")).getByRole("menuitem", { name: new RegExp(`^${name}`, "i") });

    /** The state a screen reader would hear, read off the row's own name. */
    const stateOf = (name: string) =>
      /,\s*not checked$/i.test(row(name).textContent ?? "") ? "unchecked" : "checked";

    await step("The menu opens with recipient and cost on, version off", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Columns" }));
      await body().findByRole("menu");
      await expect(stateOf("recipient")).toBe("checked");
      await expect(stateOf("cost")).toBe("checked");
      await expect(stateOf("version")).toBe("unchecked");
    });

    await step("Clicking a row toggles it — and the menu stays open", async () => {
      await userEvent.click(row("version"));
      await expect(body().getByRole("menu")).toBeInTheDocument();
      await expect(stateOf("version")).toBe("checked");
    });

    await step("…so a second column can be toggled without reopening anything", async () => {
      await userEvent.click(row("cost"));
      await expect(body().getByRole("menu")).toBeInTheDocument();
      await expect(stateOf("cost")).toBe("unchecked");
      await expect(stateOf("version")).toBe("checked");
      await expect(stateOf("recipient")).toBe("checked");
    });
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

/**
 * WP5 Task 3: fires five toasts in sequence so the four-toast cap (see
 * `toast()`'s own doc comment in `toast.tsx`) is visible — the oldest of
 * the five is dropped the moment the fifth lands, so only four cards ever
 * show at once.
 */
export const ToastCap: Story = {
  render: () => (
    <Button
      size="sm"
      onClick={() => {
        for (let i = 1; i <= 5; i++) {
          toast({ title: `Toast ${i}`, description: "One of five fired in sequence." });
        }
      }}
    >
      Fire 5 toasts
    </Button>
  ),
};

/** ⌘K-style palette. Nothing here binds the shortcut — that is the
 * application's decision, not the library's. */
export const Command: Story = {
  render: () => (
    <div className="w-full max-w-[28rem] overflow-hidden rounded-md border border-edge bg-surface-2">
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
