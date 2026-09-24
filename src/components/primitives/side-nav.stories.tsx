import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { cn } from "../../lib/cn";
import { InstrumentPanel } from "../data/instrument-panel";
import { StatTile } from "../data/stat-tile";
import { Button } from "./button";
import { RadioGroup } from "./radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectModal,
  SelectTrigger,
  SelectValue,
} from "./select";
import { SideNav } from "./side-nav";

/** Minimal stand-in icons — the real ones come from the consuming app, so
 * the component only asks for a component that accepts `size`. Four
 * shapes rather than one, because an icon rail where every glyph is the
 * same circle tests nothing about whether the rail is usable. */
function glyph(path: ReactNode) {
  return function Glyph({ size = 16, className }: { size?: number; className?: string }) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {path}
      </svg>
    );
  };
}

const Home = glyph(<path d="M2.5 7 8 2.5 13.5 7v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V7Z" />);
const Send = glyph(<path d="M14 2 7 9M14 2l-4.5 12L7 9 2 6.5 14 2Z" />);
const Inbox = glyph(
  <>
    <rect x="2.5" y="3.5" width="11" height="9" rx="1.5" />
    <path d="M2.5 8.5h3l1 2h3l1-2h3" />
  </>,
);
const Plug = glyph(
  <>
    <path d="M6 2v3M10 2v3" />
    <path d="M4 5h8v3a4 4 0 0 1-8 0V5Z" />
    <path d="M8 12v2" />
  </>,
);
const Route = glyph(
  <>
    <circle cx="4" cy="4" r="1.75" />
    <circle cx="12" cy="12" r="1.75" />
    <path d="M4 5.75V9a3 3 0 0 0 3 3h3.25" />
  </>,
);
const Gear = glyph(
  <>
    <circle cx="8" cy="8" r="2.25" />
    <path d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4M12.6 12.6l-1.4-1.4M4.8 4.8 3.4 3.4" />
  </>,
);
const Book = glyph(
  <>
    <path d="M3 3h4a2 2 0 0 1 2 2v8a1.5 1.5 0 0 0-1.5-1.5H3V3Z" />
    <path d="M13 3H9a2 2 0 0 0-2 2v8a1.5 1.5 0 0 1 1.5-1.5H13V3Z" />
  </>,
);

const GROUPS = [
  {
    label: "Messaging",
    items: [
      { label: "Composer", href: "/composer", icon: Send },
      { label: "Messages", href: "/messages", icon: Inbox },
    ],
  },
  {
    label: "Delivery",
    items: [
      { label: "Providers", href: "/providers", icon: Plug },
      { label: "Routes", href: "/routes", icon: Route },
    ],
  },
];

/**
 * A stand-in for the consuming application's shell. The library owns the
 * nav; the shell — page background, content column, where the nav sits at
 * each width — is always the caller's, so a story that does not draw one
 * shows the nav floating in a way no real screen ever does.
 */
function Shell({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <div className="flex h-[32rem] overflow-hidden rounded-md border border-edge">
      {children}
      <div className="flex min-w-0 flex-1 flex-col gap-3 bg-base-100 p-6">
        <div className="h-7 w-48 rounded-sm bg-surface-3" />
        <div className="h-4 w-72 rounded-sm bg-surface-2" />
        {note != null && <p className="mt-2 text-body text-muted-foreground">{note}</p>}
      </div>
    </div>
  );
}

