# AGENTS.md

Working notes for `@vaam-apps/ui` — a dark-first React component library
for operator consoles. `CLAUDE.md` is a symlink to this file; there is one
document, not two that drift.

This is not a summary of the README. It is the set of things that are
**not** derivable from reading the source in the order you would naturally
read it — the traps, the conventions, and the reasons behind decisions
that look arbitrary until they bite.

## Commands

Run the project's own scripts. There is no hidden wrapper.

```sh
pnpm install
pnpm lint          # biome check .   — the whole tree, not per-file
pnpm typecheck     # tsc --noEmit    — covers src, .storybook AND e2e
pnpm test          # vitest run
pnpm build         # tsc -p tsconfig.build.json + copy styles + fix specifiers
pnpm storybook     # dev server on :6006
pnpm build-storybook
pnpm e2e           # playwright, against the built storybook-static/
```

`pnpm lint` is the one people get wrong: per-file `biome check <path>` will
pass while the repo gate fails, because formatting and the
`suppressions/unused` rule are only meaningful across the tree. Always run
the bare script before claiming green.

`pnpm e2e` needs `storybook-static/` to exist (`pnpm build-storybook`) and
downloads Chromium on first use (`npx playwright install chromium`).

## Layout

```
src/components/primitives/  buttons, inputs, overlays, nav, table, calendar
src/components/status/      the status system — see below, it is the spine
src/components/data/        display of values: ids, phones, money, timestamps
src/components/patterns/    compositions: banners, empty states, live rows
src/lib/                    cn(), money, formatting, hooks, AND the gates
src/styles/theme.css        every token, both themes, all the custom classes
src/docs/                   long-form Storybook docs (.mdx)
e2e/                        Playwright specs — the real-browser gate
scripts/                    build and release helpers (not published)
```

`src/index.ts` is the public surface and is **curated, not generated**.
`src/lib` is exported selectively — several modules there exist so that
something is testable without widening the API.

## The conventions that are actually load-bearing

**Doc comments explain *why*, and cite measurements.** This codebase's
comments are unusually long on purpose. They record the failure a decision
prevents and the numbers behind it. When you change such a code, update
the comment in the same edit; a comment that survives the reasoning it
describes is worse than none. Never invent a number — measure it or leave
it out.

**Colour means something, and the status system owns it.** `StatusHue` is
the vocabulary. Decorative chrome (the aurora glow and mesh) carries no
state, cannot be tinted per state, and is bound to the same hues precisely
so it cannot drift into looking like a signal. Do not add a coloured
surface that a reader could mistake for a status.

**Three surface registers**, described in full in
`src/components/data/instrument-panel.tsx`: *diagnostic* (a hairline on a
surface step — most of the library), *floating* (a shadow, because it
overlaps a ground it does not know), *instrument* (the aurora mesh; you
scan it rather than read it).

**Four type voices** — display, sans, italic, mono — declared in
`theme.css`. Italic marks human prose written to the operator. The test is
in that file: *could this string be a template that only fills in a value
the system already has?* Then it is an emitted fact and stays upright.

**Stories live beside their component** and every export must appear in
one — `src/lib/story-coverage.test.ts` makes it a build failure. The
predecessor gallery lived in another repo, claimed to render everything,
and had silently missed thirteen exports, three of them carrying live
bugs.

## Traps that have each cost real time

**daisyUI emits into nested cascade layers.** An unlayered Tailwind utility
outranks a nested sublayer, so `rounded-field` in a base class string beats
`.btn-circle`, and a `shadow-none` utility would beat `.aurora-glow`. When a
daisyUI component class appears not to apply, this is why. It has happened
twice.

**`tailwind-merge` needs custom groups.** `src/lib/cn.ts` splits
`daisy-btn-size` from `daisy-btn-shape`; before that, `cn("btn-circle",
"btn-sm")` silently deleted `btn-circle`. Custom font sizes are registered
there too (`REGISTERED_FONT_SIZES`), because tailwind-merge otherwise
mistakes them for colours. `src/lib/cn.test.ts` pins both.

**`position: fixed` is not relative to the viewport if any ancestor has
`transform`, `filter`, `backdrop-filter`, `contain` or
`will-change: transform`.** `vaul` stamps `will-change: transform` on every
drawer unconditionally, so `SideNav`'s floating rails are portalled to
`document.body`. If you add anything `fixed`, assume a consumer wrapped you
in a drawer.

**jsdom has no layout and no CSS.** `src/lib/a11y.test.tsx` is real and
valuable, and it structurally cannot see contrast in situ, focus-ring
visibility, overflow clipping, or hit-target size. Those live in `e2e/`.
Do not "fix" a jsdom test by asserting geometry it cannot measure.

