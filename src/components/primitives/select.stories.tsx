import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { FormField } from "./form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

const meta = {
  title: "Primitives/Select",
  component: Select,
  tags: ["autodocs"],
  args: { children: null },
  parameters: {
    docs: {
      description: {
        component:
          "A listbox for a vocabulary too long to show at once. For a handful of options " +
          "prefer `RadioGroup` or `ChipSelect`: a select makes the reader click once to " +
          "discover the choices and again to pick, and its options portal out of the " +
          "document flow, which is what makes it awkward inside a drawer.",
      },
    },
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Render() {
    const [value, setValue] = useState<string>();
    return (
      <div className="w-64">
        <FormField label="Provider" htmlFor="sb-provider">
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger id="sb-provider">
              <SelectValue placeholder="Any provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="orange_cm">Orange Cameroon</SelectItem>
              <SelectItem value="mtn_agg">MTN (aggregator)</SelectItem>
              <SelectItem value="fake">Fake (test)</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>
    );
  },
};
