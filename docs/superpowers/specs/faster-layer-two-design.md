# Faster Layer 2

Branch and worktree `faster-layer-two`. Builds on master's
`c36020172` ("Name production and guard worktree
creation").

## Intent

The operator's diagnosis is that testing time dominates
development throughput, and the ask is to "discover, spec,
plan, implement, review/fix ways … to make the tests run
faster." This unit owns everything past the inner loop:
`./test browser` (Layer 2's deterministic browser suite),
`./test postgres`, `./bin/build` and the client bundle,
and the gate chain `./deploy --local` runs before it
serves. Layer 1 (`./test`, `./test validate`) belongs to
another unit and is not touched here.

The covenant the speed may not be traded for: every test
and assertion that runs today still runs and can still
fail; each suite keeps the sanitizer flags it carries
today; `--frozen` stays; each test stays an isolated
world; `./test postgres` keeps a compose project of its
own; nothing that waits on a real condition becomes a
guess.

## How the numbers were taken

One 16-core machine, shared with three sibling workers
for the whole session.

**Every figure outside "Taken under the suite lock" is
contended.** Those were taken before the machine had a
suite lock, with the siblings' own whole suites running
beside them. The one-minute load average ran from 7 to
103 while they were taken, and the same suite ran 1.2× to
2.5× slower from one run to the next with no change to
the tree. Each wall-clock figure is given with the load
it was taken at. Read them for where the seconds go and
for the order of the candidates, not for the size of a
speedup. The sizes are in "Taken under the suite lock":
one suite on the machine at a time, each before and after
back to back, CPU seconds (`/usr/bin/time -p`, user plus
sys) beside wall clock.

The profile came from a temporary patch to
`tests/browser/fixtures.ts` and
`web-app/app/cdp-client.ts` that appended one line per
phase (seed, sign-in, body, poll sleeps, Chrome launch) to
a file. The patch was never committed. The first trial
runs ran in this worktree on uncommitted edits, which
were then reverted; the later ones ran in scratch clones
under `$TMPDIR`.

## Where the seconds go

### `./test browser` on master

Two whole runs: 847.6 s (load 20–58) and 691.6 s (load
7–30, the profiled run). Each printed `ok | 164 passed | 0
failed`. The profiled run, by phase:

| Phase | Count | Sum | Share | Median |
|---|---|---|---|---|
| Mock seed, one per origin | 174 | 466.5 s | 67% | 2.0 s |
| `pollUntil` asleep, 200 ms each | 721 sleeps | 144.2 s | 21% | — |
| `stays` windows (bounded negatives) | 40 | 35.5 s | 5% | 0.5 s |
| Chrome launch, one per file | 36 | 11.1 s | 1.6% | 0.29 s |
| Browser context and page | 121 | 9.1 s | 1.3% | 0.07 s |
| `bundle_client` | 1 | 2.4 s | 0.3% | — |
| Chrome close, one per file | 36 | 1.6 s | 0.2% | 0.04 s |
| Origin close, context dispose | 242 | 0.4 s | — | — |

The rest is page loads, CDP round trips, and the tests'
own work. Sign-in through the page is 51.3 s of it (121 ×
0.42 s) and the bodies `withAdminPage` runs are 94.1 s;
both figures include the poll sleeps inside them.

Three facts carry the design.

- **The seed is two thirds of the suite.** `startOrigin()`
  runs `postMockDataLoad` for every origin: the rehearsal
  on scratch memory (4.4–4.9 s at load 24) and the landing
  (1.0–1.2 s). A seed is 2.0 s warm at load 8, and the
  first one in a file's fresh isolate is 4.3 s on average.
  The suite opens 174 origins in 36 files.
- **Every wait is quantized to 200 ms.** 642 of 1,307
  polls slept at least once, and 608 of those slept
  exactly once: the condition came true inside the first
  200 ms. `measurements/budgets.json` puts every page's
  `readyMs` between 25 and 93 ms, so most of each sleep
  is spent after the condition already holds.
- **The files are independent and run one at a time.**
  Each file has its own Chrome and its own profile
  directory, each origin listens on port 0, and each test
  has its own browser context. Nothing but the machine is
  shared across files.

### `./test postgres` on master

One run, 35.5 s (load about 25), `ok | 132 passed | 0
failed`:

| Phase | Time |
|---|---|
| `docker compose up -d --wait postgres` | 3.15 s |
| `tests/pg-explain.test.ts` (15 tests) | 10.7 s |
| `tests/pg-seed.test.ts` (17 tests) | 10.0 s |
| `tests/pg-ledger-seed.test.ts` (8 tests) | 5.7 s |
| The other nine files | 5.1 s |
| `docker compose down` | 0.35 s |

`pg-explain` spends its time in `beforeAll`, appending
about 12,300 rows one statement at a time so the planner
has volume to choose indexes on. `pg-seed` and
`pg-ledger-seed` spend theirs in the seed they exist to
test.

### `./bin/build --no-zip` on master

One run, 5.7 s: `bundle_client` 2.2 s, `deno compile`'s
type check 1.9 s, compile and embed 1.1 s, git and setup
0.5 s.

### The `./deploy --local` gate chain

`./test validate` (another unit's), then `./test
postgres` (35.5 s), then `./test browser` (692–848 s),
then its own compose stack. The browser suite is 95% of
what this unit owns in that chain.

## Decisions

The operator delegated discovery through fix, so nothing
here waited for approval. Each decision below names the
choice and the reason.

### 1. One mock seed per file; each origin takes a copy

`tests/browser/fixtures.ts` seeds one
`MemoryStorageBackend` the first time a file calls
`startOrigin()` and keeps it. Every origin, that first
one included, serves `memoryDbAdapterOver(seeded.copy())`
and reads the credentials the one seed returned.

`MemoryStorageBackend.copy()` is the product's own seam:
"The same rows under a backend of its own: a write on
either is never seen by the other. Rows are appended and
never changed in place, so the two share them."
`openReplayStage()` in
`web-app/app/api-documentation-replay.ts` already seeds
once and hands out copies this way. The seeded backend is
never served and never written after the seed lands, so
it is a value, not shared state. A copy measured 0.004 to
0.063 ms.

Each test stays an isolated world: its own backend, its
own listener, its own browser context. What a test loses
is a seed of its own, which no test asserts on: the
credentials, the seeded ids, and the seed's `requestAt`
are now one per file, not one per origin. No browser test
reads a seeded time against the clock; the status tests
fix their own commit times.

Deno gives each test file an isolate of its own, so the
memo is per file and no file sees another's seed.

- **Trial:** 388.4 s whole suite, serial (load 20–26),
  `ok | 164 passed | 0 failed`, against 691.6 s and
  847.6 s. Seed time fell from 466.5 s to 156.5 s: 36
  cold seeds, 138 copies.
- **Pin:** `tests/browser-origin.test.ts` (Layer 1, where
  the origin's existing pin lives) gains a test that a
  write through one origin is read through no other,
  neither one open beside it nor one opened after. It
  passes on master, where every origin seeds, and must
  keep passing: it is the covenant written down, not a
  test of the memo.
- **Why not one seed per run:** see the rejected list.

### 2. Run the browser files in parallel

`bin/test-browser` passes `--parallel`, as `./test` does
for the memory suite. The unit of isolation does not
move: one Chrome per file, one CDP socket per file, one
origin and one browser context per test, the resource
sanitizer on, the ops sanitizer off for the reason the
script's comment records.

Under `--parallel` every file is a worker in one process,
and `BroadcastChannel` and `navigator.locks` name
process-wide buses and locks. The browser suite's Deno
side builds API clients (`tests/in-page-facade.ts`), so
it takes the preload the memory suite already uses for
exactly this, `tests/worker-name-prefix.ts`. The
`localStorage` stub is already a preload and is per
worker.

- **Trial (seed per file, 200 ms polls):** 83.7 s at 16
  workers (load 48), 76.1 s at 8 (load 42), 150.7 s at 4
  (load 49), each `ok | 164 passed | 0 failed`, against
  388.4 s serial.
- **Four workers, the operator's decision.** The trial
  first chose one worker per two CPUs, eight here: at
  Deno's default of a worker per CPU the suite starved
  itself (median sign-in 673 ms and Chrome launch
  2,138 ms at 16 workers, against 435 ms and 499 ms at 8
  and 423 ms and 289 ms serial). The operator then ruled:
  "I'm often running parallel threads, so deno test
  threads should probably be 3-4." So the count is a
  fixed three or four, never a share of the cores, and
  nothing here depends on taking more. The script names
  it `BROWSER_FILE_WORKERS` with that reason beside it,
  and a `DENO_JOBS` the shell exports wins. Four was
  chosen over three by the runs under "Open decisions".
- **An attached Chrome stays serial.** With
  `CHROME_DEBUG_URL` every file attaches to the one
  Chrome the operator started. Running those files
  together would share a browser across files, which no
  run does today, so that path keeps today's schedule.
  `tests/test-cli.test.ts` pins it: the script names
  `--parallel` once, under the test for no attached
  Chrome.
- **A wait the trial found.** Six whole runs at 16
  workers under load 69–103 gave five green and one red:
  `tests/browser/former-member.test.ts`, "ideas/ lists
  its cards after B28 removed a submitter (D1)", read
  `Former member` at once after six cards existed.
  `web-app/ideas/index.ts` fills each card's submitter
  "on its own read after the list paints", so the test
  raced the product's second paint and the 200 ms poll
  usually hid it. The test now waits for the label, then
  reads the error card. `page.until` throws when the
  label never comes, so the expectation is unchanged and
  the error card is now read after the submissions land,
  which is later than before, never earlier. Any further
  red of this kind gets the same remedy only where the
  product code shows the read lands late by design; a red
  that is not such a wait stops the work.
- **Stability:** a scheduling change is shown stable by
  consecutive green whole-suite runs, at least five,
  taken under the suite lock. The count is reported with
  the result.

### 2a. A Chrome exits before its profile is removed

Each file's `afterAll` killed its Chrome and removed the
profile at once. A Chrome still exiting writes into its
profile, so the removal either answered `Directory not
empty` from `afterAll`, failing a file whose tests all
passed, or won and left what the late write put back.
TODO.md carried this from a serial run on master. Four
Chromes at a time widen the window, and two green trial
runs at 16 workers each left a profile behind, so the fix
lands here and its TODO.md item goes.

- `releaseChrome` in `tests/browser/fixtures.ts` kills
  the tree, awaits the child's exit status under a 10 s
  bound, then removes the profile. A removal that still
  answers not empty is transient, a helper started after
  the kill's `ps` snapshot, and is tried three times
  with backoff. `Browser.close()` and the launch failure
  path both go through it.
- **Pin:** `tests/browser/chrome-release.test.ts` reads
  the exit the moment the release returns, before the
  event loop turns, and then that the profile is gone.
  Green five times of five; red three of three with the
  wait removed. An attached run launches no Chrome and
  may have none it could launch, so there the pin is
  ignored: 164 passed and 1 ignored.
- **One directory for the run.** `bin/test-browser` now
  makes one directory that holds the bundle and, through
  `TMPDIR`, every temp directory the suite makes, each
  profile among them. Its exit trap removes it whole, so
  an interrupted run leaves no profile behind. Chrome
  starts with a `TMPDIR` of 98 characters; the operator's
  default makes one of 74.
- **Not closed:** a `deno` killed alone leaves its
  Chromes running, as it always has, one then and up to
  four now. Nothing in the script or the harness kills
  `deno` alone, and a trap that kills processes by
  pattern is more machinery than that case has earned.

### 3. Probe a starting Postgres every 200 ms

`compose.yaml`'s `postgres` healthcheck runs `pg_isready`
every 2 s, and Docker runs the first probe one interval
after the container starts. So `up -d --wait postgres`
answers at 2 s at the earliest, and at 4 s when the first
probe lands a moment too soon. The service gains
`start_period: 30s` and `start_interval: 200ms`: Docker
probes every 200 ms until the first success, then every
2 s as before. The condition is the same `pg_isready`
over TCP; only how soon Docker looks changes. Docker
announces the change with a `health_status` event, which
`up --wait` already waits on; the probe that leads to it
is Docker's own, and its cadence is all this sets.

- **Measured:** five interleaved pairs of `up -d --wait`
  then `down`, in projects of their own, at load 8–10
  with a browser suite of this unit's running beside
  them. Today: median 2.89 s (2.87–5.01 s). With the
  start interval: median 1.39 s (1.36–1.41 s). That is
  1.5 s off every start, and the 5 s outlier gone.
- **Reach:** `./test postgres` once; `./deploy --local`
  twice (the suite's stack, then its own); `./bin/develop`
  and a local `./bin/measure` sweep once each.
- **Cost:** a Postgres that never starts is declared
  unhealthy after 60 s where it was 30 s: probes inside
  the start period do not count against `retries`.
- **Floor:** Docker's Dockerfile reference says of the
  start interval, "This option requires Docker Engine
  version 25.0 or later." This machine runs 29.9.3, and
  `compose.yaml` names the floor beside the setting.

The `server` service's healthcheck is left alone: it is
not in a gate, and each probe spawns a `deno eval`.

### 4. Pipeline `pg-explain`'s rows

`tests/pg-explain.test.ts` appends about 12,300 rows in
`beforeAll` so the planner has volume to choose indexes
on. `seedRows` awaited each `tx.append` in turn, a round
trip a row. It now forms every row first, so the hashes
run outside the transaction, then issues the appends in
order and awaits them together. The driver pipelines them
on the transaction's one connection, so the table holds
the same rows in the same order and every `EXPLAIN`
assertion reads the same table.

- **Measured:** the file alone against one Postgres,
  master and the rewrite alternating, ten pairs. The
  rewrite was faster in all ten; the median saving was
  5.3 s. At load 24–34 the file took 6.8–10.3 s on master
  and 2.4–5.0 s rewritten. All fifteen tests passed in
  every run.

## Open decisions

Each was settled by a measurement.

- **Three workers or four.** Under the suite lock, the
  branch at three then four, then four then three, each
  `ok | 164 passed | 0 failed`:

  | Workers | Wall | CPU | Load |
  |---|---|---|---|
  | 3 | 105.4 s | 351.1 s | 2.7→7.4 |
  | 4 | 88.4 s | 371.7 s | 7.4→10.5 |
  | 4 | 93.7 s | 426.9 s | 10.5→13.9 |
  | 3 | 107.2 s | 373.4 s | 13.9→11.0 |

  Mean wall 106.3 s at three and 91.1 s at four. The
  rule set beforehand was four only if it bought a tenth;
  it bought 14%. Four stands.
- **Whether 8 workers hold green.** Six whole trial runs
  at 8 workers with the `former-member` wait in place,
  load 61–81: six green, 104–159 s. The operator's ruling
  then set the count to three or four, so this stands
  only as evidence that the files run together cleanly.
- **`pg-explain`'s seeding.** Taken, as decision 4.

## Taken under the suite lock

One suite on the machine at a time; `DENO_JOBS=4` in the
shell. These ran on `3de2d9805`, before the review's
fixes; the fixes' own runs are in the report.

**`./test browser`**, each `ok | 164 passed | 0 failed`:

| Tree | Wall | CPU | Load |
|---|---|---|---|
| master, serial | 759.5 s | 814.3 s | 21.6→21.4 |
| seed once per file, serial | 357.1 s | 406.2 s | 8.5→14.4 |
| the branch, 4 workers, five runs | 87.8–93.7 s, median 90.1 s | 371.7–426.9 s, median 388.5 s | 7–14 |
| the branch attached to one Chrome, serial | 284.2 s | 295.4 s | 12→5 |

The unit's result is the third row against the first:
759.5 s to about 90 s. The seed is the CPU that went;
the workers are the wall clock. Chrome is detached from
the script, so its CPU may not be in these figures. The
five runs at four workers are consecutive and green, and
none of them, nor the two at three, left a profile.

**`./test postgres`**, each `ok | 132 passed | 0 failed`,
master then branch, then branch then master:

| Pair | master | branch |
|---|---|---|
| first | 22.9 s wall, 12.4 s CPU | 16.1 s wall, 12.4 s CPU |
| second | 36.6 s wall, 21.0 s CPU | 27.5 s wall, 18.9 s CPU |

The branch was 6.8 s and 9.1 s shorter. Most of it is
waiting, the round trips and the compose start, which
CPU seconds do not see.

**Layer 1.** `./test validate` on the branch: 4951
passed, 0 failed, 12 ignored, and 8 in the timezone pass
(283.8 s wall, 1079.0 s CPU). `./test` on master: 4950
passed, 0 failed, 12 ignored, and 8. The one more is the
isolation pin.

## Measured and rejected

- **A 20 ms poll in place of 200 ms.** The largest thing
  left: 144.2 s asleep in a serial run, and a trial at 8
  jobs slept 57.2 s where the 200 ms run slept 160 s. It
  is rejected for this unit because the suite's waits
  lean on the slack. The second trial run (16 jobs, load
  47) failed `tests/browser/canvas-keyboard.test.ts`,
  "typing in a panel field goes on after its save", with
  `Tab never reached node`: `openFlow` returns when the
  first node exists, and the test tabbed through a canvas
  that was still settling. A 200 ms quantum hides that
  kind of wait; a 20 ms one finds it, one run in some
  number. Each such wait has to name a sufficient
  condition first, test by test, which is a unit of its
  own. A faster poll would also still be a poll: CDP has
  no event for "this expression became true", and an
  in-page wait on animation frames stalls on a hidden
  page and dies with a navigation. `./bin/measure` shares
  `POLL_MS` and must not change either, since a probe
  inside a page's 25–93 ms boot is load on what it
  measures.
- **One Chrome for the whole run.** `Browser.launch()`
  already attaches to `CHROME_DEBUG_URL`. Launch and
  close cost 12.7 s of a 692 s serial run, 0.33 s a file,
  and in a parallel run they overlap. One shared Chrome
  would make one crash or one leaked target every file's
  failure. Rejected: shared state for 2%.
- **One seed for the whole run,** landed once before the
  files start and read by each. Not built: TODO.md
  reserves seed caching for tests to the operator. It is
  the largest cost left. The 36 cold seeds are 156.5 s of
  CPU in the serial trial, about 39 s of wall at four
  workers. The landed backend holds 2,553 rows of 19
  fields each, every one a string: 8.79 MB as JSON. A
  backend rebuilt from that JSON through
  `seedTransaction` and `tx.append` took 45 ms and read
  back byte for byte the same, against 1,962 ms for the
  seed it replaced. (An earlier draft of this paragraph
  measured the rehearsal's rows, which carry byte
  arrays, and said the backend had no such seam. Both
  were wrong.) What it would take: `bin/test-browser`
  runs one seed after the bundle and writes the rows and
  the credentials into the run's directory;
  `seededOnce()` reads that file and rebuilds its
  backend, and every origin still takes `copy()`. The
  isolation pin holds as it stands, since it pins the
  copy, not where the rows came from. The file is made
  and removed with the run, so nothing outlives the tree
  it was seeded from. The recommendation is to take it,
  as a unit of its own, once the operator rules.
- **A cache of the client bundle** keyed by the tree.
  `bundle_client` is 2.2–2.4 s, 0.3% of the serial suite
  and under 3% of the parallel one, and "bundles on any
  tree" is a property the suite states. A cache would
  have to see every input `deno bundle` sees or serve a
  stale page. Rejected: no absolute scale.
- **A session cookie in place of the page's sign-in.**
  Sign-in is 51.3 s serial, 0.42 s a test, most of it two
  poll sleeps. Every one of those 121 tests proves today
  that the sign-in page signs in; a planted cookie would
  stop proving it. Rejected: test weakening.
- **Shorter `stays` windows.** 35.5 s across 40 windows.
  A window is the whole of a bounded negative assertion;
  a shorter one proves less. Rejected.
- **`./test postgres` in parallel.** The twelve files'
  tests take 31.5 s and the longest file 10.7 s, so at
  most 20 s. They share one database: the files have
  schemas of their own, but `pg-races` decides by
  `pg_stat_activity` and takes advisory locks, and both
  are database-wide. Safe only with a database per file.
  Rejected: shared mutable state.
- **A Postgres kept up between runs.** 3.5 s. The suite's
  own compose project, made and removed each run, is the
  covenant. Rejected.
- **`deno compile --no-check`.** 1.9 s of a 5.7 s build.
  AGENTS.md records that check as a deliberate gate.
  Rejected.
- **Fewer `deno` processes in `bundle_client`.** Fourteen
  CSS bundles take 0.55 s between them and three
  `hash-static` runs 1.1 s. Under a second to win in a
  script three tools share. Rejected: small efficiency.
- **`./test postgres` and `./test browser` at once in
  `./deploy --local`.** At most the shorter suite, about
  33 s a deploy, less in practice because a parallel
  browser suite already fills the cores. Two background
  jobs in `deploy` need their own exit-status and trap
  handling, and the first red would no longer stop the
  chain. Not measured beyond that bound. Rejected.

## What changes

- `tests/browser/fixtures.ts` — the per-file seed, the
  copy in `startOrigin()`, and `releaseChrome`.
- `tests/browser-origin.test.ts` — the isolation pin.
- `tests/browser/chrome-release.test.ts` — the pin that
  a released Chrome has exited and left no profile.
- `tests/browser/former-member.test.ts` — the wait for
  the label.
- `bin/test-browser` — `--parallel`, the worker count,
  the preload, the run's one directory, and the comment
  block's account of scheduling.
- `tests/test-cli.test.ts` — the pin that an attached run
  stays serial.
- `compose.yaml` — the `postgres` healthcheck.
- `AGENTS.md` — the sentence that says the browser suite
  runs serially.
- `TODO.md` — the profile-removal item, which lands
  here, and the two line numbers its
  `FUSION_ANGLE_STATIC_ROOT` citation names.
- `tests/pg-explain.test.ts` — rows formed first, appends
  pipelined.

`TEST-PLAN.md` is out of this unit's bounds. Its AT5 item
quotes the browser suite's command and says it runs
"serially"; that sentence goes stale with decision 2 and
is reported to the operator rather than edited.

## Out of scope

- The Layer 3 walk, `./deploy --render`, `./bin/develop`,
  and the measure ceremony (`--record`,
  `--write-budgets`).
- The mock seed's own cost. A rehearsal is 2 s warm and
  it is the largest single thing left in this suite, but
  it is product code under `api/` that the memory suite
  leans on harder still. Reported as a lead.
