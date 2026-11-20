import { assert, assertEquals, assertStrictEquals } from
    '@std/assert';
import {
    generateIdentifier,
    isIdentifier,
} from '../shared/identifier.ts';
import {
    memoryDbAdapter,
    type MemoryDbAdapter,
} from '../api/db-memory.ts';
import { handleRequest } from '../api/api.ts';
import { organizationToken } from './token-fixtures.ts';
import { seedAdminSchema } from './test-fixtures.ts';
import { seedCurrentMember } from './member-fixtures.ts';
import {
    IF_MATCH_HEADER,
    IF_NONE_MATCH_HEADER,
} from '../api/message-pair.ts';
import {
    DEFAULT_ATTRIBUTE_ACL_ROLES,
    DEFAULT_LOCK_TIMEOUT,
    nowUtc,
} from '../shared/types.ts';
import { apiRequest, partBodiesOf } from './http-fixtures.ts';
import { seedSeat } from './root-admin-fixture.ts';
import { createArchiveDelta } from
    './fixtures/create-archive-graph.ts';

// POST organizations/:id/work-orders/ — the create carries
// the instance. A flow that names a record type requires
// one; the work order, its flow join, and the empty
// instance land together or not at all.

const AT = '2026-01-01T00:00:00.000000Z';
const ORGANIZATION = 'AjdvjuECVZEgZoFajaIEkg';
const ADMIN = 'XXZruirZyAOoRpNxaDnpSA';
const MEMBER = 'nkgaOHZISTQrILTfPThWCA';
const FLOW_ID = generateIdentifier();
const WO_ID = generateIdentifier();
const TYPE_ID = generateIdentifier();
const OTHER_TYPE_ID = generateIdentifier();
const ATTR_ID = generateIdentifier();
const INSTANCE_ID = generateIdentifier();
const NODE_CREATE = generateIdentifier();
const NODE_STEP = generateIdentifier();
const NODE_TARGET = generateIdentifier();

const BASE = '/organizations/' + ORGANIZATION;
const WORK_ORDERS = BASE + '/work-orders/';
const NOT_JOINED =
    'record_type_id is not joined to the work order\'s flow';

function typePath(typeId: string): string {
    return BASE + '/record-types/' + typeId;
}

function instancesPath(typeId: string): string {
    return typePath(typeId) + '/instances/';
}

function req(
    method: string,
    path: string,
    token: string,
    body?: unknown,
    headers?: Record<string, string>,
): Request {
    return apiRequest({
        method,
        path,
        token,
        body,
        ...(headers !== undefined ? { headers } : {}),
    });
}

function nodeJson(
    id: string,
    opts: { isCreate?: boolean, required?: string[] } = {},
): Record<string, unknown> {
    return {
        id,
        name: id,
        positionX: 0,
        positionY: 0,
        isCreate: opts.isCreate === true,
        isArchive: false,
        memberIds: [],
        attributes: (opts.required ?? []).map(
            (attributeId) => ({
                attribute_id: attributeId,
                mode: 'editable',
                isRequired: true,
            }),
        ),
        taskInstructions: '',
    };
}

// Create → step (required Title) → target: the reporter's
// flow, whose first submit bears a value.
function flowGraph(): Record<string, unknown> {
    return {
        name: 'Bound Birth Flow',
        lockTimeout: DEFAULT_LOCK_TIMEOUT,
        nodes: [
            nodeJson(NODE_CREATE, { isCreate: true }),
            nodeJson(NODE_STEP, { required: [ATTR_ID] }),
            nodeJson(NODE_TARGET),
        ],
        edges: [
            {
                id: generateIdentifier(), name: 'go',
                fromNodeId: NODE_CREATE, toNodeId: NODE_STEP,
            },
            {
                id: generateIdentifier(), name: 'go',
                fromNodeId: NODE_STEP, toNodeId: NODE_TARGET,
            },
        ],
    };
}

type Instance = {
    readonly instance_id: string,
    readonly record_type_id: string,
};

// The create as the client sends it; `instance` is the
// key under test, so each caller states it.
function createBody(
    instance: unknown,
    opts: { id?: string, flowId?: string } = {},
): Record<string, unknown> {
    const id = opts.id ?? WO_ID;
    return {
        id,
        workOrder: { flow_graph: flowGraph(), position: 1 },
        flowWorkOrderId: generateIdentifier(),
        flowWorkOrder: {
            flow_id: opts.flowId ?? FLOW_ID,
            work_order_id: id,
            at: AT,
        },
        stateEventIds: [
            generateIdentifier(),
            generateIdentifier(),
            generateIdentifier(),
        ],
        stateEventAts: [nowUtc(), nowUtc(), nowUtc()],
        states: [NODE_CREATE, NODE_STEP, 'claimed'],
        ...(instance === undefined ? {} : { instance }),
    };
}

