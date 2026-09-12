"use client";

import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/react";
import { ChevronDown } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { cn } from "../../lib/cn";

/**
 * The console's information architecture (console-redesign.md §4), as data.
 * `@vaam-apps/ui` owns the shape; `frontends/apps/admin/app/nav-groups.ts` owns the actual
 * content (routes, groupings, icons) — this file never hardcodes a route.
 */
export interface NavItem {
  label: string;
  href: string;
  /** Any lucide-react icon component. Typed structurally so this file
   * doesn't need to depend on `lucide-react`'s own exported icon type name. */
  icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean | "true" }>;
}

export interface NavGroup {
  /** Small-caps section header, e.g. "Messaging" (console-redesign.md §4). */
  label: string;
  items: NavItem[];
}

export interface SideNavProps {
  /** Flat, ungrouped, always first — §4 ("Dashboard"). */
  topItem: NavItem;
  groups: NavGroup[];
  /** De-emphasized footer utility rows (§1.1: "administrivia, not content"). */
  footerItems: NavItem[];
  /** Current pathname, for active-row highlighting. Plain string, not a
   * `next/navigation` call — this package has no dependency on Next.js, so
   * the caller (`frontends/apps/admin/app/console-shell.tsx`) resolves it via
   * `usePathname()` and passes it down. */
  currentPath: string;
  /** App-specific account/sign-out markup (§4's footer "Signed in as
   * <email> · Sign out" row) — rendered as-is, never built here, so this
   * component stays free of any auth-specific knowledge. */
  accountSlot?: ReactNode;
  className?: string;
}

