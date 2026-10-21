import { expect, type Locator, type Page, test } from "@playwright/test";
import { box, openStory, paintedColors, parseColor, settleTransitions, storyRoot } from "./helpers";
import { STORY } from "./story-ids";

/**
 * The field shape morph (`src/lib/field-shape.ts`): every field-shaped
 * control rests almost circular — a stadium, half its own height — and
 * pulls in to a rounded rectangle while it holds focus, on M3 Expressive's
 * spatial spring.
 *
 * Measured, not read off the class string, because a radius can be in the
 * class list and still not be what paints (an unlayered utility against
 * daisyUI's nested layer; `rounded-full`'s infinite length), and because
 * "animates" is a claim about intermediate frames that only a running
 * browser can make.
 */

/** Some of these stories focus a field from their play function; the
 * resting shape is only measurable once nothing holds focus. */
async function blurAll(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await settleTransitions(page);
}

async function radius(target: Locator): Promise<number> {
  return await target.evaluate((el) => Number.parseFloat(getComputedStyle(el).borderTopLeftRadius));
}

/** The top-left radius on every animation frame for `ms` after `trigger`
 * runs, sampled from one in-page rAF loop started before it. */
async function sampleRadius(
  page: Page,
  target: Locator,
  trigger: () => Promise<void>,
  ms = 600,
): Promise<number[]> {
  const handle = await target.elementHandle();
  if (handle === null) throw new Error("no element");
  const sampling = page.evaluate(
    ([el, duration]) =>
      new Promise<number[]>((resolve) => {
        const out: number[] = [];
        const start = performance.now();
        const tick = () => {
          out.push(Number.parseFloat(getComputedStyle(el as Element).borderTopLeftRadius));
          if (performance.now() - start < (duration as number)) requestAnimationFrame(tick);
          else resolve(out);
        };
        requestAnimationFrame(tick);
      }),
    [handle, ms] as const,
  );
  await trigger();
  return await sampling;
}

/** Distinct values strictly between two radii, i.e. frames the change was
 * actually *in flight* — a snap has none. */
function inFlight(samples: number[], from: number, to: number): number[] {
  const lo = Math.min(from, to) + 0.5;
  const hi = Math.max(from, to) - 0.5;
  return [...new Set(samples.filter((r) => r > lo && r < hi).map((r) => Math.round(r * 10)))];
}

