# A clean tree at every door, and every script under `bin/`

Branch and worktree `clean-tree-bin-scripts`, cut from
master `745e83bf2`. Two features on one branch, both asked
for by the operator.

## Intent

**Feature 1.** The operator's words: "Do all of those cli
tests fail immediately on a dirty repo? They must." Those
tests are `./test validate`, `./test browser`, and `./test
postgres`.

**Feature 2.** The operator's words: "Why is `test` in `/`
but `build` is in `bin/`? Are there any other scripts in
`/` that should be in `bin/`?" Told that `test` and
`deploy` are the only two executables at the root, with
eleven under `bin/`, and offered the move: "Yes, let's add
that."

**Scope, as the dispatching session stated it to the
operator and the operator did not correct:** every `./test`
form fails at once on a dirty tree, `check`, `lint`,
`schema`, `api-docs`, and `validate --syntax` included,
with the error `./bin/build` gives; the edit loop becomes
commit first, then test, amend to fix; one test file run
directly under `deno test` still works on a dirty tree;
`test` and `deploy` move into `bin/` as a rename in a
commit of its own, then the references; TEST-PLAN.md has
its command names updated and nothing else.

## What was measured

All of it at `745e83bf2`, in this worktree.

- **One script refuses a dirty tree in its own code.**
  `bin/build:50` reads `git status --porcelain` and says
  `Error: working directory is not clean. Commit or stash
  changes before building.`
- **`./deploy` never asks.** No line of `deploy` reads the
  tree. `--local` reaches a check only through `docker
  compose build`, whose image runs `./bin/build --no-zip`.
  From a worktree that check cannot fire: the image holds
  the worktree's `.git` pointer, git fails, and
  `bin/build:50` reads a failed `git status` as an empty
  one. `--render` builds and tests nothing here and never
  asks either. AGENTS.md says `./deploy` requires a clean
  working directory; today that is true only of `--local`
  run from the main checkout.
- **`./bin/measure` asks in its Deno program**, not its
  wrapper: `web-app/app/measure.ts:401`, after its own
  argument parse, with the words `Working tree is dirty;
  commit before measuring`. A failed `git status` throws
  there.
- **The test command and its two door scripts never ask.**
  The result cache and the timer each read `git status
  --porcelain` (`bin/sha-result-cache-lib:73`,
  `bin/duration-lib:68`), the first to stay out of the
  cache and the second to label a sample; neither refuses.
- **What the image build relies on.** `Dockerfile:10` runs
  `./bin/build --no-zip render-out/` after `COPY . .`.
  Three cases:
  1. Render deletes `.git`. `git status` fails, the check
     reads empty, and the build goes on to name its commit
     from `RENDER_GIT_COMMIT`.
  2. A local compose build from a worktree copies a `.git`
     file that points at a directory the image lacks. Same
     path; the commit comes from
     `FUSION_COMMIT_LOG_BASE64`.
  3. A local compose build from the main checkout copies a
     real `.git`. The check then judges the build context,
     which is the tree less what `.dockerignore` drops.
  So the image build needs "no repository here" to mean
  "do not ask", and it gets that today by accident: any
  failure of `git status` reads as clean.
- **Case 3 is broken on master, and not by this unit.**
  `.claude/settings.json` has been tracked since
  `779dc2c09` (2026-11-21) and `.dockerignore` drops
  `.claude/`. A clone of this tree with `.claude/` removed
  answers `git status --porcelain` with ` D
  .claude/settings.json`. So an image built from the main
  checkout refuses as dirty. Proved by that simulation, on
  master and on this branch alike, not yet by a Docker
  build. A false refusal belongs to this unit: it is fixed
  in a commit of its own (decision 25), and the gate's
  `image` step confirms the defect and the fix with
  Docker.
