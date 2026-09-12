import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Every exported component is rendered by at least one story.
 *
 * This package's README tells the story this test exists to end. The
 * gallery used to live in a consuming application, as a hand-written
 * `/gallery` route whose own doc claimed it rendered "every export — a
 * gallery that silently drops an export is a QA surface with a blind
 * spot". An audit found **thirteen** it had never mounted, three of them
 * carrying live rendering bugs nobody had seen.
 *
 * Moving the stories next to the components made the drift *visible in
 * the same diff*. It did not make it impossible: adding a component and
 * forgetting its story is still one file, still passes every other
 * check, and still produces exactly the blind spot that cost three bugs.
 * This makes it a build failure instead.
 *
 * It is a coarse check on purpose — "does this identifier appear in any
 * story file" rather than "is it actually mounted". A component can
 * still be imported and rendered badly. What it forecloses is the one
 * failure mode with a track record here: an export that no story mentions
 * at all, which is the one nobody ever looks at.
 */

const SRC = fileURLToPath(new URL("..", import.meta.url));

/**
 * Exported symbols that legitimately have no story of their own, with
 * the reason. Every entry is asserted to still exist below, so a stale
 * exemption fails rather than quietly covering for a deleted export.
 *
 * Keep this list short and keep it justified. An entry reading "hard to
 * demo" is how the blind spot comes back.
 */
const EXEMPT: Record<string, string> = {
  DrawerPortal:
    "Re-export of vaul's own Portal. `DrawerContent` already renders it internally, so a " +
    "story that also wrapped one would mount two portals and paint two overlays. Exported " +
    "for a caller composing a bespoke content element.",
  DrawerOverlay:
    "Same as DrawerPortal — `DrawerContent` renders one already; a second would double the " +
    "scrim.",
  REGISTERED_FONT_SIZES:
    "Not a component. Exported from `cn.ts` purely so `theme-tokens.test.ts` can check the " +
    "registered scale against the stylesheet.",
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(path) ? [path] : [];
  });
}

const ALL = walk(SRC);
const STORY_FILES = ALL.filter((f) => f.endsWith(".stories.tsx"));
const SOURCE_FILES = ALL.filter((f) => !/\.(test|stories)\.tsx?$/.test(f));

const STORY_TEXT = STORY_FILES.map((f) => readFileSync(f, "utf8")).join("\n");

/**
 * `export function Foo` / `export const Foo` at the top level, capitalised
 * — which is every component and every bound-component factory in this
 * package, and excludes hooks, types and lower-case helpers like `cn` and
 * `toast` that have no independent visual surface.
 */
function exportedComponents(file: string): string[] {
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(/^export (?:function|const) ([A-Z][A-Za-z0-9_]*)/gm)].map(
    (m) => m[1] as string,
  );
}

const EXPORTS = new Map<string, string>();
for (const file of SOURCE_FILES) {
  for (const name of exportedComponents(file)) {
    EXPORTS.set(name, file.slice(SRC.length));
  }
}

describe("every exported component appears in a story", () => {
  it("finds exports to check at all (guards against a regex that matches nothing)", () => {
    expect(EXPORTS.size).toBeGreaterThan(50);
  });

  it("finds story files to check against", () => {
    expect(STORY_FILES.length).toBeGreaterThan(10);
  });

  const checked = [...EXPORTS.keys()].filter((name) => !(name in EXEMPT)).sort();

  it.each(checked)("%s is rendered by a story", (name) => {
    const mentioned = new RegExp(`\\b${name}\\b`).test(STORY_TEXT);
    expect(
      mentioned,
      `${name} (${EXPORTS.get(name)}) is exported but no story mentions it. Add one, or — if ` +
        "it genuinely has no visual surface — add it to EXEMPT in this file with the reason.",
    ).toBe(true);
  });
});

describe("the exemption list does not rot", () => {
  it.each(Object.keys(EXEMPT))("%s is still exported", (name) => {
    expect(
      EXPORTS.has(name),
      `${name} is exempted from story coverage but is no longer exported. Remove the entry.`,
    ).toBe(true);
  });
});
