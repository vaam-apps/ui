import { expect, type Locator, type Page, test as testBase } from "@playwright/test";

const testInfo = (): ReturnType<typeof testBase.info> => testBase.info();

/**
 * Shared machinery for the real-browser gate. Nothing here asserts on its
 * own — it produces *measurements*, because the whole reason this suite
 * exists is that the class string and the rendered pixel have disagreed
 * in this package four times (`playwright.config.ts` lists them).
 */

export type Theme = "dark" | "light";
export type Density = "compact" | "comfortable";

/**
 * How long `openStory` waits for the webfont swap before measuring the
 * fallback layout instead. See that function's "Why the wait is bounded"
 * note for the two measurements this number sits between.
 *
 * The healthy case is **75–183ms**, median 95, measured over 15 cold
 * browser contexts rather than the single 34ms reading this constant was
 * first sized against — so the real headroom here is **16x**, not the two
 * orders of magnitude an earlier revision of this comment claimed. 16x
 * still comfortably clears a slow-but-working load while staying an order
 * of magnitude below the 15s/30s test timeout, so the number does not
 * change; the claim about it does.
 */
const FONT_SWAP_BUDGET_MS = 3_000;

export interface StoryOptions {
  theme?: Theme;
  /** D10: the same `globals=…` channel as `theme`, defaulting to
   * `"compact"` — `.storybook/preview.ts`'s own `initialGlobals` default,
   * so a test that never passes this measures exactly what a consumer who
   * sets nothing gets. */
  density?: Density;
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
 *
 * # One shape of story this cannot open at all
 *
 * The mount signal below is "`#storybook-root` has children", so a
 * **portal-only** story — one whose entire render goes to
 * `document.body` — never satisfies it and the poll runs to its timeout
 * rather than failing with anything informative.
 * `primitives-feedback--confirming-busy-with-error` is one today: it
 * renders an overlay straight into `document.body`, so `#storybook-root`
 * stays empty forever. Byte-identical on `main`, so this is pre-existing
 * rather than something D11 introduced, and it is why the full-Storybook
 * compact sweep that backs "compact is unchanged" covered 115 of 116
 * stories. It is a standing hole for any future story of that shape: a
 * test that needs one will have to wait on its own portalled selector
 * instead, and this helper would need a way to be told which.
 *
 * # Why it also waits for the webfonts
 *
 * `.storybook/preview.css` `@import`s IBM Plex Sans from Google Fonts with
 * `display=swap`. Swap means the first paint is laid out in whatever
 * fallback face the *operating system* supplies, and every box in the
 * story moves sideways the instant the real face arrives — so a
 * measurement taken before that is a measurement of a layout no reader
 * ever sees, and it is a *different* wrong layout on every platform.
 * Measured on the run this was found in (CI, Linux; `primitives-button--
 * sizes`): `Button size="icon"` sat at x = 198.34 in the fallback layout
 * and at x = 182.34 once IBM Plex landed — 16px, because the two labelled
 * buttons ahead of it in the row each shed width. On macOS the same shift
 * is 2.8px, which is why every assertion in this suite passed on a laptop
 * and exactly the two that cannot absorb 16px failed in CI:
 * `paintedFillRatio`'s clip missed the disc it was aimed at (and its
 * top-left pixel landed on the disc's own antialiased edge, so "the
 * ground behind it" became the button's fill and the ratio inverted into
 * a plausible-looking 0.654), and `pressAndSettle`'s pointer landed
 * exactly 16.0px from the shifted centre of a 16px-radius circle — one
 * hair outside it, so nothing entered `:active` at all.
 *
 * # Why the wait is bounded
 *
 * `document.fonts.ready` resolves when nothing is in flight — including
 * when a load *fails*, but only if it fails **fast**. Probed on this
 * laptop rather than assumed: a refused connection and a 404 both resolve
 * it in 0–1ms, while `fonts.gstatic.com` **dropped** (a firewall DROP, not
 * a refusal) left the promise pending after 90 seconds with
 * `document.fonts.status === "loading"`. `page.evaluate` carries no
 * timeout of its own and `playwright.config.ts` sets `retries: 0`, so one
 * egress rule on a runner turns all 82 tests in this suite into
 * 30-second timeouts whose code frame points at this line. An earlier
 * revision of this comment claimed "a failed fetch resolves it too, so an
 * offline machine gets the fallback layout deterministically instead of
 * hanging", which is true of a fast failure and false of a dropped
 * packet — the case a locked-down network actually produces.
 *
 * So the wait races a timer. `FONT_SWAP_BUDGET_MS` sits 16x above the
 * measured healthy case and an order of magnitude below the 15s/30s test
 * timeout (see that constant), so it cannot expire on a slow-but-working
 * font load. On expiry the helper **proceeds** rather than failing: what
 * it then measures is the fallback layout, which is exactly what `main`
 * measured before the swap-wait existed and what every assertion in this
 * suite passed against — deterministic per platform, and wrong only for
 * the two assertions the swap shift was added for
 * (`paintedFillRatio`'s clip and `pressAndSettle`'s pointer). A hard
 * failure here would instead turn "this machine cannot reach Google
 * Fonts" into 82 red tests about geometry, which is the diagnosis
 * pointing at the wrong thing.
 *
 * **But expiry must not be silent, for exactly that reason.** On a cold
 * runner a budget-induced pre-swap measurement would otherwise surface as
 * a bare geometry failure with nothing pointing at the font host, which
 * is the same mis-pointing this paragraph argues against — one level
 * further down. So expiry attaches a `font-swap-budget` annotation to the
 * running test (visible in the Playwright report, and in the `github`
 * reporter's output) and writes a warning to stderr. It does not fail:
 * the annotation is there so that *if* something else in the same test
 * goes red, the reason is already on the page.
 *
 * The layout is forced before the wait rather than after — `fonts.ready`
 * answers "is any load *in flight*", so asking it before anything has
 * measured the story's text resolves against an empty set. That is the
 * claim; what was measured is narrower, and the difference matters enough
 * to record: `document.fonts.status` already reads `"loading"` before
 * that line runs, because Storybook's own preview has laid out text long
 * before this helper is reached, so the `getBoundingClientRect()` call is
 * **inert here** rather than load-bearing. It is kept as the cheap,
 * explicit guarantee for a future story that renders nothing measurable
 * until this point, not because it was observed to do anything.
 */
/**
 * The measurement this suite is *about*, installed into the page so that
 * exactly one definition of it exists.
 *
 * `openStory` has to wait for it to settle, and
 * `tap-targets.spec.ts`'s reproducibility gate has to sample it every
 * frame — both from inside the page, where a closure cannot reach. Two
 * hand-written copies of "which controls are visible and where" is the
 * duplication that let the two disagree in the first place: the wait
 * stabilised `#storybook-root`'s element count while the suite read
 * document-wide target geometry, so a story could satisfy the wait and
 * still be moving under the thing being measured.
 *
 * Same population as `tapRegions`: the target roles, minus anything with
 * a zero-size box (a built Storybook keeps `#storybook-docs` populated
 * but `display: none`, which is otherwise seven invisible "controls" in
 * every story). Geometry is rounded, so a sub-pixel reflow does not read
 * as instability while a control appearing, vanishing or sliding does.
 */
async function installTargetSignature(page: Page): Promise<void> {
  if (instrumentedPages.has(page)) return;
  instrumentedPages.add(page);
  await page.addInitScript((selector) => {
    (window as unknown as { __vaamTargetSignature?: () => string }).__vaamTargetSignature = () =>
      [...document.querySelectorAll(selector)]
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width !== 0 || r.height !== 0)
        .map(
          ({ el, r }) =>
            `${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 24)}@${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)}x${Math.round(r.height)}`,
        )
        .join("|");
  }, TARGET_SELECTOR);
}

