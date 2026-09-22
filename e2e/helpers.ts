import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Shared machinery for the real-browser gate. Nothing here asserts on its
 * own — it produces *measurements*, because the whole reason this suite
 * exists is that the class string and the rendered pixel have disagreed
 * in this package four times (`playwright.config.ts` lists them).
 */

export type Theme = "dark" | "light";

export interface StoryOptions {
  theme?: Theme;
  width?: number;
  height?: number;
  /** `ThemeSwitcher`'s stories own `data-theme` themselves and opt out of
   * the preview decorator (`.storybook/preview.ts`), so the sync point
   * below does not hold for them. */
  expectThemeStamp?: boolean;
}

/**
 * Opens one story standalone, the way Storybook's own manager does.
 *
 * `viewMode=story` rather than `docs`: a docs page renders every story of
 * the file at once, so a measurement would silently pick up whichever
 * copy came first. `globals=theme:…` is the same channel the toolbar
 * writes to, so a story is tested through the control a reader actually
 * has rather than through a decorator this file re-implements.
 *
 * Story ids come from `storybook-static/index.json`; `story-ids.ts` holds
 * the ones used here so a renamed story fails loudly in one place.
 */
export async function openStory(page: Page, id: string, options: StoryOptions = {}): Promise<void> {
  const { theme = "dark", width, height, expectThemeStamp = true } = options;
  if (width !== undefined) {
    await page.setViewportSize({ width, height: height ?? 800 });
  }
  await page.goto(`/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`);
  // The story is mounted, not merely fetched. `#storybook-root` exists in
  // `iframe.html` before React runs, so its emptiness is the only honest
  // "not yet" signal available.
  await expect
    .poll(() => page.locator("#storybook-root > *").count(), {
      message: `story ${id} never mounted`,
    })
    .toBeGreaterThan(0);
  if (expectThemeStamp) {
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  }
}

/**
 * The story's own subtree, and the only place any selector here may look.
 *
 * Storybook's iframe also carries a `#storybook-docs` element, and in a
 * built Storybook it is **populated but `display: none`** while a story
 * renders — its args table is a real `<table>` with real `<tr>`s. An
 * unscoped `page.locator("tbody tr")` therefore resolves to Storybook's
 * own documentation table, whose rows have a zero-size box, and the
 * failure reads as "element is not visible" on a row that is plainly
 * visible on screen. Found the hard way; every locator in this suite goes
 * through here.
 */
export function storyRoot(page: Page): Locator {
  return page.locator("#storybook-root");
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** `boundingBox()` is nullable for the good reason that an invisible
 * element has no box — but a null here always means the test's premise is
 * already broken, so it fails with the selector rather than a `TypeError`
 * three lines later. */
export async function box(locator: Locator): Promise<Box> {
  const rect = await locator.boundingBox();
  if (rect === null) {
    throw new Error(`element is not rendered, so it has no box: ${locator}`);
  }
  return rect;
}

export type Rgb = readonly [number, number, number];

/** Parses `rgb(…)` / `rgba(…)` — the only two forms `getComputedStyle`
 * ever returns for a colour in Chromium. */
export function parseColor(value: string): { rgb: Rgb; alpha: number } {
  const numbers = value.match(/[\d.]+/g);
  if (numbers === null || numbers.length < 3) {
    throw new Error(`not a colour: ${value}`);
  }
  const [r, g, b, a] = numbers.map(Number) as [number, number, number, number?];
  return { rgb: [r, g, b], alpha: a ?? 1 };
}

function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG 2.1 relative-contrast ratio, identical in definition to the one
 * `src/lib/contrast.test.ts` applies to tokens on paper — the difference
 * is entirely in where the two colours come from. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const one = luminance(a);
  const other = luminance(b);
  const light = Math.max(one, other);
  const dark = Math.min(one, other);
  return (light + 0.05) / (dark + 0.05);
}

export function composite(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  const mix = (a: number, b: number) => a * alpha + b * (1 - alpha);
  return [mix(fg[0], bg[0]), mix(fg[1], bg[1]), mix(fg[2], bg[2])];
}

/**
 * Every distinct colour actually painted inside `clip`, read back from a
 * real screenshot.
 *
 * The PNG is decoded by the page itself (a canvas `drawImage` +
 * `getImageData`) rather than by a decoder written here: Chromium
 * produced the bytes, so Chromium is the authority on what they mean,
 * and a hand-rolled inflate/unfilter pass would be a second thing that
 * can be wrong. Colours are deduplicated in-page so a gradient does not
 * ship tens of thousands of near-identical triples over the wire.
 */
