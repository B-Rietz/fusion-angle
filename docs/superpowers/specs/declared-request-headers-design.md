# Declared request headers

Branch and worktree `declared-request-headers`. Line
numbers below are master at `116c11044`.

## Intent

A developer integrating by software must be told, for
each endpoint, exactly which request headers it needs.
The operator wants that list derived from the code that
consumes the headers, never from a second list kept
beside it.

Today no such derivation is possible. The product reads
request headers by name at 23 sites in six files, passes
them whole at two more, and nothing declares which
requests need which header. The
API documentation generator keeps its own hand list
(`headersFor` in
`web-app/app/generate-api-documentation.ts`), and the two
disagree.

This unit makes the product declare every request header
it consumes in one module, and read every header through
that module. It changes no behaviour. A later unit, the
API documentation overhaul (its own spec), prints the
declarations. That unit waits for this one.

## Goals

- One module declares every request header the product
  reads under `api/` and `server/`.
- Each declaration answers the header's state for a given
  request (see States).
- Every request-header read goes through the module. A
  test fails when a file outside it reads a request
  header directly.
- Each state is computed from the fact the gate already
  uses, where that fact exists as data (the precondition
  class, the bearer-exempt routes), and stated beside
  the name otherwise.
- A test drives every endpoint through the real gate and
  fails when a declared state disagrees with what the
  gate does.
- TODO.md gains two entries: eliminate optional request
  headers, with the declarations as its worklist; and
  make the gate consume the declared states, as later
  work of its own.

## Non-goals

- Changing any header's state. `Content-Type` stays
  unread on PUT, POST, and PATCH; the 30 optional
  preconditions stay optional.
- Response headers. The documentation overhaul takes
  those from replayed exchanges.
- The documentation generator and its output. `headersFor`
  and the generated tree are untouched here, so
  `generate-api-documentation --check` stays green
  without a regeneration.
- `client/` and `web-app/`. They send request headers;
  they do not consume them.
- Any change to where or how the gate refuses. The gate
  consuming the declared states is later work
  (Approaches; TODO.md).

## Anti-goals

These make the unit a failure even if it type-checks.

- A refusal changes its status, its body, or its place in
  the order of refusals.
- A declared state can disagree with the gate and no
  test fails — a parallel list, the very thing this
  unit removes.
- A header value reaches a log line. `Authorization` and
  `Cookie` carry credentials.
- An existing test is edited to pass.

## Approaches

The operator chose the first.

1. **Declare, read through, and prove (chosen).** One
   module declares each header and its state per
   request. Every read goes through it; a test bans
   direct reads elsewhere, so the list of headers is
   complete by construction. States are computed from
   the gate's own facts where those are data. A test
   drives every endpoint through the gate and fails when
   a declared state disagrees with it. No refusal moves.
2. **The gate consumes the states.** The gate gets
   presence rules that ask the declarations, up to one
   judge at its front. This is derivation with nothing
   to prove, and the better design. It changes
   behaviour: the sign-in routes have no presence rule
   today (a missing credential parses as empty and fails
   verification), the earliest refusals fire before the
   route is matched, and the order of refusals is pinned
   by tests. Authentication runs before the 404 so an
   unauthenticated caller cannot map routes; reordering
   there risks a route-existence oracle. The operator
   set this aside as later work of its own, after this
   unit, whose proving test is what makes it safe.
3. **Declarations pinned by a scan.** Reads stay as they
   are; a test checks each header name read appears in
   the list. Cheapest, but nothing ties a state to the
   gate. Rejected.

An earlier form of option 1 had each refusal ask the
declaration. Review showed most refusals cannot: the
sign-in routes have none to ask from, the early ones
have no route yet, and the precondition ladder decides
more than a state can say (the both-present 412, the
tag count). The operator chose the form above.

Measuring states by replay as the *source* of the
documentation was proposed and rejected by the operator:
derive from the consuming code. The proving test here is
not a source. It only stops a declaration drifting.

## What exists today

Request headers reach product code by three channels.

1. **Direct reads** off `Request.headers` (inventory
   below).