function isActive(href: string, currentPath: string): boolean {
  if (href === "/") return currentPath === "/";
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

/**
 * One nav row, in one of the two shapes the sidebar ever needs.
 *
 * **CSS-driven, not `useMediaQuery`-driven — found live, corrected after
 * an earlier revision of this file used `@uidotdev/usehooks`' hook here
 * and wrapped `SideNav` in `next/dynamic({ ssr: false })` to work around
 * its SSR crash.** That fix traded a real cost — the sidebar never
 * appeared in the server-rendered HTML, so every full page load painted
 * an empty slab and popped the real nav in after hydration — for a
 * problem the breakpoint switch never needed JS to solve.
 *
 * - **`"labelled"`**: icon and label side by side. The off-canvas tree
 *   and the `≥1280px` full sidebar.
 * - **`"rail"`**: icon centred, label `sr-only`, the visual label carried
 *   by a native tooltip on an `aria-hidden` wrapper. The `1024–1279px`
 *   icon rail.
 *
 * # Why the tooltip is a native `title` and not daisyUI's `.tooltip`
 *
 * Because daisyUI's cannot work here, and had not been working since the
 * day this file was written. Measured on a real render at 1100px before
 * changing anything:
 *
 * ```text
 * nav.clientWidth   40      // the rail, content-sized
 * nav.scrollWidth   212     // 172px of it unreachable
 * ::before content  "Dashboard"
 * ::before left     32px
 * ::before width    82.6px  // i.e. 32→115px, entirely outside the clip box
 * ```
 *
 * `.tooltip` renders its bubble as an **absolutely positioned
 * pseudo-element at `left: 100%`**, and this `<nav>` is a scroll
 * container (`overflow-y-auto`; CSS computes the other axis to `auto`
 * too, since `visible` cannot pair with a scrolling axis). So the bubble
 * was clipped away on every hover — no label ever appeared in the icon
 * rail — while still counting toward the scrollable area, which is
 * exactly the stray horizontal scrollbar under the rail that prompted
 * this fix. One cause, two symptoms.
 *
 * There is no CSS-only way out: any flyout anchored inside a scroll
 * container is clipped by it, and escaping needs either a portal or CSS
 * anchor positioning — a floating-element dependency this package
 * deliberately does not have (D5), or a feature not yet safe to require.
 * A native `title` is painted by the browser *outside* the page entirely,
 * so it cannot be clipped by anything, costs no CSS and no JS, and is the
 * one mechanism that actually delivers the label the rail is missing.
 *
 * It sits on an `aria-hidden` wrapper rather than on the `<a>` so it
 * stays purely visual: the link's accessible name comes from the
 * `sr-only` label, and a `title` on the anchor itself would be announced
 * a second time as its description.
 */
function NavLink({
  item,
  active,
  variant,
  dim = false,
  className,
}: {
  item: NavItem;
  active: boolean;
  variant: "labelled" | "rail";
  dim?: boolean;
  className?: string;
}) {
  const Icon = item.icon;
  const rail = variant === "rail";
  const rowClass = cn(
    "flex items-center gap-3 rounded-field px-3 py-2 transition-colors",
    dim ? "text-caption" : "text-body",
    rail && "justify-center px-0",
    active && !dim && "bg-base-300 font-medium text-foreground",
    active && dim && "text-foreground",
    !active && "text-muted-foreground hover:bg-base-300/60 hover:text-foreground",
    className,
  );

  if (rail) {
    return (
      <a href={item.href} aria-current={active ? "page" : undefined} className={rowClass}>
        <span
          title={item.label}
          aria-hidden="true"
          // Fills the row, so a hover anywhere on it answers with the
          // label rather than only the 16px glyph.
          className="flex flex-1 items-center justify-center"
        >
          <Icon size={16} className="shrink-0" aria-hidden="true" />
        </span>
        <span className="sr-only">{item.label}</span>
      </a>
    );
  }

  return (
    <a href={item.href} aria-current={active ? "page" : undefined} className={rowClass}>
      <Icon size={16} className="shrink-0" aria-hidden="true" />
      {/* `truncate` + `min-w-0`: a label wider than the sidebar is cut
          with an ellipsis instead of wrapping. Nav rows are a fixed-height
          rhythm — one row growing to two lines shunts every row below it
          and turns the active row's filled rectangle into a different
          shape from all the others. No `title` here on purpose: the label
          is already on screen, and a native tooltip repeating text the
          reader can see is noise on every single row to spare the rare
          one that is actually cut. */}
      <span className="min-w-0 truncate">{item.label}</span>
    </a>
  );
}

/**
 * One row rendered as **both** persistent shapes, each visible only in its
 * own band — the same "two parallel trees, not one tree whose content
 * changes with a JS-read viewport width" technique `GroupSection` uses
 * below, applied one level down.
 *
 * It has to be two elements rather than one with responsive classes,
 * because the two shapes differ in an *attribute* (`title`) and in which
 * text is `sr-only`, and neither is something a media query can switch.
 * The cost is one extra `<a>` per row in the markup; `display: none`
 * keeps the hidden one out of the accessibility tree entirely, so a
 * screen reader still sees each destination exactly once.
 */
function NavRow(props: { item: NavItem; active: boolean; dim?: boolean }) {
  return (
    <>
      <NavLink {...props} variant="labelled" className="flex lg:hidden xl:flex" />
      <NavLink {...props} variant="rail" className="hidden lg:flex xl:hidden" />
    </>
  );
}

/**
 * One group's worth of rows, rendered as **two parallel trees**, one per
 * §6.1 regime, each visible only at its own breakpoint via a plain
 * `hidden`/`lg:hidden` toggle — not one tree whose *content* changes based
 * on a JS-read viewport width. The two regimes genuinely need different
 * DOM, not just different visibility, because the off-canvas tree is
 * interactive (a collapsible `Disclosure`) and the persistent tree is not
 * (every group is always fully expanded there, matching §1.1's LottieFiles
 * reference, which shows no user-collapsible groups on desktop at all) —
 * duplicating ~4 rows per group across two trees is a irrelevant DOM cost
 * next to the alternative (a client-only nav that never appears in the
 * first paint).
 *
 * - **Off-canvas** (`lg:hidden`, so effectively `<1024px` — both the phone
 *   band and the tablet band §6.1 explicitly keeps behind the hamburger):
 *   a Headless UI `Disclosure`, collapsed by default, expanded only if it
 *   contains the current route — "roughly 6–8 tappable rows on open, not
 *   18" (§4). `defaultOpen` is computed from `currentPath`, which is
 *   available identically on the server and the client, so this renders
 *   correctly on first paint with no hydration mismatch.
 * - **Persistent** (`hidden lg:flex`, so `≥1024px`): always fully
 *   expanded. The header/rail-divider split (small-caps text at `≥1280px`,
 *   a hairline divider instead in the `1024–1279px` icon rail band) is the
 *   same CSS-toggle technique `NavLink`'s own `"responsive"` variant uses.
 */
function GroupSection({ group, currentPath }: { group: NavGroup; currentPath: string }) {
  const hasActiveItem = group.items.some((item) => isActive(item.href, currentPath));

  return (
    <>
      <div className="lg:hidden">
        <Disclosure defaultOpen={hasActiveItem}>
          {({ open }) => (
            <div className="flex flex-col gap-0.5">
              <DisclosureButton className="flex items-center justify-between gap-2 rounded-field px-3 py-1.5 text-left text-caption text-subtle-foreground uppercase tracking-wide hover:text-foreground">
                <span className="min-w-0 truncate">{group.label}</span>
                <ChevronDown
                  size={14}
                  aria-hidden="true"
                  className={cn("shrink-0 transition-transform", open && "rotate-180")}
                />
              </DisclosureButton>
              <DisclosurePanel className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    active={isActive(item.href, currentPath)}
                    variant="labelled"
                  />
                ))}
              </DisclosurePanel>
            </div>
          )}
        </Disclosure>
      </div>

      <div className="hidden lg:flex lg:flex-col lg:gap-0.5">
        <p className="hidden truncate px-3 py-1.5 text-caption text-subtle-foreground uppercase tracking-wide xl:block">
          {group.label}
        </p>
        <div className="mx-3 my-1 border-edge-subtle border-t xl:hidden" aria-hidden="true" />
        {group.items.map((item) => (
          <NavRow key={item.href} item={item} active={isActive(item.href, currentPath)} />
        ))}
      </div>
    </>
  );
}

