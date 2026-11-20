# Declared request headers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Every request header the product reads under
`api/` and `server/` is declared once, with its surface and
its state for each kind of request, and is read only
through that declaration. A ban test keeps the reads there,
and a proving test holds every declared state to the gate.
No behaviour changes.

**Architecture:** Two modules. `api/request-header-names.ts`
knows no routes. It holds each header's name and surface
(`REQUEST_HEADERS`), the two precondition constants moved
out of `api/message-pair.ts`, and the two accessors that
every read goes through. `message-pair.ts` imports it, so
it imports nothing from `api/`. `api/request-headers.ts`
adds route knowledge: `RequestKind`, a state function per
header, and `REQUEST_HEADER_DECLARATIONS`. It reads
`conditionalOf` and `AUTHENTICATION_ROUTES`. Tests import
it, and later the documentation generator will; product
code never does. The reads change file by file, and no
refusal moves. A source-scanning test bans direct reads. A
second test drives all 135 request kinds through
`handleRequest` and compares each declared state with the
gate's answer.

**Tech Stack:** Deno 2.9.8; TypeScript under `deno.json`
(`strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noImplicitReturns`,
`noFallthroughCasesInSwitch`, `noUnusedLocals`,
`noUnusedParameters`, `verbatimModuleSyntax`,
`erasableSyntaxOnly`); `@std/assert`; the memory backend;
the sign-in fixtures under `tests/`.

**Spec:**
`docs/superpowers/specs/declared-request-headers-design.md`
(commit `09c500428`). Executors read the spec and this
plan. These parts of the spec are settled: its Approaches
(the operator chose 1), Goals, Non-goals, Anti-goals, and
Constraints. The Decisions below settle what the spec left
to the builder. Do not reopen either.

---

## Dispatch preamble

The conductor prepends this block, verbatim, to every
subagent dispatch, before the task's own text:

```text
Go to Medium Church!

You are one worker in the worktree
/Users/tmornini/code/fusion-angle/.worktrees/declared-request-headers
(branch declared-request-headers). Work only there.
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
4-space indent; no inline styles; no `org` abbreviation
in identifiers. Commit subject: one line, about 50
characters, present-tense imperative, then a blank line
and the Co-Authored-By trailer your session's
instructions give; no other body. Never move or rename a
file or a declaration and change its content in one
commit. "grant" is a verb; the noun only in RFC names
(grant_type, invalid_grant, grant_types). Prose names a
person "organization admin" or "operator", never bare
"admin"; the role string 'admin' stays.

The hard rule (not negotiable): no behaviour changes. No
refusal changes its status, its body, or its place in
the order of refusals. No existing test is edited. No
header value reaches a log line, an error message, or a
test failure message: `authorization` and `cookie` carry
credentials. Never mint a second definition of a header
name: import the one that exists.

Stop and report to the conductor, without working
around it, when:
- an existing test would need an edit;
- a refusal's status, body, or order would change;
- you find a request-header read that the plan's
  Re-verified numbers do not list;
- the proving test would pass only if loosened;
- a declared state disagrees with what the gate does;
- the ban scanner flags a line that is not a header
  read;
- `./test api-docs` or `./test schema` goes red;
- `git merge-base master HEAD` is not 116c11044 (every
  line number in the plan is pinned there);
- a module fails to load (a ReferenceError at import
  time means an import cycle).

Commandments this work touches: I Reliability (no
refusal moves), II Security (credentials never logged;
authentication stays before the 404), III Uniformity
(one name per header, defined once, read one way), IV
Logic (presence refusals told apart from value
refusals), V Clarity, VIII Simplicity (accessors stay one
line each).

Abominations this work risks: Test Weakening (never
edit an existing test; never loosen the proving test to
pass); Unbidden Helper Code (build only what the task
names; no generic header framework); Default Values (add
no `?? ''`; the two existing ones at the operation-id
reads stay as they are, D15); Internal Defense (an
accessor never re-checks what its caller decides);
Magical Values; Cleverness; Swallowed Failures (a
scanner never skips an unreadable file in silence).

Codebase patterns to match: `import type` for types;
`.ts` extensions in specifiers; no enums or namespaces
(`as const` unions); `!` or a guard on every indexed
read; an optional property is absent, never
`undefined`; validators at the gate, not downstream; no
untyped `any` from an external boundary; snake_case
storage, camelCase domain; HTTP-verb naming
(getNoun, putNoun, deleteNoun, postNounOperation).
shared/ never imports api/. Nothing under api/ imports
server/. Product code never imports
api/request-headers.ts.

The spec: docs/superpowers/specs/declared-request-headers-design.md.
The plan: docs/superpowers/plans/declared-request-headers.md
(read its Global Constraints, Re-verified numbers, and
Decisions, then your task).
```

## Global Constraints

These are copied from the spec. Every task's requirements
include them.

- No behaviour changes. `./test validate` is green, and no
  existing test is edited.
- No refusal changes its status, its body, or its place in
  the order of refusals.
- No header value reaches a log line.
- Header-name constants that exist today are defined once
  each. Do not mint a second definition. The module
  imports the `shared/` constants. The two precondition
  constants move into the route-free module in a commit of
  their own with no content change, and
  `api/message-pair.ts` re-exports them, so none of the 20
  test files that import them from there is edited.
- Never move or rename and change content in the same
  commit.
