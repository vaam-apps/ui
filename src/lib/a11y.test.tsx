// @vitest-environment jsdom
import axe from "axe-core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DetailList, DetailRow } from "../components/data/detail-row";
import { IdDisplay } from "../components/data/id-display";
import { InstrumentPanel } from "../components/data/instrument-panel";
import { MaskedValue } from "../components/data/masked-value";
import { PhoneDisplay } from "../components/data/phone-display";
import { StatTile } from "../components/data/stat-tile";
import { TimestampDisplay } from "../components/data/timestamp-display";
import { InlineBanner } from "../components/patterns/inline-banner";
import { InlineEmptyState } from "../components/patterns/inline-empty-state";
import { Badge } from "../components/primitives/badge";
import { Button } from "../components/primitives/button";
import { Card, CardBody, CardHeader } from "../components/primitives/card";
import { CheckboxField } from "../components/primitives/checkbox";
import { ChipSelect } from "../components/primitives/chip-select";
import {
  DatePicker,
  DatePickerClear,
  DatePickerContent,
  DatePickerTrigger,
  DatePickerValue,
  DateRangePicker,
} from "../components/primitives/date-picker";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../components/primitives/dropdown-menu";
import { FormField } from "../components/primitives/form-field";
import { InlineConfirm } from "../components/primitives/inline-confirm";
import { Input } from "../components/primitives/input";
import { Pagination } from "../components/primitives/pagination";
import { Progress } from "../components/primitives/progress";
import { RadioGroup } from "../components/primitives/radio-group";
import { SideNav } from "../components/primitives/side-nav";
import { Spinner } from "../components/primitives/spinner";
import { SwitchField } from "../components/primitives/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/primitives/table";
import {
  ValueTabs,
  ValueTabsContent,
  ValueTabsList,
  ValueTabsTrigger,
} from "../components/primitives/tabs";
import { Textarea } from "../components/primitives/textarea";
import { ThemeSwitcher } from "../components/primitives/theme-switcher";
import { StateChip } from "../components/status/state-chip";
import { StatusPill } from "../components/status/status-pill";
import { defineStatusSystem } from "../components/status/status-tokens";

/**
 * axe, over rendered components, in the build.
 *
 * # Why this exists alongside `contrast.test.ts`
 *
 * The two gates cover disjoint halves and neither substitutes for the
 * other. `contrast.test.ts` parses the stylesheet and measures colour,
 * because jsdom applies no CSS and axe's own `color-contrast` rule is
 * therefore inert here. This file renders real components and asks axe
 * about **structure**: does every control have an accessible name, is
 * the ARIA it declares valid for its role, is a label actually
 * associated with something, are there duplicate ids, is anything
 * focusable hidden from the tree.
 *
 * That division is deliberate. A token can be declared and illegible —
 * `contrast.test.ts` exists because `--subtle-foreground` shipped below
 * AA for months. A control can be rendered and unreachable — which is
 * the class this file exists for, and which has cost this package three
 * separate bugs in one session:
 *
 * - `FormField`'s `hint` and `error` were wired to the control by
 *   nothing at all: no `id`, no `aria-describedby`, no `aria-invalid`. A
 *   screen-reader user heard the label and neither the constraint nor
 *   the error.
 * - `ValueTabsTrigger` carried `outline-none` with no substitute ring,
 *   so a keyboard user tabbing into a tablist saw nothing.
 * - `CopyButton` and `MaskedValue`'s toggle were bare 12px icons with no
 *   hit area.
 *
 * The Storybook a11y addon runs axe too, and it is the reason several of
 * those were eventually found — but it runs in a browser a person has to
 * open, on a story someone has to write, and it reports rather than
 * fails. This runs on every `pnpm test`.
 *
 * # What it cannot see
 *
 * jsdom has no layout and no CSS. So: no contrast (see the sibling
 * gate), no "is the focus ring actually visible", no "is this clipped by
 * an ancestor's overflow", no hit-target size. Those stay the browser's
 * job, and three of them are exactly the bugs a static check missed this
 * session — so the existence of this file is not a reason to stop
 * looking at renders.
 */

