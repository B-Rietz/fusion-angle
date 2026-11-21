import { assertEquals, assertStrictEquals } from '@std/assert';
import { generateIdentifier } from '../shared/identifier.ts';
import {
    memoryDbAdapter,
    type MemoryDbAdapter,
} from '../api/db-memory.ts';
import { handleRequest } from '../api/api.ts';
import { organizationToken } from './token-fixtures.ts';
import { seedAdminSchema } from './test-fixtures.ts';
import { DEFAULT_LOCK_TIMEOUT } from '../shared/types.ts';
import { apiRequest } from './http-fixtures.ts';

// A flow's graph holds exactly one Create node and exactly
// one Archive node, as two different nodes. The designer
// adds a node only by dragging from an existing one and
// never deletes those two, so a flow stored without them
// can never be repaired in the product.

const AT = '2026-01-01T00:00:00.000000Z';
const FLOWS = '/organizations/AjdvjuECVZEgZoFajaIEkg/flows/';
const REFUSAL = 'FlowDocumentBody.graph must hold exactly one'
    + ' Create node and exactly one Archive node, as two'
    + ' different nodes';

interface NodeKind {
    readonly isCreate: boolean;
    readonly isArchive: boolean;
}

const CREATE: NodeKind = { isCreate: true, isArchive: false };
const ARCHIVE: NodeKind = { isCreate: false, isArchive: true };
const STATE: NodeKind = { isCreate: false, isArchive: false };
const BOTH: NodeKind = { isCreate: true, isArchive: true };

function node(kind: NodeKind) {
    return {
        id: generateIdentifier(),
        name: 'Node',
        positionX: 0,
        positionY: 0,
        ...kind,
        memberIds: [],
        attributes: [],
        taskInstructions: '',
    };
}

function flowFields() {
    return {
        name: 'Flow',
        is_locked: false,
        is_auto_layout: false,
        is_auto_fit: false,
        lock_timeout: DEFAULT_LOCK_TIMEOUT,
    };
}

function emptyDelta() {
    return {
        nodes: [],
        edges: [],
        deletions: [],
        memberEvents: [],
        attributeEvents: [],
    };
}

async function freshDb(): Promise<MemoryDbAdapter> {
    const db = memoryDbAdapter();
    await seedAdminSchema(db);
    return db;
}

async function putGenesis(
    db: MemoryDbAdapter,
    flowId: string,
    kinds: readonly NodeKind[],
): Promise<Response> {
    return handleRequest(db, apiRequest({
        method: 'PUT',
        path: FLOWS + flowId,
        token: await organizationToken(),
        body: {
            ...flowFields(),
            state: 'active',
            state_at: AT,
            state_event_id: generateIdentifier(),
            graph: { nodes: kinds.map(node), edges: [] },
            graphDelta: emptyDelta(),
            revivals: [],
        },
        headers: { 'if-none-match': '*' },
    }));
}

async function assertRefused(res: Response): Promise<void> {
    assertStrictEquals(res.status, 400);
    assertEquals(await res.json(), { error: REFUSAL });
}

Deno.test('a flow PUT with one Create and one Archive node'
+ ' is 201', async () => {
    const res = await putGenesis(
        await freshDb(), generateIdentifier(),
        [CREATE, STATE, ARCHIVE],
    );
    await res.body?.cancel();
    assertStrictEquals(res.status, 201);
});

Deno.test('a flow PUT with no Create node is 400', async () => {
    await assertRefused(await putGenesis(
        await freshDb(), generateIdentifier(), [ARCHIVE],
    ));
});

Deno.test('a flow PUT with no Archive node is 400', async () => {
    await assertRefused(await putGenesis(
        await freshDb(), generateIdentifier(), [CREATE],
    ));
});

Deno.test('a flow PUT with two Create nodes is 400', async () => {
    await assertRefused(await putGenesis(
        await freshDb(), generateIdentifier(),
        [CREATE, CREATE, ARCHIVE],
    ));
});

Deno.test('a flow PUT with two Archive nodes is 400', async () => {
    await assertRefused(await putGenesis(
        await freshDb(), generateIdentifier(),
        [CREATE, ARCHIVE, ARCHIVE],
    ));
});

Deno.test('a flow PUT whose one node is both Create and'
+ ' Archive is 400', async () => {
    await assertRefused(await putGenesis(
        await freshDb(), generateIdentifier(), [BOTH],
    ));
});

Deno.test('a refused flow PUT stores nothing', async () => {
    const db = await freshDb();
    const flowId = generateIdentifier();
    const refused = await putGenesis(db, flowId, []);
    await refused.body?.cancel();
    const got = await handleRequest(db, apiRequest({
        method: 'GET',
        path: FLOWS + flowId,
        token: await organizationToken(),
    }));
    await got.body?.cancel();
    assertStrictEquals(got.status, 404);
});

Deno.test('a flow POST whose graph has no Create or Archive'
+ ' node is 400', async () => {
    const flowId = generateIdentifier();
    const res = await handleRequest(await freshDb(), apiRequest({
        method: 'POST',
        path: FLOWS,
        token: await organizationToken(),
        body: {
            id: flowId,
            flow: flowFields(),
            projectFlowId: generateIdentifier(),
            projectFlow: {
                project_id: 'qfhFObbtDfxUZwEGxySBoQ',
                flow_id: flowId,
                at: AT,
            },
            initialState: 'active',
            initialStateEventId: generateIdentifier(),
            initialStateAt: AT,
            graphDelta: emptyDelta(),
        },
    }));
    await assertRefused(res);
});
