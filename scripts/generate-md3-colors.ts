/**
 * Generates this library's colour tokens from one seed, as Material 3
 * Expressive dynamic colour, and writes them into `src/styles/theme.css`.
 *
 * ```sh
 * pnpm generate:colors          # rewrite the generated regions in theme.css
 * pnpm generate:colors --check  # exit 1 if theme.css has drifted from this file
 * ```
 *
 * # Why a generator, and why the output is committed
 *
 * `@material/material-color-utilities` is a devDependency and stays one: a
 * consumer imports static CSS and never runs Material's colour science at
 * build or run time. So the scheme is computed here, written into
 * `theme.css` between `<md3:generated>` markers, and committed. Two things
 * keep the committed CSS honest, and neither is "remember to run it":
 *
 * - `src/lib/hct-neutrals.test.ts` imports this module, renders the regions
 *   again and fails when `theme.css` differs by a byte — the stylesheet and
 *   the generator cannot disagree.
 * - every gate that reads colour (`contrast.test.ts`, the ΔE floors in
 *   `hct-neutrals.test.ts`) reads the *committed* CSS, so a seed change that
 *   breaks a gate fails there, not in a consumer's screenshot.
 *
 * The material package's 0.4.0 ESM build is broken without the pnpm patch
 * `pnpm-workspace.yaml` documents; that patch is what lets plain `node`
 * import it here.
 *
 * # The scheme
 *
 * `Variant.EXPRESSIVE`, colour spec `2025`, contrast level `0` — the M3
 * Expressive scheme exactly as `vaam-apps/vitepress-md3`'s `color.ts` builds
 * it, so a console and its documentation site agree on what "Expressive
 * from this seed" means. Every role `MaterialDynamicColors.allColors` lists
 * is emitted as `--md-sys-color-<role>`, plus the four the spec references
 * but that list omits (`shadow`, `scrim`, `surface-tint`, `surface-variant`).
 *
 * The seed is not the house teal, and that is measured rather than
 * preferred — see `SEED` below.
 */
import { writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  argbFromHex,
  Blend,
  DynamicScheme,
  Hct,
  hexFromArgb,
  MaterialDynamicColors,
  TonalPalette,
  Variant,
} from "@material/material-color-utilities";

/**
 * The library's one seed: an indigo. Every colour role derives from it.
 *
 * **Why not `#0f766e`, the vaam-apps house teal.** This is an operator
 * console whose status system owns colour (`success` is green, `progress`
 * is cyan), and Expressive's primary sits in the same tone band as the
 * status foregrounds — light theme primary is T40, the status foregrounds
 * T38 — so hue and chroma are all that tell a primary-coloured control from
 * a state. Measured with this file's CIEDE2000 against the harmonized
 * status palette the teal seed itself produces, light theme: primary
 * `#006b63` sits **5.5** from `progress` and **9.4** from `success` (dark
 * `primary-container` 11.7 from `progress`). The status hues' own floor
 * (`STATUS_SEPARATION_FLOOR`, 13) is the distance at which this library
 * already accepts two colours as two different states, so a teal primary
 * would be *closer to a state than two states are to each other* — a
 * control that reads as "in progress". Teal also pulls `progress` toward
 * itself and toward the teal-tinted `neutral` (8.6 apart, light). Rejected.
 *
 * Indigo sits in the widest gap the status wheel leaves (HCT hue 287,
 * between `progress`'s cyan and `parked`'s fuchsia). With the palette below
 * its nearest status in either theme is `neutral` — 13.2 in dark, 14.7 in
 * light (`primary`; `primary-container` 13.8 in dark) — and both clear the
 * floor. M3's own baseline purple, `#6750a4`, was the other candidate and
 * lands 11.3 from `parked` in dark: under it. `hct-neutrals.test.ts` pins
 * both halves: this seed clears the floor, the teal does not. A scan across
 * the whole hue wheel (every 10°, HCT chroma 48, before `parked` moved)
 * found no seed hue more than 14.6 from every status, and none at all in
 * the indigo-to-violet range against the old violet `parked` — which is
 * why `parked` moved (below).
 */
export const SEED = "#4f46e5";

/** The M3 Expressive scheme options. Contrast `0` is the spec's default. */
const SPEC_VERSION = "2025";
const CONTRAST_LEVEL = 0;

