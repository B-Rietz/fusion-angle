# API documentation overhaul

Branch and worktree `api-documentation-overhaul`. Line
numbers below are master at `116c11044`.

## Intent

The reader is a developer integrating with this product by
software. From `/api-documentation/` alone they should be
able to write a working call: know which endpoint, who may
call it, exactly what to send, and what comes back.

Today the page is correct about which endpoints exist and
bare about everything else. It shows no response, no
roles, a hand-kept header list that is wrong in places,
and request bodies typed as placeholders
(`"title": "title"`).

This unit rebuilds what the generator produces and how the
page presents it. Every fact on the page comes from code
and is regenerated when the code changes; nothing is
hand-maintained beside it.

## Prerequisite

`declared-request-headers` lands first. This unit prints
its declarations and keeps no header list of its own.

## What the operator decided

- **Audience:** developers integrating by software.
- **Shape:** a guided start in front of the full
  reference. Both, not one.
- **Samples:** real exchanges, replayed through the gate
  against the mock seed. Each is a `curl` command the
  reader can paste after minor edits (credentials, ids)
  plus the response to expect. Success exchanges only.
- **Whole exchanges.** Everything a sample shows, in the
  `curl` text and on the page, is the whole request and
  the whole response, headers included.
- **Each sample lists** every request header with its
  state (required, optional, and so on) and every status
  code the endpoint can answer.
- **Headers are derived** from the code that consumes
  them (the prerequisite), not measured and not listed
  by hand.
- **Roles:** a visual indicator across endpoints that
  share roles, from the policy tier. Narrowing inside
  handlers is later work, recorded in TODO.md.
- **Generation:** code generates all of it whenever the
  code changes.
- **The seed is made reproducible** by fixing its write
  order (A reproducible seed), so the samples can follow
  it and still be gated byte for byte.
- **Credentials:** the hard rule below.
- **What makes it a pleasure to use:** the operator
  delegated this and accepted all eight items under The
  page.
- **Two units:** this one is the generated page. Running
  samples from the page, and filling a signed-in reader's
  own token into the `curl` text, are the next unit
  (Sequence).

Everything else in this document is the design's call
unless it says the operator approved it.

## The hard rule

**Nothing generated or committed carries a real
credential.** Not an access token, a refresh cookie, an
authorization code, a password, a password hash, a PKCE
verifier, or a signed assertion. Requests and responses
show a named placeholder in each such position.

The other statements in this document are intentions the
builder may trade against cost. This one is not.

- The generator signs with a throwaway key it sets
  itself, unconditionally, before any product code
  loads. It never reads the operator's
  `JWT_HMAC_SIGNING_KEY` or `POSTGRES_URL`.
- A test fails when anything credential-shaped is in the
  generated tree. Its oracle: planting a JWT-shaped
  string, a PHC hash string, or a seeded password into a
  sample turns it red.

## Goals

- Every endpoint the route table offers has a page with
  a replayed sample, or a stated reason it has none.
- Every sample is byte-identical on every run and every
  day, so `--check` can gate it.
- The guided start takes a newcomer from nothing to a
  read and a conditional write, then to the unattended
  path.
- The role tier of every endpoint is visible on the grid
  and switchable.
- The header list and the status list on each page are
  complete, and a test holds the status list to the
  gate.
- The page is quick to search, readable in both themes,
  and usable by keyboard.

## Non-goals

- Running a request from the page, and showing a real
  token there. Next unit.
- Handler-level role narrowing (self only; invitee or
  organization admin). TODO.md.
- A machine-readable OpenAPI file. Body shapes live in
  validator code, not as schemas. TODO.md.
- Error exchanges as samples.
- Any change to what the API does. One exception is
  named under Status codes (422).
- New dependencies. `deno.json` and `deno.lock` stay as
  they are.

## Anti-goals

- A sample that was typed, not replayed.
- A fact on the page that code does not produce.
- Output that differs between two runs, or between two
  days.
