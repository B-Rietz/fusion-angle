# A faster Layer 1

Branch and worktree `faster-layer-one`. Builds on master's
`c36020172` ("Name production and guard worktree
creation").

## Intent

The operator's diagnosis is that testing time dominates
development throughput, and the ask is to discover, spec,
plan, implement, and review ways to make the tests run
faster. This unit's lane is the inner loop: `./test` (the
memory suite, a UTC pass and a Honolulu pass) and the
steps `./test validate` composes around it (`deno check`,
lint, and the two generator `--check`s).

The covenant is not for trade. Every test and assertion
that runs today still runs and can still fail.
`--sanitize-ops`, `--sanitize-resources`, and `--frozen`
stay. The UTC and Honolulu passes keep proving what they
prove. Each test stays an isolated world.

## How this was measured

Every figure here was taken on one 16-core machine while
three sibling workers ran their own suites on it. The
one-minute load average ran from 8 to 98 during the work,
so a wall-clock figure means little without the load
beside it, and a single run means little at all.

- **The seed, in process.** `seed-pair.ts` loads two source
  trees side by side in one process and seeds from each in
  turn, the order alternating, so both halves of a pair
  run under the same load. It reports the median of the
  per-round B / A ratios, wall and process CPU.
- **The suite.** `./test` before and after, interleaved,
  several runs each, medians and spread, the load noted.
- **A profile.** `worker-spans.ts` is a fifth preload that
  writes each worker's load span and test span;
  `seed-spans.patch` is a temporary source patch that
  writes each seed's span. `spans.ts` sums them.
  `deno run --cpu-prof` and `profile-self.ts` give self
  time inside a seed.

The probes are committed with this spec under
`measurements/probes/layer-one/`, as they ran. Some
figures came from throwaway scripts that were not kept:
the digest counts, the synchronous digest, the slim
preload, the concurrent hashes, and the table copy.
`measurements/probes/README.md` lists them under "Figures
whose script did not survive".

Partway through, the machine gained a suite lock: one
full suite at a time across every worker. The baseline
runs and the profile below were taken before it, unlocked,
at the loads given, with as many workers as the machine
has CPUs, 16. The before-and-after runs in "Results"
were taken under the lock, by a runner the coordinating
session dispatched, each labeled with the `DENO_JOBS` it
ran at, and so are the ten consecutive runs on the
squashed tip. A figure with no label was taken at 16.

## What is true now

At `c36020172`, Deno 2.9.8:

| Run | Wall | User CPU | System CPU | Load, 1 min |
|---|---|---|---|---|
| `./test`, run 1 | 339.2 s | 1,116.8 s | 382.0 s | 19, then 49–63 |
| `./test`, run 2 | 163.5 s | 1,053.9 s | 312.6 s | 11, then 16 |

Both runs passed the same tests: 4,950 passed, 0 failed,
and 12 ignored over 529 files in the UTC pass; 8 passed
over 2 files in the Honolulu pass.

The steps around the suite, each timed once at a load of
9 to 16:

| Step | Wall |
|---|---|
| `./test check`, nothing changed since the last check | 0.13 s |
| `./test check`, one `shared/` file changed | 7.5 s |
| `./test lint` | 3.4 s |
| `./test schema` | 0.3 s |
| `./test api-docs` | 2.9 s |
| the Honolulu pass, its whole process, at a load of 100 | 1.0 to 1.5 s |

A commit that ran `./test validate --syntax` leaves the
check cached, so `./test validate` is the memory suite
plus about seven seconds. The suite is the cost.

### Where the suite's seconds go

One instrumented UTC pass (223 s wall, load 20 to 70),
summed over its 529 workers:

| Span | Summed | Share |
|---|---|---|
| start to first test: preloads, module graph | 98 s | 4% |
| tests | 2,479 s | 96% |
| of which `seededMockDb()`, 278 calls | 1,934 s | 78% of tests |