const AXE_OPTIONS: axe.RunOptions = {
  // `color-contrast` needs real layout and computed colour; jsdom has
  // neither, so it would report nothing and read as a pass. Disabled
  // explicitly rather than silently returning empty, and covered in full
  // by `contrast.test.ts` against the stylesheet itself.
  rules: { "color-contrast": { enabled: false } },
  resultTypes: ["violations"],
};

/**
 * Mounts the component for real — effects and all — then runs axe.
 *
 * # This must be a client render, and the first version was not
 *
 * The obvious harness is `renderToStaticMarkup` + `innerHTML`, matching
 * `form-field.render.test.tsx`'s precedent. It produces **false
 * failures across most of this library**, and it took a browser to see
 * why: Headless UI wires a control's `aria-labelledby` in an *effect*,
 * not during render. Server markup therefore shows a
 * `<label for="…">` pointing at a `<span role="checkbox">` — and `for`
 * only associates with labelable elements, so the name is genuinely
 * absent in that snapshot. axe flags `aria-toggle-field-name`, correctly,
 * about a state the user never sees.
 *
 * Measured in the running Storybook to settle it: after hydration the
 * same control carries `aria-labelledby="headlessui-label-_r_8_"`
 * resolving to "Mask the recipient in webhook payloads". The component
 * was fine; the harness was lying. A gate that cries wolf is worse than
 * no gate, because it gets switched off.
 *
 * So: `createRoot` inside `act`, which flushes effects the way a browser
 * does. `IS_REACT_ACT_ENVIRONMENT` is required for `act` to work outside
 * a test renderer.
 *
 * The wrapper is a `<main>` because axe's `region` rule flags content
 * outside a landmark — a property of the *page* a consumer builds, not
 * of a component rendered alone.
 */
async function mount<T>(
  node: React.ReactElement,
  inspect: (host: HTMLElement) => T | Promise<T>,
): Promise<T> {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("main");
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    await act(async () => {
      root.render(node);
    });
    return await inspect(host);
  } finally {
    await act(async () => {
      root.unmount();
    });
    host.remove();
  }
}

async function audit(node: React.ReactElement): Promise<axe.Result[]> {
  return mount(node, async (host) => (await axe.run(host, AXE_OPTIONS)).violations);
}

function describeViolations(violations: axe.Result[]): string {
  return violations
    .map((v) => {
      const where = v.nodes.map((n) => n.html).join("\n      ");
      return `${v.id} (${v.impact}): ${v.help}\n      ${where}\n      ${v.helpUrl}`;
    })
    .join("\n\n");
}

const DELIVERY = defineStatusSystem({
  delivered: {
    family: "terminal",
    silhouette: "circle",
    mark: "check",
    hue: "success",
    filled: true,
    attention: "quiet",
    label: "Delivered",
    tooltip: "The handset confirmed receipt.",
  },
  failed: {
    family: "terminal",
    silhouette: "circle",
    mark: "cross",
    hue: "danger",
    filled: true,
    attention: "loud",
    label: "Failed",
    tooltip: "The provider rejected it.",
  },
});

/**
 * One fixture per component, in the shape a real screen uses it — not
 * the minimum that renders. A component audited with no label, no
 * children and no error state passes trivially and proves nothing; the
 * `FormField` row below is deliberately the errored case, because that
 * is the one that was broken.
 */
