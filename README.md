# @vaam-apps/ui

A dark-first React component library for **operator consoles** — the
screens a person uses to find out why one record out of a hundred
thousand did not do what it was supposed to.

- **daisyUI** for styling, so component classes stay short and themeable.
- **Headless UI** for behaviour, so focus, keyboard and ARIA are not
  reimplemented per component.
- **A parameterised status system**, so one glyph vocabulary serves every
  state machine in an application instead of one badge component per
  enum.

Requires React 18.3+ or 19, Tailwind CSS v4, and daisyUI v5.

```sh
pnpm add @vaam-apps/ui
```

## Setup

Two steps, and skipping the second is the most common way to end up with
an unstyled page.

**1. Import the token layer** into your global stylesheet, *after*
Tailwind and the daisyUI plugin:

```css
@import "tailwindcss";
@plugin "daisyui" {
  themes: false;
}
@import "@vaam-apps/ui/styles/theme.css";
@source "../node_modules/@vaam-apps/ui/dist";
```

**`themes: false` is load-bearing, not tidiness.** This package defines
its themes under daisyUI's own `dark` and `light` names, and daisyUI's
built-ins emit at a higher specificity than any custom theme block can:

```css
/* daisyUI's built-in — specificity (0,3,1) */
:is(:root:has(input.theme-controller[value=dark]:checked),[data-theme=dark]) { … }
/* a custom theme block — specificity (0,1,0) */
:where(:root),[data-theme=dark] { … }
```

The built-in therefore wins on every token it also defines — `base-100`,
`base-200`, `base-300`, `base-content` — regardless of import order, so
the page background, card surfaces and body text silently come out as
stock daisyUI rather than this theme. Turning the built-ins off leaves
nothing to collide with. Found by measuring a rendered page, not by
reading: `--color-base-100` resolved to `oklch(25.33% .016 252.42)` where
the theme declares `#0a0b0d`.

**2. Keep the `@source` line.** Tailwind v4 generates only the utilities
it can see used, and it does not look inside `node_modules` on its own.
Without it every component renders with no styling at all — no error, no
warning, just a page that looks broken in a way that is miserable to
debug. Adjust the relative path to reach your own `node_modules`.

Two themes register, under daisyUI's own `dark` and `light` names. `dark`
carries `default: true` and `prefersdark`, so `<html data-theme="dark">` —
or no attribute at all — picks it up exactly as before. Light emits only
`[data-theme="light"]`: no `:root` rule and no `prefers-color-scheme`
query, so a dark-only application is unaffected by its presence.

One upgrade caveat: if your `<html>` already carries `data-theme="light"`
from daisyUI boilerplate, that attribute previously matched nothing and
now matches. Set `data-theme="dark"` explicitly if that is you.

**3. Load the faces, or accept the fallback.** `theme.css` names four
roles — `--font-display` (IBM Plex Serif), `--font-sans` (IBM Plex Sans),
`--font-italic` (IBM Plex Serif) and `--font-mono` (JetBrains Mono) — as
**stacks, not `@font-face` rules**. This package ships no font files and
still does not. Load them however you already load fonts:

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Serif:ital,wght@0,500;0,600;1,400;1,500&family=JetBrains+Mono:wght@400;500&display=swap">
```

Skipping this is not a failure — the stacks fall back through `ui-serif` /
`system-ui` / `ui-monospace` and every screen still works. It is a quieter
loss than the two steps above: the display and italic roles collapse into
the same system serif, and the four-voice distinction goes with them.

## What is in it

### Primitives

`Button` · `Input` · `Textarea` · `Label` · `FormField` · `Select` ·
`RadioGroup` · `ChipSelect` · `Checkbox` · `Switch` · `Calendar` ·
`DatePicker` · `DateRangePicker` · `Dialog` · `ConfirmDialog` · `Drawer` ·
`Popover` · `DropdownMenu` · `CommandMenu` · `Tooltip` · `Toast` ·
`Table` · `Tabs` · `Pagination` · `Card` · `Badge` · `Separator` ·
`Skeleton` / `SkeletonText` · `Spinner` · `Progress` · `SideNav` ·
`InlineConfirm` · `ThemeSwitcher` / `useTheme`

### Data display

`Money` · `IdDisplay` · `PhoneDisplay` · `MaskedValue` · `CopyButton` ·
`TimestampDisplay` · `DetailRow` / `DetailList` · `StatTile` ·
`InstrumentPanel` · `Code`

### Patterns

`ScreenStack` / `ScreenHeader` · `InlineBanner` · `InlineEmptyState` ·
`StaleWriteBanner` · `RouteSkeleton` · `PayloadInspector` ·
`StateTimeline` · `LiveRow`

### Status

`StatusPill` · `createStatusPill` · `StateMark` · `StateChip` ·
`defineStatusSystem` · `HUE_CLASSES` · `isQuietHue`

## The status system

A status system is one state machine's presentation: every state it can
be in, mapped to a glyph, a hue, an attention level and human copy. The
library owns the vocabulary and the rendering. **The table belongs to
you**, because what a state means is domain knowledge.

```tsx
import { createStatusPill, defineStatusSystem } from "@vaam-apps/ui";

