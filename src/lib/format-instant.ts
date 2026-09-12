/**
 * The two instant formatters behind [`StateTimeline`], in their own module
 * so they can be unit-tested without becoming public API.
 *
 * They were briefly exported from `state-timeline.tsx` purely so a test
 * could reach them — and that file is `export *`d from `src/index.ts`, so
 * `formatAbsolute` and `formatElapsed`, two of the most generic names
 * available, landed on this library's published surface beside
 * `formatMoney`. Two reviewers caught it independently, and the module
 * that makes the same argument in the same commit is `mask-secret.ts`:
 * testability must not widen an API. `src/index.ts` exports `src/lib`
 * selectively and does not list this file.
 */

const SHORT_OFFSET = /^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/;

/**
 * `2026-09-11 14:03:07 +01` — sortable, unambiguous, and carrying its own
 * offset so a screenshot pasted into a ticket is still interpretable.
 *
 * The offset is read out of `Intl`'s own `shortOffset` part rather than
 * assumed from the zone name: it is the only way to be right across DST
 * and across zones this component has never been told about. `UTC` keeps
 * its conventional `Z` rather than the `GMT` that `shortOffset` yields —
 * checked by parsing the offset rather than by string equality, because
 * `UTC` is not the only zone `shortOffset` reports as zero (`GMT+0`, no
 * sign-and-digits group, is the same case).
 */
export function formatAbsolute(iso: string, timezone: string): string {
  const date = new Date(iso);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "shortOffset",
  });
  const parts = formatter.formatToParts(date);
  const stamp = parts
    .filter((part) => part.type !== "timeZoneName" && part.type !== "literal")
    .reduce<string[]>((acc, part) => {
      acc.push(part.value);
      return acc;
    }, []);
  const [year, month, day, hour, minute, second] = stamp;
  const raw = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  const offset = formatOffset(raw);
  return `${year}-${month}-${day} ${hour}:${minute}:${second} ${offset}`;
}

/**
 * `"GMT+1"` → `"+01"`, `"GMT+5:30"` → `"+05:30"`, `"GMT+0"` / `"GMT"` →
 * `"Z"`. Parses `SHORT_OFFSET` rather than patching the string: a
 * suffix-anchored regex (`/^([+-])(\d)$/`) never matches a zone with a
 * minutes component, which is exactly why `Asia/Kolkata`'s `"GMT+5:30"`
 * used to come out as the un-padded `"+5:30"` instead of `"+05:30"`.
 */
function formatOffset(raw: string): string {
  const match = SHORT_OFFSET.exec(raw);
  if (match === null) {
    // A string `shortOffset` is not documented to produce. Render it
    // verbatim rather than falling back to `Z`.
    //
    // The fallback matters more than the case does. Every offset this
    // component has been shown resolving — and every one ICU documents —
    // matches the grammar above, so this branch should be unreachable.
    // But "unreachable, therefore return the most plausible value" is how
    // a stamp ends up claiming UTC for a zone that is not UTC, which is
    // precisely the class of silent wrongness the rest of this file
    // exists to prevent (see `formatElapsed` on why a backwards delta is
    // not clamped to zero, and `formatMoney` on why an unsafe integer
    // throws rather than being laundered). An unfamiliar suffix in a
    // screenshot is a question; a wrong `Z` is a wrong answer.
    return raw;
  }
  const [, sign, hours, minutes = "00"] = match;
  if (sign === undefined || hours === undefined) return "Z";
  if (Number(hours) === 0 && Number(minutes) === 0) return "Z";
  return `${sign}${hours.padStart(2, "0")}${minutes === "00" ? "" : `:${minutes}`}`;
}

/**
 * `elapsedMs` is a raw subtraction of two caller-supplied ISO strings —
 * `new Date(transition.at).getTime() - new Date(previous.at).getTime()`,
 * with no ordering or well-formedness guarantee. `formatElapsed` used to
 * assume a non-negative input, so an out-of-order pair rendered the
 * nonsensical `"+-5000ms"` and a malformed date rendered `"+NaNh NaNm"`.
 *
 * Both are handled explicitly rather than clamped away: `NaN` renders an
 * em dash, and a negative delta renders with its real sign (e.g.
 * `"-5.000s"`). Clamping a negative to zero would hide an ordering bug in
 * the caller's data — silent wrongness of exactly the kind this codebase
 * argues against elsewhere (see `formatMoney`'s own refusal to round a
 * bad input into a plausible-looking one).
 */
export function formatElapsed(ms: number): string {
  if (Number.isNaN(ms)) return "—";
  const sign = ms < 0 ? "-" : "+";
  const abs = Math.abs(ms);
  if (abs < 1000) return `${sign}${abs}ms`;
  if (abs < 60_000) return `${sign}${(abs / 1000).toFixed(3)}s`;
  const totalSeconds = Math.round(abs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${sign}${minutes}m ${String(seconds).padStart(2, "0")}s`;
  const hours = Math.floor(minutes / 60);
  return `${sign}${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}
