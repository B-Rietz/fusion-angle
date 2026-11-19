# Flow Canvas

This file is the canvas contract. Storage lives in
ARCHITECTURE.md `## Flow graph`. Work orders (claim expiry,
all-see-all) live in ARCHITECTURE.md `## Work orders`. Heat
ramp tokens live in DESIGN-SYSTEM.md `## Heat ramp`.

## Layers

The Flow Designer (`flows/detail.html`) renders an SVG
canvas with pan, marquee, drag, and edge connection.

- `flow-layout.ts` — Sugiyama layout
- `flow-graph.ts` — SVG render
- `flow-interactions.ts` — pointer/keyboard state
  machines (discriminated unions). Pan toggles via Space:
  one tap on, one tap off; the toggle is ignored
  mid-gesture; focus promotes to selection via
  `canvas-focus`. Space toggles pan whenever the canvas
  or a node/edge inside it has focus. Enter opens the
  properties panel for the focused node or edge. Nodes
  carry `role="button"`; this overrides the ARIA
  Space-as-activate default deliberately — pan is the
  canvas Space binding.

The canvas operates on the domain `GraphNode` /
`GraphEdge` (`memberIds`, `agentIds`, `attributes`). The
live graph is pair-plane only — see ARCHITECTURE.md
§ Flow graph for storage, reassembly, and write
semantics. `getFlowGraph` reads through `ctx.GET` and
parses the returned graph into the domain `FlowGraph`.
`flow-mutations.ts` builds a client-minted save delta
(node/edge upserts, `deletions: GraphDeletion[]`
(eventId/entityId/at), member/attribute `'added'`|
`'removed'` ledger events). Lifecycle `'deleted'`/
`'restored'` are derived from deletions/revivals, not
delta action tokens. Undo resolves its restore target
from the flow's own document-pair history (server-side);
reviving a previously removed node/edge id posts a
`'restored'` event so the tombstoned id reappears.

## The FSM seam

The FSM (`flow-fsm-reduce.ts`) propagates its new state
to the presenter via the `request-update` action payload,
consumed by `detail.ts` through
`presenter.withInteractionState(state)` — the single
sanctioned seam, no shared mutable state. After every
commit the page pushes the committed interaction state
back in the gesture context, so a gesture reduces from
the committed camera. The page restores canvas focus
after every rebuild in `update()` (`canvasFocusOf` /
`restoreCanvasFocus`).

## Gesture rendering

While a gesture is in flight (drag, pan, marquee,
connect), `detail.ts` routes `request-update` payloads to
`flow-gesture-render.ts` instead: one narrow
attribute-level mutation per animation frame (node
transform, affected edge `d`/label, marquee rect, viewBox
+ grid, connect-preview layer), built from the same pure
geometry the full rebuild uses (`computeEdgeGeometry`,
`buildConnectPreview`, `marqueeDrawRect`). The presenter
snapshot stays at the gesture-start state; pointer-up
lands the final state through the sanctioned seam and a
full rebuild. With Auto-Fit on, the camera re-fits at
gesture end, not per move. Pointer-moves force no layout
reads: the interaction layer captures the canvas rect at
gesture start and maps client points through the FSM's
own viewBox — exact, because the viewBox always shares
the canvas aspect ratio and `svg.flow-canvas` carries no
border or padding.

## Camera rules

The properties panel is positioned on the LEFT
(`pages-flow-detail.css` `.flow-props-panel` uses
`left: 0`); the visible canvas occupies pixels
`[PANEL_WIDTH_PX, canvasW]`. When the panel is open, both
Auto Layout (`applyAutoLayout`) and Auto Fit
(`fitBoxToCanvas`) account for the panel-occupied left
portion via `PANEL_WIDTH_PX`. The detail page's
`reconcileFitFromDom` runs Auto Fit only when `isAutoFit`
is true (no-op otherwise), so panel toggles and selection
updates re-fit the visible canvas symmetrically without
re-laying out nodes.

