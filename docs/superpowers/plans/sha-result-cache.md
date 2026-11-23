# SHA Result Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:executing-plans to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** A step that passed on a clean tree does not
run again for that SHA. Its stdout and stderr replay
between two lines on stderr that say so. Red never
replays. The validate stamp is retired.

**Architecture:** One sourced library,
`bin/sha-result-cache-lib`, with one entry point,
`replay_or_run WAY [ARTIFACT...] -- COMMAND [ARG...]`.
Each script that does a step's work asks at its own door:
`test` for the memory suite, lint, and the API
documentation check; `bin/test-postgres`,
`bin/test-browser`, and `bin/build` (ZIP form) for
theirs. An entry is one gzipped tar at
`<root>/<sha>/<id>`, written aside and renamed.

**Tech stack:** bash 3.2 (`/bin/bash` on macOS) for the
library, `git`, `tar`, `tee`, `mkfifo`, `mktemp`; Deno
2.9.8 `Deno.test` with `@std/assert` for the tests, which
reach the library through `/bin/bash`.

**Spec:** `docs/superpowers/specs/sha-result-cache-design.md`.
Read it before any task.

## Ground rules

- `export DENO_DIR="$TMPDIR/deno-dir"` and `export
  SHA_RESULT_CACHE_ROOT="$TMPDIR/fusion-angle-sha-result-cache"`
  in the shell, never in a script.
- Every commit passes `./test validate --syntax`. Subject
  one line, about fifty characters, imperative; trailer
  `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.
- The memory suite takes minutes under the siblings'
  load. Run one test file while iterating:

  ```bash
  deno test --frozen --no-check \
      --sanitize-ops --sanitize-resources \
      --allow-env --allow-read --allow-write --allow-net \
      --allow-run=sh,git,deno,/bin/bash \
      tests/sha-result-cache.test.ts
  ```

- `/bin/bash` is 3.2: no `${var,,}`, no `mapfile`, no
  `{fd}>`, and an empty array is unbound under `set -u`.
  The tests reach the library through `/bin/bash`, the
  shell its callers name (Task 8 moved them off `sh`).
- Port 5432 is shared: take
  `/tmp/claude-501/fusion-angle-5432.lock` with `mkdir`
  before `./test postgres`.

## Final commit shape

1. `Design and plan the SHA result cache`
2. `Replay a step that passed on its SHA` — Tasks 1–2
3. `Replay passed test steps in place of the stamp` —
   Tasks 3–4
4. `Replay the browser suite per SHA and browser` — Task 5
5. `Replay the ZIP build while its ZIP stands` — Task 6

Task commits are tiny and squash into these.

---

## Task 1: The library replays a pass

**Files:** create `tests/sha-result-cache.test.ts`, create
`bin/sha-result-cache-lib`; modify `test` (lint list).

- [ ] **Step 1: red.** Write the test file's helpers and
  the first cases.

  Helpers:

  - `scene()` makes a temp directory holding `repo/` (a
    git repository with one empty commit, made under
    `GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_NOSYSTEM=1`),
    `root/` (not created: the library makes it), and
    `ran` (a file a step appends a line to each time it
    really runs). It returns the paths and a `remove()`.
  - `replayOrRun(scene, args, options)` spawns `sh -c
    'set -eu; . "$0"; replay_or_run "$@"' <library> ...args`
    with `cwd: scene.repo`, `clearEnv: true`, and an
    environment of `PATH`, `SHA_RESULT_CACHE_ROOT`, and
    the two git variables, plus `options.env`. It returns
    `{ status, stdout, stderr }`.
  - `STEP` is `sh -c 'echo out; echo err >&2; echo ran >>
    "$0"' <ran>`.
  - `timesRan(scene)` counts `ran`'s lines.
  - `RUN_TIMEOUT_MS = 20_000`, an `AbortSignal.timeout`
    on every spawn: generous because the siblings load the
    machine.

  Cases:

  - *a pass replays both streams without running*: run
    twice; both exit 0; `timesRan` is 1; the second
    stdout equals the first, exactly `out\n`; the second
    stderr holds `err\n` between the two announcement
    lines.
  - *a replay names the step, the time, and the SHA*:
    second stderr matches `sha-result-cache: replaying
    demo, which passed at
    \d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ on <head sha>` and
    ends with `sha-result-cache: replayed demo; nothing
    ran`. The first run's stderr is exactly `err\n`.
  - *a replay returns to its caller*: a script of
    `replay_or_run demo -- step; echo after` prints
    `after` on both runs.

  Run the file: every case fails (`replay_or_run: not
  found`).

