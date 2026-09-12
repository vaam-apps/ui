# The status system

This is the main integration point. Everything else in the library is
components; this is the part your application declares.

## Declare it once, as data

```ts
import { defineStatusSystem, createStatusPill } from "@vaam-apps/ui";

export const PAYMENT_STATUS = defineStatusSystem({
  pending: {
    family: "in-flight", silhouette: "circle", mark: "pie-1",
    hue: "progress", filled: false, attention: "quiet",
    label: "Pending",
    tooltip: "Sent to the provider. Waiting for them to confirm.",
  },
  paid: {
    family: "terminal", silhouette: "circle", mark: "check",
    hue: "success", filled: true, attention: "quiet",
    label: "Paid",
    tooltip: "The provider confirmed the transfer.",
  },
  failed: {
    family: "terminal", silhouette: "circle", mark: "cross",
    hue: "danger", filled: true, attention: "loud",
    label: "Failed",
    tooltip: "The provider rejected it. Nothing was moved.",
  },
});

export const PaymentPill = createStatusPill(PAYMENT_STATUS);
```

`defineStatusSystem` is identity at runtime and exists for inference:
with it, `createStatusPill(PAYMENT_STATUS)` accepts exactly those keys and
no others. Without it you would annotate `StatusSystem<"pending" | …>` and
repeat every key.

**The table belongs to the application**, because what a state *means* is
domain knowledge. The library owns the vocabulary and the rendering.

## The fields

| Field | What it controls |
|---|---|
| `hue` | The colour, from a closed set of eight. What *kind* of state this is. |
| `attention` | `quiet` or `loud`. Whether the row should pull the eye. |
| `filled` | Whether the silhouette is solid. Answers "is it over?" in greyscale. |
| `silhouette` | `circle` / `diamond` / `square`. |
| `mark` | The interior glyph. |
| `label` | Human-facing name. Sentence case, never the raw enum literal. |
| `tooltip` | One or two sentences: what this means and what happens next. |
| `family` | `in-flight` / `unresolved` / `terminal`. Metadata; nothing renders it. |

`StatusHue` is exactly: `neutral`, `progress`, `success`, `warning`,
`danger`, `uncertain`, `expired`, `parked`. There is no ninth, and adding
a colour outside this set is the thing this system exists to prevent.

Note `progress` — use it for "running, outcome not yet known", the state a
state machine spends most of its time in. Reaching for `neutral` there
means "still moving" and "over, and there is nothing to say" share a
colour.

## Choosing `attention`

`loud` paints a tinted background and a border; `quiet` is a glyph and a
label. **Most states are quiet.** If every row is loud, nothing is —
reserve it for states a person must act on. A table of forty rows with
six loud ones reads instantly; one with forty reads as noise.

## Rendering

- **`StatusPill`** — glyph + label, optionally the raw enum `literal` and
  a `detail` (an error code, a provider response). Its accessible name is
  built from its content, so whatever you put in `detail` is announced.
- **`StateChip`** — compact, for dense tables.
- **`StateMark`** — the glyph alone, `aria-hidden`, for when a nearby
  label already says the word.

## Three redundant channels, on purpose

Shape, fill and colour all carry the state, so a reader who does not
perceive the hue — colour vision deficiency, a greyscale screenshot
pasted into a ticket, a bad monitor — still gets the answer from the
silhouette and whether it is filled. Do not "simplify" a status system by
making every state a circle and letting colour do the work alone.
