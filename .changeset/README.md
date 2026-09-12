# Changesets

Changesets owns **what the next version number is**. It does not own the
changelog and it does not publish. Both of those are deliberate, and both
are places where this repository diverges from the tool's defaults — so
they are written down here rather than discovered.

## The flow

1. **With the change**, in the same PR:

   ```bash
   pnpm changeset
   ```

   Pick `patch` / `minor` / `major` and write one line. That writes a
   throwaway markdown file into this directory; commit it. The line is
   for whoever decides the next release, not for users — the CHANGELOG is
   where users are addressed.

2. **Write the entry** under `## Unreleased` in `CHANGELOG.md`, as the
   work happens. No number yet; the release puts one on.

3. **Release: run the `Version` workflow** from the Actions tab. It
   consumes the pending changesets, bumps the manifest, renames
   `## Unreleased` to the version it produced, commits, tags, and hands
   the tag to `release.yml`.

   It has a `dry_run` input that does all of that and pushes nothing —
   worth using the first time, and any time the changelog is in doubt.

   It refuses to release when `## Unreleased` is empty. That refusal is
   the point of the whole arrangement: nothing generates this changelog,
   so an empty section means a published version nobody described.

Everything in step 3 is also doable by hand — `pnpm bump`, then
`node scripts/stamp-changelog.mjs <version>`, then commit and tag. The
workflow is not a different mechanism, just the same one without the
opportunity to forget a step.

## Why `changelog: false`

Changesets' generated changelog is a list of one-line summaries with
commit hashes. This package's `CHANGELOG.md` is prose: it explains what
broke, what the obvious fix would have been and why it was wrong, and
what a consumer has to change. Several entries are the only written
record of a measurement — the exact contrast ratios a palette was
searched against, the 120px a rotated skeleton layer sweeps at 8°, the
scrollport offsets behind a sticky header.

A generator cannot produce that, and pointing one at the same file would
either overwrite it or interleave two registers in one document. So the
generator is off, and the changelog stays hand-written. The cost is that
writing it is a manual step at release time and nothing enforces it;
that is the trade, taken knowingly.

## Why this does not publish

`changeset publish` would run its own `npm publish`. This repository
publishes through npm Trusted Publishing (OIDC) from a tag-triggered
workflow, with no npm token anywhere — see the long comment in
`release.yml` for why, and for the bootstrap step OIDC cannot perform.
Handing publishing to changesets would mean either duplicating that or
losing it. Changesets stops at the version number; the tag does the rest.

There is no `changesets/action` bot for the same reason: its value is the
"Version Packages" PR, which assumes it also owns the changelog and the
publish. `.github/workflows/version.yml` does that job instead, and stops
where changesets stops — at the version number and the tag.

One thing that workflow has to work around, documented here because it
looks like a bug otherwise: it pushes a `v*` tag, and `release.yml`
triggers on `push: tags` — and that does **not** fire. GitHub suppresses
workflow runs from events raised by the default `GITHUB_TOKEN`, with
`workflow_dispatch` and `repository_dispatch` as the only exceptions. So
`version.yml` pushes the tag and then dispatches `release.yml` at it
explicitly. The alternatives were a stored personal access token, which
this repository deliberately does not have, or making `release.yml`
reusable, which changes the OIDC claim npm matches its trusted publisher
against.

## Checking before a release

```bash
pnpm changeset:status
```

Lists what is pending and what version it would produce. It is not wired
into CI as a required check — whether every PR must carry a changeset is
a policy call for the maintainer, not something this setup assumes.
