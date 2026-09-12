/**
 * Puts the version number on the changelog section that was written
 * without one.
 *
 * `.changeset/config.json` sets `changelog: false`, so `changeset
 * version` bumps the manifest and never touches `CHANGELOG.md` — that
 * file is prose, written by hand as the work happens, under a standing
 * `## Unreleased` heading. Releasing has therefore always had a manual
 * step: rename that heading to the number the bump just produced.
 *
 * That step is the reason to automate it. It is the one part of a
 * release that is pure clerical work — the version is not knowable until
 * `changeset version` has run, so it cannot be written in advance — and
 * it is the part a person is most likely to skip under time pressure,
 * which produces exactly the failure the hand-written changelog exists
 * to prevent: a published version with nothing said about it.
 *
 * So this does the rename, and **refuses** when there is nothing to
 * rename. An empty `## Unreleased` means nobody wrote the entry, and the
 * right outcome is a failed release rather than a silent one.
 *
 * Usage: `node scripts/stamp-changelog.mjs 0.1.3 [path]`
 */

import { readFileSync, writeFileSync } from "node:fs";

/** Exported for `stamp-changelog.test.ts`, which is the only reason this
 * is a function taking a string rather than a script reading a file: the
 * refusal cases are the valuable ones to test, and testing them through
 * the filesystem would mean writing fixture files to disk. */
export function stampChangelog(source, version) {
  if (!/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(version)) {
    throw new Error(`not a version: ${JSON.stringify(version)}`);
  }

  const heading = "## Unreleased";
  const start = source.indexOf(heading);
  if (start === -1) {
    throw new Error(
      "CHANGELOG.md has no `## Unreleased` heading. It is the heading every " +
        "entry is written under between releases; a release cannot stamp a " +
        "version onto a section that does not exist.",
    );
  }

  const bodyStart = start + heading.length;
  // The next top-level heading, which is the previous release. Anything
  // between the two is this release's entry.
  const nextRelative = source.slice(bodyStart).search(/^## /m);
  const bodyEnd = nextRelative === -1 ? source.length : bodyStart + nextRelative;
  const body = source.slice(bodyStart, bodyEnd);

  if (body.trim() === "") {
    throw new Error(
      `\`## Unreleased\` is empty, so ${version} would ship with nothing said ` +
        "about it.\n\n" +
        "This is the one thing `changelog: false` trades away: no generator " +
        "is going to write the entry, so a release with an empty section is " +
        "a release nobody described. Write it under `## Unreleased` first — " +
        "see `.changeset/README.md` for why this file is prose and not " +
        "generated.",
    );
  }

  if (new RegExp(`^## ${version.replace(/\./g, "\\.")}$`, "m").test(source)) {
    throw new Error(
      `CHANGELOG.md already has a \`## ${version}\` section. Either that ` +
        "version was already stamped, or the manifest was bumped to a number " +
        "that has been released before.",
    );
  }

  // A fresh empty `## Unreleased` goes back on top, so the next change to
  // land has its heading waiting for it rather than having to remember to
  // re-add one.
  return `${source.slice(0, start)}## Unreleased\n\n## ${version}${source.slice(bodyStart)}`;
}

// `import.meta.main` is Node 24+; this repo's CI pins 26, and the
// `process.argv[1]` fallback keeps the file importable by the test under
// whatever the contributor happens to have.
const invokedDirectly =
  import.meta.main ?? process.argv[1]?.endsWith("stamp-changelog.mjs") === true;

if (invokedDirectly) {
  const [version, path = "CHANGELOG.md"] = process.argv.slice(2);
  if (version === undefined) {
    console.error("usage: node scripts/stamp-changelog.mjs <version> [path]");
    process.exit(2);
  }
  try {
    writeFileSync(path, stampChangelog(readFileSync(path, "utf8"), version));
    console.log(`stamp-changelog: ## Unreleased -> ## ${version} in ${path}`);
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
