# Retire the Work Order Display Id Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Every work order badge shows the work order's
full id, and `display_id` leaves the system.

**Architecture:** Task 1 points the four badge sites at
the id the client already carries. Task 2 removes
`display_id` from the wire type, the one validator both
writes pass through (`validateWorkOrderDocumentBody`),
the stored-version validator, search, the client, the
seed, and every test fixture in one commit, because the
validators' only-keys gate rejects any fixture still
carrying it. Task 3 brings the docs in line.

**Tech Stack:** Deno 2.9.8, TypeScript, `@std/assert`.

**Spec:**
`docs/superpowers/specs/retire-work-order-display-id-design.md`

## Global Constraints

- Label form stays `Work order <value>`; `<value>` is the
  work order's full id, e.g.
  `Work order wrVS6q_Zsd8ILhGFyG1-zg`. No abbreviation.
- No read path tolerates a stored `display_id`; a body
  carrying it answers 400.
- No change to id minting, to `Instance <id>`, or to
  binding.
- 78-character lines in code, 4-space indent, commit
  subjects present-tense imperative ≈50 chars with the
  `Co-Authored-By` trailer only.
- Each commit runs
  `export DENO_DIR="$TMPDIR/deno-dir"; ./test validate --syntax`;
  Task 2 and Task 3 also run `./test`.

## Review Focus

1. A client still sending `display_id` (a stale tab
   holding an old bundle) on create or reorder: expect
   400, not 500 and not a silent drop. Pinned in Task 2,
   Step 1.
2. A GET of a work order: the body has no `display_id`
   key. Pinned in Task 2, Step 1.
3. Searching for a piece of the id: still finds the work
   order. The existing `whole work-order id` case in
   `tests/api-work-orders-query.test.ts` already pins
   this; Task 2 deletes the `#`-display-id case beside it.
4. The seeded lead-to-close workload changes: removing
   the `b62Id(rng, 8)` draw shifts the mulberry32 stream,
   so every later random value in
   `api/mock-data/flow-workload.ts` moves. A test pinning
   one of those values gets the new derived value, never
   a looser assertion. Task 2, Step 5.
5. A 22-character id in a narrow inbox row: the
   `truncate` class clips it with an ellipsis, while the
   text stays whole for copy, search, and screen
   readers. Never an inline style. Task 1, Step 3.

---

### Task 1: Badges show the work order id

**Files:**
- Modify: `web-app/app/format.ts` (`workOrderLabel`)
- Modify: `web-app/app/presenters/workbox-detail.ts`
  (`displayIdText`, header badge ~line 366)
- Modify: `web-app/app/presenters/workbox-inbox.ts`
  (`PlacedInboxItem`, `UnplacedInboxItem`, rows ~116 and
  ~224, item build ~264)
- Modify: `web-app/app/presenters/record-detail.ts`
  (~line 633)
- Test: `tests/presenter-workbox-detail.test.ts`,
  `tests/presenter-workbox-inbox.test.ts`,
  `tests/presenter-record-detail.test.ts`,
  `tests/workbox-inbox.test.ts`

**Interfaces:**
- Produces: `workOrderLabel(workOrderId: string): string`
  returning `'Work order ' + workOrderId`. Inbox items
  drop `displayId`; `WorkboxDetailPresenter` drops
  `displayIdText()`. The client `WorkOrder.displayId`
  still exists after this task; nothing in `web-app/`
  reads it.

- [ ] **Step 1: Write the failing tests**

In `tests/presenter-workbox-detail.test.ts`, rename the
header test to `'the header labels the work order by its
id'` and assert
`assertMatch(out, /Work order wo-1/)` and
`assert(!out.includes('WO-42'))`. In the getter test
`'WorkboxDetailPresenter exposes id, display id, and
flow name from the work order'`, drop the
`displayIdText()` assertion and the words `display id`
from its name.