2. **The whole pass, at two sites.**
   `requestHeaderFields` (`api/message-pair.ts:628`)
   copies every header the client sent into the received
   request, which the ledger stores. The server's rebuilt
   request (`server/http-server.ts:306`) hands the
   client's headers on unread. Neither selects a header
   to decide a request. The stored copy is later
   partitioned by `splitCredentials`
   (`api/message-pair.ts:358`), which hoists the names in
   `REQUEST_CREDENTIAL_NAMES`
   (`shared/http-message/credentials.ts:10`:
   `authorization`, `proxy-authorization`, `cookie`) out
   of the stored message. That is storage redaction, not
   consumption, it lives in `shared/`, which cannot
   import this unit's module, and this unit leaves it
   alone.
3. **Reads by name off the copied field lines.**
   `ifMatchFromMessage` and `rawIfMatchFromMessagePair`
   (`api/message-pair.ts:575`, `:597`), `headerOf`
   (`api/invitations-domain.ts:233`, called for
   `If-Match` and `If-None-Match`), and the
   `operation-id` check at `api/message-pair.ts:233`.

Inventory of direct reads, with each header's state as
the code decides it today:

| Header | Read at | State today |
|---|---|---|
| `transfer-encoding` | `api/request-context.ts:115` | forbidden on every API request (411) |
| `content-length` | `api/request-context.ts:121`, `server/http-server.ts:242` | required when a body is sent (411); the server also reads it for the body size limit |
| `request-id` | `api/api.ts:487` | forbidden (400): the server mints it |
| `operation-id` | `api/api.ts:493`, `:1117`, `:1417`; `server/http-server.ts:564` (log field) | required on every API request (400) |
| `authorization` | `api/request-auth.ts:50` | required, `Bearer`, unless the route is in `AUTHENTICATION_ROUTES` (401) |
| `authorization` | `api/authentication.ts:1318`, `:1439`, `:1574`, `:1687` | on the two grant routes, per grant: `Basic` username and password (authorize), `Basic` code and verifier (`authorization_code`), `Bearer` assertion (`client_credentials`), `Bearer` (`token-exchange`) |
| `cookie` | `api/authentication.ts:1093` | required by the `refresh` grant: absent or empty answers 401 `missing refresh token` (`:1099`) |
| `content-type` | `api/api.ts:241` | required on QUERY (400 absent, 415 not JSON); unread on every other verb |
| `if-match`, `if-none-match` | `api/api.ts:267`, `:268`, `:997`; channel 3 | by `conditionalOf(pattern, method)`, in `preconditionRefusal` (`api/api.ts:261`) |
| `forwarded`, `x-forwarded-for` | `server/http-server.ts:720`, `:723` | read for the sign-in throttle's caller identity; set by proxies |
| `accept-encoding` | `server/http-server.ts:457` | static files only: the gzip sidecar |
| `sec-fetch-mode` | `server/http-server.ts:174` | static site only: document navigation |
| `content-type`, `accept` | `server/status-page.ts:39`, `:43` | the status page's JSON-or-HTML choice |

The precondition ladder, by `Conditional`:

- `none`: both are forbidden (400).
- `optional`: either may be sent, neither is required.
- `required`: one of the two is required (428).
- `in-order`: `If-Match` is required (428);
  `If-None-Match` is forbidden (400).
- Both together are refused wherever a precondition is
  taken (412).

The generator's hand list is wrong in ways this
inventory shows, and the documentation overhaul inherits
them as findings, not this unit: it lists no
`Authorization` on the grant routes although credentials
ride it there; it omits `Content-Type` on QUERY; it lists
no forbidden header.

## Design

### The module

One module under `api/` (suggested name
`api/request-headers.ts`; the builder may split it).
`server/` already imports from `api/`, and the state
function needs route knowledge, so it cannot live in
`shared/`.

It exports:

- **A declaration per header**: its lower-case name, its
  surface, and a state function.
- **The list of all declarations**, in a stable order,
  for the documentation generator and the tests.
