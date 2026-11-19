# Flow stats restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** The flow statistics page draws the flow exactly
as the Flow Designer does — same canvas box, arrangement,
edges, labels, and camera, under the flow's own Auto
Layout and Auto Fit settings — and paints heat softly in
the app's colours, with one slim bar in the header.

**Architecture:** Stats keeps its own read-only renderer
and borrows the designer's geometry. The designer first
exports its pure drawing helpers and moves its zoom and
pan arithmetic into a shared pure `flow-camera.ts`. Both
proofs land before anything builds on them: golden SVG
output, and a pinned canvas box. A new pure
`flow-arrangement.ts` lays the flow out once per load for
the measured canvas, by the designer's own rule. The
renderer draws that arrangement with the designer's
`computeEdgeGeometry`. A pure `flow-stats-camera.ts`
frames it the way the designer does (counting the ports
it draws but stats does not), without the designer's
crop. Pan and zoom exist only with Auto Fit off. All
paint lives in `pages-flow-stats.css`.

**Tech Stack:** Deno 2.9.8, TypeScript under `deno.json`
(`strict`, `noUncheckedIndexedAccess`,
`verbatimModuleSyntax`, `erasableSyntaxOnly`),
`@std/assert`, SVG built as `SafeHtml` strings, CSS
`color-mix(in oklch, …)`, Chrome over CDP for
`tests/browser/`.

**Spec:** `docs/superpowers/specs/flow-stats-restyle-design.md`
(commit `39b79cdbf`). Executors read the spec and this
plan. "Design" is decided; this plan decides every "Left
to the builder" item (see Decisions). Neither is
reopened.

## Operator rulings (2026-11-18)

Two parts of the spec conflicted with the code. The
operator ruled:

1. **Ports count, none are drawn.** With Auto Fit on, the
   designer re-fits to `.flow-content.getBBox()`, and on
   an unlocked flow that group holds a radius-5 port
   circle on every regular node and on any Create or
   Archive node with no edges
   (`flow-graph.ts` `canShowPort`, `computePortPos`).
   Stats draws no ports, but adds the box of the circles
   the designer would draw to its measured box. Its
   camera then equals the designer's.
2. **Degenerate stored positions mirror the designer.**
   With Auto Layout off, a flow whose stored positions
   are degenerate (`areNodePositionsDegenerate`) is laid
   out by `withRenderableLayout` in the designer. Stats
   starts from the same `getRenderableFlowGraph`, so it
   matches. The covenant "every node sits at its stored
   position" is tested on non-degenerate positions.

## Decisions (the spec's "Left to the builder")

- **Positions and waypoints.** A `FlowArrangement` (nodes
  laid out, plus waypoints by edge id) is computed once
  per load from the fetched graph and the measured
  canvas. It reaches the renderer beside the model.
  `NodeStat` drops `positionX`/`positionY`, so positions
  no longer travel in the statistics. A resize reuses the
  arrangement. It does not fetch or re-aggregate.
- **Designer exports.** `flow-graph.ts` exports
  `truncateNodeName` (new; `buildNode` calls it),
  `truncateEdgeLabel`, `connectionPortOf` (new; the node
  loop calls it), `PORT_RADIUS`, `NODE_LABEL_Y`,
  `NODE_LABEL_Y_CENTERED`, `NODE_META_Y`,
  `LABEL_RADIUS`, `ARROW_VIEWBOX`, `ARROW_MIDPOINT`, and
  `ARROW_MARKER`. `flow-designer-actions.ts` exports
  `runsAutoLayout`. `flow-interactions.ts` splits
  `fitBoxToCanvas` into the unclamped `frameBoxInCanvas`
  plus its clamp. Stats avoids the crop by taking the
  unclamped frame whenever its zoom is below `MIN_ZOOM`.
  The proof is golden SVG fixtures plus the existing
  camera tests.
- **Tokens.** `--height-flow-header: calc(7.5rem + 1px)`
  and `--width-flow-tools: 3rem`, in `tokens.css` beside
  the `--width-*` group. 121 px at a 16 px root: header
  padding 2 × 1rem, three 1.5rem switches, two 0.5rem
  gaps, and the 1 px rule (border-box). Task 3 measures
  the live header before trusting the arithmetic.
- **Lock rule.** `runsAutoLayout(flow)` is
  `flow.isAutoLayout && !flow.isLocked`, shared by the
  designer's `#applyLayoutReconcile` and stats. A locked
  flow shows the `getRenderableFlowGraph` positions and
  no waypoints, as the designer does.
- **Tint and second line.** Fill is the heat colour at
  22 % in `--background` (oklch). The second line is
  `hsl(var(--gray-300))`. Worst case across the ramp:
  8.65:1 for the name (`--foreground`) and 6.11:1 for
  the second line (`--muted-foreground` would give
  3.75:1 and fail). A browser test pins ≥ 4.5:1.
- **Narrow header.** At ≥ 768 px the header is one row of
  the token's height, and the title ellipsizes. Under
  `(max-width: 767px)` it wraps: `min-height` takes the
  token, the bar takes its own row, and the gutter
  follows the designer's mobile toolbar (a row above the
  canvas). Parity is not promised there.
- **Hover text.** A `title` on `.flow-stats-bar` serves
  the pointer. The same text sits in an `.sr-only` span
  `#flow-stats-path-detail`, which the stepper group
  (`role="group"`, `aria-label="Most-traveled paths"`)
  names in `aria-describedby`. With no hover text there
  is no title, no span, and no `aria-describedby`.
- **Pan and zoom reuse.** A new pure
  `web-app/app/flow-camera.ts` owns `MIN_ZOOM`,
  `MAX_ZOOM`, `ZOOM_STEP`, button zoom, wheel zoom, pan,
  and the keep-centre resize. The designer's FSM,
  `zoomIn`/`zoomOut`, and `withCanvasSize` delegate to
  it. Stats calls it without the FSM.
- **Keyboard and card.** These keys work only with Auto
  Fit off, at the document level, when no modifier is
  held and focus is not in a text field. Arrow keys pan
  by `KEYBOARD_PAN_STEP_PX = 48`. `+` or `=` zooms in and
  `-` zooms out, about the centre. The zoom buttons
  carry the hint "Arrow keys pan the canvas" as `.sr-only`
  text. A pan starts once the pointer moves
  `PAN_SLOP_PX = 4` and swallows the click that follows.
  A pinned card re-anchors after every camera change. A
  hover card hides while a pan runs.
