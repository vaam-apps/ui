import type { Preview } from "@storybook/react-vite";
import "./preview.css";

/**
 * Dark is the only theme this package ships, so the decorator stamps it
 * rather than offering a toolbar switch. The attribute is set explicitly
 * even though the theme also declares `prefersdark`, so a story renders
 * the same whatever the viewer's OS is set to — a screenshot in a bug
 * report should not depend on the reporter's system preference.
 */
const THEME = "dark";

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    // The theme paints its own background; Storybook's would sit on top of
    // it and make every surface token read wrong.
    backgrounds: { disable: true },
    a11y: { config: { rules: [{ id: "color-contrast", enabled: true }] } },
  },
  decorators: [
    (Story) => {
      document.documentElement.setAttribute("data-theme", THEME);
      return Story();
    },
  ],
};

export default preview;
