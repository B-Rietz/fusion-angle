# Two-way edge lens and snug labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development to implement this
> plan task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Every edge label's box wraps its text with the
same padding each side, and a two-way pair draws as a slim
lens of two arcs with each label outside it, alike at every
angle.

**Architecture:** Two pure functions stay the single
sources. `computeEdgeLabelWidth` sizes a label from a
committed table of Inter 400's advances, with no DOM, so
Auto Layout, both renderers, the in-gesture mutator, and
the showcase agree. `computeEdgeGeometry` learns two more
facts from each caller, whether the edge is its pair's
loop-back and how wide its label is, and draws a pair from
them: lanes off the centre line, one shallow arc, the label
beyond the arc's apex.

**Tech Stack:** Deno 2.9.8, TypeScript under `deno.json`
(`strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`,
`noUnusedParameters`, `verbatimModuleSyntax`,
`erasableSyntaxOnly`), `@std/assert`, Chrome over CDP for
`tests/browser/`.

**Spec:** `docs/superpowers/specs/two-way-edge-lens-design.md`.
The operator approved it. Executors read the spec and this
plan; neither is reopened.

## Execution ground

- Worktree
  `/Users/tmornini/code/fusion-angle/.worktrees/two-way-edge-lens`,
  branch `two-way-edge-lens`, on master `9812d9f60`. Every
  command runs there. No dispatch passes the Agent tool
  `isolation`; nobody creates a worktree, merges, pushes,
  force-pushes, or runs `./deploy --render`. Only the
  controller squashes.
- `export DENO_DIR="$TMPDIR/deno-dir"` before any `deno`,
  `./test`, or `./deploy` command run inside the sandbox.
- `git commit` fails inside the sandbox on `index.lock`,
  and so do `git checkout --` and `git restore`. Run those
  outside the sandbox.
- Chrome cannot start inside the sandbox. Run every
  browser test outside it. One file:

  ```bash
  source bin/build-lib
  BUNDLE="$(mktemp -d "${TMPDIR:-/tmp}/fusion-browser.XXXXXX")"
  bundle_client "$BUNDLE" > /dev/null 2>&1
  FUSION_ANGLE_STATIC_ROOT="$BUNDLE" TZ=UTC \
  JWT_HMAC_SIGNING_KEY=test-hmac-signing-key \
  CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  deno test --frozen --no-check --sanitize-resources \
      --allow-env --allow-read --allow-write --allow-net \
      --allow-run \
      --preload ./tests/hmac-test-key.ts \
      --preload ./tests/local-storage-stub.ts \
      tests/browser/FILE.test.ts
  rm -rf "$BUNDLE"
  ```

  The whole suite is `./test browser`.
- One memory file, inside the sandbox:

  ```bash
  JWT_HMAC_SIGNING_KEY=test-hmac-signing-key TZ=UTC \
  deno test --frozen --no-check --sanitize-ops \
      --sanitize-resources --allow-env --allow-read \
      --allow-write --allow-net \
      --preload ./tests/hmac-test-key.ts \
      --preload ./tests/local-storage-stub.ts \
      --preload ./tests/session-storage-stub.ts \
      --preload ./tests/worker-name-prefix.ts \
      tests/FILE.test.ts
  ```

  The whole suite is `./test` (about two and a half
  minutes in the sandbox).
- Every commit runs `./test validate --syntax` first. Every
  task runs `./test` before its last commit and reports
  the count. Where a task leaves a test red on purpose, the
  task names that test, and nothing else may be red.
- Commit subjects: one line, about 50 characters,
  present-tense imperative, then a blank line and the
  `Co-Authored-By` trailer the committing session names.
  No other body. One concern per commit. Never rename and
  change content in one commit.
- A failing test is fixed in the code. A test changes only
  where this plan names the assertion and the reason.
- Agent types, dispatched by type with no model override:
  `architect` for Tasks 1, 5, and 8; `planner` for Tasks 2
  and 4 and for every task review; `coder` for Tasks 3, 6,
  and 7.

## Global Constraints

From the spec. Every task's requirements include these.

- Tunables, each one named constant in
  `web-app/app/flow-graph.ts`, exported, and read by the
  tests from there so a tuning is a one-line change:

  | Constant | Value | Spec name |
  |---|---|---|
  | `LABEL_SIDE_PADDING` | 8 | `LABEL_SIDE_PADDING` |
  | `LANE_OFFSET` | 8 | `LANE` |
  | `BOW_FRAC` | 0.045 | `BOW_FRAC` |
  | `BOW_MAX` | 16 | `BOW_MAX` |
  | `LABEL_GAP` | 8 | `LABEL_GAP` |

