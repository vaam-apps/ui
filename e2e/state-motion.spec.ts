import { expect, type Locator, type Page, test } from "@playwright/test";
import { box, openStory, settleTransitions, storyRoot } from "./helpers";
import { STORY } from "./story-ids";

/**
 * State changes animate — measured on running transitions, frame by frame.
 *
 * The owner's report was "sometimes buttons are not animated". Every
 * button *had* a `transition-property` list naming `border-radius`; the
 * class strings were right and a test asserting them would have passed.
 * What was wrong was the value the radius animated *from*: `rounded-full`
 * is `calc(infinity * 1px)`, and a spring between 3.35e+07px and 8px
 * holds round, overshoots to 0 (square), rebounds round and then lands —
 * which reads as a glitch, not a morph. So these tests sample computed
 * values on every animation frame and assert on the *path*, not on the
 * declaration.
 *
 * The rest are state changes that had no transition at all: the tab
 * indicator (a pseudo-element, whose `transition` is its own), the
 * switch handle's colour, the checkbox's check mark, menu rows.
 */

async function sampleFrames(
  page: Page,
  target: Locator,
  read: (el: Element) => number,
  trigger: () => Promise<void>,
  ms = 600,
): Promise<number[]> {
  const handle = await target.elementHandle();
  if (handle === null) throw new Error("no element");
  const sampling = page.evaluate(
    ([el, duration, source]) =>
      new Promise<number[]>((resolve) => {
        // biome-ignore lint/security/noGlobalEval: the reader is this file's own arrow function, serialised to cross into the page.
        const fn = (0, eval)(source as string) as (e: Element) => number;
        const out: number[] = [];
        const start = performance.now();
        const tick = () => {
          out.push(fn(el as Element));
          if (performance.now() - start < (duration as number)) requestAnimationFrame(tick);
          else resolve(out);
        };
        requestAnimationFrame(tick);
      }),
    [handle, ms, read.toString()] as const,
  );
  await trigger();
  return await sampling;
}

// In px, resolving a percentage against the element's width — the bare
// icon controls rest at `50%`, and mid-transition Chromium reports the
// mix as `calc(<p>% + <l>px)`.
const topLeftRadius = (el: Element) => {
  const value = getComputedStyle(el).borderTopLeftRadius.replace(/\s-\s/g, " + -");
  const percent = /(-?[\d.e+-]+)%/.exec(value);
  const length = /(-?[\d.e+-]+)px/.exec(value);
  const width = el.getBoundingClientRect().width;
  return (
    (percent ? (Number.parseFloat(percent[1] ?? "0") / 100) * width : 0) +
    (length ? Number.parseFloat(length[1] ?? "0") : 0)
  );
};

function between(samples: number[], a: number, b: number): number[] {
  // A margin proportional to the change, so a 0 → 1 opacity and a 20px
  // → 8px radius are judged alike: a value counts as in flight only if it
  // is clear of both ends by 5% of the distance between them.
  const margin = Math.abs(b - a) * 0.05;
  const lo = Math.min(a, b) + margin;
  const hi = Math.max(a, b) - margin;
  return [...new Set(samples.filter((v) => v > lo && v < hi).map((v) => Math.round(v * 1000)))];
}

/** Press and release one control, asserting the radius *travels* both ways
 * and never leaves the band between its two ends (plus the spring's
 * documented ≤10% overshoot below the pressed value). */
async function expectPressMorph(page: Page, control: Locator, label: string): Promise<void> {
  const rect = await box(control);
  const rest = await control.evaluate(topLeftRadius);
  expect(rest, `${label}: resting radius is finite`).toBeLessThan(1000);

  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  const down = await sampleFrames(page, control, topLeftRadius, () => page.mouse.down());
  await settleTransitions(page);
  const pressed = await control.evaluate(topLeftRadius);
  expect(pressed, `${label}: the press squares it off`).toBeLessThan(rest - 1);
  expect(
    between(down, rest, pressed).length,
    `${label}: the press passed through intermediate radii (${down.join(", ")})`,
  ).toBeGreaterThanOrEqual(3);
  expect(Math.max(...down), `${label}: never above the resting radius`).toBeLessThanOrEqual(
    rest + 0.5,
  );
  expect(
    Math.min(...down),
    `${label}: overshoots by a spring's share, never to a square`,
  ).toBeGreaterThan(pressed - Math.max(1, (rest - pressed) * 0.15));

  const up = await sampleFrames(page, control, topLeftRadius, () => page.mouse.up());
  await settleTransitions(page);
  expect(await control.evaluate(topLeftRadius), `${label}: springs back`).toBeCloseTo(rest, 0);
  expect(
    between(up, pressed, rest).length,
    `${label}: the release passed through intermediate radii (${up.join(", ")})`,
  ).toBeGreaterThanOrEqual(3);
}