- **Something does write inside the tree during a run, in
  the agent sandbox only.** `/bin/bash` 3.2 writes each
  here-document to a temp file named `sh-thd-<number>` and
  unlinks it at once. Outside the sandbox the file goes to
  the system temp directory. Inside it none of bash's
  system temp directories is writable, bash falls back to
  the current directory, and every script here has `cd
  "$ROOT"`: the file appears at the root of the tree.
  Polling the root's entries while
  `tests/deploy-cli.test.ts` ran (twelve `usage` prints)
  caught twelve distinct `sh-thd-*` names inside the
  sandbox, and a 300-here-document probe caught none in
  72,240 polls outside it. `TMPDIR` does not move them.
  Every `usage`, the build's entry file, and the result
  cache's artifact list is a here-document.
- **Nothing else does.** With a marker file touched first,
  nineteen test files that spawn or read scripts were run
  one at a time; `find . -path ./.git -prune -o -newer
  MARKER` printed nothing but `.` itself, and only for the
  six files whose spawned scripts print `usage`. Seventeen
  test files call a write; each makes a temp directory of
  its own, and none writes to a literal path or to one
  built from `Deno.cwd()` or `import.meta`.
- **Which test spawns look at this checkout's tree.** Six
  cases run a real script past its arguments here:
  `tests/test-cli.test.ts` (three `memory` cases and one
  `validate`), and `tests/tool-duration-cli.test.ts`
  (`./test schema`, `./test browser` with no Chrome). The
  rest stop at `--help` or a usage error
  (`tests/deploy-cli.test.ts`, two cases of
  `tests/test-cli.test.ts`), run a script this unit leaves
  alone (`bin/measure`'s wrapper, `bin/develop`,
  `bin/serve`, `bin/worktree-add`, the two Postgres guns),
  or already run in a repository of their own
  (`tests/sha-result-cache.test.ts`).
- **The check is cheap.** `git status --porcelain` takes
  about 70 ms on this tree of 1,601 tracked files.
- **No ledger and no cache exist to migrate.** There is no
  `tool-durations.jsonl` under the git common dir and no
  `/tmp/fusion-angle-sha-result-cache`.
- **The suite's size.** `deno test --filter` with a name
  no test has lists 5,091 tests in `tests/*.test.ts`
  (5,079 run and 12 ignored) in ten seconds without
  running one.

### The inventory for feature 2

`grep -rnoP '\./(test|deploy)(?![\w/-])(?!\.\w)'`, which
passes over `./tests/…`, `./test-helpers`, and
`./test-browser`, and still takes `./test.` at the end of
a sentence.

| Where | `./test` | `./deploy` |
|---|---|---|
| `test` | 21 | 1 |
| `deploy` | 3 | 1 |
| `bin/build`, `bin/test-browser`, `bin/test-postgres`, `bin/duration-lib` | 6 | 1 |
| `tests/` (17 files) | 49 | 3 |
| `web-app/app/tool-duration-core.ts` | 1 | 0 |
| AGENTS.md | 43 | 13 |
| TEST-PLAN.md | 19 | 12 |
| TODO.md | 17 | 7 |
| README.md, ARCHITECTURE.md, SCHEMA.md | 5 | 6 |
| `measurements/probes/README.md` | 2 | 0 |
| **Outside `docs/`** | **166** | **44** |
| `docs/superpowers/` (left as written) | 2,331 | 260 |

Without the `./`, a quoted or backticked `test` or
`deploy` that names the file: 16 `Deno.readTextFileSync`
calls in five test files, `Deno.copyFile('test', …)` in
`tests/sha-result-cache.test.ts`, the two entries of
`ROOT_FILES` in `tests/fusion-angle-live-name.test.ts`,
`'test'` in `TIMED_SCRIPTS` and `'deploy'` in `UNTIMED`
in `tests/tool-duration-cli.test.ts`, the lint list's
`awk "$AWK_LINT" test deploy`, `` `test` `` twice in
AGENTS.md, "the root scripts `test`, `deploy`" in
TEST-PLAN.md, and "test for the steps it runs itself" in
`bin/sha-result-cache-lib`.

Nothing in `Dockerfile`, `.dockerignore`, `compose.yaml`,
`deno.json`, or API.md names either script. No hook runs:
`core.hooksPath` names a directory that does not exist.
There is no CI configuration and no `render.yaml`; Render
builds through the Dockerfile, which runs `./bin/build`.

