# Workbox on one page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** `workbox/index.html` lists the work on the left
and shows the open work order on the right: a row of pills
counts and filters the lists by flow, a switch claims and
releases, a transition keeps the box on a step that is
mine or moves it to my next work order, and the detail
page, the drag, and the segmented control are gone.

**Architecture:** Pure presenters build every piece of
markup: `presenters/workbox-pills.ts` (new) the pills,
`presenters/workbox-inbox.ts` the headed lists each pressed
pill draws, `presenters/workbox-detail.ts` the box's four
states and the claim place. The page module
`web-app/workbox/index.ts` owns the pills, the lists, the
search, Create, and the address; a new module beside it,
`web-app/workbox/work-order-box.ts`, owns the right box —
its reads, its claim switch, its transitions, its 412
recovery — as one `WorkOrderBox` object the page builds
once. Counts derive from the rows the lists hold in the
same pass that paints them. Where the box goes after a
transition is two pure decisions in
`web-app/app/workbox-next.ts` (Amendment 1, Segment 3b).
No API change.

**Tech Stack:** Deno 2.9.8, TypeScript under `deno.json`
(`strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`,
`noUnusedParameters`, `exactOptionalPropertyTypes`,
`verbatimModuleSyntax`, `erasableSyntaxOnly`),
`@std/assert`, the in-process gate and memory adapter,
Chrome over CDP for `tests/browser/`.

**Spec:** `docs/superpowers/specs/workbox-one-page-design.md`
(commit `f22889e27`). Executors read the spec and this
plan. Its "Left to the builder" items are decided below
under "Decisions"; do not reopen them.

## Execution ground

- Worktree:
  `/Users/tmornini/code/fusion-angle/.worktrees/workbox-one-page`,
  branch `workbox-one-page`. Every command runs there. No
  dispatch passes the Agent tool `isolation`; nobody
  creates a worktree, runs `./deploy`, pushes, or
  force-pushes. Only the master squashes and merges.
- Before any `deno`, `./test`, or `./bin/*` command:
  `export DENO_DIR="$TMPDIR/deno-dir"`. Shell state does
  not persist between tool calls: put the export at the
  front of every command line.
- **ONE-FILE** below means this command with the named
  test file as its last argument (it is the memory
  suite's own invocation, narrowed to one file):

```bash
export DENO_DIR="$TMPDIR/deno-dir" && \
JWT_HMAC_SIGNING_KEY=test-hmac-signing-key TZ=UTC \
deno test --frozen --no-check \
    --sanitize-ops --sanitize-resources \
    --allow-env --allow-read --allow-write --allow-net \
    --allow-run=deno \
    --preload ./tests/hmac-test-key.ts \
    --preload ./tests/local-storage-stub.ts \
    --preload ./tests/session-storage-stub.ts \
    --preload ./tests/worker-name-prefix.ts \
    tests/NAME.test.ts
```

- `--no-check` means ONE-FILE does not type-check. Every
  task also runs `./test validate --syntax` (the
  `deno check --frozen` gate) before its commit.
- Each task ends in exactly one commit. Every commit
  passes `./test validate --syntax`; every task also runs
  `./test` (the memory suite) green before committing,
  except where a step says the suite is expected red and
  why (none does).
- Browser tests (`tests/browser/*.test.ts`) need Chrome,
  which the coder's sandbox cannot start. The coder
  writes them and type-checks them; the step that runs
  them reads **MASTER RUNS: `./test browser`** and the
  coder does not run it.
- Commit message: the subject line given in the task,
  then a blank line, then exactly
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
  No other body. Commit with a heredoc:

```bash
git add -A && git commit -F - <<'EOF'
SUBJECT LINE FROM THE TASK

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
```

- `git add -A` is safe here: `.superpowers/` is
  gitignored. Before committing, `git status --short`
  must list only the task's files.
- A move or rename is never in a commit with a content
  change. This plan moves no file; it deletes files with
  `git rm`.
- A failing test is fixed in code. A test is changed or
  deleted only where this plan says the spec retired or
  changed the behaviour it pins, and the task says why.

## Codebase patterns (binding)

- 78-character maximum line in every `.ts`, `.html`, and
  `.css` file (`./test lint`); 4-space indent; no inline
  `style=`: classes and tokens per DESIGN-SYSTEM.md.
- The identifier `org` (and `Org…`) is banned under
  `api/`, `client/`, `web-app/`, `tests/`, `shared/`:
  write `organization`. Prose says "organization admin"
  or "operator", never bare "admin".
- `RequestContext` is the first argument of a client
  verb. A write from a held message latches it: the box
  holds the work order's head and the bound instance's
  head; `putWorkOrderClaim`, `deleteWorkOrderClaim`, and
  `postWorkOrderTransition` latch those.
- Presenters return `SafeHtml` built with `` html`…` ``;
  pages paint with `setHtml`. Presenters never fetch.
- Listeners a page adds take the page's abort `signal`
  (`createPageAbort`). `init` can run again, so every
  bind is guarded once.
- A sequence number guards every paint against a stale
  read: `listsSequence` for the lists, the box's own
  `#sequence` for the box.
- `noUncheckedIndexedAccess`: index access is
  `T | undefined`; guard it or `!` it where the line
  above proves it.
- `verbatimModuleSyntax`: `import type` for type-only
  imports. No enums, no namespaces.

## Commandments this plan leans on

- **Reliability.** A refused claim never looks claimed:
  the switch moves only after the server answers. A
  stale read never paints: sequence numbers.
- **Uniformity.** The pills are `button.badge` with
  `aria-pressed` and `data-dimmed`, as the state chips;
  the switch is `.switch`; every string reuses today's
  copy.
- **Clarity**, **Simplicity.** One page, one box object,
  one pass that derives counts and lists.
- **Idempotency.** Claim is a `PUT`, release a `DELETE`.
- **The Office of the Interface.** Accessible names on
  every pill, the switch, and the close control; the
  focused pill and switch keep focus across a repaint.
- **The Office of Verification.** Tests assert rendered
  output (Layer 1) and the page in Chrome (Layer 2).
- **The Office of the Commit.** One concern per commit.

## Abominations this plan risks

- **The Cache.** No count is stored. Pills are derived
  from the rows the lists hold, at every paint.
- **Default Values.** No `?? ''`, `|| 0`, or parameter
  default hides a missing argument in new code.
- **Internal Defense.** Validated data is trusted; the
  only throws are bugs (a gesture with no read on hand).
- **Swallowed Failures / the Greedy Catch.** Each `try`
  wraps one write or one read; the re-read after a
  refusal runs outside it. No empty `catch`.
- **Test Weakening.** Every rewritten test names the
  spec change that rewrote it.
- **Unbidden Helper Code / Premature Generalization.**
  No generic pill framework; no fixtures beyond the
  tests' own helpers.
- **Magical Values.** Header heights in CSS carry a
  comment naming the rule they mirror.
- **Obscurity.** Comments say why.
- **The request plus improvements.** The diff is the
  spec's; the decisions below are the spec's open
  choices, nothing more.

## Decisions (the spec's "Left to the builder")

1. **Module split.** `web-app/workbox/index.ts` keeps the
   page; `web-app/workbox/work-order-box.ts` (new) is the
   box. The box lives beside the page, not under
   `web-app/app/`, because
   `tests/api-transition-legacy-cut.test.ts` 'G7:
   fieldValues hits equal named exceptions' sweeps
   `web-app/app/` for `/fieldValues/` and the box must
   call `fieldValuesByEventFromHistory`.
   `web-app/workbox/detail.ts` is deleted, not moved: its
   page `init` does not survive.
2. **The detail presenter keeps its file, class, and
   method names** (`presenters/workbox-detail.ts`,
   `WorkboxDetailPresenter`, `buildPage`). No rename
   commit.
3. **Names.** Pills: `#workbox-pills`,
   `button[data-workbox-pill="claimed|archivedByMe|flow"]`,
   `data-flow-name`, `.workbox-pill-count`. Lists:
   `#work-order-lists` holds `#claimed-list`,
   `#available-list`, `#archived-list`
   (`data-inbox-list` as today). Box:
   `section#work-order-box.workbox-work-order`
   (`aria-label="Work order"`),
   `.workbox-work-order-empty`, `#work-order-close`,
   `#work-order-claim`, `#work-order-claim-switch`.
4. **Presenters.** `buildWorkboxPills` and its
   derivations in a new `presenters/workbox-pills.ts`;
   `buildInboxLists` and `inboxSectionsOf` replace the
   `WorkboxInboxPresenter` class.
5. **Address.** `workOrderAddress(href, id)` in a new
   `web-app/app/workbox-address.ts`, written through the
   existing `putAddress` / `getHref` adapters; every other
   query parameter (the `organization` stamp) stays.
6. **Accessible names** follow DESIGN-SYSTEM.md's plural
   rule: "1 work order claimed by me", "5 work orders
   claimed by me".
7. **Clicking the row already open does nothing**, so a
   stray click never throws away typed values.
8. **Phones.** Both boxes take a `scroll-margin-top` of
   the fixed 3.5rem mobile header plus a gap, so a
   scrolled-to box lands below that header.
9. **Focus.** A pill repaint hands focus to the pill
   that replaces the focused one; a claim or release that
   lands returns focus to the switch.
10. **The bell during the box's own write.** The box
    ignores reloads while its write is in flight; it
    repaints from the write's answer instead. The lists
    still refresh on that bell. After a transition the
    box judges the head the write answered (Decision
    13).
11. **The first lists read** keeps today's `loadInto`
    arc (skeleton, failed state with Try Again).
12. **The switch's `aria-label`** repeats its label text,
    as the flow designer's switches do.
13. **After a transition** (Amendment 1, spec "After a
    transition"). `stepIsMine` and `nextWorkOrder` in
    `web-app/app/workbox-next.ts` are the pure decisions.
    A step that is mine: the box re-reads in place. Any
    other: the box shows its skeleton, lets no read of
    the old work order paint (`#movingOn`), and tells the
    page `sentOn(id)`; the page's next lists read that
    paints — the newest under `listsSequence` — picks
    the row from the sections it just drew and opens it
    or closes the box. A failed lists read closes the
    box (no row to open). An open or close the person
    makes first cancels the move.
14. **Focus after a transition** moves to the box itself
    (`section#work-order-box`, now `tabindex="-1"`,
    focused without scrolling): the pressed button is
    repainted away, and the section is never replaced.
15. **A work order the box opens starts at its top:**
    `#show` resets the box's own scroll.
16. **Task numbers 16a–16d** keep Tasks 17–25 numbered
    as first planned.

## Review focus

1. **A refused claim.** The switch is disabled during the
   write and never flips on refusal; after a refusal the
   box and the lists re-read (Task 12; Layer 2 in Task 7
   'a claim another member took leaves the switch off').
2. **Stale reads.** A box read that lands after the
   person opened another work order or closed the box
   paints nothing (`#sequence`, Task 12). A lists read
   under an older `listsSequence` paints nothing (Task
   13).
3. **Counts are derived, not kept.** `paintInbox` (Task
   13) computes pills and lists from one `InboxLists` in
   one call; nothing stores a count.
4. **Pills never repaint the box; the box never repaints
   the pills.** Typed values survive pressing a pill and
   typing a search (Task 13).
5. **`./test lint` checks that every `tests/…` path
   TEST-PLAN.md cites exists.** So TEST-PLAN.md is
   rewritten (Segment 4) before the drag test is deleted
   (Segment 5).
6. **After a transition the lists refresh before the
   next row is chosen.** Only the lists read that paints
   picks it, from what it just drew; the box paints no
   read of the work order it sent on while it waits; the
   work order sent on never reopens (Task 16d; Layer 1 in
   16b, Layer 2 in 16c).

---

## File structure

| File | Responsibility | Tasks |
|---|---|---|
| `web-app/app/presenters/workbox-pills.ts` | pills: derive, draw | 1 |
| `web-app/app/presenters/workbox-inbox.ts` | headed lists per pill; sort; row | 2, 3, 15, 22, 23 |
| `web-app/app/presenters/workbox-detail.ts` | box states, claim place, close | 4, 5 |
| `web-app/app/presenters/index.ts` | exports | 1, 2, 4, 22 |
| `web-app/app/workbox-address.ts` | `?id=` address | 6 |
| `web-app/workbox/work-order-box.ts` | the right box | 12, 16d |
| `web-app/workbox/index.html`, `index.ts` | the page | 13, 16d |
| `web-app/app/workbox-next.ts` | where the box goes after a transition | 16b |
| `web-app/app/styles/pages-workbox.css` | styles | 14, 21, 24 |
| `web-app/records/detail.ts` | work order link | 16 |
| `web-app/app/workbox-inbox-drag.ts` | deleted | 21 |
| `web-app/app/workbox-inbox-rows.ts` | comment | 21 |
| `web-app/workbox/detail.html`, `detail.ts` | deleted | 24 |
| `web-app/app/page-registry.ts` | entry removed | 24 |
| `web-app/app/measure-profile-core.ts`, `measure.ts`, `measurements/budgets.json` | `workbox-detail` out | 25 |
| `TEST-PLAN.md`, `TODO.md`, `DESIGN-SYSTEM.md`, `ARCHITECTURE.md` | documents | 17–20 |

Tests:

| Test | Change | Task |
|---|---|---|
| `tests/presenter-workbox-pills.test.ts` | new | 1, 23 |
| `tests/presenter-workbox-inbox.test.ts` | added to; rewritten helper | 2, 13, 15, 22, 23 |
| `tests/workbox-inbox.test.ts` | claimed sort; helper | 3, 22 |
| `tests/presenter-workbox-detail.test.ts` | added to; one retarget | 4, 5, 24 |
| `tests/workbox-address.test.ts` | new | 6 |
| `tests/workbox-next.test.ts` | new | 16b, 23 |
| `tests/browser/workbox-box.test.ts` | new | 7 |
| `tests/browser/workbox-pills.test.ts` | new | 8 |
| `tests/browser/workbox-transition.test.ts` | restated; scroll fix; after-transition tests | 9, 16a, 16c |
| `tests/browser/workbox-search.test.ts` | restated | 10 |
| `tests/browser/former-member.test.ts` | one test restated | 11 |
| `tests/workbox-inbox-drag.test.ts` | deleted | 21 |
| `tests/page-registry.test.ts` | count, list, new test | 24 |
| `tests/measure-profile-core.test.ts` | three pages | 25 |
| `tests/browser/workbox-inbox-width.test.ts` | unchanged: its `#available-list` still renders | — |
| `tests/browser/record-instance-link.test.ts` | unchanged: no workbox dependency | — |
| `tests/adapters-work-orders.test.ts` | unchanged: no API change; `putWorkOrderPosition` stays | — |
| `tests/api-transition-legacy-cut.test.ts` | unchanged: `presenters/workbox-detail.ts` keeps its name and stays a named exception; the box lives outside the swept roots | — |

Segments: 1 presenters (Tasks 1–6), 2 browser tests,
red (7–11), 3 the page (12–16), 3b after a transition
(16a–16d, Amendment 1), 4 documents (17–20), 5 removals
(21–25).

---
## Segment 1 — Presenters and the address (Layer 1)

Pure, additive work. The old page keeps working on top of
it, except that from Task 5 the detail page shows a close
control with no handler and no back button: that page is
deleted in Task 24.

### Task 1: The pills presenter

Agent: coder. Commandments: Uniformity, Clarity, the
Office of the Interface. Risks: the Cache (no stored
count), Premature Generalization (one page's pills).

**Files:**
- Create: `web-app/app/presenters/workbox-pills.ts`
- Modify: `web-app/app/presenters/index.ts`
- Test: `tests/presenter-workbox-pills.test.ts` (create)

**Interfaces produced:** `PressedPill`, `NO_PILL`,
`samePill`, `pillFlowNamesOf`, `workboxPillsOf`,
`pressedAmong`, `buildWorkboxPills`, `FlowPill`,
`WorkboxPills`.

- [ ] **Step 1: Write the failing test.** Create
  `tests/presenter-workbox-pills.test.ts`:

```ts
import {
    assert,
    assertEquals,
    assertMatch,
    assertStrictEquals,
    assertStringIncludes,
} from '@std/assert';
import {
    NO_PILL,
    buildWorkboxPills,
    pillFlowNamesOf,
    pressedAmong,
    workboxPillsOf,
    type PressedPill,
} from '../web-app/app/presenters/workbox-pills.ts';
import type {
    InboxItem,
    InboxLists,
} from '../web-app/app/presenters/workbox-inbox.ts';

function item(id: string, flowName: string): InboxItem {
    return {
        kind: 'placed',
        id,
        flowName,
        stateName: 'Review',
        transitionerName: null,
        claimedByName: null,
        lastTransitionedAt: '2026-04-01T12:00:00.000000Z',
        completed: false,
        position: 0,
        taskInstructions: '',
    };
}

// Onboarding: two claimed by me of five; Billing: none of
// one; one work order archived by me, in a flow neither
// inbox list holds.
const LISTS: InboxLists = {
    claimed: [
        item('c-1', 'Onboarding'),
        item('c-2', 'Onboarding'),
    ],
    available: [
        item('a-1', 'Onboarding'),
        item('a-2', 'Billing'),
        item('a-3', 'Onboarding'),
        item('a-4', 'Onboarding'),
    ],
    archivedByMe: [item('r-1', 'Archived Only')],
};

function pillsHtml(pressed: PressedPill): string {
    return buildWorkboxPills(
        workboxPillsOf(pillFlowNamesOf(LISTS), LISTS),
        pressed,
    ).toString();
}

// Each pill button's opening tag, in document order.
function pillTags(out: string): string[] {
    return [...out.matchAll(/<button[^>]*>/g)].map(
        (match) => match[0],
    );
}

Deno.test(
    'the pills run Claimed by Me, Archived by Me, a'
    + ' divider, then flows by name',
    () => {
        assertEquals(
            pillFlowNamesOf(LISTS),
            ['Billing', 'Onboarding'],
        );
        const out = pillsHtml(NO_PILL);
        const at = (needle: string) => out.indexOf(needle);
        assert(at('Claimed by Me') >= 0);
        assert(at('Claimed by Me') < at('Archived by Me'));
        assert(
            at('Archived by Me') < at('header-stat-divider'),
        );
        assert(
            at('header-stat-divider')
                < at('data-flow-name="Billing"'),
        );
        assert(
            at('data-flow-name="Billing"')
                < at('data-flow-name="Onboarding"'),
        );
        assertStrictEquals(pillTags(out).length, 4);
        assertMatch(
            out,
            new RegExp(
                '<span\\s+class="header-stat-divider"'
                + '\\s+aria-hidden="true"></span>',
            ),
        );
    },
);

Deno.test('a flow pill counts claimed of total', () => {
    const pills = workboxPillsOf(
        pillFlowNamesOf(LISTS), LISTS,
    );
    assertEquals(pills.flows, [
        { flowName: 'Billing', claimed: 0, total: 1 },
        { flowName: 'Onboarding', claimed: 2, total: 5 },
    ]);
    const out = pillsHtml(NO_PILL);
    assertStringIncludes(
        out, '<span class="workbox-pill-count">2/5</span>',
    );
    assertStringIncludes(
        out, '<span class="workbox-pill-count">0/1</span>',
    );
});

Deno.test('the by-me pills count their lists', () => {
    const pills = workboxPillsOf([], LISTS);
    assertStrictEquals(pills.claimed, 2);
    assertStrictEquals(pills.archivedByMe, 1);
    const out = pillsHtml(NO_PILL);
    assertStringIncludes(
        out,
        'Claimed by Me <span class="workbox-pill-count">2'
        + '</span>',
    );
    assertStringIncludes(
        out,
        'Archived by Me <span class="workbox-pill-count">1'
        + '</span>',
    );
});

Deno.test(
    'a search\'s answer counts while the full read\'s'
    + ' flows keep their pills',
    () => {
        const answer: InboxLists = {
            claimed: [item('c-1', 'Onboarding')],
            available: [],
            archivedByMe: [],
        };
        const pills = workboxPillsOf(
            pillFlowNamesOf(LISTS), answer,
        );
        assertEquals(pills.flows, [
            { flowName: 'Billing', claimed: 0, total: 0 },
            { flowName: 'Onboarding', claimed: 1, total: 1 },
        ]);
        assertStrictEquals(pills.claimed, 1);
        assertStrictEquals(pills.archivedByMe, 0);
    },
);

Deno.test(
    'each pill\'s name says what its numbers mean',
    () => {
        const out = pillsHtml(NO_PILL);
        assertStringIncludes(
            out, 'aria-label="2 work orders claimed by me"',
        );
        assertStringIncludes(
            out, 'aria-label="1 work order archived by me"',
        );
        assertStringIncludes(
            out, 'aria-label="Onboarding: 2 claimed by me of 5"',
        );
        assertStringIncludes(
            out, 'aria-label="Billing: 0 claimed by me of 1"',
        );
    },
);

Deno.test('with no pill pressed none is dimmed', () => {
    for (const tag of pillTags(pillsHtml(NO_PILL))) {
        assertStringIncludes(tag, 'aria-pressed="false"');
        assertStringIncludes(tag, 'data-dimmed="false"');
        assertStringIncludes(tag, 'badge-secondary');
    }
});

Deno.test('a pressed pill is primary and dims the rest', () => {
    const tags = pillTags(pillsHtml({
        kind: 'flow', flowName: 'Onboarding',
    }));
    const on = tags.filter(
        (tag) => tag.includes('aria-pressed="true"'),
    );
    assertStrictEquals(on.length, 1);
    assertStringIncludes(on[0]!, 'data-flow-name="Onboarding"');
    assertStringIncludes(on[0]!, 'badge-primary');
    assertStringIncludes(on[0]!, 'data-dimmed="false"');
    for (const tag of tags.filter((tag) => tag !== on[0])) {
        assertStringIncludes(tag, 'aria-pressed="false"');
        assertStringIncludes(tag, 'data-dimmed="true"');
        assertStringIncludes(tag, 'badge-secondary');
    }
});

Deno.test('pressing Claimed by Me presses only it', () => {
    const on = pillTags(pillsHtml({ kind: 'claimed' })).filter(
        (tag) => tag.includes('aria-pressed="true"'),
    );
    assertStrictEquals(on.length, 1);
    assertStringIncludes(on[0]!, 'data-workbox-pill="claimed"');
});

Deno.test(
    'a pressed flow pill whose flow is gone is un-pressed',
    () => {
        assertEquals(
            pressedAmong(
                { kind: 'flow', flowName: 'Gone' }, ['Billing'],
            ),
            NO_PILL,
        );
        assertEquals(
            pressedAmong(
                { kind: 'flow', flowName: 'Billing' },
                ['Billing'],
            ),
            { kind: 'flow', flowName: 'Billing' },
        );
        assertEquals(
            pressedAmong({ kind: 'claimed' }, []),
            { kind: 'claimed' },
        );
    },
);

Deno.test('a flow name is escaped', () => {
    const lists: InboxLists = {
        claimed: [],
        available: [item('a-1', '<b>R&D</b>')],
        archivedByMe: [],
    };
    const out = buildWorkboxPills(
        workboxPillsOf(pillFlowNamesOf(lists), lists),
        NO_PILL,
    ).toString();
    assertStringIncludes(
        out, 'data-flow-name="&lt;b&gt;R&amp;D&lt;/b&gt;"',
    );
    assert(!out.includes('<b>'));
});
```

- [ ] **Step 2: Run** ONE-FILE with
  `tests/presenter-workbox-pills.test.ts`. Expected: FAIL,
  `Module not found` for `workbox-pills.ts`.

- [ ] **Step 3: Implement.** Create
  `web-app/app/presenters/workbox-pills.ts`:

```ts
import { html, type SafeHtml } from '../safe-html.ts';
import type {
    InboxItem,
    InboxLists,
} from './workbox-inbox.ts';

// The pill the person pressed: at most one is, or none.
export type PressedPill =
    | { readonly kind: 'none' }
    | { readonly kind: 'claimed' }
    | { readonly kind: 'archivedByMe' }
    | { readonly kind: 'flow'; readonly flowName: string };

type WorkboxPill = Exclude<PressedPill, { kind: 'none' }>;

export const NO_PILL: PressedPill = { kind: 'none' };

// A flow pill's two numbers: of that flow's work orders in
// the claimed and available lists, how many are mine and
// how many there are.
export interface FlowPill {
    readonly flowName: string;
    readonly claimed: number;
    readonly total: number;
}

// Every number the pills show.
export interface WorkboxPills {
    readonly claimed: number;
    readonly archivedByMe: number;
    readonly flows: readonly FlowPill[];
}

export function samePill(
    a: PressedPill,
    b: PressedPill,
): boolean {
    if (a.kind === 'flow' && b.kind === 'flow') {
        return a.flowName === b.flowName;
    }
    return a.kind === b.kind;
}

// One pill per flow name among the work orders in the
// claimed and available lists, by name. The page passes its
// last full read's lists, so a search moves no pill.
export function pillFlowNamesOf(lists: InboxLists): string[] {
    const names = new Set(
        [...lists.claimed, ...lists.available].map(
            (item) => item.flowName,
        ),
    );
    return [...names].toSorted((a, b) => a.localeCompare(b));
}

// The numbers come from the lists before any pill narrows
// them: the full read's, or a search's answer.
export function workboxPillsOf(
    flowNames: readonly string[],
    lists: InboxLists,
): WorkboxPills {
    return {
        claimed: lists.claimed.length,
        archivedByMe: lists.archivedByMe.length,
        flows: flowNames.map((flowName) => {
            const claimed = countInFlow(
                lists.claimed, flowName,
            );
            return {
                flowName,
                claimed,
                total: claimed
                    + countInFlow(lists.available, flowName),
            };
        }),
    };
}

function countInFlow(
    items: readonly InboxItem[],
    flowName: string,
): number {
    return items.filter(
        (item) => item.flowName === flowName,
    ).length;
}

// A pressed flow pill whose flow no longer has a pill is
// un-pressed.
export function pressedAmong(
    pressed: PressedPill,
    flowNames: readonly string[],
): PressedPill {
    return pressed.kind === 'flow'
        && !flowNames.includes(pressed.flowName)
        ? NO_PILL
        : pressed;
}

export function buildWorkboxPills(
    pills: WorkboxPills,
    pressed: PressedPill,
): SafeHtml {
    return html`${buildPill(
        { kind: 'claimed' },
        'Claimed by Me',
        String(pills.claimed),
        workOrdersBy(pills.claimed, 'claimed by me'),
        pressed,
    )}${buildPill(
        { kind: 'archivedByMe' },
        'Archived by Me',
        String(pills.archivedByMe),
        workOrdersBy(pills.archivedByMe, 'archived by me'),
        pressed,
    )}<span
        class="header-stat-divider"
        aria-hidden="true"></span>${pills.flows.map(
        (flow) => buildPill(
            { kind: 'flow', flowName: flow.flowName },
            flow.flowName,
            flow.claimed + '/' + flow.total,
            flow.flowName + ': ' + flow.claimed
                + ' claimed by me of ' + flow.total,
            pressed,
        ),
    )}`;
}

// "5 work orders claimed by me", "1 work order archived by
// me": DESIGN-SYSTEM.md's plural rule.
function workOrdersBy(count: number, by: string): string {
    return count + ' '
        + (count === 1 ? 'work order' : 'work orders')
        + ' ' + by;
}

// A filter chip: the badge look and dimming of the state
// chips on Ideas, Projects, and Records. Its name says
// what its numbers mean.
function buildPill(
    pill: WorkboxPill,
    label: string,
    count: string,
    name: string,
    pressed: PressedPill,
): SafeHtml {
    const isPressed = samePill(pill, pressed);
    const dimmed = pressed.kind !== 'none' && !isPressed;
    const flowAttr = pill.kind === 'flow'
        ? html` data-flow-name="${pill.flowName}"`
        : html``;
    return html`<button type="button" class="${
        'badge text-xs cursor-pointer '
        + (isPressed ? 'badge-primary' : 'badge-secondary')
    }" data-workbox-pill="${pill.kind}"${flowAttr} aria-pressed="${
        isPressed ? 'true' : 'false'
    }" data-dimmed="${
        dimmed ? 'true' : 'false'
    }" aria-label="${name}" title="${name}">${label} ${
        buildCount(count)
    }</button>`;
}

function buildCount(count: string): SafeHtml {
    return html`<span class="workbox-pill-count">${count}</span>`;
}
```

  In `web-app/app/presenters/index.ts`, replace:

```ts
export {
    buildAttributeInputHtml,
    WorkboxDetailPresenter,
} from './workbox-detail.ts';
```

  with:

```ts
export {
    NO_PILL,
    buildWorkboxPills,
    pillFlowNamesOf,
    pressedAmong,
    samePill,
    workboxPillsOf,
    type PressedPill,
} from './workbox-pills.ts';
export {
    buildAttributeInputHtml,
    WorkboxDetailPresenter,
} from './workbox-detail.ts';
```

- [ ] **Step 4: Run** ONE-FILE with
  `tests/presenter-workbox-pills.test.ts` — PASS (10
  tests). Then
  `export DENO_DIR="$TMPDIR/deno-dir" && ./test validate --syntax`
  — PASS; `export DENO_DIR="$TMPDIR/deno-dir" && ./test`
  — PASS; `export DENO_DIR="$TMPDIR/deno-dir" && ./test lint`
  — PASS.

- [ ] **Step 5: Commit** `Add the workbox pills presenter`.

### Task 2: The headed lists each pill draws

Agent: coder. Commandments: Clarity, Uniformity. Risks:
Default Values (no optional `pressed`), Premature
Generalization.

The class `WorkboxInboxPresenter` stays for the old page
until Task 22; its row builder becomes the module
function `buildInboxRow`, shared by the class and the new
`buildInboxLists`. The row's markup does not change in
this task.

**Files:**
- Modify (whole file below):
  `web-app/app/presenters/workbox-inbox.ts`
- Modify: `web-app/app/presenters/index.ts`
- Test: `tests/presenter-workbox-inbox.test.ts`

**Interfaces produced:** `InboxSection`,
`inboxSectionsOf(lists, pressed)`,
`buildInboxLists(sections, filter, pressed)`.

- [ ] **Step 1: Write the failing tests.** In
  `tests/presenter-workbox-inbox.test.ts`, replace the
  import block:

```ts
import {
    WorkboxInboxPresenter,
    type InboxFilter,
    type InboxItem,
} from
    '../web-app/app/presenters/workbox-inbox.ts';
```

  with:

```ts
import {
    WorkboxInboxPresenter,
    buildInboxLists,
    inboxSectionsOf,
    type InboxFilter,
    type InboxItem,
    type InboxLists,
} from
    '../web-app/app/presenters/workbox-inbox.ts';
import {
    NO_PILL,
    type PressedPill,
} from '../web-app/app/presenters/workbox-pills.ts';
```

  and replace the `@std/assert` import block, which
  today reads:

```ts
import {
    assertEquals,
    assertMatch,
    assertStringIncludes,
} from '@std/assert';
```

  with:

```ts
import {
    assert,
    assertEquals,
    assertMatch,
    assertStringIncludes,
} from '@std/assert';
```

  Then append to the end of the file:

```ts
const LISTS: InboxLists = {
    claimed: [
        placed({ id: 'c-1', flowName: 'Onboarding' }),
        placed({ id: 'c-2', flowName: 'Billing' }),
    ],
    available: [
        placed({ id: 'a-1', flowName: 'Billing' }),
        placed({ id: 'a-2', flowName: 'Onboarding' }),
    ],
    archivedByMe: [placed({ id: 'r-1', completed: true })],
};

const NO_LISTS: InboxLists = {
    claimed: [],
    available: [],
    archivedByMe: [],
};

// Each section as `kind:id,id`, in drawing order.
function sectionsDrawn(pressed: PressedPill): string[] {
    return inboxSectionsOf(LISTS, pressed).map(
        (section) => section.kind + ':'
            + section.items.map((i) => i.id).join(','),
    );
}

function listsHtml(
    lists: InboxLists,
    filter: InboxFilter,
    pressed: PressedPill,
): string {
    return buildInboxLists(
        inboxSectionsOf(lists, pressed), filter, pressed,
    ).toString();
}

Deno.test(
    'with no pill pressed claimed draws above available',
    () => {
        assertEquals(sectionsDrawn(NO_PILL), [
            'claimed:c-1,c-2', 'available:a-1,a-2',
        ]);
        const out = listsHtml(LISTS, NO_FILTER, NO_PILL);
        const claimed = out.indexOf('Work Orders claimed by me');
        const available = out.indexOf(
            'Work Orders available to me',
        );
        assert(claimed >= 0 && claimed < available);
        assert(
            out.indexOf('id="claimed-list"')
                < out.indexOf('id="available-list"'),
        );
    },
);

Deno.test('Claimed by Me draws only the claimed list', () => {
    assertEquals(
        sectionsDrawn({ kind: 'claimed' }),
        ['claimed:c-1,c-2'],
    );
});

Deno.test(
    'Archived by Me draws one list in place of the two',
    () => {
        assertEquals(
            sectionsDrawn({ kind: 'archivedByMe' }),
            ['archivedByMe:r-1'],
        );
        const out = listsHtml(
            LISTS, NO_FILTER, { kind: 'archivedByMe' },
        );
        assertStringIncludes(out, 'Work Orders archived by me');
        assertStringIncludes(out, 'id="archived-list"');
        assertEquals(
            out.includes('Work Orders available to me'), false,
        );
        assertEquals(
            out.includes('Work Orders claimed by me'), false,
        );
    },
);

Deno.test('a flow pill narrows both lists to its flow', () => {
    assertEquals(
        sectionsDrawn({ kind: 'flow', flowName: 'Billing' }),
        ['claimed:c-2', 'available:a-1'],
    );
});

Deno.test('each list keeps its heading when empty', () => {
    const out = listsHtml(NO_LISTS, NO_FILTER, NO_PILL);
    assertStringIncludes(out, 'Work Orders claimed by me');
    assertStringIncludes(out, 'No work orders claimed by me');
    assertStringIncludes(out, 'Work Orders available to me');
    assertStringIncludes(out, 'No work orders available to me');
});

Deno.test(
    'an empty list under a flow pill names the flow',
    () => {
        const pressed: PressedPill = {
            kind: 'flow', flowName: 'Billing',
        };
        const lists: InboxLists = {
            claimed: [],
            available: [placed({ flowName: 'Billing' })],
            archivedByMe: [],
        };
        const out = listsHtml(lists, NO_FILTER, pressed);
        assertStringIncludes(
            out, 'No work orders claimed by me in Billing',
        );
        assertEquals(
            out.includes('No work orders available to me'),
            false,
        );
    },
);

Deno.test(
    'a search\'s empty line wins over the flow',
    () => {
        const pressed: PressedPill = {
            kind: 'flow', flowName: 'Billing',
        };
        const out = listsHtml(
            NO_LISTS, { kind: 'matched', text: 'zz' }, pressed,
        );
        assertStringIncludes(out, 'No work orders match “zz”');
        assertEquals(out.includes(' in Billing'), false);
    },
);
```

- [ ] **Step 2: Run** ONE-FILE with
  `tests/presenter-workbox-inbox.test.ts`. Expected: FAIL —
  `buildInboxLists` and `inboxSectionsOf` are not exported
  (a SyntaxError naming the missing export).

- [ ] **Step 3: Implement.** Replace the whole of
  `web-app/app/presenters/workbox-inbox.ts` with:

```ts
import {
    html, setHtml, SafeHtml,
    trusted, escapeForHtml,
} from '../safe-html.ts';
import { DISPLAY_ABSENT } from '../format.ts';
import { idLabel } from './id-label.ts';
import { buildPageUrl } from '../navigation.ts';
import {
    type WorkOrder,
} from '../../../client/index.ts';
import {
    SECONDS_PER_DAY,
    MS_PER_SECOND,
} from '../../../shared/types.ts';
import type { Id } from '../../../shared/types.ts';
import type { PressedPill } from './workbox-pills.ts';

const DAY_MS = SECONDS_PER_DAY * MS_PER_SECOND;

function relativeTime(iso: string): string {
    const ms = Date.now()
        - new Date(iso).getTime();
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    const d = Math.floor(ms / DAY_MS);
    if (d > 0) return d + 'd ago';
    if (hr > 0) return hr + 'h ago';
    if (min > 0) return min + 'm ago';
    return 'just now';
}

interface PlacedInboxItem {
    kind: 'placed';
    id: string;
    flowName: string;
    stateName: string;
    transitionerName: string | null;
    claimedByName: string | null;
    lastTransitionedAt: string | null;
    completed: boolean;
    position: number;
    taskInstructions: string;
}

// A head whose node its flow graph no longer holds: it has
// no state to name, no completion, and no instructions.
interface UnplacedInboxItem {
    kind: 'unplaced';
    id: string;
    flowName: string;
    transitionerName: string | null;
    claimedByName: string | null;
    lastTransitionedAt: string | null;
    position: number;
}

export type InboxItem = PlacedInboxItem | UnplacedInboxItem;

export type InboxListKind =
    | 'available'
    | 'claimed'
    | 'archivedByMe';

const EMPTY_COPY: Record<InboxListKind, string> = {
    available: 'No work orders available to me',
    claimed: 'No work orders claimed by me',
    archivedByMe: 'No work orders archived by me',
};

const LIST_TITLE: Record<InboxListKind, string> = {
    available: 'Work Orders available to me',
    claimed: 'Work Orders claimed by me',
    archivedByMe: 'Work Orders archived by me',
};

const LIST_ID: Record<InboxListKind, string> = {
    available: 'available-list',
    claimed: 'claimed-list',
    archivedByMe: 'archived-list',
};

// What narrows a painted list: nothing, or the search
// text whose QUERY answer the list holds.
export type InboxFilter =
    | { readonly kind: 'none' }
    | { readonly kind: 'matched'; readonly text: string };

export interface InboxLists {
    available: InboxItem[];
    claimed: InboxItem[];
    archivedByMe: InboxItem[];
}

// A work order's claim that is live now: the head's claim,
// judged against its expiresAt by the page that reads the
// twin. The inbox names the claim-holder on the item it
// renders — a claimed work order is shown, never hidden.
export interface ActiveClaim {
    memberId: Id;
    at: string;
}

// One headed list the left box draws: which list, and the
// rows the pressed pill leaves in it.
export interface InboxSection {
    readonly kind: InboxListKind;
    readonly items: readonly InboxItem[];
}

// Static: no data-work-order-card, so the page neither
// navigates it to a detail page that cannot place it nor
// drags it; no link and no grip either.
function buildUnplacedRow(
    item: UnplacedInboxItem,
): SafeHtml {
    return html`
        <div class="card p-4">
            <div class="flex-fill">
                <div class="${
                    'flex items-center'
                    + ' gap-2 mb-1'
                }">
                    <span class="${
                        'font-semibold'
                    }">${
                        item.flowName
                    }</span>
                    <span class="${
                        'text-xs text-muted min-w-0'
                    }">${
                        idLabel('Work order', item.id)
                    }</span>
                </div>
                <div class="${
                    'flex items-center'
                    + ' gap-2 text-sm'
                    + ' text-muted'
                }">
                    <span
                        class="badge badge-warning"
                        >State unknown</span>
                    <span class="ml-auto"
                        >${
                            item.lastTransitionedAt
                                ? relativeTime(
                                    item.lastTransitionedAt,
                                )
                                : DISPLAY_ABSENT
                        }</span>
                </div>
            </div>
        </div>`;
}

// A row: its title links to its work order, its state
// badge and age below.
function buildInboxRow(
    item: InboxItem,
): SafeHtml {
    if (item.kind === 'unplaced')
        return buildUnplacedRow(item);
    const titleAttr = item.taskInstructions
        ? trusted(' title="'
            + escapeForHtml(
                item.taskInstructions,
            )
            + '"')
        : trusted('');
    const badge = item.completed
        ? html`<span
            class="badge badge-success"
            >Complete</span>`
        : html`<span
            class="badge badge-info"${
            titleAttr}
            >${item.stateName}</span>`;
    return html`
    <div
        class="card p-4 cursor-pointer"
        data-work-order-card="${item.id}"
        data-position="${item.position}">
        <div class="${
            'flex items-center gap-4'
        }">
            <div class="flex-fill">
                <a href="${
                    buildPageUrl(
                        'workbox-detail',
                        { id: item.id },
                    )
                }" class="${
                    'flex items-center'
                    + ' gap-2 mb-1'
                }">
                    <span class="${
                        'font-semibold'
                    }">${
                        item.flowName
                    }</span>
                    <span class="${
                        'text-xs text-muted min-w-0'
                    }">${
                        idLabel('Work order', item.id)
                    }</span>
                </a>
                <div class="${
                    'flex items-center'
                    + ' gap-2 text-sm'
                    + ' text-muted'
                }">
                    ${badge}
                    <span class="ml-auto"
                        >${
                            item.lastTransitionedAt
                                ? relativeTime(
                                    item.lastTransitionedAt,
                                )
                                : DISPLAY_ABSENT
                        }</span>
                </div>
            </div>
        </div>
    </div>`;
}

export class WorkboxInboxPresenter {
    readonly #items: readonly InboxItem[];
    readonly #kind: InboxListKind;
    readonly #filter: InboxFilter;

    constructor(
        items: readonly InboxItem[],
        kind: InboxListKind,
        filter: InboxFilter,
    ) {
        this.#items = items;
        this.#kind = kind;
        this.#filter = filter;
    }

    renderList(
        container: HTMLElement,
    ): void {
        if (this.#items.length === 0) {
            setHtml(container, html`<p
                class="text-muted"
            >${this.#emptyCopy()}</p>`);
            return;
        }
        setHtml(container, html`${
            this.#items.map(buildInboxRow)
        }`);
    }

    #emptyCopy(): string {
        return this.#filter.kind === 'matched'
            ? 'No work orders match “'
                + this.#filter.text + '”'
            : EMPTY_COPY[this.#kind];
    }
}

