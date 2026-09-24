import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "./button";
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger, MoreDetailDrawer } from "./drawer";
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
    // A named phone viewport, so the bottom-sheet stories can pin the band
    // they exist for rather than asking the reader to drag the window
    // under 640px — the same reason `side-nav.stories.tsx` names its own.
    viewport: {
      options: {
        phone: {
          name: "Phone — bottom sheet (375px)",
          styles: { width: "375px", height: "812px" },
        },
      },
    },
    docs: {
      description: {
        component:
          "A listbox for a vocabulary too long to show at once. For a handful of options " +
          "prefer `RadioGroup` or `ChipSelect`: a select makes the reader click once to " +
          "discover the choices and again to pick. The options render *inline*, not " +
          "portaled — `portal={false}` is a correctness fix, not a preference, and the " +
          "“Inside a drawer” story below is the case it exists for.\n\n" +
          "**Below 640px the options open as an M3 modal bottom sheet** instead of a " +
          "dropdown: pinned to the bottom edge, 28px top corners, a drag handle that really " +
          "drags (pull it down past 56px, or flick it, to dismiss), a scrim over the page, and " +
          "56px rows with the current value as a filled pill. It is the same element restyled " +
          "by a media query — no second component, no viewport read — so it works inside a " +
          "drawer exactly as the dropdown does. The “Phone” stories below open it for you.",
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
 * give for free and what `findItemLabel` reproduces here.
 *
 * The play function is the proof of that sentence: it never names an
 * option itself. It reads the active option out of the listbox's own
 * `aria-activedescendant` after each arrow key, picks *that* one with
 * Enter, and then asserts the trigger is showing the same text — so a
 * `findItemLabel` that fell back to the raw `mtn_agg` would fail here
 * rather than pass against a hardcoded expectation that happened to
 * match. It also walks the rest of the keyboard contract: opening,
 * moving, Escape closing, and focus returning to the trigger. */
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
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Provider" });

    // `SelectContent` renders `portal={false}` — see the component's own
    // note on #315 — so the options really are inside `canvasElement`.
    // Every query here stays scoped to the canvas on purpose: if that
    // fix were ever reverted, these would stop finding the listbox
    // instead of quietly passing against a portalled copy.
    const options = () => within(canvas.getByRole("listbox")).getAllByRole("option");
    const activeOption = () => {
      const id = canvas.getByRole("listbox").getAttribute("aria-activedescendant");
      const found = options().find((option) => option.id === id);
      if (found === undefined) {
        throw new Error(`no option matches aria-activedescendant "${id}"`);
      }
      return found;
    };

    await step("It starts closed, showing the placeholder", async () => {
      await expect(trigger).toHaveTextContent("Any provider");
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await expect(canvas.queryByRole("listbox")).toBeNull();
      await expect(canvas.getByText("value: —")).toBeInTheDocument();
    });

    await step("Clicking the trigger opens the whole vocabulary", async () => {
      await userEvent.click(trigger);
      await expect(await canvas.findByRole("listbox")).toBeInTheDocument();
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await expect(options()).toHaveLength(PROVIDERS.length);
    });

    await step("The first arrow key activates the first option", async () => {
      await userEvent.keyboard("{ArrowDown}");
      await expect(activeOption()).toBe(options()[0]);
    });

    let picked = "";
    await step("The next one moves down by exactly one row", async () => {
      await userEvent.keyboard("{ArrowDown}");
      await expect(activeOption()).toBe(options()[1]);
      picked = activeOption().textContent ?? "";
      await expect(picked).not.toBe("");
    });

    await step("Enter selects whatever is active, and the button shows its label", async () => {
      await userEvent.keyboard("{Enter}");
      await waitFor(async () => {
        await expect(canvas.queryByRole("listbox")).toBeNull();
      });
      // Not "MTN (aggregator)" spelled out here — `picked` is whatever the
      // listbox said was active a moment ago, so this fails if the trigger
      // shows anything else, the raw `mtn_agg` value included.
      await expect(trigger).toHaveTextContent(picked);
      await expect(canvas.getByText("value: mtn_agg")).toBeInTheDocument();
    });

    await step("Escape closes it again and hands focus back to the trigger", async () => {
      await userEvent.click(trigger);
      await expect(await canvas.findByRole("listbox")).toBeInTheDocument();
      await userEvent.keyboard("{Escape}");
      await waitFor(async () => {
        await expect(canvas.queryByRole("listbox")).toBeNull();
      });
      await expect(trigger).toHaveFocus();
      // Escape is a cancel, not a pick: the selection made above survives.
      await expect(canvas.getByText("value: mtn_agg")).toBeInTheDocument();
    });
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
 *
 * Also the reproduction for "drawer + select on small screens: it's
 * cramped" (`e2e/density.spec.ts`'s "a phone-width sheet forces
 * comfortable" suite drives this exact story at 375px). The footer
 * button stays `size="sm"` deliberately — every other drawer/dialog
 * footer action in this package's own stories is `size="sm"` too
 * (`overlays.stories.tsx`'s `Drawers`/`PlainDrawer`/`Rotate` examples),
 * and there is no reason for this one story to invent a different
 * desktop convention just because its phone rendering was cramped.
 * `drawer.tsx`'s forced comfortable density already lifts it from 32px
 * to 40px (`ButtonSmallTokens.ContainerHeight`) below `md:`, on its own
 * formula, with no change needed here; only the footer row's own
 * full-width stretch (`drawer.tsx`, same section) needed adding, which
 * this story gets for free without touching the button at all. Desktop
 * — where this story's own convention actually lives — is therefore
 * untouched: still 32px, still right-aligned, byte-identical to before
 * this fix.
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

const COUNTRIES = [
  "Angola",
  "Benin",
  "Botswana",
  "Burkina Faso",
  "Burundi",
  "Cameroon",
  "Cape Verde",
  "Central African Republic",
  "Chad",
  "Comoros",
  "Congo",
  "Côte d’Ivoire",
  "Democratic Republic of the Congo",
  "Djibouti",
  "Equatorial Guinea",
  "Eritrea",
  "Eswatini",
  "Ethiopia",
  "Gabon",
  "Gambia",
  "Ghana",
  "Guinea",
  "Guinea-Bissau",
  "Kenya",
  "Lesotho",
  "Liberia",
  "Madagascar",
  "Malawi",
  "Mali",
  "Mauritania",
];

/**
 * **The phone shape**: below 640px the options are an M3 modal bottom
 * sheet, not a dropdown. Thirty countries, so the sheet reaches its
 * `85dvh` cap and scrolls under a drag handle that stays put.
 *
 * The play function opens it and leaves it open, so what you see is the
 * sheet. Things worth trying by hand:
 *
 * - **Drag the handle down.** Let go before 56px and it springs back on
 *   the spatial spring; past 56px (or with a flick) it dismisses and
 *   focus returns to the trigger, exactly as Escape does.
 * - **Tap the dimmed page.** It closes the sheet and activates nothing
 *   underneath — the page is `inert` while the listbox is open.
 * - **Scroll the list.** The page behind does not move.
 *
 * At 640px and up the same markup is the ordinary dropdown; widen the
 * viewport to see it change back.
 */
export const PhoneBottomSheet: Story = {
  globals: { viewport: { value: "phone" } },
  render: function Render() {
    const [country, setCountry] = useState<string>("Cameroon");
    const [taps, setTaps] = useState(0);
    return (
      <div className="flex w-full max-w-[32rem] flex-col gap-4 p-4">
        {/* Above the sheet's 85dvh on purpose: a real control under the
            scrim, so "a tap on the dimmed page activates nothing" is a
            claim `e2e/select-sheet.spec.ts` can falsify. Tap it while the
            sheet is open — the sheet closes and the count stays put. */}
        <div className="flex items-center gap-3">
          <Button size="sm" variant="secondary" onClick={() => setTaps((n) => n + 1)}>
            Behind the scrim
          </Button>
          <span className="font-mono text-caption text-subtle-foreground">taps: {taps}</span>
        </div>
        <FormField label="Country" htmlFor="sb-country">
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger id="sb-country">
              <SelectValue placeholder="Choose a country" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <p className="font-mono text-caption text-subtle-foreground">value: {country}</p>
        <p className="text-body text-muted-foreground">
          Content behind the sheet. It stays where it is while the list scrolls, and a tap on it
          only closes the sheet.
        </p>
      </div>
    );
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Country" });

    await step("Opening the select opens the sheet", async () => {
      await userEvent.click(trigger);
      await expect(await canvas.findByRole("listbox")).toBeInTheDocument();
    });

    // Geometry only means something in the band the sheet exists for; in
    // the docs page or a wide canvas this is the dropdown, and asserting
    // sheet geometry there would be asserting the wrong component.
    if (window.innerWidth >= 640) return;

    await step("…pinned to the bottom edge, full width, and scrolling", async () => {
      const sheet = canvas.getByRole("listbox");
      const style = getComputedStyle(sheet);
      await expect(style.position).toBe("fixed");
      await expect(style.borderTopLeftRadius).toBe("28px");
      await expect(sheet.scrollHeight).toBeGreaterThan(sheet.clientHeight);
    });
  },
};

/**
 * A short vocabulary on a phone: the sheet is only as tall as its rows,
 * so three options are a small sheet at the bottom edge rather than a
 * tall one with empty space. Open it to see — the current value is the
 * filled, 16px-rounded row; the others are flat.
 */
export const PhoneBottomSheetShortList: Story = {
  globals: { viewport: { value: "phone" } },
  render: () => (
    <div className="flex w-full max-w-[32rem] flex-col gap-4 p-4">
      <FormField label="Priority" htmlFor="sb-priority">
        <Select defaultValue="normal">
          <SelectTrigger id="sb-priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="high">High — page the on-call operator</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Priority" }));
    await expect(await canvas.findByRole("listbox")).toBeInTheDocument();
  },
};

/**
 * A `Select` in the **generic** `Drawer` — which, unlike the two detail
 * drawers, is not `handleOnly`: vaul lets a drag start anywhere in it.
 * At phone width, dragging the select sheet's handle (or scrolling its
 * list) used to drag the drawer underneath as well — a 30px drag moved
 * the drawer 40px and the sheet 60px, and a long one closed the drawer.
 * `SelectContent`'s `data-vaul-no-drag` is what stops that; drag the
 * handle here to see only the sheet move.
 */
export const InsideAPlainDrawer: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button size="sm" variant="secondary">
          Open plain drawer
        </Button>
      </DrawerTrigger>
      <DrawerContent className="gap-4 p-5">
        <DrawerTitle>Filter messages</DrawerTitle>
        <FormField label="Country" htmlFor="plain-drawer-country">
          <Select defaultValue="Cameroon">
            <SelectTrigger id="plain-drawer-country">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </DrawerContent>
    </Drawer>
  ),
};
