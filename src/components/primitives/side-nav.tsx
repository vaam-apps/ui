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
   * the caller resolves it via its own router and passes it down. */
  currentPath: string;
  /** App-specific account/sign-out markup (§4's footer "Signed in as
   * <email> · Sign out" row) — rendered as-is, never built here, so this
   * component stays free of any auth-specific knowledge.
   *
   * Not rendered below `lg` in `"floating"` mode: ~52px has no room for
   * an email address, the same reason the `1024–1279px` icon rail has
   * always hidden it. */
  accountSlot?: ReactNode;
  /**
   * How the nav behaves below `lg`. Defaults to `"off-canvas"`.
   *
   * `"floating"` is opt-in, and the default did **not** change, because
   * flipping it would have been a silent break with no compile error:
   *
   * - The two shapes are mutually exclusive at *mount*, not by CSS. A
   *   consumer who wraps this in their own drawer — the documented
   *   pattern — would have got an empty drawer, because the accordion
   *   tree simply would not be rendered.
   * - Worse, `"floating"` positions a `fixed` pill, and a `fixed`
   *   element's containing block is the nearest ancestor with a
   *   `transform`, `filter`, `backdrop-filter`, `contain` **or
   *   `will-change: transform`**. This package's own `Drawer` is exactly
   *   that ancestor: `vaul` stamps `[data-vaul-drawer]{will-change:transform}`
   *   unconditionally, with no state gate (read it in
   *   `vaul/dist/index.mjs`). So the rail would re-anchor to the drawer
   *   instead of the viewport — and while that drawer is closed its
   *   content is not in the DOM at all, leaving no navigation below `lg`
   *   whatsoever.
   *
   * That is not something the library can make robust from the inside; a
   * `fixed` child would need a portal to `document.body`, which this does
   * not use. So `"floating"` is for a caller who owns their own shell and
   * knows no transformed ancestor sits above it.
   */
  smallScreen?: "floating" | "off-canvas" | undefined;
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
  dim?: boolean | undefined;
  className?: string | undefined;
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
 *
 * The `≥1024px` half of this (rail 1024–1279, labelled ≥1280) is always
 * the same regardless of `smallScreen` — that prop only ever changes what
 * happens *below* `lg`, per `SideNavProps`. Below `lg`, the labelled
 * variant is this row's off-canvas appearance, so it only renders (via
 * `flex` rather than `hidden`) when `smallScreen === "off-canvas"`; in
 * `"floating"` mode there is no off-canvas tree at all — the equivalent
 * row appears instead in `FloatingRail`, as its `"rail"` shape.
 */
