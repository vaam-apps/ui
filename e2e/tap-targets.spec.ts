import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  box,
  type Density,
  hitAt,
  hitAtVisibleCentre,
  openStory,
  overlapArea,
  settleTransitions,
  storyRoot,
  tapRegions,
} from "./helpers";
import { STORY } from "./story-ids";

/**
 * Whose pixel is it — the gate D11's first revision did not have.
 *
 * `geometry.spec.ts`'s D11 block asks whether each icon-only control's tap
 * target reaches 48px. Every assertion in it passed while `MaskedValue`'s
 * reveal toggle was unreachable by pointer, because a target's *size* says
 * nothing about whose it is: `CopyButton`'s equally correct 48px sat over
 * 16 of the toggle's 20 visible pixels and won hit-testing by DOM order, so
 * a real click at the eye glyph left the value masked and put the secret on
 * the clipboard. Three questions answer that class of defect, and none of
 * them is about size:
 *
 * 1. **Ownership** — `document.elementFromPoint` at a control's own visible
 *    centre resolves to that control. The pixel a reader aims at belongs to
 *    the thing drawn there.
 * 2. **Exclusivity** — no two tap regions claim the same pixels. WCAG 2.2
 *    SC 2.5.8's own Spacing exception is written this way ("the circles do
 *    not intersect another target"), and M3's `minimumInteractiveComponent
 *    Size()` reserves layout space rather than painting an overlay for
 *    exactly this reason (`theme.css`'s `.tap-target` header has both
 *    citations). Containment is exempt and only containment: a trailing
 *    affordance layered *inside* a larger container control is a real
 *    pattern, one that escapes the control it is layered over is the bug.
 * 3. **Containment** — no tap region reaches past the viewport. An
 *    out-of-flow region that did grew `document.scrollWidth` by 14px on
 *    three stories, which is a horizontal scrollbar nobody could see the
 *    cause of.
 *
 * Both densities, every time. The defect this file exists for only ever
 * appeared at comfortable, and it reached consumers who never opted into
 * comfortable because `DetailDrawerContent` sets `--density: 1`
 * unconditionally on a phone-width sheet — so "compact is what our
 * consumers render" is not a reason to test one register.
 */

const DENSITIES: readonly Density[] = ["compact", "comfortable"] as const;

/**
 * `elementFromPoint` at `target`'s visible centre, polled until it
 * settles, asserted against the control's accessible name.
 *
 * Polled rather than read once, and the reason is a real flake rather
 * than caution: an overlay that is still animating in has not finished
 * moving, so a box read on one frame and a hit-test run on the next
 * disagree and `elementFromPoint` comes back with the scrim or with
 * `null`. Measured at 1 red in 10 full-suite runs on the drawer's close
 * button before this — a gate reporting on the animation rather than on
 * the geometry. `settleTransitions` is not enough on its own: it
 * inspects `document.getAnimations()` at one instant, so a transition
 * that has not *started* yet reads as already settled.
 *
 * It does not weaken the assertion. A control that never owns its own
 * centre still fails, at the poll timeout — confirmed by re-running this
 * file's own mutation checks against the polled version.
 */
async function expectOwnsItsCentre(
  page: Page,
  target: Locator,
  expected: string,
  label: string,
): Promise<void> {
  await expect
    .poll(async () => (await hitAtVisibleCentre(page, target)).control, { message: label })
    .toBe(expected);
}

/**
 * The same, for a bare viewport point — and for the `null` case, "no
 * control claims this pixel", which `Calendar`'s caption needs.
 *
 * The `null` case has to distinguish "an element is there and no control
 * owns it" from "nothing is there at all", and an earlier revision did
 * not: `hitAt` maps `elementFromPoint === null` straight to
 * `control: null`, and per spec `elementFromPoint` returns `null` for any
 * point **outside the viewport** — so moving the caption's probe point to
 * `{ x: -500, y: -500 }` made the assertion pass. Vacuously satisfiable,
 * on the one assertion in this file whose whole job is to be hard to
 * satisfy. `HitResult.element` already told the two apart (`"<nothing>"`
 * versus a real tag) and nothing asserted it; both halves now run through
 * one string, so they are in the same expectation and the failure message
 * says which of the two went wrong.
 */
async function expectOwnerAt(
  page: Page,
  point: { x: number; y: number },
  expected: string | null,
  label: string,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const hit = await hitAt(page, point.x, point.y);
        if (hit.element === "<nothing>") return "<no element at this point>";
        return hit.control ?? "<an element, owned by no control>";
      },
      { message: label },
    )
    .toBe(expected ?? "<an element, owned by no control>");
}