- An existing hash link that stops working.
- Colour as the only signal for a role.
- An existing test edited to pass. A test of a retired
  artifact is deleted in the commit that retires it.

## Approaches

Where the samples come from. The operator chose the
first.

1. **Replay through the gate (chosen).** The generator
   seeds an in-memory backend, signs in as a seeded
   person, and sends one real request per endpoint. Only
   this shows what the gate answers. Against a seeded
   server the pasted `curl` returns the response shown,
   apart from the ids and dates that differ on every
   server (Path parameters).
2. **Read the ledger for writes, replay reads.** This
   rested on a mistake, found in review: a seeded row
   stores no request (Writes). As first proposed: the
   seed stores each write as a request and response
   pair. Cheaper, but a stored creation re-run against a
   seeded server answers 412, not the response shown.
   Rejected.
3. **Compose from the seed's builders, run nothing.**
   Cheapest; responses are unwitnessed and the envelope
   and role filtering are re-implemented. Rejected.

A feasibility check ran before this was written
(throwaway, not kept). On the memory backend: the mock
seed loads in 1.7 s with a cheap password hasher; the
two-call sign-in answers 200 and 200 through
`handleRequest`; a read replays in 1 to 2 ms. Two
separate seeds returned the same body for a single
document. They differed in random ids, time stamps, and
the multipart boundary.

Review then tested the design's claims against the code
with throwaway scripts. What it found is folded into the
sections below, each marked as review's finding. One
finding needed the operator: the seed is not
reproducible as it stands (A reproducible seed).

## What exists today

`bin/generate-api-documentation` runs
`web-app/app/generate-api-documentation.ts`, which reads
`routes` from `api/routes.ts` and writes
`web-app/api-documentation/`: `API.svg`, `elevation.ts`
(the same SVG as a string), `rooms.ts` (the catalog), and
146 bare HTML files, one per endpoint and status.
`--check` compares that tree byte for byte and runs in
`./test validate`.

`web-app/api-documentation/index.ts` paints the SVG grid,
and on a hash paints one endpoint or status through
`presenter.ts`. `web-app/app/compose.ts:226` copies the
tree into the site, skipping `.ts`.

Coverage is complete: 89 routes offer 131 route and verb
pairs, the catalog has 131 rooms, and all 15 status
documents have a page. `--check` passes.

Content is not complete. These are this unit's findings
to fix:

- No response body anywhere.
- No roles anywhere.
- `?state=` on three routes is undocumented
  (`api/routes.ts:3784`, `:5280`, `:5285`).
- `headersFor` (`generate-api-documentation.ts:925`)
  lists no `Authorization` on the two sign-in routes,
  though credentials ride it there; omits `Content-Type`
  on QUERY; omits `ETag` on responses; lists no
  forbidden header.
- 429 is answered on the two sign-in paths
  (`server/http-server.ts:714`, `server/throttle.ts:12`)
  and no endpoint lists it.
- 422 has a status page and nothing was found that
  answers it.
- The status lists are wrong in both directions (Status
  codes): 404 where it cannot occur, 400 and 403 absent
  where they can.
- Six codes `shared/http-errors.ts` names have no status
  page: 411, 413, 500, 501, 503, 504.
- A member may read and write their own PII, which the
  policy table alone would not show (Roles).
- `WRITE_EXAMPLES` (`:242`) is 45 hand-typed bodies.
- `successCodes` (`:745`) decides 200 or 201 by
  searching handler source text.

Three facts about the API shape the page, and none is
stated anywhere today:

- **The access token arrives in a response header.** The
  token exchange answers
  `{"expires_in":900,"token_type":"Bearer"}`; the token
  is the `access_token` parameter of
  `authentication-info`
  (`client/authentication.ts:158`).
- **Sign-in is two calls.** Authorize with
  `Authorization: Basic` (username and password) and an
  S256 code challenge, then exchange with
  `Authorization: Basic` (code and verifier)
  (`client/authentication.ts:120`). There is no one-call
  password grant.
