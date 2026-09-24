import { Children, cloneElement, Fragment, isValidElement, type ReactNode } from "react";

/**
 * A compound component's direct parts, with fragments opened up — so
 * `<><SelectSearch /><SelectEmpty /></>` is lifted into `Select`'s header,
 * or `<><DialogClose /></>` into a `Dialog`'s chrome, like the same parts
 * written bare.
 *
 * Each part lifted out of a fragment is re-keyed under that fragment's own
 * key. `Children.toArray` keys a fragment's children afresh (`.0`,
 * `.$cm`), so two sibling fragments — "recent" and "all", each mapping
 * `key={code}` — produced duplicate keys once flattened into one array, and
 * React then kept stale options on screen: measured, emptying the first
 * fragment's list left its "Recent Cameroon" and "Recent Kenya" rows in
 * place. The separator is `:` because `Children.toArray` escapes a `:` in
 * a caller's own key (to `=2`), so no sibling's key can spell a composed
 * one; with `/`, a sibling keyed `f/.$cm` collided with `cm` inside a
 * fragment keyed `f`.
 *
 * Only fragments are opened: a part inside the caller's own element or
 * component is that element's child, not the container's.
 */
export function flattenParts(node: ReactNode, prefix = ""): ReactNode[] {
  return Children.toArray(node).flatMap((part) => {
    if (!isValidElement(part)) return [part];
    const key = `${prefix}${String(part.key)}`;
    if (part.type === Fragment) {
      return flattenParts((part.props as { children?: ReactNode }).children, `${key}:`);
    }
    return prefix === "" ? [part] : [cloneElement(part, { key })];
  });
}
