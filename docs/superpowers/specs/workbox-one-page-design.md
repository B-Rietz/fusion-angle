# Workbox on one page

Branch and worktree `workbox-one-page`.

## Intent

A person works their queue without leaving it. The
workbox shows what they hold and what they could take
on the left, and the work order they picked on the
right: claim it, fill it in, move it on, pick the next.

Today that takes two pages and a drag. The inbox lists
work orders in two boxes; a click navigates to
`workbox/detail.html`; claiming, releasing, and ordering
happen only by dragging a card between or within the
boxes. The detail page has no claim control at all.

This design folds the detail page into the workbox,
replaces the drag with a switch, and adds a row of pills
that count and filter the work by flow.

The operator approved a clickable mockup of this page
(v3, 2026-11-22). Where this document and the mockup
disagree, this document wins.

## Goals

- One page. `workbox/index.html` lists the work and
  shows the open work order beside the lists.
- A pill per flow, each with two numbers — claimed by me
  and total — that filters the lists when pressed.
- A "Claimed by Me" pill first, an "Archived by Me" pill
  second, each with one count.
- My claimed work orders draw in their own list above
  the available ones. No row draws in both.
- Claim and release by a switch on the open work order.
- Everything `workbox/detail.html` does today, done in
  the right box: the attribute form, the transition
  buttons, the violations banner, the 412 recovery
  notice, the history.
- No drag-and-drop anywhere in the workbox.
- `workbox/detail.html` is gone.

## Non-goals

- No API change. Every read and write this page makes
  exists today. The position route and its client verb
  `putWorkOrderPosition` stay; the page stops calling
  them.
- No redirect from `workbox/detail.html`. An old
  bookmark gets the 404 page.
- No pill state in the URL. A reload starts unfiltered.
- No re-recorded performance budgets. The retired page
  leaves the measure profile and `budgets.json`; the
  `workbox` budget stands as recorded.
- Work claimed by another member stays out of the lists,
  as today.
- A hand-chosen order of claimed work. It went with the
  drag.

## Anti-goals

- A second source of truth for the counts. Every number
  on a pill is derived from the rows the lists already
  hold, in the same pass that fills the lists.
- A claim the page fakes. The switch moves only after
  the server answers; a refused claim leaves it off.
- A work order's typed values lost to an unrelated
  repaint. Pressing a pill or typing in the search box
  repaints the lists and never the open work order.
- A detail page kept alive under another name: no
  iframe, no hidden second document, no alias URL.

## Approaches

**One page, the box painted in place (chosen).** The
workbox page owns both boxes. The right box is painted
by the presenter the detail page uses now, fed by the
same reads, and its gestures are the detail page's
gestures. The detail page, its registry entry, and the
drag module are deleted. Costs: the page module grows
and wants splitting; three browser tests and the
TEST-PLAN workbox section are rewritten.

**Keep the detail page, embed it.** An iframe or a
second navigation target shows `detail.html` in the
right box. Rejected: two documents hold two copies of
the held message and ring two bells, the operator asked
for the page to be removed entirely, and an embedded
page cannot be laid out with the list.

**Counts from the server.** A new aggregate route
returns per-flow counts. Rejected: the page already
holds every row the counts are made from, so a second
read would be a cache of the first.

## The page

```
Workbox            [ Search work orders... ]   [+ Create]

(Claimed by Me 5)(Archived by Me 3) | (Customer
Onboarding 2/7)(Fusion Angle Flow 1/4)(Lead-to-Close 2/6)

+- left box ------------------+ +- right box ------------+
| Work Orders claimed by me   | | Customer Onboarding    |
|  [row][row]                 | |     (o ) Claim     (x) |
|                             | | [Work order id][Review]|
| Work Orders available to me | | Attributes ...         |
|  [row][row][row]            | | [approve][send back]   |
|                             | | History ...            |
+-----------------------------+ +------------------------+
```

The header is unchanged: title, search box, Create Work
Order. The pills sit between the header and the boxes.
The two boxes share the width equally, as the two list
boxes do today.

## The pills

One group, `role="group"`, labelled "Filter work
orders", wrapping onto as many lines as it needs.

Order: "Claimed by Me", "Archived by Me", a thin divider,
then one pill per flow sorted by flow name.

A flow is named by its work orders' flow graph name —
the name each row already shows. Two work orders with
the same flow name share a pill; a renamed flow's older
work orders keep the pill of the name they carry.

Each pill is a `button.badge` — the look and the dimming
the state filter chips on Ideas, Projects, and Records
have — carrying `aria-pressed`. At most one pill is
pressed. Pressing the pressed pill clears the filter.
While one is pressed, the others carry
`data-dimmed="true"`; the pressed one wears
`badge-primary`, the rest `badge-secondary`.

Each pill ends in a count chip:

- Claimed by Me: the number of work orders I hold a
  live claim on.
- Archived by Me: the number of work orders at an
  archive node whose last transition was mine.
- A flow: `claimed/total` — of that flow's work orders
  in my two inbox lists, how many I have claimed, and
  how many there are. `0/5`, `1/1`.