- Unchanged values: `LABEL_MIN_WIDTH` 36, `LABEL_FONT` 11,
  `LABEL_HEIGHT` 20, and the 18-character truncation, which
  becomes `LABEL_MAX_CHARS`.
- A label's width is a pure function: no DOM, no canvas,
  the same answer under Deno and in Chrome. A width is not
  rounded.
- No parameter default anywhere this unit touches. The
  label's width is always passed.
- One geometry function and one width function serve every
  consumer. No second copy of either rule, in any file.
- A one-way edge's path and label centre do not change by
  one byte. Only its label box's `x` and `width` do.
- No `NaN` or `Infinity` in an emitted attribute, whatever
  the positions.
- An arc crosses a state's rectangle only at its two ends.
- A pair's side comes from the pair's orientation and each
  edge's role, never from its direction of travel.
- `buildGraphSvg` emits nothing new beyond what "The golden
  fixtures" in the spec lists for each feature.
- `tests/flow-stats-parity.test.ts` is not edited, by any
  task, in any byte.
- Out of scope: the connect preview, Auto Layout's
  algorithm, cycle colour and dash, arrow markers, the
  selection glow, the hit width, label text, state names,
  and any new gesture.
- Voice: 78-character lines in every file `./test lint`
  lints, 4-space indent, no inline styles, `organization`
  never `org` in an identifier.

## Decisions the spec left to the builder

- **The table.** Inter's grid is 2048 units to the em, and
  Chrome reports every printable ASCII advance as a whole
  number on it: `measureText` at `400 2048px Inter`. The
  table holds those whole numbers, so it is exact and the
  Layer 2 test compares with `===`. It lives in
  `web-app/app/inter-400-advances.ts`.
- **Rounding.** None. A box is its text plus the padding.
- **Width or name.** Each caller passes the label's width.
- **The role.** `computeEdgeAimOffsets` keeps its signature
  and its 0-or-1 answer, so the existing two-way test keeps
  its assertions. The role arrives beside it as `isCycle`,
  which the designer's rebuild and the stats renderer
  already hold from `findCycleEdgeIds`; the in-gesture
  mutator calls `findCycleEdgeIds` too. A pair's edge that
  is a loop-back is its return edge.
- **`S` and `E`.** Slab intersection of the lane with each
  rectangle, as `span` does in the mock.
- **The arc.** One quadratic, `M S Q C E`, with
  `C = midpoint(S, E) + n * 2 * bow`.
- **The rename.** After the lens `aimOffset` aims nothing.
  It becomes `lane`: 0 is the centre line, 1 a lane beside
  it. The rename is Task 7, its own commit, and it stays
  its own commit through the squash, as
  `b6a2d7f85 Move the precondition header names` did.

## Where the spec's letter gives way

The controller reports each of these to the operator.

- **`tests/presenter-flow-stats.test.ts:315`.** "long names
  truncate as the designer's" pins the 18 and also pins
  `width="138"`, which is the retired 7-and-12 guess. The
  spec says this test passes untouched; it cannot. Task 1
  changes that one literal to the snug width,
  `120.80615234375`, and nothing else in the test.
- **`tests/design-system-render.test.ts`.** Its byte pin of
  the showcase moves when the showcase's boxes change
  width. Its own comment says paint edits move it on
  purpose. Task 2 re-pins the length and the digest.
- **`tests/flow-graph-geometry.test.ts:188`.** The comment
  above the truncation test derives 18 from the retired
  cap. Task 3 deletes the comment. The test's code is not
  touched.
- **`noUnusedParameters`.** A new parameter must be read in
  the commit that adds it, so the geometry's new signature
  and its three call sites land in one commit, in Task 5.
  Task 4 pins the in-gesture consumer before that lands.

## Review Focus

Inputs the spec implies and its test list does not reach,
most likely first. Each has its test in the task named.

1. A state of a pair is dragged: the mid-drag frame must be
   the rebuilt form, on both sides of the down-right
   diagonal. The mutator's role lookup is new code that no
   Layer 1 test can reach. Task 4.
2. A pair exactly on the down-right diagonal, which
   grid-aligned states reach easily: both edges must agree
   on `u`, so the labels land on opposite sides, the
   forward one up and to the right. Task 5.
3. A long pair: the bow stops at `BOW_MAX`; a short one
   bows `chord * BOW_FRAC`. Task 5.
4. A name with characters outside the table (`é`, an emoji,
   a surrogate pair cut by truncation): a finite width, one
   fallback advance for each code point. Task 1.
