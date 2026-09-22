/**
 * M3 Expressive's "press" shape morph — the interaction-driven half of the
 * shape story (the other half, the register itself, is D8/theme.css's own
 * job and is not touched here). A control's corner radius steps down to
 * `--radius-selector` (8px) for as long as `:active` holds and springs
 * back on release, using the `--ease-spatial-fast`/`--dur-spatial-fast`
 * pair (`theme.css`'s "signature bounce" spring, z=0.6) so the release
 * genuinely bounces rather than just easing back.
 *
 * `--radius-selector` is the target for every control regardless of its
 * resting shape, not a new value invented for this: it is the smallest
 * general-purpose step already in D8's three-tier register (`selector` 8px
 * / `field` 12px / `box` 20px), one step below the checkbox-only
 * `--radius-xs` (4px) outlier that `theme.css` documents as reading square
 * only at a 16px glyph scale. On a ~24–32px icon-shaped control (`Button
 * size="icon"`, and the four call sites below), 8px is ~1/4–1/3 of the
 * box — the same "quarter of the box reads as a square with softened
 * corners, not a smaller circle" ratio `--radius-xs`'s own comment
 * establishes for the 16px checkbox, re-applied at this scale rather than
 * re-derived from nothing.
 *
 * # Why this is one arbitrary CSS property, not `transition-*` classes
 *
 * A control needs several *different* transition speeds running at once —
 * its existing colour/opacity fade, and this new radius bounce — and CSS
 * has no way to split that across two separate Tailwind utility classes on
 * one element: `transition-property` (and the `transition-duration` /
 * `transition-timing-function` lists riding on it, position-matched by
 * list index) is a single longhand. Two classes that each set it resolve
 * to the same specificity, so whichever one Tailwind happens to emit later
 * in its own generated stylesheet wins *outright* — not just for the
 * property it names, for the whole element, since generation order lives
 * inside Tailwind's `utilities` layer and is not something a class *list*
 * order controls. `copy-button.tsx`'s own comment already found the
 * milder version of this trap (`transition-colors` and `transition-opacity`
 * are the *same* tailwind-merge group, so combining them silently drops
 * one) and worked around it with the bare `transition` utility, whose
 * default property list happens to cover both. That escape hatch doesn't
 * reach a *third* speed: nothing in Tailwind's default `transition`
 * property list runs at `--dur-spatial-fast`, and there's no
 * `duration-spatial-fast` utility to layer on top without re-triggering
 * the exact clobber this paragraph opened with.
 *
 * So every transition this family needs is written as one property /
 * duration / timing-function triad, all three lists the same length and
 * position-matched: `color, background-color, opacity, border-radius`
 * against `--dur-fast, --dur-fast, --dur-fast, --dur-spatial-fast` against
 * `--ease-out, --ease-out, --ease-out, --ease-spatial-fast`. `opacity` is
 * included so this one constant can also replace `CopyButton`'s bare
 * `transition` (its `revealOnGroupHover` fade) without reopening that
 * same clobber — not every call site below animates opacity, but a
 * `transition-property` entry with nothing changing to trigger it is
 * inert, not wrong.
 *
 * `border-color` is deliberately left out: none of the four call sites
 * below ever change theirs (no `border-*` class on any of them), so
 * including it would be four repeats of dead weight. `Button` needs a
 * richer version of this exact idea because daisyUI's own `.btn` *does*
 * transition `border-color` on hover/active — see that file's own comment
 * for why it writes its own triad rather than reusing this one.
 *
 * # Why these four call sites and not every `rounded-full` icon control
 *
 * `button.tsx`'s own D8 comment already establishes this family —
 * `dialog.tsx`'s `DialogClose`, `toast.tsx`'s dismiss button,
 * `masked-value.tsx`'s reveal toggle, and `copy-button.tsx` — alongside
 * `Button size="icon"`: bare `<button>`s that don't run through `cva`
 * "for layout reasons" but were "updated to the same `rounded-full` shape
 * alongside" the icon-button fix, specifically so the library does not
 * ship two different icon-affordance shapes. The press morph is the same
 * lockstep move one layer further: whichever control the reader presses,
 * the shape answers the same way.
 */
export const PRESS_SHAPE_MORPH =
  "active:rounded-selector " +
  "[transition-property:color,background-color,opacity,border-radius] " +
  "[transition-duration:var(--dur-fast),var(--dur-fast),var(--dur-fast),var(--dur-spatial-fast)] " +
  "[transition-timing-function:var(--ease-out),var(--ease-out),var(--ease-out),var(--ease-spatial-fast)]";
