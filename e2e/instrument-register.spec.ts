import { expect, type Locator, type Page, test } from "@playwright/test";
import { box, openStory, paintedColors, type Rgb, storyRoot, type Theme } from "./helpers";
import { STORY } from "./story-ids";

/**
 * The instrument register is one hue family, measured off the render.
 *
 * `InstrumentPanel`'s shapes, `Card glow`'s halo and `Skeleton
 * instrument`'s drift are all mixed from the seed's `primary-container`
 * (with `primary` for depth). The structural half — which variables the
 * tokens mix — is `src/lib/instrument-register.test.ts`; this is the half
 * a token check cannot see: that the colours Chromium actually computes
 * for the box-shadow and the gradients are those roles, and not a status
 * hue, in both themes. A class string or a token name could keep saying
 * "primary" while a later rule repainted the element.
 *
 * Every glow and skeleton stop is `color-mix(in srgb, <role> N%,
 * transparent)`, which computes to the role's own channels at an alpha, so
 * "derives from the role" is an exact channel comparison here, not a hue
 * estimate. Roles are resolved through a probe element in the same page —
 * never a hex copied into this file — so a regenerated palette moves both
 * sides.
 */

const THEMES: Theme[] = ["dark", "light"];

const STATUS_HUES = [
  "danger",
  "expired",
  "neutral",
  "parked",
  "progress",
  "success",
  "uncertain",
  "warning",
] as const;

interface Paint {
  rgb: Rgb;
  alpha: number;
}

/** Every colour in a computed `box-shadow` or `background-image`, in
 * either form Chromium serialises one: `rgb(a)(…)` or the `color(srgb …)`
 * a `color-mix(in srgb, …)` computes to (channels 0–1). */
function paints(value: string): Paint[] {
  const out: Paint[] = [];
  for (const m of value.matchAll(
    /color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.]+))?\)/g,
  )) {
    out.push({
      rgb: [Number(m[1]) * 255, Number(m[2]) * 255, Number(m[3]) * 255],
      alpha: m[4] === undefined ? 1 : Number(m[4]),
    });
  }
  for (const m of value.matchAll(/rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)/g)) {
    out.push({
      rgb: [Number(m[1]), Number(m[2]), Number(m[3])],
      alpha: m[4] === undefined ? 1 : Number(m[4]),
    });
  }
  return out;
}

/** A role's colour as this page resolves it, in the story's theme scope. */
async function role(page: Page, variable: string): Promise<Rgb> {
  const colour = await storyRoot(page).evaluate((root, name) => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = `var(${name})`;
    root.append(probe);
    const value = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return value;
  }, variable);
  const [first] = paints(colour);
  if (first === undefined) throw new Error(`${variable} resolved to ${colour}`);
  return first.rgb;
}

/** Largest per-channel difference, 0–255. */
const distance = (a: Rgb, b: Rgb) => Math.max(...a.map((c, i) => Math.abs(c - (b[i] ?? 0))));

interface Family {
  primary: Rgb;
  container: Rgb;
  statuses: { hue: string; rgb: Rgb }[];
}

async function family(page: Page): Promise<Family> {
  return {
    primary: await role(page, "--md-sys-color-primary"),
    container: await role(page, "--md-sys-color-primary-container"),
    statuses: await Promise.all(
      STATUS_HUES.map(async (hue) => ({ hue, rgb: await role(page, `--state-${hue}-fg`) })),
    ),
  };
}

/**
 * Asserts each visible paint is primary or primary-container, to the
 * channel (±1 for the 0–1 float a `color(srgb …)` is serialised as), and
 * clear of every status foreground. Fully transparent stops — the
 * gradients' fade-out — carry no colour and are skipped.
 */
