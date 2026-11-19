import {
    assert, assertEquals, assertMatch, assertNotMatch,
} from '@std/assert';
import { buildStatsGraphSvg }
    from '../web-app/app/flow-stats-graph.ts';
import type {
    FlowStatsModel, NodeStat,
} from '../web-app/app/flow-stats-aggregate.ts';
import type { FlowArrangement }
    from '../web-app/app/flow-arrangement.ts';
import type { GraphNode } from '../shared/types.ts';
import { FlowStatsPresenter }
    from '../web-app/app/presenters/flow-stats.ts';
import { DISPLAY_ABSENT } from
    '../web-app/app/format.ts';
import {
    NODE_LABEL_Y, NODE_LABEL_Y_CENTERED, NODE_META_Y,
    truncateEdgeLabel, truncateNodeName,
} from '../web-app/app/flow-graph.ts';

function model(): FlowStatsModel {
    const node =
        (over: Partial<NodeStat> & { id: string }): NodeStat => ({
            displayName: over.id.toUpperCase(),
            isCreate: false, isArchive: false,
            outgoingEdgeIds: [], heatPct: 0, heatT: 0,
            avgSeconds: null, medianSeconds: null, p90Seconds: null,
            visitsInWindow: 0, distinctWorkOrders: 0,
            currentlyHere: 0, throughputPerWeek: 0, revisitRatePct: 0,
            clanSize: 0, activeProducerCount: 0, topProducer: null,
            assignmentLabel: 'Unassigned',
            memberHazard: null, branchSplit: [],
            ...over,
        });
    return {
        nodes: [
            node({ id:'c', displayName:'Create',  isCreate:true }),
            node({ id:'a', displayName:'A',
                   heatT:0.32, heatPct:32,
                   avgSeconds: 510,
                   outgoingEdgeIds: ['e2'],
                   memberHazard: 'danger' }),
            node({ id:'z', displayName:'Archive', isArchive:true }),
        ],
        edges: [
            { id:'YiJPbufDpkyrZcZCYbUJpg', name:'',
              fromNodeId:'c', toNodeId:'a' },
            { id:'e2', name:'',
              fromNodeId:'a', toNodeId:'z' },
        ],
        pathEntries: [],
        completedWorkOrderCount: 0,
        incompleteWorkOrderCount: 0,
        windowDays: 90,
        droppedNodeIds: new Set(),
        pathsWithDroppedStepsCount: 0,
    };
}

// Where model()'s states sit: the positions the fixture
// carried before positions left the statistics.
function arrangement(): FlowArrangement {
    const at = (
        id: string, positionX: number,
        o: { isCreate?: boolean; isArchive?: boolean } = {},
    ): GraphNode => ({
        id, name: id, positionX, positionY: 0,
        isCreate: o.isCreate === true,
        isArchive: o.isArchive === true,
        memberIds: [], attributes: [], taskInstructions: '',
    });
    return {
        nodes: [
            at('c', 0, { isCreate: true }),
            at('a', 200),
            at('z', 400, { isArchive: true }),
        ],
        edgeWaypoints: new Map(),
    };
}

const VB = { x: 0, y: 0, w: 600, h: 200 };

// The flat SVG string makes a naive /data-node-id="x"[\s\S]*?…/
// leak into the *next* node's markup; slice out just this node's
// group (from its id attr to the next node-id attr) before asserting.
function nodeGroup(svg: string, id: string): string {
    const at = svg.indexOf(`data-node-id="${id}"`);
    assert(at >= 0, `node ${id} not found`);
    const rest = svg.slice(at);
    const next = rest.indexOf('data-node-id=', 1);
    return next === -1 ? rest : rest.slice(0, next);
}

Deno.test('emits an svg with role=img and no editor affordances', () => {
    const html = buildStatsGraphSvg(
        model(), arrangement(), VB, null,
    ).toString();
    assertMatch(html, /<svg[^>]*role="img"/);
    assertNotMatch(html, /role="button"/);
    assertNotMatch(html, /\btabindex\b/);
    assertNotMatch(html, /\bdata-connect-port\b/);
    assertNotMatch(html, /\baria-current\b/);
    assertNotMatch(html, /<animate\b/);
});