- [ ] **Step 2: green.** Write `bin/sha-result-cache-lib`
  as in "The library" below. Add it to the awk lint list
  in `run_lint`, after `bin/compose-lib`. Run the file:
  the three cases pass.

- [ ] **Step 3:** `./test validate --syntax`, `./test
  lint`, commit `Replay a step that passed on its SHA`.

## Task 2: What the library refuses to replay

Each case is written red first where the Task 1 library
does not already hold; commit after each group passes.

- [ ] **Red is never recorded.** A step that prints and
  exits 3: status 3 both times, both streams intact,
  `timesRan` 2, no replay line, the root holds no entry.
- [ ] **`set -e` still bites.** A step function `false;
  echo continued` under `set -eu`: non-zero status,
  stdout lacks `continued`, a second run runs again.
- [ ] **A call under `if` is refused.** `if replay_or_run
  demo -- step; then :; fi` under `set -e` exits 1 naming
  `set -e`; `timesRan` 0.
- [ ] **No SHA, no cache.** Three scenes: an untracked
  file in the tree; `git init` with no commit; a
  directory that is no repository. Each runs twice,
  `timesRan` 2, and the root holds no entry.
- [ ] **A run that changes its own name.** A step that
  writes an untracked file, and a step that commits:
  status 0, stderr says `not recorded`, the next run
  runs.
- [ ] **Other names are other entries.** Another way;
  another commit, then back to the first (`git checkout
  --quiet --detach <sha>`) which replays; a stub `deno`
  first on `PATH` printing another version; `NO_COLOR=1`.
- [ ] **Artifacts.** With `ARTIFACT` a file outside the
  repository that the step writes: present and same
  replays; deleted runs again and says so; rewritten runs
  again; a step that passes but leaves no file is `not
  recorded`. The same step asked for another file is
  another entry. The proof is of the bytes on disk (`git
  hash-object --no-filters`): a file in the tree that
  differs only in line endings is another file.
- [ ] **A broken cache changes nothing but speed.** An
  entry overwritten with garbage: stderr says
  `unreadable`, the step runs, the third run replays. A
  root under a regular file, and a root that is a
  symbolic link: stderr says `cannot use`, the step runs
  both times with status and streams intact, green and
  red alike.
- [ ] **Two runs at once** (`Promise.all`, a step that
  sleeps 0.3 s): both exit 0, the SHA directory holds
  exactly one file, a third run replays.
- [ ] **Nothing is left beside the entries.** After a
  green, a red, and a replay, every path under the root
  is `<sha>` or `<sha>/<40 hex>`.
- [ ] **A replay stands with stderr closed.** Its two
  lines are lost; the step must not run on top of it.

Commits, as groups go green: `Never record a failed
step`, `Refuse a call where set -e cannot bite`, `Run
for real where no SHA names the tree`, `Key an entry on
Deno and NO_COLOR`, `Prove an artifact before a replay`,
`Run for real when the cache cannot be used`.

## Task 3: `test` asks the cache

**Files:** modify `test`, `tests/test-cli.test.ts`.

- [ ] **Step 1: red.** In `tests/test-cli.test.ts`:

  - Delete `test validate skips when HEAD already passed`
    and `headSha`, `join`: the stamp they drive is
    retired (spec, decision 11).
  - Replace `test memory does not SHA-skip` with `test
    routes four steps through the result cache`:
    the source matches `replay_or_run memory -- .*run_memory`,
    `replay_or_run lint -- .*run_lint`, `replay_or_run
    api-docs -- .*run_api_docs`, and `replay_or_run
    postgres -- .*bin/test-postgres`; it does not match
    `most-recently-validated-sha`, `already validated`,
    `MOST_RECENTLY_VALIDATED_SHA_PATH`,
    `WORKING_TREE_PORCELAIN`, `VALIDATE_OK`, or
    `validate-ok`.
  - Add `the memory suite runs for real against a named
    database`: in the body of `replay_or_run_memory`, the
    `POSTGRES_URL` test precedes `replay_or_run`.
  - Add `validate composes cached and uncached steps`:
    the body of `run_validate` is, in order, `run_check`,
    `replay_or_run_memory`, `replay_or_run_lint`,
    `run_schema`, `replay_or_run_api_docs`, and holds no
    bare `run_memory`, `run_lint`, or `run_api_docs`.
  - Add `check and schema run every time`: neither
    `run_check` nor `run_schema` appears on a line with
    `replay_or_run`.
  - In `validate --syntax is check and does not stamp`,
    add `assertNotMatch(branch, /replay_or_run/)`.
  - Rewrite `test validate skip returns so combinations
    continue` as `validate browser reaches the browser
    suite`: keep its second half, `run_validate` before
    `bin/test-browser` in the browser combination. Its
    first half is Task 1's *a replay returns to its
    caller*.

  Run `tests/test-cli.test.ts`: the new cases fail.