// What the left box draws for the pressed pill: both
// lists, claimed first; the claimed list alone; the
// archive alone; or both lists narrowed to one flow.
export function inboxSectionsOf(
    lists: InboxLists,
    pressed: PressedPill,
): InboxSection[] {
    if (pressed.kind === 'claimed') {
        return [{ kind: 'claimed', items: lists.claimed }];
    }
    if (pressed.kind === 'archivedByMe') {
        return [{
            kind: 'archivedByMe', items: lists.archivedByMe,
        }];
    }
    if (pressed.kind === 'flow') {
        return [
            {
                kind: 'claimed',
                items: inFlow(lists.claimed, pressed.flowName),
            },
            {
                kind: 'available',
                items: inFlow(
                    lists.available, pressed.flowName,
                ),
            },
        ];
    }
    return [
        { kind: 'claimed', items: lists.claimed },
        { kind: 'available', items: lists.available },
    ];
}

function inFlow(
    items: readonly InboxItem[],
    flowName: string,
): InboxItem[] {
    return items.filter((item) => item.flowName === flowName);
}

// The headed lists; an empty one keeps its heading and
// says so.
export function buildInboxLists(
    sections: readonly InboxSection[],
    filter: InboxFilter,
    pressed: PressedPill,
): SafeHtml {
    return html`${sections.map(
        (section, index) => buildInboxSection(
            section, index === 0, filter, pressed,
        ),
    )}`;
}

function buildInboxSection(
    section: InboxSection,
    first: boolean,
    filter: InboxFilter,
    pressed: PressedPill,
): SafeHtml {
    const rows = section.items.length === 0
        ? html`<p class="text-muted">${
            emptyCopyOf(section.kind, filter, pressed)
        }</p>`
        : html`${section.items.map(buildInboxRow)}`;
    return html`<h2 class="${
        first
            ? 'text-lg font-semibold mb-4'
            : 'text-lg font-semibold mt-6 mb-4'
    }">${LIST_TITLE[section.kind]}</h2>
    <div
        id="${LIST_ID[section.kind]}"
        class="flex flex-col gap-3"
        data-inbox-list="${section.kind}">${rows}</div>`;
}

// A search's empty line names its text; under a flow pill
// a list's own line names the flow.
function emptyCopyOf(
    kind: InboxListKind,
    filter: InboxFilter,
    pressed: PressedPill,
): string {
    if (filter.kind === 'matched') {
        return 'No work orders match “' + filter.text + '”';
    }
    if (pressed.kind === 'flow') {
        return EMPTY_COPY[kind] + ' in ' + pressed.flowName;
    }
    return EMPTY_COPY[kind];
}

function archiveNode(
    wo: WorkOrder,
): boolean {
    const node = wo.flowGraph.nodes.find(
        n => n.id === wo.nodeId,
    );
    return node?.isArchive === true;
}

function toItem(wo: WorkOrder): InboxItem {
    const fg = wo.flowGraph;
    const curNode = fg.nodes.find(
        n => n.id === wo.nodeId,
    );
    const row = {
        id: wo.id,
        flowName: fg.name,
        transitionerName: null as string | null,
        claimedByName: null as string | null,
        lastTransitionedAt: wo.transition.at,
        position: wo.position,
    };
    return curNode
        ? {
            kind: 'placed',
            ...row,
            stateName: curNode.name,
            completed: curNode.isArchive,
            taskInstructions:
                curNode.taskInstructions,
        }
        : { kind: 'unplaced', ...row };
}

function byAtAsc(
    a: InboxItem, b: InboxItem,
): number {
    return (a.lastTransitionedAt ?? '')
        .localeCompare(
            b.lastTransitionedAt ?? '',
        );
}

function byAtDesc(
    a: InboxItem, b: InboxItem,
): number {
    return byAtAsc(b, a);
}

function byPosition(
    a: InboxItem, b: InboxItem,
): number {
    return a.position - b.position;
}

// Each work order into the list its membership rules name,
// in the order given: a QUERY answer keeps its best match
// first.
export function partitionInboxItems(
    workOrders: readonly WorkOrder[],
    activeClaimsByWo:
        ReadonlyMap<Id, ActiveClaim>,
    currentMemberId: Id,
): InboxLists {
    const available: InboxItem[] = [];
    const claimed: InboxItem[] = [];
    const archivedByMe: InboxItem[] = [];
    for (const wo of workOrders) {
        if (archiveNode(wo)) {
            if (
                wo.transition.memberId
                    === currentMemberId
            ) {
                archivedByMe.push(toItem(wo));
            }
            continue;
        }
        const live = activeClaimsByWo.get(wo.id);
        if (live) {
            if (live.memberId === currentMemberId) {
                claimed.push(toItem(wo));
            }
            continue;
        }
        available.push(toItem(wo));
    }
    return { available, claimed, archivedByMe };
}

export function buildInboxItems(
    workOrders: readonly WorkOrder[],
    activeClaimsByWo:
        ReadonlyMap<Id, ActiveClaim>,
    currentMemberId: Id,
): InboxLists {
    const lists = partitionInboxItems(
        workOrders, activeClaimsByWo, currentMemberId,
    );
    return {
        available: lists.available.toSorted(byAtAsc),
        claimed: lists.claimed.toSorted(byPosition),
        archivedByMe:
            lists.archivedByMe.toSorted(byAtDesc),
    };
}
```

  (The `?? ''` in `byAtAsc` is today's code, untouched.)

  In `web-app/app/presenters/index.ts`, replace:

```ts
export {
    WorkboxInboxPresenter,
    buildInboxItems,
    partitionInboxItems,
    type InboxFilter,
    type InboxListKind,
    type InboxLists,
    type InboxItem,
} from './workbox-inbox.ts';
```

  with:

```ts
export {
    WorkboxInboxPresenter,
    buildInboxItems,
    buildInboxLists,
    inboxSectionsOf,
    partitionInboxItems,
    type InboxFilter,
    type InboxListKind,
    type InboxLists,
    type InboxItem,
} from './workbox-inbox.ts';
```

- [ ] **Step 4: Run** ONE-FILE with
  `tests/presenter-workbox-inbox.test.ts` — PASS. Run
  ONE-FILE with `tests/workbox-inbox.test.ts` — PASS
  (unchanged behaviour). Then `./test validate --syntax`,
  `./test`, `./test lint` — all PASS (each prefixed with
  the `DENO_DIR` export).

- [ ] **Step 5: Commit** `Draw the inbox as headed lists per pill`.

### Task 3: Sort claimed work orders oldest first

Agent: coder. Commandment: Logic. Risk: Test Weakening.

The spec orders both lists oldest last-transition first;
the hand-chosen claimed order went with the drag. The
position sort is retired, so the test that pins it is
deleted, and `buildInboxItems still sorts` — whose
fixture puts each list's input in the reverse of its sort
— now reverses the claimed rows by time instead of by
position.

**Files:**
- Modify: `web-app/app/presenters/workbox-inbox.ts`
- Test: `tests/workbox-inbox.test.ts`

- [ ] **Step 1: Change the tests.** In
  `tests/workbox-inbox.test.ts`:

  (a) Delete the whole test that begins
  `Deno.test(\n    'claimed sorts by position',` and ends
  with the `);` after
  `            [2.5, 5, 7.5],\n        );\n    },` — i.e.
  this exact block (and the blank line after it):

```ts
Deno.test(
    'claimed sorts by position',
    async () => {
        const db = memoryDbAdapter();
        await seedAdminSchema(db);
        await seedHumanMember(db, DEMO, 'Demo Test');
        const ctx = inPageContext(
            db, await organizationToken(),
        );
        await seedFlow(
            db, 'ZOousbbnzpqlxJExVAruYQ',
            buildLinearGraph(),
        );
        for (let i = 0; i < 3; i++) {
            await createWorkOrderFromFlow(ctx, {
                workOrderId: generateIdentifier(),
                flowLinkId: generateIdentifier(),
                flowId: 'ZOousbbnzpqlxJExVAruYQ',
            });
        }
        const created = await getWorkOrders(ctx);
        const explicit = [7.5, 2.5, 5];
        for (let i = 0; i < created.length; i++) {
            await putWorkOrderPosition(
                ctx, created[i]!, explicit[i]!,
            );
        }
        const t = await collectTables(db);
        const lists = listsOf(
            t.workOrders,
            t.activeClaimsByWo,
            DEMO,
        );
        assertEquals(
            lists.claimed.map(i => i.position),
            [2.5, 5, 7.5],
        );
    },
);
```

  (b) Replace the import block

```ts
import {
    getWorkOrders,
    putWorkOrderPosition,
    type WorkOrder,
} from '../client/index.ts';
```

  with

```ts
import {
    type WorkOrder,
} from '../client/index.ts';
```

  (c) In `reversedWorkOrders`, the claimed variants. Replace

```ts
            return variant(
                id, N_MIDDLE,
                '2030-01-0' + (i + 1) + 'T00:00:00.000000Z',
                3 - i,
            );
```

  with

```ts
            return variant(
                id, N_MIDDLE,
                '2030-01-0' + (3 - i) + 'T00:00:00.000000Z',
                i + 1,
            );
```

  Now cl-3 is the newest transition and cl-1 the oldest,
  so the input is the reverse of the time sort; and the
  positions run cl-3:1, cl-2:2, cl-1:3, so the retired
  position sort would give the input order back.
  `buildInboxItems still sorts` keeps its expected
  `['cl-1', 'cl-2', 'cl-3']`; `partitionInboxItems keeps
  input order` keeps `['cl-3', 'cl-2', 'cl-1']`.

- [ ] **Step 2: Run** ONE-FILE with
  `tests/workbox-inbox.test.ts`. Expected: FAIL —
  `buildInboxItems still sorts`, claimed actual
  `["cl-3","cl-2","cl-1"]`, expected
  `["cl-1","cl-2","cl-3"]` (the position sort is still
  in place).

- [ ] **Step 3: Implement.** In
  `web-app/app/presenters/workbox-inbox.ts`, delete:

```ts
function byPosition(
    a: InboxItem, b: InboxItem,
): number {
    return a.position - b.position;
}

```

  and replace

```ts
        claimed: lists.claimed.toSorted(byPosition),
```

  with

```ts
        claimed: lists.claimed.toSorted(byAtAsc),
```

- [ ] **Step 4: Run** ONE-FILE with
  `tests/workbox-inbox.test.ts` — PASS. `./test validate
  --syntax`, `./test`, `./test lint` — PASS.

- [ ] **Step 5: Commit** `Sort claimed work orders oldest first`.

### Task 4: The box's empty, loading, and failed states

Agent: coder. Commandments: Uniformity (the page's
skeleton, failed state, and muted note), the Office of
the Interface. Risks: Unbidden Helper Code.

**Files:**
- Modify: `web-app/app/presenters/workbox-detail.ts`
- Modify: `web-app/app/presenters/index.ts`
- Test: `tests/presenter-workbox-detail.test.ts`

**Interfaces produced:** `buildWorkOrderBoxEmpty()`,
`buildWorkOrderBoxLoading()`,
`buildWorkOrderBoxFailed(message)`; the module-private
`buildWorkOrderClose()` that Task 5 reuses.

- [ ] **Step 1: Write the failing tests.** In
  `tests/presenter-workbox-detail.test.ts` replace

```ts
import {
    WorkboxDetailPresenter,
    buildAttributeInputHtml,
} from
'../web-app/app/presenters/workbox-detail.ts';
```

  with

```ts
import {
    WorkboxDetailPresenter,
    buildAttributeInputHtml,
    buildWorkOrderBoxEmpty,
    buildWorkOrderBoxFailed,
    buildWorkOrderBoxLoading,
} from
'../web-app/app/presenters/workbox-detail.ts';
```

  and append to the end of the file:

```ts
// The box before anything is opened, and while its read
// is in flight or has failed.

Deno.test('an unopened box says how to open a work order', () => {
    const out = buildWorkOrderBoxEmpty().toString();
    assertMatch(out, /<h2[^>]*>Work Order<\/h2>/);
    assertStringIncludes(
        out, 'Select a work order to open it here',
    );
    assert(!out.includes('work-order-close'));
});

Deno.test('a loading box carries the close control', () => {
    const out = buildWorkOrderBoxLoading().toString();
    assertStringIncludes(out, 'id="work-order-close"');
    assertStringIncludes(out, 'aria-label="Close work order"');
    assertStringIncludes(out, 'skeleton-shimmer');
});