Deno.test('each node carries style="--heat-t:..." and no data-heat', () => {
    const html = buildStatsGraphSvg(
        model(), arrangement(), VB, null,
    ).toString();
    assertMatch(html,
        /data-node-id="a"[^>]*style="[^"]*--heat-t:\s*0\.32[^"]*"/);
    assertMatch(html,
        /data-node-id="c"[^>]*data-special="start"/);
    assertMatch(html,
        /data-node-id="z"[^>]*data-special="archive"/);
    assertNotMatch(html, /\bdata-heat\b/);
});

// Every <text> of one node's group, in order.
function texts(group: string): string[] {
    return group.match(/<text\b[^>]*>[^<]*<\/text>/g) ?? [];
}

Deno.test(
    'regular nodes show avg sojourn; special nodes show no'
    + ' second line',
    () => {
        const html = buildStatsGraphSvg(
            model(), arrangement(), VB, null,
        ).toString();
        const regular = texts(nodeGroup(html, 'a'));
        assertEquals(regular.length, 2);
        assertMatch(regular[0]!, new RegExp(
            'class="flow-stats-node-name"[^>]*'
            + ` y="${NODE_LABEL_Y}">A<`,
        ));
        assertMatch(regular[1]!, new RegExp(
            'class="flow-stats-node-face"[^>]*'
            + ` y="${NODE_META_Y}">8\\.5m<`,
        ));
        for (const [id, name] of [
            ['c', 'Create'], ['z', 'Archive'],
        ] as const) {
            const special = texts(nodeGroup(html, id));
            assertEquals(special.length, 1);
            assertMatch(special[0]!, new RegExp(
                'class="flow-stats-node-name"[^>]*'
                + ` y="${NODE_LABEL_Y_CENTERED}">${name}<`,
            ));
        }
        const m = model();
        const idle: FlowStatsModel = {
            ...m,
            nodes: m.nodes.map(n =>
                n.id === 'a' ? { ...n, avgSeconds: null } : n,
            ),
        };
        const idleHtml = buildStatsGraphSvg(
            idle, arrangement(), VB, null,
        ).toString();
        assertMatch(texts(nodeGroup(idleHtml, 'a'))[1]!, new RegExp(
            `class="flow-stats-node-face"[^>]*>${DISPLAY_ABSENT}<`,
        ));
    },
);

Deno.test('danger hazard glyph appears when memberHazard is danger',
    () => {
    const html = buildStatsGraphSvg(
        model(), arrangement(), VB, null,
    ).toString();
    assertMatch(nodeGroup(html, 'a'),
        /class="flow-stats-node-danger"/);
    assertNotMatch(nodeGroup(html, 'c'),
        /flow-stats-node-warning|flow-stats-node-danger/);
});

Deno.test('warning hazard glyph appears when memberHazard is warning',
    () => {
    const m = model();
    const warned: FlowStatsModel = {
        ...m,
        nodes: m.nodes.map(n =>
            n.id === 'a'
                ? { ...n, memberHazard: 'warning' }
                : n,
        ),
    };
    const html = buildStatsGraphSvg(
        warned, arrangement(), VB, null,
    ).toString();
    assertMatch(nodeGroup(html, 'a'),
        /class="flow-stats-node-warning"/);
});

Deno.test('edges carry data-edge-id and no interactive attributes', () => {
    const html = buildStatsGraphSvg(
        model(), arrangement(), VB, null,
    ).toString();
    assertMatch(html, /<g[^>]*data-edge-id="YiJPbufDpkyrZcZCYbUJpg"/);
    assertMatch(html, /<g[^>]*data-edge-id="e2"/);
});

Deno.test('highlight set marks on-path and dims off-path nodes/edges',
    () => {
    const highlight = {
        nodeIds: new Set(['c', 'a']),
        edgeIds: new Set(['YiJPbufDpkyrZcZCYbUJpg']),
    };
    const html =
        buildStatsGraphSvg(
            model(), arrangement(), VB, highlight,
        ).toString();
    assertMatch(html, /data-node-id="c"[^>]*data-on-path="true"/);
    assertMatch(html, /data-node-id="a"[^>]*data-on-path="true"/);
    assertMatch(html, /data-node-id="z"[^>]*data-dim="true"/);
    assertMatch(html
        , /data-edge-id="YiJPbufDpkyrZcZCYbUJpg"[^>]*data-on-path="true"/);
    assertMatch(html, /data-edge-id="e2"[^>]*data-dim="true"/);
});

