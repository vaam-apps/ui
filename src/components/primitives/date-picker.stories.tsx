import * as RadixDialog from "@radix-ui/react-dialog";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { expect, userEvent, within } from "storybook/test";
import { cn } from "../../lib/cn";
import { Button } from "./button";
import { Calendar } from "./calendar";
import {
  DatePicker,
  DatePickerCancel,
  DatePickerClear,
  DatePickerClose,
  DatePickerConfirm,
  DatePickerContent,
  DatePickerDropdown,
  DatePickerModal,
  DatePickerTitle,
  DatePickerTrigger,
  DatePickerValue,
  DateRangePicker,
  type IsoDate,
  type IsoDateRange,
} from "./date-picker";
import {
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { MoreDetailDrawer } from "./drawer";
import { FormField } from "./form-field";

const meta = {
  title: "Primitives/Date pickers",
  component: DatePicker,
  tags: ["autodocs"],
  args: { value: undefined, onValueChange: () => undefined, children: null },
  parameters: {
    docs: {
      description: {
        component:
          "A compound picker, like `Select`: `DatePicker` (or `DateRangePicker`) owns the value, " +
          "and the trigger, its value, the clear button and the picker itself are parts nested " +
          "inside. M3's date picker: docked under the field from 640px up, M3's modal (a date) " +
          "or full-screen picker (a range) below. A pick is staged — Cancel throws it away, OK " +
          "(or Save) commits it — at every width. Values cross the boundary as `YYYY-MM-DD` " +
          "strings, never `Date` objects: a `Date` is an instant, and an instant rendered in " +
          "another zone is a different calendar day.",
      },
    },
  },
} satisfies Meta<typeof DatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

const body = () => within(document.body);

/** Opens the picker the story renders, for the stories that show it open. */
const openPicker =
  (name: RegExp | string): NonNullable<Story["play"]> =>
  async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name }));
    await expect(await body().findByRole("dialog")).toBeVisible();
  };

function SingleField({
  presentation = "content",
}: {
  presentation?: "content" | "dropdown" | "modal";
}) {
  const [value, setValue] = useState<IsoDate | undefined>("2026-09-11");
  const Container =
    presentation === "dropdown"
      ? DatePickerDropdown
      : presentation === "modal"
        ? DatePickerModal
        : DatePickerContent;
  return (
    <div className="flex w-full max-w-72 flex-col gap-2 p-4">
      <FormField label="Send on" htmlFor={`sb-date-${presentation}`}>
        <DatePicker value={value} onValueChange={setValue}>
          <DatePickerTrigger id={`sb-date-${presentation}`}>
            <DatePickerValue placeholder="Pick a date" />
            <DatePickerClear />
          </DatePickerTrigger>
          <Container />
        </DatePicker>
      </FormField>
      <p className="font-mono text-caption text-subtle-foreground">value: {value ?? "—"}</p>
    </div>
  );
}

/**
 * The default: `DatePickerContent`, docked under the field from 640px up.
 * Tapping a day only moves the pick; OK commits it and Cancel, Escape or a
 * press outside throws it away. The clear button empties the value at once.
 */
export const Single: Story = {
  render: () => <SingleField />,
};

/** The same picker opened on a desktop: docked, with no header. */
export const SingleDocked: Story = {
  globals: { viewport: { value: "desktop" } },
  render: () => <SingleField />,
  play: openPicker("Send on"),
};

/** The same picker on a phone: M3's modal date picker — 360dp wide,
 * centred over a scrim, a 120dp header with the pick as its headline. */
export const SingleOnAPhone: Story = {
  globals: { viewport: { value: "phone" } },
  render: () => <SingleField />,
  play: openPicker("Send on"),
};

/** `DatePickerDropdown`: docked at every width, phones included — the
 * opt-out for a picker inline in a dense row. */
export const DropdownOnAPhone: Story = {
  globals: { viewport: { value: "phone" } },
  render: () => <SingleField presentation="dropdown" />,
  play: openPicker("Send on"),
};

/** `DatePickerModal`: M3's modal at every width — here on a desktop,
 * centred over a scrim. */
export const ModalOnADesktop: Story = {
  globals: { viewport: { value: "desktop" } },
  render: () => <SingleField presentation="modal" />,
  play: openPicker("Send on"),
};

function RangeField() {
  const [value, setValue] = useState<IsoDateRange | undefined>({
    from: "2026-09-03",
    to: "2026-09-14",
  });
  return (
    <div className="flex w-full max-w-80 flex-col gap-2 p-4">
      <FormField label="Created between" htmlFor="sb-range">
        <DateRangePicker value={value} onValueChange={setValue}>
          <DatePickerTrigger id="sb-range">
            <DatePickerValue placeholder="Any time" />
            <DatePickerClear />
          </DatePickerTrigger>
          <DatePickerContent />
        </DateRangePicker>
      </FormField>
      <p className="font-mono text-caption text-subtle-foreground">
        value: {value === undefined ? "—" : `${value.from ?? "…"} → ${value.to ?? "…"}`}
      </p>
    </div>
  );
}

