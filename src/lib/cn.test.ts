import { describe, expect, it } from "vitest";
import { buttonVariants } from "../components/primitives/button";
import { cn } from "./cn";

describe("cn — custom theme scales", () => {
  // These three strings are verbatim from `FieldError`, `DetailList` and
  // `CardHeader`. Stock `twMerge` classifies an unknown `text-*` value as a
  // colour and drops the font size; every one of these therefore rendered
  // at the browser default until `cn()` registered the scale. Checked
  // against tailwind-merge 2.6.0 as well as 3.x — the bug predates the
  // upgrade, so these are regression guards, not upgrade guards.
  it.each([
    "text-caption text-state-danger-fg",
    "text-caption text-muted-foreground",
    "text-body text-foreground",
    "text-title-sm text-foreground",
    "font-mono text-caption text-subtle-foreground",
  ])("keeps a font size beside a text colour: %s", (input) => {
    expect(cn(input)).toBe(input);
  });

  it("still collapses two font sizes, last one winning", () => {
    expect(cn("text-caption", "text-body")).toBe("text-body");
    expect(cn("text-metric", "text-micro")).toBe("text-micro");
  });

  it("still collapses two text colours, last one winning", () => {
    expect(cn("text-foreground", "text-muted-foreground")).toBe("text-muted-foreground");
  });

  // daisyUI's radius tiers are theme keys, not stock Tailwind values, so
  // `twMerge` left both classes and let stylesheet order pick the winner.
  it("collapses daisyUI radius tiers against Tailwind's own", () => {
    expect(cn("rounded-sm", "rounded-field")).toBe("rounded-field");
    expect(cn("rounded-field", "rounded-box")).toBe("rounded-box");
    expect(cn("rounded-box", "rounded-none")).toBe("rounded-none");
    // `sheet` is registered too (`--radius-sheet`, the phone bottom sheet's
    // corner) — unregistered, both of these survived the merge.
    expect(cn("rounded-t-box", "rounded-t-sheet")).toBe("rounded-t-sheet");
  });
});

describe("cn — daisyUI component modifiers", () => {
  it("lets a later colour override an earlier one", () => {
    expect(cn("btn btn-primary", "btn-ghost")).toBe("btn btn-ghost");
    expect(cn("badge badge-neutral", "badge-primary")).toBe("badge badge-primary");
    expect(cn("alert alert-info", "alert-error")).toBe("alert alert-error");
  });

  it("lets a later size override an earlier one", () => {
    expect(cn("btn btn-sm", "btn-lg")).toBe("btn btn-lg");
    expect(cn("table table-xs", "table-md")).toBe("table table-md");
  });

  // The counter-intuitive one, and the reason colour and style are separate
  // groups: daisyUI 5's `.btn-outline` READS the `--btn-color` variable that
  // `.btn-primary` sets. Collapsing them into one group makes
  // `cn("btn-primary", "btn-outline")` return only `btn-outline`, silently
  // discarding the colour.
  it("keeps colour and style together — they are orthogonal in daisyUI 5", () => {
    expect(cn("btn btn-primary", "btn-outline")).toBe("btn btn-primary btn-outline");
    expect(cn("badge badge-neutral", "badge-outline")).toBe("badge badge-neutral badge-outline");
  });

  it("does not treat an unrelated class as a daisyUI modifier", () => {
    expect(cn("btn-primary-ish", "btn-primary")).toBe("btn-primary-ish btn-primary");
  });
});

describe("cn — stock Tailwind behaviour is unchanged", () => {
  it.each([
    [["px-2", "px-3"], "px-3"],
    [["bg-surface-2", "bg-base-300"], "bg-base-300"],
    [["size-4", "size-5"], "size-5"],
    [["py-0.5", "py-2"], "py-2"],
  ])("%s", (inputs, expected) => {
    expect(cn(...inputs)).toBe(expected);
  });

  it("passes conditional values through clsx", () => {
    expect(cn("a", false && "b", undefined, ["c", { d: true, e: false }])).toBe("a c d");
  });
});

describe("daisyUI button size and shape are orthogonal", () => {
  /**
   * Regression guard. `square`/`circle` shared a class group with
   * `xs…xl`, so `cn()` treated them as conflicting and dropped the shape —
   * `Button size="icon"` emitted `btn-circle btn-sm` and rendered as a
   * plain small button, for as long as that group existed. The classes
   * were right at the call site and deleted on the way out, which is the
   * failure mode this whole file exists to prevent.
   */
  it("keeps both a shape and a size", () => {
    expect(cn("btn-circle", "btn-sm")).toBe("btn-circle btn-sm");
    expect(cn("btn-sm", "btn-circle")).toBe("btn-sm btn-circle");
    expect(cn("btn-square", "btn-sm")).toBe("btn-square btn-sm");
  });

  it("still resolves two shapes, and two sizes, against each other", () => {
    expect(cn("btn-square", "btn-circle")).toBe("btn-circle");
    expect(cn("btn-sm", "btn-lg")).toBe("btn-lg");
  });

  /**
   * Asserts the **radius**, not just the shape class — because asserting
   * the class is what let a rounded square ship as a circle.
   *
   * `btn-circle` survived the merge and the old test was green, but the
   * base string's `rounded-field` is an unlayered Tailwind utility and
   * daisyUI emits `.btn-circle` a sublayer deeper, so the utility won and
   * the element painted at 12px. A class-string assertion cannot see that
   * and would have passed forever. This checks the class that actually
   * decides the paint.
   */
  it("survives the real `buttonVariants` output, and resolves to a round radius", () => {
    const merged = cn(buttonVariants({ variant: "ghost", size: "icon" }));
    expect(merged).toContain("btn-circle");
    expect(merged).toContain("rounded-full");
    expect(merged).not.toContain("rounded-field");
  });
});
