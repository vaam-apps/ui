import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
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
          "Material 3 Expressive, generated from one seed (`#4f46e5`) for dark (the default) " +
          "and light. Every M3 colour role is a `--md-sys-color-*` custom property; daisyUI's " +
          "theme tokens and this library's own (the surface ladder, the edge and text tiers, " +
          "the focus ring and the eight-hue status palette) are mappings onto those roles, " +
          "re-exposed as utilities through `@theme inline`.",
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
 * The surface ladder is M3's: `surface`, then the container steps, each a
 * few tones apart in the seed's own neutral — close together on purpose, so
 * the page reads as one surface with depth rather than a set of panels.
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
      <Section title="M3 roles components paint with">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Swatch className="bg-primary" name="bg-primary" note="filled controls, the seed" />
          <Swatch
            className="bg-primary-container"
            name="bg-primary-container"
            note="selected rows and pills"
          />
          <Swatch className="bg-inverse-surface" name="bg-inverse-surface" note="plain tooltips" />
          <Swatch className="bg-outline-variant" name="bg-outline-variant" note="= border-edge" />
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
          <Swatch className="bg-ring" name="bg-ring" note="focus — primary, the seed's hue" />
          <Swatch className="bg-ring-subtle" name="bg-ring-subtle" note="selection fill" />
          <Swatch className="bg-destructive" name="bg-destructive" note="delete, revoke" />
        </div>
      </Section>
    </div>
  ),
};

/**
 * Three text tiers, and the reason the dimmest one is not dimmer. The
 * first two are M3's `on-surface` and `on-surface-variant`; M3 has no
 * third, so `--subtle-foreground` is `on-surface-variant` at the dimmest
 * tone that still clears WCAG AA on every surface — the generator searches
 * for it. It used to be a hand-picked `#6b727d` that failed AA everywhere
 * (3.40:1 on a hovered row), at 11–12px in 38 places, and a design system
 * cannot ship text below AA and call the contrast a style choice.
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
          <p className="text-micro">text-micro · label-small 11/16 — enum literals, column heads</p>
          <p className="text-caption">text-caption · body-small 12/16 — captions, metadata</p>
          <p className="text-body">text-body · body-medium 14/20 — the default</p>
          <p className="text-prose">text-prose · body-large 16/24 — form input text</p>
          <p className="text-title-sm">text-title-sm · title-medium 16/24 — card titles</p>
          <p className="text-title">text-title · title-large 22/28</p>
          <p className="text-headline-small">
            text-headline-small · 24/32 — screen and dialog titles
          </p>
          <p className="font-mono text-metric tabular-nums">text-metric · headline-medium 28/36</p>
          <p className="font-mono text-metric-lg tabular-nums">
            text-metric-lg · display-small 36/44
          </p>
          <p className="text-label-large font-bold">
            text-label-large font-bold — an emphasized role: same size, one weight up
          </p>
        </div>
      </Section>
      <Section title="Mono is the voice of data">
        <div className="flex flex-col gap-1 font-mono text-body">
          <span>0123456789 — tabular-nums, so columns align</span>
          <span>O0 Il1 — slashed zero, so an operator can read a cuid at 12px</span>
          <span>cs_msg_8f21c0bd4e1a9f3c77e</span>
        </div>
      </Section>
      {/*
       * Four voices, one line of real copy each, so the pairing can be
       * judged rather than taken on the doc comment's word — see
       * `theme.css`'s own comment on `--font-display` / `--font-sans` /
       * `--font-italic` / `--font-mono` for the roles.
       *
       * The italic line is the exact sentence that comment uses as the
       * worked example: a `StateTimeline` annotation, the one case
       * `--font-italic` exists for. `font-mono`'s line has no companion
       * `italic` utility next to it — the token names a *family*, and
       * mono's family does not shift for emphasis the way the italic
       * voice does.
       */}
      <Section title="Four voices">
        <div className="flex flex-col gap-3">
          <p className="font-display text-title-sm">
            font-display — Payout batch #4128 failed validation
          </p>
          <p className="text-body">font-sans — 212 of 240 messages delivered in the last hour</p>
          <p className="font-italic text-body italic">
            font-italic — sent, but no receipt ever arrived; it will not be resubmitted
          </p>
          <p className="font-mono text-body">font-mono — cs_msg_8f21c0bd4e1a9f3c77e</p>
        </div>
      </Section>
    </div>
  ),
};

