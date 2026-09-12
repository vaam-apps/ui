import type { Meta, StoryObj } from "@storybook/react-vite";
import { Code } from "../data/code";
import { DetailList, DetailRow } from "../data/detail-row";
import { IdDisplay } from "../data/id-display";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardBody, CardHeader } from "./card";
import { Separator } from "./separator";

const meta = {
  title: "Primitives/Card",
  component: Card,
  tags: ["autodocs"],
  args: {},
  parameters: {
    docs: {
      description: {
        component:
          "Borders, not shadows. Every card is a 1px `--edge` on a surface step, and shadows " +
          "are reserved for layers that genuinely float — popover, dialog, drawer, toast. Six " +
          "shadowed boxes on a screen is noise; six outlined ones read as one instrument panel.",
      },
    },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Title, optional mono metadata line, optional right-hand action slot.
 * Both the title and the meta line truncate rather than wrapping — a card
 * header is a one-line rhythm, and a two-line title in a row of cards
 * makes one card taller than the rest for no reason the reader can see. */
export const Anatomy: Story = {
  render: () => (
    <div className="grid w-full max-w-[44rem] gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader title="Orange Cameroon" meta="orange_cm · direct" />
        <CardBody>
          <p className="text-body text-muted-foreground">
            A card with a header and a body, and nothing else.
          </p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          title="Twilio"
          meta="twilio · aggregator"
          action={
            <Button size="sm" variant="secondary">
              Edit
            </Button>
          }
        />
        <CardBody>
          <p className="text-body text-muted-foreground">…and one with an action.</p>
        </CardBody>
      </Card>
      <Card className="sm:col-span-2">
        <CardHeader
          title="A deliberately long provider name that will not fit on one line of this card"
          meta="a_very_long_provider_key_that_also_does_not_fit · direct · primary route"
          action={
            <Button size="sm" variant="secondary">
              Edit
            </Button>
          }
        />
        <CardBody>
          <p className="text-body text-muted-foreground">
            Both lines end in an ellipsis instead of wrapping.
          </p>
        </CardBody>
      </Card>
    </div>
  ),
};

/**
 * `headingLevel` is a prop rather than a constant because a heading level
 * is a property of the *page's* outline, not of the card. A card placed
 * directly under a screen's `h1` needs `h2`; the default `h3` would skip
 * a level, which axe reports as `heading-order` and a screen-reader user
 * experiences as a missing section.
 */
export const HeadingLevels: Story = {
  render: () => (
    <div className="flex w-full max-w-[32rem] flex-col gap-4">
      <h1 className="font-medium text-foreground text-title">Providers</h1>
      <Card>
        <CardHeader title="Directly under the h1" headingLevel={2} meta="headingLevel={2}" />
        <CardBody>
          <p className="text-body text-muted-foreground">
            Open the Accessibility panel: no <Code>heading-order</Code> violation.
          </p>
        </CardBody>
      </Card>
    </div>
  ),
};

/**
 * `Badge` is for non-status tags only — an app name, a provider key, a
 * role, an environment. Never a message or job state: that is
 * `StatusPill`'s job, and mixing the two is how a status language erodes,
 * because a reader who has learned that a coloured pill means "state"
 * starts reading every badge as one.
 */
export const Badges: Story = {
  render: () => (
    <div className="flex w-full max-w-[32rem] flex-wrap items-center gap-2">
      <Badge>production</Badge>
      <Badge>orange_cm</Badge>
      <Badge variant="outline">admin</Badge>
      <Badge variant="outline">read:messages</Badge>
      <Badge variant="outline">a_long_tag_value_that_keeps_going</Badge>
    </div>
  ),
};

/** A card carrying a detail list, which is what most of them do — and a
 * `Separator` between the two halves. The non-decorative separator is a
 * real `<hr>`; the decorative one is a `<div role="none">`, because an
 * ARIA `separator` role on a generic element is the *interactive*,
 * resizable-pane variant and implies attributes a visual rule has no use
 * for. */
export const WithADetailList: Story = {
  render: () => (
    <Card className="w-full max-w-[32rem]">
      <CardHeader
        title="cs_msg_8f21c0b"
        meta="delivered · 2026-09-11 14:03:07Z"
        action={<Badge variant="outline">production</Badge>}
      />
      <CardBody>
        <DetailList>
          <DetailRow label="Message">
            <IdDisplay value="cs_msg_8f21c0bd4e1a9f3c77e" variant="full" />
          </DetailRow>
          <DetailRow label="Route">
            <Code>orange_cm.direct</Code>
          </DetailRow>
          <DetailRow label="Provider reference">
            <Code>OCM-2026-0911-8f21c0bd4e1a9f3c77e2b5</Code>
          </DetailRow>
        </DetailList>
        <Separator className="my-4" />
        <DetailList>
          <DetailRow label="Attempts">2 of 3</DetailRow>
          <DetailRow label="Cost">XAF 1,200</DetailRow>
        </DetailList>
      </CardBody>
    </Card>
  ),
};