/**
 * The console's side navigation (console-redesign.md §4, §6.2). A pure
 * structural/layout component — routing, session data, and the drawer's
 * own off-canvas/persistent CSS split all live at the call site
 * (`frontends/apps/admin/app/console-shell.tsx`, D7): this component only ever decides
 * "flat top item → grouped middle → de-emphasized footer" composition and
 * the label/icon-only/accordion treatment per breakpoint.
 *
 * Breakpoint behaviour (§6.1 is the authoritative table here — see that
 * section's own reasoning for why it supersedes §4's looser "Tablet
 * (768–1024px)" prose, which pre-dates that table and was never updated to
 * match it) — entirely CSS-driven (`lg:`/`xl:` Tailwind variants), never a
 * JS breakpoint read:
 *   - `<1024px` (phone and tablet alike): off-canvas, full labels,
 *     collapsible accordion groups.
 *   - `1024–1279px`: persistent icon-only rail, label on hover via a
 *     native tooltip (hover only — a keyboard user gets the same label
 *     from the row's `sr-only` text, which is what a screen reader reads
 *     and what focus announces).
 *   - `≥1280px`: persistent full sidebar with labels.
 *
 * This means the whole nav — every row, every group, every breakpoint's
 * shape — is present in the server-rendered HTML on first paint. No
 * `next/dynamic({ ssr: false })`, no client-only mount flash. Verify that
 * claim directly, not by trusting this comment: `curl` a page and grep the
 * raw HTML for a nav item's label.
 */
export function SideNav({
  topItem,
  groups,
  footerItems,
  currentPath,
  accountSlot,
  className,
}: SideNavProps) {
  return (
    <nav
      aria-label="Primary"
      className={cn(
        "flex h-full flex-col gap-4 bg-base-200 py-4",
        // The three §6.1 bands as real widths, so the rail is a rail and
        // not "however wide a 16px icon plus its padding happens to be".
        // `w-full` off-canvas: below `lg` this lives inside the caller's
        // own drawer and should fill it. A `className` width from the
        // caller still wins — `cn()` resolves the conflict in call order.
        "w-full shrink-0 lg:w-16 xl:w-64",
        // `overflow-x-hidden` is a guard, not a fix. The fix is that
        // nothing in here overflows horizontally any more (see `NavLink`
        // on the daisyUI tooltip this replaced, and `truncate` on every
        // label). But `overflow-y: auto` forces the other axis to `auto`
        // as well, which means *any* future stray absolutely-positioned
        // child silently re-grows a horizontal scrollbar under the rail —
        // the exact bug that was here. Pinning it to `hidden` makes that
        // class of regression impossible instead of merely absent.
        "overflow-y-auto overflow-x-hidden",
        className,
      )}
    >
      <div className="flex flex-col gap-0.5 px-2">
        <NavRow item={topItem} active={isActive(topItem.href, currentPath)} />
      </div>

      <div className="flex flex-1 flex-col gap-4 px-2">
        {groups.map((group) => (
          <GroupSection key={group.label} group={group} currentPath={currentPath} />
        ))}
      </div>

      <div className="flex flex-col gap-2 border-edge-subtle border-t px-2 pt-3">
        <div className="flex flex-col gap-0.5">
          {footerItems.map((item) => (
            <NavRow key={item.href} item={item} active={isActive(item.href, currentPath)} dim />
          ))}
        </div>
        {/* Hidden in the icon rail band only (no room for the account
            block at 64px); shown off-canvas and at the full-label desktop
            width — same `lg:hidden xl:block` toggle technique as the rest
            of this file, not a JS breakpoint check. */}
        {accountSlot != null && <div className="px-3 lg:hidden xl:block">{accountSlot}</div>}
      </div>
    </nav>
  );
}