const HUES: { hue: StatusHue; means: string }[] = [
  { hue: "neutral", means: "nothing to do — quiet, no fill" },
  { hue: "progress", means: "running, outcome not yet known" },
  { hue: "success", means: "it worked — quiet, no fill" },
  { hue: "warning", means: "recoverable, needs a human" },
  { hue: "danger", means: "it failed" },
  { hue: "uncertain", means: "the outcome is unknown" },
  { hue: "expired", means: "the window closed" },
  { hue: "parked", means: "waiting on someone" },
];

/**
 * Eight status hues, each with a foreground, a fill and a border — M3
 * custom colours harmonized toward the seed, and held at least ΔE2000 13
 * apart (and from `primary`) by `hct-neutrals.test.ts`.
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
 * M3 Expressive's corner scale, as Tailwind's radius steps in order, plus
 * daisyUI's three tiers mapped onto it. A radius larger than half the box
 * is clamped to half, which is why the 16px checkbox takes `rounded-xs`:
 * `rounded-sm` (8px) on it draws a circle — a checkbox indistinguishable
 * from a radio, in a library that ships both.
 */
export const Radius: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      {[
        ["rounded-xs", "extra-small 4px — checkbox, text fields, tooltips"],
        ["rounded-sm", "small 8px — chips, table chrome"],
        ["rounded-md", "medium 12px — cards, menu items"],
        ["rounded-lg", "large 16px — menus, selected list items"],
        ["rounded-xl", "large-increased 20px"],
        ["rounded-2xl", "extra-large 28px — dialogs, sheets"],
        ["rounded-3xl", "extra-large-increased 32px"],
        ["rounded-4xl", "extra-extra-large 48px"],
        ["rounded-full", "full — buttons, nav pills, switches"],
        ["rounded-selector", "daisyUI selector → small"],
        ["rounded-field", "daisyUI field → extra-small"],
        ["rounded-box", "daisyUI box → medium"],
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
 * The motion tokens. Everything that moves or fades is one of M3
 * Expressive's six springs (`SpringTrack` below shows the two spatial
 * ones); the clock-timed tokens are what the springs fall back to without
 * `linear()`, and the timed status wash that holds and decays rather than
 * settles. Every animation has a reduced-motion answer that keeps the
 * signal and drops the movement.
 */
export const Motion: Story = {
  render: () => (
    <div className="flex flex-col gap-2 font-mono text-body">
      {[
        ["--dur-spatial-fast", "360ms", "z 0.6 · k 800 — press morph, switch, small panels"],
        ["--dur-spatial", "435ms", "z 0.8 · k 380 — default spatial"],
        ["--dur-spatial-slow", "599ms", "z 0.8 · k 200"],
        ["--dur-effects-fast", "150ms", "z 1 · k 3800 — colour, state layers"],
        ["--dur-effects", "231ms", "z 1 · k 1600"],
        ["--dur-effects-slow", "327ms", "z 1 · k 800"],
        ["--dur-state", "240ms", "the live-row status wash (timed)"],
      ].map(([token, value, use]) => (
        <div key={token} className="flex flex-wrap items-baseline gap-3">
          <span className="w-44 shrink-0 text-foreground">{token}</span>
          <span className="w-16 shrink-0 text-muted-foreground tabular-nums">{value}</span>
          <span className="min-w-0 truncate text-caption text-subtle-foreground">{use}</span>
        </div>
      ))}
    </div>
  ),
};

/**
 * Track geometry for `SpringTrack` below, in pixels rather than the
 * `VaamSpace`-style rung this package doesn't have — this is a
 * measurement diagram, not layout, and the numbers below are load-bearing
 * to what they demonstrate rather than incidental spacing.
 *
 * `TRAVEL` (240px) is the distance the chip moves. `--ease-spatial-fast`'s
 * own peak overshoot is 9.5% of the step it is applied to (see
 * `theme.css`'s comment on the scheme and `motion-tokens.test.ts`'s
 * `overshootPercent`), so at this travel the chip should visibly pass the
 * guideline by `0.095 * 240 ≈ 22.8px` before settling back — comfortably
 * inside the track's remaining `TRACK_WIDTH - INSET - TRAVEL - CHIP ≈
 * 52px` margin, so the peak never clips. `--ease-spatial`'s 1.5% overshoot
 * (≈3.6px) is real but small enough that it reads as "arrives cleanly"
 * next to the fast curve's visible bounce — which is the whole point of
 * putting them side by side.
 */
const SPRING_TRACK_WIDTH = 320;
const SPRING_CHIP_SIZE = 24;
const SPRING_INSET = 4;
const SPRING_TRAVEL = 240;

function SpringTrack({
  label,
  durationVar,
  easeVar,
  overshoot,
  moved,
  chipTestId,
}: {
  label: string;
  durationVar: string;
  easeVar: string;
  overshoot: string;
  moved: boolean;
  /** Read by `e2e/motion.spec.ts` via `[data-spring-chip="…"]` — a real
   * Chromium render is the only way to measure whether `linear()`
   * actually produces the overshoot the comment claims; nothing in this
   * repo's unit tests can (see that file's own header). */
  chipTestId: string;
}) {
  const restLeft = SPRING_INSET + SPRING_TRAVEL;
  const guidelineLeft = restLeft + SPRING_CHIP_SIZE / 2;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="font-mono text-body text-foreground">{label}</span>
        <span className="text-caption text-subtle-foreground">{overshoot}</span>
      </div>
      <div
        className="relative h-8 rounded-sm border border-edge bg-surface-2"
        style={{ width: SPRING_TRACK_WIDTH }}
      >
        {/* The resting position. Anything the chip clears to the right of
            this line, before coming back to rest on it, is overshoot. */}
        <div
          className="absolute top-0 bottom-0 w-px bg-edge-strong"
          style={{ left: guidelineLeft }}
          aria-hidden="true"
        />
        <div
          data-spring-chip={chipTestId}
          className="absolute top-1/2 rounded-full bg-ring"
          style={{
            left: SPRING_INSET,
            width: SPRING_CHIP_SIZE,
            height: SPRING_CHIP_SIZE,
            transform: `translate(${moved ? SPRING_TRAVEL : 0}px, -50%)`,
            transitionProperty: "transform",
            transitionDuration: `var(${durationVar})`,
            transitionTimingFunction: `var(${easeVar})`,
          }}
        />
      </div>
    </div>
  );
}