const FIXTURES: Array<[string, React.ReactElement]> = [
  ["Button", <Button key="b">Replay</Button>],
  [
    "Button, icon-only",
    <Button key="bi" size="icon" aria-label="Replay attempt">
      ⟳
    </Button>,
  ],
  [
    "FormField, with hint and error",
    <FormField
      key="ff"
      label="Sender ID"
      htmlFor="a11y-sender"
      hint="Three to eleven characters."
      error="Must be at most 11 characters."
    >
      <Input id="a11y-sender" defaultValue="A-SENDER-ID-THAT-IS-TOO-LONG" />
    </FormField>,
  ],
  [
    "FormField, textarea",
    <FormField key="ft" label="Notes" htmlFor="a11y-notes">
      <Textarea id="a11y-notes" />
    </FormField>,
  ],
  [
    "CheckboxField",
    <CheckboxField
      key="cf"
      label="Mask the recipient"
      description="Baked in when the row is written."
      checked
      onCheckedChange={() => undefined}
    />,
  ],
  [
    "SwitchField",
    <SwitchField
      key="sf"
      label="Live updates"
      description="Poll while this screen is open."
      checked
      onCheckedChange={() => undefined}
    />,
  ],
  ["StatusPill, quiet", <StatusPill key="sp" meta={DELIVERY.delivered} literal="delivered" />],
  [
    "StatusPill, loud with detail",
    <StatusPill key="spl" meta={DELIVERY.failed} literal="failed" showLiteral detail="4xx" />,
  ],
  [
    // The path the accessible-name regression lived on — see the
    // describe block at the bottom of this file, which asserts what axe
    // structurally cannot.
    "StatusPill, literal carried but not shown",
    <StatusPill key="sph" meta={DELIVERY.failed} literal="failed" detail="4xx" pending />,
  ],
  [
    "StateChip",
    <StateChip key="sc" tone="uncertain">
      watch
    </StateChip>,
  ],
  ["Badge", <Badge key="bd">production</Badge>],
  ["IdDisplay", <IdDisplay key="id" value="cs_msg_8f21c0bd4e1a9f3c77e" />],
  ["PhoneDisplay", <PhoneDisplay key="pd" value="+237677123456" />],
  [
    "MaskedValue",
    <MaskedValue key="mv" value="whsec_8f21c0bd4e1a9f3c77e2b5" prefix={6} label="signing secret" />,
  ],
  [
    "StatTile",
    <StatTile key="st" label="Delivered" value="12,481" caption="98.2% of 12,710 terminal" />,
  ],
  [
    "InstrumentPanel",
    <InstrumentPanel key="ip" title="Delivery" caption="Last 24 hours">
      <StatTile label="Delivered" value="12,481" />
    </InstrumentPanel>,
  ],
  [
    "Card with a heading",
    <Card key="cd">
      <CardHeader title="Orange Cameroon" meta="orange_cm" headingLevel={2} />
      <CardBody>Body copy.</CardBody>
    </Card>,
  ],
  ["Progress", <Progress key="pg" value={2} max={5} label="Delivery attempts" showValue />],
  ["Spinner, labelled", <Spinner key="sn" label="Loading" />],
  [
    "Pagination",
    <Pagination
      key="pn"
      label="Results"
      position={{ kind: "offset", offset: 0, pageSize: 25, total: 137 }}
      onPrevious={undefined}
      onNext={() => undefined}
    />,
  ],
  [
    "InlineBanner",
    <InlineBanner key="ib" variant="danger">
      The provider rejected it.
    </InlineBanner>,
  ],
  [
    "InlineEmptyState",
    <InlineEmptyState
      key="ie"
      message="No messages match these filters."
      action={{ label: "Clear filters", onClick: () => undefined }}
    />,
  ],
  [
    "DetailList",
    <DetailList key="dl">
      <DetailRow label="Message">cs_msg_8f21c0b</DetailRow>
      <DetailRow label="Cost">XAF 1,200</DetailRow>
    </DetailList>,
  ],
  [
    "RadioGroup",
    <RadioGroup
      key="rg"
      aria-label="Registration outcome"
      value="approve"
      onValueChange={() => undefined}
      options={[
        { value: "approve", label: "Approve", description: "The provider accepted it." },
        { value: "reject", label: "Reject", description: "Needs a reason." },
      ]}
    />,
  ],
  [
    "ChipSelect",
    <ChipSelect
      key="cs2"
      aria-label="Message class"
      value={["otp"]}
      onValueChange={() => undefined}
      options={[
        { value: "otp", label: "otp", description: "One-time passcodes." },
        { value: "marketing", label: "marketing" },
      ]}
    />,
  ],
  [
    "ValueTabs",
    <ValueTabs key="vt" defaultValue="request">
      <ValueTabsList>
        <ValueTabsTrigger value="request">Request</ValueTabsTrigger>
        <ValueTabsTrigger value="response">Response</ValueTabsTrigger>
      </ValueTabsList>
      <ValueTabsContent value="request">What was sent.</ValueTabsContent>
      <ValueTabsContent value="response">What came back.</ValueTabsContent>
    </ValueTabs>,
  ],
  ["ThemeSwitcher", <ThemeSwitcher key="ts" persist={false} />],
  [
    "InlineConfirm",
    <InlineConfirm
      key="ic"
      title="Delete this route?"
      description="Queued attempts for it are abandoned."
      confirmLabel="Delete route"
      onConfirm={() => undefined}
      onCancel={() => undefined}
    />,
  ],
  ["TimestampDisplay", <TimestampDisplay key="td" value="2026-08-08T14:03:07Z" />],
  [
    "Table",
    <Table key="tb">
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          <TableHead align="end">Cost</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Delivered</TableCell>
          <TableCell align="end">1,200</TableCell>
        </TableRow>
      </TableBody>
    </Table>,
  ],
];

