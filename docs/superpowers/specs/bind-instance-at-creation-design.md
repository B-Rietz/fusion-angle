# Bind the instance at work order creation — design

## Intent

A work order created from the Workbox cannot be submitted. The
reporter built a flow, created a work order from it, ticked an
attribute, pressed Submit, and got:

```
Work order transition failed: work order has no instance binding
(https://…/api/organizations/…/work-orders/…/transition)
```

They asked whether they had set the flow up wrong. They had not.
`createWorkOrderFromFlow` (`web-app/app/work-order-creation.ts`)
posts a work order with no record instance, and `a416c8930` removed
the action screen's Bind control, so `putWorkOrderBinding` has no
caller under `web-app/`. A transition that carries values needs the
bound instance to write them to, and
`postWorkOrderTransitionOp` (`api/routes.ts`) refuses with 400 when
there is none. Every work order created in the product on a flow
that names a record type is a dead end at its first value-bearing
submit.

`TODO.md` already carries this as "Bind the record instance at work
order creation", and walk `62291ec` BLOCKED WB11, WB16, and R14 on
it. The Layer 2 pin passes only because
`tests/browser/workbox-transition.test.ts` binds a genesis instance
through the API first (`bindGenesisInstance`).

The fix: creating a work order from a flow that names a record type
also creates a fresh, empty instance of that type and binds the work
order to it, in the same statement. The operator chose this over a
picker for an existing instance.

## Goals

- A work order created from the Workbox on a flow that names a
  record type is bound from birth. Filling its attributes and
  submitting succeeds with no bind step.
- The instance, the work order, and the flow join land together or
  not at all.
- The API refuses a create that would produce the dead end: a flow
  that names a record type requires the instance.
- No new UI.

## Non-goals

- Binding a new work order to an existing instance (a picker on the
  create path). The operator declined it for this unit.
- Healing work orders that are already unbound, including the
  reporter's. They stay stuck; the reporter creates a new one. `PUT
  …/work-orders/:id/binding` still exists for an API caller.
- Seeding a bound Data Capture work order. That is its own `TODO.md`
  item; this unit consumes only its live-create half.
- The error toast overflowing its box and showing the raw API URL
  (visible in the reporter's screenshot). A separate defect with its
  own red test.
- Retiring `PUT …/work-orders/:id/binding` or its client verb.

## Anti-goals

- Three client requests (instance, work order, bind). A failure
  between them recreates the stuck state, or strands an instance.
- A server-minted instance id. Ids are minted by the client so a
  resent create meets the same rows and answers 409.
- A lazy bind on the first value-bearing transition. It hides the
  unbound state instead of ending it.
- Binding the seeded gate-violation work order
  (`eOlNZpGQfmCdpSFWXGkzFQ`). R13 needs it unbound.

## Constraints

- One statement. `postWorkOrderCreationOp` already lands the work
  order and its flow join as siblings of one `runStateWrite`; the
  instance is a third sibling, not a second write.
- The create body is gated by `validateWorkOrderCreateBody`
  (`assertOnlyKeys` over `WORK_ORDER_CREATE_KEYS`); the new key is
  validated there, at the gate.
- Members create work orders (`MEMBER_VERBS['/work-orders']` has
  POST) and may already create instances (`…/instances` has PATCH),
  so the create widens no permission. An empty instance sets no
  attribute, so the field ACL has nothing to judge.
- The seed creates its work orders through `postWorkOrderCreationOp`
  in its first wave, before the flow-to-record joins land in the
  second (`api/mock-data.ts`). At that moment no seeded flow names a
  record type, so seeded work orders stay unbound under the strict
  gate. WO01 is bound afterwards through `postWorkOrderBindingOp`.
- Transaction bodies await only row ops: the flow's record joins are
  read before the statement, as `postWorkOrderBindingOp` reads them.
- `generate-api-documentation --check` gates the documented create
  body.

## Approaches

1. **The create carries the instance (chosen).** The client mints an
   instance id and names the record type in the create body. The
   server writes instance genesis, the bound work order, and the
   flow join in one statement. Atomic, one request, and a resend is
   a clean 409 because every id is the client's.
2. **The server mints the id.** The client sends nothing new; the
   handler derives the flow's record type and generates an id. It
   breaks the client-minted-id convention the create's comment
   names, and a handler that invents state the request did not carry
   is no longer a pure function of its message.
3. **The client composes three requests.** No server change, and not
   atomic. Rejected under the tenth commandment.

The operator picked the first.

## Design

### The request

`POST /organizations/:id/work-orders/` gains one optional key:

```json
"instance": {
    "instance_id": "<client-minted id>",
    "record_type_id": "<the flow's record type>"
}
```

The two names are the binding body's own
(`validateWorkOrderBindingBody`). The key's absence is the unbound
create; there is no null and no empty object.

### The gate

After the body validates, the handler reads the live record joins of
the flow named by `flowWorkOrder.flow_id` (`deriveFlowRecords`) and
judges the pair:

| Flow's record joins | `instance` | Answer |
|---|---|---|
| none | absent | create, unbound (today's behavior) |
| some | names a joined type | create, bound |
| some | absent | 400: the flow names a record type |
| some | names another type | 400: type not joined to the flow |
| none | present | 400: type not joined to the flow |

The "not joined" refusal uses the binding op's existing message
(`record_type_id is not joined to the work order's flow`). A flow
may carry more than one join on the server; any joined type is
accepted, as the binding op accepts it.