- **Test levels.** The memory suite proves the
  arrangement, edge paths, labels, and node transforms
  (against the designer's presenter and
  `buildGraphSvg`), the camera arithmetic, the bar, and
  the absence of paint. `tests/browser/` proves the
  canvas box, the camera's viewBox against the live
  designer, DOM layout parity, the stored-position and
  lock covenants on the page, pan, zoom, resize,
  contrast, and the absence of writes.
- **Edge cases decided here.** An empty flow, Auto Fit
  on or off, opens on the opening view. A flow with no
  Create node is not auto-laid out, under the read-path
  rule of `withRenderableLayout`. A canvas that measures
  0 in either axis at load leaves the arrangement unlaid,
  as the designer does. Its camera waits for the first
  non-zero resize. "+ 1 rarer path" follows
  DESIGN-SYSTEM.md's plural rule.

## Execution ground

- Worktree:
  `/Users/tmornini/code/fusion-angle/.worktrees/flow-stats-restyle`,
  branch `flow-stats-restyle`, on master `ab45fbf2f`
  plus the spec commits. Every command runs there. No
  dispatch passes the Agent tool `isolation`. Nobody
  creates a worktree, runs `./deploy --render`, pushes,
  or force-pushes. Tasks run serially: one worker per
  worktree.
- `export DENO_DIR="$TMPDIR/deno-dir"` before any
  `deno`, `./test`, or `./deploy` command.
- `git commit` in this worktree fails inside the sandbox
  on `.git/worktrees/…/index.lock`. Run `git add` and
  `git commit` outside the sandbox.
- Each commit runs `./test validate --syntax`. Each task
  runs `./test` before its last commit, so every task
  lands green. Tasks that add or touch browser tests also
  run `./test browser` (the whole suite; it takes no file
  filter). It needs Chrome (`CHROME` or
  `CHROME_DEBUG_URL`).
- Commit subjects: one line, ~50 chars, present-tense
  imperative, a blank line, then
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  No other body. Never move and change a file in one
  commit.
- A failing test is fixed in code. A test is rewritten
  only where this plan names it as pinning a covenant
  the spec retired, and its replacement holds the new
  covenant at least as tightly.
- **Brief template.** Every executor prompt begins with
  `Go to Medium Church!`, then pushes down: 78-char lines
  in files `./test lint` lints, 4-space indent, no inline
  styles (custom properties + classes per
  DESIGN-SYSTEM.md); commit voice above;
  `RequestContext` first on client verbs; presenters
  return `SafeHtml`; snake_case storage, camelCase
  domain; `getNoun`/`putNoun`/`deleteNoun`/
  `postNounOperation` naming; validators at the gate,
  not downstream; no untyped `any` from external
  boundaries; `noUncheckedIndexedAccess`. Then the
  task's commandments and risks as listed, this plan's
  path, the spec's path, and the task text.

## Global Constraints

- The designer's page must look and behave as it does
  today. `buildGraphSvg` emits byte-identical output
  (Task 1 golden files). Its canvas box measures what it
  measured (Task 3 pin).
- No colour math in TypeScript. The stats renderer's one
  presentational inline attribute is
  `style="--heat-t: <t>"`. It emits no `fill`, `stroke`,
  `stroke-width`, `stroke-dasharray`, `opacity`,
  `font-size`, `font-weight`, `text-anchor`, `filter`,
  or `marker-end` attribute.
- No editor affordances on the stats canvas: no ports,
  `role="button"`, `tabindex`, `aria-current`, or
  `<animate>`.
- Heat ramp tokens and stops unchanged: `--heat-stop-low`
  0 %, `-mid` 50 %, `-high` 75 %, `-peak` 100 %.
- Stats writes nothing: no non-GET request to a flow
  path, and no control for Auto Layout or Auto Fit.
- Camera page state is never stored. A reload opens at
  the designer's opening view.
- Every regular node keeps its average sojourn (or `—`
  with no data) on its face. The card keeps the exact
  percentage.
- Text on a tinted node holds ≥ 4.5:1 at every heat-t.
- Mobile breakpoint: `(max-width: 767px)`, as
  `pages-flow-detail.css:301` writes it.
- Copy: bar caption `share of flow time`; stepper group
  name `Most-traveled paths`; labels `Path N of M · P%`,
  `+ K rarer path(s) · P%`, and
  `No completed work orders yet`.

## Review Focus

1. **A flow with no Create node, or no nodes.**
   `computeLayout` rejects a startless graph, so a
   startless auto-layout flow must not be laid out
   (Task 4). An empty flow must draw an empty grid with a
   finite viewBox, never `NaN` (Tasks 6 and 8).
2. **A regular node with no time in the window**
   (`avgSeconds === null`) shows `—` on its second line.
   It is never blank or `0m` (Task 5).
3. **Long state and transition names** truncate exactly
   as the designer's (`…` at 18 chars for a state; label
   width cap 140) (Task 5).
4. **Typing in the top bar's search** must not pan or
   zoom the canvas, and neither must Ctrl/Cmd with `+`
   or `-` (browser zoom) (Task 9).
5. **A resize after the reader has panned** with Auto Fit
   off keeps the camera's centre and zoom. It does not
   snap back to the opening view (Task 9).

---

## File structure

| File | Responsibility | Task |
|---|---|---|
| `tests/fixtures/flow-graph-golden-*.svg` | designer output pins | 1 |
| `web-app/app/flow-graph.ts` | exported drawing helpers | 1 |
| `web-app/app/flow-designer-actions.ts` | `runsAutoLayout` | 1 |
| `web-app/app/presenters/flow-designer.ts` | uses `runsAutoLayout`, `viewBoxResized` | 1, 2 |
| `web-app/app/flow-camera.ts` (new) | zoom/pan/resize arithmetic | 2 |
| `web-app/app/flow-interactions.ts` | `frameBoxInCanvas`; delegates | 2 |
| `web-app/app/flow-fsm-reduce.ts` | delegates wheel and pan | 2 |
| `web-app/app/styles/tokens.css` | two size tokens | 3 |
| `web-app/app/styles/pages-flow-detail.css` | takes the tokens | 3 |
| `web-app/app/flow-arrangement.ts` (new) | `arrangeFlow` | 4 |
| `web-app/app/flow-stats-graph.ts` | draws the arrangement | 5 |
| `web-app/app/flow-stats-aggregate.ts` | drops positions | 5 |
| `web-app/app/flow-stats-camera.ts` (new) | stats fit, opening, port box | 6 |
| `web-app/app/presenters/flow-stats.ts` | shell, bar, camera render | 5, 7, 8, 9 |
| `web-app/flows/stats.ts` | measure, arrange, fit, resize | 5, 8, 9 |
| `web-app/app/flow-stats-pan-zoom.ts` (new) | pointer, wheel, keys | 9 |
| `web-app/app/styles/pages-flow-stats.css` | box, bar, paint | 7, 8, 9, 10 |
| `tests/browser/fixtures.ts` | `Page.wheel` | 9 |
| `DESIGN-SYSTEM.md`, `FLOW-CANVAS.md`, `TEST-PLAN.md` | docs | 11 |

