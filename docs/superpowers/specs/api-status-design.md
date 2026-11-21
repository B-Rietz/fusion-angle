# System status through the API

Branch and worktree `api-status`. Line numbers below are
master at `9812d9f60`.

## Intent

`/status` should say one thing first: is the system up.
Today it shows two pills, "UP" and "POSTGRES UP", with
nothing saying the first is the verdict on the whole, and
it reaches into Postgres itself to earn them.

The API will become a separate service. The site will
then be unable to probe the API's database, and should
not want to: the API answers for its own dependencies.
The operator wants that shape built now, from past
learnings, rather than retrofitted at the split. So the
site learns the system's health the way it will after the
split, by asking the API over HTTP, and the API answers
for Postgres.

The page also names the running commit in words, not
only by its sha. And a status page left open keeps
itself current: it refreshes by itself, and changes only
when what it reports has changed.

## Goals

- The `/status` card gives one rating for the whole
  system, "UP" or "DOWN", and is tinted green or red to
  match.
- Up, the card lists no components. Down, it lists them.
- "Fusion Angle" on the card links to `/`.
- `/status` has one component, `api`. It is up when a
  real HTTP request to the server's own `/api/status`
  answers up.
- Each component is `up`, `down`, or `timeout`. A
  timeout is a kind of down: the system is up only when
  every component is up.
- `/api/status` is a real API route. It answers JSON of
  the same structure as `/status`: `git-sha`, the commit
  subject, an overall rating, and one component,
  `postgres`. It really tests Postgres connectivity.
- The first line of the running commit's message shows
  under the sha on the page, and rides both JSON
  documents, in every environment.
- git supplies the sha and the subject together, in
  every environment, Render included.
- The page refreshes itself, once a second at first and
  less often the longer it stays open, and changes only
  when its details change.
- Neither server-side wait expires on a system that is
  up. The page's own wait can: it cannot tell a dropped
  network from a silent server.

## Non-goals

- Splitting the API into its own service, or a
  configurable API address. The address is one function
  of the listener's port; the split changes that
  function.
- An HTML representation of `/api/status`. It answers
  JSON only.
- A verb for `/api/status` in `client/`. No page calls
  it.
- Any change to `/status`'s content negotiation, its
  `Vary`, or the compose healthcheck, which reads only
  200 or not.
- Pushing status to the page (SSE, a WebSocket). The
  operator asked for a timed refresh, and nothing in
  the product pushes.
- Caching the probe's answer. Each refresh costs one
  probe. The refresh backs off instead, and nothing has
  measured what remains as a
  problem.

## Anti-goals

- `/status` calling the API in process, or keeping the
  Postgres probe under a new name. The request crosses
  HTTP or the unit has failed.
- `/api/status` answering up without a statement having
  run on Postgres, where Postgres is the backend.
- An address for that request derived from anything the
  incoming request carries (its `Host`, a forwarded
  line, a query string).
- A subject shown beside a sha it does not belong to.
  Absent beats stale.
- A status request that needs a bearer token or an
  `Operation-ID`, stores a message pair, counts toward
  the auth throttle, or reads the database before its
  probe. With Postgres down the answer is 503, never
  500.
- A probe error reaching the wire or the log. It can
  carry a server message.
- A page that still reads UP when its refresh got no
  answer.
- An expired wait reported as a plain `down`, or any
  other failure reported as `timeout`.
- The card's markup written twice, once on the server
  and once in the script.
- Refresh requests that overlap.

## Approaches

**Where `/api/status` is answered.**

- *At the server's edge.* `server/http-server.ts` answers
  it ahead of the API, with the probe it already holds.
  Small, and the probe keeps its properties for free.
  But the route is absent from the route table and the
  generated documentation, and "API up" proves the
  listener and Postgres, not the API's own dispatch.
- *A real API route.* A row in `api/routes.ts`, exempt
  from the bearer gate and from `Operation-ID`, with the
  probe behind `DbAdapter`. Documented by generation, and
  it proves the API's dispatch runs. It is the first
  exception to "every API request carries
  `Operation-ID`", and it widens the backend interface.
