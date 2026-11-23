# Faster Layer 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** `./test` passes master's tests, plus nine new
ones, on four workers and with less CPU work: one mock
seed costs less, change by change 0.87 of its CPU, then
0.73 and 0.96 of its wall (the spec, "The changes"), and
a test file seeds once (Task 8).

**Architecture:** Three changes remove waste inside one
seed and change no value it computes: the memory backend's
two scans collect only the rows of a statement's own
documents, with no key built per row, and its heads and
succession keys read that short list; `Octets.toLatin1`
builds its string a chunk at a time; the seed's score
instants share one zone formatter. A fourth, the
operator's decision, names the suite's worker count in
`run_memory`, with `DENO_JOBS` in the environment still
winning. A fifth, the operator's ruling (Task 8), seeds
the memory suite once per test file and hands each test
a copy; no test shares a seeded backend. A split of the
one 41-seed test file
was built and then withdrawn: at four workers it gains
nothing.

**Tech Stack:** Deno 2.9.8, TypeScript (`strict`,
`noUncheckedIndexedAccess`, `erasableSyntaxOnly`),
`Deno.test` with `@std/assert`.

Spec: `docs/superpowers/specs/faster-layer-one-design.md`.

## Questions

None is open. The spec's Decisions record each choice the
operator delegated. The rehearsal cache was the
operator's, and is ruled: Task 8 builds its per-file
half. The broken `measurements/probes/seed/rehearsal.ts`
stays surfaced, not fixed.

## Global Constraints

- Work only in `.worktrees/faster-layer-one`, branch
  `faster-layer-one`. No push, no merge, no force.
- `export DENO_DIR="$TMPDIR/deno-dir"` in the shell before
  any `deno` or `./test` command. Never in a script.
- 78-character lines, 4-space indent, final newline, no
  trailing whitespace, in everything `./test lint` lints.
- Each commit: one concern, one line of about 50
  characters, present-tense imperative, no body, the
  `Co-Authored-By` trailer, and `./test validate --syntax`
  green first.
- Never move and change content in one commit: Task 4's
  commits move test blocks and add only the imports and
  constants the moved blocks read.
- One edit to the `test` script, the worker count, kept
  small. No edit to `deno.json` or `deno.lock`. No `node:`
  import without the operator's ruling.
- Transaction bodies await only row ops; no validator,
  hash, or codec moves into one.
- The machine is shared. Compare before and after
  interleaved, several runs each, and report medians,
  spread, and load.
- Nothing here binds 127.0.0.1:5432; if a step ever does,
  take `/tmp/claude-501/fusion-angle-5432.lock` first.

## Review Focus

- Does any test prove less than it did? The split must
  leave 49 tests with the names and bodies they had.
- Is the memory backend's answer the same for every
  statement: heads, conflicts, duplicate ids, rows
  written, and a row with no string `supersedes`?
- Is `toLatin1` the same string for every byte sequence,
  at 0, 1, 8,191, 8,192, and 8,193 bytes and beyond?
- Does any change share state between tests, or keep
  state between two seeds?
- The Sin of the Cache, Premature Optimization,
  Cleverness, Shared Mutable State, Global State, Test
  Weakening, Resource Abandonment.

## File Map

| File | Change |
|---|---|
| `api/backend-memory.ts` | `documentRowsOf`; `headsOf` and `successionKeys` read its list |
| `shared/http-message/octets.ts` | `toLatin1` in chunks; `LATIN1_CHUNK_BYTES` |
| `api/mock-data/scores.ts` | `BUSINESS_ZONE_FORMAT`, one formatter |
| `tests/http-octets.test.ts` | the chunk-boundary test |
| `test` | `MEMORY_SUITE_WORKERS`; `run_memory` refuses a `DENO_JOBS` that is no count and sets it on the two passes alone |
| `tests/test-cli.test.ts` | the four worker-count tests |
| `tests/backend-tx-memory.test.ts` | the succession order at the backend |
| `tests/api-organization-query.test.ts` | ids of letters alone where a random id could match |
| `AGENTS.md` | the Gates paragraph; the `./test` timing paragraph |
| `TODO.md` | the rehearsal bullet's figures |
| `docs/superpowers/specs/faster-layer-one-design.md` | a Results section |

The baseline for every pair is a snapshot of master:

```bash
mkdir -p "$TMPDIR/layer-one/base"
git archive c36020172 | tar -x -C "$TMPDIR/layer-one/base"
```

and one seed pair is:

```bash
deno run --frozen --no-check --allow-env --allow-read \
    --config deno.json \
    measurements/probes/layer-one/seed-pair.ts \
    "file://$TMPDIR/layer-one/base" "file://$PWD" 15
```

A snapshot of the tree after each task (`cp -R api shared
server tests web-app client deno.json deno.lock`) is the
next task's A side, so each task has its own ratio.

### Task 1: Read only the statement's documents (judgment)

**Files:** `api/backend-memory.ts`.

- [ ] **Step 1: Run the tests that cover the statement.**

```bash
deno test --frozen --no-check --allow-all \
    --preload ./tests/hmac-test-key.ts \
    --preload ./tests/local-storage-stub.ts \
    --preload ./tests/session-storage-stub.ts \
    --preload ./tests/worker-name-prefix.ts \
    tests/ledger-store.test.ts tests/ledger-seed.test.ts \
    tests/store-acceptance-memory.test.ts \
    tests/message-plane.test.ts
```

Expected: green. These are the tests the change must
keep green.

- [ ] **Step 2: Scan for the statement's documents only.**
In `#apply`, before `classifyStatement`:

```ts
        const documents = documentsOf(rows);
        const classified = await classifyStatement(
            attempt,
            rows,
            headsOf(documentRowsOf(buffer, documents)),
            clock,
        );
```

and where the succession set is built, a second scan,
because the classification awaits and an overlapping
statement may have written meanwhile:

```ts
        // Read after the classification's awaits, not
        // with the heads: a statement that overlapped this
        // one in a transaction may have written since.
        const claimed = successionKeys(
            documentRowsOf(buffer, documents),
        );
```

- [ ] **Step 3: Give the two scans one body.**
`successionKeys` and `headsOf` take the short list;
`documentRowsOf` is the scan:

```ts
function successionKeys(
    rows: readonly DocumentRow[],
): Set<string> {
    const keys = new Set<string>();
    for (const row of rows) {
        const supersedes = row.rec['supersedes'];
        if (typeof supersedes !== 'string') continue;
        keys.add(successionKey(row.path, row.name, supersedes));
    }
    return keys;
}

// A statement's documents, their names by path, so a table
// scan asks whether a row is one of them without building
// a key for the row.
type Documents = ReadonlyMap<string, ReadonlySet<string>>;

function documentsOf(
    statement: readonly StatementBind[],
): Documents {
    const documents = new Map<string, Set<string>>();
    for (const bind of statement) {
        const names = documents.get(bind.path);
        if (names === undefined) {
            documents.set(bind.path, new Set([bind.name]));
        } else {
            names.add(bind.name);
        }
    }
    return documents;
}

// A PUT or DELETE row of one of a statement's documents.
type DocumentRow = {
    readonly path: string,
    readonly name: string,
    readonly rec: Record<string, unknown>,
};

// The table's PUT and DELETE rows of a statement's own
// documents, the only rows its heads and its successions
// read. Every statement pays this scan of the whole
// table, a seed's every statement among them.
function documentRowsOf(
    rows: readonly { id: string }[],
    documents: Documents,
): DocumentRow[] {
    const written: DocumentRow[] = [];
    for (const row of rows) {
        const rec = row as Record<string, unknown>;
        const method = rec['method'];
        if (
            typeof method !== 'string'
            || !documentMethod(method)
        ) {
            continue;
        }
        const path = rec['path'];
        const name = rec['name'];
        if (typeof path !== 'string' || typeof name !== 'string') {
            continue;
        }
        if (documents.get(path)?.has(name) !== true) continue;
        written.push({ path, name, rec });
    }
    return written;
}

// The heads of the statement's own documents: a whole
// table's heads would decode every stored response on
// every statement.
function headsOf(rows: readonly DocumentRow[]): Head[] {
    const best = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
        const key = row.path + '\u0000' + row.name;
        const prev = best.get(key);
        if (prev === undefined || laterHead(row.rec, prev)) {
            best.set(key, row.rec);
        }
    }
    // the Head construction below is unchanged
```

`laterHead` and the `Head` construction keep their text.

- [ ] **Step 4: Run Step 1's tests.** Expected: green.
- [ ] **Step 5: Mutation check, not committed.** Make
`successionKeys` return `new Set()`; run Step 1's tests;
expected: red. Restore. Read the successions with the
heads, before the classification; expected: red. Restore.
Make `documentRowsOf` skip the statement's own documents
(`=== true`); expected: red. Restore. A mutant that stays
green is a finding: either it is the same behavior, or a
test is missing and comes first.
- [ ] **Step 6: Seed pair** against the base snapshot, 15
rounds. Record wall and CPU ratio.
- [ ] **Step 7:** `./test validate --syntax`, then commit:
`Build no key per row in memory table scans`.