- `erasableSyntaxOnly` (no enums, no namespaces),
  `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, and
  `exactOptionalPropertyTypes` bind.
- 78-character lines, 4-space indent.
- These stay as they are: response headers, `client/`,
  `web-app/`, the documentation generator, its generated
  tree, and `splitCredentials`
  (`shared/http-message/credentials.ts`).
  `generate-api-documentation --check` stays green with no
  regeneration.
- `requestHeaderFields` stays in `api/message-pair.ts`;
  `tests/api-patch-verb.test.ts:17` imports it from there.
- `./test postgres` runs once before the branch rests.

## Re-verified numbers

The planning session measured these itself on
2026-11-19, against `116c11044` (master unmoved), with
throwaway probes that are not committed.

| Fact | Design | Now |
|---|---|---|
| By-name reads off `Request.headers` | 23 in six files | **24** in six files: `api/api.ts` 8 (241, 267, 268, 487, 493, 997, 1117, 1417), `api/authentication.ts` 5 (1093, 1318, 1439, 1574, 1687), `server/http-server.ts` 6 (174, 242, 457, 564, 720, 723), `api/request-context.ts` 2 (115, 121), `server/status-page.ts` 2 (39, 43), `api/request-auth.ts` 1 (50). The design's own inventory table lists all 24; only its count is off. |
| Whole passes | 2 | 2: `requestHeaderFields` (`api/message-pair.ts:628`; `forEach` and `getSetCookie` at 632–638); `apiRequest` (`server/http-server.ts:306`, `headers: request.headers` as a value) |
| Channel 3 by-name reads | 4 sites | 4: `message-pair.ts:233` (`headerFieldsWithOperationId`), `:579` (`ifMatchFromMessage`), `:601` (`rawIfMatchFromMessagePair`), `invitations-domain.ts:237` (`headerOf`, called at :243 and :250) |
| Other by-name field-line reads | none named | 1, a **response** read: `message-pair.ts:1506` (`currentRequestId` reads `request-id` off the stored response). It is out of scope, and the ban test exempts it by name (D10). |
| Header-name constants | 6 | The 6 named: `IF_MATCH_HEADER` (`api/message-pair.ts:470`), `IF_NONE_MATCH_HEADER` (`:493`), `OPERATION_ID_HEADER` and `REQUEST_ID_HEADER` (`shared/message-id-fields.ts:1`, `:3`), `CONTENT_LENGTH` and `TRANSFER_ENCODING` (`shared/http-message/framing.ts:6`, `:7`). Plus one the design does not name: a module-private `CONTENT_TYPE = 'content-type'` at `shared/http-message/body.ts:11` (D9). |
| Importers of the precondition constants via `message-pair.ts` | 20 test files | 20 test files, plus 3 product files: `api/api.ts`, `api/invitations-domain.ts`, `api/mock-data/seed-message-pairs.ts` |
| Import-cycle risk | "may close a cycle" | Real. `api/routes.ts` imports `message-pair.ts` (value imports at 92–107). `message-pair.ts`'s graph (41 modules) holds no `routes.ts`. A states module that `message-pair.ts` imports and that imports `routes.ts` would close message-pair → states → routes → message-pair. (`authentication.ts` reaches `routes.ts` only through the erased `import type` at `api/document-family.ts:13-19`, so no runtime cycle runs through it.) |
| Routes / route-verb pairs | — | 89 / 131. Writes: 54 (`none` 10, `optional` 30, `in-order` 7, `required` 7). |
| Optional preconditions | 30; "every DELETE" | 30. **8 of the 9 DELETEs.** `DELETE organizations/:id/work-orders/:id/claim` is `in-order`. The rest: 21 PUTs and `POST organizations/:organization-id/record-types/`. |
| Grant types | those `postToken` dispatches on | 4 inline literals in `postToken`'s switch (`authentication.ts:1562`): `authorization_code`, `refresh`, `token-exchange`, `client_credentials`. Not exported. |
| `./test` | 9.5 s (AGENTS.md, from `44447626f`, 2026-09-01) | One run in the planning sandbox: exit 0, 4641 + 8 passed, 11 ignored, 126.67 s. Task 0's number is the baseline. |

Three findings change how the work is done. None changes
what is built:

- **A handler makes a presence decision about one kind's
  If-Match.** `POST organizations/:organization-id/record-types/`
  is `optional` at the gate. Its handler refuses If-Match
  on a create body (400, `routes.ts:4646`) and demands it
  on an edit body (428 through `latchesOf`,
  `routes.ts:952`). That decision depends on the body, and
  a request kind has no body shape. The spec settles that
  the 30 optional preconditions stay `optional` (D14).
  Other handler 428s on `in-order` routes count tags
  (`routes.ts:1444`, `:1777`, `:2003`, `:4202`), which the
  spec already puts outside states.
- **Deno adds `content-type: text/plain;charset=UTF-8` to
  a string body.** A QUERY built that way is refused 415
  for the test's reason, not the declaration's. The
  proving test sends bytes (D11).
- **A request reaches every header check with simple
  fills.** All 129 kinds outside the sign-in routes reach
  their header check under these conditions: the root
  admin's bearer, an organization token for
  `AjdvjuECVZEgZoFajaIEkg`, filled path parameters, and a
  `{}` body sent as bytes (probed). Nothing earlier
  refuses them.

## Decisions on what the spec left to the builder

- **D1. Two files.**
  - `api/request-header-names.ts` knows no routes. It
    holds the names, surfaces, and accessors.
    `message-pair.ts`, `api.ts`, `request-context.ts`,
    `request-auth.ts`, `authentication.ts`,
    `invitations-domain.ts`, `http-server.ts`, and
    `status-page.ts` import it. It imports only from
    `shared/`.
  - `api/request-headers.ts` adds the route knowledge:
    kinds, states, and `REQUEST_HEADER_DECLARATIONS`. It
    imports `routes.ts`, `request-auth.ts`, and
    `authentication.ts`.

  Why: the cycle in Re-verified numbers. The design
  suggested this split, and R1 expects the states at
  `api/request-headers.ts`. Only the names file holds a
  direct read.
- **D2. Names and surfaces.**

  ```ts
  export type RequestHeaderSurface =
      'endpoint' | 'transport' | 'site';
  export interface RequestHeader {
      readonly name: string;      // lower-case field name
      readonly surface: RequestHeaderSurface;
  }
  export const REQUEST_HEADERS = { … } as const
      satisfies Readonly<Record<string, RequestHeader>>;
  export type RequestHeaderKey = keyof typeof REQUEST_HEADERS;
  export type DeclaredRequestHeader =
      (typeof REQUEST_HEADERS)[RequestHeaderKey];
  ```

  Keys and names, in this order (the design's Surfaces
  order, which is the stable order of the declarations):

  | Key | Name | Surface |
  |---|---|---|
  | `authorization` | `'authorization'` | endpoint |
  | `operationId` | `OPERATION_ID_HEADER` | endpoint |
  | `contentType` | `CONTENT_TYPE` | endpoint |
  | `ifMatch` | `IF_MATCH_HEADER` | endpoint |
  | `ifNoneMatch` | `IF_NONE_MATCH_HEADER` | endpoint |
  | `cookie` | `'cookie'` | endpoint |
  | `requestId` | `REQUEST_ID_HEADER` | endpoint |
  | `contentLength` | `CONTENT_LENGTH` | transport |
  | `transferEncoding` | `TRANSFER_ENCODING` | transport |
  | `forwarded` | `'forwarded'` | transport |
  | `xForwardedFor` | `'x-forwarded-for'` | transport |
  | `acceptEncoding` | `'accept-encoding'` | site |
  | `secFetchMode` | `'sec-fetch-mode'` | site |
  | `accept` | `'accept'` | site |
  | `statusPageContentType` | `CONTENT_TYPE` | site |

  Why: a keyed constant reads well at a call site
  (`REQUEST_HEADERS.ifMatch`). The `shared/` constants
  already exist as `CONTENT_LENGTH` and others, so each
  header object needs a name that does not clash with
  them. Surface is a fact that needs no route, so it
  lives with the name. The declarations copy it and do
  not restate it.
- **D3. Accessors.** Each keeps the absent value of the
  read it replaces, so no call site's comparison changes.

  ```ts
  export function requestHeaderOf(headers: Headers,
      header: DeclaredRequestHeader): string | null;
  export function requestFieldOf(
      fields: readonly FieldLine[],
      header: DeclaredRequestHeader): string | undefined;
  ```

  - The parameter is `DeclaredRequestHeader`, the union of
    `REQUEST_HEADERS`'s literal values, not
    `RequestHeader`. An inline
    `{ name: 'x-new', surface: 'endpoint' }` therefore fails
    `deno check`. The list is complete by construction, as
    the spec asks ("accessors that take a declaration, not
    a string").

  - `requestHeaderOf` is `Headers.get` of
    `header.name`.
  - `requestFieldOf` is the value of the first line whose
    name equals `header.name` exactly.
  - A presence check is the same read compared with
    absent: `has(x)` becomes `requestHeaderOf(…) !== null`,
    and `.some(…)` becomes `requestFieldOf(…) !==
    undefined`.
  - An empty value is present (`''`). Each call site
    keeps its own rule for an empty value.
- **D4. Request kind.**

  ```ts
  export type RequestMethod = 'GET' | 'QUERY' | WriteMethod;
  export interface RequestKind {
      readonly routePattern: string;  // 'organizations/:id'
      readonly method: RequestMethod;
      readonly bodySent: boolean;
      readonly grantType?: GrantType; // only on
                                      // authentication/token
  }
  ```

  The method is upper-case, as `Request.method` and
  `conditionalOf` use it. A token kind without
  `grantType` is the unsupported-grant-type kind: the gate
  answers 400 before it reads either credential header, so
  its states say exactly that. Why: R2's fields, with no
  value that pretends.
- **D5. Grant types are exported** from
  `api/authentication.ts`:

  ```ts
  export const GRANT_TYPES = ['authorization_code',
      'refresh', 'token-exchange', 'client_credentials',
  ] as const;
  export type GrantType = (typeof GRANT_TYPES)[number];
  ```

  `postToken` refuses a value outside `GRANT_TYPES` with
  today's 400 `'unsupported grant_type: ' + grantType`.
  It then switches over the narrowed `GrantType`, with no
  `default`. The compiler then ties the list to the
  dispatch in both directions: a missing case is TS2366,
  and a case outside the list is TS2678. Why: R2 asks
  whether the types are exported. A list kept beside the
  switch would be the parallel list this unit removes.
- **D6. States.** Each line says where the state comes
  from:

  | Key | `stateOf(kind)` | From |
  |---|---|---|
  | `authorization` | outside `AUTHENTICATION_ROUTES`: `required`. `authentication/authorize`: `required` (its body's `method: 'password'`; `passkey`, `provider`, and `oidc` answer 501 and an unknown method 400 before any header read, `authentication.ts:1856-1872`, which the states file's header comment notes beside D14). `authentication/token`: `required` for `authorization_code`, `client_credentials`, and `token-exchange`; `unused` for `refresh` and for no grant type | `AUTHENTICATION_ROUTES` (derived); the sign-in rows are stated |
  | `operationId` | `required` | stated (`api.ts:493`, before the route match) |
  | `contentType` | QUERY: `required`; otherwise `unused` | stated (`api.ts:237`) |
  | `ifMatch` | GET, QUERY: `unused`; otherwise `PRECONDITION_STATES[conditionalOf(routePattern, method)].ifMatch` | `conditionalOf` (derived) |
  | `ifNoneMatch` | the same, `.ifNoneMatch` | `conditionalOf` (derived) |
  | `cookie` | token with `refresh`: `required`; otherwise `unused` | stated (`authentication.ts:1093`) |
  | `requestId` | `forbidden` | stated (`api.ts:487`) |
  | `contentLength` | `bodySent`: `required`; otherwise `optional` | stated (`request-context.ts:121`) |
  | `transferEncoding` | `forbidden` | stated (`request-context.ts:115`) |
  | `forwarded`, `xForwardedFor` | in `AUTHENTICATION_ROUTES`, and the grant type is neither `refresh` nor `token-exchange`: `optional`; otherwise `unused` | stated (`server/throttle.ts:12`, `http-server.ts:710-716`) |
  | the four `site` keys | `unused` for every API kind | stated |

  `PRECONDITION_STATES` maps each `Conditional` to the two
  precondition states. It is written once, in
  `request-headers.ts`:

  | Conditional | `ifMatch` | `ifNoneMatch` |
  |---|---|---|
  | `none` | `forbidden` | `forbidden` |
  | `optional` | `optional` | `optional` |
  | `required` | `alternative` | `alternative` |
  | `in-order` | `required` | `forbidden` |

  The rest of the shapes:

  ```ts
  export type RequestHeaderState = 'required' |
      'optional' | 'forbidden' | 'unused' | 'alternative';
  export interface RequestHeaderDeclaration
      extends RequestHeader {
      readonly stateOf: (kind: RequestKind) =>
          RequestHeaderState;
      readonly alternatives: readonly string[];
  }
  export const REQUEST_HEADER_DECLARATIONS:
      readonly RequestHeaderDeclaration[];
  ```

  A module-local record typed
  `{ readonly [K in RequestHeaderKey]: Pick<RequestHeaderDeclaration, 'stateOf' | 'alternatives'> }`
  holds each key's state function and set. The list is
  built in `REQUEST_HEADERS` key order as
  `{ ...REQUEST_HEADERS[key], ...thatRecord[key] }`. A
  header added to the names file without a state fails
  `deno check`.

  The proxies borrow `AUTHENTICATION_ROUTES` as the
  throttle's paths. They are the same two patterns today,
  and `api/` cannot import `server/`. A comment names both
  sites, and Task 4's test pins that the two sets agree
  over `routes`.
- **D7. `alternative` names its set on the declaration.**
  `alternatives` lists the whole set, both members, in
  this order: `[IF_MATCH_HEADER, IF_NONE_MATCH_HEADER]`.
  Both precondition declarations share it. Every other
  declaration takes `NO_ALTERNATIVES`, a named empty
  list. Why: the set is fixed for each header, so a
  string-union state stays simple to filter. R3 asks
  where the set lives; overhaul Task 12 fills its
  `alternatives` from this field.
- **D8. `content-type` is two declarations.** `contentType`
  is `endpoint`, read by the QUERY gate. `statusPageContentType`
  is `site`, read by the status page. Both name the one
  `CONTENT_TYPE`. Each read goes through the declaration
  of its own surface. Why: two consumers on two
  surfaces. The spec groups the status page's read under
  `site`.
- **D9. Each name is defined once.**
  - `shared/http-message/body.ts`'s private `CONTENT_TYPE`
    becomes `export const`, in its own commit, and the
    names file imports it.
  - `authorization`, `cookie`, `forwarded`,
    `x-forwarded-for`, `accept-encoding`,
    `sec-fetch-mode`, and `accept` have no named constant
    today. The names file is their first.
  - `REQUEST_CREDENTIAL_NAMES`
    (`shared/http-message/credentials.ts:10`) keeps its
    literals. It is the storage-redaction list, `shared/`
    cannot import `api/`, and the spec leaves it alone.
- **D10. The ban test** is
  `tests/request-header-ban.test.ts`. It is a pure scanner
  plus four tests (Task 8).
  - Scope: every `.ts` file under `api/` and `server/`,
    recursively. `api/request-header-names.ts` is exempt
    whole.
  - Input: drop each line whose trimmed start is `//` or
    `*`. Then scan the joined text, so a call split across
    lines still matches. Report each hit's file and line.
  - Read shapes:
    1. A `Headers` read: a receiver ending in `headers`,
       then `.get(`, `.has(`, `.forEach(`, `.entries(`,
       `.keys(`, `.values(`, or `.getSetCookie`, with `?.`
       allowed.
    2. A `Headers` iterated, spread, or copied:
       `of …headers`, `...…headers`, `new Headers(…headers`,
       or `Object.fromEntries(…headers`.
    3. A field line compared by name, as equality only:
       `.name ===` or `=== x.name`. Inequality is left out
       because `slot.name !== ''`
       (`api/invitations-domain.ts:511`) and
       `next.id !== messagePair.name` (`:1152`) are not
       header reads. Every channel-3 read today is an
       equality.
  - The receiver may be a dotted chain or a bare
    `headers`. When the identifier before `.headers` is
    `response` (as in `response.headers` or
    `response?.headers`), the read is a response read and
    never counts. That is the convention: a response's
    headers are read off a binding named `response`.
  - Exempt by top-level function, from a column-0
    `function`, `async function`, `export function`, or
    `export async function` line to the next column-0 `}`:
    - `requestHeaderFields` in `api/message-pair.ts`, the
      whole pass;
    - `currentRequestId` in `api/message-pair.ts`, the
      response's own `request-id`.

    `apiRequest` (`server/http-server.ts`) passes the
    `Headers` whole as a value, which no read shape
    matches. The file's header comment names it as the
    second whole pass.
  - Every exemption must still be hit at least once, so a
    stale one fails.
  - Blind spots, stated in the test's header comment:
    - a `Headers` bound to a name that does not end in
      `headers`;
    - a by-name read written as an inequality.

    D3's typed accessors and review cover them.
  - Shape 3 flags any `.name ===` comparison under `api/`
    or `server/`, header or not. A future non-header
    comparison is rewritten or added to `EXEMPT` with a
    reason.

  Why: the spec wants a scan (precedent:
  `tests/root-scripts-exec-deno.test.ts`). The `response`
  convention is how it tells response reads apart without
  types. Shape 3 is how it sees channel 3.
