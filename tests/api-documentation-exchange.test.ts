import { assertEquals, assertThrows } from '@std/assert';
import { routes } from '../api/routes.ts';
import {
    boundaryOf,
    joinParts,
    splitParts,
} from '../shared/http-message/multipart.ts';
import { Octets } from '../shared/http-message/octets.ts';
import { generateSecret } from '../shared/secret.ts';
import type {
    ApiDocHeaderLine,
    ApiDocRequest,
    ApiDocSample,
} from '../web-app/api-documentation/shapes.ts';
import { readSample } from '../web-app/api-documentation/shapes.ts';
import {
    credentialFindingsOf,
} from '../web-app/app/api-documentation-credentials.ts';
import {
    CURL_ADDS,
    curlOf,
    SecretLedger,
    sampleOf,
} from '../web-app/app/api-documentation-exchange.ts';
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
    endpointsOf,
    planOf,
    type ReplayPlan,
    sendPlan,
} from '../web-app/app/api-documentation-story.ts';

// Every assertion on a credential compares a boolean or a
// finding (a kind and an offset), so a failure never
// prints one.

const ENDPOINTS = endpointsOf(routes);
const FLOWS_HASH = 'get/organizations/id/flows';
const FLOW_PUT_HASH = 'put/organizations/id/flows/id';
// A listing of more than RECORDED_PARTS documents.
const PROJECTS_HASH = 'get/organizations/id/projects';
// Outside ASCII, so its octets outnumber its characters.
const FLOW_NAME = 'Café — ünïcode';
const RECORDED_PARTS = 5;
// RFC 9110 §15.3: the successful class is 2xx.
const SUCCESSFUL_FROM = 200;
const SUCCESSFUL_BELOW = 300;

// Every endpoint whose exchange carries a credential the
// sign-in did not: a fresh code and challenge, a fresh
// token and refresh cookie, a credential's secret, and the
// reads of a credential and a token.
const CREDENTIAL_HASHES: readonly string[] = [
    'post/authentication/authorize',
    'post/authentication/token',
    'post/identities/id/tokens/jti/rotation',
    'post/identities/id/tokens/jti/revocation',
    'put/identities/id/credentials/cid',
    'get/identities/id/credentials/cid',
    'get/identities/id/tokens/jti',
    'put/identities/id/token-revocations/rid',
];

type Replay = Extract<ReplayPlan, { readonly kind: 'replay' }>;

