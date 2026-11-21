// The documentation's replay (spec, Replay): the mock seed
// on a memory backend, and requests sent to the gate in
// process, each recorded whole. A sample is replayed,
// never typed, so what one shows is what the API answered,
// with the defaults the server places on an answer under
// /api (plan D5). The API reports the example commit, so a
// status sample does not move with each commit.
//
// Every replay runs on its own copy of the base state,
// taken after the sign-ins, so a sample depends only on
// the seeded rows and those sign-ins (plan D4).
//
// Nothing here reads the environment or sets a timer. The
// generator runs this under pins that leave a fake clock
// installed, where a timer would never fire.

import { requestHandlerFor } from '../../api/api.ts';
import { isSystemStatusPath } from '../../api/system-status.ts';
import { EXAMPLE_COMMIT } from
    '../../api/http-status-documents.ts';
import type { GrantType } from '../../api/authentication.ts';
import { MemoryStorageBackend } from
    '../../api/backend-memory.ts';
import type { BackedDbAdapter } from '../../api/db-backed.ts';
import { memoryDbAdapterOver } from '../../api/db-memory.ts';
import { postSeedLanding } from '../../api/ledger-seed.ts';
import {
    rehearseMockData,
    type SeededCredentials,
} from '../../api/mock-data.ts';
import { throwawayPasswordHash } from
    '../../api/mock-data/throwaway-password-hash.ts';
import {
    authParam,
    basicAuthorization,
} from '../../client/authentication.ts';
import { withApiResponseDefaults } from
    '../../server/http-server.ts';
import { principalFromToken } from
    '../../shared/access-token-decode.ts';
import { bytesToBase64Url } from '../../shared/base64url.ts';
import { sha256Bytes } from '../../shared/digest.ts';
import { CONTENT_LENGTH } from
    '../../shared/http-message/framing.ts';
import {
    MULTIPART_MIXED,
    splitParts,
} from '../../shared/http-message/multipart.ts';
import { Octets } from '../../shared/http-message/octets.ts';
import { parseWire } from
    '../../shared/http-message/wire-codec.ts';
import { generateIdentifier } from '../../shared/identifier.ts';
import { OPERATION_ID_HEADER } from
    '../../shared/message-id-fields.ts';
import { setPasswordHasher } from
    '../../shared/password-hash.ts';
import type {
    ApiDocHeaderLine,
} from '../api-documentation/shapes.ts';

export interface ReplayRequest {
    readonly method: string;
    // The '/api/…' path and query.
    readonly target: string;
    readonly headers: readonly ApiDocHeaderLine[];
    // '' is no body.
    readonly body: string;
}

export interface RecordedResponse {
    readonly status: number;
    readonly headers: readonly ApiDocHeaderLine[];
    readonly body: string;
}

export interface RecordedExchange {
    // As sent: the caller's headers, then the ones the
    // replay added.
    readonly request: ReplayRequest;
    readonly response: RecordedResponse;
}

export interface ReplayState {
    readonly adapter: BackedDbAdapter;
}

export interface SignedIn {
    readonly identityId: string;
    // Never written.
    readonly bearer: string;
    readonly exchanges: readonly RecordedExchange[];
    // Every credential the sign-in carried, for the
    // credential guard's known list.
    readonly secrets: readonly string[];
}

export interface RecordedPart {
    readonly status: number;
    readonly headers: readonly ApiDocHeaderLine[];
    readonly body: string;
}

export interface ReplayStage {
    readonly credentials: SeededCredentials;
    readonly base: ReplayState;
    // The base state's rows under a state of their own.
    copy(): ReplayState;
    send(
        on: ReplayState,
        request: ReplayRequest,
    ): Promise<RecordedExchange>;
    signIn(
        on: ReplayState,
        username: string,
        password: string,
        verifier: string,
    ): Promise<SignedIn>;
}

