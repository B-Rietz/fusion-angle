# Organization in the page URL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Every organization-scoped page carries
`organization=<id>` in its address. Arriving at a URL whose
organization is not the active one shows a one-click switch
offer (member) or a no-access screen (non-member) instead
of a broken page.

**Architecture:** Each `PAGE_REGISTRY` entry declares a
required `organizationScoped` flag. After the organization
gate settles the active organization, `bootApp` reads
`organization=` from the URL. Two pure functions decide the
arrival: proceed (stamp the active organization into the
address with `history.replaceState`), or a mismatch, which
fresh identity-scoped `getOrganizations` rows resolve to a
switch offer or no-access. The two screens are `SafeHtml`
presenters on the existing state container. The switcher
and the offer share one persist-then-move rule. The
switcher now moves to `/`.

**Tech Stack:** Deno 2.9.8, TypeScript under `deno.json`
(`strict`, `noUncheckedIndexedAccess`,
`verbatimModuleSyntax`, `erasableSyntaxOnly`),
`@std/assert`, `SafeHtml` presenters, Chrome over CDP for
`tests/browser/`.

**Spec:** `docs/superpowers/specs/organization-in-page-url-design.md`
(commit `7e52daf00`). Executors read the spec and this
plan. The spec is decided. This plan decides every "Left
to the builder" item (see Decisions). Neither is reopened.

## Decisions (marked: the planner's call)

- **Field name.** `organizationScoped: boolean`, required
  on `PageEntry`. It reads like its neighbours
  (`requiresAuth`, `searchable`). *Planner's call.*
- **Two pure functions, not one.** The table splits at the
  fetch. `resolvePageArrival(urlOrganization, active)`
  answers `proceed` or `mismatch`. Only a mismatch needs
  rows, and `resolveOrganizationMismatch(organization,
  reachable)` decides on them. Fresh rows (boot's walk
  rows, else one `getOrganizations`) always decide offer
  vs no-access, so the stale token claim never decides
  anything. This is fresher than the spec's "claim, then
  rows" and costs the same single fetch. Together the two
  functions cover the spec's table, and the tests walk it
  row by row. *Planner's call.*
- **Placement.** The pure decision and stamp go in a new
  `web-app/app/organization-address.ts`. The screens go in
  `web-app/app/loading-states.ts` beside `buildErrorState`
  and `buildEmptyState`. The I/O wrapper
  `bootPageOrganization` goes in `app-boot.ts` beside
  `bootOrganizationGate`. Two address adapters (`getHref`,
  `putAddress`) go in `web-app/app/adapters/location.ts`.
  *Planner's call.*
- **Icons and tone.** The switch offer uses `iconBuilding`
  with `state-icon-empty` (neutral; a question). No-access
  uses `iconNoEntry` with `state-icon-error` (a refusal).
  *Planner's call.*
- **Copy.** State titles carry no full stop, as
  "Something went wrong" does. Offer title: `This page is
  in <target>`. Description: `You're currently viewing
  <active>.` Button: `Switch to <target>`. No-access
  title: `You don't have access to this page`. It has no
  description, and one link, `Go to Dashboard`.
  *Planner's call, from the spec's mock-up.*
- **Stamp timing.** The stamp runs before any branch
  starts, so it precedes every page module's URL read.
  *Planner's call.*
- **An empty `organization=`** names no reachable
  organization, so it is no-access. Degrade visibly; there
  is no special case. *Planner's call.*
- **A failed rows fetch on a mismatch** goes through
  `handlePageLoadError`. The content area shows the
  existing error state, or a 401 goes to login. The
  sidebar still renders. *Planner's call.*
- **Task order departs from the requested order in two
  places.** First, the screen presenters (Task 4) land
  before the boot wiring (Task 6), because the wiring
  renders them. Second, the switcher's move to `/`
  (Task 5) also lands before the wiring. If it came
  after, the commits between would reload a URL stamped
  with the old organization and at once offer to switch
  back. That is the very bug the spec names under "The
  organization switcher". *Planner's call.*
