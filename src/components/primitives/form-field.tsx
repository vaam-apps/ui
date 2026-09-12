import { cloneElement, Fragment, isValidElement, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Label } from "./label";

/**
 * A labelled form control with an optional validation error beneath it.
 *
 * This replaces the console's two most-duplicated class strings after the
 * table-column ones:
 *
 * - `"flex flex-col gap-1.5"` — **80 occurrences**, every one of them
 *   wrapping exactly `<Label htmlFor>` + one control (+ sometimes an
 *   error paragraph).
 * - `"text-caption text-state-danger-fg"` — **35 occurrences**, almost all
 *   of them that error paragraph.
 *
 * The shape was identical at every site, checked before this component was
 * designed rather than assumed:
 *
 * ```tsx
 * <div className="flex flex-col gap-1.5">
 *   <Label htmlFor="record-msisdn">MSISDN</Label>
 *   <Input id="record-msisdn" {...form.register("msisdn")} />
 *   <p className="text-caption text-state-danger-fg">{errors.msisdn.message}</p>
 * </div>
 * ```
 *
 * becomes
 *
 * ```tsx
 * <FormField label="MSISDN" htmlFor="record-msisdn" error={errors.msisdn?.message}>
 *   <Input id="record-msisdn" {...form.register("msisdn")} />
 * </FormField>
 * ```
 *
 * **Why a semantic component and not a generic `<Stack gap="1.5">`.** A
 * layout primitive parameterised by its own CSS is a `<div>` with extra
 * steps — it moves the class from the call site into a prop at the call
 * site, which is not factorisation. `FormField` instead names the *thing*
 * (a labelled control with an error slot), so the spacing, the label
 * treatment and the error treatment are one decision in one place, and a
 * caller cannot get the error styling wrong by writing the `<p>` itself.
 *
 * `htmlFor` is required rather than optional. Several of the 80 sites had
 * a `<Label>` with no `htmlFor` at all, which silently breaks
 * click-to-focus and screen-reader association; making it required turns
 * that into a compile error instead of an accessibility bug nobody
 * notices.
 */
export interface FormFieldProps {
  label: ReactNode;
  /** The `id` of the control this labels. Required — see the module doc. */
  htmlFor: string;
  /** Validation message. `undefined` renders no error element at all. */
  error?: string | undefined;
  /**
   * Help text rendered between the label and the control, e.g. "Three to
   * eleven characters." — `font-italic italic` (see the rendering below),
   * because it is `--font-italic`'s test case, not an exception to it:
   * `theme.css`'s comment on the four voices now reads italic as *a
   * person writing to the operator*, not only commentary on a decision
   * the system already made, and a hint is exactly that — someone
   * explaining a constraint the control itself cannot say out loud.
   *
   * **The line, for the next slot that looks like a candidate:** could
   * this string be a template that only fills in a value the system
   * already has — a count, a ratio, a unit, an id, a label? Then it is
   * an emitted fact, not commentary, and it stays `font-sans` no matter
   * how small or muted it is (`StatTile`'s caption, `InlineEmptyState`'s
   * message). A hint, a `RadioGroupOption.description`, a
   * `ChipOption.description` all fail that test — there is no value
   * behind "Three to eleven characters." or "Needs a reason." for a
   * template to have filled in; a person decided the constraint and
   * wrote the sentence. That is the distinction this component is
   * drawing, not "every 12px muted string."
   */
  hint?: ReactNode;
  /**
   * `"field"` (default) labels a single form control by `htmlFor`.
   *
   * `"group"` is for a `RadioGroup`/`ChipSelect`, where the control is a
   * `role="radiogroup"`/`role="group"` wrapper rather than a labelable
   * element. HTML's `for` only associates with labelable form controls, so
   * pointing it at a `<div>` is invalid *and* dangling — which is exactly
   * what the enum migration shipped: four `<Label for="…">` with no
   * element carrying that id anywhere, found in review.
   *
   * In group mode no `for` is emitted; the label carries
   * [`groupLabelId(htmlFor)`] instead, and the caller wires the group with
   * `aria-labelledby={groupLabelId(htmlFor)}`. Both sides derive the id
   * from the same function so they cannot drift.
   */
  control?: "field" | "group";
  children: ReactNode;
  className?: string | undefined;
}

/** The id a `control="group"` FormField puts on its label, and the value a
 * grouped control must pass as `aria-labelledby`. One function so the two
 * sides cannot disagree. */
export function groupLabelId(htmlFor: string): string {
  return `${htmlFor}-label`;
}

/** Same convention as `groupLabelId`, one function per derived id so the
 * hint/error elements and the `aria-describedby` that points at them
 * cannot drift apart. */
function hintId(htmlFor: string): string {
  return `${htmlFor}-hint`;
}

function errorId(htmlFor: string): string {
  return `${htmlFor}-error`;
}