5. An empty name: the minimum box. Task 1.

## File structure

| File | Change |
|---|---|
| `web-app/app/inter-400-advances.ts` | new: the table and the text-width function |
| `web-app/app/flow-graph.ts` | the width rule; the lens; the constants |
| `web-app/app/flow-gesture-render.ts` | passes the role and the width |
| `web-app/app/flow-stats-graph.ts` | passes the role and the width |
| `web-app/design-system/index.ts` | calls `computeEdgeLabelWidth` |
| `tests/flow-edge-label-width.test.ts` | new: Layer 1, snug labels |
| `tests/browser/edge-label-width.test.ts` | new: Layer 2, snug labels |
| `tests/flow-graph-layout.test.ts` | Auto Layout's gap |
| `tests/design-system-render.test.ts` | the showcase's boxes; the byte pin |
| `tests/presenter-flow-stats.test.ts` | one literal |
| `tests/flow-graph-geometry.test.ts` | Layer 1, the lens |
| `tests/browser/canvas-gestures.test.ts` | the dragged-pair pin |
| `tests/fixtures/flow-graph-golden-*.svg` | re-pinned twice |
| `tests/flow-graph-golden.test.ts` | its comment |
| `tests/flow-edge-label.test.ts` | its comment |
| `FLOW-CANVAS.md`, `AGENTS.md` | the documents |

---

# Feature 1: snug labels

### Task 1: The snug width rule and Inter's advance table

**Agent:** `architect`

**Files:**
- Create: `web-app/app/inter-400-advances.ts`
- Modify: `web-app/app/flow-graph.ts:99` (`LABEL_MAX_WIDTH`),
  `:117-124` (label constants), `:450-472`
  (`truncateEdgeLabel`, `computeEdgeLabelWidth`)
- Create: `tests/flow-edge-label-width.test.ts`
- Create: `tests/browser/edge-label-width.test.ts`
- Modify: `tests/flow-graph-layout.test.ts` (one test added)
- Modify: `tests/presenter-flow-stats.test.ts:315` (one
  literal)

**Interfaces:**
- Produces, from `inter-400-advances.ts`:
  - `INTER_400_UNITS_PER_EM = 2048`
  - `INTER_400_ADVANCES: ReadonlyMap<string, number>`: 96
    entries, one for each of U+0020 to U+007E and one for
    U+2026, each the advance in font units
  - `INTER_400_FALLBACK_ADVANCE: number`: the map's largest
    value, derived from the map, never written twice
  - `computeInter400TextWidth(text: string, fontSize:
    number): number`: the sum, by code point, of each
    character's advance, a character outside the map taking
    the fallback, times `fontSize / INTER_400_UNITS_PER_EM`
- Produces, from `flow-graph.ts`:
  - `export const LABEL_SIDE_PADDING = 8`
  - `LABEL_FONT` and `LABEL_MIN_WIDTH`, now exported
  - `const LABEL_MAX_CHARS = 18`
  - `computeEdgeLabelWidth(name: string): number`, its
    signature unchanged:
    `max(computeInter400TextWidth(truncateEdgeLabel(name),
    LABEL_FONT) + 2 * LABEL_SIDE_PADDING, LABEL_MIN_WIDTH)`
  - `truncateEdgeLabel` cuts at `LABEL_MAX_CHARS`
  - `LABEL_MAX_WIDTH` is gone. `LABEL_CHAR_WIDTH` and
    `LABEL_PADDING` stay exported: the showcase imports
    them until Task 2.

- [ ] **Step 1: Write the table's failing tests.** In
  `tests/flow-edge-label-width.test.ts`:
  - `'the table holds printable ASCII and the ellipsis'`:
    the map's keys are exactly U+0020 to U+007E and U+2026,
    96 of them, and every value is a positive integer.
  - `'a character outside the table takes the widest
    advance'`: `INTER_400_FALLBACK_ADVANCE` is the map's
    largest value; at `fontSize` 2048 each of `'é'`,
    `'🙂'`, and the lone surrogate `'\ud83d'` measures
    exactly the fallback, and `'é🙂'` exactly twice it.

  In `tests/browser/edge-label-width.test.ts`, with the
  flow designer open on `ONBOARDING` and
  `document.fonts.load('400 2048px Inter')` awaited:
  - `'Chrome sets each tabled character at the table's
    advance'`: for every entry, a canvas `measureText` of
    the character at `400 2048px Inter` has a `width` that
    `===` the entry. Collect the mismatches in the page and
    assert the list is empty.

- [ ] **Step 2: Run both files; each fails** because
  `inter-400-advances.ts` does not exist.