### The statement

Three siblings, each declaring its genesis:

1. the instance at `instancesUriPrefix(organization, typeId)`, state
   `instanceStateOf(…, [])` — no values;
2. the work order, whose first version carries `instance_id` and
   `record_type_id` beside its three births and the creator's claim;
3. the flow join, unchanged.

A resent create answers 409 and stores nothing. So does a create
whose instance id is already written: the work order does not land
beside someone else's instance.

`createdVersion` (`api/work-order-version.ts`) takes the binding as
an input; `ordered` already places the two keys. The birth version
keeps its three events; binding at birth adds none.

### The client

`createWorkOrderFromFlow` reads the flow's record type with the
flow and the existing work orders (`getRecordForFlow`, the first
join — the same choice `getRecordForWorkOrder` makes for the detail
screen). With a record type it mints an instance id and passes both
to `postWorkOrderCreation`, which adds `instance` to the body. With
none it posts as today. `createWorkOrderForFlow`
(`web-app/workbox/index.ts`) is unchanged: it still navigates to the
detail screen, which now finds a bound work order.

### What the operator sees

Nothing new on the create path. On Records, the record type's
Instances list gains one empty instance per work order created. Its
values arrive as the work order's transitions write them.

## Verification

Each lands red first.

Layer 1:

- A create on a flow that names a record type, carrying the
  instance, answers 201; the work order's head carries the binding;
  the instance exists with no values; a value-bearing transition on
  that work order then succeeds. This is the reporter's path.
- The same create without `instance` answers 400 and stores nothing.
- A create naming a type the flow does not join, and a create
  carrying `instance` on a flow with no record type, answer 400 and
  store nothing.
- A resent bound create answers 409 and leaves one instance.
- A create whose instance id is already written answers 409 and
  lands no work order.
- `createWorkOrderFromFlow` sends `instance` when the flow names a
  record type and omits it when the flow names none.
- The seed still leaves the gate-violation work order unbound, and a
  pin names why: seeded work orders are created before the
  flow-to-record joins.

Layer 2:

- `tests/browser/workbox-transition.test.ts` 'fill and submit
  navigates to the inbox (WB11)' passes with `bindGenesisInstance`
  removed: the live create path binds.

Documents:

- `TODO.md`: remove the bind-at-creation item; trim the "Seed one
  bound Data Capture work order" item to its seed half.
- `TEST-PLAN.md`: WB11, WB16, and R14 describe a live create that
  binds; the "A live WB11 or WB16 400 for no instance binding is
  BLOCKED" scoring line and the DEFERRED chain it guards go with the
  cause.
- The API documentation regenerates (`./test api-docs`).

## Left to the builder

- Existing tests that create a work order through the route or the
  op on a flow that already names a record type must now carry the
  instance. Survey them before the gate turns strict. Tests that pin
  the unbound 400 (`tests/api-work-order-transition-instance.test.ts`,
  `tests/api-transition-required-exit.test.ts`) keep their covenant:
  an unbound work order still exists when it was created before its
  flow's record join. Give those tests that order; do not weaken
  them.
- Whether the instance's record type must be probed live
  (`requireRecordTypeExists`) once it is known to be joined to the
  flow, and what a retired type answers.
- The exact 400 message for a missing `instance`, and the validator's
  field labels.
- Whether `API.md`, `ARCHITECTURE.md`, or `SCHEMA.md` describe the
  create body or the seed count in a way this changes.
- The stored response and the reader for the instance sibling,
  following what `postInstanceCreateOp` and the existing create
  answer.