The mock seed is rehearsed 320 times in one run: 278
times by `seededMockDb()` in 48 files, and 42 times by
other callers, the API documentation's replay and the
tests that rehearse directly.
Each rehearsal executes 1,626 statements on a scratch
memory backend, and each landing executes them again in
batches. Rehearsals summed to 1,564 s and landings to
455 s.

The longest worker bounds the run. `deno test --parallel`
starts files in name order on 16 slots, and a file is one
worker:

| Worker span | Seeds | File |
|---|---|---|
| 141 s | 41 | `tests/head-reads-collections.test.ts` |
| 130 s | 17 | `tests/drift-flows.test.ts` |
| 106 s | 13 | `tests/drift-phase15-cores-parity.test.ts` |
| 104 s | 12 | `tests/drift-ideas.test.ts` |
| 101 s | 12 | `tests/drift-objectives.test.ts` |

Replaying the 529 spans on 16 slots in file order gives
221 s, against the 223 s the run took, so the replay is a
fair model. With `head-reads-collections.test.ts` in two,
three, or four equal parts it gives 186 s, 185 s, and
185 s. The floor, the summed spans over 16, is 161 s.

### Where a seed's seconds go

Self time over six seeds in one process (10.5 s sampled,
load 9):

| Self time | Where |
|---|---|
| 24.0% | `api/backend-memory.ts`: `successionKeys` 9.4%, `headsOf` 5.7%, the duplicate-id scan 4.1%, `#apply` 2.6%, `latin1` 1.7% |
| 13.4% | idle, waiting on asynchronous digests |
| 11.0% | the garbage collector |
| 7.4% | `parsePreservingNumbers` |
| 5.4% | `Octets.fromLatin1` |
| 5.3% | `Octets.toLatin1` |
| 3.9% | `zoneOffsetMs`, `api/mock-data/scores.ts` |
| 2.7% | `digest` |
| 2.5% | `parseWire` |

The idle time is the digests. One seed awaits
`crypto.subtle.digest` 31,379 times, and each await is a
thread hop to Deno's blocking pool and back. At a load of
76 to 88, a profile of the seed after this unit's changes
is 65% idle: a busy machine makes every hop wait.

The memory backend scans its whole table three times for
every statement, and two of the scans build a string key
for every row. A seed is 1,626 statements against a table
that grows to 2,553 rows, so the scans are the seed's one
quadratic cost.

## The regression

AGENTS.md says `./test` takes 9.5 s. TODO.md says 44.2 s.
Both were true when written, and neither is now.

| Commit | Date | Test files | Digests in one seed | One seed, median (min) | `seededMockDb()` calls per run | `./test` here | `./test` as documented |
|---|---|---|---|---|---|---|---|
| `44447626f` | 2026-09-01 | 401 | 2,906 | 173 ms (162) | 244 | 12.2 s, 12.0 s | 9.5 s |
| `38b16ec75` | 2026-09-23 | | 2,906 | 161 ms (158) | | | |
| `447472141` | 2026-09-23 | | 8,722 | 757 ms (737) | | | |
| `ede4a1114` | 2026-09-24 | 428 | 8,722 | 759 ms (751) | | | |
| `960f2ce88` | 2026-09-24 | 428 | 14,538 | 1,610 ms (1,527) | | | |
| `8b82c6c61` | 2026-09-24 | 427 | 14,548 | 916 ms (877) | 236 | 57.0 s | 44.2 s |
| `31a0d1d8d` | 2026-10-01 | 448 | 28,811 | 1,688 ms (1,612) | | | |
| `cf683f37c` | 2026-10-05 | 450 | 23,301 | 1,372 ms (1,323) | | | |
| `d9d6c1ef3` | 2026-10-15 | 453 | 23,301 | 1,337 ms (1,303) | | | |
| `240fababd` | 2026-10-25 | 460 | 23,385 | 1,472 ms (1,379) | | | |
| `0c6cf890b` | 2026-11-05 | 485 | 30,729 | 2,007 ms (1,944) | | | |
| `c36020172` | 2026-11-21 | 529 | 31,379 | 2,051 ms (1,908) | 278 | 163.5 s, 339.2 s | |