- **Squash shape.** The design and plan commits stay as
  they are. Tasks 1–8 squash into one product commit,
  `Carry the organization in page URLs`. *Planner's
  call.*

## Global Constraints

- Parameter and every identifier spell `organization`. The
  `org` identifier ban holds under `api/`, `client/`,
  `web-app/`, `tests/`, `shared/`.
- Never switch the active organization without the
  viewer's click.
- Never show a non-member an organization's name, and
  never echo its id in page content.
- The URL authorizes nothing. There is no new endpoint,
  and the fence and token-exchange semantics do not change.
- Organization-scoped pages: dashboard, organization,
  ideas, idea-detail, idea-create, idea-convert, projects,
  project-detail, records, record-create, record-detail,
  flows, flow-detail, flow-stats, workbox, workbox-detail,
  members, member-detail, billing, identities,
  identity-detail (21). Every other entry is `false`.
- Out of scope: per-status error states, a 404 membership
  probe, the stale header select, organization in the API
  path.
- 78-char lines in linted files (not `.md`), 4-space
  indent, no inline styles.
- Under the sandbox: `export DENO_DIR="$TMPDIR/deno-dir"`
  before any `deno`, `./test`, or `./deploy`. Git commands
  that write the index may need to run outside the sandbox
  (`.git/worktrees` is read-only there).

## Review Focus

1. **The rows lookup fails on a mismatch** (network, 5xx).
   Expect the existing error state with Try Again, not a
   blank content area or a stuck skeleton. Task 6 wires
   it; Task 8 case 4 pins it.
2. **An organization name containing markup** reaches the
   offer. Expect it escaped, never rendered. Task 4 pins
   it.
3. **Duplicate or stale `organization=` parameters.**
   Expect the stamp to collapse them to one, carrying the
   active id. Task 3 pins it.
4. **`?organization=` with an empty value.** Expect
   no-access, not a crash and not a silent load. Task 2
   pins it.
5. **An organization-scoped page that is auth-exempt.**
   The check runs only in the gated boot branch, so such a
   page would skip it silently. Expect none to exist.
   Task 1 pins it.

---

## Subagent brief (every task's brief starts here)

Each task's brief begins with the literal line
`Go to Medium Church!`, then carries this block, then the
task text (Files, Interfaces, Steps) verbatim:

> Work in `/Users/tmornini/code/fusion-angle/.worktrees/organization-in-page-url`
> (branch `organization-in-page-url`). Never edit the main
> checkout, and never pass the Agent tool `isolation`.
> Read `AGENTS.md`, then the spec
> `docs/superpowers/specs/organization-in-page-url-design.md`.
> Under the sandbox, `export DENO_DIR="$TMPDIR/deno-dir"`
> first. Voice: 78-char max line in linted files, 4-space
> indent, no inline styles (CSS custom properties +
> classes per DESIGN-SYSTEM.md). The `org` identifier ban
> applies: spell `organization`. Presenters return
> `SafeHtml` via `html```. Client verbs take
> `RequestContext` first. Use HTTP-verb naming
> (`getNoun`/`putNoun`/`deleteNoun`/`postNounOperation`).
> Validators sit at the gate, not downstream. No untyped
> `any`. Test first: write the red test, watch it fail,
> then write the code. Tests assert behaviour, not
> implementation. Commit with the exact subject given,
> one line, then a blank line and
> `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`,
> no body. If `git commit` fails with "Operation not
> permitted" on `.git/worktrees`, rerun it outside the
> sandbox. Abominations to refuse: default values (`?? ''`,
> `|| fallback`, defaulted parameters), internal defense
> (re-checking validated data), unbidden helper code,
> test weakening, premature generalization.

Each task adds its own commandment and abomination lines.

---

### Task 1: Declare each page's organization scope

Role: `coder`.
Commandments: III Uniformity, I Reliability. Risks: default
values (an optional field defaulting to `false`), test
weakening.

**Files:**
- Modify: `web-app/app/page-registry.ts` (`PageEntry`, all
  29 entries)
