import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card, CardBody, CardHeader } from "../primitives/card";
import { Separator } from "../primitives/separator";
import { defineStatusSystem } from "../status/status-tokens";
import { PayloadInspector } from "./payload-inspector";
import { RouteSkeleton } from "./route-skeleton";
import { ScreenHeader, ScreenStack } from "./screen-layout";
import { StateTimeline } from "./state-timeline";

const meta = {
  title: "Patterns/Screen scaffolding",
  component: ScreenStack,
  tags: ["autodocs"],
  args: { children: null },
} satisfies Meta<typeof ScreenStack>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Layout: Story = {
  render: () => (
    <ScreenStack>
      <ScreenHeader
        title="Routes"
        description="Which provider carries which traffic, and why that one won."
      />
      <Card>
        {/* `h2`: this card sits directly under the screen's own `h1`,
            so the default `h3` would skip a level. */}
        <CardHeader title="Catch-all" meta="priority 500 · weight 1" headingLevel={2} />
        <CardBody>
          <p className="text-body text-muted-foreground">Matches anything.</p>
        </CardBody>
      </Card>
      <Separator />
      <p className="text-caption text-subtle-foreground">Below the rule.</p>
    </ScreenStack>
  ),
};

/** The loading state for a list route: the shape of what is coming, so
 * the layout does not jump when it lands. */
export const Loading: Story = {
  render: () => <RouteSkeleton rows={5} />,
};

/** Request, response and out-of-band callback, with bodies collapsed by
 * default — an inspector that expands everything is a wall of JSON. */
export const Payloads: Story = {
  render: () => (
    <PayloadInspector
      defaultOpen={0}
      exchanges={[
        {
          direction: "request",
          method: "POST",
          url: "https://api.orange.com/smsmessaging/v1/outbound/requests",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            {
              outboundSMSMessageRequest: {
                address: "tel:+237677123456",
                senderAddress: "tel:+2370000",
              },
            },
            null,
            2,
          ),
        },
        {
          direction: "response",
          status: 201,
          durationMs: 412,
          body: JSON.stringify({ resourceURL: "…/requests/abc123" }, null, 2),
        },
        {
          direction: "callback",
          method: "POST",
          url: "/dlr/orange_cm",
          status: 200,
          body: JSON.stringify(
            {
              deliveryInfoNotification: { deliveryInfo: { deliveryStatus: "DeliveredToTerminal" } },
            },
            null,
            2,
          ),
        },
      ]}
    />
  ),
};

const FLOW = defineStatusSystem({
  accepted: {
    family: "in-flight",
    silhouette: "circle",
    mark: "pie-1",
    hue: "neutral",
    filled: false,
    attention: "quiet",
    label: "Accepted",
    tooltip: "Received and validated.",
  },
  submitted: {
    family: "in-flight",
    silhouette: "circle",
    mark: "ring",
    hue: "parked",
    filled: false,
    attention: "quiet",
    label: "Submitted",
    tooltip: "Handed to the provider.",
  },
  unknown: {
    family: "unresolved",
    silhouette: "diamond",
    mark: "question",
    hue: "uncertain",
    filled: false,
    attention: "loud",
    label: "Unknown",
    tooltip: "The outcome was never learned.",
  },
});

/**
 * A record's transition history. The annotations are the caller's,
 * because why a state looks like a bug but isn't is domain knowledge —
 * and without that sentence the operator's next move is a SQL client,
 * which is the outcome a timeline exists to prevent.
 */
export const Timeline: Story = {
  render: () => (
    <div className="w-[34rem]">
      <StateTimeline
        system={FLOW}
        currentState="unknown"
        isTerminal={false}
        annotations={{
          unknown:
            "Sent, but no receipt ever arrived. It will not be resubmitted — a deliberate trade against sending a duplicate.",
        }}
        transitions={[
          { toState: "accepted", at: "2026-09-11T09:00:00Z", actor: "api" },
          {
            toState: "submitted",
            at: "2026-09-11T09:00:01Z",
            providerKey: "orange_cm",
            attempt: 1,
            maxAttempts: 3,
          },
          { toState: "unknown", at: "2026-09-11T09:00:31Z", providerKey: "orange_cm" },
        ]}
      />
    </div>
  ),
};
