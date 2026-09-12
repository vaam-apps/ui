---
"@vaam-apps/ui": minor
---

Storybook documentation, a Playwright end-to-end gate, and the accessibility and rendering bugs both of them found — RadioGroup option naming, DropdownMenuCheckboxItem state, Tooltip's position prop, SideNav's in-flow width, and the dark theme applying without a `data-theme` attribute. See CHANGELOG.md.

Declared minor rather than patch: this release changes what renders for existing callers in six ways with no API change — SideNav stops taking width below xl, RadioGroup's option names lose their descriptions, DropdownMenuCheckboxItem's checked state moves into the accessible name, Tooltip's position prop starts actually positioning, DialogTrigger/DialogClose stop submitting an enclosing form, and the dark theme now applies with no data-theme attribute. README's own versioning note puts breaking changes in a minor.