- [ ] **Step 3: Write `inter-400-advances.ts`.** Read each
  advance from Chrome as Step 1's browser test does. Chrome
  is the oracle; the test is the proof.

- [ ] **Step 4: Run both files; each passes.** Commit:
  `Add Inter 400's advance table`.

- [ ] **Step 5: Write the rule's failing tests.** In
  `tests/flow-edge-label-width.test.ts`, with `text(n)`
  standing for `computeInter400TextWidth(n, LABEL_FONT)`:
  - `'a short and a long name both leave the side padding
    each side'`: for `'submit'` and `'needs revision'`,
    `computeEdgeLabelWidth(n) - text(n)` `===`
    `2 * LABEL_SIDE_PADDING`.
  - `'eighteen Ws fit their box'`: for `'W'.repeat(18)`,
    the same equality.
  - `'a one-character name and an empty name get the
    minimum box'`: `'i'` and `''` both give
    `LABEL_MIN_WIDTH`.
  - `'a truncated name's box wraps its seventeen
    characters and the ellipsis'`: for
    `'abcdefghijklmnopqrs'`, the width `===`
    `text('abcdefghijklmnopq…') + 2 * LABEL_SIDE_PADDING`.

  In `tests/flow-graph-layout.test.ts`:
  - `'Auto Layout's gap between two states in a row
    follows the label's width'`: lay out Create, `a`, `b`,
    Archive in a chain with `a -> b` named
    `'needs revision'`; `b.x - a.x` `===` `NODE_WIDTH +
    text('needs revision') + 2 * LABEL_SIDE_PADDING +
    LABEL_SAFETY_MARGIN`.

  In `tests/browser/edge-label-width.test.ts`:
  - `'a designer label's box clears its text by the side
    padding'`: on `ONBOARDING`, with `document.fonts.ready`
    awaited, for every `.flow-edge` that has a label: the
    rect's `width` is over `LABEL_MIN_WIDTH`, and it less
    the text's `getComputedTextLength()` is within 2 of
    `2 * LABEL_SIDE_PADDING`. At least three labels are
    compared.

  In `tests/presenter-flow-stats.test.ts:315`, change
  `width="138"` to `width="120.80615234375"`.

- [ ] **Step 6: Run them; each new test fails** on the old
  7-and-12 widths, and "long names truncate as the
  designer's" fails on 138.

- [ ] **Step 7: Change the rule in `flow-graph.ts`** to the
  Interfaces block.

- [ ] **Step 8: Verify.** Both new files pass. `./test`
  shows exactly one failure: `flow-graph-golden.test.ts`
  "buildGraphSvg emits the pinned designer SVG", which
  Task 3 re-pins. Narrower labels move Auto Layout, so run
  `./test browser` whole and report every failure with its
  output. Change no existing browser test without the
  controller's word.

- [ ] **Step 9: Commit:**
  `Wrap each edge label snugly around its text`.

### Task 2: The showcase sizes its labels by the shared rule

**Agent:** `planner`

**Files:**
- Modify: `web-app/design-system/index.ts:8-12`, `:206-207`
- Modify: `web-app/app/flow-graph.ts` (`LABEL_CHAR_WIDTH`,
  `LABEL_PADDING` deleted)
- Modify: `tests/design-system-render.test.ts`

**Interfaces:**
- Consumes: `computeEdgeLabelWidth(name: string): number`
  from Task 1.
- Produces: nothing a later task reads.

- [ ] **Step 1: Write the failing test**
  `'the showcase boxes each edge label as the designer
  does'`: in `buildDesignSystemPage()`'s output, for each
  of `'submit'`, `'needs revision'`, and `'approve'`, the
  label rect that precedes that text carries
  `width="${computeEdgeLabelWidth(label)}"`.

- [ ] **Step 2: Run it; it fails** on the showcase's own
  54, 110, and 61.

- [ ] **Step 3: `buildFlowEdgeSvg` takes its `lw` from
  `computeEdgeLabelWidth(label)`.** Delete
  `LABEL_CHAR_WIDTH` and `LABEL_PADDING` from
  `flow-graph.ts` and from the showcase's import.

- [ ] **Step 4: Re-pin `'design-system render is
  byte-stable'`** to the new length and digest. Confirm by
  diffing the old render against the new that only those
  three rects' `x` and `width` moved.

- [ ] **Step 5: Verify.** `./test` shows only the golden
  failure Task 1 left.
  `grep -rn "LABEL_CHAR_WIDTH\|LABEL_PADDING" web-app tests`
  prints nothing.