Seed times are `seed-time.ts`, seven seeds in one process,
at a load of 8 to 22. A digest is one call of
`crypto.subtle.digest`, counted through one seed by a
script that was not kept. The old
suites ran from `git archive` snapshots at a load of 8 to
17; each fails the one test that needs a git checkout, and
passes the rest.

The two old suites took 1.28 and 1.29 times their
documented figures on this loaded machine, so the 163.5 s
run is about 127 s on a quiet one. `./test` is 13 times
slower than AGENTS.md says and three times slower than
TODO.md says.

The cause is the seed, and the seed grew with the
digests it awaits. Across these commits a seed's time
over its digests is 55 to 65 µs a digest, apart from the
commits that reworked the write path, and the count went
from 2,906 to 31,379 while the seed went from 173 ms to
2,051 ms. The digests are a share of a seed, not all of
it: re-measured in review at a load of 10 on this
branch, settling them synchronously took a seed from
1,144 ms to 804 ms wall (0.70) and from 1,334 ms to
931 ms CPU (0.69), about a third. The share grows with
the load; see "Left to the operator". Three steps took
the count there:

- `447472141`, "Write each pair through one statement",
  2026-09-23: every write goes through the memory
  backend's statement, which hashes each row five times,
  as the Postgres statement does in SQL. Its parent
  `38b16ec75` seeds in 161 ms with 2,906 digests; it
  seeds in 757 ms with 8,722. The
  `duration-regression-alarm` unit bisected the suite's
  CPU seconds to the same commit, 129 s against 457 s;
  this is that jump seen in one seed.
- `960f2ce88`, "Land the seed through its rehearsal",
  2026-09-24: every statement runs twice, once rehearsed
  and once landed: 14,548.
- Since then the seed's rows have grown from 1,455 to
  2,553, and its digests with them: 31,379.

The same rework brought the two costs this unit removes:
the statement's table scans, and the row's bytes turned
to Latin-1 text a byte at a time.

And the suite seeds more: 278 `seededMockDb()` calls a
run against 244, and 42 rehearsals more from other
callers. `seededMockDb()` time summed is 42 s, then
216 s, then 570 s; over 16 slots that is a floor of 3 s,
then 14 s, then 36 s, before the longest file. The test files grew 32%,
from 401 to 529; loading them is 4% of the run.

## Decisions

The operator delegated discovery through fix. Each open
decision is recorded here with the choice made.

1. **Make the seed cheaper; do not cache it.** TODO.md
   leaves "one rehearsal per test process" to the
   operator. This unit does not build it and does not
   share a seeded backend among tests. It removes waste
   inside one seed, which every caller of the seed keeps,
   and it surfaces the numbers the operator's decision
   needs (see "Left to the operator").
2. **Four workers, the operator's decision.** Partway
   through this unit the operator said: "I'm often
   running parallel threads, so deno test threads should
   probably be 3-4." `run_memory` names the count, four,
   which the runs under the suite lock chose over three
   (see "Results"), and `DENO_JOBS` already in the
   environment still wins for one run on an idle
   machine. A `DENO_JOBS` that names no positive count is
   refused.
3. **The longest file stays whole.** At 16 workers the run
   was bounded by one worker that seeds 41 times, and
   its tests were moved, unchanged, to four files. At
   four workers the run is bounded by its CPU work and
   the split gains nothing, so it is withdrawn.
4. **The preload graph stays.** `tests/hmac-test-key.ts`
   pulls 133 modules into every worker. A slimmer preload
   measures faster, and it is rejected below: it would
   move the moment a worker fixes the seed's day.
5. **One edit to the `test` script:** the worker count,
   its refusal of a value that is no count, and the
   count handed to the two passes alone. Three other
   units edit that file now.