- **D11. The proving test** is
  `tests/request-header-states.test.ts`. It runs through
  `handleRequest` on the memory backend.
  - **Kinds.** One kind per `routes` row × `offeredVerbs`
    pair (`api/route-surface.ts`), with
    `method = verb.toUpperCase()` and `bodySent` true for
    PUT, POST, PATCH, and QUERY. The POST of
    `authentication/token` becomes five kinds: one for each
    `GRANT_TYPES` member, and one with no `grantType`
    (body `grant_type: 'password'`). That makes 135.
  - **Declarations driven.** Those whose surface is
    `endpoint` or `transport`, except `forwarded` and
    `xForwardedFor`, which the server reads outside
    `handleRequest`. That leaves 9.
  - **Worlds.** Every request runs in a fresh world:
    - ordinary kinds: `memoryDbAdapter()`,
      `postSchemaCreation()`, and `seedRootAdmin`, with
      the caller `organizationToken()` (the root admin
      `XXZruirZyAOoRpNxaDnpSA` in `AjdvjuECVZEgZoFajaIEkg`);
    - sign-in kinds: the fixtures in Task 9.
  - **Paths.** The first parameter under `organizations`
    is that organization, and under `identities` that
    identity. `:membership-id` is
    `organization + ':' + identity`. `:name` is `tag`.
    Every other parameter is `generateIdentifier()`.
  - **Baseline B(K).** Every driven declaration takes its
    satisfied form for K:
    - `required`: present, with a valid value;
    - `alternative`: if-match present, if-none-match
      absent;
    - `forbidden`, `optional`, `unused`: absent.

    A body is bytes, never a string. Header names are
    written in Title-Case (`If-Match`).
  - **Checks**, with S the state that D declares for K:
    - `required`: B−D is refused on D's absence. B is
      not refused on D's account.
    - `forbidden`: B+D is refused on D's presence. B is
      not refused on D's account. For a member of the
      precondition pair, "B+D" means B with D as its
      **only** precondition: the other member is removed.
      Otherwise the both-present 412 (`api/api.ts:281`),
      which the spec puts outside states, would answer for
      it.
    - `alternative`: B with no member of
      `D.alternatives` is refused on the set's absence.
      B with each member alone is not refused on the
      set's account.
    - `optional` and `unused`: neither B−D nor B+D is
      refused on D's account.
  - **On D's account.** The test holds three refusal lists
    per header, each line citing its product site:

    | Header | Absence | Presence | Value |
    |---|---|---|---|
    | `transfer-encoding` | — | 411 | — |
    | `content-length` | 411 | — | 400 `/^Content-Length does not match the body$/` |
    | `request-id` | — | 400 `/^Request-ID is minted by the server$/` | — |
    | `operation-id` | 400 `/^Operation-ID is required$/` | — | 400 `/must be a 22-character identifier$/` |
    | `authorization` | 401 | — | 401 |
    | `cookie` | 401 | — | 401 |
    | `content-type` | 400 `/requires a Content-Type$/` | — | 415 |
    | precondition pair | `required`: 428 `/^If-Match is required to /`; `alternative`: 428 `/^If-Match or If-None-Match is required to /` | 400 `/takes no precondition$/`, 400 `/requires If-Match$/` | 400 `/^If-None-Match must be \*$/`, 400 `/^If-Match must carry exactly one strong validator$/` |

    The precondition pair has a fourth list, **Both**:
    412 `/cannot both hold/`. No check sends both
    members, so this list only joins the union below.

    - "Refused on its absence" matches the Absence list
      for the declared state.
    - "Refused on its presence" matches the Presence list.
    - "Not refused on its account" matches no list of the
      header, Both included.
    - B and B±D differ only in D, so a match is D's
      doing.

    A 412 from a stale validator, a 404, or a validator's
    400 matches none of these.
  - **Limit.** Swapping `optional` for `unused` is the one
    wrong state this test cannot see: a read that decides
    nothing leaves no trace in a response. The ban test
    holds the reads. The test's header comment says so.

  Why: comparing B with B±D attributes the refusal, and
  the lists make "on its account" specific.
  - Without the Value list, a string body's 415 would
    pass the content-type check wrongly.
  - Without the sole-precondition rule and the split
    Absence list, mis-stating the `required` row as the
    `in-order` row would pass.
