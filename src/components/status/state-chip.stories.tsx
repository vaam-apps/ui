import type { Meta, StoryObj } from "@storybook/react-vite";
import { StateChip, type StateChipTone } from "./state-chip";

const TONES: StateChipTone[] = [
  "neutral",
  "success",
  "warning",
  "danger",
  "uncertain",
  "expired",
  "parked",
];

const meta = {
  title: "Status/StateChip",
  component: StateChip,
  tags: ["autodocs"],
  args: { children: "chip" },
} satisfies Meta<typeof StateChip>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * All seven hues together, which is the only arrangement that catches a
 * collision. Two of these were unreachable until recently — the chip
 * carried its own four-tone copy of a table that already existed — and
 * `warning` was a shade of `uncertain` close enough to be the same colour
 * in a 14px glyph. Both were found by rendering them side by side.
 */
export const EveryTone: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      {TONES.map((tone) => (
        <StateChip key={tone} tone={tone}>
          {tone}
        </StateChip>
      ))}
    </div>
  ),
};

/** Inline, where it belongs — beside a value, not owning its own line. */
export const InContext: Story = {
  render: () => (
    <p className="text-body text-foreground">
      Route <span className="font-mono">orange-cm-primary</span>{" "}
      <StateChip tone="success">enabled</StateChip> · circuit{" "}
      <StateChip tone="warning">open until 14:32</StateChip>
    </p>
  ),
};