- *In process.* Dropped: the operator wants a real
  request.

The operator chose the real API route, and added that it
must really test Postgres connectivity.

**How the commit subject travels.**

Render deletes `.git` from the Docker build and supplies
`RENDER_GIT_COMMIT` alone. It has no variable for the
commit message.

- *The deploy carries it.* `./deploy --render` stores the
  subject on the Render service and the build embeds it.
  The subject shows on Render, but the two values arrive
  there by different routes, and the subject's is the
  weaker: our script sets it, not Render, so it can go
  stale.
- *git where a checkout exists.* git supplies both in a
  checkout build and in develop. Render shows the sha
  and no subject.
- *git everywhere.* The repository is public, so the
  Render build fetches the one commit
  `RENDER_GIT_COMMIT` names from GitHub, with no
  credential, and reads both values from it as a
  checkout does. It costs the Render build one more
  request to GitHub, and it depends on the repository
  staying public.

The operator needs the page the same everywhere and both
values travelling the same way, and chose git
everywhere.

**The tint.** The palette is dark only. Three were
mocked: the `-soft` surface tokens, an 18% wash of the
status colour over the card, and the palest status
colours with dark text. The operator chose the `-soft`
tokens, and "UP" / "DOWN" as the rating's words.

**How the page refreshes.**

- *A meta refresh.* One line of HTML and no script. The
  whole page reloads each second whether or not
  anything changed. Once a reload fails, the browser
  shows its own error page and stops refreshing, so the
  page never comes back by itself after an outage.
- *A script.* The page's first. It fetches the page
  again on a timer and replaces the card only when its
  markup differs. It keeps trying through an outage,
  says that it timed out, and can slow its timer down.

The operator's ideal is a page that changes only when
its details change, and the operator wants the refresh
to back off. Only the script does either, and the
author chose it.

## What exists today

- `server/http-server.ts:662-698` answers `GET /status`
  ahead of the API and the auth throttle. It reads the
  sha (`gitShaForStatus`), then `postgresUp`
  (`:407-420`), then answers JSON (`statusDocument`,
  `:341-366`) or HTML (`statusHtml`, `:385-405`). JSON
  is `{ "git-sha", "up", "components": { "postgres" } }`.
  200 when up, 503 when not, 500 when the sha is
  unacceptable.
- `server/status-page.ts` holds the page:
  `StatusComponents` (`:19-21`), `statusPageHtml`
  (`:118-172`), `statusUnavailableHtml` (`:174-198`).
  The status page links only the global stylesheet and
  the icon, by their hashed names (`statusAssets`,
  `:81-116`). The unavailable page links neither.
- `server/postgres-probe.ts` is the probe: `SELECT 1` in
  a read-only transaction whose `statement_timeout` is
  1 s. `server/boot.ts:126` hands it to the listener as
  `postgresProbe`.
- Everything under `/api/` goes to `handleRequest`
  (`api/api.ts:480`). `dispatched` (`:489`) refuses a
  request with no `Operation-ID` (`:508-524`) before it
  matches a route, and authenticates every route outside
  `AUTHENTICATION_ROUTES` (`api/request-auth.ts:43`).
  API.md `## Dispatch order` states that order.
- Every GET in the route table selects stored heads
  (`api/api.ts:1042-1065`). None computes its answer.
- The two sign-in rows offer their verb in the table
  only so the generator advertises it
  (`authGrantOffered`, `api/routes.ts:4142-4147`), and
  the gate intercepts them. That is the precedent for a
  row whose handler never runs. It is not one for
  answering ahead of `Operation-ID`: the interception
  sits in the POST arm (`api/api.ts:1306-1414`), after
  that check.
- `AUTHENTICATION_ROUTES` is more than the bearer
  exemption. It also decides the `Authorization` and
  proxy-header states (`api/request-headers.ts:102`,
  `:128`), and it must agree with the throttled paths
  (`server/throttle.ts:12-18`), which
  `tests/request-headers.test.ts:28-37` pins.
- `api/request-headers.ts` declares each request header's
  state per request kind. `operationId` is `required`
  everywhere (`:145-149`).
  `tests/request-header-states.test.ts` holds every
  state to the gate's answers.
