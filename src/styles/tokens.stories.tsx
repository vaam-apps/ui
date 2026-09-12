import type { Meta, StoryObj } from "@storybook/react-vite";
import { HUE_CLASSES, type StatusHue } from "../components/status/status-tokens";

/**
 * The token layer, rendered.
 *
 * Every class string below is a literal, never a template — Tailwind
 * scans source text statically and generates nothing for
 * `` `bg-${name}` ``, so an interpolated palette page is a page of
 * transparent boxes. That failure has already happened twice in this
 * stylesheet's own history (`--color-surface-1`/`--color-surface-2` went
 * undeclared for months, and every dialog and popover rendered with no
 * background at all), which is the reason this page exists: a token you
 * can see is a token you notice is missing.
 */
const meta = {
  title: "Foundations/Tokens",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "One dark theme, registered under daisyUI's own `dark` name. Everything daisyUI " +
          "has no vocabulary for — the fourth surface step, the three-tier edge and text " +
          "ladders, the focus ring, and the seven-hue status palette — lives beside it as " +
          "plain custom properties, re-exposed as utilities through `@theme inline`.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function Swatch({ className, name, note }: { className: string; name: string; note?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className={`size-10 shrink-0 rounded-sm border border-edge ${className}`} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-mono text-caption text-foreground">{name}</span>
        {note != null && (
          <span className="truncate text-caption text-subtle-foreground">{note}</span>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <h2 className="font-medium text-foreground text-title-sm">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Four surface steps and three edge tiers. The surfaces are close
 * together on purpose — this is a near-black theme, and a ladder with big
 * jumps between steps reads as a set of unrelated panels rather than one
 * page with depth.
 */
export const Surfaces: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <Section title="Surfaces">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Swatch className="bg-background" name="bg-background" note="the page — base-100" />
          <Swatch className="bg-surface-1" name="bg-surface-1" note="panels — base-200" />
          <Swatch className="bg-surface-2" name="bg-surface-2" note="cards, floating — base-300" />
          <Swatch className="bg-surface-3" name="bg-surface-3" note="hover, pressed, selected" />
        </div>
      </Section>
      <Section title="Edges">
        <div className="grid gap-4 sm:grid-cols-3">
          <Swatch className="bg-edge-subtle" name="border-edge-subtle" note="row dividers" />
          <Swatch className="bg-edge" name="border-edge" note="cards, panels, inputs" />
          <Swatch className="bg-edge-strong" name="border-edge-strong" note="controls, dashes" />
        </div>
      </Section>
      <Section title="Selection and destruction">
        <div className="grid gap-4 sm:grid-cols-3">
          <Swatch className="bg-ring" name="bg-ring" note="focus, selection — the only blue" />
          <Swatch className="bg-ring-subtle" name="bg-ring-subtle" note="selection fill" />
          <Swatch className="bg-destructive" name="bg-destructive" note="delete, revoke" />
        </div>
      </Section>
    </div>
  ),
};

/**
 * Three text tiers, and the reason the dimmest one is not dimmer.
 * `--subtle-foreground` used to be `#6b727d`, which failed WCAG AA on
 * every surface in the system — 4.06:1 on the page, 3.40:1 on a hovered
 * row. It is used in 38 places, all at 11px or 12px, so the normal-text
 * bar is the right one. The current value is the *minimum* that clears
 * AA on the worst case, which does compress the ladder — and a design
 * system cannot ship text below AA and call the contrast a style choice.
 */
export const Text: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <Section title="Text tiers">
        <div className="flex flex-col gap-2">
          <p className="text-body text-foreground">
            text-foreground — values, headings, the answer
          </p>
          <p className="text-body text-muted-foreground">
            text-muted-foreground — labels, secondary copy
          </p>
          <p className="text-body text-subtle-foreground">
            text-subtle-foreground — timestamps, captions, metadata
          </p>
        </div>
      </Section>
      <Section title="Type scale">
        <div className="flex flex-col gap-3">
          <p className="text-micro">text-micro · 11px — enum literals, table column heads</p>
          <p className="text-caption">text-caption · 12px — captions, metadata</p>
          <p className="text-body">text-body · 13px — the default</p>
          <p className="text-prose">text-prose · 14px — form controls, dialog copy</p>
          <p className="text-title-sm">text-title-sm · 16px — card and drawer titles</p>
          <p className="text-title">text-title · 20px — the screen h1</p>
          <p className="font-mono text-metric tabular-nums">text-metric · 28px</p>
          <p className="font-mono text-metric-lg tabular-nums">text-metric-lg · 40px</p>
        </div>
      </Section>
      <Section title="Mono is the voice of data">
        <div className="flex flex-col gap-1 font-mono text-body">
          <span>0123456789 — tabular-nums, so columns align</span>
          <span>O0 Il1 — slashed zero, so an operator can read a cuid at 12px</span>
          <span>cs_msg_8f21c0bd4e1a9f3c77e</span>
        </div>
      </Section>
    </div>
  ),
};