Which pills exist comes from the last full read: one
pill per flow name among the work orders in the claimed
and available lists. The counts come from the rows the
lists are showing before any pill narrows them — the
full read while the search box is empty, the QUERY's
answer while it has text. So pills keep their places
while a search runs, and a search can take a flow's
count to `0/0`.

A pressed flow pill whose flow no longer has a pill is
un-pressed.

Each pill's accessible name says what its numbers mean:
"Customer Onboarding: 2 claimed by me of 7", "5 work
orders claimed by me".

## The lists

The left box holds two headed lists, in this order:
"Work Orders claimed by me", then "Work Orders available
to me". Which list a work order belongs to is today's
rule, unchanged:

- at an archive node: neither list;
- under my live claim: claimed;
- under another member's live claim: neither;
- otherwise: available.

Both lists are ordered oldest last-transition first.
While the search box has text, both keep the QUERY
answer's order, best match first, as matched lists do
today.

A pressed pill changes what the box draws:

- Claimed by Me: only the claimed list.
- Archived by Me: one list, "Work Orders archived by
  me", newest first, in place of the other two.
- A flow: both lists, each narrowed to that flow name.

An empty list keeps its heading and says so, in today's
words: "No work orders claimed by me", "No work orders
available to me", "No work orders archived by me". Under
a flow pill the line ends " in <flow name>". While the
search box has text it is today's "No work orders match
“<text>”".

A row is today's row, less `data-position`. The row
whose work order is open carries `aria-current="true"`
and an outline. A row for a head whose node its flow
graph no longer holds stays the static, unclickable row
it is today.

## The work order box

Before anything is opened, and again after it is closed,
the right box holds a heading, "Work Order", and one
muted line: "Select a work order to open it here".

Opened, it reads what the detail page reads — the head,
its versions, the member map, the record, its
attributes, and the bound instance — shows the page's
skeleton while it waits, and the page's failed-load
state, with Try Again, if a read fails. The close
control is present in all three.

Loaded, top to bottom:

1. A title row: the flow name; at its right end the
   claim place, then the close control.
2. A badge row: the labelled work order id, the current
   node's name (its task instructions as the title), and
   the bound instance's link when there is one.
3. The 412 recovery notice, when one is due.
4. The Attributes card.
5. The violations slot.
6. The transition buttons.
7. History, open.

Items 2–7 are the detail page's, moved, not redesigned:
the same presenter builds them, the same rules enable
them (the form and the buttons only under my live
claim), and the same gestures drive them — the
required-attribute toast, the violations banner, the
412 recovery that re-reads and re-presents, the write
that latches the instance head the form was filled
from. An archived work order shows its badges and its
history only. There is no back button.

What the box does after a transition succeeds is its
own section, below. The page no longer navigates away.

Any work-order change the bell rings — this tab's or
another's — refreshes the lists and re-reads the open
work order, as each page does for itself today.

The close control is a ghost icon button with the
circled-x icon, labelled "Close work order". It returns
the box to its before-anything-is-opened state.

## After a transition

A transition button sends the work order on. The
"Transition complete" toast shows, the lists refresh,
and what the box does next depends on where the work
order went.

**To a step I can do.** The node it moved to is not an
archive node and lists me in its roster (`memberIds`).
The box stays on the work order, re-reads, and paints
the new head. The transition released my claim, so the
claim place offers "Claim" again.

**Anywhere else.** The box moves to my next work. Once
the lists have refreshed it opens the topmost row of the
claimed list; when that list has no row, the topmost row
of the available list. The work order just sent on is
never the one it opens. When there is no row to open,
the box closes.

"Topmost" is the first row that can be opened, as the
left box draws it. Under a flow pill it is that flow's
first row; while the search box has text it is the
answer's first; under Claimed by Me only the claimed
list is drawn, so there is no available row to fall back
to; under Archived by Me neither list is drawn, so the
box closes.

The roster decides only this. The lists still show every
unclaimed work order to every member, as today; TODO.md
item 11a is where the roster comes to narrow them.

## The claim place

One place, in the title row's upper right, left of the
close control. It shows one of four things:

- **Unclaimed:** a switch, off, labelled "Claim".
- **Claimed by me:** the same switch, on, labelled
  "Claimed by <my name>". Turning it off releases.
- **Claimed by another member:** the words "Claimed by
  <their name>", no switch.
- **Archived:** nothing.

A lapsed claim is no claim. The switch is the design
system's `button.switch` with `role="switch"` and
`aria-checked`, inside its label.

Turning the switch on calls `putWorkOrderClaim`; turning
it off calls `deleteWorkOrderClaim`. Each latches the
head the box holds. The switch is disabled while its
write is in flight and moves only when the write
succeeds: the box repaints from the head the write
returns, and the row moves between the two lists.

A refused write leaves the switch where it was. A 409
shows the toast "Someone else holds that work order";
any other failure shows "Failed to claim work order" or
"Failed to release work order". Either way the lists and
the box re-read, so the claim place shows who holds it
now.