## Decisions

The operator delegated spec through fix, so nothing here
waited for approval. Each decision carries its reason.

### 1. One check, in `bin/clean-tree-lib`

A sourced library with one function, `require_clean_tree`.
It reads `git status --porcelain` once, and on a dirty tree
prints the one message and exits 1.

This is the better way rising, not a framework before its
third site (Commandment IX). The rule already had two
sites, `bin/build` and `measure.ts`, and this unit gives it
five more scripts. `bin/build`'s own spelling is deleted
and replaced by the call.

`web-app/app/measure.ts` keeps its own check and its own
wording, and this is the one site left beside the better
way. Its check must come after its TypeScript argument
parse, so that `--help`, a usage error, and a bare
`--visualize` still answer on any tree, and the bash
wrapper cannot tell those apart without a second parser.
Having the Deno program call the bash library would change
a tool under `web-app/` that nothing cheap drives.

**The operator's ruling.** The master session recommended
leaving `web-app/app/measure.ts`'s own check and wording as
they are, apart from the one flag of decision 19, and not
converging it onto `bin/clean-tree-lib`. The operator's
words: "I accept your recommendations." So it stays. What
that buys is a measure that still answers its own usage
before it reads the tree; what it does not buy is one
message, since a dirty tree reads `Working tree is dirty;
commit before measuring` there and `Error: working
directory is not clean.` everywhere else.

### 2. Dirty means what `git status --porcelain` prints

As `bin/build`, the result cache, and the timer already
have it: a staged change, an unstaged change, a deletion,
or an untracked file that is not ignored. An ignored file
does not count. There is no second definition and no
variable that overrides it.

### 3. Where git cannot answer, the scripts refuse; the build asks only where there is a repository