/**
 * The subset of aria attributes `cloneElement` below writes onto the
 * child control. Not a claim about what that child's real prop type is —
 * `isValidElement<P>` only ever narrows to whatever `P` the caller
 * supplies, the same unchecked pattern `Slot`-style composition always
 * relies on — so it is worth being exact about which controls actually
 * honour it, because the first version of this comment was not and the
 * gap was silent.
 *
 * `Input` and `Textarea` spread `...props` onto a native element, so they
 * take these for free. `Select`, `DatePicker` and `DateRangePicker` each
 * destructure a **closed** prop list and would have dropped them with no
 * type error and no runtime warning — verified live, on this package's
 * own `Select` story: the hint rendered with an id and the trigger's
 * `aria-describedby` was `null`. They now declare both props explicitly
 * and forward them to the element that can carry them (for `Select`, down
 * a context to `SelectTrigger`'s button, which is a grandchild).
 *
 * A control from outside this library will only honour these if it
 * forwards unknown props to a DOM node. There is no way to check that
 * here, which is the cost of the `isValidElement<P>` cast.
 */
interface ControlAriaProps {
  "aria-describedby"?: string | undefined;
  "aria-invalid"?: boolean | undefined;
}

/** Space-joins the ids that exist, dropping the rest, or returns
 * `undefined` when none do — `undefined` rather than `""` so a
 * `cloneElement` call can pass this straight through without adding an
 * empty `aria-describedby=""` to a control that had none before. */
function joinIds(ids: ReadonlyArray<string | undefined>): string | undefined {
  const present = ids.filter((id): id is string => id !== undefined && id.length > 0);
  return present.length > 0 ? present.join(" ") : undefined;
}

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
  control = "field",
}: FormFieldProps) {
  const hasHint = hint !== undefined;
  const hasError = error !== undefined;

  // Wiring the control up to the hint/error text is only meaningful, and
  // only safe, for a single labelable element under `control="field"`:
  //
  // - Under `control="group"` the caller already wires `aria-labelledby`
  //   themselves (see the module doc on `control`) — a `RadioGroup` or
  //   `ChipSelect` there is not "the" control in the `htmlFor` sense, and
  //   this must not touch that path.
  // - `isValidElement` rejects text, `null`, and an array of children.
  //   It does **not** reject a fragment: `isValidElement(<></>)` is
  //   `true`, `cloneElement` happily returns a fragment carrying aria
  //   props, and React drops them without a warning — so
  //   `<FormField error><><Input /><Adornment /></></FormField>` rendered
  //   an error `<p>` that nothing pointed at, while this comment assured
  //   the reader it was covered. The explicit `Fragment` check is what
  //   makes the sentence true.
  //   Falling through to plain `children` in any of those cases is a
  //   deliberate degrade to the previous behaviour rather than a throw.
  const control_ =
    control === "field" && isValidElement<ControlAriaProps>(children) && children.type !== Fragment
      ? cloneElement(children, {
          "aria-describedby": joinIds([
            children.props["aria-describedby"],
            hasHint ? hintId(htmlFor) : undefined,
            hasError ? errorId(htmlFor) : undefined,
          ]),
          ...(hasError ? { "aria-invalid": true } : {}),
        })
      : children;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {control === "group" ? (
        // Not a <Label>: with no `for` it would associate with nothing, and
        // a label wrapping no control is worse than a plain element with an
        // id the group points back at.
        <span id={groupLabelId(htmlFor)} className="font-medium text-body text-foreground">
          {label}
        </span>
      ) : (
        <Label htmlFor={htmlFor}>{label}</Label>
      )}
      {hasHint && (
        // `font-italic italic tracking-normal`: see the `hint` prop doc
        // above for why this is `--font-italic`'s test case rather than
        // an exception. `tracking-normal` for the same reason
        // `card.tsx`'s `CardHeader` and `StateTimeline`'s
        // `AnnotationNode` carry it — the global `html { letter-spacing:
        // -0.011em }` is tuned for the sans body face, and at 12px this
        // is the smallest serif slot in the system, where that
        // sans-tuned negative tracking crowds the letterforms most.
        <p
          id={hintId(htmlFor)}
          className="font-italic text-caption text-muted-foreground italic tracking-normal"
        >
          {hint}
        </p>
      )}
      {control_}
      {hasError && <FieldError id={errorId(htmlFor)}>{error}</FieldError>}
    </div>
  );
}

/**
 * A validation message.
 *
 * Exported separately because a handful of the 35 sites are not inside a
 * `FormField` — a form-level error above the submit button, or an error
 * attached to a control group rather than one input. Those should still
 * use the same treatment rather than re-inlining the class.
 *
 * `role="alert"` so the message is announced *when it appears* — but that
 * is exactly the case `FormField` does not hit for a pre-existing or
 * server-rendered error, since `role="alert"` only fires on insertion,
 * not on a field the reader tabs back into later. `id` is what makes that
 * case work at all: `FormField` passes `errorId(htmlFor)` and wires the
 * control's `aria-describedby` to it, so the control's own accessible
 * description carries the message regardless of when it was announced.
 * `id` stays optional — undefined here is exactly what every standalone
 * call site (the 35 sites above) already gets, unchanged.
 */
export function FieldError({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string | undefined;
  id?: string | undefined;
}) {
  return (
    <p id={id} role="alert" className={cn("text-caption text-state-danger-fg", className)}>
      {children}
    </p>
  );
}