/**
 * The M3 Expressive spring tokens, side by side and replayable — the
 * claim `theme.css`'s own comment makes (1.5% vs. 9.5% peak overshoot,
 * "the signature bounce") as something you can watch rather than take on
 * the comment's word. `motion-tokens.test.ts` proves the same numbers
 * against the integrated spring; this story is the render `just`'s own
 * gates cannot check — jsdom has no layout and no CSS transitions, so a
 * unit test can assert the `linear()` stops are correct without ever
 * showing what they look like in motion.
 *
 * Both tracks share one `moved` state so "Replay" starts them together —
 * the comparison is about the *shape* of the two curves over the same
 * distance and the same trigger, not about eyeballing two separately
 * timed clips.
 */
export const Springs: Story = {
  render: () => {
    function SpringsDemo() {
      const [moved, setMoved] = useState(false);
      return (
        <div className="flex flex-col gap-6">
          <button
            type="button"
            onClick={() => setMoved((m) => !m)}
            className="w-fit rounded-field border border-edge bg-surface-2 px-3 py-1.5 text-body text-foreground hover:bg-surface-3"
          >
            Replay
          </button>
          <SpringTrack
            label="--ease-spatial / --dur-spatial"
            overshoot="z 0.8 — 1.5% peak overshoot"
            durationVar="--dur-spatial"
            easeVar="--ease-spatial"
            moved={moved}
            chipTestId="spatial"
          />
          <SpringTrack
            label="--ease-spatial-fast / --dur-spatial-fast"
            overshoot="z 0.6 — 9.5% peak overshoot, two crossings"
            durationVar="--dur-spatial-fast"
            easeVar="--ease-spatial-fast"
            moved={moved}
            chipTestId="spatial-fast"
          />
          <p className="max-w-prose text-caption text-subtle-foreground">
            Watch the chip against its own guideline: the top track settles in cleanly, the bottom
            one visibly passes the line and comes back — the same distance, the same trigger, two
            different damping ratios. An easing and its duration are one unit here; neither track
            borrows the other's timing.
          </p>
        </div>
      );
    }
    return <SpringsDemo />;
  },
};