export const ORDER_STATUS = defineStatusSystem({
  pending: {
    family: "in-flight", silhouette: "circle", mark: "pie-1",
    hue: "neutral", filled: false, attention: "quiet",
    label: "Pending", tooltip: "Accepted. Nothing has claimed it yet.",
  },
  charging: {
    family: "in-flight", silhouette: "circle", mark: "pie-2",
    hue: "progress", filled: false, attention: "quiet",
    label: "Charging", tooltip: "The rail is taking the payment. Nothing is decided yet.",
  },
  authorising: {
    family: "in-flight", silhouette: "circle", mark: "ring",
    hue: "parked", filled: false, attention: "quiet",
    label: "Authorising", tooltip: "Sent to the payer's bank. Waiting for them to approve it.",
  },
  paid: {
    family: "terminal", silhouette: "circle", mark: "check",
    hue: "success", filled: true, attention: "quiet",
    label: "Paid", tooltip: "Settled and captured.",
  },
  lapsed: {
    family: "terminal", silhouette: "circle", mark: "clock",
    hue: "expired", filled: true, attention: "quiet",
    label: "Lapsed", tooltip: "Nobody approved it before the window closed.",
  },
  disputed: {
    family: "unresolved", silhouette: "diamond", mark: "question",
    hue: "uncertain", filled: false, attention: "loud",
    label: "Disputed", tooltip: "The payer opened a chargeback.",
  },
});