Viewport scale/translate operations (zoom, pan, Auto
Fit, panel toggle, selection centering) MUST NOT invoke
Auto Layout.

The camera arithmetic is one pure module,
`web-app/app/flow-camera.ts`: `MIN_ZOOM` 0.25, `MAX_ZOOM`
2.0, `ZOOM_STEP` 0.1, the button zoom
(`cameraZoomedToward`), the wheel zoom (`cameraZoomedAt`),
the pan (`viewBoxPannedBy`), and the keep-centre resize
(`viewBoxResized`). The designer's FSM, `zoomIn`/`zoomOut`,
and `withCanvasSize` delegate to it, and the stats page
calls it without the FSM, so both canvases agree on step,
range, and focal point.

Pin: tests/flow-camera.test.ts 'button zoom equals the
designer's zoomIn and zoomOut'; 'wheel zoom equals the FSM's
wheel'; 'pan equals the FSM's pan'; 'resize keeps centre and
zoom like withCanvasSize'.

Explicit auto-layout fires only via
`withAutoLayoutToggled`, `withLayoutReconciled`, and
the `withNodesMoved` chain — never via `withFitToBox`
or `withSelectionCentered`.

The detail-page `request-update` callback MUST NOT move
the camera from pointer-down to pointer-up: a release
hit-tests the node under the pointer, so a camera moved
under an in-flight gesture misses the node the user
aimed at. At gesture start it commits
`withInteractionState` and nothing else, and keeps the
selection the gesture started from. Every other update,
gesture end included, runs `reconcileFitFromDom` after
`withInteractionState` so the auto-fit viewBox is the
final state, not stomped by the FSM's frozen viewBox;
when the selection differs from the one before the
update (at gesture end, the one the gesture started
from) while the panel is open, it then runs
`withSelectionCentered` to pan the newly selected node
to the visible canvas center (zoom unchanged).

A double-click is two presses inside `DBLCLICK_MS` on
one element, or two presses inside it whose client
points lie within `DBLCLICK_SLOP_PX` (4 px) of one
another while the first press's element is still in the
FSM's selection, even after centering has slid the node
from under the pointer (`isSecondPressNear` in
`web-app/app/flow-fsm-reduce.ts`). Pan mode is checked
first, and a press on the same element as the last
click keeps its own path. A press that matches only by
its point, on another element or the bare canvas, runs
the double-click on the first press's element and
starts no gesture: it emits `open-panel: true`, keeps
the selection, and captures no pointer, so its release
is a no-op and the page does not center again. A third
press chains from the second, on the same element. With
Auto Fit on, a second press that starts no gesture
under an open panel re-fits the camera between
pointer-down and pointer-up through the `request-update`
callback, which the MUST NOT above forbids and the
"Every other update" sentence prescribes; TODO.md files
the conflict as "A double-click's second press under an
open panel re-fits the camera under Auto Fit."

## Special nodes

The two special nodes (`isCreate` / `isArchive`) persist
their `name` field directly as "Create" and "Archive" —
no constants, no render-time override. The flow renderer,
the stats renderer, and the properties panel header
all read `node.name` and emit it verbatim; persistence
and presentation share one vocabulary. `isCreate` and
`isArchive` are properties of the graph node, not state
values. Work-order node id versus the claim alphabet
lives in ARCHITECTURE.md `## Work orders`.

## Members and attributes

Regular nodes (not start/end) carry a
`memberIds: MemberId[]` field (zero or more person
members / identities) and an optional
`agentIds: AgentId[]` field (the organization's live AI
members, those whose membership is accepted). The write
law refuses an AI or service member id in `memberIds`,
accepted or removed. The
panel body renders a `<fieldset>` with two
`<div class="member-group">` children — HUMANS and AIs —
each holding a labeled `<input type="checkbox">`. Humans
carry `data-member-id="<id>"`; AI checkboxes are
display-only (`data-ai-member-id`) until a roster seat
names an agent. The fieldset respects `isLocked` (every
checkbox `disabled` when locked). On change, the panel
collects every checked human into a `MemberId[]` and
dispatches the node-property-update action via the pure
helper `parseMemberIdsFromPanel(panelEl)` in
`flows/detail.ts`.