Deno.test(
    'a failed box carries the close control and Try Again',
    () => {
        const out = buildWorkOrderBoxFailed('No route')
            .toString();
        assertStringIncludes(out, 'id="work-order-close"');
        assertStringIncludes(out, 'No route');
        assertStringIncludes(out, 'data-retry-btn');
        assertStringIncludes(out, 'Try Again');
    },
);
```

- [ ] **Step 2: Run** ONE-FILE with
  `tests/presenter-workbox-detail.test.ts`. Expected:
  FAIL — the three builders are not exported.

- [ ] **Step 3: Implement.** In
  `web-app/app/presenters/workbox-detail.ts`, replace

```ts
import {
    ICON_SIZE,
    iconArrowLeft,
    iconClock,
} from '../icons.ts';
```

  with

```ts
import {
    ICON_SIZE,
    iconArrowLeft,
    iconClock,
    iconXCircle,
} from '../icons.ts';
import {
    buildErrorState,
    buildSkeleton,
} from '../loading-states.ts';
import { mutedEmptyNote } from './empty-note.ts';
```

  and replace

```ts
export class WorkboxDetailPresenter {
    readonly #workOrder: WorkOrder;
```

  with

```ts
// The box's close control, in every state an opened work
// order takes: loading, failed, and loaded.
function buildWorkOrderClose(): SafeHtml {
    return html`<button
        type="button"
        class="btn btn-ghost btn-icon"
        id="work-order-close"
        aria-label="Close work order"
        title="Close work order">
        ${iconXCircle(ICON_SIZE.xl, '')}
    </button>`;
}

// Before anything is opened, and after it is closed.
export function buildWorkOrderBoxEmpty(): SafeHtml {
    return html`<h2 class="text-lg font-semibold mb-4"
        >Work Order</h2>
    <div class="workbox-work-order-empty">${
        mutedEmptyNote('Select a work order to open it here')
    }</div>`;
}

// Its read in flight: the detail page's skeleton.
export function buildWorkOrderBoxLoading(): SafeHtml {
    return html`<div class="flex justify-end mb-2">${
        buildWorkOrderClose()
    }</div>${buildSkeleton('detail', 4)}`;
}

// Its read failed: the page's failed-load state.
export function buildWorkOrderBoxFailed(
    message: string,
): SafeHtml {
    return html`<div class="flex justify-end mb-2">${
        buildWorkOrderClose()
    }</div>${buildErrorState(message, 'Try Again')}`;
}

export class WorkboxDetailPresenter {
    readonly #workOrder: WorkOrder;
```

  In `web-app/app/presenters/index.ts`, replace

```ts
export {
    buildAttributeInputHtml,
    WorkboxDetailPresenter,
} from './workbox-detail.ts';
```

  with

```ts
export {
    buildAttributeInputHtml,
    buildWorkOrderBoxEmpty,
    buildWorkOrderBoxFailed,
    buildWorkOrderBoxLoading,
    WorkboxDetailPresenter,
    type WorkOrderBinding,
} from './workbox-detail.ts';
```

- [ ] **Step 4: Run** ONE-FILE with
  `tests/presenter-workbox-detail.test.ts` — PASS.
  `./test validate --syntax`, `./test`, `./test lint` —
  PASS.

- [ ] **Step 5: Commit** `Add the work order box's three states`.

### Task 5: The claim place and close in the box's header

Agent: coder. Commandments: Reliability (a lapsed claim
is no claim), Uniformity (`.switch` inside its label,
named as the flow designer's switches are), the Office
of the Interface. Risks: Default Values, Internal
Defense.

The header loses the back button and gains, at the title
row's right end, the claim place and the close control.
The title becomes an `h2` (the page's `h1` is
"Workbox"). The outer `entity` width class goes: the box
is not a page.

**Files:**
- Modify: `web-app/app/presenters/workbox-detail.ts`
- Test: `tests/presenter-workbox-detail.test.ts`

- [ ] **Step 1: Write the failing tests.** Append to
  `tests/presenter-workbox-detail.test.ts`:

```ts
// The claim place: a switch, a holder's name, or nothing.
function claimPlaceOf(out: string): string | null {
    const place = out.match(
        /<(label|span)\s+id="work-order-claim"[\s\S]*?<\/\1>/,
    );
    return place === null ? null : place[0];
}

Deno.test('the box has a close control and no back button', () => {
    const out = makePresenter().buildPage().toString();
    assertStringIncludes(out, 'id="work-order-close"');
    assertStringIncludes(out, 'aria-label="Close work order"');
    assert(!out.includes('work-order-back-btn'));
    assert(!out.includes('aria-label="Back"'));
});

Deno.test(
    'an unclaimed work order offers the claim switch off',
    () => {
        const place = claimPlaceOf(
            makePresenter({ activeClaim: null })
                .buildPage().toString(),
        );
        assert(place !== null);
        assertStringIncludes(place, 'role="switch"');
        assertStringIncludes(place, 'aria-checked="false"');
        assertStringIncludes(place, 'aria-label="Claim"');
        assertMatch(place, /<\/button>Claim<\/label>/);
    },
);

Deno.test('my claim shows the switch on with my name', () => {
    const place = claimPlaceOf(makePresenter({
        activeClaim: {
            memberId: 'pjQzgITAPDQVyvCVpzpIfQ',
            at: nowUtc(),
        },
        currentMemberId: 'pjQzgITAPDQVyvCVpzpIfQ',
    }).buildPage().toString());
    assert(place !== null);
    assertStringIncludes(place, 'aria-checked="true"');
    assertStringIncludes(
        place, 'aria-label="Claimed by Ada Park"',
    );
    assertMatch(place, /<\/button>Claimed by Ada Park<\/label>/);
});

Deno.test(
    'another member\'s claim names them with no switch',
    () => {
        const place = claimPlaceOf(makePresenter({
            activeClaim: {
                memberId: 'pnKMhTzcIZVQQBIoQlyAfw',
                at: nowUtc(),
            },
            currentMemberId: 'pjQzgITAPDQVyvCVpzpIfQ',
        }).buildPage().toString());
        assert(place !== null);
        assertStringIncludes(place, 'Claimed by Bo Park');
        assert(!place.includes('role="switch"'));
    },
);

Deno.test('an archived work order has no claim place', () => {
    const graph = makeFlowGraph();
    const out = makePresenter({
        graph,
        workOrder: makeWorkOrder(graph, { nodeId: 'n-2' }),
        transitions: [
            makeCreation({ id: 't-1', toNodeId: 'n-2' }),
        ],
        activeClaim: {
            memberId: 'pjQzgITAPDQVyvCVpzpIfQ',
            at: nowUtc(),
        },
    }).buildPage().toString();
    assertStrictEquals(claimPlaceOf(out), null);
    assert(!out.includes('work-order-claim-switch'));
});
```

- [ ] **Step 2: Run** ONE-FILE with
  `tests/presenter-workbox-detail.test.ts`. Expected:
  FAIL — the first four new tests (no close control in
  `buildPage`, a back button present, no claim place).
  'an archived work order has no claim place' passes
  already, since nothing renders a claim place yet; it
  guards the archive rule once one does.

- [ ] **Step 3: Implement** in
  `web-app/app/presenters/workbox-detail.ts`:

  (a) Replace

```ts
import {
    ICON_SIZE,
    iconArrowLeft,
    iconClock,
    iconXCircle,
} from '../icons.ts';
```

  with

```ts
import {
    ICON_SIZE,
    iconClock,
    iconXCircle,
} from '../icons.ts';
```

  (b) Replace

```ts
export function buildWorkOrderBoxEmpty(): SafeHtml {
```

  with

```ts
// The design system's switch inside its label, named as
// its label reads; aria-checked says whether I hold the
// claim.
function buildClaimSwitch(
    on: boolean,
    label: string,
): SafeHtml {
    return html`<label
        id="work-order-claim"
        class="flex items-center gap-2 text-sm"><button
        type="button"
        class="switch"
        role="switch"
        id="work-order-claim-switch"
        aria-checked="${on ? 'true' : 'false'}"
        aria-label="${label}"><span
        class="switch-thumb"></span></button>${label}</label>`;
}

export function buildWorkOrderBoxEmpty(): SafeHtml {
```

  (c) Replace

```ts
    readonly #conflictNotice: string | null;

    constructor(
```

  with

```ts
    readonly #conflictNotice: string | null;
    readonly #activeClaim:
        { memberId: Id; at: string } | null;
    readonly #memberMap: Map<Id, Member>;
    readonly #currentMemberId: string;

    constructor(
```

  (d) Replace

```ts
        this.#conflictNotice = conflictNotice;

        const head = this.#flowGraph.nodes.find(
```

  with

```ts
        this.#conflictNotice = conflictNotice;
        this.#activeClaim = activeClaim;
        this.#memberMap = memberMap;
        this.#currentMemberId = currentMemberId;

        const head = this.#flowGraph.nodes.find(
```

  (e) Replace the header — this exact block:

```ts
        // Attributes are two columns so
        // submit stays below them and still in view.
        return html`<div
            class="entity">
            <div id="work-order-header"
                class="flex items-center
                    gap-4 mb-6">
                <button
                    id="work-order-back-btn"
                    class="btn btn-ghost
                        btn-icon"
                    aria-label="Back">
                    ${iconArrowLeft(ICON_SIZE.xl, '')}
                </button>
                <div class="flex-1">
                    <h1 class="text-2xl
                        font-bold mb-1">
                        ${this.flowNameText()}
                    </h1>
                    <div class="flex
                        items-center gap-3
                        flex-wrap">
                        <span
                            class="badge
                                badge-neutral">
                            ${idLabel(
                                'Work order',
                                this.idValue(),
                            )}
                        </span>
                        <span
                            class="badge
                                badge-info"${this
                                .#currentNodeTitleAttr()}>
                            ${this
                                .#currentNodeName()}
                        </span>
                        ${this.#bindingBadge()}
                    </div>
                </div>
            </div>
```

  with:

```ts
        // The title row carries the claim place and the
        // close control at its right end; the badges take
        // their own row, so a long claim label never
        // squeezes them. Attributes are two columns so
        // submit stays below them and still in view.
        return html`<div>
            <div id="work-order-header" class="mb-6">
                <div class="flex items-center gap-3 mb-2">
                    <h2 class="${
                        'text-xl font-bold flex-1 min-w-0'
                    }">${this.flowNameText()}</h2>
                    <div class="flex items-center gap-2">
                        ${this.#buildClaimPlace()}
                        ${buildWorkOrderClose()}
                    </div>
                </div>
                <div class="flex
                    items-center gap-3
                    flex-wrap">
                    <span
                        class="badge
                            badge-neutral">
                        ${idLabel(
                            'Work order',
                            this.idValue(),
                        )}
                    </span>
                    <span
                        class="badge
                            badge-info"${this
                            .#currentNodeTitleAttr()}>
                        ${this
                            .#currentNodeName()}
                    </span>
                    ${this.#bindingBadge()}
                </div>
            </div>
```

  (f) Replace

```ts
    #claimedByMe(): boolean {
```

  with

```ts
    // The claim's one place: a switch while the work order
    // is unclaimed or mine, the holder's name while another
    // member holds it, nothing once it is archived. A
    // lapsed claim is no claim: the page passes none.
    #buildClaimPlace(): SafeHtml {
        if (this.isArchive()) {
            return html``;
        }
        const claim = this.#activeClaim;
        if (claim === null) {
            return buildClaimSwitch(false, 'Claim');
        }
        const label = 'Claimed by '
            + memberName(this.#memberMap, claim.memberId);
        if (claim.memberId === this.#currentMemberId) {
            return buildClaimSwitch(true, label);
        }
        return html`<span
            id="work-order-claim"
            class="text-sm text-muted">${label}</span>`;
    }

    #claimedByMe(): boolean {
```

- [ ] **Step 4: Run** ONE-FILE with
  `tests/presenter-workbox-detail.test.ts` — PASS (all,
  old and new). `./test validate --syntax`, `./test`,
  `./test lint` — PASS.

- [ ] **Step 5: Commit** `Put the claim place and close in the header`.

### Task 6: The work order's address

Agent: coder. Commandments: Clarity, Simplicity. Risks:
Unbidden Helper Code (one function), Default Values.

**Files:**
- Create: `web-app/app/workbox-address.ts`
- Test: `tests/workbox-address.test.ts` (create)

- [ ] **Step 1: Write the failing test.** Create
  `tests/workbox-address.test.ts`:

```ts
import { assertStrictEquals } from '@std/assert';
import { workOrderAddress } from
    '../web-app/app/workbox-address.ts';

const PAGE = 'http://local/workbox/index.html';

Deno.test(
    'opening names the work order beside the organization',
    () => {
        assertStrictEquals(
            workOrderAddress(PAGE + '?organization=O1', 'W1'),
            '/workbox/index.html?organization=O1&id=W1',
        );
    },
);

Deno.test('opening another replaces the id', () => {
    assertStrictEquals(
        workOrderAddress(
            PAGE + '?organization=O1&id=W1', 'W2',
        ),
        '/workbox/index.html?organization=O1&id=W2',
    );
});

Deno.test('closing removes the id and keeps the rest', () => {
    assertStrictEquals(
        workOrderAddress(
            PAGE + '?organization=O1&id=W1', null,
        ),
        '/workbox/index.html?organization=O1',
    );
    assertStrictEquals(
        workOrderAddress(PAGE + '?id=W1', null),
        '/workbox/index.html',
    );
});
```

- [ ] **Step 2: Run** ONE-FILE with
  `tests/workbox-address.test.ts`. Expected: FAIL,
  `Module not found`.

- [ ] **Step 3: Implement.** Create
  `web-app/app/workbox-address.ts`:

```ts
// The workbox page's address naming the work order its box
// holds, or none. Every other query parameter — the
// organization stamp boot writes among them — stays.
const WORK_ORDER_PARAM = 'id';

export function workOrderAddress(
    href: string,
    id: string | null,
): string {
    const url = new URL(href);
    if (id === null) {
        url.searchParams.delete(WORK_ORDER_PARAM);
    } else {
        url.searchParams.set(WORK_ORDER_PARAM, id);
    }
    return url.pathname + url.search + url.hash;
}
```

- [ ] **Step 4: Run** ONE-FILE with
  `tests/workbox-address.test.ts` — PASS (3 tests).
  `./test validate --syntax`, `./test`, `./test lint` —
  PASS.

- [ ] **Step 5: Commit** `Add the workbox's work order address`.

### Segment 1 gate

```bash
export DENO_DIR="$TMPDIR/deno-dir" && ./test validate --syntax
export DENO_DIR="$TMPDIR/deno-dir" && ./test
export DENO_DIR="$TMPDIR/deno-dir" && ./test lint
```

All three green. Six commits on top of the spec commit.
The master reviews the presenters before Segment 2.

---
## Segment 2 — Browser tests, written red (Layer 2)

The page does not exist yet, so these tests are written
against the spec and run red: the master's run at this
segment's gate proves they fail for the stated reason
before Segment 3 makes them pass. The coder writes them
and type-checks them; the coder does not run them.

Seeded facts the tests lean on (from `api/mock-data/`):
`gButmqAicxcpsNuiTYQNKA` is a Customer Onboarding work
order at Data Capture, available to the demo admin, its
`submit` edge `JZJrLAteZStrqAvzZiamtA`; the admin's
lists also hold work orders of another flow
(Lead-to-Close); Sarah Chen (`sarah.chen@company.com`)
is a Stark member; Customer Profile's record detail
(`SEED_RECORD_TYPE_ID`) lists Customer Onboarding work
orders under "Work orders using this Record".

### Task 7: Layer 2 — the work order box

Agent: coder. Commandments: Reliability, the Office of
Verification. Risk: Test Weakening (assert the exact
toast, the exact switch state).

**Files:**
- Create: `tests/browser/workbox-box.test.ts`

- [ ] **Step 1: Write the test file.** Create
  `tests/browser/workbox-box.test.ts`:

```ts
import { assert, assertStrictEquals } from '@std/assert';
import { buildMembers } from '../../api/mock-data/members.ts';
import { STARK_ORGANIZATION } from
    '../../api/mock-data/seed-constants.ts';
import { SEED_RECORD_TYPE_ID } from
    '../../api/mock-data/seed-message-pairs.ts';
import {
    getWorkOrders,
    isClaimedAndUnlapsed,
    putWorkOrderClaim,
    type RequestContext,
    type WorkOrder,
} from '../../client/index.ts';
import { inPageContext } from '../in-page-facade.ts';
import { organizationToken } from '../token-fixtures.ts';
import {
    ADMIN_EMAIL,
    SECOND_EMAIL,
    adminToken,
    useBrowser,
    withAdminPage,
    type Origin,
    type Page,
} from './fixtures.ts';
import { registryUrl } from
    '../../web-app/app/browser-drive.ts';

const browser = useBrowser();

// A seeded Customer Onboarding work order at Data Capture,
// available to the admin; its submit edge leaves the node.
const DATA_CAPTURE = 'gButmqAicxcpsNuiTYQNKA';
const SUBMIT_EDGE_ID = 'JZJrLAteZStrqAvzZiamtA';
const PHONE_WIDTH = 375;
const PHONE_HEIGHT = 800;

function memberOf(email: string): { id: string; name: string } {
    const member = buildMembers().find((m) => m.email === email);
    assert(member !== undefined, email);
    return { id: member.id, name: member.name };
}

async function adminContext(
    origin: Origin,
): Promise<RequestContext> {
    return inPageContext(origin.db, await adminToken());
}

async function workOrderOf(
    ctx: RequestContext,
    workOrderId: string,
): Promise<WorkOrder> {
    const found = (await getWorkOrders(ctx)).find(
        (wo) => wo.id === workOrderId,
    );
    assert(found !== undefined, workOrderId);
    return found;
}

function cardSelector(id: string): string {
    return `[data-work-order-card="${id}"]`;
}

function addressId(page: Page): Promise<string | null> {
    return page.evaluate<string | null>(
        `new URLSearchParams(location.search).get('id')`,
    );
}

async function openWorkbox(
    page: Page, origin: Origin,
): Promise<void> {
    await page.navigate(registryUrl(origin.baseUrl, 'workbox'));
    await page.ready('workbox');
    await page.until(
        `document.querySelectorAll(`
        + `'#available-list [data-work-order-card]')`
        + `.length > 0`,
        'available cards',
    );
}

async function untilBoxHolds(
    page: Page, id: string,
): Promise<void> {
    await page.until(
        `document.querySelector(`
        + `'#work-order-box #work-order-header .badge-neutral')`
        + `?.textContent.includes(${JSON.stringify(id)})`,
        'the box holds ' + id,
    );
}

// A long list puts most rows below the fold: scroll the row
// into view, click it, and wait for the box to hold it.
async function openRow(page: Page, id: string): Promise<void> {
    const selector = JSON.stringify(cardSelector(id));
    await page.evaluate(
        `document.querySelector(${selector})`
        + `.scrollIntoView({ block: 'center' })`,
    );
    await page.click(cardSelector(id));
    await untilBoxHolds(page, id);
}

function switchChecked(value: 'true' | 'false'): string {
    return `document.getElementById('work-order-claim-switch')`
        + `?.getAttribute('aria-checked') === '${value}'`;
}

function submitDisabled(disabled: boolean): string {
    return `document.querySelector(`
        + `'[data-edge-id="${SUBMIT_EDGE_ID}"]')`
        + `?.disabled === ${disabled}`;
}

Deno.test(
    'opening a row fills the box, marks the row, and sets'
    + ' the id',
    async () => {
        await withAdminPage(browser.get(), async (page, origin) => {
            const ctx = await adminContext(origin);
            await openWorkbox(page, origin);
            await openRow(page, DATA_CAPTURE);
            assert(await page.until<boolean>(
                `document.querySelector(${
                    JSON.stringify(cardSelector(DATA_CAPTURE))
                })?.getAttribute('aria-current') === 'true'`,
                'the open row marked',
            ));
            assertStrictEquals(
                await page.evaluate<number>(
                    `document.querySelectorAll(`
                    + `'[data-work-order-card][aria-current]')`
                    + `.length`,
                ),
                1,
            );
            assertStrictEquals(
                await addressId(page), DATA_CAPTURE,
            );
            assert(await page.evaluate<boolean>(
                `location.pathname`
                + `.endsWith('/workbox/index.html')`,
            ));
            assert(await page.evaluate<boolean>(
                switchChecked('false'),
            ));
            // Opening inspects: it never claims.
            const opened = await workOrderOf(ctx, DATA_CAPTURE);
            assert(!isClaimedAndUnlapsed(opened.claim));
        });
    },
);

Deno.test(
    'the close control empties the box and clears the id',
    async () => {
        await withAdminPage(browser.get(), async (page, origin) => {
            await openWorkbox(page, origin);
            await openRow(page, DATA_CAPTURE);
            await page.click('#work-order-close');
            assert(await page.until<boolean>(
                `document.getElementById('work-order-box')`
                + `.textContent.includes(`
                + `'Select a work order to open it here')`,
                'the empty box',
            ));
            assertStrictEquals(await addressId(page), null);
            assert(await page.evaluate<boolean>(
                `new URLSearchParams(location.search)`
                + `.has('organization')`,
            ));
            assertStrictEquals(
                await page.evaluate<number>(
                    `document.querySelectorAll(`
                    + `'[data-work-order-card][aria-current]')`
                    + `.length`,
                ),
                0,
            );
        });
    },
);

Deno.test(
    'loading the page with an id opens that work order',
    async () => {
        await withAdminPage(browser.get(), async (page, origin) => {
            await page.navigate(registryUrl(
                origin.baseUrl, 'workbox', 'id=' + DATA_CAPTURE,
            ));
            await page.ready('workbox');
            await untilBoxHolds(page, DATA_CAPTURE);
            assert(await page.until<boolean>(
                `document.querySelector(${
                    JSON.stringify(cardSelector(DATA_CAPTURE))
                })?.getAttribute('aria-current') === 'true'`,
                'the open row marked',
            ));
        });
    },
);

Deno.test('the switch claims and releases', async () => {
    await withAdminPage(browser.get(), async (page, origin) => {
        const ctx = await adminContext(origin);
        const admin = memberOf(ADMIN_EMAIL);
        await openWorkbox(page, origin);
        await openRow(page, DATA_CAPTURE);
        assert(await page.evaluate<boolean>(
            submitDisabled(true),
        ));
        await page.click('#work-order-claim-switch');
        await page.waitFor(
            '#claimed-list ' + cardSelector(DATA_CAPTURE),
        );
        assert(await page.until<boolean>(
            switchChecked('true')
            + ` && document.getElementById('work-order-claim')`
            + `.textContent.includes(${
                JSON.stringify('Claimed by ' + admin.name)
            })`,
            'the switch on, named for the admin',
        ));
        assert(await page.until<boolean>(
            submitDisabled(false), 'the transition enabled',
        ));
        const claimed = await workOrderOf(ctx, DATA_CAPTURE);
        assert(
            isClaimedAndUnlapsed(claimed.claim)
            && claimed.claim.memberId === admin.id,
        );
        await page.click('#work-order-claim-switch');
        await page.waitFor(
            '#available-list ' + cardSelector(DATA_CAPTURE),
        );
        assert(await page.until<boolean>(
            switchChecked('false') + ' && '
            + submitDisabled(true),
            'the switch off, the transition disabled',
        ));
        const released = await workOrderOf(ctx, DATA_CAPTURE);
        assert(!isClaimedAndUnlapsed(released.claim));
    });
});

Deno.test(
    'a claim another member took leaves the switch off',
    async () => {
        await withAdminPage(browser.get(), async (page, origin) => {
            const sarah = memberOf(SECOND_EMAIL);
            const sarahCtx = inPageContext(
                origin.db,
                await organizationToken(
                    sarah.id, STARK_ORGANIZATION,
                ),
            );
            await openWorkbox(page, origin);
            await openRow(page, DATA_CAPTURE);
            // The box latched the head from before Sarah's
            // claim, so its PUT names a stale tag: 412.
            await putWorkOrderClaim(
                sarahCtx,
                await workOrderOf(sarahCtx, DATA_CAPTURE),
            );
            await page.click('#work-order-claim-switch');
            assert(await page.until<boolean>(
                `[...document.querySelectorAll('.toast')]`
                + `.some(t => t.textContent.includes(`
                + `'Failed to claim work order'))`,
                'the refusal toast',
            ));
            assert(await page.until<boolean>(
                `document.getElementById('work-order-claim')`
                + `?.textContent.includes(${
                    JSON.stringify('Claimed by ' + sarah.name)
                }) === true`
                + ` && document.getElementById(`
                + `'work-order-claim-switch') === null`,
                'the holder named, no switch',
            ));
            await page.until(
                `document.querySelector(${
                    JSON.stringify(cardSelector(DATA_CAPTURE))
                }) === null`,
                'the row gone from the admin\'s lists',
            );
        });
    },
);

Deno.test(
    'on a phone opening scrolls to the box and closing'
    + ' scrolls back',
    async () => {
        await withAdminPage(browser.get(), async (page, origin) => {
            await page.setViewport(
                PHONE_WIDTH, PHONE_HEIGHT, true,
            );
            await openWorkbox(page, origin);
            const top = (id: string) => `document`
                + `.getElementById('${id}')`
                + `.getBoundingClientRect().top`;
            assert(
                await page.evaluate<boolean>(
                    `${top('work-order-box')} >= innerHeight`,
                ),
                'the box starts below the fold',
            );
            await openRow(page, DATA_CAPTURE);
            assert(await page.until<boolean>(
                `(() => { const t = ${top('work-order-box')};`
                + ` return t >= 0 && t < innerHeight; })()`,
                'the box in view',
            ));
            await page.click('#work-order-close');
            assert(await page.until<boolean>(
                `(() => { const t = ${top('work-order-lists')};`
                + ` return t >= 0 && t < innerHeight; })()`,
                'the lists in view',
            ));
        });
    },
);

Deno.test(
    'the Records page\'s work order link opens it in the'
    + ' workbox',
    async () => {
        await withAdminPage(browser.get(), async (page, origin) => {
            await page.navigate(registryUrl(
                origin.baseUrl, 'record-detail',
                'id=' + SEED_RECORD_TYPE_ID,
            ));
            await page.ready('record-detail');
            await page.waitFor('.record-wo-link');
            const id = await page.evaluate<string>(
                `document.querySelector('.record-wo-link')`
                + `.getAttribute('data-work-order-id')`,
            );
            await page.evaluate(
                `document.querySelector('.record-wo-link')`
                + `.scrollIntoView({ block: 'center' })`,
            );
            await page.click('.record-wo-link');
            await page.until(
                `location.pathname`
                + `.endsWith('/workbox/index.html')`,
                'the workbox',
            );
            await page.ready('workbox');
            await untilBoxHolds(page, id);
            assertStrictEquals(await addressId(page), id);
        });
    },
);
```

- [ ] **Step 2: Type-check.**
  `export DENO_DIR="$TMPDIR/deno-dir" && ./test validate --syntax`
  — PASS. `./test lint` — PASS.

- [ ] **Step 3: MASTER RUNS: `./test browser`.** Expected
  at this point: every test in this file FAILS — the
  workbox has no `#work-order-box`, rows navigate to
  `workbox/detail.html`, and the Records link goes to the
  detail page (`untilBoxHolds` times out each time; the
  phone test fails its first `until` after the click).
  The coder skips this step.

- [ ] **Step 4: Commit** `Pin the work order box in the browser`.

### Task 8: Layer 2 — the flow pills

Agent: coder. Commandments: the Office of Verification,
Uniformity. Risk: Test Weakening (counts are asserted
against the pill's own chip, not "fewer than before").

**Files:**
- Create: `tests/browser/workbox-pills.test.ts`

- [ ] **Step 1: Write the test file.** Create
  `tests/browser/workbox-pills.test.ts`:

```ts
import { assert, assertStrictEquals } from '@std/assert';
import {
    getWorkOrders,
    putWorkOrderClaim,
    type RequestContext,
    type WorkOrder,
} from '../../client/index.ts';
import { inPageContext } from '../in-page-facade.ts';
import {
    adminToken,
    useBrowser,
    withAdminPage,
    type Origin,
} from './fixtures.ts';
import { registryUrl } from
    '../../web-app/app/browser-drive.ts';

const browser = useBrowser();

// A seeded Customer Onboarding work order the admin claims
// first, so the claimed list holds a row of the flow.
const DATA_CAPTURE = 'gButmqAicxcpsNuiTYQNKA';
const FLOW = 'Customer Onboarding';
const PILL = `[data-workbox-pill="flow"]`
    + `[data-flow-name="${FLOW}"]`;

// Every row in the left box, placed or not.
const ROWS = `#work-order-lists [data-inbox-list] > .card`;

const ROW_IDS = `JSON.stringify([...document`
    + `.querySelectorAll('${ROWS}')]`
    + `.map(c => c.getAttribute('data-work-order-card')))`;

const ROW_FLOWS = `[...document.querySelectorAll('${ROWS}')]`
    + `.map(c => c.querySelector('.font-semibold')`
    + `.textContent.trim())`;

async function workOrderOf(
    ctx: RequestContext,
    workOrderId: string,
): Promise<WorkOrder> {
    const found = (await getWorkOrders(ctx)).find(
        (wo) => wo.id === workOrderId,
    );
    assert(found !== undefined, workOrderId);
    return found;
}

async function claimedFirst(origin: Origin): Promise<void> {
    const ctx = inPageContext(origin.db, await adminToken());
    await putWorkOrderClaim(
        ctx, await workOrderOf(ctx, DATA_CAPTURE),
    );
}

Deno.test(
    'pressing a flow pill narrows both lists and pressing'
    + ' it again restores them',
    async () => {
        await withAdminPage(browser.get(), async (page, origin) => {
            await claimedFirst(origin);
            await page.navigate(
                registryUrl(origin.baseUrl, 'workbox'),
            );
            await page.ready('workbox');
            await page.waitFor(
                `#claimed-list [data-work-order-card=`
                + `"${DATA_CAPTURE}"]`,
            );
            await page.waitFor(PILL);
            const before = await page.evaluate<string>(ROW_IDS);
            assert(
                await page.evaluate<boolean>(
                    `${ROW_FLOWS}.some(name => name !== `
                    + `${JSON.stringify(FLOW)})`,
                ),
                'another flow is listed before the press',
            );
            const count = await page.evaluate<string>(
                `document.querySelector(${JSON.stringify(PILL)})`
                + `.querySelector('.workbox-pill-count')`
                + `.textContent`,
            );
            const [claimed, total] = count.split('/').map(Number);
            assert(claimed !== undefined && total !== undefined);
            await page.click(PILL);
            assert(await page.until<boolean>(
                `document.querySelector(${JSON.stringify(PILL)})`
                + `?.getAttribute('aria-pressed') === 'true'`,
                'the pill pressed',
            ));
            assert(await page.evaluate<boolean>(
                `[...document.querySelectorAll(`
                + `'[data-workbox-pill]')]`
                + `.filter(p => p.getAttribute('aria-pressed')`
                + ` !== 'true')`
                + `.every(p => p.getAttribute('data-dimmed')`
                + ` === 'true')`,
            ));
            assert(await page.evaluate<boolean>(
                `${ROW_FLOWS}.every(name => name === `
                + `${JSON.stringify(FLOW)})`,
            ));
            assertStrictEquals(
                await page.evaluate<number>(
                    `document.querySelectorAll(`
                    + `'#claimed-list > .card').length`,
                ),
                claimed,
            );
            assertStrictEquals(
                await page.evaluate<number>(
                    `document.querySelectorAll('${ROWS}')`
                    + `.length`,
                ),
                total,
            );
            await page.click(PILL);
            assert(await page.until<boolean>(
                `${ROW_IDS} === ${JSON.stringify(before)}`,
                'today\'s lists',
            ));
            assert(await page.evaluate<boolean>(
                `document.querySelector(${JSON.stringify(PILL)})`
                + `.getAttribute('aria-pressed') === 'false'`,
            ));
        });
    },
);
```

- [ ] **Step 2: Type-check.** `./test validate --syntax`
  and `./test lint` — PASS.

- [ ] **Step 3: MASTER RUNS: `./test browser`.** Expected:
  FAILS at `page.waitFor(PILL)` — there are no
  `[data-workbox-pill]` buttons yet. The coder skips this
  step.

- [ ] **Step 4: Commit** `Pin the flow pills in the browser`.

### Task 9: Restate the transition test for one page

Agent: coder. Commandments: the Office of Verification,
Reliability. Risk: Test Weakening.

The spec changes what this file pins: a create opens the
work order in the box instead of navigating to
`workbox/detail.html`; a transition keeps the box on the
work order instead of navigating to the inbox; the inbox
shell is the pills and two headed lists, not two cards
and a segmented control. Each old test is restated, none
dropped: 'workbox inbox shows two cards and pills' →
'the workbox shows the pills and the claimed list above
the available list'; 'fill and submit navigates to the
inbox (WB11)' → 'fill and submit keeps the box on the
work order (WB11)'; 'the action screen has no bind or
release chrome' → 'the box has no bind, release, or back
chrome' (the spec removes the back button, so the test
also pins its absence).

**Files:**
- Modify (whole file below):
  `tests/browser/workbox-transition.test.ts`

- [ ] **Step 1: Replace the whole file with:**

```ts
import { assert, assertStrictEquals } from '@std/assert';
import {
    useBrowser, withAdminPage, type Page,
} from './fixtures.ts';
import { registryUrl } from
    '../../web-app/app/browser-drive.ts';

const browser = useBrowser();
const ONBOARDING_FLOW_ID =
    'esKujtyQFYUJaVSXWwavzA';
const SUBMIT_EDGE_ID =
    'JZJrLAteZStrqAvzZiamtA';
const COMPANY_NAME_ID =
    'CPJmMPXRaBIiNdGBofUPVg';
const CONTACT_EMAIL_ID =
    'oeqelDVElwxHYWkWRVTCYw';

// Creates through the page: the new work order opens in
// the box, its id in the address, without a navigation.
async function createOnboardingWorkOrder(
    page: Page, baseUrl: string,
): Promise<string> {
    await page.navigate(registryUrl(baseUrl, 'workbox'));
    await page.ready('workbox');
    await page.click('#create-work-order-btn');
    const readyItem =
        `[data-flow-id="${ONBOARDING_FLOW_ID}"]`;
    await page.until(
        `document.querySelector(${
            JSON.stringify(readyItem)
        })?.checkVisibility() === true`,
        'READY Customer Onboarding',
    );
    await page.click(readyItem);
    const id = await page.until<string>(
        `new URLSearchParams(location.search).get('id')`,
        'the new work order in the address',
    );
    await page.until(
        `document.querySelector(`
        + `'#work-order-header .badge-neutral')`
        + `?.textContent.includes(${JSON.stringify(id)})`,
        'the new work order in the box',
    );
    assert(await page.evaluate<boolean>(
        `location.pathname.endsWith('/workbox/index.html')`,
    ));
    return id;
}

async function fillRequired(
    page: Page,
): Promise<void> {
    const company =
        `#wo-attr-${COMPANY_NAME_ID}`;
    const email =
        `#wo-attr-${CONTACT_EMAIL_ID}`;
    await page.until(
        `document.querySelector(${
            JSON.stringify(company)
        })?.disabled === false`,
        'Company Name enabled',
    );
    await page.evaluate(
        `document.querySelector(${
            JSON.stringify(company)
        }).value = 'Acme Corp';`
        + `document.querySelector(${
            JSON.stringify(email)
        }).value = 'ops@acme.example';`,
    );
}

Deno.test(
    'the workbox shows the pills and the claimed list'
    + ' above the available list',
    async () => {
        await withAdminPage(browser.get(), async (page, origin) => {
            await page.navigate(
                registryUrl(origin.baseUrl, 'workbox'),
            );
            await page.ready('workbox');
            assert(await page.until<boolean>(
                `(() => {
                    const claimed = document
                        .getElementById('claimed-list');
                    const available = document
                        .getElementById('available-list');
                    return claimed !== null
                        && available !== null
                        && (claimed.compareDocumentPosition(
                            available)
                            & Node.DOCUMENT_POSITION_FOLLOWING)
                            !== 0;
                })()`,
                'claimed above available',
            ));
            assert(await page.until<boolean>(
                `document.querySelector('#workbox-pills')`
                + `?.getAttribute('aria-label')`
                + ` === 'Filter work orders'`
                + ` && document.querySelector(`
                + `'[data-workbox-pill="claimed"]') !== null`
                + ` && document.querySelector(`
                + `'[data-workbox-pill="archivedByMe"]')`
                + ` !== null`,
                'the pills',
            ));
            assert(await page.evaluate<boolean>(
                `document.getElementById('work-order-box')`
                + `.textContent.includes(`
                + `'Select a work order to open it here')`,
            ));
            const sub = await page.evaluate<string>(
                `document.querySelector('.page-header p')`
                + `?.textContent ?? ''`,
            );
            assertStrictEquals(sub, '');
            assert(await page.evaluate<boolean>(
                `document.querySelector('[data-inbox-pill]')`
                + ` === null`
                + ` && document.getElementById(`
                + `'workbox-tabs') === null`,
            ));
        });
    },
);

Deno.test(
    'fill and submit keeps the box on the work order'
    + ' (WB11)',
    async () => {
        await withAdminPage(browser.get(), async (page, origin) => {
            // The live create binds and birth-claims: the
            // box it opens fills and submits with no bind
            // step and no claim step.
            const id = await createOnboardingWorkOrder(
                page, origin.baseUrl,
            );
            await fillRequired(page);
            await page.click(`[data-edge-id="${SUBMIT_EDGE_ID}"]`);
            assert(await page.until<boolean>(
                `[...document.querySelectorAll('.toast')]`
                + `.some(t => t.textContent.includes(`
                + `'Transition complete'))`,
                'Transition complete toast',
            ));
            assert(await page.until<boolean>(
                `document.querySelector(`
                + `'#work-order-header .badge-info')`
                + `?.textContent.trim() === 'Review'`,
                'the box at Review',
            ));
            // The move released the claim: the row is
            // available again.
            await page.waitFor(
                `#available-list [data-work-order-card="${id}"]`,
            );
            assertStrictEquals(
                await page.evaluate<string | null>(
                    `new URLSearchParams(location.search)`
                    + `.get('id')`,
                ),
                id,
            );
            assert(await page.evaluate<boolean>(
                `location.pathname`
                + `.endsWith('/workbox/index.html')`,
            ));
            assert(await page.evaluate<boolean>(
                `![...document.querySelectorAll('.toast')]`
                + `.some(t => t.textContent.includes(`
                + `'refresh failed'))`,
            ));
        });
    },
);

Deno.test(
    'the box has no bind, release, or back chrome',
    async () => {
        await withAdminPage(browser.get(), async (page, origin) => {
            await createOnboardingWorkOrder(
                page, origin.baseUrl,
            );
            assert(await page.evaluate<boolean>(
                `document.querySelector(`
                + `'[data-dialog-open="bind-instance"]')`
                + ` === null`
                + ` && document.getElementById(`
                + `'unclaim-btn') === null`
                + ` && document.getElementById(`
                + `'work-order-back-btn') === null`,
            ));
        });
    },
);
```

- [ ] **Step 2: Type-check.** `./test validate --syntax`
  and `./test lint` — PASS.

- [ ] **Step 3: MASTER RUNS: `./test browser`.** Expected:
  all three FAIL — no `#claimed-list` above
  `#available-list` in one box and no
  `[data-workbox-pill]`; a create still navigates to
  `workbox/detail.html`, so 'the new work order in the
  box' times out. The coder skips this step.

- [ ] **Step 4: Commit** `Restate the transition test for one page`.

### Task 10: Restate the search tests for one page

Agent: coder. Commandments: the Office of Verification,
Reliability. Risk: Test Weakening.

Why each test changes:

- 'the box narrows both lists' → 'the search narrows
  both lists'; 'a stale answer does not repaint a cleared
  box' → '… a cleared search'; 'on a phone the box
  follows the button' → 'on a phone the search follows
  the button'. Renamed only: "the box" now names the
  work order box. Bodies keep their assertions; the
  claims they set up lose `putWorkOrderPosition`, since
  the claimed order is by time now.
- 'a drop during a QUERY still shows its answer' → 'a
  claim during a QUERY still shows its answer': the drag
  is gone; the same covenant, a write during a held QUERY
  still ends on its answer, is restated on the switch.
- 'a drag between the lists still claims while
  filtered' → 'the switch claims while filtered': the
  same covenant on the switch.
- 'a drag within claimed does not reorder while
  filtered': deleted. The spec retires the hand-chosen
  claimed order; there is no reorder to pin.
- 'a pill after a failed QUERY keeps the error': the
  segmented control's pill becomes the "Archived by Me"
  filter pill, and the error and the answer now paint in
  `#work-order-lists` / `#archived-list`.
- 'on a phone claimed comes first': the two lists share
  one box now; the test compares the lists themselves,
  not their cards.

**Files:**
- Modify (whole file below):
  `tests/browser/workbox-search.test.ts`

- [ ] **Step 1: Replace the whole file with:**

```ts
import { assert, assertStrictEquals } from '@std/assert';
import { buildMembers } from
    '../../api/mock-data/members.ts';
import {
    getWorkOrders,
    isClaimedAndUnlapsed,
    putWorkOrderClaim,
    queryWorkOrders,
    type RequestContext,
    type WorkOrder,
} from '../../client/index.ts';
import { inPageContext } from '../in-page-facade.ts';
import {
    ADMIN_EMAIL,
    adminToken,
    stays,
    useBrowser,
    withAdminPage,
    type Origin,
    type Page,
    type RequestHold,
    withHeldRequests,
} from './fixtures.ts';
import { registryUrl } from
    '../../web-app/app/browser-drive.ts';
import { pollUntil } from '../../web-app/app/cdp-client.ts';

const browser = useBrowser();

// A margin for an answer to land and paint.
const SETTLE_MS = 600;

// In the mock data, "capture" matches four of the
// admin's available work orders — those sitting in Data
// Capture — so it narrows both lists without emptying
// them. Each test checks the cards against a fresh
// QUERY answer for the term, not the literal text.
const TERM = 'capture';
const CAPTURED = [
    'gButmqAicxcpsNuiTYQNKA', 'AbRcGuaSMFbUfPAexnegfw',
];
const NOT_CAPTURED = 'cHhNpUQxX6iZyLZ6N6PLzQ';
const WRITE_TIMEOUT_MS = 10_000;

function adminId(): string {
    const admin = buildMembers().find(
        (m) => m.email === ADMIN_EMAIL,
    );
    assert(admin !== undefined);
    return admin.id;
}

async function adminContext(
    origin: Origin,
): Promise<RequestContext> {
    return inPageContext(origin.db, await adminToken());
}

async function workOrderOf(
    ctx: RequestContext,
    workOrderId: string,
): Promise<WorkOrder> {
    const found = (await getWorkOrders(ctx)).find(
        (wo) => wo.id === workOrderId,
    );
    assert(found !== undefined, workOrderId);
    return found;
}

async function claim(
    ctx: RequestContext,
    workOrderId: string,
): Promise<void> {
    await putWorkOrderClaim(
        ctx, await workOrderOf(ctx, workOrderId),
    );
}

async function matchedIds(
    ctx: RequestContext,
): Promise<Set<string>> {
    return new Set(
        (await queryWorkOrders(ctx, TERM)).map((wo) => wo.id),
    );
}

function idsOf(list: string): string {
    return `JSON.stringify([...document.querySelectorAll(`
        + `'#${list} [data-work-order-card]')]`
        + `.map(c => c.getAttribute(`
        + `'data-work-order-card')))`;
}

const BOTH_LISTS = `JSON.stringify([${
    idsOf('available-list')}, ${idsOf('claimed-list')}])`;

async function listIds(
    page: Page, list: string,
): Promise<string[]> {
    return JSON.parse(
        await page.evaluate<string>(idsOf(list)),
    );
}

async function openWorkbox(
    page: Page, origin: Origin,
): Promise<void> {
    await page.navigate(
        registryUrl(origin.baseUrl, 'workbox'),
    );
    await page.ready('workbox');
    await page.until(
        `document.querySelectorAll(`
        + `'#available-list [data-work-order-card]')`
        + `.length > 0`,
        'available cards',
    );
}

function typeExpression(text: string): string {
    return `(() => {
        const box = document.getElementById(
            'workbox-search');
        box.value = ${JSON.stringify(text)};
        box.dispatchEvent(
            new Event('input', { bubbles: true }));
    })()`;
}

async function typeInBox(
    page: Page, text: string,
): Promise<void> {
    await page.evaluate(typeExpression(text));
}

// The answer has painted once every available card is
// one of its matches.
async function untilNarrowed(
    page: Page, matched: ReadonlySet<string>,
): Promise<void> {
    const ids = JSON.stringify([...matched]);
    await page.until(
        `(() => {
            const matched = new Set(${ids});
            const cards = [...document.querySelectorAll(
                '#available-list [data-work-order-card]')];
            return cards.length > 0 && cards.every(c =>
                matched.has(c.getAttribute(
                    'data-work-order-card')));
        })()`,
        'available narrowed to the answer',
    );
}

// The page's work-orders QUERYs, held at the browser's
// network layer while fn runs; every other request
// passes.
function holdQueries(
    page: Page, fn: (hold: RequestHold) => Promise<void>,
): Promise<void> {
    return withHeldRequests(
        page,
        '*/work-orders/*',
        (request) => request.method === 'QUERY',
        fn,
    );
}

function cardSelector(id: string): string {
    return `[data-work-order-card="${id}"]`;
}

// A long list puts most rows below the fold: scroll the row
// into view, click it, and wait for its claim switch.
async function openRow(page: Page, id: string): Promise<void> {
    const selector = JSON.stringify(cardSelector(id));
    await page.evaluate(
        `document.querySelector(${selector})`
        + `.scrollIntoView({ block: 'center' })`,
    );
    await page.click(cardSelector(id));
    await page.until(
        `document.querySelector(`
        + `'#work-order-header .badge-neutral')`
        + `?.textContent.includes(${JSON.stringify(id)})`
        + ` && document.getElementById(`
        + `'work-order-claim-switch') !== null`,
        'the box holds ' + id,
    );
}

Deno.test('the search narrows both lists', async () => {
    await withAdminPage(browser.get(), async (page, origin) => {
        const ctx = await adminContext(origin);
        await claim(ctx, CAPTURED[0]!);
        await claim(ctx, NOT_CAPTURED);
        await openWorkbox(page, origin);
        await page.until(
            `document.querySelectorAll(`
            + `'#claimed-list [data-work-order-card]')`
            + `.length === 2`,
            'two claimed cards',
        );
        const before = {
            available: await listIds(page, 'available-list'),
            claimed: await listIds(page, 'claimed-list'),
        };
        const matched = await matchedIds(ctx);
        await typeInBox(page, TERM);
        await untilNarrowed(page, matched);
        await page.until(
            `document.querySelectorAll(`
            + `'#claimed-list [data-work-order-card]')`
            + `.length === 1`,
            'one claimed match',
        );
        const after = {
            available: await listIds(page, 'available-list'),
            claimed: await listIds(page, 'claimed-list'),
        };
        for (const id of [...after.available, ...after.claimed]) {
            assert(matched.has(id), id);
        }
        assert(after.available.length < before.available.length);
        assert(after.claimed.length < before.claimed.length);
    });
});

Deno.test('Escape clears the filter', async () => {
    await withAdminPage(browser.get(), async (page, origin) => {
        const ctx = await adminContext(origin);
        await openWorkbox(page, origin);
        const today = await page.evaluate<string>(BOTH_LISTS);
        await typeInBox(page, TERM);
        await untilNarrowed(page, await matchedIds(ctx));
        assert(
            await page.evaluate<string>(BOTH_LISTS) !== today,
        );
        await page.click('#workbox-search');
        await page.key('Escape');
        await page.until(
            `${BOTH_LISTS} === ${JSON.stringify(today)}`,
            "today's lists",
        );
        assertStrictEquals(
            await page.evaluate<string>(
                `document.getElementById(`
                + `'workbox-search').value`,
            ),
            '',
        );
    });
});

Deno.test(
    'a stale answer does not repaint a cleared search',
    async () => {
        await withAdminPage(browser.get(), async (page, origin) => {
            await openWorkbox(page, origin);
            const today = await page.evaluate<string>(
                BOTH_LISTS,
            );
            await holdQueries(page, async (hold) => {
                await typeInBox(page, TERM);
                const inFlight = await hold.next();
                // The cleared box's GET repaints the same
                // cards as new nodes; only once it has may
                // the old answer land.
                await page.evaluate(
                    `document.querySelectorAll(`
                    + `'#available-list `
                    + `[data-work-order-card]')`
                    + `.forEach(c => c.dataset.painted`
                    + ` = 'before')`,
                );
                await typeInBox(page, '');
                await page.until(
                    `document.querySelector(`
                    + `'#available-list `
                    + `[data-painted]') === null`
                    + ` && ${BOTH_LISTS} === ${
                        JSON.stringify(today)}`,
                    "today's lists repainted",
                );
                await hold.release(inFlight);
                await stays(page, BOTH_LISTS, SETTLE_MS);
                assertStrictEquals(
                    await page.evaluate<string>(BOTH_LISTS),
                    today,
                );
            });
        });
    },
);