- **A collection answers `multipart/mixed`.** Each part
  is `application/http`: one stored response, with its
  own status and headers (`api/head-reads.ts:336`). The
  seeded flows collection is 45 KB.

## Part A: the generator

### Replay

The generator loads the mock seed into a memory backend
(`memoryDbAdapter`, `postMockDataLoad`) and sends
requests to `handleRequest` directly. It imports nothing
from `tests/`. `tests/in-page-facade.ts` shows the small
wrapper a request needs (the `/api` mount stripped, the
body framed with its length); the generator writes its
own.

`postMockDataLoad` takes a password hasher and returns
the seeded sign-ins. The generator passes a cheap hasher
and signs in with what comes back. The cheap hasher
today lives in `tests/mock-seed.ts`; product code does
not import from `tests/`, so where the generator gets
one is the builder's.

### Byte-stable output

Four things vary between runs. Three are pinned inside
the generator's own process, before the product loads.

- **The day.** `api/mock-data/seed-kit.ts:27` anchors
  the seed on the current UTC day, as a module constant
  read at import. The generator fixes the day first
  (`@std/testing`'s `FakeTime` is already a dependency)
  and loads the seed after.
- **The clock.** `nowUtc` (`shared/types.ts:368`) must
  advance: when a millisecond's sequence passes 999 it
  spins until the clock moves (`:383`), and the seed
  reads the clock 1,641 times, so a frozen clock never
  returns. The generator installs a clock that steps by
  a fixed amount on each read, through the existing
  `setClockForTest` (`:343`). Review confirmed this pair
  works.
- **Random ids.** `generateIdentifier`
  (`shared/identifier.ts:81`) draws from
  `crypto.getRandomValues`, and the multipart boundary
  from `crypto.randomUUID` (`api/head-reads.ts:428`).
  The generator replaces both with a seeded source for
  its run. Review confirmed the assignment takes effect.
- **The seed's own order.** See A reproducible seed,
  below.

The builder may pin by another route if these prove
unworkable, but not by rewriting output after the fact
to hide a difference.

### A reproducible seed

Review pinned the day, the clock, and both randomness
sources, and three runs still differed: about 930 of the
2,553 seeded rows got different ids, and
`GET …/work-orders/` differed in part order, `etag`, and
`operation-id`. The cause is in the seed.
`api/mock-data.ts:530` writes the work-order histories
under `Promise.all`, so which history draws an id or a
stamp first follows scheduling.

The operator chose to fix the seed, over having the
generator sort and mask what varies: **the seed writes
those histories one after another, in the traces' own
order.** This is the unit's first commit, alone.

- Its oracle: under the generator's pins, two seeds
  produce identical rows; with `Promise.all` restored
  they do not. The check runs as its own process, for
  the reason given below.
- A real seed is unchanged apart from the order of
  those writes. `tests/fixtures/work-order-histories.json`
  and its oracle test pass untouched.
- The builder measures the memory seed before and after
  (1.7 s today) and reports both.
- If two pinned seeds still differ after this, each
  further cause is fixed the same way, in a commit of
  its own. One that is not a matter of write order
  comes back as a finding.

Nothing inside `./test` can pin first: `test:53`
preloads `tests/hmac-test-key.ts`, which imports
`tests/mock-seed.ts`, which imports `api/mock-data.ts`,
so the seed's day is already fixed on the real one. A
Layer 1 test that needs a generation runs the generator
as its own process, as `--check` already does. Tests
over the committed tree need none.

### Who calls

Each sample is sent by the least-privileged seeded
person the policy admits, in Stark Industries
(`STARK_ORGANIZATION`): a member where a member may
call, the organization admin where only that role may,
and no bearer on the two sign-in routes. Responses are
filtered by role, so this shows what the widest audience
receives.

On `identities/:id/…` routes the path names the caller's
own identity. Several of those narrow to self.

Each sample names its caller's role on the page. The
guided start's steps 1 to 5 are replayed as a member;
step 6 registers a key, which only an organization admin
may do, is replayed as one, and says so. The reader's
`$TOKEN` is their own: the role chips tell them whether
it may call an endpoint.

### Path parameters

A route's `:name` segments are filled from the seed.

- **The story's documents are named.** The generator
  declares the few seeded documents the samples follow —
  the flow the guided start reads, a project that has
  flows, and so on — by the seed's own exported ids and
  builders. Taking the first item listed does not work:
  the first flow listed has no work orders and no
  records, and the first project has no flows.
- **Every other segment is filled by listing** the
  collection at its prefix as the organization admin,
  under the story's documents where they apply.
- **Where neither can fill a segment**, the endpoint
  has no sample and a reason. Today `services/` and
  `providers/` are empty in the seed, and
  `token-revocations/` and `flows/:id/tags/` have no
  collection route to list.

An id in a sample is the real one from the generator's
run. Not every server shares it: ids derived from the
seed's day differ on a server seeded on another day
(753 score names changed between two days in review),
and version and token ids are random in every seed. So
the page marks every id in a path as the reader's to
replace, and says which endpoint returns theirs — the
collection the generator listed to fill it.

### Writes

A write must not disturb any other sample. Each write
replays against its own copy of the seeded state. How
the copy is made cheaply is the builder's (a snapshot, a
rollback, landing the rehearsed statements on a fresh
backend); re-running the whole seed per write is too
slow at 1.7 s and 45 writes.