const meta = {
  title: "Primitives/SideNav",
  component: SideNav,
  tags: ["autodocs"],
  args: {
    topItem: { label: "Dashboard", href: "/", icon: Home },
    currentPath: "/messages",
    groups: GROUPS,
    footerItems: [
      { label: "Documentation", href: "/docs", icon: Book },
      { label: "Settings", href: "/settings", icon: Gear },
    ],
  },
  parameters: {
    layout: "fullscreen",
    // Named viewports so each band can be *pinned* by a story rather than
    // described in prose and left to the reader to reproduce by dragging
    // the window. A breakpoint story that cannot show its own breakpoint
    // is where responsive bugs hide — this component's own icon rail had
    // a broken tooltip and a stray scrollbar for its whole life, in a
    // band no story ever rendered.
    viewport: {
      options: {
        tiny: {
          name: "Tiny — horizontal rail (375px)",
          styles: { width: "375px", height: "720px" },
        },
        offCanvas: { name: "Off-canvas (390px)", styles: { width: "390px", height: "720px" } },
        medium: {
          name: "Medium — floating rail (900px)",
          styles: { width: "900px", height: "640px" },
        },
        // The band that used to draw an in-flow 64px icon rail, kept as a
        // named viewport because it is where the old shape lived and is
        // the first place anyone will look to check it is really gone.
        iconRail: {
          name: "Was icon rail — now floating (1100px)",
          styles: { width: "1100px", height: "640px" },
        },
        fullSidebar: {
          name: "Full sidebar (1440px)",
          styles: { width: "1440px", height: "640px" },
        },
      },
    },
    docs: {
      description: {
        component:
          "**Only one shape takes space out of the page: the sidebar.** Everything narrower " +
          "floats over the content, which is what lets a caller build one layout instead of " +
          "one per band.\n\n" +
          "- **Below 640px** — M3 Expressive's horizontal floating toolbar along the bottom: " +
          "four destinations and a menu for the rest. A 64px column costs 17% of a 375px " +
          "screen and sits where a thumb cannot reach, so the toolbar turns rather than " +
          "shrinks.\n" +
          "- **640–1279px** — the vertical floating toolbar, 16px off the left edge.\n" +
          "- **1280px and up** — a 256px sidebar with labels, in flow. Pass `collapsed` and " +
          "this band uses the vertical rail too, which is the only way to actually give the " +
          "content its width back.\n\n" +
          "`accountSlot` renders under the sidebar's footer rows. Wherever a toolbar is the " +
          "navigation instead, the toolbar ends in a **More** control that opens an M3 modal " +
          "sheet with the account block in it — a bottom sheet from the phone bar, a navigation " +
          "drawer from the vertical rail — so it is reachable at every width, and a consumer " +
          "never needs floating account chrome of its own. Without an `accountSlot` the phone " +
          "bar keeps its plain overflow menu and the rail gains nothing.\n\n" +
          "There used to be a fourth band: an in-flow 64px icon rail from 1024–1279px. It is " +
          "gone, and its removal is the point rather than a simplification. It was the one " +
          "shape that needed a flex-row parent while its neighbours needed none, so a caller " +
          "whose layout suited the floating rail got, at exactly 1024px, a full-height strip " +
          "wherever `SideNav` happened to sit in their DOM — below the content, usually. " +
          "One layout could not satisfy both.\n\n" +
          'The opt-in `smallScreen="off-canvas"` is unchanged and keeps the original ' +
          "full-label accordion tree, plus that icon-rail band, for a caller who already owns " +
          "a drawer and wants every band in flow.\n\n" +
          "Both toolbars are M3's own geometry, transcribed from androidx: 64px across, fully " +
          "round, 8px padding, 4px between 48px targets, 24px icons, and the current page drawn " +
          "as a wide filled pill. `toolbarVariant` picks M3's `standard` or `vibrant` scheme — the " +
          "two “Toolbar colours” stories render each over the same real content.\n\n" +
          "All of it is plain CSS — no `useMediaQuery`, no viewport read — so the bands are " +
          "server-rendered. The one exception is the floating rails themselves, which are " +
          "portalled to `document.body` and therefore appear only after hydration.",
      },
    },
  },
} satisfies Meta<typeof SideNav>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Whatever band the preview is currently in. Drag the viewport across
 * 1024px and 1280px — the labels go, then come back, and the rail never
 * grows a horizontal scrollbar while doing it. */
export const InAShell: Story = {
  render: (args) => (
    <Shell note="Resize across 1024px and 1280px.">
      <SideNav {...args} />
    </Shell>
  ),
};

/**
 * The `1024–1279px` band, pinned by forcing the width rather than by
 * asking you to resize.
 *
 * The label is a **native `title`**, not daisyUI's `.tooltip`. That is a
 * correction, not a preference: `.tooltip` draws its bubble as an
 * absolutely positioned pseudo-element at `left: 100%`, and this `<nav>`
 * is a scroll container, so the bubble was clipped away on every hover
 * while still counting toward the scrollable width — no label ever
 * appeared, and the leftover width showed up as the stray horizontal
 * scrollbar under the rail. Hover a row: the label the rail was always
 * supposed to have.
 */
export const IconRail: Story = {
  globals: { viewport: { value: "iconRail" } },
  render: (args) => (
    <Shell note="Hover a rail icon for its label.">
      <SideNav {...args} />
    </Shell>
  ),
};

/** The `≥1280px` band, pinned the same way. */
export const FullSidebar: Story = {
  globals: { viewport: { value: "fullSidebar" } },
  render: (args) => (
    <Shell>
      <SideNav {...args} />
    </Shell>
  ),
};