export async function paintedColors(page: Page, clip: Box): Promise<Rgb[]> {
  const shot = await page.screenshot({ clip, animations: "disabled" });
  return await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) throw new Error("no 2d context");
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const seen = new Set<number>();
    const out: [number, number, number][] = [];
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const key = (r << 16) | (g << 8) | b;
      if (!seen.has(key)) {
        seen.add(key);
        out.push([r, g, b]);
      }
    }
    return out;
  }, shot.toString("base64"));
}

const HIDE_TEXT_ATTRIBUTE = "data-e2e-hidden-text";

/**
 * The contrast of a text element against **what is actually painted
 * behind it**, worst pixel first.
 *
 * `contrast.test.ts` computes a token against a token, which is the only
 * thing a stylesheet parser can do, and is exactly why it cannot see the
 * two cases this function exists for: a tinted pill sitting on a hovered
 * row sitting on a table sitting on a surface (four alpha composites, no
 * one of which is written down anywhere), and `InstrumentPanel`'s caption
 * over the aurora mesh (a gradient, so there is no single background
 * colour to look up at all).
 *
 * The backdrop is obtained by painting the element's glyphs transparent
 * and screenshotting its own box: whatever is left is, by construction,
 * exactly what the text sits on. Nothing is modelled, composited or
 * assumed here — the compositing was done by the compositor.
 */
export async function contrastInSitu(
  page: Page,
  locator: Locator,
): Promise<{ worst: number; best: number; foreground: Rgb; backdrop: Rgb[] }> {
  await locator.scrollIntoViewIfNeeded();
  const rect = await box(locator);
  const colour = await locator.evaluate((el) => getComputedStyle(el).color);
  const { rgb, alpha } = parseColor(colour);

  await page.addStyleTag({
    content: `[${HIDE_TEXT_ATTRIBUTE}], [${HIDE_TEXT_ATTRIBUTE}] * {
      color: transparent !important;
      -webkit-text-fill-color: transparent !important;
      text-shadow: none !important;
    }`,
  });
  await locator.evaluate((el, attribute) => el.setAttribute(attribute, ""), HIDE_TEXT_ATTRIBUTE);
  const backdrop = await paintedColors(page, rect);
  await locator.evaluate((el, attribute) => el.removeAttribute(attribute), HIDE_TEXT_ATTRIBUTE);

  const ratios = backdrop.map((bg) => contrastRatio(composite(rgb, alpha, bg), bg));
  return {
    worst: Math.min(...ratios),
    best: Math.max(...ratios),
    foreground: rgb,
    backdrop,
  };
}

/** How many pixels differ between two colour-count maps of the same clip.
 * Used to answer "is this actually painted" without caring what colour it
 * was painted in. */
export async function pixelSignature(page: Page, clip: Box): Promise<string> {
  const shot = await page.screenshot({ clip, animations: "disabled" });
  return shot.toString("base64");
}

/** Counts pixels whose colour differs between two screenshots of the same
 * clip — the honest form of "something became visible here". */
export async function changedPixels(page: Page, a: string, b: string): Promise<number> {
  return await page.evaluate(
    async ([first, second]) => {
      const read = async (base64: string) => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (context === null) throw new Error("no 2d context");
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, canvas.width, canvas.height).data;
      };
      const [x, y] = await Promise.all([read(first ?? ""), read(second ?? "")]);
      if (x.length !== y.length) return Number.POSITIVE_INFINITY;
      let changed = 0;
      for (let i = 0; i < x.length; i += 4) {
        // A tolerance of 8/255 per channel: sub-pixel antialiasing shifts a
        // border by a shade or two between frames, and this function is
        // asked "did a whole tooltip appear", never "did one edge move".
        const near =
          Math.abs((x[i] ?? 0) - (y[i] ?? 0)) <= 8 &&
          Math.abs((x[i + 1] ?? 0) - (y[i + 1] ?? 0)) <= 8 &&
          Math.abs((x[i + 2] ?? 0) - (y[i + 2] ?? 0)) <= 8;
        if (!near) changed += 1;
      }
      return changed;
    },
    [a, b],
  );
}

/**
 * Moves focus to `target` by pressing Tab, the way a keyboard user
 * reaches it.
 *
 * Not `locator.focus()`: `:focus-visible` is *modality*-dependent by
 * design, and the whole point of these assertions is the state a keyboard
 * user sees. Scripted focus on a `<button>` does not reliably match it,
 * so a ring asserted that way could be missing for every real user and
 * still pass.
 */
export async function tabTo(page: Page, target: Locator, maxPresses = 30): Promise<void> {
  await page.locator("body").click({ position: { x: 2, y: 2 } });
  // The click above makes the pointer the last modality; Tab restores the
  // keyboard one before focus lands anywhere that matters.
  for (let i = 0; i < maxPresses; i += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`focus never reached the target in ${maxPresses} Tab presses`);
}

