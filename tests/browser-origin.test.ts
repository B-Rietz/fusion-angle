import { assert, assertStrictEquals } from '@std/assert';
import { STARK_ORGANIZATION } from
    '../api/mock-data/seed-constants.ts';
import {
    ADMIN_EMAIL,
    adminToken,
    type Origin,
    passwordOf,
    startOrigin,
} from './browser/fixtures.ts';
import { fetchDiscardingBody } from
    './fixtures/fetch-discarding-body.ts';
import { generateIdentifier } from
    '../shared/identifier.ts';
import { partBodiesOf } from './http-fixtures.ts';

// The list route the API actually exposes: there is no
// /api/organizations/ collection, so the origin proves
// itself on the seats route tests/api-human-members.ts
// reads, in the same organization adminToken() scopes to.
const MEMBERS_PATH = '/api/organizations/'
    + STARK_ORGANIZATION + '/memberships/?state=accepted';

Deno.test('the in-process origin serves the seeded API',
async () => {
    const staticRoot = Deno.makeTempDirSync({
        prefix: 'fusion-origin-',
    });
    Deno.env.set('FUSION_ANGLE_STATIC_ROOT', staticRoot);
    const origin = await startOrigin();
    try {
        assert(
            passwordOf(origin.credentials, ADMIN_EMAIL)
                .length > 0,
        );
        const operationId = generateIdentifier();
        const anonymous = await fetchDiscardingBody(
            origin.baseUrl + MEMBERS_PATH,
            {
                headers: { 'operation-id': operationId },
            },
        );
        assertStrictEquals(anonymous.status, 401);
        const bearer = await fetch(
            origin.baseUrl + MEMBERS_PATH,
            { headers: {
                Authorization: 'Bearer '
                    + await adminToken(),
                'operation-id': generateIdentifier(),
            } },
        );
        assertStrictEquals(bearer.status, 200);
        const rows = await partBodiesOf<{
            identity_id: string;
        }>(bearer);
        assert(rows.length > 0);
    } finally {
        await origin.close();
        Deno.removeSync(staticRoot, { recursive: true });
    }
});

const IDEAS_PATH = '/api/organizations/'
    + STARK_ORGANIZATION + '/ideas/';

async function ideaHeaders(): Promise<Record<string, string>> {
    return {
        Authorization: 'Bearer ' + await adminToken(),
        'operation-id': generateIdentifier(),
    };
}

async function getIdeaStatus(
    origin: Origin, ideaId: string,
): Promise<number> {
    const response = await fetchDiscardingBody(
        origin.baseUrl + IDEAS_PATH + ideaId,
        { headers: await ideaHeaders() },
    );
    return response.status;
}

async function putIdeaStatus(
    origin: Origin, ideaId: string,
): Promise<number> {
    const response = await fetchDiscardingBody(
        origin.baseUrl + IDEAS_PATH + ideaId,
        {
            method: 'PUT',
            headers: {
                ...await ideaHeaders(),
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                title: 'Written through one origin',
                position: 1,
                problem_statement: 'p',
                target_users: 't',
                proposed_solution: 's',
                expected_outcome: 'o',
                success_metrics: 'm',
                state: 'active',
            }),
        },
    );
    return response.status;
}

// One origin for one body, closed whatever the body does.
async function withOrigin(
    body: (origin: Origin) => Promise<void>,
): Promise<void> {
    const origin = await startOrigin();
    try {
        await body(origin);
    } finally {
        await origin.close();
    }
}

// Every origin is a world of its own, whatever the
// fixture shares to start one: an idea written through
// one is read through no other, neither one open beside
// it nor one opened after.
Deno.test('a write through one origin is read through no other',
async () => {
    const staticRoot = Deno.makeTempDirSync({
        prefix: 'fusion-origin-',
    });
    try {
        Deno.env.set('FUSION_ANGLE_STATIC_ROOT', staticRoot);
        const ideaId = generateIdentifier();
        await withOrigin(async (written) => {
            await withOrigin(async (beside) => {
                assertStrictEquals(
                    await putIdeaStatus(written, ideaId), 201,
                );
                assertStrictEquals(
                    await getIdeaStatus(written, ideaId), 200,
                );
                assertStrictEquals(
                    await getIdeaStatus(beside, ideaId), 404,
                );
            });
            await withOrigin(async (after) => {
                assertStrictEquals(
                    await getIdeaStatus(after, ideaId), 404,
                );
            });
        });
    } finally {
        Deno.removeSync(staticRoot, { recursive: true });
    }
});
