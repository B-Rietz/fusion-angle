# System Status Through the API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** `/status` gives one UP/DOWN verdict for the
system, learned by a real HTTP request to the server's own
`/api/status`, which really probes Postgres; both name the
running commit by sha and subject, and the page refreshes
itself.

**Architecture:** The Postgres probe moves behind
`DbAdapter` and answers one of three states. `/api/status`
is a route-table row the API gate answers itself, ahead of
`Operation-ID` and the bearer check, from a commit the
listener hands the API's handler. `/status` asks that route
over loopback HTTP, renders one tinted card, and a small
bundled script re-fetches the page and swaps the card only
when its markup differs.

**Tech Stack:** Deno 2.9.8, TypeScript (`strict`,
`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`,
`erasableSyntaxOnly`), `Deno.serve`, `npm:postgres`, bash,
plain CSS, `deno bundle`.

**Spec:** `docs/superpowers/specs/api-status-design.md`.
Read it before any task. Line numbers in this plan are the
branch at `4ef48e001`.

## Global Constraints

- Work only in `.worktrees/api-status`. Never pass the Agent
  tool `isolation`. Never run `./deploy --render`. Never
  merge.
- `export DENO_DIR="$TMPDIR/deno-dir"` before any `deno`,
  `./test`, or `./deploy` command.
- `git commit` fails inside the sandbox (`index.lock` under
  `.git/worktrees`); run commits outside it.
- Before every commit: `./test validate --syntax`, `./test`,
  and `./test lint` all pass. A task that touches the route
  table also runs `./test api-docs`.
- One file of the memory suite runs as:
  `JWT_HMAC_SIGNING_KEY=test-hmac-signing-key TZ=UTC deno
  test --frozen --no-check --sanitize-ops
  --sanitize-resources --allow-env --allow-read
  --allow-write --allow-net --allow-run=deno,sh,git
  --preload ./tests/hmac-test-key.ts
  --preload ./tests/local-storage-stub.ts
  --preload ./tests/session-storage-stub.ts
  --preload ./tests/worker-name-prefix.ts tests/<file>`.
  `--no-check` hides type errors; `./test validate --syntax`
  shows them.
- Commit subject: one line, about 50 characters,
  present-tense imperative, no body beyond
  `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.
  One concern per commit. Never move or rename and change
  content in the same commit.
- 78-character lines in code and scripts, 4-space indent, no
  inline `style=`, no `org` abbreviation in identifiers.
- `handleRequest(adapter, request)` keeps its signature.
- `api/` imports nothing from `server/` and uses no `Deno.*`.
- The commit reaches the API through the handler the
  listener builds. No module-level setter.
- Request headers are read through `requestHeaderOf`
  (`tests/request-header-ban.test.ts`).
- A transaction body awaits only row ops.
- Tests run under the op and resource sanitizers: every
  body, timer, and listener a test or the product opens is
  released on every path.
- Tests that pin the old covenant are rewritten to the new
  one or deleted. No assertion is weakened to pass.
- Wire words, exactly: component states `up`, `down`,
  `timeout`; rating `UP`, `DOWN`; pills `API down`,
  `API timeout`, `Timeout`; JSON keys `git-sha`,
  `git-subject`, `up`, `components`.
- Waits, exactly: probe statement 100 ms; `/status` for
  `/api/status` 500 ms; the page for `/status` 1 500 ms.
- Refresh ladder, by time since the card last changed:
  under 1 min, 1 s; 1 to 10 min, 10 s; 10 min to 1 hour,
  60 s; over 1 hour, 10 min.

## Review Focus

1. A redeploy while the page is open: the next answer
   carries a new sha. The page's timeout card must not keep
   the old sha and subject. (Task 7)
2. A commit subject holding `<`, `"`, `'`, a backslash,
   `${`, or non-ASCII text: escaped on the page, intact in
   JSON, and unable to change the generated entry.
   (Task 5)
3. `/api/status` never answers: `/status` still answers
   inside its wait, says `timeout`, and leaks no body or
   timer. (Task 3)
4. `/status` answers slower than the page's next tick: the
   page never has two requests in flight. (Task 7)
5. Postgres accepts no connection, or throws something the
   probe has never seen: the probe answers a state and
   never rejects, so the route answers 503, never 500.
   (Task 1)

---

## File Structure

| File | Responsibility |
|---|---|
| `shared/system-status.ts` (new) | `ComponentState`, `RunningCommit`, the status document both routes answer |
| `api/postgres-probe.ts` (moved from `server/`) | the Postgres probe |
| `api/db.ts`, `api/db-backed.ts`, `api/backend-*.ts`, `api/ledger-seed.ts` | `probe()` on backend and adapter |
| `api/system-status.ts` (new) | the `/api/status` answer |
| `api/api.ts` | `requestHandlerFor`, the gate's status step |
| `api/routes.ts`, `api/request-auth.ts`, `api/request-headers.ts` | the row, its named exemption, its header states |
| `server/api-status.ts` (new) | the loopback request and its wait |
| `server/http-server.ts`, `server/status-page.ts` | `/status`, the card, the page |
| `server/git-sha.ts`, `server/main.ts`, `server/boot.ts`, `server/develop-main.ts` | the commit pair and its thread |
| `bin/build`, `bin/build-lib`, `bin/develop`, `Dockerfile` | git reads sha and subject everywhere |
| `web-app/app/status-backoff.ts`, `web-app/app/status-refresh.ts` (new) | the ladder; the refresh script |
| `web-app/app/styles/components-cards.css` | the card's tint |
| `web-app/app/generate-api-documentation.ts`, `api/http-status-documents.ts`, `web-app/api-documentation/` | the generated room |