const instrumentedPages = new WeakSet<Page>();

export async function openStory(page: Page, id: string, options: StoryOptions = {}): Promise<void> {
  const { theme = "dark", density = "compact", width, height, expectThemeStamp = true } = options;
  await installTargetSignature(page);
  if (width !== undefined) {
    await page.setViewportSize({ width, height: height ?? 800 });
  }
  await page.goto(`/iframe.html?id=${id}&viewMode=story&globals=theme:${theme};density:${density}`);
  // The story is mounted **and settled**, not merely fetched.
  // `#storybook-root` exists in `iframe.html` before React runs, so its
  // emptiness is the only honest "not yet" signal available — but "has any
  // children" is satisfied by React's *first* commit, which is not the same
  // as the story being finished. Caught by building a whole-Storybook
  // geometry sweep on this same signal and finding it disagreed with
  // **itself**: the same build swept twice differed on one story each run
  // (25 elements against 12 for `primitives-select--default`), because a
  // faster or slower run snapshotted a half-rendered subtree.
  //
  // For a locator-driven assertion that is mostly harmless — the locator
  // just retries. For a whole-document snapshot it is a silent false
  // green: `tapRegions` reads every target at one instant, so a tree that
  // is still growing reports fewer targets and therefore fewer collisions
  // than the story really has, which is the one direction
  // `tap-targets.spec.ts` must never be wrong in.
  //
  // So: wait for the subtree to stop changing size. `polling: "raf"` keeps
  // the whole loop in the page (no CDP round trip per sample), and three
  // stable frames costs ~48ms rather than the ~100ms an `expect.poll`
  // interval would — measured across the suite at under 4s total.
  try {
    await page.waitForFunction(
      () => {
        // `#storybook-root` for "did anything mount", and then the
        // shared target signature for "has it settled" — the same
        // measurement the suite goes on to take, which is the only
        // signal worth stabilising. Two earlier attempts each stabilised
        // something narrower and were each satisfied while the real
        // measurement was still moving: `#storybook-root`'s element
        // count leaves out every portalled control (
        // `primitives-overlays--menu-with-toggles` holds the root at 2
        // elements from its first frame while its portalled menu is
        // still changing three frames later), and the whole document's
        // element count is blind to a control sliding into place or
        // dropping out of view without the node count changing.
        if (document.querySelectorAll("#storybook-root *").length === 0) return false;
        const signature = window as unknown as { __vaamTargetSignature?: () => string };
        if (signature.__vaamTargetSignature === undefined) return false;
        const w = window as unknown as {
          __mountCount?: string;
          __mountStable?: number;
          __signatureAtReturn?: string;
        };
        // A running CSS transition resets the counter outright, because
        // "unchanged for three frames" cannot tell *settled* from *slow*:
        // the signature rounds geometry to whole pixels, so a control
        // easing into place holds the same rounded position for several
        // frames and then moves again.
        // `primitives-overlays--commands-versus-destinations` is the case
        // — two controls, the same count on every frame, different
        // positions — and it defeated a pure frame counter six times out
        // of six. `settleTransitions` below already encodes this test for
        // the overlay specs; this is the same one, applied before the
        // measurement rather than after it.
        const moving = document
          .getAnimations()
          .some((a) => a instanceof CSSTransition && a.playState === "running");
        const n = signature.__vaamTargetSignature();
        // What `openStory` last saw. Recorded on every evaluation and
        // before any branching, so that whenever this predicate returns
        // true, this holds the page as it was at that instant — with no
        // round trip in between to let a late commit sneak in first.
        // `tap-targets.spec.ts`'s reproducibility gate compares it
        // against the page once everything has finished, which is the
        // contract in one line: what this function hands back is what is
        // actually there.
        w.__signatureAtReturn = n;
        if (moving || w.__mountCount !== n) {
          w.__mountCount = n;
          w.__mountStable = 0;
          return false;
        }
        w.__mountStable = (w.__mountStable ?? 0) + 1;
        // A heuristic, and it says so: six quiet frames cannot promise
        // that nothing will change *later*, only that nothing has
        // changed recently. A control that appears twenty frames after
        // mount defeats it by construction, and
        // `tap-targets.spec.ts`'s gate on this contract is written
        // around that limit rather than pretending it away.
        //
        // Six frames, not three, and the number is measured rather than
        // picked: three left `primitives-select--default` re-rendering
        // inside the window about once in 120 runs, six removed it from
        // 120 (though not from 240 — see `tap-targets.spec.ts`'s note on
        // why that story cannot satisfy the invariant at all). Six frames
        // is ~96ms of wall clock and cost the full suite nothing
        // measurable: 25.2s before, 25.6s after, against a 25-30s spread
        // between runs.
        return (w.__mountStable ?? 0) >= 6;
      },
      // Its own budget, well inside the 15s/30s test timeout, so that the
      // diagnostic below can still run. Without it `waitForFunction`
      // inherits the test's timeout, the test dies first, and the catch
      // block's `page.evaluate` fails with "Target page, context or
      // browser has been closed" — so the message that distinguishes
      // "never mounted" from "never settled" is unreachable in exactly
      // the case it was written for. Found by mutating the wait and
      // reading the failure it produced.
      { polling: "raf", timeout: 10_000 },
    );
  } catch (cause) {
    // Two genuinely different failures, and they want different first
    // moves from whoever reads the message: a story that never mounted is
    // a wrong id, a missing decorator, or a portal-only story (see this
    // function's own note above), while one that never settled is an
    // infinite render loop or an animation with no end. `__mountCount`
    // already tells them apart — it is never written while the predicate
    // is still seeing `n === 0`, and holds a real count otherwise.
    const rooted = await page.evaluate(() => document.querySelectorAll("#storybook-root *").length);
    throw new Error(
      rooted === 0
        ? `story ${id} never mounted: #storybook-root stayed empty for the whole timeout. A mistyped id renders Storybook's own error page, and a portal-only story renders into document.body instead — see openStory's own note on both.`
        : `story ${id} mounted (${rooted} elements under #storybook-root) but its visible controls never stopped changing: which ones exist, or where they are, differed on every frame for the whole timeout. An endless transition or a render loop, not a missing story.`,
      { cause },
    );
  }
  const swapped = await page.evaluate(async (budgetMs) => {
    // Discarded on purpose: reading a rect forces layout, so a story that
    // has not laid out any text yet schedules its font load here rather
    // than after the wait. Inert in practice today — see this function's
    // own "Why the wait is bounded" note, which measured it.
    document.documentElement.getBoundingClientRect();
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      document.fonts.ready,
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, budgetMs);
      }),
    ]);
    // So a resolved `fonts.ready` does not leave a pending timer behind
    // for the rest of the page's life; harmless here, but a stray timer
    // is exactly the kind of thing `copy-button.tsx`'s own doc records
    // having to fix once already.
    if (timer !== undefined) clearTimeout(timer);
    // `"loaded"` means the swap landed; anything else means the budget
    // won the race and this story is about to be measured in the
    // fallback face.
    return document.fonts.status === "loaded";
  }, FONT_SWAP_BUDGET_MS);
  if (!swapped) {
    const note =
      `webfont swap did not land within ${FONT_SWAP_BUDGET_MS}ms for story ${id}; ` +
      "measuring the fallback layout. Geometry failures in this test may be about " +
      "reaching fonts.gstatic.com rather than about the component.";
    // `test.info()` throws outside a running test, and every caller here is
    // inside one — but a helper that can only be used from a test body is a
    // worse helper, so the annotation is best-effort and the stderr line is not.
    try {
      testInfo().annotations.push({ type: "font-swap-budget", description: note });
    } catch {
      // No running test: the warning below is the whole signal.
    }
    process.stderr.write(`${note}\n`);
  }
  if (expectThemeStamp) {
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  }
  await expect(page.locator("html")).toHaveAttribute("data-density", density);
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