/**
 * The status system's minimum CIEDE2000 separation — between any two status
 * foregrounds, and between `primary`/`primary-container` and any status
 * foreground, in each theme.
 *
 * 13 is the tightest pair the palette this one replaced held in its light
 * theme (`warning`/`uncertain`, 13.18) — the separation this library had
 * already accepted as "two different states". Its dark theme held only 8.74
 * (`neutral`/`expired`), which this palette no longer goes near (see
 * `expired` below), so one floor serves both themes now.
 */
export const STATUS_SEPARATION_FLOOR = 13;

/**
 * Neutral chrome (surfaces, the edge ladder) must sit at least this far from
 * every status foreground. Unchanged from the gate that predates this
 * generator: far more than any two statuses sit from each other, so a
 * surface or a border can never read as a signal.
 */
export const CHROME_SEPARATION_FLOOR = 30;

/** WCAG AA for normal text; every text token here is used at 11–14px. */
export const AA_NORMAL = 4.5;

export type StatusHue =
  | "neutral"
  | "progress"
  | "success"
  | "warning"
  | "danger"
  | "uncertain"
  | "expired"
  | "parked";

interface StatusSource {
  /** Source colour, harmonized toward the seed unless `harmonize` is false. */
  source?: string;
  /** Take the scheme's own neutral palette instead of a source colour. */
  palette?: "neutral";
  harmonize?: boolean;
  /** Override the base (foreground) tone, per theme. */
  tone?: { dark: number; light: number };
}

/**
 * The status hues, as M3 *custom colours*: each source is harmonized toward
 * the seed (`Blend.harmonize` — at most 15° of hue rotation) and turned into
 * a tonal palette, from which the four custom-colour roles are read.
 *
 * Sources are the Tailwind 400-level hues the hand-picked palette used, so
 * each state keeps its identity — green still means delivered — while its
 * exact value now comes from the seed's family. Exceptions, each measured:
 *
 * - `neutral` is the scheme's own **neutral palette**, not a source colour:
 *   the state that says "nothing to see" should be the same grey the
 *   surfaces are made of. (Not `on-surface-variant`: that role comes from the
 *   neutral-*variant* palette, chroma ~20 at this seed, and measured 9.8
 *   from light `primary` — under the floor. The neutral palette's lower
 *   chroma puts it at 14.7.)
 * - `parked` moved from violet (`#a78bfa`) to fuchsia (`#e879f9`) and is
 *   **not harmonized**. Violet is the seed's own hue: the old
 *   source, harmonized, measured 1.9 from dark `primary-container` — the
 *   same colour. Fuchsia,
 *   harmonized, is pulled 15° back toward the seed and lands 9.3 from dark
 *   `primary` — still under the floor — so it keeps its own hue: 15.4.
 * - `expired` and `neutral` are both near-achromatic, the pair this palette
 *   has always had to work hardest to separate (8.74 in the old dark
 *   theme). Hue cannot separate two greys, so tone does: `expired` sits at
 *   T86 in dark (bleached) and T30 in light (faded to ink), against
 *   `neutral`'s T70/T40. Measured: 16.1 dark, 16.2 light — no longer the
 *   tightest pair in either theme (that is `warning`/`uncertain`, 15.3 and
 *   14.2).
 */
export const STATUS_SOURCES: Record<StatusHue, StatusSource> = {
  neutral: { palette: "neutral", tone: { dark: 70, light: 40 } },
  progress: { source: "#22d3ee" },
  success: { source: "#22c55e" },
  warning: { source: "#fb923c" },
  danger: { source: "#f87171" },
  uncertain: { source: "#fbbf24" },
  expired: { source: "#a8a29e", tone: { dark: 86, light: 30 } },
  parked: { source: "#e879f9", harmonize: false },
};

/**
 * Material's custom-colour recipe — the tone pairs `primary` uses — except
 * the light base tone, which is 38 rather than 40. Measured, not preferred:
 * at T40 a loud `progress` pill's label (the foreground over its own 8%
 * tint, on `surface-container-highest`) came out at 4.46:1, under AA. T38
 * is the highest tone where every loud and flat case clears it (worst:
 * 4.80:1, loud `danger` on `surface-container-highest`).
 */
const TONES = {
  dark: { base: 80, on: 20, container: 30, onContainer: 90 },
  light: { base: 38, on: 100, container: 90, onContainer: 10 },
} as const;

/** Translucent fill and border alphas for a *loud* status surface. */
const TINT = {
  dark: { bg: 0.12, border: 0.3 },
  light: { bg: 0.08, border: 0.24 },
} as const;

