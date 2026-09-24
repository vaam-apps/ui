// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { SideNav } from "./side-nav";

/**
 * The floating rail is portalled to `document.body`, and both halves of
 * that decision need a gate.
 *
 * `smallScreen="floating"` renders the rail `fixed`. A `fixed` element's
 * containing block is the viewport **only** while no ancestor establishes
 * one — and `transform`, `filter`, `backdrop-filter`, `contain` and
 * `will-change: transform` all do. That is not a hypothetical: `vaul`
 * stamps `[data-vaul-drawer]{will-change:transform}` unconditionally, so
 * every consumer that wraps this component in a drawer would have
 * re-anchored the rail to the drawer's box. The portal is the fix, and
 * `createPortal` to `document.body` puts the subtree outside any wrapper
 * by construction.
 *
 * The cost is that the rail's markup now lands somewhere the component's
 * own return value doesn't cover, which is exactly where a second
 * landmark would hide. `nav[aria-label="Primary"]` appearing twice is an
 * axe violation the sibling a11y gate cannot see, because that gate
 * audits the component's own host node and the portal escapes it — so
 * these assertions query the whole `document` on purpose.
 *
 * `side-nav.tsx`'s `FloatingRailPortal` doc cites this measurement. It
 * cited a scratch test that had been deleted; this file is that citation
 * made real, so the claim fails with the code rather than outliving it.
 */

const Icon = () => null;

const PROPS = {
  topItem: { label: "Dashboard", href: "/", icon: Icon },
  groups: [
    {
      label: "Messaging",
      items: [
        { label: "Composer", href: "/composer", icon: Icon },
        { label: "Delivery", href: "/delivery", icon: Icon },
      ],
    },
  ],
  footerItems: [{ label: "Settings", href: "/settings", icon: Icon }],
  currentPath: "/",
};

async function mount(node: React.ReactElement, inspect: () => void | Promise<void>, wrap = false) {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  // The hazard, reproduced: an ancestor that establishes a containing
  // block for `fixed`. Without the portal the rail anchors to this.
  if (wrap) host.style.transform = "translateZ(0)";
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    await act(async () => {
      root.render(node);
    });
    await inspect();
  } finally {
    await act(async () => {
      root.unmount();
    });
    host.remove();
  }
}