const HUES: { hue: StatusHue; means: string }[] = [
  { hue: "neutral", means: "nothing to do — quiet, no fill" },
  { hue: "success", means: "it worked — quiet, no fill" },
  { hue: "warning", means: "recoverable, needs a human" },
  { hue: "danger", means: "it failed" },
  { hue: "uncertain", means: "the outcome is unknown" },
  { hue: "expired", means: "the window closed" },
  { hue: "parked", means: "waiting on someone" },
];

/**
 * Seven status hues, each with a foreground, a fill and a border.
 *
 * Two of them — `neutral` and `success` — declare `transparent` for the
 * fill and the border, and that is deliberate: they are the *quiet*
 * hues, so a delivered pill is a glyph and a word rather than a green
 * box, and a screen where most rows succeeded stays calm. It is also a
 * trap worth seeing here, because `RadioGroup` and `ChipSelect` both
 * borrowed the success trio for their selected state and rendered it
 * with no fill and no outline at all.
 *
 * `warning` and `uncertain` are kept visibly apart even though both read
 * as "attention": `uncertain` means the outcome is unknown, `warning`
 * means a recoverable condition needs a human. The first value tried for
 * `warning` was ΔE 13 from `uncertain` — the same colour, for practical
 * purposes, inside a 14px glyph.
 */
export const StatusHues: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {HUES.map(({ hue, means }) => {
        const classes = HUE_CLASSES[hue];
        return (
          <div key={hue} className="flex min-w-0 flex-wrap items-center gap-3">
            <span
              className={`inline-flex w-28 shrink-0 items-center gap-2 font-mono text-caption ${classes.fg}`}
            >
              <span className="size-3 rounded-full bg-current" />
              {hue}
            </span>
            <span
              className={`rounded-sm border px-2 py-0.5 text-caption ${classes.bg} ${classes.border} ${classes.fg}`}
            >
              loud treatment
            </span>
            <span className="min-w-0 truncate text-caption text-subtle-foreground">{means}</span>
          </div>
        );
      })}
    </div>
  ),
};

/**
 * A four-step radius register, each step visibly distinct from its
 * neighbour. `--radius-xs` is the newest and exists because of a fact
 * about how `border-radius` resolves rather than a change of taste: a
 * radius larger than half the box is clamped to half, so
 * `--radius-selector` (8px) on the 16px checkbox every form renders
 * produced a perfect circle — a checkbox indistinguishable from a radio,
 * in a library that ships both.
 */
export const Radius: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      {[
        ["rounded-xs", "4px — checkbox, the smallest box"],
        ["rounded-selector", "8px — badges, small controls"],
        ["rounded-field", "12px — buttons, inputs, nav rows"],
        ["rounded-box", "20px — cards, drawers, toasts"],
        ["rounded-full", "pill — switches, avatars"],
      ].map(([cls, note]) => (
        <div key={cls} className="flex w-40 flex-col gap-2">
          <div className={`h-16 w-full border border-edge-strong bg-surface-2 ${cls}`} />
          <span className="font-mono text-caption text-foreground">{cls}</span>
          <span className="text-caption text-subtle-foreground">{note}</span>
        </div>
      ))}
    </div>
  ),
};

/**
 * The motion tokens, as durations you can watch. Nothing in this system
 * is slower than `--dur-enter`, and the two rules around them are: an
 * in-place state change never moves anything, and every animation has a
 * reduced-motion answer that keeps the signal and drops the movement.
 */
export const Motion: Story = {
  render: () => (
    <div className="flex flex-col gap-2 font-mono text-body">
      {[
        ["--dur-instant", "90ms", "row hover, press"],
        ["--dur-fast", "150ms", "popover, dialog enter"],
        ["--dur-state", "240ms", "the live-row status wash"],
        ["--dur-enter", "400ms", "the slowest thing here"],
      ].map(([token, value, use]) => (
        <div key={token} className="flex flex-wrap items-baseline gap-3">
          <span className="w-40 shrink-0 text-foreground">{token}</span>
          <span className="w-16 shrink-0 text-muted-foreground tabular-nums">{value}</span>
          <span className="min-w-0 truncate text-caption text-subtle-foreground">{use}</span>
        </div>
      ))}
    </div>
  ),
};