- **D12. Response reads** in `api/` and `server/` read off
  a binding named `response` (D10). Every one does today:
  `server/http-server.ts:599`, `:746`, and
  `api/authentication.ts:360`.
- **D13. Commits and squash.**
  - Before the squash, the branch has one commit per
    concern, in the spec's order: the move, the grant
    types, the `CONTENT_TYPE` export, the names, the
    states, the reads file by file, the ban test, the
    proving test, then TODO.md.
  - The squash keeps two feature commits on top of the
    spec and plan commits:
    1. **Move the precondition header names**: the pure
       move, kept alone because a move never shares a
       commit with a change;
    2. **Declare the request headers the product reads**:
       everything else.
  - The squash runs `git commit-tree` on the final trees,
    with no interactive rebase (Task 12).
- **D14. POST `record-types/`'s If-Match** stays
  `optional`. The spec's Non-goal keeps the 30 optional
  preconditions optional, and a kind has no body shape.
  The proving test's `{}` body fails the body validator
  first, so it never reaches the handler's check. The
  TODO entry (Task 10) names this kind as decided by the
  body.
- **D15. The two `?? ''`** after the operation-id reads
  (`api.ts:1117`, `:1417`) stay. Only the read changes. The
  gate has already refused an absent operation-id, and
  removing them is a change of its own, not this unit's.

## What the overhaul's gate (R1–R6) will find

For the conductor of `api-documentation-overhaul`, who
corrects its Tasks 12, 14, and 16 from this list:

- **R1. As expected.** `REQUEST_HEADER_DECLARATIONS`,
  `declaration.name`, `declaration.surface`,
  `declaration.stateOf(kind)`, and `RequestKind`, all at
  `api/request-headers.ts`. New: `RequestHeaderState`,
  `RequestMethod`, `declaration.alternatives`.
- **R2.**
  - The kind's fields are `routePattern`, `method`,
    `bodySent`, and `grantType?`. **Departure:**
    `method` is upper-case (`'GET'`). The overhaul's
    endpoint verbs are lower-case `HttpVerb`, so map them
    with `toUpperCase()`.
  - The grant types are exported as `GRANT_TYPES` and
    `GrantType` from `api/authentication.ts`.
  - A token kind with no `grantType` exists; its two
    credential headers are `unused`.
- **R3.** The set is on the declaration:
  `declaration.alternatives`, both names. This matches
  Task 12's "`alternative` fills `alternatives`".
- **R4. Two declarations named `content-type`:** one with
  surface `endpoint`, one with surface `site`.
  **Departure:** Task 12's test "No `site` name appears in
  any set" must test the surface of each declaration, not
  its name. `content-type` is rightly on every QUERY set.
- **R5.** `tests/request-header-states.test.ts`.
- **R6.** `tests/request-header-ban.test.ts`. **Departure
  (two conventions):**
  - A response's headers must be read off a binding named
    `response` to pass. If overhaul Tasks 6 and 15 read
    response headers in `server/http-server.ts`, they name
    that binding `response`, as
    `withApiResponseDefaults(response)` does.
  - Shape 3 flags any `.name ===` comparison under `api/`
    or `server/`, not only request reads. Overhaul Task
    14's `ASSERTION_CLAIMS` in `api/client-assertion.ts`
    must not compare `claim.name ===`. It compares
    another way, or adds an `EXEMPT` entry with its
    reason.
- **Task 12's `TRANSPORT_HEADERS`.** **Departure:**
  - `forwarded` and `x-forwarded-for` are `transport` but
    depend on the route: `optional` on the sign-in kinds,
    `unused` elsewhere. One state "for a request that
    carries a body" does not describe them. Task 12
    states this or prints per kind.
  - `content-length` is `required` with a body and
    `optional` without one.
- **Task 12's re-check.** A forbidden `request-id` is
  declared on every kind (`endpoint`, `forbidden`).

## Review Focus

These are the input classes the spec implies but none of
its tests names, most likely to bite first. Each has a
test in its owning task.

