import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, buttonVariants } from "./button";

const meta = {
  title: "Primitives/Button",
  component: Button,
  tags: ["autodocs"],
  args: { children: "Button" },
  parameters: {
    docs: {
      description: {
        component:
          "Four variants and no more. There is deliberately no success or warning button: " +
          "those hues belong to status, and a button that borrows them erodes the status " +
          "language wherever both appear.",
      },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="icon" aria-label="Icon button">
        ⌘
      </Button>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled>Primary</Button>
      <Button variant="secondary" disabled>
        Secondary
      </Button>
      <Button variant="destructive" disabled>
        Destructive
      </Button>
    </div>
  ),
};

/** There is no `asChild`. A link that must look like a button reaches for
 * the class string directly, which keeps the anchor a real anchor. */
export const AsALink: Story = {
  render: () => (
    <a href="#top" className={buttonVariants({ variant: "secondary", size: "sm" })}>
      A real anchor, styled as a button
    </a>
  ),
};
