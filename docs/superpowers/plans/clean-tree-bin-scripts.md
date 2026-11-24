# Clean Tree at Every Door, Scripts under `bin/`: Implementation Plan

**Goal:** every form of the test command, its two door
scripts, the build, and the deploy refuse a dirty tree
before any work, with one message from one place; then
`test` and `deploy` move into `bin/`.

**Architecture:** one sourced bash function,
`require_clean_tree`, in `bin/clean-tree-lib`. Each script
reads its arguments, calls it, and only then works.
`bin/build` calls it where `git rev-parse --git-dir` finds
a repository. Tests that run a refusing script past its
arguments do so in a repository of their own, built by
`tests/fixtures/script-replica.ts`. Then `git mv test
bin/test`, `git mv deploy bin/deploy`, and every reference
follows.

**Tech stack:** bash 3.2 (`#!/bin/bash` on macOS), Deno
2.9.8, `Deno.test` with `@std/assert`.

**Spec:**
`docs/superpowers/specs/clean-tree-bin-scripts-design.md`.
Read it first. Line numbers below are as of `745e83bf2`;
trust the quoted text over the number.

## Global constraints

- Before every `deno` command: `export
  DENO_DIR="$TMPDIR/deno-dir"`, `export DENO_JOBS=4`,
  `export
  SHA_RESULT_CACHE_ROOT="$TMPDIR/fusion-angle-sha-result-cache"`,
  and a `TOOL_DURATIONS_PATH` under `$TMPDIR`. None of
  these goes into a repo script.
- No full suite: no memory suite, no `validate` but
  `--syntax`, no browser suite, no Postgres suite, no
  `bin/build`, no `deploy`. One test file at a time under
  `deno test` with the flags `run_memory` uses; lint;
  `--syntax`.
