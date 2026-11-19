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
carrying it. Task 3 brings the docs in line. Tasks 4
and 5 are spec part two: one `idLabel` helper and one
`.displayed-id` class for all eight id sites, then links
from the Instance badge and the Parent token label.

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

### Task 4: One look for every displayed id

Spec part two, "Decided" first bullet.

**Files:**
- Create: `web-app/app/presenters/id-label.ts`
- Modify: `web-app/app/format.ts` (delete
  `workOrderLabel`, `instanceLabel`)
- Modify: `web-app/app/styles/components-badges.css`
  (the `.displayed-id` rule)
- Modify: `web-app/app/styles/pages-records.css:133`
  (delete `.record-instance-id`'s font rule; the class
  stays as a hook if a test or script queries it)
- Modify: `workbox-detail.ts`, `workbox-inbox.ts`,
  `record-detail.ts`, `identity-tokens.ts`,
  `identity-providers.ts` under
  `web-app/app/presenters/`
- Test: `tests/presenter-id-label.test.ts` (new); the
  label assertions in `tests/format.test.ts` move there;
  the presenter tests Task 1 touched, plus
  `tests/presenter-identity-tokens.test.ts` and
  `tests/presenter-identity-providers.test.ts`

**Interfaces:**
- Consumes: Task 1's sites passing the work order id.
- Produces:
  `idLabel(thing: string, id: string): SafeHtml` renders
  `${thing} <code class="displayed-id">${id}</code>`. The
  id is escaped by `html`, and the whole id is always in
  the markup.

- [ ] **Step 1: Write the failing tests**

`tests/presenter-id-label.test.ts`:
- `'idLabel renders the thing and the whole id'`:
  `idLabel('Work order', 'wrVS6q_Zsd8ILhGFyG1-zg')`
  `.toString()` equals
  `'Work order <code class="displayed-id">wrVS6q_Zsd8ILhGFyG1-zg</code>'`.
- `'idLabel escapes the id'`: `idLabel('Token', '<x>')`
  contains `&lt;x&gt;` and not `<x>`.

In each presenter test that pins a label, assert the
`displayed-id` element wraps the id. Use these regexes:
- work order header:
  `/Work order <code class="displayed-id">wo-1<\/code>/`
- inbox rows (placed and unplaced), record detail work
  order links: the same, with that test's id
- instance rows, instance edit header, binding badge:
  `/Instance <code class="displayed-id">…<\/code>/`
- identity tokens:
  `/Token <code class="displayed-id">…<\/code>/`,
  `/Parent token <code class="displayed-id">…<\/code>/`,
  `/Chain <code class="displayed-id">…<\/code>/`
- identity providers:
  `/Account <code class="displayed-id">…<\/code>/`

`Parent token` with no parent stays `Parent token —`,
with no `<code>`; pin that too.

- [ ] **Step 2: Run to verify they fail**

Run: `deno test --frozen --no-check tests/presenter-id-label.test.ts tests/presenter-workbox-detail.test.ts tests/presenter-workbox-inbox.test.ts tests/presenter-record-detail.test.ts tests/workbox-inbox.test.ts tests/presenter-identity-tokens.test.ts tests/presenter-identity-providers.test.ts`
Expected: FAIL. The module does not exist yet, and each
site still renders plain text.

- [ ] **Step 3: Implement `idLabel` and the class**

`.displayed-id` sets `font-family: var(--font-mono)`
and takes the `.truncate` utility's three properties.
It also sets `display: inline-block`,
`max-width: 100%`, and `vertical-align: bottom`, so the
ellipsis can apply inside a line of text. Every site
calls `idLabel`. Delete `workOrderLabel` and
`instanceLabel`, and the inline `Token `, `Parent
token `, `Account `, and `Chain ` text. Each site keeps
its container classes (badge, link, row, heading).
Record detail's `<code class="record-instance-id …">`
becomes a `<span class="record-instance-id text-sm">`
wrapping `idLabel('Instance', …)`, so no `<code>` is
nested in another `<code>`.

