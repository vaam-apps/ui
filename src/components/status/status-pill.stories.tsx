import type { Meta, StoryObj } from "@storybook/react-vite";
import { StateMark } from "./state-mark";
import { createStatusPill, StatusPill } from "./status-pill";
import { defineStatusSystem, HUE_CLASSES, type StatusHue, type StatusMeta } from "./status-tokens";

/**
 * A demonstration state machine, not a real one.
 *
 * Deliberately invented for the story rather than imported: the tables
 * that drive a real `StatusPill` belong to the application that owns the
 * state machine, and a component library shipping one would be exactly
 * the coupling this package was split out to remove. Six states, chosen
 * to exercise all three silhouettes, both attention levels and six of
 * the eight hues.
 *
 * `pending` and `running` are both `in-flight` and deliberately do *not*
 * share a hue: nothing is happening to a queued item, whereas a worker is
 * actively holding a running one. That is the distinction `progress`
 * exists for, and the restraint too — an in-flight state where nothing is
 * actually moving is still `neutral`.
 */
const DEMO = defineStatusSystem({
  pending: {
    family: "in-flight",
    silhouette: "circle",
    mark: "pie-1",
    hue: "neutral",
    filled: false,
    attention: "quiet",
    label: "Pending",
    tooltip: "Accepted and validated. Not yet claimed.",
  },
  running: {
    family: "in-flight",
    silhouette: "circle",
    mark: "pie-3",
    hue: "progress",
    filled: false,
    attention: "quiet",
    label: "Running",
    tooltip: "Claimed by a worker and executing now.",
  },
  delivered: {
    family: "terminal",
    silhouette: "circle",
    mark: "check",
    hue: "success",
    filled: true,
    attention: "quiet",
    label: "Delivered",
    tooltip: "Confirmed complete.",
  },
  stalled: {
    family: "unresolved",
    silhouette: "square",
    mark: "pause",
    hue: "warning",
    filled: false,
    attention: "loud",
    label: "Stalled",
    tooltip: "Retryable in principle, but nothing is driving it. Needs a human.",
  },
  unknown: {
    family: "unresolved",
    silhouette: "diamond",
    mark: "question",
    hue: "uncertain",
    filled: false,
    attention: "loud",
    label: "Unknown",
    tooltip: "Sent, but the outcome was never learned. It will not be retried.",
  },
  failed: {
    family: "terminal",
    silhouette: "circle",
    mark: "cross",
    hue: "danger",
    filled: true,
    attention: "loud",
    label: "Failed",
    tooltip: "Permanently failed.",
  },
});

type DemoState = keyof typeof DEMO;
const STATES = Object.keys(DEMO) as DemoState[];
const DemoStatusPill = createStatusPill(DEMO);

const meta = {
  title: "Status/StatusPill",
  component: StatusPill,
  tags: ["autodocs"],
  // `StatusPill`'s `meta` prop is required, so without a default here
  // every `render`-based story below would have to restate it.
  args: { meta: DEMO.delivered, literal: "delivered" },
  parameters: {
    docs: {
      description: {
        component:
          "Glyph + label + attention treatment, driven by a `StatusSystem` you supply. " +
          "`createStatusPill(system)` binds one to a component whose `state` prop accepts " +
          "exactly that machine's literals — pass a state from a different machine and it " +
          "is a compile error.",
      },
    },
  },
} satisfies Meta<typeof StatusPill>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The whole vocabulary at once. This arrangement is the point: a colour
 * that collides with its neighbour, or a glyph that reads the same as
 * another, is obvious here and invisible one pill at a time.
 */
export const EveryState: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      {STATES.map((state) => (
        <DemoStatusPill key={state} state={state} showLiteral />
      ))}
    </div>
  ),
};

/**
 * Quiet states carry the glyph and label only; loud states add a tinted
 * fill and border. A table that is mostly healthy should not become a
 * wall of colour — only the rows that need a human should pull the eye.
 */
export const QuietVersusLoud: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        {STATES.filter((s) => DEMO[s].attention === "quiet").map((s) => (
          <DemoStatusPill key={s} state={s} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {STATES.filter((s) => DEMO[s].attention === "loud").map((s) => (
          <DemoStatusPill key={s} state={s} />
        ))}
      </div>
    </div>
  ),
};

/**
 * The accessibility check worth running by hand: view this story in
 * grayscale. Every state must stay distinguishable, because each differs
 * in silhouette, interior mark and fill as well as hue. Colour alone
 * fails for the ~8% of men with a colour-vision deficiency, and fails
 * completely in a monochrome screenshot pasted into a ticket.
 */
export const Grayscale: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4 grayscale">
      {STATES.map((state) => (
        <DemoStatusPill key={state} state={state} showLiteral />
      ))}
    </div>
  ),
};

/** `pending` is for a transition this client just requested and the server
 * has not yet confirmed — dimmed and dashed, never "we think it's probably
 * this". `interactive` makes the pill a real button. */
export const PendingAndInteractive: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <DemoStatusPill state="running" pending detail="optimistic" showLiteral />
      <DemoStatusPill state="failed" interactive detail="click me" />
      <DemoStatusPill state="delivered" size="md" />
    </div>
  ),
};

/** The raw geometry every pill renders through: silhouette × interior mark
 * × filled-or-stroked, at 16px. */
export const Glyphs: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      {STATES.map((state) => (
        <StateMark key={state} meta={DEMO[state]} size={16} className="text-foreground" />
      ))}
    </div>
  ),
};

const HUES = Object.keys(HUE_CLASSES) as StatusHue[];

/** A glyph that exists only to carry a hue into the matrix below. */
function hueSample(hue: StatusHue, attention: "quiet" | "loud"): StatusMeta {
  return {
    family: "in-flight",
    silhouette: "circle",
    mark: "pie-2",
    hue,
    filled: false,
    attention,
    label: hue,
    tooltip: `The ${hue} hue, ${attention}.`,
  };
}

/**
 * Every hue in both pill treatments, on the page background and on a card.
 *
 * This is the arrangement the contrast numbers in `theme.css` are checked
 * against, and it has to be a *rendered* one: the tokens are authored in
 * hex, so anything that reads the class names — or any helper that assumes
 * the theme is oklch — measures nothing at all and reports success.
 *
 * The loud row is the demanding case. A loud pill paints the hue's own
 * 10%-alpha tint behind its label, so the text is composited over
 * `base-100` or `base-200` rather than sitting on either directly, and a
 * foreground that clears AA on the bare page can still fail on its own
 * fill.
 */
export const EveryHue: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      {(["quiet", "loud"] as const).map((attention) => (
        <div key={attention} className="flex flex-col gap-3">
          <p className="text-caption text-subtle-foreground">{attention}</p>
          <div className="flex flex-wrap items-center gap-4 bg-background p-3">
            {HUES.map((hue) => (
              <StatusPill key={hue} meta={hueSample(hue, attention)} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4 rounded-sm border border-edge bg-surface-1 p-3">
            {HUES.map((hue) => (
              <StatusPill key={hue} meta={hueSample(hue, attention)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  ),
};
