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
`Skeleton` / `SkeletonText` · `Spinner` · `Progress` · `SideNav` ·
`InlineConfirm`

### Data display

`Money` · `IdDisplay` · `PhoneDisplay` · `MaskedValue` · `CopyButton` ·
`TimestampDisplay` · `DetailRow` / `DetailList` · `StatTile` · `Code`

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
    label: "Pending", tooltip: "Awaiting payment.",
  },
  paid: {
    family: "terminal", silhouette: "circle", mark: "check",
    hue: "success", filled: true, attention: "quiet",
    label: "Paid", tooltip: "Settled and captured.",
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

Three things about it are deliberate:

- **Each state differs in silhouette, interior mark and fill as well as
  hue.** Colour alone fails for the ~8% of men with a colour-vision
  deficiency and fails completely in a monochrome screenshot pasted into
  a ticket.
- **`family` is presentational, never authorisation.** A UI that greys
  out "cancel" because its own table says `terminal` will be wrong the
  first time the state machine changes and nobody remembers the table
  exists. Propose the action; let the server refuse it.
- **`unresolved` is a first-class outcome**, distinct from success and
  failure. Systems that model only two outcomes end up reporting "we
  never learned what happened" as whichever is more convenient.

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

- **Borders, not shadows.** Cards and panels are a 1px border on a
  surface step. Shadows are reserved for genuinely floating layers
  (popover, dialog).
- **There is no success or warning *button*.** Those hues belong to
  status; a button is primary, secondary, ghost or destructive. Mixing
  them is how a status language erodes.
- **Empty states are inline status lines, not centred placards** — see
  `InlineEmptyState`.
- **Two of the seven status hues are quiet.** `neutral` and `success`
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
  gradient instead — two soft fields on coprime periods, no sweep, no
  direction, out of phase with its neighbours — and stops entirely under
  `prefers-reduced-motion`.
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