- **PUT on an existing document.** The body is the one
  the seed itself wrote that document with, taken from
  `buildMockDataInvocations()`
  (`api/mock-data/seed-message-pairs.ts:1227`), sent
  with the head's current `ETag` as `If-Match`. The
  ledger cannot supply it: a seeded row stores no
  request (`api/ledger-seed.ts:143`). In review these
  bodies answered 200 on 11 of 12 PUT routes; the
  invitation item answered 400 and needs a recipe.
- **A creation** (POST to a collection, or a PUT that
  may create). The body comes from the same builder,
  under a fresh id and the route's create precondition.
- **DELETE.** A seeded document, on its own copy.
- **Operations** (transition, claim, binding, undo,
  conversion, rotation, revocation, and the like). A
  declared recipe each, in the generator, built from
  seeded ids.

`WRITE_EXAMPLES` is deleted.

### Every endpoint, or a reason

The generator holds a short declared list of endpoints
with no sample and why (for example, the seed holds no
document of that kind). Generation fails when an
endpoint has neither a sample nor an entry, and when an
entry names an endpoint that now has a sample. The page
prints the reason where the sample would be.

### Placeholders

Two kinds of value are replaced, and no others. A
credential is replaced everywhere it appears, request
and response (the hard rule). A value the reader must
supply is a shell variable in the `curl` text. Every
other value in a shown request or response is the real
one from the replay.

| Variable | Stands for |
|---|---|
| `$ORIGIN` | the server; the page fills in its own |
| `$TOKEN` | the access token |
| `$OPERATION_ID` | a fresh identifier per request |
| `$ETAG` | the validator from the preceding read |
| `$CODE`, `$VERIFIER`, `$CHALLENGE` | the sign-in's PKCE values |
| `$USERNAME`, `$PASSWORD` | the reader's sign-in |
| `$CLIENT_ASSERTION` | the unattended client's signed assertion |

Credential positions are found by name, from the lists
the product already keeps for storage redaction
(`REQUEST_CREDENTIAL_NAMES` and
`RESPONSE_CREDENTIAL_NAMES`,
`shared/http-message/credentials.ts:10`), plus the body
fields that hold a secret. The builder enumerates those
body fields from the validators and names each in the
generator.

Response headers no reader can predict (`date`,
`request-id`, `etag`) show the replay's real values, as
an example of what comes back.