1. **A string request body.** Deno adds `content-type:
   text/plain;charset=UTF-8`, so a QUERY is refused 415 for
   a reason no declaration gives. Expected: the proving
   test sends bytes. A 415 counts as a value refusal,
   never as a refusal for absence, so the error turns the
   test red rather than passing it. *Task 9.*
2. **An empty header value.** `operation-id: ''` and
   `cookie: ''` are treated as absent by their call sites.
   `If-Match: ''` is malformed (400). Expected: the
   accessor returns `''`, and each call site keeps its own
   rule. *Task 3.*
3. **A credential in a log.** The bearer refusal and the
   sign-in failures warn. Expected: no captured warn or
   error carries any `authorization` or `cookie` value
   the test sent. *Task 9.*
4. **An unknown or non-string `grant_type`.** Expected:
   400 `unsupported grant_type: password`, or
   `unsupported grant_type: ` for `42`, exactly as today,
   with neither credential header read. *Tasks 2 and 9.*
5. **Header case and repeated lines.** A client sends
   `If-Match`, and a stored message may carry a name
   twice. Expected: `Headers` reads ignore case, and
   `requestFieldOf` returns the first line of that name,
   as `.find` does today. *Tasks 3 and 9.*

## File map

| Path | Responsibility | Task |
|---|---|---|
| `api/request-header-names.ts` (new) | precondition constants (moved); `REQUEST_HEADERS`; accessors | 1, 3 |
| `api/request-headers.ts` (new) | `RequestKind`, states, `REQUEST_HEADER_DECLARATIONS` | 4 |
| `tests/token-grant-types.test.ts` (new) | `GRANT_TYPES` dispatch | 2 |
| `tests/request-header-names.test.ts` (new) | accessors | 3 |
| `tests/request-headers.test.ts` (new) | declaration list and order | 4 |
| `tests/request-header-ban.test.ts` (new) | ban on direct reads | 8 |
| `tests/request-header-states.test.ts` (new) | declared states against the gate | 9 |

Modified: `api/message-pair.ts` (1, 6),
`api/authentication.ts` (2, 5),
`shared/http-message/body.ts` (3),
`api/request-context.ts`, `api/request-auth.ts`,
`api/api.ts` (5), `api/invitations-domain.ts` (6),
`server/http-server.ts`, `server/status-page.ts` (7),
`TODO.md` (10).

---

## Task 0: Measure the baselines

**Agent:** `coder`. **Changes no file.**

- [ ] **Step 1:** `git log --oneline master..HEAD` shows the
  spec and plan commits only. `./test validate --syntax`
  exits 0.
- [ ] **Step 2:** `/usr/bin/time -p ./test`, once.
  Expected: exit 0. Record the `real` time and both summary
  lines (`ok | N passed | 0 failed | M ignored` for the
  UTC pass, and `ok | N passed | 0 failed` for the
  Honolulu pass).
- [ ] **Step 3: Report** the time and the counts. The
  conductor keeps them for Task 12.

**Acceptance:** the numbers are reported, and `git status`
is clean.

---

## Task 1: Move the precondition header names

**Agent:** `coder`.

**Files:**
- Create: `api/request-header-names.ts`
- Modify: `api/message-pair.ts:466-470`, `:493`

**Interfaces:**
- Produces: `IF_MATCH_HEADER` and `IF_NONE_MATCH_HEADER`
  exported from `api/request-header-names.ts`, and still
  exported from `api/message-pair.ts`.

- [ ] **Step 1: Move.** Cut `IF_MATCH_HEADER` with its
  four-line comment (`:466-470`) and `IF_NONE_MATCH_HEADER`
  (`:493`) into the new file, byte for byte. The new file
  holds nothing else. In `message-pair.ts`:
  - re-export both with `export { IF_MATCH_HEADER,
    IF_NONE_MATCH_HEADER } from './request-header-names.ts';`;
  - import only `IF_MATCH_HEADER` for the file's own reads
    (`:580`, `:602`). `IF_NONE_MATCH_HEADER` has no local
    use, and `noUnusedLocals` refuses an unused import.
- [ ] **Step 2: Nothing else moved.**
  `git diff --stat` names exactly those two files.
  `git diff` shows only the cut lines, the same lines in
  the new file, and the import and re-export lines.
- [ ] **Step 3:** `./test validate --syntax`, then `./test`.
  Both green. `git status --short tests/` is empty.
- [ ] **Step 4: Commit.** Subject: **Move the precondition
  header names**.

**Acceptance:** one commit; no test file touched; the 20
test importers and three product importers compile
unchanged.

## Task 2: Name the grant types the token route takes

**Agent:** `coder`.

**Files:**
- Modify: `api/authentication.ts` (`postToken`, `:1549`)
- Create: `tests/token-grant-types.test.ts`

**Interfaces:**
- Produces: `GRANT_TYPES`, `GrantType` (D5), exported
  from `api/authentication.ts`.

- [ ] **Step 1: Write the failing test.** Reuse
  `framedRequest` (`tests/http-fixtures.ts`) and a fresh
  `memoryDbAdapter()` after `postSchemaCreation()`. Send a
  POST to `/authentication/token` with a JSON body as
  bytes, `content-type: application/json`, and its
  `content-length`.
  - `'each grant type is dispatched'`: for each
    `g` of `GRANT_TYPES`, the body `{ grant_type: g }`
    answers a status other than 400, or a 400 whose
    `error` does not start with `unsupported grant_type`.
  - `'an unknown grant type answers 400 as before'`:
    `{ grant_type: 'password' }` answers 400 with
    `error` equal to `'unsupported grant_type: password'`.
    `{ grant_type: 42 }` answers 400 with
    `'unsupported grant_type: '`.
  - Capture `console.warn` with
    `tests/fixtures/console-capture.ts` around the
    requests.
- [ ] **Step 2: Red.** `one tests/token-grant-types.test.ts`.
  Expected: it fails to load, because `GRANT_TYPES` is
  not exported.
- [ ] **Step 3: Implement D5.** Add `isGrantType(value:
  string): value is GrantType` (not exported). Keep the
  `credentialRides` check first. Keep the `grantType`
  string extraction as it is. Return the same 400 for a
  non-member. The switch keeps its four arms, their
  calls, and their order, and loses `default`.
- [ ] **Step 4: Green.** `one tests/token-grant-types.test.ts`,
  then `./test`. Both green.
- [ ] **Step 5: Commit.** `./test validate --syntax`.
  Subject: **Name the grant types the token route takes**.
- [ ] **Step 6: The compiler holds the list.**
  1. Comment out one `case` arm. `./test validate
     --syntax` reports TS2366.
  2. Restore with `git checkout -- api/authentication.ts`.
  3. Add `case 'password':` with any return. It reports
     TS2678.
  4. Restore again, and report both errors.

**Acceptance:** `postToken`'s responses are byte-identical
for every `grant_type`; both compiler errors are reported;
no existing test edited.

## Task 3: Declare request header names and accessors

**Agent:** `planner`.

**Files:**
- Modify: `shared/http-message/body.ts:11`
- Modify: `api/request-header-names.ts`
- Create: `tests/request-header-names.test.ts`

**Interfaces:**
- Consumes: `OPERATION_ID_HEADER`, `REQUEST_ID_HEADER`
  (`shared/message-id-fields.ts`); `CONTENT_LENGTH`,
  `TRANSFER_ENCODING` (`shared/http-message/framing.ts`);
  `CONTENT_TYPE` (`shared/http-message/body.ts`, after
  Step 1); `type FieldLine`
  (`shared/http-message/types.ts`).
- Produces: `RequestHeaderSurface`, `RequestHeader`,
  `REQUEST_HEADERS`, `RequestHeaderKey`,
  `DeclaredRequestHeader` (D2); `requestHeaderOf`,
  `requestFieldOf` (D3).

- [ ] **Step 1: Export `CONTENT_TYPE`.** `const` becomes
  `export const` in `shared/http-message/body.ts`, with no
  other change. `./test validate --syntax`. Commit.
  Subject: **Export the content-type field name**.
