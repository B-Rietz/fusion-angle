# Faster Layer Two Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:executing-plans to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** `./test browser` seeds the mock data once per
run and runs its files in parallel; a starting compose
Postgres is probed every 200 ms. Every test that runs
today still runs and can still fail.

**Architecture:** `tests/browser/fixtures.ts` keeps one
seeded `MemoryStorageBackend` per file and serves each
origin `copy()` of it, the seam
`web-app/app/api-documentation-replay.ts` already uses.
Under the script that backend is rebuilt from rows one
seed landed for the whole run (Task 11).
`bin/test-browser` passes `--parallel` with four workers,
the operator's count, and the worker-name preload
`./test` uses;
a run attached to one Chrome through `CHROME_DEBUG_URL`
stays serial. `compose.yaml`'s `postgres` healthcheck
gains a start period and a start interval. A browser
test that read a late render at once learns to wait for
it, and `pg-explain` pipelines the rows it seeds.

**Tech Stack:** Deno 2.9.8, TypeScript (`strict`,
`noUncheckedIndexedAccess`, `erasableSyntaxOnly`), bash
3.2 (`/bin/bash` on macOS), Docker Compose, Chrome over
CDP.

**Spec:** `docs/superpowers/specs/faster-layer-two-design.md`.
Read it before any task. Line numbers below are as of
`c36020172`; trust the quoted text over the number.

## Questions

1. **Bash 3.2 and an empty array.** `/bin/bash` on macOS
   is 3.2, where `"${EMPTY[@]}"` under `set -u` is an
   unbound-variable error. **Resolution:** the serial or
   parallel choice rides in a plain string expanded
   unquoted, as `bin/build` does with `TARGET_FLAG`.
2. **Where the isolation pin lives.** `startOrigin()`
   already has a Layer 1 pin, `tests/browser-origin.test.ts`,
   which runs with both sanitizers on every `./test`.
   **Resolution:** the new pin joins it there. It needs
   no Chrome, and Layer 1 is where a broken fixture
   should go red first.
3. **`TEST-PLAN.md` AT5** quotes the suite's command and
   says "serially". The file is outside this unit.
   **Resolution:** leave it; report the stale sentence.
4. **An attached Chrome.** With `CHROME_DEBUG_URL` every
   file attaches to the one Chrome the operator started.
   **Resolution:** that run stays serial, exactly as
   today, so no two files ever share a browser at once.

## Global Constraints

- Before every `deno`, `./test`, or `./deploy` command:
  `export DENO_DIR="$TMPDIR/deno-dir"`.
- Each commit passes `./test validate --syntax`.
- `./test browser` needs Chrome, which the sandbox will
  not start: run it outside the sandbox. `git commit`
  writes under `.git/worktrees/` and needs the same.
- Take the 5432 lock in the same shell command as
  anything that binds the port:
  `mkdir /tmp/claude-501/fusion-angle-5432.lock && trap
  'rmdir /tmp/claude-501/fusion-angle-5432.lock' EXIT &&
  <command>`.
- A whole-suite run takes the machine's suite lock the
  same way, `/tmp/claude-501/fusion-angle-suite.lock`,
  before the 5432 lock where it needs both, and holds it
  for one run or one back-to-back A/B pair. The rule
  arrived mid-unit: the trial figures in the spec predate
  it and are marked contended; the before-and-after
  figures and the consecutive green runs were taken
  under it, with CPU seconds (`/usr/bin/time -p`, user
  plus sys) beside wall clock.
- 78-character lines in code and scripts, 4-space indent,
  final newline, no trailing whitespace.
- One concern per commit; a one-line subject of about 50
  characters, present-tense imperative, no body, then the
  `Co-Authored-By` trailer.
- Timings are medians of interleaved runs, with the load
  they were taken at. Before-trees are scratch clones
  under `$TMPDIR`, removed when the unit ends.

## Task 1: Pin that every origin is its own world

**Files:** `tests/browser-origin.test.ts`.