6. **Three product files change, and none changes what it
   computes.** `api/backend-memory.ts` is the memory
   backend, the Postgres backend's test double;
   `shared/http-message/octets.ts` and
   `api/mock-data/scores.ts` run in the product. Each
   change returns the same value for the same input and
   stands on its own as a faster way to compute it.
7. **Six new tests.** The Latin-1 change adds a chunk
   boundary, so one test pins every byte value across a
   megabyte of them. Four pin the worker count at the
   script's surface. One pins, at the memory backend, the
   order its two scans must keep. The zone formatter
   moves no behavior and adds no test: a timing pin would
   be a false prophet.
8. **Order.** The seed changes first, the worker count
   last, each its own feature commit with its own before
   and after.

## Goals

- `./test` passes the same tests with the same assertions,
  plus the six new tests, in less wall-clock time.
- One mock seed costs less CPU, for the tests and for
  every other caller: `./bin/postgres-seed`,
  `./bin/develop`, `./deploy --local`, and the API
  documentation's replay.
- `./test` takes four workers, not the machine, unless a
  run asks for more.
- AGENTS.md and TODO.md state what `./test` and one seed
  cost now.

## Non-goals

- A cache of the rehearsal, or a seeded backend shared
  among tests. The operator's.
- `./test browser`, `./test postgres`, `./bin/build`, and
  `./deploy --local`: the `faster-layer-two` unit's.
- A per-SHA result replay or a duration ledger: the
  `sha-result-cache` and `duration-regression-alarm`
  units'.
- A faster `deno check`, lint, or generator check. They
  are seven seconds of a run that takes minutes.

## Anti-goals

- No test weakened, skipped, merged, or made to share a
  world with another.
- No sanitizer flag, `--frozen`, or TZ pass dropped.
- No change without a measured cost and a measured gain.
- No new dependency, and no `node:` import.

## The changes

### 1. The memory backend reads only the statement's documents

`MemoryStorageBackend.#apply` (`api/backend-memory.ts`)
scans the table for the statement's heads, again for a
duplicate id, and again for every succession key in the
table. `headsOf` and `successionKeys` each build a
`path + '\0' + name` string for every PUT and DELETE row.

A statement's heads and its succession checks read only
the rows of the statement's own documents: a succession
key is `(path, name, supersedes)`, and the statement only
ever asks for keys whose path and name are its own rows'.
So each of the two scans collects those rows, looking a
row's document up by path and then by name with no key
built, and `headsOf` and `successionKeys` read that short
list. The duplicate-id scan stays as it is.

The two scans stay two, and stay where they were: the
heads before the statement is classified, the successions
after. A rehearsal's statements overlap inside its one
transaction, so a statement that awaited its hashes may
find a row another statement wrote meanwhile. A first cut
read both from one scan taken with the heads; `'two
writers of one document in a wave fail the seed'`
(`tests/ledger-seed.test.ts`) went red, as it should, and
the cut was dropped. That test reaches the order only
through the seed's rehearsal, so a backend test pins it
directly: two first versions of one document, written
by two statements in one transaction, land one and
refuse the other with a `SuccessionConflict`
(`tests/backend-tx-memory.test.ts`). It goes red with
the successions read before the classification.

The answers, the conflicts, and the rows written are the
same. A row with no string `supersedes` still claims no
succession key.

Measured: `seed-pair.ts`, 15 rounds at a load of 70 to 78,
ratio 0.85 wall and 0.87 CPU; the CPU median went from
4,310 ms to 3,707 ms.

### 2. Latin-1 text is built a chunk at a time

`Octets.toLatin1` (`shared/http-message/octets.ts`) appends
one `String.fromCharCode(byte)` per byte. The engine
builds a rope with a node per byte, and every later read
of the string pays to flatten it; the collector pays for
the nodes.

It calls `String.fromCharCode.apply` on 8,192 bytes at a
time instead. A chunk is far under any engine's argument
limit. The spread form, `String.fromCharCode(...chunk)`,
was measured too and gains nothing (ratio 1.02), so the
call is `apply`, with one cast to the shape `apply` types.
`TextDecoder('latin1')` is not an option: the label means
windows-1252, which maps 0x80 to 0x9F elsewhere.