- The sha reaches the server three ways. `bin/build`
  reads `git rev-parse HEAD`, falls back to
  `RENDER_GIT_COMMIT`, and writes the value into the
  generated entry (`:55-110`), which passes it down
  `dispatch` → `serve` → `boot` → `listenHttp`.
  `bin/develop:126` exports `GIT_SHA`, `:68` lets the
  server read it, and `server/develop-main.ts:27` passes
  it to `dispatch`. `server/git-sha.ts` reads the env,
  then git, only for a caller that passes no sha. Today
  that is the tests.
- The Render builder stage installs git and declares
  `ARG RENDER_GIT_COMMIT` (`Dockerfile:2-6`). The
  repository is public: an anonymous
  `git fetch --depth 1
  https://github.com/tmornini/fusion-angle.git <sha>`
  answers the commit, and `git log -1 --format=%s
  FETCH_HEAD` its subject. Checked on 2026-11-20 against
  `origin/master`.
- The design system tints by `data-tone`. A pill takes
  the tone's `-soft` and `-text` and a 0.3-alpha border
  (`web-app/app/styles/components-badges.css:147-161`).
  The dashboard's gauge cards are the one tinted card
  today: `.gauge-card[data-tone]` takes `-soft` and a
  0.4-alpha border of the tone, for `primary`,
  `success`, and `warning`
  (`components-metrics.css:7-25`). Its comment says why
  0.4. No card is tinted `error`. The tokens are
  `palette.css:52-72`.

## Design

### Component states

A component is in one of three states, at both routes:

- `up`: it answered, and said up.
- `timeout`: the wait set for it expired with no answer.
- `down`: any other failure.

`timeout` is a kind of down. The system's `up` is true
only when every component is `up`. `down` and `timeout`
both make it false, and both answer 503. The JSON
documents carry the state as that word, a string where
today's `postgres` is a boolean.

Each state is reported by the hop that waited. So a
component is never `timeout` on another hop's word: an
API that answers 503 is `down` at `/status`, whatever
state its own `postgres` is in, because it answered.

The operator asked for the third state, so that a down
card names its component and says when a timeout is the
likely cause.

### `/api/status`

`GET /api/status` answers:

```
200  { "git-sha": "…", "git-subject": "…", "up": true,
       "components": { "postgres": "up" } }
503  { "git-sha": "…", "git-subject": "…", "up": false,
       "components": { "postgres": "down" } }
503  { "git-sha": "…", "git-subject": "…", "up": false,
       "components": { "postgres": "timeout" } }
500  { "error": "git sha unavailable" }
```

The answer carries `Request-ID`
like every API answer, and the edge's `no-store`. A
commit with no acceptable subject has no `git-subject`
key.

`git-sha` and `git-subject` are the ones `/status`
reports. The listener hands the API both when it builds
the API's handler, as boot hands it the adapter. One
process reports one commit at both routes. After the
split each service is handed its own.

`handleRequest(adapter, request)` is untouched. It is
the API handed no sha, and its `/api/status` answers the
500 without running the probe, as `/status` does today
for an unacceptable sha. Tests that want a status answer
build the handler with a sha.

The route is a row in the route table, so the generated
documentation lists it. The gate answers it itself, as
it does the sign-in rows.

It sits in the dispatch order after framing and the
carried-`Request-ID` refusal, and before `Operation-ID`.
So a status request needs neither `Operation-ID` nor a
bearer token, and reads neither. A carried `Request-ID`
is still 400. Any verb but GET answers 405.

The bearer exemption is its own named fact. The status
route does not join `AUTHENTICATION_ROUTES`: it is not
throttled and reads no proxy line. The declared header
states say `unused` for `Operation-ID` and
`Authorization` on this route, and the proving test
agrees.

The route discloses the commit, one boolean, and one
component state to an anonymous caller. `/status` already discloses the
commit.

### The probe

The probe moves behind the adapter. `StorageBackend`
gains one read-only reachability probe, which answers a
component state, and `DbAdapter` exposes it.