/**
 * The size of `target`'s D11 `.tap-target::before` overlay
 * (`theme.css`'s own header on that class) — the invisible,
 * comfortable-register-only expansion of an icon-only control's click
 * area, distinct from its own visual box (`box()` above).
 *
 * Only the *size* is read, not the full `pseudoRect()` reconstruction:
 * every assertion this backs is "did the hit area reach 48px", which
 * `getComputedStyle(el, "::before").width/height` answers directly, and
 * computing the pseudo's viewport *position* on top would be measuring
 * something no test here needs — `theme.css`'s own comment on
 * `--tap-border` already covers the one place the raw computed value
 * would otherwise mislead (a bordered host's `::before` resolves against
 * its padding edge, not its border edge, which is a *position* fact, not
 * a *size* one — `width`/`height` are unaffected by it).
 */
export async function tapTargetSize(target: Locator): Promise<{ width: number; height: number }> {
  return await target.evaluate((el) => {
    const style = getComputedStyle(el, "::before");
    return {
      width: Number.parseFloat(style.width),
      height: Number.parseFloat(style.height),
    };
  });
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

/**
 * What `document.elementFromPoint` actually returns at one viewport point,
 * reported as "which control, if any, owns this pixel".
 *
 * This is the measurement whose absence let D11's first revision ship:
 * every assertion in that pass was about a *size* — is the overlay 48px —
 * and none about *whose* 48px it was. An overlay can be exactly 48×48 on
 * every control in the library and still leave a visible control
 * unreachable, which is what happened: `MaskedValue`'s reveal toggle
 * measured a clean 48 while `CopyButton`'s equally clean 48 sat on top of
 * 16 of its 20 visible pixels, so a click at the eye glyph copied the
 * secret. Size is necessary and hit-testing is what makes it true.
 *
 * `control` is deliberately nullable rather than a string like
 * `"div.caption"`: "nothing interactive claims this point" is itself an
 * assertion this suite needs to make — `Calendar`'s month caption is not
 * a target and must not become one just because a nav button's cover
 * reaches across it.
 */
export interface HitResult {
  /** Accessible name of the nearest interactive ancestor of whatever was
   * returned, or `null` when no control owns the point. */
  control: string | null;
  /** Tag and leading classes of the element actually returned, so a
   * failure names the thing in the way rather than only the miss. */
  element: string;
}

/** Every role this suite treats as "a target" for hit-testing and for the
 * no-two-targets-intersect rule. Deliberately concrete rather than
 * `[onclick]`-ish: a React handler is invisible to the DOM, and every
 * interactive affordance in this library is one of these elements or
 * carries one of these roles.
 *
 * Exported because `tap-targets.spec.ts`'s reproducibility gate has to
 * sample the *same* population this file measures, every frame, from
 * inside the page — and two definitions of "a target" would let that gate
 * pass while the thing it guards drifted. */
export const TARGET_SELECTOR =
  'button, a[href], input, select, textarea, [role="checkbox"], [role="switch"], [role="button"], [role="tab"], [role="option"]';

export async function hitAt(page: Page, x: number, y: number): Promise<HitResult> {
  return await page.evaluate(
    ({ x: px, y: py, selector }) => {
      const hit = document.elementFromPoint(px, py);
      if (hit === null) return { control: null, element: "<nothing>" };
      const owner = hit.closest(selector);
      const classes = hit.className.toString().split(" ").slice(0, 3).join(".");
      return {
        control:
          owner === null
            ? null
            : (owner.getAttribute("aria-label") ?? owner.textContent ?? "").trim(),
        element: `${hit.tagName.toLowerCase()}${classes === "" ? "" : `.${classes}`}`,
      };
    },
    { x, y, selector: TARGET_SELECTOR },
  );
}

/** `hitAt` at the centre of `target`'s own **visible** box — the pixel a
 * reader aims at. Not the centre of its tap region, which is the whole
 * point: a clamped or asymmetric region has a different centre, and the
 * question is always whether the glyph you can see still belongs to the
 * control that draws it. */
export async function hitAtVisibleCentre(page: Page, target: Locator): Promise<HitResult> {
  const rect = await box(target);
  return await hitAt(page, rect.x + rect.width / 2, rect.y + rect.height / 2);
}

/**
 * Every target in the document, with the region it actually claims.
 *
 * The region is the union of the control's own border box and its D11
 * cover (`theme.css`'s `.tap-target`), because those are the two things
 * a pointer can land on and be routed to this control. Reconstructed
 * rather than read: a pseudo-element has no node, so nothing in the DOM
 * or in Playwright can hand back its rect — `getComputedStyle(el,
 * "::before")` gives used insets relative to the host's **padding** box
 * (CSS Position §4), so the host's border widths have to be added back to
 * reach viewport coordinates. Valid because no host here carries a
 * scaling transform; a translate (`DatePicker`'s Clear button) is already
 * inside `getBoundingClientRect()` and applies equally to the pseudo.
 */
export interface TapRegion {
  name: string;
  element: string;
  /** The visible border box. */
  box: Box;
  /** Border box ∪ cover — everything that routes a pointer here. */
  region: Box;
}

export async function tapRegions(page: Page): Promise<TapRegion[]> {
  return await page.evaluate((selector) => {
    const out: TapRegion[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.pointerEvents === "none") continue;
      let left = r.left;
      let top = r.top;
      let right = r.right;
      let bottom = r.bottom;
      const cover = getComputedStyle(el, "::before");
      if (cover.content !== "none" && cover.position === "absolute") {
        const bl = Number.parseFloat(style.borderLeftWidth) || 0;
        const bt = Number.parseFloat(style.borderTopWidth) || 0;
        const cx = r.left + bl + Number.parseFloat(cover.left);
        const cy = r.top + bt + Number.parseFloat(cover.top);
        const cw = Number.parseFloat(cover.width);
        const ch = Number.parseFloat(cover.height);
        if (Number.isFinite(cx) && Number.isFinite(cw)) {
          left = Math.min(left, cx);
          right = Math.max(right, cx + cw);
        }
        if (Number.isFinite(cy) && Number.isFinite(ch)) {
          top = Math.min(top, cy);
          bottom = Math.max(bottom, cy + ch);
        }
      }
      const classes = el.className.toString().split(" ").slice(0, 3).join(".");
      out.push({
        name: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim(),
        element: `${el.tagName.toLowerCase()}${classes === "" ? "" : `.${classes}`}`,
        box: { x: r.x, y: r.y, width: r.width, height: r.height },
        region: { x: left, y: top, width: right - left, height: bottom - top },
      });
    }
    return out;
  }, TARGET_SELECTOR);
}

/** `0` when two regions are disjoint or one is wholly inside the other,
 * otherwise the area they share.
 *
 * Containment is exempt on purpose and it is not a loophole: a trailing
 * affordance layered over a larger container control — `DatePicker`'s
 * Clear button inside its own field-shaped trigger — is a real M3
 * pattern, and the honest requirement there is that the inner target sits
 * *inside* the outer one and the outer one reserves the room, not that
 * the two never touch. A region that escapes the control it is layered
 * over is the defect, and that is exactly what this stops exempting.
 */
export function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  const contains = (outer: Box, inner: Box): boolean =>
    inner.x >= outer.x - 0.5 &&
    inner.y >= outer.y - 0.5 &&
    inner.x + inner.width <= outer.x + outer.width + 0.5 &&
    inner.y + inner.height <= outer.y + outer.height + 0.5;
  if (contains(a, b) || contains(b, a)) return 0;
  return w * h;
}
