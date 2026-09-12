import type { Meta, StoryObj } from "@storybook/react-vite";
import { Money } from "./money";

const meta = {
  title: "Data/Money",
  component: Money,
  tags: ["autodocs"],
  args: { amount: 1250, currency: "USD" },
  parameters: {
    docs: {
      description: {
        component:
          "Amounts go in as an integer count of minor units — `number`, `bigint`, or a digit " +
          "string, so an `i64` from a backend survives the trip. The decimal exponent comes " +
          "from `Intl`, so there is no table to maintain and no currency it gets wrong.",
      },
    },
  },
} satisfies Meta<typeof Money>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Zero-, two- and three-decimal currencies. The three-decimal ones are
 * the tell: every hand-written exponent table remembers `JPY` and `XAF`
 * and forgets `KWD` and `BHD`.
 */
export const Exponents: Story = {
  render: () => (
    <div className="flex flex-col gap-1">
      <Money amount={500_000} currency="XAF" />
      <Money amount={500_000} currency="JPY" />
      <Money amount={1250} currency="USD" />
      <Money amount={1250} currency="EUR" locale="de-DE" />
      <Money amount={1250} currency="KWD" />
      <Money amount={1250} currency="BHD" />
    </div>
  ),
};

/**
 * `9007199254740993` minor units. Scaling is string surgery, never
 * division, so this is exact — the naive `minor / 100` evaluates to
 * `…409.92` and loses the last cent.
 */
export const PastMaxSafeInteger: Story = {
  render: () => (
    <div className="flex flex-col gap-1">
      <Money amount="9007199254740993" currency="USD" />
      <Money amount={9_007_199_254_740_993n} currency="USD" />
    </div>
  ),
};

export const DisplayModes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-6">
      <Money amount={1250} currency="USD" display="code" />
      <Money amount={1250} currency="USD" display="symbol" />
      <Money amount={1250} currency="USD" display="none" />
    </div>
  ),
};

/** `signed` tints by direction. Off by default: in a ledger where most
 * rows point one way, colouring every row is noise, and colour alone is
 * not an accessible way to convey sign. The minus is always rendered. */
export const SignedLedger: Story = {
  render: () => (
    <div className="flex flex-col items-end gap-1">
      <Money amount={125_000} currency="XAF" tone="signed" signDisplay="always" />
      <Money amount={-32_500} currency="XAF" tone="signed" />
      <Money amount={4_000} currency="XAF" tone="signed" signDisplay="always" />
    </div>
  ),
};

/** `tabular-nums` is the reason this is a component rather than a call to
 * `formatMoney` in a span: without fixed-width digits the column does not
 * align, and scanning it for the outlier stops working. */
export const AlignsInAColumn: Story = {
  render: () => (
    <table className="text-body">
      <tbody>
        {[500_000, 1_250, 32_500, 9_000_000, 75].map((amount) => (
          <tr key={amount}>
            <td className="py-0.5 pr-6 text-muted-foreground">invoice</td>
            <td className="py-0.5 text-right">
              <Money amount={amount} currency="XAF" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
};