test.describe("buttons: every variant and size morphs on press, both ways", () => {
  test("Variants: five buttons, a finite stadium at rest, a real morph", async ({ page }) => {
    await openStory(page, STORY.buttonVariants);
    const buttons = storyRoot(page).getByRole("button");
    const count = await buttons.count();
    expect(count, "the variants story renders its five buttons").toBeGreaterThanOrEqual(5);
    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      if (await button.isDisabled()) continue;
      const name = (await button.textContent()) ?? `#${i}`;
      const rect = await box(button);
      expect(await button.evaluate(topLeftRadius), `${name}: rests at half its height`).toBeCloseTo(
        rect.height / 2,
        0,
      );
      const motion = await button.evaluate((el) => {
        const s = getComputedStyle(el);
        return { property: s.transitionProperty, duration: s.transitionDuration };
      });
      expect(motion.property, `${name}: transitions its radius`).toContain("border-radius");
      expect(motion.property, `${name}: and its fill`).toContain("background-color");
      expect(
        motion.duration.split(",").every((d) => Number.parseFloat(d) > 0),
        `${name}: every listed property has a duration (${motion.duration})`,
      ).toBe(true);
      await expectPressMorph(page, button, name);
    }
  });

  test("Sizes: sm, md and the circular icon button", async ({ page }) => {
    await openStory(page, STORY.buttonSizes);
    const buttons = storyRoot(page).getByRole("button");
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const name =
        (await button.getAttribute("aria-label")) ?? (await button.textContent()) ?? `#${i}`;
      await expectPressMorph(page, button, name);
    }
  });

  test("the bare icon controls (PRESS_SHAPE_MORPH) rest as a circle and morph too", async ({
    page,
  }) => {
    await openStory(page, STORY.maskedValueDefault);
    const reveal = storyRoot(page)
      .getByRole("button", { name: /^(Reveal|Hide) / })
      .first();
    const rect = await box(reveal);
    expect(await reveal.evaluate(topLeftRadius), "50% of a square box").toBeCloseTo(
      rect.width / 2,
      0,
    );
    await expectPressMorph(page, reveal, "MaskedValue reveal");
  });
});

test.describe("state changes that used to snap", () => {
  test("Tabs: the indicator fades and grows rather than appearing", async ({ page }) => {
    await openStory(page, STORY.tabsWithCounts);
    const tabs = storyRoot(page).getByRole("tab");
    const next = tabs.nth(1);
    const opacity = (el: Element) => Number.parseFloat(getComputedStyle(el, "::after").opacity);
    const samples = await sampleFrames(page, next, opacity, () => next.click());
    await settleTransitions(page);
    expect(await next.evaluate(opacity)).toBe(1);
    expect(
      between(samples, 0, 1).length,
      `the indicator passed through partial opacity (${samples.join(", ")})`,
    ).toBeGreaterThanOrEqual(2);
  });

  test("Switch: the handle's colour changes on the same transition as its travel", async ({
    page,
  }) => {
    await openStory(page, STORY.checkboxAndSwitch);
    const toggle = storyRoot(page).getByRole("switch", { name: "Toggle" });
    const handle = toggle.locator("span[aria-hidden]");
    const motion = await handle.evaluate((el) => getComputedStyle(el).transitionProperty);
    for (const property of ["translate", "scale", "background-color"]) {
      expect(motion, `the handle transitions ${property}`).toContain(property);
    }
    const x = (el: Element) => el.getBoundingClientRect().x;
    const before = await handle.evaluate(x);
    const samples = await sampleFrames(page, handle, x, () => toggle.click());
    await settleTransitions(page);
    const after = await handle.evaluate(x);
    expect(after, "the click moved the handle").not.toBeCloseTo(before, 0);
    expect(between(samples, before, after).length, "and it travelled").toBeGreaterThanOrEqual(3);
  });

  test("Checkbox: the check mark fades in rather than appearing", async ({ page }) => {
    await openStory(page, STORY.checkboxAndSwitch);
    const checkbox = storyRoot(page).getByRole("checkbox", { name: "Checked", exact: true });
    const mark = checkbox.locator("svg");
    const opacity = (el: Element) => Number.parseFloat(getComputedStyle(el).opacity);
    expect(await mark.evaluate(opacity), "premise: checked").toBe(1);
    const samples = await sampleFrames(page, mark, opacity, () => checkbox.click());
    await settleTransitions(page);
    expect(await mark.evaluate(opacity)).toBe(0);
    expect(
      between(samples, 0, 1).length,
      `partial opacity (${samples.join(", ")})`,
    ).toBeGreaterThanOrEqual(2);
  });

  test("DropdownMenu: rows fade their focus fill", async ({ page }) => {
    await openStory(page, STORY.menusAndTips);
    await storyRoot(page).getByRole("button", { name: "Actions" }).click();
    const item = page.getByRole("menuitem").first();
    await expect(item).toBeVisible();
    const property = await item.evaluate((el) => getComputedStyle(el).transitionProperty);
    expect(property).toContain("background-color");
  });
});
