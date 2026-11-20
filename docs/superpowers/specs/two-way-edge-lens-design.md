# Two-way edge lens and snug labels — design

Branch and worktree `two-way-edge-lens`. Two features, one
commit each: snug labels first, then the lens.

## Intent

When two states have a transition in each direction, the
Flow Designer draws the pair well when the states sit side
by side and badly when one sits above the other: the two
lines run nearly on top of each other and the two labels
overlap each other and both lines.

The operator wants a two-way pair to read clearly and
beautifully at every angle — horizontal, vertical, and
everywhere between look alike — with each label outside
the pair so it adds space rather than crowding the gap, and
with gently curved edges.

Looking at labels set apart like that, the operator also
saw that a long label carries far more padding at its
sides than a short one. Every edge label's box should be
snug: the same padding each side, whatever the text.

## What is wrong today

`computeEdgeGeometry` (`web-app/app/flow-graph.ts`) does
two things that depend on the angle:

- **Lines.** Each edge aims at its partner's centre moved
  sideways by 20–80 units, and attaches where that ray
  leaves the node. The separation at the node therefore
  scales with the node's half-size along the axis: 80
  across, 32 down. A vertical pair 243 apart attaches about
  5 units apart; a horizontal one about 13. The control
  arms then leave square to the node's side, so the two
  lines run straight and parallel.
- **Labels.** Each label is pushed a fixed
  `BIDI_LABEL_OFFSET` (12) off its line. That clears a
  20-tall label when the edge is horizontal and cannot
  clear a 36–140-wide one when it is vertical.

`computeEdgeLabelWidth` sizes a label's box by a guess:
7 units a character, plus 12. The text is Inter 400 at 11
units, which runs between 5 and 6 a character, so the
slack grows with the name: "submit" has about 9 a side,
"needs revision" about 18. A name of wide glyphs (`W`,
`M`) goes the other way and outgrows its box.

## Goals

1. **One look at every angle.** The shape of a two-way
   pair depends on the distance between the two states,
   never on the direction from one to the other.
2. **Labels outside.** Each label sits on the outer side
   of its own edge, clear of both edges and of its
   partner's label, by the same gap at every angle.
3. **Gentle curves.** Each edge of a pair is one shallow
   arc bowing away from its partner — a slim lens.
4. **Forward on top or left.** The forward edge takes the
   top of a horizontal pair and the left of a vertical
   one, whichever way it travels. The return edge takes
   the other side.
5. **Snug labels.** Every edge label's box wraps its text
   with the same padding each side, on one-way edges too.
6. **One truth.** The designer's full rebuild, its
   in-gesture mutator, and the stats page keep drawing an
   edge from the same function, and everything that sizes
   a label asks the same function for its width.

## Non-goals

- A one-way edge's path and its label's place. Only its
  label's box changes width.
- Cycle colour and dash, arrow markers, the selection
  glow, the hit target width, and label text.
- Truncation. An edge label still cuts at 18 characters.
- State names: their text, truncation, and place.
- Auto Layout's algorithm (`flow-layout.ts`). It keeps
  reserving room by label width, so narrower labels give
  narrower gaps. An outside label on a vertical pair
  lands in the row gap, which holds no state.
- The connect-preview path (`buildEdgePreviewPath`,
  `buildConnectPreview`).
- Label collisions under manual layout, where the
  operator places states anywhere. Today's behaviour is
  no better.
- Any new gesture. Edges cannot be bent by hand:
  waypoints come only from Auto Layout.

## Anti-goals

- A second geometry path for any consumer. A dragged pair
  must never differ from its rebuilt form, and stats must
  never differ from the designer.
- A change to anything `buildGraphSvg` emits beyond what
  "The golden fixtures" lists.
- A side chosen by the direction of travel. The pair's
  orientation and each edge's role fix its side, and
  nothing else does (see "Sides").
- An arc that crosses either state's rectangle anywhere
  but at its two ends.
- `NaN` or `Infinity` in an emitted attribute, whatever
  the positions.
- Text measured in the browser at draw time. Label width
  stays a pure function that answers the same under Deno
  and in Chrome.
- An ASCII label whose text overflows its box.
- A second copy of the width rule anywhere.

## Constraints

- `computeEdgeGeometry` is shared by `buildEdge`
  (`flow-graph.ts`), the in-gesture mutator
  (`flow-gesture-render.ts`), and the stats renderer
  (`flow-stats-graph.ts`). `tests/flow-stats-parity.test.ts`
  pins stats to the designer, with a two-way fixture.