/**
 * The opt-in legacy shape: `smallScreen="off-canvas"` restores exactly the
 * original below-`lg` tree, unchanged, for a caller that already wraps
 * this component in its own drawer. Below `lg` the nav fills whatever the
 * caller put it in — here a 300px stand-in for that drawer — and groups
 * become a collapsible accordion, open only if it holds the current
 * route. "Roughly 6–8 tappable rows on open, not 18."
 *
 * This is not the default any more (`"floating"` is) — see `FloatingRail`
 * for what a caller gets without opting into this prop.
 */
export const OffCanvasDrawer: Story = {
  globals: { viewport: { value: "offCanvas" } },
  render: (args) => (
    <div className="flex h-[32rem] w-full max-w-[300px] overflow-hidden rounded-md border border-edge">
      <SideNav {...args} smallScreen="off-canvas" currentPath="/composer" />
    </div>
  ),
};

/**
 * The default shape from 640px up to the sidebar: a floating icon rail,
 * detached from the edge, layered over the page instead of hidden behind
 * a hamburger the caller has to build.
 *
 * **Resize this story across every band.** That instruction used to be a
 * trap: the stage below was a plain block, which suited a rail that
 * floats and broke the instant the component became an in-flow box at
 * 1024px — the rail appeared as a full-height strip *below* all the
 * content, because that is where `SideNav` sits in this DOM. The stage
 * is a flex row now, and the in-flow band it was failing at no longer
 * exists: nothing between 640px and 1280px takes space out of the page
 * any more.
 *
 * The content column's padding is `p-6 pb-24 sm:pb-6 sm:pl-24 xl:pl-6`,
 * and every part of it is doing something — because the rail is `fixed`
 * and portalled, so it **cannot reserve its own space**. That padding is
 * the caller's job in a real application too, which is the single thing
 * an integrator is most likely to miss.
 *
 * Reading it: below `sm` the rail is the bottom toolbar — 64px tall,
 * 16px off the bottom edge, so 80px — and `pb-24` clears it with 16px to
 * spare; there is no left gutter to leave. From `sm` the vertical toolbar
 * takes the leftmost 80px (`left-4` plus `w-16`), so `pl-24` gives it
 * 96px and a 16px margin, and the bottom clearance goes away. (It was
 * `pl-20` while the rail was a 52px pill 12px in; M3's 64px toolbar at
 * its 16px screen offset ends exactly where `pl-20` did, so a caller
 * still on `pl-20` gets content touching the toolbar's edge.)
 * At `xl` the sidebar is in flow and takes its own lane, so the gutter
 * returns to `p-6`.
 *
 * (This paragraph used to quote `xl:pl-0 pl-16`, which is not what the
 * code says and argued the opposite of what the classes do — it claimed a
 * left gutter below 640px would reserve space for nothing, while leaving
 * one there. With `collapsed`, note the `xl:pl-6` is wrong: the sidebar
 * never renders, so the left gutter has to stay.)
 *
 * Hover (or focus) an icon for its native-`title` label: nothing here is
 * a CSS tooltip, so nothing here can be clipped by an ancestor.
 */
export const FloatingRail: Story = {
  globals: { viewport: { value: "medium" } },
  render: (args) => (
    <div className="flex h-[32rem] overflow-hidden rounded-md border border-edge">
      <SideNav {...args} />
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto bg-base-100 p-6 pb-24 sm:pb-6 sm:pl-24 xl:pl-6">
        <div className="h-7 w-48 rounded-sm bg-surface-3" />
        <div className="h-4 w-full max-w-xs rounded-sm bg-surface-2" />
        <div className="mt-2 h-40 rounded-md bg-surface-2" />
        <div className="h-24 rounded-md bg-surface-2" />
        <p className="text-body text-muted-foreground">
          The rail floats over this column — it is `fixed`, not laid out beside it. Cross 640px and
          1280px: horizontal pill, vertical rail, then a real sidebar that does take a lane.
        </p>
      </div>
    </div>
  ),
};

/**
 * Below 640px the rail turns: a horizontal pill along the bottom, four
 * destinations, and everything else behind the menu on its right.
 *
 * The fixture has more destinations than slots on purpose — open the menu
 * and note that its rows are real anchors, so middle-click and
 * "open in new tab" still work on them. A destination should not become a
 * worse link for having landed fifth in the order.
 *
 * The menu button takes the active treatment when the current page is one
 * of the hidden ones, so the rail never shows nothing as current.
 *
 * Both of those paragraphs are claims, and the play function is what
 * makes them fail when they stop being true. Note that everything it
 * touches lives in `document.body`, not `canvasElement`: the rail is
 * portalled (see `FloatingRailPortal`), and Headless UI's `MenuItems`
 * portals again on top of that, so a canvas-scoped query here would find
 * nothing at all and report success for it.
 */
