import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error — a plain `.mjs` build script with no declarations. Typing
// it would mean either a `.d.mts` that can drift from the source or moving the
// script into `src/`, where it would be compiled into the published package
// for no reason. The cast below is the whole surface.
import { stampChangelog as untyped } from "../../scripts/stamp-changelog.mjs";

const stampChangelog = untyped as (source: string, version: string) => string;

/**
 * The release action's one irreversible-adjacent step.
 *
 * `.changeset/config.json` sets `changelog: false`, so nothing generates
 * `CHANGELOG.md` and nothing checks it. `version.yml` calls this script
 * to rename `## Unreleased` to the number `changeset version` just
 * produced — which means this function is the *only* thing standing
 * between "released" and "released with nothing said about it".
 *
 * Its refusals are therefore the interesting half, and they are what
 * this file spends its cases on. A rename is easy to get right; refusing
 * to rename an empty section is the behaviour that has to survive
 * someone editing this script in a hurry to unblock a release.
 */

const REAL = readFileSync(fileURLToPath(new URL("../../CHANGELOG.md", import.meta.url)), "utf8");

describe("stamping a version onto the unreleased section", () => {
  it("renames the heading and leaves a fresh Unreleased above it", () => {
    const out = stampChangelog(
      "# Changelog\n\n## Unreleased\n\nDid a thing.\n\n## 0.1.2\n\nOld.\n",
      "0.1.3",
    );
    expect(out).toContain("## Unreleased\n\n## 0.1.3\n\nDid a thing.");
    // The previous release is untouched and still below the new one.
    expect(out.indexOf("## 0.1.3")).toBeLessThan(out.indexOf("## 0.1.2"));
  });

  it("works when the unreleased section is the only one", () => {
    const out = stampChangelog("# Changelog\n\n## Unreleased\n\nFirst ever.\n", "0.1.0");
    expect(out).toContain("## 0.1.0\n\nFirst ever.");
  });

  it("keeps the body byte-for-byte, including its own `##`-free markdown", () => {
    const body = "\n\n### A heading\n\n- a bullet with `## not a heading` inside it\n\n";
    const out = stampChangelog(`## Unreleased${body}## 0.1.2\n`, "0.2.0");
    expect(out).toBe(`## Unreleased\n\n## 0.2.0${body}## 0.1.2\n`);
  });

  it("refuses an empty unreleased section rather than shipping a silent release", () => {
    expect(() =>
      stampChangelog("# Changelog\n\n## Unreleased\n\n## 0.1.2\n\nOld.\n", "0.1.3"),
    ).toThrow(/is empty/);
  });

  it("refuses whitespace that only looks like an entry", () => {
    expect(() => stampChangelog("## Unreleased\n   \n\t\n\n## 0.1.2\n", "0.1.3")).toThrow(
      /is empty/,
    );
  });

  it("refuses when there is no Unreleased heading at all", () => {
    expect(() => stampChangelog("# Changelog\n\n## 0.1.2\n\nOld.\n", "0.1.3")).toThrow(
      /no `## Unreleased` heading/,
    );
  });

  it("refuses to stamp a version the changelog already documents", () => {
    expect(() => stampChangelog("## Unreleased\n\nNew.\n\n## 0.1.2\n\nOld.\n", "0.1.2")).toThrow(
      /already has a `## 0\.1\.2` section/,
    );
  });

  it("refuses something that is not a version", () => {
    for (const bad of ["", "v0.1.3", "main", "0.1", "latest"]) {
      expect(() => stampChangelog("## Unreleased\n\nNew.\n", bad)).toThrow(/not a version/);
    }
  });
});

/**
 * Run against the file this repository actually ships, not only against
 * fixtures — the parsing above is only worth anything if it matches the
 * real document's shape, and that shape is a convention nothing else
 * enforces.
 */
describe("the real CHANGELOG.md", () => {
  it("has the heading the release action depends on", () => {
    expect(REAL).toMatch(/^## Unreleased$/m);
  });

  it("stamps cleanly once an entry exists under it", () => {
    // The shipped file's `## Unreleased` is empty between releases, which
    // is the correct steady state — so this adds an entry first and
    // checks the result, rather than asserting on whichever half of the
    // release cycle the working tree happens to be in.
    const withEntry = REAL.replace("## Unreleased\n", "## Unreleased\n\nSomething landed.\n");
    const out = stampChangelog(withEntry, "9.9.9");
    expect(out).toContain("## Unreleased\n\n## 9.9.9\n\nSomething landed.");
    expect(out).toContain("## 0.1.2");
  });
});
