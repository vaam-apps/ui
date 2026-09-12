import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
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
        offCanvas: { name: "Off-canvas (390px)", styles: { width: "390px", height: "720px" } },
        iconRail: { name: "Icon rail (1100px)", styles: { width: "1100px", height: "640px" } },
        fullSidebar: {
          name: "Full sidebar (1440px)",
          styles: { width: "1440px", height: "640px" },
        },
      },
    },
    docs: {
      description: {
        component:
          "Three bands, all of them plain CSS — no `useMediaQuery`, no client-only mount, " +
          "so the whole nav is in the server-rendered HTML on first paint. Below 1024px it " +
          "fills the caller's off-canvas drawer with collapsible groups; from 1024px it is a " +
          "64px icon rail; from 1280px a 256px sidebar with labels. Resize the preview to " +
          "cross them.",
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
 * Below `lg` the nav fills whatever the caller put it in — here a 300px
 * stand-in for the off-canvas drawer — and groups become a collapsible
 * accordion, open only if it holds the current route. "Roughly 6–8
 * tappable rows on open, not 18."
 */
export const OffCanvasDrawer: Story = {
  globals: { viewport: { value: "offCanvas" } },
  render: (args) => (
    <div className="flex h-[32rem] w-full max-w-[300px] overflow-hidden rounded-md border border-edge">
      <SideNav {...args} currentPath="/composer" />
    </div>
  ),
};

/** An account block under the footer rows. Hidden in the icon rail band
 * — there is no room for it at 64px — and shown in the other two, by the
 * same CSS toggle as everything else here. */
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
