/**
 * The masking rule behind [`MaskedValue`], in its own module so it can be
 * unit-tested without becoming public API.
 *
 * `src/index.ts` re-exports `components/data/masked-value` with
 * `export *`, so a function exported from there — exported purely so a
 * test could reach it — lands on this library's public surface, under one
 * of the most generic names available. `src/index.ts` exports `src/lib`
 * *selectively* (`cn`, `money`, `omitUndefined`) and does not re-export
 * this file, so `maskSecret` is reachable from the component and from its
 * test and from nowhere else. Testability should not widen an API.
 */

const DOT = "•";

/** The run length used whenever anything is hidden. Fixed rather than
 * derived from `hiddenCount` — see the comment in `maskSecret` below. */
const HIDDEN_RUN_LENGTH = 8;

export function maskSecret(value: string, prefix: number, reveal: number): string {
  const head = value.slice(0, prefix);
  const tail = reveal > 0 ? value.slice(-reveal) : "";
  const hiddenCount = Math.max(value.length - head.length - tail.length, 0);
  // A fixed run of dots — the same length no matter how many characters
  // are actually hidden, not one per character and not scaled to
  // `hiddenCount`. `Math.min(Math.max(hiddenCount, 6), 12)` used to sit
  // here, which reads as "clamp to a fixed range" but is the identity
  // function on exactly [6, 12]: any secret with 6 to 12 hidden characters
  // — the common case for a masked API key or token — produced a dot run
  // equal to its own length, disclosing the exact character count to
  // anyone looking over a shoulder. A single constant run closes that:
  // the dot count now carries no information about `hiddenCount` at all.
  const dots = hiddenCount === 0 ? "" : DOT.repeat(HIDDEN_RUN_LENGTH);
  return `${head}${dots}${tail}`;
}
