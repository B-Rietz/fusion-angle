import { assertEquals } from '@std/assert';
import { routes } from '../api/routes.ts';
import {
    openReplayStage,
    partsOf,
    type RecordedExchange,
    type ReplayRequest,
    type ReplayStage,
} from '../web-app/app/api-documentation-replay.ts';
import {
    type Cast,
    castOf,
    type Endpoint,
    endpointsOf,
    NO_SAMPLE,
    planOf,
    planRead,
    planWrite,
    type ReplayPlan,
    sendPlan,
} from '../web-app/app/api-documentation-story.ts';

// Every assertion compares a status, a hash, or a boolean,
// so a failure never prints the bearer a request carries.

const ENDPOINTS = endpointsOf(routes);
// RFC 9110 §15.3: the successful class is 2xx.
const SUCCESSFUL_FROM = 200;
const SUCCESSFUL_BELOW = 300;

function isSuccessful(exchange: RecordedExchange): boolean {
    const { status } = exchange.response;
    return status >= SUCCESSFUL_FROM && status < SUCCESSFUL_BELOW;
}

function readsOf(): readonly Endpoint[] {
    return ENDPOINTS.filter(
        ({ verb }) => verb === 'get' || verb === 'query',
    );
}

function endpointAt(hash: string): Endpoint {
    const endpoint = ENDPOINTS.find((held) => held.hash === hash);
    if (endpoint === undefined) {
        throw new Error('no endpoint ' + hash);
    }
    return endpoint;
}

type Replay = Extract<ReplayPlan, { readonly kind: 'replay' }>;

interface Planned {
    readonly endpoint: Endpoint;
    readonly plan: ReplayPlan;
}

async function plannedReads(
    stage: ReplayStage,
    cast: Cast,
): Promise<readonly Planned[]> {
    const planned: Planned[] = [];
    for (const endpoint of readsOf()) {
        planned.push({
            endpoint,
            plan: await planRead(endpoint, cast, stage),
        });
    }
    return planned;
}

// The plan sent on a copy of its own: sendPlan fails on a
// setup or latch read that does not succeed, and the
// request must succeed too.
async function replayed(
    stage: ReplayStage,
    hash: string,
    plan: Replay,
): Promise<RecordedExchange> {
    const exchange = await sendPlan(stage, plan, (request) => request);
    assertEquals(
        isSuccessful(exchange),
        true,
        hash + ' answered ' + exchange.response.status,
    );
    return exchange;
}

async function storyRead(
    stage: ReplayStage,
    cast: Cast,
    hash: string,
): Promise<{
    readonly plan: Replay;
    readonly exchange: RecordedExchange;
}> {
    const plan = await planRead(endpointAt(hash), cast, stage);
    if (plan.kind !== 'replay') {
        throw new Error(hash + ' has no replay: ' + plan.reason);
    }
    return { plan, exchange: await replayed(stage, hash, plan) };
}

function pathIdOf(
    plan: Replay,
    index: number,
): string {
    const pathId = plan.pathIds[index];
    if (pathId === undefined) {
        throw new Error('no path id at ' + index);
    }
    return pathId.value;
}

// The named string field of each part's JSON body.
function partFieldsOf(
    exchange: RecordedExchange,
    name: string,
): readonly string[] {
    return partsOf(exchange.response).map((part) => {
        const body: unknown = JSON.parse(part.body);
        if (typeof body !== 'object' || body === null) {
            throw new Error('a part body is not a document');
        }
        const value: unknown = Object.getOwnPropertyDescriptor(
            body, name,
        )?.value;
        if (typeof value !== 'string') {
            throw new Error('a part body names no ' + name);
        }
        return value;
    });
}

function requestsOf(plan: Replay): readonly ReplayRequest[] {
    return plan.latch.kind === 'unlatched'
        ? [...plan.setup, plan.request]
        : [...plan.setup, plan.latch.read, plan.request];
}