- Test: `tests/page-registry.test.ts`

**Interfaces:**
- Produces: `PageEntry.organizationScoped: boolean`
  (required). It carries a one-line comment: true when
  the server fences the page's reads on the token's
  organization, and boot stamps and checks
  `organization=` only on these pages.

- [ ] **Step 1: Write the failing tests** in
  `tests/page-registry.test.ts`:

```ts
const ORGANIZATION_SCOPED = [
    'billing', 'dashboard', 'flow-detail', 'flow-stats',
    'flows', 'idea-convert', 'idea-create', 'idea-detail',
    'ideas', 'identities', 'identity-detail',
    'member-detail', 'members', 'organization',
    'project-detail', 'projects', 'record-create',
    'record-detail', 'records', 'workbox',
    'workbox-detail',
];

Deno.test('organization-scoped pages are the fenced ones',
() => {
    const scoped = Object.entries(PAGE_REGISTRY)
        .filter(([, e]) => e.organizationScoped)
        .map(([k]) => k)
        .sort();
    assertEquals(scoped, ORGANIZATION_SCOPED);
});

Deno.test('every organization-scoped page is gated', () => {
    for (const [key, entry] of Object.entries(PAGE_REGISTRY)) {
        if (entry.organizationScoped) {
            assertStrictEquals(pageAuthMode(key), 'gated', key);
        }
    }
});
```

- [ ] **Step 2: Run `./test`.** Expected: FAIL. `scoped`
  is `[]` because `--no-check` reads the absent field as
  `undefined`.
- [ ] **Step 3: Add the required field** to `PageEntry`.
  Set it on every entry: `true` for the 21 listed, `false`
  for invitations, identity-providers, identity-tokens,
  api-documentation, design-system, auth, landing, and
  not-found.
- [ ] **Step 4: Run `./test validate --syntax` then
  `./test`.** Expected: both PASS.
- [ ] **Step 5: Commit** `Declare each page's organization
  scope`.

---

### Task 2: Decide a page's arrival

Role: `coder`.
Commandments: IV Logic, VIII Simplicity. Risks: premature
generalization (no options object, no third parameter),
cleverness.

**Files:**
- Create: `web-app/app/organization-address.ts`
- Test: `tests/organization-address.test.ts`

**Interfaces:**
- Produces:

```ts
export const ORGANIZATION_PARAM = 'organization';
export type PageArrival =
    | { readonly kind: 'proceed' }
    | { readonly kind: 'mismatch';
        readonly organization: string };
export type OrganizationMismatch =
    | 'switch-offer'
    | 'no-access';
export function resolvePageArrival(
    urlOrganization: string | null,
    activeOrganization: string,
): PageArrival;
export function resolveOrganizationMismatch(
    organization: string,
    reachable: readonly string[],
): OrganizationMismatch;
```

  Module comment: these two decide the spec's arrival
  table. The first needs no I/O. Only a mismatch fetches
  rows, and the fresh rows decide the second.

- [ ] **Step 1: Write the failing tests**, one per table
  row (Stark `AjdvjuECVZEgZoFajaIEkg`, Wayne
  `BBjWJsjYIDkTRKIIPrzWRw`, foreign
  `QQQQQQQQQQQQQQQQQQQQQQ`):
  - `an absent organization proceeds`:
    `resolvePageArrival(null, STARK)` deep-equals
    `{ kind: 'proceed' }`.
  - `the active organization proceeds`:
    `resolvePageArrival(STARK, STARK)` gives `proceed`.
  - `another organization is a mismatch`:
    `resolvePageArrival(WAYNE, STARK)` gives
    `{ kind: 'mismatch', organization: WAYNE }`.
  - `a reachable mismatch offers the switch`:
    `resolveOrganizationMismatch(WAYNE, [STARK, WAYNE])`
    is `'switch-offer'`.
  - `an unreachable mismatch has no access`:
    `resolveOrganizationMismatch(FOREIGN, [STARK, WAYNE])`
    is `'no-access'`.
  - `an empty organization has no access` (Review Focus
    4): `resolvePageArrival('', STARK)` is a mismatch
    with `organization: ''`, and
    `resolveOrganizationMismatch('', [STARK, WAYNE])` is
    `'no-access'`.
