// @vitest-environment jsdom
import { act, Fragment, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import {
  Select,
  SelectContent,
  SelectEmpty,
  SelectItem,
  SelectSearch,
  SelectTrigger,
  SelectValue,
} from "./select";

/**
 * Where a part lands depends on the element tree the caller wrote, and a
 * caller's fragment is part of that tree.
 *
 * The combobox popup lifts `SelectSearch` and `SelectClose` out of the
 * container's children into its header, and `SelectEmpty` under the list,
 * by comparing each child's `type`. A fragment's `type` is `Fragment`, so
 * `<><SelectSearch /><SelectEmpty /></>` — what a caller writes to toggle
 * both behind one condition — used to be one opaque child: it went into
 * the list, which put a `role="combobox"` inside the `role="listbox"`,
 * where only options and groups may live.
 *
 * Asserted on where the elements are in the DOM, which is the contract:
 * a combobox outside the listbox, and no empty state inside it.
 */

async function withOpenSelect(parts: ReactNode, inspect: (host: HTMLElement) => void) {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("main");
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    await act(async () => {
      root.render(
        <Select>
          <SelectTrigger aria-label="Country">
            <SelectValue placeholder="Choose" />
          </SelectTrigger>
          <SelectContent>
            {parts}
            <SelectItem value="cm">Cameroon</SelectItem>
            <SelectItem value="ke">Kenya</SelectItem>
          </SelectContent>
        </Select>,
      );
    });
    const trigger = host.querySelector("button");
    if (trigger === null) throw new Error("no trigger rendered");
    await act(async () => {
      trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });
    inspect(host);
  } finally {
    await act(async () => {
      root.unmount();
    });
    host.remove();
  }
}

function placement(host: HTMLElement) {
  const listbox = host.querySelector('[role="listbox"]');
  const field = host.querySelector('input[role="combobox"]');
  if (listbox === null) throw new Error("the select did not open");
  return {
    fieldRendered: field !== null,
    fieldInsideListbox: field !== null && listbox.contains(field),
    listboxChildren: [...listbox.querySelectorAll('[role="option"]')].map((o) => o.textContent),
  };
}

describe("a Select's parts land in the same place bare or inside a fragment", () => {
  it("bare, the field is in the header and the list holds only options", async () => {
    await withOpenSelect(
      [<SelectSearch key="search" />, <SelectEmpty key="empty">Nothing</SelectEmpty>],
      (host) => {
        expect(placement(host)).toEqual({
          fieldRendered: true,
          fieldInsideListbox: false,
          listboxChildren: ["Cameroon", "Kenya"],
        });
      },
    );
  });

  it("inside a nested fragment, exactly the same", async () => {
    const searchable = true;
    await withOpenSelect(
      searchable && (
        <>
          {/* biome-ignore lint/complexity/noUselessFragments: the fragment is what this test is about */}
          <>
            <SelectSearch />
          </>
          <SelectEmpty>Nothing</SelectEmpty>
        </>
      ),
      (host) => {
        expect(
          placement(host),
          "a fragment's parts were treated as one list child: the field ended up inside role=listbox",
        ).toEqual({
          fieldRendered: true,
          fieldInsideListbox: false,
          listboxChildren: ["Cameroon", "Kenya"],
        });
        expect(host.querySelector('[role="listbox"]')?.textContent).not.toContain("Nothing");
      },
    );
  });
});

/**
 * Opening a fragment must not cost its parts their identity. Two sibling
 * fragments that each map `key={code}` used to flatten into one array with
 * duplicate keys, and React then left stale options on screen: emptying
 * the "recent" list kept its rows. Asserted on the options rendered after
 * each re-render, which is what the user sees.
 */
describe("parts lifted out of fragments keep distinct keys", () => {
  const NAMES: Record<string, string> = { cm: "Cameroon", ke: "Kenya", gh: "Ghana" };
  function Picker({ recent }: { recent: string[] }) {
    return (
      <Select>
        <SelectTrigger aria-label="Country">
          <SelectValue placeholder="Choose" />
        </SelectTrigger>
        <SelectContent>
          <SelectSearch />
          {/* biome-ignore lint/complexity/noUselessFragments: the fragment is what this test is about */}
          <>
            {recent.map((code) => (
              <SelectItem key={code} value={`recent-${code}`}>
                {`Recent ${NAMES[code]}`}
              </SelectItem>
            ))}
          </>
          {/* biome-ignore lint/complexity/noUselessFragments: the fragment is what this test is about */}
          <>
            {["cm", "ke", "gh"].map((code) => (
              <SelectItem key={code} value={code}>
                {NAMES[code]}
              </SelectItem>
            ))}
          </>
        </SelectContent>
      </Select>
    );
  }

  it("re-renders a changed fragment list without stale rows", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("main");
    document.body.appendChild(host);
    const root = createRoot(host);
    const options = () =>
      [...host.querySelectorAll('[role="option"]')].map((option) => option.textContent);
    try {
      await act(async () => {
        root.render(<Picker recent={["cm"]} />);
      });
      const trigger = host.querySelector("button");
      if (trigger === null) throw new Error("no trigger rendered");
      await act(async () => {
        trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      });
      expect(options()).toEqual(["Recent Cameroon", "Cameroon", "Kenya", "Ghana"]);
      await act(async () => {
        root.render(<Picker recent={["ke"]} />);
      });
      expect(options()).toEqual(["Recent Kenya", "Cameroon", "Kenya", "Ghana"]);
      await act(async () => {
        root.render(<Picker recent={[]} />);
      });
      expect(options(), "the emptied fragment's rows stayed on screen").toEqual([
        "Cameroon",
        "Kenya",
        "Ghana",
      ]);
    } finally {
      await act(async () => {
        root.unmount();
      });
      host.remove();
    }
  });
});

describe("a composed key cannot collide with a caller's own key", () => {
  // `cm` inside a fragment keyed `f` is re-keyed from the fragment's key;
  // siblings keyed as that composition would spell with either separator
  // must stay distinct, or React warns and keeps stale rows.
  it("renders every option once, with no duplicate-key warning", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const host = document.createElement("main");
    document.body.appendChild(host);
    const root = createRoot(host);
    try {
      await act(async () => {
        root.render(
          <Select>
            <SelectTrigger aria-label="Country">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              <SelectSearch />
              <Fragment key="f">
                <SelectItem key="cm" value="cm">
                  Cameroon
                </SelectItem>
              </Fragment>
              <SelectItem key="f/.$cm" value="slash">
                Slash
              </SelectItem>
              <SelectItem key="f:.$cm" value="colon">
                Colon
              </SelectItem>
            </SelectContent>
          </Select>,
        );
      });
      const trigger = host.querySelector("button");
      if (trigger === null) throw new Error("no trigger rendered");
      await act(async () => {
        trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      });
      expect(
        [...host.querySelectorAll('[role="option"]')].map((option) => option.textContent),
      ).toEqual(["Cameroon", "Slash", "Colon"]);
      const duplicate = errors.mock.calls.filter((call) => String(call[0]).includes("same key"));
      expect(duplicate, "React reported two children with the same key").toEqual([]);
    } finally {
      errors.mockRestore();
      await act(async () => {
        root.unmount();
      });
      host.remove();
    }
  });
});
