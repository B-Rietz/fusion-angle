import {
    assert,
    assertAlmostEquals,
    assertEquals,
    assertMatch,
    assertNotStrictEquals,
    assertStrictEquals,
} from '@std/assert';
import {
    BOW_FRAC,
    BOW_MAX,
    LABEL_GAP,
    LABEL_HEIGHT,
    LABEL_MIN_WIDTH,
    LANE_OFFSET,
    buildGraphSvg,
    computeEdgeGeometry,
    computeEdgeLanes,
    computeEdgeLabelWidth,
    connectionPortOf,
    pointAlongPolyline,
    truncateEdgeLabel,
    truncateNodeName,
} from '../web-app/app/flow-graph.ts';
import type {
    EdgeGeometry,
} from '../web-app/app/flow-graph.ts';
import {
    NODE_HEIGHT,
    NODE_WIDTH,
} from '../web-app/app/flow-layout.ts';
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
        const lanes =
            computeEdgeLanes(edges);
        const geo = computeEdgeGeometry(
            nodes[0]!, nodes[1]!,
            lanes.get('YiJPbufDpkyrZcZCYbUJpg')!,
            false, computeEdgeLabelWidth('go'), [],
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
    'a two-way pair gives each edge its own lane'
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
        const lanes =
            computeEdgeLanes(edges);
        assertStrictEquals(lanes.get('YiJPbufDpkyrZcZCYbUJpg'), 1);
        assertStrictEquals(lanes.get('e2'), 1);
        const g1 = computeEdgeGeometry(
            nodes[0]!, nodes[1]!, 1,
            false, computeEdgeLabelWidth('go'), [],
        );
        const g2 = computeEdgeGeometry(
            nodes[1]!, nodes[0]!, 1,
            true, computeEdgeLabelWidth('go'), [],
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
    'a lone edge between distinct pairs keeps'
    + ' the centre line',
    () => {
        const edges = [
            edge('YiJPbufDpkyrZcZCYbUJpg', 'a', 'b'),
            edge('e2', 'b', 'c'),
        ];
        const lanes =
            computeEdgeLanes(edges);
        assertStrictEquals(lanes.get('YiJPbufDpkyrZcZCYbUJpg'), 0);
        assertStrictEquals(lanes.get('e2'), 0);
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
            nodes[0]!, nodes[1]!, 0,
            false, computeEdgeLabelWidth('go'), wps,
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
    'a one-way edge\'s path and label centre are'
    + ' unchanged',
    () => {
        const direct = computeEdgeGeometry(
            node('a', 0, 0), node('b', 300, 120), 0,
            false, computeEdgeLabelWidth('go'), [],
        );
        assertStrictEquals(
            direct.pathD,
            'M 160 64 C 197.69615364994155 64,'
            + ' 262.30384635005845 120, 300 120',
        );
        assertStrictEquals(direct.labelX, 230);
        assertStrictEquals(direct.labelY, 92);
        const routed = computeEdgeGeometry(
            node('a', 0, 0), node('b', 400, 200), 0,
            false, computeEdgeLabelWidth('go'),
            [{ x: 200, y: 0 }],
        );
        assertStrictEquals(
            routed.pathD,
            'M 144 64 Q 144 64 172 32 T 308 100 T 416 200',
        );
        assertStrictEquals(
            routed.labelX, 276.8000681741456,
        );
        assertStrictEquals(
            routed.labelY, 71.11117423532002,
        );
    },
);

interface Point {
    readonly x: number;
    readonly y: number;
}

interface Arc {
    readonly start: Point;
    readonly control: Point;
    readonly end: Point;
}

interface DrawnPair {
    readonly a: GraphNode;
    readonly b: GraphNode;
    readonly forward: EdgeGeometry;
    readonly returning: EdgeGeometry;
}

const LENGTH_TOLERANCE = 1e-9;
const PAIR_DISTANCE = 300;
const WIDE_LABEL_WIDTH =
    computeEdgeLabelWidth('W'.repeat(18));
const LABEL_WIDTHS = [LABEL_MIN_WIDTH, WIDE_LABEL_WIDTH];

// The eight angles of the lens tests, each with the
// centre line's normal that points up and to the left,
// written out rather than derived, so the tests do not
// repeat the rule they check.
const EIGHT_ANGLES: readonly {
    readonly degrees: number;
    readonly u: Point;
}[] = [
    { degrees: 0, u: { x: 0, y: -1 } },
    { degrees: 45, u: { x: Math.SQRT1_2, y: -Math.SQRT1_2 } },
    { degrees: 90, u: { x: -1, y: 0 } },
    { degrees: 135, u: { x: -Math.SQRT1_2, y: -Math.SQRT1_2 } },
    { degrees: 180, u: { x: 0, y: -1 } },
    { degrees: 225, u: { x: Math.SQRT1_2, y: -Math.SQRT1_2 } },
    { degrees: 270, u: { x: -1, y: 0 } },
    { degrees: 315, u: { x: -Math.SQRT1_2, y: -Math.SQRT1_2 } },
];

function centreOf(n: GraphNode): Point {
    return {
        x: n.positionX + NODE_WIDTH / 2,
        y: n.positionY + NODE_HEIGHT / 2,
    };
}

function midpointOf(p: Point, q: Point): Point {
    return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
}

function offsetAlong(p: Point, from: Point, axis: Point): number {
    return (p.x - from.x) * axis.x + (p.y - from.y) * axis.y;
}

function labelOf(geo: EdgeGeometry): Point {
    return { x: geo.labelX, y: geo.labelY };
}

// Whole-unit offsets keep a pair on the exact diagonal at
// 45 and 225 degrees, where the side rule breaks its tie.
function drawPairApart(
    dx: number,
    dy: number,
    forwardWidth: number,
    returnWidth: number,
): DrawnPair {
    const a = node('a', 0, 0);
    const b = node('b', dx, dy);
    return {
        a,
        b,
        forward: computeEdgeGeometry(
            a, b, 1, false, forwardWidth, [],
        ),
        returning: computeEdgeGeometry(
            b, a, 1, true, returnWidth, [],
        ),
    };
}

function drawPairAt(
    degrees: number,
    distance: number,
    forwardWidth: number,
    returnWidth: number,
): DrawnPair {
    const radians = degrees * Math.PI / 180;
    return drawPairApart(
        Math.round(distance * Math.cos(radians)),
        Math.round(distance * Math.sin(radians)),
        forwardWidth,
        returnWidth,
    );
}

function pairMidpoint(pair: DrawnPair): Point {
    return midpointOf(centreOf(pair.a), centreOf(pair.b));
}

function arcOf(geo: EdgeGeometry): Arc {
    const number = '(-?[0-9.e+-]+)';
    const match = new RegExp(
        `^M ${number} ${number} Q ${number} ${number}`
        + ` ${number} ${number}$`,
    ).exec(geo.pathD);
    assert(match !== null, geo.pathD);
    const at = (i: number): number => Number(match[i]);
    return {
        start: { x: at(1), y: at(2) },
        control: { x: at(3), y: at(4) },
        end: { x: at(5), y: at(6) },
    };
}

function pointOnArc(arc: Arc, t: number): Point {
    const s = 1 - t;
    return {
        x: s * s * arc.start.x + 2 * s * t * arc.control.x
            + t * t * arc.end.x,
        y: s * s * arc.start.y + 2 * s * t * arc.control.y
            + t * t * arc.end.y,
    };
}

function assertPointsClose(
    actual: Point,
    expected: Point,
): void {
    assertAlmostEquals(actual.x, expected.x, LENGTH_TOLERANCE);
    assertAlmostEquals(actual.y, expected.y, LENGTH_TOLERANCE);
}

Deno.test(
    'a lane stays inside half a state\'s height',
    () => {
        assert(LANE_OFFSET < NODE_HEIGHT / 2);
    },
);

function isInsideState(p: Point, state: GraphNode): boolean {
    const c = centreOf(state);
    return Math.abs(p.x - c.x) < NODE_WIDTH / 2
        && Math.abs(p.y - c.y) < NODE_HEIGHT / 2;
}

Deno.test(
    'a pair\'s attachments sit LANE_OFFSET either side of'
    + ' the centre line',
    () => {
        for (const { degrees, u } of EIGHT_ANGLES) {
            const pair = drawPairAt(
                degrees, PAIR_DISTANCE,
                LABEL_MIN_WIDTH, LABEL_MIN_WIDTH,
            );
            const origin = centreOf(pair.a);
            const forward = arcOf(pair.forward);
            const returning = arcOf(pair.returning);
            for (const p of [forward.start, forward.end]) {
                assertAlmostEquals(
                    offsetAlong(p, origin, u),
                    LANE_OFFSET,
                    LENGTH_TOLERANCE,
                );
            }
            for (const p of [returning.start, returning.end]) {
                assertAlmostEquals(
                    offsetAlong(p, origin, u),
                    -LANE_OFFSET,
                    LENGTH_TOLERANCE,
                );
            }
        }
    },
);

Deno.test(
    'a label box sits LABEL_GAP beyond its arc\'s apex'
    + ' tangent',
    () => {
        for (const { degrees } of EIGHT_ANGLES) {
            for (const width of LABEL_WIDTHS) {
                const pair = drawPairAt(
                    degrees, PAIR_DISTANCE, width, width,
                );
                for (
                    const geo of [pair.forward, pair.returning]
                ) {
                    const arc = arcOf(geo);
                    const apex = pointOnArc(arc, 0.5);
                    const chord = Math.hypot(
                        arc.end.x - arc.start.x,
                        arc.end.y - arc.start.y,
                    );
                    const across = {
                        x: -(arc.end.y - arc.start.y) / chord,
                        y: (arc.end.x - arc.start.x) / chord,
                    };
                    const outward = offsetAlong(
                        apex,
                        midpointOf(arc.start, arc.end),
                        across,
                    ) > 0
                        ? across
                        : { x: -across.x, y: -across.y };
                    const corners = [-1, 1].flatMap(sx =>
                        [-1, 1].map(sy => ({
                            x: geo.labelX + sx * width / 2,
                            y: geo.labelY + sy * LABEL_HEIGHT / 2,
                        })));
                    const nearest = Math.min(...corners.map(
                        corner =>
                            offsetAlong(corner, apex, outward),
                    ));
                    assertAlmostEquals(
                        nearest, LABEL_GAP, LENGTH_TOLERANCE,
                    );
                }
            }
        }
    },
);

Deno.test(
    'a pair\'s labels face each other across the centre'
    + ' line and never overlap',
    () => {
        for (const { degrees, u } of EIGHT_ANGLES) {
            for (const forwardWidth of LABEL_WIDTHS) {
                for (const returnWidth of LABEL_WIDTHS) {
                    const pair = drawPairAt(
                        degrees, PAIR_DISTANCE,
                        forwardWidth, returnWidth,
                    );
                    const middle = pairMidpoint(pair);
                    const forward = labelOf(pair.forward);
                    const returning = labelOf(pair.returning);
                    assert(offsetAlong(forward, middle, u) > 0);
                    assert(offsetAlong(returning, middle, u) < 0);
                    const overlapsAcross =
                        Math.abs(forward.x - returning.x)
                        < (forwardWidth + returnWidth) / 2;
                    const overlapsDown =
                        Math.abs(forward.y - returning.y)
                        < LABEL_HEIGHT;
                    assert(
                        !(overlapsAcross && overlapsDown),
                        `labels overlap at ${degrees} degrees`,
                    );
                }
            }
        }
    },
);

Deno.test(
    'the forward label sits above a horizontal pair and'
    + ' left of a vertical one',
    () => {
        for (const degrees of [0, 180]) {
            const pair = drawPairAt(
                degrees, PAIR_DISTANCE,
                LABEL_MIN_WIDTH, LABEL_MIN_WIDTH,
            );
            assert(pair.forward.labelY < pairMidpoint(pair).y);
        }
        for (const degrees of [90, 270]) {
            const pair = drawPairAt(
                degrees, PAIR_DISTANCE,
                LABEL_MIN_WIDTH, LABEL_MIN_WIDTH,
            );
            assert(pair.forward.labelX < pairMidpoint(pair).x);
        }
    },
);

Deno.test(
    'the pair swaps sides across the down-right diagonal'
    + ' and across no other',
    () => {
        // The side against a normal that turns smoothly with
        // the pair, so only the rule's own flip shows.
        const forwardSide = (degrees: number): number => {
            const radians = degrees * Math.PI / 180;
            const pair = drawPairAt(
                degrees, PAIR_DISTANCE,
                LABEL_MIN_WIDTH, LABEL_MIN_WIDTH,
            );
            return Math.sign(offsetAlong(
                labelOf(pair.forward),
                pairMidpoint(pair),
                { x: Math.sin(radians), y: -Math.cos(radians) },
            ));
        };
        assertNotStrictEquals(forwardSide(44), forwardSide(46));
        assertNotStrictEquals(
            forwardSide(224), forwardSide(226),
        );
        assertStrictEquals(forwardSide(134), forwardSide(136));
        assertStrictEquals(forwardSide(314), forwardSide(316));
    },
);

Deno.test(
    'a pair exactly on the down-right diagonal puts its'
    + ' forward label up and to the right',
    () => {
        for (const apart of [200, -200]) {
            const pair = drawPairApart(
                apart, apart, LABEL_MIN_WIDTH, LABEL_MIN_WIDTH,
            );
            const middle = pairMidpoint(pair);
            assert(pair.forward.labelX > middle.x);
            assert(pair.forward.labelY < middle.y);
            assert(pair.returning.labelX < middle.x);
            assert(pair.returning.labelY > middle.y);
        }
    },
);

Deno.test(
    'with equal label widths each edge is the other'
    + ' turned half a turn',
    () => {
        for (const { degrees } of EIGHT_ANGLES) {
            const pair = drawPairAt(
                degrees, PAIR_DISTANCE,
                LABEL_MIN_WIDTH, LABEL_MIN_WIDTH,
            );
            const middle = pairMidpoint(pair);
            const turned = (p: Point): Point => ({
                x: 2 * middle.x - p.x,
                y: 2 * middle.y - p.y,
            });
            const forward = arcOf(pair.forward);
            const returning = arcOf(pair.returning);
            assertPointsClose(
                returning.start, turned(forward.start),
            );
            assertPointsClose(
                returning.end, turned(forward.end),
            );
            assertPointsClose(
                returning.control, turned(forward.control),
            );
            assertPointsClose(
                labelOf(pair.returning),
                turned(labelOf(pair.forward)),
            );
        }
    },
);

Deno.test(
    'neither arc enters either state',
    () => {
        const samples = 32;
        const entries: string[] = [];
        for (
            const distance of [180, 200, 243, 300, 400, 600, 900]
        ) {
            for (let step = 0; step < 720; step++) {
                const degrees = step / 2;
                const pair = drawPairAt(
                    degrees, distance,
                    LABEL_MIN_WIDTH, LABEL_MIN_WIDTH,
                );
                for (
                    const geo of [pair.forward, pair.returning]
                ) {
                    const arc = arcOf(geo);
                    for (let i = 1; i <= samples; i++) {
                        const p = pointOnArc(
                            arc, i / (samples + 1),
                        );
                        if (
                            isInsideState(p, pair.a)
                            || isInsideState(p, pair.b)
                        ) {
                            entries.push(
                                `${distance} apart at`
                                + ` ${degrees} degrees:`
                                + ` (${p.x}, ${p.y})`,
                            );
                        }
                    }
                }
            }
        }
        assertEquals(entries, []);
    },
);

Deno.test(
    'a short pair bows by its chord and a long pair stops'
    + ' at BOW_MAX',
    () => {
        const bowOf = (arc: Arc): number => {
            const chord = Math.hypot(
                arc.end.x - arc.start.x,
                arc.end.y - arc.start.y,
            );
            const apex = pointOnArc(arc, 0.5);
            return Math.abs(
                (arc.end.x - arc.start.x)
                    * (apex.y - arc.start.y)
                - (arc.end.y - arc.start.y)
                    * (apex.x - arc.start.x),
            ) / chord;
        };
        const short = arcOf(drawPairAt(
            0, 300, LABEL_MIN_WIDTH, LABEL_MIN_WIDTH,
        ).forward);
        const shortChord = Math.hypot(
            short.end.x - short.start.x,
            short.end.y - short.start.y,
        );
        assert(shortChord * BOW_FRAC < BOW_MAX);
        assertAlmostEquals(
            bowOf(short),
            shortChord * BOW_FRAC,
            LENGTH_TOLERANCE,
        );
        const long = arcOf(drawPairAt(
            0, 900, LABEL_MIN_WIDTH, LABEL_MIN_WIDTH,
        ).forward);
        const longChord = Math.hypot(
            long.end.x - long.start.x,
            long.end.y - long.start.y,
        );
        assert(longChord * BOW_FRAC > BOW_MAX);
        assertAlmostEquals(
            bowOf(long), BOW_MAX, LENGTH_TOLERANCE,
        );
    },
);

Deno.test(
    'touching and overlapping states emit finite numbers',
    () => {
        const placements = [
            { name: 'touching', dx: NODE_WIDTH, dy: 0 },
            {
                name: 'touching at a corner',
                dx: NODE_WIDTH,
                dy: NODE_HEIGHT,
            },
            {
                name: 'overlapping',
                dx: NODE_WIDTH / 2,
                dy: NODE_HEIGHT / 4,
            },
            { name: 'coincident', dx: 0, dy: 0 },
            {
                name: 'one unit apart',
                dx: NODE_WIDTH + 1,
                dy: 0,
            },
        ];
        for (const { name, dx, dy } of placements) {
            const pair = drawPairApart(
                dx, dy, LABEL_MIN_WIDTH, LABEL_MIN_WIDTH,
            );
            for (const geo of [pair.forward, pair.returning]) {
                const numbers = geo.pathD
                    .split(/[\s,]+/)
                    .filter(token => !/^[MCQT]$/.test(token))
                    .map(Number);
                numbers.push(geo.labelX, geo.labelY);
                assert(
                    numbers.every(Number.isFinite),
                    `${name}: ${geo.pathD}`
                    + ` (${geo.labelX}, ${geo.labelY})`,
                );
            }
        }
    },
);

Deno.test(
    'a routed pair keeps its waypoints and gains the'
    + ' outside label',
    () => {
        const a = node('a', 0, 0);
        const b = node('b', 400, 0);
        const waypoints = [{ x: 240, y: -120 }];
        const edges = [
            { from: a, to: b, isCycle: false, n: { x: 0, y: -1 } },
            { from: b, to: a, isCycle: true, n: { x: 0, y: 1 } },
        ];
        for (const { from, to, isCycle, n } of edges) {
            const lens = arcOf(computeEdgeGeometry(
                from, to, 1, isCycle, LABEL_MIN_WIDTH, [],
            ));
            const routed = computeEdgeGeometry(
                from, to, 1, isCycle, LABEL_MIN_WIDTH,
                waypoints,
            );
            assertMatch(
                routed.pathD,
                new RegExp(
                    `^M ${lens.start.x} ${lens.start.y} Q `
                    + `.* T .* T ${lens.end.x} ${lens.end.y}$`,
                ),
            );
            const anchor = pointAlongPolyline(
                [lens.start, ...waypoints, lens.end], 0.5,
            );
            const push = LABEL_GAP + LABEL_HEIGHT / 2;
            assertPointsClose(labelOf(routed), {
                x: anchor.x + n.x * push,
                y: anchor.y + n.y * push,
            });
        }
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