---

### Task 1: The probe behind the adapter

**Files:**
- Create: `shared/system-status.ts`
- Move: `server/postgres-probe.ts` → `api/postgres-probe.ts`
- Modify: `api/db.ts:235-262` (`StorageBackend`),
  `api/db.ts` `DbLifecycle`, `api/db-backed.ts:76-78`,
  `:130-142`, `api/backend-postgres.ts:84`,
  `api/backend-memory.ts:262`, `api/ledger-seed.ts:157`,
  `server/boot.ts:13`, `:126`,
  `server/http-server.ts:86`, `:100`, `:341-420`,
  `:684-687`, `server/status-page.ts:18-40`, `:200-218`
- Test: `tests/postgres-probe.test.ts`,
  `tests/http-server.test.ts`, `tests/status-page.test.ts`,
  `tests/api-ai-agents.test.ts:607`,
  `tests/pg-races.test.ts:358`, new `tests/pg-probe.test.ts`,
  `bin/test-postgres:24-39`

**Interfaces:**
- Produces, in `shared/system-status.ts`:
  ```ts
  export type ComponentState = 'up' | 'down' | 'timeout';
  export type ComponentStates<K extends string> =
      Readonly<Record<K, ComponentState>>;
  export interface RunningCommit {
      readonly sha: string;
  }
  export interface SystemStatus<K extends string> {
      readonly 'git-sha': string;
      readonly up: boolean;
      readonly components: ComponentStates<K>;
  }
  export function everyComponentUp(
      components: ComponentStates<string>,
  ): boolean;
  export function systemStatusOf<K extends string>(
      commit: RunningCommit,
      components: ComponentStates<K>,
  ): SystemStatus<K>;
  ```
  `up` is true only when every component is `'up'`. Key
  order in the document is `git-sha`, `up`, `components`.
- Produces, in `api/postgres-probe.ts`:
  `POSTGRES_PROBE_TIMEOUT_MS = 100` and
  `probePostgres(sql: SqlClient): Promise<ComponentState>`.
- Produces: `probe(): Promise<ComponentState>` on
  `StorageBackend` and on `DbLifecycle` (so on `DbAdapter`).

- [ ] **Step 1: Move the probe, unchanged**

`git mv server/postgres-probe.ts api/postgres-probe.ts`.
Fix only the import specifiers the move breaks: the moved
file's own, `server/boot.ts:13`, and
`tests/postgres-probe.test.ts`. Run `./test validate
--syntax` and `./test`. Commit:
`Move the Postgres probe into the API`.

- [ ] **Step 2: Rewrite the probe's tests to three states**

In `tests/postgres-probe.test.ts`, keep the read-only
`SELECT 1` pin and its `statement_timeout` parameter, now
`'100'`, and pin the states:

```ts
// one row
assertEquals(await probePostgres(sql), 'up');
// zero rows
assertEquals(await probePostgres(sql), 'down');
// the statement is cancelled by its timeout
// (the thrown error's code is '57014')
assertEquals(await probePostgres(sql), 'timeout');
// the connection does not open in time
// (code 'CONNECT_TIMEOUT')
assertEquals(await probePostgres(sql), 'timeout');
// any other throw: an Error with no code, a refused
// connection ('ECONNREFUSED'), a thrown string
assertEquals(await probePostgres(sql), 'down');
```

Add one test over the adapter:
`memoryDbAdapter().probe()` answers `'up'`, and a
`BackedDbAdapter` view inside `readTransaction` answers
the same.

- [ ] **Step 3: Run them; they fail**

Expected: FAIL, `probePostgres` answers a boolean and
`probe` is not a function.

- [ ] **Step 4: Implement**

- `shared/system-status.ts` as above.
- `probePostgres`: `'timeout'` only for the two codes
  above, each a named constant; every other failure
  `'down'`. It never rejects and never logs.
- `PostgresBackend.probe()` calls `probePostgres`.
  `MemoryStorageBackend.probe()` answers `'up'`.
  `RehearsalBackend.probe()` asks its scratch backend.
  `BackedDbAdapter.probe()` and the `#viewForTx` literal
  ask the backend. Add `probe` to the two test backends
  (`tests/api-ai-agents.test.ts:607`,
  `tests/pg-races.test.ts:358`) by delegation.
- `server/http-server.ts`: `/status` reads
  `options.adapter.probe()`. `PostgresProbe`, the
  `postgresProbe` option, and `postgresUp` are deleted;
  `server/boot.ts` stops passing one. `statusDocument`
  answers `systemStatusOf({ sha }, { postgres })`.
- `server/status-page.ts`: `StatusComponents` is
  `ComponentStates<'postgres'>`; its own
  `everyComponentUp` is deleted for the shared one; a
  component pill reads `Postgres up`, `Postgres down`, or
  `Postgres timeout`, success tone for `up`, error tone
  otherwise.

- [ ] **Step 5: Rewrite the `/status` tests this trips**