- Postgres: today's probe, moved, with a shorter budget.
  `SELECT 1` in a read-only transaction whose
  `statement_timeout` is 100 ms, down from 1 s (see
  Timeouts). One row is `up`. A statement cancelled by
  that timeout, or a connection not opened in time, is
  `timeout`. Any other throw is `down`. The state is all
  that leaves: the error is neither logged nor echoed.
- Memory: `up`. It has no connection to lose.

`server/postgres-probe.ts`, the `postgresProbe` listen
option, and `postgresUp` retire.

The component is named `postgres` under either backend.
The memory backend serves tests and the in-page facade
only.

A probe against an unreachable Postgres can still wait
out the pool's 5 s acquire timeout before it answers
`timeout`. That wait is today's, unchanged. `/status`
has answered `api` `timeout` long before.

### `/status`

`components` becomes `{ "api": <state> }`, and the
document gains `git-subject`. Statuses and headers are
unchanged.

```
200  { "git-sha": "…", "git-subject": "…", "up": true,
       "components": { "api": "up" } }
503  { "git-sha": "…", "git-subject": "…", "up": false,
       "components": { "api": "down" } }
503  { "git-sha": "…", "git-subject": "…", "up": false,
       "components": { "api": "timeout" } }
```

`/status` asks `GET
http://127.0.0.1:<the listener's bound port>/api/status`
for JSON, and waits 500 ms (see Timeouts).

- `up`: a 200 whose body's `up` is `true`, inside the
  wait.
- `timeout`: no complete answer inside the wait.
- `down`: a refused connection, any other status, or a
  body that does not parse.

There is no retry. The response body is always consumed
or cancelled.

The sha is still judged first. An unacceptable sha
answers 500 and the API is not asked.

Each `/status` now writes two request-log lines, its own
and `/api/status`'s. The second has no `operationId`.

### The page

```
+------------------------------+  +------------------------------+
|         Fusion Angle         |  |         Fusion Angle         |
|              UP              |  |             DOWN             |
|                              |  |          [API DOWN]          |
|           git sha            |  |           git sha            |
|           9812d9f            |  |           9812d9f            |
|  Carry the organization in   |  |  Carry the organization in   |
|          page URLs           |  |          page URLs           |
+------------------------------+  +------------------------------+
   --success-soft, green             --error-soft, red

+------------------------------+  +------------------------------+
|         Fusion Angle         |  |         Fusion Angle         |
|             DOWN             |  |             DOWN             |
|        [API TIMEOUT]         |  |          [TIMEOUT]           |
|           git sha            |  |           git sha            |
|           9812d9f            |  |           9812d9f            |
|  Carry the organization in   |  |  Carry the organization in   |
|          page URLs           |  |          page URLs           |
+------------------------------+  +------------------------------+
   the API gave /status no           /status gave the page no
   answer; --error-soft, red         answer; --error-soft, red
```

- **The name.** The heading holds a link to `/`. It
  keeps the heading's look and underlines on hover. The
  unavailable page (500) gets the same link as markup
  only: it links no stylesheet.
- **The rating.** One line under the name: `UP` or
  `DOWN`. Text, not a pill, at `text-xl` semibold, in
  the tone's text colour.
- **The tint.** Up, the card's background is
  `--success-soft` and its border a 0.4-alpha
  `--success`. Down, `--error-soft` and a 0.4-alpha
  `--error`. That is the gauge card's recipe, so the
  product's tinted cards look alike. The status card
  gets a rule of its own, keyed on `data-tone`, in the
  global stylesheet, since that is the only one the
  page links. `.gauge-card` is untouched: two tinted
  cards are not yet a pattern to share.
- **The components.** Absent from the markup when up.
  Down, each component is a pill with its state:
  `API down` or `API timeout`, as `Postgres down` is
  today. An `up` pill takes the success tone. `down` and
  `timeout` both take the error tone.
- **The commit.** The `git sha` label and the sha, as
  today. Under the sha, the commit subject as plain
  text, wrapping. No subject, no element.

The mock the operator chose from is option A of
`.superpowers/brainstorm/29926-1795211731/content/`
`status-card-tint.html` in the main checkout
(gitignored, this machine only).

