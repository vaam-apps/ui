"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { cn } from "../../lib/cn";
import { RadioGroup, type RadioGroupOption } from "./radio-group";

/**
 * A control (and a headless hook) that switches `theme.css`'s two daisyUI
 * themes, `data-theme="dark"` / `data-theme="light"`, and remembers the
 * choice across visits.
 *
 * # Three states, not two
 *
 * `dark` carries `prefersdark: true` in `theme.css` — this package already
 * has an opinion about following the operator's OS setting. A plain
 * light/dark toggle can only ever represent an *explicit* choice, so the
 * moment a consumer wires one up, "follow my OS" stops being expressible
 * at all: the toggle has to start somewhere, and wherever it starts is a
 * decision the operator never made. A three-state `system / light / dark`
 * control costs one more option in the UI and, in exchange, keeps
 * `prefersdark` meaningful — "system" is a real, rememberable choice
 * rather than a spot the toggle happens to occupy for one page load.
 * `RadioGroup` is the right shape for it: three literal, always-visible
 * options is exactly the "small, fixed vocabulary" case its own doc
 * comment describes, and unlike a `Select` it does not need Headless UI's
 * portal-based `Listbox`.
 *
 * # SSR and the hydration mismatch
 *
 * The server cannot know a visitor's stored preference — there is no
 * `localStorage` during SSR — so the two renders (server HTML, first
 * client paint) must agree on *something* before either can see real
 * storage. `TimestampDisplay` hits the identical shape (server can't know
 * "now") and solves it with an explicit `hydrated` boolean: render the
 * server-safe value, flip a flag in `useEffect`, re-render.
 *
 * This does the same job through `useSyncExternalStore`'s third argument
 * instead, which is a closer fit here: `getServerSnapshot` supplies the
 * value used for *both* the server render and the first client render, so
 * the two are equal by construction and no manual flag is needed. Once
 * mounted, React re-invokes the client `getSnapshot` — which is the only
 * place `localStorage` is actually read — and if that differs from the
 * server guess (a returning visitor who had picked "light"), React
 * schedules the re-render itself. `toast.ts`'s module-level store is the
 * shape this borrows (mutable module state + a `Set` of listeners +
 * `emit()`); the addition here is the paired `getServerSnapshot`, and the
 * store's snapshot is a single joined string (`"system:dark"`) rather
 * than an object, because `useSyncExternalStore` requires a snapshot
 * that compares equal (`Object.is`) when nothing changed — a fresh object
 * literal returned from `getSnapshot` would compare unequal on every
 * render and the hook explicitly warns against that shape.
 *
 * The client `getSnapshot` also folds in `window.matchMedia`, so a live
 * OS-level scheme flip while the preference is `"system"` reaches the
 * same path: `subscribe` below attaches a `change` listener on the same
 * media query, and firing it re-runs `getSnapshot`. `subscribe` also
 * attaches a `storage` listener, for the same reason but a different
 * trigger: a preference change made in another tab never fires
 * `localStorage`'s own `storage` event on the tab that made it, only on
 * every other tab sharing the origin — so without this, a second tab
 * would desync from the first for the rest of its page life.
 *
 * # Persistence
 *
 * `localStorage`, under the namespaced key [`THEME_STORAGE_KEY`]. Every
 * read and write is wrapped in `try`/`catch` — Safari's private windows
 * throw on `setItem`, and some embedding webviews and org policies block
 * storage entirely. Losing persistence for the session is an acceptable
 * degradation; throwing out of a click handler is not.
 *
 * # The flash, and what it needs from the consumer
 *
 * None of the above can prevent one frame of the *wrong* theme painting
 * before React ever runs. The server has no `data-theme` attribute to
 * emit, so the browser paints `theme.css`'s own `default: true` theme
 * (`dark`) first; a visitor who chose `"light"` sees a dark flash until
 * this module's `useEffect` corrects the attribute after hydration. This
 * is not fixable from inside a React component — React cannot run before
 * the browser's first paint. The fix has to be a synchronous, blocking
 * script in the document `<head>`, before any stylesheet that paints a
 * surface colour. [`themeInitScript`] is exactly that script, exported so
 * a consumer can inline it:
 *
 * ```tsx
 * // app/layout.tsx (Next.js) — the script must be the first thing in
 * // <head>, before any stylesheet that paints a surface colour.
 * <html lang="en" suppressHydrationWarning>
 *   <head>
 *     <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
 *   </head>
 *   <body>{children}</body>
 * </html>
 * ```
 *
 * `suppressHydrationWarning` on `<html>` is not optional here, not a
 * defensive habit: this script mutates `data-theme` on that exact
 * element before React ever runs, so the attribute React observes during
 * hydration never matches the server-rendered markup for it. Omit the
 * prop and every single load logs a hydration-mismatch warning for an
 * attribute React did not itself put there. The prop only suppresses the
 * warning for that one element's own attributes/text — it does not
 * disable hydration checking for anything nested inside it, so scoping
 * it to `<html>` alone costs nothing else.
 *
 * Skipping this is a real, visible regression, not a cosmetic nit — say
 * so plainly to anyone integrating this component: **without the inline
 * script, every visitor who has chosen a non-default theme sees a flash
 * of the other one on every full page load.**
 */

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