- `computeEdgeLabelWidth` is called by those three and by
  Auto Layout's reservation (`flow-graph-layout.ts`). The
  design-system showcase (`web-app/design-system/index.ts`)
  carries its own copy of the 7-and-12 guess.
- `truncateEdgeLabel` derives its 18 from the 140 cap and
  the 7-unit guess. `tests/flow-graph-geometry.test.ts`
  and `tests/presenter-flow-stats.test.ts` pin the 18.
- The canvas draws label text in the page's sans face,
  Inter 400, bundled as `web-app/assets/inter-400.woff2`,
  at `LABEL_FONT` (11).
- `tests/flow-graph-golden.test.ts` pins `buildGraphSvg`
  byte for byte. Its flow holds three labelled edges, two
  of them a two-way pair (`ab` / `ba`, a diagonal). Its
  comment says the fixtures are never regenerated. This
  design amends that covenant on purpose; see "The golden
  fixtures".
- Auto Fit measures the rendered content with `getBBox`
  (`web-app/flows/detail.ts`, `reconcileFitFromDom`), so
  it frames outside labels with no change.
- Arrow markers are `orient="auto-start-reverse"` with the
  tip at the path's end, so an arrow follows the arc's end
  tangent.
- FLOW-CANVAS.md `## Gesture rendering` and
  `## Stats variant` govern the two other consumers.

## Approaches

### The lens

1. **A lens of two arcs, labels at the apex, outside**
   (chosen). Lanes fix the attachment; a shallow arc
   gives the curve; the label clears the arc by a
   constant gap. Every quantity is measured against the
   line between the two centres, so the angle drops out.
2. **Fix only the label offset.** Cheapest, and it stops
   the labels overlapping, but a vertical pair's lines
   stay about 5 units apart and read as one doubled line.
3. **Straight parallel lanes.** Angle-independent and
   simple, but forgoes the curve the operator would like.

The operator picked 1.

### Snug labels

1. **A table of Inter's advances** (chosen). The width of
   each character, committed as data and pinned to the
   bundled font by a browser test. Exact for ASCII to
   within kerning, and pure.
2. **A smaller guess per character.** One line, but the
   boxes stay uneven: narrow names still loose, wide
   names still overflowing.
3. **Measure in the browser at draw time.** Exact, kerning
   included. But Auto Layout sizes its gaps before
   anything is drawn and runs under Deno in tests, so
   every width would hang on the DOM and on the font
   having loaded.

The operator asked for snug labels and left the how. 1 is
the author's call.

## Design: snug labels

### The rule

A label box is `textWidth + 2 * LABEL_SIDE_PADDING` wide,
and never narrower than `LABEL_MIN_WIDTH` (36, as today).
`textWidth` is the width of the text the label draws: the
name after its 18-character truncation.

| Constant | Value | Reads as |
|---|---|---|
| `LABEL_SIDE_PADDING` | 8 | text to box, each side |

The operator chose 8 by eye on the mock. "submit" comes to
about 51 wide and "needs revision" to about 91, against 54
and 110 today.

The 140 cap (`LABEL_MAX_WIDTH`) retires. A box always
wraps its text, and the 18-character truncation bounds how
wide that can be.

### Text width

`textWidth` is the sum of each character's advance in
Inter 400, times `LABEL_FONT`. The advances are a table
committed as data, in em: one entry for each printable
ASCII character (U+0020 to U+007E), and one for the
ellipsis (U+2026) that truncation appends. Any other
character takes one named fallback: the table's widest
advance.

Kerning and contextual alternates are not modelled. They
move a label's true width by about a unit, which the
padding absorbs.

The function is pure: no DOM, no canvas.

### Truncation

Unchanged at 18 characters. With the cap and the guess
both gone, 18 becomes its own named constant. The two
tests that pin it pass untouched.

### Consumers

`computeEdgeLabelWidth` stays the one function. The
designer's rebuild, the in-gesture mutator, the stats
renderer, and Auto Layout's reservation already call it.
The design-system showcase starts calling it in place of
its own copy. `LABEL_CHAR_WIDTH` and `LABEL_PADDING`
retire.

### What moves

- Every labelled edge's box changes width, one-way edges
  included. Its centre does not move.