function bound(
    instanceId: string = INSTANCE_ID,
    typeId: string = TYPE_ID,
): Instance {
    return { instance_id: instanceId, record_type_id: typeId };
}

async function seedFlow(
    db: MemoryDbAdapter,
    token: string,
): Promise<void> {
    const res = await handleRequest(db, req(
        'POST', BASE + '/flows/', token, {
            id: FLOW_ID,
            flow: {
                name: 'Bound Birth Flow',
                is_locked: false,
                is_auto_layout: false,
                is_auto_fit: false,
                lock_timeout: DEFAULT_LOCK_TIMEOUT,
            },
            projectFlowId: generateIdentifier(),
            projectFlow: {
                project_id: generateIdentifier(),
                flow_id: FLOW_ID,
                at: AT,
            },
            initialState: 'active',
            initialStateEventId: generateIdentifier(),
            initialStateAt: AT,
            graphDelta: createArchiveDelta(FLOW_ID, AT),
        },
    ));
    assertStrictEquals(res.status, 201);
    await res.body?.cancel();
}

async function seedType(
    db: MemoryDbAdapter,
    token: string,
    typeId: string,
): Promise<void> {
    const put = await handleRequest(db, req(
        'PUT', typePath(typeId), token, {
            name: 'Type ' + typeId,
            description: '',
            position: 1,
            state: 'active',
        },
    ));
    assertStrictEquals(put.status, 201);
    await put.body?.cancel();
}

async function seedTitle(
    db: MemoryDbAdapter,
    token: string,
): Promise<void> {
    const put = await handleRequest(db, req(
        'PUT', typePath(TYPE_ID) + '/attributes/' + ATTR_ID,
        token,
        {
            name: 'Title',
            attribute_type: 'text',
            sort_order: 0,
            options: [],
            constraints: [],
            read_roles: [...DEFAULT_ATTRIBUTE_ACL_ROLES],
            write_roles: [...DEFAULT_ATTRIBUTE_ACL_ROLES],
        },
    ));
    assertStrictEquals(put.status, 201);
    await put.body?.cancel();
}

async function joinFlowTo(
    db: MemoryDbAdapter,
    token: string,
    typeId: string,
    flowId: string = FLOW_ID,
): Promise<void> {
    const put = await handleRequest(db, req(
        'PUT',
        BASE + '/flows/' + flowId + '/records/'
            + generateIdentifier(),
        token,
        { flow_id: flowId, record_id: typeId, at: AT },
    ));
    assertStrictEquals(put.status, 201);
    await put.body?.cancel();
}

async function createInstance(
    db: MemoryDbAdapter,
    token: string,
    typeId: string,
    instanceId: string,
): Promise<Response> {
    return await handleRequest(db, req(
        'PATCH', instancesPath(typeId) + instanceId, token,
        { set: [] },
        { [IF_NONE_MATCH_HEADER]: '*' },
    ));
}

// The ids the type's instance collection lists.
async function instanceIds(
    db: MemoryDbAdapter,
    token: string,
    typeId: string,
): Promise<string[]> {
    const listed = await handleRequest(
        db, req('GET', instancesPath(typeId), token),
    );
    return (await partBodiesOf<{ id: string }>(listed))
        .map((row) => row.id);
}

async function pairCount(db: MemoryDbAdapter): Promise<number> {
    return (await db.messagePairs.getAll()).length;
}

async function statusOf(
    db: MemoryDbAdapter,
    path: string,
    token: string,
): Promise<number> {
    const res = await handleRequest(db, req('GET', path, token));
    await res.body?.cancel();
    return res.status;
}

// A flow with no record join: the unjoined state.
async function unjoined(): Promise<{
    db: MemoryDbAdapter,
    adminToken: string,
    memberToken: string,
}> {
    const db = memoryDbAdapter();
    await seedAdminSchema(db);
    await seedCurrentMember(db);
    await seedSeat(db, ORGANIZATION, MEMBER, 'member', AT);
    const adminToken = await organizationToken(
        ADMIN, ORGANIZATION,
    );
    const memberToken = await organizationToken(
        MEMBER, ORGANIZATION,
    );
    await seedFlow(db, adminToken);
    await seedType(db, adminToken, TYPE_ID);
    await seedTitle(db, adminToken);
    return { db, adminToken, memberToken };
}

// The reporter's setup: the flow names a record type.
async function joined(): Promise<{
    db: MemoryDbAdapter,
    adminToken: string,
    memberToken: string,
}> {
    const seeded = await unjoined();
    await joinFlowTo(seeded.db, seeded.adminToken, TYPE_ID);
    return seeded;
}