describe("the floating rail escapes its wrapper without duplicating the landmark", () => {
  it("portals out of a transformed ancestor, to body", async () => {
    await mount(
      <SideNav {...PROPS} smallScreen="floating" />,
      () => {
        const rails = [...document.querySelectorAll("[data-floating-rail]")];
        // Two: the horizontal tiny-screen rail and the vertical one.
        // Both are always in the DOM and CSS picks — see the next case.
        expect(rails).toHaveLength(2);
        // Not "somewhere outside" — specifically children of body, which
        // is the only ancestor chain guaranteed free of a transform a
        // consumer introduced.
        for (const rail of rails) {
          expect(rail.parentElement).toBe(document.body);
        }
      },
      true,
    );
  });

  /**
   * The two rails are chosen by CSS, not by a JS viewport read — so
   * jsdom, which has no layout, cannot tell you which one a user sees.
   * What it *can* check is the property that makes the CSS choice safe:
   * that the two gates are complements. If both ever became visible at
   * one width, a phone would get a vertical rail down its side and a
   * horizontal one along its bottom, at the same time.
   *
   * Asserted on the class strings deliberately. It is the weaker kind of
   * test — it pins the mechanism rather than the result — but the result
   * is not observable here at all, and the alternative is pinning
   * nothing.
   */
  it("gates the two rails on complementary breakpoints", async () => {
    await mount(<SideNav {...PROPS} smallScreen="floating" />, () => {
      const horizontal = document.querySelector('[data-floating-rail-axis="horizontal"]');
      const vertical = document.querySelector(
        "[data-floating-rail]:not([data-floating-rail-axis])",
      );
      expect(horizontal).not.toBeNull();
      expect(vertical).not.toBeNull();
      // Horizontal: below `sm` only.
      expect(horizontal?.className).toContain("sm:hidden");
      // Vertical: `sm` and up, and it hands over to the sidebar at `xl`.
      expect(vertical?.className).toContain("hidden");
      expect(vertical?.className).toContain("sm:flex");
      expect(vertical?.className).toContain("xl:hidden");
    });
  });

  it("keeps the vertical rail past xl when the sidebar is collapsed", async () => {
    await mount(<SideNav {...PROPS} collapsed />, () => {
      const vertical = document.querySelector(
        "[data-floating-rail]:not([data-floating-rail-axis])",
      );
      // No `xl:hidden` — at `xl` there is no sidebar to hand over to.
      expect(vertical?.className).not.toContain("xl:hidden");
      expect(vertical?.className).toContain("sm:flex");
    });
  });

  it("puts overflow destinations behind a menu, as real links", async () => {
    await mount(<SideNav {...PROPS} />, () => {
      const horizontal = document.querySelector('[data-floating-rail-axis="horizontal"]');
      // PROPS has 4 destinations (top + 2 grouped + ... ) plus a footer
      // item; whatever the split, every slot shown is an anchor and the
      // menu trigger is a button.
      const slots = horizontal?.querySelectorAll("a") ?? [];
      expect(slots.length).toBeLessThanOrEqual(4);
      expect(horizontal?.querySelector('button[aria-label="More destinations"]')).not.toBeNull();
    });
  });

  /**
   * Every shape is a `<nav aria-label="Primary">` — including the two
   * portalled rails, which were plain `<div>`s until the a11y gate
   * pointed out that below `sm` the in-flow nav is `display: none` and a
   * phone was therefore getting its navigation with no landmark at all.
   *
   * Three identically-named landmarks in the DOM is only safe because
   * exactly one is ever displayed. The previous case pins that for the
   * two rails' gates only, as class strings; the in-flow `<nav>` was a
   * second exposed `Primary` landmark below 1280px for two releases while
   * it passed (vaam-apps/ui#16), so the real check is
   * `e2e/side-nav-bands.spec.ts`, in Chromium. This one pins the other
   * half: that all three really do carry the landmark, so the fix cannot
   * be half-reverted by someone turning one of them back into a `div`.
   */
  it("makes every shape a Primary landmark, rails included", async () => {
    await mount(<SideNav {...PROPS} smallScreen="floating" />, () => {
      const navs = [...document.querySelectorAll('nav[aria-label="Primary"]')];
      expect(navs).toHaveLength(3);
      // Two of them are the portalled rails.
      expect(navs.filter((n) => n.hasAttribute("data-floating-rail"))).toHaveLength(2);
    });
  });

  it("leaves exactly one Primary landmark when the caller opts out of floating", async () => {
    await mount(<SideNav {...PROPS} smallScreen="off-canvas" />, () => {
      // No rails at all in this mode, so no duplication to reason about.
      expect(document.querySelectorAll('nav[aria-label="Primary"]')).toHaveLength(1);
    });
  });

  it("is the default, so a caller gets it without opting in", async () => {
    await mount(<SideNav {...PROPS} />, () => {
      expect(document.querySelectorAll("[data-floating-rail]")).toHaveLength(2);
    });
  });

  it("renders no rail at all when a caller opts into off-canvas", async () => {
    await mount(<SideNav {...PROPS} smallScreen="off-canvas" />, () => {
      expect(document.querySelectorAll("[data-floating-rail]")).toHaveLength(0);
      expect(document.querySelectorAll('nav[aria-label="Primary"]')).toHaveLength(1);
    });
  });

  /**
   * `accountSlot` below the sidebar (vaam-apps/ui#36): each rail ends in a
   * "More" control that opens a sheet. Presence and structure only — where
   * the sheet lands and whether its contents can be operated is geometry
   * and focus, measured in `e2e/side-nav-account-sheet.spec.ts`.
   */
  it("with an accountSlot, both rails end in a More control that opens a dialog", async () => {
    await mount(
      <SideNav {...PROPS} accountSlot={<button type="button">Sign out</button>} />,
      () => {
        const controls = [...document.querySelectorAll("[data-side-nav-more]")];
        // One per rail; CSS shows one rail at a time.
        expect(controls).toHaveLength(2);
        for (const control of controls) {
          expect(control.getAttribute("aria-label")).toBe("More");
          expect(control.getAttribute("aria-haspopup")).toBe("dialog");
          // The rail's last control, after every destination and footer row.
          const rail = control.closest("[data-floating-rail]");
          const all = [...(rail?.querySelectorAll("a[href], button") ?? [])];
          expect(all.at(-1)).toBe(control);
        }
        // The menu is gone from the phone bar: a `role="menu"` cannot hold
        // the account block.
        expect(document.querySelector('button[aria-label="More destinations"]')).toBeNull();
      },
    );
  });

  it("without an accountSlot, the phone bar keeps its menu and the vertical rail gains nothing", async () => {
    await mount(<SideNav {...PROPS} />, () => {
      expect(document.querySelectorAll("[data-side-nav-more]")).toHaveLength(0);
      expect(
        document
          .querySelector('button[aria-label="More destinations"]')
          ?.getAttribute("aria-haspopup"),
      ).toBe("menu");
    });
  });

  /**
   * `accountSlot={signedIn && <Account />}` passes `false` while signed
   * out, and `false`, `true` and `""` render nothing in React. Compared
   * with `!= null`, each of them counted as an account block: both rails
   * gained a "More" control and the phone bar's menu became a sheet with
   * no account in it.
   */
  it.each([
    ["false", false],
    ["true", true],
    ["an empty string", ""],
  ])("an accountSlot of %s is no account block", async (_name, slot) => {
    await mount(<SideNav {...PROPS} accountSlot={slot} />, () => {
      expect(document.querySelectorAll("[data-side-nav-more]")).toHaveLength(0);
      expect(
        document
          .querySelector('button[aria-label="More destinations"]')
          ?.getAttribute("aria-haspopup"),
      ).toBe("menu");
    });
  });

  /**
   * The sheet is `fixed`, and the rail it opens from is `translate`d to
   * centre it — so a sheet rendered inside the rail would be laid out
   * against the 64px toolbar, whatever the caller wrapped `SideNav` in.
   * It must be portalled out of the rail, to body, as the rails are out of
   * the caller's tree. This is that half, observable without layout.
   */
  it("opens its sheet in a portal on body, outside the rail and the caller's transformed wrapper", async () => {
    // vaul reads `matchMedia('(display-mode: standalone)')` when it opens;
    // jsdom has none.
    const original = Object.getOwnPropertyDescriptor(window, "matchMedia");
    if (typeof window.matchMedia !== "function") {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: (query: string) => ({
          matches: false,
          media: query,
          addEventListener() {},
          removeEventListener() {},
        }),
      });
    }
    try {
      await mount(
        <SideNav {...PROPS} accountSlot={<button type="button">Sign out</button>} />,
        async () => {
          const more = document.querySelector<HTMLButtonElement>(
            '[data-floating-rail-axis="horizontal"] [data-side-nav-more]',
          );
          await act(async () => {
            more?.click();
          });
          const sheet = document.querySelector('[role="dialog"][data-side-nav-sheet="bottom"]');
          expect(sheet).not.toBeNull();
          expect(sheet?.closest("[data-floating-rail]")).toBeNull();
          // Not inside the host `mount` made, which carries the transform.
          expect(
            document.querySelector("body > div[style*='translateZ']")?.contains(sheet ?? null),
          ).toBe(false);
          expect(sheet?.querySelector("[data-side-nav-account] button")?.textContent).toBe(
            "Sign out",
          );
          // The destinations the bar had no room for, then the footer.
          expect(
            [...(sheet?.querySelectorAll("a") ?? [])].map((a) => a.getAttribute("href")),
          ).toEqual(["/settings"]);
        },
        true,
      );
    } finally {
      if (original === undefined) Reflect.deleteProperty(window, "matchMedia");
      else Object.defineProperty(window, "matchMedia", original);
    }
  });

  it("leaves nothing behind in body when it unmounts", async () => {
    await mount(<SideNav {...PROPS} smallScreen="floating" />, () => undefined);
    expect(document.querySelectorAll("[data-floating-rail]")).toHaveLength(0);
  });
});
