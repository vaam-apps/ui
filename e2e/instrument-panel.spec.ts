import { expect, type Locator, type Page, test } from "@playwright/test";
import { box, openStory, paintedColors, storyRoot, type Theme } from "./helpers";
import { STORY } from "./story-ids";

/**
 * `InstrumentPanel` as an M3 Expressive container, measured off the
 * render rather than read off its class string.
 *
 * Each value here is a claim the component's doc makes and a class string
 * could keep making while the render disagreed: a `rounded-2xl` that a
 * later `rounded-box` in a caller's `cn()` silently replaces, a fill
 * written as a token nobody declared (Tailwind emits nothing and the
 * panel goes transparent — `theme-tokens.test.ts` records two of those),
 * a pseudo-element whose mask URL fails to parse and paints a solid
 * square, or a `StatTile` whose in-panel variants never match because
 * the panel lost the class they key on.
 *
 * Colours are compared against the *role* resolved in the same page —
 * a probe element painted `var(--md-sys-color-…)` — never against a hex
 * copied into this file, so a regenerated palette moves both sides.
 */

const THEMES: Theme[] = ["dark", "light"];

/** The computed `background-color` a probe element gets from `value`, in
 * the story's own theme scope. */
async function resolvedColour(page: Page, value: string): Promise<string> {
  return await storyRoot(page).evaluate((root, css) => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = css;
    root.append(probe);
    const colour = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return colour;
  }, value);
}

/** `rgb(…)`, or the `color(srgb r g b)` form Chromium computes a
 * `color-mix(in srgb, …)` to, as 0–255 channels. */
function toRgb(colour: string): number[] {
  const srgb = /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/.exec(colour);
  if (srgb !== null) return srgb.slice(1, 4).map((c) => Number(c) * 255);
  const numbers = colour.match(/[\d.]+/g);
  if (numbers === null || numbers.length < 3) throw new Error(`not a colour: ${colour}`);
  return numbers.slice(0, 3).map(Number);
}

async function computed(target: Locator, pseudo?: "::before" | "::after") {
  return await target.evaluate((el, which) => {
    const style = getComputedStyle(el, which ?? null);
    return {
      radii: [
        style.borderTopLeftRadius,
        style.borderTopRightRadius,
        style.borderBottomRightRadius,
        style.borderBottomLeftRadius,
      ].map(Number.parseFloat),
      padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].map(
        Number.parseFloat,
      ),
      borderWidths: [
        style.borderTopWidth,
        style.borderRightWidth,
        style.borderBottomWidth,
        style.borderLeftWidth,
      ].map(Number.parseFloat),
      borderColor: style.borderTopColor,
      background: style.backgroundColor,
      boxShadow: style.boxShadow,
      mask: style.maskImage,
      fontSize: Number.parseFloat(style.fontSize),
      fontWeight: style.fontWeight,
    };
  }, pseudo);
}

/** The panel is the story root's first element — `InstrumentPanel` renders
 * one `<div>`, and these stories render nothing around it. */
const panelIn = (page: Page) => storyRoot(page).locator(".instrument-panel").first();