- [ ] **Step 2: green.** In `test`:

  - Source the library after `cd "$ROOT"`.
  - After `run_api_docs`, define `replay_or_run_memory`,
    `replay_or_run_lint`, `replay_or_run_api_docs`, and
    `replay_or_run_postgres` (spec, "Call sites").
  - `run_validate` becomes the five calls.
  - Dispatcher: `memory` calls `replay_or_run_memory`;
    `lint`, `api-docs`, and `postgres` call theirs;
    `validate postgres` calls `run_validate` then
    `replay_or_run_postgres`. `check`, `schema`,
    `browser`, `--syntax`, and `validate browser` keep
    their lines.
  - Update the `run_memory` comment's `test-cli's SHA
    skip uses sh` clause: `sh` now also serves the
    result-cache tests.

- [ ] **Step 3:** `./test validate --syntax`, the two test
  files, `./test lint`. Commit `Replay passed test steps
  in place of the stamp`.

## Task 4: Docs the retired stamp makes false

**Files:** `AGENTS.md`, `TODO.md`.

- [ ] AGENTS.md "Three layers" paragraph: `./test
  validate --syntax`, "which is `deno check --frozen` and
  records nothing in the SHA result cache."
- [ ] AGENTS.md Gates: a paragraph after the `./test
  validate` composition: what replays, what never does,
  the two announcement lines, the root, the escape
  hatch.
- [ ] AGENTS.md sandbox block: the
  `SHA_RESULT_CACHE_ROOT` export beside `DENO_DIR`;
  "Both are" becomes "All three are".
- [ ] TODO.md item on environment names: the stamp's two
  names become `SHA_RESULT_CACHE_ROOT`
  (`bin/sha-result-cache-lib`).
- [ ] `./test lint` (the retired-vocabulary and
  later-work greps read root `.md`). Commit `Describe the
  SHA result cache for agents`.

## Task 5: The browser suite

**Files:** `bin/test-browser`, `tests/test-cli.test.ts`,
`AGENTS.md`.

- [ ] **Red:** `test-browser asks the cache per browser`:
  the source sources `sha-result-cache-lib`; `BROWSER`
  comes from `CHROME_DEBUG_URL` or `"$CHROME"
  --version`; `replay_or_run "browser $BROWSER" --
  browser_suite`; the `mktemp` and `deno test` lines sit
  inside `browser_suite`.
- [ ] **Green:** wrap the tail (from `BUNDLE=` to the
  `deno test` run) in `browser_suite() { … }`; add the
  `BROWSER` block and the call. If `"$CHROME" --version`
  fails or says nothing, call `browser_suite` directly.
- [ ] AGENTS.md Gates paragraph names the browser suite.
- [ ] `./test validate --syntax`, `./test lint`. Commit
  `Replay the browser suite per SHA and browser`.

## Task 6: The ZIP build

**Files:** `bin/build`, `tests/test-cli.test.ts`,
`AGENTS.md`.

- [ ] **Red:** `build replays only its ZIP`: the source
  sources `sha-result-cache-lib`; `replay_or_run build
  "$SERVER_ZIP" -- build`; the `--no-zip` branch calls
  `build` with no `replay_or_run`.
- [ ] **Green:** wrap the work (from `echo "Building
  Fusion Angle..."` to `echo "Done."`) in `build() { … }`.
  Hoist `SHA`, `DEST_DIR`, and `SERVER_ZIP` out of it,
  to the ZIP branch of the call. A relative `DEST` is
  left as it is: the artifact proof hashes the file in
  this worktree, so one way shared by two worktrees
  still never claims the other's file. Call as in the
  spec.
  `tests/build-commit.test.ts` reads `bin/build` by
  substring: keep `COMMIT_LOG="$(commit_log . "$GIT_SHA")"`
  and its neighbours byte for byte.
