# What to reach for

Grouped by the job, not by the folder. Everything imports from
`@vaam-apps/ui`.

## Showing a value

| Need | Component |
|---|---|
| An id a person may need to copy | `IdDisplay`, `CopyButton` |
| A phone number | `PhoneDisplay` |
| Money | `Money`, plus the `formatMoney` / `parseMoney` helpers |
| A timestamp | `TimestampDisplay` |
| A secret, partly hidden | `MaskedValue` |
| A single headline figure | `StatTile` |
| A label/value list | `DetailList` + `DetailRow` |
| A request or response body | `PayloadInspector`, `Code` |

`DetailRow` has `divided` / `stacked` / `inline` variants; all three use
the same type pairing (small quiet label, body-size value), so mixing
them in one `DetailList` is safe.

## Surfaces

Three registers, and picking the wrong one is the most common taste error:

- **Diagnostic** — `Card`, `Table`, `DetailList`, drawers. A hairline on a
  surface step. You *read* these row by row looking for the wrong one.
  This is most of the library and should be most of your screens.
- **Floating** — `Dialog`, `Drawer`, `Popover`, `Toaster`. A shadow, because
  they overlap a ground they do not know.
- **Instrument** — `InstrumentPanel`, and `Card` with `glow`. An aurora
  mesh ground for data you *scan*. Use sparingly: a screen where every
  card glows has no glow.

## Input

`Button`, `Input`, `Textarea`, `Select`, `Checkbox`/`CheckboxField`,
`Switch`/`SwitchField`, `RadioGroup`, `ChipSelect`, `DatePicker`,
`Calendar`, `FormField`, `Label`.

`FormField` wires a control to its hint and error (`aria-describedby`,
`aria-invalid`). Use it rather than rendering a `<p>` under an input —
an unassociated paragraph is valid HTML and reaches nobody.

One known limitation: a `FormField` hint cannot reach a `Select`, because
Headless UI's `ListboxButton` owns `aria-describedby`. There is a test
pinning that limitation, so it will announce itself if it changes.

## Feedback and state

`InlineBanner`, `InlineEmptyState`, `InlineConfirm`, `ConfirmDialog`,
`Progress`, `Spinner`, `Skeleton`/`SkeletonText`, `RouteSkeleton`,
`StaleWriteBanner`, `LiveRow`, `StateTimeline`.

Toasts are a function plus one mounted host: call `toast(…)` (and
`dismissToast`) from anywhere, and render `<Toaster />` once near the root.

`Skeleton` animates a slow aurora drift and goes still under
`prefers-reduced-motion`. Do not add your own pulse.

## Navigation and layout

`SideNav`, `ScreenStack` + `ScreenHeader`, `ValueTabs` (with
`ValueTabsList` / `ValueTabsTrigger` / `ValueTabsContent`), `Pagination`,
`CommandMenu`, `DropdownMenu`, `Separator`, `Tooltip`, `ThemeSwitcher`.

`SideNav`'s shapes by width: a horizontal bottom pill below 640px, a
vertical floating rail from 640 to 1279, the sidebar at 1280+ — or the
rail again with `collapsed`. **Only the sidebar takes space out of the
page**; everything narrower floats over it, which is what lets you build
one layout instead of one per band. See `pitfalls.md` for what that means
for your padding.

In a `DropdownMenu`, use `DropdownMenuItem` for a command and
`DropdownMenuLinkItem` for a destination. The second is an `<a>`, and a
menu of places built from buttons silently loses middle-click, ⌘-click
and "copy link address".

## Utilities

`cn()` — merge classes onto any component. Use it rather than template
strings: it resolves Tailwind conflicts in call order and knows this
package's custom font sizes, which plain `clsx` would mistake for colours.

`useTheme` / `ThemeSwitcher` / `THEME_STORAGE_KEY` — theme state.
`useReducedMotion` — for your own animated surfaces.
