import type { Meta, StoryObj } from "@storybook/react-vite";
import { SideNav } from "./side-nav";

/** Minimal stand-in icons — the real ones come from the consuming app, so
 * the component only asks for a component that accepts `size`. */
function Dot({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <circle cx="8" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

const meta = {
  title: "Primitives/SideNav",
  component: SideNav,
  tags: ["autodocs"],
  args: {
    topItem: { label: "Dashboard", href: "/", icon: Dot },
    currentPath: "/messages",
    groups: [
      {
        label: "Messaging",
        items: [
          { label: "Composer", href: "/composer", icon: Dot },
          { label: "Messages", href: "/messages", icon: Dot },
        ],
      },
      {
        label: "Delivery",
        items: [
          { label: "Providers", href: "/providers", icon: Dot },
          { label: "Routes", href: "/routes", icon: Dot },
        ],
      },
    ],
    footerItems: [{ label: "Settings", href: "/settings", icon: Dot }],
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SideNav>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Collapses to an icon rail below the breakpoint — narrow the viewport
 * to see the labels go and the per-item tooltips take over. */
export const Default: Story = {
  render: (args) => (
    <div className="flex h-[32rem]">
      <SideNav {...args} />
      <div className="flex-1 p-6 text-body text-muted-foreground">Screen content</div>
    </div>
  ),
};