The refusal a person will actually meet is a 412:
another member claimed after the box read, so the head
the write latches is stale. It takes the "Failed to
claim work order" toast, and the re-read shows their
name. A 409 needs a head that is current and already
claimed, which the box shows without a switch; only a
claim that has lapsed by this clock and not the server's
reaches it.

## Opening, closing, and the URL

Clicking a row opens its work order in the box. It stays
until another row is clicked, the close control is
pressed, or a transition sends it on to a step that is
not mine. Pressing a pill, typing in the search box, or
a refresh that drops its row from the lists does not
close it.

The open work order rides the URL as `?id=<id>` on
`workbox/index.html`. Opening sets it and closing
removes it, both by `history.replaceState`. Loading the
page with it opens that work order, so a reload keeps
the box and a link can name a work order.

The `#active` and `#archived` hashes go with the
segmented control they selected.

Everything that linked to the detail page links here:

- A row's title is a link to the workbox with that
  row's id. A plain click opens it in the box without
  navigating; a modified click follows the link.
- The Records page's work-order link goes to the
  workbox with that id.
- Create Work Order opens the new work order in the box.

## What is removed

- `web-app/workbox/detail.html` and `detail.ts`; the
  `workbox-detail` entry in the page registry; its name
  in the measure profile, the measure's page map and
  usage text, and `measurements/budgets.json`. Recorded
  history is left as recorded.
- `web-app/app/workbox-inbox-drag.ts`, its test, and its
  styles: `.inbox-drop-indicator`, `.inbox-dragging`,
  `.inbox-drop-target`, and the `#workbox-inbox a`
  user-drag rule.
- The Active / Archived by Me segmented control and the
  hash reader behind it.
- `position` in the inbox presenter: the item field, the
  position sort, and the row's `data-position`.
- The phone reordering of the two list boxes. The
  claimed list is first in the document now, so only the
  header's reordering remains.

A file that moves is moved in a commit of its own, with
no change to its content.

The documents below change before these removals land:
`./test lint` rejects a TEST-PLAN.md that cites a test
file that no longer exists.

## Phones

Below the 768px breakpoint everything stacks: header,
pills, the left box, the right box. Opening a work order
scrolls the right box into view; closing it scrolls the
left box back into view.

At 768px and wider the right box is sticky below the top
header, with its own scroll when it is taller than the
window, so the open work order stays in view while the
lists scroll.

## Styles

New rules live in `pages-workbox.css`, built from
tokens, with no inline styles:

- the count chip inside a pill: a full-radius chip with
  tabular numerals on a faint foreground tint;
- the open row's outline: two pixels of `--primary`,
  inset;
- the right box's sticky position and its
  before-anything-is-opened note.

The pills' own look and dimming need no new rule: they
are `.badge`, `.badge-primary`, `.badge-secondary`, and
`.badge[data-dimmed="true"]`. The divider between the
two "by Me" pills and the flow pills is the existing
`.header-stat-divider`. The switch is the existing
`.switch`.

## Documents

- **TEST-PLAN.md** — section F2, Workbox, is rewritten
  for this page: the inbox, the pills, the claim switch,
  the action screen in the box, transitions, completion,
  concurrency. Cases that drive a drag or navigate to
  the detail page are restated against the switch and
  the box, or retired where the behavior is gone.
- **TODO.md** — every bullet that names the workbox drag
  or cites a file this design deletes is re-read: moot
  ones go, live ones are re-pointed.
- **DESIGN-SYSTEM.md** — names the pill group where it
  documents filter chips and the segmented control.
- **ARCHITECTURE.md** — any mention of the detail page
  or the claim drag is brought up to date.

## Verification

Layer 1, in `tests/`:

- the pills: which exist, their order, each count, the
  accessible names, pressed and dimmed states;
- the lists: membership, order, what each pressed pill
  draws, each empty line;
- the claim place: its four states;
- the box: its before-anything-is-opened state, and that
  a loaded work order carries no back button;
- the page registry and the measure profile without
  `workbox-detail`.

The drag test file is deleted. The detail presenter's
tests stay with the presenter and lose only what the
page lost.

Layer 2, in `tests/browser/`:

- pressing a flow pill narrows both lists and pressing
  it again restores them;
- opening a row fills the box, marks the row, and sets
  `?id=`; the close control empties the box and clears
  it; loading the page with `?id=` opens that work
  order;
- turning the switch on moves the row to the claimed
  list and enables the form; turning it off moves it
  back;
- a transition to a step that lists me keeps the box on
  the work order and shows its new node;
- a transition to a step that does not list me opens my
  topmost claimed work order; with none claimed, the
  topmost available one; with neither, it closes the
  box — and never reopens the one just sent on;
- the existing transition, search, and former-member
  tests, restated for one page.

`./test validate` and `./test browser` are green on the
squashed branch before the merge.

## Left to the builder

- How the page module is split. It gains the detail
  page's logic and loses the drag's; a module of its own
  for the box is welcome.
- The names of the new `data-` attributes and CSS
  classes, within DESIGN-SYSTEM.md's conventions.
- Whether the box's presenter keeps its file and class
  name. If it is renamed, the rename is its own commit.
- The exact tests, their names, and their fixtures.
