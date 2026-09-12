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
its theme under daisyUI's own `dark` name, and daisyUI's built-in `dark`
emits at a higher specificity than any custom theme block can:

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

The theme registers itself under daisyUI's `dark` name and sets
`prefersdark`, so `<html data-theme="dark">` (or no attribute at all)
picks it up.

## What is in it

### Primitives

`Button` · `Input` · `Textarea` · `Label` · `FormField` · `Select` ·
`RadioGroup` · `ChipSelect` · `Checkbox` · `Switch` · `Calendar` ·
`DatePicker` · `DateRangePicker` · `Dialog` · `ConfirmDialog` · `Drawer` ·
`Popover` · `DropdownMenu` · `CommandMenu` · `Tooltip` · `Toast` ·
`Table` · `Tabs` · `Pagination` · `Card` · `Badge` · `Separator` ·
`Skeleton` · `Spinner` · `Progress` · `SideNav` · `InlineConfirm`

### Data display

`Money` · `IdDisplay` · `PhoneDisplay` · `MaskedValue` · `CopyButton` ·
`TimestampDisplay` · `DetailRow` / `DetailList` · `StatTile` · `Code`

### Patterns

`ScreenStack` / `ScreenHeader` · `InlineBanner` · `InlineEmptyState` ·
`StaleWriteBanner` · `RouteSkeleton` · `PayloadInspector` ·
`StateTimeline` · `LiveRow`

### Status

`StatusPill` · `createStatusPill` · `StateMark` · `StateChip` ·
`defineStatusSystem` · `HUE_CLASSES`

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
    label: "Pending", tooltip: "Accepted. Waiting its turn.",
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

Seven, and picking from the four obvious ones is the mistake this table
exists to stop. `authorising` above is the case: an in-flight state whose
next move belongs to *somebody else*.

| Hue | What it tells the reader | Example state |
| --- | --- | --- |
| `neutral` | Still moving, and nobody needs to do anything | `pending` — accepted, waiting its turn in this system |
| `parked` | Still moving, but someone outside this system is holding it | `authorising` — handed to the rail, waiting for the payer to approve on their handset |
| `success` | Over, and it worked | `paid` |
| `danger` | Over, and it did not work | `failed` |
| `expired` | Over because a window closed — nobody decided anything | `lapsed` — no answer arrived in time |
| `warning` | A recoverable condition needs a human | `stalled` — retryable in principle, but nothing is driving it |
| `uncertain` | The outcome is unknown, and will not be learned | `unknown` — sent, and no acknowledgement ever arrived |

Two pairs account for nearly every wrong pick:

- **`warning` vs `uncertain`** both read as "attention", and are not the
  same attention. `warning` means a recoverable condition needs a human —
  somebody can act, and acting will help. `uncertain` means the outcome is
  unknown — there may be nothing to do and nothing to learn. A stalled job
  is `warning`; a send whose receipt never came back is `uncertain`.
- **`neutral` vs `expired` vs `parked`** are the three undramatic ones, and
  they answer three different questions: nobody needs to act (`neutral`),
  it lapsed (`expired`), someone is being waited on (`parked`).

`parked` is the one that gets missed, because a normal in-flight state
feels like it should be `neutral`. It should not. `neutral` is transparent
on a transparent ground — deliberately the hue that does *not* pull the
eye — so a payment sitting on a payer's handset stops being findable in a
table of a thousand rows. Reaching for `uncertain` instead is worse: amber
makes every healthy in-flight payment read as a problem. `parked` is
violet, and quiet, and its mark is `ring`.

There is deliberately **no `info` hue**. Blue is selection and focus only
(`--ring`), never a status — `theme.css` even pins daisyUI's own
`--color-info` to the neutral grey for that reason. The state an `info`
hue would be reached for is `parked`.

### Choosing a mark

Eleven, and the names do not tell you which of the six unfinished ones you
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
them "not finished yet", and the difference between them is *who is
holding it*: this system (`pie-*`), somebody else (`ring`), nobody but the
clock (`clock`), nobody at all (`pause`). `ring` + `parked` is the
combination a real state machine reaches for most and the one easiest to
miss, because "submitted" sounds like progress this system is making.

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
  assumed: quiet glyphs run 6.34:1 to 13.65:1 against the 3:1 that a
  non-text graphic needs, and loud pills — where the 12px label takes the
  hue itself — run 5.53:1 to 11.64:1 against 4.5:1. The worst case in the
  system is `expired`, loud, on a hovered row.

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
division, so an amount past `Number.MAX_SAFE_INTEGER` formats exactly.
A non-integer throws rather than being silently rounded.

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

- **Borders, not shadows.** Cards and panels are a 1px border on a
  surface step. Shadows are reserved for genuinely floating layers
  (popover, dialog).
- **There is no success or warning *button*.** Those hues belong to
  status; a button is primary, secondary, ghost or destructive. Mixing
  them is how a status language erodes.
- **Empty states are inline status lines, not centred placards** — see
  `InlineEmptyState`.
- **Dark only.** There is one theme, and no toggle. A second theme is a
  real amount of work to keep honest and nothing here pretends to have
  done it.

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
