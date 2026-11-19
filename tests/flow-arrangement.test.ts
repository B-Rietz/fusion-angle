import {
    assert, assertEquals, assertNotEquals,
} from '@std/assert';
import {
    arrangeFlow,
    type CanvasMeasure,
} from '../web-app/app/flow-arrangement.ts';
import {
    areNodePositionsDegenerate,
    withRenderableLayout,
} from '../web-app/app/flow-graph-layout.ts';
import {
    FlowDesignerPresenter,
    buildInitialFlowSnapshot,
    type FlowSnapshot,
} from '../web-app/app/presenters/flow-designer.ts';
import {
    buildFlowHistorySnapshot,
} from '../web-app/app/flow-history.ts';
import {
    DEFAULT_LOCK_TIMEOUT,
    storedGraph,
} from '../shared/types.ts';
import type {
    FlowWithGraph,
    GraphNode,
    GraphEdge,
} from '../shared/types.ts';
import type { FlowGraph } from
    '../client/flow-queries.ts';
import { responseMessage } from
    './fixtures/response-message.ts';

// --- builders ------------------------------------------------

type NodeOpts = {
    positionX?: number;
    positionY?: number;
    isCreate?: boolean;
    isArchive?: boolean;
};

function node(id: string, o: NodeOpts = {}): GraphNode {
    return {
        id,
        name: id,
        positionX: o.positionX ?? 0,
        positionY: o.positionY ?? 0,
        isCreate: o.isCreate ?? false,
        isArchive: o.isArchive ?? false,
        memberIds: [],
        attributes: [],
        taskInstructions: '',
    };
}

function edge(from: string, to: string): GraphEdge {
    return {
        id: `${from}->${to}`,
        name: 'go',
        fromNodeId: from,
        toNodeId: to,
    };
}

// The graph as the page receives it: getRenderableFlowGraph
// runs withRenderableLayout over the fetched flow.
function flowGraph(o: {
    isAutoLayout: boolean;
    isLocked?: boolean;
    nodes: GraphNode[];
    edges: GraphEdge[];
}): FlowGraph {
    const isLocked = o.isLocked ?? false;
    return withRenderableLayout({
        message: responseMessage<FlowWithGraph>({
            id: 'ZOousbbnzpqlxJExVAruYQ',
            organization_id: 'AjdvjuECVZEgZoFajaIEkg',
            name: 'F1',
            is_locked: isLocked,
            is_auto_layout: o.isAutoLayout,
            is_auto_fit: true,
            lock_timeout: DEFAULT_LOCK_TIMEOUT,
            graph: storedGraph({
                nodes: o.nodes, edges: o.edges,
            }),
        }),
        id: 'ZOousbbnzpqlxJExVAruYQ',
        name: 'F1',
        isLocked,
        isAutoLayout: o.isAutoLayout,
        isAutoFit: true,
        lockTimeout: DEFAULT_LOCK_TIMEOUT,
        nodes: o.nodes,
        edges: o.edges,
    });
}

// Create, six states, and Archive in a chain. It wraps one
// way on a landscape canvas and another on a portrait one.
function eightStateChain(
    o: { isAutoLayout: boolean; isLocked?: boolean },
): FlowGraph {
    const ids = ['s', 'a', 'b', 'c', 'd', 'e', 'f', 'z'];
    return flowGraph({
        ...o,
        nodes: ids.map(id => node(id, {
            isCreate: id === 's',
            isArchive: id === 'z',
        })),
        edges: ids.slice(1).map(
            (id, i) => edge(ids[i]!, id),
        ),
    });
}

// computeLayout's Create->Archive shortcut fixture
// (tests/flow-layout.test.ts). On a landscape canvas the
// shortcut bends through a waypoint.
function shortcutFlow(): FlowGraph {
    return flowGraph({
        isAutoLayout: true,
        nodes: [
            node('s', { isCreate: true }),
            node('a'),
            node('b'),
            node('z', { isArchive: true }),
        ],
        edges: [edge('s', 'a'), edge('a', 'b'), edge('s', 'z')],
    });
}

function measured(w: number, h: number): CanvasMeasure {
    return { kind: 'measured', w, h };
}

const CANVAS_SIZES = [
    [1100, 640], [900, 500], [600, 800],
] as const;

// tests/flow-designer-open.test.ts's bootDesigner, minus
// the fetch: the designer's opening snapshot at w x h.
function designerBoot(
    graph: FlowGraph, w: number, h: number,
): FlowSnapshot {
    const presenter = new FlowDesignerPresenter(
        buildInitialFlowSnapshot(graph, w, h, [], [], []),
        w, h,
        buildFlowHistorySnapshot(false),
    );
    presenter.withCanvasSize(w, h);
    return presenter.withLayoutReconciled();
}