export function expand(rect: Box, by: number): Box {
  return {
    x: rect.x - by,
    y: rect.y - by,
    width: rect.width + by * 2,
    height: rect.height + by * 2,
  };
}

export interface HaloEvidence {
  /** Pixels *outside* the control's own box that changed when it took
   * focus — i.e. how much indicator was actually painted. */
  changed: number;
  /** The strongest contrast between a halo pixel before focus and the
   * same pixel after: WCAG 1.4.11's 3:1 bar for a focus indicator,
   * measured against whatever it actually sits on. */
  contrast: number;
  /** Total pixels examined, so a ratio can be reasoned about. */
  examined: number;
}

/**
 * What, if anything, focus paints around a control.
 *
 * jsdom cannot answer this at all — it has no layout, no cascade and no
 * compositor, so a focus ring is invisible to it whether or not it is
 * visible to a person. It is also the assertion that survives the two
 * ways a ring goes missing in a real render: a colour that matches its
 * ground (computed style looks fine, nothing appears) and an ancestor
 * whose `overflow` clips it away (both the styles and the box are
 * correct; the pixels are gone).
 */
export async function haloEvidence(page: Page, target: Locator, margin = 6): Promise<HaloEvidence> {
  await target.scrollIntoViewIfNeeded();
  const rect = await box(target);
  const clip = expand(rect, margin);
  const before = (await page.screenshot({ clip, animations: "disabled" })).toString("base64");
  await tabTo(page, target);
  const after = (await page.screenshot({ clip, animations: "disabled" })).toString("base64");

  return await page.evaluate(
    async ([first, second, marginText]) => {
      const inset = Number(marginText);
      const read = async (base64: string) => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (context === null) throw new Error("no 2d context");
        context.drawImage(image, 0, 0);
        return {
          data: context.getImageData(0, 0, canvas.width, canvas.height).data,
          w: canvas.width,
          h: canvas.height,
        };
      };
      const a = await read(first ?? "");
      const b = await read(second ?? "");
      const channel = (c: number) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      const relative = (r: number, g: number, bl: number) =>
        0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(bl);
      let changed = 0;
      let examined = 0;
      let best = 1;
      for (let y = 0; y < a.h; y += 1) {
        for (let x = 0; x < a.w; x += 1) {
          // Only the band outside the control's own box: a button that
          // merely changes its own fill on focus is not a focus ring.
          const outside = x < inset || y < inset || x >= a.w - inset || y >= a.h - inset;
          if (!outside) continue;
          examined += 1;
          const i = (y * a.w + x) * 4;
          const [r1, g1, b1] = [a.data[i] ?? 0, a.data[i + 1] ?? 0, a.data[i + 2] ?? 0];
          const [r2, g2, b2] = [b.data[i] ?? 0, b.data[i + 1] ?? 0, b.data[i + 2] ?? 0];
          if (Math.abs(r1 - r2) > 8 || Math.abs(g1 - g2) > 8 || Math.abs(b1 - b2) > 8) {
            changed += 1;
            const one = relative(r1, g1, b1);
            const other = relative(r2, g2, b2);
            const ratio = (Math.max(one, other) + 0.05) / (Math.min(one, other) + 0.05);
            if (ratio > best) best = ratio;
          }
        }
      }
      return { changed, contrast: best, examined };
    },
    [before, after, String(margin)],
  );
}

/**
 * The fraction of a control's own box that is actually painted in
 * something other than the colour behind it.
 *
 * This is how "is it really a circle" gets answered without trusting a
 * class name or a radius token: a circle inscribed in its box covers
 * π/4 ≈ 0.785 of it, a 12px-radius rounded square on a 32px box covers
 * 0.879, and a plain square covers 1.0. Those three are far enough apart
 * to tell apart from pixels, which is precisely what the class-string
 * test that passed on a non-circular button could not do.
 */
export async function paintedFillRatio(page: Page, clip: Box): Promise<number> {
  const shot = await page.screenshot({ clip, animations: "disabled" });
  return await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) throw new Error("no 2d context");
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    // The top-left pixel of a rounded control's bounding box is, by
    // definition of "rounded", the ground behind it.
    const ground = [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0];
    let painted = 0;
    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
      total += 1;
      const distance =
        Math.abs((data[i] ?? 0) - (ground[0] ?? 0)) +
        Math.abs((data[i + 1] ?? 0) - (ground[1] ?? 0)) +
        Math.abs((data[i + 2] ?? 0) - (ground[2] ?? 0));
      if (distance > 120) painted += 1;
    }
    return painted / total;
  }, shot.toString("base64"));
}

