import {
    assert,
    assertEquals,
    assertNotStrictEquals,
    assertStrictEquals,
} from '@std/assert';
import {
    buildGraphSvg,
    computeEdgeGeometry,
    computeEdgeAimOffsets,
    connectionPortOf,
    truncateEdgeLabel,
    truncateNodeName,
} from '../web-app/app/flow-graph.ts';
import {
    runsAutoLayout,
} from '../web-app/app/flow-designer-actions.ts';
import type {
    GraphEdge,
    GraphNode,
} from '../shared/types.ts';

function node(
    id: string,
    positionX: number,
    positionY: number,
): GraphNode {
    return {
        id,
        name: 'N',
        positionX,
        positionY,
        isCreate: false,
        isArchive: false,
        memberIds: [],
        attributes: [],
        taskInstructions: '',
    };
}

function edge(
    id: string,
    from: string,
    to: string,
): GraphEdge {
    return {
        id,
        name: 'go',
        fromNodeId: from,
        toNodeId: to,
    };
}

function render(
    nodes: GraphNode[],
    edges: GraphEdge[],
    waypoints: Map<
        string,
        { x: number; y: number }[]
    >,
): string {
    return buildGraphSvg(
        nodes, edges,
        0, 0, 800, 600,
        { kind: 'none' },
        false, false, null,
        waypoints,
        '',
    ).toString();
}

Deno.test(
    'the rendered edge path is exactly the'
    + ' computed geometry',
    () => {
        const nodes = [
            node('a', 0, 0),
            node('b', 300, 120),
        ];
        const edges = [edge('YiJPbufDpkyrZcZCYbUJpg', 'a', 'b')];
        const offsets =
            computeEdgeAimOffsets(edges);
        const geo = computeEdgeGeometry(
            nodes[0]!, nodes[1]!,
            offsets.get('YiJPbufDpkyrZcZCYbUJpg')!, [],
        );
        const out = render(
            nodes, edges, new Map(),
        );
        assert(
            out.includes(`d="${geo.pathD}"`),
        );
        assert(
            out.includes(`x="${geo.labelX}"`),
        );
    },
);

Deno.test(
    'a two-way pair aims both edges off-axis'
    + ' and renders both computed paths',
    () => {
        const nodes = [
            node('a', 0, 0),
            node('b', 300, 0),
        ];
        const edges = [
            edge('YiJPbufDpkyrZcZCYbUJpg', 'a', 'b'),
            edge('e2', 'b', 'a'),
        ];
        const offsets =
            computeEdgeAimOffsets(edges);
        assertStrictEquals(offsets.get('YiJPbufDpkyrZcZCYbUJpg'), 1);
        assertStrictEquals(offsets.get('e2'), 1);
        const g1 = computeEdgeGeometry(
            nodes[0]!, nodes[1]!, 1, [],
        );
        const g2 = computeEdgeGeometry(
            nodes[1]!, nodes[0]!, 1, [],
        );
        assertNotStrictEquals(g1.pathD, g2.pathD);
        const out = render(
            nodes, edges, new Map(),
        );
        assert(
            out.includes(`d="${g1.pathD}"`),
        );
        assert(
            out.includes(`d="${g2.pathD}"`),
        );
    },
);

Deno.test(
    'a lone edge between distinct pairs aims'
    + ' straight',
    () => {
        const edges = [
            edge('YiJPbufDpkyrZcZCYbUJpg', 'a', 'b'),
            edge('e2', 'b', 'c'),
        ];
        const offsets =
            computeEdgeAimOffsets(edges);
        assertStrictEquals(offsets.get('YiJPbufDpkyrZcZCYbUJpg'), 0);
        assertStrictEquals(offsets.get('e2'), 0);
    },
);

Deno.test(
    'a waypoint edge renders the computed'
    + ' polyline path',
    () => {
        const nodes = [
            node('a', 0, 0),
            node('b', 400, 200),
        ];
        const edges = [edge('YiJPbufDpkyrZcZCYbUJpg', 'a', 'b')];
        const wps = [{ x: 200, y: 0 }];
        const geo = computeEdgeGeometry(
            nodes[0]!, nodes[1]!, 0, wps,
        );
        const out = render(
            nodes, edges,
            new Map([['YiJPbufDpkyrZcZCYbUJpg', wps]]),
        );
        assert(
            out.includes(`d="${geo.pathD}"`),
        );
        assert(geo.pathD.includes(' Q '));
    },
);

Deno.test(
    'truncateNodeName keeps 18 characters and cuts 19 to'
    + ' 17 plus an ellipsis',
    () => {
        assertStrictEquals(
            truncateNodeName('abcdefghijklmnopqr'),
            'abcdefghijklmnopqr',
        );
        assertStrictEquals(
            truncateNodeName('abcdefghijklmnopqrs'),
            'abcdefghijklmnopq…',
        );
    },
);

// floor((140 - 12) / 7) = 18: the label's width cap less
// its padding, in characters.
Deno.test(
    'truncateEdgeLabel keeps 18 characters and cuts 19 to'
    + ' 17 plus an ellipsis',
    () => {
        assertStrictEquals(
            truncateEdgeLabel('abcdefghijklmnopqr'),
            'abcdefghijklmnopqr',
        );
        assertStrictEquals(
            truncateEdgeLabel('abcdefghijklmnopqrs'),
            'abcdefghijklmnopq…',
        );
    },
);

Deno.test(
    'connectionPortOf is null on a locked flow',
    () => {
        const a = node('a', 0, 0);
        assertStrictEquals(
            connectionPortOf(
                a, [], new Map([['a', a]]), true,
            ),
            null,
        );
    },
);

Deno.test(
    'connectionPortOf is null for a Create node with an'
    + ' edge',
    () => {
        const create = {
            ...node('c', 0, 0), isCreate: true,
        };
        const a = node('a', 300, 0);
        assertStrictEquals(
            connectionPortOf(
                create,
                [edge('ca', 'c', 'a')],
                new Map([['c', create], ['a', a]]),
                false,
            ),
            null,
        );
    },
);

Deno.test(
    'connectionPortOf gives a Create node with no edge a'
    + ' port',
    () => {
        const create = {
            ...node('c', 0, 0), isCreate: true,
        };
        assertEquals(
            connectionPortOf(
                create, [], new Map([['c', create]]), false,
            ),
            { x: 160, y: 32 },
        );
    },
);

Deno.test(
    'connectionPortOf gives a regular node a port, with'
    + ' or without edges',
    () => {
        const a = node('a', 0, 0);
        const b = node('b', 300, 0);
        assertNotStrictEquals(
            connectionPortOf(
                a,
                [edge('ab', 'a', 'b')],
                new Map([['a', a], ['b', b]]),
                false,
            ),
            null,
        );
        assertEquals(
            connectionPortOf(
                a, [], new Map([['a', a]]), false,
            ),
            { x: 160, y: 32 },
        );
    },
);

Deno.test(
    'runsAutoLayout holds only with Auto Layout on and'
    + ' the flow unlocked',
    () => {
        assertStrictEquals(
            runsAutoLayout({
                isAutoLayout: true, isLocked: false,
            }),
            true,
        );
        assertStrictEquals(
            runsAutoLayout({
                isAutoLayout: true, isLocked: true,
            }),
            false,
        );
        assertStrictEquals(
            runsAutoLayout({
                isAutoLayout: false, isLocked: false,
            }),
            false,
        );
        assertStrictEquals(
            runsAutoLayout({
                isAutoLayout: false, isLocked: true,
            }),
            false,
        );
    },
);
