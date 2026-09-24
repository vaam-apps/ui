// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSearch,
  SelectTrigger,
  SelectValue,
} from "./select";

/**
 * `""` means two things to a `Select`, and only a `<SelectItem value="">`
 * says which.
 *
 * Without one, `value=""` is "nothing picked" — what callers have always
 * passed — and the trigger shows the placeholder. With one ("Any
 * country"), `""` is a real pick: the trigger has to show that item's
 * label, and before anything is picked that item must not already be the
 * selected one. Both failed once `""` became pickable in the searchable
 * engine: picking "Any country" left the trigger reading "Choose a
 * country", and both engines handed Headless UI `""` for "nothing
 * picked", which marked "Any country" `aria-selected` on first open.
 *
 * Asserted on the trigger's text and the option's `aria-selected`, which
 * are what a user and a screen reader get. Both engines, because the
 * value handling is shared and the engines are not.
 */

const ENGINES = [
  ["plain", false],
  ["searchable", true],
] as const;

// jsdom has no `ResizeObserver`, and Headless UI measures its button and
// options with one while a popup closes — an unhandled `ReferenceError`
// otherwise. Nothing here depends on a size, so an observer that observes
// nothing is enough; restored after.
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

async function withSelect(
  props: { defaultValue?: string; withEmptyItem: boolean; searchable: boolean },
  inspect: (host: HTMLElement, open: () => Promise<void>) => Promise<void> | void,
) {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("main");
  document.body.appendChild(host);
  const root = createRoot(host);
  const items: ReactNode[] = [];
  if (props.searchable) items.push(<SelectSearch key="search" />);
  if (props.withEmptyItem) {
    items.push(
      <SelectItem key="any" value="">
        Any country
      </SelectItem>,
    );
  }
  items.push(
    <SelectItem key="cm" value="cm">
      Cameroon
    </SelectItem>,
  );
  try {
    await act(async () => {
      root.render(
        <Select {...(props.defaultValue === undefined ? {} : { defaultValue: props.defaultValue })}>
          <SelectTrigger aria-label="Country">
            <SelectValue placeholder="Choose a country" />
          </SelectTrigger>
          <SelectContent>{items}</SelectContent>
        </Select>,
      );
    });
    const open = async () => {
      const trigger = host.querySelector("button");
      if (trigger === null) throw new Error("no trigger rendered");
      await act(async () => {
        trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      });
      if (host.querySelector('[role="listbox"]') === null)
        throw new Error("the select did not open");
    };
    await inspect(host, open);
  } finally {
    await act(async () => {
      root.unmount();
    });
    host.remove();
  }
}

const triggerText = (host: HTMLElement) => host.querySelector("button")?.textContent?.trim();
const anyCountry = (host: HTMLElement) =>
  [...host.querySelectorAll('[role="option"]')].find((o) => o.textContent === "Any country");

describe.each(ENGINES)('a Select whose value is "" — %s engine', (_name, searchable) => {
  it('shows the "" item\'s label when "" is picked', async () => {
    await withSelect({ defaultValue: "", withEmptyItem: true, searchable }, (host) => {
      expect(triggerText(host), "the trigger fell back to the placeholder").toBe("Any country");
    });
  });

  it('marks the "" item selected only once it is picked', async () => {
    await withSelect({ withEmptyItem: true, searchable }, async (host, open) => {
      expect(triggerText(host)).toBe("Choose a country");
      await open();
      expect(
        anyCountry(host)?.getAttribute("aria-selected"),
        'nothing is picked, yet the "" option is announced as the selected one',
      ).toBe("false");
    });
    await withSelect({ defaultValue: "", withEmptyItem: true, searchable }, async (host, open) => {
      await open();
      expect(anyCountry(host)?.getAttribute("aria-selected")).toBe("true");
    });
  });

  it('keeps value="" meaning "nothing picked" when no item has that value', async () => {
    await withSelect({ defaultValue: "", withEmptyItem: false, searchable }, (host) => {
      expect(triggerText(host)).toBe("Choose a country");
    });
  });
});

/**
 * The trigger shows an item's *current* label. Labels are also remembered
 * once rendered (so a caller-filtered search that drops the chosen item
 * still names it), but the remembered one is a fallback only: read first,
 * it showed "Safaricom" for an item since renamed "Safaricom PLC" while
 * the popup was closed.
 */
describe.each(ENGINES)("the trigger's label — %s engine", (_name, searchable) => {
  function Picker({ label }: { label: string }) {
    return (
      <Select defaultValue="saf">
        <SelectTrigger aria-label="Provider">
          <SelectValue placeholder="Choose" />
        </SelectTrigger>
        <SelectContent>
          {searchable && <SelectSearch />}
          <SelectItem value="saf">{label}</SelectItem>
          <SelectItem value="mtn">MTN</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  it("follows an item renamed while the popup is closed", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("main");
    document.body.appendChild(host);
    const root = createRoot(host);
    try {
      await act(async () => {
        root.render(<Picker label="Safaricom" />);
      });
      const trigger = host.querySelector("button");
      if (trigger === null) throw new Error("no trigger rendered");
      // Open, so the item renders and its label is remembered, then close.
      await act(async () => {
        trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      });
      expect(host.querySelector('[role="listbox"]')).not.toBeNull();
      await act(async () => {
        (document.activeElement ?? trigger).dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
        );
      });
      expect(host.querySelector('[role="listbox"]'), "the popup did not close").toBeNull();
      await act(async () => {
        root.render(<Picker label="Safaricom PLC" />);
      });
      expect(triggerText(host), "the trigger kept the remembered, stale label").toBe(
        "Safaricom PLC",
      );
    } finally {
      await act(async () => {
        root.unmount();
      });
      host.remove();
    }
  });
});