---

### Task 1: Export the designer's drawing helpers

Agent: architect (every later task draws with these).
Commandments: Reliability, Uniformity, Generality (one
truth, now three users). Risks: Test Weakening (the
golden files are never regenerated on this branch after
step 2), Unbidden Helper Code (export only the names
listed), Foreign Tongues.

**Files:**
- Create: `tests/flow-graph-golden.test.ts`,
  `tests/fixtures/flow-graph-golden-unlocked.svg`,
  `tests/fixtures/flow-graph-golden-locked.svg`
- Modify: `web-app/app/flow-graph.ts` (constants
  `:72`, `:81`, `:93-96`, `:121`; `truncateLabel` and
  `truncateEdgeLabel` `:407-425`; `buildNode` `:457`;
  the node loop in `buildGraphSvg` `:1324-1351`)
- Modify: `web-app/app/flow-designer-actions.ts`
  (beside `applyAutoLayout` `:310`)
- Modify: `web-app/app/presenters/flow-designer.ts`
  (`#applyLayoutReconcile` `:727-740`)
- Test: `tests/flow-graph-golden.test.ts`,
  `tests/flow-graph-geometry.test.ts`

**Interfaces:**
- Produces:

```ts
// flow-graph.ts — values unchanged, now exported
export const ARROW_VIEWBOX = 10;
export const ARROW_MIDPOINT = 5;
export const ARROW_MARKER = 8;
export const PORT_RADIUS = 5;
export const NODE_LABEL_Y = 26;
export const NODE_LABEL_Y_CENTERED = 38;
export const NODE_META_Y = 45;
export const LABEL_RADIUS = 4;
export function truncateNodeName(name: string): string;
    // truncateLabel(name, NODE_MAX_CHARS)
export function truncateEdgeLabel(name: string): string;
export function connectionPortOf(
    node: GraphNode,
    edges: readonly GraphEdge[],
    nodeMap: ReadonlyMap<string, GraphNode>,
    isLocked: boolean,
): { readonly x: number; readonly y: number } | null;
    // node-relative centre; null where canShowPort is
    // false. buildGraphSvg's node loop calls it.

// flow-designer-actions.ts
export function runsAutoLayout(flow: {
    readonly isAutoLayout: boolean;
    readonly isLocked: boolean;
}): boolean;
```

- [ ] **Step 1: Write the golden test.** The fixture is
  Create `c`; `a` named `Review the customer's
  onboarding paperwork` (over 18 chars); `b`; Archive
  `z`. Edges: `c→a` (unnamed); `a→b` named `approve the
  application form quickly` (over the label cap); `b→a`
  `revise` (a two-way pair and a cycle); `b→z` `close`
  with one waypoint. Positions are hand-placed and
  non-degenerate. `a` has one member, so it gets a
  hazard glyph. Call `buildGraphSvg` with no selection,
  `isConnecting` false, marquee `null`, and connect
  preview `''`, once unlocked and once locked. Test
  `buildGraphSvg emits the pinned designer SVG`
  compares `.toString()` with
  `Deno.readTextFile(new URL('./fixtures/flow-graph-golden-<variant>.svg',
  import.meta.url))` through `assertStrictEquals`.
- [ ] **Step 2: Generate the two fixtures on the
  unchanged tree.** Use a throwaway `deno eval` that
  imports the test's fixture builder, so nothing extra
  is committed. Run the test — PASS. Run `./test` —
  PASS. Commit `Pin the designer's SVG output`.
- [ ] **Step 3: Write the export tests** in
  `tests/flow-graph-geometry.test.ts`:
  `truncateNodeName` keeps 18 chars and cuts 19 to 17
  plus `…`. `truncateEdgeLabel` keeps 18 chars and cuts
  19 to 17 plus `…`
  (`floor((140 - 12) / 7) = 18`). `connectionPortOf` is
  `null` when locked, `null` for a Create with an edge,
  non-null for a Create with none, and non-null for a
  regular node. With no edges it is `{ x: 160, y: 32 }`.
  `runsAutoLayout`: on+unlocked true, on+locked false,
  off false. Run — FAIL (not exported).
- [ ] **Step 4: Implement.** Export the constants and
  helpers. Route `buildNode`'s truncation through
  `truncateNodeName`, and the node loop's port through
  `connectionPortOf`. Route `#applyLayoutReconcile`'s
  predicate through `runsAutoLayout`. Change no
  arithmetic or string building.
- [ ] **Step 5: Run** the golden and geometry tests, then
  `./test` — PASS, with the golden files untouched
  (`git diff --exit-code tests/fixtures`).
- [ ] **Step 6: Commit** `Export the designer's drawing
  helpers`.

### Task 2: One camera arithmetic

Agent: architect (designer camera; the stats camera
builds on it). Commandments: Reliability, Uniformity,
Generality (the zoom constants exist twice today; this
is the third user), Logic. Risks: Magical Values (name
every step), Cleverness (copy each expression in the
same operation order so results stay bit-identical),
Test Weakening.

**Files:**
- Create: `web-app/app/flow-camera.ts`,
  `tests/flow-camera.test.ts`
- Modify: `web-app/app/flow-interactions.ts` (constants
  `:15-18`, `zoomIn`/`zoomOut`/`applyButtonZoom`
  `:916-974`, `fitBoxToCanvas` `:1030-1081`)
- Modify: `web-app/app/flow-fsm-reduce.ts` (constants
  `:13-15`, pan `:473-505`, `onWheel` `:712-763`)
- Modify: `web-app/app/presenters/flow-designer.ts`
  (`withCanvasSize` `:974-993`)

**Interfaces:**
- Produces:

