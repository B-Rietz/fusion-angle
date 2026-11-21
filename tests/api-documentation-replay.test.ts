import { assertEquals, assertNotEquals } from '@std/assert';
import {
    STARK_ORGANIZATION,
} from '../api/mock-data/seed-constants.ts';
import { authParam } from '../client/authentication.ts';
import { withApiResponseDefaults } from
    '../server/http-server.ts';
import { isIdentifier } from '../shared/identifier.ts';
import { setPasswordHasher } from '../shared/password-hash.ts';
import { generateSecret } from '../shared/secret.ts';
import type {
    ApiDocHeaderLine,
} from '../web-app/api-documentation/shapes.ts';
import {
    openReplayStage,
    partsOf,
    type RecordedExchange,
    type ReplayRequest,
    type ReplayStage,
    type ReplayState,
} from '../web-app/app/api-documentation-replay.ts';
import { testHashPassword } from './mock-seed.ts';

// The seeded organization admin, a member of both
// organizations.
const ORGANIZATION_ADMIN_ID = 'XXZruirZyAOoRpNxaDnpSA';
const ORGANIZATION = '/api/organizations/' + STARK_ORGANIZATION;
const FLOWS = ORGANIZATION + '/flows/';
// Outside ASCII, so its octets outnumber its characters.
const FLOW_NAME = 'Café — renamed on a copy';

// Every assertion on a credential compares a boolean, so a
// failure never prints one.

function namesOf(
    headers: readonly ApiDocHeaderLine[],
): string[] {
    return headers.map(([name]) => name);
}

function valueOf(
    headers: readonly ApiDocHeaderLine[],
    name: string,
): string {
    const line = headers.find(([held]) => held === name);
    if (line === undefined) {
        throw new Error('no ' + name + ' header');
    }
    return line[1];
}

function documentOf(body: string): Record<string, unknown> {
    const document: unknown = JSON.parse(body);
    if (typeof document !== 'object' || document === null) {
        throw new Error('the body is not a document');
    }
    return { ...document };
}

function idOf(body: string): string {
    const { id } = documentOf(body);
    if (typeof id !== 'string') {
        throw new Error('the body names no id');
    }
    return id;
}

function octetLengthOf(text: string): string {
    return String(new TextEncoder().encode(text).byteLength);
}

function readOf(target: string, bearer: string): ReplayRequest {
    return {
        method: 'GET',
        target,
        headers: [['authorization', 'Bearer ' + bearer]],
        body: '',
    };
}

function organizationAdminOf(stage: ReplayStage) {
    const seeded = stage.credentials.identities.find(
        (identity) => identity.identityId === ORGANIZATION_ADMIN_ID,
    );
    if (seeded === undefined) {
        throw new Error('the organization admin is not seeded');
    }
    return seeded;
}

function signInOrganizationAdmin(stage: ReplayStage) {
    const seeded = organizationAdminOf(stage);
    return stage.signIn(
        stage.base,
        seeded.username,
        seeded.password,
        generateSecret(),
    );
}

interface RenamedFlow {
    readonly target: string;
    readonly before: RecordedExchange;
    readonly body: string;
    readonly written: RecordedExchange;
}

// The listing's first flow, renamed on `on`. A PUT whose
// body is the head's stores nothing and answers the head's
// etag, so the write changes the name.
async function renameFirstFlow(
    stage: ReplayStage,
    on: ReplayState,
    bearer: string,
): Promise<RenamedFlow> {
    const listing = await stage.send(on, readOf(FLOWS, bearer));
    const target = FLOWS
        + idOf(partsOf(listing.response)[0]!.body);
    const before = await stage.send(on, readOf(target, bearer));
    const body = JSON.stringify({
        ...documentOf(before.response.body),
        name: FLOW_NAME,
    });
    const written = await stage.send(on, {
        method: 'PUT',
        target,
        headers: [
            ['authorization', 'Bearer ' + bearer],
            ['if-match', valueOf(before.response.headers, 'etag')],
            ['content-type', 'application/json'],
        ],
        body,
    });
    return { target, before, body, written };
}

Deno.test('sign-in is two calls under Basic', async () => {
    const stage = await openReplayStage();
    const seeded = organizationAdminOf(stage);
    const verifier = generateSecret();
    const signedIn = await stage.signIn(
        stage.base, seeded.username, seeded.password, verifier,
    );
    assertEquals(signedIn.identityId, ORGANIZATION_ADMIN_ID);
    assertEquals(signedIn.exchanges.length, 2);
    const held = (secret: unknown): boolean =>
        typeof secret === 'string'
        && signedIn.secrets.includes(secret);
    for (const exchange of signedIn.exchanges) {
        assertEquals(exchange.response.status, 200);
        const authorization = valueOf(
            exchange.request.headers, 'authorization',
        );
        assertEquals(authorization.startsWith('Basic '), true);
        assertEquals(
            held(authorization.slice('Basic '.length)), true,
        );
    }
    const [authorized, granted] = signedIn.exchanges;
    assertEquals(held(seeded.password), true);
    assertEquals(held(verifier), true);
    assertEquals(
        held(documentOf(authorized!.request.body).code_challenge),
        true,
    );
    assertEquals(
        held(authParam(
            valueOf(
                authorized!.response.headers,
                'authentication-info',
            ),
            'code',
        )),
        true,
    );
    assertEquals(held(signedIn.bearer), true);
    assertEquals(
        authParam(
            valueOf(
                granted!.response.headers, 'authentication-info',
            ),
            'access_token',
        ) === signedIn.bearer,
        true,
    );
    const cookie = valueOf(granted!.response.headers, 'set-cookie');
    assertEquals(
        signedIn.secrets.some((secret) =>
            cookie.startsWith('refresh_token=' + secret + ';')
        ),
        true,
    );
});

