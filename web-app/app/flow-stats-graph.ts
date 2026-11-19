// Read-only SVG renderer for the flow-stats canvas.
// Sibling to flow-graph.ts's buildGraphSvg — shares
// geometry constants and pure helpers, but has no
// editor affordances (no role=button, tabindex, ports,
// animate filters, or aria-current).
import type { SafeHtml } from './safe-html.ts';
import { trusted, escapeForHtml } from './safe-html.ts';
import type {
    GraphEdge, GraphNode,
} from '../../shared/types.ts';
import {
    NODE_WIDTH, NODE_HEIGHT,
} from './flow-layout.ts';
import {
    NODE_RADIUS, GRID_CELL,
    ARROW_VIEWBOX, ARROW_MIDPOINT, ARROW_MARKER,
    NODE_LABEL_Y, NODE_LABEL_Y_CENTERED, NODE_META_Y,
    LABEL_HEIGHT, LABEL_RADIUS, LABEL_TEXT_OFFSET_Y,
    computeEdgeGeometry, computeEdgeAimOffsets,
    computeEdgeLabelWidth,
    truncateNodeName, truncateEdgeLabel,
} from './flow-graph.ts';
import type { FlowArrangement } from './flow-arrangement.ts';
import { findCycleEdgeIds } from './flow-cycle-edges.ts';
import {
    ALERT_TRIANGLE_SHAPES,
    ICON_VIEWBOX,
    NO_ENTRY_SHAPES,
} from './icons.ts';
import { formatMinAscending } from './duration-units.ts';
import { DISPLAY_ABSENT } from './format.ts';
import type {
    FlowStatsModel, NodeStat,
} from './flow-stats-aggregate.ts';

// --- local geometry constants -------------------------
// Geometry only. Every paint property — edge/arrowhead
// stroke & dash, node and label text size/anchor/fill,
// hazard glyph stroke, grid colours — lives in
// pages-flow-stats.css; this renderer emits structure
// (d, transform, x/y, class, data-*), nothing
// presentational.

const GRID_DOT_RADIUS = 0.7;

// Hazard glyph sits in the bottom-left of the node rect.
const HAZARD_ICON_SIZE = 16;
const HAZARD_X = 6;
const HAZARD_Y = 42;

// --- public types -------------------------------------

interface ViewBox {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
}

// Highlight set: when non-null, nodes/edges NOT in the
// set get data-dim="true"; those IN the set get
// data-on-path="true". When null, neither attribute
// is emitted (no highlight active).
interface Highlight {
    readonly nodeIds: ReadonlySet<string>;
    readonly edgeIds: ReadonlySet<string>;
}

// --- helpers ------------------------------------------

// pages-flow-stats.css fills the grid with this pattern.
const GRID_PATTERN_ID = 'stats-grid';

// Stats-canvas defs: dotted grid + one arrowhead marker.
// No animated glow filter — this canvas is static. The
// marker has the designer's size and, like it, no
// markerUnits, so the head scales with the CSS stroke.
function buildDefs(): string {
    const gridCenter = GRID_CELL / 2;
    const halfCell   = GRID_CELL / 2;
    const arrowPath  =
        'M 0 0 L ' + String(ARROW_VIEWBOX)
        + ' ' + String(ARROW_MIDPOINT)
        + ' L 0 ' + String(ARROW_VIEWBOX) + ' z';
    const markerAttrs =
        ' viewBox="0 0'
        + ' ' + String(ARROW_VIEWBOX)
        + ' ' + String(ARROW_VIEWBOX) + '"'
        + ' refX="' + String(ARROW_VIEWBOX) + '"'
        + ' refY="' + String(ARROW_MIDPOINT) + '"'
        + ' markerWidth="' + String(ARROW_MARKER) + '"'
        + ' markerHeight="' + String(ARROW_MARKER) + '"'
        + ' orient="auto-start-reverse">';
    return '<defs>'
        + '<pattern id="' + GRID_PATTERN_ID + '"'
        + ' width="' + String(GRID_CELL) + '"'
        + ' height="' + String(GRID_CELL) + '"'
        + ' patternUnits="userSpaceOnUse"'
        + ' patternTransform="translate('
        + String(-halfCell) + ', '
        + String(-halfCell) + ')">'
        + '<circle class="flow-stats-grid-dot"'
        + ' cx="' + String(gridCenter) + '"'
        + ' cy="' + String(gridCenter) + '"'
        + ' r="' + String(GRID_DOT_RADIUS) + '"/>'
        + '</pattern>'
        + '<marker id="stats-arrow"'
        + markerAttrs
        + '<path d="' + arrowPath + '"'
        + ' class="flow-stats-arrowhead"/>'
        + '</marker>'
        + '</defs>';
}

