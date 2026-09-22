"use client";

import {
  Description,
  Field,
  RadioGroup as HeadlessRadioGroup,
  Label,
  Radio,
} from "@headlessui/react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/**
 * A single-choice control over a small, fixed vocabulary.
 *
 * # Why this exists rather than reaching for `Select`
 *
 * Two reasons, and the second is a correctness one.
 *
 * The first is the one that prompted it: for a handful of options, a
 * `Select` makes the reader click once to discover what the choices even
 * are, and again to pick. A radio group shows the whole vocabulary and
 * costs one click. `SenderIdRegistrationStatus` has four values and lives
 * in a review drawer where seeing the other three *is* the decision.
 *
 * The second: this cannot hit the bug that made `Select` unusable inside a
 * drawer for its entire existence (#315). Headless UI's `Listbox` portals
 * its options to a top-level sibling of `<body>`, which lands outside
 * vaul's Radix focus trap and stalls the enter transition —
 * `opacity: 0`, `pointer-events: none`, measured live. `RadioGroup`
 * renders inline with no portal and no transition, so there is no
 * equivalent failure available to it. For a small vocabulary inside a
 * drawer, that makes radio the *safer* control, not merely the friendlier
 * one.
 *
 * Deliberately not built on `Select`'s CVA table: there are no visual
 * variants to parameterise, and every option renders identically apart
 * from its checked state.
 *
 * # The checked state used to be invisible
 *
 * Measured on a real render, not inferred — the checked option came back
 * `border-color: rgba(0,0,0,0)` and `background-color: rgba(0,0,0,0)`.
 * It was styled `data-checked:border-state-success-border
 * data-checked:bg-state-success-bg`, and both of those tokens are
 * declared `transparent` in `theme.css`, on purpose: `success` and
 * `neutral` are the two *quiet* status hues, which carry no fill and no
 * border by design so a delivered/OK pill is a glyph and a word rather
 * than a green box. Borrowed for a selection control that meant the
 * chosen option lost its outline and its fill entirely and read as
 * *less* present than the ones nobody had picked — the exact inverse of
 * what it was supposed to say. The focus ring
 * (`data-focus:ring-state-success-border`) was transparent for the same
 * reason, so keyboard focus on this control was invisible too.
 *
 * It is fixed by not using a status hue at all. Status hues answer "what
 * did the system decide"; this control answers "what did *you* pick",
 * and those are different vocabularies — mixing them is what §1.3's
 * "one accent, never a hue" rule exists to prevent. Selection is spelled
 * the way every other checked control in this library spells it: the
 * achromatic `primary` fill in a real radio glyph, on a `surface-3` row
 * with a `edge-strong` border. That also makes it legible with no colour
 * at all, which a tint alone never was.
 *
 * **M3 Expressive shape audit: two declines, not one.** The glyph
 * (`rounded-full`, below) is already at the top of the register in both
 * states — nothing to morph into, same as `Switch`'s thumb and track.
 * The option row itself (`rounded-sm`) *could* morph on `data-checked`,
 * but doesn't: unlike `NavLink`'s active indicator, this row's shape
 * carries no reference-lock decision to preserve, so the reason to
 * decline is different — a wrapped `flex-wrap` group of these sits side
 * by side, and letting only the checked one change shape would read as a
 * layout glitch in the row it shares a baseline with, not as a selection
 * signal. The existing `border-edge` → `border-edge-strong` and
 * `bg-surface-2` → `bg-surface-3` pair already carries that signal
 * redundantly (fill *and* border), which is the same "shape, fill,
 * colour" redundancy standard the radio glyph's own comment above
 * applies — it just doesn't need a fourth channel on top.
 */
export interface RadioGroupOption<T extends string> {
  value: T;
  label: ReactNode;
  /**
   * Optional one-line explanation rendered under the label, e.g. "Match
   * the OS setting." Rendered `font-italic italic` — see `FormField`'s
   * `hint` prop doc for the line: this is a person writing a sentence,
   * not a template filling in a value the system already has, so it
   * fails the "could this be an emitted fact" test the same way that
   * hint does.
   */
  description?: ReactNode;
}

export interface RadioGroupProps<T extends string> {
  value: T | undefined;
  onValueChange: (value: T) => void;
  options: readonly RadioGroupOption<T>[];
  /** Accessible name. Pair with `FormField`'s label via `aria-labelledby`
   * where one exists; supplied directly when the group stands alone. */
  "aria-label"?: string | undefined;
  "aria-labelledby"?: string | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
}

export function RadioGroup<T extends string>({
  value,
  onValueChange,
  options,
  disabled,
  className,
  ...aria
}: RadioGroupProps<T>) {
  return (
    <HeadlessRadioGroup
      value={value ?? null}
      onChange={(next: T | null) => {
        if (next !== null) onValueChange(next);
      }}
      disabled={disabled ?? false}
      className={cn("flex flex-wrap gap-2", className)}
      {...aria}
    >
      {options.map((option) => (
        // `Field` per option, and it is the only thing that makes the
        // name correct.
        //
        // Both the label and the description render *inside* the
        // `role="radio"` element, so content-based naming concatenates
        // them: measured on the shipped fixture, the option was named
        // "ApproveThe provider accepted it.", and a screen-reader user
        // heard the whole description again on every arrow press through
        // the group. axe reports nothing — the radio has a role and a
        // non-empty name, it is just the wrong text, and there is no rule
        // for "this name is longer than it should be".
        //
        // Two obvious fixes do not work, both checked directly rather
        // than assumed. Passing `aria-labelledby`/`aria-describedby` to
        // `Radio` does nothing: Headless UI owns those attributes and
        // drops what you hand it, the same way `ListboxButton` does with
        // `aria-describedby` (see `select.tsx`). And `Label`/
        // `Description` nested in a bare `Radio` wire nothing either —
        // both attributes came back `null` — because a `Radio` is not a
        // `Field`.
        //
        // With a `Field` ancestor they register through context even
        // though they sit inside the `Radio`, which is what keeps the
        // whole card clickable rather than shrinking the target to the
        // label. `ChipSelect` reached the same arrangement first.
        //
        // `className="contents"`: the wrapper must not become a flex item
        // of its own, or every option would be boxed and the group's
        // `flex-wrap gap-2` would apply to the wrappers instead of the
        // cards.
        <Field key={option.value} className="contents">
          <Radio
            value={option.value}
            className={cn(
              "group flex min-w-0 cursor-pointer items-start gap-2 rounded-sm border border-edge bg-surface-2 px-3 py-2 text-body text-muted-foreground transition-colors",
              "data-checked:border-edge-strong data-checked:bg-surface-3 data-checked:text-foreground",
              "data-focus:outline-none data-focus:ring-1 data-focus:ring-ring",
              "data-disabled:cursor-not-allowed data-disabled:opacity-50",
            )}
          >
            {/* A real radio glyph, not just a tinted box. The same three
              redundant channels the status system insists on (shape,
              fill, colour) apply to a control whose entire job is to say
              which one is chosen: a reader looking at a greyscale
              screenshot, or anyone who does not perceive the surface-2 →
              surface-3 step, can still see the filled dot. */}
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-edge-strong bg-surface-2 transition-colors",
                "group-data-checked:border-primary group-data-checked:bg-primary",
              )}
            >
              <span className="size-1.5 rounded-full bg-primary-content opacity-0 transition-opacity group-data-checked:opacity-100" />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <Label className="truncate font-medium">{option.label}</Label>
              {option.description !== undefined && (
                // Two lines, then an ellipsis. Options sit side by side in a
                // wrap container and stretch to the tallest one, so an
                // unclamped three-line description silently pads every
                // sibling — measured at 112px against 94px for the pair in
                // this component's own story before the clamp.
                //
                // `font-italic italic tracking-normal`: see the
                // `RadioGroupOption.description` doc above. `tracking-normal`
                // for the same reason as `StateTimeline`'s `AnnotationNode`
                // and `FormField`'s hint — the global sans-tuned negative
                // letter-spacing crowds a 12px serif more than a 12px sans.
                <Description className="line-clamp-2 font-italic text-caption text-subtle-foreground italic tracking-normal">
                  {option.description}
                </Description>
              )}
            </span>
          </Radio>
        </Field>
      ))}
    </HeadlessRadioGroup>
  );
}
