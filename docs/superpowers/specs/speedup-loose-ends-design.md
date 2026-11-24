# The speed-up's loose ends

Branch and worktree `speedup-loose-ends`, stacked on the
unmerged `clean-tree-bin-scripts` (tip `de1b3f58c`, seven
commits on master `745e83bf2`), which lands first. The
operator's words: "Handle those open items." Four items
the effort that made the test commands fast left open.
The operator delegated spec through fix; each decision
below states its choice and its reason.

## 1. Test files leave temp directories behind

### What was measured

Every test file the memory suite runs, 539 under
`tests/*.test.ts` and 2 under `tests/tz/`, was run under
`deno test` with the flags `run_memory` uses, in six
batches, each with an empty `TMPDIR` of its own; what
each batch left there was listed. The top levels of
`/tmp/claude-501` (the sandbox's own temp directory) and
`/private/tmp` were listed before and after the batches,
and the worktree's `git status` after: neither temp
directory gained an entry and the tree stayed clean, so
no file leaks outside `TMPDIR` or into the tree. Only the
batch of the 24 files that spawn processes left anything:
62 entries, the count found before. Run one at a time,
three files account for all 62:

| File | Left per run |
|---|---|
| `tests/deploy-cli.test.ts` | 12 `fusion-docker-stub-*`, 12 `fusion-stamp-*` |
| `tests/postgres-gun-cli.test.ts` | 8 `fusion-gun-stub-*`, 8 `fusion-docker-stamp-*`, 8 `fusion-render-stamp-*`, 2 `fusion-render-home-*` |
| `tests/serve-cli.test.ts` | 6 `fusion-docker-stub-*`, 6 `fusion-stamp-*` |

Each makes a stub directory and a stamp directory per
spawn with `Deno.makeTempDirSync` and never removes
either. Every other file that makes a temp directory
removes it. The Postgres suite cannot leak: its `deno
test` carries no `--allow-write`. The browser suite runs
its files under `$RUN_DIR/tmp`, which its trap removes.

That list is complete for a passing run of today's files
on this machine. It cannot speak for a red run, which
can skip a removal, or for a file not yet written.

### Decision: both shapes

- **The run owns a directory.** `run_memory` makes
  `fusion-memory.XXXXXX` in the `TMPDIR` it was given,
  hands it to both passes as `TMPDIR`, and removes it in
  an EXIT trap. Whatever a test, or a script a test
  spawns, leaves in its temp directory goes with the run,
  green or red. That is the guarantee, and it holds for
  files not yet written. The directory and the trap are
  made inside the step, so a replay makes neither. The
  trap is set in `run_memory`, which runs only inside
  `timed`'s subshell (`tests/tool-duration-cli.test.ts`
  fails a call outside it), so no shell above an ask ever
  holds one: the result cache's calling rule, kept as
  `bin/test-browser`'s `browser_suite` keeps it.
- **The three files clean up after themselves.** One
  test file run alone under `deno test` is the edit loop
  AGENTS.md gives, and it uses the shared `TMPDIR`, where
  the operator's had gathered tens of thousands of these
  entries; the run's directory never sees that run. So
  each file makes its directories under one of its own,
  made before its first test and removed after its last,
  the pattern `tests/tool-duration-cli.test.ts` already
  holds. Four files make it a pattern, so it moves into
  one fixture, `tests/fixtures/scratch-directory.ts`, and
  the timer's test takes it too.
- **A replica's script gets the test's own `TMPDIR`.**
  `runInReplica` (`tests/fixtures/script-replica.ts`)
  clears the environment, so a script it runs fell back
  to `/tmp`, every user's and closed inside the agent
  sandbox, where `./bin/test memory` now makes its run's
  directory. The replica hands it the test's own
  directory, removed with it, unless the case names
  another.

### Proof

Pinned: `tests/test-cli.test.ts` runs `./bin/test memory`
in a replica with a stand-in `deno` that leaves a
directory in the `TMPDIR` it is handed, once passing and
once failing its first pass. After each, the `TMPDIR`
the run was given holds nothing. Without the run's
directory or without its trap the case is red.
Surveyed, not pinned: the three files, run alone with an
empty `TMPDIR`, leave nothing. The gate's run at
`04331e858` (`/tmp/claude-501/loose-ends/gate/final/`
`results.tsv`) left its `TMPDIR` empty after `./bin/test
validate` (5096 passed, 12 ignored, then 8) and after a
run in a scratch clone with a failing test file added
(exit 1, `FAILED | 5096 passed | 1 failed | 12 ignored`),
and after the Postgres and browser suites too.

## 2. A seeded invitation expires on a calendar date

### What depends on it

`MOCK_SEED_INVITATION_EXPIRES_AT`,
`2027-01-01T00:00:00.000000Z`
(`api/mock-data/seed-constants.ts:11`), is the
`expiresAt` of the one invitation the mock seed lands:
Stark's pending invitation of Riley Okafor, the
zero-membership identity, sent at `MOCK_SEED_TIMESTAMP`
(`2026-01-01`). Readers of the instant:

