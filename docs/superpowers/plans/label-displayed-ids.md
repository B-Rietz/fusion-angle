# Label Displayed Ids Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Every id the app shows reads `<Thing> <value>`,
with no `#` prefix.

**Architecture:** Presenter text only. Two label
functions in `web-app/app/format.ts` serve the sites that
pass the rule of three (work order: four sites; instance:
three). Token labels are written inline (two sites, two
different nouns).

**Tech Stack:** Deno 2.9.8, TypeScript, `@std/assert`,
`html` tagged template (`web-app/app/safe-html.ts`).

**Spec:** `docs/superpowers/specs/label-displayed-ids-design.md`

## Global Constraints

- No `#` prefix on any displayed id.
- Form is `<Thing> <value>`: `Work order <displayId>`,
  `Instance <id>`, `Token <jti>`, `Parent token <jti>`.
- Absent parent renders `Parent token —` (today's
  `DISPLAY_ABSENT`).
- Unchanged: id generation, storage, wire, `data-*`
  attributes, element ids, `title` text, `Chain <id>`.
- Work order search still accepts `#a7c3e1f9`
  (`tests/search-match.test.ts`, `tests/api-work-orders-
  query.test.ts`); do not touch search.
- 78-char lines, 4-space indent, no inline styles.

## Review Focus

- The unplaced inbox row ("State unknown") is a second
  render path; it must carry the label too (Task 1 pins
  it).
- The record detail work order link sits under "Work
  orders using this Record" and still carries the label
  (Task 1 pins it).
- A token with no parent reads `Parent token —`, never
  `Parent token undefined` (Task 3 pins it).
- No `#` survives anywhere a work order id renders: each
  Task 1 test asserts the `#<id>` form is absent.

---

### Task 1: Label work order display ids

**Files:**
- Modify: `web-app/app/format.ts` (add and export)
- Modify: `web-app/app/presenters/workbox-detail.ts:362`
- Modify: `web-app/app/presenters/workbox-inbox.ts:112,220`
- Modify: `web-app/app/presenters/record-detail.ts:627`
- Test: `tests/format.test.ts`,
  `tests/presenter-workbox-detail.test.ts`,
  `tests/presenter-workbox-inbox.test.ts`,
  `tests/presenter-record-detail.test.ts`

**Interfaces:**
- Produces: `workOrderLabel(displayId: string): string`
  in `web-app/app/format.ts`, returning
  `'Work order ' + displayId`.

- [ ] **Step 1: Write the failing tests**

`tests/format.test.ts`:
```ts
Deno.test('workOrderLabel names the work order', () => {
    assertStrictEquals(
        workOrderLabel('6a7f72c0'), 'Work order 6a7f72c0',
    );
});
```

`tests/presenter-workbox-detail.test.ts`, new test using
`makePresenter` as the existing header tests do:
`buildPage()` output matches `/Work order WO-42/` and does
not include `'#WO-42'`.

`tests/presenter-workbox-inbox.test.ts`:
- Change the unplaced-row test's
  `assertStringIncludes(out, '#unplaced-7')` to
  `'Work order unplaced-7'`, and add
  `assertEquals(out.includes('#unplaced-7'), false)`.
  The covenant changed in the spec; this is not
  weakening.
- New test: `capture([placed()], 'available',
  NO_FILTER)` includes `'Work order WO-1'` and not
  `'#WO-1'`.

`tests/presenter-record-detail.test.ts`: extend `pageFor`
(or add a sibling) so `workOrders` holds one `WorkOrder`
with `id: 'wo-1'`, `displayId: 'a7c3e1f9'` (build it the
way `makeWorkOrder` in `presenter-workbox-detail.test.ts`
does). Output matches `/Work order a7c3e1f9/` and does not
include `'#a7c3e1f9'`.

- [ ] **Step 2: Run to verify they fail**

