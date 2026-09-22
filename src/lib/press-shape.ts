/**
 * M3 Expressive's "press" shape morph — the interaction-driven half of the
 * shape story (the other half, the register itself, is D8/theme.css's own
 * job and is not touched here). A control's corner radius steps down for
 * as long as `:active` holds and springs back on release, using the
 * `--ease-spatial-fast`/`--dur-spatial-fast` pair (`theme.css`'s
 * "signature bounce" spring, z=0.6) so the release genuinely bounces
 * rather than just easing back.
 *
 * # D10: the target is proportional to size, not a flat constant
 *
 * This used to step every control to the same flat `--radius-selector`
 * (8px), regardless of its own box — and that read fine on a ~40px text
 * button (8px is a fifth of 40, a gentle nudge) and "bizarre […] becoming
 * a square on long-press" (the owner's own bug report) on `Button
 * size="icon"`'s 32×32 box, where the identical 8px is a full quarter of
 * the width. `theme.css`'s D10 "Density register" section now computes a
 * `--btn-press-radius` custom property per control instead — `calc(var(
 * --size) * 0.2)` on `.btn`, half that (`* 0.1`, deliberately gentler for
 * a circle) on `.btn-circle` — transcribed from androidx's
 * `PressedContainerShape` tokens (`ButtonSmallTokens`/`ButtonMediumTokens`/
 * `ButtonLargeTokens`, `compose/material3/material3/…/tokens/` in
 * `androidx/androidx`): 8dp/40dp, 12dp/56dp and 16dp/96dp, "about a fifth"
 * each time. See that file's own comment for the full derivation,
 * including why `.btn-circle` needs its own, gentler ratio rather than
 * reusing 0.2. `PRESS_SHAPE_MORPH` below no longer names a value at all —
 * it reads `var(--btn-press-radius)`, and **every call site is
 * responsible for defining that custom property against its own actual
 * box**, the same way `.btn`/`.btn-circle` do for `Button`.
 *
 * The four bare-`<button>` call sites below share one shape (`-m-1 p-1
 * rounded-full` around a fixed-size icon — see "why these four call
 * sites" further down) but not one *size*: `dialog.tsx`'s `DialogClose`
 * and `toast.tsx`'s dismiss button wrap a 16px icon (24×24 box),
 * `masked-value.tsx`'s reveal toggle a 12px icon (20×20 box), and
 * `copy-button.tsx`'s icon size is itself a prop (12/14/16px, 20/22/24px
 * box) — so none of them can share one literal target the way `.btn-sm`/
 * `.btn-circle` can (those are fixed classes over a fixed `--size`). Each
 * sets `--btn-press-radius` itself, as `calc(<own box>px * 0.1)` — the
 * *same* 0.1 circular ratio `.btn-circle` uses, applied to each control's
 * own known box instead of a shared `--size`, since these controls carry
 * no daisyUI `--size` custom property to read from at all.
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
  "active:[border-radius:var(--btn-press-radius)] " +
  "[transition-property:color,background-color,opacity,border-radius] " +
  "[transition-duration:var(--dur-fast),var(--dur-fast),var(--dur-fast),var(--dur-spatial-fast)] " +
  "[transition-timing-function:var(--ease-out),var(--ease-out),var(--ease-out),var(--ease-spatial-fast)]";