describe("axe finds no structural violations in a rendered component", () => {
  it("has fixtures to audit (guards against an empty list passing vacuously)", () => {
    expect(FIXTURES.length).toBeGreaterThan(15);
  });

  it.each(FIXTURES)("%s", async (_name, element) => {
    const violations = await audit(element);
    expect(violations, `\n${describeViolations(violations)}\n`).toHaveLength(0);
  });
});

describe("the audit itself is wired up", () => {
  /**
   * Proves axe is actually running and actually reporting, so a future
   * change that silently breaks the harness — a swallowed promise, a
   * host node never attached, a rule set that disables everything —
   * fails here rather than turning the whole suite into a no-op.
   *
   * This is the guard `contrast.test.ts` needed and did not have: that
   * file stayed green with an entire theme deleted, because absence was
   * never asserted.
   */
  it("reports a violation when one is deliberately introduced", async () => {
    const violations = await audit(
      // biome-ignore lint/a11y/useValidAriaRole: deliberately invalid, to prove axe is live
      <div role="not-a-real-role">broken on purpose</div>,
    );
    expect(violations.length).toBeGreaterThan(0);
  });

  it("reports an unlabelled control", async () => {
    const violations = await audit(<button type="button" />);
    expect(violations.map((v) => v.id)).toContain("button-name");
  });
});

/**
 * The date pickers, closed and **open**. The open picker is where its
 * semantics live — a `dialog` named by its title, a grid of labelled days,
 * Cancel and OK — and none of it exists until the trigger is pressed, so a
 * closed-only fixture would audit a button and nothing else. Both trees of
 * the range picker are in the document when open (one hidden by CSS), and
 * jsdom has no CSS, so the audit sees both: a duplicated id or an
 * unnamed control in either fails here.
 */
