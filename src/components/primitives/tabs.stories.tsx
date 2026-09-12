import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { InlineBanner } from "../patterns/inline-banner";
import { Badge } from "./badge";
import { Button } from "./button";
import { ValueTabs, ValueTabsContent, ValueTabsList, ValueTabsTrigger } from "./tabs";

const meta = {
  title: "Primitives/Tabs",
  component: ValueTabs,
  tags: ["autodocs"],
  args: { children: null },
  parameters: {
    docs: {
      description: {
        component:
          "Underline tabs, and no pill or segmented variant — pill tabs are consumer " +
          "furniture. The API is value-based (`value`/`defaultValue`/`onValueChange`) over " +
          "Headless UI's index-based `TabGroup`, because a value survives a change in tab " +
          "order and an index does not.",
      },
    },
  },
} satisfies Meta<typeof ValueTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <ValueTabs defaultValue="request" className="w-full max-w-[36rem]">
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

/**
 * Controlled, which is the shape a screen wants when the tab is part of
 * the URL — a deep link to "the response tab of this attempt" has to be
 * reproducible, and that means the value lives outside the component.
 */
export const Controlled: Story = {
  render: function Render() {
    const [tab, setTab] = useState("response");
    return (
      <div className="flex w-full max-w-[36rem] flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {["request", "response", "receipts"].map((value) => (
            <Button
              key={value}
              size="sm"
              variant={tab === value ? "primary" : "secondary"}
              onClick={() => setTab(value)}
            >
              {value}
            </Button>
          ))}
          <span className="font-mono text-caption text-subtle-foreground">?tab={tab}</span>
        </div>
        <ValueTabs value={tab} onValueChange={setTab}>
          <ValueTabsList>
            <ValueTabsTrigger value="request">Request</ValueTabsTrigger>
            <ValueTabsTrigger value="response">Response</ValueTabsTrigger>
            <ValueTabsTrigger value="receipts">Receipts</ValueTabsTrigger>
          </ValueTabsList>
          <ValueTabsContent value="request">
            <InlineBanner>Outbound body, verbatim.</InlineBanner>
          </ValueTabsContent>
          <ValueTabsContent value="response">
            <InlineBanner variant="success">202 Accepted, 412ms.</InlineBanner>
          </ValueTabsContent>
          <ValueTabsContent value="receipts">
            <InlineBanner variant="uncertain">No receipt arrived within the window.</InlineBanner>
          </ValueTabsContent>
        </ValueTabs>
      </div>
    );
  },
};

/** A trigger is ordinary content, so a count or a state marker goes
 * inside it. Keep them short — the underline row is a single line, and a
 * tab whose label wraps breaks the rule beneath it. */
export const WithCounts: Story = {
  render: () => (
    <ValueTabs defaultValue="all" className="w-full max-w-[36rem]">
      <ValueTabsList>
        <ValueTabsTrigger value="all">
          All <Badge variant="outline">137</Badge>
        </ValueTabsTrigger>
        <ValueTabsTrigger value="failed">
          Failed <Badge variant="outline">4</Badge>
        </ValueTabsTrigger>
        <ValueTabsTrigger value="unresolved">
          Unresolved <Badge variant="outline">12</Badge>
        </ValueTabsTrigger>
      </ValueTabsList>
      <ValueTabsContent value="all">
        <p className="text-body text-muted-foreground">Every attempt in the window.</p>
      </ValueTabsContent>
      <ValueTabsContent value="failed">
        <p className="text-body text-muted-foreground">The four the provider rejected.</p>
      </ValueTabsContent>
      <ValueTabsContent value="unresolved">
        <p className="text-body text-muted-foreground">
          Handed off, no outcome ever learned. Neither a success nor a failure.
        </p>
      </ValueTabsContent>
    </ValueTabs>
  ),
};