`tests/http-server.test.ts`: `withServer` (`:146-199`)
loses its `postgresProbe` parameter and the
`PostgresProbe` import. A test that needs another state,
or counts probes, shadows `probe` on the memory adapter
the helper builds. Covenants:

- `:587`, `:626`, `:856`, `:881`: `components` is
  `{ postgres: 'up' }`.
- `:671`, `:913`: probe `'down'` answers 503,
  `{ postgres: 'down' }`, pill `Postgres down`.
- New: probe `'timeout'` answers 503,
  `{ postgres: 'timeout' }`, pill `Postgres timeout` in
  the error tone.
- `:641`, `:753`, `:934`: the probe count is still 0.
- `:706` and `:736` are deleted: the probe is the
  adapter's, never absent, and never throws. Step 2 holds
  the throw.

`tests/status-page.test.ts:63`, `:106`: components are
states.

- [ ] **Step 6: Add the real-Postgres pin**

`tests/pg-probe.test.ts`, added to `bin/test-postgres`'s
list. It follows a neighbour there for its connection
(`tests/pg-boot.test.ts`). A new `connectPostgres` client's
first `probePostgres` (cold) answers `'up'`, and its
second (warm) answers `'up'`. It also times both and
asserts the cold probe finishes inside 500 ms, the wait
Task 3 sets.

- [ ] **Step 7: Verify and commit**

Run: `./test validate --syntax && ./test && ./test lint`.
Expected: all pass. Run `./test postgres` if
127.0.0.1:5432 is free; report the cold and warm
milliseconds. Commit:
`Probe Postgres through the adapter in three states`.

---

### Task 2: `/api/status`

**Files:**
- Create: `api/system-status.ts`, `tests/api-status.test.ts`
- Modify: `api/request-auth.ts:43-47`,
  `api/routes.ts:3643-3651`, `:4142-4147`,
  `api/api.ts:478-524`, `api/request-headers.ts:100-112`,
  `:145-149`, `api/http-status-documents.ts`,
  `server/http-server.ts:754-771`,
  `web-app/app/generate-api-documentation.ts:768-844`,
  `:896-956`, `web-app/api-documentation/` (regenerated),
  `API.md:11-99`, `:183-250`
- Test: `tests/request-header-states.test.ts`,
  `tests/api-documentation-generator.test.ts`,
  `tests/http-status-documents.test.ts`,
  `tests/http-server.test.ts`

**Interfaces:**
- Consumes: `ComponentState`, `RunningCommit`,
  `systemStatusOf`, `DbAdapter.probe()` (Task 1).
- Produces, in `api/request-auth.ts`:
  `export const STATUS_ROUTE = 'status';`
- Produces, in `api/system-status.ts`:
  ```ts
  export function isSystemStatusPath(
      pathname: string,
  ): boolean;
  export async function systemStatusResponse(
      adapter: DbAdapter,
      method: string,
      pathname: string,
      commit: RunningCommit | undefined,
  ): Promise<Response>;
  ```
- Produces, in `api/api.ts`:
  ```ts
  export type ApiRequestHandler = (
      adapter: DbAdapter,
      request: Request,
  ) => Promise<Response>;
  export function requestHandlerFor(
      commit: RunningCommit | undefined,
  ): ApiRequestHandler;
  ```
  `handleRequest` is `requestHandlerFor(undefined)` behind
  its unchanged signature.

- [ ] **Step 1: Write the failing tests**

`tests/api-status.test.ts`, each over
`requestHandlerFor(COMMIT)(memoryDbAdapter(), request)`
with `COMMIT = { sha: 'a'.repeat(40) }` and a request that
carries no `Operation-ID` and no `Authorization`:

```ts
// GET http://x/status
assertEquals(response.status, 200);
assertEquals(await response.json(), {
    'git-sha': COMMIT.sha,
    up: true,
    components: { postgres: 'up' },
});
assert(response.headers.has('request-id'));
// probe shadowed to 'down', then 'timeout'
assertEquals(response.status, 503);
assertEquals(body.up, false);
assertEquals(body.components, { postgres: 'down' });
assertEquals(body.components, { postgres: 'timeout' });
// handleRequest(adapter, request): no commit
assertEquals(response.status, 500);
assertEquals(await response.json(),
    { error: 'git sha unavailable' });
assertEquals(probes, 0);
// a carried Request-ID
assertEquals(response.status, 400);
// POST, PUT, DELETE
assertEquals(response.status, 405);
assertEquals(response.headers.get('allow'), 'GET');
// a malformed Operation-ID and a junk bearer are unread
assertEquals(response.status, 200);
// the message plane is as long after as before
```

In `tests/request-header-states.test.ts`, `responseTo`
(`:674-699`) drives every kind through
`requestHandlerFor` with a sha. Nothing else there
changes: the declared states do the rest.

In `tests/api-documentation-generator.test.ts`, one new
test: the `GET /status` room's headers name neither
`Authorization` nor `Operation-ID`, it has no stored-pair
response lines, and its statuses are exactly 200, 500,
503.

In `tests/http-server.test.ts`, one new test over a
listener with the real handler:
`GET /api/status` answers 200, the document above with
`STATUS_SHA`, `cache-control: no-store`, and a
`request-id`; its log line has no `operationId`.

- [ ] **Step 2: Run them; they fail**

Expected: FAIL, `requestHandlerFor` is not exported, and
`GET /status` answers 400 `Operation-ID is required`.

- [ ] **Step 3: Implement the route**