for (const theme of THEMES) {
  test.describe(`${theme}: InstrumentPanel`, () => {
    test("is an M3 container: 28px corner, surface-container, 24px padding, no border, no shadow", async ({
      page,
    }) => {
      await openStory(page, STORY.instrumentPanelDashboard, { theme });
      const panel = await computed(panelIn(page));

      expect(panel.radii, "M3 extra-large corner on all four").toEqual([28, 28, 28, 28]);
      expect(panel.background, "the surface-container role").toBe(
        await resolvedColour(page, "var(--md-sys-color-surface-container)"),
      );
      expect(panel.padding, "24dp on the 4dp grid").toEqual([24, 24, 24, 24]);
      expect(panel.borderWidths, "no hairline: that is the diagnostic register").toEqual([
        0, 0, 0, 0,
      ]);
      expect(panel.boxShadow, "no shadow: it does not float").toBe("none");

      // The tier swap, checked where it happens. The caption in this story
      // sits on the bare container, where `subtle` would *pass* AA — so a
      // contrast measurement cannot tell the two tiers apart here, and only
      // the colour itself can.
      const caption = storyRoot(page).getByText("Last 24 hours, across all providers");
      expect(await caption.evaluate((el) => getComputedStyle(el).color)).toBe(
        await caption.evaluate((el) => {
          const probe = document.createElement("span");
          probe.style.color = "var(--muted-foreground)";
          el.append(probe);
          const colour = getComputedStyle(probe).color;
          probe.remove();
          return colour;
        }),
      );
    });

    test("paints its two Expressive shapes, in primary-container mixes, and they render", async ({
      page,
    }) => {
      await openStory(page, STORY.instrumentPanelDashboard, { theme });
      const target = panelIn(page);
      const clover = await computed(target, "::before");
      const halo = await computed(target, "::after");

      const cloverColour = await resolvedColour(page, "var(--instrument-shape)");
      const haloColour = await resolvedColour(page, "var(--instrument-shape-quiet)");
      expect(clover.background).toBe(cloverColour);
      expect(halo.background).toBe(haloColour);
      expect(clover.mask, "the clover is a mask, not a square").toContain("data:image/svg+xml");
      expect(halo.mask, "the halo is a mask, not a square").toContain("data:image/svg+xml");
      // Mixed *into* the container, so neither may come out equal to it —
      // a share of 0% would pass every check above and paint nothing.
      // Compared as channels, not strings: Chromium computes a mix to
      // `color(srgb …)` and a plain role to `rgb(…)`, so two strings can
      // differ while naming the same colour.
      const fill = toRgb(await resolvedColour(page, "var(--instrument-container)"));
      const distance = (colour: string) =>
        Math.max(...toRgb(colour).map((c, i) => Math.abs(c - (fill[i] ?? 0))));
      expect(distance(cloverColour), "the clover differs from the fill").toBeGreaterThan(4);
      expect(distance(haloColour), "the halo differs from the fill").toBeGreaterThan(1);

      // And they are on screen: the top-right corner of the panel has
      // both exact colours in it. A mask whose data URL fails to parse
      // paints nothing at all; a missing mask paints a square, which
      // would also pass the colour check, so it is asserted above.
      const rect = await box(target);
      const corner = { x: rect.x + rect.width - 160, y: rect.y, width: 160, height: 120 };
      const painted = await paintedColors(page, corner);
      const isPainted = (colour: string) => {
        const want = toRgb(colour);
        // ±1 per channel: the computed value is a float mix, the pixel is
        // its 8-bit rounding.
        return painted.some((p) => p.every((c, i) => Math.abs(c - (want[i] ?? 0)) <= 1));
      };
      expect(isPainted(cloverColour), `the clover (${cloverColour}) is painted`).toBe(true);
      expect(isPainted(haloColour), `the halo (${haloColour}) is painted`).toBe(true);
    });

    test("StatTiles inside it are tonal nested containers, and the emphasized figure is the hero", async ({
      page,
    }) => {
      await openStory(page, STORY.instrumentPanelDashboard, { theme });
      const tiles = panelIn(page).locator("dl").locator("xpath=..");
      const tile = await computed(tiles.first());
      expect(tile.radii, "large-increased corner").toEqual([20, 20, 20, 20]);
      expect(tile.background, "surface-container-highest").toBe(
        await resolvedColour(page, "var(--md-sys-color-surface-container-highest)"),
      );
      expect(tile.borderColor, "the hairline goes in a panel").toBe("rgba(0, 0, 0, 0)");
      expect(tile.padding).toEqual([20, 20, 20, 20]);

      const hero = await computed(storyRoot(page).getByText("12,481", { exact: true }));
      expect(hero.fontSize, "display-small").toBe(36);
      expect(hero.fontWeight, "the emphasized weight").toBe("500");
      const peer = await computed(storyRoot(page).getByText("37", { exact: true }));
      expect(peer.fontSize, "a non-emphasized peer stays headline-medium").toBe(28);
    });

    test("a StatTile outside a panel is unchanged", async ({ page }) => {
      await openStory(page, STORY.detailTiles, { theme });
      const tile = await computed(storyRoot(page).locator("dl").first().locator("xpath=.."));
      expect(tile.radii, "medium corner").toEqual([12, 12, 12, 12]);
      expect(tile.borderWidths).toEqual([1, 1, 1, 1]);
      expect(tile.borderColor, "the hairline stays outside a panel").not.toBe("rgba(0, 0, 0, 0)");
      expect(tile.background).toBe(await resolvedColour(page, "var(--color-base-300)"));
    });
  });
}
