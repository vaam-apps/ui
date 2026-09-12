import { useSyncExternalStore } from "react";

/**
 * Live `(prefers-reduced-motion: reduce)` state, via `useSyncExternalStore`
 * over `matchMedia` — so a change made *while the page is open* (the OS
 * settings panel, not just a fresh load) actually reaches components that
 * gate an animation on it, and so Storybook's own reduced-motion toolbar
 * emulation (which flips the media query live, not by reloading) has
 * something to re-render.
 *
 * # Why this isn't `toast.ts`'s module-store shape
 *
 * `toast.ts` and `theme-switcher.tsx` both keep mutable state at module
 * scope — a `toasts` array, a `preference` string — because their value
 * isn't recoverable from a single synchronous read: `toasts` is a list
 * nothing else remembers, and `theme-switcher`'s `preference` comes from
 * `localStorage`, a read worth doing exactly once and caching (`ensureLoaded`).
 *
 * `matchMedia(query).matches` has neither problem — it *is* the live
 * value, synchronously, every time — so `getSnapshot` below just asks the
 * browser again rather than maintaining a cached copy of the answer. One
 * `MediaQueryList` and one `"change"` listener per mounted hook instance,
 * which is what `theme-switcher.tsx`'s own `subscribe` does for the same
 * query. A boolean also compares equal with `Object.is` on its own, so —
 * unlike `theme-switcher.tsx`'s joined `"system:dark"` string, needed only
 * because two independent fields had to survive one snapshot — no packing
 * is needed here either.
 *
 * # SSR
 *
 * `getServerSnapshot` returns `false` (motion allowed): the server cannot
 * know the visitor's OS setting, and unlike `theme-switcher.tsx`'s dark
 * flash — which is genuinely wrong-until-corrected and worth a blocking
 * inline script — an animation that plays for one extra frame on a
 * reduced-motion visitor's very first paint before this hook's post-hydration
 * re-check corrects it is a cosmetic, one-time gap, not a page that reads
 * broken. No init script is warranted for that.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function getSnapshot(): boolean {
  try {
    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
  } catch {
    // matchMedia missing or blocked (an org policy, an odd embedding
    // webview) — fail open to "motion allowed", the same default
    // `getServerSnapshot` uses, rather than throwing out of a render.
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(onStoreChange: () => void): () => void {
  let mediaQuery: MediaQueryList | null = null;
  try {
    mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    mediaQuery.addEventListener("change", onStoreChange);
  } catch {
    // Same fallback as `getSnapshot`: reduced-motion preference just
    // won't live-update in this environment. `getSnapshot`'s own
    // try/catch still resolves correctly on every render it is called.
  }
  return () => {
    mediaQuery?.removeEventListener("change", onStoreChange);
  };
}