- The API refuses an accept at or after `expires_at`
  with 409 (`api/invitations-domain.ts:1060-1070`),
  judged against the request's stamp, `nowUtc()`.
- The client drops an expired pending invitation from
  both lists (`omitExpiredPending`,
  `client/invitations.ts`), the invitee's and the
  organization admin's, and the bell and the invitations
  page judge it by `invitationIsExpired`.
- The API documentation's samples quote it, in
  `samples/get/organizations/id/invitations.json` and
  `samples/post/organizations/id/invitations.json`. The
  generator pins its day at 2020-01-01
  (`web-app/app/api-documentation-pins.ts:33`), so its
  `--check` never sees the expiry pass.
- TEST-PLAN.md B27 quotes the instant and says the case
  is walkable through 2026.
- No SCHEMA, API, or ARCHITECTURE text quotes it.

### What breaks, and when

On or after 2027-01-01T00:00:00.000000Z, by the clock
seam: a scratch test seeded the mock data, set
`setClockForTest` to an instant, read the invitee's
pending invitations through the client, and accepted the
seeded one through the API. At
`2026-12-31T23:59:59.000000Z` the list held 1 and the
accept answered 200; at `2027-01-01T00:00:00.000000Z` and
at `2027-06-01T00:00:00.000000Z` the list held 0 and the
accept answered 409, `the invitation expired at
2027-01-01T00:00:00.000000Z`. So from that instant:

- `./bin/test` goes red. Every test file was run with a
  scratch preload that moves `Date` to 2027-03-01,
  appended after the suite's own four: two failures
  follow from the invitation,
  `tests/api-documentation-story.test.ts` ('every write
  replays on its own copy or says why': the invitee's
  accept answered 409) and
  `tests/api-documentation-answers.test.ts` ('each listed
  status is the gate's, in both directions': two rules
  list one code at the accept). Both replay the
  documentation's writes on the wall clock.
- `./bin/deploy --local` serves a walk whose B25 to B29
  fixture is gone: the zero-membership identity lands on
  an empty invitations page and can never accept.

What that run did and did not show. The seed reads its
day once, at module load (`api/mock-data/seed-kit.ts:27`),
and that load happens in the suite's first preload:
`tests/hmac-test-key.ts` imports `tests/mock-seed.ts`,
which imports the seed. The scratch preload came last, so
the seed kept the real day while `Date` moved. The run
showed what a seed made today meets when the wall clock
reads 2027-03-01, which is the break above; it did not
show a seed made on that day.

That is also why it failed
`tests/mock-data-stats-window.test.ts`, which this spec
first called unexplained: the seed's sojourns stayed on
the real day while the test's window moved with
`Date.now()`, so the test fails from the seed's day plus
ninety days. With the preload first, the seed's day moves
with it, and the test passes at 2026-10-10, 2027-03-01,
2028-07-04, and 2031-02-28 (the review's re-run), and at
2027-03-01 and 2030-06-01 in this branch's own check. It is
an artifact, not a second fuse. The other two failures
of that run are artifacts as well: `tests/log-stamp.test.ts`
reads Temporal, and `tests/postgres-gun-cli.test.ts` a
spawned shell's `date`, neither of which the preload
moves.

The review re-ran the 104 test files that name the seed
or read the wall clock with the preload first, at
2027-03-01 and at 2030-06-01, on this branch: 974 passed
and 2 failed each time, the two being those artifacts.
Two literal dates are left in the seed:
`MOCK_SEED_TIMESTAMP`, 2026-01-01, a past anchor that no
reader judges against the clock; and
`api/mock-data/records.ts:67`, `max: '2099-12-31'`, a fuse
only in 2099.

### Decision

The invitation is sent on the seed's day and expires a
named duration after it, as the rest of the seed follows
its day (`api/mock-data/seed-kit.ts`, `now`):
`at` is `daysFromNow(0, 0, 0)` and `expiresAt` is
`daysFromNow(MOCK_SEED_INVITATION_LIFETIME_DAYS, 0, 0)`,
with `MOCK_SEED_INVITATION_LIFETIME_DAYS = 365`, the
year the old constant meant. Both move, not the expiry
alone: the generator's day is 2020-01-01, and an expiry
a year after it would fall before a 2026 `at`, which the
gate refuses (`expiresAt must be after at`). The
documentation stays byte-stable, since its day is pinned;
its two samples change once, to 2020-01-01 and
2020-12-31, and are regenerated with the change. No real
invitation changes: the gate, the 409, and the client's
judgment are untouched. `MOCK_SEED_TIMESTAMP` keeps every
other use.

### Pin

A test in `tests/mock-data-unaffiliated-identity.test.ts`,
the file that already lands the seed for the same
identity, so it costs no seed of its own, reads the
seed's day where the seed reads it (`now`, from
`api/mock-data/seed-kit.ts`) and moves the product clock
with `setClockForTest`. As the invitee, an accept one day
short of the lifetime answers 200, and on a fresh copy
an accept at the lifetime's end answers 409. With the old
constants the first is 409, at a clock most of a year
past 2027-01-01 for any seed made from 2026 on; with any
fixed far-off expiry the second is 200.

