// The guided start (spec, The guided start; plan D20 to
// D22): six steps, each a sentence or two, the shell
// lines a reader runs, and one replayed sample. Steps 1 to
// 5 run as the story member and step 6 as the
// organization admin, each on a copy of its own. Every
// call a step makes is shown, and every one must succeed:
// a refusal fails the run.
//
// Shell lines are POSIX sh with openssl, and a test runs
// each one.

import {
    ASSERTION_ALGORITHMS,
    ASSERTION_CLAIMS,
} from '../../api/client-assertion.ts';
import { routes } from '../../api/routes.ts';
import {
    base64UrlEncode,
    bytesToBase64Url,
} from '../../shared/base64url.ts';
import { generateIdentifier } from '../../shared/identifier.ts';
import { generateSecret } from '../../shared/secret.ts';
import { nowEpochSeconds } from '../../shared/types.ts';
import type {
    ApiDocPathId,
    ApiDocSample,
} from '../api-documentation/shapes.ts';
import {
    KEPT_PARTS,
    sampleOf,
    type SecretLedger,
    type Sent,
} from './api-documentation-exchange.ts';
import {
    CLIENT_CREDENTIALS,
    type ReplayStage,
    succeeded,
    TOKEN_TARGET,
} from './api-documentation-replay.ts';
import {
    type Cast,
    documentOf,
    draftOf,
    endpointsOf,
    type PlannedReplay,
    planOf,
    registrationPutOf,
    sendPlan,
    serviceCreationOf,
    servicePathIdOf,
    writeRequestOf,
} from './api-documentation-story.ts';

export interface StepPlan {
    readonly slug: string;
    readonly title: string;
    readonly prose: readonly string[];
    readonly shell: readonly string[];
}

// A step's sample is filed under this hash prefix and the
// step's slug (plan D7).
const START = 'start/';

const AUTHORIZATION = 'authorization';
const BEARER_SCHEME = 'Bearer ';
const CONTENT_TYPE = 'content-type';
const JSON_MEDIA_TYPE = 'application/json';
const IF_MATCH = 'if-match';
const ETAG = 'etag';

// The reads steps 2 to 5 replay, as the story fills them.
const DEFAULT_ORGANIZATION_READ =
    'get/identities/id/default-organization';
const ORGANIZATION_READ = 'get/organizations/id';
const FLOWS_READ = 'get/organizations/id/flows';
const FLOW_READ = 'get/organizations/id/flows/id';

// Step 6's key: ECDSA on P-256, the curve ES256 names
// (RFC 7518 §3.4). WebCrypto signs it as JWS wants, r then
// s.
const ES256 = 'ES256';
const KEY_ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' };
const SIGN_ALGORITHM = { name: 'ECDSA', hash: 'SHA-256' };
// How long the assertion step 6 signs stays valid.
const ASSERTION_LIFETIME_SECONDS = 300;

// openssl's base64 on one line, made base64url (RFC 4648
// §5) and unpadded.
const BASE64URL_PIPE = "openssl base64 -A | tr '+/' '-_' | tr -d '='";
// RFC 7636 §4.1: 32 random bytes make a 43-character
// verifier.
const VERIFIER_LINE = 'VERIFIER=$(openssl rand 32 | '
    + BASE64URL_PIPE + ')';
// RFC 7636 §4.2: S256 is the base64url SHA-256 of the
// verifier.
const CHALLENGE_LINE = 'CHALLENGE=$(printf \'%s\' "$VERIFIER"'
    + ' | openssl dgst -sha256 -binary | ' + BASE64URL_PIPE + ')';
// shared/identifier.ts: 16 random bytes in base64url.
const OPERATION_ID_LINE = 'OPERATION_ID=$(openssl rand 16 | '
    + BASE64URL_PIPE + ')';

