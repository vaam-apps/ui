// @vitest-environment jsdom
import axe from "axe-core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Table, TableBody, TableCell, TableRow } from "./table";

/**
 * The scrollable branch of `Table`, which nothing else can reach.
 *
 * `Table` only becomes a focusable region once it measures itself as
 * overflowing, via `ResizeObserver`. jsdom has no layout — every element
 * reports `scrollWidth === clientWidth === 0` — and no `ResizeObserver`
 * at all, so `a11y.test.tsx`'s fixture always renders the *other*
 * branch. That is the correct answer there, and it means the branch a
 * keyboard user actually depends on was the one branch with no coverage.
 *
 * So the two things jsdom lacks are stubbed, narrowly and only here: a
 * `ResizeObserver` that fires its callback once, and a `scrollWidth`
 * wider than `clientWidth`. Everything else is the real component.
 *
 * What this pins is the pairing, which is the part that is easy to get
 * wrong in either direction:
 *
 * - `aria-label` on a roleless `<div>` names nothing — assistive tech
 *   ignores it. That was the shipped bug.
 * - `role="region"` *without* a name is also wrong, and not a lesser
 *   wrong: it puts a stop on the landmarks list that tells the reader
 *   nothing. So the two appear together or neither appears.
 * - A `tabIndex` with no visible focus state trades "unreachable by
 *   keyboard" for "reachable, but you cannot see where you are".
 * - A table that fits must gain no tab stop at all, or every table in
 *   the app pays for the few that scroll.
 */

const REAL_RO = globalThis.ResizeObserver;

function forceOverflow(overflowing: boolean) {
  Object.defineProperty(HTMLDivElement.prototype, "scrollWidth", {
    configurable: true,
    get: () => (overflowing ? 800 : 0),
  });
  Object.defineProperty(HTMLDivElement.prototype, "clientWidth", {
    configurable: true,
    get: () => (overflowing ? 200 : 0),
  });
}

beforeEach(() => {
  // Fires once on construction-time observe, which is all `useScrollable`
  // needs: it calls `measure()` itself before observing.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  globalThis.ResizeObserver = REAL_RO;
  // `delete`, not `= undefined`: restoring the prototype to its real
  // (absent) state is the point. Assigning would leave an own-property
  // shadow that outlives this file and lies to every suite after it.
  delete (HTMLDivElement.prototype as { scrollWidth?: number }).scrollWidth;
  delete (HTMLDivElement.prototype as { clientWidth?: number }).clientWidth;
});

async function mount(
  node: React.ReactElement,
  inspect: (host: HTMLElement) => void | Promise<void>,
) {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("main");
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    await act(async () => {
      root.render(node);
    });
    await inspect(host);
  } finally {
    await act(async () => {
      root.unmount();
    });
    host.remove();
  }
}

const rows = (
  <TableBody>
    <TableRow>
      <TableCell>Delivered</TableCell>
    </TableRow>
  </TableBody>
);

describe("a Table that overflows", () => {
  beforeEach(() => forceOverflow(true));

  it("becomes a named, keyboard-reachable region when given a label", async () => {
    await mount(<Table label="Delivery attempts">{rows}</Table>, (host) => {
      const wrapper = host.querySelector("div");
      expect(wrapper?.getAttribute("role")).toBe("region");
      expect(wrapper?.getAttribute("aria-label")).toBe("Delivery attempts");
      expect(wrapper?.getAttribute("tabindex")).toBe("0");
      // Reachable but invisible is its own barrier.
      expect(wrapper?.className).toContain("focus-visible:ring-1");
    });
  });

  it("stays roleless rather than becoming an unnamed landmark", async () => {
    await mount(<Table>{rows}</Table>, (host) => {
      const wrapper = host.querySelector("div");
      // Still focusable — the scroll barrier is real either way.
      expect(wrapper?.getAttribute("tabindex")).toBe("0");
      // But not a landmark nobody can identify.
      expect(wrapper?.getAttribute("role")).toBeNull();
      expect(wrapper?.getAttribute("aria-label")).toBeNull();
    });
  });

  it("has no axe violations in the named case", async () => {
    await mount(<Table label="Delivery attempts">{rows}</Table>, async (host) => {
      const results = await axe.run(host, {
        rules: { "color-contrast": { enabled: false } },
        resultTypes: ["violations"],
      });
      expect(results.violations.map((v) => v.id)).toEqual([]);
    });
  });
});

describe("a Table that fits", () => {
  beforeEach(() => forceOverflow(false));

  it("gains no tab stop, no role and no name", async () => {
    await mount(<Table label="Delivery attempts">{rows}</Table>, (host) => {
      const wrapper = host.querySelector("div");
      expect(wrapper?.getAttribute("tabindex")).toBeNull();
      expect(wrapper?.getAttribute("role")).toBeNull();
      expect(wrapper?.getAttribute("aria-label")).toBeNull();
    });
  });
});