A first draft faked the seed's day with `FakeTime` at
2031, before any seed module loaded, as the generator's
pins do. Under the suite that cannot be done: the
`tests/hmac-test-key.ts` preload imports
`tests/mock-seed.ts`, which loads the seed, so its day is
fixed before any test file runs. The seed's real day
serves as well, since every day from now on is past the
old date.

## 3. TEST-PLAN.md describes the suites as they were

Scope, exactly as asked: the Summary's "Combined Totals"
paragraph, the AT section's preamble and AT1 to AT5, and
the report template's build line and its AT1 line. No
walk case is added,
removed, reworded, or re-scored, and the walk is not run.

Decision: say how to read a count instead of quoting one,
and point at the script for a list that grows (the lint's
files), so nothing pinned rots. Stale today: AT2 quotes
an 8 Oct pass count and AT4 a 4 Oct one; AT2, AT4, and
the Summary list eleven Postgres files where
`bin/test-postgres` runs twelve (`tests/pg-probe.test.ts`
is missing) and say 11 ignored where twelve placeholders
skip; AT2 names neither the four workers nor the run's
own `TMPDIR`; AT3 lists four of the `bin/` files the lint
reads (`bin/develop`, `bin/worktree-add`, and the three
`-lib` files from the cache, the timer, and the clean
tree are missing) and none of the lint's other four
checks; AT5 says the files run serially with two
preloads, where a launched Chrome runs them four at a
time with three and the seed lands once per run; and no
entry says that every form refuses a dirty tree or that a
passed step replays.

The ruling on a replay, the master session's on the
operator's behalf, goes in the AT preamble as stated: a
replay of a pass recorded on the same clean SHA is that
SHA's result, and the entry passes; removing the SHA's
directory under the cache root is how to run it for real.

The report template's `(clean | dirty: N files)` becomes
`(clean)`: `./bin/deploy --local` refuses a dirty tree,
so a walk starts only from a clean one.

## 4. The synchronous digest, measured again

Measurement only. Nothing is built in the tree.

### The variant

In a scratch clone at this branch's final SHA, committed
there and never here: `api/sync-digest.ts`, a Deno-only
module beside the memory backend, computes SHA-256
through `node:crypto`'s `createHash`;
`shared/pair-root.ts` exports the two preimages its own
digests hash, so the synchronous ones hash the same
bytes; `classifyStatement`
(`shared/ledger-statement.ts`) takes an optional set of
synchronous digests and, given one, hashes each row
without an await; `api/backend-memory.ts` passes it. The
values are the same; `shared/digest.ts`, the browser, and
the request path's digests do not change; nothing in
`shared/` or reachable from the client imports `node:`.
This is the smallest change that makes the memory
backend's row hashing synchronous, as the operator's held
case 1 describes it
(`docs/superpowers/specs/faster-layer-one-design.md`,
"Left to the operator").

### The script

`/tmp/claude-501/loose-ends/digest-ab.sh`, for the master
session to run. It refuses unless the worktree is at the
final SHA and clean, makes a base clone at that SHA, and
runs `./bin/test` in pairs, base then variant, then
variant then base, each under the suite lock, with
`DENO_JOBS` unset, an empty cache root and a ledger of
its own per run, under `/usr/bin/time -p`. One line a run
goes to `/tmp/claude-501/loose-ends/digest-ab.txt`.

### Result

Run by the master session at `04331e858`, two pairs in
both orders under the suite lock, every run 5096 passed,
0 failed, 12 ignored, then 8 passed
(`/tmp/claude-501/loose-ends/digest-ab.txt`):

| Run | Wall | CPU | Load |
|---|---|---|---|
| base | 60.93 s | 245.65 s | 6.22 to 6.77 |
| variant | 52.31 s | 203.65 s | 6.77 to 6.72 |
| variant | 51.97 s | 203.09 s | 6.72 to 6.35 |
| base | 60.43 s | 244.92 s | 6.35 to 6.62 |

The variant's mean wall time is 0.859 of the base's, 8.5 s
a run, and its CPU 0.83.

### The rule, and its outcome

The rule, set before the run: build the synchronous
digest only if the variant saves at least a fifth of
`./bin/test`'s wall-clock time, the variant's runs
taking at most 0.80 of the base's, on runs whose loads
are alike. It was first written as a ratio of medians;
the script computes means, which for two runs a side are
the medians too. At 0.859 it is not built. The operator, shown
the measurement: "Add it to the middle section of
TODO.md". TODO.md now carries the item, with this
measurement, at the end of `## Critical functionality
path`, and its Later-work rehearsal entry points at it
(commit "List the synchronous digest with its
measurement", the master session's, on top of this
branch's four).

## Known limits

- A database seeded before this change still holds an
  invitation that expires at 2027-01-01, until it is
  wiped and seeded again. The fix changes what a seed
  writes, never what a seed wrote.
- The replay ruling has no age bound: a pass recorded on
  a SHA before a date-dependent break replays as a pass
  after it. Removing that SHA's directory under the cache
  root runs it for real.