/** `neutral` and `success` are quiet: no fill, no border. `isQuietHue` agrees. */
const QUIET: readonly StatusHue[] = ["neutral", "success"];

export type ThemeName = "dark" | "light";

// ---------------------------------------------------------------------------
// Colour math. Exported for the gates, which validate it (CIEDE2000 against
// Sharma, Wu & Dalal's published test data) rather than trusting it.
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  return [0, 2, 4].map((i) => Number.parseInt(v.slice(i, i + 2), 16)) as [number, number, number];
}

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x contrast ratio between two opaque hex colours. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = hexToRgb(hex).map(srgbToLinear) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const D65 = { x: 95.0489, y: 100.0, z: 108.884 };

function labF(t: number): number {
  const d = 6 / 29;
  return t > d ** 3 ? Math.cbrt(t) : t / (3 * d * d) + 4 / 29;
}

export function hexToLab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear) as [number, number, number];
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) * 100;
  const y = (r * 0.2126729 + g * 0.7151522 + b * 0.072175) * 100;
  const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) * 100;
  const fx = labF(x / D65.x);
  const fy = labF(y / D65.y);
  const fz = labF(z / D65.z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIEDE2000 between two CIELAB colours, kL = kC = kH = 1 (Sharma et al. 2005). */
export function deltaE2000Lab(
  [L1, a1, b1]: readonly [number, number, number],
  [L2, a2, b2]: readonly [number, number, number],
): number {
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const cBar7 = ((C1 + C2) / 2) ** 7;
  const g = 0.5 * (1 - Math.sqrt(cBar7 / (cBar7 + 25 ** 7)));
  const a1p = a1 * (1 + g);
  const a2p = a2 * (1 + g);
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const angle = (y: number, x: number) => {
    if (x === 0 && y === 0) return 0;
    const deg = Math.atan2(y, x) / rad;
    return deg < 0 ? deg + 360 : deg;
  };
  const h1p = angle(b1, a1p);
  const h2p = angle(b2, a2p);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    const diff = h2p - h1p;
    dhp = Math.abs(diff) <= 180 ? diff : diff > 180 ? diff - 360 : diff + 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * rad) / 2);

  const lBarp = (L1 + L2) / 2;
  const cBarp = (C1p + C2p) / 2;
  let hBarp: number;
  if (C1p * C2p === 0) hBarp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hBarp = (h1p + h2p) / 2;
  else hBarp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;

  const t =
    1 -
    0.17 * Math.cos((hBarp - 30) * rad) +
    0.24 * Math.cos(2 * hBarp * rad) +
    0.32 * Math.cos((3 * hBarp + 6) * rad) -
    0.2 * Math.cos((4 * hBarp - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hBarp - 275) / 25) ** 2));
  const rc = 2 * Math.sqrt(cBarp ** 7 / (cBarp ** 7 + 25 ** 7));
  const sl = 1 + (0.015 * (lBarp - 50) ** 2) / Math.sqrt(20 + (lBarp - 50) ** 2);
  const sc = 1 + 0.045 * cBarp;
  const sh = 1 + 0.015 * cBarp * t;
  const rt = -Math.sin(2 * dTheta * rad) * rc;

  return Math.sqrt(
    (dLp / sl) ** 2 + (dCp / sc) ** 2 + (dHp / sh) ** 2 + rt * (dCp / sc) * (dHp / sh),
  );
}

/** CIEDE2000 between two hex colours. */
export function deltaE2000(a: string, b: string): number {
  return deltaE2000Lab(hexToLab(a), hexToLab(b));
}

// ---------------------------------------------------------------------------
// The scheme.
// ---------------------------------------------------------------------------

const kebab = (name: string) => name.replaceAll("_", "-");

function scheme(seed: string, theme: ThemeName): DynamicScheme {
  return new DynamicScheme({
    sourceColorHct: Hct.fromInt(argbFromHex(seed)),
    variant: Variant.EXPRESSIVE,
    contrastLevel: CONTRAST_LEVEL,
    isDark: theme === "dark",
    specVersion: SPEC_VERSION,
  });
}

