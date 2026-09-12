import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Checkbox, CheckboxField } from "./checkbox";
import { ChipSelect } from "./chip-select";
import { FieldError, FormField } from "./form-field";
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
 * A checkbox is for a value a Save button will commit; a switch promises
 * the change already happened. Pairing a switch with a Save button tells
 * the operator two contradictory things and leaves them unsure whether
 * the toggle landed.
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
        <SwitchField
          checked={on}
          onCheckedChange={setOn}
          label="Live updates"
          description="Poll for new rows while this screen is open."
        />
      </div>
    );
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
};

/** Small closed vocabularies. Neither portals, so both stay usable inside
 * a drawer — unlike a listbox, whose portalled options land outside the
 * drawer's focus trap. */
export const SmallVocabularies: Story = {
  render: function Render() {
    const [classes, setClasses] = useState<string[]>(["otp"]);
    const [decision, setDecision] = useState<"approved" | "rejected">("approved");
    return (
      <div className="flex flex-col gap-5">
        <ChipSelect
          aria-label="Message class"
          value={classes}
          onValueChange={setClasses}
          options={[
            { value: "otp", label: "OTP" },
            { value: "transactional", label: "Transactional" },
            { value: "notification", label: "Notification" },
            { value: "marketing", label: "Marketing" },
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
};
