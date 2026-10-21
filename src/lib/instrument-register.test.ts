import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The instrument register is one hue family, and the stylesheet says so in
 * a form a test can read.
 *
 * `InstrumentPanel`'s shapes, `Card glow`'s halo and `Skeleton
 * instrument`'s drift are all mixed from the seed's `primary-container`
 * and `primary`. Until the glow and the skeleton followed the panel, the
 * register had two colour schemes — the panel's primary shapes and the
 * multi-hue `--aurora-*` ramp, which is bound to the status hues — and
 * nothing would have noticed a third. This pins the paint structurally:
 * which variables each token mixes, not the hex it resolves to, because a
 * regenerated palette moves every hex and none of the sources.
 *
 * The rendered half — that the painted shadow and gradient colours are
 * the role and not a status hue — is `e2e/instrument-register.spec.ts`.
 */

const THEME_CSS = readFileSync(
  fileURLToPath(new URL("../styles/theme.css", import.meta.url)),
  "utf8",
);

/** Every `var(--…)` a declaration of `name` reads, across all themes. */
function declarationSources(name: string): string[][] {
  return [...THEME_CSS.matchAll(new RegExp(`${name}:\\s*([^;]+);`, "g"))].map((m) =>
    [...(m[1] as string).matchAll(/var\((--[\w-]+)\)/g)].map((v) => v[1] as string),
  );
}

const PRIMARY_FAMILY = /^--md-sys-color-primary(-container)?$/;

describe("Card glow's halo is the primary family", () => {
  for (const token of ["--instrument-glow", "--instrument-glow-reduced"]) {
    it(`every ${token} declaration mixes only primary and primary-container`, () => {
      const declarations = declarationSources(token);
      // One per theme. Fewer means a theme lost its token and would fall
      // back to whatever the other declared.
      expect(declarations.length).toBe(2);
      for (const sources of declarations) {
        expect(sources.length).toBeGreaterThan(0);
        for (const source of sources) expect(source).toMatch(PRIMARY_FAMILY);
      }
    });
  }

  it(".instrument-glow paints the token, and its reduced-motion form the softer one", () => {
    expect(THEME_CSS).toMatch(/\.instrument-glow\s*{\s*box-shadow:\s*var\(--instrument-glow\);/);
    expect(THEME_CSS).toMatch(
      /prefers-reduced-motion: reduce\)\s*{\s*\.instrument-glow\s*{\s*box-shadow:\s*var\(--instrument-glow-reduced\);/,
    );
  });
});

/** Every `.tsx` under `src/components` that ships, stories and tests aside. */
function componentSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return componentSources(path);
    if (!entry.name.endsWith(".tsx") || /\.(stories|test)\./.test(entry.name)) return [];
    return [path];
  });
}

describe("nothing in the package renders the deprecated aurora", () => {
  const files = componentSources(fileURLToPath(new URL("../components", import.meta.url)));

  it("finds the components it scans", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("no component class string names an aurora class or token", () => {
    // Prose may name the aurora (the docs say what it was); a class string
    // or a `var()` may not. Matched as the class or token spelling only.
    const offenders = files.filter((file) =>
      /["'`\s](aurora-glow|aurora-mesh)["'`\s]|var\(--(skeleton-)?aurora-/.test(
        readFileSync(file, "utf8"),
      ),
    );
    expect(offenders).toEqual([]);
  });
});
