import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The two M3 Expressive shapes `InstrumentPanel` paints, as the formulas
 * that produced them — the spec for the mask paths in `theme.css`, which
 * nobody should edit by hand.
 *
 * Material publishes its shape library as `RoundedPolygon`s (androidx
 * `graphics-shapes`, `MaterialShapes.Cookie9Sided`, `.Clover4Leaf`),
 * which a stylesheet cannot read. These are polar approximations of the
 * same outlines: a radius that varies with the angle, sampled at 180
 * points, scaled so the outermost point touches the 100×100 box, written
 * to one decimal. To change a shape, change it here, copy the value the
 * failure message prints into `theme.css`, and look at the render — the
 * test only proves the stylesheet and the formula agree, not that the
 * result is pretty.
 */

const THEME_CSS = readFileSync(
  fileURLToPath(new URL("../styles/theme.css", import.meta.url)),
  "utf8",
);

const SAMPLES = 180;

function polarPath(radius: (theta: number) => number, rotation: number): string {
  const points = Array.from({ length: SAMPLES }, (_, i) => {
    const theta = (i / SAMPLES) * 2 * Math.PI;
    return [theta, radius(theta)] as const;
  });
  const max = Math.max(...points.map(([, r]) => r));
  return `M${points
    .map(([theta, r]) => {
      const k = 50 / max;
      const x = 50 + r * k * Math.cos(theta + rotation);
      const y = 50 + r * k * Math.sin(theta + rotation);
      return `${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join("L")}Z`;
}

function maskUrl(path: string): string {
  return (
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' ` +
    `viewBox='0 0 100 100'%3E%3Cpath d='${path}'/%3E%3C/svg%3E")`
  );
}

const SHAPES = {
  // Nine gentle scallops: r(θ) = 1 + 0.08·cos 9θ, a lobe pointing up.
  "--shape-cookie-9": maskUrl(polarPath((t) => 1 + 0.08 * Math.cos(9 * t), -Math.PI / 2)),
  // Four round lobes with pinched valleys: smooth at each peak (|cos|
  // is flat there), a kink at each valley (|cos| crosses zero). Lobes on
  // the diagonals, the way M3 draws the clover.
  "--shape-clover-4": maskUrl(
    polarPath((t) => 1 - 0.32 * (1 - Math.abs(Math.cos(2 * t))) ** 1.3, Math.PI / 4),
  ),
};

describe("the Expressive shape masks match their formulas", () => {
  it.each(Object.entries(SHAPES))("%s", (name, expected) => {
    const declared = new RegExp(`${name}:\\s*(url\\("[^"]+"\\));`).exec(THEME_CSS)?.[1];
    expect(
      declared,
      `${name} should be declared once in theme.css as:\n${name}: ${expected};`,
    ).toBe(expected);
  });
});
