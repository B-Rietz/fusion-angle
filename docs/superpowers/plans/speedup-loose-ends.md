# The Speed-up's Loose Ends: Implementation Plan

**Goal:** no test run leaves a temp directory behind, no
seeded datum expires on a calendar date, TEST-PLAN.md's
automated entries say what is true, and the synchronous
digest is ready to be measured again.

**Spec:** `docs/superpowers/specs/speedup-loose-ends-design.md`.
Read it first.

**Shape:** this commit, then one commit per item for items
1 to 3. Item 4 leaves nothing in the tree but its section
of the spec.

## Global constraints

- Before every `deno` command: `export
  DENO_DIR="$TMPDIR/deno-dir"`, `export DENO_JOBS=4`,
  `export
  SHA_RESULT_CACHE_ROOT="$TMPDIR/fusion-angle-sha-result-cache"`,
  and a `TOOL_DURATIONS_PATH` of the session's own.
- No full suite. One file, or a batch of files, under
  `deno test` with the flags `run_memory` uses; then
  commit; then `./bin/test validate --syntax` and
  `./bin/test lint`; amend to fix.
- Each new pin is shown red by a scratch mutation that is
  never committed.

## Item 1: the run owns a temp directory

1. In `tests/test-cli.test.ts`, a case that runs
   `./bin/test memory` in a replica, `TMPDIR` set to a
   directory of the test's own, with a stand-in `deno`
   whose `test` call leaves a directory under its
   `TMPDIR`; once exiting 0 and once exiting 1. Expect
   the given `TMPDIR` empty after each. Run it: red.
2. In `bin/test`'s `run_memory`: make
   `fusion-memory.XXXXXX` under `${TMPDIR:-/tmp}`, trap
   its removal on EXIT, and hand it to both passes as
   `TMPDIR`. Run the file: green. Mutations: no `TMPDIR`
   for the passes; no trap. Each red.
3. `tests/fixtures/scratch-directory.ts`: one directory
   per test file, made in `beforeAll` and removed in
   `afterAll`, handing out a directory per call. Move
   `tests/tool-duration-cli.test.ts` onto it, and the
   stub and stamp directories of `deploy-cli`,
   `serve-cli`, and `postgres-gun-cli`. Run the four
   files with an empty `TMPDIR`: green, nothing left.
4. AGENTS.md: the run's directory in `## Gates`, and the
   fixture in `## Where things live`.
5. Commit; `--syntax`; lint.

## Item 2: the seeded invitation follows the seed's day

1. `tests/mock-data-invitation-lifetime.test.ts`:
   `FakeTime` at 2031-06-15 before any seed module loads
   (dynamic imports only), the product clock stepping by
   `setClockForTest`. As the invitee: accept at the seed
   day plus the lifetime less a day, 200; on a fresh
   copy, accept at the seed day plus the lifetime, 409.
   Run it: red.
2. `api/mock-data/seed-constants.ts`: replace
   `MOCK_SEED_INVITATION_EXPIRES_AT` with
   `MOCK_SEED_INVITATION_LIFETIME_DAYS = 365`.
   `formInvitationSeedInput`: `at` is
   `daysFromNow(0, 0, 0)`, `expiresAt` is
   `daysFromNow(MOCK_SEED_INVITATION_LIFETIME_DAYS, 0,
   0)`. Run the pin: green. Mutations: the old two
   instants (red: 409); a fixed far-off expiry (red:
   200 at the lifetime's end).
3. Run every test file that names an invitation or the
   seed, and the full set of files again under the
   scratch 2027 preload: the two documentation failures
   are gone.
4. `./bin/generate-api-documentation`; then `--check`
   for it and for `./bin/generate-schema-svg`.
5. TEST-PLAN.md B27's sentence that quotes the instant,
   made true; nothing else in the case.
6. Commit with the regenerated samples; `--syntax`;
   lint.

## Item 3: TEST-PLAN.md's automated entries

1. Rewrite the "Combined Totals" paragraph, the AT
   preamble, and AT1 to AT5 to the tree as it stands
   after items 1 and 2: commands and flags read from
   `bin/test`, `bin/test-postgres`, and
   `bin/test-browser`; counts read from a run's own
   summary lines; the clean-tree refusal; the replay and
   the master session's ruling on it.
2. The report template's build line: `(clean)`.
3. Lint (it checks every cited `tests/…` path exists);
   commit; `--syntax`.

## Item 4: the digest A/B, ready to run

1. At the final SHA, a scratch clone under
   `/tmp/claude-501/loose-ends/` holding the variant of
   the spec, committed there. Run `tests/ledger-store.test.ts`
   and a seeding file in it: green.
2. `/tmp/claude-501/loose-ends/digest-ab.sh`, its
   plumbing checked with a stand-in for `./bin/test`.
   The suite is not run.

## The gate

`/tmp/claude-501/loose-ends/gate.sh`, modeled on
`/tmp/claude-501/clean-tree-proof.sh`: `./bin/test
validate` with a `TMPDIR` of its own, then that
directory empty; the same in a scratch clone with a
failing test file added, red and still empty;
`./bin/test postgres`; `./bin/test browser`; the two
generators' `--check`. Plumbing checked with a stand-in;
the suites are the master session's to run.
