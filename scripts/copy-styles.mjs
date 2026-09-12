/**
 * Copies the stylesheets from `src/styles/` into `dist/styles/`.
 *
 * The theme stylesheet is the one non-TypeScript file a consumer
 * imports, and `tsc` does not copy assets — so without this it would
 * only ever exist under `src/`, and the published package would have to
 * ship the whole source tree to deliver one CSS file. It shipped exactly
 * that way in 0.1.0: `dist/` plus a second, complete copy of every
 * component as `.tsx`.
 *
 * With the stylesheet in `dist/`, everything published lives in one
 * directory — which is also the directory the README already tells
 * Tailwind to scan.
 *
 * **`.css` only, not the whole directory.** This used to be a recursive
 * `cp` of `src/styles`, which quietly re-opened the hole 0.1.1 closed:
 * `tsconfig.build.json` excludes every `.stories.tsx` from the compile, but
 * a blanket copy does not care what `tsc` was told, so adding
 * `src/styles/tokens.stories.tsx` put an uncompiled `.tsx` source file
 * straight into `dist/` and into the tarball. Caught by listing `dist/`
 * after a build, not by any check — `ci.yml` now asserts the absence too.
 */
import { copyFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const from = resolve(root, "src/styles");
const to = resolve(root, "dist/styles");

/** Every `.css` under `dir`, recursively, as absolute paths. */
async function stylesheets(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const found = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return stylesheets(path);
      return entry.name.endsWith(".css") ? [path] : [];
    }),
  );
  return found.flat();
}

const files = await stylesheets(from);
for (const file of files) {
  const target = join(to, relative(from, file));
  await mkdir(dirname(target), { recursive: true });
  await copyFile(file, target);
}
console.log(`copy-styles: ${files.length} stylesheet(s), src/styles -> dist/styles`);