// The generator loads no test preload, so nothing but the
// stage registers the hasher the gate rehashes a signed-in
// password with.
Deno.test("the stage registers the gate's hasher", async () => {
    setPasswordHasher(null);
    try {
        const stage = await openReplayStage();
        const signedIn = await signInOrganizationAdmin(stage);
        assertEquals(signedIn.identityId, ORGANIZATION_ADMIN_ID);
    } finally {
        // What the suite's preload registered.
        setPasswordHasher(testHashPassword);
    }
});

Deno.test('a read is recorded whole', async () => {
    const stage = await openReplayStage();
    const { bearer } = await signInOrganizationAdmin(stage);
    const sent = readOf(ORGANIZATION, bearer);
    const exchange = await stage.send(stage.copy(), sent);
    assertEquals(exchange.response.status, 200);
    assertEquals(exchange.request.method, sent.method);
    assertEquals(exchange.request.target, sent.target);
    assertEquals(exchange.request.body, '');
    assertEquals(
        namesOf(exchange.request.headers),
        ['authorization', 'operation-id'],
    );
    assertEquals(
        isIdentifier(
            valueOf(exchange.request.headers, 'operation-id'),
        ),
        true,
    );
    const answered = namesOf(exchange.response.headers);
    assertEquals(answered.includes('etag'), true);
    assertEquals(answered.includes('cache-control'), true);
    assertEquals(idOf(exchange.response.body), STARK_ORGANIZATION);
});

Deno.test(
    'a write on a copy leaves the base unchanged',
    async () => {
        const stage = await openReplayStage();
        const { bearer } = await signInOrganizationAdmin(stage);
        const copy = stage.copy();
        const { target, before, body, written } =
            await renameFirstFlow(stage, copy, bearer);
        assertEquals(written.response.status, 200);
        assertEquals(namesOf(written.request.headers), [
            'authorization',
            'if-match',
            'content-type',
            'operation-id',
            'content-length',
        ]);
        assertEquals(
            valueOf(written.request.headers, 'content-length'),
            octetLengthOf(body),
        );
        const etag = valueOf(before.response.headers, 'etag');
        const writtenEtag = valueOf(
            written.response.headers, 'etag',
        );
        assertNotEquals(writtenEtag, etag);
        const onBase = await stage.send(
            stage.base, readOf(target, bearer),
        );
        assertEquals(
            valueOf(onBase.response.headers, 'etag'), etag,
        );
        assertEquals(onBase.response.body, before.response.body);
        const onCopy = await stage.send(
            copy, readOf(target, bearer),
        );
        assertEquals(
            valueOf(onCopy.response.headers, 'etag'),
            writtenEtag,
        );
        assertEquals(
            documentOf(onCopy.response.body).name, FLOW_NAME,
        );
    },
);

Deno.test("a collection's parts are parsed", async () => {
    const stage = await openReplayStage();
    const { bearer } = await signInOrganizationAdmin(stage);
    const copy = stage.copy();
    await renameFirstFlow(stage, copy, bearer);
    const listing = await stage.send(copy, readOf(FLOWS, bearer));
    const parts = partsOf(listing.response);
    assertEquals(parts.length >= 1, true);
    for (const part of parts) {
        assertEquals(part.status, 200);
        assertEquals(namesOf(part.headers).includes('etag'), true);
        assertEquals(
            valueOf(part.headers, 'content-length'),
            octetLengthOf(part.body),
        );
        assertEquals(isIdentifier(idOf(part.body)), true);
    }
    assertEquals(
        parts.filter(
            (part) => documentOf(part.body).name === FLOW_NAME,
        ).length,
        1,
    );
    const document = await stage.send(
        copy, readOf(ORGANIZATION, bearer),
    );
    assertEquals(partsOf(document.response), []);
});

Deno.test('the server applies the same API defaults', () => {
    const bare = withApiResponseDefaults(new Response(null));
    assertEquals(bare.headers.get('cache-control'), 'no-store');
    const kept = withApiResponseDefaults(new Response(null, {
        headers: { 'cache-control': 'max-age=60' },
    }));
    assertEquals(kept.headers.get('cache-control'), 'max-age=60');
});