- [ ] **Step 2: Write the failing tests**, in
  `tests/request-header-names.test.ts`:
  - `'a Headers read ignores the case it was sent in'`:
    `requestHeaderOf(new Headers({ 'If-Match': '"a"' }),
    REQUEST_HEADERS.ifMatch)` is `'"a"'`.
  - `'an absent header is null on Headers and undefined
    on field lines'`.
  - `'an empty value is present'` (Review Focus 2):
    `''` from both accessors, for `operation-id` and
    `cookie`.
  - `'a field read takes the first line of its name'`
    (Review Focus 5): two `if-match` lines; the first
    value.
  - `'every declared name is lower-case'`: for each value
    of `REQUEST_HEADERS`, `name === name.toLowerCase()`.
  - `'the two content-type headers share one name'`:
    `REQUEST_HEADERS.contentType.name ===
    REQUEST_HEADERS.statusPageContentType.name`, with
    surfaces `endpoint` and `site`.
- [ ] **Step 3: Red.** `one tests/request-header-names.test.ts`.
  Expected: it fails to load.
- [ ] **Step 4: Implement D2 and D3** in
  `api/request-header-names.ts`, below the two moved
  constants. The file imports only from `shared/`. Write a
  header comment saying the file is the one place a
  request header is read by name, and that `forwarded`
  and `x-forwarded-for` are set by proxies.
- [ ] **Step 5: Green.** Run the file, then `./test`.
- [ ] **Step 6: Commit.** `./test validate --syntax`.
  Subject: **Declare request header names and accessors**.

**Acceptance:**
- Two commits.
- The names file imports nothing from `api/`:
  `grep -nE "['\"]\./" api/request-header-names.ts` is
  empty.
- No name string appears in it twice, except
  `CONTENT_TYPE`, which two keys share by reference.

## Task 4: Declare each request header's state

**Agent:** `planner`.

**Files:**
- Create: `api/request-headers.ts`
- Create: `tests/request-headers.test.ts`

**Interfaces:**
- Consumes: Task 3's exports; `conditionalOf`, `type
  Conditional`, `type WriteMethod` (`api/routes.ts`);
  `AUTHENTICATION_ROUTES` (`api/request-auth.ts`);
  `type GrantType` (`api/authentication.ts`).
- Produces: `RequestMethod`, `RequestKind` (D4);
  `RequestHeaderState`, `RequestHeaderDeclaration`,
  `REQUEST_HEADER_DECLARATIONS` (D6, D7).

- [ ] **Step 1: Write the failing tests.**
  - `'the declarations are REQUEST_HEADERS, once each, in
    order'`: `REQUEST_HEADER_DECLARATIONS.map((d) =>
    [d.name, d.surface])` equals
    `Object.values(REQUEST_HEADERS).map((h) => [h.name,
    h.surface])`.
  - `'the throttle's paths are the bearer-exempt routes'`
    (D6, the proxies): for every row of `routes`,
    `isAuthThrottlePath('/' + routePatternOf(row))`
    (`server/throttle.ts`) equals
    `AUTHENTICATION_ROUTES.has(routePatternOf(row))`.
- [ ] **Step 2: Red** (it fails to load).
- [ ] **Step 3: Implement D4, D6, and D7.**
  - Write `PRECONDITION_STATES` once.
  - Each stated row carries a one-line comment naming its
    gate site, as in D6's From column.
  - Header comment:
    - product code never imports this file;
    - which states are derived and which are stated;
    - D14's body-dependent kind, and that
      `authentication/authorize`'s `required` holds for
      `method: 'password'` only (D6);
    - `tests/request-header-states.test.ts` holds the
      states to the gate.
- [ ] **Step 4: Green**, then `./test`.
- [ ] **Step 5: Nothing in the product imports it.**
  `grep -rln "request-headers.ts'" api server shared
  client web-app` is empty.
- [ ] **Step 6: Commit.** Subject: **Declare each request
  header's state**.

**Acceptance:** `deno check` fails if a key of
`REQUEST_HEADERS` lacks a state; the module loads on its
own (`deno eval --frozen "await
import('./api/request-headers.ts')"` exits 0).

## Task 5: Read the gate's headers through declarations

**Agent:** `coder`.

**Files:** one commit per file, in this order:
- `api/request-context.ts:115`, `:121`
- `api/request-auth.ts:50`
- `api/authentication.ts:1093`, `:1318`, `:1439`,
  `:1574`, `:1687`
- `api/api.ts:241`, `:267`, `:268`, `:487`, `:493`,
  `:997`, `:1117`, `:1417`

**Interfaces:**
- Consumes: `REQUEST_HEADERS`, `requestHeaderOf`
  (Task 3).

Each read becomes `requestHeaderOf(<the same Headers>,
REQUEST_HEADERS.<key>)`. The key comes from the header the
line reads. At `api.ts:241` it is `contentType`.
`api.ts:487`'s `.has(REQUEST_ID_HEADER)` becomes
`requestHeaderOf(request.headers,
REQUEST_HEADERS.requestId) !== null`. `:1117` and `:1417`
keep `?? ''` (D15). Comparisons, branches, messages, and
order stay byte for byte. An import that the change
leaves unused goes, and `noUnusedLocals` names it.

- [ ] **Step 1: `request-context.ts`.** Convert, run
  `./test validate --syntax`, and commit. Subject: **Read
  framing headers through declarations**.
- [ ] **Step 2: `request-auth.ts`.** Subject: **Read the
  bearer through its declaration**.
- [ ] **Step 3: `authentication.ts`.** Subject: **Read
  sign-in credentials through declarations**.
- [ ] **Step 4: `api.ts`.** Subject: **Read gate headers
  through declarations**.
- [ ] **Step 5: Each diff is only reads.** For each of the
  four commits, `git show -U0 <c>` shows only changed
  read expressions and import lines. Then `./test`, green.
  Report the four short hashes.
- [ ] **Step 6: No direct read is left in these files.**
  `grep -nE "headers\s*\.\s*(get|has)\(" <the four files>`
  is empty.

**Acceptance:** four commits; `./test` green; no test file
touched.

## Task 6: Read stored request lines through declarations

**Agent:** `coder`.

**Files:**
- `api/message-pair.ts:233`, `:579-583`, `:601-604`
- `api/invitations-domain.ts:233-251` (`headerOf` goes)

**Interfaces:**
- Consumes: `REQUEST_HEADERS`, `requestFieldOf` (Task 3).

- [ ] **Step 1: `message-pair.ts`.**
  - `:233`'s `.some(…OPERATION_ID_HEADER)` becomes
    `requestFieldOf(fields, REQUEST_HEADERS.operationId)
    !== undefined`.
  - `ifMatchFromMessage` and `rawIfMatchFromMessagePair`
    read `requestFieldOf(model.fields,
    REQUEST_HEADERS.ifMatch)`. Each keeps its return and
    its `parseIfMatch` call.
  - The local `IF_MATCH_HEADER` import from Task 1 now
    has no use, so it goes. The re-export stays.
  - `requestHeaderFields` and `currentRequestId` stay as
    they are.
  - Subject: **Read stored request lines through
    declarations**.
- [ ] **Step 2: `invitations-domain.ts`.** Delete
  `headerOf`. Its two calls become
  `requestFieldOf(received.headerFields,
  REQUEST_HEADERS.ifNoneMatch)` and `….ifMatch`. Subject:
  **Read invitation preconditions via declarations**.
- [ ] **Step 3:** Run Task 5 Step 5's check on both
  commits, then `./test`.

**Acceptance:** two commits; `./test` green; the only
`.name ===` left under `api/` outside the names file is
`currentRequestId`'s (`grep -rn "\.name ===" api/`).

## Task 7: Read server headers through declarations

**Agent:** `coder`.

