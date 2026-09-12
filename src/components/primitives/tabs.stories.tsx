import type { Meta, StoryObj } from "@storybook/react-vite";
import { ValueTabs, ValueTabsContent, ValueTabsList, ValueTabsTrigger } from "./tabs";

const meta = {
  title: "Primitives/Tabs",
  component: ValueTabs,
  tags: ["autodocs"],
  args: { children: null },
} satisfies Meta<typeof ValueTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <ValueTabs defaultValue="request" className="w-[36rem]">
      <ValueTabsList>
        <ValueTabsTrigger value="request">Request</ValueTabsTrigger>
        <ValueTabsTrigger value="response">Response</ValueTabsTrigger>
        <ValueTabsTrigger value="receipts">Receipts</ValueTabsTrigger>
      </ValueTabsList>
      <ValueTabsContent value="request">
        <p className="text-body text-muted-foreground">What was sent.</p>
      </ValueTabsContent>
      <ValueTabsContent value="response">
        <p className="text-body text-muted-foreground">What came back.</p>
      </ValueTabsContent>
      <ValueTabsContent value="receipts">
        <p className="text-body text-muted-foreground">What arrived later, out of band.</p>
      </ValueTabsContent>
    </ValueTabs>
  ),
};
