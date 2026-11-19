import type { GraphNode } from '../../shared/types.ts';
import type { FlowGraph } from '../../client/flow-queries.ts';
import {
    applyAutoLayout,
    runsAutoLayout,
    type Waypoint,
} from './flow-designer-actions.ts';

// The stats canvas's size at load. Until it measures, there
// is no size to lay a flow out for.
export type CanvasMeasure =
    | { readonly kind: 'measured';
        readonly w: number; readonly h: number }
    | { readonly kind: 'unmeasured' };

// Where the flow's states sit, and the waypoints of the
// edges the layout routes around them, keyed by edge id.
export interface FlowArrangement {
    readonly nodes: readonly GraphNode[];
    readonly edgeWaypoints:
        ReadonlyMap<string, readonly Waypoint[]>;
}

// Stats has no properties panel, so none narrows its canvas.
const NO_PANEL_PX = 0;

// Arrange a renderable graph (getRenderableFlowGraph's) by
// the designer's rule: a flow the designer lays out itself
// is laid out for the measured canvas; any other keeps its
// renderable positions. computeLayout rejects a graph with
// no Create node, so a startless flow keeps its positions
// too, as withRenderableLayout leaves it.
export function arrangeFlow(
    graph: FlowGraph, canvas: CanvasMeasure,
): FlowArrangement {
    if (
        canvas.kind === 'measured'
        && runsAutoLayout(graph)
        && graph.nodes.some(n => n.isCreate)
    ) {
        return applyAutoLayout(
            graph.nodes, graph.edges,
            canvas.w, canvas.h,
            false, NO_PANEL_PX,
        );
    }
    return { nodes: graph.nodes, edgeWaypoints: new Map() };
}