Deno.test(
    'a claim during a QUERY still shows its answer',
    async () => {
        await withAdminPage(browser.get(), async (page, origin) => {
            const ctx = await adminContext(origin);
            const claimedId = CAPTURED[0]!;
            await openWorkbox(page, origin);
            await openRow(page, claimedId);
            await holdQueries(page, async (hold) => {
                await typeInBox(page, TERM);
                await hold.next();
                await page.click('#work-order-claim-switch');
                await page.waitFor(
                    '#claimed-list ' + cardSelector(claimedId),
                );
                hold.stopHolding();
                await hold.releaseHeld();
                await untilNarrowed(page, await matchedIds(ctx));
                await page.waitFor(
                    '#claimed-list ' + cardSelector(claimedId),
                );
            });
        });
    },
);

Deno.test(
    'a pill after a failed QUERY keeps the error',
    async () => {
        await withAdminPage(browser.get(), async (page, origin) => {
            const ctx = await adminContext(origin);
            await openWorkbox(page, origin);
            await holdQueries(page, async (hold) => {
                await typeInBox(page, TERM);
                await hold.release(await hold.next());
                await untilNarrowed(page, await matchedIds(ctx));
                // The same text again: the answer on hand is
                // for it, and this QUERY fails.
                await typeInBox(page, TERM + ' ');
                await hold.fail(await hold.next());
                await page.waitFor(
                    '#work-order-lists [data-retry-btn]',
                );
                await page.click(
                    '[data-workbox-pill="archivedByMe"]',
                );
                const rerun = await hold.next();
                assert(await page.evaluate<boolean>(
                    `!!document.querySelector(`
                    + `'#work-order-lists [data-retry-btn]')`,
                ));
                await hold.release(rerun);
                await page.until(
                    `document.getElementById('archived-list')`
                    + `?.textContent.includes('No work orders`
                    + ` match “${TERM}”')`,
                    'the archived list answers',
                );
            });
        });
    },
);

Deno.test('the switch claims while filtered', async () => {
    await withAdminPage(browser.get(), async (page, origin) => {
        const ctx = await adminContext(origin);
        await openWorkbox(page, origin);
        await typeInBox(page, TERM);
        await untilNarrowed(page, await matchedIds(ctx));
        const [id] = await listIds(page, 'available-list');
        assert(id !== undefined);
        await openRow(page, id);
        await page.click('#work-order-claim-switch');
        await page.waitFor('#claimed-list ' + cardSelector(id));
        const fresh = await pollUntil(
            'the claim saved', WRITE_TIMEOUT_MS,
            async () => {
                const wo = await workOrderOf(ctx, id);
                return isClaimedAndUnlapsed(wo.claim)
                    ? wo.claim
                    : false;
            },
        );
        assertStrictEquals(fresh.memberId, adminId());
    });
});

Deno.test('on a phone claimed comes first', async () => {
    await withAdminPage(browser.get(), async (page, origin) => {
        await page.setViewport(375, 800, true);
        await openWorkbox(page, origin);
        assert(await page.until<boolean>(
            `(() => {
                const claimed = document
                    .getElementById('claimed-list');
                const available = document
                    .getElementById('available-list');
                return (claimed.compareDocumentPosition(
                    available)
                    & Node.DOCUMENT_POSITION_FOLLOWING)
                    !== 0;
            })()`,
            'claimed before available',
        ));
    });
});

Deno.test(
    'on a phone the search follows the button',
    async () => {
        await withAdminPage(browser.get(), async (page, origin) => {
            await page.setViewport(375, 800, true);
            await openWorkbox(page, origin);
            assert(await page.until<boolean>(
                `(() => {
                    const actions = document.getElementById(
                        'workbox-header-actions');
                    const box = document.getElementById(
                        'workbox-search');
                    return (actions
                        .compareDocumentPosition(box)
                        & Node.DOCUMENT_POSITION_FOLLOWING)
                        !== 0;
                })()`,
                'box after the button',
            ));
        });
    },
);
```

- [ ] **Step 2: Type-check.** `./test validate --syntax`
  and `./test lint` — PASS.

- [ ] **Step 3: MASTER RUNS: `./test browser`.** Expected
  against today's page: 'the search narrows both lists',
  'Escape clears the filter', 'a stale answer does not
  repaint a cleared search', 'on a phone claimed comes
  first', and 'on a phone the search follows the button'
  PASS (today's page already does these); 'a claim during
  a QUERY still shows its answer' and 'the switch claims
  while filtered' FAIL (no box, no switch); 'a pill after
  a failed QUERY keeps the error' FAILS (no
  `#work-order-lists`). The coder skips this step.

- [ ] **Step 4: Commit** `Restate the search tests for one page`.

### Task 11: Restate the former-member workbox test

Agent: coder. Commandment: the Office of Verification.
Risk: Test Weakening.

The covenant stays — Archived by Me still loads after
B28 — but the segmented control's
`[data-inbox-pill="archivedByMe"]` is now the filter
pill `[data-workbox-pill="archivedByMe"]`, and the
archive paints in `#archived-list`, not `#claimed-list`.

**Files:**
- Modify: `tests/browser/former-member.test.ts`

- [ ] **Step 1: Edit.** Replace

```ts
            await page.click(
                '[data-inbox-pill="archivedByMe"]',
            );
            assert(
                await page.until<boolean>(
                    `document.querySelector(`
                    + `'[data-inbox-pill=`
                    + `"archivedByMe"]')`
                    + `?.getAttribute(`
                    + `'aria-pressed')`
                    + ` === 'true'`
                    + ` && document.querySelector(`
                    + `'#claimed-list')`
                    + `?.textContent.includes(`
                    + `'No work orders archived`
                    + ` by me')`,
                    'Archived by Me empty copy',
                ),
            );
```

  with

```ts
            await page.click(
                '[data-workbox-pill="archivedByMe"]',
            );
            assert(
                await page.until<boolean>(
                    `document.querySelector(`
                    + `'[data-workbox-pill=`
                    + `"archivedByMe"]')`
                    + `?.getAttribute(`
                    + `'aria-pressed')`
                    + ` === 'true'`
                    + ` && document.querySelector(`
                    + `'#archived-list')`
                    + `?.textContent.includes(`
                    + `'No work orders archived`
                    + ` by me')`,
                    'Archived by Me empty copy',
                ),
            );
```

- [ ] **Step 2: Type-check.** `./test validate --syntax`
  and `./test lint` — PASS.

- [ ] **Step 3: MASTER RUNS: `./test browser`.** Expected:
  'workbox Archived by Me still loads after B28 (WB3)'
  FAILS — no `[data-workbox-pill]` to click. The other
  two tests in the file PASS. The coder skips this step.

- [ ] **Step 4: Commit** `Restate the former-member workbox test`.

### Segment 2 gate

```bash
export DENO_DIR="$TMPDIR/deno-dir" && ./test validate --syntax
export DENO_DIR="$TMPDIR/deno-dir" && ./test
export DENO_DIR="$TMPDIR/deno-dir" && ./test lint
```

All three green (Layer 1 is untouched by this segment).

**MASTER RUNS: `./test browser`.** Expected RED, exactly
these: every test in `workbox-box.test.ts` (7) and
`workbox-pills.test.ts` (1); all three in
`workbox-transition.test.ts`; in `workbox-search.test.ts`
'a claim during a QUERY still shows its answer', 'a pill
after a failed QUERY keeps the error', and 'the switch
claims while filtered'; in `former-member.test.ts`
'workbox Archived by Me still loads after B28 (WB3)'.
Everything else green, `workbox-inbox-width.test.ts`
included. Any other red is a defect in the test to fix
before Segment 3.

---
## Segment 3 — The page

### Task 12: The work order box module

Agent: planner (the shared interface Task 13 builds on).
Commandments: Reliability (the switch moves only on an
answer; a stale read never paints), Idempotency (PUT to
claim, DELETE to release), Clarity. Risks: Swallowed
Failures and the Greedy Catch (each `try` wraps one call;
the re-read after a refusal runs outside it), Internal
Defense (the only throws are bugs), Default Values.

The detail page's reads, transition, required-attribute
check, violations banner, and 412 recovery move here
unchanged in behaviour; what is new is the claim switch,
the close control, the box's own sequence number, and
that a transition keeps the box on the work order.

**Files:**
- Create: `web-app/workbox/work-order-box.ts`

**Interfaces produced:**

```ts
export interface WorkOrderBoxEvents {
    readonly opened: (id: string | null) => void;
    readonly claimMoved: (moved: WorkOrder) => void;
    readonly claimRefused: () => void;
}
export class WorkOrderBox {
    constructor(
        el: HTMLElement,
        memberId: string,
        events: WorkOrderBoxEvents,
        signal: AbortSignal,
    );
    openId(): string | null;
    open(id: string): void;   // gesture; fires opened(id)
    close(): void;            // gesture; fires opened(null)
    reload(): void;           // the bell
}
```

This module needs a DOM, so it has no Layer 1 test; Task
7's Layer 2 file pins it and runs green at this
segment's gate.

- [ ] **Step 1: Create** `web-app/workbox/work-order-box.ts`:

```ts
import {
    $, $$, getRequiredAttribute, isFormField,
} from '../app/dom.ts';
import { html, setHtml } from '../app/safe-html.ts';
import { log } from '../app/logger.ts';
import {
    WorkboxDetailPresenter,
    buildWorkOrderBoxEmpty,
    buildWorkOrderBoxFailed,
    buildWorkOrderBoxLoading,
    type WorkOrderBinding,
} from '../app/presenters/index.ts';
import {
    INSTANCE_CONFLICT_NOTICE,
} from '../app/presenters/record-detail.ts';
import {
    extractErrorMessage,
    reportFault,
} from '../app/error-helpers.ts';
import { showToast } from '../app/toast.ts';
import {
    deleteWorkOrderClaim,
    fieldValuesByEventFromHistory,
    getMemberMap,
    getRecordAttributesByRecord,
    getRecordForWorkOrder,
    getRecordInstance,
    getWorkOrder,
    getWorkOrderVersions,
    isClaimedAndUnlapsed,
    postWorkOrderTransition,
    projectTransitions,
    putWorkOrderClaim,
    workOrderEventsOf,
    RecordTransitionViolations,
    type RecordAttribute,
    type RequestContext,
    type StateFieldValue,
    type TransitionEvent,
    type WorkOrder,
} from '../../client/index.ts';
import { sessionContext } from '../app/client.ts';
import type {
    Id,
    Member,
    NodeAttribute,
} from '../../shared/types.ts';
import {
    RequestError,
    HTTP_CONFLICT,
    HTTP_PRECONDITION_FAILED,
} from '../../shared/http-errors.ts';
import type { HttpMessage } from
    '../../shared/http-message/http-message.ts';

const LOAD_FAILED =
    'An unexpected error occurred. Please try again.';
const REFRESH_FAILED = 'Work order detail refresh failed';

// What the box reads for one work order: the presenter's
// inputs, and the two heads its writes latch — the work
// order's, and the bound instance's the form was filled
// from (WB19a / WB19b).
type WorkOrderRead = {
    readonly workOrder: WorkOrder;
    readonly transitions: readonly TransitionEvent[];
    readonly fieldValuesByEvent: ReadonlyMap<
        Id, readonly StateFieldValue[]
    >;
    readonly memberMap: Map<Id, Member>;
    readonly attributeMap: ReadonlyMap<
        string, RecordAttribute
    >;
    readonly instanceValues:
        ReadonlyMap<string, string> | null;
    readonly binding: WorkOrderBinding | null;
    readonly instance: HttpMessage | null;
};

// What the page hears from the box.
export interface WorkOrderBoxEvents {
    // A work order opened (its id), or the box closed.
    readonly opened: (id: string | null) => void;
    // A claim or release landed: the head it answered.
    readonly claimMoved: (moved: WorkOrder) => void;
    // A claim or release was refused.
    readonly claimRefused: () => void;
}

// The workbox's right box: one work order at a time, read
// and painted in place. Its claim switch, its transitions,
// and its 412 recovery latch the heads it read.
export class WorkOrderBox {
    readonly #el: HTMLElement;
    readonly #memberId: string;
    readonly #events: WorkOrderBoxEvents;
    #openId: string | null = null;
    // The open work order's last read: the messages its
    // writes latch. Null while it loads or after it failed.
    #read: WorkOrderRead | null = null;
    #conflictNotice: string | null = null;
    // Bumped by every open, close, read, and claim: a read
    // that lands under an older number paints nothing.
    #sequence = 0;
    // The box's own write: the bell it rings repaints
    // nothing here, since the write's answer does.
    #writeInFlight = false;

    constructor(
        el: HTMLElement,
        memberId: string,
        events: WorkOrderBoxEvents,
        signal: AbortSignal,
    ) {
        this.#el = el;
        this.#memberId = memberId;
        this.#events = events;
        setHtml(el, buildWorkOrderBoxEmpty());
        el.addEventListener('click', (e) => {
            this.#onClick(e);
        }, { signal });
    }

    openId(): string | null {
        return this.#openId;
    }

    // Opening never claims. The row already open opens
    // nothing new, so a stray click keeps typed values.
    open(id: string): void {
        if (id === this.#openId) {
            return;
        }
        this.#openId = id;
        this.#read = null;
        this.#conflictNotice = null;
        this.#events.opened(id);
        void this.#show(id);
    }

