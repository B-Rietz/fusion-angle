# Organization in the page URL — design

## Intent

A page URL names a document but not the organization that owns it.
The organization rides only the session token, so a URL means
something only relative to whichever organization the viewer has
active. Every way of arriving at a page hits this:

- a link shared through Messages (the operator's case: signed in as
  `demo@` with Stark active, opened a Wayne flow link);
- a bookmark or a history entry;
- the organization switcher, which persists the new organization
  and reloads the same URL (the reporter's case: Stark flow open in
  the designer, switched to Wayne);
- a second tab: the active organization persists per browser, so a
  switch in one tab breaks a detail page reloaded in another.

Each ends in "Something went wrong — Not found: flows/…" with the
raw API URL. The API is right: a foreign id is 404 by design, so no
tenant can probe another. The client sent a URL the active token
cannot serve.

The fix: every organization-scoped page carries its organization in
its URL. On arrival, a URL naming an organization the identity
belongs to, but which is not active, gets a clear explanation and a
one-click switch instead of a broken page.

## Goals

- Every organization-scoped page's address bar shows
  `organization=<id>`, however the page was reached, so any copied
  URL carries its organization.
- Opening a URL whose organization differs from the active one, when
  the identity is a member: the page does not load its data and
  instead shows the switch offer:

  ```
            ⇄
     This page is in Wayne Industries
     You're currently viewing Stark Industries.

        [ Switch to Wayne Industries ]
  ```

  The button persists the URL's organization as active and reloads
  the same URL, which then loads normally.
- Opening a URL whose organization the identity is not a member of
  (or which does not exist): "You don't have access to this page",
  with a link to the Dashboard. The foreign organization's name is
  never shown — the server refuses it to non-members (403), and the
  screen does not disclose it either.
- The organization switcher navigates to `/` after persisting the
  choice. `/` enters from the top: it probes the session and lands on
  the Dashboard under the new organization.

## Non-goals

- Friendlier per-status error states (404, 410, 403, 5xx) in
  `buildErrorState`. That is the next unit; this one leaves the 404
  screen as it is. A URL without `organization=` (every link shared
  before this lands) behaves exactly as today.
- Probing other memberships on a 404 to find a document's owner.
  The same id may exist in two organizations as two documents, and
  the probe costs a token exchange per membership. Not built.
- The header select showing the wrong organization when the page
  body fails to load (observed in the reporter's screenshot). A
  separate bug with its own red test.
- Pages that read only the viewer's own identity (invitations,
  identity providers, identity tokens) carry no organization and
  get no check.

## Anti-goals

- Never switch the active organization without the viewer's click.
  The active organization is per browser; a silent switch would
  change every other open tab, the same class of surprise this unit
  removes.
- Never put the organization in the API path or let the page URL
  authorize anything. The URL only says which token to ask for; the
  token exchange fences on membership, and the API fences on the
  token. ARCHITECTURE.md `## Tenancy` stands unchanged.
- Never reveal an organization's name to a non-member.

## Constraints

- Page URLs stay relative, one HTML file per page
  (AGENTS.md `### HTTP only`).
- The organization fence and token-exchange semantics do not change:
  a non-member exchange is 403 and mints nothing.
- No new server endpoint. Membership comes from what boot already
  has (the token's `organizations` claim, or the walk's
  `getOrganizations` rows); the organization's display names come
  from the identity-scoped `getOrganizations`, fetched only on a
  mismatch when boot did not already hold the rows.
- The `org` identifier ban applies: the parameter and every name
  spell `organization`.
- An open tab never changes organization behind the viewer's back,
  so this unit covers arrival (boot and reload) only. A mid-session
  recovery re-scopes the refreshed token to the request's own
  organization claim and neither reads nor writes the persisted
  choice (`rescopeToActiveOrganization` in
  `client/request-context.ts`, F-109). A tab adopting a peer's
  refresh through the `fusion-angle:refresh` channel receives the
  flat (organization-agnostic) token and re-scopes it the same
  way. A switch in one tab therefore reaches another tab only when
  that tab reloads, which is exactly when this unit's check runs.
- Login's `?return=` already preserves the query, so a signed-out
  viewer opening a shared link signs in and returns to the URL with
  `organization=` intact; the check then runs.

## Approaches

**A. Boot stamps the address and checks it — chosen.** One place in
`bootApp` reads `organization=` from the URL before any page data
loads, and, once the active organization is settled, rewrites the
address with `history.replaceState` (no reload). Covers every
arrival path: `/`, login return, typed URLs, old links, in-app
links. Cost: the address changes once per load; old links are not
checked, though the address gains the stamp on arrival.

**B. Stamp every link `buildPageUrl` emits.** Misses every address
not built there — `/`'s redirect to the Dashboard, the login return,
typed and old URLs — whose address bars would then lack the
organization and recreate the bug when copied. With A in place it
adds nothing. Rejected.