- [ ] **Step 6: Commit:**
  `Size the showcase's edge labels by the shared rule`.

### Task 3: Re-pin the goldens and tell the documents

**Agent:** `coder`

**Files:**
- Modify: `tests/fixtures/flow-graph-golden-unlocked.svg`,
  `tests/fixtures/flow-graph-golden-locked.svg`
- Modify: `tests/flow-graph-golden.test.ts:8-14` (comment)
- Modify: `AGENTS.md` (`## Where things live`)
- Modify: `FLOW-CANVAS.md` (`## Stats variant`, "Edges and
  labels")
- Modify: `tests/flow-graph-geometry.test.ts:188-189`
  (comment deleted)

- [ ] **Step 1: Regenerate both fixtures.** They end
  without a newline; keep it so.

  ```bash
  deno run --frozen --allow-read --allow-write - <<'TS'
  import { goldenGraphSvg } from
      './tests/flow-graph-golden.test.ts';
  for (const [name, isLocked] of
      [['unlocked', false], ['locked', true]] as const) {
      await Deno.writeTextFile(
          `tests/fixtures/flow-graph-golden-${name}.svg`,
          goldenGraphSvg(isLocked),
      );
  }
  TS
  ```

- [ ] **Step 2: Prove the diff is confined.** The
  controller's brief carries `golden-confined.py`, which
  masks exactly the attributes a feature may move, in
  exactly the edge groups it may move them in, and demands
  the old and new fixtures be byte-identical otherwise.
  Run `python3 golden-confined.py snug HEAD`. It must
  print `confined changed` for both files and exit 0: only
  the label rect's `x` and `width` in the `ab`, `ba`, and
  `bz` groups moved. If it does not, stop and report; do
  not edit a fixture by hand.

- [ ] **Step 3: Reword the comment** at
  `tests/flow-graph-golden.test.ts:8-14` to:

  ```ts
  // The Flow Designer's SVG, pinned byte for byte. Each
  // fixture file holds what buildGraphSvg draws for this
  // flow, so a refactor of the designer's renderer must
  // reproduce it. The files are the covenant: a change
  // that breaks this test is fixed in the renderer. They
  // are re-pinned only where a design changes the drawing
  // on purpose, and only in the bytes that design names:
  // so far for snug edge labels (each label box's x and
  // width).
  ```

- [ ] **Step 4: `./test` passes whole.** Commit:
  `Re-pin the golden fixtures for snug labels`.

- [ ] **Step 5: In `AGENTS.md`** replace "as it was drawn
  before its helpers were shared," with "re-pinned only
  where a design changes the drawing," and re-wrap the
  bullet at its present width. Commit:
  `Describe the golden fixtures as re-pinned by design`.

- [ ] **Step 6: In `FLOW-CANVAS.md`**, after the "Edges and
  labels" bullet's last sentence, add:

  ```markdown
    A label's box is its text's width plus
    `LABEL_SIDE_PADDING` each side, never under
    `LABEL_MIN_WIDTH`. The text's width is the sum of Inter
    400's advances (`inter-400-advances.ts`) at
    `LABEL_FONT`: a pure function, so Auto Layout's
    reservation, both renderers, the in-gesture mutator,
    and the design-system showcase size a label alike with
    no DOM. A character outside the table takes the table's
    widest advance.
  ```

  Add to that section's `Pin:` paragraph every test name
  Tasks 1 and 2 added, each under its file, copied from the
  test files. Commit: `Document the snug label width`.

- [ ] **Step 7: Delete the two comment lines** at
  `tests/flow-graph-geometry.test.ts:188-189`. Touch
  nothing else in the file. Commit:
  `Drop the retired derivation of the label cap`.

---

# Feature 2: the lens

### Task 4: Pin a dragged pair's frame to its rebuilt form

**Agent:** `planner`

**Files:**
- Modify: `tests/browser/canvas-gestures.test.ts` (one test
  added)

**Interfaces:**
- Consumes: the designer as it stands. This pin is green
  before the lens and must stay green through Task 5.
- Produces: the test Task 5 runs to prove its wiring.

- [ ] **Step 1: Write the test** `'a dragged two-way pair
  draws mid-drag what it draws once dropped'`. On
  `ONBOARDING`, whose `Data Capture` and `Review` are a
  two-way pair, for two drop points, one that leaves the
  pair's centre line shallower than the down-right
  diagonal and one steeper:
  - press `Review`'s body, move to the drop point in
    steps, and wait one animation frame;
  - read, for each of the pair's two edges, both paths'
    `d`, the label rect's `x` and `y`, and the text's `x`
    and `y`;
  - release there, wait for the full rebuild, and read the
    same attributes again;
  - assert the two readings are equal.

  Read FLOW-CANVAS.md `## Gesture rendering` first. Hold
  whatever the page needs so the drop is not re-laid-out
  (Auto Layout) before the second reading.

- [ ] **Step 2: Run it; it passes.** It pins today's
  behaviour, so it is green.

- [ ] **Step 3: Prove it can fail.** In
  `flow-gesture-render.ts` pass `0` in place of
  `aimOffsets.get(edge.id)!`; run the test; it must fail.
  Restore the file; `git diff` is empty outside the test.

- [ ] **Step 4: Commit:**
  `Pin a dragged pair's frame to its rebuilt form`.

### Task 5: The lens geometry

**Agent:** `architect`

**Files:**
- Modify: `web-app/app/flow-graph.ts:106-110` (the `BIDI_*`
  constants), `:677-819` (`EdgeGeometry`,
  `computeEdgeGeometry`), `:855-870` and `:936-941`
  (`buildEdge`)
- Modify: `web-app/app/flow-gesture-render.ts:152-183`
- Modify: `web-app/app/flow-stats-graph.ts:147-166`
- Modify: `tests/flow-graph-geometry.test.ts`

**Interfaces:**
- Consumes: `computeEdgeLabelWidth` and `LABEL_HEIGHT`;
  `findCycleEdgeIds(nodes, edges)` from
  `flow-cycle-edges.ts`; `computeEdgeAimOffsets(edges)`,
  unchanged.
- Produces:
  - `computeEdgeGeometry(fromNode: GraphNode, toNode:
    GraphNode, aimOffset: number, isCycle: boolean,
    labelWidth: number, waypoints: readonly { x: number;
    y: number }[]): EdgeGeometry`. `EdgeGeometry` keeps
    its three fields.
  - `export const LANE_OFFSET = 8`, `BOW_FRAC = 0.045`,
    `BOW_MAX = 16`, `LABEL_GAP = 8`
  - `BIDI_SPREAD_FRAC`, `BIDI_SPREAD_MIN`,
    `BIDI_SPREAD_MAX`, `BIDI_LABEL_T`, and
    `BIDI_LABEL_OFFSET` are gone.
  - `aimOffset` keeps its name here. Task 7 renames it.

**The geometry**, in the spec's terms (its "Design: the
lens" is the contract; the mock's `lensGeo` and
`upperLeftNormal` show it, and are never copied):
- `aimOffset === 0`, coincident centres, or no chord: the
  edge draws exactly as a one-way edge draws today.
