"use client";

import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/react";
import { ChevronDown, MoreVertical } from "lucide-react";
import type { ComponentType, MouseEvent, ReactNode } from "react";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "../../lib/cn";
import { wasPointerDownUnderOpenSelect } from "../../lib/select-dismissal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

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
   * Where it renders, in the default `"floating"` mode:
   *
   * - **The sidebar (`≥1280px`, not `collapsed`)** — under the footer
   *   rows, in flow, as it always has.
   * - **Everywhere a floating toolbar is the navigation** — below
   *   `1280px`, and at every width when `collapsed` — behind a "More"
   *   control at the toolbar's end, in the M3 modal sheet it opens
   *   (`NavSheet`): a bottom sheet from the phone bar, a modal navigation
   *   drawer from the vertical rail. A 64px toolbar has no room for an
   *   email address, so the toolbar carries the way *to* it instead.
   *
   * This used to read "not rendered below `lg`", and that was the whole
   * of it: nothing replaced it there, so every consumer on the default
   * mode built its own `fixed` chrome to reach Sign out on a phone — and
   * vaam-apps/vpay's collided with the bottom toolbar (vaam-apps/ui#36).
   *
   * While a sheet is open this node is mounted twice — the sidebar's copy
   * stays in the DOM under `display: none` — so it must not hardcode an
   * `id`; derive one with `useId` if it needs one. The sheet's copy mounts
   * when the sheet opens and unmounts when it closes, so `useState` inside
   * the slot starts over on every open.
   *
   * The sheet is a vaul (Radix) modal, so the library's drawer rule holds
   * for everything inside it: confirm with `InlineConfirm`, not a
   * `Dialog`. Measured in review with a `ConfirmDialog` behind the account
   * block's Sign out, at 375 and 1100px: it opened *under* the sheet's
   * scrim — the hit test at its confirm button returned vaul's overlay, and
   * a click never reached it — and only the keyboard could press it. The
   * same `ConfirmDialog` from the 1440px sidebar worked. `Select`,
   * `DatePicker` and `RadioGroup` render inline and work in the sheet.
   *
   * `"off-canvas"` mode is unchanged: the account block sits in the
   * off-canvas tree below `lg` and in the sidebar at `xl`. */
  accountSlot?: ReactNode;
  /**
   * How the nav behaves below `lg`. Defaults to `"floating"`.
   *
   * `"floating"` used to be opt-in, for exactly one reason: it renders a
   * `fixed` pill, and a `fixed` element's containing block is the
   * nearest ancestor with a `transform`, `filter`, `backdrop-filter`,
   * `contain` **or `will-change: transform`**. This package's own
   * `Drawer` is exactly that ancestor — `vaul` stamps
   * `[data-vaul-drawer]{will-change:transform}` unconditionally, with no
   * state gate (still true; read it in `vaul/dist/index.mjs`) — so the
   * rail used to re-anchor to the drawer instead of the viewport for the
   * one consumer documented to nest this component inside one.
   *
   * That hazard is why `FloatingRail` is now rendered through
   * `createPortal` to `document.body` (see `FloatingRailPortal`'s own
   * doc for the SSR cost that came with it): a portaled node's containing
   * block is resolved against the document root, not against whatever
   * ancestor happens to sit above wherever `SideNav` was mounted, so no
   * ancestor of the caller's — transformed, `will-change`d or otherwise —
   * can capture it any more. Verified directly, not assumed: see this
   * file's stories, `FloatingRail`'s render inside a
   * `transform: translateZ(0)` wrapper still resolves against the
   * viewport.
   *
   * Removing that hazard is what makes `"floating"` safe to default, but
   * it does not make the default free:
   *
   * - It is a real behaviour change on upgrade. Every existing consumer
   *   who never passed this prop gets a new, permanent, floating icon
   *   rail below `lg` on the next install — where before there was
   *   nothing until they opened a hamburger they had built themselves.
   * - The documented drawer consumer is the sharpest case: they already
   *   render their own trigger that opens a `Drawer` containing this
   *   component. Passing nothing now gets them **both** — their drawer
   *   (still openable, though `"floating"` mode never mounts an
   *   off-canvas tree, so it opens with nothing in it, exactly as
   *   before) *and* a floating rail permanently on screen underneath it.
   *   That consumer must pass `smallScreen="off-canvas"` explicitly to
   *   get back the single below-`lg` experience they had.
   *
   * `"off-canvas"` remains exactly what it always was: the full-label
   * accordion tree, mounted only for a caller who opts in, for a
   * consumer who already owns a drawer and wants this component to fill
   * it rather than float over it.
   */
  smallScreen?: "floating" | "off-canvas" | undefined;
  /**
   * Collapses the `≥1280px` sidebar into the same floating rail the
   * narrower bands already use.
   *
   * The sidebar is the only shape in this component that takes space out
   * of the page — every other band floats over it. So "collapsed" here
   * does not mean "the sidebar, narrower": it means the sidebar stops
   * existing and the rail takes over, which is the one change that
   * actually gives the content its width back.
   *
   * This is a JS boolean rather than a breakpoint because it is a
   * *preference*, not a measurement — the caller owns it, persists it,
   * and usually puts a toggle next to it. It only means anything in the
   * default `smallScreen="floating"` mode; `"off-canvas"` has its own
   * in-flow tree at every width and ignores it.
   */
  collapsed?: boolean | undefined;
  /**
   * Which of M3 Expressive's two floating-toolbar colour schemes the
   * floating rails wear. Defaults to `"standard"`. Nothing else in the
   * nav reads it — the in-flow sidebar is not a toolbar.
   *
   * Both are androidx's own (`FloatingToolbarTokens.kt`), mapped onto this
   * library's neutral roles rather than onto hues, because §1.3's "one
   * accent, never a hue" still holds and a tinted bar would read as a
   * status:
   *
   * - `"standard"` — a `SurfaceContainer` bar (`surface-2` here); the
   *   current page is a filled `Primary` pill (`FilledIconButtonTokens`).
   *   androidx draws the other icons in `OnSurface` (the toolbar's
   *   content colour is `contentColorFor(SurfaceContainer)`); here they
   *   are `muted-foreground`, so the current page's pill is the one
   *   full-contrast mark on the bar. Quiet until you look for it — and,
   *   with no shadow (M3's `Level0`; see `TOOLBAR_CONTAINER`), separated
   *   from whatever scrolls under it by its fill alone.
   * - `"vibrant"` — a `PrimaryContainer` bar (`primary` here, so the bar
   *   is the inverse of the page: near-white on the dark theme,
   *   near-black on the light one) with the current page cut back out of
   *   it in `SurfaceContainer` (`VibrantButtonSelectedContainerColor`).
   *   Its fill is the page's own foreground, which no surface uses, so
   *   its edge holds over every surface — `Card`, `StatTile`, the page —
   *   where the standard bar's does not. Not over *everything*: a filled
   *   `primary` control (a primary `Button`) passing under it is the same
   *   colour.
   */
  toolbarVariant?: SideNavToolbarVariant | undefined;
  className?: string;
}

/** See `SideNavProps.toolbarVariant`. */
export type SideNavToolbarVariant = "standard" | "vibrant";

