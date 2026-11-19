import { assert, assertEquals } from '@std/assert';
import { arrangeFlow } from '../web-app/app/flow-arrangement.ts';
import { buildStatsGraphSvg }
    from '../web-app/app/flow-stats-graph.ts';
import { buildFlowStats }
    from '../web-app/app/flow-stats-aggregate.ts';
import { buildGraphSvg } from '../web-app/app/flow-graph.ts';
import { withRenderableLayout }
    from '../web-app/app/flow-graph-layout.ts';
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

// --- builders: tests/flow-arrangement.test.ts's -------------

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

// The id avoids '>', which the markup would escape.
function edge(
    from: string, to: string, name = 'go',
): GraphEdge {
    return {
        id: `${from}-${to}`,
        name,
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

// On a landscape canvas the Create->Archive shortcut bends
// through a waypoint.
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

function storedFlow(): FlowGraph {
    return flowGraph({
        isAutoLayout: false,
        nodes: [
            node('s', {
                isCreate: true, positionX: 40, positionY: 300,
            }),
            node('a', { positionX: 420, positionY: 90 }),
            node('b', { positionX: 777, positionY: 512 }),
            node('z', {
                isArchive: true,
                positionX: 1200, positionY: 260,
            }),
        ],
        edges: [
            edge('s', 'a'), edge('a', 'b'),
            edge('b', 'z'), edge('s', 'z'),
        ],
    });
}

function startlessFlow(): FlowGraph {
    return flowGraph({
        isAutoLayout: true,
        nodes: [
            node('a', { positionX: 0, positionY: 0 }),
            node('b', { positionX: 0, positionY: 0 }),
            node('z', { isArchive: true }),
        ],
        edges: [edge('a', 'b'), edge('b', 'z')],
    });
}

// A two-way pair bows apart, and long names cap their label
// width; no fixture above has either.
function twoWayFlow(): FlowGraph {
    return flowGraph({
        isAutoLayout: true,
        nodes: [
            node('s', { isCreate: true }),
            node('a'),
            node('b'),
            node('z', { isArchive: true }),
        ],
        edges: [
            edge('s', 'a'),
            edge('a', 'b', 'Send back for another review'),
            edge('b', 'a', 'Approve and hand to the next'),
            edge('b', 'z', 'Ok'),
        ],
    });
}

const FIXTURES: readonly (readonly [string, FlowGraph])[] = [
    ['eight-state chain',
        eightStateChain({ isAutoLayout: true })],
    ['locked chain', eightStateChain({
        isAutoLayout: true, isLocked: true,
    })],
    ['degenerate non-auto chain',
        eightStateChain({ isAutoLayout: false })],
    ['shortcut', shortcutFlow()],
    ['stored positions', storedFlow()],
    ['startless', startlessFlow()],
    ['empty', flowGraph({
        isAutoLayout: true, nodes: [], edges: [],
    })],
    ['two-way pair', twoWayFlow()],
];

const CANVAS_W = 1100;
const CANVAS_H = 640;

// --- both renderers over one arrangement --------------------

interface Drawn {
    readonly svg: string;
    // Each edge's group, keyed by edge id.
    readonly edges: ReadonlyMap<string, string>;
}

function groupsBy(
    svg: string, attribute: string,
): Map<string, string> {
    const groups = new Map<string, string>();
    const at = new RegExp(
        `<g[^>]*\\s${attribute}="([^"]+)"`, 'g',
    );
    for (const match of svg.matchAll(at)) {
        const rest = svg.slice(match.index);
        groups.set(
            match[1]!, rest.slice(0, rest.indexOf('</g>')),
        );
    }
    return groups;
}

function drawBoth(graph: FlowGraph): {
    readonly stats: Drawn; readonly designer: Drawn;
} {
    const arrangement = arrangeFlow(
        graph, { kind: 'measured', w: CANVAS_W, h: CANVAS_H },
    );
    const viewBox = { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H };
    const model = buildFlowStats({
        nodes: graph.nodes,
        edges: graph.edges,
        transitions: [],
        nowMs: 0,
        windowDays: 90,
        memberNameById: new Map(),
    });
    const stats = buildStatsGraphSvg(
        model, arrangement, viewBox, null,
    ).toString();
    const designer = buildGraphSvg(
        [...arrangement.nodes], graph.edges,
        viewBox.x, viewBox.y, viewBox.w, viewBox.h,
        { kind: 'none' }, graph.isLocked, false, null,
        arrangement.edgeWaypoints, '',
    ).toString();
    return {
        stats: {
            svg: stats, edges: groupsBy(stats, 'data-edge-id'),
        },
        designer: {
            svg: designer,
            edges: groupsBy(designer, 'data-edge-ref'),
        },
    };
}

function only(group: string, pattern: RegExp): string {
    const match = group.match(pattern);
    assert(match !== null, `${pattern} not in ${group}`);
    return match[1]!;
}

function pathOf(group: string): string {
    return only(group, /<path[^>]*\sd="([^"]+)"/);
}

// The label box and text as the designer places them, or
// null for an edge that carries none.
function labelOf(group: string): string[] | null {
    const rect = group.match(
        /<rect[^>]*\sx="([^"]+)" y="([^"]+)"\s*width="([^"]+)"/,
    );
    if (rect === null) return null;
    const height = only(group, /<rect[^>]*\sheight="([^"]+)"/);
    const text = group.match(
        /<text[^>]*\sx="([^"]+)"\s*y="([^"]+)"[^>]*>([^<]*)</,
    );
    assert(text !== null, `label text not in ${group}`);
    return [
        rect[1]!, rect[2]!, rect[3]!, height,
        text[1]!, text[2]!, text[3]!,
    ];
}