function buildGrid(vb: ViewBox): string {
    return '<rect'
        + ' class="flow-stats-grid-bg"'
        + ' x="' + String(vb.x) + '"'
        + ' y="' + String(vb.y) + '"'
        + ' width="' + String(vb.w) + '"'
        + ' height="' + String(vb.h) + '"/>'
        + '<rect'
        + ' class="flow-stats-grid-dots"'
        + ' x="' + String(vb.x) + '"'
        + ' y="' + String(vb.y) + '"'
        + ' width="' + String(vb.w) + '"'
        + ' height="' + String(vb.h) + '"/>';
}

// dim/on-path are mutually exclusive; with no highlight
// both are omitted (no-highlight state, not the same as
// dim).
function highlightAttrs(
    highlight: Highlight | null,
    isOnPath: (h: Highlight) => boolean,
): string {
    if (highlight === null) return '';
    return isOnPath(highlight)
        ? ' data-on-path="true"'
        : ' data-dim="true"';
}

// The edge's path and, unless it leaves Create, its
// transition's name in a label box: the designer's
// geometry (computeEdgeGeometry), placed and truncated as
// the designer places and truncates it.
function buildEdge(
    edge: GraphEdge,
    fromNode: GraphNode,
    toNode: GraphNode,
    aimOffset: number,
    waypoints: readonly { x: number; y: number }[],
    highlight: Highlight | null,
    isCycle: boolean,
): string {
    const geo = computeEdgeGeometry(
        fromNode, toNode, aimOffset, waypoints,
    );
    const cycleAttr = isCycle ? ' data-cycle="true"' : '';
    const pathAttrs = highlightAttrs(
        highlight, h => h.edgeIds.has(edge.id),
    );

    let label = '';
    if (!fromNode.isCreate) {
        const labelW = computeEdgeLabelWidth(edge.name);
        label = '<rect'
            + ' class="flow-stats-edge-label-bg"'
            + ' x="' + String(geo.labelX - labelW / 2) + '"'
            + ' y="' + String(geo.labelY - LABEL_HEIGHT / 2) + '"'
            + ' width="' + String(labelW) + '"'
            + ' height="' + String(LABEL_HEIGHT) + '"'
            + ' rx="' + String(LABEL_RADIUS) + '"/>'
            + '<text'
            + ' class="flow-stats-edge-label"'
            + ' x="' + String(geo.labelX) + '"'
            + ' y="'
            + String(geo.labelY + LABEL_TEXT_OFFSET_Y) + '">'
            + escapeForHtml(truncateEdgeLabel(edge.name))
            + '</text>';
    }

    return '<g'
        + ' class="flow-stats-edge"'
        + ' data-edge-id="' + escapeForHtml(edge.id) + '"'
        + cycleAttr
        + pathAttrs + '>'
        + '<path'
        + ' class="flow-stats-edge-path"'
        + ' d="' + geo.pathD + '"/>'
        + label
        + '</g>';
}

// A hazard glyph with no paint of its own: its stroke
// comes from the glyph's class in pages-flow-stats.css.
function buildHazard(
    cssClass: string,
    title: string,
    shapes: string,
): string {
    return '<g'
        + ' class="' + cssClass + '"'
        + ' transform="translate('
        + String(HAZARD_X) + ', '
        + String(HAZARD_Y) + ')">'
        + '<title>' + title + '</title>'
        + '<svg xmlns="http://www.w3.org/2000/svg"'
        + ' width="' + String(HAZARD_ICON_SIZE) + '"'
        + ' height="' + String(HAZARD_ICON_SIZE) + '"'
        + ' viewBox="' + ICON_VIEWBOX + '"'
        + ' aria-hidden="true">'
        + shapes
        + '</svg>'
        + '</g>';
}