async function refused(
    db: MemoryDbAdapter,
    token: string,
    body: Record<string, unknown>,
    status: number,
    error: string,
): Promise<void> {
    const before = await pairCount(db);
    const res = await handleRequest(
        db, req('POST', WORK_ORDERS, token, body),
    );
    assertStrictEquals(res.status, status);
    assertEquals(await res.json(), { error });
    assertStrictEquals(await pairCount(db), before);
}

Deno.test('a create carrying the instance is born bound and'
    + ' submits', async () => {
    const { db, adminToken } = await joined();
    const created = await handleRequest(db, req(
        'POST', WORK_ORDERS, adminToken, createBody(bound()),
    ));
    assertStrictEquals(created.status, 201);
    const answer = await created.json() as {
        instance_id?: string,
        record_type_id?: string,
        events: readonly { state: string }[],
    };
    assertStrictEquals(answer.instance_id, INSTANCE_ID);
    assertStrictEquals(answer.record_type_id, TYPE_ID);
    assertEquals(answer.events.map((event) => event.state), [
        NODE_CREATE, NODE_STEP, 'claimed',
    ]);

    const head = await handleRequest(
        db, req('GET', WORK_ORDERS + WO_ID, adminToken),
    );
    assertStrictEquals(head.status, 200);
    const workOrderTag = head.headers.get('ETag')!;
    assertEquals(await head.json(), answer);

    const instance = await handleRequest(db, req(
        'GET', instancesPath(TYPE_ID) + INSTANCE_ID, adminToken,
    ));
    assertStrictEquals(instance.status, 200);
    const instanceTag = instance.headers.get('ETag')!;
    assertEquals(await instance.json(), {
        id: INSTANCE_ID,
        organization_id: ORGANIZATION,
        record_type_id: TYPE_ID,
        values: [],
    });
    assertEquals(
        await instanceIds(db, adminToken, TYPE_ID),
        [INSTANCE_ID],
    );

    // The reporter's submit: a value-bearing transition.
    const submitted = await handleRequest(db, req(
        'POST', WORK_ORDERS + WO_ID + '/transition', adminToken,
        {
            transitionEventId: generateIdentifier(),
            targetState: NODE_TARGET,
            release: null,
            transitionAt: nowUtc(),
            instance_id: INSTANCE_ID,
            record_type_id: TYPE_ID,
            set: [{ attribute_id: ATTR_ID, value: 'Acme' }],
        },
        { [IF_MATCH_HEADER]: workOrderTag + ', ' + instanceTag },
    ));
    assertStrictEquals(submitted.status, 200);
    await submitted.body?.cancel();
    const filled = await handleRequest(db, req(
        'GET', instancesPath(TYPE_ID) + INSTANCE_ID, adminToken,
    ));
    assertEquals(
        (await filled.json() as { values: unknown }).values,
        [{ attribute_id: ATTR_ID, value: 'Acme' }],
    );
});

Deno.test('a create without the instance on a flow that names'
    + ' a record type is 400', async () => {
    const { db, adminToken } = await joined();
    await refused(
        db, adminToken, createBody(undefined), 400,
        'WorkOrderCreateBody.instance is required:'
            + ' the flow names a record type',
    );
    assertStrictEquals(
        await statusOf(db, WORK_ORDERS + WO_ID, adminToken), 404,
    );
});

Deno.test('a create naming a type its flow does not join is'
    + ' 400', async () => {
    const { db, adminToken } = await joined();
    await seedType(db, adminToken, OTHER_TYPE_ID);
    await refused(
        db, adminToken,
        createBody(bound(INSTANCE_ID, OTHER_TYPE_ID)),
        400, NOT_JOINED,
    );
    assertStrictEquals(
        await statusOf(db, WORK_ORDERS + WO_ID, adminToken), 404,
    );
});

Deno.test('a create carrying an instance on a flow that names'
    + ' no record type is 400', async () => {
    const { db, adminToken } = await unjoined();
    await refused(
        db, adminToken, createBody(bound()), 400, NOT_JOINED,
    );
    assertStrictEquals(
        await statusOf(db, WORK_ORDERS + WO_ID, adminToken), 404,
    );
});

Deno.test('a create without an instance on a flow that names'
    + ' no record type is born unbound', async () => {
    const { db, adminToken } = await unjoined();
    const created = await handleRequest(db, req(
        'POST', WORK_ORDERS, adminToken, createBody(undefined),
    ));
    assertStrictEquals(created.status, 201);
    const answer = await created.json() as Record<string, unknown>;
    assertStrictEquals('instance_id' in answer, false);
    assertStrictEquals('record_type_id' in answer, false);
});

Deno.test('a resent bound create is 409 and leaves one'
    + ' instance', async () => {
    const { db, adminToken } = await joined();
    const body = createBody(bound());
    const first = await handleRequest(
        db, req('POST', WORK_ORDERS, adminToken, body),
    );
    assertStrictEquals(first.status, 201);
    await first.body?.cancel();
    await refused(
        db, adminToken, body, 409,
        'Document already exists at ' + WORK_ORDERS + WO_ID,
    );
    assertEquals(
        await instanceIds(db, adminToken, TYPE_ID),
        [INSTANCE_ID],
    );
});