const API_MOUNT = '/api';
// The gate reads a request's path and query, never its
// origin; a Request needs an absolute URL to carry them.
const REPLAY_ORIGIN = 'http://localhost';
export const AUTHORIZE_TARGET = API_MOUNT + '/authentication/authorize';
export const TOKEN_TARGET = API_MOUNT + '/authentication/token';
// RFC 7523 §2.2: the grant whose bearer is a client's
// signed assertion.
export const CLIENT_CREDENTIALS: GrantType = 'client_credentials';
// The OAuth client id the web app signs in as
// (client/authentication.ts).
const WEB_CLIENT_ID = 'web-app';
const AUTHORIZATION = 'authorization';
const AUTHENTICATION_INFO = 'authentication-info';
const BASIC_SCHEME = 'Basic ';
const CONTENT_TYPE = 'content-type';
const JSON_MEDIA_TYPE = 'application/json';
const SET_COOKIE = 'set-cookie';
// RFC 9110 §15.3: the successful class is 2xx.
const SUCCESSFUL_FROM = 200;
const SUCCESSFUL_BELOW = 300;

// The mock seed, rehearsed once under the throwaway hasher
// and landed once on a fresh memory backend.
//
// The gate's password sign-in hashes with the hasher its
// process registered, as the server's boot registers
// scrypt: it rehashes the pbkdf2 secret it verified. With
// none registered that sign-in answers 500, so the stage
// registers the throwaway hasher for the gate too.
export async function openReplayStage(): Promise<ReplayStage> {
    setPasswordHasher(throwawayPasswordHash);
    const seed = await rehearseMockData({
        hashPassword: throwawayPasswordHash,
    });
    const backend = new MemoryStorageBackend();
    await postSeedLanding(backend, seed.rehearsal);
    return {
        credentials: seed.credentials,
        base: { adapter: memoryDbAdapterOver(backend) },
        copy: () => ({
            adapter: memoryDbAdapterOver(backend.copy()),
        }),
        send,
        signIn,
    };
}

const apiHandler = requestHandlerFor(EXAMPLE_COMMIT);

// What the server and a client do around the API's handler:
// the /api mount stripped, the body framed with its
// length, and the server's defaults placed on the answer.
async function send(
    on: ReplayState,
    request: ReplayRequest,
): Promise<RecordedExchange> {
    if (!request.target.startsWith(API_MOUNT + '/')) {
        throw new Error(
            'the replay reaches only the API: ' + request.target,
        );
    }
    const bytes = new TextEncoder().encode(request.body);
    const url = new URL(
        REPLAY_ORIGIN + request.target.slice(API_MOUNT.length),
    );
    // The gate answers the status route before it reads an
    // Operation-ID (api/api.ts dispatched), so none is sent.
    const sent: ApiDocHeaderLine[] = isSystemStatusPath(url.pathname)
        ? [...request.headers]
        : [
            ...request.headers,
            [OPERATION_ID_HEADER, generateIdentifier()],
        ];
    if (bytes.byteLength > 0) {
        sent.push([CONTENT_LENGTH, String(bytes.byteLength)]);
    }
    const headers = new Headers();
    for (const [name, value] of sent) {
        headers.append(name, value);
    }
    const answered = withApiResponseDefaults(await apiHandler(
        on.adapter,
        new Request(
            url,
            {
                method: request.method,
                headers,
                ...(bytes.byteLength > 0 ? { body: bytes } : {}),
            },
        ),
    ));
    return {
        request: {
            method: request.method,
            target: request.target,
            headers: sent,
            body: request.body,
        },
        response: {
            status: answered.status,
            headers: [...answered.headers],
            body: await answered.text(),
        },
    };
}

// The web app's password sign-in, as its client sends it
// (client/authentication.ts): the password under Basic
// for a code, then the code and its PKCE verifier under
// Basic for the access token and the refresh cookie.
async function signIn(
    on: ReplayState,
    username: string,
    password: string,
    verifier: string,
): Promise<SignedIn> {
    const challenge = await challengeOf(verifier);
    const passwordBasic = basicAuthorization(username, password);
    const authorized = await send(
        on, await authorizeRequestOf(username, password, verifier),
    );
    const code = authenticationParameterOf(authorized, 'code');
    const codeBasic = basicAuthorization(code, verifier);
    const granted = await send(on, {
        method: 'POST',
        target: TOKEN_TARGET,
        headers: [
            [AUTHORIZATION, codeBasic],
            [CONTENT_TYPE, JSON_MEDIA_TYPE],
        ],
        body: JSON.stringify({
            grant_type: 'authorization_code',
            client_id: WEB_CLIENT_ID,
        }),
    });
    const bearer = authenticationParameterOf(
        granted, 'access_token',
    );
    return {
        identityId: principalFromToken(bearer).id,
        bearer,
        exchanges: [authorized, granted],
        // A Basic credential is base64, so the guard finds
        // it only by its encoded text.
        secrets: [
            password,
            verifier,
            challenge,
            code,
            bearer,
            ...cookieValuesOf(authorized.response),
            ...cookieValuesOf(granted.response),
            passwordBasic.slice(BASIC_SCHEME.length),
            codeBasic.slice(BASIC_SCHEME.length),
        ],
    };
}