- [ ] Import `type Origin` from `./browser/fixtures.ts`.
- [ ] Append the helpers and the test. One try per
  acquisition, so a later failure still releases the
  earlier origin and the temp directory:

```ts
const IDEAS_PATH = '/api/organizations/'
    + STARK_ORGANIZATION + '/ideas/';

async function ideaHeaders(): Promise<Record<string, string>> {
    return {
        Authorization: 'Bearer ' + await adminToken(),
        'operation-id': generateIdentifier(),
    };
}

async function getIdeaStatus(
    origin: Origin, ideaId: string,
): Promise<number> {
    const response = await fetchDiscardingBody(
        origin.baseUrl + IDEAS_PATH + ideaId,
        { headers: await ideaHeaders() },
    );
    return response.status;
}

async function putIdeaStatus(
    origin: Origin, ideaId: string,
): Promise<number> {
    const response = await fetchDiscardingBody(
        origin.baseUrl + IDEAS_PATH + ideaId,
        {
            method: 'PUT',
            headers: {
                ...await ideaHeaders(),
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                title: 'Written through one origin',
                position: 1,
                problem_statement: 'p',
                target_users: 't',
                proposed_solution: 's',
                expected_outcome: 'o',
                success_metrics: 'm',
                state: 'active',
            }),
        },
    );
    return response.status;
}

// One origin for one body, closed whatever the body does.
async function withOrigin(
    body: (origin: Origin) => Promise<void>,
): Promise<void> {
    const origin = await startOrigin();
    try {
        await body(origin);
    } finally {
        await origin.close();
    }
}

// Every origin is a world of its own, whatever the
// fixture shares to start one: an idea written through
// one is read through no other, neither one open beside
// it nor one opened after.
Deno.test('a write through one origin is read through no other',
async () => {
    const staticRoot = Deno.makeTempDirSync({
        prefix: 'fusion-origin-',
    });
    try {
        Deno.env.set('FUSION_ANGLE_STATIC_ROOT', staticRoot);
        const ideaId = generateIdentifier();
        await withOrigin(async (written) => {
            await withOrigin(async (beside) => {
                assertStrictEquals(
                    await putIdeaStatus(written, ideaId), 201,
                );
                assertStrictEquals(
                    await getIdeaStatus(written, ideaId), 200,
                );
                assertStrictEquals(
                    await getIdeaStatus(beside, ideaId), 404,
                );
            });
            await withOrigin(async (after) => {
                assertStrictEquals(
                    await getIdeaStatus(after, ideaId), 404,
                );
            });
        });
    } finally {
        Deno.removeSync(staticRoot, { recursive: true });
    }
});
```

- [ ] Run the file alone with `./test`'s flags and
  preloads. Expect `ok | 2 passed | 0 failed`: on master
  every origin seeds, so the pin is green before the
  fixture changes. (Trial in a scratch clone of
  `c36020172`: 2 passed.)
- [ ] `./test validate --syntax`; commit
  `Pin that each browser origin is its own world`.

## Task 2: Seed once per file

**Files:** `tests/browser/fixtures.ts`.

- [ ] Replace the `memoryDbAdapter` import with
  `memoryDbAdapterOver` (keep `type MemoryDbAdapter`) and
  import `MemoryStorageBackend` from
  `../../api/backend-memory.ts`.
- [ ] Add above `startOrigin`:

```ts
type FileSeed = {
    readonly backend: MemoryStorageBackend;
    readonly credentials: SeededCredentials;
};

// The mock seed takes about two seconds, so a file lands
// it once and never serves or writes it again. Rows are
// appended and never changed in place, so each origin
// takes them under a backend of its own.
let fileSeed: Promise<FileSeed> | undefined;

function seededOnce(): Promise<FileSeed> {
    fileSeed ??= (async () => {
        const backend = new MemoryStorageBackend();
        const credentials = await postMockDataLoad(
            memoryDbAdapterOver(backend),
            { hashPassword: testHashPassword },
        );
        return { backend, credentials };
    })();
    return fileSeed;
}
```

- [ ] In `startOrigin`, replace the `memoryDbAdapter()` and
  `postMockDataLoad` lines with:

```ts
    const seed = await seededOnce();
    const db = memoryDbAdapterOver(seed.backend.copy());
```

  and return `credentials: seed.credentials`.
- [ ] Add "one mock seed per file" to the header comment's
  list.
- [ ] **Red check, not committed:** serve `seed.backend`
  itself instead of its copy and run Task 1's file. The
  pin must fail on `beside` or `after` reading 200.
  Restore the copy; the pin passes.
- [ ] `./test validate --syntax`; `./test browser` green,
  164 passed; commit `Seed the browser suite once per
  file`.
- [ ] Measure: three whole serial runs of this tree
  interleaved with master's, medians and spread into the
  report.

## Task 3: Wait for what a test reads at once

A parallel run starves the pages, and a test that reads
a late render the moment an earlier one appears goes red
when the page falls behind. That is a wait the suite
needs before its files run together.

**Files:** `tests/browser/former-member.test.ts`, and any
other test the trial runs show reading at once what
lands late. Each is its own commit.

- [ ] `ideas/ lists its cards after B28 removed a
  submitter (D1)`: `web-app/ideas/index.ts` fills each
  card's submitter "on its own read after the list
  paints", and the test asserts `Former member` at once
  after six cards exist (red in trial run 3 of 6 at 16
  jobs, load 77–100). Wait for the label, then read the
  error card, which now is read after the submissions
  land:

```ts
            assert(cards >= 6);
            // Each card's submitter lands on its own read
            // after the list paints.
            await page.until(
                `document.body.textContent.includes('Former member')`,
                'a former member on a card',
            );
            assertStrictEquals(
                await page.evaluate<boolean>(ERROR_CARD), false,
            );
```

  `page.until` throws when the label never comes, so the
  expectation is the same one and can still fail.
- [ ] `./test validate --syntax`; commit `Wait for the
  former member's name on its card`.
- [ ] A further red in the trial or stability runs gets
  the same treatment only when the product code shows
  the read lands late by design. A red that is not such
  a wait is a finding, and stops the task.

## Task 4: Run the files in parallel

**Files:** `bin/test-browser`, `AGENTS.md`.

- [ ] In `bin/test-browser`, the header comment says the
  files run in parallel and when they do not. Before the
  `deno test` line:

```bash
# A launched Chrome is one per file, so the files run
# together, four at a time. The operator often runs
# other threads beside a suite, so it takes four workers
# and never a worker per CPU, where each worker also
# drives a Chrome of several processes. A DENO_JOBS the
# shell exports wins. An attached Chrome is one browser
# for every file, so those files run one at a time.
BROWSER_FILE_WORKERS=4
SCHEDULE=''
if [ -z "${CHROME_DEBUG_URL:-}" ]; then
    SCHEDULE='--parallel'
    export DENO_JOBS="${DENO_JOBS:-$BROWSER_FILE_WORKERS}"
fi
```

  The `deno test` line gains `$SCHEDULE` (unquoted, as
  `bin/build` expands `TARGET_FLAG`) and `--preload
  ./tests/worker-name-prefix.ts`, with the comment block
  naming why: workers share one process, where
  `BroadcastChannel` and `navigator.locks` name
  process-wide buses.
- [ ] `AGENTS.md`, the paragraph that begins "`./test
  browser` needs Chrome": replace "under `deno test`
  serially" with the parallel account and the attached
  case.
- [ ] `./test lint`; `./test validate --syntax`.
- [ ] Under the suite lock: three workers and four,
  back to back, to choose between them; then five
  consecutive whole-suite green runs at the count
  chosen, and one green run attached to a Chrome through
  `CHROME_DEBUG_URL`. A red run resets the count and is
  read before anything else happens.
- [ ] Commit `Run the browser suite's files in parallel`.
- [ ] Measure: three runs interleaved with Task 2's tree.

## Task 5: Probe a starting Postgres every 200 ms

**Files:** `compose.yaml`.

- [ ] Under the `postgres` healthcheck, after
  `retries: 15`:

```yaml
            start_period: 30s
            start_interval: 200ms
```