The `curl` text is produced from the replayed request,
never written beside it.

### Whole exchanges

A sample holds the request as it was sent — its request
line, every header, its body — and the response as it
came back — its status line, every header, its body.
The page shows both in full. No header is dropped from
either side; one whose value is a credential shows its
placeholder.

- The `curl` text sets, with its own `-H`, every header
  the replayed request carried, and carries `-i` so the
  response's headers print when the reader runs it.
- A JSON body is sent with `Content-Type:
  application/json`, because that is true of the body,
  though the gate reads the header only on QUERY.
- The headers `curl` adds by itself (`Host`,
  `User-Agent`, `Accept`, `Content-Length`) are stated
  once, in the guided start.
- A step that takes more than one call (the sign-in; a
  read then a write) shows each call as its own request
  and response.

### Collections

A multipart response is stored as its parts, each with
its own status line and headers. A sample keeps the
first two parts whole and states how many more there
were. That is the only elision in a sample, it is
marked as one, and it never removes a header.

### Roles

The tier comes from the functions the gate itself calls:
`isPermitted` (`api/authorization.ts:197`) for `member`
and `admin`, and `AUTHENTICATION_ROUTES` for the routes
that take no bearer. Today that gives three groups: 95
endpoints open to a member and an organization admin, 34
to an organization admin only, 2 with no bearer.

The gate has one exception, and the generator names it:
on `identities/:id/pii` it calls `authorizeIdentityPii`
in place of the policy (`api/api.ts:674`), so a person
may read and write their own PII though the policy
alone says organization admin only. Those three
endpoints are shown open to a member.

**The tier proving test.** Every endpoint is replayed as
a member and as an organization admin, each on their own
identity's path where the route has one. The test fails
when an endpoint's tier disagrees with who got past
authorization. It is what caught the exception above.

Prose says "organization admin", never bare "admin".

### Headers

Each endpoint lists its `endpoint`-surface declarations
with their states, from the prerequisite's module,
including the forbidden ones. `transport` declarations
are stated once, in the guided start. `site`
declarations are not printed.

Response headers are those of the replayed exchange.

`headersFor` and its helpers are deleted.

### Status codes

The operator approved this shape: the generator's rules
stay the declaration, and a test holds them to the gate.

- Each listed code carries one line saying what causes
  it on this endpoint and what to do, produced by the
  rule that listed it (a stale `ETag`: read again and
  retry).
- 429 joins the two sign-in endpoints.
- 422: the builder confirms nothing answers it. If so,
  its entry in `api/http-status-documents.ts` and its
  page go, in a commit of their own. If something does,
  those endpoints list it.
- The three `?state=` routes document the parameter and
  its values, from each route's `query` judge.
- **Answers any request may get** are stated once, in
  the guided start, not on every endpoint: a request
  the gate refuses before it knows the route (a missing
  or malformed `Operation-ID`, a `Request-ID`, bad
  framing: 400 and 411), an oversized body (413), and a
  fault (500). The builder enumerates them from the gate
  and the server; `shared/http-errors.ts` also names
  501, 503, and 504.
- **Every code the product can answer has a status
  page.** Today `api/http-status-documents.ts` has none
  for 411, 413, 500, 501, 503, or 504. Each one the
  builder finds answerable gains its document there.
- **The proving test holds the lists in both
  directions.** Each generic provocation runs against
  every endpoint through `handleRequest`: no bearer
  (401), another organization's path (403), an unknown
  id (404), a stale `If-Match` (412), no precondition
  (428), a malformed body or query (400), a wrong media
  type on QUERY (415). The code answered must be in the
  endpoint's list or among the answers any request may
  get; and a generic code in an endpoint's list must be
  answered by its provocation. The replayed sample's
  own status must be in the list too.
