import { assert, assertEquals, assertStrictEquals } from '@std/assert';
import { buildFlows } from '../api/mock-data/flows.ts';
import { deriveFlow, deriveFlows } from '../api/derive-flows.ts';
import { asStoredGraph } from '../shared/flow-graph-body.ts';
import type { StoredGraph } from '../shared/types.ts';
import { seededMockDb } from './mock-seed.ts';
import {
    ORGANIZATION_TWO,
    STARK_ORGANIZATION,
} from '../api/mock-data/seed-constants.ts';

// buildFlows() seeds land on Stark (flowSeedBody stamps
// organization_id: STARK_ORGANIZATION); seed-flow-org2 is a
// separate postFlowDocumentOp path, which only the
// Create-and-Archive test below covers.
const SEEDED_ORGANIZATIONS = [
    STARK_ORGANIZATION, ORGANIZATION_TWO,
];

// Phase Final Task 2: graph relation ROW halves stripped.
// The decompose covenant re-homes to the message plane: every
// seeded flow's AUTHORED build-time graph must equal the
// graph deriveFlow returns from the document message pair (graph
// field, not graphDelta). Relations are SETS, so comparison
// is order-normalized.
function normalizeGraph(graph: StoredGraph): StoredGraph {
    return {
        nodes: [...graph.nodes]
            .sort((a, b) => a.id.localeCompare(b.id))
            .map(node => ({
                ...node,
                memberIds: [...node.memberIds].sort(),
                attributes: [...node.attributes].sort(
                    (a, b) => a.attributeId.localeCompare(
                        b.attributeId,
                    ),
                ),
            })),
        edges: [...graph.edges].sort(
            (a, b) => a.id.localeCompare(b.id),
        ),
    };
}

Deno.test('seed message-plane graph equals each flow\'s'
    + ' authored graph',
async () => {
    const db = await seededMockDb();

    for (const flow of buildFlows()) {
        const expected = asStoredGraph(
            flow.graph, 'seed flow ' + flow.id,
        );
        const derived = await deriveFlow(
            db, STARK_ORGANIZATION, flow.id,
        );
        const actual = asStoredGraph(
            derived.graph, 'derived flow ' + flow.id,
        );
        assertEquals(
            normalizeGraph(actual),
            normalizeGraph(expected),
            'flow ' + flow.id + ' pair graph must '
                + 'equal its authored graph',
        );
    }
});

Deno.test('Fusion Angle Flow keeps its seed id', () => {
    const flow = buildFlows().find(
        (row) => row.name === 'Fusion Angle Flow',
    );
    assert(flow, 'Fusion Angle Flow must exist');
    assertStrictEquals(
        flow!.id,
        'GgfDbXOJUvvaCekCTcvhuw',
    );
});

// A flow is born with its Create and Archive nodes, and the
// designer adds a node only by dragging from one that
// exists, so a seeded flow without them could never be
// drawn on.
Deno.test('every seeded flow has one Create and one Archive',
async () => {
    const db = await seededMockDb();

    for (const organization of SEEDED_ORGANIZATIONS) {
        for (const flow of await deriveFlows(db, organization)) {
            const { nodes } = asStoredGraph(
                flow.graph, 'derived flow ' + flow.id,
            );
            assertEquals(
                {
                    create: nodes.filter(n => n.isCreate).length,
                    archive:
                        nodes.filter(n => n.isArchive).length,
                },
                { create: 1, archive: 1 },
                'flow ' + flow.name,
            );
        }
    }
});