- [ ] `./test lint`; `./test validate --syntax`.
- [ ] Under the lock: `./test postgres` three times on
  this tree interleaved with master's; expect the same
  132 passed and about 1.5 s less.
- [ ] Commit `Probe a starting Postgres every 200 ms`.

## Task 6: Pipeline `pg-explain`'s rows

**Files:** `tests/pg-explain.test.ts`.

- [ ] Trial in a scratch clone: issue `seedRows`' appends
  without awaiting each and time the file alone against
  one Postgres, under the lock, master and the trial
  alternating. Take the change only if it saves seconds
  and all fifteen `EXPLAIN` tests stay green; otherwise
  record the numbers in the spec's rejected list.
- [ ] `appendRow`, `putAuthorize`, and `seedMembershipRows`
  stop taking a `Tx` and return the rows they form
  (`messageRow`, `authorizeRow`, `membershipRows`);
  `seededRows()` gathers every row in the order it
  lands; `seedRows` awaits them, then issues every
  `tx.append` in order inside one transaction and awaits
  them together. Drop the `Tx` import.
- [ ] Under the lock, `./test postgres`: 132 passed.
- [ ] `./test validate --syntax`; commit `Pipeline the
  rows the plan pins read`.

## Task 7: Record what the trials decided

- [ ] Fill the spec's "Open decisions" with the worker
  count's runs and Task 6's outcome. Amend into the
  design-and-plan commit at the squash.

## Task 8: Review

- [ ] This session may not dispatch, so the coordinator
  dispatches the independent reviewer with the spec path
  and `git diff master...HEAD`, and brings back its
  findings. Before that, re-read the whole diff cold
  against the spec, asking of each hunk whether a test
  now proves less or could now flake.
- [ ] Verify each finding before acting. Fix the real
  ones, each in its own commit; record the rejected ones
  with the reason.

## Task 9: What the review found

Six findings; each was verified, and none was rejected.

- [ ] **Chrome's profile removal races its exit.**
  `tests/browser/fixtures.ts`: `releaseChrome(chrome,
  userDataDir)` kills the tree, awaits `chrome.status`
  under `CHROME_EXIT_TIMEOUT_MS`, and removes the
  profile in its `finally`; `removeProfile` retries a
  removal that answers `ENOTEMPTY`, three attempts with
  backoff and jitter. `Browser.close()` and the launch
  catch both call it, and `Browser` keeps the
  `Deno.ChildProcess`. Pin:
  `tests/browser/chrome-release.test.ts`, green with the
  wait and red without it, ignored on an attached run.
  Remove TODO.md's item. Commit `Wait for Chrome to exit
  before removing its profile`.
- [ ] **A run killed from outside strands profiles.**
  `bin/test-browser` makes one `RUN_DIR`, bundles into
  `$RUN_DIR/site`, and runs `deno test` with
  `TMPDIR="$RUN_DIR/tmp"`; the exit trap removes
  `RUN_DIR`. Correct the two line numbers TODO.md cites
  for `FUSION_ANGLE_STATIC_ROOT`. Commit `Keep a browser
  run's temp files in one directory`.
- [ ] **Nothing pinned that an attached run stays
  serial.** A text pin in `tests/test-cli.test.ts`,
  green on the script and red when `--parallel` is made
  unconditional; it lands with the parallel commit.
- [ ] **`start_interval` has a Docker floor.** Confirmed
  in Docker's Dockerfile reference: Engine 25.0. One
  comment line in `compose.yaml`.
- [ ] **The spec's worker count had no locked figure,**
  and decision 3 misdescribed Docker's events. Record
  the locked runs and correct the sentence.
- [ ] **The spec rejected "one seed for the whole run" on
  two wrong facts.** Re-measure the landed rows and
  correct the paragraph; build nothing.

## Task 10: Finish

- [ ] Squash locally to the design-and-plan commit plus
  one commit per feature. Tree clean.