**A test that asserts a class string is not a test.** It is the specific
thing that passed while `Button size="icon"` rendered a 12px radius on a
32×32 box, and while the nav rail shipped 16×32px tap targets under a
comment claiming 40px. Assert computed values.

**`overflow-x: auto` forces computed `overflow-y` from `visible` to
`auto`.** Several stray scrollbars in this repo trace back to it.

**A tag pushed by a workflow using `GITHUB_TOKEN` triggers no other
workflow.** GitHub suppresses it; `workflow_dispatch` and
`repository_dispatch` are the only exceptions. `version.yml` pushes the tag
and then dispatches `release.yml` explicitly. This is documented in
`.changeset/README.md` because it otherwise looks like a bug.

## The gates, and what each exists for

Each was written after something passed while the thing it named was
broken. That is the point of the list.

| Gate | Exists because |
|---|---|
| `lib/contrast.test.ts` | a palette picked by eye ships a status vocabulary nobody can read. Parses `theme.css`, composites translucent fills. It once stayed green with the whole light theme deleted — it now asserts the theme roster and each text tier by name. |
| `lib/a11y.test.tsx` | axe over components mounted with `createRoot` + `act`. It **must** be a client render: Headless UI wires `aria-labelledby` in an effect, so `renderToStaticMarkup` reports violations that are not real. |
| `lib/story-coverage.test.ts` | an export nobody ever mounts is a blind spot. |
| `lib/cn.test.ts` | tailwind-merge deleting classes silently. |
| `lib/theme-tokens.test.ts` | Tailwind generates nothing for an unknown token and says nothing about it. |
| `*.render.test.tsx` | a valid `classNames` key carrying a class string written against a DOM shape that does not exist. |
| `side-nav.portal.test.tsx` | the portal target and the landmark count, neither visible to a component-scoped audit. |
| `table.scroll.test.tsx` | the scrollable branch jsdom can never reach, with `ResizeObserver` and `scrollWidth` stubbed. |
| `lib/stamp-changelog.test.ts` | mostly refusals — the release must fail rather than ship an undescribed version. |
| `e2e/` | contrast in situ, focus rings, clipping, hit targets. |

**Mutation-check new guards.** Break the thing, confirm the guard fails,
restore. A guard nobody has seen fail is a guard nobody should trust. This
has caught at least three tests here that asserted nothing.

## The skill, and keeping it current

`skills/vaam-ui/` is installed into **other repositories** — vpay, vsms —
by `npx skills add vaam-apps/ui`. Over there it is the whole
documentation: the agent reading it cannot see this source tree, and none
of the tests below run.

**Whenever you add, rename, or meaningfully change a public export,
update the skill in the same change.** Not afterwards, and not "when
someone notices" — a rename here becomes an instruction to import
something that does not exist, in a repo where nothing will contradict it.
The same applies to a changed default or a new required setup step: if a
consumer would do something different because of your change, the skill
has to say so.

You are not relied on to remember this. `src/lib/skill.test.ts` fails
when a public export is not mentioned anywhere in the skill, and fails
when the skill names something that is no longer exported — it caught
four wrong names the day it was written. Exemptions live in that file as
a short list with reasons, and a stale exemption fails too.

What the gate cannot check is whether the *prose* is still true. If you
change what a component means rather than what it is called, read the
skill's entry for it before you finish.

## Releasing

Versions are [changesets](https://www.npmjs.com/package/@changesets/cli);
`changelog: false`, because `CHANGELOG.md` is hand-written prose and a
generator would overwrite it. Publishing is npm Trusted Publishing (OIDC)
from a tag — there is no npm token in this repository and there is not
meant to be one.

Add `pnpm changeset` alongside a change; write the entry under
`## Unreleased`; run the **Version** workflow to release. It refuses when
`## Unreleased` is empty, which is the one failure `changelog: false`
trades for prose. `.changeset/README.md` has the full reasoning.

## Working here

- Don't run `pnpm format` across the tree as part of an unrelated change;
  it buries the diff.
- Don't add a dependency without saying what it buys. The list is short on
  purpose (note `@storybook/addon-vitest` is *not* installable here — it
  peers on vitest ^3/^4 against this repo's ^5).
- Behaviour changes to defaults are breaking for consumers even when the
  types are unchanged. Say so in `CHANGELOG.md` explicitly; several
  entries exist purely to do that — **and check whether
  `skills/vaam-ui/` needs the same sentence**, since that is what the
  consuming repositories actually read.
- When a reviewer or a gate contradicts you, reproduce it before arguing.
  More wrong conclusions here have come from reasoning about CSS than from
  looking at a render.
