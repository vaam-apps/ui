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
