import { assertStrictEquals } from '@std/assert';
import { buildGraphSvg } from '../web-app/app/flow-graph.ts';
import type {
    GraphEdge,
    GraphNode,
} from '../shared/types.ts';

// The Flow Designer's SVG, pinned byte for byte. Each
// fixture file holds what buildGraphSvg emitted for this
// flow before its drawing helpers were shared, so a
// refactor of the designer's renderer must reproduce it.
// The files are the covenant: a change that breaks this
// test is fixed in the renderer, never by regenerating
// them.

// One flow that reaches every branch a shared helper
// feeds: a state name and a transition name over their
// caps, an unlabelled edge out of Create, a two-way pair
// that is also a cycle, a waypoint route, both member
// hazards (one member on `a`, none on `b`), and ports on
// the regular states only.
const NODES: GraphNode[] = [
    {
        id: 'c',
        name: 'Create',
        positionX: 40,
        positionY: 150,
        isCreate: true,
        isArchive: false,
        memberIds: [],
        attributes: [],
        taskInstructions: '',
    },
    {
        id: 'a',
        name: 'Review the customer\'s onboarding paperwork',
        positionX: 290,
        positionY: 40,
        isCreate: false,
        isArchive: false,
        memberIds: ['m-solo'],
        attributes: [],
        taskInstructions: '',
    },
    {
        id: 'b',
        name: 'Verify identity',
        positionX: 560,
        positionY: 230,
        isCreate: false,
        isArchive: false,
        memberIds: [],
        attributes: [],
        taskInstructions: '',
    },
    {
        id: 'z',
        name: 'Archive',
        positionX: 850,
        positionY: 150,
        isCreate: false,
        isArchive: true,
        memberIds: [],
        attributes: [],
        taskInstructions: '',
    },
];

const EDGES: GraphEdge[] = [
    {
        id: 'ca',
        name: '',
        fromNodeId: 'c',
        toNodeId: 'a',
    },
    {
        id: 'ab',
        name: 'approve the application form quickly',
        fromNodeId: 'a',
        toNodeId: 'b',
    },
    {
        id: 'ba',
        name: 'revise',
        fromNodeId: 'b',
        toNodeId: 'a',
    },
    {
        id: 'bz',
        name: 'close',
        fromNodeId: 'b',
        toNodeId: 'z',
    },
];

const EDGE_WAYPOINTS = new Map([
    ['bz', [{ x: 790, y: 330 }]],
]);

export function goldenGraphSvg(isLocked: boolean): string {
    return buildGraphSvg(
        NODES, EDGES,
        -20, -10, 1100, 640,
        { kind: 'none' },
        isLocked, false, null,
        EDGE_WAYPOINTS,
        '',
    ).toString();
}

const VARIANTS = [
    { name: 'unlocked', isLocked: false },
    { name: 'locked', isLocked: true },
] as const;

Deno.test(
    'buildGraphSvg emits the pinned designer SVG',
    async () => {
        for (const variant of VARIANTS) {
            const pinned = await Deno.readTextFile(
                new URL(
                    './fixtures/flow-graph-golden-'
                    + variant.name + '.svg',
                    import.meta.url,
                ),
            );
            assertStrictEquals(
                goldenGraphSvg(variant.isLocked),
                pinned,
                variant.name,
            );
        }
    },
);