/**
 * Every pair of tap regions that claim the same pixels, as
 * `"<a> ∩ <b> = <n>px²"`, sorted so the list is comparable across runs.
 *
 * **The area is part of the string on purpose.** An earlier revision
 * compared pair *identity* only, stripping the area before the
 * assertion — so tightening `MaskedValue`'s row from `gap-1.5` to
 * `gap-0.5`, which triples the existing compact overlap from 40px² to
 * 120px², changed nothing the gate could see and that mutation passed. A
 * gate on "which pairs collide" and not "by how much" cannot tell a
 * pre-existing 2px overlap from a 6px one, which is the difference
 * between a recorded fact and a regression.
 *
 * Rounded to whole px² rather than carried at full precision: the
 * overlap of two boxes is a function of their *relative* positions,
 * which margins and gaps set in whole pixels, so the number is stable
 * even though the absolute x of a row shifts with the webfont — while a
 * 0.1px difference between this laptop and a CI runner must not turn
 * into a red. The 0.5px² floor below is the same sub-pixel tolerance
 * every size assertion in this suite already carries.
 */
async function targetCollisions(page: Page): Promise<string[]> {
  const regions = await tapRegions(page);
  const found: string[] = [];
  for (let i = 0; i < regions.length; i += 1) {
    for (let j = i + 1; j < regions.length; j += 1) {
      const a = regions[i];
      const b = regions[j];
      if (a === undefined || b === undefined) continue;
      const area = overlapArea(a.region, b.region);
      if (area > 0.5) {
        found.push(`${a.name || a.element} ∩ ${b.name || b.element} = ${Math.round(area)}px²`);
      }
    }
  }
  return found.sort();
}

/** Every tap region that reaches outside the viewport, which is the same
 * defect as a horizontal scrollbar and names its own culprit. */
async function targetsOutsideViewport(page: Page): Promise<string[]> {
  const width = await page.evaluate(() => document.documentElement.clientWidth);
  return (await tapRegions(page))
    .filter((r) => r.region.x < -0.5 || r.region.x + r.region.width > width + 0.5)
    .map(
      (r) =>
        `${r.name || r.element} spans ${r.region.x.toFixed(1)}…${(r.region.x + r.region.width).toFixed(1)} of ${width}`,
    )
    .sort();
}

test.describe("MaskedValue — the reveal toggle beside its CopyButton", () => {
  for (const density of DENSITIES) {
    test(`both controls own their own glyph at ${density}`, async ({ page }) => {
      await openStory(page, STORY.maskedValueDefault, { density });
      const reveal = storyRoot(page).getByRole("button", { name: /^Reveal / });
      const copy = storyRoot(page).getByRole("button", { name: /^Copy / });

      // The assertion that was missing. At comfortable on `main` this
      // read "Copy signing secret" for both.
      await expectOwnsItsCentre(page, reveal, "Reveal signing secret", "the reveal toggle");
      await expectOwnsItsCentre(page, copy, "Copy signing secret", "the copy button");

      // And the click it stands in for, end to end: the toggle flips
      // `aria-pressed` rather than the sibling copying a secret.
      await page.mouse.click((await box(reveal)).x + 10, (await box(reveal)).y + 10);
      await expect(storyRoot(page).getByRole("button", { name: /^Hide / })).toBeVisible();
    });
  }

  test("the row's own pitch grows with the density, which is what makes the targets disjoint", async ({
    page,
  }) => {
    await openStory(page, STORY.maskedValueDefault, { density: "compact" });
    const compact = await tapRegions(page);
    await openStory(page, STORY.maskedValueDefault, { density: "comfortable" });
    const comfortable = await tapRegions(page);

    const pitch = (regions: Awaited<ReturnType<typeof tapRegions>>): number => {
      const reveal = regions.find((r) => r.name.startsWith("Reveal"));
      const copy = regions.find((r) => r.name.startsWith("Copy"));
      if (reveal === undefined || copy === undefined) throw new Error("both controls expected");
      return copy.box.x - reveal.box.x;
    };

    // 12px of margin box plus 6px of `gap-1.5`, unchanged.
    expect(pitch(compact), "compact pitch").toBeCloseTo(18, 0);
    // 48px of reserved margin box plus the same 6px gap. Two 48px targets
    // cannot be closer than 48px apart and still be two targets; this is
    // the number the fix is actually about.
    expect(pitch(comfortable), "comfortable pitch").toBeCloseTo(54, 0);
  });
});