function isActive(href: string, currentPath: string): boolean {
  if (href === "/") return currentPath === "/";
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

/**
 * Whether `accountSlot` is an account block at all. `false`, `true` and
 * `""` render nothing in React, and `accountSlot={signedIn && <Account />}`
 * passes `false` while signed out. This used to be `!= null`, which was
 * harmless while the slot only ever landed in the sidebar (an empty
 * wrapper), and stopped being harmless once its presence decides the
 * toolbars' shape: each of those values put a "More" control on both
 * rails and turned the phone bar's menu into a sheet with no account in
 * it (`side-nav.portal.test.tsx`).
 */
function hasAccountBlock(slot: ReactNode): boolean {
  return slot !== null && slot !== undefined && typeof slot !== "boolean" && slot !== "";
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
 * container is clipped by it, and escaping needs a portal, `position:
 * fixed` placed by script (Floating UI, a dependency since #32 for
 * `Select`'s dropdown), or CSS anchor positioning, a feature not yet safe
 * to require — each more machinery than a label needs.
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
  // M3 Expressive shape audit: `rounded-field` stays constant across
  // `active`, not a candidate for a selected-state morph. This is a
  // locked decision, not an oversight — D8's own reference lock (theme.css)
  // names this exact row: judged against LottieFiles' active nav row,
  // "not fully pill-shaped either", so `rounded-full` on selection would
  // directly contradict a cited reference screen. And below in this same
  // file, a different active row growing to two lines is flagged as a bug
  // precisely because it "turns the active row's filled rectangle into a
  // different shape from all the others" — the established reading here
  // is that every row in a list shares one shape so the *fill* alone
  // carries selection, which is what `bg-base-300` below already does.
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
 * row appears instead in `FloatingRail` or `HorizontalRail`, as a
 * `ToolbarLink` (the `"rail"` variant above is off-canvas mode's in-flow
 * icon rail only).
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
      {/* The in-flow `1024–1279px` icon rail is an off-canvas-mode shape
          only. In the default floating mode that band is served by the
          portalled rail instead — see `SideNav`'s own doc for the band
          table and why the in-flow version had to go: it is the one
          shape that needs a flex-row parent, and a caller cannot build a
          layout that satisfies both it and a rail that floats. */}
      <NavLink
        item={item}
        active={active}
        dim={dim}
        variant="rail"
        className={smallScreen === "off-canvas" ? "hidden lg:flex xl:hidden" : "hidden"}
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
 *   `NavLink`'s own `"labelled"` and `"rail"` variants use.
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
                    className={cn(
                      // `rotate-180` is spatial (orientation/shape), same
                      // family as the switch thumb's `translate-x` —
                      // `--dur-spatial-fast` / `--ease-spatial-fast`, the
                      // "fast" pair for a small, local affordance. See
                      // `switch.tsx` for the fuller reasoning.
                      "shrink-0 transition-transform duration-[var(--dur-spatial-fast)] ease-[var(--ease-spatial-fast)]",
                      open && "rotate-180",
                    )}
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
 * The two colour schemes of M3 Expressive's floating toolbar, as class
 * strings. See `SideNavProps.toolbarVariant` for where each role comes from.
 *
 * `idle` is a *state layer*, not a fill: M3 draws hover as the content
 * colour laid over the container at 8% (`StateTokens.HoverStateLayerOpacity`),
 * so a hover moves each bar toward its own content colour — lighter on a
 * dark bar, darker on a light one, whichever scheme and theme that is —
 * from the same rule, without a second token for either.
 */
const TOOLBAR_PALETTES: Record<
  SideNavToolbarVariant,
  { container: string; idle: string; selected: string; divider: string; ring: string }
> = {
  standard: {
    container: "bg-surface-2 text-muted-foreground",
    idle: "hover:bg-foreground/8 hover:text-foreground",
    selected: "bg-primary text-primary-content",
    divider: "bg-edge",
    ring: "",
  },
  vibrant: {
    container: "bg-primary text-primary-content",
    idle: "hover:bg-primary-content/8",
    selected: "bg-surface-2 text-foreground",
    divider: "bg-primary-content/20",
    // The theme's `--ring` is a mid blue chosen against the dark page;
    // on a `primary` bar — near-white on the dark theme — it measured
    // 2.68:1, under WCAG 1.4.11's 3:1 (`e2e/focus.spec.ts`). The bar's
    // own content colour is the one colour guaranteed to stand off it in
    // both themes.
    ring: "focus-visible:outline-primary-content",
  },
};

/**
 * Every toolbar item animates four things at two speeds: its colours on
 * the effects clock, and its size and corner radius on the spatial spring
 * — the current page's pill widening (`toolbarItemClasses`' doc) and the press
 * morph both move *shape*, which is what M3 Expressive's spatial springs
 * are for. One `transition-property` list, position-matched, for the
 * reason `PRESS_SHAPE_MORPH`'s own header gives: two transition utilities
 * on one element clobber each other outright.
 */
const TOOLBAR_ITEM_MOTION =
  "[transition-property:color,background-color,border-radius,width,height] " +
  "[transition-duration:var(--dur-fast),var(--dur-fast),var(--dur-spatial-fast),var(--dur-spatial-fast),var(--dur-spatial-fast)] " +
  "[transition-timing-function:var(--ease-out),var(--ease-out),var(--ease-spatial-fast),var(--ease-spatial-fast),var(--ease-spatial-fast)]";

/**
 * The geometry of one toolbar item, split into the two boxes M3 draws:
 * the **target** (what a finger or pointer hits) and the **container**
 * (what is painted). Every number is androidx's:
 *
 * - the target is 48×48 — `FloatingToolbarDefaults.ContentPadding`'s own
 *   doc names "the minimum touch target (48.dp)" as the thing its 8dp
 *   padding is sized around, and 8 + 48 + 8 is exactly the toolbar's
 *   64dp `ContainerHeight`;
 * - the container is 40×40, round — `SmallIconButtonTokens.ContainerHeight`
 *   and `ContainerShapeRound`, the icon button that sits in a toolbar;
 * - the icon is 24px — the same file's `IconSize`.
 *
 * The **current page** is the one thing drawn differently: a filled pill
 * 64 long on the toolbar's own axis, not a 40px disc. That is the M3
 * floating-toolbar sample's own emphasised item (`FloatingToolbarSamples.kt`
 * renders its one important action as `FilledIconButton(Modifier.width(64.dp))`
 * among plain `IconButton`s) applied to the one thing a navigation bar
 * has to emphasise. Its target grows with it, 64×48, so the pill is never
 * bigger than what answers a tap.
 *
 * The container's resting radius is `20px` — half its 40px short side,
 * which draws the same disc and the same stadium as `rounded-full` — and
 * not `rounded-full` itself, because `rounded-full` is
 * `calc(infinity * 1px)`, and a spring that overshoots between infinity
 * and 4px strobes: measured on this toolbar before the change, the
 * radius went round → square → round again → settled over ~400ms. A
 * finite radius interpolates as a radius.
 *
 * Pressed, the container's corners pull in to `--btn-press-radius` —
 * `calc(40px * 0.1)`, the circular ratio `PRESS_SHAPE_MORPH`'s own doc
 * sets for every bare icon control in this library, applied to this
 * control's own 40px box. androidx's `PressedContainerShape` is 8dp
 * (a fifth); `.btn-circle`'s gentler tenth is the house rule for a
 * circle, and a toolbar full of discs is a row of circles.
 */
function toolbarItemClasses(
  axis: "horizontal" | "vertical",
  active: boolean,
  palette: (typeof TOOLBAR_PALETTES)[SideNavToolbarVariant],
) {
  const along = axis === "horizontal";
  return {
    target: cn(
      "group flex shrink-0 items-center justify-center rounded-full",
      TOOLBAR_ITEM_MOTION,
      active ? (along ? "h-12 w-16" : "h-16 w-12") : "size-12",
      palette.ring,
    ),
    container: cn(
      "flex items-center justify-center rounded-[20px]",
      "[--btn-press-radius:calc(40px*0.1)] group-active:[border-radius:var(--btn-press-radius)]",
      TOOLBAR_ITEM_MOTION,
      active ? (along ? "h-10 w-16" : "h-16 w-10") : "size-10",
      active ? palette.selected : palette.idle,
    ),
  };
}

/**
 * One destination in a floating toolbar. Its own component rather than
 * `NavLink`'s `"rail"` variant, because the two no longer share a shape:
 * `"rail"` is still the in-flow `1024–1279px` icon rail of `"off-canvas"`
 * mode, a list row, and this is an M3 icon button.
 *
 * The label is still a native `title` on an `aria-hidden` wrapper and an
 * `sr-only` span on the anchor — `NavLink`'s own doc has the measurements
 * behind that, and they apply unchanged: the vertical toolbar is still a
 * scroll container, so anything drawn beside it would still be clipped.
 */
function ToolbarLink({
  item,
  active,
  axis,
  palette,
}: {
  item: NavItem;
  active: boolean;
  axis: "horizontal" | "vertical";
  palette: (typeof TOOLBAR_PALETTES)[SideNavToolbarVariant];
}) {
  const Icon = item.icon;
  const classes = toolbarItemClasses(axis, active, palette);
  return (
    <a href={item.href} aria-current={active ? "page" : undefined} className={classes.target}>
      {/* The `title` sits on a wrapper that fills the whole 48px target,
          not on the 40px container inside it — `NavLink`'s rail variant
          does the same, so a hover anywhere a tap would land answers with
          the label. */}
      <span
        title={item.label}
        aria-hidden="true"
        className="flex size-full items-center justify-center"
      >
        <span data-toolbar-item="" className={classes.container}>
          <Icon size={24} className="shrink-0" aria-hidden="true" />
        </span>
      </span>
      <span className="sr-only">{item.label}</span>
    </a>
  );
}

/**
 * The container both floating toolbars share: M3 Expressive's
 * `FloatingToolbar`, transcribed from `FloatingToolbarTokens.kt`
 * (`compose/material3/material3/…/tokens/`, token set `12_0_0`).
 *
 * - **64px across its short axis, fully round.** `ContainerHeight` 64dp,
 *   `ContainerShape` `CornerFull`.
 * - **8px of padding, 4px between items.** `ContainerLeadingSpace` /
 *   `ContainerTrailingSpace` 8dp, `ContainerBetweenSpace` 4dp.
 * - **16px from the screen edge.** `ContainerExternalPadding`, exposed as
 *   `FloatingToolbarDefaults.ScreenOffset`. The bottom offset adds
 *   `env(safe-area-inset-bottom)` on top, because on a phone with a home
 *   indicator 16px from the *viewport* edge lands on the gesture bar.
 * - **Opaque, no outline, no blur, no shadow.** The bar used to be
 *   `surface-2/90` with `backdrop-blur-md`, a hairline border and
 *   `--shadow-popover`; M3 has none of the four. androidx ships this
 *   toolbar at `ElevationTokens.Level0` and has since the component was
 *   introduced (checked against the history of `FloatingToolbar.kt`: the
 *   value has been `Level0` in every revision, first as
 *   `ContainerElevation` and, since the expanded/collapsed split, as
 *   `ContainerExpandedElevation` with a `// TODO read from token`). Only
 *   the with-FAB variant lifts to `Level1`, and this toolbar has no FAB.
 *
 * # What matching androidx costs, stated rather than hidden
 *
 * This bar is the one piece of permanent chrome in the library that
 * floats *unanchored* over content it knows nothing about, which is why
 * it used to carry the floating-layer shadow `theme.css` reserves for
 * such layers ("borders, not shadows, for cards/tables/panels — only
 * floating layers get one"). Without one, the container colour is the
 * only separation. On Android a `Level0` toolbar sits over a `Surface`
 * the same theme painted a tonal step darker; here it sits over whatever
 * a consumer's page scrolls under it, and in *either* theme the standard
 * bar is `surface-2` — the same fill as `Card` and `StatTile` (both
 * `bg-base-300`), measured 1.000:1 against them in dark and light alike —
 * so over those the standard bar's edge disappears and only its icons
 * remain. A shadow was weighed against that and dropped by the maintainer
 * (2026-09-24) in favour of M3's `Level0` exactly. A screen that scrolls
 * cards or stat tiles under the bar has `toolbarVariant="vibrant"`, whose
 * fill no surface uses.
 */
const TOOLBAR_CONTAINER = "fixed z-40 flex rounded-full p-2 gap-1";

/**
 * One labelled row in a `NavSheet` — M3's navigation-drawer item
 * (`NavigationDrawerTokens.kt`, `NavigationDrawerItem` in
 * `NavigationDrawer.kt`), used in both sheets because both hold the same
 * thing: destinations, with their labels back.
 *
 * - **56px tall, fully round** — `ActiveIndicatorHeight` 56dp,
 *   `ActiveIndicatorShape` `CornerFull`. Not the sidebar's `rounded-field`
 *   rectangle (`NavLink`'s doc has why that one is locked): the sheet is
 *   M3's component, and its current-page pill is the same shape as the
 *   toolbar's that opened it.
 * - **16px leading, 24px trailing, 12px from icon to label** — the item's
 *   own `padding(start = 16.dp, end = 24.dp)` and `Spacer(12.dp)`.
 * - **24px icon** — `IconSize`.
 * - **Label 14px medium** — `LabelTextFont` is `LabelLarge` (14/20,
 *   medium); `text-prose` (14/21) is this library's nearest rung.
 * - **Colours** — inactive icon and label are `OnSurfaceVariant`
 *   (`muted-foreground`); hover is the 8% state layer the toolbar items
 *   use; the current page is M3's `SecondaryContainer` pill drawn in
 *   `primary` instead — a library choice, the same one `Select`'s phone
 *   sheet and the toolbar make, because a tonal container is a hue here
 *   and would read as a status.
 *
 * A plain primary click closes the sheet before the browser follows the
 * link — androidx's `ModalNavigationDrawerSample` (`DrawerSamples.kt`)
 * closes the drawer in the item's `onClick` — so a client-side router
 * that intercepts the navigation does not leave the sheet open over the
 * new page. A modified click (new tab, new window) leaves it open,
 * because the page it is over has not changed. It is still a real anchor either way, for the same reason the
 * overflow menu's rows are (`HorizontalRail`'s doc).
 */
function NavSheetLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    onNavigate();
  }
  return (
    <a
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-full pr-6 pl-4 font-medium text-prose",
        "transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)]",
        active
          ? "bg-primary text-primary-content"
          : "text-muted-foreground hover:bg-foreground/8 hover:text-foreground",
      )}
    >
      <Icon size={24} className="shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">{item.label}</span>
    </a>
  );
}

