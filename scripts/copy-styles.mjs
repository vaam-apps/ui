/**
 * Copies `src/styles/` into `dist/styles/`.
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
 */
import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const from = resolve(root, "src/styles");
const to = resolve(root, "dist/styles");

await mkdir(dirname(to), { recursive: true });
await cp(from, to, { recursive: true });
console.log(`copy-styles: src/styles -> dist/styles`);