test.describe("DatePicker — a Clear button layered over its own field", () => {
  for (const density of DENSITIES) {
    test(`Clear and the trigger each own their own region at ${density}`, async ({ page }) => {
      await openStory(page, STORY.datePickerSingle, { density });
      const trigger = storyRoot(page).getByRole("button", { expanded: false });
      const clear = storyRoot(page).getByRole("button", { name: /^Clear / });

      await expectOwnsItsCentre(page, clear, "Clear the date", "the Clear button");
      await expect
        .poll(async () => (await hitAtVisibleCentre(page, trigger)).control, {
          message: "the field itself",
        })
        .toContain("2026-09-11");

      const regions = await tapRegions(page);
      const clearRegion = regions.find((r) => r.name.startsWith("Clear"));
      const triggerRegion = regions.find((r) => r.name.includes("2026-09-11"));
      if (clearRegion === undefined || triggerRegion === undefined) {
        throw new Error("both the trigger and its Clear button are expected to be rendered");
      }
      // Layered *inside*, never past the field's own edge. On `main` at
      // comfortable this region ran to 281 against a field ending at 272,
      // so the rightmost 39px of the field cleared the date instead of
      // opening the calendar.
      expect(
        clearRegion.region.x + clearRegion.region.width,
        "Clear's tap region may not reach past the field's right edge",
      ).toBeLessThanOrEqual(triggerRegion.region.x + triggerRegion.region.width + 0.5);
      expect(clearRegion.region.x).toBeGreaterThanOrEqual(triggerRegion.region.x - 0.5);
      expect(clearRegion.region.y).toBeGreaterThanOrEqual(triggerRegion.region.y - 0.5);
      expect(clearRegion.region.y + clearRegion.region.height).toBeLessThanOrEqual(
        triggerRegion.region.y + triggerRegion.region.height + 0.5,
      );
    });
  }

  test("the trigger's own label is clear of Clear's target at both densities", async ({ page }) => {
    for (const density of DENSITIES) {
      await openStory(page, STORY.datePickerSingle, { density });
      const trigger = await box(storyRoot(page).getByRole("button", { expanded: false }));
      const label = storyRoot(page).locator("span.truncate").first();
      const labelBox = await box(label);
      // The `pr` gutter's whole job: the field's own text never sits under
      // the trailing affordance's target. This is the reservation an
      // anchored control cannot make for itself.
      const clearRegion = (await tapRegions(page)).find((r) => r.name.startsWith("Clear"));
      if (clearRegion === undefined) throw new Error("Clear expected");
      expect(
        labelBox.x + labelBox.width,
        `${density}: the trigger's label must end before Clear's target begins`,
      ).toBeLessThanOrEqual(clearRegion.region.x + 0.5);
      await expect
        .poll(
          async () => (await hitAt(page, labelBox.x + 4, trigger.y + trigger.height / 2)).control,
          { message: `${density}: the label's own pixels belong to the trigger` },
        )
        .toContain("2026-09-11");
    }
  });
});

test.describe("Calendar — prev/next nav beside a caption that is not a target", () => {
  for (const density of DENSITIES) {
    test(`nav owns its glyph and the caption owns its own at ${density}`, async ({ page }) => {
      // Inside `DatePicker`'s docked panel, which is how a consumer
      // renders it, rather than `BareCalendar`: the panel is the edge a
      // cover must not cross. The arrows sit together at the end of the
      // month row, M3's layout, clear of the caption at its start.
      await openStory(page, STORY.datePickerSingle, { density });
      await storyRoot(page).getByRole("button", { expanded: false }).click();
      await settleTransitions(page);

      const prev = page.getByRole("button", { name: "Go to the Previous Month" });
      const next = page.getByRole("button", { name: "Go to the Next Month" });
      await expectOwnsItsCentre(page, prev, "Go to the Previous Month", "the prev nav button");
      await expectOwnsItsCentre(page, next, "Go to the Next Month", "the next nav button");

      // The caption has no click action, and a nav button's target
      // reaching toward it must not give it one. `control: null` is the
      // assertion — "no control claims this pixel" — rather than a
      // selector for the caption itself.
      const caption = page.getByText(/^September 2026$/).first();
      const captionBox = await box(caption);
      await expectOwnerAt(
        page,
        { x: captionBox.x + captionBox.width / 2, y: captionBox.y + captionBox.height / 2 },
        null,
        `${density}: the month caption is not a target`,
      );
      await expectOwnerAt(
        page,
        { x: captionBox.x + 2, y: captionBox.y + captionBox.height / 2 },
        null,
        `${density}: not at its left edge either`,
      );

      // Inside the panel. The arrows are in-flow targets in a `nav` that
      // is itself absolutely placed 12px from the panel's end, so their
      // covers' containment comes from that offset, not from flow — and a
      // changed offset fails here.
      const panel = await box(page.locator("[data-date-picker]"));
      const navRegions = await tapRegions(page);
      for (const name of ["Go to the Previous Month", "Go to the Next Month"] as const) {
        const region = navRegions.find((r) => r.name === name);
        if (region === undefined) throw new Error(`${name} is expected to be rendered`);
        expect(
          region.region.x,
          `${density}: ${name} starts inside the panel`,
        ).toBeGreaterThanOrEqual(panel.x - 0.5);
        expect(
          region.region.x + region.region.width,
          `${density}: ${name} ends inside the panel`,
        ).toBeLessThanOrEqual(panel.x + panel.width + 0.5);
      }
    });
  }
});