- `STATUS_ROUTE`, with a comment: the gate answers this
  route before authentication; it is not in
  `AUTHENTICATION_ROUTES`, so it is not throttled and
  reads no proxy line.
- `api/routes.ts`: `route(STATUS_ROUTE, { select:
  statusOffered })` beside the sign-in rows.
  `statusOffered` throws, as `authGrantOffered` does: the
  row exists so the generator documents the verb.
- `dispatched` takes the commit. Straight after the
  carried-`Request-ID` refusal (`api/api.ts:506`) and
  before the `Operation-ID` read, a path
  `isSystemStatusPath` accepts answers
  `systemStatusResponse`.
- `systemStatusResponse`: a method other than `GET`
  answers 405 with `Allow: GET` (RFC 9110 §15.5.6); no
  commit answers 500 `{ error: 'git sha unavailable' }`
  without probing; otherwise it probes once and answers
  `systemStatusOf(commit, { postgres })`, 200 when `up`,
  503 when not.
- `api/request-headers.ts`: on `STATUS_ROUTE`,
  `operationId` and `authorization` are `'unused'`.
- `server/http-server.ts`: at the API mount, when
  `options.handle` is absent and the API path is the
  status path, the request goes to
  `requestHandlerFor(commit)`, where `commit` is
  `{ sha }` from `gitShaForStatus(options.gitSha)` or
  `undefined`. Every other API request still goes to
  `handleRequest`.

- [ ] **Step 4: Teach the generator, then regenerate**

`statusCodesFor`, `headersFor`, and
`carriesStoredPairLines` learn the status row by
`STATUS_ROUTE`. `STATUS_DOCUMENTS` gains 500 (body
`{ error: 'git sha unavailable' }`) and 503 (the document
with `up: false` and `postgres: 'down'`), in code order.
Then run `./bin/generate-api-documentation` and commit
what it writes under `web-app/api-documentation/`.

- [ ] **Step 5: Update API.md**

- `## Dispatch order`: a new step 3, **Status**, between
  Carried Request-ID and Operation-ID; renumber the rest.
  It says what the step answers and that it reads neither
  `Operation-ID` nor a bearer token.
- `## Bearer-exempt set`: `STATUS_ROUTE` is answered
  before the bearer check and is not a member of
  `AUTHENTICATION_ROUTES`.
- The status ladder: rungs for 500 and 503.

- [ ] **Step 6: Verify and commit**

Run: `./test validate --syntax && ./test && ./test lint
&& ./test api-docs`. Expected: all pass. Commit:
`Answer system status at /api/status`.

---

### Task 3: `/status` asks `/api/status`

**Files:**
- Create: `server/api-status.ts`, `tests/api-state.test.ts`
- Modify: `server/http-server.ts:90-101`, `:662-698`,
  `:836-870`, `server/status-page.ts`
- Test: `tests/http-server.test.ts`,
  `tests/status-page.test.ts`

**Interfaces:**
- Consumes: `/api/status` (Task 2), `ComponentState`,
  `systemStatusOf` (Task 1).
- Produces, in `server/api-status.ts`:
  ```ts
  export const API_STATUS_WAIT_MS = 500;
  export function apiStatusUrl(port: number): string;
  export async function apiState(
      url: string,
      waitMs: number,
  ): Promise<ComponentState>;
  ```
  `apiStatusUrl(8080)` is
  `'http://127.0.0.1:8080/api/status'`.
- Produces: `HttpListenOptions.apiStatusWaitMs?: number`,
  defaulting to `API_STATUS_WAIT_MS` as `drainMs` defaults
  to `DRAIN_TIMEOUT_MS`.
- Produces: `StatusComponents` is `ComponentStates<'api'>`,
  labelled `API`.

- [ ] **Step 1: Write the failing tests**

`tests/api-state.test.ts`, each against a throwaway
`Deno.serve` on port 0:

```ts
// 200 { "up": true }
assertEquals(await apiState(url, 500), 'up');
// 503 { "up": false }; 200 { "up": "true" };
// 200 with a body that is not JSON; 404
assertEquals(await apiState(url, 500), 'down');
// a port nothing listens on
assertEquals(await apiState(url, 500), 'down');
// a handler that answers after the wait
assertEquals(await apiState(url, 20), 'timeout');
// headers at once, the body after the wait
assertEquals(await apiState(url, 20), 'timeout');
```

The request the server saw carries
`Accept: application/json` and neither `Operation-ID` nor
`Authorization`.

`tests/http-server.test.ts`, rewritten covenants:

- `:587`: with the real handler, 200 and
  `{ 'git-sha', up: true, components: { api: 'up' } }`.
  With a stub `handle`, the stub is called exactly once,
  for `GET /status` with `Accept: application/json`.
- `:671`: the adapter's probe `'down'` answers 503 and
  `{ api: 'down' }`. The log holds two lines in order,
  `/api/status` 503 then `/status` 503, neither with an
  `operationId`.
- New: a stub `handle` that answers only when the test
  releases it, with `apiStatusWaitMs: 20`, answers 503 and
  `{ api: 'timeout' }`; the test then releases the stub.
- New: the adapter's probe `'timeout'` answers
  `{ api: 'down' }`, because the API answered.
- `:641`, `:934`: an unacceptable sha answers 500 and the
  stub `handle` is never called.