- **The rules are rewritten until it passes.** Review
  found today's lists wrong both ways. `:806` lists 404
  on every endpoint outside sign-in, but 37 of the 114
  endpoints review could fill have no id to make
  unknown, and 7 sub-collections under an unknown
  parent answer 204. Identity routes answer 403 by role
  and list none.
- A provocation must be otherwise valid. Validators run
  before the precondition, so a stale `If-Match` on an
  invalid body answers 400, not 412.
- Codes that need particular state (409, 410, 405, 429,
  204) are stated by the rules and not provoked; the
  generator says which are which, and the page does
  not.

Replacing the source-text search in `successCodes` is
wanted if the replay makes it unnecessary (the sample's
status is witnessed), and left alone otherwise.

### The guided start

A short declared list of steps in the generator. Each
step is a sentence or two and one replayed exchange,
gated like every other sample.

1. **Sign in.** The two calls, the shell lines that make
   a verifier and its S256 challenge, and the line that
   takes the token out of `authentication-info` into
   `$TOKEN`.
2. **Every request needs an `Operation-ID`.** How to
   mint one in the shell. An identifier is 16 random
   bytes in base64url (`shared/identifier.ts:16`).
3. **Read your organization.** One JSON document.
4. **List its flows.** A collection, and how to read its
   parts.
5. **Change one.** Read it, keep its `ETag`, write it
   back with `If-Match`.
6. **Going unattended.** Register a key on a service
   identity, sign an assertion, exchange it
   (`client_credentials`). The registration and the
   exchange are replayed samples. The assertion is
   `$CLIENT_ASSERTION`, with the claims and the
   algorithm it must carry listed from the code that
   verifies them (`api/client-assertion.ts`). If a
   dependable `openssl` command produces one, print it;
   otherwise stop at the claims.

The transport headers are stated here once.

### What the generator writes

- `rooms.ts`, the catalog the page imports at boot:
  light facts only. Per endpoint: verb, URI, role tier,
  headers with states, status codes with their lines,
  related endpoints, and either its sample's path or its
  no-sample reason. Plus the guided start's steps and
  the status documents.
- One sample file per endpoint (JSON), holding the
  request, the response, and the `curl` text. The page
  fetches it when that endpoint opens. Samples stay out
  of the boot bundle: one collection alone is 45 KB.
- `elevation.ts` and `API.svg`, the grid, now carrying
  role shapes.

The 146 bare HTML files are retired (approved by the
operator). Nothing in the product has used them since
the in-place page arrived. `verbRoomHtml`,
`statusRoomHtml`, and their tests go in the commit that
retires them, and `compose.ts` stops copying them and
starts copying the sample files.

Related endpoints are computed from the route table: an
item's collection, its versions, and the operations
under it.

`KEPT_ROOT_NAMES` (`:51`) names the hand-written files
the generator must not delete. Any new hand-written
module under `web-app/api-documentation/` joins it.

### Run time

The generator runs inside `./test validate`, whose test
suite takes 9.5 s. Target: `--check` in under 10 s on
the operator's machine. The builder measures before and
after and reports both. A missed target is brought back
as a finding, not worked around quietly.

## Part B: the page

The look is delegated to the builder, inside
DESIGN-SYSTEM.md's tokens, with no inline styles. The
operator reviews it in the browser. What follows is the
arrangement and the behaviour.

### Landing

```
API              View as: (•) Everyone ( ) Member ( ) Organization admin
[ Search endpoints, verbs, status codes        / ]
┌ Start here ──────────────────────────────────────────────┐
│ 1 Sign in   2 Operation-ID   3 Read   4 List   5 Change  │
│ curl … /api/authentication/authorize              [Copy] │
│ → 200  authentication-info: code="$CODE"                 │
└──────────────────────────────────────────────────────────┘
                                    GET QRY PUT POST PATCH DEL
organizations
 /api/organizations/:id/flows/       ●   ●   ·   ●    ·    ·
 /api/organizations/:id/invitations/ ◆   ·   ·   ◆    ·    ·
authentication
 /api/authentication/token           ·   ·   ·   ○    ·    ·
● member and organization admin  ◆ organization admin only  ○ no token
```