/** Every M3 colour role for one theme, keyed by its kebab-case role name. */
export function schemeRoles(seed: string, theme: ThemeName): Record<string, string> {
  const s = scheme(seed, theme);
  const roles: Record<string, string> = {};
  for (const color of new MaterialDynamicColors().allColors) {
    roles[kebab(color.name)] = hexFromArgb(color.getArgb(s));
  }
  // Referenced by every M3 component spec, absent from `allColors`.
  roles.shadow = "#000000";
  roles.scrim = "#000000";
  roles["surface-tint"] = roles.primary as string;
  roles["surface-variant"] = roles["surface-container-highest"] as string;
  return roles;
}

export interface StatusRoles {
  /** The base role: glyph and label colour. `--state-<hue>-fg`. */
  base: string;
  on: string;
  container: string;
  onContainer: string;
}

function statusPalette(seed: string, theme: ThemeName, spec: StatusSource): TonalPalette {
  if (spec.palette === "neutral") return scheme(seed, theme).neutralPalette;
  const source = argbFromHex(spec.source as string);
  const argb = spec.harmonize === false ? source : Blend.harmonize(source, argbFromHex(seed));
  return TonalPalette.fromInt(argb);
}

/** The four custom-colour roles of every status hue, for one theme. */
export function statusRoles(seed: string, theme: ThemeName): Record<StatusHue, StatusRoles> {
  const out = {} as Record<StatusHue, StatusRoles>;
  const tones = TONES[theme];
  for (const [hue, spec] of Object.entries(STATUS_SOURCES) as [StatusHue, StatusSource][]) {
    const palette = statusPalette(seed, theme, spec);
    out[hue] = {
      base: hexFromArgb(palette.tone(spec.tone?.[theme] ?? tones.base)),
      on: hexFromArgb(palette.tone(tones.on)),
      container: hexFromArgb(palette.tone(tones.container)),
      onContainer: hexFromArgb(palette.tone(tones.onContainer)),
    };
  }
  return out;
}

/**
 * The surfaces every foreground must clear, in ladder order: the library's
 * `base-100/200/300`, `surface-3` and `surface-4`.
 */
export const SURFACE_ROLES = [
  "surface",
  "surface-container-low",
  "surface-container",
  "surface-container-high",
  "surface-container-highest",
] as const;

/**
 * A role's own hue and chroma at another tone: the role, made dimmer or
 * stronger without changing what colour it is. (Reading the raw
 * neutral-variant palette instead gave a visibly more violet grey than the
 * roles beside it — the 2025 spec draws `on-surface-variant` and
 * `outline` at a lower chroma than the palette's key colour.)
 */
function atTone(hex: string, tone: number): string {
  const hct = Hct.fromInt(argbFromHex(hex));
  return hexFromArgb(Hct.from(hct.hue, hct.chroma, tone).toInt());
}

/**
 * `--subtle-foreground`: the library's third text tier, which M3 has no role
 * for (it stops at `on-surface` and `on-surface-variant`). It is
 * `on-surface-variant` at the dimmest tone that still clears AA on every
 * surface — the same "minimum that clears the worst case" rule the
 * hand-picked `#838a95` was chosen by.
 */
export function subtleForeground(seed: string, theme: ThemeName): string {
  const roles = schemeRoles(seed, theme);
  const surfaces = SURFACE_ROLES.map((r) => roles[r] as string);
  const base = roles["on-surface-variant"] as string;
  const clears = (hex: string) => surfaces.every((bg) => contrastRatio(hex, bg) >= AA_NORMAL);
  // Dark walks up from black, light down from white: the first tone that
  // clears is the dimmest one.
  const tones = Array.from({ length: 101 }, (_, i) => (theme === "dark" ? i : 100 - i));
  for (const tone of tones) {
    const hex = atTone(base, tone);
    if (clears(hex)) return hex;
  }
  throw new Error(`no tone of on-surface-variant clears AA on every ${theme} surface`);
}

/**
 * `--edge-strong`: the ladder's top step, for the borders of selection
 * controls and pending pills. M3's own role for a control outline is
 * `outline` — and it is the one role this library cannot ship as chrome:
 * measured, dark `outline` sits 18.8 from `neutral` and light 12.5, under
 * `CHROME_SEPARATION_FLOOR`; a grey line that close to the grey status
 * glyph would be chrome you could read as a signal. So the step is
 * `outline` itself, moved away from the status foregrounds (darker in dark,
 * lighter in light) to the first tone that clears the floor against every
 * one of them.
 */
