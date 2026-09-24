// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConfirmDialog } from "./confirm-dialog";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "./dialog";

/**
 * Which close controls a dialog renders, by name — what a screen-reader
 * user and a keyboard user get. The surface renders one close icon by
 * default and replaces it with a bare `DialogClose` written among its
 * direct parts (fragments opened); anything else is an extra control, not
 * a replacement. And a busy `ConfirmDialog` must not let its Cancel close
 * the dialog under a write in flight. Geometry is in
 * `e2e/dialog-presentations.spec.ts`; jsdom cannot see it.
 */

// Headless UI measures with a `ResizeObserver` jsdom does not have; nothing
// here depends on a size.
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

async function withOpen(node: ReactNode, inspect: () => void) {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("main");
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    await act(async () => {
      root.render(node);
    });
    inspect();
  } finally {
    await act(async () => {
      root.unmount();
    });
    host.remove();
  }
}

const buttonsNamed = (name: string) =>
  [...document.body.querySelectorAll("button")].filter(
    (button) => (button.getAttribute("aria-label") ?? button.textContent?.trim()) === name,
  );

describe("the dialog's close icon", () => {
  it("is rendered once by default, named Close", async () => {
    await withOpen(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Title</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
      () => {
        expect(buttonsNamed("Close")).toHaveLength(1);
      },
    );
  });

  it.each([
    ["written bare among the parts", (close: ReactNode) => close],
    ["inside a fragment", (close: ReactNode) => <>{close}</>],
  ])("is replaced by a bare DialogClose %s", async (_how, wrap) => {
    await withOpen(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Title</DialogTitle>
          </DialogHeader>
          {wrap(<DialogClose aria-label="Dismiss" />)}
        </DialogContent>
      </Dialog>,
      () => {
        expect(buttonsNamed("Dismiss"), "failed: the caller's close icon is missing").toHaveLength(
          1,
        );
        expect(
          buttonsNamed("Close"),
          "failed: the default close icon stayed beside the caller's",
        ).toHaveLength(0);
      },
    );
  });
});

describe("a busy ConfirmDialog", () => {
  it("disables its Cancel, so a click cannot close it under a write in flight", async () => {
    await withOpen(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Delete endpoint?"
        description="Deliveries to it stop at once."
        confirmLabel="Delete endpoint"
        onConfirm={() => {}}
        busy
      />,
      () => {
        const [cancel] = buttonsNamed("Cancel");
        expect(cancel, "failed: no Cancel rendered").toBeDefined();
        expect((cancel as HTMLButtonElement).disabled, "failed: Cancel is live while busy").toBe(
          true,
        );
      },
    );
  });
});