// The named parameter of the authentication-info line in
// a call's output on standard input. The server quotes
// each parameter's value.
function authenticationInfoLineOf(
    variable: string,
    parameter: string,
): string {
    return variable + "=$(grep -i '^authentication-info:'"
        + " | sed 's/.*" + parameter + '="\\([^"]*\\)".*/\\1/\')';
}

const CODE_LINE = authenticationInfoLineOf('CODE', 'code');
const TOKEN_LINE = authenticationInfoLineOf('TOKEN', 'access_token');
// The whole validator, quotes included (plan D9).
const ETAG_LINE = "ETAG=$(grep -i '^etag:'"
    + " | sed 's/^[^:]*: *//' | tr -d '\\r')";

export const STEPS: readonly StepPlan[] = [
    {
        slug: 'sign-in',
        title: 'Sign in',
        prose: [
            'Sign in with your username and password in two'
                + ' calls. Before the first, make a verifier and'
                + ' its S256 challenge. The first call sends your'
                + ' username and password under Basic, with the'
                + ' challenge, and answers a code in'
                + ' Authentication-Info. The second sends the code'
                + ' and the verifier under Basic, and answers your'
                + ' access token in Authentication-Info and a'
                + ' refresh cookie.',
            'Every call needs an Operation-ID of its own: run the'
                + ' first line before each call. Step 2 says why.',
            'A line that reads an answer reads the call\'s'
                + ' output, headers included, on its standard'
                + ' input. Save the output with curl … > answer.txt,'
                + ' then run the line as { LINE; } < answer.txt.',
            'Send the token on every other call as'
                + ' Authorization: Bearer $TOKEN. The answer\'s'
                + ' expires_in says for how many seconds it serves.',
        ],
        shell: [
            OPERATION_ID_LINE, VERIFIER_LINE, CHALLENGE_LINE, CODE_LINE,
            TOKEN_LINE,
        ],
    },
    // The transport headers, the headers curl adds, and the
    // answers any request may get are stated once, as
    // catalog constants of their own (API_DOC_TRANSPORT,
    // API_DOC_CURL_ADDS, API_DOC_GENERIC_ANSWERS), so this
    // prose repeats none of them. It keeps the framing,
    // which no constant holds.
    {
        slug: 'operation-id',
        title: 'Every request needs an Operation-ID',
        prose: [
            'Send a fresh Operation-ID on every request: 16'
                + ' random bytes in base64url, 22 characters. A'
                + ' write that changes a document carries it back'
                + ' in its answer. A read\'s answer, and a write\'s'
                + ' that changes nothing, name the Operation-ID of'
                + ' the write that made the document.',
            'This call reads the organization your identity'
                + ' opens by default; the next step reads it.',
            'A sample shows what the API answered, with the'
                + ' server\'s defaults. The HTTP layer frames the'
                + ' answer on the wire: it sets content-length, and'
                + ' adds date where the answer has none.',
        ],
        shell: [OPERATION_ID_LINE],
    },
    {
        slug: 'read',
        title: 'Read your organization',
        prose: [
            'A read of one document answers it as JSON, with'
                + ' the ETag that names this version of it.',
        ],
        shell: [],
    },
    {
        slug: 'list',
        title: 'List its flows',
        prose: [
            'A read of a collection answers multipart/mixed: one'
                + ' part per document, each the answer a read of'
                + ' that document gives, with its own status line,'
                + ' headers, ETag, and body.',
            'This sample shows the first ' + KEPT_PARTS + ' parts'
                + ' and counts the rest.',
        ],
        shell: [],
    },
    {
        slug: 'change',
        title: 'Change one',
        prose: [
            'Read the flow and keep its ETag. Write it back with'
                + ' one change, its name, under If-Match: that'
                + ' ETag. The write lands only on the version you'
                + ' read: if another landed first, the answer is'
                + ' 412, and you read again. The answer names the'
                + ' new version\'s ETag.',
        ],
        shell: [ETAG_LINE],
    },
    {
        slug: 'unattended',
        title: 'Going unattended',
        prose: [
            'A program that runs with no person signs in as a'
                + ' service, with a key of its own. This step needs'
                + ' an organization admin: one creates the service'
                + ' and registers its public key. The service then'
                + ' signs an assertion with its private key and'
                + ' exchanges it for an access token, under'
                + ' grant_type ' + CLIENT_CREDENTIALS + '.',
            'Register your own key: put its public coordinates,'
                + ' in base64url, where the registration shows'
                + ' $JWK_X and $JWK_Y. Sign the assertion with a'
                + ' JOSE library. This guide stops at what the'
                + ' assertion carries: no single openssl command'
                + ' makes an ES256 signature in the form JWS'
                + ' needs.',
            'The assertion is signed with '
                + ASSERTION_ALGORITHMS.join(' or ') + '.',
            'Its claims:',
            ...ASSERTION_CLAIMS.map(({ name, rule, required }) =>
                name + ' (' + (required ? 'required' : 'optional')
                    + '): ' + rule + '.'),
            'Send it as Authorization: Bearer $CLIENT_ASSERTION,'
                + ' with the service\'s id as client_id in the body.'
                + ' The answer\'s access token is the service\'s'
                + ' $TOKEN.',
        ],
        shell: [],
    },
];

