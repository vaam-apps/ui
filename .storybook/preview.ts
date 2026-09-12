import type { Preview } from "@storybook/react-vite";
import { themes } from "storybook/theming";
import "./preview.css";

/**
 * `theme.css` now ships two themes, and a bug report's screenshot still
 * should not depend on the reporter's OS — that reasoning from the
 * previous hard-stamped `data-theme="dark"` decorator hasn't changed.
 * What has is that "dark, always" is no longer the only thing worth
 * seeing: a story can carry a light-theme regression a dark-only preview
 * would never surface. So this is a **toolbar control** instead of a
 * hard stamp — every story can be viewed in either theme on demand — with
 * the default pinned to `"dark"` via `initialGlobals`, which keeps a
 * fresh Storybook load exactly as deterministic as the old decorator was.
 *
 * The shape here (`globalTypes` + a `globals`-reading decorator) is
 * Storybook 10's real API for a global toolbar control, not guessed at:
 * confirmed by reading the installed package's own `.d.ts` output
 * (`storybook/dist/chunk-DdLFxT9J.d.ts`'s `ProjectAnnotations` —
 * `initialGlobals?: Globals` and `globalTypes?: GlobalTypes`, where a
 * `GlobalTypes` value's `toolbar` field is `ToolbarConfig` — rather than
 * assumed from memory or an older major's docs. This repository
 * typecheck's its `.storybook` directory (see `tsconfig.json`'s
 * `include`), which is what caught `docs.autodocs` — a key removed in
 * Storybook 10 and silently ignored ever since in a sibling package that
 * does not typecheck this directory. The same guard would catch a
 * `globalTypes`/`initialGlobals` shape this installed version no longer
 * accepts.
 *
 * # Precedence against `ThemeSwitcher`'s own stories
 *
 * `ThemeSwitcher` (`theme-switcher.tsx`) sets this same `data-theme`
 * attribute itself, from its own effect, whenever one is mounted — that
 * story is specifically about demonstrating the control re-theming the
 * page, so it has to win there, deterministically, not by an accident of
 * effect ordering against this decorator. `theme-switcher.stories.tsx`
 * opts its stories out via `parameters.theme.ownedByStory`, checked
 * below, so this decorator steps back and never stamps `data-theme` for
 * them at all. Every other story in this Storybook has no theme control
 * of its own, so the toolbar remains the sole writer everywhere else.
 */
const preview: Preview = {
  initialGlobals: { theme: "dark" },
  globalTypes: {
    theme: {
      description: "Theme",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "dark", title: "Dark", icon: "circle" },
          { value: "light", title: "Light", icon: "circlehollow" },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    // The theme paints its own background; Storybook's would sit on top of
    // it and make every surface token read wrong.
    backgrounds: { disable: true },
    // Dark docs chrome, because this is a dark-first library and the
    // default is not. Without it a documentation page frames dark
    // component demos in a light page — the demos read as islands, and
    // the contrast between chrome and content is the first thing a reader
    // notices about a page whose subject is contrast.
    //
    // This themes the Storybook *chrome* only (prose, tables, code
    // blocks). What the components themselves resolve is the library's
    // own `data-theme`, which the toolbar below still switches.
    docs: { theme: themes.dark },
    a11y: { config: { rules: [{ id: "color-contrast", enabled: true }] } },
  },
  decorators: [
    (Story, context) => {
      // See this file's doc comment, "Precedence against `ThemeSwitcher`'s
      // own stories" — those stories own the attribute themselves and opt
      // out of this stamp via this parameter.
      if (!context.parameters.theme?.ownedByStory) {
        document.documentElement.setAttribute("data-theme", context.globals.theme ?? "dark");
      }
      return Story();
    },
  ],
};

export default preview;
