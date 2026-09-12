# Changelog

## Unreleased

Visual-coherence pass. Four of the fixes below are latent rendering bugs
that had been shipping since the components were written, and every one
of them was found by looking at a rendered page — three of them in bands
or states no story had ever drawn, which is also why the gallery grew
from 59 stories to 92 and why there is now a test that fails when an
export has none.

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