test.describe("Checkbox and Switch — a row of them", () => {
  for (const density of DENSITIES) {
    test(`every control in the row owns its own box at ${density}`, async ({ page }) => {
      await openStory(page, STORY.checkboxAndSwitch, { density });
      for (const name of ["Checked", "Unchecked", "Indeterminate", "Disabled"]) {
        const target = storyRoot(page).getByRole("checkbox", { name, exact: true });
        await expectOwnsItsCentre(page, target, name, `${density}: the ${name} checkbox`);
      }
      for (const name of ["Toggle", "Off"]) {
        const target = storyRoot(page).getByRole("switch", { name, exact: true });
        await expectOwnsItsCentre(page, target, name, `${density}: the ${name} switch`);
      }
    });
  }
});

test.describe("Close buttons — dialog, drawer, toast", () => {
  for (const density of DENSITIES) {
    test(`DialogClose owns its glyph and stays inside its panel at ${density}`, async ({
      page,
    }) => {
      await openStory(page, STORY.dialogScrollingBody, { density });
      await storyRoot(page).getByRole("button", { name: "Open tall dialog" }).click();
      await settleTransitions(page);
      const close = page.locator('button[aria-label="Close"]');
      await expectOwnsItsCentre(page, close, "Close", "the dialog's close button");
      expect(await targetsOutsideViewport(page)).toEqual([]);
    });

    test(`the drawer's close button owns its glyph at ${density}`, async ({ page }) => {
      await openStory(page, STORY.drawers, { density });
      await storyRoot(page).getByRole("button", { name: "Quick detail" }).click();
      const close = page.locator('button[aria-label="Close"]');
      await expect(close).toBeVisible();
      await settleTransitions(page);
      await expectOwnsItsCentre(page, close, "Close", "the drawer's close button");
      expect(await targetsOutsideViewport(page)).toEqual([]);
    });

    test(`the toast's dismiss button owns its glyph at ${density}`, async ({ page }) => {
      await openStory(page, STORY.toasts, { density });
      await storyRoot(page).getByRole("button", { name: "Default" }).click();
      const dismiss = page.locator('button[aria-label="Dismiss"]');
      await expect(dismiss).toBeVisible();
      await expectOwnsItsCentre(page, dismiss, "Dismiss", "the toast's dismiss button");
      expect(await targetsOutsideViewport(page)).toEqual([]);
    });
  }
});

/**
 * Exclusivity and containment over **every story that renders one of
 * these controls**, at both densities and both widths.
 *
 * Widened from three stories to twelve, because the claim outran the
 * gate. The revision that introduced this file — and
 * `Docs/Accessibility` with it — said the compact set was pinned at
 * *exactly* one known pair, "so a tenth control arriving with the same
 * problem fails the build", while the assertion ran on
 * `data-maskedvalue--default` alone and `data-maskedvalue--variants` next
 * door already carried two more of the same pair (40.0px² each) that
 * nothing looked at. Either the claim narrows or the gate widens; this is
 * the one that makes the sentence true.
 *
 * `KNOWN_COMPACT_COLLISIONS` is the measured set per story, and the
 * assertion is **equality** rather than "at most" — so a new compact
 * collision fails, and so does *fixing* one, loudly and pointing here,
 * rather than leaving a stale entry nobody rechecks. Comfortable is
 * asserted clean everywhere with no exceptions, because that is the
 * register this pass is about.
 *
 * The three compact entries are all one defect, and it is pre-existing:
 * `MaskedValue` renders a reveal toggle beside a `CopyButton` in a
 * `gap-1.5` row whose -4px resting margins pull the pitch to 18px between
 * two 20px boxes, so the boxes themselves overlap by 2px. That is also a
 * plain SC 2.5.8 failure (two sub-24px targets whose 24px circles
 * intersect). Closing it means changing what compact renders, which is a
 * product decision and not this file's to make.
 */
const KNOWN_COMPACT_COLLISIONS: Readonly<Record<string, readonly string[]>> = {
  [STORY.maskedValueDefault]: ["Reveal signing secret ∩ Copy signing secret = 40px²"],
  [STORY.maskedValueVariants]: [
    "Reveal TOTP secret ∩ Copy TOTP secret = 40px²",
    "Reveal signing secret ∩ Copy signing secret = 40px²",
  ],
  // A `CopyButton` as the last thing in a row, flush to its container's
  // right edge — the arrangement whose unreserved cover pushed
  // `document.scrollWidth` past the viewport on three of these.
  [STORY.idsConstrained]: [],
  [STORY.idsCodeAndCopy]: [],
  [STORY.idsPhones]: [],
  [STORY.idsTableAndFull]: [],
  [STORY.detailVariants]: [],
  [STORY.detailMixedVariants]: [],
  [STORY.detailCardsAndBadges]: [],
  [STORY.detailTiles]: [],
  // The two in-flow form controls, whose covers overlapped each other by
  // 8px along a row before the reservation existed.
  [STORY.checkboxAndSwitch]: [],
  // The anchored pair, layered over their own field.
  [STORY.datePickerSingle]: [],
};

