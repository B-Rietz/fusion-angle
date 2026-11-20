# Two-way edge lens — design

Branch and worktree `two-way-edge-lens`.

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

## Why the angles differ today

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
5. **One truth.** The designer's full rebuild, its
   in-gesture mutator, and the stats page keep drawing a
   pair from the same function.

## Non-goals

- One-way edges: path, label position, and label
  stagger stay exactly as they are.
- Cycle colour and dash, arrow markers, the selection
  glow, the hit target width, label text, truncation, and
  label box size.
- Auto Layout (`flow-layout.ts`). An outside label on a
  vertical pair lands in the row gap, which holds no
  state.
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
- A change to any byte `buildGraphSvg` emits outside a
  two-way pair's own edge groups.
- A side chosen by the direction of travel. The pair's
  orientation and each edge's role fix its side, and
  nothing else does (see "Sides").
- An arc that crosses either state's rectangle anywhere
  but at its two ends.
- `NaN` or `Infinity` in an emitted attribute, whatever
  the positions.

## Constraints

- `computeEdgeGeometry` is shared by `buildEdge`
  (`flow-graph.ts`), the in-gesture mutator
  (`flow-gesture-render.ts`), and the stats renderer
  (`flow-stats-graph.ts`). `tests/flow-stats-parity.test.ts`
  pins stats to the designer, with a two-way fixture.
- `tests/flow-graph-golden.test.ts` pins `buildGraphSvg`
  byte for byte, and its flow holds a two-way pair
  (`ab` / `ba`, a diagonal). Its comment says the fixtures
  are never regenerated. This design amends that
  covenant on purpose; see "The golden fixtures".
- Auto Fit measures the rendered content with `getBBox`
  (`web-app/flows/detail.ts`, `reconcileFitFromDom`), so
  it frames outside labels with no change.
- Arrow markers are `orient="auto-start-reverse"` with the
  tip at the path's end, so an arrow follows the arc's end
  tangent.
- FLOW-CANVAS.md `## Gesture rendering` and
  `## Stats variant` govern the two other consumers.

## Approaches

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

## Design

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
from 6, and may tune them
again on the development server, so each lives in one
named constant.

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

### The golden fixtures

`tests/fixtures/flow-graph-golden-unlocked.svg` and
`-locked.svg` are re-pinned, because what the designer
draws for a two-way pair changes by design. The operator
approves that amendment by approving this document.

The amendment is narrow. Only the `ab` and `ba` edge
groups may differ: each group's two path `d` attributes
and its label's rect `x`/`y` and text `x`/`y`. Every other
byte of both files must be unchanged, and the commit that
re-pins them shows exactly that diff. The test's comment
is reworded to say the fixtures pin the designer's drawing
and were re-pinned once, here, for this change.

### Tests

Written red first, at the level of what is drawn
(`computeEdgeGeometry` and `buildGraphSvg` output, as
`tests/flow-graph-geometry.test.ts` does today):

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
- A one-way edge's geometry is unchanged.
- Touching and overlapping states emit finite numbers.
- A routed pair keeps its path and gains the outside
  label.

`tests/flow-stats-parity.test.ts` must pass untouched.
The existing two-way test in
`tests/flow-graph-geometry.test.ts` keeps its assertions.

### Documents

FLOW-CANVAS.md gains the lens under its edges-and-labels
passage. AGENTS.md `## Where things live` describes the
golden fixtures as drawn "before its helpers were shared";
it is reworded to match the re-pin. The comment in
`tests/flow-edge-label.test.ts` that names the "two-way
perpendicular offset" is brought up to date.

## Verification

Layer 1 (`./test validate`) on the squashed branch. Then
the operator's eye: the development server, a two-way
pair dragged through horizontal, diagonal, and vertical,
on the designer and on the stats page, with Auto Fit on.

## Left to the builder

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
- Task order and commit boundaries.