describe("DatePicker and DateRangePicker, closed and open", () => {
  // Floating UI's `autoUpdate` observes the trigger with a `ResizeObserver`
  // jsdom does not have; nothing here depends on a size.
  const REAL_RO = globalThis.ResizeObserver;
  beforeAll(() => {
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });
  afterAll(() => {
    globalThis.ResizeObserver = REAL_RO;
  });

  const PICKERS: [string, React.ReactElement][] = [
    [
      "DatePicker in a FormField, with a hint and an error",
      <FormField
        key="single"
        label="Send on"
        htmlFor="a11y-send-on"
        hint="The day it goes out."
        error="Pick a weekday."
      >
        <DatePicker value="2026-09-11" onValueChange={() => undefined}>
          <DatePickerTrigger id="a11y-send-on">
            <DatePickerValue placeholder="Pick a date" />
            <DatePickerClear />
          </DatePickerTrigger>
          <DatePickerContent />
        </DatePicker>
      </FormField>,
    ],
    [
      "DateRangePicker named by aria-label",
      <DateRangePicker
        key="range"
        value={{ from: "2026-09-03", to: "2026-09-14" }}
        onValueChange={() => undefined}
      >
        <DatePickerTrigger aria-label="Created between">
          <DatePickerValue placeholder="Any time" />
          <DatePickerClear />
        </DatePickerTrigger>
        <DatePickerContent />
      </DateRangePicker>,
    ],
  ];

  it.each(PICKERS)("%s, closed", async (_name, element) => {
    const violations = await audit(element);
    expect(violations, `\n${describeViolations(violations)}\n`).toHaveLength(0);
  });

  it.each(PICKERS)("%s, open", async (_name, element) => {
    const violations = await mount(element, async (host) => {
      const trigger = host.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]');
      if (trigger === null) throw new Error("no trigger rendered");
      await act(async () => {
        trigger.click();
      });
      expect(host.querySelector('[role="dialog"]'), "the picker did not open").not.toBeNull();
      expect(host.querySelectorAll('[role="grid"]').length).toBeGreaterThan(0);
      return (await axe.run(host, AXE_OPTIONS)).violations;
    });
    expect(violations, `\n${describeViolations(violations)}\n`).toHaveLength(0);
  });
});

/**
 * A checkable menu row must say whether it is checked.
 *
 * It used to claim `role="menuitemcheckbox"` and `aria-checked`, and
 * neither reached the DOM in a usable form: Headless UI's `MenuItem`
 * owns `role` and renders `menuitem` regardless, while `aria-checked`
 * survived onto a role that does not permit it. The state was therefore
 * carried by a checkmark glyph and nothing else, in a component whose
 * source read as though ARIA handled it.
 *
 * This pins the replacement — the state is in the accessible name — and
 * pins it by *effect* rather than by mechanism, so a future version of
 * Headless UI that does honour the role can be adopted by changing the
 * component and leaving these cases alone.
 */
