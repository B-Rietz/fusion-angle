# The duration regression alarm

Branch and worktree `duration-regression-alarm`, cut from
master `c36020172` and rebased onto `sha-result-cache` at
`08afff195`, which carries master's `873c89b4b`. What the
rebase changed is under Integration onto master, at the
end.

## Intent

The operator's diagnosis is that testing time dominates
development throughput, and their words for this unit
were: "a tool in the build/test chain that fairly recently
ran in 2 minutes may now be taking around 10 minutes, for
instance."

**Assumption, inherited from the dispatching session and
not confirmed by the operator:** the ask is for the thing
in the build/test chain that notices when a tool is now
running far slower than it recently did, and says so.
Today nothing would tell anyone. This unit does not make
any tool faster and does not replay any result: the two
`faster-*` units and `sha-result-cache` own those.

## What was measured

All of it on one 16-core machine shared with three
sibling workers, so every wall-clock figure below is
under contention. Load is the one-minute load average.

- **Nothing records a tool's duration.** `grep -nE
  '\bSECONDS\b|date \+%s|elapsed|duration' test deploy
  bin/*` finds one wait deadline in `bin/postgres-lib` and
  a schema name in `bin/test-postgres`.
- **The docs disagree.** `AGENTS.md:163` says `./test`
  takes 9.5 s (`44447626f`, 2026-09-01). `TODO.md:3706`
  says 44.2 s over three runs (`8b82c6c61`, 2026-09-24).
- **Load swamps wall-clock time.** Seven `./test` runs of
  the same suite (`c36020172`, or commits that add only
  this unit) took 157.5 s, 160.5 s, 244.5 s, 315.9 s,
  331 s, 374.6 s, and 661.5 s. Load at the start ran from
  6 to 93.
- **CPU seconds hardly move with load, and they show the
  real slowdown.** `/usr/bin/time -p ./test`, user plus
  sys:

  | Commit | Date | Tests | CPU s | Wall s | Load |
  |---|---|---|---|---|---|
  | `44447626f` | 09-01 | 3489 | 143 | 35.6 | 64 |
  | `8b82c6c61` | 09-24 | 3712 | 626 | 238.5 | 98 |
  | `c36020172` | 11-21 | 4950 | 1616 | 661.5 | 93 |

  The suite does 11.3 times the work it did on 09-01 for
  1.42 times the tests. Nothing said so at either step.
- **A reading at the start is not enough.** Three runs
  began at a load of 6.2, 15.8, and 8.1 and took 157.5 s,
  160.5 s, and 244.5 s. The first two ended at 15.8 and
  14.7. The third ended at 26.8: a sibling's suite started
  under it.
- **What a quiet reading is worth.** Scaling the 44.2 s of
  09-24 by the CPU ratio puts today's quiet duration near
  114 s. That is an estimate from single runs. Against it
  the two runs that read under 1 per core at both ends
  were 1.4 times slow, and the run that ended at 1.68 per
  core was 2.1 times slow.
- **One step has two honest durations.** `./test check`
  took 6.5 s, then 0.18 s on the next run: `deno check`
  keeps the result of a check whose inputs did not change.
- **The instrument is cheap.** Two `deno run`s of 10 to
  20 ms, one `git status` of 70 ms, three `git rev-parse`
  of 8 ms: about 0.1 s a step.
- **The scripts run under bash 3.2** (`#!/bin/bash` on
  macOS), which has no sub-second clock.

## Decisions

The operator delegated spec through fix, so nothing here
waited for approval. Each decision carries its reason.

### 1. It is a second thing, not a part of `./bin/measure`

`./bin/measure` is a ceremony the operator starts on
purpose. It needs Chrome, Postgres, and a clean tree; it
measures the product's page loads; it writes
`measurements/history.jsonl`, which is committed and
shared by every machine; and `--check` gates medians
against a budget a person ratified.

A tool's duration is a by-product of running the tool. It
must be recorded on every ordinary run with no ceremony,
it belongs to one machine, it must never dirty the tree,
and it is compared with its own recent past, not with a
ratified number. A committed history would dirty the tree
on every test run, and a dirty tree blocks `./bin/build`,
`./deploy`, and `./bin/measure` and keeps every step out
of the SHA result cache.

So the two share a vocabulary and nothing else: a JSON
Lines ledger, `sha`, a `machine` block, and the median.
The new code imports `median` from
`web-app/app/measure-core.ts` and records `arch` in the
words `measurements/history.jsonl` already uses.

### 2. The ledger lives under the git common dir

`$(git rev-parse --git-common-dir)/tool-durations.jsonl`,
redirected by `TOOL_DURATIONS_PATH`. It was put beside
the validate stamp, which the SHA result cache has since
retired. `/dev/null` there means no ledger: the step
runs, nothing is recorded, the timer runs no program of
its own, and nothing is said. A test that spawns a
script it does not mean to time hands it that
(Integration onto master).

- It survives. `/tmp` is emptied by a reboot and aged out
  by macOS, so "fairly recently" could not mean two weeks
  there.
- It never dirties a tree: nothing under the git directory
  is in any working tree.
- It is per machine: a clone's git directory is never
  pushed.
- It is one file for the clone, so a worktree's history
  outlives the worktree.

Each sample is one line, appended with a single write to a
file opened for append, so concurrent worktrees do not
tear each other's lines. The file is never rewritten. A
last line that lost its newline gets one before the next
sample, so no sample is glued onto another.

From the main checkout the git directory is inside the
image build context (`COPY . .`). `.dockerignore` names
the ledger, so a run recorded before a build does not
defeat Docker's layer cache.

A place git cannot describe has no ledger: Render's image
build deletes `.git`. There the step runs untimed and one
line on stderr says so.

### 3. A sample

One JSON object per line:

| Field | Meaning |
|---|---|
| `tool` | the script, for example `./test` |
| `arguments` | the words that fix its work: `["memory"]` |
| `sha` | `git rev-parse HEAD`, 40 hex |
| `tree` | `clean` or `dirty` |
| `worktree` | `git rev-parse --show-toplevel` |
| `startedAt` | RFC 3339 zulu, microseconds |
| `durationMs` | wall-clock milliseconds |
| `exitStatus` | the step's exit status |
| `machine` | `platform`, `arch`, `cpuCount` |
| `loadAtStart` | load average as it began |
| `loadAtEnd` | load average as it ended |

`tree` is what `git status --porcelain` says where the
step runs, as it is for the SHA result cache. No variable
overrides it.

`arguments` is chosen at each call site, never copied from
`$@`: `./deploy --render TOKEN` and `./bin/measure
--password SECRET` carry secrets in their arguments, and a
destination directory or a port does not change the work.

`worktree`, `loadAtStart`, and `loadAtEnd` are three more
fields than the dispatching brief listed. Decisions 4 and
5 need each, and none can be derived later.

The duration is the wall-clock difference between two
instants, each read by its own short `deno run`, because
bash 3.2 has no sub-second clock and the timed step is a
shell function, which nothing outside its shell can wrap.
`startedAt` comes from `Temporal`, as `server/log-stamp.ts`
reads it.

A sample is a completed execution, green or red. A step
killed by a signal takes its shell with it and leaves no
sample; a step that turns an interrupt into an exit
status is recorded red.

### 4. What counts toward the baseline

A run counts when all of these hold:

- it is the same series: equal `tool`, `arguments`,
  `worktree`, and `machine`;
- it completed green: `exitStatus` is 0. A run that dies
  early is fast, and would drag the baseline down;
- it was quiet at both ends (decision 5);
- it started within the window before this run.

A worktree is its own series because its code is its own.
With one series for the whole clone, a worktree that made
a tool five times faster would raise the alarm in every
other worktree, where nothing regressed. The cost is that
a fresh worktree says "no baseline yet" for its first
three quiet runs.

A replay never reaches the ledger at all, because only
real execution is timed (decision 7).

SHA and tree state are recorded and are not part of the
series. Comparing across commits is the whole point.

### 5. The comparison

Every threshold is a named constant in
`web-app/app/tool-duration-core.ts`:

| Constant | Value |
|---|---|
| `BASELINE_WINDOW_DAYS` | 14 days |
| `BASELINE_MINIMUM_RUNS` | 3 runs |
| `SLOWDOWN_RATIO` | 3 times |
| `SLOWDOWN_FLOOR_MS` | 30 000 ms |
| `CONTENDED_LOAD_PER_CORE_AT_START` | 1 per core |
| `CONTENDED_LOAD_PER_CORE_AT_END` | 1.5 per core |

**Then** is the median duration of the baseline runs. The
median is the repo's statistic (`./bin/measure --check`
gates medians), and one odd run on either side does not
move it.

**Now** is this run.

**Slow** means both `now ≥ SLOWDOWN_RATIO × then` and
`now − then ≥ SLOWDOWN_FLOOR_MS`. The floor is half a
minute for two reasons. The complaint is about minutes.
And a step with a cache has two honest durations: `./test
check` takes 0.18 s on a hit and 6.5 s on a miss, and two
misses in a row must not read as a regression.

**Quiet** means the load average per core (`load /
cpuCount`) was under 1 as the step began and under 1.5 as
it ended. At 1 the run queue is already as long as the
machine is wide. The end reading also holds the step's
own jobs, so its bound is higher; it sees load that
arrived after the step began. A contended run is
recorded, is never a baseline run, and never raises the
alarm.

Two readings of a one-minute average bound nothing about
the minutes between them. The thresholds rest on what was
measured: runs that read quiet stayed within about 1.4
times the estimated quiet duration, the run that ran 2.1
times read 1.68 at its end, and the ratio is 3.

**A regression is a slow quiet green run whose predecessor
was slow and quiet too.** One slow run can be a cold
cache: a first `deno check` after an upgrade, a Postgres
image pull. It can be load the readings missed. Load only
adds time, so the predecessor is found by stepping back
over runs that were slow under load, which show nothing
either way. A run that was fast, under load or not, shows
the tool is still fast and ends the search.

The verdict is derived from the ledger every time and is
stored nowhere.

### 6. A regression is a loud line, not a failed gate

The step's exit status is never changed. The alarm is one
line on stderr:

```
DURATION REGRESSION: ./test memory took 600.0 s; its
recent median is 120.0 s (4 runs in the last 14 days);
5.0× slower, two quiet runs in a row
```

(one line; wrapped here). It names the tool, then, now,
and the ratio.

The line goes to the script's own stderr. Where a step is
asked of the SHA result cache, the step's stderr is
recorded for the SHA and replayed, and the timer is
inside that ask. So `bin/duration-lib` keeps a copy of
the script's stderr on descriptor 9, taken as it is
sourced, and says everything of its own there. A replay
then replays what the step printed and no line about a
run that did not happen. The step itself runs with the
descriptor closed.

It is not a gate because a gate must be reproducible, and
one wall-clock reading on a shared machine is not. `./test
validate` answers "is this commit correct"; failing it
because the machine was busy would be a false red on the
path to every merge. `./bin/measure --check` can gate
because it takes the median of 25 runs of one page against
a ratified budget. This alarm has one run and no budget.
Layer 3 gates nothing for the same reason.

Every green timed step ends with one line, so the
mechanism is visibly alive and an empty history is said
out loud:

```
duration: ./test memory took 120.0 s; no baseline yet
    (1 of 3 quiet green runs in the last 14 days)
duration: ./test memory took 120.0 s; recent median
    118.0 s (12 runs in the last 14 days)
duration: ./test memory took 600.0 s, 5.0× its recent
    median of 120.0 s (12 runs in the last 14 days); a
    second quiet run this slow here is a regression
duration: ./test memory took 600.0 s, 5.0× its recent
    median of 120.0 s (12 runs in the last 14 days); load
    was 3.4 per core as it began, so this run is not
    counted
```

(each one line). The load clause follows any line whose
run was contended, and states the reading, not a cause:
at the end it holds the step's own jobs too. A red step
gets no line. Its failure is its own news, and
`web-app/app/measure.ts` shows a failed build's stdout
only when its stderr is empty.

### 7. One hook: `timed LABEL COMMAND`

`bin/duration-lib` is sourced, like `bin/compose-lib`, and
holds one function. `timed './test memory' run_memory`
runs the command as one timed step. The label is the tool
and its arguments; the first word is the tool.

The command runs in a subshell under the caller's own
errexit setting, and its status is read with errexit off
around it. `run_memory || status=$?` would be wrong: bash
ignores `set -e` inside anything on the left of `||`, so
a failing UTC pass would be followed by the Honolulu pass
and its status lost. For the same reason `timed` itself
must never be called inside `if`, `&&`, or `||`.

Two things follow from the subshell, and both are
accepted. A variable the command sets is not seen by its
caller; no call site reads one. And the timer's shell
outlives the step, because it records after the step
ends. A signal sent to the process group, as Ctrl-C is,
still reaches the step, and the step's own exit trap
still runs there, a subshell below the timer (the SHA
result cache's design, its fifth property). A signal
sent to the timing shell alone does not stop the step:
the shell dies and the step, whichever it is, runs on to
its own end.

Call sites, each where the step really runs:

- `test`: `check`, `memory`, `lint`, `schema`, and
  `api-docs`, each wherever it runs. `./test validate` is
  those five steps, so an alarm names the step that
  slowed.
- `bin/test-postgres` and `bin/test-browser`: the suite,
  as `./test postgres` and `./test browser`. `test`
  `exec`s each script, and a shell that `exec`s is gone
  before its step ends, so the script times its own work.
- `bin/build`: the work after the clean-tree gate and the
  commit log, as `./bin/build` or `./bin/build --no-zip`.

Not timed, each named with its reason in the pin below:
`deploy`, `bin/measure` (a benchmark whose duration its
flags set), `bin/develop` and `bin/serve` (they end when
the operator ends them), `bin/postgres-seed` and
`bin/postgres-wipe` (an operator's verbs on a database),
`bin/worktree-add`, and the two generators, whose checks
are `./test schema` and `./test api-docs`.

`deploy` is untimed on purpose. Its gates are `./test`
steps and time themselves. Its `--local` stand-up is an
image build, as long as Docker's layer cache makes it: a
new commit rebuilds, the same commit does not, and two
new commits in a row would read as a regression. Its
`--render` path is Render's time behind a token.

**What the pins hold.** `tests/tool-duration-cli.test.ts`:

- reads every executable git tracks at the root and
  directly under `bin/`; each must call `timed` or be
  named in the test's list of untimed scripts. A script
  added tomorrow fails until someone decides;
- reads the arms of `./test`'s dispatch; each step `test`
  runs itself must appear there in a `timed './test
  NAME'` call, always with the same command, and each
  suite it hands to a script must be timed in that
  script, under the suite's name and with one command;
- requires that no step's command appear in `test`
  outside a `timed` call, that `test` `exec`s nothing but
  those scripts, and that it names them nowhere but in
  the `exec` and the lint list: timed in `test` as well,
  one run would be two samples;
- requires that `run_validate` hold nothing but steps
  timed where they run: a timed step as it stands, or an
  ask whose command is a timed step.

A pin reads source, so it can be written around. These
four catch the ways the review found.

**Composition with `sha-result-cache`.** The timer goes
inside the ask, after its `--`: `replay_or_run WAY --
timed LABEL COMMAND`. The cache check is outermost, so
`timed` wraps real execution only and a replay is never a
sample. `check`, `schema`, and the `--no-zip` build are
never asked, and are timed as they stand. The `already
validated` skip this unit first pinned went with the
stamp. Its successor runs the real `test` and the real
`bin/test-browser`, each in a repository of its own, and
pins that a run appends one sample and prints one line,
and that the replay after it appends none and prints
none.

### 8. An empty history says so

Fewer than `BASELINE_MINIMUM_RUNS` baseline runs prints
"no baseline yet" with the count. Nothing is invented and
nothing is assumed.

### 9. The instrument never changes the tool's result

- `timed` returns the command's status, whatever happens
  to the recording.
- If git cannot describe the checkout, or the start
  cannot be read, the command runs untimed and one line
  says the duration was not recorded.
- If the ledger cannot be read or written, the program
  prints its error and `timed` adds a line naming the
  step and the ledger's path.
- With `/dev/null` for the ledger there is none: the
  command runs under the caller's errexit as ever, and
  the timer reads no clock, asks git nothing, and says
  nothing.
- A script whose stderr is closed gives the timer no
  voice. The sample is still recorded.
- Both `deno run`s pass `--no-prompt`. Deno asks on a
  terminal before refusing a permission, and a question
  would stall the tool.
- A ledger line that is not a sample is not skipped. The
  program names the line number and records nothing until
  the file is repaired. Storage is an edge; a ledger that
  silently ignores its own bad lines lies about its
  baseline.

## Limits, said plainly

- **A busy machine hides a regression.** While runs read
  contended, nothing is compared. On the day this was
  built the load never fell, and no real tool run was
  compared at all.
- **Load readings do not bound contention.** The average
  lags by a minute and is read twice. Memory pressure and
  heat are not in it. The two-in-a-row rule is the
  defence, not a proof.
- **A chain reads its own load.** `./test memory` leaves a
  load near 1 per core behind it, so `lint`, `schema`, and
  `api-docs` inside `./test validate`, and `./test
  browser` after it, often start contended and are not
  compared. Run alone, they are.
- **Creep is absorbed.** The baseline moves with the
  window, so a slowdown that arrives more slowly than 3×
  in 14 days never trips the alarm. Every line prints now
  and the recent median, and the ledger keeps every
  sample.
- **The alarm ends.** Once slow runs are half the
  baseline, slow is the new median. With an even count
  the median is the mean of the two middle runs, a
  duration no run had.
- **A cache longer than the floor would cry wolf.** A
  step whose miss runs 3× its hit and half a minute
  longer, twice in a row, reads as a regression. No timed
  step is like that today.
- **A comma in the ledger's path** splits Deno's
  permission list. The step runs and the line says the
  duration was not recorded.
- **One shape, no version.** A later change to the sample
  must keep old lines readable, or every worktree on an
  older revision stops recording.
- **The ledger grows without bound**, at about 350 bytes a
  sample, and is read whole on every timed step.

## Not built

No report command, no chart, no dashboard, no budget file,
no acknowledgement of an alarm, no pruning, no timing of
`deploy`. The ledger is JSON Lines; `jq` reads it.

One thing the measurements point at and this unit does
not build: comparing CPU seconds as well as wall-clock
seconds. They moved little under a load that moved wall
time fourfold, so they would keep the alarm useful on a
busy machine. They are blind to a step that waits rather
than works, and reading them needs `times` around the
subshell. That is a design the operator should choose.

## Tests

`tests/tool-duration-core.test.ts` feeds the pure verdict
crafted samples, so no test depends on elapsed time or on
this machine's load: the regression, the first slow run,
a run contended at either end, a faster worktree, a fast
or a slow run under load before the current one, the
ratio and floor boundaries, each way a run is no baseline
run, an empty history, and every way a line is not a
sample.

`tests/tool-duration-cli.test.ts` spawns the scripts with
`TOOL_DURATIONS_PATH` pointed at a temp file: one sample
of the documented shape; clean and dirty, in a tree of
the test's own; a failing command keeps its status, is
recorded red, and prints no duration line; a function's
first failure still stops it; the caller's errexit
setting is left as it was; an unwritable ledger and a
line that is no sample are reported and change no status;
a lost final newline; no ledger at all; the timer's line
on the script's stderr where the call's goes elsewhere;
`./test schema` green; `./test browser` with no Chrome
refused before any step, with no sample; and the pins of
decision 7.

`tests/sha-result-cache.test.ts` runs the real `test` and
the real `bin/test-browser` in repositories of their own,
with the real timer and a ledger of the case's own: a
run is one sample and one line, its replay neither, and
a browser run that begins and fails is recorded red with
no line.

## Integration onto master

The unit was built on `c36020172` and ended at
`b89217b68`. Master then gained the faster suites, and
`sha-result-cache` went onto master first; this unit was
rebased onto that branch's tip, `08afff195`. It was
built against a `test` that ran every suite itself,
never `exec`ed, and kept a validate stamp, and it pinned
that shape. Its three commits keep their subjects. Two
follow them: `Hand every spawned script a ledger of its
own`, and the one that records this.

What changed at the rebase, and why:

- **Where the timer sits.** Inside every ask, after its
  `--`, so a replay is never a sample: the memory suite,
  lint, and the API documentation check in `test`; the
  Postgres suite in `bin/test-postgres`; the browser
  suite in `bin/test-browser`; the ZIP build in
  `bin/build`. `check`, `schema`, and the `--no-zip`
  build are never asked and are timed as plain
  statements. The memory suite with `POSTGRES_URL` set,
  and a browser suite whose Chrome states no version,
  run unasked and are timed all the same. The labels did
  not change, so a series recorded before the rebase
  goes on.
- **`test` `exec`s again.** The cache keeps the Postgres
  and browser scripts as the processes a signal reaches,
  so `test` `exec`s them, and each times its own suite
  at its own door. The pin that `test` never `exec`s is
  now a pin of where real execution is timed: `test`
  `exec`s only a script that times its own work, and
  times no such script itself.
- **A replay prints no line.** The timer is inside the
  ask, where the step's stderr is recorded for the SHA.
  A `duration:` line written there would have been
  kept, and replayed as news of a run that never
  happened. The timer speaks on a copy of the script's
  stderr instead (decision 6).
- **One way to say a tree is clean.** `timed` read
  `WORKING_TREE_PORCELAIN`, the validate stamp's
  variable, which the cache retired: set empty, it would
  call a dirty tree clean. Both libraries now ask `git
  status --porcelain` and nothing else. A test that needs
  a clean tree or a dirty one makes a repository of its
  own, or tells git of one.
- **No ledger.** Master's tests of the memory suite's
  workers run the real `./test` in this checkout with a
  stand-in `deno` and count every call it gets. With a
  ledger the timer would have run the stand-in twice
  more for every step, and written its instant passes
  into the operator's ledger as the suite's recent
  duration. So `/dev/null` for the ledger means none
  (decision 2), and the rule the cache made for its root
  now covers both: a test that spawns `./test`,
  `bin/test-postgres`, `bin/test-browser`, `bin/build`,
  `./deploy`, `./bin/measure`, or `./bin/develop` names
  `SHA_RESULT_CACHE_ROOT` and `TOOL_DURATIONS_PATH`
  both, in the env of that spawn, each a path of the
  test's own or `/dev/null`.
  `tests/sha-result-cache-isolation.test.ts` pins both,
  spawn by spawn, as far as the cache's design says
  source can be read. Master's assertions stand as
  written.
- **The cache's two calling rules.** `replay_or_run`
  refuses a caller with `set -e` off and a caller that
  holds an `EXIT` trap. `timed` sets no trap of any
  kind and runs its command as a plain statement in a
  subshell under the caller's errexit, so the four
  scripts pass both refusals with the timer in place,
  and a step's own exit trap still runs a subshell
  below it.
- **A browser run with no Chrome.** It used to be
  recorded red. Chrome is now found before the suite is
  asked of the cache, since the browser names the entry,
  so a run with none is refused before any step begins
  and leaves no sample. A run that begins and fails is
  still recorded red, and is pinned through the real
  script.

How the seven scripts a test may spawn stand:

| Script | Asked of the cache | Timed |
|---|---|---|
| `./test` | memory, lint, api-docs | those three, and check and schema |
| `bin/test-postgres` | its suite | as `./test postgres` |
| `bin/test-browser` | its suite, per browser | as `./test browser` |
| `bin/build` | the ZIP build | as `./bin/build`; `--no-zip` too |
| `./deploy` | no; its gates ask | no; its gates are timed |
| `./bin/measure` | no | no; the build it runs is |
| `./bin/develop` | no | no |

The two test files of this unit cost what they did:
`tests/tool-duration-cli.test.ts` took about 885 ms
before and 869 ms after, each run from a fresh
repository of its own, and
`tests/tool-duration-core.test.ts` 4 ms both times.