    close(): void {
        this.#sequence += 1;
        this.#openId = null;
        this.#read = null;
        this.#conflictNotice = null;
        setHtml(this.#el, buildWorkOrderBoxEmpty());
        this.#events.opened(null);
    }

    // The bell: re-read the open work order in place, or
    // show it afresh if it never painted.
    reload(): void {
        if (this.#openId === null || this.#writeInFlight) {
            return;
        }
        if (this.#read === null) {
            void this.#show(this.#openId);
            return;
        }
        void this.#refresh(sessionContext(), this.#openId);
    }

    #onClick(e: MouseEvent): void {
        if (!(e.target instanceof Element)) return;
        if (e.target.closest('#work-order-close')) {
            this.close();
            return;
        }
        if (e.target.closest('[data-retry-btn]')) {
            void this.#show(this.#requireOpenId());
            return;
        }
        const claimSwitch = e.target.closest(
            '#work-order-claim-switch',
        );
        if (claimSwitch instanceof HTMLButtonElement) {
            void this.#toggleClaim(claimSwitch);
            return;
        }
        const edge = e.target.closest('[data-edge-id]');
        if (edge) {
            void this.#transition(
                getRequiredAttribute(edge, 'data-edge-id'),
            );
        }
    }

    // A work order the box has not painted: the skeleton,
    // then the work order, or the failed state.
    async #show(id: string): Promise<void> {
        this.#sequence += 1;
        const sequence = this.#sequence;
        setHtml(this.#el, buildWorkOrderBoxLoading());
        let read: WorkOrderRead;
        try {
            read = await readWorkOrder(sessionContext(), id);
        } catch (err) {
            if (sequence !== this.#sequence) return;
            log.error('work order read failed', 'workbox', err);
            setHtml(this.#el, buildWorkOrderBoxFailed(
                extractErrorMessage(err, LOAD_FAILED),
            ));
            $('[data-retry-btn]', this.#el)?.focus();
            return;
        }
        if (sequence !== this.#sequence) return;
        this.#paint(read);
    }

    // A work order the box has painted, read again in
    // place: a failed read keeps what is painted and says
    // so.
    async #refresh(
        ctx: RequestContext,
        id: string,
    ): Promise<void> {
        this.#sequence += 1;
        const sequence = this.#sequence;
        let read: WorkOrderRead;
        try {
            read = await readWorkOrder(ctx, id);
        } catch (err) {
            if (sequence !== this.#sequence) return;
            reportFault(ctx, REFRESH_FAILED, err);
            return;
        }
        if (sequence !== this.#sequence) return;
        this.#paint(read);
    }

    #paint(read: WorkOrderRead): void {
        this.#read = read;
        setHtml(this.#el, this.#presenterOf(read).buildPage());
    }

    #presenterOf(read: WorkOrderRead): WorkboxDetailPresenter {
        return new WorkboxDetailPresenter(
            read.workOrder,
            read.transitions,
            read.fieldValuesByEvent,
            activeClaimOf(read.workOrder),
            read.memberMap,
            this.#memberId,
            read.attributeMap,
            read.instanceValues,
            read.binding,
            [],
            this.#conflictNotice,
        );
    }

    // On is a PUT, off a DELETE, each latching the head the
    // box holds. The switch is disabled while the write is
    // in flight and moves only when it answers. A refusal
    // leaves it where it was, and the lists and the box
    // read again so the claim place names who holds it.
    async #toggleClaim(
        switchEl: HTMLButtonElement,
    ): Promise<void> {
        if (this.#writeInFlight) return;
        const read = this.#requireRead();
        const held = read.workOrder;
        const releasing = this.#holdsClaim(held);
        switchEl.disabled = true;
        this.#writeInFlight = true;
        this.#sequence += 1;
        const sequence = this.#sequence;
        const ctx = sessionContext();
        let moved: WorkOrder;
        try {
            moved = releasing
                ? await deleteWorkOrderClaim(ctx, held)
                : await putWorkOrderClaim(ctx, held);
        } catch (err) {
            log.error(
                releasing ? 'release failed' : 'claim failed',
                'workbox', err,
            );
            showToast(refusalMessage(err, releasing), 'error');
            switchEl.disabled = false;
            this.#events.claimRefused();
            if (sequence === this.#sequence) {
                void this.#refresh(ctx, held.id);
            }
            return;
        } finally {
            this.#writeInFlight = false;
        }
        this.#events.claimMoved(moved);
        if (sequence !== this.#sequence) return;
        this.#paint({ ...read, workOrder: moved });
        $('#work-order-claim-switch', this.#el)?.focus();
    }

    #holdsClaim(workOrder: WorkOrder): boolean {
        return isClaimedAndUnlapsed(workOrder.claim)
            && workOrder.claim.memberId === this.#memberId;
    }

    // The detail page's transition, moved: the required
    // check, the violations banner, the 412 recovery, and
    // the write that latches the head and the instance the
    // form was filled from. After it lands the box stays
    // and reads the new head; the bell refreshes the lists.
    async #transition(edgeId: string): Promise<void> {
        if (this.#writeInFlight) return;
        const read = this.#requireRead();
        const detail = this.#presenterOf(read);
        const values = collectAttributeValues(this.#el);
        if (
            hasEmptyRequiredAttribute(
                detail.renderableAttributes(), values,
            )
        ) {
            showToast(
                'Please fill all required attributes',
                'error',
            );
            return;
        }
        const violationsEl = $(
            '#transition-violations', this.#el,
        );
        if (violationsEl) {
            setHtml(violationsEl, html``);
        }
        // One vessel per gesture: submit, 412 recovery
        // GET, and re-present share the same requestId
        // (D8).
        const ctx = sessionContext();
        this.#writeInFlight = true;
        try {
            await postWorkOrderTransition(ctx, {
                workOrder: read.workOrder,
                edgeId,
                values,
                ...(read.instance === null
                    ? {}
                    : { instance: read.instance }),
            });
        } catch (err) {
            if (err instanceof RecordTransitionViolations) {
                if (violationsEl) {
                    setHtml(
                        violationsEl,
                        detail.buildViolations(err.violations),
                    );
                }
                return;
            }
            if (
                err instanceof RequestError
                && err.status === HTTP_PRECONDITION_FAILED
            ) {
                void this.#recoverFrom412(
                    ctx, read.workOrder.id,
                );
                return;
            }
            reportFault(ctx, 'Work order transition failed', err);
            return;
        } finally {
            this.#writeInFlight = false;
        }
        showToast('Transition complete', 'success');
        void this.#refresh(ctx, read.workOrder.id);
    }

    // A stale head or instance: read again, re-present with
    // the conflict notice, warn, and never retry the write.
    async #recoverFrom412(
        ctx: RequestContext,
        id: string,
    ): Promise<void> {
        if (id !== this.#openId) return;
        this.#conflictNotice = INSTANCE_CONFLICT_NOTICE;
        this.#sequence += 1;
        const sequence = this.#sequence;
        let read: WorkOrderRead;
        try {
            read = await readWorkOrder(ctx, id);
        } catch (err) {
            reportFault(ctx, 'Failed to refresh work order', err);
            return;
        }
        if (sequence !== this.#sequence) return;
        this.#paint(read);
        showToast(INSTANCE_CONFLICT_NOTICE, 'warning');
    }

    // The switch and the transition buttons exist only on a
    // painted work order, so its read is on hand.
    #requireRead(): WorkOrderRead {
        if (this.#read === null) {
            throw new Error('workbox: a box gesture before its read');
        }
        return this.#read;
    }

    // Try Again shows only while a work order is open.
    #requireOpenId(): string {
        if (this.#openId === null) {
            throw new Error('workbox: Try Again with nothing open');
        }
        return this.#openId;
    }
}

// Wave 1: the head, its versions, the members, and the
// record, side by side; wave 2: the record's attributes
// beside the bound instance's head. The present is the
// head; the timeline is the versions' events in chain
// order; live form values come from the instance.
async function readWorkOrder(
    ctx: RequestContext,
    id: string,
): Promise<WorkOrderRead> {
    const [workOrder, versions, memberMap, recordId] =
        await Promise.all([
            getWorkOrder(ctx, id),
            getWorkOrderVersions(ctx, id),
            getMemberMap(ctx),
            getRecordForWorkOrder(ctx, id),
        ]);
    const binding = bindingOf(workOrder);
    const [attributes, instance] = await Promise.all([
        recordId === null
            ? Promise.resolve<RecordAttribute[]>([])
            : getRecordAttributesByRecord(ctx, recordId),
        binding === null
            ? Promise.resolve(null)
            : getRecordInstance(
                ctx, binding.recordTypeId, binding.instanceId,
            ),
    ]);
    const events = workOrderEventsOf(versions);
    return {
        workOrder,
        transitions: projectTransitions(id, events),
        fieldValuesByEvent:
            fieldValuesByEventFromHistory(events),
        memberMap,
        attributeMap: new Map(
            attributes.map((a) => [a.id, a] as const),
        ),
        instanceValues:
            instance === null ? null : instance.values,
        binding,
        instance: instance === null ? null : instance.message,
    };
}

function bindingOf(
    workOrder: WorkOrder,
): WorkOrderBinding | null {
    return workOrder.instanceId !== undefined
        && workOrder.recordTypeId !== undefined
        ? {
            instanceId: workOrder.instanceId,
            recordTypeId: workOrder.recordTypeId,
        }
        : null;
}

// The head's claim while it is live; a lapsed claim is no
// claim.
function activeClaimOf(
    workOrder: WorkOrder,
): { memberId: Id; at: string } | null {
    return isClaimedAndUnlapsed(workOrder.claim)
        ? {
            memberId: workOrder.claim.memberId,
            at: workOrder.claim.at,
        }
        : null;
}

function refusalMessage(
    err: unknown,
    releasing: boolean,
): string {
    if (err instanceof RequestError && err.status === HTTP_CONFLICT) {
        return 'Someone else holds that work order';
    }
    return releasing
        ? 'Failed to release work order'
        : 'Failed to claim work order';
}

function collectAttributeValues(
    container: HTMLElement,
): Record<string, string> {
    const values: Record<string, string> =
        {};
    const inputs = $$(
        '[data-attribute-id]', container,
    );
    for (const input of inputs) {
        if (!isFormField(input)) continue;
        const attributeId = getRequiredAttribute(
            input, 'data-attribute-id',
        );
        if (input.type === 'radio') {
            if ((input as HTMLInputElement).checked) {
                values[attributeId] = input.value;
            }
        } else if (input.type === 'checkbox') {
            values[attributeId] = (
                input as HTMLInputElement
            ).checked
                ? 'true'
                : 'false';
        } else {
            values[attributeId] =
                input.value.trim();
        }
    }
    return values;
}

function hasEmptyRequiredAttribute(
    refs: readonly NodeAttribute[],
    values: Record<string, string>,
): boolean {
    return refs
        .filter(r => r.isRequired)
        .some(r => {
            const v = values[r.attributeId];
            return v === undefined || v === '';
        });
}
```

  (`collectAttributeValues` and `hasEmptyRequiredAttribute`
  are `web-app/workbox/detail.ts`'s, copied verbatim;
  `detail.ts` itself goes in Task 24.)

- [ ] **Step 2: Check.**
  `export DENO_DIR="$TMPDIR/deno-dir" && ./test validate --syntax`
  — PASS (the module compiles; nothing imports it yet).
  `./test lint` — PASS (no line over 78). `./test` — PASS.

- [ ] **Step 3: Commit** `Add the work order box`.

### Task 13: The workbox on one page

Agent: planner. Commandments: Reliability (sequence
numbers), Uniformity, Clarity, the Office of the
Interface. Risks: the Cache (counts derived in
`paintInbox`, never stored), Default Values, the Greedy
Catch (the create's `try` wraps the create alone),
Unbidden Helper Code.

What the page stops doing: navigating to the detail page
(rows, Create), the drag, the segmented control and its
hash, the phone swap of the list cards, the drop toasts.
What it starts doing: the pills, the two headed lists in
one box, the work order box, `?id=`, and the phone
scroll.

**Files:**
- Modify (whole file): `web-app/workbox/index.html`
- Modify (whole file): `web-app/workbox/index.ts`
- Test: `tests/presenter-workbox-inbox.test.ts`

- [ ] **Step 1: Write the failing test.** In
  `tests/presenter-workbox-inbox.test.ts`, the test
  'workbox index.html is two cards, pills on the right,
  no subtitle' pins the segmented control and two cards
  the spec removes. Replace that whole test — from
  `Deno.test(\n    'workbox index.html is two cards, pills on'`
  through its closing `);` — with:

```ts
Deno.test(
    'workbox index.html holds the pills, the lists, and'
    + ' the box, no subtitle',
    async () => {
        const page = await Deno.readTextFile(
            new URL(
                '../web-app/workbox/index.html',
                import.meta.url,
            ),
        );
        assertStringIncludes(page, 'Workbox');
        const pills = /<div\s+id="workbox-pills"[^>]*>/
            .exec(page);
        assertEquals(pills !== null, true);
        assertStringIncludes(pills![0], 'role="group"');
        assertStringIncludes(
            pills![0], 'aria-label="Filter work orders"',
        );
        const box = /<section\s+id="work-order-box"[^>]*>/
            .exec(page);
        assertEquals(box !== null, true);
        assertStringIncludes(box![0], 'aria-label="Work order"');
        const at = (needle: string) => page.indexOf(needle);
        assertEquals(
            at('id="workbox-pills"') >= 0
                && at('id="workbox-pills"')
                    < at('id="work-order-lists"')
                && at('id="work-order-lists"')
                    < at('id="work-order-box"'),
            true,
        );
        for (const retired of [
            'data-inbox-pill', 'Active</',
            'Your work order inbox', 'workbox-tabs',
            'tab-archive', 'Archive</', 'drag-handle',
        ]) {
            assertEquals(page.includes(retired), false, retired);
        }
    },
);
```

- [ ] **Step 2: Run** ONE-FILE with
  `tests/presenter-workbox-inbox.test.ts`. Expected: FAIL
  — `pills !== null` is false (no `#workbox-pills`).

- [ ] **Step 3: Implement the page.** Replace the whole of
  `web-app/workbox/index.html` with:

```html
<div class="workspace">
    <div class="page-header workbox-header">
        <div>
            <h1 class="page-title">
                Workbox
            </h1>
        </div>
        <div class="search-wrapper search-wrapper-wide">
            <span
                class="search-icon"
                id="workbox-search-icon"
            ></span>
            <input
                id="workbox-search"
                type="search"
                class="input search-input"
                placeholder="Search work orders..."
                aria-label="Search work orders"
            />
        </div>
        <div
            class="workbox-header-actions flex
                flex-wrap items-center gap-3"
            id="workbox-header-actions"
        >
            <div class="dropdown">
                <button
                    class="btn btn-primary gap-2"
                    id="create-work-order-btn"
                >
                    <span
                        id="create-work-order-btn-icon"
                    ></span>
                    <span
                        class="hidden-mobile"
                    >Create Work Order</span><span
                        class="visible-mobile"
                    >Create</span>
                </button>
                <div
                    class="dropdown-content
                        hidden"
                    id="create-work-order-dropdown"
                    data-align="end"
                >
                </div>
            </div>
        </div>
    </div>

    <div
        id="workbox-pills"
        class="flex flex-wrap items-center gap-2 mb-6"
        role="group"
        aria-label="Filter work orders"
    >
    </div>

    <div
        id="workbox-inbox"
        class="grid grid-cols-1
            md:grid-cols-2 gap-6"
    >
        <div
            id="work-order-lists"
            class="card p-4 min-w-0"
        >
        </div>
        <section
            id="work-order-box"
            class="card p-4 min-w-0
                workbox-work-order"
            aria-label="Work order"
        >
        </section>
    </div>
</div>
```

  Replace the whole of `web-app/workbox/index.ts` with:

```ts
import {
    $, $$, $input, populateIcons, getRequiredAttribute,
} from '../app/dom.ts';
import {
    html, setHtml, type SafeHtml,
} from '../app/safe-html.ts';
import { log } from '../app/logger.ts';
import { createPageAbort } from
    '../app/page-lifecycle.ts';
import { showToast } from '../app/toast.ts';
import {
    buildErrorState,
    buildSkeleton,
    loadInto,
} from '../app/loading-states.ts';
import { extractErrorMessage } from
    '../app/error-helpers.ts';
import {
    ICON_SIZE,
    iconPlus,
    iconNoEntry,
    iconSearch,
} from '../app/icons.ts';
import { initDropdown } from '../app/dropdown.ts';
import {
    getFlowsForCreation,
    type NotReadyFlowEntry,
} from '../app/flow-publish.ts';
import {
    getCurrentHumanMember,
    isClaimedAndUnlapsed,
    subscribeWorkOrderChanges,
    type RequestContext,
    type WorkOrder,
} from '../../client/index.ts';
import { sessionContext } from '../app/client.ts';
import { generateIdentifier } from
    '../../shared/identifier.ts';
import {
    createWorkOrderFromFlow,
} from '../app/work-order-creation.ts';
import {
    getInboxRows,
    queryInboxRows,
    type InboxRows,
} from '../app/workbox-inbox-rows.ts';
import {
    NO_PILL,
    buildInboxItems,
    buildInboxLists,
    buildWorkboxPills,
    inboxSectionsOf,
    partitionInboxItems,
    pillFlowNamesOf,
    pressedAmong,
    samePill,
    workboxPillsOf,
    type InboxFilter,
    type InboxLists,
    type PressedPill,
} from '../app/presenters/index.ts';
import { getHref, putAddress } from
    '../app/adapters/location.ts';
import { workOrderAddress } from
    '../app/workbox-address.ts';
import { WorkOrderBox } from './work-order-box.ts';
import { QUERY_TEXT_MAX_LENGTH } from
    '../../shared/search-match.ts';

const { signal } = createPageAbort();

// The pause after the last keystroke before the search
// sends its QUERY.
const SEARCH_PAUSE_MS = 200;
const MOBILE_MEDIA_QUERY = '(max-width: 767px)';

const NO_FILTER: InboxFilter = { kind: 'none' };

// What the lists show: every work order from the last
// full GET (inboxRows), a QUERY's answer, or the error
// state of the read that failed.
type InboxView =
    | { readonly kind: 'all' }
    | {
        readonly kind: 'matched';
        readonly text: string;
        readonly rows: InboxRows;
    }
    | { readonly kind: 'failed' };

// The page's three regions: the pills, the lists, and the
// box that holds the open work order.
type WorkboxElements = {
    readonly pills: HTMLElement;
    readonly lists: HTMLElement;
    readonly box: HTMLElement;
};

let inboxRows: InboxRows | null = null;
let inboxView: InboxView = { kind: 'all' };
// Bumped by every keystroke and read: a read that
// finishes under an older number paints nothing.
let listsSequence = 0;
let searchTimer:
    ReturnType<typeof setTimeout> | undefined;
let currentMemberId: string | null = null;
// At most one pill is pressed; a reload starts with none.
let pressed: PressedPill = NO_PILL;
let workOrderBox: WorkOrderBox | null = null;
let searchBound = false;
let phoneOrderBound = false;
let regionsBound = false;
let bellBound = false;

export async function init(
    params?: Record<string, string>,
): Promise<void> {
    const pillsEl = $('#workbox-pills', document);
    const listsEl = $('#work-order-lists', document);
    const boxEl = $('#work-order-box', document);
    if (!pillsEl || !listsEl || !boxEl) return;
    const els: WorkboxElements = {
        pills: pillsEl,
        lists: listsEl,
        box: boxEl,
    };
    const searchEl = $input('#workbox-search', document);
    if (!searchEl) return;
    searchEl.maxLength = QUERY_TEXT_MAX_LENGTH;
    populateIcons([
        [
            '#workbox-search-icon',
            iconSearch(ICON_SIZE.base, ''),
        ],
    ]);

    const ctx = sessionContext();
    if (!phoneOrderBound) {
        phoneOrderBound = true;
        bindPhoneOrder();
    }
    const memberId = (await getCurrentHumanMember(ctx)).id;
    currentMemberId = memberId;
    const box = workOrderBoxOf(els, memberId, searchEl, ctx);
    if (!regionsBound) {
        regionsBound = true;
        bindRegions(els, box, searchEl, ctx);
    }
    // The address names the work order to open: a reload
    // keeps the box, and a link can name one.
    const openId = params?.id;
    if (openId !== undefined) {
        box.open(openId);
    }
    const rowsPromise = fetchInboxRows(ctx);
    const sequence = listsSequence;
    if (!searchBound) {
        searchBound = true;
        bindSearchBox(searchEl, els, ctx);
    }
    await Promise.all([
        renderInbox(
            els, ctx, sequence, rowsPromise, searchEl,
        ),
        initCreateDropdown(ctx, box),
    ]);

    if (!bellBound) {
        bellBound = true;
        // Any work-order change, this tab's or another's,
        // refreshes the lists and re-reads the open work
        // order.
        subscribeWorkOrderChanges(() => {
            void refreshInboxLists(searchEl, els, ctx);
            box.reload();
        });
    }
}

// One box for the page's life: init runs again on a retry.
function workOrderBoxOf(
    els: WorkboxElements,
    memberId: string,
    searchEl: HTMLInputElement,
    ctx: RequestContext,
): WorkOrderBox {
    if (workOrderBox === null) {
        workOrderBox = new WorkOrderBox(els.box, memberId, {
            opened: (id) => {
                onWorkOrderOpened(els, id);
            },
            claimMoved: (moved) => {
                onClaimMoved(els, moved);
            },
            claimRefused: () => {
                void refreshInboxLists(searchEl, els, ctx);
            },
        }, signal);
    }
    return workOrderBox;
}

// Every paint of the lists follows init's box.
function requireWorkOrderBox(): WorkOrderBox {
    if (workOrderBox === null) {
        throw new Error('workbox: lists painted before the box');
    }
    return workOrderBox;
}

function bindRegions(
    els: WorkboxElements,
    box: WorkOrderBox,
    searchEl: HTMLInputElement,
    ctx: RequestContext,
): void {
    els.pills.addEventListener('click', (e) => {
        onPillClick(e, els, searchEl, ctx);
    }, { signal });
    els.lists.addEventListener('click', (e) => {
        onRowClick(e, box);
    }, { signal });
}

function bindSearchBox(
    searchEl: HTMLInputElement,
    els: WorkboxElements,
    ctx: RequestContext,
): void {
    searchEl.addEventListener('input', () => {
        onSearchInput(searchEl, els, ctx);
    }, { signal });
    searchEl.addEventListener('keydown', e => {
        if (e.key !== 'Escape' || searchEl.value === '') {
            return;
        }
        e.preventDefault();
        searchEl.value = '';
        onSearchInput(searchEl, els, ctx);
    }, { signal });
    // A box the browser restored on history navigation
    // searches as if typed.
    if (searchText(searchEl) !== '') {
        onSearchInput(searchEl, els, ctx);
    }
}

// An emptied box shows every work order at once; text
// waits for the pause, so one QUERY follows a burst of
// keystrokes.
function onSearchInput(
    searchEl: HTMLInputElement,
    els: WorkboxElements,
    ctx: RequestContext,
): void {
    listsSequence += 1;
    clearTimeout(searchTimer);
    if (searchText(searchEl) === '') {
        void refreshInboxLists(searchEl, els, ctx);
        return;
    }
    searchTimer = setTimeout(() => {
        void refreshInboxLists(searchEl, els, ctx);
    }, SEARCH_PAUSE_MS);
}

function searchText(searchEl: HTMLInputElement): string {
    return searchEl.value.trim();
}

// CSS order moves no focus, and the DOM puts the search
// before the button and the claimed list before the
// available one, so a phone's stacked order is the DOM's
// own.
function bindPhoneOrder(): void {
    const phone = matchMedia(MOBILE_MEDIA_QUERY);
    followPhoneOrder(phone.matches);
    phone.addEventListener('change', e => {
        followPhoneOrder(e.matches);
    }, { signal });
}

function followPhoneOrder(phone: boolean): void {
    const search = $(
        '.workbox-header > .search-wrapper', document,
    );
    const actions = $('#workbox-header-actions', document);
    if (!search || !actions) return;
    if (phone) {
        actions.after(search);
    } else {
        actions.before(search);
    }
}

async function fetchInboxRows(
    ctx: RequestContext,
): Promise<InboxRows> {
    inboxRows = await getInboxRows(ctx);
    return inboxRows;
}

// Every list is built after init resolves the caller.
function requireCurrentMemberId(): string {
    if (currentMemberId === null) {
        throw new Error(
            'workbox: lists built before the caller'
            + ' resolved',
        );
    }
    return currentMemberId;
}

// Every paint follows a full read: the pills are its
// flows.
function requireInboxRows(): InboxRows {
    if (inboxRows === null) {
        throw new Error(
            'workbox: lists painted before the first read',
        );
    }
    return inboxRows;
}

function listsFrom(
    rows: InboxRows,
) {
    return buildInboxItems(
        rows.workOrders,
        rows.activeClaimsByWo,
        requireCurrentMemberId(),
    );
}

function matchedListsOf(rows: InboxRows): InboxLists {
    return partitionInboxItems(
        rows.workOrders,
        rows.activeClaimsByWo,
        requireCurrentMemberId(),
    );
}

function filterOf(view: InboxView): InboxFilter {
    return view.kind === 'matched'
        ? { kind: 'matched', text: view.text }
        : NO_FILTER;
}

// The first read takes the page's load arc: a skeleton,
// then the lists, or the failed state with Try Again.
async function renderInbox(
    els: WorkboxElements,
    ctx: RequestContext,
    sequence: number,
    rowsPromise: Promise<InboxRows>,
    searchEl: HTMLInputElement,
): Promise<void> {
    await loadInto({
        container: els.lists,
        skeleton: buildSkeleton('card-list', 4),
        fetch: () => rowsPromise,
        retry: () => {
            void refreshInboxLists(searchEl, els, ctx);
        },
        onData: () => {
            if (sequence !== listsSequence) return;
            inboxView = { kind: 'all' };
            paintInbox(els);
        },
    });
}

// The box decides the read: empty, today's GET; text, its
// QUERY. Each read takes the next sequence number, so only
// the newest paints.
async function refreshInboxLists(
    searchEl: HTMLInputElement,
    els: WorkboxElements,
    ctx: RequestContext,
): Promise<void> {
    listsSequence += 1;
    const sequence = listsSequence;
    const text = searchText(searchEl);
    const retry = () => {
        void refreshInboxLists(searchEl, els, ctx);
    };
    if (text === '') {
        await showAllLists(els, ctx, sequence, retry);
        return;
    }
    await showMatchedLists(els, ctx, sequence, text, retry);
}

async function showAllLists(
    els: WorkboxElements,
    ctx: RequestContext,
    sequence: number,
    retry: () => void,
): Promise<void> {
    try {
        await fetchInboxRows(ctx);
    } catch (err) {
        if (sequence !== listsSequence) return;
        log.error('inbox read failed', 'workbox', err);
        inboxView = { kind: 'failed' };
        paintListsError(els.lists, err, retry);
        return;
    }
    if (sequence !== listsSequence) return;
    inboxView = { kind: 'all' };
    paintInbox(els);
}

// The answer's members are the last full GET's, read
// first when no GET has landed yet.
async function showMatchedLists(
    els: WorkboxElements,
    ctx: RequestContext,
    sequence: number,
    text: string,
    retry: () => void,
): Promise<void> {
    let rows: InboxRows;
    try {
        const all = inboxRows ?? await fetchInboxRows(ctx);
        rows = await queryInboxRows(
            ctx, text, all.memberMap,
        );
    } catch (err) {
        if (sequence !== listsSequence) return;
        log.error('inbox search failed', 'workbox', err);
        inboxView = { kind: 'failed' };
        paintListsError(els.lists, err, retry);
        return;
    }
    if (sequence !== listsSequence) return;
    inboxView = { kind: 'matched', text, rows };
    paintInbox(els);
}

// The page's failed-load treatment: never the unfiltered
// lists standing in for a failed search.
function paintListsError(
    listsEl: HTMLElement,
    err: unknown,
    retry: () => void,
): void {
    setHtml(listsEl, buildErrorState(
        extractErrorMessage(
            err,
            'An unexpected error occurred.'
            + ' Please try again.',
        ),
        'Try Again',
    ));
    $('[data-retry-btn]', listsEl)
        ?.addEventListener('click', retry);
}

// One pass over the rows on hand gives the pills their
// numbers and the lists what the pressed pill draws. The
// pills are the last full read's flows, so a search moves
// none of them. The box is not repainted.
function paintInbox(els: WorkboxElements): void {
    const full = listsFrom(requireInboxRows());
    const flowNames = pillFlowNamesOf(full);
    pressed = pressedAmong(pressed, flowNames);
    const lists = inboxView.kind === 'matched'
        ? matchedListsOf(inboxView.rows)
        : full;
    paintPills(
        els.pills,
        buildWorkboxPills(
            workboxPillsOf(flowNames, lists), pressed,
        ),
    );
    setHtml(els.lists, buildInboxLists(
        inboxSectionsOf(lists, pressed),
        filterOf(inboxView),
        pressed,
    ));
    markOpenRow(els.lists, requireWorkOrderBox().openId());
}

// A repaint replaces the pill buttons: the one that held
// focus hands it to the pill that takes its place.
function paintPills(
    pillsEl: HTMLElement,
    content: SafeHtml,
): void {
    const active = document.activeElement;
    const held = active instanceof Element
        ? active.closest('[data-workbox-pill]')
        : null;
    const heldPill = held !== null && pillsEl.contains(held)
        ? pillOf(held)
        : null;
    setHtml(pillsEl, content);
    if (heldPill === null) return;
    $$('[data-workbox-pill]', pillsEl)
        .find((el) => samePill(pillOf(el), heldPill))
        ?.focus();
}

function pillOf(el: Element): PressedPill {
    const kind = getRequiredAttribute(el, 'data-workbox-pill');
    if (kind === 'claimed') return { kind: 'claimed' };
    if (kind === 'archivedByMe') return { kind: 'archivedByMe' };
    if (kind === 'flow') {
        return {
            kind: 'flow',
            flowName: getRequiredAttribute(el, 'data-flow-name'),
        };
    }
    throw new Error('workbox: unknown pill ' + kind);
}

// Pressing the pressed pill clears the filter. A pill
// repaints the pills and the lists, never the box.
function onPillClick(
    e: MouseEvent,
    els: WorkboxElements,
    searchEl: HTMLInputElement,
    ctx: RequestContext,
): void {
    if (!(e.target instanceof Element)) return;
    const pill = e.target.closest('[data-workbox-pill]');
    if (!pill) return;
    const next = pillOf(pill);
    pressed = samePill(next, pressed) ? NO_PILL : next;
    // A failed read has no rows to narrow: the pill runs
    // it again.
    if (inboxView.kind === 'failed') {
        void refreshInboxLists(searchEl, els, ctx);
        return;
    }
    paintInbox(els);
}

// The row whose work order the box holds carries
// aria-current; no other row does.
function markOpenRow(
    listsEl: HTMLElement,
    openId: string | null,
): void {
    for (const card of $$('[data-work-order-card]', listsEl)) {
        if (
            card.getAttribute('data-work-order-card')
                === openId
        ) {
            card.setAttribute('aria-current', 'true');
        } else {
            card.removeAttribute('aria-current');
        }
    }
}

// A plain click opens the row's work order in the box; a
// modified click on its title follows the link, as any
// link does.
function onRowClick(e: MouseEvent, box: WorkOrderBox): void {
    if (!(e.target instanceof Element)) return;
    const card = e.target.closest('[data-work-order-card]');
    if (!card) return;
    if (e.target.closest('a[href]') && isModifiedClick(e)) {
        return;
    }
    e.preventDefault();
    box.open(getRequiredAttribute(card, 'data-work-order-card'));
}

function isModifiedClick(e: MouseEvent): boolean {
    return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
}

// The open work order rides the address and marks its
// row; on a phone the page scrolls to the box it opened,
// or back to the lists it closed to.
function onWorkOrderOpened(
    els: WorkboxElements,
    id: string | null,
): void {
    putAddress(workOrderAddress(getHref(), id));
    markOpenRow(els.lists, id);
    if (matchMedia(MOBILE_MEDIA_QUERY).matches) {
        (id === null ? els.lists : els.box)
            .scrollIntoView({ block: 'start' });
    }
}

// A claim or release the box landed moves its row now,
// from the head the write answered. Before the first read
// lands there is no list to move it in, and a failed read
// keeps its error; the bell's read follows either way.
function onClaimMoved(
    els: WorkboxElements,
    moved: WorkOrder,
): void {
    latchMoved(moved);
    if (inboxRows === null || inboxView.kind === 'failed') {
        return;
    }
    paintInbox(els);
}

function latchMovedWorkOrder(
    rows: InboxRows,
    moved: WorkOrder,
): InboxRows {
    const workOrders = rows.workOrders.map(
        wo => wo.id === moved.id ? moved : wo,
    );
    const activeClaimsByWo = new Map(
        rows.activeClaimsByWo,
    );
    if (isClaimedAndUnlapsed(moved.claim)) {
        activeClaimsByWo.set(moved.id, {
            memberId: moved.claim.memberId,
            at: moved.claim.at,
        });
    } else {
        activeClaimsByWo.delete(moved.id);
    }
    return {
        ...rows,
        workOrders,
        activeClaimsByWo,
    };
}

// The moved head replaces its stale twin in the last GET
// and in the answer, so its row moves at once.
function latchMoved(moved: WorkOrder): void {
    if (inboxRows !== null) {
        inboxRows = latchMovedWorkOrder(inboxRows, moved);
    }
    if (inboxView.kind === 'matched') {
        inboxView = {
            ...inboxView,
            rows: latchMovedWorkOrder(
                inboxView.rows, moved,
            ),
        };
    }
}

// The new work order opens in the box; its bell refreshes
// the lists.
async function createWorkOrderForFlow(
    flowId: string,
    ctx: RequestContext,
    box: WorkOrderBox,
): Promise<void> {
    const workOrderId =
        generateIdentifier();
    const flowLinkId =
        generateIdentifier();
    try {
        await createWorkOrderFromFlow(ctx, {
            workOrderId,
            flowLinkId,
            flowId,
        });
    } catch (err) {
        log.error(
            'work order creation failed',
            'workbox', err,
        );
        showToast(
            'Failed to create work order',
            'error',
        );
        return;
    }
    showToast(
        'Work order created', 'success',
    );
    box.open(workOrderId);
}

async function initCreateDropdown(
    ctx: RequestContext,
    box: WorkOrderBox,
): Promise<void> {
    populateIcons([
        [
            '#create-work-order-btn-icon',
            iconPlus(ICON_SIZE.base, ''),
        ],
    ]);

    const dropdownEl = $(
        '#create-work-order-dropdown',
        document,
    );
    if (!dropdownEl) return;

    const { ready, notReady } =
        await getFlowsForCreation(ctx);

    if (ready.length === 0 && notReady.length === 0) {
        setHtml(dropdownEl, html`<div
            class="dropdown-empty"
        >No flows available</div>`);
    } else {
        const readySection =
            ready.length > 0
                ? html`<div
                        class="dropdown-section-label"
                    >READY</div>${ready.map(
                        f => html`<button
                            class="dropdown-item"
                            data-flow-id="${f.id}"
                        >${f.name}</button>`,
                    )}`
                : html``;
        const notReadySection =
            notReady.length > 0
                ? html`<div
                        class="dropdown-section-label"
                    >NOT READY</div>${
                        notReady.map(buildNotReadyRow)
                    }`
                : html``;
        setHtml(
            dropdownEl,
            html`${readySection}${notReadySection}`,
        );
    }

    initDropdown(
        'create-work-order-btn',
        'create-work-order-dropdown',
    );

    dropdownEl.addEventListener(
        'click',
        e => onDropdownClick(e, dropdownEl, ctx, box),
        { signal },
    );
}

function buildNotReadyRow(f: NotReadyFlowEntry) {
    const subtitle = f.problemCount === 1
        ? '1 node needs attention'
        : `${f.problemCount} nodes need attention`;
    return html`<div
        class="dropdown-item-disabled"
        aria-disabled="true"
    ><span
        class="not-ready-icon"
    >${iconNoEntry(ICON_SIZE.base, '')}</span><span
        class="not-ready-body"
    ><span
        class="not-ready-name"
    >${f.name}</span><span
        class="not-ready-subtitle"
    >${subtitle}</span></span></div>`;
}

function onDropdownClick(
    e: MouseEvent,
    dropdownEl: HTMLElement,
    ctx: RequestContext,
    box: WorkOrderBox,
): void {
    if (
        !(e.target instanceof Element)
    ) return;
    const item = e.target.closest<HTMLElement>(
        '[data-flow-id]',
    );
    if (!item) return;
    const flowId = item.getAttribute(
        'data-flow-id',
    );
    if (!flowId) return;
    dropdownEl.classList.add('hidden');
    void createWorkOrderForFlow(flowId, ctx, box);
}
```

  Notes for the implementer:
  - `inboxRows ?? await fetchInboxRows(ctx)`,
    `buildInboxItems`, `buildNotReadyRow`, and the Create
    dropdown are today's code, kept.
  - `paintInbox` is the one place counts are computed;
    nothing stores them.
  - Nothing here imports `web-app/app/workbox-inbox-drag.ts`
    or `navigateTo` any more; the drag module stays on
    disk, unused, until Task 21.

- [ ] **Step 4: Run** ONE-FILE with
  `tests/presenter-workbox-inbox.test.ts` — PASS.
  `./test validate --syntax`, `./test`, `./test lint` —
  PASS. If `./test lint` names a line in `index.ts` over
  78 characters, wrap it at an argument boundary; do not
  shorten names.

- [ ] **Step 5: Commit** `Put the workbox on one page`.

### Task 14: The workbox's new styles

Agent: coder. Commandments: Uniformity (tokens only, the
existing `.badge`, `.switch`, `.header-stat-divider`),
the Office of the Interface. Risk: Magical Values (each
header height names the rule it mirrors).

**Files:**
- Modify: `web-app/app/styles/pages-workbox.css`

- [ ] **Step 1: Append** to the end of
  `web-app/app/styles/pages-workbox.css`:

```css

/* A pill's count: a full-radius chip of tabular numerals
    on a faint foreground tint. The pill itself is .badge,
    .badge-primary / .badge-secondary, and
    .badge[data-dimmed]. */
.workbox-pill-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.25rem;
    height: 1.25rem;
    padding: 0 var(--space-1);
    border-radius: var(--radius-full);
    background: hsl(var(--foreground) / 0.12);
    font-weight: var(--font-weight-semibold);
    font-variant-numeric: tabular-nums;
}

/* The row whose work order the box holds. */
[data-work-order-card][aria-current="true"] {
    outline: 2px solid hsl(var(--primary));
    outline-offset: -2px;
}

/* Before anything is opened: the box's one muted line. */
.workbox-work-order-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 12rem;
}

/* From md up the open work order stays in view while the
    lists scroll: sticky below layout.css's 4rem sticky
    .top-header and the page's --space-8 padding, scrolling
    on its own when taller than the window. */
@media (min-width: 768px) {
    .workbox-work-order {
        position: sticky;
        top: calc(4rem + var(--space-8));
        align-self: start;
        max-height: calc(100vh - 4rem - 2 * var(--space-8));
        overflow-y: auto;
    }
}

/* On a phone, opening and closing scroll a box to the
    top, under layout.css's fixed 3.5rem .mobile-header:
    the margin lands it below that header. */
@media (max-width: 767px) {
    #work-order-lists,
    .workbox-work-order {
        scroll-margin-top: calc(3.5rem + var(--space-2));
    }
}
```

- [ ] **Step 2: Run** `./test lint` — PASS (no line over
  78; tokens only). `./test validate --syntax`, `./test`
  — PASS.

- [ ] **Step 3: Commit** `Style the pills, the open row, and the box`.

### Task 15: Link inbox rows to the workbox

Agent: coder. Commandment: Uniformity. Risk: Test
Weakening.

A row's title links to `workbox/index.html?id=<id>` so a
modified click opens the work order in a new tab; a plain
click the page intercepts (Task 13).

**Files:**
- Modify: `web-app/app/presenters/workbox-inbox.ts`
- Test: `tests/presenter-workbox-inbox.test.ts`

- [ ] **Step 1: Write the failing test.** In
  `tests/presenter-workbox-inbox.test.ts` add to the
  imports:

```ts
import { buildPageUrl } from '../web-app/app/navigation.ts';
import { escapeForHtml } from '../web-app/app/safe-html.ts';
```

  and append:

```ts
Deno.test('a row\'s title links to the workbox with its id', () => {
    const out = buildInboxLists(
        [{ kind: 'available', items: [placed()] }],
        NO_FILTER,
        NO_PILL,
    ).toString();
    assertStringIncludes(
        out,
        'href="' + escapeForHtml(
            buildPageUrl('workbox', { id: 'wo-1' }),
        ) + '"',
    );
    assertEquals(out.includes('detail.html'), false);
});
```

- [ ] **Step 2: Run** ONE-FILE with
  `tests/presenter-workbox-inbox.test.ts`. Expected: FAIL
  — the href is `../workbox/detail.html?id=wo-1`.

- [ ] **Step 3: Implement.** In
  `web-app/app/presenters/workbox-inbox.ts` replace

```ts
                <a href="${
                    buildPageUrl(
                        'workbox-detail',
                        { id: item.id },
                    )
                }" class="${
```

  with

```ts
                <a href="${
                    buildPageUrl(
                        'workbox',
                        { id: item.id },
                    )
                }" class="${
```

  and replace

```ts
// Static: no data-work-order-card, so the page neither
// navigates it to a detail page that cannot place it nor
// drags it; no link and no grip either.
```

  with

```ts
// Static: no data-work-order-card and no link, so the page
// never opens it in the box, which could not place it.
```

- [ ] **Step 4: Run** ONE-FILE with
  `tests/presenter-workbox-inbox.test.ts` — PASS.
  `./test validate --syntax`, `./test`, `./test lint` —
  PASS.

- [ ] **Step 5: Commit** `Link inbox rows to the workbox`.

### Task 16: Point the Records page's work order link at the workbox

Agent: coder. Commandment: Uniformity.

**Files:**
- Modify: `web-app/records/detail.ts`

The page handler needs a DOM; Task 7's 'the Records
page's work order link opens it in the workbox' pins it
at this segment's gate.

- [ ] **Step 1: Edit.** In `web-app/records/detail.ts`
  replace

```ts
        navigateTo('workbox-detail', {
            id: woLink,
        });
```

  with

```ts
        navigateTo('workbox', {
            id: woLink,
        });
```

- [ ] **Step 2: Run** `./test validate --syntax`, `./test`,
  `./test lint` — PASS.

- [ ] **Step 3: Commit** `Link records' work orders to the workbox`.

### Segment 3 gate

```bash
export DENO_DIR="$TMPDIR/deno-dir" && ./test validate --syntax
export DENO_DIR="$TMPDIR/deno-dir" && ./test
export DENO_DIR="$TMPDIR/deno-dir" && ./test lint
```

All green.

**MASTER RUNS: `./test browser`.** Expected: ALL GREEN —
every test Segment 2 left red now passes, and
`workbox-inbox-width.test.ts` still fits 900px and 320px.
A red here is a defect in Segment 3 (or in a Segment 2
test the master then rules on), fixed as a `fixup!` of
the task that caused it before Segment 4.

---

## Segment 3b — After a transition

Added by Amendment 1, after Segments 1–3 ran as planned
(through `7d2fdcb0f`). It answers two things:

- **A test defect, measured in Chrome.** At the fixtures'
  1280×800 viewport the submit edge button sits at
  y 897–937, below the bottom of the sticky
  `#work-order-box` (y 214–886, its own scroll:
  scrollHeight 934, clientHeight 670). `page.click` is a
  compositor press at the rect's centre with no
  scrolling, so the press lands on nothing. The product
  is right; the test must scroll the button into view
  first, as a person would (the idiom
  `workbox-box.test.ts` and `workbox-search.test.ts`
  already use for rows). The only `page.click` on a
  control below the box's header is the edge click in
  `workbox-transition.test.ts`; the switch and the close
  control sit in the title row, and the search and box
  tests set field values by `evaluate`.
- **The spec's new section "After a transition"**
  (`4cf8a54b1`): a step that lists me (not an archive
  node, `memberIds` names me) keeps the box on the work
  order; anywhere else, once the lists have refreshed,
  the box opens the topmost openable row of the claimed
  list as drawn, else of the available list as drawn,
  never the work order just sent on, and closes when
  there is none.

Task numbers 16a–16d keep Tasks 17–25 numbered as
before.

How the rule is built (decided here, the spec leaving
the mechanics open):

- The two pure decisions — "is this step mine" and
  "which row opens next" — live in
  `web-app/app/workbox-next.ts`, Layer 1 tested.
- The box judges the head `postWorkOrderTransition`
  answers. Mine: it re-reads in place, as before. Not
  mine: it shows its skeleton, marks itself moving on (no
  bell read and no read already in flight may paint the
  old work order), and tells the page `sentOn(id)`.
- The page records the id and runs its own lists read.
  Only the read that paints — the newest, under
  `listsSequence` — picks the next row, from the very
  sections it just drew (`inboxSectionsOf` over the same
  lists, under the same pill and search), then opens it
  or closes the box. A failed read closes the box: it has
  no row to open. Any open or close the person makes
  first cancels the move.
- Focus: the pressed button is about to be repainted
  away, so the box (`section#work-order-box`, now
  `tabindex="-1"`) takes focus without scrolling; its
  repaints replace its content, not itself.
- A work order the box opens starts at its top: `#show`
  resets the box's own scroll, so the next work order's
  header is not left scrolled out of view.

### Task 16a: Scroll to a transition button before clicking it

Agent: coder. Commandment: the Office of Verification.
Risk: Test Weakening (no assertion changes; the click is
made the way a person makes it).

**Files:**
- Modify: `tests/browser/workbox-transition.test.ts`

- [ ] **Step 1: Edit.** In
  `tests/browser/workbox-transition.test.ts` replace

```ts
Deno.test(
    'the workbox shows the pills and the claimed list'
    + ' above the available list',
```

  with

```ts
// A transition button sits below the box's fold: scroll it
// into view, as a person would, then click it.
async function clickEdge(
    page: Page, edgeId: string,
): Promise<void> {
    const selector = `[data-edge-id="${edgeId}"]`;
    await page.evaluate(
        `document.querySelector(${JSON.stringify(selector)})`
        + `.scrollIntoView({ block: 'center' })`,
    );
    await page.click(selector);
}

Deno.test(
    'the workbox shows the pills and the claimed list'
    + ' above the available list',
```

  and replace

```ts
            await page.click(`[data-edge-id="${SUBMIT_EDGE_ID}"]`);
```

  with

```ts
            await clickEdge(page, SUBMIT_EDGE_ID);
```

- [ ] **Step 2: Check.**
  `export DENO_DIR="$TMPDIR/deno-dir" && ./test validate --syntax`
  and `./test lint` — PASS.

- [ ] **Step 3: MASTER RUNS: `./test browser`.** Expected:
  'fill and submit keeps the box on the work order
  (WB11)' now PASSES against today's box (the master
  measured the same sequence by hand: POST 200, the
  toast, the box at Review). Everything else as at
  Segment 3's gate. The coder skips this step.

- [ ] **Step 4: Commit** `Scroll to the submit button before clicking it`.

### Task 16b: Decide where the box goes after a transition

Agent: coder. Commandments: Logic, Clarity, Simplicity.
Risks: Premature Generalization (two functions, no
options), Internal Defense (an unplaced head is a real
case — the inbox already draws one — not a guard),
Default Values.

**Files:**
- Create: `web-app/app/workbox-next.ts`
- Test: `tests/workbox-next.test.ts` (create)

**Interfaces produced:**

```ts
export function stepIsMine(
    workOrder: Pick<WorkOrder, 'flowGraph' | 'nodeId'>,
    memberId: Id,
): boolean;
export type NextWorkOrder =
    | { readonly kind: 'open'; readonly id: string }
    | { readonly kind: 'close' };
export function nextWorkOrder(
    sections: readonly InboxSection[],
    sentOn: string,
): NextWorkOrder;
```

- [ ] **Step 1: Write the failing test.** Create
  `tests/workbox-next.test.ts`:

```ts
import { assertEquals, assertStrictEquals } from '@std/assert';
import {
    nextWorkOrder,
    stepIsMine,
} from '../web-app/app/workbox-next.ts';
import {
    inboxSectionsOf,
    type InboxItem,
    type InboxLists,
    type InboxSection,
} from '../web-app/app/presenters/workbox-inbox.ts';
import { NO_PILL } from
    '../web-app/app/presenters/workbox-pills.ts';
import {
    DEFAULT_LOCK_TIMEOUT,
    type GraphNode,
    type WorkOrderFlowGraph,
} from '../shared/types.ts';

const ME = 'XXZruirZyAOoRpNxaDnpSA';
const OTHER = 'MQFcPtrZPIGjMCRAXtZUnA';

function node(
    id: string,
    overrides: Partial<GraphNode>,
): GraphNode {
    return {
        id,
        name: id,
        positionX: 0,
        positionY: 0,
        isCreate: false,
        isArchive: false,
        memberIds: [],
        attributes: [],
        taskInstructions: '',
        ...overrides,
    };
}

const GRAPH: WorkOrderFlowGraph = {
    name: 'Onboarding',
    lockTimeout: DEFAULT_LOCK_TIMEOUT,
    nodes: [
        node('mine', { memberIds: [OTHER, ME] }),
        node('theirs', { memberIds: [OTHER] }),
        node('done', { isArchive: true, memberIds: [ME] }),
    ],
    edges: [],
};

function at(nodeId: string) {
    return { flowGraph: GRAPH, nodeId };
}

function placed(id: string, flowName: string): InboxItem {
    return {
        kind: 'placed',
        id,
        flowName,
        stateName: 'Review',
        transitionerName: null,
        claimedByName: null,
        lastTransitionedAt: '2026-04-01T12:00:00.000000Z',
        completed: false,
        position: 0,
        taskInstructions: '',
    };
}

function unplaced(id: string): InboxItem {
    return {
        kind: 'unplaced',
        id,
        flowName: 'Onboarding',
        transitionerName: null,
        claimedByName: null,
        lastTransitionedAt: '2026-04-01T12:00:00.000000Z',
        position: 0,
    };
}

function drawn(
    claimed: InboxItem[],
    available: InboxItem[],
): InboxSection[] {
    return [
        { kind: 'claimed', items: claimed },
        { kind: 'available', items: available },
    ];
}

const LISTS: InboxLists = {
    claimed: [
        placed('c-1', 'Billing'),
        placed('c-2', 'Onboarding'),
    ],
    available: [
        placed('a-1', 'Billing'),
        placed('a-2', 'Onboarding'),
    ],
    archivedByMe: [placed('r-1', 'Onboarding')],
};

Deno.test('a step whose roster lists me is mine', () => {
    assertStrictEquals(stepIsMine(at('mine'), ME), true);
});

Deno.test('a step whose roster leaves me out is not mine', () => {
    assertStrictEquals(stepIsMine(at('theirs'), ME), false);
});

Deno.test('an archive node is never mine', () => {
    assertStrictEquals(stepIsMine(at('done'), ME), false);
});

Deno.test('a node the graph no longer holds is not mine', () => {
    assertStrictEquals(stepIsMine(at('gone'), ME), false);
});

Deno.test('the topmost claimed row opens next', () => {
    assertEquals(
        nextWorkOrder(inboxSectionsOf(LISTS, NO_PILL), 'sent'),
        { kind: 'open', id: 'c-1' },
    );
});

Deno.test(
    'with no claimed row the topmost available opens',
    () => {
        assertEquals(
            nextWorkOrder(
                drawn([], [placed('a-1', 'Billing')]), 'sent',
            ),
            { kind: 'open', id: 'a-1' },
        );
    },
);

Deno.test('the work order sent on never opens', () => {
    assertEquals(
        nextWorkOrder(
            drawn(
                [placed('sent', 'Billing')],
                [placed('a-1', 'Billing')],
            ),
            'sent',
        ),
        { kind: 'open', id: 'a-1' },
    );
    assertEquals(
        nextWorkOrder(drawn([], [placed('sent', 'Billing')]), 'sent'),
        { kind: 'close' },
    );
});

Deno.test('a row that cannot be opened is passed over', () => {
    assertEquals(
        nextWorkOrder(
            drawn([unplaced('u-1'), placed('c-2', 'Billing')], []),
            'sent',
        ),
        { kind: 'open', id: 'c-2' },
    );
});

Deno.test('with no row to open the box closes', () => {
    assertEquals(
        nextWorkOrder(drawn([], []), 'sent'),
        { kind: 'close' },
    );
});

Deno.test('under a flow pill its flow\'s first row opens', () => {
    assertEquals(
        nextWorkOrder(
            inboxSectionsOf(LISTS, {
                kind: 'flow', flowName: 'Onboarding',
            }),
            'sent',
        ),
        { kind: 'open', id: 'c-2' },
    );
});

Deno.test(
    'under Claimed by Me there is no available row to fall'
    + ' back to',
    () => {
        const lists: InboxLists = {
            claimed: [],
            available: [placed('a-1', 'Billing')],
            archivedByMe: [],
        };
        assertEquals(
            nextWorkOrder(
                inboxSectionsOf(lists, { kind: 'claimed' }),
                'sent',
            ),
            { kind: 'close' },
        );
    },
);

Deno.test(
    'under Archived by Me neither list is drawn, so the box'
    + ' closes',
    () => {
        assertEquals(
            nextWorkOrder(
                inboxSectionsOf(LISTS, { kind: 'archivedByMe' }),
                'sent',
            ),
            { kind: 'close' },
        );
    },
);
```

- [ ] **Step 2: Run** ONE-FILE with
  `tests/workbox-next.test.ts`. Expected: FAIL,
  `Module not found` for `workbox-next.ts`.

- [ ] **Step 3: Implement.** Create
  `web-app/app/workbox-next.ts`:

```ts
import type { WorkOrder } from '../../client/index.ts';
import type { Id } from '../../shared/types.ts';
import type { InboxSection } from
    './presenters/workbox-inbox.ts';

// Where the work order box goes after a transition. The
// roster decides only this; the lists still show the
// organization's whole pool (TODO.md item 11a).

// The node the work order now sits at is a step I can do:
// not an archive node, and its roster names me. A head
// whose node its graph no longer holds is no one's step.
export function stepIsMine(
    workOrder: Pick<WorkOrder, 'flowGraph' | 'nodeId'>,
    memberId: Id,
): boolean {
    const node = workOrder.flowGraph.nodes.find(
        (n) => n.id === workOrder.nodeId,
    );
    return node !== undefined
        && !node.isArchive
        && node.memberIds.includes(memberId);
}

export type NextWorkOrder =
    | { readonly kind: 'open'; readonly id: string }
    | { readonly kind: 'close' };

// The topmost row that can be opened, as the left box
// draws its lists: the claimed list's first, else the
// available list's first, never the work order just sent
// on. An unplaced row cannot be opened. Under Archived by
// Me neither list is drawn, so the box closes.
export function nextWorkOrder(
    sections: readonly InboxSection[],
    sentOn: string,
): NextWorkOrder {
    for (const kind of ['claimed', 'available'] as const) {
        const next = sections
            .find((section) => section.kind === kind)
            ?.items.find(
                (item) => item.kind === 'placed'
                    && item.id !== sentOn,
            );
        if (next !== undefined) {
            return { kind: 'open', id: next.id };
        }
    }
    return { kind: 'close' };
}
```

- [ ] **Step 4: Run** ONE-FILE with
  `tests/workbox-next.test.ts` — PASS (12 tests).
  `./test validate --syntax`, `./test`, `./test lint` —
  PASS.

- [ ] **Step 5: Commit** `Decide where the box goes after a transition`.

### Task 16c: Layer 2 — the box after a transition

Agent: coder. Commandments: the Office of Verification,
Reliability. Risk: Test Weakening.

The spec changes what 'fill and submit keeps the box on
the work order (WB11)' pins: Review does not list the
admin (Tony Stark), so the box no longer stays. It is
restated as 'fill and submit moves the box to my next
work (WB11)' — with no claim left, the topmost
available row opens, never the one just sent on. Four
tests join it, one per clause of the spec's two new
Verification bullets. Every edge click scrolls first
(`clickEdge`, Task 16a).

Seed facts (verified in `api/mock-data/flows.ts`,
`records.ts`, `members.ts`): the admin is Tony Stark,
`XXZruirZyAOoRpNxaDnpSA`. Customer Onboarding's Data
Capture (`KWpWgeKhKyoyBDEymUgcmg`) lists Marcus and
Tony; Review (`xmghdGZDgLKilxByetrBoA`) lists Sarah and
Emily; Archive lists nobody. Edges: submit
`JZJrLAteZStrqAvzZiamtA` (Data Capture → Review),
"needs revision" `DYcnMktqUpTdZuEBnLBppw` (Review → Data
Capture). Review requires Reviewer Notes
(`ElVKgkCreTEHQXJZPBJDKw`, text). The API does not gate a
transition on the roster, so Tony may claim and send
back a Review work order.

**Files:**
- Modify (whole file below):
  `tests/browser/workbox-transition.test.ts`

- [ ] **Step 1: Replace the whole file with:**

```ts
import { assert, assertStrictEquals } from '@std/assert';
import {
    getRecordInstance,
    getWorkOrders,
    postWorkOrderTransition,
    putWorkOrderClaim,
    type RequestContext,
    type WorkOrder,
} from '../../client/index.ts';
import { createWorkOrderFromFlow } from
    '../../web-app/app/work-order-creation.ts';
import { generateIdentifier } from
    '../../shared/identifier.ts';
import { inPageContext } from '../in-page-facade.ts';
import {
    adminToken,
    useBrowser,
    withAdminPage,
    type Origin,
    type Page,
} from './fixtures.ts';
import { registryUrl } from
    '../../web-app/app/browser-drive.ts';

const browser = useBrowser();
const ONBOARDING_FLOW_ID =
    'esKujtyQFYUJaVSXWwavzA';
// Data Capture → Review: Review does not list the admin.
const SUBMIT_EDGE_ID =
    'JZJrLAteZStrqAvzZiamtA';
// Review → Data Capture: Data Capture lists the admin.
const REVISION_EDGE_ID =
    'DYcnMktqUpTdZuEBnLBppw';
const COMPANY_NAME_ID =
    'CPJmMPXRaBIiNdGBofUPVg';
const CONTACT_EMAIL_ID =
    'oeqelDVElwxHYWkWRVTCYw';
const REVIEWER_NOTES_ID =
    'ElVKgkCreTEHQXJZPBJDKw';
// A seeded Customer Onboarding work order at Data Capture,
// available to the admin, its last move long past.
const DATA_CAPTURE = 'gButmqAicxcpsNuiTYQNKA';
const EMPTY_BOX = 'Select a work order to open it here';

async function adminContext(
    origin: Origin,
): Promise<RequestContext> {
    return inPageContext(origin.db, await adminToken());
}

async function workOrderOf(
    ctx: RequestContext,
    workOrderId: string,
): Promise<WorkOrder> {
    const found = (await getWorkOrders(ctx)).find(
        (wo) => wo.id === workOrderId,
    );
    assert(found !== undefined, workOrderId);
    return found;
}

// Through the API: a fresh Customer Onboarding work order,
// filled at Data Capture and submitted to Review, where the
// admin is not on the roster; the move released the
// admin's birth claim.
async function submittedToReview(
    ctx: RequestContext,
): Promise<string> {
    const workOrderId = generateIdentifier();
    await createWorkOrderFromFlow(ctx, {
        workOrderId,
        flowLinkId: generateIdentifier(),
        flowId: ONBOARDING_FLOW_ID,
    });
    const created = await workOrderOf(ctx, workOrderId);
    assert(
        created.instanceId !== undefined
        && created.recordTypeId !== undefined,
    );
    const instance = await getRecordInstance(
        ctx, created.recordTypeId, created.instanceId,
    );
    await postWorkOrderTransition(ctx, {
        workOrder: created,
        edgeId: SUBMIT_EDGE_ID,
        values: {
            [COMPANY_NAME_ID]: 'Acme Corp',
            [CONTACT_EMAIL_ID]: 'ops@acme.example',
        },
        instance: instance.message,
    });
    return workOrderId;
}

function addressId(page: Page): Promise<string | null> {
    return page.evaluate<string | null>(
        `new URLSearchParams(location.search).get('id')`,
    );
}

function boxHolds(id: string): string {
    return `document.querySelector(`
        + `'#work-order-box #work-order-header .badge-neutral')`
        + `?.textContent.includes(${JSON.stringify(id)})`
        + ` === true`;
}

const BOX_EMPTY = `document.getElementById('work-order-box')`
    + `.textContent.includes(${JSON.stringify(EMPTY_BOX)})`;

async function untilToast(
    page: Page, text: string,
): Promise<void> {
    await page.until(
        `[...document.querySelectorAll('.toast')]`
        + `.some(t => t.textContent.includes(`
        + `${JSON.stringify(text)}))`,
        text + ' toast',
    );
}

// Creates through the page: the new work order opens in
// the box, its id in the address, without a navigation.
async function createOnboardingWorkOrder(
    page: Page, baseUrl: string,
): Promise<string> {
    await page.navigate(registryUrl(baseUrl, 'workbox'));
    await page.ready('workbox');
    await page.click('#create-work-order-btn');
    const readyItem =
        `[data-flow-id="${ONBOARDING_FLOW_ID}"]`;
    await page.until(
        `document.querySelector(${
            JSON.stringify(readyItem)
        })?.checkVisibility() === true`,
        'READY Customer Onboarding',
    );
    await page.click(readyItem);
    const id = await page.until<string>(
        `new URLSearchParams(location.search).get('id')`,
        'the new work order in the address',
    );
    await page.until(boxHolds(id), 'the new work order in the box');
    assert(await page.evaluate<boolean>(
        `location.pathname.endsWith('/workbox/index.html')`,
    ));
    return id;
}

async function fillRequired(
    page: Page,
): Promise<void> {
    const company =
        `#wo-attr-${COMPANY_NAME_ID}`;
    const email =
        `#wo-attr-${CONTACT_EMAIL_ID}`;
    await page.until(
        `document.querySelector(${
            JSON.stringify(company)
        })?.disabled === false`,
        'Company Name enabled',
    );
    await page.evaluate(
        `document.querySelector(${
            JSON.stringify(company)
        }).value = 'Acme Corp';`
        + `document.querySelector(${
            JSON.stringify(email)
        }).value = 'ops@acme.example';`,
    );
}