- **Accessors** that take a declaration, not a string:
  one reading a value off `Headers`, one reading a value
  off the copied field lines (channel 3). A presence
  check is the same read compared with absent.
The two whole-pass sites stay where they are and are the
ban test's named exemptions. `requestHeaderFields` does
not move: `tests/api-patch-verb.test.ts:17` imports it
from `api/message-pair.ts`.

### Surfaces

Each declaration names the surface it serves, so the
documentation can print the right ones in the right
place. This grouping is the design's call, not the
operator's:

- `endpoint`: decided per endpoint. `authorization`,
  `operation-id`, `content-type`, `if-match`,
  `if-none-match`, `cookie`, `request-id`.
- `transport`: the same on every API request, or set by
  infrastructure. `content-length`, `transfer-encoding`,
  `forwarded`, `x-forwarded-for`.
- `site`: read only for static files and the status
  page, never for `/api/`. `accept-encoding`,
  `sec-fetch-mode`, `accept`, and the status page's
  `content-type`.

`content-type` is read on two surfaces. Whether that is
one declaration or two is the builder's.

### States

A state function takes a request's kind and answers one
of:

- `required` — the request is refused without it.
- `optional` — read when sent, never demanded.
- `forbidden` — the request is refused with it.
- `unused` — not read for this request.
- `alternative` — one of a named set is required; the
  declaration names the set. Today that is `if-match`
  and `if-none-match` under the `required` conditional.

The fifth state is the design's call. The operator was
shown four; the either-or precondition does not fit
them without lying in one direction.

A request's kind is the route pattern, the method,
whether a body is sent, and, on `authentication/token`,
the grant type. The body is part of the kind because
`content-length` is required exactly when one is sent.
Headers judged before the route is matched
(`transfer-encoding`, `content-length`, `request-id`,
`operation-id`, at `api/api.ts:483`–`:500`, which fire on
unmatched paths too) declare a state that ignores the
route and the method. The grant
type is part of the kind because that route's headers
turn on it: `refresh` takes `cookie`, the other grants
take `authorization` in two schemes. Without it the
honest answer for both headers on that route would be
`optional`, which would put them on the TODO's worklist
wrongly. This is the design's call. The grant types are
those `postToken` dispatches on
(`api/authentication.ts:1549`).

The precondition states derive from `conditionalOf`,
which the gate already consults; the declaration is a
new reader of the same fact, not a second copy of it.
The `authorization` state on ordinary routes derives
from `AUTHENTICATION_ROUTES`.

### The gate

Every by-name read in the inventory becomes a read
through an accessor. Channel 3's by-name reads do too.
That is the whole change to the gate.

Every refusal keeps its logic, its site, and its order.
`preconditionRefusal` keeps branching on `Conditional`.
Parsing a value (a bearer token, an entity tag, a
`Basic` pair, a cookie) stays where it is.

The state functions read the same facts the refusals
do — `conditionalOf` for the two preconditions,
`AUTHENTICATION_ROUTES` for `authorization` on ordinary
routes — so those states cannot be restated wrongly
without the fact itself changing. The mapping from a
`Conditional` to the two precondition states is written
once, in the module. States with no such fact (the
sign-in routes' credentials, the pre-match headers, the
server-read ones) are stated. The proving test holds
both kinds to the gate.

### The ban test

A test under `tests/` fails when any file under `api/`
or `server/`, other than the module, reads a request
header directly. Its oracle: adding
`request.headers.get('x-new')` to `api/api.ts` turns it
red; reading the same header through a new declaration
keeps it green.

Response headers are out of scope and must not trip it:
`server/http-server.ts:599` reads `request-id` off a
response, and several sites set response headers. How
the test tells the two apart is the builder's.

`tests/root-scripts-exec-deno.test.ts` is a precedent for
a source-scanning pin in this repository.

### The proving test

Through `handleRequest` on the memory backend, not
against the module's internals. For every request kind
— each route and verb the route table offers, and each
grant type on `authentication/token` — and every
`endpoint` and `transport` declaration:

- `required`: the request without the header is refused
  on that header's account.
- `forbidden`: the request with the header is refused on
  that header's account.
- `alternative`: the request with no member of the set
  is refused on the set's account.
- `optional`: the request without the header is not
  refused on that header's account.

"On that header's account" is the test's burden: a
refusal for some other reason (a 404, a bad body) must
not satisfy it. Comparing the same request with and
without the header, or declaring the refusal's status
beside the state, are two ways; the builder chooses.

Its oracle: changing a declared state to a wrong one
turns the test red, for every header and every kind.
`unused` is held by the ban test, not this one: a header
with no read cannot decide a request.

`site` declarations and the two proxy headers are not
driven through `handleRequest`; the server reads them
outside it. The existing server tests cover them, and
this unit adds none.

`tests/in-page-facade.ts` reaches `handleRequest`
in-process, and `tests/token-fixtures.ts` and
`tests/root-admin-fixture.ts` mint callers.

### TODO.md

Two entries, placed and worded as TODO.md's own
conventions ask (the builder reads them).

**The gate consumes the declared header states**, under
`## Later work`. It records Approaches, 2: what it buys
(derivation with nothing to prove), what it changes (a
presence rule on the sign-in routes, the early refusals
after the route match, the order tests pin), the hazard
(authentication before the 404 keeps routes unmappable;
reordering must not open a route-existence oracle), and
its prerequisite (this unit's proving test, which shows
any behaviour that moved). Its oracle: no refusal over a
header's presence decides from anything but the
declaration.

**Eliminate optional request headers.** Its oracle is
that no
`endpoint` declaration answers `optional` for any
request kind. Its worklist, from the declarations:

- the optional preconditions — every DELETE, and the
  PUTs and the one POST that may create (30 endpoints in
  today's generated catalog).

The entry names `forwarded` and `x-forwarded-for` as
optional by nature (a proxy sets them, and the server
reads them only on the two sign-in paths
`server/throttle.ts:12` names) and outside the oracle.

## Constraints

- No behaviour change. `./test validate` is green with no
  existing test edited.
- `deno.json` binds `erasableSyntaxOnly` (no enums, no
  namespaces), `verbatimModuleSyntax`, and
  `noUncheckedIndexedAccess`.
- 78-character lines, 4-space indent.
- Import cycles: `api/message-pair.ts` holds channel 3's
  readers and the header-name constants, and
  `api/routes.ts` holds `conditionalOf`. A module that
  both is imported by `message-pair.ts` and imports
  `routes.ts` may close a cycle. Splitting names and
  accessors (no route knowledge) from states (route
  knowledge) avoids it. The builder decides.
- Header-name constants that exist today are defined
  once each: `IF_MATCH_HEADER` and `IF_NONE_MATCH_HEADER`
  in `api/message-pair.ts`; `OPERATION_ID_HEADER` and
  `REQUEST_ID_HEADER` in `shared/message-id-fields.ts`,
  which `client/` also uses; `CONTENT_LENGTH` and
  `TRANSFER_ENCODING` in
  `shared/http-message/framing.ts`. Do not mint a second
  definition of a name. The module imports the `shared/`
  ones. The two precondition constants may move into the
  module's route-free half, with `api/message-pair.ts`
  re-exporting them so the twenty test files that import
  them from there are not edited; the move is its own
  commit.
- Never move or rename and change content in the same
  commit.

## Left to the builder

- Names, file split, and the exact types.
- Whether `alternative` carries its set on the state or
  on the declaration.
- The ban test's mechanism, and how the proving test
  tells a header's refusal from any other.
- Commit slicing. One concern per commit: the module,
  then the reads file by file, then the ban test, the
  proving test, then TODO.md.

## Verification

- `./test validate --syntax` on each commit.
- Squash to one commit per feature, then `./test
  validate` (Layer 1).
- `./test postgres` once before the branch rests: the
  gate's reads are backend-independent, but the stored
  request message is not, and channel 3 reads it.

## Sequence

This unit lands first. `api-documentation-overhaul`
plans after it and reads its declarations.
