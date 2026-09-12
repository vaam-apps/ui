import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Calendar } from "./calendar";
import { DatePicker, DateRangePicker, type IsoDate, type IsoDateRange } from "./date-picker";

const meta = {
  title: "Primitives/Date pickers",
  component: DatePicker,
  tags: ["autodocs"],
  args: { value: undefined, onValueChange: () => undefined },
  parameters: {
    docs: {
      description: {
        component:
          "`react-day-picker`, themed from this system's own tokens rather than its " +
          "stylesheet — so a colour change here follows, instead of leaving the calendar " +
          "behind. Values cross the boundary as `YYYY-MM-DD` strings, never `Date` objects: " +
          "a `Date` is an instant, and an instant rendered in another zone is a different " +
          'calendar day, which is how a filter for "today" quietly returns yesterday\'s rows.',
      },
    },
  },
} satisfies Meta<typeof DatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Single: Story = {
  render: function Render() {
    const [value, setValue] = useState<IsoDate | undefined>("2026-09-11");
    return (
      <div className="flex w-64 flex-col gap-2">
        <DatePicker value={value} onValueChange={setValue} />
        <p className="font-mono text-caption text-subtle-foreground">
          value: {value ?? "undefined"}
        </p>
      </div>
    );
  },
};

/** Two months side by side, so "last 30 days" is selectable without
 * navigating. The control stays open between the two clicks, and a
 * half-finished range is representable rather than a validation error. */
export const Range: Story = {
  render: function Render() {
    const [value, setValue] = useState<IsoDateRange | undefined>({
      from: "2026-09-03",
      to: "2026-09-14",
    });
    return (
      <div className="flex w-80 flex-col gap-2">
        <DateRangePicker value={value} onValueChange={setValue} />
        <p className="font-mono text-caption text-subtle-foreground">
          value: {value === undefined ? "undefined" : `${value.from ?? "…"} → ${value.to ?? "…"}`}
        </p>
      </div>
    );
  },
};

/** `min`/`max` clamp navigation as well as selection — the chevrons stop
 * rather than letting you wander into a month with nothing selectable. */
export const Bounded: Story = {
  render: function Render() {
    const [value, setValue] = useState<IsoDate | undefined>();
    return (
      <div className="w-64">
        <DatePicker
          value={value}
          onValueChange={setValue}
          min="2026-09-01"
          max="2026-09-30"
          placeholder="A day in September"
        />
      </div>
    );
  },
};

/**
 * The bare calendar, for a different shell.
 *
 * Controlled on purpose. `Calendar` passes props straight through, so
 * react-day-picker's own semantics apply: given `selected` with no
 * `onSelect` it manages selection itself and treats `selected` as an
 * initial value — a component that looks controlled and silently
 * diverges from its own prop on the first click.
 */
export const BareCalendar: Story = {
  render: function Render() {
    const [selected, setSelected] = useState<Date | undefined>(new Date(2026, 8, 11));
    return (
      <div className="inline-block rounded-md border border-edge bg-surface-2">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={setSelected}
          defaultMonth={new Date(2026, 8, 1)}
        />
      </div>
    );
  },
};

/** The range fill: both ends filled and rounded outward, the interior a
 * tinted band that meets with no gap between cells. */
export const CalendarRange: Story = {
  render: () => (
    <div className="inline-block rounded-md border border-edge bg-surface-2">
      <Calendar
        mode="range"
        numberOfMonths={2}
        selected={{ from: new Date(2026, 8, 3), to: new Date(2026, 8, 14) }}
        defaultMonth={new Date(2026, 8, 1)}
      />
    </div>
  ),
};