### Timeouts

A timeout must never fire before the hop under it could
have answered. So each is the one below it plus an
allowance, from Postgres outward.

| Wait | Value | Covers | Expired, it reports |
|---|---|---|---|
| A probe statement | 100 ms | A healthy `SELECT 1` takes single-digit ms. | `postgres` `timeout` |
| `/status` for `/api/status` | 500 ms | The probe, the loopback request, and opening a Postgres connection when the pool has none. | `api` `timeout` |
| The page for `/status` | 1 500 ms | `/status`'s own 500 ms, plus a second for the viewer's network. | The timeout card |

The operator asked for 200 ms, and for the timeouts to
be set as needed to avoid a false DOWN, and then
accepted these three. 200 ms cannot be shown safe at the
two outer waits. The pool recycles
each connection every 30 to 60 minutes (the driver's
default lifetime), so a probe sometimes opens a new
connection (TCP, TLS, SCRAM), and a viewer's network
round trip alone can pass 200 ms.

These three are estimates, each a named constant beside
the code it bounds. The plan measures a warm and a cold
probe under `./test postgres`. On Render, the request
log's `latencyMs` for `/api/status` gives the real
figures, and the constants are tuned from those.

### Refresh

The page loads one small script. It fetches the page's
own URL as HTML and compares the card it got with the
card on screen.

- Same markup: it touches nothing.
- Different markup: it replaces the card.
- No answer inside the page's wait, or a failed request:
  one error, a timeout. It shows the timeout card.

The next request is scheduled only once the last has
settled, so none overlap. The wait before it grows with
the time since the page last changed:

| Since the last change | Wait |
|---|---|
| under 1 minute | 1 s |
| 1 to 10 minutes | 10 s |
| 10 minutes to 1 hour | 60 s |
| over 1 hour | 10 minutes |

The operator capped the wait at 10 minutes. A page left
open, however long, shows an outage within 10 minutes.

Any change of card starts the clock again at 1 s, the
timeout card included. So a page that sees DOWN watches
closely for the recovery.

The server renders every card. The page carries its own
timeout card in a `<template>`: red, `DOWN`, and one
pill, `Timeout`, with the page's own sha and subject.
That pill names no component, because none answered:
what went silent is `/status` itself, or the viewer's
network. The script holds no markup.

The card is an `aria-live="polite"` region, so a change
is announced.

The script is a standalone bundle with a hashed name,
built as `root-redirect.js` is (`bin/build-lib:59-66`)
and named in the asset manifest. The page's CSP allows
it: `script-src 'self'`. A page whose manifest names no
script is static, as the status page is today. The
unavailable page stays static.

Each refresh is one request to `/status`, one to
`/api/status`, one probe, and two request-log lines.

### The commit subject

git is the one reader of both values, in every
environment. The subject is `git log -1 --format=%s`,
read from the same commit as the sha, at each place the
sha is read:

- `bin/build` writes it into the generated entry beside
  the sha. It rides `dispatch` → `serve` → `boot` →
  `listenHttp` as the sha does.
- `bin/develop` exports it beside `GIT_SHA` and lets
  the server read it, and `server/develop-main.ts`
  passes both to `dispatch`.
- `server/git-sha.ts` reads both for a caller that gives
  neither: the env, then git.

The two travel as a pair. A sha never reaches the server
without the subject read from the same commit.

In a checkout the commit is `HEAD`, and nothing leaves
the machine: an unpushed commit exists nowhere else.

On Render the build has no repository. It fetches the
one commit `RENDER_GIT_COMMIT` names from
`https://github.com/<RENDER_GIT_REPO_SLUG>.git`, with no
credential, and reads the sha and the subject from that
commit. `RENDER_GIT_COMMIT` now only says which commit
to fetch. The builder stage declares
`ARG RENDER_GIT_REPO_SLUG` beside `ARG
RENDER_GIT_COMMIT`.

- The fetch goes into a scratch repository outside the
  source tree, so the clean-tree gate still finds no
  `.git` there.
- It fetches no more than the subject needs, and it is
  bounded in time.