- Otherwise `n` is `u` for the forward edge and `-u` for
  the return edge, the one with `isCycle` true. `S` and `E`
  are where the lane through `c_from + n * LANE_OFFSET`
  leaves the source and enters the target.
  `bow = min(chord * BOW_FRAC, BOW_MAX)`.
- No waypoints: the path is `M S Q C E`, and the label's
  centre is `midpoint(S, E) + n * (bow + LABEL_GAP + h)`.
- Waypoints: the path is `buildWaypointPath(S, E,
  waypoints)`, and the label's centre is
  `pointAlongPolyline([S, ...waypoints, E], 0.5) + n *
  (LABEL_GAP + h)`.

- [ ] **Step 1: Pin the one-way edge before touching the
  geometry.** Add to `tests/flow-graph-geometry.test.ts`
  `'a one-way edge's path and label centre are
  unchanged'`, and run it green against the present code
  with the present signature:
  - `a` at (0, 0) to `b` at (300, 120), no waypoints:
    `pathD` is `'M 160 64 C 197.69615364994155 64,
    262.30384635005845 120, 300 120'`, the label (230, 92);
  - `a` at (0, 0) to `b` at (400, 200) through
    `{ x: 200, y: 0 }`: `pathD` is `'M 144 64 Q 144 64 172
    32 T 308 100 T 416 200'`, the label
    (276.8000681741456, 71.11117423532002).

