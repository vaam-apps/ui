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

/**
 * The package's real export surface.
 *
 * `src/index.ts` is almost entirely `export * from "./components/…"`, so
 * an exported name appears nowhere in the barrel as text — the first
 * version of this check grepped `index.ts` and flagged all sixty
 * identifiers the skill names. Resolving it properly means reading the
 * modules the barrel re-exports, which is also the only version that
 * survives someone adding a component.
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

/**
 * The surface a consumer can actually import, resolved by following
 * `src/index.ts`'s re-export graph.
 *
 * The first version of this walked all of `src/` and collected every
 * `export function`. That over-reports, and the over-reporting is not
 * harmless: `format-instant.ts` and `mask-secret.ts` are deliberately
 * **not** re-exported — both module docs say testability must not widen
 * the public API — so the gate was demanding documentation for three
 * helpers a consumer cannot import, and the honest fix in the skill would
 * have been to show an import that does not compile.
 *
 * So: read the barrel, follow `export * from "./x"` into that module's
 * own exports, and take named re-exports as written. Anything the barrel
 * does not reach is not public, however exported it looks in its own file.
 */
function moduleExports(file: string): Set<string> {
  const names = new Set<string>();
  for (const m of readFileSync(file, "utf8").matchAll(
    /^export (?:declare )?(?:function|const|class) ([A-Za-z_$][\w$]*)/gm,
  )) {
    names.add(m[1] as string);
  }
  return names;
}

function resolve(spec: string): string {
  for (const candidate of [`${spec}.ts`, `${spec}.tsx`, `${spec}/index.ts`]) {
    const path = join(ROOT, "src", candidate.replace(/^\.\//, ""));
    try {
      if (statSync(path).isFile()) return path;
    } catch {
      // try the next extension
    }
  }
  throw new Error(`src/index.ts re-exports "${spec}", which resolves to no file`);
}

function publicValues(): Set<string> {
  const barrel = readFileSync(join(ROOT, "src", "index.ts"), "utf8");
  const names = new Set<string>();

  for (const m of barrel.matchAll(/^export \* from "(\.[^"]+)";/gm)) {
    for (const name of moduleExports(resolve(m[1] as string))) names.add(name);
  }
  for (const m of barrel.matchAll(/^export \{([^}]*)\} from "(\.[^"]+)";/gm)) {
    const fromModule = moduleExports(resolve(m[2] as string));
    for (const part of (m[1] as string).split(",")) {
      const [original, alias] = part.split(/\bas\b/).map((s) => s.trim());
      const source = (original ?? "").replace(/^type\s+/, "");
      const exposed = (alias ?? source).replace(/^type\s+/, "");
      // Types are re-exported here too; only keep the runtime values.
      if (source !== "" && fromModule.has(source)) names.add(exposed);
    }
  }
  return names;
}

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

  /**
   * Identifiers that belong to React, the DOM or a dependency.
   *
   * The scan above cannot tell `ReactNode` from `StatusPill` by shape —
   * both are backticked PascalCase — so without this it reports React's
   * own API as "not exported from the package", which is a false positive
   * that would train a reader to ignore this test. Kept as a pattern
   * rather than a list because the alternative is an entry in
   * `NOT_EXPORTS` every time a page mentions a hook.
   *
   * The precise version of this check is the import assertion below,
   * which does not need a deny-list at all.
   */
  const FOREIGN =
    /^(React|ReactNode|ReactElement|ComponentProps\w*|CSSProperties|Fragment|Suspense|Portal|createPortal|useState|useEffect|useMemo|useRef|useCallback|useId|useSyncExternalStore|Date|Intl|Promise|Record|Partial|Omit|Pick|Array|Object|String|Number|Boolean|Map|Set|JSON|Math|Error|HTML\w*|SVG\w*|Element|Node|Event|MutationObserver|ResizeObserver|IntersectionObserver|MediaQueryList|Headless\w*|Listbox\w*|Menu\w*|Radio|Field|Description|Label|Checkbox|Switch|Disclosure\w*|Transition|Dialog\w*|Vaul|Tailwind\w*|Storybook|Playwright|Vitest|TypeScript|JavaScript|GitHub|WCAG|ARIA|DOM|CSS|HTML|JSON|URL|API|UI|UX|OS|SSR|CLI)$/;

  const claimed = claimedIdentifiers().filter((id) => !(id in NOT_EXPORTS) && !FOREIGN.test(id));

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

  /**
   * The version of this check with no judgement in it.
   *
   * Everything above has to guess whether a backticked word is one of
   * ours. This does not: an identifier inside
   * `import { … } from "@vaam-apps/ui"` in one of the skill's examples is
   * unambiguously a claim that the package exports it, and the example is
   * the part a reader copies. If the two checks ever disagree, this one
   * is right.
   */
  it("every example imports only things the package exports", () => {
    const base = join(SKILLS, "vaam-ui");
    const files = [
      join(base, "SKILL.md"),
      ...readdirSync(join(base, "references")).map((f) => join(base, "references", f)),
    ];
    const bad: string[] = [];
    let statements = 0;
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(
        /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']@vaam-apps\/ui["']/g,
      )) {
        statements += 1;
        for (const part of (m[1] as string).split(",")) {
          const name = part
            .split(/\bas\b/)[0]
            ?.replace(/^\s*type\s+/, "")
            .trim();
          if (name !== undefined && name !== "" && !EXPORTS.has(name)) {
            bad.push(`${name} (in ${file.split("/").pop()})`);
          }
        }
      }
    }
    expect(statements, "the skill's examples should import from the package").toBeGreaterThan(3);
    expect(
      bad,
      `these examples import things the package does not export: ${bad.join(", ")}`,
    ).toEqual([]);
  });
});

