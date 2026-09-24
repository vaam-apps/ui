import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useRef, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "./button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger, MoreDetailDrawer } from "./drawer";
import { FormField } from "./form-field";
import {
  Select,
  SelectClose,
  SelectContent,
  SelectDropdown,
  SelectEmpty,
  SelectGroup,
  SelectItem,
  SelectModal,
  SelectModalHandle,
  SelectSearch,
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
        desktop: {
          name: "Desktop (1280px)",
          styles: { width: "1280px", height: "800px" },
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
          "56px rows with the current value as a filled row. It is the same element restyled " +
          "by a media query — no second component, no viewport read — so it works inside a " +
          "drawer exactly as the dropdown does. The “Phone” stories below open it for you.\n\n" +
          "**It is a compound component.** `Select` owns the value; everything visible is a " +
          "part nested inside it. Add a `SelectSearch` and it becomes searchable — M3's " +
          "full-screen search view on a phone, the docked one on a desktop. Swap " +
          "`SelectContent` for `SelectDropdown` to keep the dropdown on phones, or for " +
          "`SelectModal` to use the sheet everywhere. `SelectClose`, `SelectModalHandle` and " +
          "`SelectEmpty` are public too, with defaults, so most callers never write them.",
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

/** Country names with their ISO codes, for the searchable stories: the code
 * is in `textValue` only, so "CM" finds Cameroon without being shown. */
const COUNTRY_CODES: Record<string, string> = {
  Angola: "AO",
  Benin: "BJ",
  Botswana: "BW",
  "Burkina Faso": "BF",
  Burundi: "BI",
  Cameroon: "CM",
  "Cape Verde": "CV",
  "Central African Republic": "CF",
  Chad: "TD",
  Comoros: "KM",
  Congo: "CG",
  "Côte d’Ivoire": "CI",
  "Democratic Republic of the Congo": "CD",
  Djibouti: "DJ",
  "Equatorial Guinea": "GQ",
  Eritrea: "ER",
  Eswatini: "SZ",
  Ethiopia: "ET",
  Gabon: "GA",
  Gambia: "GM",
  Ghana: "GH",
  Guinea: "GN",
  "Guinea-Bissau": "GW",
  Kenya: "KE",
  Lesotho: "LS",
  Liberia: "LR",
  Madagascar: "MG",
  Malawi: "MW",
  Mali: "ML",
  Mauritania: "MR",
};

function CountryItems() {
  return (
    <>
      {COUNTRIES.map((name) => (
        <SelectItem key={name} value={name} textValue={`${name} ${COUNTRY_CODES[name] ?? ""}`}>
          {name}
        </SelectItem>
      ))}
    </>
  );
}

/**
 * **Searchable, on a phone: M3's full-screen search view.** Adding a
 * `<SelectSearch />` among the container's children is the whole switch —
 * the select becomes a combobox (focus stays in the field while the arrows
 * move through the options) and, below 640px, opens full-screen: a 72px
 * header with the back arrow and the field, the results under it. Full
 * screen rather than a sheet because the on-screen keyboard takes about
 * half the height.
 *
 * Try: type "cote" (accents do not matter) or "CM" (the ISO code, matched
 * through `textValue` but never shown); arrow down and press Enter; tap the
 * back arrow; clear the field with the ✕.
 */
export const SearchablePhone: Story = {
  globals: { viewport: { value: "phone" } },
  render: function Render() {
    const [country, setCountry] = useState<string>("Cameroon");
    return (
      <div className="flex w-full max-w-[32rem] flex-col gap-4 p-4">
        <FormField label="Country" htmlFor="sb-search-country">
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger id="sb-search-country">
              <SelectValue placeholder="Choose a country" />
            </SelectTrigger>
            <SelectContent>
              <SelectSearch placeholder="Search countries" />
              <CountryItems />
            </SelectContent>
          </Select>
        </FormField>
        <p className="font-mono text-caption text-subtle-foreground">value: {country}</p>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Country" }));
    await expect(await canvas.findByRole("combobox")).toHaveFocus();
  },
};

/**
 * **Searchable, on a desktop: M3's docked search view** — the same parts as
 * the phone story, no change at all; from 640px up the popup is a dropdown
 * with the field in a 56px header, and no back arrow (the default one is a
 * phone affordance). Escape, a click outside, or picking an option all close
 * it and put focus back on the trigger.
 */
export const SearchableDesktop: Story = {
  globals: { viewport: { value: "desktop" } },
  render: function Render() {
    const [country, setCountry] = useState<string>();
    return (
      <div className="flex w-full max-w-80 flex-col gap-3 p-4">
        <FormField label="Country" htmlFor="sb-search-country-desk">
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger id="sb-search-country-desk">
              <SelectValue placeholder="Choose a country" />
            </SelectTrigger>
            <SelectContent>
              <SelectSearch placeholder="Search countries" />
              <CountryItems />
            </SelectContent>
          </Select>
        </FormField>
        <p className="font-mono text-caption text-subtle-foreground">value: {country ?? "—"}</p>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Country" }));
    await expect(await canvas.findByRole("combobox")).toHaveFocus();
  },
};

/**
 * **`SelectEmpty`, written by the caller.** Every searchable popup says "No
 * match" on its own when the search empties the list; pass a `SelectEmpty`
 * to say more. It is announced politely (`role="status"`), so a
 * screen-reader user typing hears that the list emptied. The play function
 * types a query nothing matches.
 */
export const SearchWithCustomEmpty: Story = {
  globals: { viewport: { value: "phone" } },
  render: () => (
    <div className="flex w-full max-w-[32rem] flex-col gap-4 p-4">
      <FormField label="Country" htmlFor="sb-search-empty">
        <Select defaultValue="Kenya">
          <SelectTrigger id="sb-search-empty">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectSearch placeholder="Search countries" />
            <CountryItems />
            <SelectEmpty>No country matches — check the spelling, or try its ISO code.</SelectEmpty>
          </SelectContent>
        </Select>
      </FormField>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Country" }));
    await userEvent.type(await canvas.findByRole("combobox"), "atlantis");
    await expect(await canvas.findByRole("status")).toHaveTextContent("No country matches");
  },
};

// Ids, not names, as the values: the trigger has to show the name of an
// option the caller's results no longer include, and a value equal to its
// label cannot tell that apart from showing the raw value.
const PROVIDER_DIRECTORY = [
  { id: "prv_101", name: "Orange Cameroon" },
  { id: "prv_102", name: "MTN Cameroon" },
  { id: "prv_103", name: "Nexttel" },
  { id: "prv_104", name: "Camtel" },
  { id: "prv_105", name: "Airtel Kenya" },
  { id: "prv_106", name: "Safaricom" },
  { id: "prv_107", name: "Vodacom Tanzania" },
  { id: "prv_108", name: "Tigo Ghana" },
  { id: "prv_109", name: "Moov Africa" },
  { id: "prv_110", name: "Glo Nigeria" },
];

/**
 * **The caller filters: `filter={false}` and `onQueryChange`.** For a list
 * the caller fetches per keystroke (a server search), the select must not
 * filter a second time. With `filter={false}` every `SelectItem` rendered
 * is shown, and `SelectEmpty` appears when the caller renders none. Here
 * the "server" is a 300ms timer over a fixed list. Only the latest query's
 * answer is applied — each keystroke cancels the previous request — and
 * nothing is applied after unmount: a real server answers out of order,
 * and a template that let a stale answer overwrite a newer one would be
 * copied with the bug.
 */
export const CallerFilteredSearch: Story = {
  globals: { viewport: { value: "desktop" } },
  render: function Render() {
    const [provider, setProvider] = useState<string>();
    const [results, setResults] = useState(PROVIDER_DIRECTORY);
    const [pending, setPending] = useState(false);
    const request = useRef<number | undefined>(undefined);
    useEffect(() => () => window.clearTimeout(request.current), []);
    function search(query: string) {
      window.clearTimeout(request.current);
      setPending(true);
      request.current = window.setTimeout(() => {
        const q = query.trim().toLowerCase();
        setResults(PROVIDER_DIRECTORY.filter((p) => p.name.toLowerCase().includes(q)));
        setPending(false);
      }, 300);
    }
    return (
      <div className="flex w-full max-w-80 flex-col gap-3 p-4">
        <FormField label="Provider" htmlFor="sb-remote">
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger id="sb-remote">
              <SelectValue placeholder="Search the provider directory" />
            </SelectTrigger>
            <SelectContent>
              <SelectSearch placeholder="Provider name" filter={false} onQueryChange={search} />
              {results.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
              <SelectEmpty>{pending ? "Searching…" : "No provider by that name"}</SelectEmpty>
            </SelectContent>
          </Select>
        </FormField>
      </div>
    );
  },
};

/**
 * **`SelectDropdown`: the phone opt-out.** The same select as the phone
 * sheet stories, but the container is `SelectDropdown`, so even at 375px
 * the options are the anchored dropdown. For the rare select that really is
 * better as a short list in place — most should stay on `SelectContent`.
 */
export const DropdownOnAPhone: Story = {
  globals: { viewport: { value: "phone" } },
  render: () => (
    <div className="flex w-full max-w-[32rem] flex-col gap-4 p-4">
      <FormField label="Sort by" htmlFor="sb-sort">
        <Select defaultValue="newest">
          <SelectTrigger id="sb-sort">
            <SelectValue />
          </SelectTrigger>
          <SelectDropdown>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="status">By status</SelectItem>
          </SelectDropdown>
        </Select>
      </FormField>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Sort by" }));
    await expect(await canvas.findByRole("listbox")).toBeInTheDocument();
  },
};

/**
 * **`SelectModal` on a desktop, with its parts placed by hand.** The sheet
 * at every width — capped at 640px and centred from 640px up, M3's own
 * maximum for a modal bottom sheet. The handle and a "Done" button are
 * written out here to show that they are parts: `SelectModalHandle` is
 * where the caller put it (a sheet renders one on its own otherwise), and
 * `SelectClose` takes any children. In a plain select the close button is
 * a pointer affordance only — keyboard users have Escape.
 */
export const ModalOnADesktop: Story = {
  globals: { viewport: { value: "desktop" } },
  render: () => (
    <div className="flex w-full max-w-80 flex-col gap-4 p-4">
      <FormField label="Retry policy" htmlFor="sb-retry">
        <Select defaultValue="exponential">
          <SelectTrigger id="sb-retry">
            <SelectValue />
          </SelectTrigger>
          <SelectModal>
            <SelectModalHandle />
            <SelectItem value="none">Never retry</SelectItem>
            <SelectItem value="linear">Every 5 minutes, 6 times</SelectItem>
            <SelectItem value="exponential">Exponential backoff, up to 24 hours</SelectItem>
            <div className="flex justify-end px-2 pt-2">
              <SelectClose className="px-4 py-2 text-prose font-medium">Done</SelectClose>
            </div>
          </SelectModal>
        </Select>
      </FormField>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Retry policy" }));
    await expect(await canvas.findByRole("listbox")).toBeInTheDocument();
  },
};

/**
 * **Searchable, inside a drawer, on a phone.** The full-screen view opens
 * over the drawer's own sheet; Escape, the back arrow, or picking a country
 * closes the search alone, focus returns to the trigger, and only the next
 * Escape closes the drawer.
 */
export const SearchableInsideADrawer: Story = {
  globals: { viewport: { value: "phone" } },
  render: function Render() {
    const [open, setOpen] = useState(false);
    const [country, setCountry] = useState<string>();
    return (
      <>
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          Open drawer
        </Button>
        <MoreDetailDrawer
          open={open}
          onOpenChange={setOpen}
          title="Sender ID country"
          description="Where the sender ID will be registered."
          footer={
            <Button size="sm" disabled={country === undefined}>
              Save
            </Button>
          }
        >
          <FormField label="Country" htmlFor="drawer-search-country">
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger id="drawer-search-country">
                <SelectValue placeholder="Choose a country" />
              </SelectTrigger>
              <SelectContent>
                <SelectSearch placeholder="Search countries" />
                <CountryItems />
              </SelectContent>
            </Select>
          </FormField>
        </MoreDetailDrawer>
      </>
    );
  },
};

/**
 * **Searchable, inside a `Dialog`, where picking closes the dialog.** The
 * regression this story exists for: the combobox engine's own modality
 * used to snapshot the page state the dialog had already set and write it
 * back on close — and when a pick closed the select *and* the dialog in
 * one commit, the page was left `inert` and unscrollable until a reload.
 * Pick a country: the dialog closes and "Open dialog" must still work.
 *
 * It also carries an option whose value is `""` ("Any country" — pickable,
 * as it is in a plain select), and a "Done" written inside the list: there
 * it is a pointer-only affordance (`aria-hidden`), because a listbox may own
 * options only.
 *
 * From `sm` up both selects here are dropdowns, and the dialog is far
 * shorter than either: they used to be clipped to one row by the dialog's
 * scrolling body. Now they float over it, under the trigger — or above it,
 * on a window too short to fit one below.
 */
export const SearchableInADialog: Story = {
  globals: { viewport: { value: "desktop" } },
  render: function Render() {
    const [open, setOpen] = useState(false);
    const [country, setCountry] = useState<string>();
    return (
      <div className="flex flex-col items-start gap-3 p-4">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          Open dialog
        </Button>
        <p className="font-mono text-caption text-subtle-foreground">
          value: {country === undefined ? "—" : country === "" ? "(any)" : country}
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Choose where to send from</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <FormField label="Country" htmlFor="dialog-search-country">
                <Select
                  value={country}
                  onValueChange={(next) => {
                    setCountry(next);
                    setOpen(false);
                  }}
                >
                  <SelectTrigger id="dialog-search-country">
                    <SelectValue placeholder="Choose a country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectSearch placeholder="Search countries" />
                    <SelectItem value="">Any country</SelectItem>
                    <CountryItems />
                    <div className="flex justify-end px-2 pt-2">
                      <SelectClose className="px-4 py-2 font-medium text-prose">Done</SelectClose>
                    </div>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Channel" htmlFor="dialog-channel">
                <Select defaultValue="sms">
                  <SelectTrigger id="dialog-channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="voice">Voice call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="push">Push notification</SelectItem>
                    <SelectItem value="ussd">USSD</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  },
};

/**
 * **Searchable `SelectModal` on a desktop**: M3's full-screen search view,
 * but from 640px up it stops at the sheet's own 640px, centred, with the
 * sheet's 28px top corners and scrim — the same footprint as a plain
 * `SelectModal` rather than a blanked-out screen (a maintainer's call).
 * Below 640px it is full-screen, like `SelectContent`'s phone view.
 */
export const SearchableModalOnADesktop: Story = {
  globals: { viewport: { value: "desktop" } },
  render: () => (
    <div className="flex w-full max-w-80 flex-col gap-4 p-4">
      <FormField label="Country" htmlFor="sb-search-modal">
        <Select defaultValue="Kenya">
          <SelectTrigger id="sb-search-modal">
            <SelectValue />
          </SelectTrigger>
          <SelectModal>
            <SelectSearch placeholder="Search countries" />
            <CountryItems />
          </SelectModal>
        </Select>
      </FormField>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Country" }));
    await expect(await canvas.findByRole("combobox")).toHaveFocus();
  },
};