// A transition button sits below the box's fold: scroll it
// into view, as a person would, then click it.
async function clickEdge(
    page: Page, edgeId: string,
): Promise<void> {
    const selector = `[data-edge-id="${edgeId}"]`;
    await page.evaluate(
        `document.querySelector(${JSON.stringify(selector)})`
        + `.scrollIntoView({ block: 'center' })`,
    );
    await page.click(selector);
}

// Fills Data Capture and submits it to Review, which does
// not list the admin.
async function submitToReview(page: Page): Promise<void> {
    await fillRequired(page);
    await clickEdge(page, SUBMIT_EDGE_ID);
    await untilToast(page, 'Transition complete');
}

Deno.test(
    'the workbox shows the pills and the claimed list'
    + ' above the available list',
    async () => {
        await withAdminPage(browser.get(), async (page, origin) => {
            await page.navigate(
                registryUrl(origin.baseUrl, 'workbox'),
            );
            await page.ready('workbox');
            assert(await page.until<boolean>(
                `(() => {
                    const claimed = document
                        .getElementById('claimed-list');
                    const available = document
                        .getElementById('available-list');
                    return claimed !== null
                        && available !== null
                        && (claimed.compareDocumentPosition(
                            available)
                            & Node.DOCUMENT_POSITION_FOLLOWING)
                            !== 0;
                })()`,
                'claimed above available',
            ));
            assert(await page.until<boolean>(
                `document.querySelector('#workbox-pills')`
                + `?.getAttribute('aria-label')`
                + ` === 'Filter work orders'`
                + ` && document.querySelector(`
                + `'[data-workbox-pill="claimed"]') !== null`
                + ` && document.querySelector(`
                + `'[data-workbox-pill="archivedByMe"]')`
                + ` !== null`,
                'the pills',
            ));
            assert(await page.evaluate<boolean>(BOX_EMPTY));
            const sub = await page.evaluate<string>(
                `document.querySelector('.page-header p')`
                + `?.textContent ?? ''`,
            );
            assertStrictEquals(sub, '');
            assert(await page.evaluate<boolean>(
                `document.querySelector('[data-inbox-pill]')`
                + ` === null`
                + ` && document.getElementById(`
                + `'workbox-tabs') === null`,
            ));
        });
    },
);

Deno.test(
    'fill and submit moves the box to my next work (WB11)',
    async () => {
        await withAdminPage(browser.get(), async (page, origin) => {
            // The live create binds and birth-claims, and
            // the admin holds no other claim.
            const id = await createOnboardingWorkOrder(
                page, origin.baseUrl,
            );
            await submitToReview(page);
            // The move released the claim: once the lists
            // have refreshed the row is available again.
            await page.waitFor(
                `#available-list [data-work-order-card="${id}"]`,
            );
            assertStrictEquals(
                await page.evaluate<number>(
                    `document.querySelectorAll(`
                    + `'#claimed-list [data-work-order-card]')`
                    + `.length`,
                ),
                0,
            );
            const next = await page.evaluate<string | undefined>(
                `[...document.querySelectorAll(`
                + `'#available-list [data-work-order-card]')]`
                + `.map(c => c.getAttribute(`
                + `'data-work-order-card'))`
                + `.find(each => each !== ${JSON.stringify(id)})`,
            );
            assert(next !== undefined && next !== id);
            await page.until(boxHolds(next), 'the next work order');
            assertStrictEquals(await addressId(page), next);
            assert(await page.evaluate<boolean>(
                `location.pathname`
                + `.endsWith('/workbox/index.html')`,
            ));
            assert(await page.evaluate<boolean>(
                `![...document.querySelectorAll('.toast')]`
                + `.some(t => t.textContent.includes(`
                + `'refresh failed'))`,
            ));
        });
    },
);

Deno.test(
    'a transition to a step that lists me keeps the box on'
    + ' the work order',
    async () => {
        await withAdminPage(browser.get(), async (page, origin) => {
            const ctx = await adminContext(origin);
            const id = await submittedToReview(ctx);
            await putWorkOrderClaim(ctx, await workOrderOf(ctx, id));
            await page.navigate(registryUrl(
                origin.baseUrl, 'workbox', 'id=' + id,
            ));
            await page.ready('workbox');
            await page.until(boxHolds(id), 'the box holds ' + id);
            const notes = `#wo-attr-${REVIEWER_NOTES_ID}`;
            await page.until(
                `document.querySelector(${
                    JSON.stringify(notes)
                })?.disabled === false`,
                'Reviewer Notes enabled',
            );
            await page.evaluate(
                `document.querySelector(${
                    JSON.stringify(notes)
                }).value = 'Needs a purchase order';`,
            );
            await clickEdge(page, REVISION_EDGE_ID);
            await untilToast(page, 'Transition complete');
            assert(await page.until<boolean>(
                `document.querySelector(`
                + `'#work-order-header .badge-info')`
                + `?.textContent.trim() === 'Data Capture'`,
                'the box at Data Capture',
            ));
            // The move released the claim: the claim place
            // offers Claim again.
            assert(await page.until<boolean>(
                `document.getElementById(`
                + `'work-order-claim-switch')`
                + `?.getAttribute('aria-checked') === 'false'`
                + ` && document.getElementById(`
                + `'work-order-claim').textContent.trim()`
                + ` === 'Claim'`,
                'the switch off, labelled Claim',
            ));
            assert(await page.evaluate<boolean>(boxHolds(id)));
            assertStrictEquals(await addressId(page), id);
        });
    },
);

Deno.test(
    'a transition to a step that is not mine opens my'
    + ' topmost claimed work order',
    async () => {
        await withAdminPage(browser.get(), async (page, origin) => {
            const ctx = await adminContext(origin);
            // An older claim than the one about to be made.
            await putWorkOrderClaim(
                ctx, await workOrderOf(ctx, DATA_CAPTURE),
            );
            const id = await createOnboardingWorkOrder(
                page, origin.baseUrl,
            );
            await submitToReview(page);
            await page.until(
                boxHolds(DATA_CAPTURE), 'the claimed work order',
            );
            assertStrictEquals(
                await addressId(page), DATA_CAPTURE,
            );
            await page.waitFor(
                `#available-list [data-work-order-card="${id}"]`,
            );
        });
    },
);

Deno.test(
    'with only the claimed list drawn and none left the box'
    + ' closes',
    async () => {
        await withAdminPage(browser.get(), async (page, origin) => {
            await createOnboardingWorkOrder(page, origin.baseUrl);
            await page.click('[data-workbox-pill="claimed"]');
            await page.until(
                `document.querySelector(`
                + `'[data-workbox-pill="claimed"]')`
                + `?.getAttribute('aria-pressed') === 'true'`,
                'Claimed by Me pressed',
            );
            await submitToReview(page);
            assert(await page.until<boolean>(
                BOX_EMPTY, 'the box closed',
            ));
            assertStrictEquals(await addressId(page), null);
            // Rows were available, but Claimed by Me draws
            // no available list to fall back to.
            assert(await page.evaluate<boolean>(
                `document.getElementById('available-list')`
                + ` === null`,
            ));
        });
    },
);

Deno.test(
    'the box never reopens the work order it sent on',
    async () => {
        await withAdminPage(browser.get(), async (page, origin) => {
            const id = await createOnboardingWorkOrder(
                page, origin.baseUrl,
            );
            // Searching for its id draws this work order
            // alone, so after the move it is the only row.
            await page.evaluate(`(() => {
                const box = document.getElementById(
                    'workbox-search');
                box.value = ${JSON.stringify(id)};
                box.dispatchEvent(
                    new Event('input', { bubbles: true }));
            })()`);
            await page.until(
                `document.querySelectorAll(`
                + `'#work-order-lists [data-work-order-card]')`
                + `.length === 1 && document.querySelector(`
                + `'#claimed-list [data-work-order-card=`
                + `"${id}"]') !== null`,
                'the search draws this work order alone',
            );
            await submitToReview(page);
            await page.waitFor(
                `#available-list [data-work-order-card="${id}"]`,
            );
            assert(await page.until<boolean>(
                BOX_EMPTY, 'the box closed',
            ));
            assertStrictEquals(await addressId(page), null);
        });
    },
);

Deno.test(
    'the box has no bind, release, or back chrome',
    async () => {
        await withAdminPage(browser.get(), async (page, origin) => {
            await createOnboardingWorkOrder(
                page, origin.baseUrl,
            );
            assert(await page.evaluate<boolean>(
                `document.querySelector(`
                + `'[data-dialog-open="bind-instance"]')`
                + ` === null`
                + ` && document.getElementById(`
                + `'unclaim-btn') === null`
                + ` && document.getElementById(`
                + `'work-order-back-btn') === null`,
            ));
        });
    },
);
```

- [ ] **Step 2: Type-check.** `./test validate --syntax`
  and `./test lint` — PASS.

- [ ] **Step 3: MASTER RUNS: `./test browser`.** Expected
  against today's box (it always stays): 'fill and submit
  moves the box to my next work (WB11)' FAILS at 'the
  next work order' (the box still holds the one sent on);
  'a transition to a step that is not mine opens my
  topmost claimed work order', 'with only the claimed list
  drawn and none left the box closes', and 'the box never
  reopens the work order it sent on' FAIL (the box stays);
  'a transition to a step that lists me keeps the box on
  the work order', the shell test, and the chrome test
  PASS. The coder skips this step.

- [ ] **Step 4: Commit** `Pin the box's move after a transition`.

### Task 16d: Move the box on after a transition