test.describe("Exclusivity and containment, across every story that carries these controls", () => {
  for (const [id, knownAtCompact] of Object.entries(KNOWN_COMPACT_COLLISIONS)) {
    for (const width of [375, 1280] as const) {
      for (const density of DENSITIES) {
        test(`${id} at ${width}px / ${density}: nothing escapes, nothing unexpected collides`, async ({
          page,
        }) => {
          await openStory(page, id, { width, height: 760, density });
          expect(await targetsOutsideViewport(page)).toEqual([]);
          expect(
            await targetCollisions(page),
            density === "comfortable"
              ? "the register this pass fixes has to be clean, with no exceptions"
              : "compact is unchanged by ruling, so the gate is `exactly these pairs, at exactly these sizes, and no new ones`",
          ).toEqual(density === "comfortable" ? [] : [...knownAtCompact].sort());
        });
      }
    }
  }
});

/**
 * The mechanism itself, driven directly rather than through a call site.
 *
 * `--tap-room-top/right/bottom/left` are the four knobs
 * `.tap-target-anchored` exposes, and only one of them is load-bearing at
 * any call site in this library today — `DatePicker`'s Clear button
 * clamps `right`, the rest declare a room their cover never reaches. That
 * is how two of the four came to be declared and silently ignored: an
 * earlier revision of the formula derived each side from the *opposite*
 * side's already-clamped value, so `--tap-room-left` and
 * `--tap-room-top` were never read, and every call site still measured
 * correctly because none of them needed the clamp it had asked for.
 *
 * So this block sets each property on a live element and measures the
 * cover, which is the only thing that can tell a working knob from a dead
 * one. `DatePicker`'s Clear button is the host because it is already
 * `.tap-target-anchored` in a story; nothing here depends on its own
 * geometry beyond the 14px box and the 17px per-side reach that implies.
 */
