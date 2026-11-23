# The SHA result cache

Branch and worktree `sha-result-cache`, cut from master's
`c36020172` ("Name production and guard worktree
creation").

## Intent

The operator's diagnosis is that testing time dominates
development throughput. Their words for this unit:

> every time consuming (>5 seconds) tool in our build/test
> suite should be idempotent per Git SHA such that running
> the same tool in the same way on the same SHA more than
> once will immediately return the original result. The
> result cache can live in /tmp/ as losing it is not
> catastrophic.

A commit is tested many times over. An agent runs
`./test`, then `./test validate`; the operator runs
`./test validate browser`, then `./deploy --local`, which
runs all three gates again. Each run repeats work whose
answer the same SHA already gave.

One ancestor of this exists. `./test validate` writes
HEAD's SHA to `<git-common-dir>/most-recently-validated-sha`
after a pass on a clean tree, and the next run on that SHA
prints `already validated <sha>` and returns. It holds one
entry, covers one command, and replays one line.

## The operator's ruling

The brief left the stamp's fate to this spec. While the
unit was in flight the operator ruled on it, and the
ruling is theirs, not the worker's:

> every tool, `./test validate` included, uses one
> consistent method of caching results.

What it settles, as relayed:

- The stamp does not survive as a second mechanism.
  `./test validate` and its `browser` and `postgres` forms
  go through the same per-SHA result cache as every other
  qualifying tool: the same key rule, root, replay
  announcement, dirty-tree rule, and write discipline.
- No tool gets a private variant. A tool that seems to
  need a special case is solved inside the one mechanism,
  and the spec says how.
- Everything that reads or documents the stamp moves to
  the one mechanism or is rewritten to match it.
- `./test validate --syntax` must still never make a later
  full `./test validate` skip.
- The tests that pinned the stamp pinned a covenant the
  operator has changed. They are replaced with tests of
  the new covenant, on purpose.

This spec had already taken that course. Decisions 2, 11,
and 15 are where it is carried out.

After the unit was built and proved, the operator ruled on
decision 5 as well, the one place this design departs from
their first sentence:

> Yes, you're right, failure should not be cached.

Two more choices were put to the operator at the same
time and drew no objection: lint and the API
documentation check take part though each runs in under
five seconds (decision 1), and `./bin/measure` stays
outside (decision 12).

## What was measured

Every candidate was timed on this branch's base commit, on
a 16-core laptop. Wall-clock seconds, each run a fresh
process timed from outside.

The first table was taken unlocked, with three sibling
agents running suites at the same time and the load
average between 8 and 39. Every figure in it is
contended: read each as an upper bound, and trust the
ordering more than the size.

| Tool | Runs (s) | Median | Repeats under 5 s? |
|---|---|---|---|
| `./test` (memory) | 238.8, 175.0, 258.4 | 238.8 | no |
| `./test lint` | 10.6, 10.1, 10.3, 4.7 | 10.2 | no |
| `./test api-docs` | 12.7, 12.5, 13.5, 7.7 | 12.6 | no |
| `./test postgres` | 45.4, 27.3 | 36.4 | no |
| `./test browser` | 828.1, 1181.1 | 1004.6 | no |
| `./bin/build dir/` (ZIP) | 11.8, 11.0, 11.1 | 11.1 | no |
| `./bin/build --no-zip dir/` | 3.8, 4.0, 3.7, 3.6 | 3.7 | yes |
| `./test check` | 17.4, 0.4, 0.2 | 0.4 | yes |
| `./test validate --syntax` | 0.4, 0.2, 0.2 | 0.2 | yes |
| `./test schema` | 0.3, 0.04, 0.05 | 0.05 | yes |

AGENTS.md records the memory suite at 9.5 s on a quiet
machine; the same suite took three to four minutes here.
The fourth lint and API documentation runs were taken at
load 12 and used 3.4 and 5.6 CPU-seconds.

`./test check` is slow once and fast after: its first run
on these bytes took 17.4 s and the next two 0.4 s and
0.2 s, because Deno keeps its own type-check cache, keyed
by content. It is already idempotent, and for more than a
SHA.

`./test browser` could not start Chrome inside the agent
sandbox, so its runs were taken outside it. `./test
postgres` ran inside it, under the workers' 5432 lock.
The second browser run printed `164 passed | 0 failed`
and then exited 127: the worker edited `bin/test-browser`
while it ran, and bash reads a script as it goes. Its
duration stands and its status does not count.

Two more costs bear on the design. `git status
--porcelain` takes 0.17 s here and `git rev-parse HEAD`,
`deno --version`, and `Chrome --version` 0.01 s to 0.03 s
each, so asking the cache costs about a fifth of a second.
`git hash-object` reads the 76 MB executable in 0.15 s.

The steps near the line were taken again under the
workers' suite lock, which keeps any other full suite
from running at the same time; the one-minute load
average was falling from 49 to 22 as they ran. These
are the figures decision 1 rests on.

| Tool | Runs (s) | Median | Repeats under 5 s? |
|---|---|---|---|
| `./bin/build dir/` (ZIP) | 5.6, 7.1, 9.3 | 7.1 | no |
| `./test lint` | 3.6, 3.3, 3.3 | 3.3 | yes |
| `./test api-docs` | 2.7, 2.6, 2.7 | 2.7 | yes |
| `./bin/build --no-zip dir/` | 3.1, 2.1, 2.1 | 2.1 | yes |
| `./test check` | 0.14, 0.14 | 0.14 | yes |
| `./test schema` | 0.05, 0.05 | 0.05 | yes |

The memory, Postgres, and browser suites were not taken
again: each sits far above the line at any load.

`./bin/measure` was not timed as a candidate; the decision
below does not turn on its duration.

## Decisions

### 1. A step takes part when a repeat costs over five seconds, its own or its command's

The five-second line is the operator's. It is applied to
what a second run on one SHA costs, because that is the
cost this unit removes.

Four steps cross it on their own: the memory suite, the
Postgres suite, the browser suite, and the ZIP build.

Lint and the API documentation check do not. Under the
suite lock they take 3.3 s and 2.7 s; the 10 s and 13 s
of the first table were contention. They take part
because `./test validate` is far over the line and
repeats at the sum of its steps that still run. With
those two outside the cache a validated SHA would cost
6.3 s to validate again on a quiet machine and over 20 s
on a loaded one, where the stamp costs nothing today.
With them inside it costs `check` and `schema`, 0.2 s.

`./test check`, `./test validate --syntax`, and `./test
schema` repeat in well under a second and always run. A
cache over them would guard a cost that is not there.

`./bin/build --no-zip dir/` takes 2.1 s and always
builds. No command composes it into something slower.
That also keeps the Docker image build and the measure
sweep, which both use it, away from the cache.

### 2. The cache holds steps, not commands

`./test validate` is `check`, memory, lint, `schema`, and
the API documentation check, in that order. `./test
validate browser` adds the browser suite, and `./deploy
--local` runs `./test validate`, `./test postgres`, and
`./test browser` before it serves.

Each step that takes part asks the cache for itself. A
command made
of steps is then fast whenever its steps have passed, in
whatever command they passed: `./test` followed by `./test
validate` runs the memory suite once, and `./deploy
--local` on a gated SHA goes straight to serving. No entry
exists for `validate` as a whole, and `deploy` needs no
change.

### 3. "The same way" is the SHA, the step, and what the step reads from its machine

An entry is named by HEAD's SHA and by the step's *way*:

- the step and its arguments (`memory`, `lint`,
  `api-docs`, `postgres`, `browser …`, `build …`);
- `deno --version`, all three lines, because the runtime
  is not in the tree and a new one may fail the same
  bytes;
- whether `NO_COLOR` is set, because the result is bytes
  and that variable changes them;
- for the browser suite, the browser: `Chrome --version`
  for the binary `CHROME` names, or `CHROME_DEBUG_URL`
  itself when the suite attaches to a running Chrome.
  Chrome replaces itself in place, so the path alone
  would not see a new version;
- for a step that leaves a file, the file's path. The
  build's is its ZIP, whose path carries the destination
  and so `HOME`. The same step asked for another file is
  another entry, never a replay that claims the first.

Left out, each for a reason:

- `TZ`. `run_memory`, `bin/test-postgres`, and
  `bin/test-browser` pin it themselves. Lint reads no
  clock. The API documentation generator pins its own
  day; it was run under `TZ=Pacific/Honolulu` and
  answered `up to date`. The ZIP's function does not
  depend on the zone.
- `JWT_HMAC_SIGNING_KEY`. The suites sign and verify with
  whatever key they hold, and the generator installs its
  own.
- The worktree's path. Two worktrees at one SHA with
  clean trees hold the same bytes, and sharing between
  them is the point.
- The Docker engine, the operating system, the versions
  of `awk`, `perl`, `grep`, and `git`. The key stops at
  what the repository's own scripts choose between.

One inexactness is accepted: lint runs no Deno and still
runs again after a Deno upgrade. One rule for every step
costs one lint run per upgrade.

HEAD's commit SHA names the entry, not its tree's. Two
commits can share a tree, but the build embeds the commit
log and the status tests read it, so they are two runs.

### 4. What no SHA names neither reads nor writes the cache

A dirty tree, a directory with no commit, and a directory
that is no repository run for real, every time, and store
nothing. The check is `git rev-parse HEAD` and an empty
`git status --porcelain`, the same test `./bin/build`
applies before it builds.

The name is taken again after the run. If HEAD moved, or
the run left the tree dirty, or Deno changed underneath
it, the result belongs to no SHA and is not stored; one
line on stderr says so.

`./test` with `POSTGRES_URL` set also runs the suite's
Postgres files against that database. No SHA names a
database, so the memory suite runs for real whenever that
variable is set.

### 5. The result is stdout, stderr, and a pass; red never replays

A green run's stdout and stderr are stored and replayed,
each to its own stream, and the replay exits 0.

A red run is not stored. The operator's sentence covers a
red result as much as a green one, and this is the one
place the design departs from it, for a reason that
outranks it. The scripts answer exit 1 for a failing test
and for a held port alike: for Docker stopped, Chrome
missing, a sandbox that will not start a browser, a
signal, a timeout under load. A SHA and a way name none of
those. A stored red would replay a machine's bad minute as
a fact about the tree until the next commit, and the cure
would be to know about the cache root and delete it.

Four such reds happened while this unit was built, on
commits that were not red:

- The browser suite went red inside the agent sandbox,
  which will not start Chrome.
- Three `./test postgres` runs went red in a row because
  another worker held port 5432.
- This unit's own Layer 1 proof went red on three
  `bin/develop` tests that wait eight seconds for a
  server, with the load average near 100. The same tests
  had passed half an hour earlier, on a tree that differed
  only in this unit's library and its tests.
- A sibling's browser suite ran 65 minutes with the load
  average near 200 and went red on four tests that hit
  their two-minute bound from starvation alone.

Each was true of the machine and false of the tree. Under
a cache that stored red, each would have been its SHA's
result until the next commit. No red is ever written, so
a starved run cannot become one.

A green is different in kind. It is evidence that the
bytes can pass, and no later accident of the machine
unsays it.

The cost is that a true red asked twice of one SHA runs
twice, as it does today. It is small: the cure for a true
red is a change to the tree, which dirties it or moves
HEAD, and either one ends the question.

The choice is a one-way ratchet, and it has a price of
its own. A step that fails now and then is recorded the
first time it passes, and from then on it replays green
until HEAD moves. Running a suite again to hunt a flake
no longer runs it: the hunter removes the SHA's directory
under the root first, or the root.

Order within each stream is kept. Order between the two
streams is not: a replay writes all of stdout, then all of
stderr.

### 6. A replay proves its artifact first

The ZIP build's result includes a file. Its entry keeps
the ZIP's path and the `git hash-object --no-filters` id
of its bytes on disk. A replay hashes the file at that
path first; a missing file, or one with other bytes, is no
hit, says so, and builds again.
After a build, a ZIP that is not where the build said is
not recorded.

The check is by content, not by presence, because a path
can outlive the file that earned it.

### 7. A replay says so, first and last

Two lines on stderr bracket every replay:

```
sha-result-cache: replaying memory, which passed at 2026-11-23T09:25:52Z on 5306a7c12a4d26d1300d4c317e75802a56f11952
…the original stdout, then the original stderr…
sha-result-cache: replayed memory; nothing ran
```

The first reaches a reader who starts at the top, the
second one who reads the tail. They go to stderr so that a
caller who captures stdout gets the original bytes and
nothing else. The time is when the original run passed,
RFC 3339 zulu, to the second: `date` offers no finer.

A real run prints nothing new. Its own output is what
makes it visibly real.

### 8. The cache lives at `/tmp/fusion-angle-sha-result-cache`

The operator named `/tmp/`. One fixed path there is shared
by every terminal, worktree, and session of one user, which
`$TMPDIR` is not on every machine. The operating system
empties `/tmp` at restart; nothing in the repository sweeps
it.

`SHA_RESULT_CACHE_ROOT` overrides the path. The tests use
it to give each case a root of its own, and an agent whose
sandbox cannot write `/tmp` exports it in its own shell,
beside `DENO_DIR`. No script names a sandbox.

`/tmp` is writable by every user of the machine, and an
entry planted there would turn a red tree green. The root
is created mode 700 and set to it again on every use, so
one found open is closed first. A root that is a symbolic
link or is owned by someone else is refused, and an entry
owned by someone else is no entry.

### 9. An entry is one file, renamed into place

An entry is a gzipped tar of four members: `stdout`,
`stderr`, `passed-at`, and `artifacts`. It is written
beside its final name and renamed onto it, so it appears
whole or not at all, and two worktrees finishing the same
step at once leave one whole entry, the later one. One
file is used because a rename replaces a file atomically
and does not replace a directory at all.

Its path is `<root>/<sha>/<id>`, where `<id>` is `git
hash-object` of the way's text. Git is already required to
name the SHA, so it names the way and the artifact too,
and nothing new is needed on any machine.

A replay extracts all four members to a scratch directory
before it prints a byte, so a partial entry never prints
half a result. Gzip is there because transcripts are large
and repetitive: the memory suite's is 840 KB and 123 KB
compressed, the browser suite's 4.3 MB and 637 KB.

### 10. A cache failure changes nothing but speed

A missing entry runs for real. An unreadable or partial
one, a root that cannot be created or is not ours, a
transcript that could not be written, a failed rename: each
prints one `sha-result-cache:` line on stderr saying what
failed, and the step runs for real or goes unrecorded. No
cache failure sets an exit status. A red stays red and a
green stays green.

### 11. The stamp is retired, by the operator's ruling

`most-recently-validated-sha`, its `already validated`
line, and its two environment seams,
`MOST_RECENTLY_VALIDATED_SHA_PATH` and
`WORKING_TREE_PORCELAIN`, go. Nothing takes their place
beside the cache: `./test validate` has no mechanism of
its own (decision 2).

Three of the five steps `./test validate` composes
replay, and the two that still run cost under half a
second together, so the command keeps the stamp's speed,
gains its steps' original output, and shares them with
`./test` and `./deploy --local`.

Who read the stamp was checked by search, not assumed.
`test` wrote and read it; `tests/test-cli.test.ts` pinned
it; AGENTS.md had one sentence on it and TODO.md one
list entry. `bin/build`, `deploy`, `bin/measure`,
TEST-PLAN.md, and README.md never read or named it. All
four places change; the specs and plans of finished
units that mention it are history and stay.

`./test validate --syntax` still runs `deno check` and
nothing else. Its rule, that a syntax pass must never
excuse a full one, held under the stamp because that
branch took care not to write it. It now holds by
construction: `check` is not a step that takes part, so
it has no entry to write, and a full validate asks only
for memory, lint, and the API documentation check.

The file a previous `./test validate` left under the git
common directory is never read or written again. This
unit does not delete it: it sits in the main checkout's
git directory, which every worktree shares, and branches
cut before this one still write it until they are
rebased. Code that removed it would undo their stamp on
every run. The operator removes it once, after those
branches land:

```bash
rm "$(git rev-parse --git-common-dir)/most-recently-validated-sha"
```

### 12. What stays outside

- `./bin/measure`. A sweep answers how fast this machine
  serves these bytes now, and no SHA names a machine's
  load. Its `--record` form appends to
  `measurements/history.jsonl`, which is already the
  per-SHA record of what was measured, and `--visualize`
  reads it back without Chrome; a second store of the
  same fact would be a copy of the ledger. Its `--check`
  form is a verdict, but a verdict on the machine's
  present.
- `./deploy --render`. Its result is production's state,
  which `https://fusionangle.com/status` reports. A replay
  of "deployed" would claim a state without looking at it.
  It takes part only in that nothing it runs is cached.
- `./deploy --local` after its gates, `./bin/develop`, and
  `./bin/serve`. A process that serves until interrupted
  has no result to replay.

### 13. No lifetime and no tooling

An entry is true for as long as its SHA and its way are,
so it has no age to check. The escape hatch is `rm -rf` on
the root, or on one `<sha>` directory beneath it. Nothing
lists, inspects, or purges entries.

### 14. Each script asks at its own door, and a timer goes inside the ask

The ask lives in the script that does the step's work.
`test` runs the memory suite, lint, and the API
documentation check itself, so it asks for those.
`bin/test-postgres`, `bin/test-browser`, and `bin/build`
do their own work, so each asks for its own, and `test`
still `exec`s the first two as it did before this unit.
One rule covers every tool, the script that asks is the
one that knows what its result reads from the machine,
and the process a signal reaches is the suite's own.

The cache check is outermost. Whatever times a step goes
after the `--`, at that same door, so a replay is never a
timing sample:

```
replay_or_run WAY -- TIMER COMMAND
```

```bash
replay_or_run memory -- TIMER run_memory            # test
replay_or_run postgres -- TIMER postgres_suite      # bin/test-postgres
replay_or_run "browser $BROWSER" -- TIMER browser_suite
replay_or_run build "$SERVER_ZIP" -- TIMER build    # bin/build
```

A step that is not asked of the cache is timed the same
way without the ask: `TIMER run_check`, `TIMER build` for
`--no-zip`.

The timer calls its command as a plain statement, never
under `if`, `&&`, `||`, or `!`, and never inside `$( )`.
`replay_or_run` refuses such a call of itself, but it
cannot see inside `COMMAND`: a timer that took its
command's status with `||` would switch `set -e` off
inside `run_memory`, a failed first pass followed by a
passing second would exit 0, and the pass would be
recorded. A timer written as start, `"$@"`, record
runs its record only on a pass, because `set -e` ends the
step at the failure. How a failed step's duration is
taken is that unit's to decide; whatever it does leaves
`"$@"` a plain statement.

### 15. One mechanism, and how each seeming special case fits inside it

The operator ruled that no tool gets a private variant.
Every entry is read and written by `replay_or_run` in
`bin/sha-result-cache-lib`, under one key rule, one root,
one announcement, one dirty-tree rule, and one write
discipline. The cases that look special are these.

- **A command made of steps** (`./test validate`, its
  `browser` and `postgres` forms, and `./deploy --local`'s
  gates). It holds no entry. Each step in it that takes
  part asks the
  cache through the same call, so the command replays
  step by step, each replay announced the same way.
- **A step that leaves a file** (the ZIP build). The same
  call takes the file's path as one more argument. The
  entry lists it, and the replay proves it (decision 6).
- **A step whose result follows a program outside the
  tree** (the browser suite). What that program says it
  is goes into the step's way (decision 3).
- **A step that cannot be named.** Decision 4 says what
  no SHA names is not asked of the cache. The library
  applies that to the tree. Two steps apply it to
  something only they know of, at their own door, by
  calling the step instead of `replay_or_run`: the memory
  suite when `POSTGRES_URL` names a database, and the
  browser suite when Chrome will not state its version.
  Neither stores or replays anything by another route.
- **A step under the five-second line that no slow
  command composes** (`check`, `schema`, `--syntax`, the
  `--no-zip` build). It has no cache of ours at all.
  `deno check` repeats quickly
  because Deno keeps a type-check cache of its own; that
  is the runtime's, and nothing here adds to it.

## Design

### `bin/sha-result-cache-lib`

Sourced by `test`, `bin/test-postgres`, `bin/test-browser`,
and `bin/build`. One entry point:

```
replay_or_run WAY [ARTIFACT...] -- COMMAND [ARG...]
```

0. Refuse a caller whose `set -e` is off or cannot bite:
   exit 1 with a message.
1. Name the entry: HEAD's SHA, a clean tree, a usable
   root, and the id of `WAY`, each `ARTIFACT`'s path,
   `deno --version`, and `NO_COLOR`. With no name, run
   `COMMAND` in the calling shell exactly as before and
   return.
2. If the entry is this user's, extracts whole, and every
   artifact it lists still hashes to its recorded id,
   announce, write its stdout and stderr, announce, and
   return 0.
3. Otherwise run `COMMAND` in a subshell with its stdout
   and stderr each passing through a `tee` into a
   directory beside the entry. Wait for both `tee`s.
4. If `COMMAND` exited 0, both transcripts were written,
   the entry still has the name it started with, and
   every `ARTIFACT` exists: write the four members, tar
   them, and rename the tar onto the entry.
5. Remove the directory and return `COMMAND`'s status.

Four properties are load-bearing.

`set -e` must bite inside `COMMAND`. `run_memory` is two
`deno test` runs; if the first failed and the second
passed with `set -e` off, the suite would pass and the
pass would be recorded. Bash ignores `set -e` in
everything called from an `if`, `&&`, `||`, or `!`, and
clears it inside `$( )`, where POSIX `sh` keeps it. So
step 0 refuses a caller without `set -e`, then proves
that it bites where the call stands; and step 3 captures
the status with `set +e` around a plain subshell that
turns `set -e` back on inside. A step is therefore always
called under `set -e`, as a plain statement.

Steps 3 to 5 run in a subshell of their own. The `EXIT`
trap that removes the directory, the two `tee`s, and `set
+e` all end with it, so the calling script's own traps
and options are never touched, and an interrupt leaves
nothing beside the entries.

A reader who has gone never costs a run. Every line the
library says is written from a subshell that ignores
`SIGPIPE`, so `./test validate 2>&1 | head -5` on a
recorded SHA loses the tail of the replay and nothing
else. Before that held, the replay died on its last line,
was taken for a miss, and the step ran for real behind
the reader's back.

A step that is replayed sets nothing in the calling shell.
`run_memory` exports `JWT_HMAC_SIGNING_KEY`; no later step
reads it, and none may come to.

### Call sites

`test` gains three functions and calls them from its
dispatcher and from `run_validate`:

```bash
replay_or_run_memory() {
    if [ -n "${POSTGRES_URL:-}" ]; then
        run_memory
    else
        replay_or_run memory -- run_memory
    fi
}
replay_or_run_lint() { replay_or_run lint -- run_lint; }
replay_or_run_api_docs() {
    replay_or_run api-docs -- run_api_docs
}
```

`run_validate` becomes `run_check`, memory, lint,
`run_schema`, API documentation, with no stamp. `test`
`exec`s `bin/test-postgres` and `bin/test-browser` as it
did before.

`bin/test-postgres` asks at its own door. Everything it
did becomes `postgres_suite`: the Docker check, the minted
stack, its teardown trap, `docker compose up`, and the
`deno test` run. A replay needs none of them, Docker
included. It is called as `replay_or_run postgres --
postgres_suite`.

`bin/test-browser` asks at its own door, because only it
knows which browser it will drive. Its bundle-and-test
tail becomes `browser_suite`, called as `replay_or_run
"browser $BROWSER" -- browser_suite`, where `BROWSER` is
`CHROME_DEBUG_URL` or `"$CHROME" --version`. If Chrome
will not state a version, or states nothing, the suite
runs uncached.

`bin/build` asks at its own door, because only it knows
its destination. Its work becomes `build`; the ZIP form
calls `replay_or_run build "$SERVER_ZIP" -- build`, and
`--no-zip` calls `build`.

`deploy`, `bin/measure`, and the Dockerfile do not change.

## Costs

- A recorded run writes through two pipes. A tool that
  draws differently on a terminal, such as Docker's
  progress display, draws its plain form on a clean tree.
  Deno colors its output either way.
- stdout and stderr pass through separate `tee`s, so a
  line of one may land a moment before or after a line of
  the other. Order within each stream is kept.
- A recorded run waits for both `tee`s, and a `tee` ends
  when the last writer closes its pipe. A step that left
  a descendant running with the step's stdout or stderr
  still open would stall there. No step does today:
  Chrome is spawned with its own pipes and Docker's
  containers hold none of ours.
- A signal aimed at one process id reaches the script
  that asks, not the step. On a recorded run the step is
  in a subshell and that script holds no trap of its own,
  so `kill <pid>` ends it at once with 143 while the step
  finishes behind it, records, and tears down what it set
  up. Before this unit bash put the suite's `TERM` trap
  off until the suite had finished, so the stack came
  down at the same moment either way; what changed is
  that the process id is gone first. On a dirty tree the
  step runs in the script's own shell, traps and all, as
  it always did. Ctrl-C reaches every process and stops
  the step.
- Asking costs about 0.2 s per step, most of it `git
  status`, on every run, clean or dirty.
- `bin/test-postgres`, `bin/test-browser`, and
  `bin/build` each have a block re-indented into a
  function. A sibling unit that edits those lines will
  meet a conflict there.
- The root grows by under a megabyte per fully gated SHA
  until the next restart.

## Tests

`tests/sha-result-cache.test.ts` drives `replay_or_run`
through `/bin/bash`, the shell its callers' first line
names: bash and POSIX `sh` differ on exactly what the
library guards. Each case has a repository and a cache
root of its own. It pins: a pass replays both streams,
says so, and returns to its caller; a replay stands when
its reader has closed stderr or left early; red runs
every time with its status and output intact; `set -e`
stops a failing step and nothing is recorded; a call with
no `set -e`, under `if`, or inside `$( )` is refused; a
dirty tree, an unborn branch, and no repository record
nothing; a run that moves HEAD or dirties the tree is not
recorded; another SHA, another way, another Deno,
`NO_COLOR`, and another artifact are other entries; an
artifact that is gone, changed only in its line endings,
or never made; an unreadable entry; a recording lost
mid-run; a root found open, an unusable root, and a
symbolic-link root; two runs that are proved to overlap
by a fifo, with no clock; nothing left beside the
entries.

Two cases run the real `test` script, copied with the
real library into a repository of its own beside
stand-ins for `deno` and the generator, under the shell
its first line names. One runs `./test` and `./test
api-docs` for real and then as replays, and `./test` with
`POSTGRES_URL` set for real again. The other fails the
memory suite's first pass and passes its second, and pins
exit 1, no second pass, and no entry: the unit's worst
failure, through the script that ships.

`tests/test-cli.test.ts` pinned the stamp. The operator
changed that covenant, so those pins are replaced on
purpose, each by a pin of what now holds:

| Stamp pin | Its successor |
|---|---|
| `test validate skips when HEAD already passed` (spawned `./test validate` against a stamp file) | `the real test script replays the steps that passed`, which spawns the real script, and `validate composes cached and uncached steps` |
| `test memory does not SHA-skip` | `test asks the result cache for its own three steps`. The old covenant is reversed on purpose: the memory suite now replays per SHA |
| `validate --syntax is check and does not stamp` | `validate --syntax is check and records nothing`: every old assertion kept, and two added, that neither the branch nor `run_check` calls `replay_or_run` |
| `test validate skip returns so combinations continue` | `a pass replays both streams and says so`, which pins that the caller goes on after a replay, and `validate browser reaches the browser suite`, which keeps the old order assertions |

The same file gains `check and schema run every time` and
pins on `bin/test-postgres`, `bin/test-browser`, and
`bin/build`. Those three are regular expressions over
script source: running any of them for real needs Docker,
Chrome, or a compile.

No test spawns `./test validate`: it would run `deno
check` for real, cold, inside the suite that is running.

## Docs

AGENTS.md: the Gates section describes the cache; the
sentence on the validate stamp is rewritten; the sandbox
block gains the `SHA_RESULT_CACHE_ROOT` export. TODO.md's
list of environment names trades the stamp's two for the
cache's one.

## Not chosen

- **Replaying red.** Decision 5.
- **One entry per command.** `./test` and `./test
  validate` would each run the memory suite.
- **Naming entries by tree.** A squash or a `--no-ff`
  merge of a rebased branch keeps the tree, so results
  would carry across both. The build and the status tests
  read the commit, so the name would be wrong for them,
  and the operator asked for the SHA.
- **Storing the ZIP in the cache** and restoring it on a
  replay. It is the fuller reading of "the original
  result", at 39 MB an entry.
- **A cache in the git directory**, where the stamp lives.
  It would be shared with the sandbox for free and would
  never be swept.