/**
 * A range, docked from 640px up: two months, side by side from 768px (and
 * stacked between), so "last 30 days" needs no navigating. A half-finished
 * range (a start, no end) is a value, and Save is enabled for it.
 */
export const Range: Story = {
  globals: { viewport: { value: "desktop" } },
  render: () => <RangeField />,
  play: openPicker("Created between"),
};

/**
 * The same range on a phone: M3's full-screen range picker. A close icon
 * and Save in a 64dp bar, the range as the headline, and the months
 * stacked — scroll through them rather than paging.
 */
export const RangeOnAPhone: Story = {
  globals: { viewport: { value: "phone" } },
  render: () => <RangeField />,
  play: openPicker("Created between"),
};

/**
 * The full-screen picker's chrome, relabelled: `DatePickerClose` renames
 * the bar's close icon, and `DatePickerTitle` and `DatePickerConfirm` the
 * header and Save — say, for a reporting filter.
 */
export const RangeRelabelledOnAPhone: Story = {
  globals: { viewport: { value: "phone" } },
  render: function Render() {
    const [value, setValue] = useState<IsoDateRange | undefined>({
      from: "2026-09-03",
      to: "2026-09-14",
    });
    return (
      <div className="w-full max-w-80 p-4">
        <DateRangePicker value={value} onValueChange={setValue}>
          <DatePickerTrigger aria-label="Reporting period">
            <DatePickerValue placeholder="Any time" />
          </DatePickerTrigger>
          <DatePickerContent>
            <DatePickerTitle>Reporting period</DatePickerTitle>
            <DatePickerClose aria-label="Discard the period" />
            <DatePickerConfirm>Apply</DatePickerConfirm>
          </DatePickerContent>
        </DateRangePicker>
      </div>
    );
  },
  play: openPicker("Reporting period"),
};

/**
 * A range bounded more than a year before today, on a phone: the stacked
 * list is the twelve months up to `max`, and it opens on `max`'s month,
 * not twelve months earlier. `max` is mid-month, so a test can also put
 * today in that month but past `max`, in the list and not selectable.
 */
export const RangeBoundedInThePastOnAPhone: Story = {
  globals: { viewport: { value: "phone" } },
  render: function Render() {
    const [value, setValue] = useState<IsoDateRange | undefined>();
    return (
      <div className="w-full max-w-80 p-4">
        <DateRangePicker value={value} onValueChange={setValue} max="2024-12-15">
          <DatePickerTrigger aria-label="Archived between">
            <DatePickerValue placeholder="Any time before 2025" />
          </DatePickerTrigger>
          <DatePickerContent />
        </DateRangePicker>
      </div>
    );
  },
  play: openPicker("Archived between"),
};

/** `min`/`max` bound navigation and disable every day outside them. */
export const Bounded: Story = {
  render: function Render() {
    const [value, setValue] = useState<IsoDate | undefined>();
    return (
      <div className="w-full max-w-72 p-4">
        <DatePicker value={value} onValueChange={setValue} min="2026-09-08" max="2026-09-24">
          <DatePickerTrigger aria-label="A weekday this month">
            <DatePickerValue placeholder="Between the 8th and the 24th" />
          </DatePickerTrigger>
          <DatePickerContent />
        </DatePicker>
      </div>
    );
  },
};

/**
 * The chrome, relabelled: `DatePickerTitle`, `DatePickerCancel` and
 * `DatePickerConfirm` written among the container's children replace the
 * defaults ("Select date", "Cancel", "OK"). No clear button: a date this
 * form requires.
 */
export const Relabelled: Story = {
  globals: { viewport: { value: "desktop" } },
  render: function Render() {
    const [value, setValue] = useState<IsoDate | undefined>("2026-09-11");
    return (
      <div className="w-full max-w-72 p-4">
        <FormField label="Go live" htmlFor="sb-go-live">
          <DatePicker value={value} onValueChange={setValue}>
            <DatePickerTrigger id="sb-go-live">
              <DatePickerValue />
            </DatePickerTrigger>
            <DatePickerModal>
              <DatePickerTitle>Go-live date</DatePickerTitle>
              <DatePickerCancel>Keep current</DatePickerCancel>
              <DatePickerConfirm>Schedule</DatePickerConfirm>
            </DatePickerModal>
          </DatePicker>
        </FormField>
      </div>
    );
  },
  play: openPicker("Go live"),
};

