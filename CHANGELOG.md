# Changelog

## Unreleased

### `StatusHue` gains `progress` (minor, additive)

**The hue axis had no value for "running, outcome not yet known"** — the
one state every state machine spends most of its time in. Of the seven
hues, five meant trouble or stasis and one (`success`) was terminal, so
an in-flight state had to borrow `neutral`: the same hue this package's
own README gave a *refunded* order. "Still moving" and "over, and there
is nothing to see" are opposites on the only question an operator is
asking, and they rendered identically.

The two workarounds are both wrong, which is what made this a gap rather
than a preference. `uncertain` means the outcome is *unknowable* and puts
a "something may be wrong" marker on every healthy in-flight row — a
false positive a hundred thousand times over, on exactly the scan an
operator console exists for. `neutral` understates it, and an in-flight
record stops being tellable apart from a settled one.

`progress` is `#67e8f9` (cyan-300), with its 400-level neighbour at
10%/28% for the fill and border — the construction every tinted sibling
here already uses. Chosen by measurement, not by eye:

- Nearest status sibling is `neutral` at ΔE2000 25.3; `success` is 31.0
  away. Teal-300 was rejected at 16.9 from `success` — near enough to be
  the same colour inside a 14px glyph, and "processing" against
  "succeeded" is the one pair on a payments table that must never be
  confusable. That is the same failure `--state-warning-fg`'s own comment
  records from the first value tried for it.