Regular nodes also carry `attributes: NodeAttribute[]`
(`{ attributeId, mode, isRequired }`). Hidden is encoded
by absence from the array. `mode` is `'editable'` or
`'readonly'`. The per-node panel renders one row per ref
with a mode picker + Required checkbox + remove button,
plus a picker `<select>` listing every record_attribute
on the bound Record not yet referenced. The flow header
carries a Record-binding `<select>` driven by
`getRecordForFlow` / `postFlowRecordBinding` /
`deleteFlowRecordForFlow`.

## Hazards

Hazards are two-tier and shared across the designer +
stats canvases via the pure predicate
`shouldShowMemberHazard(node, allEdges)` in
`web-app/app/flow-graph.ts`. Precedence: `isCreate` /
`isArchive` → no hazard ever; zero members → `'danger'`
(red `iconNoEntry`, class `.flow-node-danger` /
`.flow-stats-node-danger`); zero outgoing edges (strict
dead-end) → `'danger'`; exactly one member → `'warning'`
(yellow `iconAlertTriangle`, class `.flow-node-warning` /
`.flow-stats-node-warning`); two-or-more members AND at
least one outgoing edge → no hazard. Both badges sit in
the bottom-left of the node, mutually exclusive at the
slot.

Three call sites of the same predicate: `flow-graph.ts`,
`flow-stats-aggregate.ts`, and
`adapters/flow-publish.ts`. The aggregate model emitted
by `flow-stats-aggregate.ts` carries the resolved level
on each node as
`memberHazard: 'warning' | 'danger' | null`; the stats
renderer reads it directly.

## Publish gate

The flow-publish gate is the third call site.
`validateFlowForCreation(flow)` in
`web-app/app/adapters/flow-publish.ts` returns
`{ ready: boolean, problems: FlowProblem[] }` —
`zero_members(nodeId)` and `dead_end(nodeId)` variants —
and `getFlowsForCreation(ctx)` partitions the unlocked
flows into `{ ready, notReady }` (locked flows are
excluded) for the workbox "Create Work Order"
dropdown. The picker renders two sections: READY
(clickable, carries `data-flow-id`) and NOT READY
(disabled, no-entry icon, "N nodes need attention"
subtitle, no `data-flow-id` so the click handler ignores
it). The client adapter `postWorkOrderCreation` re-runs
`validateFlowForCreation` and throws before POST if the
picker was somehow bypassed — defense in depth at the
client boundary.

## Stats variant

The read-only stats variant (`flow-stats`) is the designer's
twin: the same canvas, grid, geometry, and framing, drawn by
its own renderer `flow-stats-graph.ts` and presenter
`FlowStatsPresenter`, deliberately not a parametrization of
`flow-graph.ts`/`FlowDesignerPresenter`. It shares the pure
pieces, so the two cannot drift:

- **Arrangement.** `arrangeFlow` (`flow-arrangement.ts`) lays
  the flow out by the designer's rule `runsAutoLayout(flow)`
  (`isAutoLayout && !isLocked`, in `flow-designer-actions.ts`),
  through `applyAutoLayout` for the measured canvas. Any other
  flow keeps the positions `getRenderableFlowGraph` gives it
  (Auto Layout off, or locked; no waypoints), and so does a flow with no
  Create node. A canvas that has not measured lays nothing
  out. The arrangement is computed once per load; a resize
  never lays out and never fetches.
- **Edges and labels.** `computeEdgeGeometry` and
  `computeEdgeAimOffsets` give each edge its path, with
  waypoints; `computeEdgeLabelWidth`, `truncateEdgeLabel`, and
  `truncateNodeName` size and clip the labels; `NODE_WIDTH`/
  `NODE_HEIGHT` (`flow-layout.ts`) and `NODE_RADIUS`,
  `GRID_CELL`, and the label and arrow constants
  (`flow-graph.ts`) fix the geometry; `findCycleEdgeIds`
  (`flow-cycle-edges.ts`) marks loop-backs as the designer
  does; the alert-triangle and no-entry shapes of `icons.ts`
  draw the hazards.