/** One run of rows in a `NavSheet`, with the small-caps header the sidebar
 * gives the same group when it has one. */
interface NavSheetSection {
  key: string;
  label?: string | undefined;
  items: NavItem[];
}

function NavSheetList({
  section,
  currentPath,
  onNavigate,
}: {
  section: NavSheetSection;
  currentPath: string;
  onNavigate: () => void;
}) {
  const headerId = useId();
  return (
    <div className="flex flex-col">
      {section.label !== undefined && (
        // The sidebar's own group header, not M3's `TitleSmall` headline
        // (`NavigationDrawerTokens.HeadlineFont`) — a library choice: the
        // same group should read the same in the sidebar and in the sheet
        // that stands in for it.
        <p
          id={headerId}
          className="truncate px-4 pt-3 pb-1.5 text-caption text-subtle-foreground uppercase tracking-wide"
        >
          {section.label}
        </p>
      )}
      <ul
        aria-labelledby={section.label !== undefined ? headerId : undefined}
        className="flex flex-col"
      >
        {section.items.map((item) => (
          <li key={item.href}>
            <NavSheetLink
              item={item}
              active={isActive(item.href, currentPath)}
              onNavigate={onNavigate}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A pointer-down that belonged to a `Select` (or `DatePicker`) open inside
 * the sheet must close that popup alone, not the sheet — `drawer.tsx`'s
 * `keepOpenForSelect` has the measurement and the mechanism. Repeated here
 * rather than imported because `drawer.tsx` is re-exported whole from the
 * package root, and this handshake is not public API.
 *
 * Redundant today, and kept on purpose. `select-dismissal.ts` also
 * declines these events for *every* Radix layer from a window listener,
 * and with this handler removed the sheet's Select test in
 * `e2e/side-nav-account-sheet.spec.ts` stayed green (measured in review).
 * But that listener is keyed to Radix's internal event name, which its
 * own doc says goes quiet if a Radix release renames it; this prop is
 * Radix's documented API and does not.
 */
function keepOpenForPopup(event: CustomEvent<{ originalEvent: PointerEvent }>) {
  if (wasPointerDownUnderOpenSelect(event.detail.originalEvent)) event.preventDefault();
}

/**
 * The two containers, per `NavSheet` presentation. Written out in full
 * because Tailwind only generates classes it finds literally.
 */
const NAV_SHEET_SURFACE: Record<"bottom" | "side", string> = {
  // M3's modal bottom sheet (`SheetBottomTokens.kt`, `SheetDefaults.kt`):
  // top corners `CornerExtraLargeTop` (`--radius-sheet`, 28dp), a square
  // bottom edge, and at most `BottomSheetDefaults.SheetMaxWidth` (640dp)
  // wide, centred — which only matters if the window widens while it is
  // open, since the bar that opens it exists below 640px only. Fill,
  // height cap and elevation are the library's, and are `Select`'s phone
  // sheet's exactly, so a select opened over this sheet is visibly the
  // same material: `surface-2` rather than `SurfaceContainerLow`, `85dvh`,
  // and no `Level1` shadow — the scrim separates it.
  bottom: cn(
    "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85dvh] w-full max-w-[640px] flex-col",
    "rounded-t-sheet bg-surface-2 outline-none",
  ),
  // M3's modal navigation drawer (`NavigationDrawerTokens.kt`,
  // `DrawerDefaults` in `NavigationDrawer.kt`), from the leading edge:
  // full height; 360dp wide (`ContainerWidth`, `MaximumDrawerWidth`),
  // never under 240dp (`MinimumDrawerWidth`); `CornerLargeEnd` — 16dp on
  // the two trailing corners only, a literal because 16px is on no rung
  // of `theme.css`'s radius register (the same call `Select`'s selected
  // sheet row makes); and no shadow, which here *is* M3's —
  // `DrawerDefaults.ModalDrawerElevation` is `Level0`. Fill `surface-2`
  // rather than `ModalContainerColor`'s `SurfaceContainerLow`, as the
  // bottom sheet above.
  side: cn(
    "fixed inset-y-0 left-0 z-50 flex h-full w-[360px] min-w-[240px] max-w-full flex-col",
    "rounded-r-[16px] bg-surface-2 outline-none",
  ),
};

/**
 * What the floating toolbars open when there is something they cannot
 * show — the M3 modal sheet behind the "More" control at the toolbar's
 * end. It exists because `accountSlot` had nowhere to go below the
 * sidebar (vaam-apps/ui#36): its markup is arbitrary — a radio group, a
 * sign-out form, a theme switch — and a `role="menu"` may hold only
 * `menuitem`s, so the dropdown the phone bar already had could not carry
 * it. A sheet can hold anything.
 *
 * # Which sheet, and why they differ
 *
 * - **The phone bar opens a modal bottom sheet** (`presentation="bottom"`),
 *   rising from the edge the bar sits on, under the thumb that tapped it.
 *   It holds the destinations that did not fit in the bar, then
 *   `footerItems`, then `accountSlot` — what the old menu held, plus the
 *   account block.
 * - **The vertical rail opens a modal navigation drawer from the leading
 *   edge** (`presentation="side"`). A bottom sheet here would be a strip
 *   capped at 640dp (`SheetMaxWidth`) and centred on the bottom edge — on
 *   a 1100px window its nearest edge is 230px in from the side the rail,
 *   and the control that opened it, are on.
 *   androidx's own answer for a rail that needs more room is to expand it
 *   modally from the edge it sits on: `ModalWideNavigationRail`
 *   (`WideNavigationRail.kt`), which "blocks interaction with the rest of
 *   an app's content with a scrim". The expanded form of *this* rail is
 *   M3's modal navigation drawer, whose tokens it takes. It holds what the
 *   sidebar holds, labelled — every destination under its group's header,
 *   the footer rows, then `accountSlot` — because the rail shows every
 *   destination already, but only as an icon, and a hover `title` does not
 *   exist on a touch tablet. Which contents, and the drawer rather than a
 *   bottom sheet, are this library's reading of those sources rather than
 *   anything androidx states for a floating toolbar.
 *
 * # Engine: vaul, as `DetailDrawerContent` uses it
 *
 * `vaul`'s `Drawer` (Radix `Dialog` underneath) rather than Headless UI's
 * `Dialog`, for two reasons already paid for elsewhere in this library:
 *
 * - **It is the engine the library's drawers already use.** A Headless UI
 *   dialog inside a vaul drawer fights it for focus and cannot be operated
 *   (`MoreDetailDrawer`'s doc); two Radix layers stack instead. That is
 *   the mechanism, not something this component's tests exercise: what
 *   they exercise is the containing-block half below, with `SideNav`
 *   inside a `will-change: transform` wrapper. A `SideNav` mounted inside
 *   an open *modal* drawer is a different question, and the answer is
 *   that "More" cannot be reached there at all, exactly like every other
 *   control on the rails: they are portalled out of that drawer and sit
 *   under its modality. Measured in review with the floating `SideNav`
 *   inside an open `DrawerContent`, at 375 and 1100px: Radix had set
 *   `pointer-events: none` on `body`, and the hit test at More's centre
 *   returned the consumer's drawer or its overlay. A consumer who nests
 *   `SideNav` in a drawer uses `smallScreen="off-canvas"`
 *   (`SideNavProps.smallScreen`).
 * - **It escapes containing blocks by portal.** `DrawerPrimitive.Portal`
 *   puts the sheet in `document.body`, beside the rails. That is not
 *   optional twice over: a consumer's `transform`/`will-change` ancestor
 *   (vaul's own drawer — `SideNavProps.smallScreen`'s doc) would capture a
 *   `fixed` sheet, and so would **the rail it opens from**, which is
 *   itself `translate`d to centre it (`-translate-x-1/2`,
 *   `-translate-y-1/2`) — a `fixed` sheet rendered inside the rail would
 *   be laid out against the 64px toolbar.
 *
 * What that buys, as the library's other sheets do it: focus moves into
 * the sheet on open (`onOpenAutoFocus`) and is trapped there; Escape and
 * a tap on the scrim close it; focus returns to the "More" control; the
 * page behind is scroll-locked, `aria-hidden` and inert to the pointer; a
 * `Select` inside closes alone (`keepOpenForPopup`). What it costs is the
 * drawer rule: a Headless UI `Dialog` opened from inside the sheet — a
 * `ConfirmDialog` behind Sign out — opens under the sheet's scrim, where a
 * pointer cannot reach it (`SideNavProps.accountSlot` has the
 * measurement), so an account block confirms with `InlineConfirm`. The
 * bottom sheet
 * drags from its handle only (`handleOnly`, as `DetailDrawerContent`), so
 * a drag inside the account block — selecting the email — is not a
 * dismissal. vaul's own release thresholds decide a drag, not androidx's
 * 56dp/125dp (`SelectModalHandle` has those); a library choice, shared
 * with `DetailDrawerContent`. The drawer has no handle and does not
 * drag — M3's can be swiped shut; here the scrim and Escape close it, a
 * library choice that keeps vaul's drag to the one sheet with a handle.
 *
 * The sheet is named "More", after the control, with a visually hidden
 * title: M3 draws neither sheet with a headline.
 */
function NavSheet({
  presentation,
  sections,
  accountSlot,
  currentPath,
  trigger,
}: {
  presentation: "bottom" | "side";
  sections: NavSheetSection[];
  accountSlot: ReactNode;
  currentPath: string;
  trigger: ReturnType<typeof toolbarItemClasses>;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const shown = sections.filter((section) => section.items.length > 0);

  return (
    <DrawerPrimitive.Root
      open={open}
      onOpenChange={setOpen}
      // vaul's `direction` is not a CSS concern: it picks the entrance
      // keyframes and the drag axis (`drawer.tsx`'s header has the
      // detail), so each presentation passes its own.
      direction={presentation === "bottom" ? "bottom" : "left"}
      handleOnly
    >
      <DrawerPrimitive.Trigger aria-label="More" data-side-nav-more="" className={trigger.target}>
        <span aria-hidden="true" data-toolbar-item="" className={trigger.container}>
          <MoreVertical size={24} aria-hidden="true" />
        </span>
      </DrawerPrimitive.Trigger>
      <DrawerPrimitive.Portal>
        {/* `ScrimTokens`: M3 dims the page behind a modal sheet. `bg-scrim`
            is the theme's own per-mode scrim, as every sheet here. */}
        <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim" />
        <DrawerPrimitive.Content
          data-side-nav-sheet={presentation}
          // No description: the rows are the content. Radix warns unless
          // the attribute is opted out explicitly, which this does.
          aria-describedby={undefined}
          onPointerDownOutside={keepOpenForPopup}
          // Focus lands on the sheet itself, not on its first control.
          // Radix's default skips links (`removeLinks` in its `FocusScope`)
          // and so put focus on the account block's first control — the
          // radio group, halfway down the sheet, in `AccountSheetOnAPhone`
          // — which a screen reader then starts reading from. On the
          // sheet, it announces "More, dialog" and reads from the top, and
          // the first Tab reaches the first row. Radix's `Content` is
          // already `tabIndex={-1}`, so it can take focus.
          //
          // This handler is also why the root needs no `autoFocus`. vaul
          // cancels Radix's open auto-focus unless that prop is set, but
          // it calls this first (`onOpenAutoFocus` in
          // `vaul/dist/index.mjs`), and this focuses the sheet either way;
          // the prop was here once, and removing it left the keyboard test
          // in `e2e/side-nav-account-sheet.spec.ts` green.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement | null)?.focus({ preventScroll: true });
          }}
          className={NAV_SHEET_SURFACE[presentation]}
        >
          <DrawerPrimitive.Title className="sr-only">More</DrawerPrimitive.Title>
          {presentation === "bottom" && (
            // M3's `DragHandle` (`SheetDefaults.kt`): 32×4
            // (`SheetBottomTokens.DockedDragHandleWidth`/`Height`) in
            // `OnSurfaceVariant`, 22dp above and below
            // (`DragHandleVerticalPadding`). Every property vaul's injected
            // `[data-vaul-handle]` rule also sets is `!`, for the reason
            // `DetailDrawerContent`'s handle records: that rule is
            // unlayered, so it beats a plain utility. 18px of margin below
            // plus the list's 4px of top padding make M3's 22dp to the
            // first row; the 4px is where that row's focus ring (2px
            // outline, 2px offset) draws, inside the list's scroll box
            // rather than clipped by it.
            <DrawerPrimitive.Handle className="mt-[22px] mb-[18px] h-1! w-8! shrink-0 bg-muted-foreground! opacity-100!" />
          )}
          <div
            className={cn(
              // `select-text`: vaul makes its drawer `user-select: none`
              // under a fine pointer, which would leave the signed-in
              // email uncopyable. Set on this child because vaul's rule
              // on the drawer itself is unlayered and wins there.
              "flex min-h-0 flex-1 select-text flex-col gap-2 overflow-y-auto overscroll-contain px-3",
              // M3's `ItemPadding` is 12dp either side; the bottom inset
              // keeps the last row clear of a home indicator.
              presentation === "bottom"
                ? "pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
                : "py-3",
            )}
          >
            {shown.map((section, index) => (
              <div
                key={section.key}
                // A hairline before a run with no header of its own — the
                // footer, or the overflow after nothing — and none before
                // a group, whose header already separates it: the
                // sidebar's own reading of the same sections.
                className={cn(
                  index > 0 && section.label === undefined && "border-edge-subtle border-t pt-2",
                )}
              >
                <NavSheetList section={section} currentPath={currentPath} onNavigate={close} />
              </div>
            ))}
            {accountSlot != null && (
              // Rendered as-is, in the sidebar's own position — last, under
              // a hairline — and inset to line up with the rows' icons
              // (12px sheet padding + the row's 16px leading space).
              <div
                data-side-nav-account=""
                className={cn("px-4 py-3", shown.length > 0 && "border-edge-subtle border-t")}
              >
                {accountSlot}
              </div>
            )}
          </div>
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}

/**
 * `smallScreen="floating"`'s replacement for the off-canvas accordion
 * below `lg`, and the whole nav when `collapsed`: M3 Expressive's
 * *vertical* floating toolbar, `fixed`, vertically centred, 16px from the
 * left edge, layered over the page instead of hidden behind a hamburger
 * the caller has to build and the reader has to find first. `TOOLBAR_CONTAINER`'s
 * doc has the geometry and the elevation; the orientation is the only
 * thing this function adds.
 *
 * # Why every group's items are flattened
 *
 * A 64px toolbar has no room for a small-caps group header — in the
 * off-canvas tree, "Messaging" costs a whole row before "Composer" ever
 * appears; here that row would cost as much as an icon and deliver
 * nothing a hover/`title` doesn't already. So every group's `items` are
 * concatenated in group order into one icon list with no divider between
 * groups. The footer keeps its divider: it is the one grouping that
 * carries meaning here ("administrivia, not content").
 *
 * # Where `accountSlot` goes
 *
 * Not into the toolbar: there is no room for an email address and a
 * sign-out button at 64px. With an `accountSlot`, the toolbar ends in a
 * "More" control instead, after the footer rows and under the same
 * divider — the position the account block has at the foot of the
 * sidebar, and the position the phone bar's own overflow control has at
 * the end of its row. It opens `NavSheet`'s modal navigation drawer, which
 * carries the whole nav labelled and then the account block (its doc has
 * why a drawer, from this edge, with that content). Without an
 * `accountSlot` there is nothing the toolbar cannot show, and no control
 * is added — this toolbar is unchanged for a caller who passes none.
 *
 * This section used to be "Why `accountSlot` never appears here", and
 * told a caller who needed the account block on a tablet to fall back to
 * `smallScreen="off-canvas"` — which, for the default floating mode, left
 * nothing between 640 and 1279px, nor at any width when `collapsed`
 * (vaam-apps/ui#36).
 *
 * # Why it scrolls, and why the label survives that
 *
 * `max-h-[80vh] overflow-y-auto` caps the toolbar at something that
 * always leaves room above and below it. `overflow-x-hidden` pins the
 * other axis, which `overflow-y: auto` would otherwise force to `auto`
 * too — the stray-scrollbar class of bug this file exists to keep closed.
 * Clipping an overflow axis is exactly what broke daisyUI's `.tooltip`
 * here once (`NavLink`'s comment has the measurements), and a native
 * `title` does not care, because the browser paints it outside the page.
 *
 * # Why this component is never mounted directly
 *
 * `SideNav` always goes through `FloatingRailPortal`, which moves this
 * markup to `document.body` so `fixed` resolves against the viewport
 * regardless of what the caller wrapped `SideNav` in
 * (`SideNavProps.smallScreen`'s doc has the full reasoning).
 */
function FloatingRail({
  topItem,
  groups,
  footerItems,
  currentPath,
  accountSlot,
  collapsed,
  toolbarVariant,
}: {
  topItem: NavItem;
  groups: NavGroup[];
  footerItems: NavItem[];
  currentPath: string;
  accountSlot: ReactNode;
  collapsed: boolean;
  toolbarVariant: SideNavToolbarVariant;
}) {
  const palette = TOOLBAR_PALETTES[toolbarVariant];
  const destinations = [topItem, ...groups.flatMap((group) => group.items)];
  const hasAccount = accountSlot != null;

  return (
    // A `<nav>` for the same reason `HorizontalRail` is one: between
    // `sm` and the sidebar, this toolbar is the navigation and the
    // in-flow `<nav>` is `display: none`.
    <nav
      aria-label="Primary"
      // A stable hook, not a test-only wart. This subtree is portalled to
      // `document.body`, so it is the one part of `SideNav` a caller
      // cannot reach through the element they rendered — `side-nav.portal.test.tsx`
      // needs it to assert the portal target, and a consumer needs it to
      // reach past a portal for the same reason (an e2e selector, or a
      // `body > [data-floating-rail]` override). Selecting on the layout
      // classes instead would make a styling change silently break both.
      data-floating-rail=""
      data-toolbar-variant={toolbarVariant}
      className={cn(
        TOOLBAR_CONTAINER,
        palette.container,
        "-translate-y-1/2 top-1/2 left-4 w-16 flex-col items-center",
        "max-h-[80vh] overflow-y-auto overflow-x-hidden",
        // No visible scrollbar. With classic (non-overlay) scrollbars —
        // Windows, or macOS set to "always" — the 48px items and the 16px
        // of padding leave nowhere for one: measured at 900×500 with the
        // nav taller than 80vh, `clientWidth` 49 against `scrollWidth` 57,
        // the items pushed off-centre and the first one's focus ring
        // clipped under the bar. It still scrolls by wheel, touch and
        // keyboard; headless Chromium hides scrollbars, which is why no
        // e2e run ever showed this.
        "[scrollbar-width:none]",
        // Vertical band: `640px` up to wherever the sidebar takes over.
        // Below `sm` the horizontal toolbar replaces it — a 64px column
        // down the side of a 375px phone spends 17% of the width on
        // chrome, and does it in the thumb's dead zone.
        "hidden sm:flex",
        // Collapsed, the sidebar never renders, so this toolbar is the
        // navigation at every width above `sm` — including `≥1280px`,
        // where it would otherwise hand over.
        collapsed ? "sm:flex" : "xl:hidden",
        // Gone while a `SelectModal` is open — the one select that is a
        // modal sheet (or search view) at desktop widths. Its scrim is a
        // shadow, which cannot catch a tap, and this rail is portalled to
        // `body`, which the plain engine's inert (Headless UI's, stopping
        // at `body`) never reaches — so it stayed clickable, and
        // navigable, under the scrim. Same mechanism as `HorizontalRail`'s
        // rule, keyed to the presentation rather than the width.
        '[body:has([data-select-presentation="modal"])_&]:invisible',
      )}
    >
      {destinations.map((item) => (
        <ToolbarLink
          key={item.href}
          item={item}
          active={isActive(item.href, currentPath)}
          axis="vertical"
          palette={palette}
        />
      ))}
      {(footerItems.length > 0 || hasAccount) && (
        <div className={cn("my-1 h-px w-6 shrink-0", palette.divider)} aria-hidden="true" />
      )}
      {footerItems.map((item) => (
        <ToolbarLink
          key={item.href}
          item={item}
          active={isActive(item.href, currentPath)}
          axis="vertical"
          palette={palette}
        />
      ))}
      {hasAccount && (
        <NavSheet
          presentation="side"
          // The sidebar's content, in the sidebar's order and with its
          // group headers — `NavSheet`'s doc has why all of it.
          sections={[
            { key: "top", items: [topItem] },
            ...groups.map((group) => ({
              key: `group:${group.label}`,
              label: group.label,
              items: group.items,
            })),
            { key: "footer", items: footerItems },
          ]}
          accountSlot={accountSlot}
          currentPath={currentPath}
          // Never "current": every destination is on this toolbar already,
          // so the current page always has its own pill.
          trigger={toolbarItemClasses("vertical", false, palette)}
        />
      )}
    </nav>
  );
}

/** How many destinations the horizontal toolbar shows before the rest go
 * behind the overflow menu. Four, and the number is a width measurement
 * rather than a taste one. At M3's geometry (`toolbarItemClasses`) the
 * current page's 64px pill, four 48px targets (three slots plus the menu
 * button), four 4px gaps and the bar's own 16px of padding come to 288px.
 * At 375px — the narrowest phone this library targets — that leaves the
 * toolbar 43px clear of each edge, which reads as a floating toolbar.
 * Five slots would be 340px, leaving 17px — barely more than the 16px
 * screen offset M3 asks for, so the bar reads as a docked one that lost
 * its corners — and six does not fit at all without shrinking targets
 * below 48px, which is the one dimension not available to trade. */
const HORIZONTAL_RAIL_SLOTS = 4;

/**
 * The tiny-screen shape: M3 Expressive's *horizontal* floating toolbar,
 * along the bottom, four destinations and an overflow menu for the rest.
 * `TOOLBAR_CONTAINER`'s doc has the geometry.
 *
 * # Why the vertical toolbar could not simply get narrower
 *
 * A 64px column is 17% of a 375px viewport, permanently, down the side
 * the writing starts on — and it sits where a thumb cannot comfortably
 * reach on a phone held one-handed. Both problems are about the *axis*,
 * not the width, so the fix is to turn the toolbar rather than shrink it.
 * Along the bottom it costs height in the region every mobile OS already
 * reserves for chrome, and it lands under the thumb.
 *
 * # Why four, and why a menu rather than scrolling
 *
 * A strip of icons that scrolls sideways with no scrollbar and no
 * affordance is the pattern where destinations simply go unfound, and it
 * is also the exact class of unwanted horizontal scroll this library has
 * spent two rounds removing. A menu is the honest version: everything
 * past the fourth slot sits *visibly* behind one control rather than
 * invisibly past an edge — the same overflow androidx's own toolbar
 * samples use (`AppBarRow`'s overflow indicator, a vertical ellipsis).
 *
 * The menu's rows are real anchors (`DropdownMenuLinkItem`), not buttons
 * that navigate — a destination behind a menu must still support
 * middle-click, cmd-click and "copy link address".
 *
 * # What goes where
 *
 * Order is `topItem`, then every group's items flattened. The first four
 * are slots; the remainder and **all** footer items go to the menu.
 * Footer items are "administrivia, not content" per this file's own doc,
 * so they lose to any destination for a slot, and they keep their labels
 * in the menu where there is room for them.
 *
 * # With an `accountSlot`, the menu becomes a sheet
 *
 * The account block has to live behind the same control, and a
 * `role="menu"` cannot hold it: its children may only be `menuitem`s (and
 * groups of them), so a radio group or a sign-out form inside one is
 * invalid ARIA and, in Headless UI's `Menu`, keyboard-unreachable: arrow
 * keys move only between items, and Tab inside the items is
 * `preventDefault`ed and closes the menu (`menu/menu.js`). So with an
 * `accountSlot` the control is labelled "More" and opens `NavSheet`'s
 * modal bottom sheet instead: the same overflow destinations and footer
 * items as labelled rows, then the account block rendered as-is. The
 * control is shown whenever there is overflow **or** an account block, so
 * a nav of four destinations with an `accountSlot` gains it — the bar is
 * then as wide as any bar with an overflow, 288px.
 *
 * Without an `accountSlot` it stays the dropdown menu it was, named "More
 * destinations". That is deliberate rather than left over: for a list of
 * links, an M3 menu is what androidx's own toolbar overflow uses
 * (`AppBarRow`'s overflow indicator, above), `menu`/`menuitem` is the
 * right semantics for it, and a consumer who passes no `accountSlot` sees
 * no change at all. The sheet replaces it only when there is something a
 * menu cannot hold.
 */
function HorizontalRail({
  topItem,
  groups,
  footerItems,
  currentPath,
  accountSlot,
  toolbarVariant,
}: {
  topItem: NavItem;
  groups: NavGroup[];
  footerItems: NavItem[];
  currentPath: string;
  accountSlot: ReactNode;
  toolbarVariant: SideNavToolbarVariant;
}) {
  const palette = TOOLBAR_PALETTES[toolbarVariant];
  const destinations = [topItem, ...groups.flatMap((group) => group.items)];
  const slots = destinations.slice(0, HORIZONTAL_RAIL_SLOTS);
  const overflowDestinations = destinations.slice(HORIZONTAL_RAIL_SLOTS);
  const overflow = [...overflowDestinations, ...footerItems];
  // If the current page is behind the menu, the menu button is what is
  // "current" as far as anyone scanning the toolbar can tell — so it
  // takes the current page's pill rather than leaving nothing marked.
  const activeIsHidden = overflow.some((item) => isActive(item.href, currentPath));
  const more = toolbarItemClasses("horizontal", activeIsHidden, palette);

  return (
    // A `<nav>`, not a `<div>`. Below `sm` this toolbar *is* the
    // navigation — the in-flow `<nav>` is `display: none` at that width,
    // so a plain div here left a phone with no navigation landmark at all
    // and every link sitting outside any landmark (axe `region`, caught
    // by `a11y.test.tsx`'s `SideNav` block, which audits `document.body`
    // precisely because these rails portal out of the component).
    //
    // All three shapes carry the same `aria-label="Primary"`, and exactly
    // one is ever displayed — the gates are complements, measured in a
    // real browser by `e2e/side-nav-bands.spec.ts` (see `SideNav`'s
    // "Landmarks" doc for the one that was not).
    <nav
      aria-label="Primary"
      data-floating-rail=""
      data-floating-rail-axis="horizontal"
      data-toolbar-variant={toolbarVariant}
      className={cn(
        TOOLBAR_CONTAINER,
        palette.container,
        // `left-1/2 -translate-x-1/2` rather than `inset-x-4`: the toolbar
        // is content-width, so stretching it edge to edge would make a
        // three-item nav look like a broken five-item one.
        "-translate-x-1/2 left-1/2 h-16 items-center",
        "bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] max-w-[calc(100vw-2rem)]",
        // Below `sm` only — above it the vertical toolbar takes over.
        "sm:hidden",
        // Gone while any `Select` is open below `sm` — its phone sheet,
        // its full-screen search view, or a `SelectDropdown` (each marks
        // its popup `data-select-content`, and unmounts it on close). The
        // sheet or view is full-width on the bottom edge, so it normally
        // covers this toolbar anyway — but it is not portalled, so its `z-50` only
        // counts inside whatever stacking context the `Select` sits in,
        // and inside a `sticky`, `isolate`d (every `InstrumentPanel`) or
        // transformed ancestor this `fixed z-40` bar, portalled to `body`,
        // paints over the sheet's bottom 80px, above its scrim — seen:
        // the last option drawn under the bar. Nor is the bar `inert`
        // then: Headless UI's `useInertOthers` stops climbing at `body`,
        // so body-level portals stay live, and a tap on the option drawn
        // underneath navigated instead. `invisible` removes it from both
        // painting and hit-testing.
        "max-sm:[body:has([data-select-content])_&]:invisible",
      )}
    >
      {slots.map((item) => (
        <ToolbarLink
          key={item.href}
          item={item}
          active={isActive(item.href, currentPath)}
          axis="horizontal"
          palette={palette}
        />
      ))}
      {accountSlot != null ? (
        <NavSheet
          presentation="bottom"
          sections={[
            { key: "overflow", items: overflowDestinations },
            { key: "footer", items: footerItems },
          ]}
          accountSlot={accountSlot}
          currentPath={currentPath}
          trigger={more}
        />
      ) : (
        overflow.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="More destinations" className={more.target}>
              <span aria-hidden="true" data-toolbar-item="" className={more.container}>
                <MoreVertical size={24} aria-hidden="true" />
              </span>
            </DropdownMenuTrigger>
            {/* `anchor="top end"`: this toolbar is pinned to the bottom of
              the viewport, so `DropdownMenuContent`'s own `bottom start`
              default would open the menu off-screen.
              `[--anchor-gap:12px]` rather than the menu's own 4px: the
              gap is measured from the trigger, and the trigger sits 8px
              inside the toolbar's padding, so 4px left the menu's bottom
              edge overlapping the bar by 4px. */}
            <DropdownMenuContent anchor="top end" className="[--anchor-gap:12px]">
              {overflow.map((item) => (
                <DropdownMenuLinkItem
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item.href, currentPath) ? "page" : undefined}
                  className={
                    isActive(item.href, currentPath) ? "bg-base-300 font-medium" : undefined
                  }
                >
                  <item.icon size={16} className="shrink-0" aria-hidden="true" />
                  <span className="min-w-0 truncate">{item.label}</span>
                </DropdownMenuLinkItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      )}
    </nav>
  );
}

/**
 * `FloatingRail`, portaled to `document.body` — and the one place in this
 * file where "everything is in the server-rendered HTML on first paint"
 * (the module doc's headline claim, see `SideNav` below) is not true.
 *
 * # Why a portal needs a mount gate, and what that costs
 *
 * `createPortal` needs a real DOM node to portal into, and `document`
 * does not exist while this component renders on the server. There is no
 * way to hand `createPortal` a body element that has not been created
 * yet — so, unlike every other band in this file, `FloatingRail` cannot
 * be part of the server-rendered markup at all when `smallScreen` is
 * `"floating"`. This function is the containment for that: it renders
 * `null` until an effect confirms a client has mounted it, then portals.
 * `useState` + `useEffect` rather than some cleverer check, because the
 * question is not "what breakpoint are we at" (still answered by CSS
 * everywhere else in this file) but "does `document.body` exist yet" —
 * true on the server and during the first client render (so server and
 * client markup match, no hydration warning), false only after that
 * first commit, which is exactly when the effect flips it.
 *
 * The cost is real and worth stating plainly rather than glossing over:
 * for a `curl` of the page, or for a client whose JS fails to load or
 * has not finished hydrating yet, `smallScreen="floating"` mode has *no
 * small-screen navigation at all* for that window — the same gap this
 * file was rewritten to eliminate when it dropped
 * `next/dynamic({ ssr: false })`. It is a narrower version of that same
 * gap, not the same size: scoped to one band (the floating rail, not the
 * whole sidebar) and to one mode (`"floating"`, not every render), and
 * bounded by hydration rather than a lazy chunk's network round trip.
 * But it is not zero, and a caller who cannot accept any gap at all below
 * `lg` — a bot that only ever sees first-paint HTML, or a strict
 * no-JS requirement — should reach for `smallScreen="off-canvas"`, which
 * has none: it renders with the rest of the tree, no portal, no gate.
 *
 * # Why the `<nav>` count stays exactly one despite the portal
 *
 * The portal moves DOM out of `SideNav`'s own subtree — in the live DOM
 * tree, this rail ends up a descendant of `document.body`, a sibling of
 * `SideNav`'s ancestors, not a descendant of the `<nav>` element `SideNav`
 * renders. That sounds like it could produce a second landmark, so it was
 * checked rather than assumed — and the answer changed. This paragraph
 * used to say `FloatingRail` rendered a `<div>`, so the portal could not
 * add a second landmark. That was true and it was also the bug: below
 * `sm` the in-flow `<nav>` is `display: none`, so a phone got its
 * navigation in a plain div, outside any landmark at all. `a11y.test.tsx`
 * found it by auditing `document.body`, which it has to do precisely
 * because a portal escapes the host every other fixture is audited in.
 *
 * So all three shapes are `<nav aria-label="Primary">` now, and there are
 * three of them in the DOM at once. That is safe only because exactly one
 * is ever displayed — the breakpoint gates are complements.
 * `side-nav.portal.test.tsx` pins the two rails' gates as class strings,
 * which is all jsdom can see; whether exactly one is *exposed* is measured
 * in Chromium by `e2e/side-nav-bands.spec.ts`, because the class-string
 * version passed for two releases while the in-flow `<nav>` was a second
 * exposed landmark (vaam-apps/ui#16, `SideNav`'s "Landmarks" doc).
 */
function FloatingRailPortal({
  collapsed,
  ...props
}: {
  topItem: NavItem;
  groups: NavGroup[];
  footerItems: NavItem[];
  currentPath: string;
  accountSlot: ReactNode;
  collapsed: boolean;
  toolbarVariant: SideNavToolbarVariant;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  // Both rails are portalled and both are always in the DOM; CSS decides
  // which one is visible, exactly as `NavRow` and `GroupSection` do for
  // their own two shapes. That is deliberate rather than lazy: choosing
  // in JS means reading a viewport width, which means the server cannot
  // know it, which means a flash of the wrong rail on every load. The
  // cost is one extra copy of the links in the markup, and `display:
  // none` keeps the hidden copy out of the accessibility tree entirely,
  // so a screen reader still reaches each destination exactly once.
  return createPortal(
    <>
      <HorizontalRail {...props} />
      <FloatingRail {...props} collapsed={collapsed} />
    </>,
    document.body,
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
 * match it) — entirely CSS-driven (`sm:`/`xl:` Tailwind variants), never a
 * JS breakpoint read.
 *
 * **The band table changed in 0.1.2, and the old shape is the reason for
 * the current one.** There used to be a fourth band: an in-flow 64px icon
 * rail from `1024–1279px`. It was the only shape that took space out of
 * the page while its neighbours floated over it, so a caller's layout
 * could suit the rail or the sidebar but not both — and at exactly 1024px
 * a layout built for the floating rail got a full-height strip wherever
 * `SideNav` sat in its DOM, which in practice meant below all the
 * content. It is gone from `"floating"` mode and survives only in
 * `"off-canvas"`, where every band is in flow anyway.
 *
 * Default (`smallScreen="floating"`):
 *   - `<640px`: M3's horizontal floating toolbar along the bottom — four
 *     destinations and an overflow menu (`HorizontalRail`). A 64px column
 *     is 17% of a 375px screen and sits where a thumb cannot reach, so
 *     the toolbar turns rather than shrinks.
 *   - `640–1279px`: M3's vertical floating toolbar, 16px off the left
 *     edge (`FloatingRail`), label on hover via a native tooltip — hover only,
 *     and a keyboard user gets the same label from the row's `sr-only`
 *     text, which is what a screen reader reads and what focus announces.
 *   - `≥1280px`: the full sidebar with labels, in flow — the one shape
 *     that takes a lane. With `collapsed`, this band uses the vertical
 *     rail too, which is the only version that gives the content its
 *     width back.
 *
 * With an `accountSlot`, both toolbars end in a "More" control that opens
 * an M3 modal sheet holding the account block — a bottom sheet from the
 * phone bar, a navigation drawer from the vertical rail (`NavSheet`) — so
 * the account block is reachable at every width, not only the sidebar's.
 *
 * Opt-in `smallScreen="off-canvas"` is unchanged: the off-canvas tree
 * below `lg` (full labels, collapsible accordion groups) for a caller
 * that already wraps this component in its own drawer, then the
 * `1024–1279px` in-flow icon rail, then the sidebar.
 *
 * # Landmarks
 *
 * All three floating-mode shapes are `<nav aria-label="Primary">`, so
 * three exist in the DOM at once. That is safe only because exactly one
 * is ever displayed — the gates are complements — and `display: none`
 * removes a subtree from the accessibility tree, so a hidden band is
 * genuinely absent rather than merely invisible.
 *
 * For two releases that paragraph was true of the two rails and false of
 * this element: its gate was `xl:flex` with no unprefixed `hidden`, so
 * below `xl` it was a zero-width `display: block` box — still a landmark,
 * and so two `Primary` landmarks at every width under 1280px
 * (vaam-apps/ui#16). `side-nav.portal.test.tsx` pinned the complementarity
 * on the two rails' class strings and never looked at this one, and jsdom
 * could not have seen the result anyway. The guard now is a real browser:
 * `e2e/side-nav-bands.spec.ts` counts the exposed `Primary` landmarks and
 * runs axe's `landmark-unique` at 375, 700, 1100 and 1280px, and was seen
 * failing at the first three before the fix.
 *
 * This used to read "there is only ever one `<nav>` element in this file,
 * full stop", and that was true right up until it was the bug: below
 * `sm` the in-flow `<nav>` is `display: none`, so a phone's navigation
 * sat in a plain portalled `<div>`, outside any landmark. See
 * `FloatingRailPortal`.
 *
 * `smallScreen` still decides, per render, which subtree is mounted at
 * all — the off-canvas tree is never mounted in `"floating"` mode and the
 * rails are never mounted in `"off-canvas"` mode — so there is never a
 * moment with two competing small-screen trees.
 *
 * This means every shape *except the rails* is present in the
 * server-rendered HTML on first paint: the `≥1280px` full sidebar, and —
 * for a caller who opts into `smallScreen="off-canvas"` — its icon-rail
 * band and off-canvas accordion tree,
 * all render with no JS at all. No `next/dynamic({ ssr: false })`, no
 * client-only mount flash, for any of those. Verify that directly, not by
 * trusting this comment: `curl` a page rendered with `smallScreen`
 * omitted or set to `"off-canvas"`, and grep the raw HTML for a nav
 * item's label.
 *
 * The one exception is `FloatingRail` in the default `"floating"` mode.
 * It is portaled to `document.body`, and `document` does not exist on the
 * server, so it cannot be part of that same server-rendered HTML — it is
 * mount-gated instead and appears only after the client hydrates.
 * `FloatingRailPortal`'s doc has the full reasoning and, plainly, the
 * cost: this is a real, narrow regression of the property above, not a
 * quiet one.
 */
export function SideNav({
  topItem,
  groups,
  footerItems,
  currentPath,
  accountSlot,
  smallScreen = "floating",
  collapsed,
  toolbarVariant = "standard",
  className,
}: SideNavProps) {
  // In floating mode the in-flow tree exists only at `xl`. This comment
  // used to say the `<nav>` itself already knew that; it did not (#16 —
  // see its own class list below), and neither did its children: a
  // wrapper with `px-2` lays out whether or not everything inside it is
  // `display: none`. Measured: at 375px and 900px the in-flow nav was a
  // **16px wide by 510px tall** box with zero visible descendants, and at
  // 1262px a 40px one painting two `border-t` hairlines beside the
  // floating rail. This file's own comment says this element "must not
  // draw a box of its own down here"; it was drawing a thin one.
  const inFlow = smallScreen === "floating" ? "hidden xl:flex" : "flex";
  // Normalised once, so every `!= null` below — the rails', the sheet's,
  // this sidebar's — means "there is an account block" (`hasAccountBlock`).
  const account = hasAccountBlock(accountSlot) ? accountSlot : undefined;

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
          : // Floating: below `lg` this element renders no visible band of
            // its own at all — `FloatingRailPortal` moves the pill's
            // markup to `document.body`, so nothing below `lg` is even a
            // descendant of this `<nav>` any more. So *this* element must
            // not draw a box of its own down here — no background, no
            // padding, no forced height — or it becomes a full-width,
            // empty, coloured strip sitting uselessly wherever `SideNav`
            // was mounted, doing nothing (the rail floats independently,
            // wherever `document.body` puts it). It becomes the real
            // rail/sidebar box starting at `lg`, identically to the
            // off-canvas branch.
            // `xl:`, not `lg:`. The in-flow box now appears only where
            // the *sidebar* appears; the `1024–1279px` band that used to
            // draw a 64px in-flow icon rail is served by the floating
            // rail instead. Collapsed, it never appears at all.
            //
            // The unprefixed `hidden` is the half that was missing
            // (vaam-apps/ui#16). Every other utility here is `xl:`, so
            // below `xl` this `<nav>` had no display utility at all and
            // fell back to the UA's `display: block` — an empty, zero-width
            // box, but a box, and so a second `navigation "Primary"`
            // landmark beside whichever rail was showing. Measured in
            // Chromium before this line: two exposed `Primary` landmarks
            // and one axe `landmark-unique` violation at 375, 700 and
            // 1100px, one landmark and none at 1280px
            // (`e2e/side-nav-bands.spec.ts`). `display: none` is the fix
            // rather than a second name, because there is nothing in this
            // element below `xl` to name: every child is `hidden xl:flex`
            // too (`inFlow`), so a distinctly-labelled landmark here would
            // be an empty one in every screen reader's landmark list.
            collapsed
            ? "hidden"
            : "hidden xl:flex xl:h-full xl:shrink-0 xl:flex-col xl:gap-4 xl:overflow-y-auto xl:overflow-x-hidden xl:bg-base-200 xl:py-4",
        // Real widths rather than "however wide a 16px icon plus its
        // padding happens to be". `lg:w-16` is off-canvas-only now,
        // because that is the only mode with an in-flow icon rail left.
        // A `className` width from the caller still wins — `cn()`
        // resolves the conflict in call order.
        smallScreen === "off-canvas" ? "lg:w-16 xl:w-64" : !collapsed && "xl:w-64",
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
        <FloatingRailPortal
          topItem={topItem}
          groups={groups}
          footerItems={footerItems}
          currentPath={currentPath}
          accountSlot={account}
          collapsed={collapsed === true}
          toolbarVariant={toolbarVariant}
        />
      )}

      <div className={cn(inFlow, "flex-col gap-0.5 px-2")}>
        <NavRow
          item={topItem}
          active={isActive(topItem.href, currentPath)}
          smallScreen={smallScreen}
        />
      </div>

      <div className={cn(inFlow, "flex-1 flex-col gap-4 px-2")}>
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
          inFlow,
          "flex-col gap-2 border-edge-subtle border-t px-2 pt-3",
          // In floating mode the rails render their own footer rows, so
          // this block — hairline `border-t` included — would otherwise
          // be an empty line at every width below the sidebar. It used to
          // say `lg`, which stopped being the handover point in 0.1.2.
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
            64px) and, in floating mode, everywhere below `xl` — there the
            floating toolbars carry it instead, behind their "More" control
            (`NavSheet`) — and shown off-canvas (in `"off-canvas"` mode
            only) and at the full-label desktop width, by the same
            `lg:hidden xl:block` toggle technique as the rest of this file,
            not a JS breakpoint check. */}
        {account != null && (
          <div className={cn("px-3 lg:hidden xl:block", smallScreen === "floating" && "hidden")}>
            {account}
          </div>
        )}
      </div>
    </nav>
  );
}