function namesOf(headers: readonly ApiDocHeaderLine[]): string[] {
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

function sampleJsonOf(sample: ApiDocSample): string {
    return JSON.stringify(sample, null, 2) + '\n';
}

async function replayOf(
    stage: ReplayStage,
    cast: Cast,
    hash: string,
): Promise<Replay> {
    const endpoint = ENDPOINTS.find((held) => held.hash === hash);
    if (endpoint === undefined) throw new Error('no endpoint ' + hash);
    const plan = await planOf(endpoint, cast, stage);
    if (plan.kind !== 'replay') {
        throw new Error(hash + ' has no replay: ' + plan.reason);
    }
    return plan;
}

// The plan sent on a copy of its own, as `transform` leaves
// its request; the answer must succeed.
async function replayed(
    stage: ReplayStage,
    plan: Replay,
    hash: string,
    transform: (request: ReplayRequest) => ReplayRequest,
): Promise<RecordedExchange> {
    const exchange = await sendPlan(stage, plan, transform);
    const { status } = exchange.response;
    assertEquals(
        status >= SUCCESSFUL_FROM && status < SUCCESSFUL_BELOW,
        true,
        hash + ' answered ' + status,
    );
    return exchange;
}

function sampleOfOne(
    hash: string,
    plan: Replay,
    exchange: RecordedExchange,
    ledger: SecretLedger,
): ApiDocSample {
    return sampleOf(
        hash, plan.pathIds, [{ caller: plan.caller, exchange }], ledger,
    );
}

function onlyExchangeOf(sample: ApiDocSample) {
    const [exchange] = sample.exchanges;
    if (exchange === undefined || sample.exchanges.length !== 1) {
        throw new Error('the sample holds not one exchange');
    }
    return exchange;
}

function renamed(request: ReplayRequest): ReplayRequest {
    const document: unknown = JSON.parse(request.body);
    if (typeof document !== 'object' || document === null) {
        throw new Error('the body is not a document');
    }
    return {
        ...request,
        body: JSON.stringify({ ...document, name: FLOW_NAME }),
    };
}

// The `-d` argument as the curl text writes it.
function dataArgumentOf(curl: string): string {
    const flag = ' -d ';
    const at = curl.lastIndexOf(flag);
    if (at < 0) throw new Error('the curl sends no body');
    return curl.slice(at + flag.length);
}

// The listing's response with only its first `count`
// parts, as a recorded body: text, split as Latin-1 the
// way the replay frames it.
function firstPartsOf(
    exchange: RecordedExchange,
    count: number,
): RecordedExchange {
    const contentType = valueOf(exchange.response.headers, 'content-type');
    const octets = Octets.fromBytes(
        new TextEncoder().encode(exchange.response.body),
    );
    const wires = splitParts(contentType, octets.toLatin1());
    assertEquals(wires.length >= count, true);
    const joined = joinParts(wires.slice(0, count), boundaryOf(contentType));
    return {
        request: exchange.request,
        response: {
            ...exchange.response,
            body: new TextDecoder('utf-8', { fatal: true })
                .decode(Octets.fromLatin1(joined).asBytes()),
        },
    };
}

Deno.test(
    'the curl text names the method, path, every header, and the body',
    async () => {
        const stage = await openReplayStage();
        const cast = await castOf(stage);
        const plan = await replayOf(stage, cast, FLOW_PUT_HASH);
        const exchange = await replayed(
            stage, plan, FLOW_PUT_HASH, (request) => request,
        );
        assertEquals(namesOf(exchange.request.headers), [
            'authorization',
            'content-type',
            'if-match',
            'operation-id',
            'content-length',
        ]);
        const { request, curl } = onlyExchangeOf(sampleOfOne(
            FLOW_PUT_HASH, plan, exchange, new SecretLedger(),
        ));
        assertEquals(curl.startsWith('curl -i -X PUT '), true);
        assertEquals(
            curl.includes('"$ORIGIN' + exchange.request.target + '"'),
            true,
        );
        for (const [name] of request.headers) {
            assertEquals(
                curl.includes('-H "' + name + ': '),
                !CURL_ADDS.includes(name),
                name,
            );
        }
        assertEquals(curl.includes('-H "if-match: $ETAG"'), true);
        assertEquals(
            curl.includes('-H "authorization: Bearer $TOKEN"'), true,
        );
        assertEquals(
            curl.includes('-H "operation-id: $OPERATION_ID"'), true,
        );
        assertEquals(
            dataArgumentOf(curl),
            "'" + exchange.request.body.replaceAll("'", "'\\''") + "'",
        );
        assertEquals(curl.includes('content-length'), false);
        assertEquals(curl.includes(cast.admin.bearer), false);
        assertEquals(curl.includes(cast.member.bearer), false);
    },
);

Deno.test('a stored sample keeps every header sent and received',
    async () => {
        const stage = await openReplayStage();
        const cast = await castOf(stage);
        const plan = await replayOf(stage, cast, FLOW_PUT_HASH);
        const exchange = await replayed(
            stage, plan, FLOW_PUT_HASH, (request) => request,
        );
        const shown = onlyExchangeOf(sampleOfOne(
            FLOW_PUT_HASH, plan, exchange, new SecretLedger(),
        ));
        assertEquals(
            namesOf(shown.request.headers),
            namesOf(exchange.request.headers),
        );
        assertEquals(
            namesOf(shown.response.headers),
            namesOf(exchange.response.headers),
        );
        assertEquals(
            namesOf(shown.request.headers).includes('content-length'),
            true,
        );
        assertEquals(
            namesOf(shown.response.headers).includes('content-length'),
            true,
        );
    });

Deno.test('credentials become placeholders in both directions',
    async () => {
        const stage = await openReplayStage();
        const seeded = stage.credentials.identities[0];
        if (seeded === undefined) throw new Error('no seeded sign-in');
        const signedIn = await stage.signIn(
            stage.copy(), seeded.username, seeded.password,
            generateSecret(),
        );
        const ledger = new SecretLedger();
        const signInJson = sampleJsonOf(sampleOf(
            'start/sign-in',
            [],
            signedIn.exchanges.map((exchange) => ({
                caller: 'none' as const, exchange,
            })),
            ledger,
        ));
        for (const placeholder of ['$TOKEN', '$CODE', '$REFRESH_TOKEN']) {
            assertEquals(signInJson.includes(placeholder), true, placeholder);
        }
        for (const secret of signedIn.secrets) {
            assertEquals(signInJson.includes(secret), false);
        }
        assertEquals(credentialFindingsOf(signInJson, ledger.known()), []);
        assertEquals(
            credentialFindingsOf(signInJson, signedIn.secrets), [],
        );
        const cast = await castOf(stage);
        let json = signInJson;
        for (const hash of CREDENTIAL_HASHES) {
            const plan = await replayOf(stage, cast, hash);
            const exchange = await replayed(
                stage, plan, hash, (request) => request,
            );
            json += sampleJsonOf(sampleOfOne(hash, plan, exchange, ledger));
        }
        assertEquals(credentialFindingsOf(json, ledger.known()), []);
        assertEquals(
            credentialFindingsOf(json, [
                ...signedIn.secrets,
                ...cast.member.secrets,
                ...cast.admin.secrets,
            ]),
            [],
        );
    });

Deno.test('an unmapped credential parameter fails closed', () => {
    const planted = 'planted-parameter-value';
    const exchange: RecordedExchange = {
        request: {
            method: 'GET',
            target: '/api/organizations/',
            headers: [['operation-id', 'Aw9cXL2nQdW9Sb0rZ6aQcA']],
            body: '',
        },
        response: {
            status: 200,
            headers: [['authentication-info', 'secret_x="' + planted + '"']],
            body: '',
        },
    };
    const error = assertThrows(() =>
        sampleOf('get/organizations', [], [{
            caller: 'member', exchange,
        }], new SecretLedger())
    );
    if (!(error instanceof Error)) throw error;
    assertEquals(error.message.includes('authentication-info'), true);
    assertEquals(error.message.includes('secret_x'), true);
    assertEquals(error.message.includes(planted), false);
});

Deno.test('a parameter not shaped as a name is not printed', () => {
    // Mixed case and 22 characters: the shape of a credential.
    const planted = 'PlantedMixedCaseValue1';
    const exchange: RecordedExchange = {
        request: {
            method: 'GET',
            target: '/api/organizations/',
            headers: [['operation-id', 'Aw9cXL2nQdW9Sb0rZ6aQcA']],
            body: '',
        },
        response: {
            status: 200,
            headers: [['authentication-info', planted + '="x"']],
            body: '',
        },
    };
    const error = assertThrows(() =>
        sampleOf('get/organizations', [], [{
            caller: 'member', exchange,
        }], new SecretLedger())
    );
    if (!(error instanceof Error)) throw error;
    assertEquals(error.message.includes('authentication-info'), true);
    assertEquals(error.message.includes(planted), false);
});

Deno.test('a malformed authorization names no credential', () => {
    const planted = 'planted-credential-first-word';
    const exchange: RecordedExchange = {
        request: {
            method: 'GET',
            target: '/api/organizations/',
            headers: [
                ['authorization', planted + ' trailing'],
                ['operation-id', 'Aw9cXL2nQdW9Sb0rZ6aQcA'],
            ],
            body: '',
        },
        response: { status: 200, headers: [], body: '' },
    };
    const error = assertThrows(() =>
        sampleOf('get/organizations', [], [{
            caller: 'member', exchange,
        }], new SecretLedger())
    );
    if (!(error instanceof Error)) throw error;
    assertEquals(error.message.includes('authorization'), true);
    assertEquals(error.message.includes(planted), false);
});

Deno.test('a malformed JSON body names none of its text', () => {
    // Short enough that V8's parse error quotes it whole.
    const planted = 'planted-secret-value';
    const exchange: RecordedExchange = {
        request: {
            method: 'PUT',
            target: '/api/organizations/a/flows/b',
            headers: [
                ['content-type', 'application/json'],
                ['operation-id', 'Aw9cXL2nQdW9Sb0rZ6aQcA'],
            ],
            body: planted,
        },
        response: { status: 200, headers: [], body: '' },
    };
    const error = assertThrows(() =>
        sampleOf('put/organizations/id/flows/id', [], [{
            caller: 'member', exchange,
        }], new SecretLedger())
    );
    if (!(error instanceof Error)) throw error;
    assertEquals(error.message.includes(planted), false);
});

Deno.test('a collection keeps two parts and counts the rest',
    async () => {
        const stage = await openReplayStage();
        const cast = await castOf(stage);
        const plan = await replayOf(stage, cast, PROJECTS_HASH);
        const recorded = firstPartsOf(
            await replayed(
                stage, plan, PROJECTS_HASH, (request) => request,
            ),
            RECORDED_PARTS,
        );
        const recordedParts = partsOf(recorded.response);
        assertEquals(recordedParts.length, RECORDED_PARTS);
        const { body } = onlyExchangeOf(sampleOfOne(
            PROJECTS_HASH, plan, recorded, new SecretLedger(),
        )).response;
        if (body.kind !== 'multipart') {
            throw new Error('the listing is not multipart');
        }
        assertEquals(body.parts.length, 2);
        assertEquals(body.more, 3);
        assertEquals(
            body.boundary,
            boundaryOf(valueOf(recorded.response.headers, 'content-type')),
        );
        for (const [index, part] of body.parts.entries()) {
            const sent = recordedParts[index]!;
            assertEquals(part.status, sent.status);
            assertEquals(part.headers, sent.headers);
            assertEquals(part.body, {
                kind: 'text',
                mediaType: 'application/json',
                text: sent.body,
            });
        }
    });

Deno.test('a single quote in a body survives the shell', async () => {
    const text = '{"title":"Owner\'s review"}';
    const request: ApiDocRequest = {
        method: 'PUT',
        target: '/api/organizations/a/flows/b',
        headers: [['content-type', 'application/json']],
        body: { kind: 'text', mediaType: 'application/json', text },
    };
    const output = await new Deno.Command('sh', {
        args: ['-c', 'printf %s ' + dataArgumentOf(curlOf(request))],
        stdout: 'piped',
        stderr: 'piped',
    }).output();
    assertEquals(new TextDecoder().decode(output.stderr), '');
    assertEquals(output.code, 0);
    assertEquals(new TextDecoder().decode(output.stdout), text);
});

Deno.test('non-ASCII text survives', async () => {
    const stage = await openReplayStage();
    const cast = await castOf(stage);
    const plan = await replayOf(stage, cast, FLOW_PUT_HASH);
    const exchange = await replayed(stage, plan, FLOW_PUT_HASH, renamed);
    const sample = sampleOfOne(
        FLOW_PUT_HASH, plan, exchange, new SecretLedger(),
    );
    const { body } = onlyExchangeOf(sample).request;
    if (body.kind !== 'text') throw new Error('the PUT sends no text');
    assertEquals(body.text, exchange.request.body);
    assertEquals(body.text.includes(FLOW_NAME), true);
    assertEquals(sampleJsonOf(sample).includes(FLOW_NAME), true);
});

Deno.test('a sample reads back', async () => {
    const stage = await openReplayStage();
    const cast = await castOf(stage);
    const plan = await replayOf(stage, cast, FLOWS_HASH);
    const exchange = await replayed(
        stage, plan, FLOWS_HASH, (request) => request,
    );
    const sample = sampleOfOne(
        FLOWS_HASH, plan, exchange, new SecretLedger(),
    );
    const read = readSample(JSON.parse(JSON.stringify(sample)));
    assertEquals(read.kind, 'sample');
    if (read.kind !== 'sample') return;
    assertEquals(read.sample, sample);
});

Deno.test('a body that already names a placeholder fails closed', () => {
    // Its curl would expand the reader's own $TOKEN.
    const planted = 'paid with $TOKEN';
    const exchange: RecordedExchange = {
        request: {
            method: 'PUT',
            target: '/api/organizations/a/flows/b',
            headers: [
                ['content-type', 'application/json'],
                ['operation-id', 'Aw9cXL2nQdW9Sb0rZ6aQcA'],
            ],
            body: JSON.stringify({ name: planted }),
        },
        response: { status: 200, headers: [], body: '' },
    };
    const error = assertThrows(() =>
        sampleOf('put/organizations/id/flows/id', [], [{
            caller: 'member', exchange,
        }], new SecretLedger())
    );
    if (!(error instanceof Error)) throw error;
    assertEquals(error.message.includes('placeholder'), true);
    assertEquals(error.message.includes(planted), false);
});
