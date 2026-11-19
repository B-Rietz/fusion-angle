# Retire the work order display id

## Intent

The work order detail page at
`/workbox/detail.html?id=wrVS6q_Zsd8ILhGFyG1-zg` shows
`Work order dd9d1e4a`. Both name the same work order,
but nothing on the page says so: the badge shows
`display_id`, the first four SHA-256 bytes of the
work order's id as hex, minted at create since
2026-04-05 (`ee63c6f65`). A hash is one-way; no one,
the product included, can read the id back from it.
The page and its URL disagree. Call a thing a thing:
the work order's name is its id.

`display_id` is also a stored copy of a value
derivable from `id`, and the mock data already drifts
from the rule: `api/mock-data/flow-workload.ts` mints
a random 8-character string, and
`api/mock-data/work-orders.ts` hand-writes values such
as `c3e5g7b9` that are not hex. Two truths, neither
derivable from the other.

## Goals

- Every site that shows a work order's display id
  shows the work order's full id instead:
  `Work order wrVS6q_Zsd8ILhGFyG1-zg`, the same string
  as the page URL's `id`.
- `display_id` leaves the system: no write carries it,
  no read serves it, no validator accepts it.

## Non-goals

- No change to how work order ids are minted.
- No change to the `Work order <value>` label form or
  to `Instance <id>`.
- No bind-at-create (`TODO.md`, "Bind the record
  instance at work order creation") — a separate unit.

## Anti-goals

- An abbreviated id (`wrVS6q_Z…`): still a second
  spelling of the name.
- A read path that tolerates a stored `display_id`.
  fusionangle.com is wiped and reseeded after this
  lands, so no stored version carries the key.

## Approaches

- **A, chosen by the operator:** show the full id.
  Matches the URL exactly, copies, and searches.
  Wider in inbox rows.
- B: show the first 8 characters. Compact, but an
  abbreviation the reader must match against the URL.
- C: keep the hash, add the id beside it. Two names
  for one thing.

## Sites

| Layer | Site | Change |
|---|---|---|
| Wire | `shared/types.ts` `WorkOrderFieldsEntity` | drop `display_id` |
| API | `api/validators.ts` document body and version keys, both pickers | drop the key; a body carrying it 400s |
| API | `api/work-order-version.ts` `ordered`, `sameFields` | drop the key |
| API | `api/work-order-search.ts` `workOrderFieldsOf` | drop the field; `order.id` already matches by substring |
| Client | `client/work-orders-mutations.ts` | drop `generateDisplayId` and both writes |
| Client | `client/work-orders-queries.ts` | drop `displayId` |
| Pages | `workbox-detail.ts` header badge | `workOrderLabel(id)` |
| Pages | `workbox-inbox.ts` both row paths | `workOrderLabel(id)` |
| Pages | `record-detail.ts` work order links | `workOrderLabel(id)` |
| Pages | `web-app/app/format.ts` `workOrderLabel` | parameter names the id |
| Seed | `api/mock-data/flow-workload.ts`, `work-orders.ts` | drop `display_id` |
| Docs | `API.md` search fields, `ARCHITECTURE.md` work order keys, `TEST-PLAN.md` display id cases, generated API docs | drop the display id |

## Constraints

- RFC 9110 and the foreign-id rules are untouched; the
  validators' only-keys gate is what makes a stale
  `display_id` body a 400.
- After the merge, the operator wipes and reseeds
  fusionangle.com (`./deploy --render TOKEN --postgres
  mock-data`); any stored version still carrying
  `display_id` fails its read validator until then.

## Left to the builder

- Order of the commits, red test first at each layer.
- Whether a test pins that a `display_id` body 400s
  at the document PUT and the create POST.
- The wrap of a 22-character id in a narrow inbox row,
  within DESIGN-SYSTEM.md's tokens.