```ts
// flow-camera.ts — pure; imports type ViewBox from
// flow-interactions.ts (type-only, so no runtime cycle)
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2.0;
export const ZOOM_STEP = 0.1;
export type ZoomDirection = 'in' | 'out';
export interface Camera {
    readonly zoom: number;
    readonly viewBox: ViewBox;
}
export function wheelZoomDirection(deltaY: number):
    ZoomDirection; // deltaY > 0 → 'out', else 'in'
export function cameraZoomedToward(
    camera: Camera, direction: ZoomDirection,
    focal: { readonly x: number; readonly y: number }
        | null,
): Camera; // applyButtonZoom: recentre on focal ?? centre
export function cameraZoomedAt(
    camera: Camera, direction: ZoomDirection,
    anchor: { readonly x: number; readonly y: number },
): Camera; // onWheel: anchor stays under the pointer
export function viewBoxPannedBy(
    viewBox: ViewBox, dxPx: number, dyPx: number,
    rect: { readonly w: number; readonly h: number },
): ViewBox; // the FSM's panning branch
export function viewBoxResized(
    viewBox: ViewBox, zoom: number,
    w: number, h: number,
): ViewBox; // withCanvasSize, Auto Fit off

// flow-interactions.ts
export function frameBoxInCanvas(
    box: FitBox, canvasW: number, canvasH: number,
    panelOffsetPx: number,
): FitResult; // fitBoxToCanvas minus the zoom clamp;
              // fitBoxToCanvas = frame, then clamp
```

- [ ] **Step 1: Write the equality tests** in
  `tests/flow-camera.test.ts`. Each one checks a table
  against the designer's current public behaviour with
  `assertEquals`. The table: zooms 0.25, 0.3, 1, 1.95,
  2; viewBoxes with non-integer origins; focal `null`
  and a point.
  - `button zoom equals the designer's zoomIn and
    zoomOut` — against `zoomIn(state, focal)`, with
    `state` from `buildInteractionState` and the row's
    viewBox and zoom.
  - `wheel zoom equals the FSM's wheel` — against
    `reduceFsm(state, { kind: 'wheel', deltaY,
    svgX, svgY, isAutoFit: false })` for deltaY −1, 0,
    and 3.
  - `pan equals the FSM's pan` — against `reduceFsm`'s
    `pointer-move` from a `panning` state, with
    `svgRectW/H` 900×500.
  - `resize keeps centre and zoom like withCanvasSize` —
    against a presenter whose snapshot has Auto Fit off.
  - `zoom stays within 0.25..2 after 30 steps either way`.
  - `frameBoxInCanvas equals fitBoxToCanvas inside the
    range` and `frameBoxInCanvas goes below MIN_ZOOM for
    a 20000-wide box` (zoom < 0.25, and the viewBox
    contains the padded box).
  Run — FAIL (module missing).
- [ ] **Step 2: Implement `flow-camera.ts` and
  `frameBoxInCanvas`.** Copy the expressions verbatim.
  Run — PASS. Run `./test` — PASS. Commit
  `Add the shared flow camera arithmetic`.
- [ ] **Step 3: Delegate.** `applyButtonZoom`, `onWheel`,
  and the panning branch call the camera functions.
  `withCanvasSize` assigns `viewBoxResized`'s fields onto
  the same viewBox object; it is mutated in place today,
  and that stays. `fitBoxToCanvas` calls
  `frameBoxInCanvas` and then clamps. Delete the
  duplicate constants in `flow-interactions.ts` and
  `flow-fsm-reduce.ts`, and import them.
- [ ] **Step 4: Run** `tests/flow-camera.test.ts`,
  `tests/flow-zoom-to-fit.test.ts`,
  `tests/flow-fsm-reduce.test.ts`,
  `tests/flow-fsm-scenarios.test.ts`,
  `tests/flow-graph-golden.test.ts`, then `./test` and
  `./test browser` (`canvas-pan`, `canvas-gestures`,
  and `canvas-keyboard` cover the designer live) — PASS.
- [ ] **Step 5: Commit** `Route designer zoom and pan
  through the camera`.

### Task 3: Shared header height and tool width

Agent: planner. Commandments: Uniformity, Reliability.
Risks: Magical Values (the token's derivation is its
comment), Test Weakening (record the baseline from the
unchanged tree, never from the changed one).

**Files:**
- Create: `tests/browser/flow-canvas-box.test.ts`
- Modify: `web-app/app/styles/tokens.css` (after
  `--width-workspace` `:81`)
- Modify: `web-app/app/styles/pages-flow-detail.css`
  (`.flow-designer-header` `:33`, `.flow-toolbar` `:59`)

**Interfaces:**
- Produces: `--height-flow-header: calc(7.5rem + 1px)`,
  `--width-flow-tools: 3rem`. Below `md` the designer
  keeps its mobile toolbar rule (`width: auto`).

- [ ] **Step 1: Measure the baseline** on the unchanged
  tree. Use a throwaway run of the test below with its
  assertions printed rather than checked. At
  `VIEWPORT` (1280×800) on `ONBOARDING`, read
  `.flow-designer-header` `offsetHeight`,
  `.flow-toolbar` `offsetWidth`, and
  `.flow-canvas-wrap` `clientWidth`/`clientHeight`.
  Expect 121 and 48. Record all four numbers. If the
  header is not 121, the token takes the measured value,
  expressed as `rem` plus the rule.
- [ ] **Step 2: Write the pin**
  `the designer header, tool column, and canvas keep
  their size`. It asserts the four recorded numbers with
  `assertStrictEquals`, and runs again at 1024×768.
  Run `./test browser` — PASS on the unchanged tree.
  Commit `Pin the designer canvas box`.
- [ ] **Step 3: Implement.** Add the tokens, each with a
  one-line comment giving its derivation. The designer
  header gets `height: var(--height-flow-header)`. The
  toolbar gets `width: var(--width-flow-tools)`.