- The fetched commit's sha must equal
  `RENDER_GIT_COMMIT`, or the build fails.
- A failed fetch fails the build, as a missing sha does
  today. Render then keeps the previous deploy. A
  repository gone private fails here, loudly, until the
  build is given a credential.

That `RENDER_GIT_REPO_SLUG` reaches the Docker build as
an argument rests on Render's documentation, which lists
it beside `RENDER_GIT_COMMIT`. The first Render deploy
proves it.

A subject is only ever read from the commit its sha came
from. When the env supplies the sha and no subject, git
is not asked for one.

A subject is arbitrary text. The generated entry carries
it as encoded data, never as text spliced into source: a
quote, a backslash, or `${` in a commit message must not
change the program. The page escapes it, and the JSON
documents carry it as a JSON string.

An acceptable subject is one non-empty line. Anything
else is absence.

`/status` is public, so the running commit's subject is
public, in production too. The repository is public and
the page already shows the sha, so the subject was
already one lookup away.

## Constraints

- `handleRequest(adapter, request)` keeps its signature.
  It is called at 2 161 sites.
- `api/` imports nothing from `server/` and uses no
  `Deno.*`: it also runs in the page. So the API is
  handed its sha and never reads it, and the probe
  travels on the adapter.
- The sha and the subject reach the API through the
  handler the listener builds, not through a
  module-level setter.
- The script is browser code: no `Deno.*`, no `process`,
  and no inline `<script>`, which the CSP refuses.
- A transaction body awaits only row ops. The probe's
  body is its two statements.
- No inline style. `tests/http-server.test.ts:791` and
  DESIGN-SYSTEM.md hold that; the page's CSP permits
  `style=` attributes.
- Follow the RFCs: 503 for a failed dependency, 405 for
  an unoffered verb.
- Tests run under the op and resource sanitizers, so the
  request to `/api/status` releases its body and its
  timer on every path.
- The tests that pin the old page and the old
  `components` are rewritten to the new covenant. The
  covenant changed; no assertion is weakened to pass.
- `generate-api-documentation --check` and
  `generate-schema-svg --check` stay green. The first
  needs a regeneration.

## Left to the builder

- Every name: the probe's method, the exemption, the
  subject's env variable and parameter, the card's tone
  class, the script.
- How the script tells one card's markup from another.
- How each hop tells an expired wait from another
  failure.
- Where in `dispatched` the status answer sits, given the
  order above.
- The shape and name of the seam that hands the API its
  sha.
- How the declared header states derive `unused` for the
  status route.
- How the generator documents a GET that selects no
  heads and can answer 503.
- Any pin over the route table that the new row trips.
- How the generated entry encodes the subject.
- Where the Render fetch sits (`bin/build` or the
  Dockerfile), how it is kept small, and how it is
  bounded.
- Which documents change: API.md's dispatch order and
  bearer-exempt set at least, DESIGN-SYSTEM.md for the
  card tone, ARCHITECTURE.md where it says what the
  builder stage sees, and TODO.md where it cites this
  code by line.

## Verification

- `./test validate` (Layer 1) after the squash.
- `./test postgres`: the Postgres backend's probe
  answers `up` against a real Postgres.
- A test reaches each of the three states at the hop
  that reports it.
- `./test validate browser` (Layer 2), with a browser
  test of the refresh: the card changes without a reload
  when the status does, an unchanged status leaves the
  card's element in place, no answer shows the timeout
  card, and the wait follows the table.
- A warm and a cold probe timed under `./test postgres`,
  against the Timeouts table.
- By eye, under `./bin/develop`: the up card, then the
  down card with Postgres stopped, without reloading.
- The operator's next `./deploy --render`: the build
  passes, and the production page shows the sha and its
  subject.

## Sequence

Each step lands green on its own.

1. The probe behind the adapter, answering a state.
   `/status` still calls it, through the adapter, and
   reports `postgres` as that state.
2. `/api/status`.
3. `/status` asks `/api/status`; the `api` component
   replaces `postgres`.
4. The page: link, rating, tint, components.
5. The commit subject, on the page and in both JSON
   documents.
6. The refresh.
