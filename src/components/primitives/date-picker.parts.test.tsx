// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  DatePicker,
  DatePickerClose,
  DatePickerContent,
  DatePickerTrigger,
  DatePickerValue,
  DateRangePicker,
  type IsoDate,
  type IsoDateRange,
} from "./date-picker";

/**
 * What the picker commits, and which months it offers — the logic under
 * the render, found wrong in review and pinned here, where no layout is
 * needed. jsdom has no CSS, so both of a range picker's trees are in the
 * document and "visible": each query below says which one it reads.
 * Geometry, focus and dismissal are in `e2e/date-picker.spec.ts`.
 */

// Floating UI's `autoUpdate` observes the trigger with a `ResizeObserver`
// jsdom does not have; nothing here depends on a size.
const REAL_RO = globalThis.ResizeObserver;
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterAll(() => {
  globalThis.ResizeObserver = REAL_RO;
});

/**
 * A range picker renders both its trees in jsdom — 27 month grids — on
 * every open and every tap, and CI's runner does that about 3.4× slower
 * than a workstation (measured: one open, tap and Save cycle 658ms locally,
 * 2254ms in CI). A test with two cycles hit vitest's 5s default there, so
 * the range tests get this instead, and none runs more than one cycle.
 */
const RANGE_TIMEOUT = 15_000;

let mounted: { root: Root; host: HTMLElement } | undefined;

async function unmount() {
  if (mounted === undefined) return;
  const { root, host } = mounted;
  await act(async () => {
    root.unmount();
  });
  host.remove();
  mounted = undefined;
}

/** Mounts `node` as the only thing in the document, replacing the last. */
async function mount(node: ReactNode) {
  await unmount();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("main");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(node);
  });
  mounted = { root, host };
  return async (next: ReactNode) => {
    await act(async () => {
      root.render(next);
    });
  };
}

afterEach(unmount);

async function click(element: Element | null | undefined) {
  if (!(element instanceof HTMLElement)) throw new Error("nothing to click");
  await act(async () => {
    element.click();
  });
}

const trigger = () => document.querySelector('button[aria-haspopup="dialog"]');
const buttonNamed = (name: string) =>
  [...document.querySelectorAll("[data-date-picker] button")].find(
    (button) => button.textContent?.trim() === name,
  );
/** A day in the first tree: the compact one, which is first in the DOM. */
const day = (iso: string) => document.querySelector(`td[data-day="${iso}"] button`);
/** The full-screen tree's stacked months. */
const stacked = () => [...document.querySelectorAll("[data-picker-month]")];

function Range({
  value,
  onValueChange,
  min,
  max,
}: {
  value: IsoDateRange | undefined;
  onValueChange: (value: IsoDateRange | undefined) => void;
  min?: IsoDate;
  max?: IsoDate;
}) {
  return (
    <DateRangePicker
      value={value}
      onValueChange={onValueChange}
      {...(min === undefined ? {} : { min })}
      {...(max === undefined ? {} : { max })}
    >
      <DatePickerTrigger aria-label="Window">
        <DatePickerValue />
      </DatePickerTrigger>
      <DatePickerContent />
    </DateRangePicker>
  );
}

describe("a range follows M3's taps, not react-day-picker's", { timeout: RANGE_TIMEOUT }, () => {
  async function pickAndSave(start: IsoDateRange, taps: IsoDate[]) {
    const onValueChange = vi.fn();
    await mount(<Range value={start} onValueChange={onValueChange} />);
    await click(trigger());
    for (const iso of taps) await click(day(iso));
    await click(buttonNamed("Save"));
    return onValueChange.mock.calls.at(-1)?.[0];
  }

  const WHOLE = { from: "2026-09-03", to: "2026-09-14" };

  it("a tap on a whole range starts a new one, with an open end", async () => {
    // react-day-picker's own rule extended the range from its start.
    expect(await pickAndSave(WHOLE, ["2026-09-20"])).toEqual({
      from: "2026-09-20",
      to: undefined,
    });
  });

  it("a tap after the start ends the range", async () => {
    expect(await pickAndSave(WHOLE, ["2026-09-20", "2026-09-25"])).toEqual({
      from: "2026-09-20",
      to: "2026-09-25",
    });
  });

  it("a tap on the start ends a one-day range", async () => {
    expect(await pickAndSave(WHOLE, ["2026-09-20", "2026-09-20"])).toEqual({
      from: "2026-09-20",
      to: "2026-09-20",
    });
  });

  it("a tap before the start starts again", async () => {
    expect(await pickAndSave(WHOLE, ["2026-09-20", "2026-09-18"])).toEqual({
      from: "2026-09-18",
      to: undefined,
    });
  });

  it("a half-open value is finished by the next tap after its start", async () => {
    expect(await pickAndSave({ from: "2026-09-05" }, ["2026-09-09"])).toEqual({
      from: "2026-09-05",
      to: "2026-09-09",
    });
  });
});

