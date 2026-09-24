// @vitest-environment jsdom
import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { usePopupModality } from "./popup-modality";

/**
 * The page lock is shared: `usePopupModality` counts the popups holding it,
 * and only the last to close lifts it. Nothing else exercised that count —
 * React runs one popup's cleanup before the next popup's effect, so in the
 * e2e suite it never rises above one, and a lock that forgot to count
 * passed every spec (found in review). Two popups open at once is the date
 * picker's case as much as the select's: a picker inside a searchable
 * select's page, or two pickers in one form.
 *
 * What is asserted is the page's state — the attribute `theme.css` reads —
 * not the counter itself.
 */

function Popup() {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  usePopupModality(true, surfaceRef, triggerRef);
  return (
    <div>
      <button ref={triggerRef} type="button">
        Open
      </button>
      <div ref={surfaceRef}>Popup</div>
    </div>
  );
}

const roots: { root: Root; host: HTMLElement }[] = [];

async function open() {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("section");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<Popup />);
  });
  roots.push({ root, host });
  return { root, host };
}

async function close(entry: { root: Root; host: HTMLElement }) {
  await act(async () => {
    entry.root.unmount();
  });
  entry.host.remove();
  roots.splice(roots.indexOf(entry), 1);
}

const locked = () => document.documentElement.hasAttribute("data-select-scroll-lock");

afterEach(async () => {
  for (const entry of [...roots]) await close(entry);
});

describe("the page lock is counted across popups", () => {
  it("stays on until the last of two open popups closes", async () => {
    const first = await open();
    const second = await open();
    expect(locked(), "failed: two popups open and the page is not locked").toBe(true);
    await close(first);
    expect(locked(), "failed: closing one popup unlocked the page under the other").toBe(true);
    await close(second);
    expect(locked(), "failed: the page stayed locked after every popup closed").toBe(false);
  });

  it("closing in the other order ends the same way", async () => {
    const first = await open();
    const second = await open();
    await close(second);
    expect(locked()).toBe(true);
    await close(first);
    expect(locked()).toBe(false);
  });

  it("leaves an element someone else made inert, inert", async () => {
    const other = document.createElement("div");
    other.inert = true;
    document.body.appendChild(other);
    const popup = await open();
    await close(popup);
    expect(other.inert, "failed: closing the popup un-inerted what it did not inert").toBe(true);
    other.remove();
  });
});