// The path parameter a latch fills, as pathIds names the
// others.
function latchedNamesOf(plan: Replay): readonly string[] {
    return plan.latch.kind === 'etag-segment'
        ? [plan.latch.name]
        : [];
}

function writesOf(): readonly Endpoint[] {
    return ENDPOINTS.filter(
        ({ verb }) => verb !== 'get' && verb !== 'query',
    );
}

async function plannedEndpoints(
    stage: ReplayStage,
    cast: Cast,
): Promise<readonly Planned[]> {
    const planned: Planned[] = [];
    for (const endpoint of ENDPOINTS) {
        planned.push({
            endpoint,
            plan: await planOf(endpoint, cast, stage),
        });
    }
    return planned;
}

// The documents the writes change on their copies: the
// story flow (undo renames it), the story flow record and
// the story instance (deleted), and a work order the
// transition moves.
const BASE_WITNESSES: readonly string[] = [
    'get/organizations/id/flows/id',
    'get/organizations/id/flows/id/records/frid',
    'get/organizations/organization-id/record-types'
        + '/record-type-id/instances/instance-id',
];
const MOVED_WORK_ORDER_ID = 'FCEBEWzmelSFTOlqcZsbdQ';

async function storyReadRequestOf(
    stage: ReplayStage,
    cast: Cast,
    hash: string,
): Promise<ReplayRequest> {
    const plan = await planRead(endpointAt(hash), cast, stage);
    if (plan.kind !== 'replay') {
        throw new Error(hash + ' has no replay');
    }
    return plan.request;
}

// What the base rows serve for each witness: its target,
// status, and etag lines.
async function baseStateOf(
    stage: ReplayStage,
    cast: Cast,
): Promise<readonly string[]> {
    const requests: ReplayRequest[] = [];
    for (const hash of BASE_WITNESSES) {
        requests.push(await storyReadRequestOf(stage, cast, hash));
    }
    const workOrder = await storyReadRequestOf(
        stage, cast, 'get/organizations/id/work-orders/id',
    );
    requests.push({
        ...workOrder,
        target: workOrder.target.slice(
            0, workOrder.target.lastIndexOf('/') + 1,
        ) + MOVED_WORK_ORDER_ID,
    });
    const state: string[] = [];
    for (const request of requests) {
        const { response } = await stage.send(stage.base, request);
        state.push([
            request.target,
            String(response.status),
            ...response.headers
                .filter(([name]) => name === 'etag')
                .map(([, value]) => value),
        ].join(' '));
    }
    return state;
}

Deno.test('every read replays or says why', async () => {
    const stage = await openReplayStage();
    const cast = await castOf(stage);
    const replays = new Set<string>();
    for (const { endpoint, plan } of await plannedReads(stage, cast)) {
        if (plan.kind === 'none') {
            assertEquals(plan.reason !== '', true, endpoint.hash);
            assertEquals(
                NO_SAMPLE.has(endpoint.hash), true, endpoint.hash,
            );
            continue;
        }
        replays.add(endpoint.hash);
        await replayed(stage, endpoint.hash, plan);
    }
    const hashes = new Set(ENDPOINTS.map(({ hash }) => hash));
    for (const hash of NO_SAMPLE.keys()) {
        assertEquals(hashes.has(hash), true, hash);
        assertEquals(replays.has(hash), false, hash);
    }
});