/** Namespaced so this package's own preference cannot collide with a
 * consuming app's other `localStorage` keys. Exported so [`themeInitScript`]
 * and a consumer's own tooling can address the same key without
 * retyping it. */
export const THEME_STORAGE_KEY = "vaam-ui:theme";

const THEME_ATTRIBUTE = "data-theme";
const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    // Private window, disabled storage, or an org policy blocking it —
    // fall back to "system", the same experience a first-time visitor gets.
  }
  return "system";
}

function writeStoredPreference(next: ThemePreference): void {
  if (typeof window === "undefined") return;
  try {
    if (next === "system") {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    }
  } catch {
    // Same as above: losing persistence for the session is fine, throwing
    // out of a click handler is not.
  }
}

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia(DARK_MEDIA_QUERY).matches;
  } catch {
    // matchMedia missing/blocked — fall back to this package's own
    // documented default (`theme.css`: `dark` carries both `default: true`
    // and `prefersdark: true`).
    return true;
  }
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? (systemPrefersDark() ? "dark" : "light") : preference;
}

function applyDocumentTheme(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(THEME_ATTRIBUTE, resolved);
}

// Module-level store — same shape as `toast.ts`'s: mutable state plus a
// `Set` of listeners, notified by `emit()`. `preference` starts at
// `"system"` so an import that never mounts a component (or runs during
// SSR) is inert rather than reaching for `window` at module-evaluation
// time.
let preference: ThemePreference = "system";
let loaded = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