- [ ] AGENTS.md Gates paragraph names the ZIP build.
- [ ] `./test validate --syntax`, `./test lint`. Commit
  `Replay the ZIP build while its ZIP stands`.

## Task 7: Review, squash, gates, proof

- [ ] Review `git diff master...HEAD` against the spec.
  The brief asks for one fresh `architect` reviewer where
  the Agent tool is available; this worker's own standing
  instructions forbid it dispatching subagents, so the
  review is the brief's fallback, a cold re-read. Verify
  each finding; fix the real ones test-first.
- [ ] Squash to the final commit shape. `git diff
  <old tip>` must be empty.
- [ ] `./test validate` on the clean, squashed tree, then
  again: the second run replays memory, lint, and the API
  documentation check.
- [ ] `./test postgres` twice (lock), `./test browser`
  twice (outside the sandbox), `./bin/build <scratch>/`
  twice; delete the ZIP and build a third time: it
  builds.
- [ ] Record each tool's real and replay duration.

---

## Task 8: The independent review

The coordinator's reviewer read `95dfb4a87`. Each finding
was checked before it was acted on. Tasks 1 to 7 above
are the plan as it was first carried out; where this
task differs from them, this task and the library
listing below are what landed. In short: the Postgres
ask moved from `test` to `bin/test-postgres`, the tests
moved from `sh` to `/bin/bash`, and several cases were
merged, dropped, or added.

- [x] **1. A reader who leaves early.** Real: on a
  recorded SHA `replay_or_run … 2>&1 | head -n 1` killed
  the replay on its last line, and the step then ran for
  real. Every line the library says now comes from a
  subshell that ignores `SIGPIPE`. Red first: `a replay
  stands when its reader has gone`.
- [x] **2. A caller whose `set -e` is off.** Real under
  `/bin/bash`, which clears `set -e` inside `$( )`; the
  tests ran under `sh`, which keeps it, and could not
  see it. The library refuses a caller without `set -e`,
  and every case now runs through `/bin/bash`
  (`ALLOW_RUN` gains it). Red first: `a call where set -e
  is off or cannot bite is refused`.
- [x] **3. `./test postgres` no longer `exec`ed.** Taken
  for the one-door rule: `bin/test-postgres` asks for
  itself and `test` `exec`s it again. The premise that
  the old `TERM` trap downed compose at once did not
  reproduce: bash puts a trap off until the foreground
  child ends.
- [x] **4. A root found open.** Real: `chmod 700` on every
  use, and an entry must be this user's. Red first: `the
  root is private, even one found open`. The two
  ownership tests cannot be exercised by one user.
- [x] **5. Docs.** The TODO.md line reference and the
  unmeasured "about a second" in AGENTS.md. TEST-PLAN.md
  is the coordinator's.
- [x] **6. Tests.** Two artifact cases the byte-for-byte
  case covers are gone; `two runs at once` proves its
  overlap with a fifo and no sleep; the timeout is the
  browser suite's two minutes; two cases run the real
  `test` script in a replica. The file went from 26
  cases, 9.6 s wall and 7.4 s CPU, to 24 cases, 7.4 s and
  5.7 s, measured back to back at load 14 to 22.

## The library

As it landed, review fixes included.

```bash
# Sourced, never executed: the SHA result cache.
#
#     replay_or_run WAY [ARTIFACT...] -- COMMAND [ARG...]
#
# A step that passed on a clean tree does not run again
# for that SHA: its stdout and stderr replay, between two
# lines on stderr that say so. Red never replays, and a
# tree no SHA names (uncommitted changes, no commit, no
# repository) neither reads nor writes an entry.
#
# WAY names the step, its arguments, and whatever its
# result reads from the machine; the Deno version and
# NO_COLOR are added here. Each ARTIFACT is a file the
# step leaves. Its path is part of the entry's name, and
# a replay first proves the file still holds the bytes
# the step wrote.
#
# A step takes part when a second run on one SHA costs
# more than five seconds, the operator's line, or when it
# is a step of a command whose second run would. The
# measurements and the reasons are in
# docs/superpowers/specs/sha-result-cache-design.md.
#
# Call it under `set -e`, as a plain statement. A step
# whose first command failed must stop there, or a later
# passing command would turn it green and the green would
# be recorded. bash ignores `set -e` in everything called
# under `if`, `&&`, `||`, or `!`, and clears it inside
# `$( )`; a call from either place is refused. The same
# holds inside COMMAND, where this file cannot look: a
# timer or any other wrapper goes after the `--`, as
# `replay_or_run WAY -- TIMER COMMAND`, and calls its
# command as a plain statement too.
#
# Each script that does a step's work asks at its own
# door: test for the steps it runs itself, and
# bin/test-postgres, bin/test-browser, and bin/build for
# theirs.
#
# No cache failure sets an exit status: each says what
# failed on stderr, and the step runs for real.

