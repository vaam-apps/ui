import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";

/**
 * Storybook is this package's visual-QA surface, and it replaces a
 * hand-written `/gallery` route that used to live inside the consuming
 * application.
 *
 * That route is worth a sentence, because its failure mode is the reason
 * these stories exist at all. It claimed, in its own doc, to render
 * "every export — a gallery that silently drops an export is a QA surface
 * with a blind spot", and an audit found thirteen it had never mounted,
 * among them the three components carrying live rendering bugs nobody had
 * seen. A gallery in another repository, maintained by hand, drifts from
 * the library the moment someone adds a component and forgets. Colocating
 * a story beside its component does not make that impossible, but it
 * makes it visible in the same diff.
 */
const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  // `@storybook/addon-essentials` does not exist past 8.6.14; `addon-docs`
  // replaces its docs half, and the controls/actions/viewport panels are
  // core Storybook 9+ features rather than addons. Same set the sibling
  // @vpay/ui installation settled on.
  addons: ["@storybook/addon-a11y", "@storybook/addon-docs"],
  framework: { name: "@storybook/react-vite", options: {} },
  // No `docs: { autodocs: "tag" }` here. Storybook 10's `DocsOptions` is
  // `{ defaultName?, docsMode? }` — `autodocs` was removed and is now a
  // per-story tag. Left in a config it is silently ignored, which is how
  // the sibling @vpay/ui installation still carries it: that repository
  // does not typecheck its `.storybook` directory, so nothing told it.
  // This one does (see tsconfig.json's `include`), which is what caught it.
  viteFinal: (viteConfig) => {
    // The components are styled entirely by Tailwind v4 + daisyUI, so
    // Storybook needs the same pipeline the consuming app has. Without
    // it every story renders unstyled — the identical silent failure the
    // README warns consumers about for a missing `@source`.
    viteConfig.plugins = [...(viteConfig.plugins ?? []), tailwindcss()];
    return viteConfig;
  },
};

export default config;
