import type { Meta, StoryObj } from "@storybook/react-vite";
import { Code } from "./code";
import { CopyButton } from "./copy-button";
import { IdDisplay } from "./id-display";
import { PhoneDisplay } from "./phone-display";

const ID = "cs_a1b2c3d4e5f6g7h8i9j0k1l2";

const meta = {
  title: "Data/Identifiers",
  component: IdDisplay,
  tags: ["autodocs"],
  args: { value: ID },
} satisfies Meta<typeof IdDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Two rules, both enforced here rather than left to each call site: never
 * truncate in the middle — `abc…xyz` makes two ids that differ only in
 * the middle look identical, which is exactly the comparison a human
 * scanning a column is making — and never decorate, because a displayed
 * prefix gets pasted into a filter that does not expect it.
 */
export const TableAndFull: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <IdDisplay value={ID} />
      <IdDisplay value={ID} variant="full" />
      <IdDisplay value="pi_3QxR7w2eZvKYlo2C1a2b3c4d" truncateTo={10} />
    </div>
  ),
};

/** In a narrow column, to check wrap and overflow rather than only the
 * happy case with room to spare. */
export const Constrained: Story = {
  render: () => (
    <div className="w-full max-w-[200px] rounded-sm border border-edge bg-surface-2 p-2">
      <IdDisplay value={ID} variant="full" />
    </div>
  ),
};

/**
 * `PhoneDisplay` ships no grouping and no country table: grouping is a
 * per-market convention and a mis-grouped number reads as a different
 * number. A caller that knows its market passes a formatter; everyone
 * else gets the raw E.164, which is always correct if less pretty.
 */
export const Phones: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <PhoneDisplay
        value="+237677123456"
        format={(v) => `+237 ${v.slice(4, 5)} ${v.slice(5).replace(/(..)/g, "$1 ").trim()}`}
        tag="MTN"
        tagTitle="Inferred from prefix — not authoritative."
      />
      <PhoneDisplay value="+14155550132" />
    </div>
  ),
};

/** `Code` is for a literal that must be read in full — a config key, a
 * role, an enum. Never `IdDisplay`, which truncates. */
export const CodeAndCopy: Story = {
  render: () => (
    <div className="flex flex-col gap-3 text-body text-foreground">
      <p>
        Role <Code>operator</Code> may run <Code>expire_stale</Code>.
      </p>
      <span className="group inline-flex w-fit items-center gap-2 font-mono text-caption">
        pi_3QxR7w2eZvKYlo2C1a2b3c4d
        <CopyButton value="pi_3QxR7w2eZvKYlo2C1a2b3c4d" />
      </span>
    </div>
  ),
};
