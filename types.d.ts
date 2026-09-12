/**
 * Side-effect imports of stylesheets.
 *
 * TypeScript 7 reports `TS2882: Cannot find module or type declarations
 * for side-effect import` on `import "./preview.css"`, where 5.9 accepted
 * it silently. The bundler resolves these; the compiler only needs to be
 * told the module exists and exports nothing.
 *
 * Only `.css` is declared. Adding a catch-all for every asset extension
 * would silence real missing-module errors along with this one.
 */
declare module "*.css";
