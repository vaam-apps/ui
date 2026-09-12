// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { Button } from "./button";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "./dialog";

/**
 * A dialog trigger must never submit the form it sits inside.
 *
 * `DialogTrigger` set `type="button"` only when `as` was undefined. That
 * covers the bare case and misses the one people actually write:
 * `<DialogTrigger as={Button}>` renders a `<button>` with no `type`, and
 * HTML's default for that is **submit**. Inside a `<form>` — a filter
 * bar, an edit panel, anything — clicking the trigger submitted the form
 * on its way to opening the dialog.
 *
 * Nothing caught it. The markup is valid, the dialog opens, and the
 * submit is someone else's navigation. `tsc` cannot see it, axe has no
 * rule for it, and a story does not sit inside a form.
 *
 * Asserted on the attribute rather than by dispatching a submit, because
 * the attribute *is* the contract: `type="button"` is what stops the
 * browser, and a test that watched for a submit event would pass just as
 * well if some other thing happened to call `preventDefault`.
 */

async function mount(node: React.ReactElement, inspect: (host: HTMLElement) => void) {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("main");
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    await act(async () => {
      root.render(node);
    });
    inspect(host);
  } finally {
    await act(async () => {
      root.unmount();
    });
    host.remove();
  }
}

describe("DialogTrigger and DialogClose never submit a form", () => {
  it("bare, it is type=button", async () => {
    await mount(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
      </Dialog>,
      (host) => {
        expect(host.querySelector("button")?.getAttribute("type")).toBe("button");
      },
    );
  });

  it("as={Button}, it is still type=button", async () => {
    await mount(
      <form>
        <Dialog>
          <DialogTrigger as={Button}>Open</DialogTrigger>
        </Dialog>
      </form>,
      (host) => {
        const trigger = host.querySelector("button");
        expect(
          trigger?.getAttribute("type"),
          "an untyped <button> defaults to submit, so this trigger would post the form it sits in",
        ).toBe("button");
      },
    );
  });

  it("a caller who wants a submit can still say so", async () => {
    await mount(
      <Dialog>
        <DialogTrigger type="submit">Save and review</DialogTrigger>
      </Dialog>,
      (host) => {
        expect(host.querySelector("button")?.getAttribute("type")).toBe("submit");
      },
    );
  });

  it("an anchor gets no type attribute", async () => {
    await mount(
      <Dialog>
        <DialogTrigger as="a" href="#open">
          Open
        </DialogTrigger>
      </Dialog>,
      (host) => {
        // `type` on an <a> means a MIME hint, not a button kind — putting
        // "button" there would be wrong rather than merely useless.
        expect(host.querySelector("a")?.hasAttribute("type")).toBe(false);
      },
    );
  });

  it("DialogClose carries the same guarantee", async () => {
    await mount(
      <form>
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Requeue this message?</DialogTitle>
            <DialogClose as={Button}>Cancel</DialogClose>
          </DialogContent>
        </Dialog>
      </form>,
      () => {
        // The content is portalled, so query the document.
        const buttons = [...document.querySelectorAll("button")];
        const cancel = buttons.find((b) => b.textContent?.includes("Cancel"));
        expect(cancel?.getAttribute("type")).toBe("button");
      },
    );
  });
});