test.describe("the mechanism itself — all four room clamps", () => {
  const COVER = 17; // (48 − 14) / 2, this host's own per-side reach.

  async function coverInsets(
    page: Page,
    overrides: Record<string, string>,
  ): Promise<{
    top: number;
    right: number;
    bottom: number;
    left: number;
    width: number;
    height: number;
  }> {
    return await page.locator('button[aria-label^="Clear "]').evaluate((el, vars) => {
      for (const [name, value] of Object.entries(vars as Record<string, string>)) {
        (el as HTMLElement).style.setProperty(name, value);
      }
      const s = getComputedStyle(el, "::before");
      return {
        top: -Number.parseFloat(s.top),
        right: -Number.parseFloat(s.right),
        bottom: -Number.parseFloat(s.bottom),
        left: -Number.parseFloat(s.left),
        width: Number.parseFloat(s.width),
        height: Number.parseFloat(s.height),
      };
    }, overrides);
  }

  test("unclamped, the cover is symmetric and lands on 48", async ({ page }) => {
    await openStory(page, STORY.datePickerSingle, { density: "comfortable" });
    const insets = await coverInsets(page, {
      "--tap-room-right": "9999px",
      "--tap-room-left": "9999px",
      "--tap-room-top": "9999px",
      "--tap-room-bottom": "9999px",
    });
    expect(insets.left, "left reach").toBeCloseTo(COVER, 0);
    expect(insets.right, "right reach").toBeCloseTo(COVER, 0);
    expect(insets.top, "top reach").toBeCloseTo(COVER, 0);
    expect(insets.bottom, "bottom reach").toBeCloseTo(COVER, 0);
    expect(insets.width, "total width").toBeCloseTo(48, 0);
    expect(insets.height, "total height").toBeCloseTo(48, 0);
  });

  for (const [clamped, opposite] of [
    ["--tap-room-left", "left"],
    ["--tap-room-right", "right"],
    ["--tap-room-top", "top"],
    ["--tap-room-bottom", "bottom"],
  ] as const) {
    test(`${clamped} clamps its own side and the opposite side absorbs the rest`, async ({
      page,
    }) => {
      await openStory(page, STORY.datePickerSingle, { density: "comfortable" });
      const insets = await coverInsets(page, {
        "--tap-room-right": "9999px",
        "--tap-room-left": "9999px",
        "--tap-room-top": "9999px",
        "--tap-room-bottom": "9999px",
        [clamped]: "3px",
      });
      const other = { left: "right", right: "left", top: "bottom", bottom: "top" }[opposite];
      expect(insets[opposite], `${opposite} is clamped to its room`).toBeCloseTo(3, 0);
      expect(
        insets[other as "left" | "right" | "top" | "bottom"],
        `${other} absorbs what ${opposite} gave up, so the target is still 48px`,
      ).toBeCloseTo(2 * COVER - 3, 0);
      // The axis still reaches 48. The clamp moves the target, it does not
      // shrink it — which is the whole reason a clamped side is allowed.
      const axis = opposite === "left" || opposite === "right" ? insets.width : insets.height;
      expect(axis, "the clamped axis still reaches 48px").toBeCloseTo(48, 0);
    });
  }

  /**
   * `--tap-room-*` must not reach the in-flow variant, and this is what
   * enforces it rather than documenting it.
   *
   * These are inherited custom properties declared on a selector both
   * variants once matched, so "anchored only" was a sentence in the docs
   * and nothing else. Measured before the split:
   * `--tap-room-left: 0px` on `MaskedValue`'s reveal toggle moved its
   * cover from 191.64…239.64 to 205.64…253.64 — desynced from its own
   * margin reservation — and produced a 384px² collision with the
   * `CopyButton` beside it. The exact defect class this whole file exists
   * to catch, reachable through a knob the docs said did not apply here.
   */
  test("the in-flow variant ignores --tap-room-*, so a stray one cannot desync its cover", async ({
    page,
  }) => {
    await openStory(page, STORY.maskedValueDefault, { density: "comfortable" });
    const reveal = page.locator('button[aria-label^="Reveal "]');
    const coverOf = async (): Promise<{ left: number; right: number; width: number }> =>
      await reveal.evaluate((el) => {
        const s = getComputedStyle(el, "::before");
        return {
          left: -Number.parseFloat(s.left),
          right: -Number.parseFloat(s.right),
          width: Number.parseFloat(s.width),
        };
      });

    const before = await coverOf();
    expect(before.left, "symmetric to begin with").toBeCloseTo(14, 0);
    expect(before.right).toBeCloseTo(14, 0);

    for (const side of [
      "--tap-room-left",
      "--tap-room-right",
      "--tap-room-top",
      "--tap-room-bottom",
    ]) {
      await reveal.evaluate((el, name) => {
        (el as HTMLElement).style.setProperty(name, "0px");
      }, side);
    }
    const after = await coverOf();
    expect(after.left, "an in-flow cover does not read --tap-room-*").toBeCloseTo(14, 0);
    expect(after.right).toBeCloseTo(14, 0);
    expect(after.width, "and still covers exactly its 48px reservation").toBeCloseTo(48, 0);
    // The consequence, stated as the thing that actually matters.
    expect(await targetCollisions(page)).toEqual([]);
  });

  /**
   * The `@layer components` wrapper on `.tap-target`'s `margin` is
   * load-bearing, and until this test it was completely ungated.
   *
   * Removing only the wrapper — leaving the declaration byte-identical —
   * left all 151 e2e tests and all 945 unit tests green while deleting
   * the escape hatch `theme.css` and `Docs/Theming and tokens` both
   * promise: unlayered, `.tap-target` outranks a consumer's `m-0` and the
   * margin stays at its reserved 14px instead of collapsing to 0. A
   * published opt-out that a one-line edit can silently remove is not an
   * opt-out.
   *
   * Asserted against a real `m-0` utility rather than an injected rule,
   * because that is what a consumer writes — with the premise checked
   * first on a plain element, so "Tailwind no longer emits `.m-0` in this
   * build" reads as its own failure instead of as a precedence one.
   */
  test("a consumer's own margin utility still wins over the reservation", async ({ page }) => {
    await openStory(page, STORY.maskedValueDefault, { density: "comfortable" });

    const premise = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.className = "m-0";
      probe.style.margin = "7px";
      document.body.append(probe);
      // An inline style outranks any stylesheet, so this only reports
      // whether `.m-0` resolves at all once the inline value is dropped.
      probe.style.removeProperty("margin");
      const resolved = getComputedStyle(probe).margin;
      probe.remove();
      return resolved;
    });
    expect(premise, "the premise: `.m-0` is a real utility in this build").toBe("0px");

    const reveal = page.locator('button[aria-label^="Reveal "]');
    const margins = await reveal.evaluate((el) => {
      const reserved = getComputedStyle(el).margin;
      el.classList.add("m-0");
      const overridden = getComputedStyle(el).margin;
      el.classList.remove("m-0");
      return { reserved, overridden };
    });

    expect(margins.reserved, "the reservation itself").toBe("14px");
    expect(
      margins.overridden,
      "`m-0` has to win — the rule is in `@layer components` precisely so it can",
    ).toBe("0px");
  });

  test("clamped on both sides of an axis, the target is honestly smaller than 48", async ({
    page,
  }) => {
    await openStory(page, STORY.datePickerSingle, { density: "comfortable" });
    const insets = await coverInsets(page, {
      "--tap-room-right": "3px",
      "--tap-room-left": "3px",
      "--tap-room-top": "9999px",
      "--tap-room-bottom": "9999px",
    });
    expect(insets.left).toBeCloseTo(3, 0);
    expect(insets.right).toBeCloseTo(3, 0);
    // 14 + 3 + 3. Documented as smaller beats reaching outside the
    // container anyway — `theme.css`'s own header says so, and this is
    // the assertion that keeps it true rather than aspirational.
    expect(insets.width, "no room means no growth, not growth elsewhere").toBeCloseTo(20, 0);
  });
});