The grid is today's, with the role tier drawn as shape
and colour together. The legend says that some member
endpoints act only on the caller's own data.

### An endpoint

Two columns on a wide screen; the sample stays in view
while the facts scroll. One column on a narrow one.

```
PUT /api/organizations/:id/flows/:id
[member] [organization admin]
                              │ curl -i -X PUT "$ORIGIN/api/organizations/…" \
Headers                       │   -H "Authorization: Bearer $TOKEN" \
 Authorization     required   │   -H "Operation-ID: $OPERATION_ID" \
 Operation-ID      required   │   -H "If-Match: $ETAG" \
 If-Match          required   │   -H "Content-Type: application/json" \
 If-None-Match     forbidden  │   -d '{ "name": "Lead to Close", … }'
                              │                                  [Copy]
Answers                       │ Request
 200 the flow as stored       │   PUT /api/organizations/…/flows/…
 412 your ETag is stale:      │   authorization: Bearer $TOKEN
     read again and retry     │   operation-id: $OPERATION_ID
 428 send If-Match            │   if-match: "sQ7fWm0cTn2xJp4aLk9ZdA"
                              │   content-type: application/json
Related                       │   { "name": "Lead to Close", … }
 the collection · versions    │ Response
                              │   200
                              │   etag: "v_vjCifPkpf3OYnoygC4gA"
                              │   last-modified: Wed, 01 Jan 2020 …
                              │   request-id: t3iAgcQ2VoNp2gOrSTYb4g
                              │   … every header returned …
                              │   { "name": "Lead to Close", … }
```

### The eight

All accepted by the operator, in this order of value.

1. **Samples that run with minor edits.** The page
   replaces `$ORIGIN` with its own origin. The variables
   the guided start sets carry through every later
   sample. Each id in a path is marked as the reader's
   to replace, with the endpoint that returns theirs.
   One control copies the command.
2. **Example beside explanation.** The two columns
   above.
3. **Finding things fast.** Instant search over verbs,
   URIs, status codes, and header names. `/` focuses
   it; arrow keys and Enter move and open. Every view
   keeps its own link.
4. **Status codes that say why.** The lines from Part A.
5. **The role switch.** Choosing a role dims every
   endpoint that role cannot call, on the grid and in
   search.
6. **One story through the samples.** Part A's path
   parameters.
7. **Related endpoints.** Part A's links.
8. **Reading comfort.** Syntax colouring for JSON and
   `curl` with no library; both themes from the
   product's tokens; long bodies folded with a control
   to open them.

### Hashes

Every existing hash keeps working: `''` is the landing
view, `#get/organizations/id/flows` an endpoint,
`#statuses/412` a status, and an unknown hash the
in-pane miss. The guided start's steps get hashes of
their own. Back behaves as it does today.

### Reach

Keyboard reaches everything a pointer does. Roles are
shape and text as well as colour. Contrast meets the
design system's bar in both themes. Motion respects
`prefers-reduced-motion`. A sample that fails to load
says so in place and offers a retry; the rest of the
page stands.

## Generation and gates

- The generated tree stays committed. `./test validate`
  already fails on drift through `--check`; that is the
  rule that code changes regenerate the docs.
- `./bin/develop`'s Return regenerates before it
  recomposes (the loop at `bin/develop:110`), so the
  running page is current, and says so in its log when
  files changed. A generation that fails never blocks
  the redeploy: mid-branch, a new route with neither
  sample nor reason is routine. Return prints the
  failure, recomposes with the tree as it stands, and
  the gate still fails until it is fixed. AGENTS.md's
  paragraph on Return is updated to match.
- The server gains a media type for `.json`
  (`MIME_BY_EXT`, `server/http-server.ts:62`); without
  one a sample file is served as
  `application/octet-stream`.
- `bin/generate-api-documentation`'s permissions grow
  only as far as the throwaway signing key needs.