A failed `git status` is never read as clean (the
Abomination of Swallowed Failures). `require_clean_tree`
lets git's own words through on stderr, adds `Error: git
could not say whether the working directory is clean.`,
and exits 1. A test run outside a repository has no SHA to
belong to, so it is refused like a dirty one.

`bin/build` is the one script with a real reason to run
where there is no repository: the image build. It asks the
precise question first, `git rev-parse --git-dir`, and
calls `require_clean_tree` only where that finds a
repository. Where it finds none the tree is not asked
about, and the build goes on to name its commit from a
build argument or to fail with `no commit SHA to embed`,
as today. This is what the image build already relied on,
now said on purpose: only "no repository" skips the check,
where before any git failure did. All three image cases
above behave as they do today.

### 4. Each script and its rule

| Script | On a dirty tree | Why |
|---|---|---|
| `test`, every form | refuses | a result belongs to a SHA |
| `bin/test-postgres`, `bin/test-browser` | refuse | the same, at their own doors |
| `bin/build`, both forms | refuses where there is a repository | a build from uncommitted state cannot be traced |
| `deploy`, every form | refuses | decision 7 |
| `bin/measure` | refuses a run, in its own program | every run measures committed bytes |
| `bin/develop` | runs | an edit session over the working tree |
| `bin/serve` | runs | it serves a bundle already built |
| `bin/generate-schema-svg`, `bin/generate-api-documentation` | run | they write the tree; `--check` is reached through `test` |
| `bin/postgres-seed`, `bin/postgres-wipe` | run | operator verbs on a database |
| `bin/worktree-add` | runs | it reads the main checkout's HEAD |
| `deno test` on one file | runs | it is no gate and records nothing |

`--help` and a usage error answer on any tree in the
three scripts that take arguments, `test`, `bin/build`,
and `deploy`: they are about the command line, not the
tree. The two door scripts take no arguments and read
none, so `bin/test-browser --help` is `bin/test-browser`:
refused on a dirty tree, and the suite on a clean one, as
it was before this unit.

### 5. Arguments, then the tree, then the work

Each script reads its arguments first, asks about the tree
second, and does nothing else before that. In `test` the
call stands in each arm, after that arm's usage check and
before its step: six calls. One call ahead of the `case`
would refuse a usage error on a dirty tree; a second pass
over the arguments would list the suites twice. A miss is
caught by the test that derives every form from `--help`
and requires each to refuse.

`./test postgres` and `./test browser` are asked twice,
once by `test` and once at the door `test` execs. The door
must ask for itself, since it is run directly and since
`validate` ran between the two; 70 ms buys one rule with
no exception.

`bin/test-browser` asks before it looks for Chrome: the
tree is the first thing any of these scripts reads.

### 6. The message

```
Error: working directory is not clean.
?? scratch.txt
Commit, then run this again; amend the commit to fix what a run finds.
```

The first line is `bin/build`'s fact, word for word. The
porcelain lines name what is dirty, which is what the
reader needs next and what a stray file's refusal would
otherwise hide. The last line is the way forward in the
operator's own words: commit first, then test, amend to
fix. `bin/build`'s "Commit or stash changes before
building" goes: the message is one for every script.

### 7. `deploy` asks at its own door, in every form

After its arguments are validated and before anything
else. `--local` stands up an image of this tree, and from a
worktree nothing checked it. It also makes AGENTS.md's
existing sentence true for the first time, with one rule
and no form excepted (Commandment III).

`--render` builds nothing from the tree, and this adds a
refusal there that was not there before. What it buys: no
uncommitted edit to `deploy`, `bin/postgres-wipe`,
`bin/postgres-seed`, or `bin/postgres-lib` acts on
production, because those are the scripts a render deploy
runs here. What it does not buy: it does not make the
checkout what ships. `--render --commit SHA` deploys the
SHA it is handed, checks only that the SHA is
`origin/master`, and never compares it with HEAD.

**The operator's ruling.** The master session recommended
keeping the refusal on every form of deploy, `--render`
included, "since a deploy from uncommitted state can't be
traced", and not scoping it to `--local`. The operator's
words: "I accept your recommendations." So every form
refuses.

### 8. The libraries keep their own guards

`replay_or_run` still neither reads nor writes on a dirty
tree, and `timed` still labels a sample `dirty`. Both are
the libraries' own truth for any caller, and both are
still reachable from the scripts: the door asks once, and
a tree can turn dirty under a run. The cache asks again
when each step begins and once more before it records
(`HEAD, the tree, or Deno changed under …; not
recorded`). No guard is deleted. The library-level tests
of those paths stay: each drives the library in a
repository of its own and is still about the library.

### 9. No test's result depends on this checkout's tree

A script that refuses a dirty tree is run past its
arguments only in a repository of the test's own, as the
cache's replicas already are. The replica holds the
scripts as this checkout's working tree has them, so an
edit is tested before it is committed, and it is
committed there, so its tree is clean. That is what keeps
two promises at once:

- **The suite cannot flake on this tree.** No test asks
  whether it is clean, so a tree that is dirty for an
  instant, as the sandbox's here-documents make it, fails
  nothing.
- **One file under `deno test` passes on a dirty tree.**
  The edit loop runs a test file while the tree holds the
  edit.

The six cases named above move to replicas. The usage and
`--help` cases stay in this checkout: decision 5 answers
them before the tree is read, and a test on a dirty
replica pins that order.
A spawn of a refusing script in this checkout hands it
`GIT_DIR=/dev/null`, which is no repository, so a case
that got past the arguments would be refused on any tree,
and `tests/sha-result-cache-isolation.test.ts` requires
that of every such spawn (decision 22).

The replica is a shared seam, `tests/fixtures/script-replica.ts`:
a repository with one commit, the copy of named files from
this checkout, the copy of the whole working tree for the
one case that lints it, and the spawn. The cache's
replicas are rebuilt on it, so the list of what a gate
script sources lives in one place.

Within one replica nothing overlaps: a script's own
here-documents and its own `git status` calls run one
after another.

### 10. Tests replaced on purpose

The operator changed the covenant for the scripts, so each
test that pinned a real run on a dirty tree, or that ran a
script for real in this checkout, is replaced by a test of
the new one. None is loosened.

- `the real test script never records a red first pass`:
  its second half reached "the cache is not asked" by
  dirtying the replica. It now reaches it through
  `POSTGRES_URL`, which still leaves the memory step
  unasked, with the same assertions.
- `the real browser script cleans up a failed run`: the
  same half, now through a Chrome that states no version,
  which still runs the suite unasked in the script's own
  shell.
- The four `./test memory` and `./test validate` cases of
  `tests/test-cli.test.ts`: same assertions, in a replica.
- `./test schema records a green sample` and `./test
  browser with no Chrome records nothing` in
  `tests/tool-duration-cli.test.ts`: same assertions, in
  a replica, the first with a stand-in generator.

New, in `tests/clean-tree-cli.test.ts`, eleven tests:
every form of the test command refuses, the forms read
from `--help`; the two door scripts and both forms of the
build refuse; `deploy` refuses in every form; what counts
as dirty; a git setting cannot hide an untracked file;
help and usage on a dirty tree; a directory git cannot
describe; the build where there is no repository; every
reader of the tree asks for untracked files; one file
spells the refusal; and the image build context drops no
tracked file. One more in each of
`tests/sha-result-cache.test.ts`,
`tests/sha-result-cache-isolation.test.ts`, and
`tests/tool-duration-cli.test.ts`, and one in the new
`tests/script-replica.test.ts`: fifteen in all.

### 11. How an agent works test-first now

1. Write the failing test and run that one file under
   `deno test`, with the flags `run_memory` uses. A dirty
   tree is fine: nothing asks.
2. Write the code and run the file again.
3. Commit. Red on a branch is allowed.
4. Run `./bin/test validate --syntax`, and `./bin/test
   lint` where a script changed. Fix what it finds and
   `git commit --amend --no-edit`, then run it again.

"Each commit on a development branch runs `./test validate
--syntax`" stays true as written: the commit exists, then
the check runs on it. AGENTS.md gains the order and the
one-file sentence.

The sandbox paragraph gains the here-document fact,
because a refusal that lists `?? sh-thd-…` is what an
agent sees if it runs two scripts at once in one worktree.

### 12. `bin/test` and `bin/deploy`, and no shim

Invoked as `./bin/test` and `./bin/deploy`. Neither name
collides: `bin/test-postgres` and `bin/test-browser` are
other names. Nothing is left at the root, and a pin,
`every executable script lives under bin/` in
`tests/tool-duration-cli.test.ts`, fails when a tracked
executable sits anywhere but directly under `bin/`.

The move is `git mv` in a commit of its own with no
content change. That commit is red: each script resolves
`ROOT` from its own directory, which is then `bin/`. The
commit after it makes it work.

### 13. `BIN` and `ROOT`, as every other script under `bin/`

`BIN="$(cd "$(dirname "$0")" && pwd)"`, `ROOT="$(cd
"$BIN/.." && pwd)"`, `cd "$ROOT"`. Siblings are named
through `$BIN`, as `bin/test-postgres` already does, so
`test` execs `"$BIN/test-postgres"` and sources
`"$BIN/sha-result-cache-lib"`. The structural pins that
read those lines follow the spelling and assert what they
did.