**C. Organization as a path segment (`/<id>/flows/detail.html`).**
Changes server routing, every relative `../` link, and every page's
location, and blurs "organization rides the verified token, never
the path". Much risk, no added behaviour. Rejected.

The operator chose A, and chose the switch offer (ask with a button)
over an automatic switch.

## Design

### Which pages are organization-scoped

Each `PAGE_REGISTRY` entry gains a required (non-optional) field
declaring whether the page is organization-scoped, so the compiler
forces a decision on every new page. Proposed name:
`organizationScoped: boolean`.

Expected `true`: dashboard, organization, ideas, idea-detail,
idea-create, idea-convert, projects, project-detail, records,
record-create, record-detail, flows, flow-detail, flow-stats,
workbox, workbox-detail, members, member-detail, billing,
identities, identity-detail.

Expected `false`: invitations, identity-providers,
identity-tokens, and the public pages (api-documentation,
design-system, auth, landing, not-found).

The rule is whether the server fences the page's reads on the
token's organization — not whether the path sits under
`organizations/<id>/`. `GET identities/` answers the fenced
organization's accepted seats, and a non-self identity read
outside the token's organization is 403 (`api/api.ts`, ARCHITECTURE.md
`## Tenancy`), so the identities list and identity detail are
organization-scoped. Invitations, identity providers and identity
tokens read only the viewer's own identity and load under any
organization. Billing reads nothing today; it is `true` because
billing belongs to an organization. (Design-review findings; the
identity and billing values are the designer's calls.)

The viewer's own identity detail gets no exception: opened under
another organization it shows the switch offer although it would
have loaded. Sharing a link to one's own profile is rare, the offer
is harmless, and an exception would add a fourth input to the
decision for little gain. (Designer's call.)

### The boot decision

After `bootOrganizationGate` settles the active organization, and
before the page branches run, boot decides, for an
organization-scoped page, from three inputs — the URL's
`organization` (or none), the active organization, and the
identity's reachable organizations:

| URL organization | Outcome |
|---|---|
| absent | proceed; stamp the active organization |
| equals active | proceed; stamp (already present) |
| reachable, not active | render the switch offer; no page init; URL kept as-is |
| not reachable | render no-access; no page init; URL kept as-is |

The decision is a pure function, unit-tested over the table.

"Reachable" must be fresh. The token's `organizations` claim lags
membership changes by up to the access TTL (15 minutes), so when
the URL's organization is absent from the claim, boot fetches the
identity-scoped `getOrganizations` (unless the walk already
returned its rows) and those rows decide between the switch offer
and no-access. That is the same single fetch the switch offer
needs for display names, so a member added minutes ago sees the
offer, not a false no-access. (Designer's call.)

On *proceed*, boot calls `history.replaceState` with the current
URL plus `organization=<active>`, preserving every other parameter
and the fragment. Not organization-scoped pages are never stamped
and never checked.

On *switch offer* and *no-access*, the sidebar chrome still renders
(scoped to the active organization, as today), and the page content
area shows the screen instead of `initPageModule`. The page does not
record ready (no page init ran).

### The switch offer

Names both organizations from the identity-scoped
`getOrganizations` rows (boot's own rows when the walk ran;
otherwise one fetch). The button persists the URL's organization as
active with the same persist-then-move rule the switcher uses —
on a failed persist, a toast and no move — and then reloads the
current URL. The reload re-exchanges for the new organization, the
URL now matches, and the page loads.

### No access

Copy: "You don't have access to this page." A link to the
Dashboard. No organization name, no id echoed back.

### The organization switcher

`switchToOrganization` keeps persist-then-move and moves to `/`
after a confirmed persist. `urlAfterOrganizationSwitch` and its
convert-page special case are deleted, with their tests: their
covenant ("reload where you are") is the bug. Without this change
the switcher would reload a URL stamped with the old organization
and immediately offer to switch back.

### Visual treatment

Both screens reuse the existing state container (icon, title,
description, action) used by the empty and error states, so they
sit in the design system's established look. The switch offer uses
a neutral (not error) icon; it is a question, not a failure.
`design-system/index.html` shows both screens alongside the existing
states.

## Verification

- Unit (Layer 1): the boot decision table; URL stamping (adds,
  replaces a stale value, preserves other parameters and the
  fragment); every registry entry declares organization scope; the
  switcher moves to `/` after a confirmed persist and does not move
  after a failed one.
- Browser (Layer 2, `tests/browser/`): signed in as a member of two
  organizations with Stark active, open a Wayne detail URL with
  `organization=<Wayne>`; the switch offer names Wayne and Stark;
  clicking it lands on the loaded page. A URL with a non-member
  organization shows no-access and no organization name. An
  organization-scoped page reached without the parameter gains it
  in the address bar.

## Left to the builder

- The registry field's final name, if a better one fits the
  registry's voice.
- Module placement of the decision function and the two screens.
- Exact icon choice for each screen, from the existing icon set.
- Whether the stamp happens before or alongside the sidebar branch,
  provided it precedes any page-module code that reads the URL.
