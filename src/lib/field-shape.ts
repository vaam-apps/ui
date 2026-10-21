/**
 * The M3 Expressive field shape morph — the text-field counterpart of
 * `press-shape.ts`. Every field-shaped control in this library (`Input`,
 * `Textarea`, `SelectTrigger`, `DatePickerTrigger`) rests almost circular
 * and pulls its corners in to a plain rounded rectangle while it holds
 * focus — or, for a trigger, while the popup it opened is up, since focus
 * moves into that popup and the trigger would otherwise spring back out
 * under it.
 *
 * The two radii are custom properties `theme.css` declares on `.input`,
 * `.select` and `.textarea` (`--field-radius-rest`, `--field-radius-focus`
 * — see that file for the values and why the resting one has to be a
 * finite length, never `rounded-full`). This string only says *when* each
 * applies and *how* the change moves.
 *
 * # Why the focus ring needs nothing
 *
 * daisyUI draws a field's focus indicator as an `outline` (2px, offset
 * 2px), and Chromium, Firefox and Safari all draw an outline along the
 * element's `border-radius` — so the ring follows the morph frame by frame
 * without a line of code here. `e2e/field-shape.spec.ts` measures it.
 *
 * # Motion
 *
 * One property / duration / timing-function triad, for the reason
 * `press-shape.ts` gives (two transition utilities on one element
 * clobber each other outright). Colours ride M3 Expressive's *effects*
 * spring; the radius rides the default *spatial* spring (z 0.8, a 1.5%
 * overshoot) rather than the fast one a button's press takes — a field
 * gaining focus is a calmer event than a press, and a 9.5% bounce on a
 * 20px-to-12px move reads as a wobble. `prefers-reduced-motion` needs no
 * branch here: `theme.css`'s global rule collapses every transition.
 *
 * `px-4` is part of the shape, not decoration: at rest the corners are a
 * semicircle, and daisyUI's own 12px inline padding puts the first glyph
 * where the curve is still turning. 16dp is M3's text-field inline
 * padding (`OutlinedTextFieldTokens`' `TextFieldPadding`).
 */
export const FIELD_SHAPE =
  "rounded-(--field-radius-rest) px-4 " +
  "focus:rounded-(--field-radius-focus) focus-within:rounded-(--field-radius-focus) " +
  "aria-expanded:rounded-(--field-radius-focus) " +
  "[transition-property:color,background-color,border-color,outline-color,box-shadow,border-radius] " +
  "[transition-duration:var(--dur-effects-fast),var(--dur-effects-fast),var(--dur-effects-fast),var(--dur-effects-fast),var(--dur-effects-fast),var(--dur-spatial)] " +
  "[transition-timing-function:var(--ease-effects),var(--ease-effects),var(--ease-effects),var(--ease-effects),var(--ease-effects),var(--ease-spatial)]";