function buildNode(
    n: NodeStat,
    at: GraphNode,
    highlight: Highlight | null,
): string {
    const halfW = NODE_WIDTH / 2;

    let inner = '';

    inner += '<rect'
        + ' class="flow-stats-node-rect"'
        + ' width="' + String(NODE_WIDTH) + '"'
        + ' height="' + String(NODE_HEIGHT) + '"'
        + ' rx="' + String(NODE_RADIUS) + '"'
        + ' ry="' + String(NODE_RADIUS) + '"/>';

    // Create and Archive hold no time: the name alone,
    // centred, as in the designer. A regular node's second
    // line is its average sojourn, or the absent marker
    // when it has no time in the window.
    const isSpecial = n.isCreate || n.isArchive;
    inner += '<text'
        + ' class="flow-stats-node-name"'
        + ' x="' + String(halfW) + '"'
        + ' y="' + String(
            isSpecial ? NODE_LABEL_Y_CENTERED : NODE_LABEL_Y,
        ) + '">'
        + escapeForHtml(truncateNodeName(n.displayName))
        + '</text>';

    if (!isSpecial) {
        const sojourn = n.avgSeconds === null
            ? DISPLAY_ABSENT
            : formatMinAscending(n.avgSeconds);
        inner += '<text'
            + ' class="flow-stats-node-face"'
            + ' x="' + String(halfW) + '"'
            + ' y="' + String(NODE_META_Y) + '">'
            + escapeForHtml(sojourn) + '</text>';
    }

    if (n.memberHazard === 'warning') {
        inner += buildHazard(
            'flow-stats-node-warning',
            'Single member assigned (no backup)',
            ALERT_TRIANGLE_SHAPES,
        );
    } else if (n.memberHazard === 'danger') {
        // Dead-end is the only danger variant the
        // stats canvas can self-disambiguate
        // (NodeStat carries outgoingEdgeIds but
        // not memberIds); zero-members falls
        // through to the same generic title.
        inner += buildHazard(
            'flow-stats-node-danger',
            n.outgoingEdgeIds.length === 0
                ? 'Dead end (no outgoing edges)'
                : 'Members required',
            NO_ENTRY_SHAPES,
        );
    }

    // Same highlight semantics as edges.
    const pathAttrs = highlightAttrs(
        highlight, h => h.nodeIds.has(n.id),
    );

    // data-special only on start/complete nodes.
    const specialAttr = n.isCreate
        ? ' data-special="start"'
        : n.isArchive
        ? ' data-special="archive"'
        : '';

    // Attribute order keeps test regexes happy:
    // class → data-node-id → style → transform →
    // data-special? → data-dim? → data-on-path?
    return '<g'
        + ' class="flow-stats-node"'
        + ' data-node-id="' + escapeForHtml(n.id) + '"'
        + ' style="--heat-t: '
        + n.heatT.toFixed(2) + '"'
        + ' transform="translate('
        + String(at.positionX) + ', '
        + String(at.positionY) + ')"'
        + specialAttr
        + pathAttrs + '>'
        + inner
        + '</g>';
}

// --- public API ---------------------------------------

// Draw the statistics over the arrangement: each state
// where the arrangement places it, each edge by the
// designer's geometry through the arrangement's
// waypoints.
export function buildStatsGraphSvg(
    model: FlowStatsModel,
    arrangement: FlowArrangement,
    viewBox: ViewBox,
    highlight: Highlight | null,
): SafeHtml {
    const placed = new Map(
        arrangement.nodes.map(n => [n.id, n]),
    );
    const cycleEdgeIds = findCycleEdgeIds(
        arrangement.nodes, model.edges,
    );
    const aimOffsets = computeEdgeAimOffsets(model.edges);

    let edgeMarkup = '';
    for (const edge of model.edges) {
        const from = placed.get(edge.fromNodeId);
        const to   = placed.get(edge.toNodeId);
        if (!from || !to) continue;
        edgeMarkup += buildEdge(
            edge, from, to,
            aimOffsets.get(edge.id)!,
            arrangement.edgeWaypoints.get(edge.id) ?? [],
            highlight,
            cycleEdgeIds.has(edge.id),
        );
    }

    let nodeMarkup = '';
    for (const n of model.nodes) {
        const at = placed.get(n.id);
        if (at === undefined) {
            throw new Error(
                `state ${n.id} has no place in the arrangement`,
            );
        }
        nodeMarkup += buildNode(n, at, highlight);
    }

    const vbStr = String(viewBox.x)
        + ' ' + String(viewBox.y)
        + ' ' + String(viewBox.w)
        + ' ' + String(viewBox.h);

    const stateLabel = model.nodes.length === 1
        ? '1 state'
        : String(model.nodes.length) + ' states';
    const transLabel = model.edges.length === 1
        ? '1 transition'
        : String(model.edges.length) + ' transitions';
    const canvasLabel =
        'Flow statistics canvas: '
        + stateLabel + ', ' + transLabel;

    return trusted(
        '<svg'
        + ' xmlns="http://www.w3.org/2000/svg"'
        + ' class="flow-stats-canvas"'
        + ' role="img"'
        + ' aria-label="' + escapeForHtml(canvasLabel) + '"'
        + ' viewBox="' + vbStr + '"'
        + ' preserveAspectRatio="xMidYMid meet"'
        + ' width="100%"'
        + ' height="100%">'
        + buildDefs()
        + buildGrid(viewBox)
        + '<g class="flow-stats-content">'
        + edgeMarkup
        + nodeMarkup
        + '</g>'
        + '</svg>',
    );
}
