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

async function mount(node: React.ReactElement, inspect: () => void, wrap = false) {
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
    inspect();
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
        expect(rails).toHaveLength(1);
        // Not "somewhere outside" — specifically a child of body, which
        // is the only ancestor chain guaranteed free of a transform a
        // consumer introduced.
        expect(rails[0]?.parentElement).toBe(document.body);
      },
      true,
    );
  });

  it("leaves exactly one Primary landmark in the whole document", async () => {
    await mount(<SideNav {...PROPS} smallScreen="floating" />, () => {
      expect(document.querySelectorAll('nav[aria-label="Primary"]')).toHaveLength(1);
    });
  });

  it("is the default, so a caller gets it without opting in", async () => {
    await mount(<SideNav {...PROPS} />, () => {
      expect(document.querySelectorAll("[data-floating-rail]")).toHaveLength(1);
    });
  });

  it("renders no rail at all when a caller opts into off-canvas", async () => {
    await mount(<SideNav {...PROPS} smallScreen="off-canvas" />, () => {
      expect(document.querySelectorAll("[data-floating-rail]")).toHaveLength(0);
      expect(document.querySelectorAll('nav[aria-label="Primary"]')).toHaveLength(1);
    });
  });

  it("leaves nothing behind in body when it unmounts", async () => {
    await mount(<SideNav {...PROPS} smallScreen="floating" />, () => undefined);
    expect(document.querySelectorAll("[data-floating-rail]")).toHaveLength(0);
  });
});