function assertMatchesDesigner(
    graph: FlowGraph, w: number, h: number,
): void {
    const arrangement = arrangeFlow(graph, measured(w, h));
    const designer = designerBoot(graph, w, h);
    assertEquals(arrangement.nodes, designer.nodes);
    assertEquals(
        arrangement.edgeWaypoints, designer.edgeWaypoints,
    );
}

function storedPositions(
    nodes: readonly GraphNode[],
): [string, number, number][] {
    return nodes.map(n => [n.id, n.positionX, n.positionY]);
}

// --- tests ---------------------------------------------------

Deno.test("matches the designer's boot layout", () => {
    for (const graph of [
        eightStateChain({ isAutoLayout: true }),
        shortcutFlow(),
    ]) {
        for (const [w, h] of CANVAS_SIZES) {
            assertMatchesDesigner(graph, w, h);
        }
    }
    const shortcut = arrangeFlow(
        shortcutFlow(), measured(1100, 640),
    ).edgeWaypoints.get('s->z');
    assert(
        shortcut !== undefined && shortcut.length > 0,
        'the Create->Archive shortcut keeps its waypoints',
    );
    const chain = eightStateChain({ isAutoLayout: true });
    assertNotEquals(
        arrangeFlow(chain, measured(900, 500)).nodes,
        arrangeFlow(chain, measured(600, 800)).nodes,
    );
});

Deno.test('a locked flow keeps its renderable positions', () => {
    const graph = eightStateChain({
        isAutoLayout: true, isLocked: true,
    });
    for (const [w, h] of CANVAS_SIZES) {
        assertMatchesDesigner(graph, w, h);
        const arrangement = arrangeFlow(graph, measured(w, h));
        assertEquals(
            storedPositions(arrangement.nodes),
            storedPositions(graph.nodes),
        );
        assertEquals(arrangement.edgeWaypoints.size, 0);
    }
});

Deno.test(
    'with Auto Layout off a non-degenerate flow keeps its'
    + ' stored positions',
    () => {
        const nodes = [
            node('s', {
                isCreate: true, positionX: 40, positionY: 300,
            }),
            node('a', { positionX: 420, positionY: 90 }),
            node('b', { positionX: 777, positionY: 512 }),
            node('z', {
                isArchive: true,
                positionX: 1200, positionY: 260,
            }),
        ];
        const graph = flowGraph({
            isAutoLayout: false,
            nodes,
            edges: [
                edge('s', 'a'), edge('a', 'b'),
                edge('b', 'z'), edge('s', 'z'),
            ],
        });
        for (const [w, h] of CANVAS_SIZES) {
            const arrangement =
                arrangeFlow(graph, measured(w, h));
            assertEquals(
                storedPositions(arrangement.nodes),
                storedPositions(nodes),
            );
            assertEquals(arrangement.edgeWaypoints.size, 0);
            assertMatchesDesigner(graph, w, h);
        }
    },
);

Deno.test('a degenerate non-auto flow matches the designer', () => {
    const graph = eightStateChain({ isAutoLayout: false });
    for (const [w, h] of CANVAS_SIZES) {
        assertMatchesDesigner(graph, w, h);
        assert(!areNodePositionsDegenerate(
            arrangeFlow(graph, measured(w, h)).nodes,
        ));
    }
});

Deno.test('an unmeasured canvas lays nothing out', () => {
    const graph = shortcutFlow();
    const arrangement =
        arrangeFlow(graph, { kind: 'unmeasured' });
    assertEquals(
        storedPositions(arrangement.nodes),
        storedPositions(graph.nodes),
    );
    assertEquals(arrangement.edgeWaypoints.size, 0);
});

Deno.test('a startless auto-layout flow is not laid out', () => {
    const nodes = [
        node('a', { positionX: 0, positionY: 0 }),
        node('b', { positionX: 0, positionY: 0 }),
        node('z', { isArchive: true }),
    ];
    const graph = flowGraph({
        isAutoLayout: true,
        nodes,
        edges: [edge('a', 'b'), edge('b', 'z')],
    });
    for (const [w, h] of CANVAS_SIZES) {
        const arrangement = arrangeFlow(graph, measured(w, h));
        assertEquals(
            storedPositions(arrangement.nodes),
            storedPositions(nodes),
        );
        assertEquals(arrangement.edgeWaypoints.size, 0);
    }
});

Deno.test('an empty flow arranges to nothing', () => {
    const graph = flowGraph({
        isAutoLayout: true, nodes: [], edges: [],
    });
    for (const canvas of [
        measured(1100, 640),
        { kind: 'unmeasured' } as const,
    ]) {
        const arrangement = arrangeFlow(graph, canvas);
        assertEquals(arrangement.nodes, []);
        assertEquals(arrangement.edgeWaypoints.size, 0);
    }
});
