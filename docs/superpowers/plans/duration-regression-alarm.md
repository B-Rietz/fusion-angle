# Duration Regression Alarm Implementation Plan

**Goal:** every time-consuming tool in the build and test
chain appends how long it took to a per-machine ledger,
and says on stderr when it now takes far longer than it
recently did.

**Architecture:** one sourced bash function, `timed LABEL
COMMAND`, in `bin/duration-lib`. It reads the git facts,
asks `web-app/app/tool-duration.ts begin` for the start
instant and the machine's load, runs the command in a
subshell, then hands `end` the begun sample, the exit
status, and the ledger path. `end` appends the sample and
prints one line derived by the pure
`web-app/app/tool-duration-core.ts`. `test`, `bin/build`,
and `deploy` call `timed`; a pin makes every other
executable script name its reason for not calling it.

**Tech stack:** bash 3.2 (`#!/bin/bash` on macOS), Deno
2.9.8, TypeScript (`strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `erasableSyntaxOnly`),
`Deno.test` with `@std/assert`.

**Spec:**
`docs/superpowers/specs/duration-regression-alarm-design.md`.
Read it first. Line numbers below are as of `c36020172`;
trust the quoted text over the number.

## Global constraints

- Before every `deno`, `./test`, or `./deploy` command:
  `export DENO_DIR="$TMPDIR/deno-dir"`.
- Before every run of a timed tool during this work:
  `export TOOL_DURATIONS_PATH="$TMPDIR/dra-ledger.jsonl"`,
  so development runs never write the clone's real ledger.
  One run at the end proves the real path, and its file is
  removed.
- `git add` and `git commit` fail in the sandbox with
  "Operation not permitted" under `.git/worktrees/`; run
  those two outside it.
- Each commit passes `./test validate --syntax`.
- 78 columns in everything `./test lint` lints, 4-space
  indent, final newline. `bin/duration-lib` joins the lint
  list.
- Commit subject: one line, about 50 characters,
  imperative, then the `Co-Authored-By: Claude Fable 5.2
  <noreply@anthropic.com>` trailer. No body.
- No test may depend on elapsed time or on this machine's
  load. The verdict is tested as a pure function over
  crafted samples; the spawned tests assert only what does
  not move with the clock.
- The other three units edit `test` too. Keep edits there
  to the call sites and two single lines.

## Questions settled while planning

1. **Existing pins on `test` stay untouched.**
   `tests/test-cli.test.ts` requires `run_check` in the
   `--syntax` branch and `bin/test-browser` in the `validate
   browser` branch. So each call site reads `timed './test
   NAME' COMMAND` with the command spelled out, and no
   `step NAME` helper hides it. A new pin keeps the label
   and the command paired.
2. **`deploy`'s stand-up function is defined after the
   traps.** `tests/deploy-cli.test.ts` requires the first
   `trap ` to precede `docker compose up -d --wait
   postgres` in the file. The function is therefore
   declared inside the `--local` branch, below the traps.
3. **`bin/build`'s body moves into a function**, which
   indents it by four. One line would pass 78 columns: the
   `--allow-env=` list is re-broken one name earlier. Its
   continuation lines stay at column 0; they are inside a
   word.
4. **Doc citations.** `TODO.md` cites `test:64` and
   `deploy:178`. Both shift and are corrected. `test:242`
   and `bin/build:100-104` were already wrong at
   `c36020172`; they are reported, not rewritten.
5. **`sh` runs the lib in tests**, as
   `tests/build-commit.test.ts` sources `bin/build-lib`.
   `sh` is already in `ALLOW_RUN`, so `run_memory` needs no
   new entry. The lib uses no bash-only syntax.
6. **Found while executing Task 2: the start reading is
   not enough.** The first `./test` timed through the lib
   began at a load of 8.1 on 16 cores and took 244.5 s,
   against 157.5 s and 160.5 s for the two runs before it;
   it ended at 26.8, under a sibling's suite. The sample
   gained `loadAtEnd`, and a run is contended at 1 per
   core as it begins or 2 per core as it ends. The spec's
   decision 5 carries the argument. Where a task below
   says "started contended", read "began or ended
   contended".

## Task 1: the pure verdict

**Files:** create `web-app/app/tool-duration-core.ts`,
`tests/tool-duration-core.test.ts`.

- [ ] Write the tests first. A `sample(overrides)` helper
  returns a valid quiet green `./test memory` sample; a
  `daysBefore(n)` helper returns an RFC 3339 instant.
  Tests, each one `Deno.test`:
  - a second slow quiet run in one worktree is a
    regression, and `durationLine` starts `DURATION
    REGRESSION: ./test memory took 600.0 s` and contains
    `120.0 s`, `5.0×`, and `4 runs in the last 14 days`;
  - the first slow run is `slower`, and its line says a
    second quiet run this slow here is a regression;
  - a slow run that began or ended contended is `slower`,
    and its line says `ran under machine load (3.4 per
    core at the start)` or `(2.5 per core at the end)`;
  - a slow run whose predecessor ran in another worktree
    is `slower`; a fast run in another worktree between
    two slow ones does not hide the regression;
  - 2.9× is `steady`; 3× with 9 999 ms added is `steady`;
    exactly 3× with exactly 10 000 ms added is slow;
  - a red run, a contended run, a run older than 14 days,
    other arguments, another tool, and another machine are
    each no baseline;
  - no samples is `no-baseline` with `0 of 3`;
  - a red current run is `failed`, and its line says
    `failed (exit 1) after`;
  - `parseLedger('')` is `[]`; a line that is not JSON and
    a line missing `durationMs` each throw naming the line
    number.
- [ ] Run `./test` on the one file and see every test
  fail (module missing).
- [ ] Write the module: the five constants with their
  units, `DurationSample`, `DurationVerdict`, `sampleFrom`,
  `parseLedger`, `durationVerdict`, `durationLine`.
  `median` comes from `./measure-core.ts`.
- [ ] Green, `./test validate --syntax`, commit: `Derive a
  duration verdict from the ledger`.

## Task 2: the entry and the hook

**Files:** create `web-app/app/tool-duration.ts`,
`bin/duration-lib`, `tests/tool-duration-cli.test.ts`;
modify `test` (the lint list only).

- [ ] Write the spawned tests first. A `runTimed(script,
  env)` helper runs `sh -c 'set -eu; . ./bin/duration-lib;
  <script>'` with `TOOL_DURATIONS_PATH` set to a file in a
  fresh temp directory. Tests:
  - `timed "./probe green" true` exits 0, appends exactly
    one line that `sampleFrom` accepts with `tool`
    `./probe`, `arguments` `['green']`, `exitStatus` 0, and
    prints `no baseline yet (0 of 3`;
  - `WORKING_TREE_PORCELAIN=''` records `tree` `clean`, and
    `' M x'` records `dirty`;
  - `timed "./probe red" sh -c "exit 7"` exits 7, records
    `exitStatus` 7, prints `failed (exit 7)`;
  - `two() { false; echo SECOND; }; timed "./probe two"
    two` prints no `SECOND` and exits 1;
  - `timed "./probe red" false; echo AFTER` prints no
    `AFTER`;
  - a ledger path inside a directory that does not exist:
    exit 0, stderr says `./probe green not recorded`;
  - a ledger holding one line that is not a sample: exit
    0, stderr names `line 1`, and the file is unchanged;
  - three crafted quiet green 600 000 ms samples for this
    machine, then a real `true`: the line says `recent
    median 600.0 s (3 runs in the last 14 days)`.
- [ ] See them fail.
- [ ] Write `tool-duration.ts`: `begin LABEL SHA TREE
  WORKTREE` prints the begun sample on stdout; `end BEGUN
  EXIT_STATUS LEDGER` reads the ledger (absent is empty),
  appends, prints the line on stderr. A failure prints
  `duration: <message>` and exits 1, as `measure.ts`
  reports `measure failed:`.
- [ ] Write `bin/duration-lib` with `timed` as the spec's
  decision 7 and 9 describe, and add it to the lint list
  in `test`.
- [ ] Green, `./test lint`, `./test validate --syntax`,
  commit: `Time a step and record its sample`.

## Task 3: `./test` times its steps

**Files:** modify `test`, `tests/tool-duration-cli.test.ts`.

- [ ] Tests first:
  - `./test schema` with the seam appends a green `./test`
    `['schema']` sample;
  - `./test browser` with `CHROME=/nonexistent/chrome` and
    an empty `CHROME_DEBUG_URL` exits 1 and appends a red
    `./test` `['browser']` sample;
  - `./test validate` with the stamp seam pointing at HEAD
    and a clean porcelain prints `already validated` and
    leaves no ledger file;
  - source pin: every suite name in `./test`'s dispatch
    appears in a `timed './test NAME'` call, each label is
    always followed by the same command, and no `run_*`
    step or `bin/test-*` script is named outside a `timed`
    call or its own definition.
- [ ] See them fail.
- [ ] Source the lib after `cd "$ROOT"`; wrap the five
  calls in `run_validate`, the `memory` dispatch, the six
  inner cases, `--syntax`, and the two `validate` combos.
  `postgres` and `browser` lose their `exec`.
- [ ] Green, existing `tests/test-cli.test.ts` green,
  commit: `Time every step ./test runs`.

## Task 4: `./bin/build` times its work

**Files:** modify `bin/build`.

- [ ] Commit 1, no behavior change: move the lines from
  `echo "Building Fusion Angle..."` to `echo "Done."` into
  `build() { … }` and call it. Re-break the `--allow-env=`
  line. `./test lint`, `./test` on
  `tests/server-zip-metafile.test.ts` and
  `tests/build-commit.test.ts`. Commit: `Hold the build's
  work in one function`.
- [ ] Commit 2: source `bin/duration-lib`; call `timed
  './bin/build --no-zip' build` or `timed './bin/build'
  build`. Run `./bin/build --no-zip "$TMPDIR/dra-build/"`
  on the clean tree and read the sample. Commit: `Time the
  build`.

## Task 5: `./deploy --local` times its stand-up

**Withdrawn after review** (see the last section). The
task was carried out and then reverted; `deploy` is as
master has it.

**Files:** modify `deploy`, `TODO.md`.

- [ ] Declare `stand_up_local_stack` below the traps,
  holding the five commands, and call it through `timed
  "./deploy --local --postgres ${MODE#--}"`.
- [ ] `tests/deploy-cli.test.ts` green. Correct
  `deploy:178` in `TODO.md`.
- [ ] Commit: `Time the local stack's stand-up`.

## Task 6: no script joins the chain untimed

**Files:** modify `tests/tool-duration-cli.test.ts`.

- [ ] Add the pin: read every file at the root and under
  `bin/` whose mode has an execute bit; each either
  contains a `timed '` or `timed "` call or is a key of
  the test's `UNTIMED` record, whose values are the
  reasons from the spec's decision 7. The two sets must
  not overlap and must cover the directory listing
  exactly.
- [ ] Prove it bites: add an executable `bin/probe`
  locally, see the pin fail, remove it.
- [ ] Commit: `Pin every script as timed or exempt`.

## Task 7: docs

**Files:** modify `AGENTS.md`, `TODO.md`.

- [ ] `TODO.md`: `test:64` to its new line.
- [ ] `AGENTS.md`, Gates: one paragraph naming the ledger,
  its seam, the line, and that it gates nothing.
- [ ] Grep the root docs for sentences the change made
  false (`exec`, "prints nothing", the lint list).
- [ ] Commit: `Document the duration ledger`.

## Task 8: review, squash, prove

- [ ] Dispatch one `architect` reviewer with the spec path
  and `git diff master...HEAD`. Verify each finding; fix
  the real ones test-first.
- [ ] Squash to `Design and plan the duration regression
  alarm` plus one feature commit.
- [ ] `./test validate` on the clean squashed tree; then
  `./test browser` and `./test postgres` once each, the
  latter under the shared 5432 lock.
- [ ] Prove it end to end on a scratch ledger with real
  elapsed time: three quiet runs of a 2 s command, then
  two quiet runs of a 13 s one; the second prints
  `DURATION REGRESSION`. Show a contended run and a
  sub-threshold run staying quiet.
- [ ] Use it: time the chain at `c36020172`, then at
  older SHAs in this worktree, and report medians, spread,
  load, and the suspected commit range of any real
  slowdown. Fix none of it.

## What the review changed

One independent reviewer read `git diff master...HEAD`
against the spec. Verified and fixed, each test-first:

- **A worktree is its own series.** The baseline pooled
  every worktree, so a speed-up in one raised the alarm in
  the others.
- **The predecessor is found by stepping back** over runs
  that were slow under load; a fast run under load ends
  the search.
- **Thresholds.** The end bound moved from 2 to 1.5 per
  core, because the run that motivated it read 1.68. The
  floor moved from 10 s to 30 s, because a `./test check`
  miss under allowed load passed 10 s. The claim that a
  quiet run "can never" be slowed past the ratio is gone;
  the spec gives the measurements instead.
- **`deploy` is untimed.** Its stand-up is an image build
  that follows Docker's layer cache, so two new commits
  in a row read as a regression. The revert also returned
  `AGENTS.md` and `README.md` to master's text.
- **`.dockerignore` names the ledger**, which from the
  main checkout sat inside the image build context.
- **A red step prints no duration line.**
- **The ledger keeps itself whole**: a lost final newline
  no longer glues two samples together.
- **`--no-prompt`** on both `deno run`s, a truthful
  message when git fails, and the ledger's path in the
  failure line.
- **The pins** now catch a plain step inside `./test
  validate`, a suite arm with a digit, an `exec`, and a
  suite script named outside its timed call; the script
  list comes from `git ls-files`, so a stray untracked
  executable is no script.
- **`startedAt` carries microseconds**, from `Temporal`.

Read where a task above says otherwise: "started
contended" is "contended at either end"; the ratio tests
use a 30 s floor; Task 6's `TIMED` list is `bin/build`
and `test`; Task 7's `AGENTS.md` paragraph was removed,
because the brief allows only sentences the change made
false, and `TODO.md` gained `tool-duration.ts` in its
list of Deno-only modules under `web-app/app/`.

Rejected, with the reason:

- **A version field in the sample.** Nothing reads a
  second shape yet; the spec states the limit.
- **The median of an even count names a duration no run
  had.** It is the median `./bin/measure` already uses;
  the spec states it.
- **Forwarding a signal from the timing shell to its
  step.** It would mean running the step in the
  background and changing who owns the terminal. The
  spec states the change in behavior.