- `:626`, `:856`, `:881`, `:896`, `:913`: `api` for
  `postgres`; pills `API down`, `API timeout`.

- [ ] **Step 2: Run them; they fail**

Expected: FAIL, `server/api-status.ts` does not exist.

- [ ] **Step 3: Implement**

- `apiState`: one `fetch`, no retry. `'up'` is a 200
  whose JSON body's `up` is `true`, read inside the wait.
  `'timeout'` is the wait expiring first, headers or body.
  Everything else is `'down'`. The body is consumed or
  cancelled and the timer cleared on every path.
- `listenHttp`: the URL comes from the port `Deno.serve`
  reports in `onListen`, never from `options.port` (tests
  listen on 0) and never from the request.
- `/status`: the sha is judged first (500, the API not
  asked), then `apiState`, then `{ api }`. It no longer
  calls `adapter.probe()`.

- [ ] **Step 4: Verify and commit**

Run: `./test validate --syntax && ./test && ./test lint`.
Expected: all pass. Commit:
`Ask /api/status for the system's health`.

---

### Task 4: The card

**Files:**
- Modify: `server/status-page.ts:118-218`,
  `web-app/app/styles/components-cards.css`,
  `DESIGN-SYSTEM.md:62-63`
- Test: `tests/status-page.test.ts`,
  `tests/http-server.test.ts:794`, `:896`, `:913`, `:954`,
  a CSS pin through `tests/fixtures/css-declaration.ts`

**Interfaces:**
- Consumes: `ComponentStates<'api'>` (Task 3).
- Produces the card's markup, which Task 7's script and
  tests address:
  ```html
  <section id="status-card"
  class="card status-card max-w-md p-8 text-center"
  data-tone="success">
  <h1 class="font-display text-3xl font-bold mb-6">
  <a class="status-name" href="/">Fusion Angle</a>
  </h1>
  <p class="status-rating text-xl font-semibold mb-6">UP</p>
  <p class="text-muted text-sm">git sha</p>
  <p class="git-sha font-mono text-sm">…</p>
  </section>
  ```
  Down: `data-tone="error"`, rating `DOWN`, and after the
  rating
  `<p class="mb-6 flex flex-wrap justify-center gap-2">`
  holding one `.pill` per component.
- Produces: one card renderer inside
  `server/status-page.ts` that takes the tone, the rating,
  and the pills. Task 7 renders the timeout card with it.

- [ ] **Step 1: Write the failing tests**

`tests/status-page.test.ts`:

```ts
const up = statusPageHtml(sha, { api: 'up' }, {});
assertStringIncludes(up, 'data-tone="success"');
assertStringIncludes(up, '>UP</p>');
assertNotMatch(up, /class="pill"/);
assertStringIncludes(up,
    '<a class="status-name" href="/">Fusion Angle</a>');
const down = statusPageHtml(sha, { api: 'down' }, {});
assertStringIncludes(down, 'data-tone="error"');
assertStringIncludes(down, '>DOWN</p>');
assertStringIncludes(down,
    '<span class="pill" data-tone="error">API down</span>');
const late = statusPageHtml(sha, { api: 'timeout' }, {});
assertStringIncludes(late,
    '<span class="pill" data-tone="error">API timeout'
    + '</span>');
assertStringIncludes(statusUnavailableHtml(),
    '<a href="/">Fusion Angle</a>');
```

The name comes before the rating, the rating before the
pills, the pills before the sha. No page carries `style=`.

A CSS pin: `.status-card[data-tone="success"]` declares
`background: hsl(var(--success-soft))` and
`border-color: hsl(var(--success) / 0.4)`; the `error`
rule declares the same with `--error-soft` and `--error`.

- [ ] **Step 2: Run them; they fail**

Expected: FAIL, the page still holds an `Up` pill.

- [ ] **Step 3: Implement**

- The markup above, through the one card renderer.
- `components-cards.css`: the two tint rules; the rating
  takes `--success-text` or `--error-text` by the card's
  tone; `.status-name` keeps the heading's colour, with no
  underline until hover. `.gauge-card` is untouched.
- `statusUnavailableHtml` gains the bare link only.
- `DESIGN-SYSTEM.md`: the Cards line names
  `.status-card[data-tone]` and says it shares the gauge
  card's recipe.

- [ ] **Step 4: Verify and commit**

Run: `./test validate --syntax && ./test && ./test lint`.
Expected: all pass. Commit:
`Show one tinted verdict on the status card`.

---

### Task 5: The commit subject

**Files:**
- Modify: `shared/system-status.ts`, `server/git-sha.ts`,
  `server/main.ts:14-27`, `server/boot.ts:91-96`,
  `:125`, `:147-158`, `server/develop-main.ts:24-28`,
  `server/http-server.ts:99`, `:667-683`,
  `server/status-page.ts`, `bin/build:52-66`, `:98-105`,
  `bin/develop:68`, `:126`
- Test: `tests/git-sha.test.ts`, `tests/api-status.test.ts`,
  `tests/http-server.test.ts`, `tests/status-page.test.ts`,
  `tests/server-zip-metafile.test.ts:149`,
  `tests/develop-cli.test.ts:592`

**Interfaces:**
- Produces: `RunningCommit` gains
  `readonly subject?: string`; `SystemStatus` gains
  `readonly 'git-subject'?: string`, written between
  `git-sha` and `up`, and absent when the commit has no
  subject.