function transforms(svg: string): Map<string, string> {
    const byId = new Map<string, string>();
    const at = new RegExp(
        '<g[^>]*\\sdata-node-id="([^"]+)"'
        + '[^>]*\\stransform="([^"]+)"',
        'g',
    );
    for (const match of svg.matchAll(at)) {
        byId.set(match[1]!, match[2]!);
    }
    return byId;
}

// --- tests --------------------------------------------------

Deno.test('every edge path matches the designer', () => {
    for (const [name, graph] of FIXTURES) {
        const { stats, designer } = drawBoth(graph);
        assertEquals(
            [...stats.edges.keys()].sort(),
            [...designer.edges.keys()].sort(),
            name,
        );
        assertEquals(stats.edges.size, graph.edges.length, name);
        for (const [id, group] of stats.edges) {
            assertEquals(
                pathOf(group), pathOf(designer.edges.get(id)!),
                `${name}: ${id}`,
            );
        }
    }
});

Deno.test('every node transform matches the designer', () => {
    for (const [name, graph] of FIXTURES) {
        const { stats, designer } = drawBoth(graph);
        const statsAt = transforms(stats.svg);
        assertEquals(statsAt.size, graph.nodes.length, name);
        assertEquals(statsAt, transforms(designer.svg), name);
    }
});

Deno.test('every transition label matches the designer', () => {
    let labelled = 0;
    for (const [name, graph] of FIXTURES) {
        const { stats, designer } = drawBoth(graph);
        for (const [id, group] of stats.edges) {
            const label = labelOf(group);
            assertEquals(
                label, labelOf(designer.edges.get(id)!),
                `${name}: ${id}`,
            );
            if (label !== null) labelled += 1;
        }
    }
    assert(labelled > 0, 'no label was compared');
});

Deno.test('an edge with waypoints is drawn through them', () => {
    const { stats } = drawBoth(shortcutFlow());
    const shortcut = stats.edges.get('s-z');
    assert(shortcut !== undefined);
    assert(pathOf(shortcut).includes(' Q '), pathOf(shortcut));
});