Deno.test('a create whose instance id is already written is'
    + ' 409 and lands no work order', async () => {
    const { db, adminToken } = await joined();
    const taken = await createInstance(
        db, adminToken, TYPE_ID, INSTANCE_ID,
    );
    assertStrictEquals(taken.status, 201);
    await taken.body?.cancel();
    await refused(
        db, adminToken, createBody(bound()), 409,
        'Document already exists at '
            + instancesPath(TYPE_ID) + INSTANCE_ID,
    );
    assertStrictEquals(
        await statusOf(db, WORK_ORDERS + WO_ID, adminToken), 404,
    );
});

Deno.test('a create whose instance id was deleted is 410 and'
    + ' lands no work order', async () => {
    const { db, adminToken } = await joined();
    const taken = await createInstance(
        db, adminToken, TYPE_ID, INSTANCE_ID,
    );
    assertStrictEquals(taken.status, 201);
    await taken.body?.cancel();
    const deleted = await handleRequest(db, req(
        'DELETE', instancesPath(TYPE_ID) + INSTANCE_ID,
        adminToken,
    ));
    assertStrictEquals(deleted.status, 204);
    await refused(
        db, adminToken, createBody(bound()), 410,
        'Document is gone at '
            + instancesPath(TYPE_ID) + INSTANCE_ID,
    );
    assertStrictEquals(
        await statusOf(db, WORK_ORDERS + WO_ID, adminToken), 404,
    );
});

Deno.test('a malformed instance is 400 at the gate',
async () => {
    const { db, adminToken } = await joined();
    const label = 'WorkOrderCreateBody.instance';
    const cases: readonly [unknown, string][] = [
        [
            'not-an-object',
            'expected object for ' + label + ', got string',
        ],
        [
            { instance_id: INSTANCE_ID },
            'missing required key "record_type_id" for ' + label,
        ],
        [
            { instance_id: '', record_type_id: TYPE_ID },
            'instance_id must be a 22-character identifier',
        ],
        [
            { instance_id: INSTANCE_ID, record_type_id: '' },
            label + '.record_type_id must be non-empty',
        ],
        [
            { ...bound(), values: [] },
            'unexpected key "values" for ' + label,
        ],
    ];
    for (const [instance, error] of cases) {
        await refused(
            db, adminToken, createBody(instance), 400, error,
        );
    }
});

Deno.test('a member\'s create on a flow that names a record'
    + ' type is born bound', async () => {
    const { db, memberToken } = await joined();
    const created = await handleRequest(db, req(
        'POST', WORK_ORDERS, memberToken, createBody(bound()),
    ));
    assertStrictEquals(created.status, 201);
    const answer = await created.json() as {
        instance_id?: string,
    };
    assertStrictEquals(answer.instance_id, INSTANCE_ID);
});

Deno.test('a flow with two record joins accepts either type',
async () => {
    const { db, adminToken } = await joined();
    await seedType(db, adminToken, OTHER_TYPE_ID);
    await joinFlowTo(db, adminToken, OTHER_TYPE_ID);
    for (const typeId of [TYPE_ID, OTHER_TYPE_ID]) {
        const id = generateIdentifier();
        assert(isIdentifier(id));
        const created = await handleRequest(db, req(
            'POST', WORK_ORDERS, adminToken,
            createBody(
                bound(generateIdentifier(), typeId), { id },
            ),
        ));
        assertStrictEquals(created.status, 201);
        const answer = await created.json() as {
            record_type_id?: string,
        };
        assertStrictEquals(answer.record_type_id, typeId);
    }
});

// A join restricts its type's DELETE only under a live
// flow, so a join can outlive its type; the create asks
// the type what the instance create asks it.
Deno.test('a create naming a retired type is refused as the'
    + ' instance create is', async () => {
    const { db, adminToken } = await unjoined();
    const strayFlow = generateIdentifier();
    await seedType(db, adminToken, OTHER_TYPE_ID);
    await joinFlowTo(db, adminToken, OTHER_TYPE_ID, strayFlow);
    const retired = await handleRequest(db, req(
        'DELETE', typePath(OTHER_TYPE_ID), adminToken,
    ));
    assertStrictEquals(retired.status, 204);
    const direct = await createInstance(
        db, adminToken, OTHER_TYPE_ID, generateIdentifier(),
    );
    const directError = await direct.json() as { error: string };
    assertStrictEquals(direct.status, 404);
    await refused(
        db, adminToken,
        createBody(
            bound(INSTANCE_ID, OTHER_TYPE_ID),
            { flowId: strayFlow },
        ),
        direct.status, directError.error,
    );
});