- **Camera.** `flow-camera.ts` (see `## Camera rules`) owns
  zoom, pan, and resize. `statsFitCamera`
  (`flow-stats-camera.ts`) is the designer's `fitBoxToCanvas`
  with no panel, except where the designer's `MIN_ZOOM` would
  crop: there stats takes the unclamped `frameBoxInCanvas`, so
  the reader, who cannot turn Auto Fit off and pan to the
  rest, sees the whole flow, smaller. With Auto Fit on the
  designer re-fits to the bounding box of its drawn content,
  which on an unlocked flow includes the radius-5 port circles
  it draws on regular nodes and on a Create or Archive node
  with no edges. Stats draws no ports, so `connectionPortBox`
  adds the box of the circles the designer would draw to the
  drawn box, and the two cameras agree.
- **Page state.** The camera and the arrangement live in the
  page, never stored. Auto Layout and Auto Fit are not
  controls here: the page reads them from the flow's own
  settings and draws no switch for either.

Pin: tests/flow-arrangement.test.ts 'matches the designer's
boot layout'; 'a locked flow keeps its renderable positions';
tests/flow-stats-parity.test.ts 'every edge path matches the
designer'; 'every node transform matches the designer';
'every transition label matches the designer';
tests/flow-stats-camera.test.ts 'statsFitCamera equals
fitBoxToCanvas with no panel'; 'statsFitCamera shows the whole
flow where the designer would crop'; 'it spans each port's
circle'; tests/browser/flow-stats.test.ts 'stats lays the flow
out as the designer does'; 'with Auto Fit on, stats frames
the flow as the designer does'; tests/presenter-flow-stats.test.ts
'the page carries no Auto Layout or Auto Fit control'.

Pan and zoom exist only with Auto Fit off
(`flow-stats-pan-zoom.ts`, `bindStatsPanZoom`). A drag pans
once the pointer moves `PAN_SLOP_PX` (4) and swallows the click
that follows, so a pan neither pins nor unpins a card; the
wheel zooms about the pointer; the document-level keys, with no
Ctrl, Cmd, or Alt held and focus outside a text field, pan by
`KEYBOARD_PAN_STEP_PX` (48 px) on the arrows and zoom about the
centre on `+`, `=`, and `-`. The zoom buttons stand in the
gutter, where the designer's tool column stands, at the
height its toolbar keeps them: below the room its undo and
redo take. The arrow keys' pan is told to assistive technology by a
`.sr-only` hint, "Arrow keys pan the canvas", that both zoom
buttons name with `aria-describedby`. With
Auto Fit on, nothing is bound, the gutter is blank, and a
resize re-fits; with it off, a resize keeps the centre and the
zoom. A pinned card re-anchors after each camera change, and a
hover card hides while a pan runs.

Pin: tests/browser/flow-stats-pan-zoom.test.ts 'a drag pans
and does not pin'; 'the wheel zooms about the pointer within
0.25..2'; 'the buttons zoom by the designer's step'; 'the zoom
buttons stand where the designer keeps them'; 'arrow and
plus/minus keys pan and zoom'; 'a pinned card follows its
node'; 'with Auto Fit on, nothing moves the camera and there
are no zoom buttons'; tests/presenter-flow-stats.test.ts
'Auto Fit off puts the designer's zoom buttons in the gutter';
'Auto Fit on leaves the gutter blank'.

**The header bar.** The path stepper and the heat legend share
one bar in the header, after the back button, the title, and
the window badge. The header is `--height-flow-header` high
(DESIGN-SYSTEM.md `## Tokens`), and the gutter is
`--width-flow-tools` wide, so the canvas measures what the
designer's measures. That parity is promised where the
designer's header and page fit: the parity tests run at
900x700 and up, and at 800x700 the designer itself overflows
its page sideways. The bar changes with width:

- at `xl` (1280 px) and above, one row, with the legend
  caption `share of flow time` seen;
- below `xl`, the caption is visually hidden (heard, not seen)
  and the ramp narrows, so the whole bar fits beside the back
  button;
- below `lg` (1024 px), the bar takes its own row under the
  back button, title, and badge, with 32 px arrows, inside the
  same 121 px header from `md` (768 px) up, whose block padding
  narrows to `--space-2` so the two rows fit with the
  dropped-nodes footnote under the title;
- below `md`, the bar compacts (tighter padding and gaps, a
  shorter ramp), and the header grows from the token as a
  minimum height; the gutter becomes a row above the canvas,
  as the designer's toolbar does.

The title ellipsizes at every width. The bar's `title`
attribute carries the selected path's detail (its share of
the completed work orders and the in-flight count), and the
same text sits in an `.sr-only` span that the stepper group
(`role="group"`, `aria-label="Most-traveled paths"`) names in
`aria-describedby`; with no detail there is no title, span, or
`aria-describedby`.

Pin: tests/presenter-flow-stats.test.ts 'buildBar on the first
path: label, hover text, prev disabled'; 'the stepper group
carries the accessible name'; tests/browser/flow-stats.test.ts
'the bar's hover text follows the selected path'; 'at 1024x768
the header keeps its back button and its whole bar'; 'below xl
the whole bar fits in the header'; 'the bar's caption is seen
at xl and only heard below it'; tests/browser/flow-canvas-box.test.ts
'below lg the stats header holds two rows in the designer's
height'; 'below lg the stats header holds the dropped-nodes
footnote'.

**Paint.** The emitted SVG carries none of the editor's
interactivity tells (no `<animate>`, `role="button"`,
`tabindex`, connection ports, `data-connect-port`,
`aria-current`) and no paint either: edge and node strokes,
fills, the arrowhead, the loop-back dash, and the hazard
glyphs' stroke all live in `pages-flow-stats.css`. The
renderer emits structure (`d`, `transform`, `x/y`, `class`,
`data-*`) and, per node, the one presentational inline
attribute `style="--heat-t:${t}"`; a hazard glyph is bare
markup that the stylesheet strokes. A regular node wears its
heat as its border and a tint of it as its fill (DESIGN-SYSTEM.md
`## Heat ramp`), and shows its average sojourn on a second
line, or the absent marker when it has no time in the window;
Create and Archive show a name alone, centred, and no second
line. Loop-back edges carry `data-cycle="true"` and CSS
dashes and warning-colours them, mirroring the designer; the
single `#stats-arrow` marker's head tracks each line's own
stroke via `fill: context-stroke`. Path selection highlights
via `data-on-path` / `data-dim`: off-path elements fade and
desaturate, and the lit path keeps its normal paint, so it is
the only colour on the canvas. No animated filter: the editor
uses a glow; the stats canvas does not. A path is lit by
default (the most-travelled one).

Pin: tests/presenter-flow-stats.test.ts 'the renderer emits no
paint'; 'regular nodes show avg sojourn; special nodes show no
second line'; 'highlight set marks on-path and dims off-path
nodes/edges'; 'a hazard glyph keeps its place and size'.

The aggregate logic lives in the pure module
`flow-stats-aggregate.ts` (`buildFlowStats(input) → model`); it
consumes the universal `TransitionEvent[]` shape exported from
`client/work-orders-queries.ts` — derived from each joined work
order's `versions/` in chain order (`getWorkOrderVersions`,
`workOrderEventsOf`). The I/O wrapper is
`web-app/app/flow-stats.ts`'s `getFlowStats(ctx, flowId,
nowMs)`. `NodeStat` carries no position: positions come from
the arrangement.

## How we got here

This file is the canvas contract. The stats canvas is a
separate renderer on purpose.
