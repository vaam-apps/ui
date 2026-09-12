import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "./button";
import { Card, CardBody, CardHeader } from "./card";
import { Input } from "./input";
import { ThemeSwitcher } from "./theme-switcher";

const meta = {
  title: "Primitives/ThemeSwitcher",
  component: ThemeSwitcher,
  tags: ["autodocs"],
  args: {},
  parameters: {
    // Opts every story below out of `.storybook/preview.ts`'s decorator,
    // which otherwise stamps `data-theme` from the toolbar on every
    // story. These stories are specifically about the switcher owning
    // that attribute, so the decorator has to step back deterministically
    // rather than the outcome depending on effect-ordering luck against
    // it — see the decorator's own doc comment for the full precedence
    // rule.
    theme: { ownedByStory: true },
    docs: {
      description: {
        component:
          "Three states — system / light / dark — rather than a two-state toggle, because " +
          "`theme.css`'s `dark` theme carries `prefersdark: true`: this package already has an " +
          "opinion about following the operator's OS setting, and a plain toggle can only ever " +
          "represent an explicit choice. See the component's own doc comment for the full " +
          "reasoning, the SSR/hydration approach, and the blocking `<head>` script " +
          "(`themeInitScript`) a consumer must inline to avoid a one-frame flash of the wrong " +
          "theme on every page load — this Storybook preview cannot demonstrate that part, " +
          "since it is a real browser navigation, not a re-render. In a real app the choice " +
          "persists to `localStorage` so it survives a reload; the switcher below runs with " +
          "that persistence turned off (`persist={false}`) so flipping it in this Storybook " +
          "doesn't write into Storybook's own storage and quietly override the theme toolbar " +
          "the next time this Storybook loads. The document still re-themes live either way — " +
          "only the write to storage is skipped.",
      },
    },
  },
} satisfies Meta<typeof ThemeSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The attribute these stories are about. It lives on `<html>`, outside
 * `canvasElement` entirely — writing `within(canvasElement)` here would
 * find nothing and prove nothing. */
const documentTheme = () => document.documentElement.getAttribute("data-theme");

/**
 * Both play functions below finish on `"dark"` deliberately.
 *
 * `parameters.theme.ownedByStory` stops `.storybook/preview.ts` stamping
 * `data-theme` for these stories, so nothing puts it back afterwards —
 * and `useTheme`'s store is module-level, so a preference left on
 * `"light"` would outlive this story for the rest of the Storybook
 * session. `"dark"` is what `initialGlobals` pins the toolbar to, so
 * ending there leaves the next story exactly where it expects to be.
 *
 * `"system"` is deliberately not the resting state either: it resolves
 * through `matchMedia`, so what it puts in `data-theme` depends on the
 * machine running the story — the one value here that cannot be asserted.
 */
const RESTING_THEME = "dark";

/** The control on its own. Flip it with a mouse or the arrow keys — it is
 * a `RadioGroup` underneath, so it is fully keyboard-operable and shows
 * the global focus ring. Rendered with `persist={false}` — see the
 * meta's `docs.description` above for why.
 *
 * The play function is the claim in the meta description made checkable:
 * clicking a mode re-themes the *document*, not the control. It asserts
 * `document.documentElement`'s `data-theme`, which is the attribute every
 * daisyUI token in the package reads from. */