- Produces, in `server/git-sha.ts`:
  ```ts
  export function parseGitSubject(
      text: string,
  ): string | undefined;
  export function embeddedCommit(
      sha: string,
      subjectBase64: string,
  ): RunningCommit;
  export function envCommit(
      read: (name: string) => string | undefined,
  ): RunningCommit | undefined;
  export async function readWorktreeCommit(): Promise<
      RunningCommit | undefined
  >;
  export async function runningCommitFor(
      given: RunningCommit | undefined,
  ): Promise<RunningCommit | undefined>;
  ```
  `runningCommitFor` replaces `gitShaForStatus`, and
  `readWorktreeCommit` replaces `readWorktreeGitSha`.
- Produces: `dispatch`, `main`, and `boot` take
  `commit?: RunningCommit` where they took
  `gitSha?: string`; `HttpListenOptions.commit` replaces
  `gitSha`. `server/main.ts` re-exports `embeddedCommit`.
- Produces: the env pair `GIT_SHA`, `GIT_SUBJECT`.

- [ ] **Step 1: Write the failing tests**

`tests/git-sha.test.ts`:

```ts
assertEquals(parseGitSubject('Add a thing\n'),
    'Add a thing');
assertEquals(parseGitSubject(''), undefined);
assertEquals(parseGitSubject('  \n'), undefined);
assertEquals(parseGitSubject('one\ntwo'), undefined);
const hard = `<b>"it's" \\ \${x} é`;
assertEquals(
    embeddedCommit(SHA, btoa(String.fromCharCode(
        ...new TextEncoder().encode(hard),
    ))),
    { sha: SHA, subject: hard },
);
assertEquals(embeddedCommit(SHA, ''),
    { sha: SHA, subject: '' });
// runningCommitFor
assertEquals(
    await runningCommitFor({ sha: SHA, subject: 'x' }),
    { sha: SHA, subject: 'x' },
);
assertEquals(
    await runningCommitFor({ sha: SHA, subject: '' }),
    { sha: SHA },
);
assertEquals(
    await runningCommitFor({ sha: 'nope', subject: 'x' }),
    undefined,
);
// envCommit
assertEquals(envCommit(reader({ GIT_SHA: SHA })),
    { sha: SHA });
assertEquals(envCommit(reader({ GIT_SUBJECT: 'x' })),
    undefined);
```

`runningCommitFor(undefined)` in this checkout answers
`HEAD`'s sha and its `git log -1 --format=%s`. When the
env gives a sha and no subject, git is not run.

`tests/api-status.test.ts` and `tests/http-server.test.ts`:
with a subject, both documents carry `'git-subject'`
between `git-sha` and `up`; without one, neither has the
key. The `hard` subject above arrives in both documents
character for character.

`tests/status-page.test.ts`: the subject is a
`<p class="git-subject text-sm">` straight after the sha's
`<p>`, escaped (`<b>` arrives as `&lt;b&gt;`); with no
subject the page has no `git-subject` element.

`tests/server-zip-metafile.test.ts:149`, rewritten:
`bin/build` reads `GIT_SUBJECT` with
`git log -1 --format=%s`, the entry's third argument is
`embeddedCommit('${GIT_SHA}', '${GIT_SUBJECT_BASE64}')`,
and the entry heredoc never names `${GIT_SUBJECT}`.

`tests/develop-cli.test.ts`: `bin/develop` exports
`GIT_SUBJECT="$(git log -1 --format=%s)"` beside
`GIT_SHA`, and `ALLOW_ENV` names `GIT_SUBJECT`.

- [ ] **Step 2: Run them; they fail**

Expected: FAIL, `parseGitSubject` is not exported.

- [ ] **Step 3: Implement**

- An acceptable subject is one non-empty line after
  trimming; anything else is absence. `runningCommitFor`
  judges what it is given the same way: an unacceptable
  sha is no commit, an unacceptable subject is a commit
  without one.
- `readWorktreeCommit`: `envCommit` first; only when the
  env has no sha, one `git log -1 --format=%H%n%s`.
- `embeddedCommit` decodes base64 to UTF-8 and judges
  nothing.
- `bin/build`: `GIT_SUBJECT` from git beside the sha;
  `GIT_SUBJECT_BASE64` is its base64 on one line; the
  entry imports `embeddedCommit` beside `dispatch`. On the
  `RENDER_GIT_COMMIT` path the subject is empty until
  Task 6.
- `bin/develop` and `server/develop-main.ts`: the env
  pair, passed as `envCommit(Deno.env.get)`'s result.
- The page: the subject element through the card renderer.

- [ ] **Step 4: Verify and commit**

Run: `./test validate --syntax && ./test && ./test lint`.
Expected: all pass. Commit:
`Name the running commit by its subject`.

---

### Task 6: git supplies the commit on Render

**Files:**
- Modify: `bin/build-lib`, `bin/build:52-66`,
  `Dockerfile:2`, `ARCHITECTURE.md:84-89`
- Test: new `tests/build-commit.test.ts`,
  `tests/server-zip-metafile.test.ts:149`

**Interfaces:**
- Consumes: `GIT_SHA`, `GIT_SUBJECT` in `bin/build`
  (Task 5).
- Produces, in `bin/build-lib`: `fetched_commit URL SHA`.
  It prints the fetched commit's sha, a newline, its
  subject, and a newline, and returns non-zero printing
  nothing on stdout when the fetch fails or the fetched
  sha is not `SHA`.