Agent: planner. Commandments: Reliability (the lists
refresh before the next row is chosen; no stale read of
the old work order paints), Clarity, the Office of the
Interface (focus). Risks: the Greedy Catch (the
transition's `try` still wraps the write alone), Default
Values, Shared Mutable State (the page holds one
`sentOnId`, cleared by any open or close).

**Files:**
- Modify: `web-app/workbox/work-order-box.ts`,
  `web-app/workbox/index.ts`, `web-app/workbox/index.html`

**Interfaces changed:** `WorkOrderBoxEvents` gains
`readonly sentOn: (id: string) => void`.

The behaviour is pinned by Task 16c's Layer 2 tests and
Task 16b's Layer 1 tests; this task has no new Layer 1
test (the wiring needs a DOM).

- [ ] **Step 1: The box.** In
  `web-app/workbox/work-order-box.ts`:

  (a) replace

```ts
import { sessionContext } from '../app/client.ts';
```

  with

```ts
import { sessionContext } from '../app/client.ts';
import { stepIsMine } from '../app/workbox-next.ts';
```

  (b) replace

```ts
    // A claim or release was refused.
    readonly claimRefused: () => void;
}
```

  with

```ts
    // A claim or release was refused.
    readonly claimRefused: () => void;
    // A transition sent the work order on to a step that
    // is not mine: the page picks the next one.
    readonly sentOn: (id: string) => void;
}
```

  (c) replace

```ts
    // The box's own write: the bell it rings repaints
    // nothing here, since the write's answer does.
    #writeInFlight = false;
```

  with

```ts
    // The box's own write: the bell it rings repaints
    // nothing here, since the write's answer does.
    #writeInFlight = false;
    // Sent on and waiting for the page to pick the next
    // work order: no read of the old one may paint.
    #movingOn = false;
```

  (d) replace

```ts
    // Opening never claims. The row already open opens
    // nothing new, so a stray click keeps typed values.
    open(id: string): void {
        if (id === this.#openId) {
            return;
        }
        this.#openId = id;
```

  with

```ts
    // Opening never claims. The row already open opens
    // nothing new, so a stray click keeps typed values —
    // unless the box is waiting to move on from it.
    open(id: string): void {
        if (id === this.#openId && !this.#movingOn) {
            return;
        }
        this.#movingOn = false;
        this.#openId = id;
```

  (e) replace

```ts
    close(): void {
        this.#sequence += 1;
        this.#openId = null;
```

  with

```ts
    close(): void {
        this.#sequence += 1;
        this.#movingOn = false;
        this.#openId = null;
```

  (f) replace

```ts
        if (this.#openId === null || this.#writeInFlight) {
            return;
        }
```

  with

```ts
        if (
            this.#openId === null
            || this.#writeInFlight
            || this.#movingOn
        ) {
            return;
        }
```

  (g) replace

```ts
        const sequence = this.#sequence;
        setHtml(this.#el, buildWorkOrderBoxLoading());
        let read: WorkOrderRead;
        try {
            read = await readWorkOrder(sessionContext(), id);
```

  with

```ts
        const sequence = this.#sequence;
        setHtml(this.#el, buildWorkOrderBoxLoading());
        // A work order opens at its top, wherever the box's
        // own scroll left the last one.
        this.#el.scrollTop = 0;
        let read: WorkOrderRead;
        try {
            read = await readWorkOrder(sessionContext(), id);
```

  (h) replace

```ts
    // the write that latches the head and the instance the
    // form was filled from. After it lands the box stays
    // and reads the new head; the bell refreshes the lists.
```

  with

```ts
    // the write that latches the head and the instance the
    // form was filled from. After it lands the bell
    // refreshes the lists, and the box stays on a step
    // that is mine or moves on (spec "After a transition").
```

  (i) replace

```ts
        const ctx = sessionContext();
        this.#writeInFlight = true;
        try {
            await postWorkOrderTransition(ctx, {
```

  with

```ts
        const ctx = sessionContext();
        this.#writeInFlight = true;
        let moved: WorkOrder;
        try {
            moved = await postWorkOrderTransition(ctx, {
```

  (j) replace

```ts
        showToast('Transition complete', 'success');
        void this.#refresh(ctx, read.workOrder.id);
    }
```

  with

```ts
        showToast('Transition complete', 'success');
        // The button pressed is about to be repainted away:
        // focus moves to the box, which no repaint replaces.
        this.#el.focus({ preventScroll: true });
        if (stepIsMine(moved, this.#memberId)) {
            void this.#refresh(ctx, moved.id);
            return;
        }
        this.#moveOn(moved.id);
    }

    // Sent on to a step that is not mine: the box shows its
    // skeleton, and no read of the old work order may paint,
    // while the page refreshes its lists and picks the next.
    #moveOn(id: string): void {
        this.#sequence += 1;
        this.#read = null;
        this.#movingOn = true;
        setHtml(this.#el, buildWorkOrderBoxLoading());
        this.#events.sentOn(id);
    }
```

- [ ] **Step 2: The page.** In `web-app/workbox/index.ts`:

  (a) replace

```ts
import { WorkOrderBox } from './work-order-box.ts';
```

  with

```ts
import { nextWorkOrder } from '../app/workbox-next.ts';
import { WorkOrderBox } from './work-order-box.ts';
```

  (b) replace

```ts
let workOrderBox: WorkOrderBox | null = null;
let searchBound = false;
```

  with

```ts
let workOrderBox: WorkOrderBox | null = null;
// The work order a transition sent on to a step that is
// not mine: the next lists read that paints opens the one
// after it. Any open or close clears it.
let sentOnId: string | null = null;
let searchBound = false;
```

  (c) replace

```ts
            claimRefused: () => {
                void refreshInboxLists(searchEl, els, ctx);
            },
        }, signal);
```

  with

```ts
            claimRefused: () => {
                void refreshInboxLists(searchEl, els, ctx);
            },
            sentOn: (id) => {
                sentOnId = id;
                void refreshInboxLists(searchEl, els, ctx);
            },
        }, signal);
```

  (d) replace

```ts
        log.error('inbox read failed', 'workbox', err);
        inboxView = { kind: 'failed' };
        paintListsError(els.lists, err, retry);
        return;
    }
    if (sequence !== listsSequence) return;
    inboxView = { kind: 'all' };
    paintInbox(els);
}
```

  with

```ts
        log.error('inbox read failed', 'workbox', err);
        inboxView = { kind: 'failed' };
        paintListsError(els.lists, err, retry);
        closeAfterSendOn();
        return;
    }
    if (sequence !== listsSequence) return;
    inboxView = { kind: 'all' };
    paintInbox(els);
    openAfterSendOn();
}
```

  (e) replace

```ts
        log.error('inbox search failed', 'workbox', err);
        inboxView = { kind: 'failed' };
        paintListsError(els.lists, err, retry);
        return;
    }
    if (sequence !== listsSequence) return;
    inboxView = { kind: 'matched', text, rows };
    paintInbox(els);
}
```

  with

```ts
        log.error('inbox search failed', 'workbox', err);
        inboxView = { kind: 'failed' };
        paintListsError(els.lists, err, retry);
        closeAfterSendOn();
        return;
    }
    if (sequence !== listsSequence) return;
    inboxView = { kind: 'matched', text, rows };
    paintInbox(els);
    openAfterSendOn();
}
```

  (f) replace

```ts
    const lists = inboxView.kind === 'matched'
        ? matchedListsOf(inboxView.rows)
        : full;
```

  with

```ts
    const lists = listsOnHand(full);
```

  (g) replace

```ts
// A repaint replaces the pill buttons: the one that held
// focus hands it to the pill that takes its place.
```

  with

```ts
// The lists the rows on hand give before any pill narrows
// them: the full read's, or the search's answer.
function listsOnHand(full: InboxLists): InboxLists {
    return inboxView.kind === 'matched'
        ? matchedListsOf(inboxView.rows)
        : full;
}

// After a send-on, once the lists have refreshed and
// painted: the topmost row as just drawn opens, never the
// one sent on; with none, the box closes.
function openAfterSendOn(): void {
    if (sentOnId === null) return;
    const sent = sentOnId;
    sentOnId = null;
    const drawn = inboxSectionsOf(
        listsOnHand(listsFrom(requireInboxRows())), pressed,
    );
    const next = nextWorkOrder(drawn, sent);
    if (next.kind === 'open') {
        requireWorkOrderBox().open(next.id);
    } else {
        requireWorkOrderBox().close();
    }
}

// A refresh that failed has no row to open: the box closes.
function closeAfterSendOn(): void {
    if (sentOnId === null) return;
    sentOnId = null;
    requireWorkOrderBox().close();
}

// A repaint replaces the pill buttons: the one that held
// focus hands it to the pill that takes its place.
```

  (h) replace

```ts
    putAddress(workOrderAddress(getHref(), id));
    markOpenRow(els.lists, id);
```

  with

```ts
    // An open or close the person makes while the box
    // waits to move on is the move: nothing opens after it.
    sentOnId = null;
    putAddress(workOrderAddress(getHref(), id));
    markOpenRow(els.lists, id);
```

- [ ] **Step 3: The box takes focus.** In
  `web-app/workbox/index.html` replace

```html
            class="card p-4 min-w-0
                workbox-work-order"
            aria-label="Work order"
        >
```

  with

```html
            class="card p-4 min-w-0
                workbox-work-order"
            aria-label="Work order"
            tabindex="-1"
        >
```

- [ ] **Step 4: Run** `./test validate --syntax`, `./test`,
  `./test lint` — PASS.

- [ ] **Step 5: Commit** `Move the box on after a transition`.

### Segment 3b gate

```bash
export DENO_DIR="$TMPDIR/deno-dir" && ./test validate --syntax
export DENO_DIR="$TMPDIR/deno-dir" && ./test
export DENO_DIR="$TMPDIR/deno-dir" && ./test lint
```

All green.

**MASTER RUNS: `./test browser`.** Expected: ALL GREEN,
the seven tests of `workbox-transition.test.ts` included.
A red here is a defect in Segment 3b, fixed as a
`fixup!` of its task before Segment 4.

---

## Segment 4 — Documents

The documents come before the removals because
`./test lint` fails when TEST-PLAN.md cites a `tests/…`
path that does not exist: TEST-PLAN.md must stop citing
`tests/workbox-inbox-drag.test.ts` before Task 21 deletes
it. Every path the new text cites exists after Segment
3b (test *names* are not linted; the one renamed in Task 24,
'the work order box has no bind or unclaim chrome', is
cited ahead of its rename).

`.md` files are not line-linted; keep the files' own
wrap (about 56 columns in TEST-PLAN.md's cases).

### Task 17: TEST-PLAN.md — the workbox on one page

Agent: coder. Commandments: Clarity, the Office of
Verification. Risk: the request plus improvements
(only F2, its two driving notes, and the case range
change).

Conventions kept: case IDs are stable, so every
reference elsewhere (TODO.md's WB1–WB21 citations, the
driving notes, R13's "(WB10b)") still resolves. A case
whose behaviour changed is restated under its own ID;
new behaviour takes new IDs WB24–WB30, placed in the
section they belong to (the file already orders IDs by
section, not by number: WB16 follows WB11; WB30 follows
WB11). No case is
retired: each drag or detail-page case is restated
against the switch or the box. The section "Action Screen
(`workbox/detail.html`)" becomes "Work Order Box".

**Files:**
- Modify: `TEST-PLAN.md`

- [ ] **Step 1: The WB11/WB16 driving note.** Replace
  this exact block (Driving notes, near line 304):

```markdown
- WB11/WB16: one explorer's turn. Arm the network
  read on the action-screen document before `submit`
  navigates, by either (a) CDP `Network` enabled on
  that target before the click, or (b) a `pagehide`
  listener installed on that document before the
  click that copies
  `performance.getEntriesByType('resource')` into
  `sessionStorage`, read back on the inbox. Arming
  (a) records only requests issued after it is
  enabled. Arming (b) holds the whole document
  buffer, so it may be installed after fill; it
  witnesses URL and status only, and the Layer 1
  pins decide the body and `If-Match`. A
  `getEntries()` call made on the inbox document is
  not the read, and `js()` fetch of the API is not a
  read: the bearer is memory-only. A successor who
  finds the inbox already loaded does not call
  `getEntries()` there. They witness the pair once,
  in this order: a claimed-by-me action screen
  (a live create birth-claims and binds, or drag onto
  claimed-by-me first), fill, arm the read, click
  `submit`, and snapshot before the inbox document
  commits (with arming (a), enabled before
  `submit`). One attempt. Append WB16's line after
  WB15's, out of document order, holding the
  witnessed read until then; a resume at the first
  ID after the last scored line must not skip WB12
  through WB15. A transition POST missing because
  navigation dropped an unarmed buffer is BLOCKED,
  not FAIL. The Layer 1 pins decide the
  instance-shape body and If-Match. The live
  network-log read is the exploratory half.
```

  with:

```markdown
- WB11/WB16: one explorer's turn. The transition no
  longer navigates: the page stays on the workbox
  document, so arm the network read on it by either
  (a) CDP `Network` enabled on that target before
  `submit`, or (b)
  `performance.getEntriesByType('resource')` read on
  the same document after the "Transition complete"
  toast. Arming (a) records only requests issued
  after it is enabled. Reading (b) sees the whole
  document buffer; it witnesses URL and status only,
  and the Layer 1 pins decide the body and
  `If-Match`. `js()` fetch of the API is not a read:
  the bearer is memory-only. Witness the pair once,
  in this order: a claimed-by-me work order open in
  the box (a live create birth-claims, binds, and
  opens it there; or turn the claim switch on first),
  fill, arm the read, click `submit`. One attempt.
  Append WB16's line after WB15's, out of document
  order, holding the witnessed read until then; a
  resume at the first ID after the last scored line
  must not skip WB12 through WB15. The Layer 1 pins
  decide the instance-shape body and If-Match. The
  live network-log read is the exploratory half.
```

- [ ] **Step 2: The WB11 driving note.** Replace this
  exact block (near line 406):

```markdown
- WB11: from a claimed-by-me action screen (a live
  create on Customer Onboarding birth-claims and
  binds a fresh instance; or drag onto claimed-by-me
  first), fill, submit. Opening inspects; bind is
  gone. Layer 2 pin
  tests/browser/workbox-transition.test.ts
  'fill and submit navigates to the inbox
  (WB11)' creates through the page, fills, and
  submits; it decides the inbox navigation. One
  attempt. WB16's read is armed before this
  `submit`, in the same turn (Driving notes,
  WB11/WB16).
```

  with:

```markdown
- WB11: from a claimed-by-me work order open in the
  box (a live create on Customer Onboarding
  birth-claims, binds a fresh instance, and opens it
  there; or turn the claim switch on first), fill,
  submit. Opening inspects; bind is gone. Layer 2 pin
  tests/browser/workbox-transition.test.ts
  'fill and submit moves the box to my next work
  (WB11)' creates through the page, fills, and
  submits; it decides the box opens the next work
  order, never this one. One attempt. WB16's read is
  armed before this `submit`, in the same turn
  (Driving notes, WB11/WB16).
```

- [ ] **Step 3: The case range.** Replace
  `chains — Workbox cases (WB1–WB23) and dashboard counts`
  with
  `chains — Workbox cases (WB1–WB30) and dashboard counts`.

- [ ] **Step 4: Section F2.** Save the block in Step 5,
  exactly, without its fence lines, to
  `$TMPDIR/f2-new.md` (Write tool). It replaces every line
  from `## F2. Workbox` through the last line of WB23's
  `Pin:` — the blank line, `---`, and blank line before
  `## FS. Flow Statistics` stay. Splice it in:

```bash
cd /Users/tmornini/code/fusion-angle/.worktrees/workbox-one-page
start=$(grep -n '^## F2\. Workbox$' TEST-PLAN.md | cut -d: -f1)
fs=$(grep -n '^## FS\. Flow Statistics$' TEST-PLAN.md | cut -d: -f1)
{ head -n "$((start - 1))" TEST-PLAN.md
  cat "$TMPDIR/f2-new.md"
  tail -n "+$((fs - 3))" TEST-PLAN.md
} > "$TMPDIR/test-plan.md"
mv "$TMPDIR/test-plan.md" TEST-PLAN.md
```

  Check the seams: `sed -n "$((start - 2)),$((start + 1))p" TEST-PLAN.md`
  shows `---`, a blank line, `## F2. Workbox`, a blank
  line; and the lines just above `## FS. Flow Statistics`
  are WB23's last `Pin:` line, a blank line, `---`, a
  blank line.

- [ ] **Step 5: The new section F2** (the block to save):

````markdown
## F2. Workbox

### Workbox Source Flow

- [ ] **AA-WB-SETUP** Verify Customer Onboarding is
  READY in Create Work Order — its Review node names
  Sarah Chen and Emily Rodriguez. Workbox's Create Work
  Order draws only on flows the mock seed already
  publishes; it does not depend on any AA or F case
  creating one live.
  Pin: tests/mock-flow-readiness.test.ts 'mock admin sees
       Customer Onboarding and Lead-to-Close' (decides
       Customer Onboarding is READY); exploratory — the
       live dropdown listing and the Review node's member
       names

### Workbox Inbox (`workbox/`)

- [ ] **WB1** Navigate to `workbox/`. PASS: the page
  shows the "Workbox" title, no subtitle, the "Search
  work orders..." box, and a "Create Work Order" button
  (plus icon + label; mobile short label "Create").
  Below the header a pill group labelled "Filter work
  orders" holds "Claimed by Me", "Archived by Me", a
  thin divider, then one pill per flow by name. The left
  box lists "Work Orders claimed by me" above "Work
  Orders available to me"; the right box reads "Work
  Order" and "Select a work order to open it here".
  There is no Active / Archived by Me segmented control.
  The user-facing word is the past participle Archived,
  never Archive.
  Pin: tests/presenter-workbox-inbox.test.ts 'workbox
       index.html holds the pills, the lists, and the
       box, no subtitle';
       tests/presenter-workbox-pills.test.ts 'the pills
       run Claimed by Me, Archived by Me, a divider, then
       flows by name';
       tests/presenter-workbox-detail.test.ts 'an
       unopened box says how to open a work order';
       tests/browser/workbox-transition.test.ts 'the
       workbox shows the pills and the claimed list above
       the available list'
- [ ] **WB2** With no work orders claimed by or
  available to the current member, the left box keeps
  both headings and says "No work orders claimed by me"
  and "No work orders available to me".
  Pin: tests/presenter-workbox-inbox.test.ts 'each list
       keeps its heading when empty';
       tests/presenter-workbox-inbox.test.ts 'available
       empty copy is No work orders available to me';
       tests/presenter-workbox-inbox.test.ts 'claimed
       empty copy is No work orders claimed by me'
- [ ] **WB3** Press "Archived by Me". PASS: it is pressed
  (`aria-pressed="true"`, primary) and every other pill
  is dimmed; the left box holds one list, "Work Orders
  archived by me", most recently archived first, in
  place of the other two. Press it again. PASS: both
  lists return and no pill is dimmed. The right box
  does not change.
  Pin: tests/presenter-workbox-inbox.test.ts 'Archived
       by Me draws one list in place of the two';
       tests/workbox-inbox.test.ts 'this member's archive
       transition is archived-by-me';
       tests/workbox-inbox.test.ts 'buildInboxItems still
       sorts' (decides newest first);
       tests/presenter-workbox-pills.test.ts 'a pressed
       pill is primary and dims the rest';
       tests/browser/former-member.test.ts 'workbox
       Archived by Me still loads after B28 (WB3)'
- [ ] **WB24 — Flow pills.** Read the flow pills. PASS:
  one per flow name among the work orders in the two
  lists, by name, each ending in `claimed/total` — of
  that flow's listed work orders, how many are claimed
  by me and how many there are; "Claimed by Me" and
  "Archived by Me" each end in one count. Each pill's
  accessible name says what its numbers mean
  ("Customer Onboarding: 2 claimed by me of 7", "5 work
  orders claimed by me"). Press Customer Onboarding.
  PASS: both lists narrow to that flow — the claimed
  list holds `claimed` rows and the two hold `total` —
  and an emptied list says "… in Customer Onboarding".
  Press it again. PASS: today's lists return.
  Pin: tests/presenter-workbox-pills.test.ts 'a flow
       pill counts claimed of total';
       tests/presenter-workbox-pills.test.ts 'each pill's
       name says what its numbers mean';
       tests/presenter-workbox-inbox.test.ts 'a flow pill
       narrows both lists to its flow';
       tests/presenter-workbox-inbox.test.ts 'an empty
       list under a flow pill names the flow';
       tests/browser/workbox-pills.test.ts 'pressing a
       flow pill narrows both lists and pressing it again
       restores them'
- [ ] **WB25 — Claimed by Me.** Press "Claimed by Me".
  PASS: the left box holds only "Work Orders claimed by
  me", as many rows as the pill counts.
  Pin: tests/presenter-workbox-inbox.test.ts 'Claimed by
       Me draws only the claimed list';
       tests/presenter-workbox-pills.test.ts 'the by-me
       pills count their lists'
- [ ] **WB26 — Pills under a search.** Type a term in the
  search box. PASS: every pill keeps its place; the
  counts follow the matches, a flow with none reading
  `0/0`; a pressed pill narrows the matches; an emptied
  list reads "No work orders match “<term>”". Clear the
  box. PASS: the counts return.
  Pin: tests/presenter-workbox-pills.test.ts 'a search's
       answer counts while the full read's flows keep
       their pills'; tests/presenter-workbox-inbox.test.ts
       'a search's empty line wins over the flow';
       exploratory — the live counts while typing

### Workbox — Create Work Order

- [ ] **WB4** Click "+ Create Work Order". PASS: a
  dropdown opens with up to two labeled sections — READY
  (clickable rows, one per publishable flow) includes at
  least Customer Onboarding and Lead-to-Close. It may
  hold more by now: E7, earlier in this walk,
  unconditionally creates a flow whose bare start+complete
  graph has zero non-exempt nodes, so
  `validateFlowForCreation` reports it `ready` with zero
  problems — a live third READY row — and F's own Flow
  Designer edits may add further flows still. NOT READY
  includes Fusion Angle Flow and Layout Test: Proposal
  Review Cycle — disabled rows for any flow with
  zero-member or dead-end nodes, each carrying a red
  no-entry icon and a subtitle "1 node needs attention"
  or "N nodes need attention". Their exact problem counts
  (16 and 15 in the untouched seed) may also have drifted:
  F's Flow Designer cases (F19, F32–F39) edit Layout
  Test's own graph earlier in this walk. Hover a NOT
  READY row. PASS: cursor stays default (no `pointer`),
  `aria-disabled="true"` is present, no `data-flow-id`
  attribute.
  Pin: tests/mock-flow-readiness.test.ts 'mock admin sees
       Customer Onboarding and Lead-to-Close' (decides the
       untouched seed's exact READY pair and NOT READY
       problem counts — a fact about the seed alone, not
       a live guarantee once E7 and F have run);
       exploratory — the live dropdown's exact contents
       by the time F2 is reached, the NOT-READY subtitle
       text and its node-count wording (the adapter test
       pins `problemCount`; whether the page glue's
       subtitle string reflects that exact number live is
       unverified by any test), `aria-disabled="true"`,
       the no-entry icon, and the hover cursor
- [ ] **WB4a** Click a `NOT READY` row. PASS: nothing
  happens — the dropdown stays open, no navigation occurs
  (the click handler ignores rows without
  `data-flow-id`).
  Pin: exploratory — the live no-op click; the handler's
       `data-flow-id` guard carries no CLI or browser
       test
- [ ] **WB5** Click Customer Onboarding from the READY
  section. PASS: the work order is created and opens in
  the right box at the first post-start state ("Data
  Capture") without leaving the page: the address gains
  `?id=<id>`, the label `Work order <id>` is in the box's
  header, and the claim switch is on, "Claimed by
  <you>" — a create birth-claims.
  Pin: tests/adapters-work-orders.test.ts
       'postWorkOrderCreation seeds work order, flow
       link, and three state events in one call' (decides
       creation lands the work order at the flow's
       post-start node, not the Create node itself);
       tests/browser/workbox-transition.test.ts 'fill and
       submit moves the box to my next work (WB11)'
       (creates through the page and finds the new work
       order in the box and the address); exploratory —
       the switch's live label
- [ ] **WB5a** Click the Data Capture → Review `submit`
  edge to select it, then click the Delete (trash)
  toolbar button — F28's own gesture. Reload Workbox and
  open Create Work Order. PASS: the subject sits in
  `NOT READY` with subtitle "1 node needs attention".
  Restore the edge the same way (or via Undo), reload.
  PASS: the subject returns to `READY`.
  Pin: tests/adapters-flow-publish.test.ts
       'validateFlowForCreation flags dead_end on a
       non-End node with zero outgoing edges' (decides
       the dead-end detection this edge removal
       exercises); exploratory — the live edge-select +
       delete gesture and the reload/dropdown re-check
- [ ] **WB5b — Server-side gate.** No manual browser
  verification is needed — the production IIFE bundle
  does not expose `postWorkOrderCreation` on the console,
  so a DevTools-driven check is not available against the
  deployed build. This case PASSES by virtue of automated
  coverage alone.
  Pin: tests/adapters-flow-publish.test.ts
       'validateFlowForCreation reports ready when every
       regular node has a member and an outgoing edge';
       tests/adapters-flow-publish.test.ts
       'getFlowsForCreation partitions ready and notReady
       flows'

### Workbox — Work Order Box

- [ ] **WB6** Open a work order. PASS: the right box
  shows a title row — the flow name, then at its right
  end the claim place and an icon-only close control
  named "Close work order" — then the work order id
  badge, the current state badge, and attributes
  rendered from the current node's attribute
  references. There is no back button.
  Pin: tests/presenter-workbox-detail.test.ts
       'WorkboxDetailPresenter exposes id and flow name
       from the work order';
       tests/presenter-workbox-detail.test.ts
       'renderableAttributes are the current node refs
       and buildPage renders a labeled input per required
       attribute with a marker';
       tests/presenter-workbox-detail.test.ts 'the box has
       a close control and no back button'; exploratory —
       the live state badge
- [ ] **WB7** Attribute types render correctly: text
  inputs, selects, number inputs, date inputs,
  checkboxes, and radio buttons as appropriate for each
  attribute type in the flow definition.
  Pin: tests/presenter-workbox-detail.test.ts
       'buildAttributeInputHtml renders a text input
       carrying the attribute id';
       tests/presenter-workbox-detail.test.ts
       'buildAttributeInputHtml renders a number input for
       the number attribute type';
       tests/presenter-workbox-detail.test.ts
       'buildAttributeInputHtml renders a date input for
       the date attribute type';
       tests/presenter-workbox-detail.test.ts
       'buildAttributeInputHtml renders a select with one
       option per choice plus a placeholder';
       tests/presenter-workbox-detail.test.ts
       'buildAttributeInputHtml renders a radio group with
       one collectable input per option';
       tests/presenter-workbox-detail.test.ts
       'buildAttributeInputHtml renders a bare checkbox
       input for the checkbox type'
- [ ] **WB8** Transition buttons appear below the
  attributes, one per outgoing edge from the current
  node, labeled with the edge name, enabled only under
  my live claim.
  Pin: tests/presenter-workbox-detail.test.ts
       'buildPage claimed-by-me enables transitions';
       tests/presenter-workbox-detail.test.ts 'buildPage
       unclaimed shows disabled fields with values and
       disabled transitions'
- [ ] **WB9** No Release button. Turning the claim switch
  off releases (WB13).
  Pin: tests/browser/workbox-box.test.ts 'the switch
       claims and releases'
- [ ] **WB10** A collapsible History section shows all
  transitions with from/to state names, user name, and
  relative timestamp.
  Pin: tests/presenter-workbox-detail.test.ts 'buildPage
       shows a single Created -> Triage history row for a
       freshly created work order';
       tests/presenter-workbox-detail.test.ts 'buildPage
       history lists transitions newest first with their
       attribute values'; exploratory — the collapsible
       interaction and the relative-timestamp formatting
       live
- [ ] **WB10a — No bind chrome.** Open a work order on a
  flow that has a record-type join. PASS: there is no
  "Bind instance" button, no bind-instance dialog, and
  no bind-prompt title. A bound instance may still show
  an Instance badge that identifies the record; the
  badge is a link (`?instance=<id>`) to the record
  type's detail, which opens with that instance's row
  scrolled into view.
  Pin: tests/presenter-workbox-detail.test.ts
       'buildPage claimed-by-me enables fields and omits
       bind chrome'; tests/presenter-workbox-detail.test.ts
       'the binding badge links to its instance' (decides
       the link); tests/browser/record-instance-link.test.ts
       'an instance link scrolls its row into view'
       (decides the scroll)
- [ ] **WB10b — Unclaimed fields disabled with values.**
  Open an unclaimed (or lapsed) work order that has
  instance values. PASS: attribute inputs are disabled
  and still show those values; transition buttons are
  shown and disabled; the claim switch is off, labelled
  "Claim". To work it, turn the switch on.
  Pin: tests/presenter-workbox-detail.test.ts
       'buildPage unclaimed shows disabled fields with
       values and disabled transitions';
       tests/presenter-workbox-detail.test.ts 'an
       unclaimed work order offers the claim switch off'
- [ ] **WB27 — Open, close, and the address.** Click an
  available row. PASS: its work order fills the right
  box, the row is outlined (`aria-current="true"`), the
  address gains `?id=<id>` beside `organization=`, and
  the page does not navigate. Press "Close work order".
  PASS: the box returns to "Select a work order to open
  it here", the outline goes, and `id` leaves the
  address. Reload with `?id=<id>`. PASS: that work order
  opens. Cmd/Ctrl-click a row's title. PASS: a new tab
  opens `workbox/index.html?id=<id>` with it open. From
  Customer Profile's record detail, click a work order
  link. PASS: the workbox opens it in the box.
  Pin: tests/browser/workbox-box.test.ts 'opening a row
       fills the box, marks the row, and sets the id';
       tests/browser/workbox-box.test.ts 'the close
       control empties the box and clears the id';
       tests/browser/workbox-box.test.ts 'loading the page
       with an id opens that work order';
       tests/browser/workbox-box.test.ts 'the Records
       page's work order link opens it in the workbox';
       tests/workbox-address.test.ts 'closing removes the
       id and keeps the rest';
       tests/presenter-workbox-inbox.test.ts 'a row's
       title links to the workbox with its id';
       exploratory — the modified click's new tab
- [ ] **WB28 — The claim place.** Open, in turn, an
  unclaimed work order, one I claim, one another member
  claims, and an archived one. PASS: a switch, off,
  labelled "Claim"; the same switch, on, labelled
  "Claimed by <me>"; the words "Claimed by <them>" and
  no switch; nothing. A lapsed claim reads as no claim.
  Pin: tests/presenter-workbox-detail.test.ts 'an
       unclaimed work order offers the claim switch off';
       tests/presenter-workbox-detail.test.ts 'my claim
       shows the switch on with my name';
       tests/presenter-workbox-detail.test.ts 'another
       member's claim names them with no switch';
       tests/presenter-workbox-detail.test.ts 'an archived
       work order has no claim place'
- [ ] **WB29 — Phones.** At 375×800, open a row. PASS:
  the page scrolls the box into view below the mobile
  header. Close it. PASS: the page scrolls back to the
  lists. At 1280×800 with a long list, scroll the
  lists. PASS: the open work order stays in view.
  Pin: tests/browser/workbox-box.test.ts 'on a phone
       opening scrolls to the box and closing scrolls
       back'; exploratory — the sticky box at desktop
       width

### Workbox — Transitions

- [ ] **WB11** With a claimed-by-me work order open in
  the box (a live create on Customer Onboarding binds a
  fresh instance, birth-claims, and opens it there),
  fill Company Name and Contact Email, scroll to
  `submit`, and click it → Review. PASS: the transition
  POSTs `work-orders/:id/transition` (200) and the
  "Transition complete" toast shows. Review does not list
  Tony Stark, so the box moves on: once the lists
  refresh — the row now in available-to-me, its claim
  released by the move — it opens the topmost claimed
  work order or, with none, the topmost available one,
  never this one, and the address's `?id=` follows. The
  page does not navigate, and no "Work order detail
  refresh failed" toast shows.
  Pin: tests/browser/workbox-transition.test.ts 'fill
       and submit moves the box to my next work (WB11)'
- [ ] **WB30 — After a transition.** (a) Claim a Review
  work order — Review's roster does not list Tony
  Stark — fill Reviewer Notes, scroll to "needs
  revision", and click it. PASS: Data Capture lists
  Tony, so the box stays on the work order, now at Data
  Capture, its claim place offering "Claim". (b) Claim
  one work order, then submit a Data Capture one. PASS:
  the box opens the topmost claimed work order. (c)
  Press "Claimed by Me" while holding one claim, and
  submit it. PASS: the box closes — no available list is
  drawn to fall back to. (d) Search for one work order's
  id and submit it. PASS: it shows in available-to-me,
  and the box closes rather than reopen it. The roster
  decides only where the box goes: the lists still show
  every unclaimed work order (TODO.md item 11a).
  Pin: tests/workbox-next.test.ts 'a step whose roster
       lists me is mine'; tests/workbox-next.test.ts 'an
       archive node is never mine';
       tests/workbox-next.test.ts 'the work order sent on
       never opens'; tests/workbox-next.test.ts 'under
       Claimed by Me there is no available row to fall
       back to'; tests/browser/workbox-transition.test.ts
       'a transition to a step that lists me keeps the box
       on the work order';
       tests/browser/workbox-transition.test.ts 'a
       transition to a step that is not mine opens my
       topmost claimed work order';
       tests/browser/workbox-transition.test.ts 'with only
       the claimed list drawn and none left the box
       closes'; tests/browser/workbox-transition.test.ts
       'the box never reopens the work order it sent on'
- [ ] **WB16** Read the network log across WB11's
  transition (never `js()` fetch — the bearer is
  memory-only, per the explorer prompt). Drive WB16
  in WB11's turn, on the workbox document, with the
  read armed before `submit`: CDP `Network` enabled
  before `submit`, or
  `performance.getEntriesByType('resource')` read on
  the same document once the "Transition complete"
  toast shows — the transition no longer navigates, so
  the document keeps its buffer (Driving notes,
  WB11/WB16). There is no submit-time binding PUT.
  PASS:
  the transition POST is `work-orders/:id/transition`
  (200) whose body
  is the **instance shape** (`targetState`, `instance_id`,
  `record_type_id`, `set`/`clear` delta, `release`,
  `transitionAt` — no `fieldValues` bag) and carries a
  strong `If-Match` naming the work order's etag and the
  instance's; a pure move omits
  `set`/`clear`/`instance_id`/`record_type_id` and sends
  the work order's etag alone (without it the POST is
  428); a sibling instance revision pair
  advances the head when the transition was value-bearing.
  Derived WO history is chain order, oldest first
  (`versions/`), with one non-claim event per transition
  (`state` = target node id, `member_id` = actor,
  `at` = RFC-3339 Zulu). Live form
  values come from the instance head, not a history fold.
  Pin: tests/api-work-order-binding.test.ts 'fresh bind →
       200; detail + list embed; unbound omits keys';
       tests/api-work-order-transition-instance.test.ts
       'value-bearing fresh If-Match → 200; head advances'
       (its own assertion checks
       `instancePairCount === before + 1` — decides the
       sibling revision pair advancing the head);
       tests/api-work-order-transition-instance.test.ts
       'a value-bearing transition names both heads';
       tests/api-work-order-transition-instance.test.ts
       'a pure move sends the work order's tag' (decides
       a pure move without a tag is 428 and with the
       work order's tag is 200);
       tests/api-work-order-transition-instance.test.ts
       'pure move carrying instance_id → 400';
       tests/api-work-order-transition-instance.test.ts
       'pure move carrying record_type_id → 400' (both
       decide a pure move must omit them);
       tests/api-work-order-versions.test.ts 'a work order
       lists its versions oldest first, each part the
       version its tag serves';
       exploratory — the live network-log read itself
- [ ] **WB12** Click a work order row. PASS: the box
  opens it and the page does not PUT
  `work-orders/:id/claim`; the switch stays off.
  Pin: tests/browser/workbox-box.test.ts 'opening a row
       fills the box, marks the row, and sets the id'
       (decides the head is still unclaimed after
       opening)
- [ ] **WB13** On a claimed-by-me work order, turn the
  claim switch off. PASS: DELETE `work-orders/:id/claim`
  (200); the switch is disabled while the DELETE is in
  flight and goes off only when it answers; the row
  moves to available-to-me; the form and the transition
  buttons disable.
  Pin: tests/browser/workbox-box.test.ts 'the switch
       claims and releases';
       tests/adapters-work-orders.test.ts
       'deleteWorkOrderClaim DELETEs claim and derives
       claim_released'
- [ ] **WB13a — Claim → release → reclaim.** Open an
  available row and turn the switch on (claim), off
  (release), and on again (reclaim). PASS: the message
  plane carries `claimed` → `claim_released` →
  `claimed`. On a seeded work order, its first claim
  records `claim_expired` for its creator's lapsed
  birth claim, then `claimed`.
  Pin: tests/browser/workbox-box.test.ts 'the switch
       claims and releases';
       tests/api-work-order-claim.test.ts 'a released
       claim allows a fresh claim';
       tests/mock-data-pairs.test.ts 'claiming a seeded
       work order expires its birth claim'
- [ ] **WB19** Subject: the bound WO from WB11–WB13
  (WB14 archives it later; history is still readable
  after archive). After transitioning a work order
  through at least two states, read the derived history
  (`GET work-orders/:id/versions/` or the matching pairs
  in `message_pairs`) for this work order's id. PASS:
  versions are in chain order, oldest first (the last is
  current); each non-claim event, in the `events` of the
  version that recorded it, has the immutable shape
  `{id, state, member_id, at, field_values}`,
  with `state` carrying the target node's identifier;
  and `GET work-orders/:id/history` answers 404.
  Live values live on the instance head; history
  `field_values` may be empty for new-shape transitions.
  Pin: tests/api-work-order-versions.test.ts 'a work order
       lists its versions oldest first, each part the
       version its tag serves';
       tests/api-work-order-history.test.ts 'a work order's
       /history is a router 404' (decides the retired
       route answers 404); exploratory — that no app code path
       ever mutates an existing pair (an architectural
       invariant, not a single assertion)
- [ ] **WB19a — Two-tab 412 in the box.**
  Subject: the same bound Active WO from WB11–WB13,
  claimed by the switch (or already claimed-by-me). Drive
  before WB14. If the WO is already archived,
  DEFERRED on WB14 — not FAIL. Open it in the box
  in two tabs.
  In tab 2, open the bound record's detail. The
  Instances section sits below the fold at
  1280×800 — `scrollIntoView` the row's
  `[data-action="edit-instance"]` (`block:
  "center"`), then click it. Do not click the
  record-type header Edit (that opens the type form).
  Change an instance value and Save so the head etag
  advances (or drive a second transition). In tab
  1, edit a value and transition. PASS: tab 1
  receives 412, re-GETs the instance, re-presents
  the box with a conflict notice and a
  warning toast ("This instance changed
  underneath you — values refreshed; re-apply your
  edit"), and does **not** auto-retry the
  transition. A targeting miss on header Edit is
  BLOCKED, not FAIL.
  Pin: tests/api-work-order-transition-instance.test.ts
       'value-bearing stale If-Match → 412' (decides the
       server 412 when a transition's held etag is
       stale); exploratory — the live re-GET, the
       conflict notice, and the absence of auto-retry (no
       CLI or browser test exercises the client-side 412
       recovery in web-app/workbox/work-order-box.ts;
       `WorkboxDetailPresenter`'s `conflictNotice`
       rendering carries no test either)
- [ ] **WB19b — Direct instance PATCH vs transition 412
  convergence.** Subject: the same bound Active WO from
  WB11–WB13. Drive before WB14. If the WO is already
  archived, DEFERRED on WB14 — not FAIL. With a bound
  WO open in the box, PATCH the same
  instance from the record detail UI (save) so the
  head advances; then attempt a value-bearing
  transition in the stale box. PASS: same 412
  recovery shape as WB19a. Conversely, after a successful
  **value-bearing** transition (set/clear + If-Match —
  Review fills Reviewer Notes), a stale instance Save on
  record detail 412s and recovers — drive the converse as
  a plain instance Save from record detail, never as a WO
  transition: Review has two outgoing edges, and its
  `approve` edge archives the WO — exactly the transition
  WB14 still needs to drive later (value-bearing, with
  Reviewer Notes), so do not pre-empt it here. A
  **pure move** (no set/clear, no If-Match) does not
  advance the instance etag; a Save with the held etag is
  200, not a FAIL.
  Pin: tests/adapters-work-orders.test.ts
       'postWorkOrderTransition 412s when the snapshot etag
       is stale against a concurrent PATCH' (decides the
       forward direction: an instance PATCH advances the
       etag, so a stale-etag transition afterward 412s);
       tests/api-work-order-transition-instance.test.ts
       'value-bearing transition then stale instance PATCH
       is 412' (the converse direction);
       tests/api-work-order-transition-instance.test.ts
       'pure move does not advance instance etag; held
       If-Match PATCH is 200';
       tests/presenter-record-instances.test.ts 'edit form
       surfaces 412 conflict notice' (record detail's own
       conflict-notice render); exploratory — the live
       re-present and warning toast in the workbox's box
       specifically

### Workbox — Completion

- [ ] **WB14** Drive WB14 only after WB19a and WB19b
  have scored lines in the checkpoint: this case
  archives their subject. If either has no line yet,
  drive it now, then come back. Transition a work
  order to the completion
  (Archive) node (its `isArchive` is true) — on Review
  fill Reviewer Notes and click `approve`. PASS: an
  archive node is no one's step, so the box moves on to
  the topmost claimed or available work order, or
  closes; the row leaves both lists, and "Archived by
  Me" lists it, its count one higher.
  Pin: tests/workbox-inbox.test.ts 'this member's archive
       transition is archived-by-me';
       tests/workbox-next.test.ts 'an archive node is
       never mine'; exploratory — the live transition and
       the box's move
- [ ] **WB15** Press "Archived by Me" and click a
  completed row. PASS: the box shows the read-only view
  — its badges and history, no attributes, transition
  buttons, or claim place.
  Pin: tests/presenter-workbox-detail.test.ts 'buildPage
       on a complete work order hides the attributes
       card, transition buttons, and release button';
       tests/presenter-workbox-detail.test.ts 'an archived
       work order has no claim place'; exploratory — the
       live read-only render

### Workbox — Data Integrity