export const TinyScreenRail: Story = {
  globals: { viewport: { value: "tiny" } },
  // `/routes` is deliberately one of the *overflowed* destinations in this
  // fixture, so the menu button carries the active treatment and the
  // story demonstrates that rather than describing it.
  args: { currentPath: "/routes" },
  render: (args) => (
    <div className="flex h-[40rem] overflow-hidden bg-base-100">
      <SideNav {...args} />
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-5 pb-24">
        <div className="h-7 w-40 rounded-sm bg-surface-3" />
        <div className="h-4 w-full rounded-sm bg-surface-2" />
        <div className="h-32 rounded-md bg-surface-2" />
        <div className="h-32 rounded-md bg-surface-2" />
        <p className="text-body text-muted-foreground">
          `pb-24` on this column is the caller's job, not the rail's: the rail is `fixed`, so it
          cannot reserve its own space, and content that scrolls under it would otherwise end
          beneath the pill.
        </p>
      </div>
    </div>
  ),
  play: async ({ step }) => {
    const body = within(document.body);
    const railSelector = 'nav[data-floating-rail-axis="horizontal"]';

    await step("The horizontal pill is the navigation at this width", async () => {
      const rail = await waitFor(() => {
        const found = document.body.querySelector(railSelector);
        if (found === null) throw new Error("the horizontal rail has not mounted");
        return found as HTMLElement;
      });
      // Four destinations in slots, the rest behind the menu. The count is
      // `HORIZONTAL_RAIL_SLOTS`, and it is a thumb measurement — see the
      // component's own note.
      await expect(within(rail).getAllByRole("link")).toHaveLength(4);
      // A `<nav aria-label="Primary">`, not a `<div>` — below `sm` this
      // pill *is* the navigation landmark, and every rail link sits
      // inside it.
      await expect(rail.tagName).toBe("NAV");
      await expect(rail).toHaveAttribute("aria-label", "Primary");
    });

    const menuButton = body.getByRole("button", { name: "More destinations" });

    await step("`/routes` is behind the menu, so the menu button reads as current", async () => {
      // The trigger's "current" state is *only* a visual treatment — there
      // is no ARIA on it to assert — so this reads what is painted rather
      // than a class name: the menu button's pill is filled, and an idle
      // slot's is not. A computed colour, because a class string is what
      // this assertion used to be, and the class it named stopped
      // existing the day the rail became an M3 toolbar.
      const pill = (el: Element) =>
        getComputedStyle(el.querySelector("[data-toolbar-item]") as Element).backgroundColor;
      const idle = within(document.body.querySelector(railSelector) as HTMLElement).getAllByRole(
        "link",
      )[0] as HTMLElement;
      await expect(pill(menuButton)).not.toBe("rgba(0, 0, 0, 0)");
      await expect(pill(idle)).toBe("rgba(0, 0, 0, 0)");
    });

    await step("Opening it shows the three destinations that did not fit", async () => {
      await userEvent.click(menuButton);
      const menu = within(await body.findByRole("menu"));
      const rows = menu.getAllByRole("menuitem");
      await expect(rows.map((row) => row.textContent)).toEqual([
        "Routes",
        "Documentation",
        "Settings",
      ]);
    });

    await step("Every row is a real anchor with a real href", async () => {
      const rows = within(body.getByRole("menu")).getAllByRole("menuitem");
      await expect(rows.map((row) => row.tagName)).toEqual(["A", "A", "A"]);
      await expect(rows.map((row) => row.getAttribute("href"))).toEqual([
        "/routes",
        "/docs",
        "/settings",
      ]);
    });

    await step("…and the current page is the one marked inside it", async () => {
      const rows = within(body.getByRole("menu")).getAllByRole("menuitem");
      const current = rows.filter((row) => row.getAttribute("aria-current") === "page");
      await expect(current.map((row) => row.getAttribute("href"))).toEqual(["/routes"]);
    });

    await step("Escape closes the menu and hands focus back to its button", async () => {
      await userEvent.keyboard("{Escape}");
      await waitFor(async () => {
        await expect(body.queryByRole("menu")).toBeNull();
      });
      await expect(menuButton).toHaveFocus();
    });
  },
};

/**
 * `collapsed` at desktop width. The sidebar is the only shape that takes
 * a lane, so collapsing it means handing the band to the floating rail —
 * not drawing a narrower sidebar. Compare with `FullSidebar`: the content
 * column here starts at the page edge.
 *
 * The prop is a boolean rather than a breakpoint because it is a
 * preference, not a measurement. The caller owns it, persists it, and
 * usually puts a toggle beside it.
 */