Deno.test('no highlight ⇒ no data-dim or data-on-path anywhere', () => {
    const html = buildStatsGraphSvg(
        model(), arrangement(), VB, null,
    ).toString();
    assertNotMatch(html, /data-dim="true"/);
    assertNotMatch(html, /data-on-path="true"/);
});

Deno.test('a back-edge gets data-cycle; forward edges do not', () => {
    const m = model();
    const cyclic: FlowStatsModel = {
        ...m,
        edges: [
            ...m.edges,
            { id: 'e3', name: '',
              fromNodeId: 'z', toNodeId: 'a' },
        ],
    };
    const html =
        buildStatsGraphSvg(
            cyclic, arrangement(), VB, null,
        ).toString();
    assertMatch(html,
        /data-edge-id="e3"[^>]*data-cycle="true"/);
    assertNotMatch(html,
        /data-edge-id="YiJPbufDpkyrZcZCYbUJpg"[^>]*data-cycle="true"/);
    assertNotMatch(html,
        /data-edge-id="e2"[^>]*data-cycle="true"/);
});

// One edge's group, from its id to its close.
function edgeGroup(svg: string, id: string): string {
    const at = svg.indexOf(`data-edge-id="${id}"`);
    assert(at >= 0, `edge ${id} not found`);
    const rest = svg.slice(at);
    return rest.slice(0, rest.indexOf('</g>'));
}

function withNames(
    m: FlowStatsModel,
    nodeName: string,
    edgeName: string,
): FlowStatsModel {
    return {
        ...m,
        nodes: m.nodes.map(n =>
            n.id === 'a' ? { ...n, displayName: nodeName } : n,
        ),
        edges: m.edges.map(e => ({ ...e, name: edgeName })),
    };
}

Deno.test(
    "a transition's name is drawn on its edge, not on an edge"
    + ' out of Create',
    () => {
        const html = buildStatsGraphSvg(
            withNames(model(), 'A', 'Ship it'),
            arrangement(), VB, null,
        ).toString();
        const out = edgeGroup(html, 'e2');
        assertMatch(out, new RegExp(
            '<rect class="flow-stats-edge-label-bg"'
            + ' x="[-0-9.]+" y="[-0-9.]+" width="[0-9.]+"'
            + ' height="20" rx="4"/>',
        ));
        assertMatch(out,
            /<text class="flow-stats-edge-label"[^>]*>Ship it<\/text>/);
        const fromCreate =
            edgeGroup(html, 'YiJPbufDpkyrZcZCYbUJpg');
        assertMatch(fromCreate, /class="flow-stats-edge-path"/);
        assertNotMatch(fromCreate, /flow-stats-edge-label/);
        assertNotMatch(fromCreate, /Ship it/);
    },
);