describe("DropdownMenuCheckboxItem announces its state", () => {
  const menu = (checked: boolean) => (
    <DropdownMenu>
      <DropdownMenuTrigger>Columns</DropdownMenuTrigger>
      <DropdownMenuContent static>
        <DropdownMenuCheckboxItem checked={checked}>Delivered</DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // `DropdownMenuContent` sets an `anchor`, and Headless UI renders an
  // anchored `MenuItems` in a portal — so the rows are NOT inside the
  // mount host. Querying `host` here finds nothing and every assertion
  // below would pass vacuously, which is the same trap the `SideNav`
  // block documents for its rails.
  it("puts the state in the name when checked", async () => {
    await mount(menu(true), () => {
      const row = document.querySelector('[role="menuitem"], [role="menuitemcheckbox"]');
      expect(row, "no menu row found — did the portal target change?").not.toBeNull();
      expect(row?.textContent).toContain("Delivered");
      expect(row?.textContent).toContain("checked");
    });
  });

  it("distinguishes unchecked from checked", async () => {
    await mount(menu(false), () => {
      const row = document.querySelector('[role="menuitem"], [role="menuitemcheckbox"]');
      expect(row).not.toBeNull();
      expect(row?.textContent).toContain("not checked");
    });
  });

  it("declares no ARIA state its role does not permit", async () => {
    await mount(menu(true), () => {
      const row = document.querySelector('[role="menuitem"]');
      // `aria-checked` is not allowed on `role="menuitem"`. If a future
      // change gets the role honoured, this assertion is the one to
      // revisit — and it will fail loudly rather than drift.
      if (row !== null) {
        expect(row.getAttribute("aria-checked")).toBeNull();
      }
    });
  });
});

/**
 * An option's name must be its label, not its label plus its description.
 *
 * axe cannot see this one either, for the same reason it could not see
 * `StatusPill`'s: every rule is satisfied. The radio has a role, the role
 * has a non-empty name, the name is derived from content. It is simply
 * the **wrong** content — both spans render inside the `role="radio"`
 * element, so content naming concatenates them and the shipped fixture's
 * option was named `"ApproveThe provider accepted it."`. A screen-reader
 * user hears the whole description again on every arrow press through the
 * group, and there is no rule for "this name is longer than it should
 * be".
 *
 * Headless UI's `Label`/`Description` do not help nested inside a
 * `Radio` — measured, both `aria-labelledby` and `aria-describedby` came
 * back `null`, because a `Radio` is not a `Field`. `ChipSelect` is
 * correct only because it wraps each option in a real `<Field>`.
 *
 * So `radio-group.tsx` sets both ids explicitly, and this pins the
 * result rather than the mechanism it happens to use: the name is the
 * label alone, and the description is reachable as a description.
 */
describe("RadioGroup names an option by its label alone", () => {
  const OPTIONS = [
    { value: "approve", label: "Approve", description: "The provider accepted it." },
    { value: "reject", label: "Reject" },
  ];

  it("does not fold the description into the accessible name", async () => {
    await mount(
      <RadioGroup
        aria-label="Registration outcome"
        value="approve"
        onValueChange={() => undefined}
        options={OPTIONS}
      />,
      (host) => {
        const radio = host.querySelector('[role="radio"]');
        const labelledBy = radio?.getAttribute("aria-labelledby");
        expect(
          labelledBy,
          "the option must be named by an element, not by its own content",
        ).toBeTruthy();

        const label = labelledBy ? host.querySelector(`#${CSS.escape(labelledBy)}`) : null;
        expect(label, `aria-labelledby="${labelledBy}" resolves to nothing`).not.toBeNull();
        expect(label?.textContent).toBe("Approve");
        // The failure this exists for: the description riding along.
        expect(label?.textContent).not.toContain("provider accepted");
      },
    );
  });

  it("exposes the description as a description", async () => {
    await mount(
      <RadioGroup
        aria-label="Registration outcome"
        value="approve"
        onValueChange={() => undefined}
        options={OPTIONS}
      />,
      (host) => {
        const radio = host.querySelector('[role="radio"]');
        const describedBy = radio?.getAttribute("aria-describedby");
        expect(describedBy).toBeTruthy();
        const description = describedBy ? host.querySelector(`#${CSS.escape(describedBy)}`) : null;
        expect(description?.textContent).toBe("The provider accepted it.");
      },
    );
  });

  it("omits aria-describedby entirely when an option has no description", async () => {
    await mount(
      <RadioGroup
        aria-label="Registration outcome"
        value="approve"
        onValueChange={() => undefined}
        options={OPTIONS}
      />,
      (host) => {
        // A dangling `aria-describedby` pointing at an element that was
        // never rendered is worse than none: it resolves to nothing and
        // AT announces nothing, with no way to tell from the markup.
        const second = host.querySelectorAll('[role="radio"]')[1];
        expect(second?.getAttribute("aria-describedby")).toBeNull();
      },
    );
  });
});

/**
 * The one regression axe structurally cannot see.
 *
 * `StatusPill` used to render its non-interactive case as `role="img"`
 * with a synthetic `aria-label` built from `literal` + `meta.label`.
 * `img` flattens its subtree: everything inside becomes the label
 * string and nothing else is announced. `detail` — "4xx", the HTTP code
 * that is the entire reason a reader is looking at a failed pill — was
 * rendered, visible, and read to nobody, because the `aria-label` never
 * grew to include it. The `button` case was worse in the same way:
 * `aria-label` on a focusable element overrides content naming outright.
 *
 * **axe reports zero violations on both the broken and the fixed
 * version.** Every rule it has is satisfied either way: the element has
 * a role, the role has a name, the name is non-empty. "The name omits a
 * fact the sighted reader can see" is not a rule, because it cannot be
 * one in general — only the component's own contract says `detail`
 * belongs in the name. So the fixture above covers this path structurally
 * and this block covers the contract, by asserting the mechanism rather
 * than the outcome: no flattening role, no synthetic label, and the two
 * pieces of text reachable as content.
 *
 * Mutation-checked, not merely green. Restoring `role="img"` and the
 * synthetic `aria-label` on the pill fails exactly the first two cases
 * here and **nothing else in the suite** — every axe fixture above,
 * including the `StatusPill` ones, stays green. That measurement is the
 * claim two paragraphs up, not a prediction about it.
 *
 * The third case survives the mutation on purpose: the `sr-only` span is
 * still in the DOM either way, and `aria-label` merely outranks it. It
 * guards the complementary regression — someone dropping the span, or
 * rendering it alongside a visible literal so the enum is announced
 * twice.
 */
describe("StatusPill's accessible name is built from content", () => {
  const pill = (host: HTMLElement) => host.firstElementChild as HTMLElement;

  it("declares no subtree-flattening role", async () => {
    await mount(<StatusPill meta={DELIVERY.failed} literal="failed" detail="4xx" />, (host) => {
      expect(pill(host).getAttribute("role")).toBeNull();
      expect(host.querySelector('[role="img"]')).toBeNull();
    });
  });

  it("carries no synthetic aria-label, on either the span or the button case", async () => {
    await mount(<StatusPill meta={DELIVERY.failed} literal="failed" detail="4xx" />, (host) => {
      expect(pill(host).getAttribute("aria-label")).toBeNull();
    });
    await mount(
      <StatusPill
        meta={DELIVERY.failed}
        literal="failed"
        detail="4xx"
        interactive
        onClick={() => undefined}
      />,
      (host) => {
        const el = pill(host);
        expect(el.tagName).toBe("BUTTON");
        expect(el.getAttribute("aria-label")).toBeNull();
        // The failure this whole block exists for: a button whose name
        // comes from an attribute never mentions what happened.
        expect(el.textContent).toContain("4xx");
      },
    );
  });

  it("keeps a hidden literal in the name and a visible one out of it twice", async () => {
    await mount(<StatusPill meta={DELIVERY.failed} literal="failed" detail="4xx" />, (host) => {
      const sr = host.querySelector(".sr-only");
      expect(sr?.textContent).toBe("failed");
      expect(host.textContent).toContain("Failed");
      expect(host.textContent).toContain("4xx");
    });
    await mount(
      <StatusPill meta={DELIVERY.failed} literal="failed" showLiteral detail="4xx" />,
      (host) => {
        // Visible already — an `sr-only` copy would announce it twice.
        expect(host.querySelector(".sr-only")).toBeNull();
        expect(host.textContent?.match(/failed/g)).toHaveLength(1);
      },
    );
  });

  it("hides the glyph, which would otherwise announce as an unnamed image", async () => {
    await mount(<StatusPill meta={DELIVERY.failed} literal="failed" />, (host) => {
      const svg = host.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
    });
  });
});

/**
 * `SideNav` needs its own block, because the fixture list above cannot
 * reach it.
 *
 * Every other component is audited inside the `<main>` host `mount`
 * creates. `SideNav`'s two floating rails are `createPortal`ed to
 * `document.body` — deliberately, so their `fixed` positioning survives a
 * transformed ancestor — which puts them outside that host. Adding
 * `SideNav` to `FIXTURES` would therefore have audited the in-flow
 * sidebar and silently skipped both rails: a fixture that passes by
 * looking at the wrong half of the component, which is worse than no
 * fixture, because it reads as coverage.
 *
 * So these audit `document.body` instead. What they are actually
 * protecting:
 *
 * - The rail links are icon-only. Their accessible name comes from an
 *   `sr-only` span, with the glyph `aria-hidden` and the visible `title`
 *   on an `aria-hidden` wrapper — a chain with several ways to go quiet.
 * - The tiny-screen rail's overflow control is a `<button>` whose only
 *   content is an icon, so its name is an `aria-label` and nothing else.
 * - Both rails are in the DOM at once, so any duplicate-`id` bug in the
 *   menu wiring shows up here and nowhere else.
 */
describe("SideNav, including the portalled rails", () => {
  const Icon = () => null;
  const NAV = {
    topItem: { label: "Dashboard", href: "/", icon: Icon },
    groups: [
      {
        label: "Messaging",
        items: [
          { label: "Composer", href: "/composer", icon: Icon },
          { label: "Messages", href: "/messages", icon: Icon },
          { label: "Providers", href: "/providers", icon: Icon },
          { label: "Routes", href: "/routes", icon: Icon },
        ],
      },
    ],
    footerItems: [{ label: "Settings", href: "/settings", icon: Icon }],
    currentPath: "/messages",
  };

  /**
   * `landmark-unique` is disabled here, and only here.
   *
   * All three shapes — the in-flow sidebar and the two rails — are
   * `<nav aria-label="Primary">`, and **exactly one is ever displayed**:
   * their breakpoint gates are complements. jsdom applies no CSS, so
   * every one of them is "visible" to axe, and it reports three
   * identically-named landmarks that no browser will ever show at once.
   *
   * That is the definition of a false positive, and the rule this file's
   * own doc sets is that a gate which cries wolf gets switched off
   * wholesale — so the narrow rule is switched off instead of the gate.
   * The invariant it would otherwise be checking is not dropped: it is
   * pinned in `side-nav.portal.test.tsx`, on the class gates themselves,
   * which is the only place it is observable without a real layout.
   *
   * Everything else stays on. `region` in particular — the rule that
   * caught the rails being plain `<div>`s outside any landmark, which is
   * why they are `<nav>` at all — is exactly the check this block exists
   * for, and disabling `landmark-unique` does not weaken it.
   */
  const SIDE_NAV_AXE_OPTIONS: axe.RunOptions = {
    ...AXE_OPTIONS,
    rules: { ...AXE_OPTIONS.rules, "landmark-unique": { enabled: false } },
  };

  async function auditBody(node: React.ReactElement): Promise<axe.Result[]> {
    return mount(node, async () => (await axe.run(document.body, SIDE_NAV_AXE_OPTIONS)).violations);
  }

  it.each([
    ["floating (default)", <SideNav key="a" {...NAV} />],
    ["collapsed", <SideNav key="b" {...NAV} collapsed />],
    ["off-canvas", <SideNav key="c" {...NAV} smallScreen="off-canvas" />],
  ])("%s", async (_name, element) => {
    const violations = await auditBody(element);
    expect(violations, `\n${describeViolations(violations)}\n`).toHaveLength(0);
  });

  it("names every rail link and the overflow control", async () => {
    await mount(<SideNav {...NAV} />, () => {
      for (const rail of document.querySelectorAll("[data-floating-rail]")) {
        for (const link of rail.querySelectorAll("a")) {
          // Icon-only: the name has to come from somewhere that is not
          // the visible content, because there is no visible text.
          expect(link.textContent?.trim()).not.toBe("");
        }
      }
      const more = document.querySelector('[data-floating-rail-axis="horizontal"] button');
      expect(more?.getAttribute("aria-label")).toBe("More destinations");
    });
  });
});