export const CollapsedOnDesktop: Story = {
  globals: { viewport: { value: "fullSidebar" } },
  args: { collapsed: true },
  render: (args) => (
    <div className="flex h-[32rem] overflow-hidden rounded-md border border-edge">
      <SideNav {...args} />
      <div className="flex min-w-0 flex-1 flex-col gap-4 bg-base-100 p-6 pl-24">
        <div className="h-7 w-64 rounded-sm bg-surface-3" />
        <div className="h-4 w-96 rounded-sm bg-surface-2" />
        <div className="mt-2 h-40 rounded-md bg-surface-2" />
        <p className="text-body text-muted-foreground">
          No 256px lane — the rail floats, and the content has the width back.
        </p>
      </div>
    </div>
  ),
};

/**
 * Enough groups that the floating rail itself outgrows `max-h-[80vh]` and
 * has to scroll — the same overflow this component has always had to
 * handle, one level narrower. `overflow-x-hidden` guards the same
 * horizontal-scrollbar regression `<nav>` itself guards against, and the
 * native `title` label keeps working the whole way down, because a
 * browser-painted tooltip is never subject to an ancestor's `overflow`.
 */
export const FloatingRailOverflow: Story = {
  globals: { viewport: { value: "offCanvas" } },
  render: (args) => (
    <div className="h-[45rem] overflow-y-auto bg-base-100 p-6">
      <div className="pl-16">
        <div className="h-7 w-48 rounded-sm bg-surface-3" />
      </div>
      <SideNav
        {...args}
        groups={[
          ...GROUPS,
          {
            label: "Operations",
            items: [
              { label: "Jobs", href: "/jobs", icon: Route },
              { label: "Workers", href: "/workers", icon: Plug },
              { label: "Opt-outs", href: "/opt-outs", icon: Inbox },
              { label: "Audit log", href: "/audit-log", icon: Book },
            ],
          },
          {
            label: "Administration",
            items: [
              { label: "Apps", href: "/apps", icon: Plug },
              { label: "Users", href: "/users", icon: Send },
              { label: "Webhooks", href: "/webhooks", icon: Route },
            ],
          },
          {
            label: "Extra",
            items: [
              { label: "Templates", href: "/templates", icon: Book },
              { label: "Segments", href: "/segments", icon: Route },
            ],
          },
        ]}
      />
    </div>
  ),
};

/** An account block under the footer rows of the `≥1280px` sidebar,
 * unchanged. Below 1280px it is not in the toolbar — there is no room for
 * it at 64px — but behind the toolbar's "More" control: see the three
 * "Account sheet" stories. */
export const WithAnAccountBlock: Story = {
  globals: { viewport: { value: "fullSidebar" } },
  render: (args) => (
    <Shell>
      <SideNav
        {...args}
        accountSlot={
          <div className="flex flex-col gap-0.5 text-caption">
            <span className="truncate text-subtle-foreground">ops@example.com</span>
            <button type="button" className="text-left text-muted-foreground hover:text-foreground">
              Sign out
            </button>
          </div>
        }
      />
    </Shell>
  ),
};

/**
 * A realistic `accountSlot`: who is signed in, a radio group, and a
 * sign-out action — the three things vaam-apps/vpay puts there, and
 * exactly what a `role="menu"` cannot hold. Stateful, so a test can prove
 * each control was *operated*, not merely found: the radio moves, and
 * the button says so once pressed.
 *
 * A `RadioGroup` of its own rather than `ThemeSwitcher`, whose stories
 * own `data-theme` and opt out of the preview's theme decorator — mounted
 * here it would fight the toolbar's theme global.
 */
function AccountBlock() {
  const [density, setDensity] = useState<"compact" | "comfortable">("compact");
  const [signedOut, setSignedOut] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-w-0 flex-col gap-0.5 text-caption">
        <span className="text-subtle-foreground">Signed in as</span>
        <span className="truncate text-foreground">ops@example.com</span>
      </div>
      <RadioGroup
        aria-label="Row density"
        value={density}
        onValueChange={setDensity}
        options={[
          { value: "compact", label: "Compact" },
          { value: "comfortable", label: "Comfortable" },
        ]}
      />
      <Button variant="secondary" size="sm" onClick={() => setSignedOut(true)}>
        {signedOut ? "Signed out" : "Sign out"}
      </Button>
    </div>
  );
}

/** The "More" control's sheet, found where it really lives: portalled to
 * `document.body`, so a canvas-scoped query would find nothing. */