Deno.test('the story documents tell one story', async () => {
    const stage = await openReplayStage();
    const cast = await castOf(stage);
    const workOrder = await storyRead(
        stage, cast, 'get/organizations/id/work-orders/id',
    );
    const recordType = await storyRead(
        stage,
        cast,
        'get/organizations/organization-id/record-types'
            + '/record-type-id',
    );
    const flowWorkOrders = await storyRead(
        stage, cast, 'get/organizations/id/flows/id/work-orders',
    );
    const flowRecords = await storyRead(
        stage, cast, 'get/organizations/id/flows/id/records',
    );
    const projectFlows = await storyRead(
        stage, cast, 'get/organizations/id/projects/id/flows',
    );
    const flow = pathIdOf(flowWorkOrders.plan, 1);
    assertEquals(pathIdOf(flowRecords.plan, 1), flow);
    assertEquals(
        partFieldsOf(flowWorkOrders.exchange, 'work_order_id')
            .includes(pathIdOf(workOrder.plan, 1)),
        true,
    );
    assertEquals(
        partFieldsOf(flowRecords.exchange, 'record_id')
            .includes(pathIdOf(recordType.plan, 1)),
        true,
    );
    assertEquals(
        partFieldsOf(projectFlows.exchange, 'flow_id')
            .includes(flow),
        true,
    );
});

Deno.test('a path id names its source', async () => {
    const stage = await openReplayStage();
    const cast = await castOf(stage);
    const hashes = new Set(ENDPOINTS.map(({ hash }) => hash));
    for (const { endpoint, plan } of await plannedReads(stage, cast)) {
        if (plan.kind === 'none') continue;
        const caller = plan.caller === 'member'
            ? cast.member
            : cast.admin;
        const parameters = endpoint.row.segments.filter(
            (segment) => segment.startsWith(':'),
        );
        assertEquals(
            [
                ...plan.pathIds.map(({ name }) => name),
                ...latchedNamesOf(plan),
            ],
            parameters,
            endpoint.hash,
        );
        if (plan.latch.kind === 'etag-segment') {
            assertEquals(
                hashes.has(plan.latch.source),
                true,
                endpoint.hash + ' ' + plan.latch.name,
            );
        }
        for (const pathId of plan.pathIds) {
            if (pathId.source === '') {
                assertEquals(
                    pathId.value === caller.identityId,
                    true,
                    endpoint.hash + ' ' + pathId.name,
                );
                continue;
            }
            assertEquals(
                hashes.has(pathId.source),
                true,
                endpoint.hash + ' ' + pathId.name,
            );
        }
    }
});

Deno.test("a plan's header names are lower-case and unique",
    async () => {
        const stage = await openReplayStage();
        const cast = await castOf(stage);
        for (const { endpoint, plan } of
            await plannedEndpoints(stage, cast)) {
            if (plan.kind === 'none') continue;
            for (const request of requestsOf(plan)) {
                const names = request.headers.map(([name]) => name);
                assertEquals(
                    names.map((name) => name.toLowerCase()),
                    names,
                    endpoint.hash,
                );
                assertEquals(
                    new Set(names).size,
                    names.length,
                    endpoint.hash,
                );
            }
        }
    });

Deno.test('every write replays on its own copy or says why',
    async () => {
        const stage = await openReplayStage();
        const cast = await castOf(stage);
        const before = await baseStateOf(stage, cast);
        for (const endpoint of writesOf()) {
            const plan = await planWrite(endpoint, cast, stage);
            if (plan.kind === 'none') {
                assertEquals(
                    NO_SAMPLE.get(endpoint.hash),
                    plan.reason,
                    endpoint.hash,
                );
                continue;
            }
            await replayed(stage, endpoint.hash, plan);
        }
        assertEquals(await baseStateOf(stage, cast), before);
    });

Deno.test('a plan with no sample gives its NO_SAMPLE entry',
    async () => {
        const stage = await openReplayStage();
        const cast = await castOf(stage);
        const none = new Set<string>();
        for (const { endpoint, plan } of
            await plannedEndpoints(stage, cast)) {
            if (plan.kind !== 'none') continue;
            none.add(endpoint.hash);
            assertEquals(
                plan.reason,
                NO_SAMPLE.get(endpoint.hash),
                endpoint.hash,
            );
        }
        assertEquals([...none].sort(), [...NO_SAMPLE.keys()].sort());
    });
