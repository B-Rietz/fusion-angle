# Label displayed ids

## Intent

An id the app shows must say what it identifies. The work
order detail page shows `#6a7f72c0` under the flow name:
the `#` is noise, and nothing says the value is a work
order's. Call a thing a thing, everywhere the app shows an
id.

## Goals

- No `#` prefix on any displayed id.
- Every displayed id reads `<Thing> <value>`, the form the
  work order binding badge already uses (`Instance <id>`).

## Non-goals

- No change to how ids are made, stored, or sent; the
  display id stays the first four SHA-256 bytes of the
  work order's id, as hex.
- No change to `data-*` attributes, element ids, or
  `title` text.

## Anti-goals

- A generic `ID 6a7f72c0` that names the format and not
  the thing.

## Approaches

- **A, chosen:** `Work order 6a7f72c0`. Names the thing;
  matches the existing `Instance <id>` badge.
- B: `Work order ID 6a7f72c0`. The value already reads as
  an id; the word is redundant.
- C: `ID 6a7f72c0`. Breaks "call a thing a thing".

The label stays even where a heading already names the
thing ("Work orders using this Record"), so the rule
holds without exception.

## Sites

| Page | Today | After |
|---|---|---|
| Work order detail header badge | `#6a7f72c0` | `Work order 6a7f72c0` |
| Workbox inbox, both row paths | `#6a7f72c0` | `Work order 6a7f72c0` |
| Record detail, work order links | `#6a7f72c0` | `Work order 6a7f72c0` |
| Record detail, instance row | bare id | `Instance <id>` |
| Record detail, instance edit header | bare id | `Instance <id>` |
| Identity tokens, event row | bare jti | `Token <jti>` |
| Identity tokens, parent line | `parent: <jti>` | `Parent token <jti>` |
| Identity providers, event row | bare provider subject | `Account <subject>` |
| Identity tokens, chain heading | `Chain <id>` | unchanged |
| Work order detail binding badge | `Instance <id>` | unchanged |

`Parent token` with no parent keeps today's absent
marker: `Parent token —`.

## Left to the builder

- Whether the four work order sites share one presenter
  helper (Generality: four sites is past three) or each
  writes the text inline.
- Presenter tests pin the new text at each site, red
  before the change.