In `tests/presenter-workbox-inbox.test.ts`, the placed
row asserts `'Work order <its id>'` (the fixture's `id`)
in place of `'Work order WO-1'`, and the unplaced row
likewise in place of `'Work order unplaced-7'`; each also
asserts the old display text is absent. Same for
`tests/workbox-inbox.test.ts:896`.

In `tests/presenter-record-detail.test.ts`,
`workOrderShown` takes the work order's id instead of a
display id; the test passes `'xqcXYHXBJJXcLkRYkRngKA'`
(WO01's seed id) and asserts
`/Work order xqcXYHXBJJXcLkRYkRngKA/`, and that
`a7c3e1f9` is absent.

- [ ] **Step 2: Run to verify they fail**

Run: `deno test --frozen --no-check tests/presenter-workbox-detail.test.ts tests/presenter-workbox-inbox.test.ts tests/presenter-record-detail.test.ts tests/workbox-inbox.test.ts`
Expected: FAIL on each `Work order <id>` assertion.

- [ ] **Step 3: Point every badge at the id**

`workOrderLabel` names its parameter `workOrderId`.
Header badge passes `this.idValue()`; delete
`displayIdText()`. Inbox rows pass `item.id`; delete
`displayId` from both item interfaces and the build.
Record detail passes `w.id`. The markup always carries
the full id. Where a row is too narrow, add the existing
`truncate` class (the identity token and provider rows
use it) so the browser clips with an ellipsis. Never
shorten the string itself.

- [ ] **Step 4: Run to verify they pass**

Run: the Step 2 command.
Expected: PASS. Then
`./test validate --syntax` — PASS.

- [ ] **Step 5: Commit**

```bash
git add web-app/app tests
git commit -m "Label work orders by their id"
```

---

### Task 2: Retire display_id

**Files:**
- Modify: `shared/types.ts:1262` (`WorkOrderFieldsEntity`)
- Modify: `api/validators.ts` (`WORK_ORDER_DOCUMENT_BODY_KEYS`
  ~1462, `validateWorkOrderDocumentBody` ~1495,
  `WORK_ORDER_VERSION_KEYS` ~1503,
  `validateWorkOrderVersion` ~1640)
- Modify: `api/work-order-version.ts` (`ordered` ~64,
  `sameFields` ~148)
- Modify: `api/work-order-search.ts:104`
- Modify: `client/work-orders-mutations.ts`
  (`generateDisplayId` and its `sha256Bytes` import,
  create body ~158, `putWorkOrderPosition` ~428 and its
  comment)
- Modify: `client/work-orders-queries.ts`
  (`WorkOrder.displayId`, `toWorkOrder`)
- Modify: `api/mock-data/work-orders.ts`,
  `api/mock-data/flow-workload.ts:109,215`
- Modify: `web-app/app/generate-api-documentation.ts:205`;
  regenerate `web-app/api-documentation/rooms.ts`
- Test: every file under `tests/` that
  `grep -rln "display_id\|displayId" tests` lists
  (about 40, including `tests/work-order-fixtures.ts`,
  `tests/store-acceptance.ts`, and
  `tests/browser/workbox-search.test.ts`)

**Interfaces:**
- Consumes: Task 1 (no `web-app/` reader of
  `displayId`).
- Produces: `WorkOrderFieldsEntity` is
  `{ id, organization_id, flow_graph, position }`;
  `WorkOrder` has no `displayId`;
  `validateWorkOrderDocumentBody` accepts only
  `flow_graph` and `position`.

- [ ] **Step 1: Write the failing tests**

In `tests/api-work-order-document.test.ts`, add:
- `'a document PUT carrying display_id answers 400'`:
  a valid If-Match PUT whose body adds
  `display_id: 'x'` → status 400.
- `'a work order GET serves no display_id'`:
  `assertEquals('display_id' in body, false)` on a
  created work order's GET.

In `tests/api-work-orders-create.test.ts`, add
`'a create whose workOrder carries display_id answers
400'`: the existing valid create body with
`workOrder.display_id: 'abcd'` → 400, and no work order
is stored (a GET on its id is 404).

- [ ] **Step 2: Run to verify they fail**

Run: `deno test --frozen --no-check tests/api-work-order-document.test.ts tests/api-work-orders-create.test.ts`
Expected: the two 400 tests FAIL (today the key is
required, so the bodies pass); the GET test FAILS on the
key's presence.

- [ ] **Step 3: Remove display_id from wire, API, client**

Delete the field from `WorkOrderFieldsEntity`, both key
lists, both pickers, `ordered`, `sameFields`, the search
field list, `toWorkOrder`, `WorkOrder`, the create body,
and `putWorkOrderPosition`. Delete `generateDisplayId`
and its now-unused import. Reword the
`putWorkOrderPosition` comment to name only the flow
graph.

- [ ] **Step 4: Sweep the fixtures and the seed**

Delete `display_id` / `displayId` from every test
fixture and from both mock-data files. In
`tests/api-work-orders-query.test.ts`, delete the
`'display id with its hash'` case from `FIELD_CASES` and
the `displayId` seed option it fed; the
`'whole work-order id'` case stays. In
`tests/mock-data-pairs.test.ts:632`, drop the key from
the expected list. Tests that asserted a stored display
id (e.g. `api-work-orders-create.test.ts:145`,
`api-work-order-document.test.ts:202`) delete that
assertion, because the covenant it named is gone.

- [ ] **Step 5: Re-key the browser search test and the
  workload**

In `tests/browser/workbox-search.test.ts`,
`workOrderOf(ctx, workOrderId)` finds by `wo.id`.
`CAPTURED` becomes the seed ids of the two work orders
whose display ids were `d0f2h4c6` and `e1g3i5d7` in
`api/mock-data/work-orders.ts`; read them before
Step 4 deletes the display ids. In
`flow-workload.ts`, delete the `b62Id(rng, 8)` draw.
`NOT_CAPTURED` then becomes the id of an
admin-available lead-to-close work order that the term
`capture` does not match. Find it by running
`generateFlowWorkload` after the change and checking it
against `searchMatchOf`. If any other test pins a
lead-to-close value that moved, update it to the newly
derived value and name the test in the task report.

- [ ] **Step 6: Regenerate the API docs**

Run: `./bin/generate-api-documentation`
Expected: `web-app/api-documentation/rooms.ts` no longer
contains `display_id`.

- [ ] **Step 7: Verify**

Run: `./test validate --syntax && ./test`
Expected: PASS, and
`grep -rn "display_id\|displayId\|generateDisplayId" api client shared server web-app tests`
prints nothing.

Run: `./test browser` when Chrome is available;
`tests/browser/workbox-search.test.ts` PASS. If Chrome is
not available, say so in the report.

- [ ] **Step 8: Commit**

```bash
git add -A api client shared web-app tests
git commit -m "Retire the work order display id"
```

---

### Task 3: Docs drop the display id

**Files:**
- Modify: `API.md:299` (search fields: drop
  `display id`)
- Modify: `ARCHITECTURE.md:402` (version keys) and
  `:450` (document PUT sets `flow_graph` and
  `position`)
- Modify: `TEST-PLAN.md` ~4460–4505 (the display id
  cases now read the work order id, `Work order <id>`)
  and `:7197` (WO01 named by its id,
  `xqcXYHXBJJXcLkRYkRngKA`)

Specs and plans under `docs/superpowers/` are history;
leave them.

- [ ] **Step 1: Edit the three docs**
- [ ] **Step 2: Verify**

Run:
`grep -n -i "display id\|display_id" API.md ARCHITECTURE.md TEST-PLAN.md`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add API.md ARCHITECTURE.md TEST-PLAN.md
git commit -m "Drop the display id from the docs"
```

---

## After the branch

Squash to one commit, run `./test validate` (Layer 1),
and report the branch. After the operator's merge and
`./test validate browser`, the operator wipes and
reseeds fusionangle.com with
`./deploy --render TOKEN --postgres mock-data`.
