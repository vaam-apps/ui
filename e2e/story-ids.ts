/**
 * Every story this suite drives, by id, in one place.
 *
 * Storybook derives an id from the `title` and the export name, so a
 * rename that looks purely cosmetic silently changes it — and a
 * mistyped id does not fail as "no such story", it renders Storybook's
 * own error page, on which every selector below simply times out.
 * `story-ids.spec.ts` checks this list against the built
 * `index.json`, so that failure reads as "this id no longer exists"
 * instead of as a mysterious 15-second timeout in an unrelated spec.
 */
export const STORY = {
  buttonSizes: "primitives-button--sizes",
  buttonVariants: "primitives-button--variants",
  dialogScrollingBody: "primitives-overlays--dialog-with-scrolling-body",
  drawers: "primitives-overlays--drawers",
  toasts: "primitives-overlays--toasts",
  formControls: "primitives-form-controls--fields-and-errors",
  checkboxAndSwitch: "primitives-form-controls--checkbox-and-switch",
  instrumentPanelDashboard: "data-instrumentpanel--as-a-dashboard",
  instrumentPanelSubtle: "data-instrumentpanel--why-subtle-is-banned",
  maskedValueDefault: "data-maskedvalue--default",
  datePickerSingle: "primitives-date-pickers--single",
  bareCalendar: "primitives-date-pickers--bare-calendar",
  sideNavInAShell: "primitives-sidenav--in-a-shell",
  tableAsAScreenUsesIt: "primitives-table--as-a-screen-uses-it",
  tableDefault: "primitives-table--default",
  tabsManyScrolling: "primitives-tabs--many-tabs-scrolling",
  tooltipClipped: "primitives-tooltip--clipped-by-a-scrolling-ancestor",
  tooltipPositions: "primitives-tooltip--positions",
  idsConstrained: "data-identifiers--constrained",
  screenLayout: "patterns-screen-scaffolding--layout",
  selectLongValues: "primitives-select--long-values",
  // `#sb-long` lives here, not on `LongValues` — that story's own
  // `SelectTrigger` carries no `id` at all (a bare, unlabelled `Select`).
  selectDisabledAndScrolling: "primitives-select--disabled-and-scrolling",
  selectInsideADrawer: "primitives-select--inside-a-drawer",
  statusPillQuietVersusLoud: "status-statuspill--quiet-versus-loud",
  tokensSprings: "foundations-tokens--springs",
} as const;

export type StoryKey = keyof typeof STORY;
