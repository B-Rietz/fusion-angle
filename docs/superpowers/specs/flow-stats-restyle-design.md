# Flow stats restyle

Branch and worktree `flow-stats-restyle`.

## Intent

The flow statistics page (`flows/stats.html`) looks foreign
to the rest of the app. Its nodes are filled with
full-strength heat colour, which forces haloed text; its
lit path is a four-pixel yellow stroke with a glow; its
stepper and legend sit on grey slabs; and it draws the flow
as one long row where the Flow Designer
(`flows/detail.html`) draws the same flow as a wrapped
snake.

The operator wants the page to read as the designer's
read-only twin: the same canvas, the same arrangement of
states and transitions, with heat laid softly on top.

## Goals

1. **Layout parity.** For the same flow, each page freshly
   loaded in the same window, stats places the states,
   routes the edges, labels the transitions, and frames
   the camera exactly as the designer does.
2. **The flow's own settings, read-only.** Stats honours
   the flow's stored Auto Layout and Auto Fit settings
   and offers no control for either. The page is for
   consumption: it changes nothing about the flow.
3. **The app's colours and contrast.** Canvas, strokes,
   and text come from the tokens the designer uses.
4. **Softer heat, same ramp.** The four `--heat-stop-*`
   tokens and their stops (0 / 50 / 75 / 100 %) stay; the
   way a node wears the colour changes.
5. **One slim bar in the header.** The path stepper and
   the legend become a single bar beside the title.
   Nothing sits below the canvas or over it.

## Non-goals

- The statistics themselves: `flow-stats-aggregate.ts`,
  the hover card's content, the path ranking.
- The ramp tokens or their stops.
- What the designer renders or does. Its stylesheet may
  take the shared size tokens named under "The same box";
  its page must look and behave as it does today.
- Editing of any kind. Stats selects nothing, moves no
  state, and writes nothing.
- Storing a camera. Where stats lets the reader pan and
  zoom, the view lasts until the page reloads.
- Merging the two renderers.

## Anti-goals

- A designer regression, or a change in what
  `buildGraphSvg` emits.
- Colour math in TypeScript, or paint attributes emitted
  by the stats renderer. Its one presentational inline
  attribute stays `style="--heat-t:…"`.
- Editor affordances on the stats canvas: ports,
  `role="button"`, `tabindex`, `aria-current`, the
  animated glow.
- Colour as the only channel. Every regular node keeps its
  average sojourn on its face; the hover card keeps the
  exact percentage.
- Anything laid over the canvas that can hide a state from
  the pointer.
- A control on this page that changes a flow setting, or
  any write to the flow.

## Constraints

- FLOW-CANVAS.md: the stats canvas is a separate renderer
  on purpose, and it emits structure only.
- DESIGN-SYSTEM.md: no inline styles; colours and sizes
  through tokens and classes.
- Text on a tinted node holds WCAG AA (4.5:1) at every
  point of the ramp.
- A test whose covenant this design changes is rewritten
  to the new covenant; no assertion is weakened to let old
  behaviour and new both pass.

## Approaches

1. **Keep the stats renderer; feed it the designer's
   geometry.** Chosen. Stats stays a read-only renderer
   and calls the designer's existing pure functions for
   layout, edge geometry, and camera fit. Two renderers
   remain, but one geometry, so the two pages cannot drift
   apart in arrangement. The look is a stylesheet change.
2. **One renderer: a read-only mode on `buildGraphSvg`.**
   Guarantees a pixel match, but that function carries
   inline paint and every editor affordance, and takes
   twelve arguments on the editor's hot path. A stats mode
   threads heat, path highlight, and "no affordances"
   through it, and reverses a documented decision — real
   risk to the designer for a page that only reads.
3. **Stylesheet only.** Fixes the colours and leaves the
   single row. Fails goal 1.

## Design

### The same box

The designer's arrangement is a function of the graph and
of its canvas size in CSS pixels at the moment it lays
out. The size does not scale the layout. It decides how a
long chain wraps into a snake — the row count steps at
fixed canvas heights, the column cap at fixed widths — and
whether the graph is rotated. A canvas a few dozen pixels
larger therefore wraps some flows differently: an
eight-state chain is 4×2 on one side of a step and 3×3 on
the other.

So the stats canvas has the designer's box exactly:

- **Height.** The stats header and the designer header
  take one shared height token.
- **Width.** A gutter stands where the designer keeps its
  tool column, sized by one shared width token that the
  tool column also takes. It is blank, except for the
  zoom buttons named under "Pan and zoom".
- **No other chrome.** Nothing sits below the canvas. The
  canvas area carries no margin the designer's lacks.