/**
 * `DialogHeader`'s gutter — the container reservation, gated the way
 * `DatePicker`'s already was.
 *
 * `.tap-target-anchored` cannot reserve its own 48dp, so whatever sits
 * beside an anchored control has to. Two call sites do that, and only one
 * of them was gated: reverting `date-picker.tsx`'s `pr` to a literal
 * `pr-9` went red with a real message, while reverting `dialog.tsx`'s to
 * `pr-8` left the whole suite green. `geometry.spec.ts`'s `DialogClose`
 * test cannot see it — it measures the button's own cover, which the
 * gutter does not affect.
 *
 * The assertion is on the **title's own layout box**, not on where its
 * glyphs happen to end. `DialogTitle` is a block filling the header's
 * content box, so its right edge *is* the gutter, and text inside it can
 * lay out all the way to that edge on some string — whereas a
 * glyph-extent assertion would pass or fail on where the last word
 * happened to wrap, which is a fact about the fixture rather than about
 * the reservation.
 *
 * Compact is recorded rather than asserted clean: the title's box already
 * runs 4px into the close button's own 24px box there (`pr-8` is 32px and
 * the button's inner edge sits 36px in, because `top-4 right-4` plus
 * `-m-1` puts it at 12…36), which `dialog.tsx`'s own gutter comment
 * describes with slightly optimistic arithmetic. Pre-existing, unchanged
 * by this pass, and named here rather than smoothed over.
 */
const KNOWN_TITLE_OVERLAP_PX: Readonly<Record<Density, number>> = {
  // 847 of title box against a close box starting at 843, measured.
  compact: 4,
  // Flush: 831 against a target starting at 831.
  comfortable: 0.5,
};

test.describe("DialogHeader — the gutter that reserves room for Close's target", () => {
  for (const density of DENSITIES) {
    for (const width of [375, 1280] as const) {
      test(`a long title stops before Close's target at ${density} / ${width}px`, async ({
        page,
      }) => {
        await openStory(page, STORY.dialogWithLongTitle, { density, width, height: 760 });
        await storyRoot(page).getByRole("button", { name: "Open dialog" }).click();
        await settleTransitions(page);

        const title = await box(page.getByRole("heading").first());
        const close = (await tapRegions(page)).find((r) => r.name === "Close");
        if (close === undefined) throw new Error("the dialog's close button is expected");

        expect(
          title.x + title.width,
          `${density} @${width}: the title's layout box must stop before Close's target begins`,
        ).toBeLessThanOrEqual(close.region.x + KNOWN_TITLE_OVERLAP_PX[density]);

        // And the target is still whole and still inside the panel — so the
        // gutter cannot be "satisfied" by shrinking the thing it reserves for.
        await expectOwnsItsCentre(
          page,
          page.locator('button[aria-label="Close"]'),
          "Close",
          `${density} @${width}: Close still owns its own glyph`,
        );
        expect(await targetsOutsideViewport(page)).toEqual([]);
      });
    }
  }
});

