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

2. **When releasing**, on `main`:

   ```bash
   pnpm bump
   ```

   `changeset version` collapses every pending changeset into one bump of
   `package.json` and deletes the files it consumed. Then write the real
   `CHANGELOG.md` entry by hand (see below) and open a release PR.

3. **Publishing is a tag**, unchanged:

   ```bash
   git tag v0.1.2 && git push origin v0.1.2
   ```

   `.github/workflows/release.yml` takes it from there.

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
publish. The `pnpm bump` step above is that PR, opened by a person.

## Checking before a release

```bash
pnpm changeset:status
```

Lists what is pending and what version it would produce. It is not wired
into CI as a required check — whether every PR must carry a changeset is
a policy call for the maintainer, not something this setup assumes.