interface StepReplay {
    readonly pathIds: readonly ApiDocPathId[];
    readonly sent: readonly Sent[];
}

type StepReplayer = (
    cast: Cast,
    stage: ReplayStage,
) => Promise<StepReplay>;

const REPLAYERS: ReadonlyMap<string, StepReplayer> = new Map([
    ['sign-in', signInStep],
    ['operation-id', readStep(DEFAULT_ORGANIZATION_READ)],
    ['read', readStep(ORGANIZATION_READ)],
    ['list', readStep(FLOWS_READ)],
    ['change', changeStep],
    ['unattended', unattendedStep],
]);

export async function replayStep(
    slug: string,
    cast: Cast,
    stage: ReplayStage,
    ledger: SecretLedger,
): Promise<ApiDocSample> {
    const replayer = REPLAYERS.get(slug);
    if (replayer === undefined) {
        throw new Error('no step of the guided start is ' + slug);
    }
    const { pathIds, sent } = await replayer(cast, stage);
    return sampleOf(START + slug, pathIds, sent, ledger);
}

// The story member's password sign-in, its two calls.
async function signInStep(
    cast: Cast,
    stage: ReplayStage,
): Promise<StepReplay> {
    const seeded = stage.credentials.identities.find(
        (identity) => identity.identityId === cast.member.identityId,
    );
    if (seeded === undefined) {
        throw new Error('the seed holds no sign-in for the member');
    }
    const signedIn = await stage.signIn(
        stage.copy(), seeded.username, seeded.password,
        generateSecret(),
    );
    return {
        pathIds: [],
        sent: signedIn.exchanges.map((exchange) => ({
            caller: 'none', exchange: succeeded(exchange),
        })),
    };
}

// A read the story plans, sent by the member.
async function memberReadOf(
    hash: string,
    cast: Cast,
    stage: ReplayStage,
): Promise<PlannedReplay> {
    const endpoint = endpointsOf(routes).find(
        (candidate) => candidate.hash === hash,
    );
    if (endpoint === undefined) {
        throw new Error('the route table offers no ' + hash);
    }
    const plan = await planOf(endpoint, cast, stage);
    if (plan.kind !== 'replay') {
        throw new Error(hash + ' has no sample: ' + plan.reason);
    }
    if (plan.caller !== 'member') {
        throw new Error(hash + ' is not the member\'s to read');
    }
    return plan;
}

