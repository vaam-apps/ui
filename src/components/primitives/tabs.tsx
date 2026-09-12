"use client";

import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import {
  Children,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useMemo,
  useState,
} from "react";
import { cn } from "../../lib/cn";

/**
 * D18/D3: Radix `Tabs` → Headless UI `TabGroup`, behind a value-based
 * `ValueTabs` adapter. Radix's `Tabs` was value-based and controlled
 * (`value`/`onValueChange`/`defaultValue`); Headless UI's own `TabGroup` is
 * index-based (`selectedIndex`/`onChange(index)`). Four call sites
 * (`payload-inspector.tsx`, `users-screen.tsx`, and the gallery) already
 * depend on the value-based shape, and a value-based API is more resistant
 * to bugs when tab order changes — so this adapter translates once, here,
 * rather than rewriting every call site to track an index.
 *
 * Every consumer's own JSX is untouched: only the import line changes, via
 * aliasing (`import { ValueTabs as Tabs, ... } from "@vaam-apps/ui"`) — the one
 * genuinely necessary API break this bucket owns (see each updated file's
 * own import for the one-line diff).
 */

function collectTriggerValues(node: ReactNode, out: string[] = []): string[] {
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<{ value?: string; children?: ReactNode }>;
    if (el.type === ValueTabsTrigger) {
      if (typeof el.props.value === "string") out.push(el.props.value);
      return;
    }
    if (el.props?.children != null) collectTriggerValues(el.props.children, out);
  });
  return out;
}

/** Separates the one `ValueTabsList` child from everything else, so
 * `ValueTabs` can group "everything else" (the `ValueTabsContent` panels,
 * declared as direct siblings of `ValueTabsList` — the exact Radix `Tabs`
 * shape) under one implicit `TabPanels`, which Headless UI's `TabGroup`
 * requires but the old Radix-shaped call sites never had to write. */
function splitOutList(children: ReactNode): { list: ReactNode; rest: ReactNode[] } {
  let list: ReactNode = null;
  const rest: ReactNode[] = [];
  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === ValueTabsList) {
      list = child;
    } else {
      rest.push(child);
    }
  });
  return { list, rest };
}

/**
 * Note the `| undefined` on the optional props below. This package
 * compiles under `exactOptionalPropertyTypes`, where a bare `value?:
 * string` means "you may omit this key" and NOT "you may pass
 * `undefined`" — so the ordinary controlled pattern,
 * `const [v, setV] = useState<string>()` followed by `value={v}`, is a
 * type error. Found writing this component's own story, which is the
 * first code outside the original application to use it.
 */
export interface ValueTabsProps {
  value?: string | undefined;
  defaultValue?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  className?: string | undefined;
  children: ReactNode;
}

export function ValueTabs({
  value,
  defaultValue,
  onValueChange,
  className,
  children,
}: ValueTabsProps) {
  const values = useMemo(() => collectTriggerValues(children), [children]);
  const { list, rest } = useMemo(() => splitOutList(children), [children]);
  const [internalValue, setInternalValue] = useState(defaultValue ?? values[0]);
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;
  const selectedIndex = Math.max(0, values.indexOf(currentValue ?? values[0] ?? ""));

  function handleChange(index: number) {
    const next = values[index];
    if (next === undefined) return;
    if (!isControlled) setInternalValue(next);
    onValueChange?.(next);
  }

  return (
    <TabGroup className={className} selectedIndex={selectedIndex} onChange={handleChange}>
      {list}
      <TabPanels as={Fragment}>{rest}</TabPanels>
    </TabGroup>
  );
}