- Contrast measured on a **rendered** pill, not from the class names:
  11.71:1 loud on `base-100` and 10.90:1 on `base-200` (the demanding
  case, where the label is composited over the hue's own 10% tint),
  13.58:1 / 12.93:1 quiet. Second-highest of the eight hues, against
  `uncertain` 11.64, `warning` 10.28, `expired` 6.89.
- **This sits close to the theme's own "blue is selection-only, never a
  status hue" rule, and is a judgement call a maintainer may want to
  overrule.** The cyan gap is 71° of Lab hue and ΔE2000 32.2 from the
  selection ring's `#5b8def`, wider than the `warning`/`uncertain`
  separation this theme already accepts, and `--ring` only ever paints a
  2px outline offset outside a focused element — never a glyph or text.

Nothing existing changes colour. `StatusHue` is a union, so a consumer's
own `Record<StatusHue, …>` — anyone mirroring `HUE_CLASSES` — needs the
new key; a `StatusSystem` table does not.

- `HUE_CLASSES` gains the matching `state-progress-*` entry, and
  `theme.css` the `--state-progress-{fg,bg,border}` trio plus its
  `@theme inline` aliases.
- New `StatusPill` story **EveryHue**: every hue × quiet/loud × page and
  card. This is the surface the contrast numbers above were measured on.
- `StateChip`'s story now derives its tone list from `HUE_CLASSES`
  instead of retyping it. That literal had already fallen behind the
  vocabulary once.
- New `src/components/status/status-tokens.test.ts`. `HUE_CLASSES` is a
  `Record<StatusHue, …>`, so the compiler catches a *missing* hue but not
  a *wrong* one — and a hue is added by copying the block above it, so
  the natural bug is an entry keyed `progress` whose classes still say
  `neutral`. It compiles, satisfies the existing token guard, and renders
  a plausible grey. The tests pin that a hue's classes are its own name,
  and that each `--state-<hue>-*` is declared with a value rather than
  only aliased in `@theme inline` — the half `theme-tokens.test.ts`
  cannot see, where the utility is emitted but resolves to nothing.
- The README documents the in-flight mapping concretely, so a consumer
  does not have to make this choice by guessing.

Visual-coherence pass. Four of the fixes below are latent rendering bugs
that had been shipping since the components were written, and every one
of them was found by looking at a rendered page — three of them in bands
or states no story had ever drawn, which is also why the gallery grew
from 59 stories to 92 and why there is now a test that fails when an
export has none.

### A second pass, and three API changes

Same method as above — render it, look at it, check the comment against
the code beneath it — run this time as six parallel implementers behind
two adversarial reviewers on separate lenses. The reviewers found six
defects in the fixes, including one that made its own target worse; those
are folded in rather than listed separately. **Three of these can break a
build or a screen, so they come first.**

- **`formatMoney` throws for a `number` past `Number.MAX_SAFE_INTEGER`.**
  `Number.isInteger(1e21)` is `true`, so the existing integer guard let it
  through — but `(1e21).toFixed(0)` is `"1e+21"` (the spec falls back to
  `ToString` at that magnitude) and the decimal shift turned that into
  `NaN`. `formatMoney(1e21, "USD")` returned the string `"USDNaN"`.
  The guard is deliberately wider than the range that mangles, and not
  for the reason first written down: `1e16` and `1e20` are exactly
  representable and used to format correctly. It is that past `2^53` a
  `number` cannot be *checked* for exactness, and a money formatter must
  not print a figure that only looks exact. `bigint` and digit strings
  are unaffected at any size. This rejects input that used to work for
  anyone holding large zero-decimal amounts (XAF, VND, JPY) as `number`.
- **`Toaster` caps the stack at four, dropping the oldest.** Nothing
  capped it before; ten rapid calls stacked 600px of cards with no
  ceiling.
- **`ValueTabsList` renders a scroll container, and takes a second prop.**
  `className` still lands on the `role="tablist"` row it always did —
  routing it to the new wrapper would have been a silent break, since a
  caller's `gap-2` would have merged against nothing and quietly stopped
  working. The wrapper has its own `wrapperClassName`.

- **`StateTimeline` renders real offsets.** `Asia/Kolkata` came out as
  `+5:30` rather than `+05:30` — the padding regex was anchored to a
  single trailing digit and never matched a zone with minutes. UTC came
  out as `+00`, because the `raw === "GMT"` test never fires: modern ICU
  reports a zero offset as `"GMT+0"`. The offset is parsed now instead of
  string-patched, so `Z` is reached by arithmetic rather than by luck, and
  a shape `shortOffset` is not documented to emit renders verbatim rather
  than defaulting to a plausible-looking `Z`. A backwards elapsed delta
  renders with its real sign instead of `+-5000ms`, and a malformed one
  renders an em dash instead of `+NaNh NaNm`; neither is clamped, because
  clamping hides an ordering bug in the caller's data.
- **`MaskedValue` stopped disclosing the length of the secret.** The dot
  run was `Math.min(Math.max(hiddenCount, 6), 12)`, which reads as a clamp
  and is the identity function on exactly [6, 12] — the common case for a
  masked key. It is a fixed run of eight now.
- **`InlineBanner`'s `success` variant and `StateChip`'s `success` and
  `neutral` tones rendered with no box at all.** All three painted tokens
  `theme.css` declares `transparent` on purpose, so they read as *less*
  present than their loud siblings. Third and fourth instance of a mistake
  already fixed twice, so the fact is written down once now — `isQuietHue`
  in `status-tokens.ts` — and `theme-tokens.test.ts` asserts it against
  the stylesheet rather than trusting the list.
- **`truncate` on a flex row never ellipsized anything.** `text-overflow`
  applies to block containers and a flex container is not one, so
  `DropdownMenuItem`, `DropdownMenuCheckboxItem` and `CommandMenuItem`
  hard-cut their labels mid-glyph under comments claiming an ellipsis —
  a mistake introduced by the previous entry in this changelog. The label
  moves one level in. `DatePicker`'s trigger was a fourth instance,
  missing the `min-w-0` that lets a flex item shrink at all.
- **A disabled `CheckboxField`, `SwitchField` or `ChipSelect` had a
  live-looking label.** Headless UI's `Label` reads disabled state from
  `Field`'s context and nowhere else, and `disabled` was reaching only the
  inner control — so the `data-disabled:` classes already written on those
  labels were dead.
- **`FormField` wires the control to its own hint and error**, with
  derived ids, a merged `aria-describedby` and `aria-invalid`; `Input` and
  `Textarea` render an `aria-invalid:` danger treatment to match. What a
  control actually emits is now pinned by a render test, because the first
  version of this shipped a comment claiming it reached `Select` when it
  did not. It reaches `Input`, `Textarea`, `DatePicker` and
  `DateRangePicker`. **It cannot reach `Select`**: Headless UI's
  `ListboxButton` builds `aria-describedby` into its own props and lets
  them win, so `Select` does not accept a prop it could not honour.
  Closing that gap means adopting Headless UI's `Field`/`Description`
  pair library-wide, which is a design decision and not a patch.
- **`ValueTabs` had no focus indicator at all** — the trigger carried
  `outline-none` with no substitute. Deleting the utility is the whole
  fix: the global `:focus-visible` rule is in `@layer base` and the
  utility suppressing it is in `@layer utilities`, which wins. The list
  also scrolls horizontally instead of wrapping triggers to two lines and
  detaching the active underline from the rule beneath it — and the
  `TabList` inside that scroller is `w-max`, without which its `border-b`
  painted only across the first viewport-width and the last tabs had no
  rule under them at all. That regression was introduced by the scroll fix
  and caught in review.
- **`LiveRow`'s wash faded in and vanished out.** The transition and the
  tint were gated together, so the decay edge landed on a style with no
  transition. Only the *duration* is gated now — making the whole
  transition unconditional overshot and left every `LiveRow` hovering at
  240ms beside plain rows at 90ms.
- `Toaster` no longer re-announces the whole stack on every change:
  `role="status"` carries an implicit `aria-atomic="true"`, so one expiry
  re-read every toast on screen. The container keeps the live region with
  an explicit `aria-atomic="false"`. An intermediate attempt also moved
  `role="status"` onto each card; that is backwards — a live region must
  exist *before* its content changes to announce it, and a populated
  inserted region shadows the container that can — and was reverted.
- Close buttons in `Dialog`, `Drawer` and `Toast` are ~32×32px hit targets
  without moving; the toast's `×` glyph is the same Lucide `X` as the
  others. `DialogHeader` reserves the gutter that long title had been
  running under.
- `SelectTrigger` accepts `aria-label`/`aria-labelledby`; `ChipSelect`
  accepts the `aria-labelledby` that `FormField`'s own documentation had
  been telling callers to pass to a component whose type did not declare
  it; `Dialog`'s controlled props accept an explicit `undefined`, the same
  `exactOptionalPropertyTypes` fix `Select` and `ValueTabs` already had.
- `input-bordered`, `select-bordered` and `textarea-bordered` are gone —
  daisyUI v4 modifiers that v5 ships no rule for, so they had been
  matching nothing. Zero rendered pixels changed, checked by compiling the
  Tailwind output with and without them and diffing.
- `Progress`'s `tone` was documented as rendering an indeterminate bar
  when unset. It defaults to `"neutral"` and always has.
- `maskSecret` and the two instant formatters moved to `src/lib`, which
  the public barrel does not re-export. All three had been exported purely
  so a test could reach them, which had put `mask`, `formatAbsolute` and
  `formatElapsed` on the published API under three of the most generic
  names available.

### Skeletons drift instead of standing still

`Skeleton` plays a **chaotic gradient**: two oversized, very
low-contrast gradient fields translating and scaling past each other on
coprime periods (13s and 19s), with per-position phase offsets so a
stack of them never brightens in unison.

This does not reverse the "no skeleton shimmer" rule. A shimmer is a
highlight that sweeps across the block on a fixed period — it reads as
a progress indicator, implying the content is a knowable fraction of the
way through arriving, and a column of them beats like a metronome. Both
are properties of the *sweep*. The drift has no sweep, no direction and
no edge; it says "still waiting, not stuck" and deliberately says
nothing about how much longer. Transform-only, so a table of 200
placeholder cells costs no layout and no repaint, and it stops dead
under `prefers-reduced-motion` — leaving the gradients painted where
they stand, so reduced motion degrades to a different still image
rather than a broken one.

- `Skeleton` takes `animated` (default `true`) for a placeholder sitting
  inside something that is already moving.
- New `SkeletonText`: a paragraph placeholder whose last line is short,
  the way real prose ends.
- `Skeleton` is now `aria-hidden` — a dozen empty boxes read aloud is
  worse than silence — and `RouteSkeleton` carries the `role="status"`
  live region that announces the wait once instead.

### Four rendering bugs, all found by looking

- **`SideNav`'s icon rail had a stray horizontal scrollbar, and its
  tooltips had never once appeared.** One cause, two symptoms: daisyUI's
  `.tooltip` draws its bubble as an absolutely positioned pseudo-element
  at `left: 100%`, and the `<nav>` is a scroll container, so the bubble
  was clipped away on every hover while still counting toward the
  scrollable width. Measured at 1100px: `clientWidth 40`, `scrollWidth
  212`, the bubble sitting at 32→115px entirely outside the clip box.
  The rail's labels are native `title` attributes now, which the browser
  paints outside the page and nothing can clip. The nav also has real
  per-band widths (`w-full` / `lg:w-16` / `xl:w-64`) instead of sizing
  itself to whatever a 16px icon plus padding happens to measure.
- **`Select` rendered two disclosure indicators.** daisyUI's `.select`
  paints its own arrow as a pair of `linear-gradient` background images
  for a native `<select>`; this trigger also renders a real
  `ChevronDown`. `bg-none` removes daisyUI's, and `pe-3` reclaims the
  1.75rem it had reserved.
- **`RadioGroup` and `ChipSelect` rendered their *selected* option with
  no fill and no border.** Both used the `state-success-*` trio, and
  `--state-success-bg`/`--state-success-border` are declared
  `transparent` on purpose — `success` is one of the two quiet status
  hues. The chosen option therefore read as *less* present than the ones
  nobody had picked, and the focus ring was transparent for the same
  reason. Selection is not a status: both now use the achromatic
  `primary`/`surface-3` vocabulary every other checked control uses, and
  `RadioGroup` draws a real radio dot so the choice survives with no
  colour at all.
- **`Checkbox` was a perfect circle, indistinguishable from a radio.** A
  `border-radius` larger than half the box is clamped to half, and
  `--radius-selector` (8px) is exactly half of the 16px box. New
  `--radius-xs` (4px) makes the register a real four-step ladder —
  4 / 8 / 12 / 20 — and the checkbox a square again.

### Text that is meant to fit, fits

Every slot with a line budget now ends in an ellipsis instead of
growing: nav labels, select values and options, card titles and metadata,
stat-tile labels and captions, checkbox/switch/radio/chip descriptions,
dropdown and command-palette items, toast titles and bodies, and the
screen header's description.

- **`Card` and `StatTile` gained `min-w-0`, which is what made the
  truncation real.** `white-space: nowrap` sets an element's min-content
  width to the whole string — `overflow: hidden` hides the text, it does
  not shrink the box — and a grid or flex item defaults to `min-width:
  auto`. So a card with a long title refused to be narrower than that
  title and pushed its own track, and the page, past the viewport:
  measured at 375px, cards laid out at 617px each on a page that
  scrolled sideways. A `truncate` that looks correct and silently does
  nothing.
- `DetailRow`'s inline variant keeps the label whole and gives the value
  the room, so a 60-character provider reference no longer widens the
  drawer it is in.
- `DropdownMenuContent` is bounded at `min(20rem, 100vw - 2rem)`.

### The gallery

59 stories to 92, and a guard so the count cannot quietly fall behind
the exports again.

- **`src/lib/story-coverage.test.ts` fails when an exported component is
  mentioned by no story.** The README already tells the story this
  closes: the hand-written gallery this Storybook replaced claimed to
  render every export and had silently missed thirteen, three of them
  carrying live rendering bugs. Colocating stories made that drift
  visible in a diff; this makes it a build failure. Exemptions are a
  short, justified list, and a stale one fails too.
- New: **Foundations/Tokens** (surfaces, edges, text tiers, the type
  scale, the seven status hues, the radius register, the motion
  tokens), **Primitives/Skeleton**, **Primitives/Card**,
  **Primitives/Tooltip**.
- `SideNav` pins each of its three bands to a named viewport, so a
  breakpoint story can show its own breakpoint. `Select`, `Tabs` and
  `Table` gained stories for the states that were breaking: a select
  inside a drawer, long values, an empty table, a loading table, a
  sticky header.
- `Tooltip` has a story that *demonstrates* the scroll-container
  clipping rather than describing it, so the next person meets the
  limitation before they hit it.
- Story fixtures use `max-w-*` rather than fixed widths, so the gallery
  itself no longer scrolls sideways on a phone.


## 0.1.1

**The 0.1.0 tarball shipped the whole source tree** — `dist/` plus a
second, complete copy of every component as `.tsx`, 285 files and 196KB
for a package whose runtime is 117 files and 88KB.

Two things had kept `src/` in `files`, and both are now addressed rather
than overridden: the theme stylesheet was exported from
`src/styles/theme.css`, so dropping the directory would have broken
`@vaam-apps/ui/styles/theme.css`; and `declarationMap`/`sourceMap`
emitted 112 maps pointing back into `src/`.

- The build copies `src/styles/` into `dist/styles/`, and the published
  `exports` points there. Everything published now lives in one
  directory — the same one the README already tells Tailwind to scan.
- Declaration and source maps are off. They are only useful when the
  sources they reference are present, and a map pointing at an absent
  `src/` is worse than none: a debugger reports it as broken rather than
  falling back to the built output.

No API change. Verified against the real tarball, not the working tree:
both `@vaam-apps/ui` and `@vaam-apps/ui/styles/theme.css` resolve from a
clean install, and a consumer typechecks against the shipped
declarations.

## 0.1.0

First release as `@vaam-apps/ui`, in its own repository. Previously
`@vsms/ui`, a private package inside the vsms monorepo — extracted with
its full history, back to the commit that created it.

### Storybook replaces the gallery

Stories live beside their components, and the `addon-a11y` panel runs
axe on every one. The gallery this replaces lived in a consuming
application and had drifted: it claimed to render every export and had
missed thirteen, among them the three carrying live rendering bugs.

### Accessibility

- **`--subtle-foreground` failed WCAG AA on every surface** — 4.06:1 on
  `--background` down to 3.40:1 on `--surface-3`, against the 4.5:1
  normal text requires, across 38 usages all at 11–12px. Raised to
  `#838a95`, the minimum that clears AA on the worst case. This
  compresses the gap to `--muted-foreground` from ΔE 18.2 to 8.8 and is
  a real, deliberate visual change. Found by the a11y addon, not by
  inspection.

### API

- `Select` and `ValueTabs` accept an explicit `undefined` for their
  controlled props. Under `exactOptionalPropertyTypes` a bare `value?:
  string` rejects `useState<string>()`'s own output, which made the
  ordinary controlled pattern a type error.

### Generalised for release

- **The status system is parameterised.** `StatusMeta`, the glyph
  geometry and the hue classes stay here; the per-state-machine tables
  moved to the consuming application. `createStatusPill(system)` binds
  one table to a pill whose `state` prop accepts exactly that machine's
  literals, replacing three near-identical pill components that differed
  only in which table they indexed (and had already drifted: one set
  `role="img"`, one did not; one supported `interactive`, two did not).
- `StateMark` now takes a `StatusMeta` rather than one application's
  state enum. The previous meta-based export, `StateMarkFromMeta`, is
  gone — this is it, renamed.
- `StateTimeline` is generic over the state machine, takes its `system`
  and its per-state `annotations` as props, and accepts any IANA
  timezone. It previously hard-coded one application's message states,
  that application's own explanatory notes, and a two-value timezone
  union whose UTC-offset suffix was literal (`"Z"` or `"+01"`) — wrong
  for every other zone and across DST. The offset is now read from
  `Intl`.
- `MsisdnDisplay` → **`PhoneDisplay`**, with the Cameroon digit grouping
  and carrier table replaced by a `format` callback and a `tag` prop.
- `StateChip`'s tones are the shared `StatusHue` vocabulary rather than a
  private four-entry copy, so `expired` and `parked` are now reachable.
- `EncodingPreview` (GSM-7/UCS-2 SMS segment counting) was removed. It is
  application domain knowledge, not a component.
- `components/bespoke/` → `components/patterns/`.

### Fixed

- **`cn()` silently deleted custom font sizes.** `tailwind-merge`
  classifies an unrecognised `text-*` value as a colour, so
  `cn("text-caption text-state-danger-fg")` returned only the colour —
  affecting `FieldError`, `DetailList`, `CardHeader` and others, which
  had been rendering at the browser default size. The theme's font-size
  and radius scales are now registered. Present in tailwind-merge 2.6.0
  as well as 3.x; a latent bug, not an upgrade regression.
- **`cn()` did not resolve daisyUI component modifiers**, so
  `cn("btn btn-primary", "btn-ghost")` kept both and let stylesheet order
  decide. Now grouped — with `btn`/`badge` *colour* and *style* kept
  separate, because daisyUI 5's `.btn-outline` reads the variable
  `.btn-primary` sets and collapsing them discards the colour.
- **`--state-warning-*` was referenced but never declared.**
  `StateChip tone="warning"` and every `InlineBanner variant="warning"`
  (so every `StaleWriteBanner`) emitted classes matching no rule and
  rendered with no colour. Both bug classes are now build failures: see
  `lib/theme-tokens.test.ts`.
- **The copy-to-clipboard affordance leaked a timer and swallowed
  rejections.** Unmounting inside the 1.5s confirmation window called
  `setState` on a dead component, and a refused `navigator.clipboard`
  write (insecure origin, permissions policy) was an unhandled rejection
  with no user-visible result. Extracted to `CopyButton` and fixed once.

### Added

- `Money` and `formatMoney` — minor units in, `Intl`-derived exponents,
  string-based scaling that stays exact past `Number.MAX_SAFE_INTEGER`.
- `Calendar`, `DatePicker`, `DateRangePicker` on `react-day-picker`,
  exchanging `YYYY-MM-DD` strings rather than `Date` objects.
- `Checkbox` / `CheckboxField`, `Switch` / `SwitchField`, `Spinner`,
  `Progress`, `Pagination`, `ConfirmDialog`, `MaskedValue`, `StatTile`,
  `CopyButton`.

### Dependencies

- `tailwind-merge` 2.6 → 3.6 (the 3.x line targets Tailwind v4, which
  this package already required).
- `lucide-react` 0.469 → 1.44.
- `react-day-picker` 10.0 added.
- `@radix-ui/react-dialog` added as a direct dependency. It arrives
  transitively through `vaul` regardless; declaring it is what lets
  TypeScript name the drawer's re-exported types in the emitted
  declarations (TS2742).
