import type { Meta, StoryObj } from "@storybook/react-vite";
import { StateChip, type StateChipTone } from "./state-chip";
import { HUE_CLASSES } from "./status-tokens";

/**
 * Derived from `HUE_CLASSES`, not retyped. This list used to be a literal
 * and had already fallen behind the vocabulary once — `expired` and
 * `parked` were unreachable through the chip for as long as it carried
 * its own private tone table. Reading the keys means a hue added to
 * `StatusHue` shows up in this story on the next render rather than
 * whenever somebody remembers two files are meant to agree.
 */
const TONES = Object.keys(HUE_CLASSES) as StateChipTone[];

const meta = {
  title: "Status/StateChip",
  component: StateChip,
  tags: ["autodocs"],
  args: { children: "chip" },
} satisfies Meta<typeof StateChip>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Every hue together, which is the only arrangement that catches a
 * collision. Two of these were unreachable until recently — the chip
 * carried its own four-tone copy of a table that already existed — and
 * `warning` was a shade of `uncertain` close enough to be the same colour
 * in a 14px glyph. Both were found by rendering them side by side, which
 * is also how teal was rejected for `progress`: at ΔE 17 from `success`
 * it read as a dim green here, and "processing" against "succeeded" is
 * the one pair on a payments table that must never be confusable.
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