- [ ] **Step 2: Run `./test`.** Expected: FAIL (module not
  found).
- [ ] **Step 3: Implement both functions.**
- [ ] **Step 4: Run `./test validate --syntax` then
  `./test`.** Expected: PASS.
- [ ] **Step 5: Commit** `Decide a page's arrival
  organization`.

---

### Task 3: Stamp the organization into an address

Role: `coder`.
Commandments: VI Immutability (return a new string; never
mutate a caller's `URL`), V Clarity. Risks: cleverness
(hand-built query strings), default values.

**Files:**
- Modify: `web-app/app/organization-address.ts`
- Test: `tests/organization-address.test.ts`

**Interfaces:**
- Consumes: `ORGANIZATION_PARAM` (Task 2).
- Produces: `export function stampOrganization(href:
  string, organization: string): string`. It takes an
  absolute `href` and returns
  `pathname + search + hash`, with `organization=` set
  once. Use `URL` plus `URLSearchParams.set`, which keeps
  the first occurrence's position and drops later
  duplicates.

- [ ] **Step 1: Write the failing tests** (S = Stark id,
  W = Wayne id):
  - `a stamp adds the organization`:
    `stampOrganization('http://local/dashboard/index.html',
    S)` is `'/dashboard/index.html?organization=' + S`.
  - `a stamp keeps other parameters and the fragment`:
    `'http://local/flows/detail.html?flowId=F1#node'`
    gives `'/flows/detail.html?flowId=F1&organization='
    + S + '#node'`.
  - `a stamp replaces a stale organization`:
    `'http://local/ideas/index.html?organization=' + W
    + '&x=1'` gives `'/ideas/index.html?organization='
    + S + '&x=1'`.
  - `a stamp collapses duplicates` (Review Focus 3):
    `'?organization=' + W + '&x=1&organization=QQ'`
    on `/ideas/index.html` gives
    `'/ideas/index.html?organization=' + S + '&x=1'`.
- [ ] **Step 2: Run `./test`.** Expected: FAIL
  (`stampOrganization` not exported).
- [ ] **Step 3: Implement `stampOrganization`.**
- [ ] **Step 4: Run `./test validate --syntax` then
  `./test`.** Expected: PASS.
- [ ] **Step 5: Commit** `Stamp the organization into a
  page address`.

---

### Task 4: Build the switch offer and no-access screens

Role: `coder`.
Commandments: II Security (escape names; never disclose),
V Clarity. Risks: unbidden helper code (no generic "state
builder" refactor of `buildErrorState`/`buildEmptyState`),
inline styles.

**Files:**
- Modify: `web-app/app/loading-states.ts`
- Test: `tests/loading-states.test.ts`

**Interfaces:**
- Produces:

```ts
export function buildSwitchOfferState(
    targetName: string,
    activeName: string,
): SafeHtml;
export function buildNoAccessState(
    dashboardHref: string,
): SafeHtml;
```

  Both use `.state-container`, `.state-icon`,
  `.state-title`, `.state-description` as
  `buildEmptyState` does. The offer's icon is
  `iconBuilding(ICON_SIZE['2xl'], '')` in `state-icon
  state-icon-empty`. Its description is `You're currently
  viewing ${activeName}.`. Its button is
  `<button class="btn btn-primary"
  data-switch-organization-btn>Switch to
  ${targetName}</button>`. No-access uses
  `iconNoEntry(ICON_SIZE['2xl'], '')` in `state-icon
  state-icon-error`. Its link is `<a
  href="${dashboardHref}" class="btn btn-primary">Go to
  Dashboard</a>`. It has no description paragraph.

- [ ] **Step 1: Write the failing tests:**
  - `the switch offer names both organizations`: the
    output of `buildSwitchOfferState('Wayne Enterprises',
    'Stark Industries').toString()` includes `This page
    is in Wayne Enterprises`, `You're currently viewing
    Stark Industries.`, `Switch to Wayne Enterprises`,
    `data-switch-organization-btn`, and
    `state-icon-empty`. It does not include
    `state-icon-error`.
  - `the switch offer escapes organization names` (Review
    Focus 2): `buildSwitchOfferState('<b>W</b>',
    'Stark')` includes `&lt;b&gt;W&lt;/b&gt;` and not
    `<b>W</b>`.
  - `no access links to the dashboard`:
    `buildNoAccessState('../dashboard/index.html')`
    includes `You don't have access to this page`,
    `href="../dashboard/index.html"`, `Go to Dashboard`,
    and `state-icon-error`. It does not include
    `data-switch-organization-btn`.
- [ ] **Step 2: Run `./test`.** Expected: FAIL (not
  exported).
- [ ] **Step 3: Implement both presenters.**
- [ ] **Step 4: Run `./test validate --syntax` then
  `./test`.** Expected: PASS.
- [ ] **Step 5: Commit** `Build the switch offer and
  no-access screens`.

---

### Task 5: Enter from the root after a switch

Role: `coder`.
Commandments: I Reliability (persist, then move), IX
Generality (one rule for switcher and offer, shared through
a `move` callback). Risks: test weakening (the deleted
tests pin a covenant the spec revokes; delete them, do not
rewrite them), swallowed failures.

**Files:**
- Modify: `web-app/app/organization-switcher.ts`
- Test: `tests/organization-switcher.test.ts`
- Modify: `TEST-PLAN.md` (D16, G36 prose)

**Interfaces:**
- Produces:

```ts
// Persist the chosen organization, then move. A false
// persist toasts and never moves.
export function switchToOrganization(
    organization: string,
    move: () => void,
): void;
// The switcher's choice: switch, then enter from the
// top at '/', which lands on the Dashboard.
export function chooseOrganization(
    organization: string,
): void;
```

  `chooseOrganization` is
  `switchToOrganization(organization, () =>
  putLocation('/'))`. `wireOrganizationSwitcher`'s change
  handler calls `chooseOrganization(el.value)`. Delete
  `urlAfterOrganizationSwitch`, its three tests (`a switch
  off convert…`, `a switch on the ideas index…`, `a switch
  on idea detail…`), and the comment that names the
  convert case.

- [ ] **Step 1: Write the failing tests** in
  `tests/organization-switcher.test.ts`. Before the
  module import, stub `globalThis.window = { location:
  fakeLocation }`, as `tests/navigation.test.ts` does.
  Stub `sessionStorage` and the minimal `document` that
  `showToast` paints into, as `installDom` in
  `tests/toast-pending.test.ts` does. Use
  `withLocalStorage` from `tests/fixtures/local-storage.ts`.
  - `a confirmed switch persists, then enters from the
    root`: a fake `setItem` records into a `Map`. After
    `chooseOrganization(WAYNE)`, the map holds `WAYNE`
    under `'fusion-angle:active-organization-id'` and
    `fakeLocation.href` is `'/'`.
  - `a refused switch toasts and stays`: the fake
    `setItem` throws `new DOMException('full',
    'QuotaExceededError')`. After `chooseOrganization(WAYNE)`,
    `fakeLocation.href` is still `''`. The pending toast
    in the stubbed `sessionStorage` carries `Could not
    switch organization — please try again.`
  - `switchToOrganization moves only after the persist`:
    the `move` callback reads the recorded map. It sees
    `WAYNE` and runs exactly once.
- [ ] **Step 2: Run `./test`.** Expected: FAIL
  (`chooseOrganization` not exported).
- [ ] **Step 3: Implement.** Export
  `switchToOrganization` with `move`, and add
  `chooseOrganization`. Delete `urlAfterOrganizationSwitch`
  and its tests. Keep the toast copy unchanged.
- [ ] **Step 4: Update `TEST-PLAN.md`.** In D16, "the
  switch leaves `ideas/convert.html` for
  `ideas/index.html`" becomes "the switch lands on the
  Dashboard". Drop its pin to the deleted test, and pin
  the new `a confirmed switch persists, then enters from
  the root`. In G36, "the page does a FULL reload onto
  Wayne: Ideas shows…" becomes "the page lands on Wayne's
  Dashboard; open Ideas and Members: Ideas shows…". Touch
  nothing else in either case.
- [ ] **Step 5: Run `./test validate --syntax` then
  `./test`.** Expected: PASS. Also run `grep -rn
  urlAfterOrganizationSwitch web-app tests client`.
  Expected: no output.
- [ ] **Step 6: Commit** `Enter from the root after an
  organization switch`.

---

### Task 6: Check and stamp the page organization at boot

Role: `planner`.
Commandments: I Reliability, II Security, VIII Simplicity.
The Office of the Context also applies: read the token
once, per boot. Risks: internal defense (no re-validating
the token after the gate), default values (no `?? []`
over absent rows), swallowed failures (the rows fetch
error must surface), greedy catch (one `try` around one
call), premature optimization (no extra performance mark).

**Files:**
- Modify: `web-app/app/app-boot.ts`
- Modify: `web-app/app/adapters/location.ts`

**Interfaces:**
- Consumes: `PageEntry.organizationScoped` (Task 1).
  `ORGANIZATION_PARAM`, `resolvePageArrival`,
  `resolveOrganizationMismatch`, `stampOrganization`
  (Tasks 2–3). `buildSwitchOfferState`,
  `buildNoAccessState` (Task 4). `switchToOrganization`
  (Task 5). `buildPageUrl` (`navigation.ts`), `getUrlParam`
  (`adapters/url-params.ts`), `getOrganizations`
  (`client/organizations.ts`), `$required` (`dom.ts`),
  `setHtml`.
- Produces, in `adapters/location.ts`:
  `export function getHref(): string` (returns
  `window.location.href`), and
  `export function putAddress(url: string): void`. The
  second calls `history.replaceState(history.state, '',
  url)`. It rewrites the address without a reload.
- Produces, in `app-boot.ts` (module-private):

```ts
// Returns true when the page may init (the address now
// carries the active organization), false once it has
// rendered the switch offer or no-access.
async function bootPageOrganization(
    bootOrganizations:
        readonly HttpMessage<OrganizationEntity>[] | null,
): Promise<boolean>;
```

- [ ] **Step 1: Implement `bootPageOrganization`.**
  1. Read `active` from `principalFromToken(
     getClient().getSessionToken()).organization`. If it
     is `undefined`, throw `new Error('boot left an
     organization-scoped page unscoped')`. The gate
     guarantees a scope, so absence is a bug and must
     crash.
  2. Compute `resolvePageArrival(getUrlParam(
     ORGANIZATION_PARAM), active)`. On `proceed`, call
     `putAddress(stampOrganization(getHref(), active))`
     and return true.
  3. On a mismatch, use `bootOrganizations ?? await
     getOrganizations(sessionContext())`. Boot's walk
     rows are fresh; `null` means the sidebar was going
     to self-fetch, so fetch here.
  4. Resolve `resolveOrganizationMismatch(
     arrival.organization, rows.map(o =>
     o.body().toValue().id))`.
  5. Render into `$required('.page-content', document)`.
     For `switch-offer`, take both names from the rows by
     id. Name lookup throws if absent; that is impossible,
     since both ids came from these rows. Then call
     `setHtml(buildSwitchOfferState(targetName,
     activeName))`. Wire `[data-switch-organization-btn]`
     `click` to `switchToOrganization(target, () =>
     location.reload())`. For `no-access`, call
     `setHtml(buildNoAccessState(buildPageUrl(
     'dashboard')))`. Return false.
- [ ] **Step 2: Wire it into `bootApp`.** Place this after
  the auth/organization gate block and before `branches`
  is built. When `PAGE_REGISTRY[pageName]?.organizationScoped
  === true`, await `bootPageOrganization(
  bootOrganizations)` inside one `try`. A rejection goes
  to `handlePageLoadError(pageName, err)` and counts as
  "may not init" (Review Focus 1). Push the page-init
  branch only when the page may init. The sidebar and
  palette branches always run. `recordPageReady` stays
  gated on `pageReady`, so neither screen records ready.
  Pages that are not organization-scoped are untouched.
- [ ] **Step 3: Run `./test validate --syntax` then
  `./test`.** Expected: PASS. This task's behaviour is
  pinned at Layer 2 by Task 8. It needs no new Layer 1
  test: `bootApp` has no Layer 1 harness, and its
  decisions are already pure and pinned (Tasks 2–4).
- [ ] **Step 4: Commit** `Check and stamp the page
  organization at boot`.

---

### Task 7: Show both screens in the design system

Role: `coder`.
Commandments: III Uniformity, V Clarity. Risks: test
weakening. The byte pin in
`tests/design-system-render.test.ts` is meant to move on a
paint edit. Update its length and digest to the new
render, and change nothing else in that test.

**Files:**
- Modify: `web-app/design-system/index.ts` (the "Error &
  System States" section)
- Modify: `tests/design-system-render.test.ts`

**Interfaces:**
- Consumes: `buildSwitchOfferState`,
  `buildNoAccessState` (Task 4), and `buildPageUrl`.

- [ ] **Step 1: Write the failing test** in
  `tests/design-system-render.test.ts`:
  `the showcase shows the organization screens`. The
  output of `buildDesignSystemPage().toString()` includes
  `data-switch-organization-btn`, `This page is in Wayne
  Enterprises`, and `You don't have access to this page`.
- [ ] **Step 2: Run `./test`.** Expected: FAIL.
- [ ] **Step 3: Add two cards** after "Full Page Error",
  in the section's existing card idiom. One is headed
  "Switch Offer" and renders `buildSwitchOfferState(
  'Wayne Enterprises', 'Stark Industries')`. The other is
  headed "No Access" and renders `buildNoAccessState(
  buildPageUrl('dashboard'))`. Its button is inert.
- [ ] **Step 4: Run `./test`.** The new test passes. The
  byte pin fails, and its message prints the new length.
  Compute the new digest with `sha256Hex`. Put both into
  the pin, then rerun `./test validate --syntax` and
  `./test`. Expected: PASS.
- [ ] **Step 5: Commit** `Show the organization screens in
  the showcase`.

---

### Task 8: Pin arrival in the browser

Role: `planner`.
Commandments: I Reliability. The Office of Verification
also applies: an isolated world per test, no false
prophets. Risks: test weakening, polling without a bound
(use `page.until`/`waitFor`, never bare sleeps), unbidden
helper code (no new fixture in `fixtures.ts`; keep the one
local helper in the test file).

**Files:**
- Create: `tests/browser/organization-in-page-url.test.ts`

**Interfaces:**
- Consumes: `useBrowser`, `withAdminPage`, `startOrigin`,
  `signIn`, `withTimeout`, `withHeldRequests`
  (`tests/browser/fixtures.ts`); `registryUrl`
  (`web-app/app/browser-drive.ts`);
  `STARK_ORGANIZATION`, `ORGANIZATION_TWO`
  (`api/mock-data/seed-constants.ts`). Wayne's seeded
  `approved` idea is `WurwPqXxGtLhRAoCEcPzfQ` ("Automated
  Report Generation"). Seed names are `Stark Industries`
  and `Wayne Enterprises`. The active key is
  `fusion-angle:active-organization-id`.

The tests below read `location.search` with
`page.evaluate`. They read the active organization from
`localStorage`, and visible text from
`document.querySelector('.page-content').textContent`.
Every test first opens `ideas` and waits for
`page.ready('ideas')`. It then asserts that the stored
active organization is `STARK_ORGANIZATION`. That pins
the precondition, and fails by name if the seed's
default ever moves.

- [ ] **Step 1: Write the tests:**
  1. `an organization-scoped page gains its organization
     in the address`: after the precondition, the
     `organization` parameter is `STARK_ORGANIZATION`.
     Then open `idea-detail` with
     `ideaId=YvOylAxOjQcgmNmsSoVBPQ` (seed index 0, so
     Stark; confirm in `api/mock-data/ideas.ts`) and no
     `organization`. After `ready`, the address has
     both `ideaId` and `organization=STARK`.
  2. `another of the viewer's organizations offers the
     switch`: open `idea-detail` with
     `ideaId=WurwPqXxGtLhRAoCEcPzfQ&organization=` +
     `ORGANIZATION_TWO`. Wait for
     `[data-switch-organization-btn]`. The content
     includes `This page is in Wayne Enterprises` and
     `You're currently viewing Stark Industries.`, and
     has no `[data-retry-btn]`. The address is unchanged.
     Click the button. Then `page.ready('idea-detail')`,
     the stored active organization is
     `ORGANIZATION_TWO`, the content includes `Automated
     Report Generation`, and the address still carries
     `organization=ORGANIZATION_TWO`.
  3. `a foreign organization's page shows no access and
     no name`: use a local `withPageAs(email, fn)` that
     mirrors `withAdminPage` (same `withTimeout`, the
     same acquisition and release order). Sign in as
     `mike.thompson@company.com`, a Wayne-only member.
     Open `ideas` with `organization=STARK_ORGANIZATION`.
     Skip the Stark precondition here; Mike has Wayne
     active. Wait for the link `Go to Dashboard`. The
     content includes `You don't have access to this
     page`. It includes neither `Stark Industries` nor
     `STARK_ORGANIZATION`. There is no
     `[data-switch-organization-btn]`.
  4. `a failed organization lookup shows the error state`
     (Review Focus 1): after the precondition, take a
     `withHeldRequests` hold on
     `*/identities/*/organizations/*` that holds every
     match. Open the Wayne URL from case 2. Fail each
     held request as it arrives until
     `[data-retry-btn]` shows. Assert there is no
     `[data-switch-organization-btn]`.
- [ ] **Step 2: Prove the tests bite.** Put back the
  pre-wiring boot. Run `git checkout <Task 5 sha> --
  web-app/app/app-boot.ts`, then `./test browser`. Cases
  1–3 must FAIL. Case 4 may pass there, because an
  unwired boot also ends in the 404 error state. It
  bites only against wiring that drops the rejection,
  which the Task 9 review checks. Restore with `git
  checkout HEAD -- web-app/app/app-boot.ts`. Confirm
  `git status` shows only the new test file.
- [ ] **Step 3: Run `./test validate --syntax` then
  `./test browser`.** Expected: all browser tests PASS,
  the new file included.
- [ ] **Step 4: Commit** `Pin the page organization in the
  browser`.

---

### Task 9: Review, squash, and gate

Role: `architect` for the review. The master session
does the squash and gates.

- [ ] **Step 1: Whole-branch review.** Dispatch
  `architect`, with a brief that begins `Go to Medium
  Church!`. Give it the spec, this plan, and `git diff
  master...organization-in-page-url`. Ask it to check
  each Goal, Non-goal, and Anti-goal against the diff,
  and each Review Focus line against its pin. Also ask
  it to confirm no organization name or id reaches a
  non-member's screen, and that no path switches the
  active organization without a click. Fix findings in
  new commits on the branch, each gated by `./test
  validate --syntax`.
- [ ] **Step 2: Squash.** Keep `Add the
  organization-in-page-url design` and the plan commit.
  Squash every product commit into one commit with the
  subject `Carry the organization in page URLs` and the
  Co-Authored-By trailer.
- [ ] **Step 3: Layer 1.** Run `./test validate`.
  Expected: PASS.
- [ ] **Step 4: Layer 2.** Run `./test validate browser`.
  Expected: PASS.
- [ ] **Step 5: Report** the branch name
  `organization-in-page-url` to the operator. Do not
  merge; the operator initiates every merge.