**Files:**
- `server/http-server.ts:174` (`secFetchMode`), `:242`
  (`contentLength`), `:457` (`acceptEncoding`), `:564`
  (`operationId`), `:720` (`forwarded`), `:723`
  (`xForwardedFor`)
- `server/status-page.ts:39` (`statusPageContentType`),
  `:43` (`accept`)

- [ ] **Step 1: `http-server.ts`.** The response reads at
  `:599` and `:746` stay as they are. Subject: **Read
  server headers through declarations**.
- [ ] **Step 2: `status-page.ts`.** `jsonRequested` keeps
  its signature. Subject: **Read status-page headers
  through declarations**.
- [ ] **Step 3:** Run Task 5 Step 5's check on both
  commits, then `./test`.

**Acceptance:** two commits; `./test` green;
`tests/http-server.test.ts` and the status-page tests
untouched and green.

## Task 8: Ban direct request-header reads

**Agent:** `planner`.

**Files:**
- Create: `tests/request-header-ban.test.ts`

**Interfaces:**
- Produces, inside the test file:
  ```ts
  interface DirectRead {
      readonly line: number;      // 1-based
      readonly text: string;      // the line, trimmed
      readonly enclosing: string; // top-level function,
                                  // '' at module level
  }
  function directReadsIn(source: string):
      readonly DirectRead[];
  ```

- [ ] **Step 1: Write the scanner's own tests first**
  (D10). `'the scanner sees each read shape'` runs
  `directReadsIn` over each snippet and compares the
  count:

  | Snippet | Reads |
  |---|---|
  | `request.headers.get('x-new')` | 1 |
  | `const v = request.headers\n    .get('x-new');` | 1 |
  | `request.headers?.get('x-new')` | 1 |
  | `headers.has(REQUEST_ID_HEADER)` | 1 |
  | `for (const [n] of request.headers) {}` | 1 |
  | `const copy = new Headers(request.headers);` | 1 |
  | `fields.find((f) => f.name === 'x-new')` | 1 |
  | `if (slot.name !== '') {}` | 0 |
  | `if (next.id !== pair.name) {}` | 0 |
  | `requestHeaderOf(request.headers, REQUEST_HEADERS.xNew)` | 0 |
  | `response.headers.get('request-id')` | 0 |
  | `response?.headers.has('cache-control')` | 0 |
  | `new Headers(response.headers)` | 0 |
  | `response.headers.set('ETag', tag)` | 0 |
  | `// request.headers.get('x-new')` | 0 |

  Add `'a read names its enclosing function'`: a read
  inside `function f() {` … `}` reports `enclosing: 'f'`.
- [ ] **Step 2: Red** (no scanner yet), then implement
  `directReadsIn` and turn it green.
- [ ] **Step 3: The tree tests.**
  - `'no file under api/ or server/ reads a request
    header directly'`: walk both trees (`.ts` only, sorted)
    and skip `api/request-header-names.ts`. Every read
    whose (file, enclosing) is not in `EXEMPT` fails the
    test. `EXEMPT` is `api/message-pair.ts` with
    `requestHeaderFields` and `currentRequestId`, each with
    a one-line reason.
  - `'every exemption still reads'`: each `EXEMPT` entry
    has at least one read.
  - The failure message lists `file:line text`. It names
    no header value, because source text holds none.
- [ ] **Step 4: Green.** `one tests/request-header-ban.test.ts`.
- [ ] **Step 5: The spec's oracle, by hand.**
  1. Add `request.headers.get('x-new');` inside
     `dispatched` in `api/api.ts`. Run the file: red,
     naming `api/api.ts`.
  2. Restore with `git checkout -- api/api.ts`.
  3. Add `xNew` (`'x-new'`, endpoint) to `REQUEST_HEADERS`,
     with an `unused` state in `request-headers.ts`, and
     read it in `dispatched` through `requestHeaderOf`.
     Run: green.
  4. Restore all three files with `git checkout --`.
  5. In `dispatched`, add
     `requestHeaderOf(request.headers, { name: 'x-new',
     surface: 'endpoint' });`. `./test validate --syntax`
     fails (D3: the accessor takes only a declared header).
     Restore with `git checkout -- api/api.ts`.
  6. Report all three runs.
- [ ] **Step 6: Commit.** Subject: **Ban direct
  request-header reads**.

**Acceptance:** green on the real tree; the self-test table
is in the file; both oracle runs reported.

## Task 9: Prove declared header states against the gate

**Agent:** `architect`.

**Files:**
- Create: `tests/request-header-states.test.ts`

**Interfaces:**
- Consumes: `REQUEST_HEADER_DECLARATIONS`, `RequestKind`,
  `RequestMethod` (Task 4); `GRANT_TYPES` (Task 2);
  `routes` (`api/routes.ts`); `offeredVerbs`,
  `routePatternOf` (`api/route-surface.ts`);
  `handleRequest` (`api/api.ts`).
- Fixtures, imported (never from a `.test.ts` file):
  - `memoryDbAdapter` (`api/db-memory.ts`);
  - `seedRootAdmin` (`tests/root-admin-fixture.ts`);
  - `organizationToken`, `devToken`
    (`tests/token-fixtures.ts`);
  - `testHashPassword` (`tests/mock-seed.ts`);
  - `seedPersonIdentity`, `seedIdentityCredential`,
    `seedClientRegistration`
    (`tests/identity-fixtures.ts`);
  - `seedAuthorizationCodeMessagePair`
    (`tests/authorization-code-fixtures.ts`);
  - `makeAssertionSigner`
    (`tests/client-assertion-fixtures.ts`);
  - `refreshTokenFromSetCookie`
    (`tests/http-fixtures.ts`);
  - `basicAuthorization` (`api/authentication.ts`);
  - `captureConsole`
    (`tests/fixtures/console-capture.ts`).

Sign-in worlds and their valid credential values. Each
request gets a new one:

| Kind | World | Body | Valid credential |
|---|---|---|---|
| `authentication/authorize` | `seedPersonIdentity` (email `demo@example.com`) and `seedIdentityCredential` (password `s3cret`, hashed by `testHashPassword`) for the root admin, plus `seedRootAdmin`, as `dbWithPasswordUser` in `tests/api-authentication-authorize.test.ts` | `{ method: 'password', client_id: 'web', code_challenge, code_challenge_method: 'S256' }` | `authorization: basicAuthorization('demo@example.com', 's3cret')` |
| token, `authorization_code` | `seedRootAdmin`, then `seedAuthorizationCodeMessagePair(db, code, root admin, 'web')` | `{ grant_type, client_id: 'web' }` | `basicAuthorization(code, '')` |
| token, `refresh` | the `authorization_code` world plus one 200 exchange of it | `{ grant_type }` | `cookie: 'refresh_token=' + refreshTokenFromSetCookie(res)` |
| token, `token-exchange` | `seedRootAdmin` | `{ grant_type }` | `'Bearer ' + await devToken()` |
| token, `client_credentials` | `makeAssertionSigner('ES256')`, `seedClientRegistration` with the signer's `jwks`, as `signedClientSetup` in `tests/api-authentication-token.test.ts` (copy the client row's fields) | `{ grant_type, client_id }` | `'Bearer ' + ` a fresh assertion with a new `jti` |
| token, no grant type | `seedRootAdmin` | `{ grant_type: 'password' }` | none |

Where `authorization` is `unused`, its value is
`'Bearer ' + await organizationToken()`. Where `cookie` is
`unused`, its value is `'refresh_token=' +
generateIdentifier()`. Other values:
- `transfer-encoding: chunked`;
- `content-length` set to the body's byte length, or `0`;
- `request-id` and `operation-id` set to
  `generateIdentifier()`;
- `content-type: application/json`;
- `if-match` set to `'"' + generateIdentifier() + '"'`;
- `if-none-match: *`.