- Auto Layout reserves a label's width plus
  `LABEL_SAFETY_MARGIN` between two states in a row.
  Where a label set that gap, the states now sit closer.

## Design: the lens

All lengths are SVG units. `c_from` and `c_to` are the
two states' centres; `d` is the unit vector from `c_from`
to `c_to`; `n` is the edge's outward unit normal, fixed
under "Sides".

### Sides

A two-way pair is a two-edge cycle, so `findCycleEdgeIds`
marks exactly one of its edges as a loop-back. That edge
is the pair's return edge. The other is its forward edge,
the one a work order follows on its way to Archive.

`u` is the unit normal of the line between the two
centres that points up and to the left: `u.x + u.y < 0`,
and on the exact down-right diagonal, where that sum is
zero, the one pointing up. `u` belongs to the pair, not to
either edge. The forward edge's `n` is `u`; the return
edge's is `-u`.

So the forward edge and its label sit on top when the
pair is horizontal and on the left when it is vertical,
whether the forward edge runs right or left, down or up.
The operator confirmed all four on the mock.

`u` turns with the pair and flips where the centre line
crosses the down-right diagonal. There the two edges swap
sides. No rule can put the forward edge on top of a
horizontal pair and on the left of a vertical one without
a swap between the two; this one puts it halfway. The
other diagonal has no swap.

Today's rule, each edge to the right of its own travel,
retires.

### Lanes

The edge's lane is the line through `c_from + n * LANE`
along `d`. The edge starts at `S`, where the lane leaves
the source rectangle, and ends at `E`, where it enters the
target rectangle. `LANE` is less than half a state's
height, so the lane always crosses both rectangles, and
`S` and `E` move continuously round a corner as a state is
dragged.

The pair's two attachments on a state are therefore
`2 * LANE` apart measured across the centre line, at every
angle.

### The arc

`chord = |E - S|`. `bow = min(chord * BOW_FRAC, BOW_MAX)`.
The edge is the single quadratic arc from `S` to `E` whose
apex is `A = midpoint(S, E) + n * bow`.

A proportional bow holds the arc's end angle constant
(about 10 degrees off the lane), so a short pair and a
long pair wear the same curve and the arrow enters the
state at the same gentle angle. The cap keeps a long pair
from ballooning.

### The label

The label's centre is `A + n * (LABEL_GAP + h)`, where
`h = |n.x| * labelWidth / 2 + |n.y| * LABEL_HEIGHT / 2` is
the label box's half-extent along `n`.

The arc lies wholly on the inner side of its tangent at
`A`, and the box lies wholly `LABEL_GAP` beyond that
tangent, so the box clears the arc by the same gap at
every angle: its long side when the pair is vertical, its
flat side when horizontal, its nearest corner between.
The pair's two labels face each other across the lens.
The `BIDI_LABEL_T` stagger retires.

### Starting numbers

| Constant | Value | Reads as |
|---|---|---|
| `LANE` | 8 | attachments 16 apart |
| `BOW_FRAC` | 0.045 | end angle about 10 degrees |
| `BOW_MAX` | 16 | at most 48 apart mid-span |
| `LABEL_GAP` | 8 | label to arc |

Measured: a vertical pair 243 apart has a 179 chord, an
8.1 bow, and 32 between the arcs mid-span. A sweep of
every half degree at seven distances found no arc
entering a state.

The operator set these by eye on an interactive mock,
bringing `BOW_FRAC` down from 0.07 and `LABEL_GAP` up
from 6, and may tune them again on the development
server, so each lives in one named constant.

### Routed pairs

Auto Layout gives waypoints to an edge that skips a layer.
A pair so routed keeps `buildWaypointPath` through its
waypoints, between the same lane points `S` and `E`, so
its ends sit on the side its role gives it. Its label is
anchored at the route's midpoint (`pointAlongPolyline` at
0.5) and pushed along `n` by `LABEL_GAP + h`.

### Touching or overlapping states

When the lane leaves the source at or after the point
where it enters the target, there is no chord. The edge
then draws as a one-way edge between those states draws
today. Coincident centres already take that path.

### Consumers

The label's place now depends on its width, so
`computeEdgeGeometry` needs the width (or the name) from
each caller. All three callers already compute it.

The edge's side now depends on its role, so the geometry
also needs to know forward from return. The designer's
rebuild and the stats renderer already call
`findCycleEdgeIds`; the in-gesture mutator does not, and
holds the nodes and edges it would need. All three must
resolve the role the same way, from one place.