: "${SHA_RESULT_CACHE_ROOT:=/tmp/fusion-angle-sha-result-cache}"

# Its body is a subshell that ignores SIGPIPE: a reader
# who has left loses this line and never takes the caller
# down with it.
sha_result_cache_say() (
    trap '' PIPE
    printf 'sha-result-cache: %s\n' "$*" >&2
    exit 0
)

# Print the entry that names WAY and ARTIFACTS at HEAD.
# Fail silently when no SHA names the tree, aloud when
# the cache cannot be used.
result_entry() {
    local way="$1" artifacts="$2" sha porcelain deno id
    sha=$(git rev-parse --verify --quiet HEAD 2>/dev/null) \
        || return 1
    porcelain=$(git status --porcelain 2>/dev/null) \
        || return 1
    [ -z "$porcelain" ] || return 1
    # /tmp is every user's to write, and a planted entry
    # would turn a red tree green: the root is this
    # user's own and closed to every other, even one
    # found open.
    if ! mkdir -p -m 700 "$SHA_RESULT_CACHE_ROOT" \
            2>/dev/null \
        || [ -L "$SHA_RESULT_CACHE_ROOT" ] \
        || [ ! -O "$SHA_RESULT_CACHE_ROOT" ] \
        || ! chmod 700 "$SHA_RESULT_CACHE_ROOT" \
            2>/dev/null \
        || ! mkdir -p "$SHA_RESULT_CACHE_ROOT/$sha" \
            2>/dev/null
    then
        sha_result_cache_say \
            "cannot use $SHA_RESULT_CACHE_ROOT;" \
            "running without it"
        return 1
    fi
    if ! deno=$(deno --version 2>/dev/null) \
        || ! id=$(
            printf '%s\n' "$way" "$artifacts" "$deno" \
                "NO_COLOR ${NO_COLOR:+set}" \
                | git hash-object --stdin 2>/dev/null
        )
    then
        sha_result_cache_say \
            "cannot name $way; running without the cache"
        return 1
    fi
    printf '%s\n' "$SHA_RESULT_CACHE_ROOT/$sha/$id"
}

# Print the id of the bytes at PATH, as they are on disk:
# without --no-filters git hashes a file in the tree as
# it would store it, line endings normalised.
artifact_id() {
    git hash-object --no-filters -- "$1" 2>/dev/null
}

# Replay ENTRY. Fail when no whole entry of this user's
# is there, or a file it claims is gone or holds other
# bytes. Its body is a subshell so the trap ends with it.
replay_result() (
    way="$1"
    entry="$2"
    [ -f "$entry" ] && [ -O "$entry" ] || exit 1
    sha="${entry%/*}"
    sha="${sha##*/}"
    if ! scratch=$(
        mktemp -d "${entry%/*}/replay.XXXXXX" 2>/dev/null
    ); then
        sha_result_cache_say \
            "cannot read the entry for $way; running it"
        exit 1
    fi
    trap 'rm -rf "$scratch"' EXIT
    if ! tar -xzf "$entry" -C "$scratch" \
        passed-at stdout stderr artifacts 2>/dev/null
    then
        sha_result_cache_say \
            "the entry for $way is unreadable; running it"
        exit 1
    fi
    while read -r id path; do
        if [ "$(artifact_id "$path")" != "$id" ]; then
            sha_result_cache_say \
                "$path is not the file $way left;" \
                "running it"
            exit 1
        fi
    done < "$scratch/artifacts"
    sha_result_cache_say "replaying $way, which passed at" \
        "$(cat "$scratch/passed-at") on $sha"
    cat "$scratch/stdout"
    cat "$scratch/stderr" >&2
    sha_result_cache_say "replayed $way; nothing ran"
    # The replay stands even where a caller closed stderr,
    # or a reader took its first lines and left: the step
    # must not run for real behind it.
    exit 0
)