/**
 * **Inside a drawer.** Date pickers in a `MoreDetailDrawer`'s body — the
 * same place `Select` had to stop portalling. The previous picker's
 * calendar was portalled out of the drawer, where vaul left it
 * `pointer-events: none`: no day could be clicked. These render inline:
 * pick a date and press OK, and Escape closes the picker alone. The drawer
 * is a containing block for `position: fixed` (vaul's `will-change`), so
 * the phone's modal and full-screen range picker, and `DatePickerModal`
 * here on a desktop, still have to reach the whole window.
 */
export const InsideADrawer: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState<IsoDate | undefined>();
    const [retry, setRetry] = useState<IsoDateRange | undefined>();
    const [goLive, setGoLive] = useState<IsoDate | undefined>();
    return (
      <div className="flex flex-col items-start gap-3 p-4">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          Open drawer
        </Button>
        <p className="font-mono text-caption text-subtle-foreground">value: {value ?? "—"}</p>
        <MoreDetailDrawer
          open={open}
          onOpenChange={setOpen}
          title="Reschedule the broadcast"
          description="Pick the day it goes out."
        >
          <div className="flex flex-col gap-4">
            <FormField label="Send on" htmlFor="drawer-send-on">
              <DatePicker value={value} onValueChange={setValue}>
                <DatePickerTrigger id="drawer-send-on">
                  <DatePickerValue placeholder="Pick a date" />
                </DatePickerTrigger>
                <DatePickerContent />
              </DatePicker>
            </FormField>
            <FormField label="Retry between" htmlFor="drawer-retry">
              <DateRangePicker value={retry} onValueChange={setRetry}>
                <DatePickerTrigger id="drawer-retry">
                  <DatePickerValue placeholder="Any time" />
                </DatePickerTrigger>
                <DatePickerContent />
              </DateRangePicker>
            </FormField>
            <FormField label="Go live" htmlFor="drawer-go-live">
              <DatePicker value={goLive} onValueChange={setGoLive}>
                <DatePickerTrigger id="drawer-go-live">
                  <DatePickerValue placeholder="Pick a date" />
                </DatePickerTrigger>
                <DatePickerModal />
              </DatePicker>
            </FormField>
          </div>
        </MoreDetailDrawer>
      </div>
    );
  },
};

/**
 * **Inside a `Dialog`.** A press outside the picker is spent on closing
 * it: here it closes the picker and leaves the dialog, and the form in it,
 * open. The first cut closed both — Headless UI's dialog judged the same
 * press as its own outside click.
 */
export const InsideADialog: Story = {
  globals: { viewport: { value: "desktop" } },
  render: function Render() {
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState<IsoDate | undefined>();
    return (
      <div className="flex flex-col items-start gap-3 p-4">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          Open dialog
        </Button>
        <p className="font-mono text-caption text-subtle-foreground">value: {value ?? "—"}</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule the export</DialogTitle>
            </DialogHeader>
            <FormField label="Export on" htmlFor="dialog-export-on">
              <DatePicker value={value} onValueChange={setValue}>
                <DatePickerTrigger id="dialog-export-on">
                  <DatePickerValue placeholder="Pick a date" />
                </DatePickerTrigger>
                <DatePickerContent />
              </DatePicker>
            </FormField>
            <DialogActions>
              <DialogClose as={Button} variant="ghost">
                Done
              </DialogClose>
            </DialogActions>
          </DialogContent>
        </Dialog>
      </div>
    );
  },
};

function RadixDialogField({ wrapped }: { wrapped: boolean }) {
  const [value, setValue] = useState<IsoDate | undefined>();
  const content = (
    <RadixDialog.Content
      aria-describedby={undefined}
      className={cn(
        "z-40 mx-auto flex max-w-md flex-col gap-4 rounded-sheet bg-surface-2 p-6",
        wrapped ? "relative my-24 w-[calc(100%-2rem)]" : "fixed inset-x-4 top-24",
      )}
    >
      <RadixDialog.Title className="font-medium text-title">Pick a cut-off</RadixDialog.Title>
      <FormField label="Cut-off" htmlFor={wrapped ? "radix-wrapped-cut-off" : "radix-cut-off"}>
        <DatePicker value={value} onValueChange={setValue}>
          <DatePickerTrigger id={wrapped ? "radix-wrapped-cut-off" : "radix-cut-off"}>
            <DatePickerValue placeholder="Pick a date" />
          </DatePickerTrigger>
          <DatePickerContent />
        </DatePicker>
      </FormField>
    </RadixDialog.Content>
  );
  return (
    <div className="flex flex-col items-start gap-3 p-4">
      <RadixDialog.Root>
        <RadixDialog.Trigger asChild>
          <Button variant="secondary" size="sm">
            Open Radix dialog
          </Button>
        </RadixDialog.Trigger>
        <p className="font-mono text-caption text-subtle-foreground">value: {value ?? "—"}</p>
        <RadixDialog.Portal>
          {wrapped ? (
            <RadixDialog.Overlay className="fixed inset-0 z-40 overflow-y-auto bg-[var(--scrim)]">
              {content}
            </RadixDialog.Overlay>
          ) : (
            <>
              <RadixDialog.Overlay className="fixed inset-0 z-40 bg-[var(--scrim)]" />
              {content}
            </>
          )}
        </RadixDialog.Portal>
      </RadixDialog.Root>
    </div>
  );
}