Measured on top of change 1: 15 rounds, median wall
1,810 ms to 1,310 ms, ratio 0.73, load not recorded; a
second 15 rounds at a load of 23 to 27, ratio 0.79. The profile's 5.3% self
time understated the cost, which is mostly in the
flattening and the collector.

New test, `tests/http-octets.test.ts`: a megabyte, a
million bytes, holding every byte value comes back as a
million characters with the same codes. It passes before
the change. After it, it pins the hazards the change
brings: a chunk boundary that drops or repeats bytes, a
last partial chunk that is lost (a million is 2^6 times
15,625, so the 8,192-byte chunk, like any power of two
from 128 up, ends on a partial one), and a chunk too
large for one call, which is a `RangeError`.

### 3. One zone formatter for the seed's score instants

`zoneOffsetMs` (`api/mock-data/scores.ts`) builds an
`Intl.DateTimeFormat` on every call, twice per score
instant. The options never change, so the formatter
becomes one module constant beside `BUSINESS_ZONE`.

Measured on top of changes 1 and 2: 15 rounds, median wall
1,345 ms to 1,279 ms, ratio 0.96, load not recorded.

### 4. The suite runs on four workers

`deno test --parallel` starts one worker per CPU unless
`DENO_JOBS` names a count, so `./test` took all 16 cores
and, with every worker's collector and blocking pool,
more than 16 runnable threads. The operator's machine is
usually running other work beside the suite.

`run_memory` takes `DENO_JOBS` as the value already in
the environment, or `MEMORY_SUITE_WORKERS`, four, when
there is none or it is empty. A value that is no
positive integer is refused with an error and exit
status 1 before any pass runs: deno reads `abc` or `0`
as one worker and says nothing. The count is set on the
two `deno test` commands alone and exported to nothing
after them, so `./test validate browser` hands
`bin/test-browser` no count of the memory suite's. The
operator's reason sits beside the constant. A run that
may have the machine says so: `DENO_JOBS=16 ./test`.

Three or four was decided under the suite lock; the
Results section records both, and master's earlier
unlocked run at 16.

New tests, `tests/test-cli.test.ts`, with `deno` stubbed
on `PATH` as `tests/measure-wrapper.test.ts` stubs it,
recording each call's count, whether it runs files in
parallel (deno reads `DENO_JOBS` only then), its zone,
and its subcommand: `./test` hands both passes four
workers when the environment names none, and the count
the environment names, each pass with `--parallel`; a
`DENO_JOBS` of `abc`, `0`, `-4`, `4x`, or ` 4` is
refused before any pass; and under `./test validate` no
deno call but the two passes is handed a count. The last
runs the real lint, a few seconds.

This is a scheduling change, so the whole suite runs
green ten consecutive times at the new count.

## Candidates measured and rejected

- **One rehearsal per test process** (TODO.md). Not this
  unit's to decide. See "Left to the operator".
