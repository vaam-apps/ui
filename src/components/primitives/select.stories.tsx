import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "./button";
import { MoreDetailDrawer } from "./drawer";
import { FormField } from "./form-field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

const meta = {
  title: "Primitives/Select",
  component: Select,
  tags: ["autodocs"],
  args: { children: null },
  parameters: {
    docs: {
      description: {
        component:
          "A listbox for a vocabulary too long to show at once. For a handful of options " +
          "prefer `RadioGroup` or `ChipSelect`: a select makes the reader click once to " +
          "discover the choices and again to pick. The options render *inline*, not " +
          "portaled — `portal={false}` is a correctness fix, not a preference, and the " +
          "“Inside a drawer” story below is the case it exists for.",
      },
    },
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

const PROVIDERS = [
  { id: "orange_cm", name: "Orange Cameroon" },
  { id: "mtn_agg", name: "MTN (aggregator)" },
  { id: "twilio", name: "Twilio" },
  { id: "fake", name: "Fake (test)" },
];

/** The trigger shows the matching item's *label*, not the raw value —
 * `provider.name` for an `id`, which is what Radix's `SelectValue` used to
 * give for free and what `findItemLabel` reproduces here. */
export const Default: Story = {
  render: function Render() {
    const [value, setValue] = useState<string>();
    return (
      <div className="flex w-full max-w-64 flex-col gap-3">
        <FormField label="Provider" htmlFor="sb-provider">
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger id="sb-provider">
              <SelectValue placeholder="Any provider" />
            </SelectTrigger>
            <SelectContent>
              {PROVIDERS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <p className="font-mono text-caption text-subtle-foreground">value: {value ?? "—"}</p>
      </div>
    );
  },
};

/**
 * One chevron.
 *
 * daisyUI's `.select` draws its own disclosure arrow as a pair of
 * `linear-gradient` background images, meant for a native `<select>` with
 * no room for a child element. This trigger renders a real lucide
 * `ChevronDown`, so both used to paint: two indicators, 6px apart, on one
 * control. `bg-none` removes daisyUI's and `pe-3` reclaims the 1.75rem it
 * had reserved for it, so the chevron sits the same 12px off the edge as
 * the label does on the other side.
 */
export const OneIndicator: Story = {
  render: () => (
    <div className="flex w-full max-w-[28rem] flex-col gap-2">
      <Select defaultValue="orange_cm">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PROVIDERS.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-caption text-subtle-foreground">
        Compare against a bare daisyUI select below, which keeps its own CSS arrow because it has no
        icon child of its own.
      </p>
      <select aria-label="A native daisyUI select, for comparison" className="select w-full">
        <option>Orange Cameroon</option>
      </select>
    </div>
  ),
};

/** A value longer than the control ends in an ellipsis and the chevron
 * stays put. `.select` is `overflow: hidden; white-space: nowrap`, so
 * before the trigger got `min-w-0 truncate` a long label was sliced off
 * mid-glyph at the border and pushed the icon out of the box entirely. */
export const LongValues: Story = {
  render: () => (
    <div className="flex w-full max-w-64 flex-col gap-3">
      <Select defaultValue="long">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="long">
            Orange Cameroon — primary outbound route, Douala point of presence
          </SelectItem>
          <SelectItem value="short">MTN</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-caption text-subtle-foreground">
        Open it: the option itself clamps to two lines, so one long entry cannot make its row three
        times the height of every other.
      </p>
    </div>
  ),
};

/** `SelectGroup` is a semantic wrapper with no visual treatment of its
 * own — Headless UI's `Listbox` has no grouped-options concept, so this
 * exists for API parity rather than to draw a divider. Label the sections
 * yourself if the vocabulary needs it. */
export const Grouped: Story = {
  render: () => (
    <div className="w-full max-w-64">
      <Select defaultValue="orange_cm">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <p className="px-2 py-1 text-micro text-muted-foreground tracking-[0.03em]">DIRECT</p>
            <SelectItem value="orange_cm">Orange Cameroon</SelectItem>
            <SelectItem value="twilio">Twilio</SelectItem>
          </SelectGroup>
          <SelectGroup>
            <p className="mt-1 px-2 py-1 text-micro text-muted-foreground tracking-[0.03em]">
              AGGREGATED
            </p>
            <SelectItem value="mtn_agg">MTN (aggregator)</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  ),
};

/** Disabled, and a long vocabulary that scrolls inside `max-h-80` rather
 * than running off the bottom of the screen. */
export const DisabledAndScrolling: Story = {
  render: () => (
    <div className="flex w-full max-w-[32rem] flex-col gap-4 sm:flex-row">
      <div className="flex-1">
        <FormField label="Provider" htmlFor="sb-disabled" hint="Locked while a send is in flight.">
          <Select defaultValue="orange_cm" disabled>
            <SelectTrigger id="sb-disabled">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="orange_cm">Orange Cameroon</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <div className="flex-1">
        <FormField label="Timezone" htmlFor="sb-long">
          <Select defaultValue="Africa/Douala">
            <SelectTrigger id="sb-long">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                "Africa/Douala",
                "Africa/Lagos",
                "Africa/Nairobi",
                "America/New_York",
                "America/Sao_Paulo",
                "Asia/Kolkata",
                "Asia/Tokyo",
                "Europe/Berlin",
                "Europe/London",
                "Pacific/Auckland",
                "UTC",
              ].map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>
    </div>
  ),
};

/**
 * The regression this component's `portal={false}` exists to prevent.
 *
 * Headless UI's `anchor` prop portals the options to a top-level sibling
 * of `<body>`. Inside a `vaul` drawer that is fatal: vaul mounts a
 * trapped Radix `FocusScope` that force-refocuses back into the drawer
 * the instant focus lands outside it, so a portaled listbox stalled
 * mid-transition at `opacity: 0` and never became usable — every select
 * inside a drawer was silently dead. Rendering inline keeps the options
 * in the drawer's own subtree. Open the drawer and use the select.
 */
export const InsideADrawer: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false);
    const [provider, setProvider] = useState<string>();
    return (
      <>
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          Open drawer
        </Button>
        <MoreDetailDrawer
          open={open}
          onOpenChange={setOpen}
          title="Register sender ID"
          description="Pick the provider to register VAAM with."
          footer={
            <Button size="sm" disabled={provider === undefined}>
              Register
            </Button>
          }
        >
          <FormField label="Provider" htmlFor="drawer-provider">
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger id="drawer-provider">
                <SelectValue placeholder="Choose a provider" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </MoreDetailDrawer>
      </>
    );
  },
};