- [ ] **Step 2: Write the lens's failing tests** in the
  same file, against the new signature. A pair is two
  states whose centres sit a given distance apart at a
  given angle, measured in SVG's own axes, so 45 degrees
  is down and to the right; its forward edge passes
  `isCycle` false and its return edge true. An edge's side
  is the sign of its label's offset from the pair's
  midpoint along the centre line's normal. Tolerance 1e-9
  wherever a length is compared.
  - `'a pair's attachments sit LANE_OFFSET either side of
    the centre line'`: at 0, 45, 90, 135, 180, 225, 270,
    and 315 degrees, each edge's `S` and `E` are
    `LANE_OFFSET` from the centre line, the forward edge's
    on `u`'s side and the return edge's on the other.
  - `'a label box sits LABEL_GAP beyond its arc's apex
    tangent'`: at each of those angles, for both edges, the
    box's nearest point to the tangent at the apex is
    `LABEL_GAP` from it, on the outer side.
  - `'a pair's labels face each other across the centre
    line and never overlap'`: at each angle, for widths
    `LABEL_MIN_WIDTH` and
    `computeEdgeLabelWidth('W'.repeat(18))`, in all four
    pairings of the two.
  - `'the forward label sits above a horizontal pair and
    left of a vertical one'`: forward running right and
    running left, the label is above the centre line;
    running down and running up, left of it.
  - `'the pair swaps sides across the down-right diagonal
    and across no other'`: the forward edge's side differs
    between 44 and 46 degrees, and between 224 and 226; it
    does not between 134 and 136, or between 314 and 316.
  - `'a pair exactly on the down-right diagonal puts its
    forward label up and to the right'`: centres apart by
    (200, 200) and by (-200, -200); the two labels are on
    opposite sides. (Review Focus 2.)
  - `'with equal label widths each edge is the other
    turned half a turn'`: about the pair's midpoint, the
    return edge's `S`, `E`, control point, and label centre
    are the forward edge's `E`, `S`, control point, and
    label centre reflected through it.
  - `'neither arc enters either state'`: at every half
    degree and at centre distances 180, 200, 243, 300, 400,
    600, and 900 (none lets the two states overlap), 32
    points along each arc, ends excluded, lie outside both
    rectangles. If one does not, stop and report it: that
    is a finding about the spec's numbers, not a test to
    loosen.
  - `'a short pair bows by its chord and a long pair stops
    at BOW_MAX'`: the apex stands `chord * BOW_FRAC` off
    the chord for centres 300 apart, and `BOW_MAX` for
    centres 900 apart. (Review Focus 3.)
  - `'touching and overlapping states emit finite
    numbers'`: for a pair touching, overlapping, coincident,
    and one unit short of touching, in both roles, every
    number in `pathD` and both label coordinates is finite.
  - `'a routed pair keeps its waypoints and gains the
    outside label'`: with one waypoint, the path runs from
    `S` through `Q` and `T` segments to `E`, and the label
    stands `LABEL_GAP + h` along `n` from the route's
    midpoint.

- [ ] **Step 3: Run them; each fails** to type-check or to
  hold.

- [ ] **Step 4: Change `computeEdgeGeometry` and its three
  callers.** Each caller computes
  `computeEdgeLabelWidth(edge.name)` before the geometry
  and passes it with `cycleEdgeIds.has(edge.id)`. The
  in-gesture mutator gets `cycleEdgeIds` from
  `findCycleEdgeIds(graph.nodes, graph.edges)`. Give the
  three existing tests that call `computeEdgeGeometry` the
  new arguments; "a two-way pair aims both edges off-axis
  and renders both computed paths" keeps every assertion
  it has.

- [ ] **Step 5: Verify.**
  - `tests/flow-graph-geometry.test.ts` passes.
  - `./test` shows exactly one failure, the golden test,
    which Task 6 re-pins. `tests/flow-stats-parity.test.ts`
    passes, and `git diff master --
    tests/flow-stats-parity.test.ts` is empty.
  - Task 4's test passes. Then prove it sees the role: pass
    `false` for `isCycle` in the mutator, see it fail,
    restore.
  - Run `./test browser` whole and report every failure
    with its output. Change no existing browser test
    without the controller's word.

- [ ] **Step 6: Commit:** `Draw a two-way pair as a lens`.

### Task 6: Re-pin the goldens and tell the documents

**Agent:** `coder`

**Files:**
- Modify: both `tests/fixtures/flow-graph-golden-*.svg`
- Modify: `tests/flow-graph-golden.test.ts` (comment)
- Modify: `FLOW-CANVAS.md` (`## Gesture rendering`,
  `## Stats variant`)
- Modify: `tests/flow-edge-label.test.ts:6-11` (comment)

- [ ] **Step 1: Regenerate both fixtures** with Task 3's
  Step 1 command.

- [ ] **Step 2: Prove the diff is confined:**
  `python3 golden-confined.py lens HEAD` prints
  `confined changed` twice and exits 0: only the `ab` and
  `ba` groups' two path `d`s, label rect `x` and `y`, and
  text `x` and `y` moved. If not, stop and report.