- [ ] **Step 4: Run** `./test browser` (the pin and the
  designer's canvas tests) and `./test` — PASS.
- [ ] **Step 5: Commit** `Size the designer header and
  tools by tokens`.

### Task 4: The flow arrangement

Agent: planner. Commandments: Reliability, Uniformity
(the designer's rule, not a copy of it), Immutability.
Risks: Default Values (an unmeasured canvas is a variant,
never `0`), Internal Defense, Premature Generalization.

**Files:**
- Create: `web-app/app/flow-arrangement.ts`,
  `tests/flow-arrangement.test.ts`

**Interfaces:**
- Consumes: `runsAutoLayout`, `applyAutoLayout`,
  `Waypoint` (`flow-designer-actions.ts`), `FlowGraph`.
- Produces:

```ts
export type CanvasMeasure =
    | { readonly kind: 'measured';
        readonly w: number; readonly h: number }
    | { readonly kind: 'unmeasured' };
export interface FlowArrangement {
    readonly nodes: readonly GraphNode[]; // positioned
    readonly edgeWaypoints:
        ReadonlyMap<string, readonly Waypoint[]>;
}
// graph is getRenderableFlowGraph's. Measured, with
// runsAutoLayout(graph) and a Create node present:
// applyAutoLayout(nodes, edges, w, h, false,
// NO_PANEL_PX) with NO_PANEL_PX = 0 ("stats has no
// properties panel"). Otherwise graph.nodes, no
// waypoints.
export function arrangeFlow(
    graph: FlowGraph, canvas: CanvasMeasure,
): FlowArrangement;
```

- [ ] **Step 1: Write the failing tests.** Build graphs
  with a local `flowGraph(…)` builder in the shape
  `tests/flow-graph-layout.test.ts` uses. Run each one
  through `withRenderableLayout` first, as the page
  receives it.
  - `matches the designer's boot layout` — an eight-state
    chain (it wraps differently at 900×500 and 600×800),
    plus `computeLayout`'s Create→Archive shortcut
    fixture (`tests/flow-layout.test.ts:299`), so at
    least one edge has waypoints; assert that it does.
    At three canvas sizes (1100×640, 900×500, 600×800),
    nodes and `edgeWaypoints` `assertEquals` what
    `tests/flow-designer-open.test.ts`'s `bootDesigner`
    sequence yields:
    `buildInitialFlowSnapshot` → `new
    FlowDesignerPresenter` → `withCanvasSize(w, h)` →
    `withLayoutReconciled()`.
  - `a locked flow keeps its renderable positions` — the
    same equality, with `isLocked: true`; no waypoints.
  - `with Auto Layout off a non-degenerate flow keeps its
    stored positions`.
  - `a degenerate non-auto flow matches the designer`
    (ruling 2).
  - `an unmeasured canvas lays nothing out`.
  - `a startless auto-layout flow is not laid out` and
    `an empty flow arranges to nothing` — no throw.
  Run — FAIL.
- [ ] **Step 2: Implement** `arrangeFlow`.
- [ ] **Step 3: Run** the test, then `./test` — PASS.
- [ ] **Step 4: Commit** `Add the flow arrangement`.

### Task 5: Draw the arrangement

Agent: planner. Commandments: Uniformity, Clarity,
Reliability. Risks: Test Weakening (the four rewrites
below only), Magical Values, Foreign Tongues, and paint
attributes, which the spec makes an anti-goal.

**Files:**
- Modify: `web-app/app/flow-stats-graph.ts`
- Modify: `web-app/app/flow-stats-aggregate.ts`
  (`NodeStat` `:31-32`, `emptyNodeStat` `:95-96`)
- Modify: `web-app/app/presenters/flow-stats.ts`
  (constructor, `renderUpdate`)
- Modify: `web-app/flows/stats.ts` (`load`: build
  `arrangeFlow(graph, { kind: 'unmeasured' })`; the old
  `boundingViewBox` stays until Task 8)
- Modify: `web-app/app/styles/pages-flow-stats.css` (move
  the grid's `fill="url(#stats-grid)"` into a rule)
- Test: `tests/presenter-flow-stats.test.ts`,
  `tests/flow-stats-parity.test.ts` (create)

**Interfaces:**
- Consumes: Task 1 exports, `computeEdgeGeometry`,
  `computeEdgeAimOffsets`, `computeEdgeLabelWidth`,
  `LABEL_HEIGHT`, `LABEL_TEXT_OFFSET_Y`; Task 4
  `FlowArrangement`.
- Produces:

```ts
export function buildStatsGraphSvg(
    model: FlowStatsModel,
    arrangement: FlowArrangement,
    viewBox: ViewBox,
    highlight: Highlight | null,
): SafeHtml;
// FlowStatsPresenter(model, arrangement, viewBox)
```

Structure: defs (grid pattern; `#stats-arrow` with the
designer's `viewBox`, `refX`, `refY`,
`markerWidth`/`markerHeight` = `ARROW_MARKER`, and
`orient`, but no `markerUnits`, so it scales with the
CSS stroke width the way the designer's does), then the
grid rects, then `<g class="flow-stats-content">` with
edges and then nodes. Each edge is a `g.flow-stats-edge`
(`data-edge-id`, `data-cycle`, `data-dim`/
`data-on-path`) holding `path.flow-stats-edge-path`. For
edges not out of Create it also holds
`rect.flow-stats-edge-label-bg` (`x`, `y`, `width`,
`height`, `rx` = `LABEL_RADIUS`, placed as the
designer's) and `text.flow-stats-edge-label` (at
`labelY + LABEL_TEXT_OFFSET_Y`, text
`truncateEdgeLabel(name)`). On a node, the name is
`truncateNodeName`, at `NODE_LABEL_Y`, or
`NODE_LABEL_Y_CENTERED` for Create and Archive. The
second line, at `NODE_META_Y`, is regular-only:
`formatMinAscending(avgSeconds)`, or `DISPLAY_ABSENT`
when it is null. The node transform comes from the
arrangement.

- [ ] **Step 1: Write the failing tests.**
  `tests/flow-stats-parity.test.ts`. For each Task 4
  fixture at 1100×640, arranged by `arrangeFlow`, every
  `data-edge-id` path `d` in `buildStatsGraphSvg` equals
  the `d` in `buildGraphSvg` for the same nodes, edges,
  and waypoints. Pair stats `data-edge-id` with
  designer `data-edge-ref`, so Create edges count too.
  Every node `transform` is equal. Every label rect's
  `x/y/width/height` and label text is equal. Assert the
  waypoint fixture's edge `d` holds a ` Q `. Rewrites in
  `tests/presenter-flow-stats.test.ts`:
  - `regular nodes show avg-sojourn face; special nodes
    show —` becomes `regular nodes show avg sojourn;
    special nodes show no second line`. Create and
    Archive groups hold exactly one `<text>`. A
    regular node with null `avgSeconds` shows `—`.
  - The `model()` fixture drops `positionX`/`positionY`
    and every call gains an arrangement.
  New:
  - `a transition's name is drawn on its edge, not on an
    edge out of Create`.
  - `long names truncate as the designer's`.
  - `the renderer emits no paint`: no
    `\s(fill|stroke|stroke-width|stroke-dasharray|opacity|font-size|font-weight|text-anchor|filter|marker-end)=`.
    Every `style=` matches `style="--heat-t: [0-9.]+"`.
  - `content sits in one group`: everything after the
    grid lies inside `g.flow-stats-content`.
  Run — FAIL.
- [ ] **Step 2: Implement.** Drop the aggregate's
  position copy. `tests/flow-stats-aggregate.test.ts`
  inputs keep their `GraphNode` positions, which are
  input, not output.
- [ ] **Step 3: Run** the two files, then `./test`, then
  `./test browser` (`a hovered stats node keeps its card
  open` holds unchanged) — PASS.
- [ ] **Step 4: Commit** `Draw stats with the designer's
  geometry`.

### Task 6: The stats camera

Agent: planner. Commandments: Logic, Uniformity,
Reliability. Risks: Default Values (`null` boxes are
explicit), Premature Generalization, Magical Values.

**Files:**
- Create: `web-app/app/flow-stats-camera.ts`,
  `tests/flow-stats-camera.test.ts`

**Interfaces:**
- Consumes: Task 2 `Camera`, `MIN_ZOOM`,
  `frameBoxInCanvas`; `fitBoxToCanvas`, `nodeBoundsBox`,
  `buildInteractionState`, `FitBox`; Task 1
  `connectionPortOf`, `PORT_RADIUS`; Task 4
  `FlowArrangement`.
- Produces:

```ts
// The designer's fit with no panel, except where its
// MIN_ZOOM clamp would crop: then the unclamped frame.
export function statsFitCamera(
    box: FitBox, canvas: { w: number; h: number },
): Camera;
// buildInteractionState(w, h): 1:1, centred on 0,0.
export function statsOpeningCamera(
    canvas: { w: number; h: number },
): Camera;
// The circles the designer draws and stats does not
// (ruling 1), in content coordinates; null if none.
export function connectionPortBox(
    arrangement: FlowArrangement,
    edges: readonly GraphEdge[],
    isLocked: boolean,
): FitBox | null;
export function unionFitBox(
    a: FitBox, b: FitBox | null,
): FitBox;
```

- [ ] **Step 1: Write the failing tests.**
  `statsFitCamera equals fitBoxToCanvas with no panel`
  (a 600×200 box on 1100×640, and on 300×200);
  `statsFitCamera shows the whole flow where the designer
  would crop` (a 20000×100 box on 800×600: zoom < 0.25,
  and the viewBox contains the box plus 70 padding);
  `statsFitCamera clamps at MAX_ZOOM like the designer`
  (a 10×10 box); `the opening camera is the designer's`
  (`buildInteractionState(1100, 640).viewBox`, zoom 1);
  `connectionPortBox is null on a locked flow`; `it spans
  each port's circle` (a regular node alone with no
  edges at (0, 0): `{ minX: 155, minY: 27, maxX: 165,
  maxY: 37 }`); `unionFitBox with null is the first
  box`. Run — FAIL.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Run** the test, then `./test` — PASS.
- [ ] **Step 4: Commit** `Add the stats camera`.

### Task 7: The header bar

Agent: planner. Commandments: Clarity, Uniformity, the
Office of the Interface (accessibility). Risks: Test
Weakening (the rewrites below only), Default Values
(no-hover-text is an absence, not `''` in an attribute),
Unbidden Helper Code.

**Files:**
- Modify: `web-app/app/presenters/flow-stats.ts`
  (`buildShell`, `buildStepperBar` → `buildBar`,
  `buildLegend` folded in, `renderUpdate`)
- Modify: `web-app/app/styles/pages-flow-stats.css`
  (header, bar, footnote; delete the stepper-bar, eyebrow,
  and legend slab rules, plus the
  `.flow-stats-body:has([data-on-path])` accent frame)
- Test: `tests/presenter-flow-stats.test.ts`

**Interfaces:**
- Produces: `buildBar(ui: { selectedPathIndex: number }):
  SafeHtml`. `buildShell` puts `.flow-stats-bar`
  in `.flow-stats-header` after the badge, and puts the
  footnote in `.flow-stats-title-block` under the h1.
  Nothing follows the canvas.

Bar markup: `div.flow-stats-bar[title?]` >
`div.flow-stats-stepper[role=group][aria-label="Most-traveled
paths"][aria-describedby?]` (prev button, label span,
next button, as applicable, plus
`span#flow-stats-path-detail.sr-only`), then
`div.flow-stats-legend` (`0%`, `.flow-stats-legend-bar`,
`100%`, caption `share of flow time`). The bar uses
`--card`, a `--border` hairline, and `--radius-full`.

| Entries | Visible | Hover text |
|---|---|---|
| ≥ 2, path k | `◀ Path k of M · P% ▶` | `P% of N completed work orders[ · F in flight]` |
| ≥ 2, rest | `◀ + K rarer path(s) · P% ▶` | `P% of N completed work orders[ · F in flight]` |
| 1 | nothing | `1 path · N completed work order(s)[ · F in flight]` |
| 0 | `No completed work orders yet` | `F in flight`, or none when F = 0 |

- [ ] **Step 1: Write the tests.** These rewrites retire
  covenants:
  - `buildStepperBar idx 0: path label, 75%, prev
    disabled` becomes `buildBar on the first path: label,
    hover text, prev disabled`. Visible
    `Path 1 of 3 · 75%`. The title and the sr-only span
    are `75% of 12 completed work orders · 3 in flight`.
    The visible label holds no `work orders`.
  - `buildStepperBar idx 1: prev not disabled` becomes
    `buildBar idx 1: prev not disabled`.
  - `buildStepperBar idx 2: rest entry, next disabled`
    becomes `buildBar on the rest: label, next
    disabled`. Visible `+ 1 rarer path · 8%`.
  - `buildStepperBar names the control with an eyebrow`
    becomes `the stepper group carries the accessible
    name`: `role="group"`,
    `aria-label="Most-traveled paths"`, and
    `aria-describedby="flow-stats-path-detail"`. No
    `flow-stats-stepper-eyebrow`.
  - `buildLegend: structure, end labels, no
    linear-gradient` becomes `the bar's legend: end
    labels, caption, no inline gradient`. Caption
    `share of flow time`, without `trailing 90 days`.
  - `buildShell contains required structural elements`
    keeps its assertions and adds: `.flow-stats-bar` sits
    inside `.flow-stats-header`;
    `flow-stats-stepper-bar` is absent; and the shell's
    last element is the body.
  New: `one path shows no arrows and no label`;
  `no paths reads No completed work orders yet`;
  `no in-flight work drops the clause, and with no paths
  the bar has no title or describedby`; `the footnote
  sits under the title`; `the page carries no Auto
  Layout or Auto Fit control` (no `role="switch"` and no
  `Auto Layout`/`Auto Fit` text in the shell). Run —
  FAIL.
- [ ] **Step 2: Implement.** Bar CSS at ≥ 768 px: the
  header is one row with
  `height: var(--height-flow-header)` (border-box), a
  transparent 1 px bottom border where the rule was
  (spec: "the rule's pixel stays as space"), and the
  title block `min-width: 0` with ellipsis. Under
  `(max-width: 767px)` the header uses `height: auto`,
  `min-height: var(--height-flow-header)`,
  `flex-wrap: wrap`, and gives the bar `flex-basis:
  100%`.
- [ ] **Step 3: Run** the test, then `./test` — PASS.
- [ ] **Step 4: Commit** `Move the stepper and legend
  into the header`.

### Task 8: The same box, layout, and camera on the page

Agent: architect (cross-page parity is the spec's
covenant). Commandments: Reliability, Uniformity,
Logic, Performance (one layout per load). Risks: Test
Weakening, Internal Defense, Unbidden Helper Code,
Shared Mutable State (one `FlowStatsUi`, set in one
place), Polling (measure through `subscribeResize`, never
a timer).

**Files:**
- Modify: `web-app/flows/stats.ts` (delete
  `boundingViewBox`, `EMPTY_W/H`,
  `STATS_VIEW_PADDING_PX`)
- Modify: `web-app/app/presenters/flow-stats.ts`
  (`FlowStatsUi.camera`, `renderCamera`)
- Modify: `web-app/app/styles/pages-flow-stats.css`
  (page chain mirroring `pages-flow-detail.css:1-50`;
  `.flow-stats-body` as a row; `.flow-stats-gutter` with
  `width: var(--width-flow-tools)`; a
  `.flow-stats-canvas-wrap` with the designer wrap's
  border, radius, and no margin)
- Test: `tests/browser/flow-canvas-box.test.ts`,
  `tests/browser/flow-stats.test.ts`

**Interfaces:**
- Consumes: Tasks 4, 6, 7.
- Produces:

```ts
export interface FlowStatsUi {
    selectedPathIndex: number;
    pinnedNodeId: string | null;
    hoveredNodeId: string | null;
    camera: Camera;
}
// FlowStatsPresenter(model, arrangement): the viewBox
// leaves the constructor for ui.camera.
// FlowStatsPresenter.renderCamera(container, viewBox):
// sets the svg viewBox and the grid rects' x/y/w/h only.
```

Load: `renderShell`, then measure `.flow-stats-canvas-wrap`
`clientWidth`/`clientHeight`. Then `arrangeFlow` (once).
With Auto Fit on, `statsFitCamera` runs over
`nodeBoundsBox` of the arrangement, then `renderUpdate`,
then `statsFitCamera` again over
`unionFitBox(contentBBox, connectionPortBox(…))`, where
`contentBBox` is `.flow-stats-content`'s `getBBox()`,
skipped when its width or height is ≤ 0. Then
`renderCamera`. With Auto Fit off, it uses
`statsOpeningCamera`. With no nodes, the opening view.
On resize (`subscribeResize` on the wrap, under the
load's AbortController), Auto Fit on runs both fit
passes; Auto Fit off uses `viewBoxResized`. Neither
calls `arrangeFlow` or fetches. A pinned card
re-anchors.

- [ ] **Step 1: Write the failing browser tests.** Each
  runs at 1280×800, and the first also at 1024×768.
  - `flow-canvas-box`: `the stats canvas measures what
    the designer canvas measures` — the
    `.flow-stats-canvas-wrap` client size equals
    `.flow-canvas-wrap`'s for `ONBOARDING` (strict
    equality), and the stats header is 121 high.
  - `stats lays the flow out as the designer does` — on
    `ONBOARDING` and on `Fusion Angle Flow` (which wraps),
    each stats node `transform` equals the designer's
    `[data-node-id]` transform. Each stats
    `data-edge-id` path `d` equals the designer's
    `[data-edge-ref]` visible path `d` (the
    `marker-end` one).
  - `with Auto Fit on, stats frames the flow as the
    designer does` — the two `viewBox` attributes,
    parsed, agree within 0.01 user units (getBBox is
    float32).
  - `with Auto Fit off, stats opens at the designer's
    opening view` — click `#flow-auto-fit-switch` in the
    designer and wait for its save; reload the designer
    and read its viewBox; open stats. They are equal,
    and equal `-w/2 -h/2 w h` of the wrap.
  - `with Auto Layout off, every node sits at its stored
    position` — toggle `#flow-auto-layout-switch` off and
    wait for the save; on stats, each transform equals
    `flowGraph(origin, id)`'s stored position.
  - `a resize keeps every node where it was` — select
    path 2 and pin a node; `setViewport(1000, 700,
    false)`; wait for the viewBox to change. The
    transforms are unchanged, the label still reads
    `Path 2 of`, and the card is still shown. Under
    `withHeldRequests`, no `/api/` request is made during
    the resize.
  - `stats writes nothing` — under `withHeldRequests`
    holding any non-GET whose URL holds `/flows/`: load,
    step, pin, unpin, resize. Nothing is held.
  Run `./test browser` — FAIL.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Run** `./test browser` and `./test` —
  PASS.
- [ ] **Step 4: Commit** `Lay out and frame stats as the
  designer does`.

### Task 9: Pan and zoom with Auto Fit off

Agent: planner. Commandments: Reliability, Uniformity
(the designer's step, range, and focal point through
`flow-camera.ts`), the Office of the Interface
(keyboard), Simplicity. Risks: Unbidden Helper Code (no
marquee, no pan mode, no stored camera), Magical Values
(`PAN_SLOP_PX`, `KEYBOARD_PAN_STEP_PX`), Swallowed
Failures, Resource Abandonment (every listener under the
load's AbortController).

**Files:**
- Create: `web-app/app/flow-stats-pan-zoom.ts`,
  `tests/browser/flow-stats-pan-zoom.test.ts`
- Modify: `web-app/app/presenters/flow-stats.ts`
  (constructor becomes `(model, arrangement,
  isAutoFit: boolean)`; with it
  false, the gutter holds the designer's
  `data-action="zoom-out"`/`"zoom-in"` buttons, markup as
  `flow-designer-view.ts:405-417`, between two spacers,
  plus the `.sr-only` hint)
- Modify: `web-app/flows/stats.ts`,
  `web-app/app/styles/pages-flow-stats.css` (`cursor:
  grab`/`grabbing` on the wrap with Auto Fit off; the
  gutter's mobile row as `pages-flow-detail.css:301-316`)
- Modify: `tests/browser/fixtures.ts` (`Page.wheel(pt:
  Point, deltaY: number)` via
  `Input.dispatchMouseEvent` `mouseWheel`)
- Test: `tests/presenter-flow-stats.test.ts`

**Interfaces:**
- Consumes: Task 2 `cameraZoomedToward`,
  `cameraZoomedAt`, `wheelZoomDirection`,
  `viewBoxPannedBy`.
- Produces:

```ts
export const PAN_SLOP_PX = 4;
export const KEYBOARD_PAN_STEP_PX = 48;
export function bindStatsPanZoom(
    wrap: HTMLElement,
    camera: () => Camera,
    onCamera: (next: Camera) => void,
    signal: AbortSignal,
): void;
```

The wheel calls `preventDefault`. Its anchor comes from
the camera and the wrap rect, as the designer's
`gesturePointToSvg`. The buttons zoom with focal `null`.
A pan coalesces moves per animation frame. The page
binds nothing with Auto Fit on.

- [ ] **Step 1: Write the failing tests.** Presenter:
  `Auto Fit off puts the designer's zoom buttons in the
  gutter`; `Auto Fit on leaves the gutter blank`.
  Browser (Auto Fit turned off in the designer first,
  except the last):
  - `a drag pans and does not pin` — the drag starts on
    a node, and the viewBox x/y shift by −drag × w/rectW.
    The card stays hidden.
  - `the wheel zooms about the pointer within 0.25..2` —
    40 wheel-ups end at zoom 2; the point under the
    pointer stays under it.
  - `the buttons zoom by the designer's step` — one
    `zoom-in` gives width × 1/1.1.
  - `arrow and plus/minus keys pan and zoom`; `typing in
    the top bar search does not move the camera`;
    `Ctrl with + does not move the camera`.
  - `a pinned card follows its node` — after a pan, the
    card's `--card-x` changes by the node's screen delta.
  - `a resize after a pan keeps centre and zoom`.
  - `with Auto Fit on, nothing moves the camera and there
    are no zoom buttons` — drag, wheel, and keys; the
    viewBox `stays`.
  Run — FAIL.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Run** `./test` and `./test browser` —
  PASS.
- [ ] **Step 4: Commit** `Pan and zoom stats with Auto
  Fit off`.

### Task 10: Paint

Agent: planner. Commandments: Uniformity (the designer's
tokens), the Office of the Interface (contrast),
Clarity. Risks: Magical Values (the 22 % is named in a
comment with its contrast), Test Weakening.

**Files:**
- Modify: `web-app/app/styles/pages-flow-stats.css`
- Create: `tests/browser/flow-stats-paint.test.ts`

Rules, per the spec's "Paint":
- `--background` canvas, and the designer's grid dot on
  `--muted-foreground`. The wrap keeps the designer's
  border and radius.
- A regular node's `--heat` (today's three-segment mix)
  is its `stroke` at 2. Its fill is `color-mix(in oklch,
  var(--heat) 22%, hsl(var(--background)))`.
- Create and Archive use `--success`/`--error` at 2.5/3
  on `--background`, with no tint.
- Name: `--foreground`, 13px, 600. Second line:
  `--gray-300`, 11px. No halo stroke.
- Edges: `--primary`, stroke-width 2. Cycle edges use
  `--warning` with `6 3` dashes. The arrowhead uses
  `context-stroke`.
- Labels: `--card` at opacity 0.9 with a 1 px border in
  the edge's colour; 11px `--foreground`, `text-anchor:
  middle`.
- A hovered node's border grows by 1. Off-path keeps
  `opacity: 0.3; filter: saturate(0.2)`. The accent
  stroke and drop shadow are deleted.

- [ ] **Step 1: Write the failing browser test** `node
  text holds 4.5:1 across the ramp`. On `ONBOARDING`
  stats, for heat-t in {0, 0.125, …, 1}, set one regular
  node's `--heat-t` with `page.evaluate`. Paint its
  rect's computed `fill`, and the computed `fill` of each
  of its texts, into a 1×1 canvas and read sRGB. Assert
  the WCAG contrast is ≥ 4.5. Also assert the rect's
  computed `stroke-width` is `2px`. Run — FAIL (today's
  face text is `--muted-foreground` on full heat).
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Run** `./test browser` and `./test` —
  PASS.
- [ ] **Step 4: Commit** `Paint stats in the designer's
  colours`.

### Task 11: Documents

Agent: coder. Commandments: Clarity, Uniformity.

**Files:** `DESIGN-SYSTEM.md` (`## Tokens`: the two size
tokens; `## Heat ramp`: Mechanism and Legend),
`FLOW-CANVAS.md` (`## Camera rules`: `flow-camera.ts`;
`## Stats variant` rewritten), and `TEST-PLAN.md`
(FS1, FS3, FS7).

- [ ] **Step 1: Write.**
  - Heat ramp: the border wears the heat; the fill is
    22 % heat in `--background`; the name is
    `--foreground` and the second line `--gray-300`
    (8.65:1 and 6.11:1 worst case); the legend sits in
    the header bar, captioned `share of flow time`.
  - Stats variant: what it shares now
    (`arrangeFlow`/`runsAutoLayout`,
    `computeEdgeGeometry`, the label helpers,
    `flow-camera.ts`, `fitBoxToCanvas` via
    `statsFitCamera`, the port box of ruling 1); the box
    tokens; pan and zoom only with Auto Fit off; the
    bar. Drop the accent-flag sentence.
  - FS1: header bar, gutter, Pin names from Tasks 7–8.
  - FS3: tint and border, no `—` on Create/Archive, pins
    from Tasks 5 and 10.
  - FS7: the bar's label and hover text, lit path in
    normal paint, pins from Task 7.
  Every Pin names a test that exists.
- [ ] **Step 2: Run** `./test validate --syntax`.
- [ ] **Step 3: Commit** `Document the stats restyle`.

---

## Landing (controller)

1. Whole-branch review: architect, given the spec, this
   plan, and `git diff master...`. Fix rounds commit as
   `fixup!` of their task's commit.
2. Squash locally to one commit per task, above the spec
   and plan commits, with `git rebase --autosquash
   master` driven by a non-interactive
   `GIT_SEQUENCE_EDITOR=:`.
3. `./test validate` (Layer 1), then
   `./test validate browser` (Layer 2). Report any gate
   that cannot run, with its output.
4. Compare with the mockups. Run
   `./deploy --local 8081 --postgres mock-data` (master
   owns 8080; this needs 127.0.0.1:5432 free). In
   browser-use at 1280×800, with the HTTP cache off,
   screenshot the designer and stats for
   `Customer Onboarding` side by side. Then turn its Auto
   Fit off in the designer and repeat. Compare stats
   with option A of `heat-options.html` (canvas) and
   with `header-rule-v3.html` (page, Auto Fit on and
   off), both under
   `/Users/tmornini/code/fusion-angle/.superpowers/brainstorm/15492-1795071256/content/`.
   Where they differ, the spec wins. A difference
   changes the product only through a red test.
5. The branch rests squashed and Layer-1 green; report
   `flow-stats-restyle`. Only when the operator asks,
   from `/Users/tmornini/code/fusion-angle`, run
   `git merge --no-ff flow-stats-restyle` with subject
   `Restyle flow stats as the designer's twin`, then
   `git worktree remove .worktrees/flow-stats-restyle`
   and `git branch -d flow-stats-restyle`.