## Tests

Layer 1:

- The credential test (The hard rule).
- Two generations produce identical bytes.
- Every endpoint has a sample or a declared reason, and
  no reason is stale.
- The tier proving test.
- Each endpoint's headers equal the declarations'
  states.
- The status proving test.
- The `curl` text of a sample names the method, path,
  every header, and the body of the request that was
  replayed, and carries `-i`.
- A sample's stored request and response hold every
  header the replay sent and received, and the presenter
  paints every one.
- Presenter tests for the endpoint view, the guided
  start, a multipart sample, and a no-sample reason.

Layer 2 (`tests/browser/api-documentation.test.ts`, no
sign-in):

- The landing view shows the guided start, the search,
  and the grid.
- Every catalog hash paints its view, and every existing
  hash still does.
- Opening an endpoint shows its sample with `$ORIGIN`
  replaced.
- Choosing Member dims an organization-admin-only
  endpoint and leaves a member one lit.
- Typing in search narrows to a known endpoint; Enter
  opens it; `/` focuses the box.
- At a narrow width the endpoint view is one column.

TEST-PLAN.md's cases for this page (AT3, A2, B19, the
walk case after C2) are updated to match, and gain a
walk case for the guided start.

`./bin/measure --check` holds the page's budget; the
builder reports `readyMs` before and after.

## Constraints

- AGENTS.md binds: 78-character lines and 4-space indent
  in code, no inline styles, SafeHtml from presenters,
  `erasableSyntaxOnly`, `verbatimModuleSyntax`,
  `noUncheckedIndexedAccess`, one concern per commit,
  never a move and a content change together.
- The page's CSP drops a `<style>` block; the grid's SVG
  already paints by presentation attribute for that
  reason (`generate-api-documentation.ts:1131`).
- The browser never imports `api/`. The catalog and the
  sample files are the only bridge.
- Generated `.ts` passes the 78-column lint.
- Never log a credential, in the generator included.

## Left to the builder

- All names and types, the catalog's and sample file's
  exact shape, and file layout under
  `web-app/api-documentation/`.
- How a write gets its own copy of the seeded state.
- Where the cheap password hasher comes from.
- The recipes for operations, and the no-sample list.
- The body fields that hold secrets.
- The visual design.
- Commit slicing. The seed's write order is the first
  commit. Part A and Part B may land as two features.

## TODO.md

"Seed through the API" is already rewritten on this
branch (`c1c337ce7`), at the operator's request. Until
it lands, the generator's write bodies come from the
seed's builders (Writes). This unit does not do it.

Two more entries under `## Later work`, in TODO.md's own
conventions:

- **Declare and prove handler role narrowing.** Each
  rule that narrows a tier (self only; invitee or
  organization admin) is declared beside its route, a
  test proves it by calling as the wrong person, and the
  page shows it. The header unit is the pattern.
- **A machine-readable OpenAPI file**, once body shapes
  exist as schemas.

## Sequence

1. `declared-request-headers`.
2. This unit.
3. The live layer, its own spec, on top of this page.
   The operator has already decided:
   - A signed-in reader can run a sample from the page.
     The page sends it with the reader's session, shows
     the live response beside the expected one, and
     never displays the token.
   - A run shows the whole request the page sent and the
     whole response it received, headers included. Two
     limits are the browser's and the page says so: it
     cannot see the request headers the browser adds
     itself, and a response's `Set-Cookie` is never
     exposed to a page.
   - Reads run in one click. A write asks first, naming
     what it will change.
   - Off a mock-seeded server the seed's ids do not
     exist: the page uses the reader's own organization
     and, for an item, the first the matching list
     returns, and says why when there is none.
   - A reader may opt in to having their live access
     token filled into the `curl` text. Off by default,
     never remembered, behind a loud and specific
     warning that shows the time left. Access token
     only. A test proves no token is on the page before
     the opt-in.