function readStep(hash: string): StepReplayer {
    return async (cast, stage) => {
        const plan = await memberReadOf(hash, cast, stage);
        const exchange = await sendPlan(
            stage, plan, (request) => request,
        );
        return {
            pathIds: plan.pathIds,
            sent: [{ caller: plan.caller, exchange: succeeded(exchange) }],
        };
    };
}

// The story flow read, then written back renamed under
// the validator the read answered, on one copy.
async function changeStep(
    cast: Cast,
    stage: ReplayStage,
): Promise<StepReplay> {
    const plan = await memberReadOf(FLOW_READ, cast, stage);
    if (plan.setup.length > 0 || plan.latch.kind !== 'unlatched') {
        throw new Error(FLOW_READ + ' is no read the member sends'
            + ' alone');
    }
    const on = stage.copy();
    const read = succeeded(await stage.send(on, plan.request));
    const etag = read.response.headers.find(([name]) => name === ETAG);
    if (etag === undefined) {
        throw new Error(FLOW_READ + ' answered no ' + ETAG);
    }
    const write = succeeded(await stage.send(on, writeRequestOf(
        'PUT', plan.request.target, cast.member, [[IF_MATCH, etag[1]]],
        draftOf(documentOf(read.response.body)),
    )));
    return {
        pathIds: plan.pathIds,
        sent: [
            { caller: plan.caller, exchange: read },
            { caller: plan.caller, exchange: write },
        ],
    };
}

// The organization admin creates a service and registers
// a key made fresh for this run (plan D21); the service
// exchanges an assertion signed with it for a token.
async function unattendedStep(
    cast: Cast,
    stage: ReplayStage,
): Promise<StepReplay> {
    const organization = await memberReadOf(
        ORGANIZATION_READ, cast, stage,
    );
    const pair = await crypto.subtle.generateKey(
        KEY_ALGORITHM, false, ['sign', 'verify'],
    );
    const { kty, crv, x, y } = await crypto.subtle.exportKey(
        'jwk', pair.publicKey,
    );
    const serviceId = generateIdentifier();
    const on = stage.copy();
    const created = succeeded(await stage.send(
        on, serviceCreationOf(cast.admin, serviceId),
    ));
    const registered = succeeded(await stage.send(
        on, registrationPutOf(
            cast.admin, serviceId,
            JSON.stringify({ keys: [{ kty, crv, x, y }] }),
        ),
    ));
    const audience = documentOf(registered.response.body)['aud'];
    if (typeof audience !== 'string') {
        throw new Error('the registration names no audience');
    }
    const assertion = await assertionOf(pair.privateKey, {
        iss: serviceId,
        sub: serviceId,
        aud: audience,
        exp: nowEpochSeconds() + ASSERTION_LIFETIME_SECONDS,
        jti: generateIdentifier(),
    });
    const exchanged = succeeded(await stage.send(on, {
        method: 'POST',
        target: TOKEN_TARGET,
        headers: [
            [AUTHORIZATION, BEARER_SCHEME + assertion],
            [CONTENT_TYPE, JSON_MEDIA_TYPE],
        ],
        body: JSON.stringify({
            grant_type: CLIENT_CREDENTIALS,
            client_id: serviceId,
        }),
    }));
    return {
        pathIds: [...organization.pathIds, servicePathIdOf(serviceId)],
        sent: [
            { caller: 'admin', exchange: created },
            { caller: 'admin', exchange: registered },
            { caller: 'none', exchange: exchanged },
        ],
    };
}

// RFC 7515 §7.1: a compact JWS, signed ES256.
async function assertionOf(
    key: CryptoKey,
    claims: Readonly<Record<string, unknown>>,
): Promise<string> {
    const signed = base64UrlEncode(JSON.stringify({ alg: ES256 }))
        + '.' + base64UrlEncode(JSON.stringify(claims));
    const signature = await crypto.subtle.sign(
        SIGN_ALGORITHM, key, new TextEncoder().encode(signed),
    );
    return signed + '.' + bytesToBase64Url(new Uint8Array(signature));
}