### 14. The timer's labels follow the path

`./bin/test memory`, `./bin/test browser`, and the rest. A
label is the command the operator types, and the old one
would name a file that is gone. A series is keyed by its
label, so an existing `./test memory` series would be
orphaned and the new one would start at `no baseline
yet`. No ledger exists on this machine, so nothing is
lost; this is the free moment.

### 15. The result cache's names do not change

An entry is named by HEAD's SHA and by the step's own
word, `memory` or `lint`, never by the script's path. A
pass recorded before the move was recorded for an earlier
SHA and cannot apply to a later one, with or without the
move. After it the names are what they were, and the
replica tests prove a replay through `bin/test`.

### 16. `tests/root-scripts-exec-deno.test.ts` becomes `tests/operator-scripts-exec-deno.test.ts`

It walks the root and `bin/` for a `node`, `npm`, or `npx`
invocation. With no script at the root, the root half is
about the files a build reads there: `Dockerfile`,
`compose.yaml`, `deno.json`, and `deno.lock`. The walk
stays as it is; the name, the header, and the test's
title say what it covers, and it now requires the two
moved scripts and the build files to be in the walk. The
rename rides in the pure-rename commit; AGENTS.md is its
one citation outside `docs/`.

### 17. Documents

Every sentence the change makes false is corrected:
AGENTS.md, README.md, ARCHITECTURE.md, TODO.md, SCHEMA.md,
COST-ESTIMATION.md (its "root operator scripts"), and
`measurements/probes/README.md`. TEST-PLAN.md has its
command names changed and nothing else: 28 lines, and
putting the old names back gives the file master has.
`docs/superpowers/` describes the past and stays as
written.