- [ ] **Step 4: Run to verify they pass**

Run: the Step 2 command, then
`./test validate --syntax && ./test`.
Expected: PASS, and
`grep -rn "workOrderLabel\|instanceLabel" web-app tests`
prints nothing.

- [ ] **Step 5: Commit**

```bash
git add web-app tests
git commit -m "Show every displayed id one way"
```

---

### Task 5: Link the instance and parent token ids

Spec part two, the clickable table: two new links.

**Files:**
- Modify: `web-app/app/presenters/workbox-detail.ts`
  (`#bindingBadge`)
- Modify: `web-app/records/detail.ts` (read the
  `instance` query parameter, scroll its row into view)
- Modify: `web-app/app/presenters/identity-tokens.ts`
  (`buildEventRow`, `buildChainCard`)
- Test: `tests/presenter-workbox-detail.test.ts`,
  `tests/presenter-identity-tokens.test.ts`; a browser
  case in `tests/browser/` for the scroll

**Interfaces:**
- Consumes: `idLabel` (Task 4); `buildPageUrl(page,
  params)` from `web-app/app/navigation.ts`.
- Produces: record detail accepts
  `?id=<recordTypeId>&instance=<instanceId>`. The first
  row per jti carries `id="token-<jti>"`.

- [ ] **Step 1: Write the failing tests**

`tests/presenter-workbox-detail.test.ts`,
`'the binding badge links to its instance'`: with a bound
work order, the badge is an `<a>` whose `href` equals
`buildPageUrl('record-detail', { id: <recordTypeId>,
instance: <instanceId> })`. It keeps `badge
badge-success`, and its text holds `idLabel('Instance',
<instanceId>)`.

`tests/presenter-identity-tokens.test.ts`:
- `'the first row of each token carries its anchor'`:
  for a chain whose jti `t1` has two events, exactly one
  `id="token-t1"` appears.
- `'a parent token on the page is a link to its row'`:
  child event `parentJti: 't1'` with `t1` in the same
  render: `<a href="#token-t1">` wraps the parent's
  label.
- `'a parent token absent from the page is not a
  link'`: `parentJti: 'gone'` with no `gone` row: no
  `href="#token-gone"`, and the label is still rendered.

A browser case: open the record detail URL with
`instance=<the seeded bound instance>`; that row's
`getBoundingClientRect().top` is within the viewport.

- [ ] **Step 2: Run to verify they fail**

Run: `deno test --frozen --no-check tests/presenter-workbox-detail.test.ts tests/presenter-identity-tokens.test.ts`
Expected: FAIL on the three link and anchor assertions.

- [ ] **Step 3: Implement the links**

The binding badge becomes
`<a href="${buildPageUrl(…)}" class="badge
badge-success" data-binding="bound" title="…">`. Keep the
`title` and the `data-binding` attribute.

The identity tokens presenter collects the jtis rendered
across all chains before it builds the rows. It anchors
the first row per jti, and links the parent label only
when the parent's jti is in that set.

Record detail reads `instance` the same way it reads
`id`. After the instance list renders, it calls
`scrollIntoView({ block: 'center' })` on
`[data-instance-id="<instance>"]` when that row exists.
When the row is absent, nothing happens: no error, no
toast.

- [ ] **Step 4: Run to verify they pass**

Run: the Step 2 command, then
`./test validate --syntax && ./test`; then the browser
case under `./test browser` when Chrome is available. If
it isn't, say so in the report.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web-app tests
git commit -m "Link the instance and parent token ids"
```

---

## After the branch

Squash to two commits, one per feature: Tasks 1–3
(`Retire the work order display id`) and Tasks 4–5
(`Show and link every displayed id one way`). Then run
`./test validate` (Layer 1) and report the branch. After the operator's merge and
`./test validate browser`, the operator wipes and
reseeds fusionangle.com with
`./deploy --render TOKEN --postgres mock-data`.