export const OrderStatusPill = createStatusPill(ORDER_STATUS);
```

```tsx
<OrderStatusPill state="disputed" showLiteral />
```

`state` accepts exactly that machine's literals, so a status from a
different machine is a compile error. Add a second machine by calling
`createStatusPill` again — the rendering is shared, the vocabularies stay
apart.

### Choosing a hue

Eight, and picking from the four obvious ones is the mistake this table
exists to stop. The first three rows are all "not finished", and they are
not interchangeable.

| Hue | What it tells the reader | Example state |
| --- | --- | --- |
| `neutral` | Not finished, and nothing is happening to it | `pending` — accepted, nothing has claimed it |
| `progress` | Not finished, and **this** system is working on it now | `charging` — the rail is taking the payment |
| `parked` | Not finished, and somebody **outside** this system is holding it | `authorising` — waiting for the payer to approve on their handset |
| `success` | Over, and it worked | `paid` |
| `danger` | Over, and it did not work | `failed` |
| `expired` | Over because a window closed — nobody decided anything | `lapsed` — no answer arrived in time |
| `warning` | A recoverable condition needs a human | `stalled` — retryable in principle, but nothing is driving it |
| `uncertain` | The outcome is unknown, and will not be learned | `unknown` — sent, and no acknowledgement ever arrived |

Three clusters account for nearly every wrong pick:

- **`neutral` vs `progress` vs `parked`** — the three ways a record can be
  unfinished, and they answer *who has it*: nobody (`neutral`), this
  system (`progress`), somebody else (`parked`). All three stay `quiet`;
  none of them needs a human. The hue is there so the row is told apart in
  a peripheral scan down a column, not so it pulls the eye.
- **`warning` vs `uncertain`** both read as "attention", and are not the
  same attention. `warning` means a recoverable condition needs a human —
  somebody can act, and acting will help. `uncertain` means the outcome is
  unknown — there may be nothing to do and nothing to learn. A stalled job
  is `warning`; a send whose receipt never came back is `uncertain`.
- **`neutral` vs `expired`** are the two undramatic ones. Both say nothing
  is happening; only `expired` says a window closed. They are also the
  closest pair in the system chromatically — see the ΔE note below.

`parked` is the one that gets missed, because it looks like either of its
neighbours. It is not `progress`: nothing is being attempted, and time
passing will not advance it — only a decision by someone you are waiting
on. It is not `neutral` either, which is transparent on a transparent
ground and deliberately does *not* pull the eye, so a payment sitting on a
payer's handset stops being findable in a table of a thousand rows.
Reaching for `uncertain` is worse still: amber makes every healthy
in-flight payment read as a problem. `parked` is violet, and quiet, and
its mark is `ring`.

There is deliberately **no `info` hue**, and the eighth hue is named
`progress` for that reason. Blue is selection and focus only (`--ring`),
never a status — `theme.css` even pins daisyUI's own `--color-info` to the
neutral grey with a written reason, so a `StatusHue` named `info` would
contradict its own neighbour by name. The two states an `info` hue gets
reached for are `progress` and `parked`.

### Choosing a mark

Eleven, and the names do not tell you which of the unfinished ones you
want. `filled` is a separate channel: terminal marks sit on a filled
silhouette and knock out of it, in-flight and unresolved marks are
stroked on an empty one.

| Mark | The distinction it draws | Reach for it when |
| --- | --- | --- |
| `pie-1` `pie-2` `pie-3` | A quarter, half and three-quarter progress wedge | **This** system is doing the work, and you can say roughly how far through it is |
| `ring` | A completed stroke with a hollow centre | The work has left this system — the next event comes from outside, and no progress can be reported until it does |
| `clock` | A window, not a worker | Nothing is being attempted; only time passing changes anything |
| `pause` | Stopped, with nobody driving it | It could resume, and it will not resume on its own |
| `check` | Over, and it worked | The happy terminal state |
| `cross` | Over, and it failed | Something went wrong and stayed wrong |
| `slash` | Over, on purpose | Cancelled, rejected, skipped — nothing failed |
| `bar` | Over, with no verdict to report | Refunded, voided, superseded |
| `question` | The outcome was never learned | Pair it with `uncertain`; it is not a failure |

The four that overlap are `pie-*`, `ring`, `clock` and `pause` — all of
them "not finished yet", and they split on the same question the hue axis
splits on: *who is holding it*. That is not a coincidence, and the two
axes are meant to agree:

| Who has it | Hue | Mark |
| --- | --- | --- |
| This system, actively | `progress` | `pie-1` / `pie-2` / `pie-3` |
| Somebody outside it | `parked` | `ring` |
| Nobody — only the clock | `neutral` | `clock` |
| Nobody at all, and it is stuck | `warning` | `pause` |

`ring` + `parked` is the combination a real state machine reaches for most
and the one easiest to miss, because "submitted" sounds like progress this
system is making.

### Mapping an in-flight state

Every state machine has a state that is *running and not yet resolved* —
a payment the rail has, a job a worker claimed, a deploy underway, a
webhook mid-delivery. It maps like this, and the two adjacent hues are
both wrong for it:

```tsx
processing: {
  family: "in-flight", silhouette: "circle", mark: "pie-2",
  hue: "progress", filled: false, attention: "quiet",
  label: "Processing", tooltip: "The rail has the charge. Nothing is decided yet.",
},
```

- **`hue: "progress"`**, not `uncertain`. `uncertain` means the outcome
  is unknowable — sent, and the answer never came back. A payment that is
  merely *in flight* is entirely normal, and colouring it `uncertain`
  gives an operator scanning for real problems a false positive on every
  healthy row.
- **`hue: "progress"`**, not `neutral` either. `neutral` is for a state
  where nothing is happening and nothing is expected to — a queued item
  nobody has claimed, a refunded order that is over. An in-flight record
  has to stay tellable-apart from a settled one in a peripheral scan of a
  hundred thousand rows, which is the scan this library exists for.
- **`hue: "progress"`**, not `parked`, *while the rail is still working*.
  The moment the next move belongs to a person — the payer approving on
  their handset, a reviewer signing off — it becomes `parked` and its mark
  becomes `ring`. Time advances a `progress` state; only somebody else
  advances a `parked` one.
- **`attention: "quiet"`.** The hue makes the row *identifiable*; the
  attention level makes it *demand a human*. An in-flight payment demands
  nobody. Go `loud` on a detail screen showing one record, not down a
  column.
- **`filled: false`, and a `pie-*` mark.** Fill answers "is it over?" on
  its own, in grayscale and in a monochrome screenshot — the redundancy
  that keeps hue from being load-bearing.

`family: "in-flight"` is metadata, not a channel — nothing in the
rendering reads it. It drives `isTerminalStatus`, which answers "should
this row stop polling", and that is all it does.

### What is deliberate

- **Each state differs in silhouette, interior mark and fill as well as
  hue.** Colour alone fails for the ~8% of men with a colour-vision
  deficiency and fails completely in a monochrome screenshot pasted into
  a ticket. That redundancy is load-bearing rather than decorative: the
  closest two hues in the system, `neutral` and `expired`, are ΔE00 8.7
  apart, so inside a 14px glyph the *mark* is doing much of the work of
  telling them apart.
- **`family` is presentational, never authorisation.** A UI that greys
  out "cancel" because its own table says `terminal` will be wrong the
  first time the state machine changes and nobody remembers the table
  exists. Propose the action; let the server refuse it.
- **`unresolved` is a first-class outcome**, distinct from success and
  failure. Systems that model only two outcomes end up reporting "we
  never learned what happened" as whichever is more convenient.
- **Every hue is legible in both treatments**, on all four steps of the
  surface ladder. Measured against the hex tokens in `theme.css`, not
  assumed — the tokens are authored in hex, so a helper that expects oklch
  parses none of them and reports success on nothing. Quiet glyphs run
  6.34:1 to 13.65:1 against the 3:1 a non-text graphic needs, and loud
  pills — where the 12px label takes the hue itself — run 5.53:1 to
  11.71:1 against 4.5:1. The worst case in the system is `expired`, loud,
  on a hovered row.

## Money

```tsx
import { formatMoney, Money } from "@vaam-apps/ui";