Deno.test("long names truncate as the designer's", () => {
    const stateName = 'Quality assurance review';
    const transitionName = 'Send back for another look';
    assertEquals(truncateNodeName(stateName), 'Quality assurance…');
    assertEquals(
        truncateEdgeLabel(transitionName), 'Send back for ano…',
    );
    const html = buildStatsGraphSvg(
        withNames(model(), stateName, transitionName),
        arrangement(), VB, null,
    ).toString();
    assertMatch(texts(nodeGroup(html, 'a'))[0]!,
        />Quality assurance…</);
    const label = edgeGroup(html, 'e2');
    assertMatch(label, />Send back for ano…</);
    assertMatch(label, /flow-stats-edge-label-bg"[^>]* width="138"/);
    assertNotMatch(html, new RegExp(stateName));
    assertNotMatch(html, new RegExp(transitionName));
});

const PAINT_ATTRIBUTE = new RegExp(
    '\\s(fill|stroke|stroke-width|stroke-dasharray'
    + '|stroke-linecap|stroke-linejoin|opacity|font-size'
    + '|font-weight|text-anchor|filter|marker-end)=',
);

Deno.test('the renderer emits no paint', () => {
    const m = withNames(model(), 'A', 'Ship it');
    const highlight = {
        nodeIds: new Set(['c', 'a']),
        edgeIds: new Set(['YiJPbufDpkyrZcZCYbUJpg']),
    };
    const warned: FlowStatsModel = {
        ...m,
        nodes: m.nodes.map(n =>
            n.id === 'a' ? { ...n, memberHazard: 'warning' } : n,
        ),
    };
    const cyclic: FlowStatsModel = {
        ...m,
        edges: [
            ...m.edges,
            { id: 'e3', name: 'again',
              fromNodeId: 'z', toNodeId: 'a' },
        ],
    };
    for (const [svgModel, hazard] of [
        [m, 'danger'], [warned, 'warning'], [cyclic, 'danger'],
    ] as const) {
        const html = buildStatsGraphSvg(
            svgModel, arrangement(), VB, highlight,
        ).toString();
        assertMatch(html,
            new RegExp(`class="flow-stats-node-${hazard}"`));
        assertNotMatch(html, PAINT_ATTRIBUTE);
        const styles = html.match(/\sstyle="[^"]*"/g) ?? [];
        assertEquals(styles.length, svgModel.nodes.length);
        for (const style of styles) {
            assertMatch(style, /^\sstyle="--heat-t: [0-9.]+"$/);
        }
    }
});

Deno.test('a hazard glyph keeps its place and size', () => {
    const html = buildStatsGraphSvg(
        model(), arrangement(), VB, null,
    ).toString();
    assertMatch(nodeGroup(html, 'a'), new RegExp(
        '<g class="flow-stats-node-danger"'
        + ' transform="translate\\(6, 42\\)">'
        + '<title>[^<]+</title>'
        + '<svg [^>]*width="16" height="16"'
        + ' viewBox="0 0 24 24" aria-hidden="true">',
    ));
});

Deno.test('content sits in one group', () => {
    const html = buildStatsGraphSvg(
        model(), arrangement(), VB, null,
    ).toString();
    const grid = html.indexOf('class="flow-stats-grid-dots"');
    assert(grid >= 0, 'grid dots not found');
    const after = html.slice(html.indexOf('/>', grid) + 2);
    const open = '<g class="flow-stats-content">';
    const close = '</g></svg>';
    assert(after.startsWith(open), after.slice(0, 80));
    assert(after.endsWith(close));
    let depth = 0;
    let groupEnd = -1;
    for (const tag of after.matchAll(/<g\b|<\/g>/g)) {
        depth += tag[0] === '</g>' ? -1 : 1;
        if (depth === 0) {
            groupEnd = tag.index;
            break;
        }
    }
    assertEquals(groupEnd, after.length - close.length);
    const content = after.slice(0, groupEnd);
    for (const id of ['c', 'a', 'z']) {
        assertMatch(content, new RegExp(`data-node-id="${id}"`));
    }
    for (const id of ['YiJPbufDpkyrZcZCYbUJpg', 'e2']) {
        assertMatch(content, new RegExp(`data-edge-id="${id}"`));
    }
});

// ---- FlowStatsPresenter tests ----

function modelWithPaths(): FlowStatsModel {
    return {
        ...model(),
        completedWorkOrderCount: 12,
        incompleteWorkOrderCount: 3,
        pathEntries: [
            {
                kind: 'path',
                path: {
                    nodeIds: ['c', 'a', 'z'],
                    edgeIds: ['YiJPbufDpkyrZcZCYbUJpg', 'e2'],
                    workOrderCount: 9,
                    sharePct: 75,
                },
            },
            {
                kind: 'path',
                path: {
                    nodeIds: ['c', 'a'],
                    edgeIds: ['YiJPbufDpkyrZcZCYbUJpg'],
                    workOrderCount: 2,
                    sharePct: 17,
                },
            },
            {
                kind: 'rest',
                pathCount: 1,
                count: 1,
                combinedSharePct: 8,
            },
        ],
    };
}

Deno.test('buildShell contains required structural elements', () => {
    const p = new FlowStatsPresenter(
        modelWithPaths(),
        arrangement(),
        { x: 0, y: 0, w: 600, h: 200 },
    );
    const s = p.buildShell().toString();
    assertMatch(s, /id="flow-stats-back"/);
    assertMatch(s,
        /class="flow-stats-canvas-host"/);
    assertMatch(s,
        /id="flow-stats-card"[^>]*class="[^"]*hidden/);
    assertMatch(s, /Trailing 90 days/);
    // no dropped nodes in this fixture
    assertNotMatch(s,
        /omitted from this view/i);
});