async function openAccountSheet(presentation: "bottom" | "side") {
  const body = within(document.body);
  const more = await waitFor(() => {
    const found = [...document.body.querySelectorAll<HTMLElement>("[data-side-nav-more]")].find(
      (el) => el.checkVisibility(),
    );
    if (found === undefined) throw new Error("no visible More control has mounted");
    return found;
  });
  await userEvent.click(more);
  const sheet = await body.findByRole("dialog", { name: "More" });
  await expect(sheet).toHaveAttribute("data-side-nav-sheet", presentation);
  return sheet;
}

/**
 * **Account sheet — phone.** Below 640px, with an `accountSlot`, the
 * bottom toolbar's last control is "More" and opens an M3 modal bottom
 * sheet: the destinations that did not fit, the footer rows, then the
 * account block exactly as the caller rendered it. Before this, the
 * account block did not exist below 1280px at all in the default mode,
 * and consumers built their own `fixed` chrome to reach Sign out — which
 * then collided with this toolbar (vaam-apps/ui#36).
 *
 * `/routes` is one of the overflowed destinations, so "More" wears the
 * current-page pill, and the sheet marks Routes as the current row.
 *
 * `SideNav` sits inside a `will-change: transform` wrapper here — vaul's
 * own stamp on every drawer, and the containing-block trap AGENTS.md
 * names. The sheet is portalled to `document.body`, so it still lands on
 * the viewport's bottom edge; `e2e/side-nav-account-sheet.spec.ts`
 * measures that. The play function leaves the sheet open.
 */