# Write ENTRY from the transcripts in ASIDE: beside its
# name, then renamed onto it, so it appears whole or not
# at all. Quiet: the caller says what failed.
write_entry() {
    local entry="$1" aside="$2" listed="$3"
    printf '%s' "$listed" > "$aside/artifacts" \
        && date -u +'%Y-%m-%dT%H:%M:%SZ' > "$aside/passed-at" \
        && tar -czf "$aside/entry" -C "$aside" \
            passed-at stdout stderr artifacts \
        && mv -f "$aside/entry" "$entry"
} 2>/dev/null

# Record what COMMAND printed, unless the run no longer
# has the name it started with or left no artifact.
record_result() {
    local way="$1" entry="$2" artifacts="$3" aside="$4"
    local path id listed=''
    if [ "$(result_entry "$way" "$artifacts")" != "$entry" ]
    then
        sha_result_cache_say \
            "HEAD, the tree, or Deno changed under $way;" \
            "not recorded"
        return 1
    fi
    while IFS= read -r path; do
        [ -n "$path" ] || continue
        if ! id=$(artifact_id "$path"); then
            sha_result_cache_say \
                "$way left no $path; not recorded"
            return 1
        fi
        listed="${listed}${id} ${path}
"
    done <<ARTIFACTS
$artifacts
ARTIFACTS
    if ! write_entry "$entry" "$aside" "$listed"; then
        sha_result_cache_say "cannot write the entry for" \
            "$way; not recorded"
        return 1
    fi
}

# Run COMMAND with each stream passing through a tee, and
# record it if it passes. Its body is a subshell: the
# trap, the tees, and `set +e` end with it, and the
# caller's own traps and options are never touched.
run_and_record() (
    way="$1"
    entry="$2"
    artifacts="$3"
    shift 3
    set +e
    if ! aside=$(
        mktemp -d "${entry%/*}/aside.XXXXXX" 2>/dev/null
    ); then
        sha_result_cache_say \
            "cannot record $way; running without the cache"
        set -e
        "$@"
        exit
    fi
    if ! mkfifo "$aside/stdout.fifo" "$aside/stderr.fifo" \
        2>/dev/null
    then
        rm -rf "$aside"
        sha_result_cache_say \
            "cannot record $way; running without the cache"
        set -e
        "$@"
        exit
    fi
    trap 'rm -rf "$aside"' EXIT
    tee "$aside/stdout" < "$aside/stdout.fifo" &
    stdout_tee=$!
    tee "$aside/stderr" < "$aside/stderr.fifo" >&2 &
    stderr_tee=$!
    # A plain subshell, with `set -e` put back inside it:
    # a failing command still stops COMMAND, and its
    # status still reaches this line.
    ( set -e; "$@" ) \
        > "$aside/stdout.fifo" 2> "$aside/stderr.fifo"
    status=$?
    wait "$stdout_tee"
    stdout_written=$?
    wait "$stderr_tee"
    stderr_written=$?
    if [ "$status" -ne 0 ]; then
        exit "$status"
    fi
    if [ "$stdout_written" -ne 0 ] \
        || [ "$stderr_written" -ne 0 ]
    then
        sha_result_cache_say \
            "cannot keep what $way printed; not recorded"
        exit 0
    fi
    record_result "$way" "$entry" "$artifacts" "$aside"
    exit 0
)

replay_or_run() {
    local way="$1" artifacts='' entry
    shift
    while [ "$1" != '--' ]; do
        artifacts="${artifacts}${1}
"
        shift
    done
    shift
    case "$-" in
        *e*) ;;
        *)
            echo "Error: replay_or_run $way needs set -e" >&2
            exit 1
            ;;
    esac
    set +e
    ( set -e; false; true )
    if [ "$?" -eq 0 ]; then
        # The subshell ran past `false`.
        echo "Error: replay_or_run $way is called" \
            "where set -e cannot bite" >&2
        exit 1
    fi
    set -e
    if ! entry=$(result_entry "$way" "$artifacts"); then
        "$@"
        return
    fi
    if replay_result "$way" "$entry"; then
        return 0
    fi
    run_and_record "$way" "$entry" "$artifacts" "$@"
}
```