// `localStorage` is read exactly once, lazily, the first time the client
// `getSnapshot` below actually runs — which is guaranteed to be in the
// browser (the server always uses `getServerSnapshot` instead). This is
// the one place this module touches storage on load, and it deliberately
// is not a `useEffect`: an effect races with React's own post-hydration
// snapshot re-check, while a lazy read inside `getSnapshot` is exactly
// when that re-check calls it.
function ensureLoaded(): void {
  if (loaded) return;
  loaded = true;
  preference = readStoredPreference();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  let mediaQuery: MediaQueryList | null = null;
  try {
    mediaQuery = window.matchMedia(DARK_MEDIA_QUERY);
    mediaQuery.addEventListener("change", onStoreChange);
  } catch {
    // matchMedia unsupported/blocked: a "system" preference just won't
    // live-update on an OS flip. It still resolves correctly on the next
    // mount or reload, via `resolveTheme`'s own fallback.
  }
  // A second tab (or window) that changes the preference fires `storage`
  // here — `localStorage`'s own API never fires it on the tab that made
  // the write, only on every *other* tab sharing the same origin. Without
  // this listener, `ensureLoaded`'s `loaded` flag latches after this
  // tab's first read and this tab never learns storage disagrees with it
  // again for the rest of the page's life. `readStoredPreference` here is
  // called unconditionally, bypassing `loaded` on purpose — this is a
  // distinct, explicit refresh path, not a second copy of the lazy-load
  // gate.
  const onStorage = (event: StorageEvent): void => {
    // `event.key` is `null` for `localStorage.clear()`; otherwise only
    // react to this module's own key so an unrelated key elsewhere in the
    // same origin's storage doesn't trigger a spurious re-render.
    if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;
    preference = readStoredPreference();
    onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    mediaQuery?.removeEventListener("change", onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

// A single joined string rather than `{ preference, resolvedTheme }` —
// `useSyncExternalStore` compares snapshots with `Object.is`, so a fresh
// object literal on every call would never compare equal and the hook
// would re-render on every tick. A string does.
function getSnapshot(): string {
  ensureLoaded();
  return `${preference}:${resolveTheme(preference)}`;
}

// The store's real, current resolved theme — as opposed to whatever a
// particular render's closed-over `resolvedTheme` happens to hold, which
// during the first post-hydration render is still `getServerSnapshot()`'s
// guess. `ensureLoaded` is idempotent, so calling this outside of
// `getSnapshot` (an effect, an event handler) is always safe.
function currentResolvedTheme(): ResolvedTheme {
  ensureLoaded();
  return resolveTheme(preference);
}

// Used for the server render and, critically, for the very first client
// render too — matching it exactly is what keeps hydration mismatch-free
// (see the module doc's own section on this). `"dark"` here is a
// deliberate stand-in, not a fully accurate description of what an
// attribute-less page actually renders. `theme.css` gives `dark`
// `default: true`, so daisyUI's own `--color-base-*` tokens do resolve
// correctly with no `data-theme` attribute present. But every *custom*
// property this package defines lives under `[data-theme="dark"] { … }`
// with no `:root` fallback — measured with the attribute removed,
// `--surface-3` resolves to empty and `text-subtle-foreground` collapses
// to inherited `base-content`. So an attribute-less page is not actually
// "the dark theme" for this package's own tokens, only for daisyUI's;
// `"dark"` is used here only because it is the nearest available
// snapshot value. This gap is a further reason `themeInitScript` matters:
// it sets the real attribute before first paint instead of leaving the
// page to this fallback.
function getServerSnapshot(): string {
  return "system:dark";
}

/**
 * Sets the theme preference outside of React — the same path
 * [`useTheme`]'s returned `setPreference` calls. Exposed directly for a
 * consumer wiring up a keyboard shortcut, a settings-sync handler, or
 * anything else that isn't itself a component.
 *
 * `options.persist` (default `true`) gates only the `localStorage`
 * write — the document still re-themes immediately either way. Pass
 * `false` in a context that must not leave a preference behind after the
 * caller goes away, such as a Storybook story: a switcher mounted there
 * without this would write into Storybook's own `localStorage`, where it
 * outlives the story and silently overrides the theme toolbar on a later
 * load (see `theme-switcher.stories.tsx`).
 */
export function setThemePreference(next: ThemePreference, options?: { persist?: boolean }): void {
  loaded = true;
  preference = next;
  if (options?.persist ?? true) writeStoredPreference(next);
  applyDocumentTheme(resolveTheme(next));
  emit();
}

export interface UseThemeOptions {
  /** Default `true`. See [`setThemePreference`]'s option of the same
   * name. */
  persist?: boolean | undefined;
}

export interface UseThemeResult {
  /** What the operator asked for. */
  preference: ThemePreference;
  /** What is actually painted — `preference` with `"system"` resolved
   * against the OS media query. Use this to render "currently dark/light"
   * copy; use `preference` to render which control is checked. */
  resolvedTheme: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
}

/**
 * The headless half of this module: drives the same store `ThemeSwitcher`
 * renders, for a consumer building its own presentation (a settings page
 * row, a command-menu action, a keyboard shortcut) rather than reaching
 * for the packaged control. `ThemeSwitcher` itself is built on this hook
 * and adds nothing to the state it exposes.
 */
export function useTheme(options?: UseThemeOptions): UseThemeResult {
  const persist = options?.persist ?? true;
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const separator = snapshot.indexOf(":");
  const preferenceValue = snapshot.slice(0, separator) as ThemePreference;
  const resolvedTheme = snapshot.slice(separator + 1) as ResolvedTheme;

  // Keeps `<html data-theme>` in sync with whatever the store resolved to.
  // `setThemePreference` already applies it immediately for a same-frame
  // response to a click; this effect covers the two cases that don't go
  // through that function at all — the post-hydration correction (server
  // guessed `"dark"`, storage actually held `"light"`) and a live OS
  // scheme flip while the preference is `"system"`. Both only ever change
  // `resolvedTheme` via `emit()`/the media-query listener, never by
  // calling `setThemePreference`.
  //
  // Reads `currentResolvedTheme()` — the store's live value — rather
  // than applying the closed-over `resolvedTheme` argument directly. On
  // the very first post-hydration run, `resolvedTheme` is still
  // `getServerSnapshot()`'s guess (`"dark"`): `useSyncExternalStore`'s
  // own re-check effect, which is what corrects it, is a separate effect
  // scheduled independently of this one and is not guaranteed to have
  // already committed a re-render by the time this one runs. Applying
  // the guess here would overwrite whatever `themeInitScript` already
  // painted correctly before hydration — the exact flash that script
  // exists to prevent — for one real frame before the corrected value
  // lands. Reading the store directly sidesteps the stale argument
  // entirely; `ensureLoaded` is idempotent, so this is just as correct
  // on the later runs genuinely triggered by a `resolvedTheme` change.
  // `resolvedTheme` is a trigger here, not a value the body reads — the
  // body deliberately re-fetches its own value instead — so the linter
  // cannot see why it belongs in the dependency array.
  // biome-ignore lint/correctness/useExhaustiveDependencies: resolvedTheme drives *when* this re-runs (post-hydration correction, OS flip, cross-tab sync); the body reads the live store instead of this value on purpose, see the comment above.
  useEffect(() => {
    applyDocumentTheme(currentResolvedTheme());
  }, [resolvedTheme]);

  const setPreference = useCallback(
    (next: ThemePreference) => setThemePreference(next, { persist }),
    [persist],
  );

  return { preference: preferenceValue, resolvedTheme, setPreference };
}

/**
 * A synchronous, blocking script for the consumer's own document `<head>`
 * — see the module doc's "The flash" section for why this cannot be done
 * from inside React at all. Inline it verbatim, before any stylesheet, on
 * an `<html>` that carries `suppressHydrationWarning` (required, not
 * optional — see the module doc's integration snippet for the full
 * example and why):
 *
 * ```tsx
 * <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
 * ```
 *
 * It duplicates `readStoredPreference`/`resolveTheme`'s logic in plain
 * JS on purpose — it has to run before React, this package's bundle, or
 * even the document body exist, so it cannot import them.
 *
 * # Why this is one literal string and not a template
 *
 * It used to interpolate `THEME_STORAGE_KEY`, `THEME_ATTRIBUTE` and
 * `DARK_MEDIA_QUERY` via `JSON.stringify`, and advertised that as the
 * thing keeping it in lockstep with the constants. CodeQL flagged all
 * three as code construction from a non-literal value, and it is right
 * to: this string is handed to `dangerouslySetInnerHTML` and executed,
 * so every interpolation into it is a script-injection sink.
 *
 * Nothing was exploitable — all three are module constants — but the
 * exposure is one plausible refactor away. "Let a consumer namespace the
 * storage key" is an obvious future request, and the day someone makes
 * `THEME_STORAGE_KEY` a parameter, this template starts writing caller
 * input into executable code. Removing the sink is cheaper than
 * remembering not to create it.
 *
 * The lockstep guarantee did not go away with the interpolation; it got
 * stronger. `theme-switcher.init.test.ts` asserts the literal contains
 * each constant's exact JSON form, so a renamed key fails the build
 * rather than silently shipping a script that reads the wrong one — a
 * test where there used to be a comment, which is this package's habit
 * everywhere else a fact is written down twice.
 *
 * Never throws: the same private-window/blocked-storage cases
 * `readStoredPreference` guards against apply here too, and on failure it
 * leaves the attribute unset, which falls through to `theme.css`'s own
 * `default: true` theme (`dark`) — the same fallback the rest of this
 * module uses.
 */
export const themeInitScript =
  '(function(){try{var k="vaam-ui:theme";var s=window.localStorage.getItem(k);var p=s==="light"||s==="dark"?s:"system";var r=p==="system"?(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches===false?"light":"dark"):p;document.documentElement.setAttribute("data-theme",r);}catch(e){}})();';

const THEME_OPTIONS: readonly RadioGroupOption<ThemePreference>[] = [
  { value: "system", label: "System", description: "Match the OS setting" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export interface ThemeSwitcherProps {
  /** Defaults to `"Theme"`. Override when the surrounding UI already
   * labels this control (e.g. a `FormField` in `control="group"` mode). */
  "aria-label"?: string | undefined;
  className?: string | undefined;
  /** Default `true`. See [`useTheme`]'s option of the same name — pass
   * `false` in a context that must not persist the choice, such as a
   * Storybook story. */
  persist?: boolean | undefined;
}

/**
 * The packaged presentation of [`useTheme`] — a three-state `RadioGroup`
 * (see the module doc for why three states and why `RadioGroup`). Fully
 * keyboard-operable and focus-ringed for free, since it is built on
 * `RadioGroup` rather than a bespoke element.
 */
export function ThemeSwitcher({ className, persist, ...aria }: ThemeSwitcherProps) {
  const { preference, setPreference } = useTheme({ persist });
  return (
    <RadioGroup
      value={preference}
      onValueChange={setPreference}
      options={THEME_OPTIONS}
      aria-label={aria["aria-label"] ?? "Theme"}
      className={cn(className)}
    />
  );
}
