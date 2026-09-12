import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The published skill must stay true, and nothing else checks it.
 *
 * `skills/vaam-ui/` is installed into other repositories by
 * `npx skills add vaam-apps/ui`, where it becomes the thing an agent
 * reads *instead of* this source tree. It is therefore the one document
 * here whose staleness is invisible from inside this repository: the
 * package can rename an export and every test, story and type check will
 * pass while vpay's copy of the skill goes on recommending the old name.
 *
 * This repository has already shipped six comments that measurement
 * contradicted. A document that is copied into other people's
 * repositories deserves better odds than that, so:
 *
 * - the frontmatter is the shape `skills add` actually requires (checked
 *   against the real CLI, which reported "Found 1 skill" for this
 *   layout — the layout is `skills/<name>/SKILL.md`);
 * - every reference file the skill points at exists;
 * - **every `@vaam-apps/ui` identifier the skill names is really
 *   exported**, which is the check that would have caught a rename.
 */

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SKILLS = join(ROOT, "skills");

function skillDirs(): string[] {
  return readdirSync(SKILLS).filter((entry) => statSync(join(SKILLS, entry)).isDirectory());
}

const DIRS = skillDirs();

describe("the skill package `npx skills add` installs", () => {
  it("has at least one skill to check (guards against an empty scan passing)", () => {
    expect(DIRS.length).toBeGreaterThan(0);
  });

  it.each(DIRS)("%s/SKILL.md has the frontmatter the CLI requires", (dir) => {
    const text = readFileSync(join(SKILLS, dir, "SKILL.md"), "utf8");
    const front = /^---\n([\s\S]*?)\n---\n/.exec(text);
    expect(front, "SKILL.md must open with a YAML frontmatter block").not.toBeNull();

    const body = front?.[1] ?? "";
    const name = /^name:\s*(.+)$/m.exec(body)?.[1]?.trim();
    const description = /^description:\s*(.+)$/m.exec(body)?.[1]?.trim();

    // `skills add` keys the install directory off `name`, so a mismatch
    // installs to a path nobody expects.
    expect(name, "`name` must match the directory it lives in").toBe(dir);
    expect(name).toMatch(/^[a-z0-9][a-z0-9-]*$/);

    // The description is the only thing an agent sees when deciding
    // whether the skill is relevant. A vague one is a skill that never
    // loads.
    expect(description ?? "").not.toBe("");
    expect((description ?? "").length).toBeGreaterThan(40);
  });

  it.each(DIRS)("%s links only to reference files that exist", (dir) => {
    const base = join(SKILLS, dir);
    const text = readFileSync(join(base, "SKILL.md"), "utf8");
    const links = [...text.matchAll(/`(references\/[\w.-]+\.md)`/g)].map((m) => m[1] as string);
    expect(links.length, "SKILL.md should point at its references").toBeGreaterThan(0);
    for (const link of links) {
      expect(() => statSync(join(base, link)), `${link} is linked but missing`).not.toThrow();
    }
  });
});

/**
 * The check that matters: the skill tells another repository's agent
 * which identifiers to import. If one is renamed here, that agent is
 * being told to write code that does not compile — in a repository where
 * nothing in this test suite runs.
 */
describe("every export the skill names is really exported", () => {
  /**
   * `src/index.ts` is almost entirely `export * from "./components/…"`,
   * so an exported name appears nowhere in it as text. Resolving the real
   * surface means reading the modules it re-exports — which is also the
   * only version of this check that survives someone adding a component.
   */
  function publicExports(): Set<string> {
    const names = new Set<string>();
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((entry) => {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) return walk(path);
        return /\.tsx?$/.test(path) && !/\.(test|stories)\.tsx?$/.test(path) ? [path] : [];
      });
    for (const file of walk(join(ROOT, "src"))) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(
        /^export (?:declare )?(?:function|const|class|type|interface) ([A-Za-z_$][\w$]*)/gm,
      )) {
        names.add(m[1] as string);
      }
      // `export { A, B as C } from "…"` and plain `export { A }`.
      for (const m of text.matchAll(/^export \{([^}]*)\}/gm)) {
        for (const part of (m[1] as string).split(",")) {
          const alias = part
            .split(/\bas\b/)
            .pop()
            ?.trim();
          if (alias !== undefined && alias !== "") names.add(alias.replace(/^type\s+/, ""));
        }
      }
    }
    return names;
  }

  const EXPORTS = publicExports();

  /** Backticked identifiers that look like an API symbol. */
  function claimedIdentifiers(): string[] {
    const base = join(SKILLS, "vaam-ui");
    const files = [
      join(base, "SKILL.md"),
      ...readdirSync(join(base, "references")).map((f) => join(base, "references", f)),
    ];
    const found = new Set<string>();
    for (const file of files) {
      for (const m of readFileSync(file, "utf8").matchAll(/`([A-Za-z][A-Za-z0-9]*)(?:\(\))?`/g)) {
        const id = m[1] as string;
        if (
          /^[A-Z][A-Za-z0-9]*$/.test(id) ||
          /^(cn|toast|use[A-Z]\w*|create[A-Z]\w*|define[A-Z]\w*|themeInitScript)$/.test(id)
        ) {
          found.add(id);
        }
      }
    }
    return [...found].sort();
  }

  /**
   * Words the skill backticks that are not this package's exports, each
   * with the reason. An entry here is a decision; a growing list of them
   * without reasons is this check quietly turning itself off.
   */
  const NOT_EXPORTS: Record<string, string> = {
    ListboxButton: "Headless UI's, named to explain why a FormField hint cannot reach a Select.",
    Headless: "Prose — the words 'Headless UI'.",
    UI: "Prose — the words 'Headless UI'.",
    Tailwind: "Prose — the framework's name.",
    Docs: "Prose — the Storybook sidebar section.",
    Storybook: "Prose — the tool's name.",
  };

  const claimed = claimedIdentifiers().filter((id) => !(id in NOT_EXPORTS));

  it("resolved a real export surface (guards against a scanner that finds nothing)", () => {
    expect(EXPORTS.size).toBeGreaterThan(80);
  });

  it("found identifiers to check (guards against a regex that matches nothing)", () => {
    expect(claimed.length).toBeGreaterThan(15);
  });

  it.each(claimed)("%s is exported from the package", (id) => {
    expect(
      EXPORTS.has(id),
      `The skill names \`${id}\`, but nothing in src/ exports it. Another ` +
        "repository's agent is being told to import it. Either restore the " +
        "export, fix the skill, or add it to NOT_EXPORTS with a reason.",
    ).toBe(true);
  });
});