TODO.md cites six lines in scripts this unit lengthened.
Each is re-pointed at the line it names: `bin/deploy:190`,
`bin/test:95`, `bin/test-postgres:34` and `:29`, and
`bin/test-browser:56` and `:69`. A seventh,
`bin/build:100-104`, was already stale on master; it now
reads `bin/build:163-170`, the `--allow-env` lines its
sentence describes.

### 18. One file outside the tracked tree names the old paths

`.claude/settings.local.json` in the main checkout is
ignored by git and not writable from here. Its
`permissions.allow` names `./test *` and `./deploy --local
*`, and its `sandbox.excludedCommands` names `./test
browser *`, `./test validate browser *`, `./test postgres
*`, `./deploy --local *`, and two worktree `deploy` paths.
After the move none of those match the new commands. It
calls nothing, so it is no reason for a shim; it is the
operator's to update, and the report says so.

## After the review

An independent review read the branch at `8350aa132` and
the gate ran green there. What follows was found then.
Each fix is folded into the commit it belongs to, and the
image build and the timer test's directories have commits
of their own.

### 19. Untracked files are asked for by name

`status.showUntrackedFiles=no`, in a repository's config
or the operator's own, makes a bare `git status
--porcelain` leave untracked files out. A new, uncommitted
test file then read as a clean tree: the refusal let it
run, and the result cache would have recorded that pass
under HEAD's SHA. The library's header also said "No
variable overrides it", which was not so.

Every reader now asks `git status --porcelain
--untracked-files=normal`: `bin/clean-tree-lib`,
`bin/sha-result-cache-lib`, `bin/duration-lib`, and
`web-app/app/measure.ts`. A test sets the option in a
repository of its own for each of the three libraries and
sees the untracked file still count. `measure.ts`'s check
has no cheap test of its behavior, so it is held by the
structural pin alone: `every reader of the tree asks for
untracked files` reads all four spellings.

### 20. The pin on `bin/` reads every tracked executable and symbolic link

`every executable script lives under bin/` read only mode
`100755` files at the root or directly under `bin/`. A
tracked symbolic link `test -> bin/test`, a tracked
executable at `tools/helper`, and one at `bin/sub/helper`
all passed it. It now takes every tracked `100755` or
`120000` entry, wherever it is, and requires
`^bin/[^/]+$`. Nothing tracked breaks it: thirteen
executables, all directly under `bin/`, and no symbolic
link.

### 21. The working-tree copy passes over a path that has gone

The fixture lists the working tree and then copies it. A
here-document's temp file can be listed and gone before
its copy, and the one case that uses the copy then failed
with `NotFound`. A listed path that is gone is no longer
in the working tree, so its copy is passed over; a file a
test names must still be there.

The copy is not narrowed. It takes 0.21 s to copy 1,606
files and 0.83 s to commit them. Leaving out `docs/` and
`measurements/` would save a quarter of a second and cost
a hand-kept statement of what `validate` never reads.

### 22. A spawn in this checkout hands the script no repository

The pin was titled "spawned here only for its arguments"
and checked only which files spawn. Turning
`runTest(['bogus'])` into `runTest(['lint'])` left it
green. It now proves its title. The two helpers that spawn
a refusing script here pass `GIT_DIR=/dev/null`: `--help`
and a usage error never ask git, and anything past the
arguments is refused with `git could not say`, on a clean
tree as on a dirty one. The pin requires `GIT_DIR` in
every such spawn. It still cannot see a shell or a
variable, the blind spots the isolation pin already
names.

### 23. Behavior nobody asked for, kept, each with its reason

- **`bin/build`'s message lost "or stash".** One message
  serves every script, and it names the one way forward
  the operator named: commit, then run, amend to fix. A
  stash still cleans a tree; the message no longer
  recommends it.
- **The test command refuses outside a repository.** It
  ran there before. A run with no repository has no SHA
  to belong to, and a failed `git status` read as clean is
  the fault decision 3 removes.
- **The timer's labels changed**, to `./bin/test …`
  (decision 14).
- **Two hang bounds rose to 120 s**, from the 10 s and
  60 s the `memory` and `validate` cases of
  `tests/test-cli.test.ts` had in this checkout. Every
  replica spawn shares the fixture's one bound, which the
  cache's replicas set after a loaded machine stretched a
  one-second spawn past twenty. It bounds a hang and
  asserts nothing about time.

### 24. Which scripts answer `--help`

AGENTS.md said `--help` and a usage error answer on any
tree. That is true of the three scripts that take
arguments and says nothing of the two door scripts, which
take none (decision 4). AGENTS.md now names the three. It
also gives the one `deno test` command for a single file,
says that a test file which spawns a script counts as a
second script for the here-document hazard, and names the
test file that holds each pin.

### 25. The image build context drops no tracked file

`.dockerignore` dropped `.claude/` while the context kept
`.git/`, and `.claude/settings.json` is tracked. Inside an
image built from the main checkout, `git status` listed it
as deleted and `bin/build --no-zip` refused. The cause is
a context that drops a tracked file while keeping the
repository that knows of it, so the fix is there:
`.dockerignore` now has the two lines `.gitignore` has,
`.claude/*` and `!.claude/settings.json`.

What that does to the image: the builder stage's `/srv`
gains one small tracked file. The runtime stage copies
`/srv/render-out` alone, so the image that runs is byte
for byte what it was.

The pin is `the image build context drops no tracked
file`: it reads `.dockerignore` as Docker reads the kinds
of line this file uses, refuses a kind it does not know,
and requires that no path git tracks is dropped. The
gate's `image` step builds master's tree and this one
with Docker.

### 26. The timer test removes what it makes

`tests/tool-duration-cli.test.ts` left sixteen
`tool-durations-*` directories in `$TMPDIR` on every run,
on master as here. Every directory it makes now lives
under one of the file's own, made before its first test
and removed after its last, whether the tests pass or
fail. Run with a `TMPDIR` of its own, the file leaves
nothing behind, and the gate's `files` step checks that.

## Not done here

- `web-app/app/measure.ts` keeps its own check and
  wording, by the operator's ruling (decision 1).
- The `tool-durations-*` directories earlier runs left in
  the agents' `$TMPDIR` remain; the review counted 1,762.
  Another worker's run in flight makes directories of the
  same name, so they are not this unit's to remove.

## How it is verified

Test first, each pin seen red by a scratch mutation that is
never committed. No full suite is run while building: one
file at a time under `deno test`, lint, and `--syntax`.

The gate is `/tmp/claude-501/clean-tree-proof.sh RUN`, for
the master session to run. In a scratch clone it makes and
dirties, its `refusal` step proves that every form refuses
with nothing run, recorded, or sampled, that `--help` and a
usage error still answer, and that a repository set to
hide untracked files is refused all the same; its `files`
step proves that the test files that spawn scripts pass
under `deno test` there and that the timer test leaves no
directory behind. On the clean worktree it runs validate,
the Postgres suite, the ZIP build, and the browser suite
for real and again for the replay, then the composed
validate-plus-browser form, and judges each run. Its
`image` step builds master's tree and this one with
Docker, from full clones, and expects the first to refuse
and the second to build.

## Commits

1. The design and the plan.
2. The dirty-tree refusal.
3. The pure rename (red).
4. The references.
5. The image build context.
6. The timer test's directories.
