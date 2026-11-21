import {
    compareIdentifiers,
    generateIdentifier,
} from '../../shared/identifier.ts';

// The least graph the flow gate accepts: one Create node
// and one Archive node, as a flow is born with.

interface StoredNode {
    readonly id: string;
    readonly name: string;
    readonly positionX: number;
    readonly positionY: number;
    readonly isCreate: boolean;
    readonly isArchive: boolean;
    readonly memberIds: string[];
    readonly attributes: never[];
    readonly taskInstructions: string;
}

interface NodeRow {
    readonly id: string;
    readonly flow_id: string;
    readonly name: string;
    readonly position_x: number;
    readonly position_y: number;
    readonly is_create: boolean;
    readonly is_archive: boolean;
    readonly task_instructions: string;
    readonly at: string;
}

// A type alias, not an interface: callers hand the graph
// to parameters typed Record<string, unknown>, and only
// an alias carries the implicit index signature.
type Graph = {
    nodes: StoredNode[];
    edges: never[];
};

interface Delta {
    nodes: NodeRow[];
    edges: never[];
    deletions: never[];
    memberEvents: never[];
    attributeEvents: never[];
}

function storedNode(
    name: string,
    isCreate: boolean,
): StoredNode {
    return {
        id: generateIdentifier(),
        name,
        positionX: 0,
        positionY: 0,
        isCreate,
        isArchive: !isCreate,
        memberIds: [],
        attributes: [],
        taskInstructions: '',
    };
}

function byId(
    a: { readonly id: string },
    b: { readonly id: string },
): number {
    return compareIdentifiers(a.id, b.id);
}

// The stored graph a document PUT carries, its nodes in
// identifier order, as a GET serves them.
export function createArchiveGraph(): Graph {
    return {
        nodes: [
            storedNode('Create', true),
            storedNode('Archive', false),
        ].sort(byId),
        edges: [],
    };
}

// `graph` and the nodes a test adds to it, in identifier
// order.
export function graphWithNodes<N extends { readonly id: string }>(
    graph: Graph,
    nodes: readonly N[],
): { nodes: (StoredNode | N)[]; edges: never[] } {
    return {
        nodes: [...graph.nodes, ...nodes].sort(byId),
        edges: [],
    };
}

// The graphDelta a flow creation POST carries to be born
// with `graph`: one row per node, in the graph's order.
export function createArchiveDeltaOf(
    graph: Graph,
    flowId: string,
    at: string,
): Delta {
    return {
        nodes: graph.nodes.map((node) => ({
            id: node.id,
            flow_id: flowId,
            name: node.name,
            position_x: node.positionX,
            position_y: node.positionY,
            is_create: node.isCreate,
            is_archive: node.isArchive,
            task_instructions: node.taskInstructions,
            at,
        })),
        edges: [],
        deletions: [],
        memberEvents: [],
        attributeEvents: [],
    };
}

export function createArchiveDelta(
    flowId: string,
    at: string,
): Delta {
    return createArchiveDeltaOf(
        createArchiveGraph(), flowId, at,
    );
}