- [ ] Hand the coordinator one runner script for the
  final commit: five consecutive `./test browser` runs
  at the script's own worker count, stopping at the
  first red and counting stranded profiles after each;
  one run attached to a Chrome; one `./test postgres`;
  one `./test validate`. Every run under the suite lock,
  `DENO_JOBS=4`, refusing to start unless HEAD and a
  clean tree match.
- [ ] Compare each suite's passed count with master's:
  browser 164 plus the release pin (165; attached, 164
  and 1 ignored), Postgres 132, and Layer 1's 4950 plus
  the isolation pin and the attached-run pin (4952).
- [ ] Remove the scratch clones, confirm no Chrome, no
  compose stack, and no `fusion-browser-*` profile is
  left behind.

## Task 11: One seed for the run

The operator's ruling: "I'd love the run-wide seed for
the browser suite, 39 secs is a lot of waste." The spec's
decision 5 holds the design and each case's rule.

**Files:** `tests/browser/fixtures.ts`,
`tests/browser/land-run-seed.ts`, `bin/test-browser`,
`tests/browser-run-seed.test.ts`,
`tests/browser/run-seed.test.ts`,
`tests/test-cli.test.ts`, `AGENTS.md`, `TODO.md`, the
spec.

- [ ] Red first: `tests/browser-run-seed.test.ts` against
  a `fileSeedFrom(path)` that ignores its path and seeds,
  as a file does today. Every test fails: the rebuilt
  rows and sign-ins differ from the landed ones, and no
  refusal rejects.
- [ ] `fixtures.ts`: `RUN_SEED_ENV`, `writeRunSeed(path,
  seed)` (`{ rows, credentials }` with `createNew` and
  mode 0444), `landRunSeed(path)` (seed, then write),
  the shape check at the read, quoting nothing of the
  file, `fileSeedFrom(path)` (none named: seed; empty:
  refused by the variable's name; named: read, check,
  rebuild in one `seedTransaction`, every `append`
  answering true), and `seededOnce()` naming
  `fileSeedFrom(Deno.env.get(RUN_SEED_ENV))`.
- [ ] `tests/browser/land-run-seed.ts`: one argument, the
  path; lands the seed.
- [ ] `tests/test-cli.test.ts`: the script names the seed
  in `$RUN_DIR` and lands it before `deno test`. Red on
  the script as it stands.
- [ ] `bin/test-browser`: after the bundle, export
  `FUSION_ANGLE_BROWSER_SEED="$RUN_DIR/seed.json"` and
  `deno run --frozen --allow-env=JWT_HMAC_SIGNING_KEY
  --allow-write="$RUN_DIR"` the landing, `TZ=UTC` as the
  files run.
- [ ] `tests/browser/run-seed.test.ts`: an origin's rows
  and sign-ins are the named seed's; ignored when none
  is named.
- [ ] Each new pin red under a scratch mutation, not
  committed: the rebuild drops a row; a missing file
  falls back to a seed; the parse error goes unnamed; a
  repeated row is taken quietly; the shape check is
  skipped; the mode or `createNew` is dropped; the empty
  name reaches the file system; `seededOnce()` ignores
  the name; the rebuild takes the file's sign-ins but
  rows of its own seed. The isolation pin
  still fails when an origin serves the seeded backend
  itself.
- [ ] A handful of browser files through the script's
  own steps, launched and attached, outside the sandbox.
- [ ] `./test lint`; `./test validate --syntax`; commit
  `Seed the browser suite once per run`.
- [ ] Hand the coordinator a gate script: the tree before
  and after, under one lock hold each pair, both orders;
  five consecutive whole runs; one attached; Postgres;
  Layer 1.
- [ ] Review findings, each verified and taken: the
  repeated-row pin writes two literal rows in place of a
  second cold seed; TODO.md's env citation names the new
  line numbers and the seed's variable; the mode and
  `createNew` are pinned through `writeRunSeed`; the
  landing's env permission is scoped to the signing key;
  the Layer 2 pin compares rows as well as sign-ins; a
  parse refusal keeps no cause; an empty name is refused
  by name; the stale spec and AGENTS.md sentences, the
  inferred UTC-day hazard, and the result are recorded.