- **No rule under the header.** The designer's header
  rule lands on its tool column. Over the stats gutter it
  would run off to the left of the canvas, so stats draws
  none: the canvas's own border is the only line. The
  rule's pixel stays as space, so the box does not move.

The covenant: in one window, the stats canvas and the
designer canvas measure the same width and the same
height.

### Layout parity

Stats does what the designer does with that box, under
the flow's two stored settings. It reads them; it shows no
switch for either.

| Setting | On | Off |
|---|---|---|
| Auto Layout | the designer's computed arrangement | the stored, hand-placed positions |
| Auto Fit | the camera fits the flow to the canvas | the designer's opening view: 1:1 zoom, centred on the canvas origin |

- **Measure, then lay out, once per load.** After the
  shell renders, stats reads the size of its canvas. When
  the designer would lay the flow out — Auto Layout on,
  by the designer's own rule — stats lays it out with
  that size, the properties panel counted as closed. The
  designer's call is `applyAutoLayout`
  (`flow-designer-actions.ts`) over `runFlowLayout`.
  Otherwise stats draws the stored positions.
- **Keep the waypoints.** The layout returns waypoints for
  edges that route around nodes. Stats discards them
  today; it keeps them and hands them to the edge
  geometry.
- **One edge geometry.** Edge paths and label anchors come
  from the designer's `computeEdgeGeometry`, with
  `computeEdgeAimOffsets` so a two-way pair bows apart the
  way it does in the designer.
- **Transition labels.** Each edge carries its
  transition's name in a label box at the geometry's
  anchor, sized and truncated as the designer does. Edges
  out of the Create node carry none, as in the designer.
- **Node faces.** The name and the second line sit where
  the designer puts its name and its attribute count. The
  second line is the average sojourn. Create and Archive
  carry the name alone, centred, as in the designer; the
  "—" they show today goes. Names truncate as the designer
  truncates them.
- **One camera, Auto Fit on.** The viewBox is the result
  of the designer's `fitBoxToCanvas` with no panel
  offset: first over the node bounds, then again over the
  measured extent of the drawn content, the way the
  designer's `reconcileFitFromDom` corrects its own first
  fit. The viewBox has the canvas's aspect, so nothing
  letterboxes.
- **Never cropped, Auto Fit on.** The designer's fit
  stops at a minimum zoom and crops what is left, because
  its user can turn Auto Fit off and pan. A reader of
  stats cannot turn it off, so where that clamp would
  crop, stats shows the whole flow smaller. Every other
  flow gets the designer's camera unchanged.
- **One camera, Auto Fit off.** Stats opens where the
  designer opens: the viewBox `buildInteractionState`
  gives, 1:1 and centred on the origin.
- **A resize never lays out.** This is what the designer
  does: with Auto Fit on a resize re-fits the camera;
  with it off the camera keeps its centre and its zoom.
  The arrangement waits for the next load. The selected
  path and a pinned card survive a resize. No resize
  fetches.

### Pan and zoom

Only when the flow's Auto Fit is off. The designer's
opening view can leave part of a flow outside the canvas,
and its user pans to reach it; the reader of stats must be
able to as well.

- **Pan.** Dragging the canvas moves the camera. Stats has
  no marquee and no pan mode to toggle: a drag is a pan.
  A drag is not a click, so it neither pins nor unpins a
  card.
- **Zoom.** The wheel zooms about the pointer, and the
  designer's − and + buttons stand in the gutter where the
  designer keeps them. Step, range, and focal point are
  the designer's.
- **Keyboard.** Pan and zoom are both reachable without a
  pointer.
- **The card follows.** A pinned card stays beside its
  node as the camera moves.
- **Nothing is kept.** The camera is page state. It is
  not written to the flow, and a reload opens at the
  designer's opening view again.

With Auto Fit on there is no pan, no zoom, and no zoom
buttons: the gutter is blank.

### Paint

All of it lives in `pages-flow-stats.css`. Option A of
the first brainstorm mockup is the reference for the
canvas; the third is the reference for the page, with
Auto Fit on and off. Both are untracked and sit in the
main checkout, not this worktree:
`.superpowers/brainstorm/15492-1795071256/content/heat-options.html`
and `header-rule-v3.html` beside it.

- **Canvas.** `--background`, the designer's dotted grid,
  border, and radius.
- **Regular node.** The heat colour — the existing
  three-segment `color-mix` over `--heat-t` — becomes the
  node's two-pixel border. The fill is that colour mixed
  into `--background` in oklch at about 22 %. Name in
  `--foreground`, 13 px semibold; second line 11 px. No
  halo stroke behind the text.
- **Create and Archive.** The designer's green and red
  borders at the designer's widths, plain `--background`
  fill, no tint. They hold no time, so they wear no heat.