- [ ] **Step 1: Write the failing tests**

`tests/build-commit.test.ts` builds a repository in a temp
directory with one empty commit whose subject is
`It's a "test" $HOME \ subject`, sets
`uploadpack.allowFilter` and `uploadpack.allowAnySHA1InWant`
on it, and runs
`sh -c '. ./bin/build-lib && fetched_commit "$1" "$2"'`
with `TMPDIR` set to a second, empty temp directory:

```ts
// file://<repo>, the commit's sha
assertEquals(code, 0);
assertEquals(stdout, sha + '\n' + SUBJECT + '\n');
// the scratch repository is gone
assertEquals([...Deno.readDirSync(scratchTmp)], []);
// a sha the repository does not hold
assertNotEquals(code, 0);
assertEquals(stdout, '');
// a URL that is not a repository
assertNotEquals(code, 0);
assertEquals(stdout, '');
```

`tests/server-zip-metafile.test.ts:149`: the Dockerfile's
builder stage declares `ARG RENDER_GIT_REPO_SLUG` after
`ARG RENDER_GIT_COMMIT` and before `RUN ./bin/build`; the
runtime stage names neither; `bin/build` calls
`fetched_commit` with
`"https://github.com/${RENDER_GIT_REPO_SLUG}.git"` and
`"$RENDER_GIT_COMMIT"`, and no longer assigns `GIT_SHA`
from `RENDER_GIT_COMMIT`.

- [ ] **Step 2: Run them; they fail**

Expected: FAIL, `fetched_commit: command not found`.

- [ ] **Step 3: Implement `fetched_commit`**

```bash
fetched_commit() {
    local url="$1" sha="$2" scratch fetched subject
    scratch=$(mktemp -d \
        "${TMPDIR:-/tmp}/fusion-commit.XXXXXX")
    if ! git init --quiet "$scratch" \
        || ! GIT_TERMINAL_PROMPT=0 git -C "$scratch" \
            -c http.lowSpeedLimit=1000 \
            -c http.lowSpeedTime=30 \
            fetch --quiet --depth 1 --filter=tree:0 \
            "$url" "$sha" >&2; then
        rm -rf "$scratch"
        return 1
    fi
    fetched=$(git -C "$scratch" rev-parse FETCH_HEAD)
    subject=$(git -C "$scratch" log -1 --format=%s \
        FETCH_HEAD)
    rm -rf "$scratch"
    if [ "$fetched" != "$sha" ]; then
        return 1
    fi
    printf '%s\n%s\n' "$fetched" "$subject"
}
```

The scratch repository sits under `TMPDIR`, outside the
source tree. `--filter=tree:0` fetches the commit object
alone. If git refuses the filter against a bare URL, stop
and report; do not drop it silently.

- [ ] **Step 4: Use it in `bin/build`**

A checkout reads `HEAD`, as today. With no repository,
`RENDER_GIT_COMMIT` (40 lowercase hex) and
`RENDER_GIT_REPO_SLUG` (non-empty) name what to fetch, and
both values come from `fetched_commit`'s two lines. A
failed fetch, or either variable missing, fails the build
with one message naming what was missing. `Dockerfile`
declares `ARG RENDER_GIT_REPO_SLUG`.

- [ ] **Step 5: Prove the fetch against GitHub**

In the worktree, `SHA=$(git rev-parse origin/master)`.
Then, from a directory outside any repository:
`sh -c '. <worktree>/bin/build-lib && fetched_commit
https://github.com/tmornini/fusion-angle.git "$1"' sh
"$SHA"`. Expected: that sha, then the subject
`git log -1 --format=%s origin/master` prints. If the
network is refused, report that this step did not run.

- [ ] **Step 6: Update ARCHITECTURE.md**

`:84-89`: the builder stage declares both `ARG`s, fetches
the one commit from the public GitHub repository with no
credential, and still sees no secret.

- [ ] **Step 7: Verify and commit**

Run: `./test validate --syntax && ./test && ./test lint`.
Expected: all pass. Commit:
`Fetch the commit from GitHub in the Render build`.

---

### Task 7: The refresh

**Files:**
- Create: `web-app/app/status-backoff.ts`,
  `web-app/app/status-refresh.ts`,
  `tests/status-backoff.test.ts`,
  `tests/browser/status-refresh.test.ts`
- Modify: `bin/build-lib:59-66`,
  `server/status-page.ts:15-32`, `:81-172`
- Test: `tests/status-page.test.ts`,
  `tests/http-server.test.ts:794`, `:954`

**Interfaces:**
- Consumes: the card's markup and renderer (Task 4), the
  subject (Task 5).
- Produces, in `web-app/app/status-backoff.ts`:
  ```ts
  export const STATUS_PAGE_WAIT_MS = 1_500;
  export function refreshWaitMs(
      sinceChangeMs: number,
  ): number;
  ```
- Produces: `StatusAssets.script?: string`, from the
  manifest key `status-refresh.js`, accepted only when it
  matches `/^status-refresh\.[0-9a-f]{8,}\.js$/`.
- Produces the page's refresh markup, only when
  `assets.script` is defined:
  `<script src="/assets/status-refresh.<hash>.js" defer>`
  `</script>` in `<head>`; the card inside
  `<div id="status-live" aria-live="polite">`; and
  `<template id="status-timeout">` holding the timeout
  card.