Deno.test('buildShell includes footnote when droppedNodeIds non-empty',
    () => {
    const m: FlowStatsModel = {
        ...modelWithPaths(),
        droppedNodeIds: new Set(['x']),
        pathsWithDroppedStepsCount: 2,
    };
    const p = new FlowStatsPresenter(
        m, arrangement(), { x: 0, y: 0, w: 600, h: 200 },
    );
    assertMatch(
        p.buildShell().toString(),
        /omitted from this view/i,
    );
});

Deno.test('buildStepperBar idx 0: path label, 75%, prev disabled',
    () => {
    const p = new FlowStatsPresenter(
        modelWithPaths(),
        arrangement(),
        { x: 0, y: 0, w: 600, h: 200 },
    );
    const s = p.buildStepperBar(
        { selectedPathIndex: 0 },
    ).toString();
    assertMatch(s, /Path\s+1\s+of\s+3/);
    assertMatch(s,
        /75%\s+of\s+12\s+work\s+orders/);
    assertMatch(s,
        /data-stepper="prev"[^>]*disabled/);
    // next must NOT be disabled at idx 0
    assertNotMatch(s,
        /data-stepper="next"[^>]*disabled/);
    // in-flight count appended
    assertMatch(s, /3\s+in\s+flight/);
});

Deno.test('buildStepperBar idx 1: prev not disabled', () => {
    const p = new FlowStatsPresenter(
        modelWithPaths(),
        arrangement(),
        { x: 0, y: 0, w: 600, h: 200 },
    );
    const s = p.buildStepperBar(
        { selectedPathIndex: 1 },
    ).toString();
    assertNotMatch(s,
        /data-stepper="prev"[^>]*disabled/);
});

Deno.test('buildStepperBar idx 2: rest entry, next disabled', () => {
    const p = new FlowStatsPresenter(
        modelWithPaths(),
        arrangement(),
        { x: 0, y: 0, w: 600, h: 200 },
    );
    const s = p.buildStepperBar(
        { selectedPathIndex: 2 },
    ).toString();
    assertMatch(s, /\+\s*1\s+rarer paths/);
    assertMatch(s, /8%/);
    assertMatch(s,
        /data-stepper="next"[^>]*disabled/);
});

Deno.test('buildStepperBar names the control with an eyebrow',
    () => {
    const p = new FlowStatsPresenter(
        modelWithPaths(),
        arrangement(),
        { x: 0, y: 0, w: 600, h: 200 },
    );
    const s = p.buildStepperBar(
        { selectedPathIndex: 0 },
    ).toString();
    assertMatch(s, /flow-stats-stepper-eyebrow/);
    assertMatch(s, /Most-traveled paths/);
});