export function ValueTabsList({
  className,
  wrapperClassName,
  children,
}: {
  /** Lands on the `role="tablist"` element — the flex row itself, as it
   * always has. `gap-*`, `justify-*` and `border-b-*` belong here. */
  className?: string;
  /** Lands on the horizontal scroll container wrapping the tablist.
   *
   * The wrapper is new, and routing `className` to it would have been a
   * silent break: a caller's `gap-2` would have merged against nothing,
   * landed on an element with no `display: flex`, and quietly stopped
   * working while `gap-4` survived on the row it was meant to override.
   * Both reviewers caught that independently. `className` therefore keeps
   * its original target and the wrapper gets its own prop. */
  wrapperClassName?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        // `overflow-x-auto` + `whitespace-nowrap`/`shrink-0` on each
        // trigger (below): with ~8 tabs in a narrow container and neither,
        // every trigger shrank to its longest word and a multi-word label
        // wrapped to two lines — at which point the active tab's `-mb-px
        // border-b-2` sat a line below the list's own `border-b` and the
        // underline no longer read as attached to anything.
        // `tabs.stories.tsx`'s `WithCounts` story already said this in
        // prose without preventing it; `ManyTabsScrolling` there now
        // exercises the fix at ~380px.
        //
        // This is a *separate* element from `TabList` below, not
        // `overflow-x-auto` on `TabList` itself — found live, by tabbing
        // into a scrolled list and watching the keyboard focus ring get
        // clipped top and bottom. The CSS Overflow spec computes
        // `overflow-y` to `auto` whenever `overflow-x` isn't `visible`
        // (confirmed in the running story: `getComputedStyle` reported
        // `overflow-y: auto` despite never setting it), so an
        // `overflow-x-auto` list clips vertically too — and this list's
        // triggers fill its height exactly (`items-center`, no vertical
        // padding), so the focus outline's own `outline-offset` had zero
        // clearance and was cut on the two sides that don't scroll. `py-1`
        // here gives the outline's `2px` width + `2px` offset the 4px of
        // room it needs on a plain, unclipped wrapper — confirmed by
        // reading the focused trigger's and this element's
        // `getBoundingClientRect()` side by side. It sits *outside*
        // `TabList`, so `TabList`'s own border-box is untouched and the
        // `-mb-px` trick below still lands exactly on `TabList`'s own
        // `border-b` — padding this element instead of `TabList` was the
        // difference between the underline staying flush and gaining a
        // 4px gap (tried the latter first; it visibly detached).
        //
        // The `[scrollbar-width:none]`/`::-webkit-scrollbar` pair hide the
        // scrollbar chrome while keeping it scrollable (mouse-wheel-shift,
        // trackpad, drag, and arrow-key nav below all still work; only the
        // visual bar is gone). No `tabIndex={0}` on this element — unlike
        // `SideNav`'s flyout-clipping fix, nothing in here is absolutely
        // positioned, so there's no clipped-content bug to reproduce, and
        // the tabs themselves (each a real `<button>` from Headless UI's
        // `Tab`) are already in the page's tab order and confirmed live to
        // scroll themselves into view on focus (the browser's native
        // behaviour for focusing an element outside a scroll container's
        // visible area), so a `tabIndex` on the scroller itself would only
        // add a second, redundant stop.
        "overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        wrapperClassName,
      )}
    >
      {/* `w-max`, and this is not cosmetic. `TabList` is block-level
          inside the scroller, so without it its border-box is the
          *scroller's* content width (380px in the story) while its
          content is 944px — and `border-b` paints only across the first
          viewport-width of the strip. Scrolled to the end, the last three
          tabs had no rule beneath them at all and the active tab's 2px
          underline floated over nothing. Measured live before the fix:
          `listW 380` against `listScrollW 944`. The failure is invisible
          at scroll offset 0, which is the only state a screenshot shows —
          and the story's own docstring asserted the opposite. */}
      <TabList className={cn("flex w-max items-center gap-4 border-edge border-b", className)}>
        {children}
      </TabList>
    </div>
  );
}

// Underline variant only (design doc §5.2: "no pill/segmented variant — pill
// tabs are consumer furniture"). 2px bottom rule in --foreground on the
// active tab.
export function ValueTabsTrigger({
  value,
  className,
  children,
}: {
  /** Consumed by `collectTriggerValues` above via prop introspection on the
   * element tree, not read inside this component itself. */
  value: string;
  className?: string;
  children: ReactNode;
}) {
  void value;
  return (
    <Tab
      type="button"
      className={cn(
        // No `outline-none` here — this used to end with it (matching every
        // other stripped-outline component in this package) but, unlike
        // those, never paired it with a substitute (`checkbox.tsx`,
        // `switch.tsx`, `radio-group.tsx`, `chip-select.tsx`, `select.tsx`
        // and `dropdown-menu.tsx` all pair `outline-none` with a
        // `data-focus:ring-*`). Tabbing into the list showed nothing, and
        // the selected tab's own underline gave no clue the list had focus
        // at all.
        //
        // `theme.css`'s `:focus-visible` rule (`@layer base`) already
        // draws a ring on every focusable element with no exceptions, and
        // it uses `outline` rather than `box-shadow` so the ring costs no
        // layout (an outline is not part of the box model) — which matters here,
        // since `-mb-px`/`border-b-2` sits right where a clipped outline
        // would have been cut. Tailwind's `outline-none` utility lives in
        // `@layer utilities`, a layer that wins over `@layer base`
        // regardless of selector specificity, so simply not emitting that
        // utility is enough to let the global rule apply — no
        // `data-focus:` override needed. (Headless UI's `Tab` does expose
        // one, driven by `@react-aria/focus`'s keyboard-only
        // `isFocusVisible`, as a fallback if the plain deletion had turned
        // out not to fire — it did fire, so that fallback is unused here.)
        "-mb-px shrink-0 whitespace-nowrap border-b-2 border-transparent px-1 py-2 font-medium text-body text-muted-foreground",
        "data-selected:border-foreground data-selected:text-foreground",
        className,
      )}
    >
      {children}
    </Tab>
  );
}

export function ValueTabsContent({
  className,
  children,
}: {
  /** Kept for API parity with the old value-based `TabsContent` — the real
   * Tab↔Panel association is positional (Headless UI's own `TabGroup`
   * matches `Tab`/`TabPanel` by declaration order), not looked up by value. */
  value: string;
  className?: string;
  children: ReactNode;
}) {
  return <TabPanel className={cn("pt-4", className)}>{children}</TabPanel>;
}
