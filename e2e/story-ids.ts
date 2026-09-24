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
  // Two more reveal/copy pairs than `Default` has, and the reason
  // `e2e/tap-targets.spec.ts`'s compact-collision gate covers every story
  // that renders one of these controls rather than one story: the claim
  // was "exactly one known pair in the whole library" while this story
  // sat next door with two more of it.
  maskedValueVariants: "data-maskedvalue--variants",
  // Every story where a `CopyButton` is the last thing in a row and sits
  // flush to its container's right edge — the shape whose D11 overlay
  // grew `document.scrollWidth` past the viewport at comfortable
  // (`e2e/overflow.spec.ts`, `e2e/tap-targets.spec.ts`).
  detailVariants: "data-detail-and-summary--variants",
  detailMixedVariants: "data-detail-and-summary--mixed-variants-in-one-column",
  detailCardsAndBadges: "data-detail-and-summary--cards-and-badges",
  detailTiles: "data-detail-and-summary--tiles",
  idsCodeAndCopy: "data-identifiers--code-and-copy",
  idsPhones: "data-identifiers--phones",
  idsTableAndFull: "data-identifiers--table-and-full",
  // A long title on a narrow panel, which is how `DialogHeader`'s own
  // density-aware gutter is measured: the title's layout box must stop
  // before `DialogClose`'s 48px target begins.
  dialogWithLongTitle: "primitives-overlays--dialog-with-long-title",
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
  // Below 640px `SelectContent` is an M3 modal bottom sheet; both stories
  // open it from their play function (`e2e/select-sheet.spec.ts`).
  selectPhoneSheet: "primitives-select--phone-bottom-sheet",
  selectPhoneSheetShort: "primitives-select--phone-bottom-sheet-short-list",
  selectInsideAPlainDrawer: "primitives-select--inside-a-plain-drawer",
  // `SideNav`'s floating toolbars, one per M3 colour scheme, over real
  // content (`e2e/floating-toolbar.spec.ts`).
  sideNavToolbarStandard: "primitives-sidenav--toolbar-colors-standard",
  sideNavToolbarVibrant: "primitives-sidenav--toolbar-colors-vibrant",
  // A phone `Select` in a `sticky` header with the toolbar on screen; its
  // play function opens the sheet.
  sideNavToolbarUnderASheet: "primitives-sidenav--toolbar-under-a-phone-sheet",
  statusPillQuietVersusLoud: "status-statuspill--quiet-versus-loud",
  tokensSprings: "foundations-tokens--springs",
} as const;

export type StoryKey = keyof typeof STORY;