// The first call of the web app's password sign-in: the
// password under Basic, and the PKCE challenge of the
// verifier the second call will present.
export async function authorizeRequestOf(
    username: string,
    password: string,
    verifier: string,
): Promise<ReplayRequest> {
    return {
        method: 'POST',
        target: AUTHORIZE_TARGET,
        headers: [
            [AUTHORIZATION, basicAuthorization(username, password)],
            [CONTENT_TYPE, JSON_MEDIA_TYPE],
        ],
        body: JSON.stringify({
            method: 'password',
            client_id: WEB_CLIENT_ID,
            code_challenge: await challengeOf(verifier),
            code_challenge_method: 'S256',
        }),
    };
}

// RFC 7636 §4.2: S256 is the base64url SHA-256 of the
// verifier.
async function challengeOf(verifier: string): Promise<string> {
    return bytesToBase64Url(await sha256Bytes(verifier));
}

// A successful exchange. Anything else fails the run,
// naming the call and never its credentials.
export function succeeded(
    exchange: RecordedExchange,
): RecordedExchange {
    const { status } = exchange.response;
    if (status < SUCCESSFUL_FROM || status >= SUCCESSFUL_BELOW) {
        throw new Error(
            exchange.request.method + ' ' + exchange.request.target
                + ' answered ' + status,
        );
    }
    return exchange;
}

// The named parameter of a successful sign-in answer's
// authentication-info line. A refusal or a missing
// parameter fails the run, naming the request and never
// a value.
function authenticationParameterOf(
    exchange: RecordedExchange,
    name: string,
): string {
    const line = succeeded(exchange).response.headers.find(
        ([held]) => held === AUTHENTICATION_INFO,
    );
    if (line === undefined) {
        throw new Error(
            exchange.request.target + ' answered no '
                + AUTHENTICATION_INFO,
        );
    }
    const value = authParam(line[1], name);
    if (value === null) {
        throw new Error(AUTHENTICATION_INFO + ' lacks ' + name);
    }
    return value;
}

// The value of each cookie a response set: what follows
// the name and `=` on its set-cookie line, up to the
// first `;` (RFC 6265 §4.1.1).
function cookieValuesOf(response: RecordedResponse): string[] {
    return response.headers
        .filter(([name]) => name === SET_COOKIE)
        .map(([, line]) => {
            const [pair] = line.split(';');
            const equals = pair!.indexOf('=');
            if (equals < 0) {
                throw new Error('a set-cookie line names no value');
            }
            return pair!.slice(equals + 1);
        });
}

// A collection's parts, each the response its document
// serves; none for an answer that is not multipart/mixed.
// The recorded body is text, and a part is framed by its
// length in octets, so the body is split as Latin-1, one
// char per octet, and each part's body is read back as
// UTF-8.
export function partsOf(
    response: RecordedResponse,
): readonly RecordedPart[] {
    const line = response.headers.find(
        ([name]) => name === CONTENT_TYPE,
    );
    if (line === undefined || !isMultipartMixed(line[1])) {
        return [];
    }
    const octets = Octets.fromBytes(
        new TextEncoder().encode(response.body),
    );
    return splitParts(line[1], octets.toLatin1()).map(partOf);
}

function isMultipartMixed(contentType: string): boolean {
    const [mediaType] = contentType.split(';');
    return mediaType!.trim().toLowerCase() === MULTIPART_MIXED;
}

function partOf(wire: string): RecordedPart {
    const model = parseWire(wire);
    if (model.startLine.kind !== 'response') {
        throw new Error('a collection part is not a response');
    }
    return {
        status: model.startLine.status,
        headers: model.fields.map(
            (field): ApiDocHeaderLine => [field.name, field.value],
        ),
        body: model.body === undefined
            ? ''
            : new TextDecoder('utf-8', { fatal: true })
                .decode(model.body.asBytes()),
    };
}