- **A slim preload.** `tests/hmac-test-key.ts` imports
  `tests/mock-seed.ts` for one function, and with it 133
  modules and 1.43 MB of source in every worker. Two
  hundred one-line test files, five interleaved rounds:
  12.5 s of CPU with the preload as it is, 5.0 s with it
  importing the hasher alone; 37 ms a worker. Half the
  suite's files import that graph anyway; by their
  static imports the workers would load 26,010 fewer
  modules of 102,094 between them, about 8 s of CPU and
  half a second of wall on 16 slots. Rejected: the API
  documentation spec relies on the preload fixing the
  seed's day before any test runs
  (`api-documentation-overhaul-design.md`, "Nothing inside
  `./test` can pin first"), and half a second does not
  buy a change to that.
- **Row hashes computed concurrently.** `hashedRow` awaits
  five digests in turn, and `classifyStatement` awaits its
  rows in turn. With both under `Promise.all`, two early
  pairs gave wall ratios of 1.08 and 0.85 at loads of 45
  to 59, and a later 15-round pair 0.86 wall and 0.90 CPU
  at a load of 58 to 79. A row's four leaf hashes alone
  under `Promise.all`, its rows still in turn: 0.87 wall
  and 0.96 CPU, 15 rounds at a load of 11 to 14. The
  hops are the same number either way; only their waits
  overlap. Rejected: a landing batch would put ten
  thousand digests on the blocking pool at once, and the
  next entry is the same cost with a far larger answer.
- **A synchronous digest.** The root cause's own fix.
  Measured, not built: it needs a ruling. See "Left to
  the operator".
- **A set of the statement's ids for the duplicate scan.**
  4.1% of a seed. A rehearsal statement inserts one to
  three rows, so a set lookup per table row costs more
  than the comparison it replaces. Rejected.
- **A fast path around `parsePreservingNumbers`.** 7.4% of
  a seed. Any shortcut has to decide, without parsing,
  that a JSON text holds no number. Rejected as cleverness
  on the product's number-preserving codec.
- **The table copy per bare statement** (TODO.md, "a cost
  every test write outside a transaction pays,
  unmeasured"). Measured: 0.8 to 1.9 µs to copy 2,300
  rows, about a seeded table. At the 7,318 requests
  TODO.md counts in one run, that is tens of milliseconds
  a run. A phantom cost.
- **The longest file split in four.**
  `tests/head-reads-collections.test.ts` seeds 41 times.
  Its sections were moved byte for byte into four files
  (24, 12, 5, and 8 tests; the 49 names unchanged) and
  the four ran green. Replayed from the measured spans,
  the run goes from 221 s to 185 s on 16 slots, from
  270 s to 234 s on 12, from 351 s to 338 s on 8, and
  not at all on 4: fewer workers make the run CPU-bound
  before its longest file can bound it. Withdrawn when
  the operator set the count to four; the plan keeps the
  line ranges for a day the suite runs wide again.
- **Longest files first.** Naming files ahead of the glob
  would start the long worker at once, with the replay's
  same 16%. Rejected: a file name hard-coded in `test`
  rots silently when another file becomes the longest.
- **`deno check` beside the suite.** The check is 0.13 s
  cached and 7.5 s cold. Running it concurrently would
  interleave two outputs and run the suite on a tree that
  does not type-check, for at most seven seconds.
- **A faster lint.** 3.4 s, of which the `org` scan and the
  retired-vocabulary grep are 2.2 s and 2.3 s timed alone.
  Both could move to another regular-expression engine.
  Rejected for now: re-expressing a lint's pattern in
  another dialect risks a lint that proves less, for
  three seconds, in a file three units are editing.
- **The Honolulu pass beside the UTC pass.** Its whole
  process is 1.0 to 1.5 s at a load of 100.

Not measured, because the covenant forbids it: moving
read-only tests from `seededMockDb()` to `sharedMockDb()`.

## Tests

- `tests/http-octets.test.ts`: the new chunk-boundary
  test, written first.
- `tests/test-cli.test.ts`: the four worker-count tests,
  written first; the default one failed against the
  script as it was, and so did the refusal and the
  validate one against the script that exported its
  count. With `--parallel` dropped from both passes, the
  default and the given-count tests go red.
- `tests/backend-tx-memory.test.ts`: the succession
  order, as change 1 says.
- `tests/api-organization-query.test.ts`: `'matches a
  project by its progress'` failed in 6 of 500 runs on
  a copy of master and 11 of 500 on this branch, and in
  1.3% of sampled ids. Search matches a project by its id
  too, and the query `40%` is the word `40`, so a random
  id holding `40` tied the near project with the exact
  one, and one with a short run one edit from `40`
  matched the far project. Its three projects now take
  ids of letters alone, the near one first by its write
  and by its id, so only the ranking puts the exact one
  ahead. It passed 3,000 runs of 3,000; with the
  ranking's sort removed, or a one-edit match counted as
  none, it goes red. `'groups ideas,
  projects, members in that order'` had the same
  exposure through its reader's id, 8 of 5,000,000
  sampled ids, and takes the same fix. The assertions are
  unchanged.
- Each commit passes `./test validate --syntax`.
- The finished branch passes `./test validate` on a clean
  tree, and its counts are master's plus six tests:
  4,956 passed and 12 ignored over 529 files in the UTC
  pass, 8 passed over 2 files in the Honolulu pass.
- `./test` runs green ten consecutive times on the
  finished branch, at the script's own worker count,
  under the suite lock.
- A mutation check for each product change, run once and
  not committed. The suite goes red with `successionKeys`
  returning an empty set, with the successions read
  before the classification, with `documentRowsOf`
  skipping the statement's own documents, with `toLatin1`
  dropping its last chunk, and with `toLatin1` passing the
  megabyte in one call, and with `toLatin1` dropping a
  trailing partial chunk. One mutant survives and is no
  gap:
  `documentRowsOf` matching by path alone returns more
  heads, which the classifier never reads, so it is the
  same behavior, slower.

## Documents

- AGENTS.md, the Gates paragraph: the worker count, the
  knob that overrides it, and the refusal of a value that
  is no count.
- AGENTS.md, the `./test` timing paragraph: the figure
  measured at the script's own worker count, its
  conditions, and the seed as the cost; the 9.5 s, 9.6 s,
  and 16.2 s figures stay as the dated comparison that
  showed the sanitizers cost nothing.
- TODO.md, the "One rehearsal per test process" bullet:
  its call-site count, and `./test`'s time as measured
  here in place of the medians of a probe that no longer
  runs. The decision stays the operator's. The table-copy
  bullet: its line, and the cost measured here.
- `measurements/probes/README.md`: a `layer-one/` section.

## Results

Under the suite lock, on a quiet machine, back to back,
at the branch's tip before review (master's tests plus
three). CPU is user plus system; load is the one-minute
average before and after.

| Tree | Workers | Wall | CPU | UTC pass | Load |
|---|---|---|---|---|---|
| master `c36020172` | 4 | 188.85 s | 887.0 s | 4,950 passed, 0 failed, 12 ignored | 1.9 to 6.6 |
| this branch | 4 | 125.84 s | 567.3 s | 4,953 passed, 0 failed, 12 ignored | 6.6 to 6.1 |
| this branch | 3 | 161.52 s | 546.0 s | 4,952 passed, 1 failed, 12 ignored | 4.2 to 5.2 |

The Honolulu pass passed 8 of 8 in each run that reached
it; the three-worker run stopped at its one failure, the
flaky test the Tests section fixes. At four workers the
branch takes 33% less wall and 36% less CPU than master.
Four workers took 22% less wall than three for 4% more
CPU, so four stands.

Master's earlier run at deno's default of 16 workers,
unlocked, took 163.5 s wall and 1,366 s CPU at a load of
11 to 16: four times the workers bought 13% less wall
for 54% more CPU, on a machine that was not quiet. More
workers mostly burn CPU.

The ten consecutive runs at the script's own count, and
`./test validate`, run on the squashed tip; the
coordinating session records them.

## Left to the operator

Neither case below is built. Each needs a ruling.

1. **A synchronous digest in the memory backend.** One
   mock seed awaits `crypto.subtle.digest` 31,379 times,
   22.7 MB at 725 bytes a call, and Deno runs every one
   on its blocking pool: a thread hop out and a hop back.
   A run of the suite makes about ten million of them.
   The regression table above is this count. On a busy
   machine each hop waits its turn twice, so the hops
   cost most exactly when the machine is shared: settled
   synchronously they are about a third of a seed at a
   load of 10, and most of its wall at 78 to 83.

   Measured in a throwaway snapshot, not kept, with
   `shared/digest.ts` computing SHA-256 through
   `node:crypto`'s synchronous `createHash` and nothing
   else changed, on top of this unit's three seed
   changes, `seed-pair.ts`, 11 rounds each; the first row
   was re-measured in review:

   | Load | Seed CPU | Seed wall |
   |---|---|---|
   | 10 | 0.69 (1.33 s to 0.93 s) | 0.70 (1.14 s to 0.80 s) |
   | 17 to 21 | 0.63 (1.47 s to 0.99 s) | 0.63 (1.29 s to 0.83 s) |
   | 39 to 51 | 0.39 (2.6 s to 1.1 s) | 0.46 (5.1 s to 2.4 s) |
   | 78 to 83 | 0.32 (4.2 s to 1.2 s) | 0.12 (35.3 s to 4.8 s) |

   Against master, a seed with both is 0.25 of its CPU
   and 0.33 of its wall (11 rounds, load 39 to 63). That
   is larger than everything this unit built.

   The only synchronous SHA-256 the platform has is
   `node:crypto`, and AGENTS.md keeps
   `server/scrypt-hash.ts` the one product `node:`
   import. Four fifths of the digests, 25,530 of the
   31,379, are the memory backend's: its statement hashes
   each of 2,553 rows five times, in the rehearsal and
   again in the landing, where Postgres hashes inside its
   own statement. The rest form the messages. So the
   smallest fix is the memory backend's alone: its
   classifier takes its hashes from a synchronous SHA-256
   in a Deno-only module beside it, as Postgres takes
   them from SQL. The values are the same; no test swaps
   anything in; the product's seed rehearses faster too;
   the browser's digest, the request path's digests, and
   `shared/digest.ts` do not change. The cost is a second
   product `node:` import and the AGENTS.md section that
   counts them. A wider fix, every digest on the server
   through a synchronous primitive registered at boot as
   scrypt is, also holds the event loop for a large body,
   and is a larger decision.

   Asked of the operator: may the memory backend hash
   through `node:crypto`?

2. **One seed per test file, copied for each test.** A
   run rehearses the mock seed 320 times; 278 of those
   come through `seededMockDb()`, from 48 test files.
   `tests/` names `seededMockDb()` at 97 call sites in 42
   files (by grep; a site in a helper serves several
   tests, and a shared helper serves several files).
   Each call builds the same dataset from nothing.

   The sibling `faster-layer-two` unit built exactly this
   for the browser suite (`3da2f5c7b`, "Seed the browser
   suite once per file"): `tests/browser/fixtures.ts`
   lands the mock seed once per file in a memo and hands
   each origin `backend.copy()` of it, and
   `tests/browser-origin.test.ts` pins the isolation: an
   idea written through one origin reads 404 through one
   open beside it and through one opened after, which
   goes red on an uncopied seed. Two workers on this
   machine measured a seeded backend rebuilt from its
   landed rows in 45 to 73 ms, byte-identical, against
   about 2 s for a seed at master.

   An estimate, not a measurement: 230 of the 278 seeds
   would become copies. At this branch's quiet seed of
   about 1.36 s CPU (`seed-pair.ts`, load 14 to 11), less
   about 0.07 s a copy, that is near 300 CPU seconds of
   the 567 a four-worker run spends, and if the run
   stays CPU-bound at its measured 4.5 cores, about a
   minute of its 126 s wall.

   Isolation would be pinned as the browser suite pins
   it: two backends from one file's seed, a write through
   one read as absent through the other and through one
   taken after. The seed's day stays fixed by the
   preload, before any test runs.

   TODO.md, "One rehearsal per test process", reserves a
   seed cache for tests to the operator. Asked of the
   operator: may `seededMockDb()` seed once per test file
   and copy?

3. **`measurements/probes/seed/rehearsal.ts` no longer
   runs.** At `c36020172` its replay throws "no document
   for organization" before it prints: the replay
   predates the organization hold. Found here, not fixed
   here.

4. **The lint**, three seconds, if the `test` script is
   ever quiet enough to touch.

## Left to the builder

- The exact names of the short list's type and helper in
  `api/backend-memory.ts`.
- Three workers or four: four, from the runs under the
  suite lock (see "Results").