/**
 * `openStory`'s contract: **it does not return until the page has
 * stopped changing.**
 *
 * Why this is not tautological, since a reader will otherwise delete it:
 * `tapRegions` reads every target at one instant, so a subtree still in
 * flux yields fewer targets, therefore fewer pairs to intersect,
 * therefore a clean exclusivity verdict for a story that is not clean.
 * That is the one direction this file must never be wrong in, and before
 * the stability wait existed it was wrong quietly — a whole-Storybook
 * geometry sweep built on the old "has any children" signal disagreed
 * with *itself*, one story per run. The wait that fixed it was then
 * ungated for a round: reverting it to the first-commit signal left all
 * 190 tests green.
 *
 * # Why the stimulus is planted rather than borrowed
 *
 * Three real stories were measured to commit more than once —
 * `primitives-select--default` (24 elements at the first commit, 10 once
 * settled), `primitives-overlays--commands-versus-destinations` (7
 * targets against 9) and `primitives-overlays--menu-with-toggles` (7
 * against 8). Every gate built on them was **probabilistic**, and three
 * different shapes were tried before that was accepted: census-wait-
 * census (2 reds in 5 against the reverted wait), per-frame sampling with
 * a mark (4 in 5), and comparing what the wait itself last saw against
 * the settled page (1 to 4 reds in 5). They all fail for one reason: in
 * those stories the two commits usually land inside a single polling
 * interval, so whether the difference is observable at all is a coin
 * flip. A gate that catches its defect four times in five is worse than
 * none, because it looks like one.
 *
 * So the late commit is *constructed*: a real story, plus a control that
 * appears a fixed number of frames after mount — the same phenomenon
 * those three stories exhibit by accident, with the timing under this
 * test's control instead of the scheduler's. With the wait, `openStory`
 * cannot return until that control has been there for six unchanging
 * frames. Without it, `openStory` returns at the first commit, three
 * frames before the control exists, and hands back a page without it.
 * Deterministic in both directions.
 *
 * # What this does *not* claim, and the number is the reason
 *
 * Three frames, not twenty — and the first attempt used twenty and
 * failed on the fixed code, correctly. **No finite stability wait can
 * promise that nothing will change later.** Six quiet frames is a
 * heuristic: a control arriving at frame twenty defeats it by
 * construction, because by then the wait has already concluded and
 * returned. So the stimulus has to land inside the window the wait is
 * still counting, which is what the real phenomenon looks like — a late
 * commit arrives while the page is still coming up, not half a second
 * after it has gone quiet.
 *
 * Three frames is far enough for the mutated wait to miss it (it returns
 * on the first frame the root is non-empty, ~48ms earlier) and near
 * enough that the real wait is still counting. That is the contract this
 * gate asserts, and the limit of it is stated here rather than implied.
 *
 * # One story cannot satisfy the contract at all, and that is recorded
 *
 * `primitives-select--default` is the story the sweep caught, and it is
 * not a subject here for a reason worth writing down rather than hiding
 * behind a subject list that happens to be green. Measured under
 * `--repeat-each=40` (240 runs, six workers): its target census drops to
 * a single control for exactly one frame and comes back — `[5, 1, 5]`
 * across the window — roughly once in 240. Raising `openStory`'s
 * stable-frame requirement from three to six removed that from 120 runs
 * and not from 240, so it is not a wait that is too short; it is a
 * genuine intermittent re-render inside the story, after the transitions
 * it runs have already reported themselves finished. No amount of
 * waiting makes a *single* measurement of that story reproducible.
 *
 * Which is a live caveat for this suite rather than a footnote: it is why
 * no `Select` story appears in the exclusivity gate's own list. A
 * whole-document snapshot of that one would be right about 99.6% of the
 * time, and nothing in this file asserts anything about it.
 */
const LATE_CONTROL_FRAMES = 3;

test.describe("openStory's contract — it waits for the page to stop changing", () => {
  for (const density of DENSITIES) {
    test(`a control that appears ${LATE_CONTROL_FRAMES} frames after mount is there at ${density}`, async ({
      page,
    }) => {
      await page.addInitScript((frames) => {
        const plantWhenMounted = (): void => {
          const root = document.querySelector("#storybook-root");
          if (root === null || root.children.length === 0) {
            requestAnimationFrame(plantWhenMounted);
            return;
          }
          let waited = 0;
          const tick = (): void => {
            waited += 1;
            if (waited < frames) {
              requestAnimationFrame(tick);
              return;
            }
            // A real target by `TARGET_SELECTOR`'s own definition, with a
            // real box, parked out of the way of everything else.
            const late = document.createElement("button");
            late.type = "button";
            late.setAttribute("aria-label", "late arrival");
            late.style.cssText =
              "position:fixed;left:0;bottom:0;width:24px;height:24px;opacity:0.01";
            document.body.append(late);
          };
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(plantWhenMounted);
      }, LATE_CONTROL_FRAMES);

      await openStory(page, STORY.maskedValueDefault, { density });

      const atReturn = await page.evaluate(
        () => (window as unknown as { __signatureAtReturn?: string }).__signatureAtReturn,
      );
      expect(
        atReturn,
        "the premise: openStory's own stability predicate has to have recorded what it saw",
      ).toBeDefined();
      expect(
        atReturn,
        `openStory returned before a control that takes ${LATE_CONTROL_FRAMES} frames to appear was there, so every measurement this suite takes — the target census, and the exclusivity gate built on it — is of a page that is still being built. Saw: ${atReturn}`,
      ).toContain("late arrival");

      // And the measurement the suite actually uses agrees, so this is
      // about `tapRegions` rather than about one instrumentation hook.
      expect((await tapRegions(page)).map((r) => r.name)).toContain("late arrival");
    });
  }
});
