# API documentation overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** `/api-documentation/` lets a developer who
integrates by software write a working call: a guided
start, then a reference in which every endpoint shows its
role tier, its declared headers, every status with a line
saying why, and a replayed `curl` exchange.

**Architecture:** The seed first writes in a fixed order,
so a pinned seed can be reproduced. The generator then
runs as its own process. It pins the day, the clock, both
randomness sources, and a throwaway signing key before
any product code loads. It seeds a memory backend, signs
in, and replays one real request per endpoint through
`handleRequest`, each on its own copy of the seeded rows.
It writes a light catalog (`rooms.ts`), one JSON sample
per endpoint, and the role-shaped grid, and `--check`
gates the result byte for byte. Tests that need a
generation spawn one. Proving tests replay in-process
against an unpinned seed and hold the role tiers and
status lists to the gate. The page reads the catalog at
boot and fetches a sample when its endpoint opens.

**Tech Stack:** Deno 2.9.8; TypeScript under `deno.json`
(`strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `verbatimModuleSyntax`,
`erasableSyntaxOnly`); `@std/assert`;
`@std/testing/time`'s `FakeTime`, already locked; WebCrypto;
the memory backend; `SafeHtml` presenters; Chrome over
CDP for `tests/browser/`.

**Spec:**
`docs/superpowers/specs/api-documentation-overhaul-design.md`
(commit `c239061cb`). Executors read the spec and this
plan. The spec's "What the operator decided" and
"Approaches" are settled. The decisions below settle what
the spec left to the builder. Do not reopen either.

---

## The gate: no task starts until this holds

The spec prints the declarations of
`declared-request-headers` (design:
`.worktrees/declared-request-headers/docs/superpowers/specs/declared-request-headers-design.md`).
On 2026-11-19 that unit was **not on master**: its
branch held only its spec commit `09c500428`.

Execution does not begin until both hold:

1. Master contains the prerequisite. `git log --merges
   master` names its merge, and its module exists (the
   design suggests `api/request-headers.ts`).
2. This branch is rebased onto that master:

```bash
cd /Users/tmornini/code/fusion-angle/.worktrees/api-documentation-overhaul
git rebase master        # outside the sandbox: git writes
export DENO_DIR="$TMPDIR/deno-dir"
./test validate --syntax
```

After the rebase, the conductor (not a subagent) re-checks
the items below against the real module. It rewrites the
text of Tasks 12, 14, and 16 where they differ, before it
dispatches Task 0:

- **R1.** The module's path and exports: the declaration
  type, the list of all declarations ("in a stable
  order"), the state function, and the request-kind
  type. Tasks 12 and 14 name these as
  `REQUEST_HEADER_DECLARATIONS`, `declaration.surface`,
  `declaration.stateOf(kind)`, and `RequestKind`.
- **R2.** The request kind's fields. The design gives
  them as route pattern, method, whether a body is
  sent, and the grant type on `authentication/token`.
  Check their names, and whether the grant types are
  exported (`postToken` dispatches on them,
  `api/authentication.ts`).
- **R3.** Where `alternative` names its set: on the
  state or on the declaration.
- **R4.** Whether `content-type` is one declaration or
  two, and which surfaces they carry.
- **R5.** The prerequisite's proving test exists and
  passes. The page trusts the declared states because
  of it.
- **R6.** The prerequisite's ban test passes after
  Tasks 6 and 15. They touch `server/http-server.ts`
  response headers only, which the ban does not cover.

Line numbers in the spec and below are master at
`116c11044`. After the rebase, find code by name.

## Dispatch preamble

The conductor prepends this block, verbatim, to every
subagent dispatch, before the task's own text:

```text
Go to Medium Church!

You are one worker in the worktree
/Users/tmornini/code/fusion-angle/.worktrees/api-documentation-overhaul
(branch api-documentation-overhaul). Work only there.
No other worker runs beside you. Never create a worktree
or branch, never pass the Agent tool `isolation`, never
run ./deploy (any form, never --render), never start a
development server (master owns port 8080; 5432 may be
the operator's), never push, never force-push, never
merge.

Environment: `export DENO_DIR="$TMPDIR/deno-dir"` before
any deno or ./test command. Run git writes (add, commit,
reset, checkout) outside the sandbox. The sandbox makes
this worktree's .git metadata read-only.

To run one test file the way ./test does:
  one() {
      TZ=UTC JWT_HMAC_SIGNING_KEY=test-hmac-signing-key \
      deno test --frozen --no-check \
          --sanitize-ops --sanitize-resources \
          --allow-env --allow-read --allow-write \
          --allow-net --allow-run=deno,sh \
          --preload ./tests/hmac-test-key.ts \
          --preload ./tests/local-storage-stub.ts \
          --preload ./tests/session-storage-stub.ts \
          --preload ./tests/worker-name-prefix.ts "$@"
  }
A pass prints `ok | N passed | 0 failed`.

Before each commit: `./test validate --syntax`. Before
the last commit of your task: `./test` (memory suite).
Report each command's last lines.

Voice rules. Lines of 78 characters at most in every
file ./test lint lints (.ts .html .css under api client
web-app tests shared server, and the root scripts);
4-space indent; no inline styles: classes and CSS custom
properties per DESIGN-SYSTEM.md; no `org` abbreviation
in identifiers. Commit subject: one line, about 50
characters, present-tense imperative, then a blank line
and the Co-Authored-By trailer your session's
instructions give; no other body. Never move or rename a
file and change its content in one commit. "grant" is a
verb; the noun only in RFC names (grant_type,
invalid_grant). Prose names a person "organization
admin" or "operator", never bare "admin"; the role
string 'admin' stays.

The hard rule (not negotiable): nothing generated or
committed carries a real credential: no access token,
refresh cookie, authorization code, password, password
hash, PKCE verifier, or signed assertion. Never print,
log, or put in an error message any credential, signing
key, POSTGRES_URL, or seeded password, the generator's
own included. Report a credential finding by file and
kind, never by value.

Commandments this work touches: I Reliability (byte-
stable output, the gate's real answers), II Security (the
hard rule), III Uniformity (one name per thing; the
catalog's names are shapes.ts's), IV Logic (status lists
right in both directions), V Clarity, VI Immutability
(rows copied, never mutated), XI Efficiency (--check
under 10 s, measured).

Abominations this work risks: Swallowed Failures (a
replay that answers non-2xx must fail generation, never
be skipped); Test Weakening (never edit an existing test
to pass; a test of a retired artifact is deleted only
where this plan names it, in the commit that retires
it); Default Values (no `?? ''` hiding a missing sample,
id, or header); Internal Defense (validate the fetched
sample once, at readSample, then trust it); Magical
Values (name opaque numbers: timeouts, fold length, the
PRNG seed); Coupling (fetch and clipboard through the
page's own adapter); Unbidden Helper Code (build what the
task says, nothing "in case"); Cleverness.

Codebase patterns to match: RequestContext first for
client verbs; a client verb returns an HttpMessage, an
array of them, or a value that keeps one; presenters
return SafeHtml (web-app/app/safe-html.ts: html``,
setHtml, trusted only for the generated SVG);
snake_case storage, camelCase domain; HTTP-verb naming
(getNoun, putNoun, deleteNoun, postNounOperation);
validators at the gate, not downstream; no untyped
`any` from an external boundary (fetched JSON is
`unknown` until readSample). The browser bundle never
imports api/ or server/. web-app/api-documentation/
holds hand-written modules and generated output: every
hand-written module there must be named in
KEPT_ROOT_NAMES (web-app/app/generate-api-documentation.ts),
or the generator deletes it and --check fails.

The spec: docs/superpowers/specs/api-documentation-overhaul-design.md.
The plan: docs/superpowers/plans/api-documentation-overhaul.md
(read its Decisions and Global Constraints sections, then
your task). Read only the spec sections your task names.
```

## Global Constraints

Copied from the spec. Every task's requirements include
these.

- Nothing generated or committed carries a real
  credential. Requests and responses show a named
  placeholder in each credential position.
- The generator signs with a throwaway key it sets
  itself, unconditionally, before any product code
  loads. It never reads the operator's
  `JWT_HMAC_SIGNING_KEY` or `POSTGRES_URL`.
  `bin/generate-api-documentation`'s permissions grow
  only as far as that key needs.
- Every sample is byte-identical on every run and every
  day. Nothing is rewritten after the fact to hide a
  difference.
- A sample is replayed, never typed. `WRITE_EXAMPLES`
  goes. The `curl` text is produced from the replayed
  request, never written beside it.
- Success exchanges only. No new dependencies:
  `deno.json` and `deno.lock` stay as they are.
- A sample shows the whole request and the whole
  response, headers included. The only elision is a
  collection's parts after the second, marked and
  counted.
- The browser never imports `api/`. The catalog and the
  sample files are the only bridge.
- The page's CSP drops a `<style>` block. No inline
  styles, so the grid paints by presentation attribute.
- Every existing hash keeps working: `''`,
  `#get/organizations/id/flows`, `#statuses/412`, and an
  unknown hash as the in-pane miss. Back behaves as it
  does today.
- Colour is never the only signal for a role.
- Generated `.ts` passes the 78-column lint.
- No existing test is edited to pass. A test of a
  retired artifact is deleted in the commit that
  retires it.
- Target: `--check` in under 10 s on the operator's
  machine. A miss is reported as a finding, not worked
  around.

## Re-verified numbers

The review's scripts are gone. Each number below was
measured again on 2026-11-19 against `c239061cb` with
throwaway scripts that are not committed.

| Fact | Spec | Now |
|---|---|---|
| Routes / route-verb pairs | 89 / 131 | 89 / 131 |
| Tiers: member+admin / admin / no token | 95 / 34 / 2 | 95 / 34 / 2 |
| Bare HTML files (rooms + statuses) | 146 | 146 (131 + 15) |
| Status documents | 15 | 15 |
| `WRITE_EXAMPLES` entries | 45 | 43 |
| Rehearsed seed rows (+ root bind) | 2,553 | 2,552 + 1 |
| Rows differing between two pinned seeds | ~930 | 939 |
| Clock reads in one seed | 1,641 | 1,758 (every `clockNowMs` call) |
| Memory seed load | 1.7 s | 1.83–1.87 s |
| `--check` today | — | 0.08–0.36 s |
| Landing a rehearsal on a fresh backend | — | ~0.39 s each |
| 422 answered anywhere | no | no: a constant and a re-export only |

Two findings change how the work is done, and neither
changes what is built:

- **The seed has two write-order causes, not one.** With
  the histories (`api/mock-data.ts:530`) written in
  order, 417 rows still differ. The second cause is the
  work-order creations inside the concurrent wave at
  `api/mock-data.ts:984`. With both written in order,
  three pinned seeds were byte-identical. With either
  one alone they were not. Task 2 fixes both, one commit
  each, as the spec directs for a further cause.
- **Landing per write is too slow.** About 45 writes ×
  0.39 s ≈ 18 s. The memory backend keeps one array of
  rows that it never mutates in place, so each replay
  gets a shallow copy instead (Decision D4).

Not re-measured, and nothing here relies on them: the
45 KB flows collection, 37 of 114 fillable endpoints, 7
sub-collections answering 204, 11 of 12 PUT bodies
answering 200, and 753 score names. The proving tests
settle the status lists whatever those numbers are now.

## Decisions on what the spec left to the builder

- **D1. Pins.** `web-app/app/api-documentation-pins.ts`,
  `installReplayPins()`. It runs in this order:
  (a) set `JWT_HMAC_SIGNING_KEY` to 64 hex characters drawn
  from the real `crypto.getRandomValues`;
  (b) install `FakeTime` at `PINNED_DAY_MS`
  (`Date.UTC(2020, 0, 1)`) and leave it installed for the
  whole run;
  (c) replace `crypto.getRandomValues` and
  `crypto.randomUUID` with one xorshift32 stream seeded
  by `RANDOM_SEED`;
  (d) dynamic-import `shared/types.ts` and install a
  clock that steps `CLOCK_STEP_MS` (1 ms) per read.
  The module's only static import is
  `@std/testing/time`.
  Why: the day matches the spec's mock and the old
  generator's `AT`. A random per-run key is never
  committed, and tokens are placeholders, so it cannot
  move a byte. The probe above showed `FakeTime` left in
  place keeps the seed stable.
- **D2. The cheap hasher** moves to
  `api/mock-data/throwaway-password-hash.ts` as
  `throwawayPasswordHash`. `tests/mock-seed.ts`
  re-exports it as `testHashPassword`, so no test
  changes. A test keeps it out of `server/` and the rest
  of `api/`.
- **D3. CLI entry.** A new
  `web-app/app/generate-api-documentation-main.ts`
  statically imports only the pins, then dynamic-imports
  the library `web-app/app/generate-api-documentation.ts`.
  The library keeps its name, so its surviving exports and
  their tests stay untouched. The bin script runs the
  entry with `--allow-env=JWT_HMAC_SIGNING_KEY` added.
  Any other env read crashes the run, and that crash is
  reported, not granted.
- **D4. Copies.** `MemoryStorageBackend.copy()` returns a
  backend over `[...rows]`. Every replay, reads included,
  runs on its own copy taken after both sign-ins, so a
  sample depends only on the seeded rows and those
  sign-ins. Listings that fill path segments also run on
  copies.
- **D5. Response headers.** A sample records what
  `handleRequest` answers, plus the server's `/api`
  defaults. Those defaults are today's `Cache-Control:
  no-store` when the response has none, moved into an
  exported `withApiResponseDefaults` that `dispatch` and
  the generator both call. The HTTP layer's own framing
  (`content-length`, and `date` when a response lacks
  one) cannot be witnessed without `--allow-net`. The
  guided start states it once, beside the headers curl
  adds.
- **D6. Shapes.** The catalog and sample types live in a
  hand-written `web-app/api-documentation/shapes.ts`,
  which imports nothing, with the edge validator
  `readSample`. The generated `rooms.ts` imports and
  re-exports the types. It keeps the export names
  `API_DOC_ROOMS`, `API_DOC_STATUSES`, `ApiDocRoom`, and
  `ApiDocStatus`, and keeps `ApiDocStatus` as
  `{ hash, code, body }`, because surviving tests import
  them.
- **D7. Sample files** live at
  `web-app/api-documentation/samples/<hash>.json`, for
  example `samples/get/organizations/id/flows.json` and
  `samples/start/sign-in.json`. They are
  `JSON.stringify(sample, null, 2)` plus a newline. The
  catalog stores that path relative to the page.
- **D8. Header names** print lower-case, as declared and
  as recorded. `Headers` lower-cases them, so no casing
  table is kept beside the code.
- **D9. `curl` text.** It is always
  `curl -i -X <METHOD> "$ORIGIN<target>"`, then one
  `-H "<name>: <value>"` per recorded request header,
  except `CURL_ADDS` (`host`, `user-agent`, `accept`,
  `content-length`), then `-d '<body as sent>'`. A
  single quote in the body becomes `'\''`. Continuation
  lines end in ` \` and are indented two spaces.
  `If-Match` and `If-None-Match` values other than `*`
  become `$ETAG`, which holds the whole validator,
  quotes included. Basic is
  `Basic $(printf '%s:%s' "$A" "$B" | base64 | tr -d '\n')`.
- **D10. Placeholders.** The spec's table, plus three
  more:
  - `$REFRESH_TOKEN`, the refresh cookie's value;
  - `$JWK_X` and `$JWK_Y` (and `$JWK_KID` if the
    product derives a key id), the reader's own public
    key in step 6;
  - one `$<FIELD>` for each body field that holds a
    secret, named in the generator's
    `BODY_SECRET_FIELDS`.

  Credential headers are rewritten per parameter:
  - `authorization` keeps its scheme;
  - `authentication-info` maps `code` to `$CODE` and
    `access_token` to `$TOKEN`, and keeps every other
    parameter real;
  - `set-cookie` keeps its attributes.

  A credential-named header carrying a parameter the
  generator does not map fails generation (fail closed).
  The request's `operation-id` shows `$OPERATION_ID`
  everywhere, as the spec's mock does.
- **D11. Credential guard.**
  `credentialFindingsOf(text, known)` returns a kind and
  an offset, never the value. The kinds are JWT shape,
  PHC string, and a known secret. Every file the
  generator writes or compares passes it, with the run's
  known secrets: seeded passwords and every code,
  verifier, challenge, token, cookie value, and
  assertion the replay carried. Layer 1 scans the
  committed tree for shapes. The planted-value oracle is
  in unit tests.
- **D12. Callers.** The member is the first human in
  `buildMembers()` order whose Stark membership type is
  `'member'`. The organization admin is
  `XXZruirZyAOoRpNxaDnpSA`, the seeded admin, a member
  of both organizations. Both sign in on the base state
  before any replay, member first.
- **D13. Story documents** are declared in
  `web-app/app/api-documentation-story.ts`, by the
  seed's own exports (`STARK_ORGANIZATION`, `WO01_ID`,
  `SEED_RECORD_TYPE_ID`, `SEED_INSTANCE_ID`,
  `seedIdentifier(...)`, builders). The story flow has
  work orders and records. The story project has flows.
  A test holds both properties by replay.
- **D14. Listing fills a segment.** The organization
  admin lists the collection at the prefix, on a copy.
  The value is the first part's `content-location`, last
  segment (`api/head-reads.ts:386`). That collection's
  hash becomes the id's `source`.
- **D15. The no-sample list** is
  `NO_SAMPLE: ReadonlyMap<hash, reason>`. An endpoint
  goes on it only when no story document and no listing
  fills a segment, and no recipe creates what it needs
  (today's `services/`, `providers/`, and the GET of
  `token-revocations/:rid`). Generation fails on a gap
  and on a stale entry.
- **D16. Success codes.** Where a sample exists, the
  success code is its witnessed status. The named second
  successes are added beside it: `POST invitations/`
  answers 200 when the head is served again, and
  `POST record-types/` answers 200 on an edit. An
  endpoint with no sample takes its class default. The
  source-text search (`successCodes`, `answersCreated`,
  `alsoAnswersOk`) is deleted.
- **D17. Status pages.** 411, 413, 500, 501, and 504
  gain documents whose bodies are the ones their
  producers send. 422 goes, in its own commit. 503 gets
  no page: only `GET /status`, outside `/api/`, answers
  it. 501 is listed on `POST authentication/authorize`
  as a stated code, for a method other than `password`.
  504 joins the answers any request may get: a Postgres
  timeout, `api/errors-postgres.ts`.
- **D18. The 403 provocation** is "a path the caller
  does not own". Organization routes put
  `ORGANIZATION_TWO` in place of Stark. Identity routes
  put another seeded Stark identity in place of the
  caller's own. The spec names identity 403s as a
  finding but gives no provocation for them, and 403 is
  not among its stated-only codes.
- **D19. The other provocations.**
  - Unknown id: replace the last path parameter with a
    well-formed, never-written value.
  - Stale `If-Match`: a well-formed strong validator
    that is not current.
  - No precondition: drop both `If-*`.
  - Malformed: a `{` body, or `?state=bogus` on the
    three judged routes.
  - Wrong media type: `content-type: text/plain` on
    QUERY.
  - No bearer: drop `authorization`, on the sign-in
    routes too.

  Each keeps every other part of the sample's request.
- **D20. Guided start.**
  - Step 2's exchange is
    `GET /api/identities/<member>/default-organization`.
    It yields the organization id that step 3 reads.
  - Step 2 also states the `transport` declarations,
    `CURL_ADDS`, the HTTP layer's framing (D5), and the
    answers any request may get. All of these are facts
    about every request.
  - The landing shows the step list and step 1's lead.
    Each step opens at `#start/<slug>`. The slugs are
    `sign-in`, `operation-id`, `read`, `list`, `change`,
    and `unattended`.
- **D21. Step 6.** An ES256 key is generated fresh each
  run by WebCrypto, which the seeded stream does not
  reach. Its public coordinates show placeholders, so
  nothing committed ever names a key whose private half
  is known.

  The step stops at the claims. ES256 needs a DER-to-JOSE
  conversion that no single `openssl` command does
  dependably.

  The claims and algorithms come from new exports of
  `api/client-assertion.ts`:
  - `ASSERTION_ALGORITHMS`, the keys of
    `ALGORITHM_PROFILES`;
  - `ASSERTION_CLAIMS`, each claim with its rule and
    whether it is required.

  A test holds those exports to `verifyClientAssertion`.
- **D22. Shell lines** in the guided start are POSIX.
  None uses GNU-only `sed I`. A test runs each one
  through `sh` with `openssl`.
- **D23. Related endpoints**, from the route table:
  - an item links to its collection, its `versions/`,
    and each operation route directly under it;
  - a collection links to its item;
  - `versions/` and `versions/:etag` link to their item;
  - an operation links to its item.
- **D24. `?state=`.** Each judge is probed with
  `'?state=' + s` for every `s` in `INVITATION_STATES`,
  and the accepted values are kept. `judge('')` names
  what the route does without the parameter.
- **D25. Two generations** run concurrently, one under
  `TZ=UTC` and one under `TZ=Pacific/Honolulu`, so a
  local-time leak fails too.
- **D26. Part A ends working.** Its last code task
  adapts the presenter to the new catalog: title, tier,
  headers, answers, and related links. The page works
  at the Part A commit, and Part B builds on it.
- **D27. Search** is a filter on the landing view, not a
  view of its own, and each hit is a link. The role
  switch is not persisted.
- **D28. Squash** without an interactive rebase:
  `git commit-tree` on each feature's final tree. The
  boundaries are found by the fixed subjects of each
  feature's last commit (Task 24).

## Review Focus

These are the input classes the spec implies but no test
named in it exercises, most likely to bite first. Each has
a test in its owning task.

1. **A body with a single quote** (a title like
   "Owner's review") breaks a pasted `curl -d '…'`.
   Expected: the shell receives the body byte for byte.
   *Task 9.*
2. **Typing `/` in the search box** (searching
   `/api/organizations`) must type a slash, not refocus.
   *Task 20.*
3. **A phone-width screen with long `curl` lines**
   scrolls inside the code block, never the page
   (`scrollWidth <= innerWidth`). *Task 18.*
4. **A missing, stale, or reshaped sample file** (a
   partial deploy, a cached file of an older shape)
   says so in place and offers a retry. The rest of the
   page stands. *Tasks 3 and 18.*
5. **Ids from a server seeded on another day** answer
   404 when pasted. Every id in a path is marked as the
   reader's, with a link to the listing that returns
   theirs. *Task 18.*

## File map

New (all hand-written unless noted):

| Path | Responsibility | Task |
|---|---|---|
| `web-app/app/api-documentation-pins.ts` | day, clock, randomness, throwaway key | 1, 4 |
| `tests/seed-determinism-probe.ts` | spawned: pinned seed digest | 1 |
| `tests/seed-write-order.test.ts` | two pinned seeds agree | 1 |
| `web-app/api-documentation/shapes.ts` | catalog + sample types, `readSample` | 3 |
| `web-app/app/generate-api-documentation-main.ts` | CLI entry: pins, then the library | 4 |
| `web-app/app/api-documentation-credentials.ts` | placeholders, `credentialFindingsOf` | 4 |
| `tests/fixtures/replay-pins-key-probe.ts` | spawned: key replaced? | 4 |
| `api/mock-data/throwaway-password-hash.ts` | the cheap hasher | 5 |
| `web-app/app/api-documentation-hash.ts` | `roomHashOf`, `roomPathOf` (moved) | 7 |
| `web-app/app/api-documentation-replay.ts` | stage, copies, send, sign-in, parts | 6 |
| `web-app/app/api-documentation-tier.ts` | `tierOf`, the PII exception | 7 |
| `web-app/app/api-documentation-story.ts` | endpoints, cast, story, path filling, plans | 7, 8 |
| `web-app/app/api-documentation-exchange.ts` | placeholders applied, curl, multipart, `sampleOf` | 9 |
| `web-app/app/api-documentation-answers.ts` | status rules with lines, provocations | 11 |
| `web-app/app/api-documentation-headers.ts` | declared headers per endpoint (BLOCKED) | 12 |
| `web-app/app/api-documentation-related.ts` | related links, `?state=` | 13 |
| `web-app/app/api-documentation-guided-start.ts` | steps, their replays | 14 |
| `web-app/api-documentation/samples/**.json` | generated samples | 15 |
| `web-app/api-documentation/sample-source.ts` | fetch adapter for a sample | 18 |
| `web-app/api-documentation/search.ts` | catalog search | 20 |
| `web-app/api-documentation/syntax.ts` | JSON and curl colouring | 21 |

Each new module task names its own test file. Modified:
`api/mock-data.ts`, `api/backend-memory.ts`,
`api/db-memory.ts`, `server/http-server.ts`,
`api/http-status-documents.ts`,
`api/client-assertion.ts`,
`web-app/app/generate-api-documentation.ts`,
`web-app/app/compose.ts`,
`web-app/api-documentation/{index.ts,index.html,presenter.ts}`,
`web-app/app/styles/pages-api-documentation.css`,
`bin/generate-api-documentation`, `bin/develop`,
`tests/mock-seed.ts`, `AGENTS.md`, `TODO.md`,
`TEST-PLAN.md`.

---

## Task 0: Measure the baselines

**Agent:** `coder`. **Changes no file.**

- [ ] **Step 1: `--check` run time, three runs**

```bash
for i in 1 2 3; do
    /usr/bin/time -p ./bin/generate-api-documentation --check
done
```
Expected: `api-documentation is up to date`, with a
`real` time of about 0.1–0.4 s each.

- [ ] **Step 2: memory seed load, three runs**

```bash
for i in 1 2 3; do
    JWT_HMAC_SIGNING_KEY=x deno eval --frozen "
    const { seededMockDb } = await import(
        './tests/mock-seed.ts');
    const t0 = performance.now();
    await seededMockDb();
    console.log(Math.round(performance.now() - t0));"
done
```
Expected: three numbers near 1,850 (ms).

- [ ] **Step 3: `./test` wall time** (`/usr/bin/time -p
  ./test`). Expected: exit 0.

- [ ] **Step 4: readyMs.** Run this only when Chrome
  exists (`/Applications/Google Chrome.app` or
  `CHROME`), Docker answers `docker info`, and
  `nc -z 127.0.0.1 5432` fails, meaning nothing listens
  there. Then:
  `./bin/measure --check --pages api-documentation`.
  Expected: a median `readyMs` printed; the budget is
  57. Otherwise, write "readyMs before: the operator's
  to run on master" and go on.

- [ ] **Step 5: Report** the four results. The conductor
  keeps them for Task 24.

**Acceptance:** four results reported, or the reason a
result is the operator's. `git status` is clean.

---

# Feature 1: the seed's write order

## Task 1: Pin a seed and prove two pinned seeds differ

**Agent:** `planner`.

**Files:**
- Create: `web-app/app/api-documentation-pins.ts`
- Create: `tests/seed-determinism-probe.ts`
- Create: `tests/seed-write-order.test.ts`

**Interfaces:**
- Consumes: `setClockForTest` (`shared/types.ts:343`),
  `rehearseMockData` (`api/mock-data.ts`),
  `testHashPassword` (`tests/mock-seed.ts`), and
  `FakeTime` (`@std/testing/time`).
- Produces:
  ```ts
  export const PINNED_DAY_MS: number;  // Date.UTC(2020, 0, 1)
  export const CLOCK_STEP_MS = 1;
  export const RANDOM_SEED: number;    // non-zero uint32
  export async function installReplayPins(): Promise<void>;
  ```
  It runs D1's steps (b) to (d) in that order. Step (a)
  joins in Task 4. Replace the crypto methods with
  `Object.defineProperty` (`configurable`, `writable`),
  not an `any` cast. `randomUUID` returns a v4-shaped
  UUID from the same stream. The header comment says why
  each pin exists (spec, Byte-stable output).

- [ ] **Step 1: Write the probe.**
  `tests/seed-determinism-probe.ts` statically imports
  only the pins, awaits `installReplayPins()`, then
  dynamic-imports `../api/mock-data.ts` and
  `./mock-seed.ts`. It runs
  `rehearseMockData({ hashPassword: testHashPassword })`
  and prints one JSON line:
  `{"digest": <SHA-256 hex of
  JSON.stringify(rehearsal.statements)>, "rows": <total
  rows>}`. It prints nothing else, and never a
  credential.

- [ ] **Step 2: Write the failing test**

```ts
// tests/seed-write-order.test.ts
async function probe(): Promise<{
    digest: string; rows: number;
}> {
    const out = await new Deno.Command('deno', {
        args: ['run', '--frozen', '--allow-read',
            '--allow-env', 'tests/seed-determinism-probe.ts'],
        stdout: 'piped', stderr: 'piped',
    }).output();
    assert(out.success, new TextDecoder().decode(out.stderr));
    return JSON.parse(new TextDecoder().decode(out.stdout));
}

Deno.test('two pinned seeds write identical rows',
async () => {
    const [first, second] = await Promise.all([
        probe(), probe(),
    ]);
    assert(first.rows > 0);
    assertStrictEquals(first.digest, second.digest);
});
```

- [ ] **Step 3: Run it red.** Command:
  `one tests/seed-write-order.test.ts`.
  Expected: `FAILED`, with two different digests.

- [ ] **Step 4: Commit** (red on the branch is allowed).
  `./test validate --syntax`, then
  `git add web-app/app/api-documentation-pins.ts
  tests/seed-determinism-probe.ts
  tests/seed-write-order.test.ts`. Subject: **Pin the
  seed's day, clock, and randomness**.

**Acceptance:**
- The pins module's only static import is
  `@std/testing/time`.
- The probe prints exactly one line.
- The test is red for the right reason: digests differ,
  and the probe succeeded.

## Task 2: Write the seed's work-order writes in order

**Agent:** `coder`.

**Files:**
- Modify: `api/mock-data.ts`. That means
  `postWorkOrderChainsIn` (`:518-559`) and the wave in
  `postMockDataLoadIn` that holds the idea submissions,
  the work-order creations, the AI members, and the
  record types (`:984`).
- Test: `tests/seed-write-order.test.ts` (Task 1),
  unchanged.

- [ ] **Step 1: Write the histories in order.**
  Replace
  `await Promise.all([...traces.values()].map(async (trace) => {…}))`
  with `for (const trace of traces.values()) {…}`,
  leaving the body unchanged. Rewrite the comment line
  "Chains run concurrently" to say chains run one after
  another, in the traces' own order, so that a re-seed
  under fixed pins draws the same ids and stamps.

- [ ] **Step 2: Still red.** Command:
  `one tests/seed-write-order.test.ts`.
  Expected: `FAILED`. The digests still differ, from the
  second cause. `./test validate --syntax`, then commit
  `api/mock-data.ts` with the subject **Write work-order
  histories in trace order**.

- [ ] **Step 3: Create the work orders in order.** Take
  the `…[...mockWorkOrders, ...leadToCloseData.workOrders].map(… postWorkOrderCreationOp …)`
  element out of that `Promise.all`. After the wave
  resolves, run
  `for (const wo of [...mockWorkOrders, ...leadToCloseData.workOrders]) { await postWorkOrderCreationOp(…same arguments…); }`.
  Nothing else in the wave reads a work order, and the
  histories (Step 1) run after it. Add one comment line
  saying why.

- [ ] **Step 4: Green.** Command:
  `one tests/seed-write-order.test.ts`. Expected:
  `ok | 1 passed | 0 failed`.

- [ ] **Step 5: Commit.** `./test validate --syntax`,
  then commit `api/mock-data.ts` with the subject
  **Create seeded work orders one at a time**. Commit
  now: the next step restores the file from git.

- [ ] **Step 6: Each fix is necessary.** First restore
  Step 1's `Promise.all` by hand and run the test.
  Expected: `FAILED`. Then
  `git checkout -- api/mock-data.ts`. Next, put the
  work-order creations back into the wave and run.
  Expected: `FAILED`. Run `git checkout --
  api/mock-data.ts` again, then rerun. Expected: `ok`.
  Report both red results.

- [ ] **Step 7: The real seed is unchanged but for
  order.** Command:
  `one tests/work-order-history-oracle.test.ts
  tests/mock-data-pairs.test.ts`. Then `./test`.
  Expected: both `ok`. No test file was edited:
  `git diff --stat HEAD~2 HEAD -- tests/` and
  `git status --short tests/` are both empty.

- [ ] **Step 8: Measure the seed after.** Run Task 0
  Step 2's command and report it beside the baseline.

**Acceptance:**
- Two commits, each touching only `api/mock-data.ts`.
- `./test` is green.
- Both red oracles were reported.
- Seed load is reported before and after.
- If a third cause appears (still red after Step 3),
  fix it the same way in its own commit. If a cause is
  not a matter of write order, stop and report it.

---

# Feature 2: Part A, the generator

## Task 3: Declare the catalog and sample shapes

**Agent:** `architect`.

**Files:**
- Create: `web-app/api-documentation/shapes.ts`
- Modify: `web-app/app/generate-api-documentation.ts`
  (`KEPT_ROOT_NAMES`, `:51`: add `'shapes.ts'`)
- Test: `tests/api-documentation-shapes.test.ts`

**Interfaces:**
- Produces (the names every later task uses; the
  architect may add a type, but may not rename these):

```ts
export type ApiDocTier = 'member' | 'admin' | 'none';
export type ApiDocHeaderState =
    'required' | 'optional' | 'forbidden' | 'alternative';
export interface ApiDocHeader {
    readonly name: string;           // lower-case
    readonly state: ApiDocHeaderState;
    readonly alternatives: readonly string[]; // [] unless alternative
}
export interface ApiDocHeaderSet {
    readonly when: string;           // '' | 'grant_type=refresh' …
    readonly headers: readonly ApiDocHeader[];
}
export interface ApiDocAnswer {
    readonly code: string;           // '412'
    readonly line: string;           // why, and what to do
}
export interface ApiDocQueryParameter {
    readonly name: string;
    readonly values: readonly string[];
    readonly absent: string;
}
export interface ApiDocLink {
    readonly hash: string;
    readonly label: string;
}
export type ApiDocSampleRef =
    | { readonly kind: 'sample'; readonly path: string }
    | { readonly kind: 'none'; readonly reason: string };
export interface ApiDocRoom {
    readonly hash: string;
    readonly verb: string;
    readonly uri: string;            // '/api/…'
    readonly tier: ApiDocTier;
    readonly headerSets: readonly ApiDocHeaderSet[];
    readonly query: readonly ApiDocQueryParameter[];
    readonly answers: readonly ApiDocAnswer[];
    readonly related: readonly ApiDocLink[];
    readonly sample: ApiDocSampleRef;
}
export interface ApiDocStatus {      // unchanged from today
    readonly hash: string;
    readonly code: string;
    readonly body: string;
}
export interface ApiDocStep {
    readonly hash: string;           // 'start/sign-in'
    readonly title: string;
    readonly prose: readonly string[];
    readonly shell: readonly string[];
    readonly sample: ApiDocSampleRef;
}
export type ApiDocHeaderLine = readonly [string, string];
export type ApiDocBody =
    | { readonly kind: 'empty' }
    | { readonly kind: 'text';
        readonly mediaType: string;
        readonly text: string }
    | { readonly kind: 'multipart';
        readonly boundary: string;
        readonly parts: readonly ApiDocPart[];
        readonly more: number };
export interface ApiDocPart {
    readonly status: number;
    readonly headers: readonly ApiDocHeaderLine[];
    readonly body: ApiDocBody;       // never multipart
}
export interface ApiDocRequest {
    readonly method: string;
    readonly target: string;         // '/api/…', real ids
    readonly headers: readonly ApiDocHeaderLine[];
    readonly body: ApiDocBody;
}
export interface ApiDocResponse {
    readonly status: number;
    readonly headers: readonly ApiDocHeaderLine[];
    readonly body: ApiDocBody;
}
export interface ApiDocExchange {
    readonly caller: ApiDocTier;     // who sent it
    readonly request: ApiDocRequest;
    readonly response: ApiDocResponse;
    readonly curl: string;
}
export interface ApiDocPathId {
    readonly name: string;           // ':id'
    readonly value: string;
    readonly source: string;         // a hash, '' = caller's own
}
export interface ApiDocSample {
    readonly hash: string;
    readonly pathIds: readonly ApiDocPathId[];
    readonly exchanges: readonly ApiDocExchange[];
}
export type SampleRead =
    | { readonly kind: 'sample'; readonly sample: ApiDocSample }
    | { readonly kind: 'fault'; readonly reason: string };
export function readSample(value: unknown): SampleRead;
```

- [ ] **Step 1: Write the failing tests.**

  `readSample` accepts a well-formed sample built in the
  test, with one JSON exchange and one multipart
  exchange of two parts, and returns it deep-equal.

  It returns `fault` with a `reason` naming the path
  (for example `exchanges[0].response.status`) for each
  of these:
  - a non-object;
  - a missing `response`;
  - a header line that is not two strings;
  - a multipart part whose body is multipart;
  - a negative `more`;
  - an unknown body `kind`;
  - a `caller` outside the tier set.

  Finally, `shapes.ts` has no `import` line: read its
  source and `assertNotMatch(src, /^import /m)`.

- [ ] **Step 2: Run red.** Command:
  `one tests/api-documentation-shapes.test.ts`. Expected:
  module not found.

- [ ] **Step 3: Write `shapes.ts`.** Add `'shapes.ts'` to
  `KEPT_ROOT_NAMES` in the same commit, so `--check`
  stays green.

- [ ] **Step 4: Green.** Run the same file, then
  `./bin/generate-api-documentation --check`. Expected:
  `ok`, and `api-documentation is up to date`.

- [ ] **Step 5: Commit.** Subject: **Declare the
  documentation catalog and sample shapes**.

**Acceptance:**
- The names above are exact.
- `readSample` validates every field once and never
  throws.
- No optional properties: `exactOptionalPropertyTypes`
  applies.
- `--check` is green.

## Task 4: Guard credentials; generate under a throwaway key

**Agent:** `planner`.

**Files:**
- Create: `web-app/app/api-documentation-credentials.ts`
- Create: `web-app/app/generate-api-documentation-main.ts`
- Create: `tests/fixtures/replay-pins-key-probe.ts`
- Modify: `web-app/app/api-documentation-pins.ts` (D1a)
- Modify: `web-app/app/generate-api-documentation.ts`
  (export `runCli`, delete the `isCliEntry` self-run,
  and pass every written or compared file through the
  guard)
- Modify: `bin/generate-api-documentation`
- Test: `tests/api-documentation-credentials.test.ts`

**Interfaces:**
- Consumes: `REQUEST_CREDENTIAL_NAMES` and
  `RESPONSE_CREDENTIAL_NAMES`
  (`shared/http-message/credentials.ts:10`); the PHC
  algorithm ids `shared/password-hash.ts` dispatches on;
  the shapes (Task 3); `postMockDataLoad` and
  `memoryDbAdapter` (tests only).
- Produces:
  ```ts
  export const PLACEHOLDERS: Readonly<Record<string, string>>;
  // role → variable: origin '$ORIGIN', token '$TOKEN',
  // operationId '$OPERATION_ID', etag '$ETAG',
  // code '$CODE', verifier '$VERIFIER',
  // challenge '$CHALLENGE', username '$USERNAME',
  // password '$PASSWORD',
  // clientAssertion '$CLIENT_ASSERTION',
  // refreshToken '$REFRESH_TOKEN', jwkX '$JWK_X',
  // jwkY '$JWK_Y'
  export const BODY_SECRET_FIELDS:
      Readonly<Record<string, string>>;  // field → '$FIELD'
  export type CredentialKind = 'jwt' | 'phc' | 'known';
  export interface CredentialFinding {
      readonly kind: CredentialKind;
      readonly at: number;              // offset; never the text
  }
  export function credentialFindingsOf(
      text: string, known: readonly string[],
  ): readonly CredentialFinding[];
  export async function runCli(
      args: readonly string[],
  ): Promise<void>;                     // library
  ```
  A known secret shorter than 16 characters throws
  (`MIN_KNOWN_SECRET_LENGTH`). A short value means the
  wrong value was registered. `BODY_SECRET_FIELDS` is
  enumerated from the gate validators. Read each
  validator a body passes through on a credential,
  token, registration, or authentication route; name
  each field that holds a secret and say in a comment
  where you found it. Until Task 6 the generator passes
  `known = []`.

- [ ] **Step 1: Write the failing tests.**
  1. 'a planted JWT is found'. Build a valid
     `ApiDocSample` and `JSON.stringify` it. Plant
     `eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.c2ln` in a
     header value. Expect
     `findings.map((f) => f.kind)` to equal `['jwt']`.
     The same sample without the plant gives `[]`.
  2. 'a planted PHC string is found'. Plant
     `$scrypt$ln=17,r=8,p=1$c2FsdA$aGFzaA`. Expect
     `['phc']`.
  3. 'a planted seeded password is found'. Run
     `postMockDataLoad(memoryDbAdapter(), { hashPassword:
     testHashPassword })` and plant
     `identities[0].password` in a body. With
     `known = every seeded password`, expect `['known']`.
     The assertion messages never include the password.
  4. 'the committed tree carries no credential shape'.
     Walk every file under `web-app/api-documentation/`
     and expect `credentialFindingsOf(text, [])` to be
     `[]`, naming the file on failure.
  5. 'the generator sets its own signing key'. Spawn
     `deno run --frozen --allow-read
     --allow-env=JWT_HMAC_SIGNING_KEY
     tests/fixtures/replay-pins-key-probe.ts` with env
     `JWT_HMAC_SIGNING_KEY=operator-key-sentinel`. The
     probe prints `replaced` when, after
     `installReplayPins()`, the variable differs from the
     sentinel and is 64 hex characters. Otherwise it
     prints `kept`. Expect stdout `replaced`.
  6. 'the generator may read only its own key'. Read
     `bin/generate-api-documentation`. Expect exactly
     one `--allow-env`, equal to
     `--allow-env=JWT_HMAC_SIGNING_KEY`, no
     `POSTGRES_URL`, and that it runs
     `generate-api-documentation-main.ts`.
  7. 'pins load before product code'. The main entry's
     only static import is the pins module, and the
     pins module's only static import is
     `@std/testing/time` (scan the `import` lines).

- [ ] **Step 2: Run red.** Command:
  `one tests/api-documentation-credentials.test.ts`.
  Expected: module not found, then 5 to 7 failing.

- [ ] **Step 3: Write the guard module.** Commit it with
  tests 1 to 4. Subject: **Guard the documentation
  against credentials**.

- [ ] **Step 4: Wire it up.** Add D1(a) to the pins.
  Write the main entry: `await installReplayPins()`,
  then `(await import('./generate-api-documentation.ts'))
  .runCli(Deno.args)`. Make `runCli` exported and async.
  Pass every file the generator writes or compares
  through the guard. A finding fails the run with
  `credential-shaped text in <path> (<kind>)`. Point the
  bin script at the entry and add
  `--allow-env=JWT_HMAC_SIGNING_KEY`. If the run then
  needs any other permission, stop and report it.

- [ ] **Step 5: Green.** Commands:
  `one tests/api-documentation-credentials.test.ts`,
  then `./bin/generate-api-documentation --check`.
  Expected: `ok | 7 passed`, and `api-documentation is
  up to date`. The output tree is unchanged.

- [ ] **Step 6: Commit.** Subject: **Generate under a
  throwaway signing key**.

**Acceptance:**
- Two commits.
- No test, message, or log prints a credential.
- `bin/generate-api-documentation` grants env for the
  key alone.
- The generated tree is byte-identical to before.

## Task 5: Move the throwaway password hash out of tests

**Agent:** `coder`.

**Files:**
- Create: `api/mock-data/throwaway-password-hash.ts`
- Modify: `tests/mock-seed.ts`
- Test: `tests/throwaway-password-hash.test.ts`

- [ ] **Step 1: Write the failing test.** Name it 'the
  throwaway hash stays out of the server'. No file under
  `server/`, and none under `api/` other than the module
  itself, contains `throwaway-password-hash`. It runs
  red because the module does not exist; assert first
  that it does (`Deno.statSync`).
- [ ] **Step 2: Run red.** Command:
  `one tests/throwaway-password-hash.test.ts`.
  Expected: `FAILED`, with NotFound.
- [ ] **Step 3: Move the code.** Move `testHashPassword`'s
  body and its four constants verbatim into the new
  module, exported as `throwawayPasswordHash`, with a
  header comment: one iteration, for throwaway seeds
  only (the test seeds and the documentation generator),
  never the operator's seed. In `tests/mock-seed.ts`,
  delete them and add
  `export { throwawayPasswordHash as testHashPassword }
  from '../api/mock-data/throwaway-password-hash.ts';`.
  Keep `seededMockDb` and `sharedMockDb` as they are,
  calling the import.
- [ ] **Step 4: Green.** Commands: the same file, then
  `./test`. Expected: `ok`, and every importer of
  `testHashPassword` unchanged.
- [ ] **Step 5: Commit.** Subject: **Move the throwaway
  password hash out of tests**.

**Acceptance:** The body moves unchanged, and only its
name and file change. No test file other than the new one
is edited.

## Task 6: Replay requests through the gate

**Agent:** `architect`.

**Files:**
- Modify: `api/backend-memory.ts` (`copy()`)
- Modify: `api/db-memory.ts` (`memoryDbAdapterOver`)
- Modify: `server/http-server.ts`
  (`withApiResponseDefaults`, called from `dispatch` at
  `:746`)
- Create: `web-app/app/api-documentation-replay.ts`
- Test: `tests/api-documentation-replay.test.ts`

**Interfaces:**
- Consumes: `rehearseMockData`, `postSeedLanding`
  (`api/ledger-seed.ts:324`), `handleRequest`,
  `throwawayPasswordHash`, `generateIdentifier`,
  `generateSecret`, `ApiDocHeaderLine`, and
  `client/authentication.ts:110-170` for the two
  sign-in calls (client id `web-app`).
- Produces:
  ```ts
  // api/backend-memory.ts
  copy(): MemoryStorageBackend;  // same rows; independent
  // api/db-memory.ts
  export function memoryDbAdapterOver(
      backend: MemoryStorageBackend): BackedDbAdapter;
  // server/http-server.ts
  export function withApiResponseDefaults(
      response: Response): Response;
  // web-app/app/api-documentation-replay.ts
  export interface ReplayRequest {
      readonly method: string;
      readonly target: string;  // '/api/…' path + query
      readonly headers: readonly ApiDocHeaderLine[];
      readonly body: string;    // '' = none
  }
  export interface RecordedResponse {
      readonly status: number;
      readonly headers: readonly ApiDocHeaderLine[];
      readonly body: string;
  }
  export interface RecordedExchange {
      readonly request: ReplayRequest;  // as sent
      readonly response: RecordedResponse;
  }
  export interface ReplayState {
      readonly adapter: BackedDbAdapter;
  }
  export interface SignedIn {
      readonly identityId: string;
      readonly bearer: string;          // never written
      readonly exchanges: readonly RecordedExchange[];
      readonly secrets: readonly string[];
  }
  export interface RecordedPart {
      readonly status: number;
      readonly headers: readonly ApiDocHeaderLine[];
      readonly body: string;
  }
  export interface ReplayStage {
      readonly credentials: SeededCredentials;
      readonly base: ReplayState;
      copy(): ReplayState;
      send(on: ReplayState, request: ReplayRequest):
          Promise<RecordedExchange>;
      signIn(on: ReplayState, username: string,
          password: string, verifier: string):
          Promise<SignedIn>;
  }
  export function openReplayStage(): Promise<ReplayStage>;
  export function partsOf(
      response: RecordedResponse): readonly RecordedPart[];
  ```
  `send` sends the caller's headers in their given
  order, then `operation-id` (a fresh
  `generateIdentifier()`), then `content-length` when
  the body is not empty. It records exactly that list.
  It strips the `/api` mount as
  `tests/in-page-facade.ts:31-58` does and calls
  `handleRequest`, then `withApiResponseDefaults`. It
  records the response headers in `Headers` iteration
  order and the body as `text()`.

  `signIn` throws when either call answers anything but
  2xx. Its `secrets` holds the password, the verifier,
  the challenge, the code, the access token, and every
  `set-cookie` value.

  `partsOf` parses a `multipart/mixed` body of
  `application/http` parts and returns `[]` for any
  other media type.

  `openReplayStage` rehearses once with
  `throwawayPasswordHash`, lands once on a fresh memory
  backend, and returns.

- [ ] **Step 1: Write the failing tests** (in-process;
  the seed is unpinned).
  1. 'sign-in is two calls under Basic'. Sign in as
     `XXZruirZyAOoRpNxaDnpSA`, finding its username and
     password in `stage.credentials` and using a
     verifier from `generateSecret()`. Expect
     `exchanges.length === 2`, both statuses 200, and
     each request's `authorization` to start with
     `Basic `. `secrets` includes the bearer. Never
     print it.
  2. 'a read is recorded whole'. Send
     `GET /api/organizations/<STARK_ORGANIZATION>` with
     `authorization: Bearer …` on `stage.copy()`. Expect
     200; the request headers include `operation-id`;
     the response headers include `etag` and
     `cache-control`.
  3. 'a write on a copy leaves the base unchanged'.
     Take the first part's `content-location` from
     `GET …/flows/` on base. Read that flow on base and
     keep its etag E. PUT the same body with
     `if-match: E` and `content-type: application/json`
     on a copy. Expect 200 and a different etag. A GET
     on base still shows E. A GET on the copy shows the
     new etag.
  4. 'a collection's parts are parsed'. On
     `GET …/flows/`, `partsOf` gives at least one part,
     each with status 200 and a `content-location`.
  5. 'the server applies the same API defaults'. An
     existing server test file may not be edited, so
     add this one here. `withApiResponseDefaults` on a
     response without `cache-control` sets `no-store`
     and keeps one that is already set.

- [ ] **Step 2: Run red.** Command:
  `one tests/api-documentation-replay.test.ts`.
  Expected: module not found.

- [ ] **Step 3: Implement in three commits, each with
  `./test validate --syntax`.**
  - **Copy a memory backend's rows:**
    `copy()` plus `memoryDbAdapterOver`.
    `memoryDbAdapter()` becomes
    `memoryDbAdapterOver(new MemoryStorageBackend())`.
  - **Share the server's API response defaults:**
    extract the `cache-control` default from `dispatch`
    without changing behaviour; `./test` stays green.
  - **Replay requests through the gate:**
    the replay module and its test.

- [ ] **Step 4: Green.** Commands: the same file, then
  `./test`. Expected: `ok | 5 passed`, and the suite
  green.

**Acceptance:**
- `copy()` throws `MissingTableError` on an absent
  table, as `transaction` does.
- No replay path reads `Deno.env`.
- The interface above is exact; later tasks rely on it.
- `server/http-server.ts`'s behaviour is unchanged.

## Task 7: Tier each endpoint and replay every read

**Agent:** `planner`.

**Files:**
- Create: `web-app/app/api-documentation-hash.ts`
  (move only)
- Create: `web-app/app/api-documentation-tier.ts`
- Create: `web-app/app/api-documentation-story.ts`
- Test: `tests/api-documentation-tier.test.ts`
  (the unit half; Task 10 adds the proving half)
- Test: `tests/api-documentation-story.test.ts`

**Interfaces:**
- Consumes: `isPermitted` (`api/authorization.ts:197`),
  `AUTHENTICATION_ROUTES`, `routes`, `offeredVerbs`,
  `routePatternOf`, `roomHashOf` (moved, Step 0), the
  replay stage (Task 6), `buildMembers`,
  `assignOrganization`, and the seed's exported ids
  (D13).

- [ ] **Step 0: Move the hash helpers; change nothing.**
  Move `roomPathOf` and `roomHashOf` verbatim from
  `web-app/app/generate-api-documentation.ts` into
  `web-app/app/api-documentation-hash.ts`. The library
  imports them for its own use and re-exports them
  (`export { roomHashOf, roomPathOf } from
  './api-documentation-hash.ts';`). Its tests' imports
  stay as they are, and the story module never imports
  the library, so no cycle forms. Then
  `./test validate --syntax`, `./test`, and `--check`.
  Commit: **Give the documentation hash helpers a
  module**.
- Produces:
  ```ts
  // api-documentation-tier.ts
  export const TIER_EXCEPTIONS: ReadonlyMap<string, {
      readonly tier: ApiDocTier;
      readonly because: string;
  }>;  // 'identities/:id/pii' → member (api/api.ts:674)
  export function tierOf(row: Route, verb: HttpVerb): ApiDocTier;
  // api-documentation-story.ts
  export interface Endpoint {
      readonly row: Route;
      readonly verb: HttpVerb;
      readonly hash: string;
  }
  export function endpointsOf(
      rows: readonly Route[]): readonly Endpoint[];  // by hash
  export interface Cast {
      readonly member: SignedIn;
      readonly admin: SignedIn;
  }
  export function castOf(stage: ReplayStage): Promise<Cast>;
  export type ReplayPlan =
      | { readonly kind: 'replay';
          readonly caller: ApiDocTier;
          readonly setup: readonly ReplayRequest[];
          readonly request: ReplayRequest;
          readonly pathIds: readonly ApiDocPathId[] }
      | { readonly kind: 'none'; readonly reason: string };
  export function planRead(endpoint: Endpoint, cast: Cast,
      stage: ReplayStage): Promise<ReplayPlan>;
  export const NO_SAMPLE: ReadonlyMap<string, string>;
  ```
  `tierOf` builds the path with each `:x` replaced by a
  literal. A route in `AUTHENTICATION_ROUTES` is
  `'none'`. Otherwise `'member'` when `isPermitted` lets
  a member through, else `'admin'`. `TIER_EXCEPTIONS`
  overrides both.

  `planRead` covers GET and QUERY. The caller is
  `tierOf`'s least-privileged role. Path filling
  follows D13, D14, and the caller's own id on
  `identities/:id`. A QUERY body is
  `{"q": "<a word the story's documents contain>"}`,
  declared per QUERY route. Every request with a JSON
  body carries `content-type: application/json` (spec,
  Whole exchanges). Requests are compact JSON, as a
  client sends them.

- [ ] **Step 1: Write the failing tests.**
  - Tier: across `endpointsOf(routes)`, the counts are
    member 95 + 3 (the PII exception) = 98, admin
    34 − 3 = 31, none 2. `tierOf` on
    `identities/:id/pii` GET, PUT, and DELETE gives
    `'member'`. `TIER_EXCEPTIONS` has exactly one key.
  - Story: 'every read replays or says why'. For every
    GET and QUERY endpoint, either `planRead` is
    `'none'` with a non-empty reason and its hash is in
    `NO_SAMPLE`, or the plan sent on `stage.copy()`
    (setup first) answers 2xx. No `NO_SAMPLE` key names
    an endpoint whose plan is `'replay'`.
  - Story: 'the story documents tell one story'.
    Listing the story flow's `work-orders/` and
    `records/` each yields at least one part (`partsOf`),
    and so does the story project's `flows/`.
  - Story: 'a path id names its source'. Every
    `pathIds` entry that was filled by listing has a
    `source` equal to an existing endpoint hash.

- [ ] **Step 2: Run red.** Command:
  `one tests/api-documentation-tier.test.ts
  tests/api-documentation-story.test.ts`.
  Expected: module not found.

- [ ] **Step 3: Implement in two commits.** Subjects:
  **Derive each endpoint's role tier** and **Replay
  every read through the gate**.

- [ ] **Step 4: Green** on both files and on `./test`.

**Acceptance:**
- No segment is filled by "the first item listed" where
  a story document applies.
- Every replay runs on its own copy.
- A plan's reason names the missing seed document or
  collection route.

## Task 8: Replay every write on its own copy

**Agent:** `planner`.

**Files:**
- Modify: `web-app/app/api-documentation-story.ts`
- Test: `tests/api-documentation-story.test.ts`
  (append)

**Interfaces:**
- Consumes: `buildMockDataInvocations`
  (`api/mock-data/seed-message-pairs.ts:1227`),
  `conditionalOf`, the Task 7 exports.
- Produces:
  ```ts
  export function planWrite(endpoint: Endpoint, cast: Cast,
      stage: ReplayStage): Promise<ReplayPlan>;
  export function planOf(endpoint: Endpoint, cast: Cast,
      stage: ReplayStage): Promise<ReplayPlan>;  // read|write
  ```
  The recipes (spec, Writes):
  - **PUT on an existing document**: the body the seed
    wrote it with, matched on route pattern and
    `idParams`, sent with a setup GET's `etag` as
    `if-match`.
  - **A creation**: a body of that family from the same
    builder, under a fresh `generateIdentifier()`, with
    the route's create precondition from
    `conditionalOf`.
  - **DELETE**: a story or listed document, with
    `if-match` wherever the conditional takes one.
  - **Operations**: one declared recipe each, keyed by
    route pattern and built from seeded ids. That covers
    transition, claim (PUT and DELETE), binding, undo,
    conversion, rotation, revocation, submissions, the
    joins, scores, revisions, record types, attributes,
    instance PATCH, flow records, tags, memberships,
    invitations, and the invitation item PUT, which the
    seed body answers 400.

  Setup requests run on the same copy and are not part
  of the endpoint's sample. Every JSON body carries
  `content-type: application/json`.

- [ ] **Step 1: Write the failing test.** 'every write
  replays on its own copy or says why'. For every
  PUT, POST, PATCH, and DELETE endpoint, either the plan
  is `'none'` and its hash is in `NO_SAMPLE`, or, on a
  fresh copy, every setup answers 2xx and the request
  answers 2xx. Afterwards the base state's story-flow
  etag is unchanged.
- [ ] **Step 2: Run red.** Expected: `FAILED` (no
  `planWrite`).
- [ ] **Step 3: Implement.** No recipe may type a body
  the seed's builders can supply. If an endpoint cannot
  replay, add it to `NO_SAMPLE` with its reason. Never
  silently skip it.
- [ ] **Step 4: Green.** Run the story file and `./test`.
- [ ] **Step 5: Commit.** Subject: **Replay every write
  on its own copy**.

**Acceptance:**
- `NO_SAMPLE` stays short: list it in the report, with
  each reason.
- Each operation recipe names the seeded ids it uses.

## Task 9: Render exchanges as samples and curl text

**Agent:** `planner`.

**Files:**
- Create: `web-app/app/api-documentation-exchange.ts`
- Test: `tests/api-documentation-exchange.test.ts`

**Interfaces:**
- Consumes: `PLACEHOLDERS`, `BODY_SECRET_FIELDS`,
  `credentialFindingsOf`, `RecordedExchange`,
  `partsOf`, and the shapes.
- Produces:
  ```ts
  export const CURL_ADDS: readonly string[];
  // ['host','user-agent','accept','content-length']
  export const KEPT_PARTS = 2;
  export class SecretLedger {        // a bag, nothing more
      add(value: string): void;
      known(): readonly string[];
  }
  export interface Sent {
      readonly caller: ApiDocTier;
      readonly exchange: RecordedExchange;
  }
  export function sampleOf(hash: string,
      pathIds: readonly ApiDocPathId[],
      sent: readonly Sent[],
      ledger: SecretLedger): ApiDocSample;
  export function curlOf(request: ApiDocRequest): string;
  ```
  `sampleOf` replaces each credential with its
  placeholder (D10) and records every value it replaces
  in the ledger. The request's `operation-id` becomes
  `$OPERATION_ID`. Bodies come from the `content-type`:
  JSON and other text become `text`, nothing becomes
  `empty`, and `multipart/mixed` becomes `multipart`,
  with the first `KEPT_PARTS` parts whole and
  `more = total − KEPT_PARTS`. Each exchange's `curl` is
  `curlOf(request)` (D9). A credential-named header
  parameter that is not mapped throws, naming the header
  and the parameter, never the value.

- [ ] **Step 1: Write the failing tests.**
  1. 'the curl text names the method, path, every
     header, and the body'. Use a recorded PUT carrying
     `authorization`, `operation-id`, `if-match`,
     `content-type`, and `content-length`, with a JSON
     body. The curl contains `curl -i -X PUT`,
     `"$ORIGIN/api/…"`, each header name except those
     in `CURL_ADDS`, `If-Match`'s `$ETAG`, and the body.
     It does not contain `content-length`.
  2. 'a stored sample keeps every header sent and
     received'. The header names, in order, equal the
     recorded ones on both sides, `content-length`
     included.
  3. 'credentials become placeholders in both
     directions'. Use a real in-process sign-in (Task
     6). In the sample's JSON, `$TOKEN`, `$CODE`, and
     `$REFRESH_TOKEN` appear, the real values do not,
     and `credentialFindingsOf(json, ledger.known())`
     is `[]`.
  4. 'an unmapped credential parameter fails closed'.
     An `authentication-info` carrying `secret_x="v"`
     throws, and the message lacks `v`.
  5. 'a collection keeps two parts and counts the rest'.
     A recorded multipart of 5 parts gives
     `parts.length === 2` and `more === 3`, and the
     kept parts' headers are whole.
  6. Review Focus 1: 'a single quote in a body survives
     the shell'. Body `{"title":"Owner's review"}`.
     Spawn `sh -c 'printf %s ' + <the -d argument as
     written in the curl>` and expect stdout to equal
     the body.
  7. 'non-ASCII text survives'. A copy's flow renamed
     `Café — ünïcode` replays and the sample's body
     contains it unchanged.
  8. 'a sample reads back'. `readSample` of
     `JSON.parse(JSON.stringify(sampleOf(…)))` for a
     real `GET …/flows/` is kind `'sample'`.

- [ ] **Step 2: Run red.** Command:
  `one tests/api-documentation-exchange.test.ts`.
  Expected: module not found.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Green** on the file and `./test`.
- [ ] **Step 5: Commit.** Subject: **Render replayed
  exchanges as samples**.

**Acceptance:**
- `curl` is a pure function of the stored request.
- No credential reaches a sample.
- The only elision is the counted parts.

## Task 10: Prove the tiers and draw them on the grid

**Agent:** `planner`.

**Files:**
- Test: `tests/api-documentation-tier.test.ts` (append)
- Modify: `web-app/app/generate-api-documentation.ts`
  (`svgOf`)
- Regenerate: `web-app/api-documentation/API.svg`,
  `elevation.ts`

**Interfaces:**
- Consumes: `tierOf`, `planOf`, `castOf`, the stage.
- Produces: `svgOf(rows)`, with the same signature. Each
  offered verb is an `<a href="#<hash>" data-tier="…">`
  around its shape:
  - member: a filled circle;
  - organization admin only: a filled diamond;
  - no token: an open circle.

  Each tier's colour comes from a design token, by
  presentation attribute and in the `<style>` block. The
  legend reads: "● member and organization admin
  ◆ organization admin only ○ no token". A second line
  reads: "Some member endpoints act only on the
  caller's own data."

- [ ] **Step 1: Write the failing proving test.**
  'each tier agrees with who gets past authorization'.
  For each endpoint not tiered `'none'`, send its plan's
  request on a fresh copy twice: once as the member,
  once as the organization admin. Each sends its own
  bearer, with any `identities/:id` segment set to the
  sender's own id.

  "Got past authorization" means the answer is not a 403
  whose `error` is one of the two authorization
  refusals. Those are `authorizeRequest`'s "requires a
  role this principal lacks", and
  `authorizeIdentityPii`'s messages; read
  `api/request-auth.ts`.

  It expects:
  - for a `'member'` tier, the member gets past;
  - for an `'admin'` tier, the admin gets past and the
    member does not.

  A failure names the hash, the tier, and both answers.
- [ ] **Step 2: Oracle.** Delete the PII entry from
  `TIER_EXCEPTIONS` locally. The test must turn red on
  exactly the three PII endpoints. Restore it, then run
  it green and report the red run.
- [ ] **Step 3: Commit the test.** Subject: **Prove each
  endpoint's role tier at the gate**.
- [ ] **Step 4: Draw the tiers.** The existing tests in
  `tests/api-documentation-generator.test.ts`
  ('filled GET circle hrefs the identities hash', 'svg
  draws the /api/ wire prefix', 'the map names
  /invitations/ as backing', 'elevation module matches
  svgOf') must pass untouched. Change `svgOf`, run
  `./bin/generate-api-documentation`, then `--check`.
- [ ] **Step 5: Commit.** Subject: **Draw each
  endpoint's role tier on the grid**.

**Acceptance:**
- The proving test fails when a tier lies.
- Shape and colour differ per tier.
- `--check` is green.

## Task 11: Say why each status is answered, and prove it

**Agent:** `planner`.

**Files:**
- Create: `web-app/app/api-documentation-answers.ts`
- Modify: `api/http-status-documents.ts`
- Test: `tests/api-documentation-answers.test.ts`
- Regenerate: the tree (the status HTML files gain or
  lose pages)

**Interfaces:**
- Consumes: `Endpoint`, `planOf`, `castOf`, the stage,
  `conditionalOf`, `documentFamilyWiring`, and the
  helpers in today's `statusCodesFor`
  (`generate-api-documentation.ts:768-844`), which the
  rules may reuse; the old function itself stays until
  Task 16.
- Produces:
  ```ts
  export interface AnswerRule {
      readonly code: number;
      readonly line: string;      // why here, what to do
      readonly provoked: boolean; // false: stated (409,410,…)
  }
  export const GENERIC_ANSWERS: readonly AnswerRule[];
  // 400 (Operation-ID, Request-ID, framing), 411, 413,
  // 500, 504 — enumerated from api/api.ts:483-500,
  // api/request-context.ts, server/http-server.ts,
  // api/errors-postgres.ts
  export type Provocation = 'no-bearer' | 'foreign-path'
      | 'unknown-id' | 'stale-if-match' | 'no-precondition'
      | 'malformed' | 'wrong-media-type';
  export const PROVOCATION_CODES:
      Readonly<Record<Provocation, number>>;
  // 401 403 404 412 428 400 415
  export function answersFor(endpoint: Endpoint,
      witnessed: number | undefined): readonly AnswerRule[];
  export function provoke(plan: ReplayPlan, p: Provocation,
      cast: Cast): ReplayPlan | undefined;  // undefined = n/a
  ```
  The rules follow D16 to D19, and the order is by code.
  Every listed code carries a line produced by the rule
  that listed it. 429 joins the two sign-in endpoints.
  The three `?state=` routes list 400.

- [ ] **Step 0: Move the shared helpers; change
  nothing.** Move `isDeletableDocument`,
  `versionFamily`, `familyHoldsDeletedHead`,
  `isMembershipItem`, and `isMembershipConflict`
  verbatim into `api-documentation-answers.ts`,
  exported. The library imports them back for today's
  `statusCodesFor`. Then `./test validate --syntax`,
  `./test`, and `--check`. Commit: **Move the status
  rule helpers beside the answers**.

- [ ] **Step 1: Write the failing proving test.**
  'each listed status is the gate's, in both
  directions'. For every endpoint with a `'replay'`
  plan:
  - the plan's witnessed status is in
    `answersFor(endpoint, witnessed)`;
  - for each provocation `provoke` applies, the request
    sent on a fresh copy answers a code that is in the
    endpoint's list or in `GENERIC_ANSWERS`;
  - every listed rule with `provoked: true` is answered
    by its provocation.

  A failure names the hash, the provocation, the
  expected code, the answered code, and the error body.
- [ ] **Step 2: Run red.** Command:
  `one tests/api-documentation-answers.test.ts`.
  Expected: module not found, then many mismatches.
- [ ] **Step 3: Rewrite the rules until it passes.**
  Never loosen the test. A provocation must be otherwise
  valid (the stale `If-Match` keeps the valid body).
  Validators run before preconditions, so a stale
  `If-Match` on an invalid body answers 400, not 412.
  Report what the rewrite changed against today's lists,
  by code.
- [ ] **Step 4: Oracle.** Two local checks; report both,
  then restore. Removing 404 from an endpoint whose
  provocation answers 404 turns the test red. So does
  listing 404 where the provocation answers 204.
- [ ] **Step 5: Status pages, in two commits.**
  - **Document the statuses the gate can answer:** add
    411, 413, 500, 501, and 504 to `STATUS_DOCUMENTS`,
    with the bodies their producers send, then
    regenerate. The existing test 'every status
    document has a catalog status' stays green.
  - **Drop the 422 status page nothing answers:** first
    confirm with
    `grep -rn "UNPROCESSABLE\|422" api server shared
    client web-app/app`, where only the constant and the
    `api/api.ts:127` re-export may appear. Then remove
    the entry and regenerate. If anything answers 422,
    stop and report instead.
- [ ] **Step 6: Commit the rules and the test.**
  Subjects: **Say why each endpoint answers each
  status**, then **Prove each endpoint's statuses at the
  gate**.

**Acceptance:**
- The test holds the lists both ways.
- No `provoked: false` code is checked by provocation.
- 503 gets no page (D17).
- 422 is gone in its own commit.

## Task 12: Print each endpoint's declared headers

The prerequisite is on master. R1 to R6 were re-checked
against the real module, and this text follows it.

**Agent:** `planner`.

**Files:**
- Create: `web-app/app/api-documentation-headers.ts`
- Test: `tests/api-documentation-headers.test.ts`

**Interfaces:**
- Consumes:
  - `REQUEST_HEADER_DECLARATIONS`, `RequestKind`,
    `RequestMethod`, and `RequestHeaderDeclaration`
    from `api/request-headers.ts`. The list is in
    `REQUEST_HEADERS` key order. Each declaration has
    `name` (lower-case), `surface` (`'endpoint' |
    'transport' | 'site'`, from
    `api/request-header-names.ts`), `stateOf(kind)`,
    and `alternatives`.
  - `RequestKind` is `{ routePattern, method, bodySent,
    grantType? }`. `method` is upper-case (`'GET' |
    'QUERY' | 'PUT' | 'POST' | 'PATCH' | 'DELETE'`).
    `grantType` is set only on `authentication/token`;
    elsewhere omit it, because
    `exactOptionalPropertyTypes` applies.
  - `GRANT_TYPES` from `api/authentication.ts`, in its
    own order: `authorization_code`, `refresh`,
    `token-exchange`, `client_credentials`.
  - `AUTHENTICATION_ROUTES` from `api/request-auth.ts`.
  - Build each kind as `KINDS` in
    `tests/request-header-states.test.ts` does:
    `routePatternOf(row)`, `verb.toUpperCase()`, and a
    body sent when the method is PUT, POST, PATCH, or
    QUERY.
- Produces:
  ```ts
  export function headerSetsOf(
      endpoint: Endpoint): readonly ApiDocHeaderSet[];
  export const TRANSPORT_HEADERS:
      readonly ApiDocHeaderSet[];
  ```
  `headerSetsOf`:
  - `authentication/token` gets one set per
    `GRANT_TYPES` entry, in that order, with `when` set
    to `'grant_type=<g>'`. The kind with no grant type
    is not printed: a `grant_type` outside
    `GRANT_TYPES` is refused with 400.
  - Every other endpoint gets one set, with `when: ''`.
  - Only `endpoint` declarations appear, in
    `REQUEST_HEADER_DECLARATIONS` order. `unused` is
    dropped. `request-id` is `forbidden` on every kind,
    so every set lists it.
  - `alternatives` is the declaration's own list when
    the state is `'alternative'`, and `[]` otherwise.
    The declaration carries the set, not the state, and
    `if-match` and `if-none-match` carry it whatever
    their state.

  `TRANSPORT_HEADERS` holds the `transport`
  declarations, stated once in the guided start. Their
  states differ by kind: `forwarded` and
  `x-forwarded-for` are `optional` on
  `authentication/authorize` and on
  `authentication/token` for `authorization_code` and
  `client_credentials`, and `unused` everywhere else.
  So it is a list of sets, each built with `stateOf`,
  with `unused` dropped and every kind taken as
  carrying a body:
  1. `when: ''`: the states for a request outside
     `AUTHENTICATION_ROUTES`;
  2. then one set for each sign-in kind whose list
     differs from set 1, in route then `GRANT_TYPES`
     order. Its `when` is `'POST /api/<route>'`, plus
     `' grant_type=<g>'` on the token route.

  `site` declarations appear nowhere. `content-type` is
  two declarations with one name: `contentType`
  (`endpoint`, `required` on QUERY, `unused`
  otherwise) and `statusPageContentType` (`site`,
  always `unused`). So `content-type` appears exactly
  on the QUERY endpoints.

- [ ] **Step 1: Write the failing test.** 'each
  endpoint's headers equal the declarations' states'.
  - For every endpoint, every set, and every
    `endpoint` declaration, the state listed equals
    `stateOf(kind)`, and an `unused` one is absent.
  - No name that only a `site` declaration carries
    (`accept-encoding`, `sec-fetch-mode`, `accept`)
    appears in any set or in `TRANSPORT_HEADERS`. Derive
    those names from the declarations; do not type them.
  - `content-type` appears on exactly the QUERY
    endpoints.
  - `TRANSPORT_HEADERS`' first set has `when: ''` and
    lists `content-length` `required` and
    `transfer-encoding` `forbidden`. Each set's states
    equal `stateOf` of the kind its `when` names.
- [ ] **Step 2: Red, implement, green**, with `./test`.
- [ ] **Step 3: Commit.** Subject: **Print each
  endpoint's declared request headers**.

## Task 13: Related endpoints and the `?state=` parameter

**Agent:** `coder`.

**Files:**
- Create: `web-app/app/api-documentation-related.ts`
- Test: `tests/api-documentation-related.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function relatedOf(endpoint: Endpoint,
      all: readonly Endpoint[]): readonly ApiDocLink[];
  export function queryParametersOf(
      row: Route): readonly ApiDocQueryParameter[];
  ```
  `relatedOf` follows D23. The labels are
  `'the collection'`, `'the item'`, `'versions'`, and
  the operation's literal segment, such as
  `'transition'`. A link prefers the GET of its target
  route; otherwise it takes the first offered verb.

  `queryParametersOf` follows D24 and returns `[]` for
  a route with no `query` judge.

- [ ] **Step 1: Write the failing tests.**
  - `GET organizations/:id/work-orders/:id` links to
    `get/organizations/id/work-orders`,
    `get/organizations/id/work-orders/id/versions`, and
    `post/organizations/id/work-orders/id/transition`,
    among the others under it.
  - Every link's hash is an endpoint's hash.
  - `identities/:id/invitations/`'s values equal
    `INVITATION_STATES`.
  - `organizations/:id/invitations/` gives
    `['pending','declined','revoked']`, with `absent`
    naming pending.
  - `organizations/:id/memberships/` gives
    `['accepted','removed']`, with `absent` naming
    accepted.
  - A route without a judge gives `[]`.
- [ ] **Step 2: Red, implement, green.**
- [ ] **Step 3: Commit, twice.** Subjects: **Link each
  endpoint to its neighbours**, then **Document
  ?state= from each route's judge**.

**Acceptance:** Both are pure functions over the route
table and the judges. No list of values is typed beside
the judges.

## Task 14: Replay the guided start

**Agent:** `planner`.

**Files:**
- Modify: `api/client-assertion.ts` (D21 exports)
- Create: `web-app/app/api-documentation-guided-start.ts`
- Test: `tests/client-assertion-claims.test.ts`
- Test: `tests/api-documentation-guided-start.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // api/client-assertion.ts
  export const ASSERTION_ALGORITHMS: readonly string[];
  export const ASSERTION_CLAIMS: readonly {
      readonly name: string;    // iss sub aud exp nbf jti
      readonly rule: string;
      readonly required: boolean;
  }[];
  // api-documentation-guided-start.ts
  export interface StepPlan {
      readonly slug: string;
      readonly title: string;
      readonly prose: readonly string[];
      readonly shell: readonly string[];
  }
  export const STEPS: readonly StepPlan[];
  // sign-in, operation-id, read, list, change, unattended
  export function replayStep(slug: string, cast: Cast,
      stage: ReplayStage, ledger: SecretLedger):
      Promise<ApiDocSample>;
  ```
  The steps follow the spec (The guided start) and
  D20 to D22. Steps 1 to 5 run as the member and step 6
  as the organization admin, each on its own copy. Step
  6 shows every call it makes and says it needs an
  organization admin. Its prose lists
  `ASSERTION_ALGORITHMS` and `ASSERTION_CLAIMS`. Step 2's
  prose carries:
  - `TRANSPORT_HEADERS` (Task 12), set by set: what
    every request with a body carries, then what each
    named sign-in request adds;
  - `CURL_ADDS`;
  - the HTTP layer's framing (D5);
  - `GENERIC_ANSWERS`.

- [ ] **Step 1: Write the failing tests.**
  - Claims: for each claim with `required: true`, an
    otherwise-valid assertion that omits it fails
    `verifyClientAssertion`. Without `nbf` it is valid.
    `ASSERTION_ALGORITHMS` equals `['RS256','ES256']`.
    Reuse the assertion helpers that existing
    client-assertion tests use.
  - Shell (Review Focus via D22), run through `sh`:
    - The `VERIFIER` and `CHALLENGE` lines print a pair
      whose challenge equals the base64url SHA-256 of
      the verifier, and `stage.signIn` with that
      verifier succeeds.
    - The `OPERATION_ID` line prints a value that
      `isIdentifier` accepts.
    - The `TOKEN` line, given a real token exchange's
      header block on stdin, prints the bearer. Compare
      in-process; never print it.
    - The `ETAG` line, given a real GET's headers,
      prints its etag.
  - Steps: each `replayStep` sample reads back through
    `readSample`. Every exchange answers 2xx. Step 5 is
    a GET and then a PUT whose `if-match` is the GET's
    etag. Step 6's JSON holds `$JWK_X`,
    `$CLIENT_ASSERTION`, and `$TOKEN`, and no key
    coordinate, by `credentialFindingsOf` with the
    ledger.
- [ ] **Step 2: Red, implement, green.**
- [ ] **Step 3: Commit, twice.** Subjects: **Name the
  claims a client assertion must carry**, then **Replay
  the guided start**.

Re-checked against the module: `TRANSPORT_HEADERS`'
first set lists `content-length` `required` and
`transfer-encoding` `forbidden`, and Task 12's test holds
it.

## Task 15: Write a replayed sample for every endpoint

**Agent:** `planner`.

**Files:**
- Modify: `server/http-server.ts` (`MIME_BY_EXT` `:62`:
  `'.json': 'application/json'`)
- Modify: `web-app/app/generate-api-documentation.ts`
  (an async generation; `--out DIR`)
- Create: `web-app/api-documentation/samples/**.json`
  (generated)
- Test: `tests/http-static-json.test.ts`
- Test: `tests/api-documentation-determinism.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: `runCli` generates in this order.
  1. Open the stage and cast.
  2. For each endpoint (by hash), take `planOf`. A
     replay goes through `sampleOf` into
     `samples/<hash>.json`; `'none'` must be in
     `NO_SAMPLE`.
  3. Each step goes to `samples/start/<slug>.json`.
  4. Generation fails on an endpoint with neither a
     sample nor a reason, and on a `NO_SAMPLE` key with
     a sample. It names the hash.
  5. Every output file passes the guard with
     `ledger.known()` plus the seeded passwords.
  6. The old outputs (old `rooms.ts`, the HTML rooms,
     `API.svg`, `elevation.ts`) stay as they are.

  `--out DIR` writes or checks DIR in place of
  `web-app/api-documentation`. A write prints `wrote
  <root> (N files changed)` or `<root> unchanged`, for
  `bin/develop`'s log.

- [ ] **Step 1: Serve JSON.** Test 'a .json file is
  served as application/json': through
  `listenHttp`, as `tests/http-static-directory-index.test.ts`
  does in a new file. Expect status 200, `content-type`
  `application/json`, and `cache-control` `no-store`.
  Red, add the entry, green. Commit: **Serve JSON files
  as application/json**.
- [ ] **Step 2: Write the failing determinism test.**
  'two generations write the same bytes'. Make two temp
  directories and spawn, concurrently:
  `deno run --frozen --allow-read --allow-write=<dir>
  --allow-env=JWT_HMAC_SIGNING_KEY
  web-app/app/generate-api-documentation-main.ts --out
  <dir>`. One runs with `TZ=UTC`. The other runs with
  `TZ=Pacific/Honolulu` and
  `JWT_HMAC_SIGNING_KEY=operator-key-sentinel`. Both
  succeed. The two file maps are equal, with every
  sample path present. Remove the directories in a
  `finally`. Run red: there is no `--out` yet.
- [ ] **Step 3: Implement**, then
  `./bin/generate-api-documentation`. Expected: about
  131 sample files minus `NO_SAMPLE`, plus 6 step files.
- [ ] **Step 4: Green.** Commands:
  `one tests/api-documentation-determinism.test.ts`,
  `./bin/generate-api-documentation --check`, and
  `./test`. Then run
  `one tests/api-documentation-credentials.test.ts`.
  Its committed-tree scan now covers real samples.
- [ ] **Step 5: Measure.** Run `/usr/bin/time -p
  ./bin/generate-api-documentation --check` three times
  and `/usr/bin/time -p ./test` once. Report them. A
  `--check` of 10 s or more is a finding; do not tune
  around it.
- [ ] **Step 6: Commit, twice.** Subjects: **Write a
  replayed sample for every endpoint** (the generator
  and the samples together), then **Prove two
  generations write the same bytes**.

**Acceptance:**
- Samples are committed only after the guard (Task 4).
- Two generations agree.
- `--check` is green, and its run time is reported.

## Task 16: Emit the catalog and retire the HTML rooms

**Agent:** `architect`.

**Files:**
- Modify: `web-app/app/compose.ts` (rename only)
- Modify: `web-app/app/generate-api-documentation.ts`
- Modify: `web-app/api-documentation/presenter.ts`,
  `index.ts`
- Regenerate: `rooms.ts` and the tree; the
  `get/ post/ put/ patch/ delete/ query/ statuses/`
  directories disappear
- Modify (delete named tests only):
  `tests/api-documentation-generator.test.ts`,
  `tests/api-documentation-presenter.test.ts`
- Create: `tests/api-documentation-catalog.test.ts`

- [ ] **Step 1: Rename.** `copyApiDocumentationRooms`
  becomes `copyApiDocumentationFiles`, with no other
  change. The test 'compose skips TypeScript sources'
  stays green. Commit: **Name the docs copy for what it
  copies**.

- [ ] **Step 2: Write the new catalog tests.** They fail
  to type-check against today's `rooms.ts`; that
  failure is the red. All read the committed tree.
  1. 'the generated tree holds the catalog, the grid,
     and the samples'. `API.svg`, `elevation.ts`,
     `rooms.ts`, and `samples/` exist. No `get/`,
     `post/`, `put/`, `patch/`, `delete/`, `query/`, or
     `statuses/` directory remains.
  2. 'every endpoint has a sample or a reason'. Each
     room's `sample` is either a file that `readSample`
     accepts, whose `hash` equals the room's, or a
     non-empty reason. The same holds for every
     `API_DOC_STEPS` entry.
  3. 'every answer an endpoint lists has its status
     page', and 'every listed code carries a line'.
  4. 'the catalog's tiers are tierOf's', and 'each
     room's headers are headerSetsOf's', and
     `API_DOC_TRANSPORT` equals `TRANSPORT_HEADERS`.
  5. 'each exchange's curl is its request's'. Expect
     `curlOf(request) === curl` for every committed
     exchange.
  6. 'every exchange is whole'. Each request carries
     `operation-id`. Each request on a non-sign-in
     endpoint carries `authorization`. Each response
     carries at least one header.
  7. These re-pin the stated (not provoked) covenants
     of the deleted HTML tests, with their expected
     values unchanged. If the catalog disagrees, stop
     and report; never change an expected value.
     - 410 is listed on GET `ideas/:id`, `flows/:id`,
       `record-types/:record-type-id`, and
       `identities/:id/pii`. It is not listed on
       `identities/:id`, `organizations/:id`,
       `ideas/`, or `invitations/:membership-id`.
     - 204 is listed on GET `identities/`,
       `identities/:id/invitations/`,
       `organizations/:id/ideas/`, and
       `organizations/:id/invitations/`, and not on
       `identities/:id`.
     - The membership items have no DELETE room. Their
       GET lists 405 and neither 410 nor 409. Their PUT
       lists 405 and 409. POST `invitations/` lists 409
       and not 405.
     - The five created-only POSTs list 201 and not
       200. POST `invitations/` and POST
       `record-types/` list both.
  8. 'roomHtml paints the title, answers with lines,
     and status links' (the minimal presenter).

- [ ] **Step 3: The swap.** It is one commit, because
  the tree, its consumers, and their tests change
  together.

  The generator:
  - writes `rooms.ts`, which imports and re-exports the
    shapes' types and holds:
    - `API_DOC_ROOMS`, each room's fields being
      `tierOf`, `headerSetsOf`, `queryParametersOf`,
      the answers as `{ code, line }`, `relatedOf`,
      and the sample ref;
    - `API_DOC_STATUSES` (same shape);
    - `API_DOC_STEPS`;
    - `API_DOC_TRANSPORT`, Task 12's
      `TRANSPORT_HEADERS`: a list of
      `ApiDocHeaderSet`;
    - `API_DOC_GENERIC_ANSWERS`;
    - `API_DOC_CURL_ADDS`;
  - stops writing HTML.

  Delete everything that then has no caller;
  `noUnusedLocals` names it. That includes:
  - `WRITE_EXAMPLES`, `writeExample`, the
    `*Document()` builders, `graphDeltaExample`,
    `invitationTransition`, `QUERY_EXAMPLE`, and
    `exampleBodyFor`;
  - `statusCodesFor`, `successCodes`,
    `handlerSource`, `answersCreated`,
    `alsoAnswersOk`, and `QUERY_STATUS_CODES`;
  - `headersFor` and its helpers;
  - `verbRoomHtml`, `statusRoomHtml`, `heading`,
    `roomDepth`, `statusHref`, `isGrantUri`, and
    `viewStorageField`.

  `presenter.ts`'s `roomHtml(room)` paints:
  - the h1 `VERB /api/uri`;
  - the tier as text;
  - each header set (name and state);
  - each answer as `<a href="#statuses/<code>">` plus
    its line;
  - the related links;
  - the no-sample reason, when there is one.

  `statusHtml` and `unknownHtml` keep their signatures
  and behaviour. `index.ts` changes only its types.

  Delete exactly these tests:
  - From `tests/api-documentation-generator.test.ts`,
    tests of retired artifacts:
    - 'two 401 links share statuses/401/'
    - 'verb room title is the wire URI'
    - 'generateAll emits catalog and elevation'
    - 'a GET of a document that can be deleted lists
      410'
    - 'a GET of a selected collection lists 204'
    - 'every status a room lists has its page'
    - 'a GET room names Operation-ID on every request'
    - 'invitation views list 400, and the identity
      view lists the fence 403'
    - 'a membership item lists 405 and no DELETE room,
      and its writes list 409'
    - "a stored pair's 2xx names the three lines as
      response headers"
    - 'a created answer is 201, and memberships name
      the body the handler validates'
    - 'a QUERY room takes q and answers as a
      collection'
    - "the memberships QUERY room names the GET's
      storage field"
  - From `tests/api-documentation-presenter.test.ts`:
    - 'roomHtml paints heading body headers statuses'
    - 'roomHtml paints response headers apart'

  Each deleted covenant is either re-pinned in Step 2's
  item 7, held by a proving test (Tasks 10, 11, 12), or
  retired with its artifact. That last group is the
  HTML storage section and the typed bodies. List which
  is which in the report.

  Every other test in both files stays byte-identical.
- [ ] **Step 4: Green.** Commands:
  `./bin/generate-api-documentation`,
  `--check`, `./test`, and `./test validate --syntax`.
  Then `./test browser` if Chrome runs, which shows the
  existing Layer 2 file still passes. If Chrome cannot
  launch here, report it as the operator's.
- [ ] **Step 5: Commit.** Subject: **Emit the replayed
  catalog and retire HTML rooms**.

**Acceptance:**
- `git show --stat` shows the generator, `rooms.ts`,
  the deleted HTML tree, the presenter and `index.ts`,
  the two test files (deletions only), and the new
  catalog test.
- The existing browser tests pass unedited.
- `KEPT_ROOT_NAMES` is
  `index.html, index.ts, presenter.ts, shapes.ts`.

## Task 17: Regenerate on Return; record the later work

**Agent:** `coder`.

**Files:** `bin/develop` (`read_return`, `:105`),
`tests/develop-cli.test.ts` (append one test),
`AGENTS.md` (the Return paragraph), `TODO.md`
(`## Later work`).

- [ ] **Step 1: Write the failing test.** 'Return
  regenerates the API documentation before it
  recomposes'. In `bin/develop`'s `read_return` body,
  `generate-api-documentation` appears before
  `bundle_client`. The generation is guarded so a
  failure prints and continues: its line carries
  `||`. Run red.
- [ ] **Step 2: Implement.** In the loop's subshell, run
  `./bin/generate-api-documentation ||
  echo "api-documentation: generation failed;
  recomposing with the tree as it stands"`, then
  `bundle_client`. The existing develop tests stay
  untouched and green. Commit: **Regenerate the API
  documentation on Return**.
- [ ] **Step 3: AGENTS.md.** Add one sentence to the
  Return paragraph: Return first regenerates the API
  documentation and logs whether files changed; a
  failed generation prints its error and does not block
  the redeploy. Commit: **Say Return regenerates the API
  documentation**.
- [ ] **Step 4: TODO.md.** Add two entries under
  `## Later work`, in its conventions (spec, TODO.md):
  "Declare and prove handler role narrowing", and "A
  machine-readable OpenAPI file". Commit: **Record the
  documentation's two later-work items**.

---

# Feature 3: Part B, the page

Every task in Part B reads `DESIGN-SYSTEM.md` in full
before it writes CSS or markup. It uses tokens only,
`hsl(var(--token))` with no hex, adds classes to
`web-app/app/styles/pages-api-documentation.css`, and
writes no `style="…"`. These DOM hooks are pinned by
existing Layer 2 tests and must keep working:
- `#api-elevation` holds the grid's `svg`, and its first
  `a` is an endpoint;
- `#api-room` is hidden on the landing;
- `#api-room h1` reads `VERB /api/uri` for an endpoint
  and the code for a status;
- `#api-room a[href^="#statuses/"]`;
- `[data-api-docs-back]`;
- the unknown-hash miss.

Every new hand-written module joins `KEPT_ROOT_NAMES` in
the same commit.

## Task 18: Show an endpoint's facts beside its sample

**Agent:** `planner`.

**Files:**
- Create: `web-app/api-documentation/sample-source.ts`
- Modify: `presenter.ts`, `index.ts`, `index.html`,
  `pages-api-documentation.css`, and `KEPT_ROOT_NAMES`
- Test: `tests/api-documentation-presenter.test.ts`
  (append)
- Test: `tests/browser/api-documentation.test.ts`
  (append)

**Interfaces:**
- Produces:
  ```ts
  // sample-source.ts — the page's fetch adapter
  export const SAMPLE_TIMEOUT_MS = 10_000;
  export function getSample(path: string): Promise<SampleRead>;
  // presenter.ts
  export type SampleState =
      | { readonly kind: 'loading' }
      | SampleRead;
  export function endpointHtml(room: ApiDocRoom,
      state: SampleState, origin: string): SafeHtml;
  export function exchangeHtml(exchange: ApiDocExchange,
      origin: string): SafeHtml;
  ```
  `getSample` fetches the path relative to the page,
  with `AbortSignal.timeout(SAMPLE_TIMEOUT_MS)`. A
  non-200, a timeout, or a parse failure becomes
  `{ kind: 'fault', reason }`.

  `endpointHtml` lays out two columns from `lg` up: the
  facts on one side; on the other, the sample, sticky so
  it stays in view while the facts scroll. Below `lg` it
  is one column. It paints:
  - the role chips as shape plus text ("member",
    "organization admin", "no token");
  - the header sets;
  - the `?state=` parameter;
  - the answers with their lines and status links;
  - the related links;
  - the curl, with `$ORIGIN` replaced by `origin`, and
    a copy button `[data-api-docs-copy]` that goes
    through `navigator.clipboard`;
  - the request and response, every header line;
  - each path id wrapped in a
    `<mark data-path-id title="…">` that names and links
    the listing `source` (Review Focus 5);
  - on a fault, the reason and `[data-api-docs-retry]`.

- [ ] **Step 1: Write the failing presenter tests.**
  - 'the endpoint view paints facts beside the sample'.
  - 'a multipart sample shows two parts and the count'.
  - 'an endpoint with no sample shows its reason'.
  - 'every header the replay sent and received is
    painted'. Load a committed sample
    (`samples/get/organizations/id/flows.json`); every
    name and value of every line appears in the HTML.
  - 'a failed sample says so and offers a retry'.
  - 'each path id is marked with its source'.
- [ ] **Step 2: Write the failing Layer 2 tests**
  (append; touch no existing test).
  - 'opening an endpoint shows its sample with $ORIGIN
    replaced'. The curl text contains `location.origin`
    and not `$ORIGIN`.
  - 'at a narrow width the endpoint view is one column'.
    Use `page.setViewport` at 375 px. The facts and the
    sample stack: the sample's top is at or below the
    facts' bottom. And
    `document.documentElement.scrollWidth <=
    innerWidth` (Review Focus 3).
- [ ] **Step 3: Red, implement, green.** Commands:
  `one tests/api-documentation-presenter.test.ts`,
  `./test browser`, and `./test`.
- [ ] **Step 4: Commit, twice.** Subjects: **Load an
  endpoint's sample when it opens**, then **Show an
  endpoint's facts beside its sample**.

## Task 19: Put the guided start on the page

**Agent:** `planner`.

**Files:** `presenter.ts`, `index.ts`, `index.html`,
`pages-api-documentation.css`; tests appended as in
Task 18.

**Interfaces:**
- Produces: `startCardHtml(steps: readonly ApiDocStep[]):
  SafeHtml` for the landing's `#api-start`: the six step
  links and step 1's lead. Also
  `stepHtml(step: ApiDocStep, state: SampleState,
  origin: string): SafeHtml`, which paints in
  `#api-room` with the h1 set to the step's title:
  - the prose;
  - the shell lines, copyable;
  - each exchange through `exchangeHtml`;
  - on step 2, the transport headers, the headers curl
    adds, and the answers any request may get, from the
    catalog.

  The hash `#start/<slug>` paints the step. Its sample
  loads without delaying the page's ready.

- [ ] **Step 1: Failing tests.**
  - Presenter: 'the guided start paints its steps in
    order with every exchange'.
  - Layer 2: 'every step hash paints its title', and
    'Back from a step returns to the landing'.
- [ ] **Step 2: Red, implement, green**, with
  `./test browser`.
- [ ] **Step 3: Commit.** Subject: **Put the guided start
  in front of the reference**.

## Task 20: Search the catalog; switch the role view

**Agent:** `planner`.

**Files:**
- Create: `web-app/api-documentation/search.ts`
- Modify: `index.ts`, `index.html`, `presenter.ts`, and
  the CSS
- Test: `tests/api-documentation-search.test.ts`, and
  Layer 2 appended

**Interfaces:**
- Produces:
  ```ts
  export interface SearchHit {
      readonly hash: string;
      readonly label: string;   // 'PUT /api/…' | '412'
      readonly tier: ApiDocTier | 'status';
  }
  export function searchCatalog(query: string,
      rooms: readonly ApiDocRoom[],
      statuses: readonly ApiDocStatus[]): readonly SearchHit[];
  ```
  A search matches, case-folded, on the verb, the URI,
  any listed code, and any header name. The view-as
  control is a radio group (Everyone, Member,
  Organization admin) that sets `data-view-as` on
  `.api-documentation`. CSS dims every
  `[data-tier="admin"]` under the Member view, in the
  grid and in the search hits, and the tier's shape and
  text stay. `/` focuses the box unless focus is already
  in a text field. ArrowUp and ArrowDown move through
  the hits, and Enter opens one.

- [ ] **Step 1: Failing unit tests.**
  - `'412'` finds every room listing 412, plus
    `statuses/412`.
  - `'if-match'` finds rooms with that header.
  - `'flows'` finds the flow URIs.
  - `'zzz'` finds `[]`, and the page shows "No endpoint
    matches."
- [ ] **Step 2: Failing Layer 2 tests.**
  - 'the landing view shows the guided start, the
    search, and the grid'.
  - 'choosing Member dims an organization-admin-only
    endpoint and leaves a member one lit'. Compare the
    computed `opacity` of
    `#api-elevation a[data-tier="admin"]` and
    `[data-tier="member"]`.
  - 'typing in search narrows to a known endpoint;
    Enter opens it; / focuses the box'.
  - 'typing / inside the search box types a slash'
    (Review Focus 2).
- [ ] **Step 3: Red, implement, green.**
- [ ] **Step 4: Commit, twice.** Subjects: **Search
  endpoints, codes, and headers**, then **Dim what the
  chosen role cannot call**.

## Task 21: Colour and fold samples for reading

**Agent:** `planner`.

**Files:**
- Create: `web-app/api-documentation/syntax.ts`
- Modify: `presenter.ts` and the CSS
- Test: `tests/api-documentation-syntax.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const FOLD_LINES = 24;
  export function jsonHtml(text: string): SafeHtml;
  export function curlHtml(text: string): SafeHtml;
  ```
  It uses no library. JSON tokens get the classes
  `tok-key`, `tok-string`, `tok-number`, `tok-literal`,
  and `tok-punct`. Curl gets `tok-flag`, `tok-string`,
  and `tok-var`. Text that is not JSON falls back to
  escaped plain text. A body longer than `FOLD_LINES`
  shows its first lines, with the rest in
  `<details><summary>Show all N lines</summary>`. The
  colours come from tokens in both themes, at the
  design system's contrast. Any transition sits under
  `prefers-reduced-motion: no-preference`.
- [ ] **Step 1: Failing tests.**
  - Every character of the input survives into the
    text content.
  - The keys, strings, numbers, and literals carry
    their classes.
  - `$TOKEN` inside a curl string carries `tok-var`.
  - A 40-line body folds behind a `<details>`.
  - A `<script>` inside a JSON string comes out
    escaped.
- [ ] **Step 2: Red, implement, green.**
- [ ] **Step 3: Commit.** Subject: **Colour and fold
  samples without a library**.

## Task 22: Keyboard reach, the bundle fence, TEST-PLAN.md

**Agent:** `planner`.

**Files:**
- Test: `tests/api-documentation-bundle-fence.test.ts`
- Layer 2 appended
- Modify: `TEST-PLAN.md` (AT3 `:612`, A2 `:656`, B19
  `:1679`, C2a after C2 `:1827`, and a new walk case)

- [ ] **Step 1: Failing fence test.** 'the page's bundle
  never imports api/ or server/'. Spawn
  `deno info --json web-app/api-documentation/index.ts`.
  No module specifier lies under `/api/` or `/server/`.
- [ ] **Step 2: Failing Layer 2 test.** 'the keyboard
  reaches what the pointer does'. Tab reaches, in order:
  the role switch, the search, the step links, and a
  grid endpoint. Enter on the endpoint opens it, and the
  copy button is reachable. Focus is visible on each:
  the computed `outline-style` is not `none`.
- [ ] **Step 3: Implement what fails.** Then update
  TEST-PLAN.md:
  - AT3's gate becomes "the API documentation drift
    gate (catalog, samples, grid)";
  - A2's line on rooms becomes samples under
    `api-documentation/samples/`;
  - B19's pin is kept;
  - C2a covers search and the role switch;
  - a new C2b walks the guided start, pasting step 1's
    shell lines and both calls against the walk origin.
- [ ] **Step 4: Commit, twice.** Subjects: **Reach every
  documentation control by keyboard**, then **Walk the
  rebuilt API documentation page**.

---

# Close

## Task 23: Review the whole branch

**Agent:** `architect`.

Read the spec, this plan, AGENTS.md, and
`git diff master...HEAD`. Judge the branch against the
spec's Goals, Anti-goals, the hard rule, and the Global
Constraints. Look in particular for:
- a typed sample;
- a fact on the page that code does not produce;
- an edited existing test;
- a credential in any committed byte (run the Task 4
  scan by hand);
- a move and a change in one commit;
- inline styles;
- an `api/` import in the bundle;
- an existing hash that broke.

Report findings by severity. Each finding is fixed in its
own commit by a fresh `planner`, and a scoped re-review
by a `coder` follows. Fix rounds end when nothing
important remains.

## Task 24: Squash, validate, measure, report

**Agent:** `coder`.

- [ ] **Step 1: Find the feature ends** by subject:

```bash
F1=$(git log --format=%H --grep='^Create seeded work orders one at a time$' -1)
F2=$(git log --format=%H --grep='^Record the documentation.s two later-work items$' -1)
BASE=$(git log --format=%H --grep='^Plan the API documentation overhaul$' -1)
```
A Task 23 fix that touches only Part A's files must
reach the Part A tree too. The conductor names such
fixes. For them, run `git checkout --detach "$F2"` and
`git cherry-pick <those fixes>`, then set
`F2=$(git rev-parse HEAD)` and
`git checkout api-documentation-overhaul`. A conflict
means the fix depends on Part B: abort the
cherry-pick, and the fix stays in Part B.

- [ ] **Step 2: Squash by tree** (outside the sandbox):

```bash
T='Co-Authored-By: <your trailer>'
c1=$(git commit-tree "$F1^{tree}" -p "$BASE" \
    -m 'Seed work-order writes in a fixed order' -m "$T")
c2=$(git commit-tree "$F2^{tree}" -p "$c1" \
    -m 'Generate replayed API documentation' -m "$T")
c3=$(git commit-tree "HEAD^{tree}" -p "$c2" \
    -m 'Rebuild the API documentation page' -m "$T")
git diff --quiet HEAD "$c3" && git reset --hard "$c3"
```
Expected: the diff is empty, so the reset changes no
file. `git log --oneline master..HEAD` shows the
TODO-rewrite, spec, and plan commits, then exactly three
feature commits.

- [ ] **Step 3: The two feature commits below HEAD
  stand.** For `c1` and `c2`, run `git checkout --detach
  <c>`, `./test validate --syntax`, and `./test`. Then
  `git checkout api-documentation-overhaul`. Expected:
  green at each.
- [ ] **Step 4: Layer 1.** Command: `./test validate`.
  Expected: exit 0.
- [ ] **Step 5: Layer 2.** Command:
  `./test validate browser`. Expected: exit 0. If Chrome
  cannot launch here, write the operator's command.
- [ ] **Step 6: Measure after.**
  - `--check` three times.
  - Seed load three times (Task 0 Step 2).
  - `./test` once.
  - readyMs, under Task 0 Step 4's conditions:
    `./bin/measure --check --pages api-documentation`.
- [ ] **Step 7: Report.**
  - The branch name, `api-documentation-overhaul`,
    resting squashed and green; no merge.
  - Each measurement before and after, with `--check`
    against the 10 s target and readyMs against the 57
    budget. A missed target is a finding.
  - `NO_SAMPLE` with its reasons.
  - The status-rule changes Task 11 reported.
  - The checks left to the operator: `./test validate
    browser` and `./bin/measure --check --pages
    api-documentation`, when Chrome, Docker, or a free
    5432 was missing; and `./test postgres`, because
    the seed's write order also runs on Postgres and
    5432 may be theirs.