function expectPrimaryFamily(found: Paint[], f: Family, what: string) {
  const visible = found.filter((p) => p.alpha > 0);
  expect(visible.length, `${what} paints something`).toBeGreaterThan(0);
  for (const p of visible) {
    const isPrimary = distance(p.rgb, f.primary) <= 1;
    const isContainer = distance(p.rgb, f.container) <= 1;
    expect(
      isPrimary || isContainer,
      `${what}: rgb(${p.rgb.map(Math.round).join(", ")}) is neither primary (${f.primary.join(
        ", ",
      )}) nor primary-container (${f.container.join(", ")})`,
    ).toBe(true);
    for (const status of f.statuses) {
      expect(
        distance(p.rgb, status.rgb),
        `${what}: rgb(${p.rgb.map(Math.round).join(", ")}) is the ${status.hue} status hue`,
      ).toBeGreaterThan(8);
    }
  }
  // At least one stop is the container role itself: the register's hue,
  // not only its darker sibling.
  expect(
    visible.some((p) => distance(p.rgb, f.container) <= 1),
    `${what} uses primary-container`,
  ).toBe(true);
}

const glowCard = (page: Page) => storyRoot(page).locator(".card").first();

async function pseudoImage(target: Locator, which: "::before" | "::after") {
  return await target.evaluate((el, w) => getComputedStyle(el, w).backgroundImage, which);
}

for (const theme of THEMES) {
  test.describe(`${theme}: the instrument register is one hue`, () => {
    test("Card glow's halo is primary-container and primary, never a status hue", async ({
      page,
    }) => {
      await openStory(page, STORY.instrumentPanelGlow, { theme });
      const f = await family(page);
      const shadow = await glowCard(page).evaluate((el) => getComputedStyle(el).boxShadow);
      expect(shadow, "the glow card has a shadow at all").not.toBe("none");
      const found = paints(shadow);
      expect(found.length, "a halo is several stacked shadows").toBeGreaterThanOrEqual(3);
      expectPrimaryFamily(found, f, "Card glow");

      // And it is on screen: the band just under the card's border box is
      // not the bare page. A shadow can compute and still be painted over
      // (the reason this is not a blurred pseudo-element).
      const rect = await box(glowCard(page));
      const page100 = await role(page, "--color-base-100");
      const under = await paintedColors(page, {
        x: rect.x + rect.width / 4,
        y: rect.y + rect.height + 2,
        width: rect.width / 2,
        height: 10,
      });
      expect(
        under.some((p) => distance(p, page100) > 3),
        "the halo is painted under the card",
      ).toBe(true);
    });

    test("Skeleton instrument's drift is primary-container and primary; the default stays tonal", async ({
      page,
    }) => {
      await openStory(page, STORY.skeletonTonalVsInstrument, { theme });
      const f = await family(page);

      const instrument = storyRoot(page).locator(".skeleton-instrument").first();
      for (const which of ["::before", "::after"] as const) {
        expectPrimaryFamily(
          paints(await pseudoImage(instrument, which)),
          f,
          `Skeleton instrument ${which}`,
        );
      }

      // The default drift beside it is still the tonal token, so the
      // instrument paint is a real switch rather than the only paint.
      // Tonal mixes `in oklab` and computes to an `oklab(…)` this file
      // does not convert, so it is compared as the serialisation the same
      // token gets on a probe.
      const tonal = storyRoot(page).locator(".skeleton-chaos:not(.skeleton-instrument)").first();
      const tonalToken = await storyRoot(page).evaluate((root) => {
        const probe = document.createElement("div");
        probe.style.backgroundColor = "var(--skeleton-tonal-1)";
        root.append(probe);
        const value = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return value;
      });
      expect(await pseudoImage(tonal, "::before")).toContain(tonalToken);
    });

    test("under reduced motion the drift stops and the glow softens, still in the primary family", async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await openStory(page, STORY.instrumentPanelOneRegister, { theme });
      const f = await family(page);

      const instrument = storyRoot(page).locator(".skeleton-instrument").first();
      for (const which of ["::before", "::after"] as const) {
        expect(
          await instrument.evaluate((el, w) => getComputedStyle(el, w).animationName, which),
        ).toBe("none");
        expectPrimaryFamily(
          paints(await pseudoImage(instrument, which)),
          f,
          `reduced-motion Skeleton instrument ${which}`,
        );
      }

      const shadow = await glowCard(page).evaluate((el) => getComputedStyle(el).boxShadow);
      const found = paints(shadow);
      expect(found.length, "the softened glow is fewer shadows").toBe(2);
      expectPrimaryFamily(found, f, "reduced-motion Card glow");
    });
  });
}
