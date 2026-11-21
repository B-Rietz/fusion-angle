# Bind the instance at work order creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** A work order created on a flow that names a
record type is born bound to a fresh, empty instance of
that type, so its first value-bearing submit succeeds.

**Architecture:** The create request gains one optional
key, `instance`, carrying a client-minted instance id and
the flow's record type. `postWorkOrderCreationOp` reads the
flow's live record joins before its statement, judges the
pair strictly, and lands the bound work order, its flow
join, and the empty instance as siblings of the one
`runStateWrite` it already runs. The client reads the
flow's record type beside the reads it already makes and
mints the id.

**Tech Stack:** Deno 2.9.8, TypeScript under `deno.json`
(`strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `verbatimModuleSyntax`,
`erasableSyntaxOnly`), `@std/assert`, the memory backend
through `handleRequest`, Chrome over CDP for
`tests/browser/`.

**Spec:** `docs/superpowers/specs/bind-instance-at-creation-design.md`
(commit `39735ea99`). Executors read the spec and this
plan. The spec is decided. This plan decides every "Left to
the builder" item (see Decisions). Neither is reopened. If
the design proves wrong while building, stop and say so.

## Decisions (marked: the planner's call)

- **Sibling order.** Work order, flow join, instance. The
  answer's body, tag, and `Location` are read from
  `siblings[0]`, so the work order stays the parent and the
  create still answers the work order. *Planner's call.*
- **The instance's condition.**
  `{ kind: 'never-written', declarer: 'handler' }`.
  Tombstone-wins is the instance family's rule
  (`postInstanceCreateOp`): a retired instance name never
  comes back. Over a live head the refusal is 409, as the
  spec says; over a tombstone it is 410 Gone, which
  `refusalOfRow` already answers whoever declared it.
  *Planner's call.*
- **The reader.** Unchanged, `{ sees: 'whole' }`: the
  answer is the work order, and a birth carries no values.
- **The type probe.** `requireRecordTypeExists` runs after
  the join judgment, as `postInstanceCreateOp` runs it. A
  join can outlive its type: `collectRecordTypeReferrers`
  counts only live flows, so a lifecycle-deleted flow's
  join no longer restricts the type's DELETE, and the
  create does not ask whether its flow is live. A retired
  type answers what the instance create answers for it.
  Task 3's red test reaches it without deleting a flow: a
  join under a flow id that has no live flow document does
  not restrict the type's DELETE either. A retired type
  answers 404 there, as the instance create does.
  *Planner's call.*
- **The missing-instance message.**
  `WorkOrderCreateBody.instance is required: the flow names
  a record type`. *Planner's call.*
- **Validator labels.** The body the error names is
  `WorkOrderCreateBody.instance`. The two ids are gated by
  the binding body's own checks, shared through one
  label-taking function (the `validateGraphTriple`
  precedent: same wire shape, same gate), so a missing or
  unexpected key and an empty id name that label. A
  wrong-typed id keeps the bare-key message every
  `pickString`/`pickIdentifier` gate answers
  (`instance_id must be a 22-character identifier`), so
  the binding PUT's messages do not move. `instance` is
  optional at the gate through `assertOnlyKeys`' own
  `optional` list. *Planner's call, corrected while
  building: the first draft labelled every message.*
- **Absence is a kind, not an optional.** The validated
  body, the birth, and the client's creation each carry a
  required discriminated union. No optional input hides a
  missing argument, and `exactOptionalPropertyTypes` has
  nothing to trip on. *Planner's call.*
- **Existing tests.** A throwaway strict gate broke 16
  tests in four files (see Task 1). Each keeps every
  assertion and gets its work order created before its
  flow's record join. None is weakened or deleted.
- **Documents.** `API.md`, `ARCHITECTURE.md`, and
  `SCHEMA.md` are searched in Task 7 for the create body
  and the seed count; they change only if they state
  something this unit makes false.

## Global Constraints

- One statement: the instance is a third sibling of the
  existing `runStateWrite`, never a second write.
- Transaction bodies await only row ops: the flow's record
  joins and the type probe are read before the statement.
- The create widens no permission: members POST
  `/work-orders` today.
- Ids are minted by the client. The server mints none.
- Seeded work orders stay unbound, the gate-violation work
  order (`eOlNZpGQfmCdpSFWXGkzFQ`) included.
- No new UI. `web-app/workbox/index.ts` is unchanged.
- `PUT …/work-orders/:id/binding` and `putWorkOrderBinding`
  stay.
- 78-character lines in every linted file, 4-space indent.
  No bare "admin" in prose; `grant` is a verb.
- `export DENO_DIR="$TMPDIR/deno-dir"` before any `deno`,
  `./test`, or `./deploy` command.
- `./test validate --syntax` before each commit. Commit
  subjects: one line, about 50 characters, present-tense
  imperative, the `Co-Authored-By` trailer and no body.

## Review Focus

Inputs the spec implies and no Verification line names,
most likely to bite first. Each has its test in the task
that owns the code.

1. **A malformed `instance`** (a string, a missing id, an
   empty id, an extra key): 400 at the gate naming the
   field, nothing stored. Task 3.
2. **An instance id that was written and then deleted**:
   refused 410, no work order lands, the name stays
   retired. Task 3.
3. **A member who is not an organization admin** creates on
   a flow that names a record type: 201, bound. Task 3.
4. **A flow with two record joins**: the server accepts
   either joined type; the client names the first. Task 3
   and Task 5.
5. **A record type retired while a join still names it**
   (the join's flow is not live): the create is refused as
   the instance create is, and stores nothing. Task 3.

## File Structure

- `api/work-order-version.ts` — `createdVersion` takes the
  birth's binding.
- `api/validators.ts` — the `instance` key at the create
  gate; the binding ids' shared checks.
- `api/routes.ts` — the join read, the gate, the probe, and
  the third sibling in `postWorkOrderCreationOp`.
- `client/work-orders-mutations.ts` — the creation carries
  its instance; the body gains the key.
- `web-app/app/work-order-creation.ts` — reads the flow's
  record type and mints the instance id.
- `web-app/app/generate-api-documentation.ts` and the
  generated `web-app/api-documentation/` — the documented
  create body.
- `tests/api-work-orders-create-instance.test.ts` (new) —
  the route's covenant.
- `tests/work-order-version.test.ts`,
  `tests/adapters-work-orders.test.ts`,
  `tests/mock-data-records.test.ts`,
  `tests/browser/workbox-transition.test.ts` — the unit,
  client, seed, and Layer 2 pins.
- `TODO.md`, `TEST-PLAN.md` — the documents the spec lists.

---

### Task 1: Create test work orders before their record join

Preparation. The suite is green before and after; no
assertion changes.

**Files:**
- Modify: `tests/adapters-flow-records.test.ts`
  ('getWorkOrdersForRecord walks …': seed the three work
  orders before the two `putFlowRecord` calls)
- Modify: `tests/adapters-work-orders.test.ts` (six tests:
  the four `postWorkOrderTransition …` instance tests,
  'putWorkOrderBinding embeds instance on the work-order
  GET', and 'a binding sends no GET before its PUT' — call
  `createWorkOrder` before `seedTypeInstanceAndJoin`)
- Modify: `tests/api-transition-required-exit.test.ts`
  (`baseSeed` stops joining; each of the eight tests calls
  `seedFlowTypeJoin` after its `seedWorkOrder` calls)
- Modify: `tests/api-work-order-document.test.ts`
  (`claimedBoundWorkOrder`: the work-order POST moves
  ahead of the flow-record PUT in `writes`)

- [ ] **Step 1:** Reorder as above. Where the order is
  load-bearing, one comment says why: a work order created
  before its flow's record join is unbound.
  `tests/api-work-order-transition-instance.test.ts`
  already has this order in `seededBound`; add the same
  comment there and change nothing else.
- [ ] **Step 2:** Run `./test`. Expected: 4683 passed,
  0 failed (the baseline).
- [ ] **Step 3:** `./test validate --syntax`, then commit:
  `Create test work orders before their record join`.

### Task 2: The birth carries its binding

**Files:**
- Modify: `api/work-order-version.ts`
- Modify: `api/routes.ts` (the one caller passes
  `binding: { kind: 'unbound' }`)
- Test: `tests/work-order-version.test.ts`

**Interfaces:**
- Produces:

```ts
export type BirthBinding =
    | { readonly kind: 'unbound' }
    | {
        readonly kind: 'bound',
        readonly instanceId: Id,
        readonly recordTypeId: Id,
    };
// createdVersion's input gains:
//     readonly binding: BirthBinding,
```

- [ ] **Step 1: Write the failing tests.** The file's
  `created()` helper passes `binding: { kind: 'unbound' }`.
  Add:

```ts
Deno.test('a bound birth carries its binding beside its'
    + ' three births', () => {
    const version = createdVersion({
        ...birthInput(),
        binding: {
            kind: 'bound',
            instanceId: 'instance-1',
            recordTypeId: 'type-1',
        },
    });
    assertStrictEquals(version.instance_id, 'instance-1');
    assertStrictEquals(version.record_type_id, 'type-1');
    assertStrictEquals(version.events.length, 3);
    assertEquals(Object.keys(version), [
        'id', 'organization_id', 'flow_graph', 'position',
        'state', 'transition', 'instance_id',
        'record_type_id', 'claim', 'events',
    ]);
});

Deno.test('an unbound birth carries no binding', () => {
    const version = created();
    assertStrictEquals('instance_id' in version, false);
    assertStrictEquals('record_type_id' in version, false);
});
```

  `birthInput()` is `created()`'s argument without
  `binding`, extracted so both tests share it.
- [ ] **Step 2:** Run
  `deno test --frozen --no-check tests/work-order-version.test.ts`.
  Expected: the bound test FAILS (`instance_id` undefined).
- [ ] **Step 3:** Add `BirthBinding` and the `binding`
  input to `createdVersion`; a bound birth passes the two
  ids to `ordered`, which already places them. The caller
  in `postWorkOrderCreationOp` passes
  `{ kind: 'unbound' }` for now.
- [ ] **Step 4:** Re-run the file. Expected: PASS.
- [ ] **Step 5:** `./test validate --syntax`, then commit:
  `Let a work order's birth carry its binding`.

### Task 3: The create carries the instance

**Files:**
- Modify: `api/validators.ts`
- Modify: `api/routes.ts` (`postWorkOrderCreationOp`, its
  comment, the `deriveFlowRecords` import)
- Test: `tests/api-work-orders-create-instance.test.ts`
  (new)

**Interfaces:**
- Consumes: `BirthBinding`, `createdVersion` (Task 2);
  `deriveFlowRecords`, `requireRecordTypeExists`,
  `instancesUriPrefix`, `instanceStateOf` (existing).
- Produces:

```ts
// api/validators.ts
export type WorkOrderCreateInstance =
    | { readonly kind: 'absent' }
    | {
        readonly kind: 'named',
        readonly binding: WorkOrderBindingBody,
    };
// WorkOrderCreateBody gains:
//     readonly instance: WorkOrderCreateInstance;
// WORK_ORDER_CREATE_KEYS gains 'instance'.

// api/routes.ts, private
function birthBindingOf(
    joinedTypeIds: readonly Id[],
    instance: WorkOrderCreateInstance,
): BirthBinding
```

  `birthBindingOf` is the spec's gate table: it throws
  `ValidationError` with the missing-instance message when
  the flow names a type and `instance` is absent, and with
  the binding op's existing message (`record_type_id is not
  joined to the work order's flow`) when the named type is
  not among the joins, which covers a flow with no joins.

- [ ] **Step 1: Write the failing tests.** The file seeds
  through `handleRequest`, as
  `tests/api-transition-required-exit.test.ts` does: a
  flow, a live record type with one writable text
  attribute, and the flow-record join. Each "stores
  nothing" assertion compares
  `(await db.messagePairs.getAll()).length` before and
  after. Tests, by name:

  1. `a create carrying the instance is born bound and
     submits` — 201; the answer and the GET head carry
     `instance_id` and `record_type_id`; the head's three
     events are the births; the instance GET is 200 with
     `values: []` and the type's instance collection lists
     it; a value-bearing transition on the work order (tags
     of both heads) is 200 and the instance then holds the
     value. The reporter's path.
  2. `a create without the instance on a flow that names a
     record type is 400` — error exactly
     `WorkOrderCreateBody.instance is required: the flow
     names a record type`; stores nothing.
  3. `a create naming a type its flow does not join is
     400` — a second live type, not joined; error exactly
     `record_type_id is not joined to the work order's
     flow`; stores nothing.
  4. `a create carrying an instance on a flow that names no
     record type is 400` — same error; stores nothing.
  5. `a resent bound create is 409 and leaves one
     instance` — the same body twice; the second is 409 and
     stores nothing; the instance collection has one entry.
  6. `a create whose instance id is already written is 409
     and lands no work order` — PATCH-create the instance
     first; the create is 409 naming the instance's
     document; the work order GET is 404.
  7. `a malformed instance is 400 at the gate` — a string;
     `{ instance_id }` alone; an empty `instance_id`; an
     empty `record_type_id`; an extra key. Each 400 carries
     the message the Validator labels decision names and
     stores nothing. (Review Focus 1.)
  8. `a create whose instance id was deleted is 410 and
     lands no work order` — PATCH-create, DELETE, then the
     create. (Review Focus 2.)
  9. `a member's create on a flow that names a record type
     is born bound` — a member token; 201. (Review
     Focus 3.)
  10. `a flow with two record joins accepts either type` —
      two creates, one per joined type; both 201. (Review
      Focus 4.)
  11. `a create naming a retired type is refused as the
      instance create is` — join the type under a flow id
      with no flow document, DELETE the type, then compare
      the create's answer to a PATCH-create on the same
      type; equal (404), and nothing stored. (Review
      Focus 5; see the probe Decision.)
  12. `a create without an instance on a flow that names
      no record type is born unbound` — the table's first
      row; green before and after.
- [ ] **Step 2:** Run the new file. Expected: every test
  FAILS (1, 9, 10 answer 400 `unexpected key "instance"`;
  2 answers 201; the rest answer the wrong status or
  message).
- [ ] **Step 3: The validator.** Extract the binding body's
  two id checks into one private function taking the body
  and its label; `validateWorkOrderBindingBody` calls it
  with `WorkOrderBindingBody`, and
  `validateWorkOrderCreateBody` calls it with
  `WorkOrderCreateBody.instance` when the key is present
  (`asObject` first). Update the gate's comment.
- [ ] **Step 4: The handler.** After `flowId`: read
  `deriveFlowRecords(db, org, flowId)`, call
  `birthBindingOf`, and for a bound birth call
  `requireRecordTypeExists`. Pass the binding to
  `createdVersion`. A bound birth appends the third
  sibling: `PUT` at `instancesUriPrefix(org, typeId)`, name
  the instance id, state
  `instanceStateOf(org, typeId, instanceId, [])`, condition
  `{ kind: 'never-written', declarer: 'handler' }`. Rewrite
  the function's comment to name the three siblings and
  the gate.
- [ ] **Step 5:** Re-run the new file, then `./test`.
  Expected: PASS; the suite total is the baseline plus the
  new tests, 0 failed.
- [ ] **Step 6:** `./test validate --syntax`, then commit:
  `Bind a fresh instance in the work order create`.

### Task 4: Pin the seed's order

**Files:**
- Test: `tests/mock-data-records.test.ts`

- [ ] **Step 1: Write the pin.**

```ts
Deno.test('seeded work orders are created before their'
    + ' flow\'s record join, so the gate-violation work'
    + ' order stays unbound', async () => { … });
```

  It asserts, on the seeded database: the gate-violation
  work order's head has neither `instance_id` nor
  `record_type_id`; its flow (`esKujtyQFYUJaVSXWwavzA`)
  has a live record join (`deriveFlowRecords`); and in
  `db.messagePairs.getAll()` the work order's first pair
  precedes that join's pair. The comment above it says why
  the order is the covenant: the strict gate would refuse
  the seed's unbound create once the join exists.
- [ ] **Step 2: Prove it can fail.** Temporarily move the
  `mockFlowRecords` wave in `api/mock-data.ts` above the
  work-order wave and run the file. Expected: FAIL (the
  seed's create answers the missing-instance 400, or the
  order assertion fails). Restore `api/mock-data.ts`
  exactly (`git diff --stat` shows only the test file).
- [ ] **Step 3:** Run the file. Expected: PASS.
- [ ] **Step 4:** In `api/mock-data.ts`, extend the comment
  above the second wave with one sentence: work orders are
  created in the first wave so the create gate finds no
  record join and leaves them unbound.
- [ ] **Step 5:** `./test validate --syntax`, then commit:
  `Pin seeded work orders before their record joins`.

### Task 5: The client sends the instance

**Files:**
- Modify: `client/work-orders-mutations.ts`
- Modify: `web-app/app/work-order-creation.ts`
- Modify: `tests/browser/workbox-transition.test.ts`
- Test: `tests/adapters-work-orders.test.ts`

**Interfaces:**
- Consumes: `getRecordForFlow(ctx, flowId):
  Promise<RecordId | null>` (`client/flow-records.ts`).
- Produces:

```ts
// client/work-orders-mutations.ts
export type WorkOrderCreationInstance =
    | { readonly kind: 'none' }
    | {
        readonly kind: 'minted',
        readonly instanceId: string,
        readonly recordTypeId: RecordId,
    };
// WorkOrderCreation gains:
//     readonly instance: WorkOrderCreationInstance;
```

- [ ] **Step 1: Layer 2 red.** In
  `tests/browser/workbox-transition.test.ts` delete
  `bindGenesisInstance`, its call, the reload that followed
  it, and the imports only it used. Run that file alone
  (the `deno test` line of `bin/test-browser`, one path,
  after `bundle_client`). Expected: 'fill and submit
  navigates to the inbox (WB11)' FAILS — the submit is the
  reporter's 400.
- [ ] **Step 2: Layer 1 red.** In
  `tests/adapters-work-orders.test.ts`, with
  `recordedContext`:

```ts
Deno.test('createWorkOrderFromFlow sends the instance when'
    + ' the flow names a record type', async () => { … });
Deno.test('createWorkOrderFromFlow omits the instance when'
    + ' the flow names no record type', async () => { … });
```

  The first joins the flow to `RT_ID`, creates, and reads
  the one `POST …/work-orders/` in `sent`: its parsed body
  has `instance.record_type_id === RT_ID` and an
  `instance.instance_id` that `isIdentifier` accepts; the
  work order read back is bound to that pair. The second
  creates on an unjoined flow: `'instance' in body` is
  false and the work order is unbound. The existing direct
  `postWorkOrderCreation` caller in this file passes
  `instance: { kind: 'none' }`.
- [ ] **Step 3:** Run the file. Expected: the first new
  test FAILS (400, the missing-instance message).
- [ ] **Step 4: Implement.** `postWorkOrderCreation` adds
  `instance: { instance_id, record_type_id }` to the body
  for a minted instance and no key otherwise; its comment
  names the fourth client-minted id.
  `createWorkOrderFromFlow` adds
  `getRecordForFlow(ctx, input.flowId)` to its
  `Promise.all` and passes `{ kind: 'minted', instanceId:
  generateIdentifier(), recordTypeId }` or
  `{ kind: 'none' }`.
- [ ] **Step 5:** Run `./test`. Expected: 0 failed. A pin
  that counts the create's requests gains the one
  flow-records GET; update the count where the pin is
  about the create's reads and say so in the report.
- [ ] **Step 6:** Re-run the browser file from Step 1.
  Expected: PASS, all three tests.
- [ ] **Step 7:** `./test validate --syntax`, then commit:
  `Send the instance when the flow names a record type`.

### Task 6: Document the create body

**Files:**
- Modify: `web-app/app/generate-api-documentation.ts`
- Regenerate: `web-app/api-documentation/`

- [ ] **Step 1:** Run `./test api-docs`. Expected after
  Task 3: it may already FAIL if the handler's statuses
  changed; note the output either way.
- [ ] **Step 2:** Add
  `instance: { instance_id: 'id', record_type_id: 'id' }`
  to the `post /organizations/:id/work-orders/` example.
- [ ] **Step 3:** Run `./bin/generate-api-documentation`
  (no `--check`), read the diff: the create room's body
  gains the key, and its statuses change only as the
  handler's did.
- [ ] **Step 4:** `./test api-docs` and
  `deno test --frozen --no-check
  tests/api-documentation-generator.test.ts`. Expected:
  PASS.
- [ ] **Step 5:** `./test validate --syntax`, then commit:
  `Document the instance in the work order create`.

### Task 7: The documents

**Files:**
- Modify: `TODO.md`, `TEST-PLAN.md`
- Read, change only if false: `API.md`, `ARCHITECTURE.md`,
  `SCHEMA.md`

- [ ] **Step 1: `TODO.md`.** Remove the "Bind the record
  instance at work order creation" item. Trim "Seed one
  bound Data Capture work order" to its seed half: drop
  "Until bind-at-creation, live create is unbound".
- [ ] **Step 2: `TEST-PLAN.md`.** WB11, WB16, and R14 (both
  the Driving notes and the cases) describe a live create
  that binds: create on Customer Onboarding, fill, submit.
  Remove the scoring line "A live WB11 or WB16 400 for no
  instance binding is BLOCKED, not FAIL …" and the
  DEFERRED chain it guards, WB16's "A missing 200 because
  the work order is unbound is BLOCKED", and the WB11
  note's stopgap sentences. R13 keeps the gate-violation
  work order unbound and names the new seed pin.
- [ ] **Step 3:** `grep -n` the three other documents for
  the create body, `bind`, and the seed's instance count.
  Change only a sentence this unit makes false.
- [ ] **Step 4:** `grep -rn "bind-at-creation\|
  bindGenesisInstance" --include=*.md --include=*.ts .`
  outside `docs/superpowers/`. Expected: no stale mention.
- [ ] **Step 5:** `./test validate --syntax`, then commit:
  `Retire the bind-at-creation notes`.

### Task 8: Squash and gate

- [ ] **Step 1:** Squash Tasks 1–7 into one commit on top
  of the design and plan commits:
  `Bind the instance at work order creation`.
- [ ] **Step 2:** `./test validate`. Expected: green, and
  the validate stamp written.
- [ ] **Step 3:** `./test validate browser`. Expected:
  green, WB11 included.
- [ ] **Step 4:** Report the branch name. Do not merge.
