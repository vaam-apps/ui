import type { Meta, StoryObj } from "@storybook/react-vite";
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

/** The control on its own. Flip it with a mouse or the arrow keys — it is
 * a `RadioGroup` underneath, so it is fully keyboard-operable and shows
 * the global focus ring. Rendered with `persist={false}` — see the
 * meta's `docs.description` above for why. */
export const Switcher: Story = {
  render: () => <ThemeSwitcher persist={false} />,
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
};