Deno.test('buildLegend: structure, end labels, no linear-gradient',
    () => {
    const p = new FlowStatsPresenter(
        modelWithPaths(),
        arrangement(),
        { x: 0, y: 0, w: 600, h: 200 },
    );
    const s = p.buildLegend().toString();
    assertMatch(s, /class="flow-stats-legend"/);
    assertMatch(s, />\s*0%\s*</);
    assertMatch(s, />\s*100%\s*</);
    assertNotMatch(s,
        /linear-gradient\(/i);
});

// ---- buildCard / renderCard tests ----

function nodeStat(
    over: Partial<NodeStat> & { id: string },
): NodeStat {
    return {
        id: over.id,
        displayName:
            over.displayName ?? over.id.toUpperCase(),
        isCreate: over.isCreate ?? false,
        isArchive: over.isArchive ?? false,
        outgoingEdgeIds:
            over.outgoingEdgeIds ?? [],
        heatPct: over.heatPct ?? 0,
        heatT: over.heatT ?? 0,
        avgSeconds: over.avgSeconds ?? null,
        medianSeconds: over.medianSeconds ?? null,
        p90Seconds: over.p90Seconds ?? null,
        visitsInWindow: over.visitsInWindow ?? 0,
        distinctWorkOrders:
            over.distinctWorkOrders ?? 0,
        currentlyHere: over.currentlyHere ?? 0,
        throughputPerWeek:
            over.throughputPerWeek ?? 0,
        revisitRatePct: over.revisitRatePct ?? 0,
        clanSize: over.clanSize ?? 0,
        activeProducerCount:
            over.activeProducerCount ?? 0,
        topProducer: over.topProducer ?? null,
        assignmentLabel:
            over.assignmentLabel ?? 'Unassigned',
        memberHazard: over.memberHazard ?? null,
        branchSplit: over.branchSplit ?? [],
    };
}

Deno.test('rich card renders all stat blocks for a regular node',
    () => {
    const p = new FlowStatsPresenter(
        modelWithPaths(),
        arrangement(),
        { x: 0, y: 0, w: 600, h: 200 },
    );
    const s = nodeStat({
        id: 'a', displayName: 'Review',
        heatPct: 58, heatT: 0.58,
        avgSeconds: 414720,
        medianSeconds: 259200,
        p90Seconds: 777600,
        visitsInWindow: 138,
        distinctWorkOrders: 124,
        currentlyHere: 12,
        throughputPerWeek: 11,
        revisitRatePct: 18,
        clanSize: 5,
        activeProducerCount: 3,
        topProducer: {
            name: 'Lee', vsClanAvgPct: 140,
            sharePct: 31, inCurrentClan: true,
        },
        assignmentLabel: 'Sarah Chen, Mike OBrien',
        branchSplit: [
            {
                edgeId: 'e3', label: 'approve',
                toNodeId: 'z', pct: 81,
            },
            {
                edgeId: 'e4', label: 'revise',
                toNodeId: 'a', pct: 19,
            },
        ],
    });
    const html = p.buildCard(s).toString();
    assertMatch(html, />\s*58%\s*</);
    assertMatch(html, /4\.8d/);
    assertMatch(html, /3d/);
    // 777600s = 1.3 weeks (formatMinAscending
    // prefers weeks over days above 7d)
    assertMatch(html, /1\.3w/);
    assertMatch(html, />\s*138\s*</);
    assertMatch(html, />\s*124\s*</);
    assertMatch(html, />\s*12\s*</);
    assertMatch(html, />\s*~11\/wk\s*</);
    assertMatch(html, />\s*18%\s*</);
    assertMatch(html, />\s*5\s*</);
    assertMatch(html, />\s*3\s*</);
    assertMatch(html, /Lee/);
    assertMatch(html, /140%/);
    assertMatch(html, /31%/);
    assertNotMatch(html, /not in current clan/);
    assertMatch(html, /Sarah Chen, Mike OBrien/);
    assertMatch(html, /approve\s+81%/);
    assertMatch(html, /revise\s+19%/);
});

Deno.test('sub-1/wk throughput reads <1/wk', () => {
    const p = new FlowStatsPresenter(
        modelWithPaths(),
        arrangement(),
        { x: 0, y: 0, w: 600, h: 200 },
    );
    const html = p.buildCard(nodeStat({
        id: 'a', displayName: 'Review',
        throughputPerWeek: 0.5,
    })).toString();
    assertMatch(html, />\s*<1\/wk\s*</);
});

Deno.test('top producer not in clan is flagged', () => {
    const p = new FlowStatsPresenter(
        modelWithPaths(),
        arrangement(),
        { x: 0, y: 0, w: 600, h: 200 },
    );
    const s = nodeStat({
        id: 'a',
        topProducer: {
            name: 'Zed', vsClanAvgPct: 400,
            sharePct: 100, inCurrentClan: false,
        },
    });
    const html = p.buildCard(s).toString();
    assertMatch(html, /Zed/);
    assertMatch(html, /not in current clan/);
});

Deno.test('special-node card is lean (no clan/producer/branch)',
    () => {
    const p = new FlowStatsPresenter(
        modelWithPaths(),
        arrangement(),
        { x: 0, y: 0, w: 600, h: 200 },
    );
    const s = nodeStat({
        id: 'c', isCreate: true,
        displayName: 'Create',
    });
    const html = p.buildCard(s).toString();
    assertNotMatch(html, /Top producer/);
    assertNotMatch(html, /Clan size/);
    // null durations render via DISPLAY_ABSENT
    assertMatch(html, new RegExp(DISPLAY_ABSENT));
});

Deno.test('renderCard hides the slot when nodeId is null', () => {
    const p = new FlowStatsPresenter(
        modelWithPaths(),
        arrangement(),
        { x: 0, y: 0, w: 600, h: 200 },
    );
    const classes = new Set<string>();
    const cardEl = {
        classList: classes,
    } as unknown as HTMLElement;
    const container = {
        querySelector: (sel: string) =>
            sel === '#flow-stats-card'
                ? cardEl : null,
    } as unknown as HTMLElement;
    p.renderCard(container, null);
    assert(classes.has('hidden'));
});