- [ ] **Step 1: Write the test to D11.**
  - One `Deno.test` per driven declaration:
    `'<name> answers as declared on every request kind'`.
  - Each collects disagreements as
    `<METHOD> <pattern>[ <grant type>] <header> declared <state>:
    <check> answered <status> <error>` and ends with
    `assertEquals(disagreements, [])`.
  - No hasher seam is needed. The preload
    `tests/hmac-test-key.ts:19` already sets
    `setPasswordHasher(testHashPassword)`.
  - The PKCE pair is `s256Fields`'s (`:83` in the same
    file): the verifier `pkce-verifier-test`, with its
    base64url SHA-256 as the challenge.
  - Run each test's body under `captureConsole('warn',
    …)` nested in `captureConsole('error', …)`. Then
    assert that no captured argument, after
    `Deno.inspect` (not `JSON.stringify`, which turns an
    `Error` into `{}`), contains any `authorization` or
    `cookie` value the test sent (Review Focus 3). The
    failure message names the header and the kind, never
    the value.
  - The header comment states D11's limit.
- [ ] **Step 2: Run.** `one tests/request-header-states.test.ts`.
  Expected: `ok | 9 passed | 0 failed`. A disagreement is
  a stop condition. Report it with its line. Do not
  change a declared state or a refusal list to pass.
- [ ] **Step 3: The oracle.** Make each change below to
  `api/request-headers.ts` alone and run the file. Each
  turns red with a disagreement naming that header. Then
  restore with `git checkout -- api/request-headers.ts`:
  1. `operationId` → `optional`;
  2. `transferEncoding` → `optional`;
  3. `requestId` → `unused`;
  4. `contentLength` with a body → `optional`;
  5. `authorization` outside `AUTHENTICATION_ROUTES` →
     `unused`;
  6. `authorization` for `client_credentials` → `unused`;
  7. `cookie` for `refresh` → `unused`;
  8. `contentType` for QUERY → `unused`;
  9. `PRECONDITION_STATES['in-order'].ifMatch` →
     `optional`;
  10. `PRECONDITION_STATES['in-order'].ifNoneMatch` →
      `optional`;
  11. `PRECONDITION_STATES.required` → both `optional`;
  12. `PRECONDITION_STATES.none` → both `optional`;
  13. `PRECONDITION_STATES.required` →
      `{ ifMatch: 'required', ifNoneMatch: 'forbidden' }`,
      the `in-order` row.

  Report each run's first disagreement line.
- [ ] **Step 4:** Run `./test`, green. Report its summary
  lines.
- [ ] **Step 5: Commit.** Subject: **Prove declared header
  states against the gate**.

**Acceptance:** 9 tests green; all 13 oracle edits red;
nothing loosened; no value of `authorization` or `cookie`
appears in any assertion message.

## Task 10: Record the header-state later work

**Agent:** `coder`.

**Files:**
- Modify: `TODO.md` (`## Later work`)

Read TODO.md's head first. Each section runs from the best
ratio of benefit to cost down. Entries are plain bullets of
prose, each with an `Oracle:` sentence. Place each entry by
that ratio. Cite code by `file:line`.

- [ ] **Step 1: "The gate consumes the declared header
  states."** It records Approaches 2 of the spec:
  - what it buys: derivation with nothing to prove;
  - what it changes:
    - a presence rule on the sign-in routes, where a
      missing credential parses as empty and fails
      verification today;
    - the early refusals (`transfer-encoding`,
      `content-length`, `request-id`, `operation-id`)
      after the route match;
    - the refusal order that tests pin;
  - the hazard: authentication runs before the 404, so an
    unauthenticated caller cannot map routes. Reordering
    must not open a route-existence oracle;
  - the prerequisite: `tests/request-header-states.test.ts`,
    which shows any behaviour that moved.

  Oracle: no refusal over a header's presence decides from
  anything but the declaration.
- [ ] **Step 2: "Eliminate optional request headers."**
  Oracle: no `endpoint` declaration answers `optional` for
  any request kind. Its worklist, from the declarations:
  - the 30 optional preconditions: 8 DELETEs, 21 PUTs,
    and `POST organizations/:organization-id/record-types/`
    (`PRECONDITION_STATES.optional`,
    `api/request-headers.ts`);
  - that POST's If-Match turns on its body: a create
    refuses it (400, `api/routes.ts:4646`), and an edit
    demands it (428, `api/routes.ts:952`).

  It names `forwarded` and `x-forwarded-for` as optional
  by nature: a proxy sets them, and the server reads them
  only on the two sign-in paths that `server/throttle.ts:12`
  names. Both are outside the oracle.
- [ ] **Step 3: Commit.** Subject: **Record the
  header-state later work**.

**Acceptance:** both bullets under `## Later work`, each
with an oracle; nothing else in TODO.md changed.

---

## Task 11: Review the whole branch

**Agent:** `architect`.

Read the spec, this plan, AGENTS.md, and
`git diff master...HEAD`. Judge the branch against the
spec's Goals, its Anti-goals, and the Global Constraints.
Look in particular for:
- a refusal whose status, body, or order moved. Compare
  each converted read with its original by
  `git log -p -- <file>`;
- an existing test edited (`git diff master...HEAD
  --stat -- tests/` names only the five new files);
- a header-name string defined twice;
- a direct read the ban test cannot see;
- a declared state no test holds to the gate, other than
  the stated `site` and proxy rows (D6);
- a header value in any log, error, or assertion message;
- a move and a change in one commit;
- product code importing `api/request-headers.ts`.

Report findings by severity. A fresh `planner` fixes each
finding in its own commit, and a `coder` follows with a
scoped re-review. Fix rounds end when nothing important
remains. A fix must not touch the Task 1 commit's files
in a way that needs to live in the move. If one does,
stop and report.

## Task 12: Squash, validate, report

**Agent:** `coder`.

- [ ] **Step 1: Find the ends.**

```bash
MOVE=$(git log --format=%H \
    --grep='^Move the precondition header names$' -1)
BASE=$(git rev-parse "$MOVE^")
test "$(git rev-list --count master.."$BASE")" = 2
test -z "$(git status --porcelain)"
```
Expected: both `test`s exit 0. The move sits directly on
the plan commit, the plan and spec commits are the only
ones below it, and the tree is clean.

- [ ] **Step 2: Squash by tree** (outside the sandbox). The
  move commit is kept as it is, and the rest folds onto
  it:

```bash
T='Co-Authored-By: <your trailer>'
c2=$(git commit-tree "HEAD^{tree}" -p "$MOVE" \
    -m 'Declare the request headers the product reads' \
    -m "$T")
git reset --hard "$c2"
```
Expected: `git diff "$c2" ORIG_HEAD` is empty, since the
trees are the same. `git log --oneline master..HEAD` then
shows the spec and plan commits, followed by exactly these
two.

- [ ] **Step 3: The move stands alone.** Run
  `git checkout --detach "$MOVE"`, then
  `./test validate --syntax` and `./test`. Then
  `git checkout declared-request-headers`. Expected: green.
- [ ] **Step 4: Layer 1.** `./test validate`. Expected:
  exit 0.
- [ ] **Step 5: Postgres, once.** Run it only when
  `docker info` answers and `nc -z 127.0.0.1 5432` fails,
  meaning nothing listens there. Then run
  `./test postgres`. Expected: exit 0. Otherwise write
  "`./test postgres`: the operator's to run" and go on.
- [ ] **Step 6: `./test` after.** Run
  `/usr/bin/time -p ./test`, once.
- [ ] **Step 7: Report.**
  - The branch is `declared-request-headers`, resting
    squashed and green, with no merge.
  - The two feature commits' hashes and subjects.
  - Task 0's time and counts beside Step 6's. The
    difference in counts is this unit's new tests.
  - Task 2's compiler errors, Task 8's oracle runs, and
    Task 9's 13 red runs.
  - The checks left to the operator.

**Acceptance:** the two feature commits on top of the spec
and plan commits; Layer 1 green; the report delivered.