### Task 2: Build Latin-1 text in chunks (test first)

**Files:** `tests/http-octets.test.ts`,
`shared/http-message/octets.ts`.

- [ ] **Step 1: Write the boundary test.**

```ts
// More bytes than one call takes as arguments, so text
// built in a single call fails here; and no whole number
// of any power-of-two chunk, so a last, partial chunk
// follows the full ones.
const MEGABYTE = 1_000_000;
const BYTE_VALUES = 256;

Deno.test('Octets.toLatin1 keeps every byte of a megabyte', () => {
    // Each run of 256 starts one value after the last: every
    // value appears, and no two stretches nearby match.
    const bytes = Uint8Array.from(
        { length: MEGABYTE },
        (_, at) => (at + Math.floor(at / BYTE_VALUES)) % BYTE_VALUES,
    );
    const text = Octets.fromBytes(bytes).toLatin1();
    assertStrictEquals(text.length, bytes.length);
    assertStrictEquals(
        bytes.findIndex((byte, at) => text.charCodeAt(at) !== byte),
        -1,
    );
});
```

- [ ] **Step 2: Run it.** Expected: green on the byte at
a time code. It is a characterization of a pure function;
it goes red in Step 5.
- [ ] **Step 3: Commit the test:** `Pin Latin-1 text
across a megabyte`.
- [ ] **Step 4: Build the string in chunks.**

```ts
// One String.fromCharCode call takes this many bytes as
// its arguments: far under any engine's argument limit.
const LATIN1_CHUNK_BYTES = 8192;
```

```ts
    // A chunk at a time: a string appended a byte at a
    // time is a rope with a node per byte, which every
    // later read pays to flatten. apply takes the bytes
    // as they are, though its type asks for an array; the
    // spread form measures no faster than the loop it
    // replaces.
    toLatin1(): string {
        let text = '';
        for (
            let at = 0;
            at < this.#bytes.length;
            at += LATIN1_CHUNK_BYTES
        ) {
            text += String.fromCharCode.apply(
                null,
                this.#bytes.subarray(
                    at, at + LATIN1_CHUNK_BYTES,
                ) as unknown as number[],
            );
        }
        return text;
    }
```

- [ ] **Step 5: Mutation check, not committed.** Stop the
loop one chunk early (`at + LATIN1_CHUNK_BYTES <
this.#bytes.length`); run `tests/http-octets.test.ts`;
expected: the new test red. Restore. Raise the chunk past
a megabyte; expected: the new test red, a `RangeError`.
Restore; expected: green.
- [ ] **Step 6: Seed pair** against Task 1's snapshot, 15
rounds.
- [ ] **Step 7:** `./test validate --syntax`, then commit:
`Build Latin-1 text a chunk at a time`.

### Task 3: Share one zone formatter (mechanical)

**Files:** `api/mock-data/scores.ts`.

- [ ] **Step 1: Hoist the formatter.**

```ts
// One formatter for every score instant: building one is
// the costly step, and the business zone never changes.
const BUSINESS_ZONE_FORMAT = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
});

function zoneOffsetMs(utcMs: number): number {
    const parts = BUSINESS_ZONE_FORMAT.formatToParts(
        new Date(utcMs),
    );
```

- [ ] **Step 2: Run the seed's pins:**
`tests/mock-data-objectives.test.ts`,
`tests/mock-data-weekly-scores.test.ts`,
`tests/work-order-history-oracle.test.ts`, and both
`tests/tz/` files under `TZ=Pacific/Honolulu`. Expected:
green.
- [ ] **Step 3: Seed pair** against Task 2's snapshot.
- [ ] **Step 4:** `./test validate --syntax`, then commit:
`Share one zone formatter across score instants`.

### Task 4: Split the collection head reads (withdrawn)

Built, proved, and committed as three moves, then
withdrawn in `Withdraw the collection head reads split`
when the operator set the worker count to four: replayed
on four slots the split gains nothing. The steps stay as
the record of how it was done and how it was proved.

**Files:** the four `tests/head-reads-*collections*` files.

Line ranges are `tests/head-reads-collections.test.ts` at
`c36020172`:

| Lines | Section | To |
|---|---|---|
| 1–55 | imports | each file takes what it reads |
| 57 | `STARK` | repeated where read |
| 59–106 | stream collections, the empty collection | stays |
| 108–109 | `ME`, `AT` | repeated where read |
| 111–355 | identity collections, an identity's organizations | `head-reads-identity-collections.test.ts` |
| 356–461 | flows | `head-reads-flow-collections.test.ts` |
| 462–738 | record types, attributes, instances | `head-reads-record-collections.test.ts` |
| 739–1194 | children, accepted view, corrupt head, matching, mixed | stays |

- [ ] **Step 1: Record the names before.** Run the file
and keep its 49 test names, sorted.
- [ ] **Step 2: One move per commit.** For each new file:
cut the line range out of the original, paste it under an
import block holding only what the block reads, repeat the
constants it reads, and remove from the original the
imports nothing there reads any more. `deno check` names
every unused and every missing import.
- [ ] **Step 3: Prove the move.** For each new file, the
moved range of `git show c36020172:tests/head-reads-
collections.test.ts` and the new file's body below its
header differ by nothing (`diff`). The four files' test
names, sorted, equal Step 1's list: 24 + 12 + 5 + 8 = 49.
- [ ] **Step 4:** `./test validate --syntax`, `./test
lint`, then commit each move: `Move the identity
collection reads to their own file`, `Move the flow
collection reads to their own file`, `Move the record
collection reads to their own file`.

### Task 4b: Name the suite's worker count (test first)

**Files:** `tests/test-cli.test.ts`, `test`, `AGENTS.md`.

- [ ] **Step 1: Write the two tests** in
`tests/test-cli.test.ts`: `deno` stubbed on `PATH`, the
environment cleared, `./test memory` run; each stub call
appends the `DENO_JOBS` and `TZ` it was handed. Expect
`['4 UTC', '4 Pacific/Honolulu']` with no `DENO_JOBS`,
and `['16 UTC', '16 Pacific/Honolulu']` with
`DENO_JOBS=16`.
- [ ] **Step 2: Run them.** Expected: the first red (the
script hands deno no count), the second green.
- [ ] **Step 3: Commit the tests:** `Pin the memory
suite's worker count`.
- [ ] **Step 4: Name the count.** Above `run_memory`,
after the flags' comment:

```bash
#
# Workers: four per pass, not deno's one per CPU. The
# operator's machine is usually running other work
# beside the suite. DENO_JOBS already in the environment
# is deno's own knob and wins, for one run that may have
# the machine.
MEMORY_SUITE_WORKERS=4
```

and in `run_memory`, before the command is composed:

```bash
    export DENO_JOBS="${DENO_JOBS:-$MEMORY_SUITE_WORKERS}"
```

Review replaced the export: `run_memory` refuses a
`DENO_JOBS` that is no positive integer and sets the
count on the two `deno test` commands alone. Two more
tests pin those, and the stub also records `--parallel`.

- [ ] **Step 5: Run both tests.** Expected: green.
- [ ] **Step 6: AGENTS.md**, the Gates paragraph: "on four
workers unless `DENO_JOBS` already names a count".
- [ ] **Step 7:** `./test validate --syntax`, `./test
lint`, commit: `Run the memory suite on four workers`.
- [ ] **Step 8:** Three or four, after Task 5's curve.

### Task 5: Measure the suite (delegated; slow)

Full-suite runs are not run by the builder. The
coordinating session dispatches one runner per batch,
under the machine's suite lock
(`/tmp/claude-501/fusion-angle-suite.lock`, one run or one
back-to-back pair per hold), and returns per run the exit
status, the counts, wall-clock and CPU seconds, the load,
and the log path. `DENO_DIR` and `DENO_JOBS` are set in
the runner's shell and never in a script.

- [ ] **Step 1: Three workers or four, and the curve.**
`./test` on the branch at `DENO_JOBS` 3, 4, 4, 3, then 8
and 16: six holds, one run each.
- [ ] **Step 2: Before and after** at `DENO_JOBS=4`:
master's tree, then the branch's, back to back in one
hold. Master's tree is a snapshot committed to a
throwaway repository of its own under `$TMPDIR` (`git
init`, one commit), so the tests that need a git checkout
pass and the baseline is green.
- [ ] **Step 3: The synchronous digest, for the ruling:**
one run at `DENO_JOBS=4` of a measurement-only tree, the
branch with `shared/digest.ts` hashing through
`node:crypto`, also a throwaway repository under
`$TMPDIR`. It is not the branch and nothing from it is
committed.
- [ ] **Step 4: Decide** three or four from Step 1 and set
`MEMORY_SUITE_WORKERS`.
- [ ] **Step 5: Ten consecutive green runs** of the
finished branch at the script's own worker count, in the
closing batch, which stops at the first run that is not
green. A red is a finding, reported with its text and not
re-run into a green. The first of the ten is the figure
AGENTS.md states.
- [ ] **Step 6: Counts.** UTC: 4,956 passed, 12 ignored,
529 files. Honolulu: 8 passed, 2 files.

