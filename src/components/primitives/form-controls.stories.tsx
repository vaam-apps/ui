import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { Checkbox, CheckboxField } from "./checkbox";
import { ChipSelect } from "./chip-select";
import { FieldError, FormField, groupLabelId } from "./form-field";
import { Input } from "./input";
import { Label } from "./label";
import { RadioGroup } from "./radio-group";
import { Switch, SwitchField } from "./switch";
import { Textarea } from "./textarea";

const meta = {
  title: "Primitives/Form controls",
  component: Checkbox,
  tags: ["autodocs"],
  args: { checked: true, onCheckedChange: () => undefined },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Several rows below deliberately render the same control twice — once
 * live, once `disabled` — so a role+name query legitimately matches both.
 * This picks the live one and **throws** when the count is not exactly
 * one, rather than returning `undefined`: a play function that quietly
 * asserts against nothing is the failure mode these are written to avoid.
 *
 * Headless UI spells "disabled" two ways depending on the element it
 * rendered — a real `disabled` attribute on the `<button>` a `Switch`
 * produces, `aria-disabled` on the `<span role="checkbox">` a `Checkbox`
 * produces — so both are checked.
 */
function theLiveOne(controls: readonly HTMLElement[]): HTMLElement {
  const live = controls.filter(
    (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-disabled") !== "true",
  );
  const [only] = live;
  if (live.length !== 1 || only === undefined) {
    throw new Error(`expected exactly one enabled control, found ${live.length}`);
  }
  return only;
}

/** The `<label for="…">` among `candidates`, or a throw. Same reasoning as
 * `theLiveOne`: two fields in `FieldsAndErrors` share the label text
 * "Sender ID", and picking the wrong one silently is how an assertion
 * ends up proving nothing. */
function labelFor(candidates: readonly HTMLElement[], htmlFor: string): HTMLElement {
  const found = candidates.find((el) => el.getAttribute("for") === htmlFor);
  if (found === undefined) {
    throw new Error(`no <label for="${htmlFor}"> among ${candidates.length} candidates`);
  }
  return found;
}

/** The element with this `id` among `candidates`, or a throw. */
function withId(candidates: readonly HTMLElement[], id: string): HTMLElement {
  const found = candidates.find((el) => el.id === id);
  if (found === undefined) {
    throw new Error(`no element with id "${id}" among ${candidates.length} candidates`);
  }
  return found;
}

/**
 * A checkbox is for a value a Save button will commit; a switch promises
 * the change already happened. Pairing a switch with a Save button tells
 * the operator two contradictory things and leaves them unsure whether
 * the toggle landed.
 *
 * The play function below replays the part of that claim a screenshot
 * cannot show: the four live controls here share one `useState`, so
 * toggling any of them by mouse *or* by Space moves all four, and
 * `aria-checked` follows every time. It also pins the two states that only
 * exist as an ARIA value — `mixed` for the indeterminate box, and a
 * disabled control that does not move when clicked.
 */
export const CheckboxAndSwitch: Story = {
  render: function Render() {
    const [on, setOn] = useState(true);
    return (
      <div className="flex max-w-md flex-col gap-5">
        <div className="flex flex-wrap items-center gap-6">
          <Checkbox checked={on} onCheckedChange={setOn} aria-label="Checked" />
          <Checkbox checked={false} onCheckedChange={() => undefined} aria-label="Unchecked" />
          <Checkbox
            checked={false}
            indeterminate
            onCheckedChange={() => undefined}
            aria-label="Indeterminate"
          />
          <Checkbox checked disabled onCheckedChange={() => undefined} aria-label="Disabled" />
          <Switch checked={on} onCheckedChange={setOn} aria-label="Toggle" />
          <Switch checked={false} disabled onCheckedChange={() => undefined} aria-label="Off" />
        </div>
        <CheckboxField
          checked={on}
          onCheckedChange={setOn}
          label="Mask the recipient in webhook payloads"
          description="The masked form is baked in when the attempt row is written, not at delivery."
        />
        {/* Disabled: both the label and the description must dim and lose
            their pointer cursor along with the control. Before this was
            fixed, `disabled` landed only on the inner `Checkbox` —
            Headless UI's `Label` reads disabled state from `Field`'s own
            context only, never from a sibling control, so the label sat
            at full brightness with a live `cursor-pointer` beside a
            50%-dimmed box. */}
        <CheckboxField
          checked
          disabled
          onCheckedChange={() => undefined}
          label="Mask the recipient in webhook payloads"
          description="The masked form is baked in when the attempt row is written, not at delivery."
        />
        <SwitchField
          checked={on}
          onCheckedChange={setOn}
          label="Live updates"
          description="Poll for new rows while this screen is open."
        />
        {/* Same fix, same component shape — see the CheckboxField note
            above. */}
        <SwitchField
          checked={false}
          disabled
          onCheckedChange={() => undefined}
          label="Live updates"
          description="Poll for new rows while this screen is open."
        />
      </div>
    );
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const box = canvas.getByRole("checkbox", { name: "Checked" });
    const toggle = canvas.getByRole("switch", { name: "Toggle" });
    const boxField = theLiveOne(
      canvas.getAllByRole("checkbox", { name: "Mask the recipient in webhook payloads" }),
    );
    const switchField = theLiveOne(canvas.getAllByRole("switch", { name: "Live updates" }));

    await step("All four live controls start checked — they share one state", async () => {
      for (const control of [box, toggle, boxField, switchField]) {
        await expect(control).toHaveAttribute("aria-checked", "true");
      }
    });

    await step("Clicking the checkbox unchecks it", async () => {
      await userEvent.click(box);
      await expect(box).toHaveAttribute("aria-checked", "false");
    });

    await step("…and every control bound to the same state follows", async () => {
      for (const control of [toggle, boxField, switchField]) {
        await expect(control).toHaveAttribute("aria-checked", "false");
      }
    });

    await step("Space checks it again from the keyboard", async () => {
      box.focus();
      await expect(box).toHaveFocus();
      await userEvent.keyboard(" ");
      await expect(box).toHaveAttribute("aria-checked", "true");
    });

    await step("Space operates the switch too, and lands back where it started", async () => {
      switchField.focus();
      await expect(switchField).toHaveFocus();
      await userEvent.keyboard(" ");
      await expect(switchField).toHaveAttribute("aria-checked", "false");
      await userEvent.keyboard(" ");
      await expect(switchField).toHaveAttribute("aria-checked", "true");
    });

    await step("The indeterminate box reports `mixed`, not checked", async () => {
      await expect(canvas.getByRole("checkbox", { name: "Indeterminate" })).toHaveAttribute(
        "aria-checked",
        "mixed",
      );
    });

    await step("A disabled switch does not move when clicked", async () => {
      const off = canvas.getByRole("switch", { name: "Off" });
      await expect(off).toBeDisabled();
      await userEvent.click(off);
      await expect(off).toHaveAttribute("aria-checked", "false");
    });
  },
};

/**
 * `FormField` names the thing — a labelled control with an error slot —
 * rather than being a `<div>` with a gap prop. `htmlFor` is required, so
 * a label with no control to point at is a compile error rather than an
 * accessibility bug nobody notices.
 *
 * The error line is `text-caption` (12px). If it renders at the browser
 * default, `cn()` has lost the font size to the colour beside it again —
 * a real bug this package shipped for months.
 *
 * The "Sender ID" field with both a hint and an error is also the
 * `aria-describedby`/`aria-invalid` story: `FormField` clones the
 * `Input` it wraps to add both, so a screen-reader user tabbing into
 * `#sb-sender-bad` hears the label, then "Three to eleven characters.
 * Must be at most 11 characters.", and `aria-invalid` triggers the
 * `Input`/`Textarea` danger-tone border and text colour — none of which
 * a plain unassociated `<p>` (the previous shape) could do, and none of
 * which axe can see either way, so this story is the check.
 *
 * The play function is that check made executable. It clicks each label
 * and watches focus land in the control it names (the thing a dangling
 * `htmlFor` silently loses), then *resolves* the ids in the bad field's
 * `aria-describedby` back to their elements and compares the text a
 * screen reader would actually read out — asserting the attribute merely
 * exists would pass just as happily on two ids pointing at nothing.
 */
export const FieldsAndErrors: Story = {
  render: () => (
    <div className="flex max-w-sm flex-col gap-4">
      <FormField label="Sender ID" htmlFor="sb-sender" hint="Three to eleven characters.">
        <Input id="sb-sender" defaultValue="ACME" />
      </FormField>
      <FormField
        label="Sender ID"
        htmlFor="sb-sender-bad"
        hint="Three to eleven characters."
        error="Must be at most 11 characters."
      >
        <Input id="sb-sender-bad" defaultValue="A-SENDER-ID-THAT-IS-TOO-LONG" />
      </FormField>
      <FormField label="Notes" htmlFor="sb-notes">
        <Textarea id="sb-notes" rows={3} defaultValue="Free text." />
      </FormField>
      <FieldError>A standalone FieldError, outside any FormField.</FieldError>
      <Label htmlFor="sb-notes">A standalone Label</Label>
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;
    // Both fields are named "Sender ID", which is the point of the pair —
    // so they are separated by id, and `withId` throws rather than
    // guessing if either one ever stops existing.
    const senderFields = canvas.getAllByRole("textbox", { name: "Sender ID" });
    const good = withId(senderFields, "sb-sender");
    const bad = withId(senderFields, "sb-sender-bad");
    const senderLabels = canvas.getAllByText("Sender ID");

    await step("Clicking a label focuses the control it names", async () => {
      await userEvent.click(labelFor(senderLabels, "sb-sender"));
      await expect(good).toHaveFocus();
      await userEvent.click(labelFor(senderLabels, "sb-sender-bad"));
      await expect(bad).toHaveFocus();
    });

    await step("The valid field is not marked invalid", async () => {
      await expect(good).not.toHaveAttribute("aria-invalid");
    });

    await step("The field with an error is", async () => {
      await expect(bad).toHaveAttribute("aria-invalid", "true");
    });

    await step("Its aria-describedby names two elements — the hint, then the error", async () => {
      const ids = (bad.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
      await expect(ids).toHaveLength(2);
      // Resolve the ids rather than trusting them. A dangling id ref is
      // the exact defect `FormField`'s `hintId`/`errorId` pair exists to
      // make impossible, and it is invisible to every other check.
      const described = ids.map((id) => doc.getElementById(id)?.textContent ?? null);
      await expect(described).toEqual([
        "Three to eleven characters.",
        "Must be at most 11 characters.",
      ]);
    });

    await step("The error element is an alert, so it announces on insertion", async () => {
      const errorId = (bad.getAttribute("aria-describedby") ?? "").split(" ")[1];
      await expect(errorId).toBeDefined();
      await expect(doc.getElementById(errorId ?? "")).toHaveAttribute("role", "alert");
    });

    // `^Notes` rather than an exact name: this story deliberately points
    // two labels at `#sb-notes` (the `FormField`'s own, and the
    // standalone `Label` below it), and an accessible name is the
    // concatenation of every associated label, not the first one.
    await step("The standalone Label points at the textarea", async () => {
      await userEvent.click(canvas.getByText("A standalone Label"));
      await expect(canvas.getByRole("textbox", { name: /^Notes/ })).toHaveFocus();
    });
  },
};

/**
 * Small closed vocabularies. Neither portals, so both stay usable inside
 * a drawer — unlike a listbox, whose portalled options land outside the
 * drawer's focus trap.
 *
 * The message-class field is the `control="group"` pairing `FormField`'s
 * own doc prescribes: the caller wires the group with
 * `aria-labelledby={groupLabelId(htmlFor)}` rather than `htmlFor`, since
 * a `<fieldset>` isn't a labelable element `for` can point at.
 * `ChipSelectProps` didn't declare `aria-labelledby` until now, so this
 * exact call was a type error even though the `<fieldset>` already
 * spread the prop onto itself at runtime.
 *
 * This is also the `--font-italic` story: the group's hint, the
 * "Marketing" chip's description and the radio options' descriptions are
 * all a person's sentence explaining something the control cannot say on
 * its own, so all three render `font-italic italic tracking-normal` —
 * see `FormField`'s `hint` prop doc for the line being drawn. The plain
 * count beside the chips ("2 of 4 selected") is the contrast case: it is
 * a value the system already has, so it stays `font-sans`, the same as
 * every chip/option label above it. Side by side, italic vs. sans should
 * read as two different registers, not as one muted-text style with an
 * inconsistent font.
 *
 * The play function exercises the *semantic* difference between the two
 * controls, which is the one thing the side-by-side rendering cannot
 * show: picking a second chip keeps the first (multi-select), while an
 * arrow key on the radio group moves the single choice and leaves exactly
 * one option `aria-checked`.
 */
export const SmallVocabularies: Story = {
  render: function Render() {
    const [classes, setClasses] = useState<string[]>(["otp"]);
    const [decision, setDecision] = useState<"approved" | "rejected">("approved");
    return (
      <div className="flex flex-col gap-5">
        <FormField
          label="Message class"
          htmlFor="sb-message-class"
          hint="Governs which senders may deliver this message."
          control="group"
        >
          <ChipSelect
            aria-labelledby={groupLabelId("sb-message-class")}
            value={classes}
            onValueChange={setClasses}
            options={[
              { value: "otp", label: "OTP" },
              { value: "transactional", label: "Transactional" },
              { value: "notification", label: "Notification" },
              {
                value: "marketing",
                label: "Marketing",
                description: "Requires the recipient's prior consent.",
              },
            ]}
          />
        </FormField>
        {/* Emitted fact, not commentary — a plain count the system already
            has, deliberately `font-sans` beside the italic hint and chip
            description above. This is the excluded case `FormField`'s
            `hint` doc names: nothing here is a person's sentence. */}
        <p className="text-caption text-subtle-foreground">
          {classes.length} of 4 message classes selected.
        </p>
        {/* Disabled: unlike `CheckboxField`/`SwitchField`, `ChipSelect`'s
            `Label` is a *child* of the chip it toggles, not a sibling
            outside it, so it already dims correctly with no separate fix
            — the chip's own `opacity-50` covers everything painted
            inside it, label text included. */}
        <ChipSelect
          aria-label="Message class (disabled)"
          disabled
          value={["otp"]}
          onValueChange={() => undefined}
          options={[
            { value: "otp", label: "OTP" },
            { value: "transactional", label: "Transactional" },
          ]}
        />
        <RadioGroup
          aria-label="Registration decision"
          value={decision}
          onValueChange={setDecision}
          options={[
            { value: "approved", label: "Approve", description: "The provider accepted it." },
            { value: "rejected", label: "Reject", description: "Needs a reason." },
          ]}
        />
      </div>
    );
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    // Scoped to the live `<fieldset>` — the disabled one below it repeats
    // "OTP" and "Transactional", so an unscoped name query would match
    // two chips and throw. The `<fieldset>` is reachable by the accessible
    // name `FormField`'s `control="group"` wiring gives it, which is
    // itself the thing `groupLabelId` exists to guarantee.
    const classes = within(canvas.getByRole("group", { name: "Message class" }));
    const otp = classes.getByRole("checkbox", { name: "OTP" });
    const transactional = classes.getByRole("checkbox", { name: "Transactional" });

    await step("One class is selected to begin with", async () => {
      await expect(otp).toHaveAttribute("aria-checked", "true");
      await expect(transactional).toHaveAttribute("aria-checked", "false");
      await expect(canvas.getByText("1 of 4 message classes selected.")).toBeInTheDocument();
    });

    await step("Selecting a second one keeps the first — this is multi-select", async () => {
      await userEvent.click(transactional);
      await expect(transactional).toHaveAttribute("aria-checked", "true");
      await expect(otp).toHaveAttribute("aria-checked", "true");
      await expect(canvas.getByText("2 of 4 message classes selected.")).toBeInTheDocument();
    });

    await step("Deselecting one leaves the other alone", async () => {
      await userEvent.click(otp);
      await expect(otp).toHaveAttribute("aria-checked", "false");
      await expect(transactional).toHaveAttribute("aria-checked", "true");
      await expect(canvas.getByText("1 of 4 message classes selected.")).toBeInTheDocument();
    });

    const decision = within(canvas.getByRole("radiogroup", { name: "Registration decision" }));
    // A `RadioGroupOption`'s `description` renders inside the `role="radio"`
    // element, so the accessible name is "Approve The provider accepted
    // it." — hence the anchored regex rather than an exact string.
    const approve = decision.getByRole("radio", { name: /^Approve/ });
    const reject = decision.getByRole("radio", { name: /^Reject/ });

    await step("The radio group starts on Approve", async () => {
      await expect(approve).toHaveAttribute("aria-checked", "true");
      await expect(reject).toHaveAttribute("aria-checked", "false");
    });

    await step("An arrow key moves the choice to the next option", async () => {
      await userEvent.click(approve);
      await expect(approve).toHaveFocus();
      await userEvent.keyboard("{ArrowRight}");
      await expect(reject).toHaveAttribute("aria-checked", "true");
      await expect(reject).toHaveFocus();
    });

    await step("…and exactly one option is checked, never two", async () => {
      const checked = decision
        .getAllByRole("radio")
        .filter((radio) => radio.getAttribute("aria-checked") === "true");
      await expect(checked).toHaveLength(1);
      await expect(approve).toHaveAttribute("aria-checked", "false");
    });

    await step("The arrow key walks back the other way too", async () => {
      await userEvent.keyboard("{ArrowLeft}");
      await expect(approve).toHaveAttribute("aria-checked", "true");
      await expect(reject).toHaveAttribute("aria-checked", "false");
    });
  },
};