function NavRow({
  item,
  active,
  dim,
  smallScreen,
}: {
  item: NavItem;
  active: boolean;
  dim?: boolean | undefined;
  smallScreen: "floating" | "off-canvas";
}) {
  return (
    <>
      <NavLink
        item={item}
        active={active}
        dim={dim}
        variant="labelled"
        className={cn(smallScreen === "off-canvas" ? "flex" : "hidden", "lg:hidden xl:flex")}
      />
      <NavLink
        item={item}
        active={active}
        dim={dim}
        variant="rail"
        className="hidden lg:flex xl:hidden"
      />
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
 *   correctly on first paint with no hydration mismatch. This tree is
 *   only mounted when `smallScreen === "off-canvas"` — in `"floating"`
 *   mode it does not exist at all (not merely hidden): the equivalent
 *   rows are flattened, icons-only, into `FloatingRail` instead, which
 *   has no room for a group header or an accordion.
 * - **Persistent** (`hidden lg:flex`, so `≥1024px`): always fully
 *   expanded, and always rendered regardless of `smallScreen` — that prop
 *   only changes what happens below `lg`. The header/rail-divider split
 *   (small-caps text at `≥1280px`, a hairline divider instead in the
 *   `1024–1279px` icon rail band) is the same CSS-toggle technique
 *   `NavLink`'s own `"responsive"` variant uses.
 */
function GroupSection({
  group,
  currentPath,
  smallScreen,
}: {
  group: NavGroup;
  currentPath: string;
  smallScreen: "floating" | "off-canvas";
}) {
  const hasActiveItem = group.items.some((item) => isActive(item.href, currentPath));

  return (
    <>
      {smallScreen === "off-canvas" && (
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
      )}

      <div className="hidden lg:flex lg:flex-col lg:gap-0.5">
        <p className="hidden truncate px-3 py-1.5 text-caption text-subtle-foreground uppercase tracking-wide xl:block">
          {group.label}
        </p>
        <div className="mx-3 my-1 border-edge-subtle border-t xl:hidden" aria-hidden="true" />
        {group.items.map((item) => (
          <NavRow
            key={item.href}
            item={item}
            active={isActive(item.href, currentPath)}
            smallScreen={smallScreen}
          />
        ))}
      </div>
    </>
  );
}

/**
 * `smallScreen="floating"`'s replacement for the off-canvas accordion
 * below `lg`: a detached pill, `fixed`, vertically centred, inset from the
 * left edge, layered *over* the page content instead of hidden behind a
 * hamburger the caller has to build and the reader has to find first.
 * `lg:hidden` is the only thing that ever removes it — same CSS-toggle
 * technique as every other band in this file, still no JS viewport read;
 * it is simply a `fixed` element rather than one sized by its parent.
 *
 * # Why this is the one floating thing in the library with a shadow
 *
 * `theme.css` states the rule directly: "borders, not shadows, for
 * cards/tables/panels — only floating layers (popover, dropdown, dialog,
 * tooltip, sheet/drawer) get one." Every layer on that list is transient,
 * anchored to a trigger, and gone the moment the interaction ends. This
 * rail is new territory even inside that exception: it is permanent
 * chrome, not an overlay, and it floats *unanchored* — nothing on the
 * page points to it. It still earns `--shadow-popover` because the reason
 * behind the rule hasn't changed: a layer sitting on top of arbitrary,
 * unknown-contrast page content needs a shadow to read as a separate
 * surface, and a border alone — the treatment every non-floating surface
 * in this system gets — cannot do that job for something that overlaps
 * content rather than sitting beside it. `backdrop-blur-md` is the same
 * argument taken one step further: content can scroll *under* the pill,
 * not just behind it.
 *
 * # Why every group's items are flattened
 *
 * A pill ~52px wide has no room for a small-caps group header — in the
 * off-canvas tree, "Messaging" costs a whole row before "Composer" ever
 * appears; here that row would cost as much as an icon and deliver
 * nothing a hover/`title` doesn't already (`NavLink`'s own comment covers
 * why the label is a native `title`, not rendered text). So every group's
 * `items` are concatenated in group order into one icon list with no
 * divider between groups — the same trade-off the `1024–1279px` icon rail
 * already makes, one level narrower.
 *
 * # Why `accountSlot` never appears here
 *
 * Same reasoning the `1024–1279px` icon rail already applies to hide it:
 * there is no room for an email address and a sign-out button at ~52px.
 * Unlike that band, there is no wider sibling column below `lg` to defer
 * to, so this is a permanent omission for `"floating"` mode rather than a
 * per-breakpoint hide — a caller whose small-screen users need the
 * account block keeps `smallScreen="off-canvas"`, where it already works.
 *
 * # Why it scrolls, and why the label survives that
 *
 * `max-h-[80vh] overflow-y-auto` caps the pill at something that always
 * leaves room above and below it, for a nav with enough groups to outgrow
 * 80% of even a short phone viewport. `overflow-x-hidden` is the same
 * guard the outer `<nav>` carries and for the same reason (see that
 * class's own comment on `SideNav`): once one axis scrolls, the other is
 * forced to `auto`, and any future stray child would silently reopen the
 * horizontal-scrollbar bug this file exists to keep closed. And clipping
 * an overflow axis is exactly the situation that broke daisyUI's
 * `.tooltip` in the first place (`NavLink`'s comment has the measurements)
 * — which a native `title` does not care about, because the browser
 * paints it outside the page entirely, immune to any ancestor's
 * `overflow`. That is the whole reason this rail is still usable once it
 * starts scrolling.
 */
function FloatingRail({
  topItem,
  groups,
  footerItems,
  currentPath,
}: {
  topItem: NavItem;
  groups: NavGroup[];
  footerItems: NavItem[];
  currentPath: string;
}) {
  // No group headers survive at this width (see doc comment above), so
  // there is nothing left to group by — every group's rows become one
  // flat, ordered list of icons.
  const flatGroupItems = groups.flatMap((group) => group.items);

  return (
    <div
      className={cn(
        "fixed top-1/2 left-3 z-40 flex w-[52px] -translate-y-1/2 flex-col items-stretch gap-1",
        "max-h-[80vh] overflow-y-auto overflow-x-hidden",
        "rounded-full border border-edge bg-surface-2/90 p-1.5 backdrop-blur-md",
        // The one deliberate exception to "borders, not shadows" — see
        // this function's own doc comment for why.
        "shadow-[var(--shadow-popover)]",
        "lg:hidden",
      )}
    >
      <NavLink item={topItem} active={isActive(topItem.href, currentPath)} variant="rail" />
      {flatGroupItems.map((item) => (
        <NavLink
          key={item.href}
          item={item}
          active={isActive(item.href, currentPath)}
          variant="rail"
        />
      ))}
      {footerItems.length > 0 && (
        <>
          <div className="my-1 border-edge-subtle border-t" aria-hidden="true" />
          {footerItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(item.href, currentPath)}
              variant="rail"
              dim
            />
          ))}
        </>
      )}
    </div>
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
 *   - `<1024px` (phone and tablet alike): `smallScreen` chooses the
 *     shape. Default `"floating"`: a detached icon-only pill, permanently
 *     on screen, layered over the content (`FloatingRail`). Opt-in
 *     `"off-canvas"`: the original off-canvas tree, full labels,
 *     collapsible accordion groups, for a caller that already wraps this
 *     component in its own drawer.
 *   - `1024–1279px`: persistent icon-only rail, label on hover via a
 *     native tooltip (hover only — a keyboard user gets the same label
 *     from the row's `sr-only` text, which is what a screen reader reads
 *     and what focus announces). Unaffected by `smallScreen`.
 *   - `≥1280px`: persistent full sidebar with labels. Unaffected by
 *     `smallScreen`.
 *
 * Exactly one `<nav aria-label="Primary">` exists at any width, in either
 * mode: there is only ever one `<nav>` element in this file, full stop —
 * every band is a subtree of it, shown or hidden by CSS (`display: none`
 * removes a subtree from the accessibility tree, so a hidden band is
 * genuinely absent, not merely invisible). `smallScreen` only decides,
 * per render, which below-`lg` subtree exists at all — the off-canvas
 * tree is never mounted in `"floating"` mode, and `FloatingRail` is never
 * mounted in `"off-canvas"` mode — so there is never a moment with two
 * competing below-`lg` trees, mounted or hidden.
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
  smallScreen = "off-canvas",
  className,
}: SideNavProps) {
  return (
    <nav
      aria-label="Primary"
      className={cn(
        smallScreen === "off-canvas"
          ? // Off-canvas: unchanged from before this prop existed. Below
            // `lg` this nav fills the caller's own drawer, so it needs a
            // real box of its own — full width and height, its own
            // background, scrollable.
            "flex h-full w-full shrink-0 flex-col gap-4 overflow-y-auto overflow-x-hidden bg-base-200 py-4"
          : // Floating: below `lg` the only visible thing is the `fixed`
            // `FloatingRail` rendered inside this element — which paints
            // its own pill and escapes this element's box entirely (fixed
            // positioning is sized independently of its parent). So
            // *this* element must not draw a box of its own down here —
            // no background, no padding, no forced height — or it becomes
            // a full-width, empty, coloured strip sitting uselessly
            // behind content the rail already floats over. It becomes the
            // real rail/sidebar box starting at `lg`, identically to the
            // off-canvas branch.
            "lg:flex lg:h-full lg:shrink-0 lg:flex-col lg:gap-4 lg:overflow-y-auto lg:overflow-x-hidden lg:bg-base-200 lg:py-4",
        // The `1024–1279px`/`≥1280px` widths as real widths, so the rail
        // is a rail and not "however wide a 16px icon plus its padding
        // happens to be" — true regardless of `smallScreen`. A
        // `className` width from the caller still wins — `cn()` resolves
        // the conflict in call order.
        "lg:w-16 xl:w-64",
        // `overflow-x-hidden` (unconditional off-canvas, `lg:` off in
        // floating mode below `lg` where nothing scrolls) is a guard, not
        // a fix. The fix is that nothing in here overflows horizontally
        // any more (see `NavLink` on the daisyUI tooltip this replaced,
        // and `truncate` on every label). But `overflow-y: auto` forces
        // the other axis to `auto` as well, which means *any* future
        // stray absolutely-positioned child silently re-grows a
        // horizontal scrollbar under the rail — the exact bug that was
        // here. Pinning it to `hidden` makes that class of regression
        // impossible instead of merely absent.
        className,
      )}
    >
      {smallScreen === "floating" && (
        <FloatingRail
          topItem={topItem}
          groups={groups}
          footerItems={footerItems}
          currentPath={currentPath}
        />
      )}

      <div className="flex flex-col gap-0.5 px-2">
        <NavRow
          item={topItem}
          active={isActive(topItem.href, currentPath)}
          smallScreen={smallScreen}
        />
      </div>

      <div className="flex flex-1 flex-col gap-4 px-2">
        {groups.map((group) => (
          <GroupSection
            key={group.label}
            group={group}
            currentPath={currentPath}
            smallScreen={smallScreen}
          />
        ))}
      </div>

      <div
        className={cn(
          "flex flex-col gap-2 border-edge-subtle border-t px-2 pt-3",
          // In floating mode there is no off-canvas footer below `lg` —
          // `FloatingRail` renders its own footer rows instead — so this
          // whole block (including its hairline `border-t`) would
          // otherwise render as an empty, pointless line at that width.
          smallScreen === "floating" && "hidden lg:flex",
        )}
      >
        <div className="flex flex-col gap-0.5">
          {footerItems.map((item) => (
            <NavRow
              key={item.href}
              item={item}
              active={isActive(item.href, currentPath)}
              dim
              smallScreen={smallScreen}
            />
          ))}
        </div>
        {/* Hidden in the icon rail band (no room for the account block at
            64px) and, in floating mode, below `lg` too (no room at ~52px
            either, and floating mode has no off-canvas tree for it to
            live in) — shown off-canvas (in `"off-canvas"` mode only) and
            at the full-label desktop width, by the same `lg:hidden
            xl:block` toggle technique as the rest of this file, not a JS
            breakpoint check. */}
        {accountSlot != null && (
          <div className={cn("px-3 lg:hidden xl:block", smallScreen === "floating" && "hidden")}>
            {accountSlot}
          </div>
        )}
      </div>
    </nav>
  );
}