- Git writes fail in the sandbox with "Operation not
  permitted" under `.git/worktrees/`; run `git add`, `git
  mv`, and `git commit` outside it.
- 78 columns in everything lint covers, 4-space indent,
  final newline, no trailing whitespace. `bin/clean-tree-lib`
  joins the lint list.
- Scripts run under `/bin/bash` 3.2.
- Commit subject: one line, about 50 characters,
  imperative, then a blank line and `Co-Authored-By: Claude
  Fable 5.2 <noreply@anthropic.com>`. No body.
- The branch ends as four commits: design and plan; the
  refusal; the pure rename; the references. **The
  pure-rename commit is red by design**: `bin/test` and
  `bin/deploy` still resolve `ROOT` from their own
  directory, and every test that reads `test` or `deploy`
  fails. Every other commit passes `validate --syntax` and
  lint, under the script's name at that commit.
- With the refusal in place, `validate --syntax` and `lint`
  run only on a committed tree: commit, run, amend.
- Never weaken an assertion. Each new or moved pin is seen
  red by a scratch mutation, reverted before the commit.
- Count every `Deno.test` added to or removed from
  `tests/*.test.ts`: the gate states the memory suite's
  count exactly. The count at `745e83bf2` is 5,079 passed
  and 12 ignored, 5,091 listed.

## Questions settled while planning

1. **The call stands in each arm of `test`.** The
   structural pins in `tests/test-cli.test.ts` and
   `tests/tool-duration-cli.test.ts` read the `case`: the
   arms at four spaces, the `--syntax` branch up to its
   next `elif`, `run_validate`'s five lines. A call inside
   each arm, after its usage check, changes none of what
   they read. `run_validate` gains no line.
2. **`bin/build` asks `git rev-parse --git-dir` first.**
   It succeeds in a repository with no commit, so a dirty
   one still refuses as today, and it fails where there is
   no repository or a pointer to nowhere.
3. **`deploy` sources the library where it calls it**,
   after the last argument check and before `compose-lib`,
   so the usage cases in `tests/deploy-cli.test.ts` never
   reach it.
4. **A replica is spawned as `/bin/bash SCRIPT`** with
   `cwd` the replica, as the cache's replicas are:
   `/bin/bash` is already in `ALLOW_RUN`, and a relative
   program path would be resolved against this checkout.
5. **The fixture names both resources in its own spawn.**
   `tests/sha-result-cache-isolation.test.ts` reads every
   `new Deno.Command(` under `tests/`, fixtures included.
6. **The one `validate` case copies the whole working
   tree** into its replica: `git ls-files --cached
   --others --exclude-standard`, less `--deleted`. It
   lints for real, and a hand-kept list of what lint reads
   would rot.
7. **Feature 1 lands under the old names.** Its tests
   reach the scripts through one constant per file, so the
   references commit changes a line each.

## Task 1: the library and its refusal

**Files:** create `bin/clean-tree-lib`,
`tests/fixtures/script-replica.ts`,
`tests/clean-tree-cli.test.ts`; modify `test`, `deploy`,
`bin/build`, `bin/test-browser`, `bin/test-postgres`,
`bin/build-lib` (its header).

1. Write `tests/fixtures/script-replica.ts`: `HERMETIC_GIT`,
   `git`, `searchPath`, `withRepository`,
   `copyFromCheckout`, `copyWorkingTree`, `commitAll`,
   `runInReplica`, `realDeno`, `TIMER_RUNS_FOR_REAL`, and
   the list of what a gate script sources. Move, do not
   copy, what `tests/sha-result-cache.test.ts` already has.
2. Write `tests/clean-tree-cli.test.ts` against a replica
   of the five scripts with stand-ins for `deno`, `docker`,
   `render`, `curl`, and Chrome that each note their call:
   - every form of `test`, derived from `--help`, refuses:
     status 1, the message, the porcelain line, empty
     stdout, no call noted, no cache root, no ledger;
   - the two door scripts and both forms of the build
     refuse the same way;
   - `deploy` refuses in its three forms;
   - untracked, modified, staged, and deleted each refuse;
     an ignored file does not;
   - `--help` and a usage error answer on a dirty replica,
     for `test`, `deploy`, and `bin/build`;
   - outside a repository `test` refuses with git's words
     and the library's line;
   - outside a repository, and beside a `.git` that points
     nowhere, `bin/build` reaches `no commit SHA to embed`;
   - only `bin/clean-tree-lib` spells `is not clean`, and
     no other script under `bin/` or at the root reads
     `git status` to refuse.
3. Run the file: every case red, for want of the library.
4. Write `bin/clean-tree-lib` and the calls. Run the file:
   green.
5. Mutations, one at a time, each reverted: drop the call
   from one arm of `test`; from each door; from `deploy`;
   from `bin/build`; make the library `return 0` on a
   failed `git status`; move `test`'s call above its
   `case`. Each turns the named case red.

## Task 2: the tests that ran a script here

**Files:** modify `tests/test-cli.test.ts`,
`tests/tool-duration-cli.test.ts`,
`tests/sha-result-cache.test.ts`,
`tests/sha-result-cache-isolation.test.ts`.

1. `tests/test-cli.test.ts`: `denoCalls` builds a replica;
   the `validate` case copies the working tree. Same
   assertions.
2. `tests/tool-duration-cli.test.ts`: the `schema` and
   no-Chrome cases run in a replica, the first with a
   stand-in generator. Same assertions.
3. `tests/sha-result-cache.test.ts`: the replicas carry
   `bin/clean-tree-lib`; the two "cache is not asked"
   halves reach it through `POSTGRES_URL` and a silent
   Chrome.
4. `tests/sha-result-cache-isolation.test.ts`: the header
   says what a spawn in this checkout may now reach; a
   second assertion lists the files that spawn a refusing
   script by its own path, so a new one is a decision.
5. Run each file on the dirty tree: green. That is the
   proof that none asks about this tree.
6. Mutation: point one moved case back at this checkout
   and run it on the dirty tree: red with the refusal.

## Task 3: the documents for feature 1, and the commit

AGENTS.md: the commit-before paragraph, the sandbox
paragraph, the Gates sentences on clean trees, dirty
trees, the isolation rule, and "on any tree"; the fixture
in "Where things live". `bin/test-browser`'s header. Then
commit, run `./test validate --syntax` and `./test lint`,
amend until both pass.

## Task 4: the pure rename

`git mv test bin/test`, `git mv deploy bin/deploy`, `git
mv tests/root-scripts-exec-deno.test.ts
tests/operator-scripts-exec-deno.test.ts`. Commit with no
content change. Red.

## Task 5: the references

**Scripts.** `bin/test` and `bin/deploy`: `BIN` and
`ROOT`; siblings through `$BIN`; usage text; `ALLOW_RUN`;
the lint list; the timer's labels; `deploy`'s three gate
calls. `bin/test-browser`, `bin/test-postgres`,
`bin/build`, `bin/duration-lib`,
`bin/sha-result-cache-lib`: labels, usage, comments.

**Tests.** Every spawn and every read of the two scripts;
the labels; the structural pins' spellings
(`"$BIN/test-postgres"`, `'./bin/test NAME'`); the seven
names in the isolation pin; `TIMED_SCRIPTS` and `UNTIMED`;
a new pin that every tracked executable is directly under
`bin/`; the renamed test's header and title;
`ROOT_FILES`; comments.

**Documents.** AGENTS.md, README.md, ARCHITECTURE.md,
TODO.md, SCHEMA.md, COST-ESTIMATION.md,
`measurements/probes/README.md`,
`web-app/app/tool-duration-core.ts`; TEST-PLAN.md command
names only. Re-read each TODO.md file:line citation
touched.

Sweep with the spec's pattern until it finds nothing
outside `docs/`, then by eye for the bare names. Commit,
run `./bin/test validate --syntax` and `./bin/test lint`,
amend until both pass. Run every touched test file.

Mutations: restore a root `test` shim (the bin-only pin
goes red); change one label back (the timed-step pin goes
red); drop `bin/deploy` from the isolation pattern (a
spawn loses its hold and the known-spawner list goes red).

## Task 6: the gate

`/tmp/claude-501/clean-tree-proof.sh RUN [STEP...]`,
modeled on `/tmp/claude-501/duration-alarm-proof.sh`: the
same two locks, the same refusal unless HEAD and a clean
tree match, its own empty cache root and ledger, a verdict
on every run, exit 1 on anything unexpected, counts
grepped from a file.

Steps: `refusal` (a scratch clone, dirtied: every form
refuses with nothing run, recorded, or sampled; `--help`
and a usage error answer), `files` (the test files that
spawn scripts pass under `deno test` in that dirty clone),
then `validate`, `postgres`, `build`, `browser`, each for
real and again, then `composed`.

Check its plumbing against a copy pointed at a scratch
clone with stand-in tools on `PATH`. Do not run a suite
with it.

## Task 7: after the review

The review of `8350aa132` found five things and asked for
two more; the spec's "After the review" has each. Fixes
fold into the commit they belong to: the untracked-files
flag, the copy that passes over a vanished path, the
no-repository spawn, and the render comment into the
refusal commit; the stricter `bin/` pin into the
references commit. Two commits follow: the image build
context, and the timer test's directories. The gate gains
a refusal under `status.showUntrackedFiles=no` and an
`image` step.

## Task 8: squash and report

Fold the plan into the design commit. Four commits, tree
clean. Report: the commits, both features as the dispatch
lists them, every pin and its mutation, what was run, the
gate's expectations, and what is unfinished or unverified.