export function edgeStrong(seed: string, theme: ThemeName): string {
  const statuses = Object.values(statusRoles(seed, theme)).map((r) => r.base);
  const outline = schemeRoles(seed, theme).outline as string;
  const clears = (hex: string) =>
    statuses.every((fg) => deltaE2000(hex, fg) >= CHROME_SEPARATION_FLOOR);
  const start = Math.round(Hct.fromInt(argbFromHex(outline)).tone);
  const step = theme === "dark" ? -1 : 1;
  for (let tone = start; tone >= 0 && tone <= 100; tone += step) {
    const hex = atTone(outline, tone);
    if (clears(hex)) return hex;
  }
  throw new Error(`no ${theme} tone of outline clears the chrome floor`);
}

function rgbAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${r} ${g} ${b} / ${alpha})`;
}

/**
 * Every declaration the generator owns for one theme, in emission order.
 * Hand-written mappings (`--surface-3: var(--md-sys-color-…)` and friends)
 * live in `theme.css` itself, beside the comments that justify them.
 */
export function generatedDeclarations(
  theme: ThemeName,
  seed: string = SEED,
): [name: string, value: string][] {
  const decls: [string, string][] = [];
  const roles = schemeRoles(seed, theme);
  for (const [role, hex] of Object.entries(roles)) decls.push([`--md-sys-color-${role}`, hex]);

  const status = statusRoles(seed, theme);
  for (const [hue, r] of Object.entries(status) as [StatusHue, StatusRoles][]) {
    decls.push(
      [`--md-custom-color-${hue}`, r.base],
      [`--md-custom-color-on-${hue}`, r.on],
      [`--md-custom-color-${hue}-container`, r.container],
      [`--md-custom-color-on-${hue}-container`, r.onContainer],
    );
  }
  for (const [hue, r] of Object.entries(status) as [StatusHue, StatusRoles][]) {
    const quiet = QUIET.includes(hue);
    decls.push(
      [`--state-${hue}-fg`, r.base],
      [`--state-${hue}-bg`, quiet ? "transparent" : rgbAlpha(r.base, TINT[theme].bg)],
      [`--state-${hue}-border`, quiet ? "transparent" : rgbAlpha(r.base, TINT[theme].border)],
    );
  }

  decls.push(
    ["--subtle-foreground", subtleForeground(seed, theme)],
    ["--edge-strong", edgeStrong(seed, theme)],
    ["--ring-subtle", rgbAlpha(roles.primary as string, theme === "dark" ? 0.24 : 0.18)],
  );
  return decls;
}

const begin = (theme: ThemeName) =>
  `/* <md3:generated theme="${theme}"> — scripts/generate-md3-colors.ts writes everything up to the closing marker. Do not edit by hand: run \`pnpm generate:colors\`. */`;
const end = (theme: ThemeName) => `/* </md3:generated theme="${theme}"> */`;

/** The generated region for one theme, markers included, at two-space indent. */
export function renderRegion(theme: ThemeName, seed: string = SEED): string {
  const lines = generatedDeclarations(theme, seed).map(([n, v]) => `  ${n}: ${v};`);
  return [`  ${begin(theme)}`, ...lines, `  ${end(theme)}`].join("\n");
}

/** Replace both themes' regions in a stylesheet's text. Throws if a marker is missing. */
export function applyRegions(css: string, seed: string = SEED): string {
  let out = css;
  for (const theme of ["dark", "light"] as const) {
    const open = out.indexOf(begin(theme));
    const closeAt = out.indexOf(end(theme));
    if (open === -1 || closeAt === -1 || closeAt < open) {
      throw new Error(`theme.css has no complete <md3:generated theme="${theme}"> region`);
    }
    const lineStart = out.lastIndexOf("\n", open) + 1;
    const lineEnd = closeAt + end(theme).length;
    out = out.slice(0, lineStart) + renderRegion(theme, seed) + out.slice(lineEnd);
  }
  return out;
}

export const THEME_CSS_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../src/styles/theme.css",
);

async function main(): Promise<void> {
  const current = await readFile(THEME_CSS_PATH, "utf8");
  const next = applyRegions(current);
  if (process.argv.includes("--check")) {
    if (next !== current) {
      console.error("theme.css is out of date: run `pnpm generate:colors`.");
      process.exit(1);
    }
    console.log("generate-md3-colors: theme.css is up to date");
    return;
  }
  if (next !== current) writeFileSync(THEME_CSS_PATH, next);
  console.log(`generate-md3-colors: seed ${SEED}, ${next === current ? "unchanged" : "written"}`);
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