- [ ] **Step 1: Write the failing tests**

`tests/status-backoff.test.ts`:

```ts
assertEquals(refreshWaitMs(0), 1_000);
assertEquals(refreshWaitMs(59_999), 1_000);
assertEquals(refreshWaitMs(60_000), 10_000);
assertEquals(refreshWaitMs(599_999), 10_000);
assertEquals(refreshWaitMs(600_000), 60_000);
assertEquals(refreshWaitMs(3_599_999), 60_000);
assertEquals(refreshWaitMs(3_600_000), 600_000);
assertEquals(refreshWaitMs(86_400_000), 600_000);
```

`tests/status-page.test.ts`: with a published script name
the page has the `<script src defer>` with an empty body,
the live region, and a template whose card is
`data-tone="error"`, rating `DOWN`, one pill
`<span class="pill" data-tone="error">Timeout</span>`, and
the page's own sha and subject. With no script name the
page has none of the three. `statusAssets` answers
`script` only for a published name. The unavailable page
has no script.

`tests/browser/status-refresh.test.ts`, in the shape of
`tests/browser/landing.test.ts:10-38`, each on
`origin.baseUrl + '/status'`:

- The card changes without a reload. Set
  `window.kept = true`; shadow `origin.db.probe` to answer
  `'down'`; `page.until` the card's `data-tone` is
  `error` and its text holds `API down`; `window.kept` is
  still `true`. Restore the probe; the card returns to
  `success`.
- An unchanged status leaves the element in place. Put a
  JS property on `#status-card` (not an attribute);
  `stays` it for 3 s.
- No answer shows the timeout card. With requests to
  `/status` failed through `withHeldRequests`, the card
  becomes `DOWN` with the pill `Timeout`; released, it
  returns to `UP`.
- Requests never overlap. With `/status` held for 3 s,
  count requests to `/status` in flight; the count never
  exceeds 1.
- The timeout card follows the server. Replace the page's
  `#status-timeout` content from the test with other
  markup; after the next answer it again equals the
  markup the server sends.

- [ ] **Step 2: Run them; they fail**

Run: `./test` and `./test browser`. Expected: FAIL,
`web-app/app/status-backoff.ts` does not exist.

- [ ] **Step 3: Implement the ladder and the page**

- `refreshWaitMs`: the Global Constraints ladder, every
  bound and wait a named constant.
- `bin/build-lib`: a third `deno bundle --format iife`
  block, as `root-redirect.ts` has, writing
  `status-refresh.js`.
- `server/status-page.ts`: the three pieces above. The
  timeout card comes from Task 4's card renderer; no card
  markup is written twice.

- [ ] **Step 4: Implement the script**

`web-app/app/status-refresh.ts` holds no markup. It keeps
the markup it last showed as a string, and the time of its
last change.

1. Wait `refreshWaitMs(now - lastChange)`.
2. Fetch `location.href` with `Accept: text/html` and
   `cache: 'no-store'`, aborted after
   `STATUS_PAGE_WAIT_MS`.
3. The next card is the answer's `#status-card`, whatever
   the status code. A failed or aborted request, or an
   answer with no card, makes it the timeout template's
   card.
4. When an answer carries a `#status-timeout` whose
   markup differs from the page's, the page's template
   takes it.
5. When the next card's markup differs from the string
   kept, the card inside `#status-live` is replaced, the
   string kept is that markup, and the last change is now.
   Otherwise nothing in the document is touched.
6. Only then schedule step 1 again.

No `Deno.*`, no `process`, no inline script.

- [ ] **Step 5: Verify and commit**

Run: `./test validate --syntax && ./test && ./test lint
&& ./test browser`. Expected: all pass. Commit:
`Refresh the status page when its card changes`.

---

### Task 8: Re-point the documents

**Files:**
- Modify: `TODO.md:345-362`, `:611`, `:622`, `:628`,
  `:631-632`, `:1106`, `:1387`, `:1453`, `:1520-1523`,
  `:3217`, `:3249-3254`, `:3742-3743`

- [ ] **Step 1: Re-point every line citation**

Each `server/http-server.ts:NNN` and `api/api.ts:NNN` in
`TODO.md` names the code it describes. For each, find
that code on this branch and write its current line.
Where the sentence itself is no longer true (`/status`
reaching Postgres directly, the sha arriving from
`RENDER_GIT_COMMIT` alone, a 405 carrying no `Allow` on
the status route), correct the sentence. Change nothing
else.

- [ ] **Step 2: Check the other root documents**

`grep -n "postgresProbe\|postgres-probe\|gitSha\|POSTGRES
UP\|RENDER_GIT_COMMIT" *.md`. Every hit states what the
branch now does, or is corrected.

- [ ] **Step 3: Verify and commit**

Run: `./test lint`. Expected: pass. Commit:
`Re-point the documents at the status code`.

---

## After the last task

The master session, not a subagent:

1. Squash the branch to one design commit, one plan
   commit, and one feature commit.
2. `./test validate` (Layer 1).
3. `./test postgres`, reporting the cold and warm probe
   against the Timeouts table.
4. `./test validate browser` (Layer 2).
5. By eye under `./bin/develop`: the up card, then the
   down card with Postgres stopped, without reloading.
6. Report the branch name. The operator's next
   `./deploy --render` proves the Render fetch.