```bash
export DENO_DIR="$TMPDIR/deno-dir"
deno test --frozen --preload ./tests/hmac-test-key.ts \
  --preload ./tests/local-storage-stub.ts \
  --preload ./tests/session-storage-stub.ts \
  --preload ./tests/worker-name-prefix.ts \
  tests/format.test.ts tests/presenter-workbox-detail.test.ts \
  tests/presenter-workbox-inbox.test.ts \
  tests/presenter-record-detail.test.ts
```
Expected: the new assertions FAIL (`workOrderLabel` not
exported; `#` text present).

- [ ] **Step 3: Implement**

Add `workOrderLabel` to `format.ts` and its `export {}`
block. Replace each `#${…displayId…}` with
`${workOrderLabel(…)}` at the four sites.

- [ ] **Step 4: Run to verify they pass**

Same command. Expected: all PASS.

- [ ] **Step 5: Commit**

`./test validate --syntax`, then commit
`Label work order display ids`.

### Task 2: Label record instance ids

**Files:**
- Modify: `web-app/app/format.ts` (add and export)
- Modify: `web-app/app/presenters/record-detail.ts:226,270`
- Modify: `web-app/app/presenters/workbox-detail.ts:427`
- Test: `tests/format.test.ts`,
  `tests/presenter-record-instances.test.ts`

**Interfaces:**
- Produces: `instanceLabel(instanceId: string): string`
  in `web-app/app/format.ts`, returning
  `'Instance ' + instanceId`.

- [ ] **Step 1: Write the failing tests**

`tests/format.test.ts`: `instanceLabel('inst-1')` is
`'Instance inst-1'`.

`tests/presenter-record-instances.test.ts`:
- 'list renders instance id and projected values': add
  `assertMatch(html, /Instance inst-1/)`.
- 'edit form: writable input, readonly text, unreadable
  omitted': add `assertMatch(html, /Instance inst-9/)`.

The binding badge's existing
`assertMatch(out, /Instance inst-xyz/)`
(`presenter-workbox-detail.test.ts:386`) guards its swap
to `instanceLabel`.

- [ ] **Step 2: Run to verify they fail**

The Task 1 command with `tests/presenter-record-
instances.test.ts` added. Expected: new assertions FAIL.

- [ ] **Step 3: Implement**

Add `instanceLabel`; render it in the two `<code
class="record-instance-id …">` elements and in
`#bindingBadge()`.

- [ ] **Step 4: Run to verify they pass**

Expected: all PASS, including the binding badge test.

- [ ] **Step 5: Commit**

`./test validate --syntax`, then commit
`Label record instance ids`.

### Task 3: Label identity token ids

**Files:**
- Modify: `web-app/app/presenters/identity-tokens.ts:30-38`
- Test: `tests/presenter-identity-tokens.test.ts`

**Interfaces:** none.

- [ ] **Step 1: Write the failing tests**

In 'renders a card per chain with each jti event', add:
```ts
assertMatch(out, /Token jmvogLnzTmiQlAkVvDHrvQ/);
assertMatch(out, /Token j2/);
assertMatch(out, /Parent token —/);
assertMatch(out, /Parent token jmvogLnzTmiQlAkVvDHrvQ/);
assertNotMatch(out, /parent:/);
```
(The first event has no `parentJti`.)

- [ ] **Step 2: Run to verify they fail**

`deno test` as above on
`tests/presenter-identity-tokens.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement**

Event row text becomes `Token ${event.jti}`; the parent
line becomes `Parent token ${…}`, keeping the
`DISPLAY_ABSENT` branch.

- [ ] **Step 4: Run to verify they pass**

Expected: PASS.

- [ ] **Step 5: Commit**

`./test validate --syntax`, then commit
`Label identity token ids`.

### Task 4: Squash and gate

- [ ] **Step 1:** `git rebase master`; squash the branch
  to one commit, `Label displayed ids`.
- [ ] **Step 2:** `./test validate`. Expected: green.
- [ ] **Step 3:** Report the branch name
  `label-displayed-ids`.
