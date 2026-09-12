import type { Meta, StoryObj } from "@storybook/react-vite";
import { MaskedValue } from "./masked-value";

const meta = {
  title: "Data/MaskedValue",
  component: MaskedValue,
  tags: ["autodocs"],
  args: { value: "whsec_9f2c41b6a7e84d15b3c0a8e7f2d9146c8b0e3a75d", label: "signing secret" },
  parameters: {
    docs: {
      description: {
        component:
          "A shoulder-surfing and screen-share control, **not** a security boundary. Whoever " +
          "renders this already received the value over the wire. What masking buys is real " +
          "but narrow: the value stays out of screenshots, recordings, and the eyeline of " +
          "whoever is sitting behind the operator. If a value must never reach the client, " +
          "that is an API decision — do not send it.",
      },
    },
  },
} satisfies Meta<typeof MaskedValue>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { prefix: 6, reveal: 4 } };

/** A prefixed credential keeps its prefix visible: `whsec_` says what kind
 * of thing it is and is not itself secret. */
export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <MaskedValue
        value="whsec_9f2c41b6a7e84d15b3c0a8e7f2d9146c8b0e3a75d"
        prefix={6}
        reveal={4}
        label="signing secret"
      />
      <MaskedValue value="JBSWY3DPEHPK3PXP" reveal={0} label="TOTP secret" />
      <MaskedValue value="+237677123456" reveal={3} revealable={false} label="payer number" />
      <MaskedValue value="4242424242424242" reveal={4} copyable={false} label="card number" />
    </div>
  ),
};