- [ ] **Step 3: End the golden test's comment** with
  "(each label box's x and width) and for the two-way lens
  (the pair's paths and its labels' places)." in place of
  "(each label box's x and width).", re-wrapped.

- [ ] **Step 4: `./test` passes whole.** Commit:
  `Re-pin the golden fixtures for the lens`.

- [ ] **Step 5: In `FLOW-CANVAS.md`**, after the passage
  Task 3 added, add:

  ```markdown
    A two-way pair draws as a lens. `u` is the unit normal
    of the line between the two centres that points up and
    to the left; the forward edge takes `u`'s side and the
    return edge, the pair's loop-back by
    `findCycleEdgeIds`, the other, so the forward edge is
    on top of a horizontal pair and on the left of a
    vertical one whichever way it runs. Each edge runs from
    where its lane, `LANE_OFFSET` off the centre line,
    leaves the source to where it enters the target, as one
    arc bowing outward by `min(chord * BOW_FRAC, BOW_MAX)`.
    Its label sits `LABEL_GAP` beyond the arc's apex
    tangent, outside the pair. A routed pair keeps its
    waypoints between the same lane points. States that
    touch draw their pair as one-way edges.
  ```

  In `## Gesture rendering`, after "(`computeEdgeGeometry`,
  `buildConnectPreview`, `marqueeDrawRect`)", add: ", with
  each pair's return edge found by `findCycleEdgeIds` as
  the rebuild finds it". Add the names of Task 4's and
  Task 5's new tests to the `Pin:` paragraph, copied from
  the test files. Commit: `Document the two-way lens`.

- [ ] **Step 6: In `tests/flow-edge-label.test.ts:6-11`**
  replace "the deliberate two-way perpendicular offset is
  applied on top of this point, not tested here." with "a
  routed two-way pair's label is pushed outward from this
  point, which tests/flow-graph-geometry.test.ts covers.",
  re-wrapped under 78 characters. Commit:
  `Bring the label anchor comment up to date`.

### Task 7: Rename `aimOffset` to `lane`

**Agent:** `coder`

**Files:**
- Modify: `web-app/app/flow-graph.ts`,
  `web-app/app/flow-gesture-render.ts`,
  `web-app/app/flow-stats-graph.ts`,
  `tests/flow-graph-geometry.test.ts`, `FLOW-CANVAS.md`

A rename and nothing else. No logic, no assertion, and no
other wording changes in this commit.

| Before | After |
|---|---|
| `aimOffset` | `lane` |
| `aimOffsets` | `lanes` |
| `computeEdgeAimOffsets` | `computeEdgeLanes` |
| "a two-way pair aims both edges off-axis and renders both computed paths" | "a two-way pair gives each edge its own lane and renders both computed paths" |
| "a lone edge between distinct pairs aims straight" | "a lone edge between distinct pairs keeps the centre line" |

- [ ] **Step 1: Apply the table** to code, comments, test
  titles, and `FLOW-CANVAS.md`. Leave `docs/` alone: it
  records what was true when it was written.

- [ ] **Step 2: Verify.**
  `grep -rnE "aimOffset|AimOffset|aims both|aims straight"
  web-app tests FLOW-CANVAS.md AGENTS.md` prints nothing.
  `./test` passes whole. `./test lint` passes.

- [ ] **Step 3: Commit:** `Rename aimOffset -> lane`.

### Task 8: Whole-branch review

**Agent:** `architect`

- [ ] Review `git diff master...HEAD` against the spec and
  this plan: every Global Constraint, every anti-goal, the
  golden diffs' confinement, `tests/flow-stats-parity.test.ts`
  untouched, the two truncation tests' code untouched, one
  home for every tunable, and no parameter default.
- [ ] Report findings ranked by severity. The controller
  dispatches the fixes.

## The controller's close

- [ ] Squash to: the snug feature (Tasks 1 to 3) as
  `Wrap each edge label snugly around its text`; the lens
  feature (Tasks 4 to 6) as `Draw a two-way pair as a
  lens`; and Task 7's rename, kept as its own commit. The
  design and plan commits stay as they are. The squashed
  tip's tree must equal the unsquashed tip's.
- [ ] Re-run `golden-confined.py` against each feature
  commit and its parent.
- [ ] `./test validate browser`: Layer 1, then Layer 2.
- [ ] Start `./bin/develop 8080 --postgres mock-data` as
  AGENTS.md prescribes, reveal the seeded sign-ins, and
  show a two-way pair at horizontal, diagonal, and
  vertical on the Flow Designer and on the stats page.
- [ ] Report the branch name and stop. The operator
  merges.
