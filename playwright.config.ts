import { defineConfig, devices } from "@playwright/test";

/**
 * The real-browser gate, run against a **built** Storybook.
 *
 * # Why this exists next to two gates that already pass
 *
 * `contrast.test.ts` parses the stylesheet; `a11y.test.tsx` mounts
 * components in jsdom. Both are fast, both are load-bearing, and both are
 * blind to the same class of defect, which `a11y.test.tsx`'s own doc
 * lists: no contrast *in situ*, no "is the focus ring actually visible",
 * no "is this clipped by an ancestor's overflow", no hit-target size.
 *
 * That is not a hypothetical list. Every item on it has cost this package
 * a real bug, found by a person looking at a render:
 *
 * - `SideNav`'s icon rail had a tooltip clipped by a scrolling ancestor
 *   and a stray horizontal scrollbar, for its whole life.
 * - `Button size="icon"` was not circular — twice, and the second time a
 *   test asserting the class string passed while the radius was 12px.
 * - The tiny-screen rail shipped 16×32px tap targets while the comment
 *   above it claimed 40px.
 * - A sticky dialog header pinned 24px below the scrollport, with the
 *   body sliding visibly past above it.
 *
 * Every one of those was invisible to jsdom by construction, because
 * jsdom has no layout. This runs the same components in Chromium, where
 * `getBoundingClientRect` returns real numbers.
 *
 * # Why a built Storybook rather than the dev server
 *
 * `storybook build` is what CI already produces for Pages, and it is what
 * a consumer ends up reading. Testing the dev server would test Vite's
 * HMR pipeline as much as the components. `webServer` below serves the
 * static build, so a broken build fails here rather than in a later job.
 *
 * # Why Chromium only
 *
 * The assertions are geometry, computed style and focus behaviour, not
 * rendering-engine differences — and a three-browser matrix on every push
 * buys little against a library whose consumers are internal operator
 * consoles. Adding WebKit later is a `projects` entry, not a rewrite.
 */
export default defineConfig({
  testDir: "./e2e",
  // A story that needs a retry is a story with a race in it, and this
  // suite is meant to catch races rather than paper over them.
  retries: 0,
  fullyParallel: true,
  // CI machines are slower and the failure is otherwise a confusing
  // timeout rather than a clear assertion.
  timeout: process.env.CI ? 30_000 : 15_000,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: "http://127.0.0.1:6100",
    // Deterministic geometry: several assertions here are about what fits
    // at a given width, so the viewport cannot be whatever the runner
    // happens to default to.
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // `--yes` so a missing `http-server` in a clean CI cache does not turn
    // into an interactive prompt that hangs the job.
    command: "npx --yes http-server storybook-static -p 6100 --silent",
    url: "http://127.0.0.1:6100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
