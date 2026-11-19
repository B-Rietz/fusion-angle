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

## Part two: one look for every displayed id

The operator's rule: call a thing a thing, in both its
id and how it is shown. Today the eight places that show
an id use five looks. Work order and Instance labels come
from helpers, while Token, Account, and Chain are typed
inline.

### Decided

- **The id text looks the same everywhere (A, chosen by
  the operator).** One presenter helper renders
  `<Thing> <id>`. The id sits in one monospace element
  with one class, and the whole id is always in the
  markup. When space runs short, CSS clips it with an
  ellipsis, so copy, search, and screen readers still get
  the whole id. Each site keeps its surroundings (header
  badge, row, link, heading), because those say what the
  element does. B, one badge everywhere, was rejected
  because it hides which ids are clickable.
- **Clickable wherever it makes sense (operator).** The
  calls:

| Id | Site | Clickable |
|---|---|---|
| Work order | inbox rows | already: the row opens it |
| Work order | record detail | already a link |
| Work order | its own header | no: current page |
| Instance | work order binding badge | new: record detail of its record type, scrolled to that instance's row |
| Instance | record detail rows | no: current page |
| Parent token | identity tokens | new: in-page jump to the parent's row, only when that row is on the page |
| Token, Chain | identity tokens | no: current page |
| Account | identity providers | no: the provider's account has no page here |

### Left to the builder (part two)

- The helper's name and module. It returns `SafeHtml`
  and replaces `workOrderLabel` and `instanceLabel`.
- The class name and its stylesheet home, per
  DESIGN-SYSTEM.md; no inline style.
- How record detail receives the instance to scroll to
  (fragment or query), and the anchor id each token row
  carries.

## Left to the builder

- Order of the commits, red test first at each layer.
- Whether a test pins that a `display_id` body 400s
  at the document PUT and the create POST.
- The wrap of a 22-character id in a narrow inbox row,
  within DESIGN-SYSTEM.md's tokens.