- **Edges.** `--primary`, two pixels, the designer's
  arrowhead size; the arrowhead keeps tracking its line
  through `context-stroke`. Loop-back edges stay dashed
  `6 3` in `--warning`.
- **Transition labels.** The designer's label: card
  background at its opacity, a one-pixel border in the
  edge's colour, 11 px `--foreground` text.
- **Lit path.** The most-travelled path is lit by
  default, as today. On-path nodes and edges wear their
  normal paint. Off-path ones dim and desaturate, as
  today. The yellow four-pixel stroke and the drop shadow
  go. When the stepper rests on the "rarer paths" entry,
  nothing dims.
- **Hover and hazards.** A hovered node thickens its
  border. The single-member and dead-end glyphs stay
  where they are.

### The bar

One bar sits in the header, right of the title and the
"Trailing 90 days" badge: `--card`, a `--border` hairline,
a full radius.

Its legend half is always there: `0%`, the ramp bar,
`100%`, and the caption "share of flow time". The caption
drops "trailing 90 days", which the badge already says.

Its stepper half depends on how many paths the window
holds:

| Paths | Shown | Hover text |
|---|---|---|
| several, on a path | `◀ Path 2 of 3 · 25% ▶` | "25% of 12 completed work orders · 3 in flight" |
| several, on the rest | `◀ + 4 rarer paths · 8% ▶` | "8% of 12 completed work orders · 3 in flight" |
| one | nothing: no arrows, no label | "1 path · 2 completed work orders · 3 in flight" |
| none | "No completed work orders yet" | "3 in flight" |

- The work-order counts leave the label for the hover
  text. The in-flight clause appears only when something
  is in flight, as today.
- The visible eyebrow "Most-traveled paths" goes. The
  words become the stepper group's accessible name, and
  the hover text reaches assistive technology as well as
  the pointer.
- The dropped-nodes footnote is rare. It becomes a muted
  line under the title, shown only when it has something
  to say, so it cannot change the canvas's box.

The stepper bar's accent frame, the legend's slab, and
the row they occupied below the canvas go.

### Documents

DESIGN-SYSTEM.md `## Heat ramp` (mechanism, legend) and
the stats section of FLOW-CANVAS.md describe the old
paint, the old edge rendering, and the accent-flagged
stepper. TEST-PLAN.md cases FS1, FS3, and FS7 describe
the old look and name tests this work rewrites. All three
are brought in line.

### Tests

Covenants that change, and so tests that are rewritten:

- special nodes show "—" → special nodes show no second
  line;
- the shell's stepper bar and legend below the canvas →
  the one bar in the header;
- the eyebrow → the group's accessible name;
- the stepper label's work-order counts → the hover text;
- prev and next always present → present only with more
  than one path.

Covenants that are new:

- a transition's name is drawn on its edge, and not on an
  edge out of Create;
- an edge with waypoints is drawn through them;
- for one graph and one canvas size, stats and the
  designer's layout agree on every node position and
  every edge path;
- in one window, the stats canvas and the designer canvas
  measure the same;
- with Auto Fit on, the viewBox is the designer's camera
  fit for the canvas size, except where that fit would
  crop; with it off, the viewBox is the designer's
  opening view;
- with Auto Layout off, every node sits at its stored
  position;
- with Auto Fit off, a drag pans, the wheel and the
  buttons zoom within the designer's range, and a pinned
  card stays beside its node; with it on, none of them
  moves the camera and the buttons are absent;
- the page carries no control for Auto Layout or Auto
  Fit, and writes nothing;
- a resize keeps every node where it was.

The existing browser test (a hovered node keeps its card
open) holds unchanged.

## Left to the builder

- How positions and waypoints reach the renderer. The
  aggregate copies each node's stored position into its
  model today; a resize must not re-fetch, and need not
  re-aggregate.
- Which private designer helpers to export for reuse (the
  two truncations, for example), and how stats avoids the
  minimum-zoom crop, both without changing what the
  designer emits or how its camera behaves.
- The names and home of the two shared size tokens, and
  the value of the height token: the designer header's
  height today.
- The lock rule. The designer skips auto-layout on a
  locked flow; stats mirrors whatever the designer shows
  for that flow.
- The exact tint percentage and the token for the node's
  second line, verified for contrast across the ramp. The
  mockup used 22 % and `--gray-300`.
- The header at narrow widths, by DESIGN-SYSTEM.md's
  breakpoints. Parity is promised where the designer's
  header holds one row.
- The mechanism of the hover text.
- How much of the designer's pan and zoom arithmetic stats
  reuses, so the two cannot disagree on step, range, or
  focal point, without taking on the designer's editing
  state machine.
- The keyboard bindings for pan, and whether a held card
  hides during a drag.
- The highest level at which each parity covenant can be
  tested.