The function stays the single source of path and label
place for all three.

## The golden fixtures

`tests/fixtures/flow-graph-golden-unlocked.svg` and
`-locked.svg` are re-pinned twice, once by each feature,
because what the designer draws changes by design. The
operator approves that amendment by approving this
document.

Each amendment is narrow, and its commit shows exactly
its diff:

- **Snug labels.** Only the label rect's `x` and `width`
  in each labelled edge group (`ab`, `ba`, `bz`).
- **The lens.** Only the `ab` and `ba` edge groups: each
  group's two path `d` attributes, and its label's rect
  `x`/`y` and text `x`/`y`.

Every other byte of both files is unchanged. The test's
comment is reworded to say the fixtures pin the designer's
drawing and were re-pinned for these two changes.

## Tests

Written red first, at the level of what is drawn.

### Snug labels, Layer 1

- A short name and a long name both leave exactly
  `2 * LABEL_SIDE_PADDING` between text width and box
  width.
- Eighteen `W`s fit their box.
- A one-character name gets `LABEL_MIN_WIDTH`.
- A truncated name's box wraps its seventeen characters
  and the ellipsis.
- A character outside the table takes the fallback
  advance.
- Auto Layout's gap between two states in a row follows
  the new width.
- The showcase's label box is `computeEdgeLabelWidth` of
  its label.

### Snug labels, Layer 2

A browser test, with Inter loaded in the running app:

- For every character in the table, Chrome's advance for
  it matches the table's.
- For the labels of a flow drawn in the designer, box
  width less the text's measured length is
  `2 * LABEL_SIDE_PADDING`, to within a unit a side.

### The lens, Layer 1

`computeEdgeGeometry` and `buildGraphSvg` output, as
`tests/flow-graph-geometry.test.ts` does today:

- At 0, 45, 90, 135, 180, 225, 270, and 315 degrees, a
  pair's attachments sit `LANE` either side of the centre
  line.
- At each of those angles the label box's nearest point
  is `LABEL_GAP` beyond the apex tangent.
- The pair's two labels lie on opposite sides of the
  centre line and never overlap, for the shortest and the
  longest label.
- The forward edge's label is above the centre line when
  the forward edge runs right and when it runs left, and
  left of it when the forward edge runs down and when it
  runs up.
- The two edges have swapped sides between a pair just
  either side of the down-right diagonal, and have not
  between a pair just either side of the other diagonal.
- With equal label widths, one edge's geometry is the
  other's turned half a turn about the pair's midpoint.
- Sampled along its length, neither arc enters either
  state's rectangle.
- A one-way edge's path and label centre are unchanged.
- Touching and overlapping states emit finite numbers.
- A routed pair keeps its waypoints and gains the outside
  label.

`tests/flow-stats-parity.test.ts` must pass untouched.
The existing two-way test in
`tests/flow-graph-geometry.test.ts` keeps its assertions.

## Documents

FLOW-CANVAS.md gains the lens and the width rule under
its edges-and-labels passage. AGENTS.md
`## Where things live` describes the golden fixtures as
drawn "before its helpers were shared"; it is reworded to
match the re-pins. The comment in
`tests/flow-edge-label.test.ts` that names the "two-way
perpendicular offset" is brought up to date.

## Verification

Layer 1 (`./test validate`) and, because this unit adds a
browser test, Layer 2 (`./test validate browser`), on the
squashed branch. Then the operator's eye: the development
server, a two-way pair dragged through horizontal,
diagonal, and vertical, on the designer and on the stats
page, with Auto Fit on.

## Left to the builder

- Where the advance table lives, how its values are read
  from the bundled font, and to how many places. Chrome's
  own measurement is the oracle the Layer 2 test repeats.
- Whether a label's width is rounded.
- How `S` and `E` are found, and whether the arc is
  emitted as a quadratic or as its exact cubic
  equivalent.
- Whether the caller passes the label's width or the
  edge's name.
- How the forward-or-return role reaches the geometry,
  within "Consumers".
- `aimOffset` stops describing what it carries once edges
  no longer aim off-centre. If the builder renames it,
  the rename is its own commit.
- The names of the new constants, and the retirement of
  `BIDI_SPREAD_*`, `BIDI_LABEL_T`, and
  `BIDI_LABEL_OFFSET` where they fall out of use.
- Task order within each feature, and commit boundaries
  before the squash.