/**
 * **Inside a consumer's own Radix dialog** — not this library's `Dialog`
 * or `Drawer`. A press outside the picker closes it and leaves the dialog
 * open, and so does the click after it: Radix defers an outside dismissal
 * to the click, and a click hidden from it left the dismissal armed for
 * the next one.
 */
export const InsideARadixDialog: Story = {
  globals: { viewport: { value: "desktop" } },
  render: () => <RadixDialogField wrapped={false} />,
};

/**
 * The same, with the overlay wrapping the content — Radix's own
 * "scrollable overlay" layout. The overlay is then the picker's ancestor,
 * so it is not made inert and takes the press itself, and Radix never
 * counts a press on it as intercepted.
 */
export const InsideAScrollableRadixDialog: Story = {
  globals: { viewport: { value: "desktop" } },
  render: () => <RadixDialogField wrapped />,
};

/**
 * Anything else written in the container renders once, between the
 * calendar and the actions, and keeps its own place in the tab order —
 * here a time and a "Now" shortcut.
 */
export const WithExtraContent: Story = {
  globals: { viewport: { value: "desktop" } },
  render: function Render() {
    const [value, setValue] = useState<IsoDate | undefined>("2026-09-11");
    return (
      <div className="w-full max-w-72 p-4">
        <FormField label="Send at" htmlFor="sb-send-at">
          <DatePicker value={value} onValueChange={setValue}>
            <DatePickerTrigger id="sb-send-at">
              <DatePickerValue />
            </DatePickerTrigger>
            <DatePickerContent>
              <div className="flex items-center gap-2 px-6 pb-2">
                <select aria-label="Time" className="select select-sm w-28">
                  <option>09:00</option>
                  <option>13:00</option>
                  <option>17:00</option>
                </select>
                <Button type="button" variant="ghost" size="sm">
                  Now
                </Button>
              </div>
            </DatePickerContent>
          </DatePicker>
        </FormField>
      </div>
    );
  },
  play: openPicker("Send at"),
};

/**
 * The bare calendar, for a different shell. Controlled on purpose:
 * `Calendar` passes props straight through, so given `selected` with no
 * `onSelect` react-day-picker manages selection itself and silently
 * diverges from its own prop on the first click.
 */
export const BareCalendar: Story = {
  render: function Render() {
    const [selected, setSelected] = useState<Date | undefined>(new Date(2026, 8, 11));
    return (
      <div className="inline-block rounded-md bg-surface-2">
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

/** The range fill: both ends filled, the interior a band that meets with
 * no gap between cells. Controlled, for the reason `BareCalendar` gives. */
export const CalendarRange: Story = {
  render: function Render() {
    const [selected, setSelected] = useState<DateRange | undefined>({
      from: new Date(2026, 8, 3),
      to: new Date(2026, 8, 14),
    });
    return (
      <div className="inline-block rounded-md bg-surface-2">
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={selected}
          onSelect={setSelected}
          defaultMonth={new Date(2026, 8, 1)}
        />
      </div>
    );
  },
};

/**
 * Today, fixed at 8 September 2026 so the story does not move with the
 * clock: M3's ring and label in `Primary` when not picked (left), and the
 * filled pick with its label in `Primary`'s content colour when it is
 * (right) — where a `Primary` label would vanish into the fill.
 */
export const CalendarToday: Story = {
  render: function Render() {
    const today = new Date(2026, 8, 8);
    const [left, setLeft] = useState<Date | undefined>(new Date(2026, 8, 11));
    const [right, setRight] = useState<Date | undefined>(today);
    return (
      <div className="flex flex-wrap gap-4">
        <div data-calendar="today-not-picked" className="inline-block rounded-md bg-surface-2">
          <Calendar
            mode="single"
            today={today}
            selected={left}
            onSelect={setLeft}
            defaultMonth={today}
          />
        </div>
        <div data-calendar="today-picked" className="inline-block rounded-md bg-surface-2">
          <Calendar
            mode="single"
            today={today}
            selected={right}
            onSelect={setRight}
            defaultMonth={today}
          />
        </div>
      </div>
    );
  },
};