<Money amount={500_000} currency="XAF" />        // XAF 500,000
<Money amount="1250" currency="USD" />           // USD 12.50
formatMoney(1250, "KWD");                        // KWD 1.250
```

Amounts go in as an **integer count of minor units** — `number`,
`bigint`, or a digit string, so an `i64` from a backend survives the
trip. The decimal exponent comes from `Intl`, which knows every ISO 4217
currency including the three-decimal ones (`KWD`, `BHD`, `TND`) that
hand-written tables invariably forget. Scaling is string surgery, never
division, so a `bigint` or a digit string formats exactly at any size.

A `number` cannot make that promise past `Number.MAX_SAFE_INTEGER`, and
`formatMoney` throws rather than pretending otherwise. Not because every
such value has lost precision — `1e16` is exact — but because a `number`
no longer carries enough information to tell an exact value from one the
caller's arithmetic already rounded, and printing a figure that *looks*
exact is the one thing a money formatter must never do. A non-integer
throws too, rather than being silently rounded.

## Dates

`DatePicker` and `DateRangePicker` wrap `react-day-picker` in a popover
and exchange **`YYYY-MM-DD` strings, not `Date` objects**. A `Date` is an
instant, and an instant rendered in another zone is a different calendar
day — which is how a filter for "today" quietly returns yesterday's rows
for anyone west of the server. `Date` is confined to the internals.

```tsx
const [range, setRange] = useState<IsoDateRange | undefined>();
<DateRangePicker value={range} onValueChange={setRange} />
```

`Calendar` is the bare, themed `DayPicker` if you need a different shell.

## `cn()`

`clsx` + `tailwind-merge`, extended so the later class wins for this
theme's own scales and for daisyUI's component modifiers:

```ts
cn("btn btn-primary", "btn-ghost");      // "btn btn-ghost"
cn("btn btn-primary", "btn-outline");    // both — orthogonal in daisyUI 5
cn("rounded-sm", "rounded-field");       // "rounded-field"
cn("text-caption", "text-danger-fg");    // both — size and colour
```

That last case is the one worth knowing about: stock `tailwind-merge`
classifies an unrecognised `text-*` value as a colour, so a custom font
size sitting beside a colour is silently deleted. The scale is registered
here so it is not.

## Design constraints

Worth knowing before you fight them:

- **Three surface registers, and borders are still the default.**
  *Diagnostic* surfaces — tables, drawers, detail panes, the places you
  **read** — are a 1px border on a surface step, and that is most of the
  library. *Floating* layers (popover, dialog, drawer, toast) get a
  shadow, because they overlap a ground they do not know. *Instrument*
  surfaces — dashboards and metrics, the places you **scan** — get an
  aurora: `InstrumentPanel`'s mesh ground, or `Card glow`. The third one
  is a deliberate exception, not a loosening: a glow on every card is a
  glow on none, and the rule still holds everywhere it was doing work.
- **There is no success or warning *button*.** Those hues belong to
  status; a button is primary, secondary, ghost or destructive. Mixing
  them is how a status language erodes.
- **Empty states are inline status lines, not centred placards** — see
  `InlineEmptyState`.
- **Hue means status, with exactly one exception.** The `--aurora-*` ramp
  — the skeleton's drift, `InstrumentPanel`'s mesh, `Card glow` — is
  chrome: bound by `color-mix` to the system's own hues so it cannot
  drift, and carrying no meaning at all. Nothing infers a state from it
  and no caller can express one through it, which is the only reason a
  coloured surface is safe in a system whose premise is that colour
  means something.
- **Two of the eight status hues are quiet.** `neutral` and `success`
  declare `transparent` for their own fill and border on purpose, so a
  screen where most rows succeeded is a column of glyphs and words rather
  than a wall of green boxes. A surface that needs a *box* for a quiet
  hue draws ordinary `border-edge`/`bg-surface-2` chrome and keeps only
  the hue's foreground — `isQuietHue` is the predicate, and painting the
  quiet tokens as unconditional chrome has now produced an invisible box
  four separate times.
- **A slot with a line budget clips; it never grows.** Nav labels, card
  titles, select values, tile captions, option descriptions and toast
  bodies all end in an ellipsis rather than wrapping, because a row of
  cards where one is taller reads as broken rather than as informative.
  Values a reader must be able to *match* — ids, phone numbers, amounts
  — are never truncated, which is the whole distinction `Code` and
  `IdDisplay` exist to draw.
- **Skeletons drift; they do not shimmer.** A shimmer sweeps on a fixed
  period, which reads as progress a placeholder cannot know about, and a
  column of them beats like a metronome. `Skeleton` runs a chaotic
  gradient instead — soft aurora ribbons on coprime periods (23s and 31s),
  no sweep, no direction, out of phase with its neighbours — and stops
  entirely under `prefers-reduced-motion`.
- **Two themes, and dark is still the default.** A second theme is a real
  amount of work to keep honest, and the honest part is contrast, not
  colour: every status foreground in the dark set is a 300-level tint
  chosen for ~11:1 against near-black, and measured against white all
  eight fell between 1.4:1 and 2.6:1 — every one below AA. So
  `src/lib/contrast.test.ts` was written *first* and the light values
  searched against it. `dark` keeps `default: true` and `prefersdark`, so
  a consumer who sets no `data-theme` gets exactly what they got before.
  Light is opt-in, via `data-theme="light"` or `ThemeSwitcher`.

## The component gallery

Every component is published as a Storybook at
**<https://vaam-apps.github.io/ui/>**, redeployed from `main` on every
push. The a11y panel runs axe on each story.

## Development

```sh
pnpm install
pnpm storybook        # the component gallery, at :6006
pnpm test             # unit tests + the invariant guards
pnpm typecheck
pnpm lint             # biome, format and lint together
pnpm build            # what npm receives: dist/ + declarations
```

**Storybook is the visual-QA surface**, and stories live beside the
components they demonstrate. That colocation is deliberate: this package
previously had its gallery in a consuming application, where it drifted —
it claimed to render every export and had silently missed thirteen of
them, including the three that turned out to be carrying live rendering
bugs. A story in the same directory as its component at least shows up in
the same diff.

The `@storybook/addon-a11y` panel runs axe on every story. It is not
decoration: it is what caught `--subtle-foreground` failing WCAG AA on
every surface in the system, across 38 usages, by flagging fourteen
calendar weekday headers at once.

A few guards are worth knowing about before you trip one:

- **`src/lib/theme-tokens.test.ts`** scans the components for
  `bg-`/`text-`/`border-` tokens this stylesheet owns and fails if one is
  not declared. Tailwind generates nothing for an unknown token and says
  nothing about it, which has produced invisible transparent surfaces
  here twice.
- **`src/components/primitives/calendar.render.test.tsx`** renders the
  calendar and asserts the classes land on the elements react-day-picker
  actually emits. Its sibling `calendar.test.ts` only checks that the
  `classNames` keys are real — necessary, and not sufficient: a valid key
  carrying a class string written against a DOM shape that does not exist
  is exactly how the selection styling silently matched nothing.
- **`src/lib/cn.test.ts`** pins the merge behaviour, including the case
  where `tailwind-merge` deletes a custom font size because it mistakes
  it for a colour.
- **`src/components/primitives/form-field.render.test.tsx`** pins what
  each control *actually* emits when `FormField` wires it to its hint and
  error. `tsc` cannot check it (`cloneElement` on an `isValidElement<P>`
  cast type-checks whatever you claim) and axe cannot see it (an
  unassociated `<p>` is valid HTML), so the first version of that feature
  shipped with a doc comment asserting it worked for controls where it
  did not. One row of that test pins a *limitation* rather than a
  feature: Headless UI's `ListboxButton` owns `aria-describedby`, so a
  `FormField` hint cannot reach a `Select`. If an upgrade changes that,
  the test fails and says so.
- **`src/lib/story-coverage.test.ts`** fails when an exported component
  is mentioned by no story. Colocation makes the drift visible in a
  diff; this makes it a build failure, because "added a component,
  forgot the story" is one file and passes every other check. Exemptions
  live in that file as a short list with reasons, and a stale exemption
  fails too.

## Releasing

Tag `vX.Y.Z` matching `package.json`; `.github/workflows/release.yml`
publishes to npm through Trusted Publishing (OIDC), with no token stored
in this repository.

**Except the very first publish, which that workflow cannot do.** npm
attaches a trusted publisher to an *existing* package, so there is
nothing to configure until the name exists. Bootstrap it once by hand:

```sh
npm login
pnpm install
pnpm publish --access public
```

Then add the trusted publisher on npmjs.com (repository `vaam-apps/ui`,
workflow `release.yml`). Every later tag publishes tokenlessly.

## Versioning

Pre-1.0. Minor versions may contain breaking changes; pin exactly if that
matters to you. See `CHANGELOG.md`.

## Licence

MIT.