/**
 * Waits out every running CSS **transition**, and only those.
 *
 * A measurement taken while a dialog is still scaling in is a
 * measurement of `scale-95` — the close button reads 22.8px rather than
 * its settled 24px, and the test then fails, or worse passes, depending
 * on how loaded the machine is. `getAnimations()` is the browser's own
 * answer to "is anything still moving".
 *
 * Filtered to `CSSTransition` on purpose: `Skeleton`'s pulse is a
 * `CSSAnimation` that never finishes by design, so waiting for *all*
 * animations would hang wherever one is on screen.
 */
export async function settleTransitions(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) => !(animation instanceof CSSTransition) || animation.playState !== "running",
      ),
  );
}

/**
 * Where a pseudo-element is actually painted, in viewport coordinates.
 *
 * daisyUI's tooltip bubble is a `::before`, so it is in no accessibility
 * tree, matches no selector and has no `getBoundingClientRect` — the only
 * handle on it is its computed style plus the box of the element it hangs
 * off. Reconstructed rather than assumed so a test can look wherever the
 * bubble really goes, instead of encoding a belief about which side that
 * is.
 */
export async function pseudoRect(target: Locator, pseudo: "::before" | "::after"): Promise<Box> {
  const host = await box(target);
  const measured = await target.evaluate((el, which) => {
    const style = getComputedStyle(el, which);
    const matrix = new DOMMatrixReadOnly(style.transform === "none" ? undefined : style.transform);
    return {
      left: Number.parseFloat(style.left),
      top: Number.parseFloat(style.top),
      width: Number.parseFloat(style.width),
      height: Number.parseFloat(style.height),
      translateX: matrix.m41,
      translateY: matrix.m42,
    };
  }, pseudo);
  return {
    x: host.x + measured.left + measured.translateX,
    y: host.y + measured.top + measured.translateY,
    width: measured.width,
    height: measured.height,
  };
}

/** Clamps a box to the viewport, because `page.screenshot({ clip })`
 * refuses a region that starts off-screen — and a clipped tooltip is
 * exactly the case whose box starts off-screen. */
export async function clampToViewport(page: Page, rect: Box): Promise<Box> {
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error("no viewport");
  const x = Math.max(0, Math.min(rect.x, viewport.width - 1));
  const y = Math.max(0, Math.min(rect.y, viewport.height - 1));
  return {
    x,
    y,
    width: Math.max(1, Math.min(rect.x + rect.width, viewport.width) - x),
    height: Math.max(1, Math.min(rect.y + rect.height, viewport.height) - y),
  };
}

/**
 * Samples one or more elements' `getBoundingClientRect().x` together, on
 * every animation frame, for `durationMs` — inside the page rather than
 * round-tripped over CDP once per sample, which would add its own latency
 * on top of whatever it is trying to measure, exactly backwards for
 * catching a transition's *peak*.
 *
 * Plural rather than one selector at a time so two elements triggered by
 * the *same* event (e.g. one "Replay" click starting two chips at once)
 * are read from the *same* rAF loop, on the *same* frames — the only way
 * to compare their peaks without also asking whether two separate runs
 * happened to sample at the same point in their respective transitions.
 * `e2e/motion.spec.ts` is the one caller today, and it uses this to
 * compare two curves started by one click; a single-selector read is
 * just this with a one-element array.
 *
 * This exists for one thing `motion-tokens.test.ts` cannot reach: that
 * file integrates the spring's ODE and pins the `linear()` stops against
 * it, entirely in Node, so it proves the curve is correct without ever
 * asking a browser to run it. `linear()` easing functions are Baseline
 * 2023 but not universal, and a CSS engine could in principle sample them
 * differently than the spec's own linear interpolation between stops —
 * this is what actually watches Chromium apply one to a real transition
 * and measures what comes out, rather than trusting that a correct
 * `linear()` string implies a correct render.
 */
export async function sampleBoundingClientXs(
  page: Page,
  selectors: string[],
  durationMs: number,
): Promise<number[][]> {
  return await page.evaluate(
    async ([sels, total]) => {
      // Resolved and null-checked here, in the same scope as the throw —
      // `nodes`'s declared type is `Element[]`, never `(Element | null)[]`,
      // so the nested `tick` function below (a hoisted function
      // declaration; TS does not carry a same-scope `const`'s narrowing
      // across that boundary) never needs its own narrowing to begin with.
      const nodes: Element[] = (sels as string[]).map((sel) => {
        const found = document.querySelector(sel);
        if (found === null) throw new Error(`no element for selector: ${sel}`);
        return found;
      });
      const samples: number[][] = nodes.map(() => []);
      const deadline = performance.now() + (total as number);
      await new Promise<void>((resolve) => {
        function tick() {
          nodes.forEach((el, i) => {
            samples[i]?.push(el.getBoundingClientRect().x);
          });
          if (performance.now() < deadline) {
            requestAnimationFrame(tick);
          } else {
            resolve();
          }
        }
        requestAnimationFrame(tick);
      });
      return samples;
    },
    [selectors, durationMs],
  );
}