export const AccountSheetOnAPhone: Story = {
  globals: { viewport: { value: "tiny" } },
  args: { currentPath: "/routes", accountSlot: <AccountBlock /> },
  render: (args) => (
    <div className="flex h-[40rem] overflow-hidden bg-base-100">
      <div data-transformed-ancestor="" className="[will-change:transform]">
        <SideNav {...args} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-5 pb-24">
        <div className="h-7 w-40 rounded-sm bg-surface-3" />
        <div className="h-32 rounded-md bg-surface-2" />
        <div className="h-32 rounded-md bg-surface-2" />
      </div>
    </div>
  ),
  play: async ({ step }) => {
    const sheet = await openAccountSheet("bottom");
    const inSheet = within(sheet);
    await step("The rows are the overflow destinations, then the footer", async () => {
      const rows = inSheet.getAllByRole("link");
      await expect(rows.map((row) => row.textContent)).toEqual([
        "Routes",
        "Documentation",
        "Settings",
      ]);
      await expect(inSheet.getByRole("link", { name: "Routes" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    });
    await step("…then the account block, rendered as-is and operable", async () => {
      await expect(inSheet.getByText("ops@example.com")).toBeInTheDocument();
      await expect(inSheet.getByRole("radiogroup", { name: "Row density" })).toBeInTheDocument();
      await expect(inSheet.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    });
  },
};

/**
 * **Account sheet — no overflow.** Three destinations, no footer rows: the
 * bar has room for everything, and before this it had no overflow control
 * at all. With an `accountSlot` it gains "More" anyway, because the
 * account block is the one thing the bar can never show — and the sheet
 * holds only that. The play function leaves the sheet open.
 */
export const AccountSheetWithNoOverflow: Story = {
  globals: { viewport: { value: "tiny" } },
  args: {
    currentPath: "/composer",
    groups: [GROUPS[0] as (typeof GROUPS)[number]],
    footerItems: [],
    accountSlot: <AccountBlock />,
  },
  render: (args) => (
    <div className="flex h-[40rem] overflow-hidden bg-base-100">
      <SideNav {...args} />
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-5 pb-24">
        <div className="h-7 w-40 rounded-sm bg-surface-3" />
        <div className="h-32 rounded-md bg-surface-2" />
      </div>
    </div>
  ),
  play: async () => {
    const sheet = await openAccountSheet("bottom");
    await expect(within(sheet).queryAllByRole("link")).toHaveLength(0);
    await expect(within(sheet).getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  },
};

/**
 * **Account sheet — the vertical rail.** From 640px up to the sidebar (and
 * at every width when `collapsed`), with an `accountSlot`, the rail ends in
 * a "More" control under the footer rows. It opens M3's modal navigation
 * drawer from the left edge — the rail's own edge — holding what the
 * sidebar holds: every destination, labelled, under its group's header,
 * the footer rows, and the account block. The rail shows every
 * destination already, but only as an icon whose label needs a hover a
 * touch tablet does not have. The play function leaves the drawer open.
 */
export const AccountSheetFromTheRail: Story = {
  globals: { viewport: { value: "iconRail" } },
  args: { currentPath: "/providers", accountSlot: <AccountBlock /> },
  render: (args) => (
    <div className="flex h-[40rem] overflow-hidden bg-base-100">
      <SideNav {...args} />
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-6 sm:pl-24 xl:pl-6">
        <div className="h-7 w-64 rounded-sm bg-surface-3" />
        <div className="h-40 rounded-md bg-surface-2" />
      </div>
    </div>
  ),
  play: async ({ step }) => {
    const sheet = await openAccountSheet("side");
    const inSheet = within(sheet);
    await step("Every destination, labelled, in the sidebar's order", async () => {
      const rows = inSheet.getAllByRole("link");
      await expect(rows.map((row) => row.textContent)).toEqual([
        "Dashboard",
        "Composer",
        "Messages",
        "Providers",
        "Routes",
        "Documentation",
        "Settings",
      ]);
      await expect(inSheet.getByRole("list", { name: "Delivery" })).toBeInTheDocument();
    });
    await step("…then the account block", async () => {
      await expect(inSheet.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    });
  },
};

/**
 * Long labels and a nav taller than its own box, together — the two
 * things that used to break this component.
 *
 * Labels end in an ellipsis instead of wrapping, because nav rows are a
 * fixed-height rhythm and one row growing to two lines shunts every row
 * below it. Vertical scrolling is real and intended; horizontal scrolling
 * is not, and is now impossible rather than merely absent.
 */
export const LongLabelsAndOverflow: Story = {
  globals: { viewport: { value: "fullSidebar" } },
  render: (args) => (
    <Shell note="Scrolls down, never sideways.">
      <SideNav
        {...args}
        groups={[
          {
            label: "Messaging and delivery receipts",
            items: [
              { label: "Composer", href: "/composer", icon: Send },
              {
                label: "Messages awaiting a delivery receipt",
                href: "/messages",
                icon: Inbox,
              },
            ],
          },
          ...GROUPS.slice(1),
          {
            label: "Operations",
            items: [
              { label: "Jobs", href: "/jobs", icon: Route },
              { label: "Workers", href: "/workers", icon: Plug },
              { label: "Opt-outs", href: "/opt-outs", icon: Inbox },
              { label: "Audit log", href: "/audit-log", icon: Book },
            ],
          },
          {
            label: "Administration",
            items: [
              { label: "Apps", href: "/apps", icon: Plug },
              { label: "Users", href: "/users", icon: Send },
              { label: "Webhooks", href: "/webhooks", icon: Route },
            ],
          },
        ]}
      />
    </Shell>
  ),
};

/**
 * A realistic page to put a floating toolbar over: an instrument panel
 * (the aurora mesh, the busiest surface in the library), stat tiles, and
 * enough text to scroll under the bar. The toolbar stories below use it
 * so its two colour schemes are judged where they will actually live,
 * not on an empty page where anything reads.
 */
function BusyPage({ bottomPad }: { bottomPad: string }) {
  return (
    // `space-y-4` on a block, not `flex flex-col gap-4`: the instrument
    // panel clips its own mesh, and a flex item with `overflow` set has a
    // zero automatic minimum height, so a flex column squashed it to a
    // 40px sliver the first time this rendered.
    <div className={cn("h-[50rem] space-y-4 overflow-y-auto bg-base-100 p-4", bottomPad)}>
      <div className="h-7 w-40 rounded-sm bg-surface-3" />
      <InstrumentPanel title="Delivery, last 24h" caption="Across every provider">
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Delivered" value="18,204" emphasized />
          <StatTile label="Unresolved" value="37" />
        </div>
      </InstrumentPanel>
      {Array.from({ length: 6 }, (_, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: static filler rows
          key={index}
          // `surface-2`, the fill every `Card` has — the case the standard
          // bar's missing shadow costs, so this story has to show it.
          className="flex flex-col gap-2 rounded-box border border-edge bg-surface-2 p-4"
        >
          <div className="h-4 w-1/2 rounded-sm bg-surface-3" />
          <p className="text-body text-muted-foreground">
            Content scrolls under the toolbar. Its fill is the only thing that separates it from
            this card, which is the whole question these stories ask.
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * **Toolbar colours — standard.** M3's default floating-toolbar scheme:
 * a `SurfaceContainer` bar (`surface-2`) with muted icons, and the current
 * page as a filled `primary` pill, with no shadow — androidx ships it at
 * elevation `Level0`, and so does this. Scroll the page, in either
 * theme: where a card passes under it — `surface-2`, the bar's own fill,
 * like every `Card` and `StatTile` — the bar's edge disappears and only
 * its icons remain. That is the accepted cost of matching M3; the vibrant
 * story is the answer for a screen where it matters.
 */
export const ToolbarColorsStandard: Story = {
  globals: { viewport: { value: "tiny" } },
  args: { currentPath: "/messages", toolbarVariant: "standard" },
  render: (args) => (
    <>
      <SideNav {...args} />
      <BusyPage bottomPad="pb-24" />
    </>
  ),
};

/**
 * **Toolbar colours — vibrant.** M3's other scheme: a `PrimaryContainer`
 * bar — `primary` here, so near-white on the dark theme and near-black on
 * the light one — with the current page cut back out of it in
 * `SurfaceContainer`. Loud, and its edge holds over every surface,
 * because no surface uses its fill — only a filled `primary` control
 * passing under it would match.
 * Switch the theme toolbar to light to see it invert.
 */
export const ToolbarColorsVibrant: Story = {
  globals: { viewport: { value: "tiny" } },
  args: { currentPath: "/messages", toolbarVariant: "vibrant" },
  render: (args) => (
    <>
      <SideNav {...args} />
      <BusyPage bottomPad="pb-24" />
    </>
  ),
};

/** The vertical toolbar (640–1279px) in the vibrant scheme. The current
 * page's pill runs along the toolbar's own axis — 40 wide, 64 tall —
 * which is androidx's vertical toolbar sample, turned. */
export const VerticalToolbarVibrant: Story = {
  globals: { viewport: { value: "medium" } },
  args: { currentPath: "/providers", toolbarVariant: "vibrant" },
  render: (args) => (
    <div className="flex">
      <SideNav {...args} />
      <div className="min-w-0 flex-1 pl-24">
        <BusyPage bottomPad="pb-6" />
      </div>
    </div>
  ),
};

/**
 * A phone-width `Select` inside a **`sticky` header**, with the toolbar on
 * screen. `sticky` with a `z-index` is a stacking context, so the select's
 * sheet — not portalled, `z-50` only inside that context — would paint
 * *under* the toolbar, which is portalled to `body` at `z-40`: an
 * undimmed bar sitting over the bottom 80px of the sheet, above its
 * scrim. The toolbar hides itself while a sheet is open instead
 * (`HorizontalRail`'s `body:has([data-select-content])` rule), which is
 * what the play function leaves you looking at. Close the sheet and the
 * toolbar comes back.
 */
export const ToolbarUnderAPhoneSheet: Story = {
  globals: { viewport: { value: "tiny" } },
  args: { currentPath: "/messages" },
  render: (args) => (
    <>
      <SideNav {...args} />
      <div className="h-[50rem] overflow-y-auto bg-base-100 pb-24">
        <div className="sticky top-0 z-10 border-edge border-b bg-base-100 p-4">
          <Select defaultValue="24h">
            <SelectTrigger aria-label="Window">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last hour</SelectItem>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <BusyPage bottomPad="pb-6" />
      </div>
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Window" }));
    await expect(await canvas.findByRole("listbox")).toBeInTheDocument();
  },
};

/**
 * A `SelectModal` at tablet width, with the vertical toolbar on screen.
 * The sheet's scrim is a shadow, which cannot catch a tap, and the toolbar
 * is portalled to `body`, which a plain select's inert never reaches — so
 * it used to stay clickable (and navigable) under the scrim. It steps out
 * of the way while a modal select is open, the same way the bottom toolbar
 * does for a phone sheet — and only then: the "Sort by" dropdown beside it
 * leaves the toolbar where it is. The play function leaves the sheet open.
 */
export const RailUnderAModalSelect: Story = {
  globals: { viewport: { value: "medium" } },
  args: { currentPath: "/messages" },
  render: (args) => (
    <div className="flex h-[40rem] bg-base-100">
      <SideNav {...args} />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-4 p-6 sm:pl-24">
        <Select defaultValue="exponential">
          <SelectTrigger aria-label="Retry policy">
            <SelectValue />
          </SelectTrigger>
          <SelectModal>
            <SelectItem value="none">Never retry</SelectItem>
            <SelectItem value="linear">Every 5 minutes, 6 times</SelectItem>
            <SelectItem value="exponential">Exponential backoff, up to 24 hours</SelectItem>
          </SelectModal>
        </Select>
        <Select defaultValue="newest">
          <SelectTrigger aria-label="Sort by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Retry policy" }));
    await expect(await canvas.findByRole("listbox")).toBeInTheDocument();
  },
};