describe("the full-screen range picker's months", { timeout: RANGE_TIMEOUT }, () => {
  // The 15th: a month's first and last cells can be its neighbours' days,
  // hidden but still in the grid.
  const monthOf = (element: Element | undefined) =>
    element?.querySelector('td[data-day$="-15"]')?.getAttribute("data-day")?.slice(0, 7);

  it("are twelve either side of the range's start", async () => {
    await mount(
      <Range value={{ from: "2026-09-03", to: "2026-09-14" }} onValueChange={() => undefined} />,
    );
    await click(trigger());
    const months = stacked();
    expect(months).toHaveLength(25);
    expect(monthOf(months[0])).toBe("2025-09");
    expect(monthOf(months[24])).toBe("2027-09");
  });

  it("stay put when a tap moves the start into another month", async () => {
    await mount(
      <Range value={{ from: "2026-09-03", to: "2026-09-14" }} onValueChange={() => undefined} />,
    );
    await click(trigger());
    const november = stacked()
      .flatMap((month) => [...month.querySelectorAll('td[data-day="2026-11-10"] button')])
      .at(0);
    await click(november);
    expect(monthOf(stacked()[0]), "failed: the list re-based on the tap").toBe("2025-09");
    expect(stacked()).toHaveLength(25);
  });

  it("keep twelve months when max is more than a year before today", async () => {
    await mount(<Range value={undefined} onValueChange={() => undefined} max="2024-12-31" />);
    await click(trigger());
    const months = stacked();
    expect(months, "failed: the window collapsed").toHaveLength(13);
    expect(monthOf(months[0])).toBe("2023-12");
    expect(monthOf(months[12])).toBe("2024-12");
  });

  it("are anchored on the end when the value has only an end", async () => {
    await mount(<Range value={{ to: "2020-03-10" }} onValueChange={() => undefined} />);
    await click(trigger());
    const months = stacked();
    expect(months).toHaveLength(25);
    expect(monthOf(months[12]), "failed: the list does not hold the value's end").toBe("2020-03");
  });

  it("keep twelve months when min is far after today", async () => {
    await mount(<Range value={undefined} onValueChange={() => undefined} min="2099-03-01" />);
    await click(trigger());
    const months = stacked();
    expect(months, "failed: the window collapsed").toHaveLength(13);
    expect(monthOf(months[0])).toBe("2099-03");
  });
});

describe("a value changed from outside while the picker is open", () => {
  function Single({
    value,
    onValueChange,
  }: {
    value: IsoDate | undefined;
    onValueChange: (value: IsoDate | undefined) => void;
  }) {
    return (
      <DatePicker value={value} onValueChange={onValueChange}>
        <DatePickerTrigger aria-label="Send on">
          <DatePickerValue />
        </DatePickerTrigger>
        <DatePickerContent />
      </DatePicker>
    );
  }

  it("is what OK commits when nothing was picked", async () => {
    const onValueChange = vi.fn();
    const rerender = await mount(<Single value="2026-09-11" onValueChange={onValueChange} />);
    await click(trigger());
    await rerender(<Single value="2026-09-20" onValueChange={onValueChange} />);
    await click(buttonNamed("OK"));
    expect(
      onValueChange,
      "failed: OK wrote back the value the picker opened on",
    ).toHaveBeenCalledWith("2026-09-20");
  });

  it("does not replace a pick already made", async () => {
    const onValueChange = vi.fn();
    const rerender = await mount(<Single value="2026-09-11" onValueChange={onValueChange} />);
    await click(trigger());
    await click(day("2026-09-15"));
    await rerender(<Single value="2026-09-20" onValueChange={onValueChange} />);
    await click(buttonNamed("OK"));
    expect(onValueChange).toHaveBeenCalledWith("2026-09-15");
  });
});

describe("DatePickerClose", { timeout: RANGE_TIMEOUT }, () => {
  it("keeps a written aria-label when it replaces the icon", async () => {
    await mount(
      <DateRangePicker value={undefined} onValueChange={() => undefined}>
        <DatePickerTrigger aria-label="Window">
          <DatePickerValue />
        </DatePickerTrigger>
        <DatePickerContent>
          <DatePickerClose aria-label="Back">
            <span data-glyph="" aria-hidden="true">
              ←
            </span>
          </DatePickerClose>
        </DatePickerContent>
      </DateRangePicker>,
    );
    await click(trigger());
    const back = document.querySelector("[data-date-picker] [data-glyph]")?.closest("button");
    expect(back?.getAttribute("aria-label"), "failed: the icon button lost its name").toBe("Back");
  });

  it("is named by its text when it has text and no label", async () => {
    await mount(
      <DateRangePicker value={undefined} onValueChange={() => undefined}>
        <DatePickerTrigger aria-label="Window">
          <DatePickerValue />
        </DatePickerTrigger>
        <DatePickerContent>
          <DatePickerClose>Discard</DatePickerClose>
        </DatePickerContent>
      </DateRangePicker>,
    );
    await click(trigger());
    const discard = buttonNamed("Discard");
    expect(discard).toBeDefined();
    expect(discard?.hasAttribute("aria-label")).toBe(false);
  });
});