- [ ] **WB17** With a work order open in the box,
  navigate away and come back with Back. PASS: all data
  persists, and the address's `?id=` reopens the same
  work order.
  Pin: tests/browser/workbox-box.test.ts 'loading the page
       with an id opens that work order' (decides the
       reopen); exploratory — page-navigation data
       persistence

### Workbox — Concurrency & Integrity

- [ ] **WB18** Open the same unclaimed work order in the
  box as two members in two cookie jars: Tony Stark in
  the walk's tab, and Sarah Chen in a second jar minted
  as SV6 does (Driving notes, SV6/SV7/SV10). In Tony's
  tab, turn the switch on. Opening inspects. In
  Sarah's, still showing the switch off, turn it on.
  PASS: Sarah's claim is refused — her box latched the
  head from before Tony's claim, so `PUT
  work-orders/:id/claim` answers 412 — a toast carries
  "Failed to claim work order", her switch never shows
  on, and her box re-reads to "Claimed by Tony Stark"
  with no switch; the row is in neither of her lists.
  (A claim the server refuses with 409 `work order is
  already claimed` toasts "Someone else holds that work
  order"; a box that read after Tony's claim shows no
  switch to try.) This work order's version chain
  carries one live `'claimed'` event, Tony's (a stale
  prior claim is superseded by a `'claim_expired'`
  event, never overwritten in place). Inspect via
  derived `GET work-orders/:id/versions/` (oldest
  first; claim events carry `field_values: []`). Two
  tabs of one jar are one member: the second opens the
  holder's switch on and appends no claim (WB23's claim
  half).
  Pin: tests/api-work-order-claim.test.ts 'a live claim by
       another member is a 409';
       tests/api-work-order-claim.test.ts 'a foreign
       live claim is 409 from the head' (decides the
       409 body and that nothing is stored);
       tests/api-work-order-claim.test.ts 'two-actor
       contention: the second claim on a stale tag is
       412 and exactly one claimed event lands';
       tests/api-work-order-claim.test.ts 'an expired claim
       is superseded atomically' (the general
       never-overwritten-in-place invariant, though this
       specific live drive is unlikely to trigger an
       actual expiry);
       tests/browser/workbox-box.test.ts 'a claim another
       member took leaves the switch off'; exploratory —
       Sarah's live toast and lists

### Workbox — Personal inbox

The inbox is personal. Available-to-me is the org pool
(every unclaimed or released active work order, any
node). Assigned-pool (current node `memberIds`) is
TODO.md item 11a. Item 11's processes rewrite keeps
all-see-all as the default.

- [ ] **WB20** As the demo user, navigate to `workbox/`.
  PASS: the left box lists this member's live claims
  under "Work Orders claimed by me" and, below them,
  available-to-me (unclaimed or released, not
  `isArchive`, any node), each oldest last transition
  first. Another member's live claim is omitted. No row
  draws in both lists. Rows do not name a claimant.
  Pin: tests/workbox-inbox.test.ts 'an unclaimed active
       work order is available';
       tests/workbox-inbox.test.ts 'this member's live
       claim is claimed';
       tests/workbox-inbox.test.ts 'another member's
       live claim is omitted';
       tests/workbox-inbox.test.ts 'buildInboxItems still
       sorts'
- [ ] **WB21** Press "Archived by Me". PASS: only work
  this member last transitioned onto an `isArchive`
  node is listed. Another member's archive is omitted.
  Pin: tests/workbox-inbox.test.ts 'this member's
       archive transition is archived-by-me';
       tests/workbox-inbox.test.ts 'another member's
       archive is omitted'
- [ ] **WB22** Inspect
  `web-app/app/presenters/workbox-inbox.ts`. PASS:
  `buildInboxItems` takes three parameters —
  `(workOrders, activeClaimsByWo, currentMemberId)` —
  and returns `{ available, claimed, archivedByMe }`.
  Its exports include `InboxItem`, `InboxListKind`,
  `InboxLists`, `ActiveClaim`, `InboxSection`,
  `buildInboxItems`, `inboxSectionsOf`, and
  `buildInboxLists`. There is no `InboxMode`, no
  `WorkboxInboxPresenter`, and no item `position`.
  Pin: tests/workbox-inbox.test.ts calls
       `buildInboxItems` with exactly these three
       arguments, so AT1's `deno check` rejects any
       further required parameter
- [ ] **WB23** Open the holder's work order in the box in
  two tabs of one cookie jar. PASS: the second tab shows
  the holder's switch on and the form editable, and
  appends no claim. Release is the switch, not
  `#unclaim-btn`.
  Pin: tests/browser/workbox-box.test.ts 'opening a row
       fills the box, marks the row, and sets the id'
       (decides opening never claims);
       tests/presenter-workbox-detail.test.ts 'the work
       order box has no bind or unclaim chrome';
       tests/api-work-order-release.test.ts 'a release
       with no live claim answers the head'
````

- [ ] **Step 6: Check.**

```bash
cd /Users/tmornini/code/fusion-angle/.worktrees/workbox-one-page
grep -c '^- \[ \] \*\*WB' TEST-PLAN.md      # 38 (was 31)
grep -c 'workbox-inbox-drag' TEST-PLAN.md    # 0
grep -c 'workbox/detail' TEST-PLAN.md        # 0
export DENO_DIR="$TMPDIR/deno-dir" && ./test lint   # PASS
```

  `./test lint` checks that every `tests/…` path the file
  cites exists; all do after Segment 3b.

- [ ] **Step 7: Commit** `Rewrite the workbox walk for one page`.

### Task 18: TODO.md — the drag and the detail page

Agent: coder. Commandment: Clarity. Risk: the request
plus improvements (only the bullets below).

Each bullet that names the workbox drag or cites a file
this design deletes, and its fate:

| Bullet (opening words) | Fate | Why |
|---|---|---|
| "Claim-on-load with no release-on-leave…" (cites `web-app/workbox/detail.ts:598-616`) | removed | Moot: opening never claims; a claim is the switch's deliberate act, and the cited page is deleted. |
| "Class the ideas-list drop indicator…" | re-pointed | Live (the ideas list still drags); its aside "Workbox inbox already paints `.inbox-drop-indicator`" goes with that class. |
| "Seed one bound Data Capture work order…" | re-pointed | Live; "a claim-drag" becomes "the claim switch". |
| "…a page that holds a message and is refused keeps the stale head…" (cites `web-app/workbox/index.ts`, `:237`, and `web-app/workbox/detail.ts:70`, `:195-206`, `:234`) | re-pointed | Live for the other pages. The workbox leaves the stale-head list (the box re-reads after every refused claim and every 412) and the held-item-miss list (no drop); "— workbox toasts" goes with the drag; the 412 clause's citation moves to the box. |
| "Phone drag in the workbox…" (cites `web-app/app/workbox-inbox-drag.ts`) | removed | Moot: there is no drag. |
| "The workbox action screen's empty-required pre-check…" (cites `web-app/workbox/detail.ts`) | re-pointed | Live; `hasEmptyRequiredAttribute` moved to `web-app/workbox/work-order-box.ts`. |

Bullets that cite surviving workbox files by line
("Inbox rows wrap at desktop width" at
`presenters/workbox-inbox.ts:112`, "The two id links…"
at `presenters/workbox-detail.ts:431`, "Header badges…"
at `:358-364`) neither name the drag nor cite a deleted
file; they stay as they are.

**Files:**
- Modify: `TODO.md`

- [ ] **Step 1: Remove** this exact bullet:

```markdown
- Claim-on-load with no release-on-leave plus the
  8-hour `DEFAULT_LOCK_TIMEOUT` turns a drive-by
  work-order view into an 8-hour claim
  (the page shows the claim; the 8-hour hold is the
  defect) —
  `web-app/workbox/detail.ts:598-616`,
  `shared/types.ts:1087`
```

- [ ] **Step 2:** Replace

```markdown
  not query a hysteresis flip. Workbox inbox already
  paints `.inbox-drop-indicator`. Oracle: the
```

  with

```markdown
  not query a hysteresis flip. Oracle: the
```

- [ ] **Step 3:** Replace

```markdown
  Capture that a claim-drag (or a birth-claimed seed
  row) can open; a later walk can fill Company
```

  with

```markdown
  Capture that the claim switch (or a birth-claimed
  seed row) can claim; a later walk can fill Company
```

- [ ] **Step 4:** Replace

```markdown
  `web-app/organization/index.ts`,
  `web-app/workbox/index.ts`, and the PII hop of
  `putHumanMember` in `client/members.ts`), so every
  retry refuses until a bell refetch or a reload; the
  drag reorders surface nothing on a refusal (ideas,
  projects, records, organization — workbox toasts); the
```

  with

```markdown
  `web-app/organization/index.ts`, and the PII hop of
  `putHumanMember` in `client/members.ts`), so every
  retry refuses until a bell refetch or a reload; the
  drag reorders surface nothing on a refusal (ideas,
  projects, records, organization); the
```

- [ ] **Step 5:** Replace

```markdown
  `web-app/organization/index.ts:240`,
  `web-app/workbox/index.ts:237`), as do the objective
```

  with

```markdown
  `web-app/organization/index.ts:240`), as do the
  objective
```

- [ ] **Step 6:** Replace

```markdown
  (`client/invitations.ts:317`), and the workbox action
  screen sends every 412 into the instance-conflict
  recovery, a stale work-order tag on a pure move
  included, its `conflictNotice` module state
  outliving a refresh (`web-app/workbox/detail.ts:70`,
  `:195-206`, `:234`)
```

  with

```markdown
  (`client/invitations.ts:317`), and the workbox's work
  order box sends every 412 into the instance-conflict
  recovery, a stale work-order tag on a pure move
  included, its `conflictNotice` state outliving a
  refresh (`web-app/workbox/work-order-box.ts`,
  `#transition` and `#recoverFrom412`)
```

- [ ] **Step 7: Remove** this exact bullet (keep the blank
  line that follows it):

```markdown
- Phone drag in the workbox. On a touch screen a finger
  moving over a card scrolls the page and the browser
  cancels the drag (`pointercancel`).
  `web-app/app/workbox-inbox-drag.ts` listens for
  pointer events (`pointerdown` at `:464`, `pointermove`
  at `:498`, `pointerup` at `:559`, `pointercancel` at
  `:576`) with no `touch-action` on the cards and no
  long-press, and nothing scrolls the page while
  dragging, so a card low in "available to me" cannot
  reach "claimed by me" at the top. Needs press-and-hold
  to pick up and edge auto-scroll. (Read from the code;
  not yet observed on a device.)
```

- [ ] **Step 8:** Replace

```markdown
  - The workbox action screen's empty-required pre-check
    and its toast text (R13) — Layer 1;
    `hasEmptyRequiredAttribute`
    (`web-app/workbox/detail.ts`) is a pure function one
    `export` away from a direct test
```

  with

```markdown
  - The workbox action screen's empty-required pre-check
    and its toast text (R13) — Layer 1;
    `hasEmptyRequiredAttribute`
    (`web-app/workbox/work-order-box.ts`) is a pure
    function one `export` away from a direct test
```

- [ ] **Step 9: Check.**
  `grep -n 'workbox/detail\|workbox-inbox-drag\|claim-drag\|Phone drag in the workbox' TODO.md`
  prints nothing. `./test lint` — PASS (its later-work
  rule reads TODO.md's section headings, which are
  untouched).

- [ ] **Step 10: Commit** `Retire the workbox drag from TODO`.

### Task 19: DESIGN-SYSTEM.md — the pill group

Agent: coder. Commandment: Uniformity.

**Files:**
- Modify: `DESIGN-SYSTEM.md`

- [ ] **Step 1:** Replace

```markdown
are `stateBadge` chips (`data-invitation-state`:
Pending, Declined, Revoked) on the sent card.

When groups exist, use native `<optgroup label>` —
```

  with

```markdown
are `stateBadge` chips (`data-invitation-state`:
Pending, Declined, Revoked) on the sent card.

**Filter pills.** The workbox's pill group is a
`role="group"` labelled "Filter work orders" of
`button.badge` pills, the state chips' look and
dimming. Each carries `aria-pressed`; at most one is
`true`. The pressed pill wears `badge-primary`, the
rest `badge-secondary`, and while one is pressed the
rest carry `data-dimmed="true"`. Each ends in a
`.workbox-pill-count` chip: one count on "Claimed by
Me" and "Archived by Me", `claimed/total` on a flow's,
and its `aria-label` says what its numbers mean
("Customer Onboarding: 2 claimed by me of 7"). A
`.header-stat-divider` parts the two "by Me" pills from
the flows'. One page uses it, so its one rule stays in
`pages-workbox.css`. The work order box's claim control
is the existing `.switch`, `role="switch"` with
`aria-checked`, inside its label.

When groups exist, use native `<optgroup label>` —
```

- [ ] **Step 2: Commit** `Document the workbox filter pills`.

### Task 20: ARCHITECTURE.md — one workbox page

Agent: coder. Commandment: Clarity.

The file names neither the detail page nor the drag; its
one plural "workbox pages" becomes the one page.

**Files:**
- Modify: `ARCHITECTURE.md`

- [ ] **Step 1:** Replace

```markdown
whether a prior claim lapsed. The workbox pages read a
claim's liveness from the head's `claim.expires_at`,
the page judging the stored claim against the clock.
```

  with

```markdown
whether a prior claim lapsed. The workbox page reads a
claim's liveness from the head's `claim.expires_at`,
judging the stored claim against the clock.
```

- [ ] **Step 2: Run** `./test lint` — PASS (its rule that
  ARCHITECTURE.md holds no `## Later work` and one
  `## KNOWN seams` is untouched).

- [ ] **Step 3: Commit** `Name one workbox page in the architecture`.

### Segment 4 gate

```bash
export DENO_DIR="$TMPDIR/deno-dir" && ./test validate --syntax
export DENO_DIR="$TMPDIR/deno-dir" && ./test
export DENO_DIR="$TMPDIR/deno-dir" && ./test lint
```

All green. The master reads the F2 rewrite against the
spec before Segment 5.

---
## Segment 5 — What is removed

Each removal follows the page that stopped using it.
Nothing here moves a file; deletions are `git rm`.

### Task 21: Remove the inbox drag

Agent: coder. Commandment: Simplicity. Risk: Unbidden
Helper Code (nothing replaces it).

The spec removes the drag: `web-app/app/workbox-inbox-drag.ts`,
its test (whose every case pins drag behaviour the spec
retires), and its styles. `web-app/app/drag-reorder-positions.ts`
stays: the ideas, projects, records, and organization
lists still use it.

**Files:**
- Delete: `web-app/app/workbox-inbox-drag.ts`,
  `tests/workbox-inbox-drag.test.ts`
- Modify: `web-app/app/styles/pages-workbox.css`,
  `web-app/app/workbox-inbox-rows.ts`

- [ ] **Step 1: Confirm nothing imports the module.**
  `grep -rn 'workbox-inbox-drag' web-app tests client shared server api`
  prints only lines of `tests/workbox-inbox-drag.test.ts`
  (its import).

- [ ] **Step 2: Delete.**

```bash
git rm web-app/app/workbox-inbox-drag.ts \
    tests/workbox-inbox-drag.test.ts
```

- [ ] **Step 3: Remove the drag's styles.** In
  `web-app/app/styles/pages-workbox.css` replace

```css
.inbox-drop-indicator {
    height: 3px;
    margin: 2px 0;
    pointer-events: none;
    border-radius: 2px;
    background: hsl(var(--primary));
}

.inbox-dragging {
    opacity: 0.4;
    position: relative;
    z-index: 1;
}

.inbox-drop-target {
    outline: 2px solid hsl(var(--primary));
    outline-offset: -2px;
}

/* Native link drag over other rows looks like
    reorder. Available is never Custom-order. */
#workbox-inbox a {
    -webkit-user-drag: none;
}

/* A pill's count: a full-radius chip of tabular numerals
```

  with

```css
/* A pill's count: a full-radius chip of tabular numerals
```

- [ ] **Step 4: The rows' comment.** In
  `web-app/app/workbox-inbox-rows.ts` replace

```ts
// The heads the work-orders QUERY matches, best match
// first, each keeping the message a drag on it latches.
```

  with

```ts
// The heads the work-orders QUERY matches, best match
// first, each keeping the message it was read as.
```

- [ ] **Step 5: Run** `./test validate --syntax`,
  `./test`, `./test lint` — PASS.
  `grep -rn 'inbox-drop\|inbox-dragging\|user-drag' web-app`
  prints nothing.

- [ ] **Step 6: Commit** `Remove the workbox inbox drag`.

### Task 22: Remove the inbox presenter class

Agent: coder. Commandment: Simplicity. Risk: Test
Weakening (the tests keep every assertion; only how they
render changes).

`WorkboxInboxPresenter` painted one list into a
container. The page draws `buildInboxLists` now, and the
drag (its other user) is gone. The two test files that
rendered rows through the class render the same rows
through `buildInboxLists` — one headed list, no pill —
and keep every assertion.

**Files:**
- Modify: `web-app/app/presenters/workbox-inbox.ts`,
  `web-app/app/presenters/index.ts`
- Test: `tests/presenter-workbox-inbox.test.ts`,
  `tests/workbox-inbox.test.ts`

- [ ] **Step 1: Move the tests off the class.** In
  `tests/presenter-workbox-inbox.test.ts` replace

```ts
import {
    WorkboxInboxPresenter,
    buildInboxLists,
    inboxSectionsOf,
    type InboxFilter,
    type InboxItem,
    type InboxLists,
} from
```

  with

```ts
import {
    buildInboxLists,
    inboxSectionsOf,
    type InboxFilter,
    type InboxItem,
    type InboxListKind,
    type InboxLists,
} from
```

  and replace

```ts
function capture(
    items: readonly InboxItem[],
    kind: 'available' | 'claimed' | 'archivedByMe',
    filter: InboxFilter,
): string {
    let html = '';
    const container = {
        set innerHTML(value: string) {
            html = value;
        },
    };
    new WorkboxInboxPresenter(items, kind, filter)
        .renderList(
            container as unknown as HTMLElement,
        );
    return html;
}
```

  with

```ts
// One headed list, as the left box draws it with no pill
// pressed.
function capture(
    items: readonly InboxItem[],
    kind: InboxListKind,
    filter: InboxFilter,
): string {
    return buildInboxLists(
        [{ kind, items }], filter, NO_PILL,
    ).toString();
}
```

  In `tests/workbox-inbox.test.ts` replace

```ts
import {
    buildInboxItems,
    partitionInboxItems,
    WorkboxInboxPresenter,
    type ActiveClaim,
    type InboxLists,
} from
    '../web-app/app/presenters/workbox-inbox.ts';
```

  with

```ts
import {
    buildInboxItems,
    buildInboxLists,
    partitionInboxItems,
    type ActiveClaim,
    type InboxLists,
} from
    '../web-app/app/presenters/workbox-inbox.ts';
import { NO_PILL } from
    '../web-app/app/presenters/workbox-pills.ts';
```

  and replace

```ts
        let captured = '';
        const container = {
            set innerHTML(value: string) {
                captured = value;
            },
        };
        new WorkboxInboxPresenter(
            items, 'available', { kind: 'none' },
        )
            .renderList(
                container as unknown as HTMLElement,
            );
```

  with

```ts
        const captured = buildInboxLists(
            [{ kind: 'available', items }],
            { kind: 'none' },
            NO_PILL,
        ).toString();
```

- [ ] **Step 2: Run** ONE-FILE with
  `tests/presenter-workbox-inbox.test.ts`, then with
  `tests/workbox-inbox.test.ts` — both PASS against the
  class still in place (the tests no longer touch it).

- [ ] **Step 3: Remove the class.** In
  `web-app/app/presenters/workbox-inbox.ts` replace

```ts
import {
    html, setHtml, SafeHtml,
    trusted, escapeForHtml,
} from '../safe-html.ts';
```

  with

```ts
import {
    html, SafeHtml,
    trusted, escapeForHtml,
} from '../safe-html.ts';
```

  and delete this block and the blank line after it:

```ts
export class WorkboxInboxPresenter {
    readonly #items: readonly InboxItem[];
    readonly #kind: InboxListKind;
    readonly #filter: InboxFilter;

    constructor(
        items: readonly InboxItem[],
        kind: InboxListKind,
        filter: InboxFilter,
    ) {
        this.#items = items;
        this.#kind = kind;
        this.#filter = filter;
    }

    renderList(
        container: HTMLElement,
    ): void {
        if (this.#items.length === 0) {
            setHtml(container, html`<p
                class="text-muted"
            >${this.#emptyCopy()}</p>`);
            return;
        }
        setHtml(container, html`${
            this.#items.map(buildInboxRow)
        }`);
    }

    #emptyCopy(): string {
        return this.#filter.kind === 'matched'
            ? 'No work orders match “'
                + this.#filter.text + '”'
            : EMPTY_COPY[this.#kind];
    }
}
```

  In `web-app/app/presenters/index.ts` replace

```ts
export {
    WorkboxInboxPresenter,
    buildInboxItems,
```

  with

```ts
export {
    buildInboxItems,
```

- [ ] **Step 4: Run** both files again — PASS.
  `./test validate --syntax`, `./test`, `./test lint` —
  PASS. `grep -rn 'WorkboxInboxPresenter' web-app tests`
  prints nothing.

- [ ] **Step 5: Commit** `Remove the inbox presenter class`.

### Task 23: Drop position from the inbox presenter

Agent: coder. Commandment: Simplicity. Risk: Test
Weakening.

The spec removes `position` from the inbox presenter: the
item field, the sort (gone in Task 3), and the row's
`data-position`. `WorkOrder.position`, the position route,
and `putWorkOrderPosition` stay (no API change).

**Files:**
- Modify: `web-app/app/presenters/workbox-inbox.ts`
- Test: `tests/presenter-workbox-inbox.test.ts`,
  `tests/presenter-workbox-pills.test.ts`,
  `tests/workbox-next.test.ts`

- [ ] **Step 1: Write the failing test.** Append to
  `tests/presenter-workbox-inbox.test.ts`:

```ts
Deno.test('a row carries no position', () => {
    assertEquals(
        capture([placed()], 'available', NO_FILTER)
            .includes('data-position'),
        false,
    );
});
```

- [ ] **Step 2: Run** ONE-FILE with
  `tests/presenter-workbox-inbox.test.ts`. Expected: FAIL —
  the row carries `data-position="1"`.

- [ ] **Step 3: Implement.** In
  `web-app/app/presenters/workbox-inbox.ts`:

  (a) replace

```ts
    completed: boolean;
    position: number;
    taskInstructions: string;
```

  with

```ts
    completed: boolean;
    taskInstructions: string;
```

  (b) replace

```ts
    lastTransitionedAt: string | null;
    position: number;
}
```

  with

```ts
    lastTransitionedAt: string | null;
}
```

  (c) replace

```ts
        lastTransitionedAt: wo.transition.at,
        position: wo.position,
    };
```

  with

```ts
        lastTransitionedAt: wo.transition.at,
    };
```

  (d) replace

```ts
        data-work-order-card="${item.id}"
        data-position="${item.position}">
```

  with

```ts
        data-work-order-card="${item.id}">
```

  The test helpers' item literals lose the field too
  (otherwise `deno check` rejects an unknown property):

  (e) in `tests/presenter-workbox-inbox.test.ts`, in
  `placed()`, delete the line `        position: 1,`; in
  the test 'an unplaced row is State unknown without a
  grip or navigation', delete the line
  `            position: 2,`.

  (f) in `tests/presenter-workbox-pills.test.ts`, in
  `item()`, delete the line `        position: 0,`.

  (g) in `tests/workbox-next.test.ts` (Task 16b), delete
  both lines `        position: 0,` — one in `placed()`,
  one in `unplaced()`.

- [ ] **Step 4: Run** ONE-FILE with each of
  `tests/presenter-workbox-inbox.test.ts`,
  `tests/presenter-workbox-pills.test.ts`,
  `tests/workbox-inbox.test.ts`,
  `tests/workbox-next.test.ts` — PASS.
  `./test validate --syntax`, `./test`, `./test lint` —
  PASS. `grep -n 'position' web-app/app/presenters/workbox-inbox.ts`
  prints nothing.

- [ ] **Step 5: Commit** `Drop position from the inbox presenter`.

### Task 24: Remove the work order detail page

Agent: coder. Commandments: Simplicity, Uniformity.
Risk: Test Weakening.

`web-app/workbox/detail.html` and `detail.ts` go, with
their registry entry; an old bookmark gets the 404 page
(no redirect). Tests change because the page is gone:
`tests/page-registry.test.ts` counts 28 pages and lists
no `workbox-detail`, and gains a pin that the retired
page is missing (as `snapshots` has); the source-scan
test 'detail.ts does not call putWorkOrderClaim' read the
deleted file — its bind and unclaim covenants move to the
box's module, and its `putWorkOrderClaim` assertion goes,
because the spec makes the box claim.

**Files:**
- Delete: `web-app/workbox/detail.ts`,
  `web-app/workbox/detail.html`
- Modify: `web-app/app/page-registry.ts`,
  `web-app/app/styles/pages-workbox.css`
- Test: `tests/page-registry.test.ts`,
  `tests/presenter-workbox-detail.test.ts`

- [ ] **Step 1: Write the failing tests.** In
  `tests/page-registry.test.ts`:

  (a) replace

```ts
    'PAGE_REGISTRY is 29 HTML page files including '
    + 'the api-documentation index',
    () => {
        const keys = Object.keys(PAGE_REGISTRY);
        assertStrictEquals(keys.length, 29);
```

  with

```ts
    'PAGE_REGISTRY is 28 HTML page files including '
    + 'the api-documentation index',
    () => {
        const keys = Object.keys(PAGE_REGISTRY);
        assertStrictEquals(keys.length, 28);
```

  (b) replace

```ts
        assertStrictEquals(files.size, 29);
```

  with

```ts
        assertStrictEquals(files.size, 28);
```

  (c) replace

```ts
    'record-detail', 'records', 'workbox',
    'workbox-detail',
];
```

  with

```ts
    'record-detail', 'records', 'workbox',
];
```

  (d) after the test 'retired snapshots is a missing
  page', add:

```ts
Deno.test('retired workbox-detail is a missing page', () => {
    assertStrictEquals(
        pageAuthMode('workbox-detail'), 'missing',
    );
});
```

  In `tests/presenter-workbox-detail.test.ts` replace the
  test

```ts
Deno.test(
    'detail.ts does not call putWorkOrderClaim',
    async () => {
        const src = await Deno.readTextFile(
            new URL(
                '../web-app/workbox/detail.ts',
                import.meta.url,
            ),
        );
        assertEquals(
            src.includes('putWorkOrderClaim'),
            false,
        );
        assertEquals(
            src.includes('unclaim-btn'),
            false,
        );
```

  with

```ts
// The box claims by its switch; the bind picker and the
// unclaim button stay retired.
Deno.test(
    'the work order box has no bind or unclaim chrome',
    async () => {
        const src = await Deno.readTextFile(
            new URL(
                '../web-app/workbox/work-order-box.ts',
                import.meta.url,
            ),
        );
        assertEquals(
            src.includes('unclaim-btn'),
            false,
        );
```

  (the rest of that test — the `putWorkOrderBinding`,
  `initBindPicker`, and `initUnclaimButton` assertions —
  stays as it is).

- [ ] **Step 2: Run** ONE-FILE with
  `tests/page-registry.test.ts`. Expected: FAIL — 29
  pages, `workbox-detail` scoped and not missing. ONE-FILE
  with `tests/presenter-workbox-detail.test.ts` — PASS
  (the box module already exists and carries none of the
  four strings).

- [ ] **Step 3: Implement.**

```bash
git rm web-app/workbox/detail.ts web-app/workbox/detail.html
```

  In `web-app/app/page-registry.ts` delete this block:

```ts
    'workbox-detail': {
        organizationScoped: true,
        title: 'Work Order',
        layout: 'sidebar',
        sidebarKey: 'workbox',
        sourceDir: 'workbox',
        sourceFile: 'detail',
        icon: iconMail,
        searchable: false,
        cssBundles: ['pages-workbox'],
        loader: () => import('../workbox/detail.ts'),
    },
```

  In `web-app/app/styles/pages-workbox.css` replace

```css
/* Workbox: work-order inbox, detail. */

/* Cross-document snapshots cover compositor clicks
    on Bind after inbox → detail. Inbox and detail
    are the only pages that load this bundle. */
```

  with

```css
/* Workbox: the inbox and its work order box. */

/* Cross-document snapshots cover compositor clicks.
    The workbox is the only page that loads this
    bundle. */
```

- [ ] **Step 4: Run** ONE-FILE with each of
  `tests/page-registry.test.ts`,
  `tests/presenter-workbox-detail.test.ts` — PASS.
  `./test validate --syntax`, `./test`, `./test lint` —
  PASS. `grep -rn "'workbox-detail'\|workbox/detail" web-app tests`
  (the quoted registry key, not the presenter's file
  name) prints only `tests/page-registry.test.ts` (the
  missing-page pin) and the three measure lines Task 25
  removes: `web-app/app/measure.ts`,
  `web-app/app/measure-profile-core.ts`, and
  `tests/measure-profile-core.test.ts`.

- [ ] **Step 5: Commit** `Remove the work order detail page`.

### Task 25: Retire workbox-detail from the measure

Agent: coder. Commandment: Uniformity. Risk: the
request plus improvements (no re-recorded budget; the
`workbox` budget stands; recorded history stays as
recorded, `measurements/page-load-times-broken-in-ichat.html`
and `measurements/history.jsonl` included).

**Files:**
- Modify: `web-app/app/measure-profile-core.ts`,
  `web-app/app/measure.ts`, `measurements/budgets.json`
- Test: `tests/measure-profile-core.test.ts`

- [ ] **Step 1: Write the failing test.** In
  `tests/measure-profile-core.test.ts` replace

```ts
Deno.test('DEFAULT_PROFILE_PAGES is the four heavy pages', () => {
    assertEquals(
        [...DEFAULT_PROFILE_PAGES],
        [
            'organization',
            'workbox',
            'workbox-detail',
            'projects',
        ],
    );
});
```

  with

```ts
Deno.test('DEFAULT_PROFILE_PAGES is the three heavy pages', () => {
    assertEquals(
        [...DEFAULT_PROFILE_PAGES],
        [
            'organization',
            'workbox',
            'projects',
        ],
    );
});
```

- [ ] **Step 2: Run** ONE-FILE with
  `tests/measure-profile-core.test.ts`. Expected: FAIL —
  the list still holds `workbox-detail`.

- [ ] **Step 3: Implement.**

  In `web-app/app/measure-profile-core.ts` replace

```ts
    'workbox',
    'workbox-detail',
    'projects',
] as const;
```

  with

```ts
    'workbox',
    'projects',
] as const;
```

  In `web-app/app/measure.ts` delete the line

```ts
    'workbox-detail': 'workbox',
```

  and replace

```ts
        '                       omitted, uses organization,',
        '                       workbox, workbox-detail,',
        '                       projects. If --runs is',
        '                       omitted, uses 1.',
```

  with

```ts
        '                       omitted, uses organization,',
        '                       workbox, projects. If',
        '                       --runs is omitted, uses 1.',
```

  In `measurements/budgets.json` replace

```json
    "workbox": {
        "readyMs": 87
    },
    "workbox-detail": {
        "readyMs": 58
    }
}
```

  with

```json
    "workbox": {
        "readyMs": 87
    }
}
```

- [ ] **Step 4: Run** ONE-FILE with
  `tests/measure-profile-core.test.ts` — PASS. Then
  `./test validate --syntax`, `./test`, `./test lint` —
  PASS. `grep -rn "'workbox-detail'" web-app tests` prints
  only the missing-page pin in
  `tests/page-registry.test.ts`;
  `grep -c '"workbox-detail"' measurements/budgets.json`
  prints `0`.

- [ ] **Step 5: Commit** `Retire workbox-detail from the measure`.

### Segment 5 gate

```bash
export DENO_DIR="$TMPDIR/deno-dir" && ./test validate
```

Layer 1, the full gate (check, memory suite, lint,
schema, API documentation) — green on the clean tree.

**MASTER RUNS: `./test validate browser`** (Layer 2):
all green, as at Segment 3's gate.

---

## Landing (master)

1. Whole-branch review: an architect, given the spec,
   this plan, and `git diff master...`. Fix rounds commit
   as `fixup!` of their task's commit.
2. Squash locally to one commit per task (Tasks 1–25),
   above the spec and plan commits, with
   `git rebase --autosquash master` driven by a
   non-interactive `GIT_SEQUENCE_EDITOR=:`.
3. `./test validate` (Layer 1), then
   `./test validate browser` (Layer 2). Report any gate
   that cannot run, with its output.
4. When the operator asks to merge, from
   `/Users/tmornini/code/fusion-angle`:
   `git merge --no-ff workbox-one-page` with subject
   `Put the workbox on one page` and a body that says why
   (work a queue without leaving it) and what changed
   (pills, the switch, the box; the detail page, the
   drag, and the segmented control gone); then
   `git worktree remove .worktrees/workbox-one-page` and
   `git branch -d workbox-one-page`.