/**
 * Every public export is documented in the skill.
 *
 * This is the same shape as `story-coverage.test.ts`, for the same reason
 * and against a worse failure. That gate exists because a gallery in
 * another repository claimed to render every export and had silently
 * missed thirteen, three of them carrying live bugs. This one guards a
 * document that is *installed into* other repositories, where an export
 * nobody wrote up is not a blind spot in a QA surface — it is a component
 * the consuming team does not know exists.
 *
 * It also makes "upgrade the skill when the package changes" mechanical
 * rather than a habit. Add an export, and this fails until the skill says
 * something about it.
 *
 * Coarse on purpose — "is this name mentioned anywhere in the skill"
 * rather than "is it well documented". A name can be mentioned and
 * explained badly; what this forecloses is the failure with a track
 * record here, which is the export nobody mentioned at all.
 */
describe("the skill documents every public export", () => {
  /**
   * Exports that legitimately need no entry, each with the reason. Every
   * one is asserted to still exist below, so a stale exemption fails
   * rather than quietly covering for a deleted export.
   *
   * Keep it short and keep it justified. An entry reading "internal" with
   * no explanation is how the gap comes back.
   */
  const EXEMPT: Record<string, string> = {
    omitUndefined:
      "An internal helper for stripping `undefined` before a spread, exported only " +
      "because components in different folders share it. A consumer has no use for it.",
    groupLabelId:
      "Derives the id `ChipSelect`/`RadioGroup` wire their group label with. Called by " +
      "those components; documenting it invites a caller to hand-roll the wiring.",
    badgeVariants:
      "The `cva` variant table behind `Badge`, exported for consumers extending the " +
      "component. `Badge` itself is documented; the table is an implementation seam.",
    buttonVariants: "As `badgeVariants`, for `Button`.",
    DrawerPortal:
      "A re-export of vaul's own Portal. `DrawerContent` renders one internally, so a " +
      "consumer using it directly would mount two.",
    DrawerOverlay: "As `DrawerPortal` — `DrawerContent` renders one already.",
  };

  const documented = (() => {
    const base = join(SKILLS, "vaam-ui");
    const files = [
      join(base, "SKILL.md"),
      ...readdirSync(join(base, "references")).map((f) => join(base, "references", f)),
    ];
    return files.map((f) => readFileSync(f, "utf8")).join("\n");
  })();

  const PUBLIC = [...publicValues()].filter((n) => !(n in EXEMPT)).sort();

  it("has a public surface to check (guards against an empty scan)", () => {
    expect(PUBLIC.length).toBeGreaterThan(100);
  });

  it.each(PUBLIC)("%s is mentioned in the skill", (name) => {
    expect(
      new RegExp(`\\b${name}\\b`).test(documented),
      `\`${name}\` is exported but the skill never mentions it. An agent installing ` +
        "this skill into vpay or vsms will not know it exists. Document it, or add it " +
        "to EXEMPT in this file with the reason.",
    ).toBe(true);
  });

  it.each(Object.keys(EXEMPT))("%s is exempt and still exported", (name) => {
    expect(
      publicValues().has(name),
      `${name} is exempted from skill coverage but is no longer exported. Remove the entry.`,
    ).toBe(true);
  });
});