export const Switcher: Story = {
  render: () => <ThemeSwitcher persist={false} />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const group = within(canvas.getByRole("radiogroup", { name: "Theme" }));
    // The "System" option renders its description inside the
    // `role="radio"` element, so its accessible name is "System Match the
    // OS setting" — hence the anchored regex.
    const system = group.getByRole("radio", { name: /^System/ });
    const light = group.getByRole("radio", { name: "Light" });
    const dark = group.getByRole("radio", { name: "Dark" });

    await step("Three modes, not a two-state toggle", async () => {
      await expect(group.getAllByRole("radio")).toHaveLength(3);
      await expect(system).toBeInTheDocument();
    });

    await step("Choosing Light re-themes the document", async () => {
      await userEvent.click(light);
      await expect(light).toHaveAttribute("aria-checked", "true");
      await waitFor(async () => {
        await expect(documentTheme()).toBe("light");
      });
    });

    await step("…and only one mode is checked while it does", async () => {
      const checked = group
        .getAllByRole("radio")
        .filter((radio) => radio.getAttribute("aria-checked") === "true");
      await expect(checked).toEqual([light]);
    });

    await step("Choosing Dark re-themes it back", async () => {
      await userEvent.click(dark);
      await expect(dark).toHaveAttribute("aria-checked", "true");
      await expect(light).toHaveAttribute("aria-checked", "false");
      await waitFor(async () => {
        await expect(documentTheme()).toBe(RESTING_THEME);
      });
    });
  },
};

/**
 * A small panel of real components — a `Card`, a status-style row, an
 * `Input` — rendered beside the switcher, so flipping the theme visibly
 * re-themes actual surfaces rather than a lone control. Nothing here
 * wires the panel to the switcher explicitly: `ThemeSwitcher` sets
 * `data-theme` on `document.documentElement`, and every daisyUI/token
 * class in the panel reads from that same attribute, exactly as it would
 * in a consuming application. Also rendered with `persist={false}`, same
 * reason as the `Switcher` story above.
 *
 * Its play function takes the other half of the contract: the keyboard.
 * `Switcher` above proves a *click* re-themes the page; this one proves
 * an arrow key does the same thing, which is the part that would quietly
 * rot if `ThemeSwitcher` ever stopped being a `RadioGroup` underneath. It
 * clicks "Dark" first rather than assuming a starting mode — the store is
 * module-level, so whatever ran before this may have left it anywhere.
 */
export const RethemesRealSurfaces: Story = {
  render: () => (
    <div className="flex flex-wrap items-start gap-8">
      <ThemeSwitcher persist={false} />
      <Card className="w-80">
        <CardHeader title="Delivery attempt" meta="att_9f2c1a · direct" />
        <CardBody className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-body text-muted-foreground">Status</span>
            {/* A StatusPill-shaped row without a real state machine: this
                story is about surface/foreground tokens re-theming, not
                about the status vocabulary — `status-pill.stories.tsx`
                already owns that. */}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-surface-2 px-2 py-0.5 text-caption text-foreground">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-state-success-fg" />
              Delivered
            </span>
          </div>
          <label htmlFor="theme-switcher-story-webhook-url" className="flex flex-col gap-1.5">
            <span className="text-caption text-subtle-foreground">Webhook URL</span>
            <Input
              id="theme-switcher-story-webhook-url"
              defaultValue="https://example.com/hooks/delivery"
              readOnly
            />
          </label>
          <Button size="sm" className="self-start">
            Retry
          </Button>
        </CardBody>
      </Card>
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const group = within(canvas.getByRole("radiogroup", { name: "Theme" }));
    const light = group.getByRole("radio", { name: "Light" });
    const dark = group.getByRole("radio", { name: "Dark" });

    await step("Start from a known mode rather than assuming one", async () => {
      await userEvent.click(dark);
      await expect(dark).toHaveFocus();
      await waitFor(async () => {
        await expect(documentTheme()).toBe("dark");
      });
    });

    await step("An arrow key moves to the previous mode, and the page re-themes", async () => {
      await userEvent.keyboard("{ArrowLeft}");
      await expect(light).toHaveAttribute("aria-checked", "true");
      await expect(light).toHaveFocus();
      await waitFor(async () => {
        await expect(documentTheme()).toBe("light");
      });
    });

    await step("…and back, leaving the document on the toolbar's own default", async () => {
      await userEvent.keyboard("{ArrowRight}");
      await expect(dark).toHaveAttribute("aria-checked", "true");
      await waitFor(async () => {
        await expect(documentTheme()).toBe(RESTING_THEME);
      });
    });
  },
};