### Task 6: Documents (mechanical)

- [ ] **Step 1: AGENTS.md**, the `./test` timing
paragraph: the measured median with its runs, load, and
date; the seed as the cost; the 9.5 s, 9.6 s, and 16.2 s
figures as the dated sanitizer comparison.
- [ ] **Step 2: TODO.md**, the "One rehearsal per test
process" bullet: the seed's and `./test`'s figures as
they now are, the count of rehearsals per run, and their
probe. The decision stays the operator's. (Superseded:
the operator ruled, and Task 8 rewrites the bullet.)
- [ ] **Step 3: The spec's Results section:** each change's
ratio, the suite's medians, the counts.
- [ ] **Step 4:** `./test lint`, `./test validate
--syntax`, commit: `Record what ./test costs now`.

### Task 7: Review, fix, squash, Layer 1

- [ ] **Step 1: Review.** The coordinating session
dispatches one independent reviewer with the spec and
`git diff master...HEAD`. Verify each finding before
acting on it; fix the real ones in their own commits;
record the rejected ones with the reason.
- [ ] **Step 2: Squash, local only:** one design-and-plan
commit (spec, plan, probes), then one commit per change:
the memory backend, Latin-1 (test and code), the zone
formatter, the worker count (tests, script, and the
Gates sentence), and the flaky search test. The split
and its withdrawal cancel and leave no commit. The
AGENTS.md timing figure follows the closing runs.
- [ ] **Step 3: Layer 1.** Tree clean, `./test validate`
under the suite lock, by the coordinating session's
runner. Read its report, check the log it names, and
confirm Task 5's counts.

### Task 8: Seed once per test file (test first)

The operator's ruling: "I'll take your recommendations on
per-file seeding and hold node:crypto." The spec's change
5 is the design.

**Files:** `tests/mock-seed.test.ts`, `tests/mock-seed.ts`,
`TODO.md`, `measurements/probes/README.md`, and the
comments of `measurements/probes/layer-one/seed-time.ts`
and `seed-pair.ts`.

- [ ] **Step 1: Write the three pins** in
`tests/mock-seed.test.ts`: a write through one seeded
database is read through no other, beside or after;
every seeded database in a file holds the same seed;
a seeded database is a fresh seed, copied field for
field: a copy equals its source in every field, and the
file's seed equals a fresh one in each row's place,
order, and response body outside the salted credential
rows.
- [ ] **Step 2: Run them.** Expected: the same-seed pin
red, because each call seeds afresh; the other two
green.
- [ ] **Step 3: The memo.** In `tests/mock-seed.ts`, one
module-level promise of a seeded `MemoryStorageBackend`,
and `seededMockDb()` returning
`memoryDbAdapterOver(backend.copy())`. Nothing under
`api/`, `client/`, `server/`, `shared/`, or `web-app/`
changes, and `testHashPassword` keeps its export.
- [ ] **Step 4: Mutations, not committed:** the helper
without the copy, the helper handing one adapter, and
`copy()` reversing or dropping rows, rewriting a row's
id, or blanking a row's response, pair hash, and stamp
each turn a pin red.
- [ ] **Step 5: The 48 seeded files together** under the
suite's own flags, four workers, at least three times,
against the same set at `6981d40aa` for an unlocked
indication. A file that fails beside the others, or not
every time, is a finding.
- [ ] **Step 6: Documents.** TODO.md's "One rehearsal per
test process" bullet says what is decided and built and
what stays open; the probes README and the two probes'
comments say they time copies from this change on.
- [ ] **Step 7:** `./test validate --syntax`, `./test
lint`, commit: `Seed the memory suite once per test file`.
- [ ] **Step 8: Gate,** delegated:
`/tmp/claude-501/layer-one/seed-closing.sh`, the
before-and-after pair in both orders, ten consecutive
runs, and `./test validate`. Expected: 4,959 passed,
0 failed, 12 ignored, then 8 passed.