test.describe("field shape: a stadium at rest, rounded while focused", () => {
  test("Input rests at half its height and pulls in to 12px on focus, animating between", async ({
    page,
  }) => {
    await openStory(page, STORY.formControls);
    const input = storyRoot(page).locator("input").first();
    await blurAll(page);
    const rect = await box(input);

    const rest = await radius(input);
    expect(rest, "resting radius is a finite half-height, not rounded-full").toBeCloseTo(
      rect.height / 2,
      0,
    );

    const samples = await sampleRadius(page, input, () => input.focus());
    await settleTransitions(page);
    const focused = await radius(input);
    expect(focused, "focused radius is M3's corner-medium at compact").toBeCloseTo(12, 0);
    expect(
      inFlight(samples, rest, focused).length,
      `the radius passed through intermediate values (sampled: ${samples.join(", ")})`,
    ).toBeGreaterThanOrEqual(3);
    // A spring from a finite radius never leaves the neighbourhood of its
    // two ends — `rounded-full`'s 3.35e7px would show up here.
    expect(Math.max(...samples), "never above the resting radius").toBeLessThanOrEqual(rest + 0.5);
    expect(Math.min(...samples), "never collapses to a square").toBeGreaterThan(focused - 3);

    const back = await sampleRadius(page, input, () => input.blur());
    await settleTransitions(page);
    expect(await radius(input), "springs back to the stadium on blur").toBeCloseTo(rest, 0);
    expect(
      inFlight(back, focused, rest).length,
      "and animates on the way back",
    ).toBeGreaterThanOrEqual(3);
  });

  test("the focus ring follows the radius: its outer corner pixel is empty, its edge is painted", async ({
    page,
  }) => {
    await openStory(page, STORY.formControls);
    const input = storyRoot(page).locator("input").first();
    await input.focus();
    await settleTransitions(page);
    const rect = await box(input);
    const style = await input.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        width: s.outlineWidth,
        offset: s.outlineOffset,
        colour: s.outlineColor,
        style: s.outlineStyle,
      };
    });
    expect(style.style, "the field draws an outline when focused").toBe("solid");
    const reach = Number.parseFloat(style.width) + Number.parseFloat(style.offset);
    const ring = parseColor(style.colour).rgb;
    const isRing = (c: readonly number[]) =>
      Math.abs((c[0] ?? 0) - ring[0]) +
        Math.abs((c[1] ?? 0) - ring[1]) +
        Math.abs((c[2] ?? 0) - ring[2]) <
      30;

    // The outline's bounding box corner. A square outline paints it; one
    // that follows a 12px corner (16px once offset) leaves it untouched.
    const corner = await paintedColors(page, {
      x: Math.round(rect.x - reach),
      y: Math.round(rect.y - reach),
      width: 2,
      height: 2,
    });
    expect(
      corner.some(isRing),
      `outer corner should be unpainted, got ${JSON.stringify(corner)}`,
    ).toBe(false);
    // Halfway along the top edge, the ring is there.
    const edge = await paintedColors(page, {
      x: Math.round(rect.x + rect.width / 2),
      y: Math.round(rect.y - reach),
      width: 2,
      height: Math.round(Number.parseFloat(style.width)),
    });
    expect(edge.some(isRing), `top edge should carry the ring, got ${JSON.stringify(edge)}`).toBe(
      true,
    );
  });

  test("Textarea rests at 28px (extra-large) and pulls in to 12px on focus", async ({ page }) => {
    await openStory(page, STORY.formControls);
    const textarea = storyRoot(page).locator("textarea").first();
    await blurAll(page);
    expect(await radius(textarea)).toBeCloseTo(28, 0);
    await textarea.focus();
    await settleTransitions(page);
    expect(await radius(textarea)).toBeCloseTo(12, 0);
  });

  test("comfortable density: the stadium follows the 56px field and focus takes corner-large", async ({
    page,
  }) => {
    await openStory(page, STORY.formControls, { density: "comfortable" });
    const input = storyRoot(page).locator("input").first();
    await blurAll(page);
    const rect = await box(input);
    expect(rect.height).toBeCloseTo(56, 0);
    expect(await radius(input)).toBeCloseTo(28, 0);
    await input.focus();
    await settleTransitions(page);
    expect(await radius(input)).toBeCloseTo(16, 0);
  });

  test("Select's trigger stays rounded while its popup is open, not only while it has focus", async ({
    page,
  }) => {
    await openStory(page, STORY.selectDefault);
    const trigger = storyRoot(page).locator("button.select").first();
    await blurAll(page);
    const rect = await box(trigger);
    expect(await radius(trigger)).toBeCloseTo(rect.height / 2, 0);
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await settleTransitions(page);
    // Focus has moved into the listbox; `aria-expanded` is what holds it.
    const focusIsOnTrigger = await trigger.evaluate((el) => el === document.activeElement);
    expect(focusIsOnTrigger, "premise: focus left the trigger for the listbox").toBe(false);
    expect(await radius(trigger)).toBeCloseTo(12, 0);
  });

  test("DatePicker's trigger is the same stadium", async ({ page }) => {
    await openStory(page, STORY.datePickerSingle);
    const trigger = storyRoot(page).locator("button.input").first();
    await blurAll(page);
    const rect = await box(trigger);
    expect(await radius(trigger)).toBeCloseTo(rect.height / 2, 0);
    await trigger.focus();
    await settleTransitions(page);
    expect(await radius(trigger)).toBeCloseTo(12, 0);
  });

  test("prefers-reduced-motion: the shape changes on focus without travelling", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openStory(page, STORY.formControls);
    const input = storyRoot(page).locator("input").first();
    await blurAll(page);
    const rest = await radius(input);
    const samples = await sampleRadius(page, input, () => input.focus(), 200);
    expect(await radius(input)).toBeCloseTo(12, 0);
    expect(inFlight(samples, rest, 12), "no intermediate frames under reduced motion").toEqual([]);
  });
});
