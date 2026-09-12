import type { Meta, StoryObj } from "@storybook/react-vite";
import { TimestampDisplay } from "./timestamp-display";

/**
 * Well over 24h old no matter when this story is viewed, so every row
 * renders its absolute form — the point of the `Timezones` story is
 * comparing zones, not chasing the relative/absolute boundary.
 */
const OLD = "2026-01-04T09:12:31Z";

const meta = {
  title: "Data/Timestamps",
  component: TimestampDisplay,
  tags: ["autodocs"],
  args: { value: OLD },
} satisfies Meta<typeof TimestampDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * `timezone` is forwarded to the shared `formatAbsolute`
 * (`../../lib/format-instant`), so `TimestampDisplay` covers the same
 * ground `StateTimeline` does: a whole-hour positive offset, a
 * whole-hour negative offset, and a half-hour offset that a
 * suffix-anchored regex would mis-render as un-padded (`Asia/Kolkata`'s
 * `+05:30`). Defaults to `"UTC"` when omitted.
 */
export const Timezones: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      {(
        [
          ["UTC (default)", undefined],
          ["Africa/Douala — positive, whole hour", "Africa/Douala"],
          ["America/New_York — negative, whole hour (EST here)", "America/New_York"],
          ["Asia/Kolkata — positive, half hour", "Asia/Kolkata"],
        ] as const
      ).map(([label, timezone]) => (
        <div key={label} className="flex items-baseline gap-3">
          <p className="w-64 shrink-0 text-micro text-subtle-foreground">{label}</p>
          <TimestampDisplay value={OLD} timezone={timezone} />
        </div>
      ))}
    </div>
  ),
};

/**
 * Under 24h renders relative (`just now`, `2m`, `47m`, `6h`), older falls
 * back to `formatAbsolute`. The recent row is computed from `Date.now()`
 * at render time rather than a fixed literal — unlike `Timestamps` in
 * `detail.stories.tsx`, which fixes its values specifically so the
 * *value prop itself* never differs between a server and a client render.
 * That hydration hazard doesn't apply to a value computed once inside
 * this story's own `render`, and it is the only way a "recent" example
 * stays recent for as long as this story exists — a fixed literal would
 * drift into the absolute case the moment more than a day passed.
 */
export const RelativeAndAbsolute: Story = {
  render: () => {
    const recent = new Date(Date.now() - 5 * 60_000).toISOString();
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-3">
          <p className="w-64 shrink-0 text-micro text-subtle-foreground">
            5 minutes ago — relative
          </p>
          <TimestampDisplay value={recent} />
        </div>
        <div className="flex items-baseline gap-3">
          <p className="w-64 shrink-0 text-micro text-subtle-foreground">
            2026-01-04 — over 24h, absolute
          </p>
          <TimestampDisplay value={OLD} />
        </div>
      </div>
    );
  },
};
