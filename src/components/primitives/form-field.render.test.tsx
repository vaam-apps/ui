import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DatePicker, DatePickerContent, DatePickerTrigger, DatePickerValue } from "./date-picker";
import { FormField } from "./form-field";
import { Input } from "./input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSearch,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Textarea } from "./textarea";

/**
 * What each control *actually* emits when `FormField` wires it up.
 *
 * `FormField` associates a control with its own hint and error by cloning
 * its direct child with `aria-describedby`/`aria-invalid`. Whether that
 * survives to the DOM depends entirely on the child, and the first
 * version of this feature shipped with a doc comment asserting it worked
 * for controls where it did not. `tsc` cannot catch it — `cloneElement`
 * on an `isValidElement<P>` cast type-checks whatever you claim — and
 * neither can axe, because an unassociated `<p>` is valid HTML. Only a
 * render does.
 *
 * The `Select` row is the one that matters most, because it pins a
 * limitation rather than a feature. Headless UI's `ListboxButton` builds
 * `aria-describedby` into its *own* props from an internal `Description`
 * context and lets those win over the caller's, so a description cannot
 * be threaded to it from outside. If a Headless UI upgrade ever changes
 * that, this test fails and tells us the limitation is gone.
 */
const HINT = "Three to eleven characters.";
const ERROR = "Must be at most 11 characters.";

function wrap(id: string, control: React.ReactElement): string {
  return renderToStaticMarkup(
    <FormField label="Sender ID" htmlFor={id} hint={HINT} error={ERROR}>
      {control}
    </FormField>,
  );
}

describe("FormField wires the control to its hint and error", () => {
  it.each([
    ["Input", "i", <Input id="i" key="i" />],
    ["Textarea", "t", <Textarea id="t" key="t" />],
    [
      "DatePicker",
      "d",
      <DatePicker key="d" value={undefined} onValueChange={() => undefined}>
        <DatePickerTrigger id="d">
          <DatePickerValue placeholder="Pick a date" />
        </DatePickerTrigger>
        <DatePickerContent />
      </DatePicker>,
    ],
  ])("%s carries aria-describedby and aria-invalid", (_name, id, control) => {
    const html = wrap(id, control);
    expect(html).toContain(`aria-describedby="${id}-hint ${id}-error"`);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain(`id="${id}-hint"`);
    expect(html).toContain(`id="${id}-error"`);
  });

  // Both engines: a `SelectSearch` swaps the trigger for Headless UI's
  // `ComboboxButton`, which builds its own `aria-describedby` the same way.
  it.each([
    ["Select", false],
    ["Searchable Select", true],
  ])("%s carries aria-invalid, and cannot carry aria-describedby", (_name, searchable) => {
    const html = wrap(
      "s",
      <Select defaultValue="a">
        <SelectTrigger id="s">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {searchable && <SelectSearch />}
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(html).toContain('aria-invalid="true"');
    // Not a preference — Headless UI overwrites it. See `select.tsx`'s
    // `SelectContextValue.invalid` for the mechanism and the way out.
    expect(html).not.toContain('aria-describedby="s-hint s-error"');
  });

  it("emits no aria-describedby at all when there is neither hint nor error", () => {
    const html = renderToStaticMarkup(
      <FormField label="L" htmlFor="p">
        <Input id="p" />
      </FormField>,
    );
    // Asserted as *attributes*, not as substrings: `Input`'s class list
    // legitimately contains the string `aria-invalid` as a Tailwind
    // variant (`aria-invalid:border-...`), which a naive `toContain`
    // reads as a failure.
    expect(html).not.toContain("aria-describedby=");
    expect(html).not.toContain("aria-invalid=");
  });

  it("merges rather than clobbers a caller's own aria-describedby", () => {
    const html = renderToStaticMarkup(
      <FormField label="L" htmlFor="m" error={ERROR}>
        <Input id="m" aria-describedby="caller-owned" />
      </FormField>,
    );
    expect(html).toContain('aria-describedby="caller-owned m-error"');
  });

  it("leaves a fragment child alone instead of silently dropping the props", () => {
    const html = renderToStaticMarkup(
      <FormField label="L" htmlFor="f" error={ERROR}>
        {/* biome-ignore lint/complexity/noUselessFragments: the fragment is the case under test — `isValidElement` accepts one and `cloneElement` silently drops props on it */}
        <>
          <Input id="f" />
          <span>adornment</span>
        </>
      </FormField>,
    );
    // `isValidElement` returns true for a fragment and `cloneElement`
    // happily returns one carrying aria props that React then drops
    // without a warning. The explicit Fragment guard is what keeps this
    // honest: no attribute, rather than an attribute that does nothing.
    expect(html).not.toContain("aria-describedby=");
  });
});
