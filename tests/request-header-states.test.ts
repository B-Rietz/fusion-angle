// Every state api/request-headers.ts declares, held to what
// the gate answers. Each request kind — a route and verb the
// route table offers, the token route once per grant type and
// once more for a grant_type it does not take — is driven
// through handleRequest on the memory backend, for every
// declared header handleRequest reads: the endpoint and
// transport declarations, less forwarded and x-forwarded-for,
// which the server reads before handleRequest.
//
// B(K) is a kind's baseline: each driven header in the form
// its declared state is satisfied by. A required one is
// present and valid, the first of an alternative set is
// present, and the rest are absent. A check sends B with one
// header added or removed, so a different answer is that
// header's doing:
// - required: without it the request is refused for its
//   absence, and B is not refused on its account;
// - forbidden: with it the request is refused for its
//   presence, and B is not refused on its account;
// - alternative: with no member of the set the request is
//   refused for the set's absence, and with each member alone
//   it is not refused on the set's account, nor on the
//   member's own;
// - optional, unused: the request is refused on its account
//   neither with it nor without it.
// A header is added as the only member of its set, so the 412
// that answers both preconditions never stands in for one.
//
// The set an `alternative` names is part of the state, so the
// gate's answers hold it too: a driven header the set does not
// name, sent in the set's place, leaves the request refused.
// A set that names a header the gate refuses, or omits one it
// admits, is a disagreement.
//
// "On its account" is the header's own refusals, which
// DRIVEN_HEADERS lists beside the gate site of each. Any other
// answer — a 404, a validator's 400, a stale validator's 412 —
// is on no header's account. A 5xx agrees with no check.
//
// The limit: `optional` declared where `unused` is true, or
// the reverse, passes. A read that decides nothing leaves no
// trace in an answer; tests/request-header-ban.test.ts holds
// the reads.
//
// Every request runs in a world of its own. A body is bytes:
// Deno gives a string body `content-type: text/plain`, and a
// QUERY would then be refused for the test's reason, not the
// declaration's.
//
// Each test also asserts that no credential it sent reached a
// log line, or an answer it would print, and names the header
// and the kind when one did, never the value.

import { assertEquals } from '@std/assert';
import { handleRequest } from '../api/api.ts';
import {
    basicAuthorization,
    GRANT_TYPES,
    parseBasic,
    type GrantType,
} from '../api/authentication.ts';
import {
    memoryDbAdapter,
    type MemoryDbAdapter,
} from '../api/db-memory.ts';
import { AUTHENTICATION_ROUTES } from '../api/request-auth.ts';
import { REQUEST_HEADERS } from '../api/request-header-names.ts';
import {
    REQUEST_HEADER_DECLARATIONS,
    type RequestHeaderDeclaration,
    type RequestKind,
    type RequestMethod,
} from '../api/request-headers.ts';
import {
    offeredVerbs,
    routePatternOf,
    type HttpVerb,
} from '../api/route-surface.ts';
import { routes } from '../api/routes.ts';
import { bytesToBase64Url } from '../shared/base64url.ts';
import { sha256Bytes } from '../shared/digest.ts';
import { generateIdentifier } from '../shared/identifier.ts';
import { membershipNameOf } from '../shared/membership-name.ts';
import { nowEpochSeconds } from '../shared/types.ts';
import {
    seedAuthorizationCodeMessagePair,
} from './authorization-code-fixtures.ts';
import {
    makeAssertionSigner,
} from './client-assertion-fixtures.ts';
import { captureConsole } from './fixtures/console-capture.ts';
import { refreshTokenFromSetCookie } from './http-fixtures.ts';
import {
    seedClientRegistration,
    seedIdentityCredential,
    seedPersonIdentity,
} from './identity-fixtures.ts';
import { testHashPassword } from './mock-seed.ts';
import { seedRootAdmin } from './root-admin-fixture.ts';
import { devToken, organizationToken } from './token-fixtures.ts';

const BASE = 'http://localhost';

const TOKEN_ROUTE = 'authentication/token';
const AUTHORIZE_ROUTE = 'authentication/authorize';

// seedRootAdmin's organization, and the identity it seats
// there.
const ORGANIZATION = 'AjdvjuECVZEgZoFajaIEkg';
const IDENTITY = 'XXZruirZyAOoRpNxaDnpSA';

const EMAIL = 'demo@example.com';
const PASSWORD = 's3cret';
const WEB_CLIENT = 'web';

// The audience a headless client registers, which its
// assertion must name.
const ASSERTION_AUDIENCE = 'fusion-angle';
const ASSERTION_TTL_SECONDS = 300;

// The server reads these two before handleRequest
// (server/http-server.ts), so no request made here shows them.
const SERVER_READ: ReadonlySet<string> = new Set<string>([
    REQUEST_HEADERS.forwarded.name,
    REQUEST_HEADERS.xForwardedFor.name,
]);

const DRIVEN: readonly RequestHeaderDeclaration[] =
    REQUEST_HEADER_DECLARATIONS.filter((declaration) =>
        declaration.surface !== 'site'
        && !SERVER_READ.has(declaration.name));

const CREDENTIAL_NAMES: ReadonlySet<string> = new Set<string>([
    REQUEST_HEADERS.authorization.name,
    REQUEST_HEADERS.cookie.name,
]);

const BODY_METHODS: ReadonlySet<RequestMethod> =
    new Set<RequestMethod>(['PUT', 'POST', 'PATCH', 'QUERY']);

// The token route is one kind per grant type, then the kind
// whose grant_type is none of them.
const KINDS: readonly RequestKind[] = routes.flatMap((row) => {
    const routePattern = routePatternOf(row);
    return offeredVerbs(row).flatMap((verb) => {
        const method: RequestMethod =
            verb.toUpperCase() as Uppercase<HttpVerb>;
        const kind: RequestKind = {
            routePattern,
            method,
            bodySent: BODY_METHODS.has(method),
        };
        return routePattern === TOKEN_ROUTE
            ? [
                ...GRANT_TYPES.map((grantType) => ({
                    ...kind,
                    grantType,
                })),
                kind,
            ]
            : [kind];
    });
});

function labelOf(kind: RequestKind): string {
    const label = kind.method + ' ' + kind.routePattern;
    return kind.grantType === undefined
        ? label
        : label + ' ' + kind.grantType;
}

// The caller's own organization and identity where the path
// opens on one, so the fence admits the request. A membership
// name joins the two, a tag's name is a word, and every other
// parameter is a fresh identifier.
function pathOf(routePattern: string): string {
    const segments = routePattern.split('/');
    const firstParameter = segments.findIndex((segment) =>
        segment.startsWith(':'));
    return segments.map((segment, index) => {
        if (!segment.startsWith(':')) return segment;
        if (index === firstParameter) {
            if (segments[0] === 'organizations') return ORGANIZATION;
            if (segments[0] === 'identities') return IDENTITY;
        }
        if (segment === ':membership-id') {
            return membershipNameOf(ORGANIZATION, IDENTITY);
        }
        if (segment === ':name') return 'tag';
        return generateIdentifier();
    }).join('/');
}

interface World {
    readonly db: MemoryDbAdapter;
    readonly body: Record<string, unknown>;
    // The two credential lines as this world's kind takes them:
    // the credential the kind's route accepts, or a line the
    // kind never reads.
    readonly authorization: string;
    readonly cookie: string;
}

// A credential line a request carried, kept to show that no
// log line repeats it.
interface SentCredential {
    readonly header: string;
    readonly kind: string;
    readonly value: string;
}

async function emptyDb(): Promise<MemoryDbAdapter> {
    const db = memoryDbAdapter();
    await db.postSchemaCreation();
    return db;
}

function unreadCookie(): string {
    return 'refresh_token=' + generateIdentifier();
}

// seedRootAdmin's world, and the caller every ordinary kind is
// sent as: the seated identity, in its organization.
async function seatedWorld(
    body: Record<string, unknown>,
): Promise<World> {
    const db = await emptyDb();
    await seedRootAdmin(db);
    return {
        db,
        body,
        authorization: 'Bearer ' + await organizationToken(),
        cookie: unreadCookie(),
    };
}

async function authorizeWorld(): Promise<World> {
    const db = await emptyDb();
    await seedPersonIdentity(db, IDENTITY, {
        name: 'Demo',
        email: EMAIL,
        phone: '555-0100',
        bio: 'demo user',
    });
    await seedIdentityCredential(
        db, IDENTITY, generateIdentifier(), {
            identity_id: IDENTITY,
            kind: 'password',
            status: 'set',
            secret: await testHashPassword(PASSWORD),
            at: '2026-06-03T00:00:00.000000Z',
        },
    );
    await seedRootAdmin(db);
    return {
        db,
        body: {
            method: 'password',
            client_id: WEB_CLIENT,
            code_challenge: bytesToBase64Url(
                await sha256Bytes('pkce-verifier-test'),
            ),
            code_challenge_method: 'S256',
        },
        authorization: basicAuthorization(EMAIL, PASSWORD),
        cookie: unreadCookie(),
    };
}

async function authorizationCodeWorld(): Promise<World> {
    const world = await seatedWorld({
        grant_type: 'authorization_code',
        client_id: WEB_CLIENT,
    });
    const code = generateIdentifier();
    await seedAuthorizationCodeMessagePair(
        world.db, code, IDENTITY, WEB_CLIENT,
    );
    return { ...world, authorization: basicAuthorization(code, '') };
}

// The exchange a refresh world is made by, stated here so that
// the world rests on no declared state.
const EXCHANGE: RequestKind = {
    routePattern: TOKEN_ROUTE,
    method: 'POST',
    bodySent: true,
    grantType: 'authorization_code',
};
const EXCHANGE_LINES: readonly string[] = [
    REQUEST_HEADERS.authorization.name,
    REQUEST_HEADERS.operationId.name,
    REQUEST_HEADERS.contentLength.name,
];

async function refreshWorld(
    sent: SentCredential[],
): Promise<World> {
    const code = await authorizationCodeWorld();
    const exchange = await responseTo(
        code, EXCHANGE, EXCHANGE_LINES, sent,
    );
    return {
        db: code.db,
        body: { grant_type: 'refresh' },
        authorization: 'Bearer ' + await organizationToken(),
        cookie: 'refresh_token='
            + refreshTokenFromSetCookie(exchange),
    };
}

async function tokenExchangeWorld(): Promise<World> {
    return {
        ...await seatedWorld({ grant_type: 'token-exchange' }),
        authorization: 'Bearer ' + await devToken(),
    };
}

async function clientCredentialsWorld(): Promise<World> {
    const db = await emptyDb();
    const client = generateIdentifier();
    const signer = await makeAssertionSigner('ES256');
    await seedClientRegistration(db, client, {
        grant_types: 'client_credentials',
        redirect_uris: '',
        jwks: signer.jwks,
        aud: ASSERTION_AUDIENCE,
        status: 'active',
    });
    const now = nowEpochSeconds();
    const assertion = await signer.sign({
        iss: client,
        sub: client,
        aud: ASSERTION_AUDIENCE,
        exp: now + ASSERTION_TTL_SECONDS,
        iat: now,
        jti: generateIdentifier(),
    });
    return {
        db,
        body: { grant_type: 'client_credentials', client_id: client },
        authorization: 'Bearer ' + assertion,
        cookie: unreadCookie(),
    };
}

const TOKEN_WORLDS: Readonly<Record<
    GrantType,
    (sent: SentCredential[]) => Promise<World>
>> = {
    authorization_code: authorizationCodeWorld,
    refresh: refreshWorld,
    'token-exchange': tokenExchangeWorld,
    client_credentials: clientCredentialsWorld,
};

function worldOf(
    kind: RequestKind,
    sent: SentCredential[],
): Promise<World> {
    if (kind.routePattern === AUTHORIZE_ROUTE) {
        return authorizeWorld();
    }
    if (kind.routePattern === TOKEN_ROUTE) {
        // A grant_type the token route does not take.
        if (kind.grantType === undefined) {
            return seatedWorld({ grant_type: 'password' });
        }
        return TOKEN_WORLDS[kind.grantType](sent);
    }
    // A bearer-exempt route this test has yet to be taught,
    // never one to send as the seated caller.
    if (AUTHENTICATION_ROUTES.has(kind.routePattern)) {
        throw new Error('no world stated for ' + kind.routePattern);
    }
    return seatedWorld({});
}

// A refusal the gate answers: its status and, where the status
// alone does not name the header, the text of its error.
interface Refusal {
    readonly status: number;
    readonly error?: RegExp;
}

interface RefusalLists {
    // What answers the header's absence where it is required,
    // and where one of its alternatives is.
    readonly absentRequired: readonly Refusal[];
    readonly absentAlternative: readonly Refusal[];
    // What answers its presence where it is forbidden.
    readonly present: readonly Refusal[];
    // What answers a value the gate cannot take, and both
    // members of a set sent together. No check sends either:
    // the two complete what counts as the header's account.
    readonly value: readonly Refusal[];
    readonly both: readonly Refusal[];
}

interface DrivenHeader extends RefusalLists {
    readonly valueOf: (world: World, bodyLength: number) => string;
}

const UNREFUSED: RefusalLists = {
    absentRequired: [],
    absentAlternative: [],
    present: [],
    value: [],
    both: [],
};

// api.ts preconditionRefusal, every line.
const PRECONDITION_REFUSALS: RefusalLists = {
    absentRequired: [
        { status: 428, error: /^If-Match is required to / },
    ],
    absentAlternative: [{
        status: 428,
        error: /^If-Match or If-None-Match is required to /,
    }],
    present: [
        { status: 400, error: /takes no precondition$/ },
        { status: 400, error: /requires If-Match$/ },
    ],
    value: [
        { status: 400, error: /^If-None-Match must be \*$/ },
        {
            status: 400,
            error:
                /^If-Match must carry exactly one strong validator$/,
        },
    ],
    both: [{ status: 412, error: /cannot both hold/ }],
};

// Each driven header by name: the value a request carries it
// with, and its refusals. Neither credential header has a
// refusal for absence alone: absent or invalid, the answer is
// 401.
const DRIVEN_HEADERS: Readonly<Record<string, DrivenHeader>> = {
    [REQUEST_HEADERS.authorization.name]: {
        ...UNREFUSED,
        valueOf: (world) => world.authorization,
        // request-auth.ts authenticateRequest, answered by
        // unauthorizedBearerResponse; authentication.ts
        // authorizePassword, grantAuthorizationCode,
        // grantTokenExchange, grantClientCredentials
        absentRequired: [{ status: 401 }],
        value: [{ status: 401 }],
    },
    [REQUEST_HEADERS.operationId.name]: {
        ...UNREFUSED,
        valueOf: () => generateIdentifier(),
        // api.ts dispatched
        absentRequired: [
            { status: 400, error: /^Operation-ID is required$/ },
        ],
        value: [{
            status: 400,
            error: /must be a 22-character identifier$/,
        }],
    },
    [REQUEST_HEADERS.contentType.name]: {
        ...UNREFUSED,
        valueOf: () => 'application/json',
        // api.ts queryMediaTypeRefusal
        absentRequired: [
            { status: 400, error: /requires a Content-Type$/ },
        ],
        value: [{ status: 415 }],
    },
    [REQUEST_HEADERS.ifMatch.name]: {
        ...PRECONDITION_REFUSALS,
        valueOf: () => '"' + generateIdentifier() + '"',
    },
    [REQUEST_HEADERS.ifNoneMatch.name]: {
        ...PRECONDITION_REFUSALS,
        valueOf: () => '*',
    },
    [REQUEST_HEADERS.cookie.name]: {
        ...UNREFUSED,
        valueOf: (world) => world.cookie,
        // authentication.ts grantRefresh
        absentRequired: [{ status: 401 }],
        value: [{ status: 401 }],
    },
    [REQUEST_HEADERS.requestId.name]: {
        ...UNREFUSED,
        valueOf: () => generateIdentifier(),
        // api.ts dispatched
        present: [{
            status: 400,
            error: /^Request-ID is minted by the server$/,
        }],
    },
    [REQUEST_HEADERS.contentLength.name]: {
        ...UNREFUSED,
        valueOf: (_world, bodyLength) => String(bodyLength),
        // request-context.ts framingRefusal
        absentRequired: [{ status: 411 }],
        value: [{
            status: 400,
            error: /^Content-Length does not match the body$/,
        }],
    },
    [REQUEST_HEADERS.transferEncoding.name]: {
        ...UNREFUSED,
        valueOf: () => 'chunked',
        // request-context.ts framingRefusal
        present: [{ status: 411 }],
    },
};

// A driven declaration with no entry is a header this test has
// yet to be taught, never one to pass over.
function drivenOf(name: string): DrivenHeader {
    const driven = DRIVEN_HEADERS[name];
    if (driven === undefined) {
        throw new Error('no value or refusals stated for ' + name);
    }
    return driven;
}

interface Answer {
    readonly status: number;
    readonly error?: string;
}

function shownOf(answer: Answer): string {
    return answer.error === undefined
        ? String(answer.status)
        : answer.status + ' ' + answer.error;
}

function isAmong(
    answer: Answer,
    refusals: readonly Refusal[],
): boolean {
    return refusals.some((refusal) =>
        refusal.status === answer.status
        && (refusal.error === undefined
            || (answer.error !== undefined
                && refusal.error.test(answer.error))));
}

// Every refusal that is a header's own.
function accountOf(lists: RefusalLists): readonly Refusal[] {
    return [
        ...lists.absentRequired,
        ...lists.absentAlternative,
        ...lists.present,
        ...lists.value,
        ...lists.both,
    ];
}

// B(K), as the names of the lines it carries.
function baselineOf(kind: RequestKind): string[] {
    return DRIVEN.filter((declaration) => {
        const state = declaration.stateOf(kind);
        return state === 'required'
            || (state === 'alternative'
                && declaration.alternatives[0] === declaration.name);
    }).map((declaration) => declaration.name);
}

interface Check {
    readonly name: string;
    // The names of the header lines the request carries.
    readonly lines: readonly string[];
    readonly agrees: (answer: Answer) => boolean;
}

// An alternative's set, held to the gate from both sides.
// `carried` is B with no member of the set. In the set's place
// the gate admits each member the declaration names: it
// refuses on neither the set's account nor the member's own.
// It admits no other driven header: the request stays refused,
// for the set's absence or for that header's presence. A
// header the request already carries cannot take the set's
// place, so it is not tried.
function setChecksOf(
    declaration: RequestHeaderDeclaration,
    carried: readonly string[],
): Check[] {
    const lists = drivenOf(declaration.name);
    const unnamed = DRIVEN.map((driven) => driven.name)
        .filter((name) =>
            !declaration.alternatives.includes(name)
            && !carried.includes(name));
    return [{
        name: 'with none of its set',
        lines: carried,
        agrees: (answer) =>
            isAmong(answer, lists.absentAlternative),
    }, ...declaration.alternatives.map((member) => ({
        name: 'with only ' + member,
        lines: [...carried, member],
        agrees: (answer: Answer) => !isAmong(answer, [
            ...accountOf(lists),
            ...accountOf(drivenOf(member)),
        ]),
    })), ...unnamed.map((name) => ({
        name: 'with ' + name + ' in place of its set',
        lines: [...carried, name],
        agrees: (answer: Answer) => isAmong(answer, [
            ...lists.absentAlternative,
            ...drivenOf(name).present,
        ]),
    }))];
}

function checksOf(
    declaration: RequestHeaderDeclaration,
    kind: RequestKind,
): Check[] {
    const lists = drivenOf(declaration.name);
    const refusedBy = (refusals: readonly Refusal[]) =>
        (answer: Answer) => isAmong(answer, refusals);
    const unrefused = (answer: Answer) =>
        !isAmong(answer, accountOf(lists));
    const baseline = baselineOf(kind);
    const without = baseline.filter((name) =>
        name !== declaration.name);
    const outsideItsSet = without.filter((name) =>
        !declaration.alternatives.includes(name));
    // The header as the only member of its set.
    const alone = [...outsideItsSet, declaration.name];
    switch (declaration.stateOf(kind)) {
        case 'required':
            return [{
                name: 'without it',
                lines: without,
                agrees: refusedBy(lists.absentRequired),
            }, {
                name: 'with it',
                lines: baseline,
                agrees: unrefused,
            }];
        case 'forbidden':
            return [{
                name: 'with it',
                lines: alone,
                agrees: refusedBy(lists.present),
            }, {
                name: 'without it',
                lines: without,
                agrees: unrefused,
            }];
        case 'optional':
        case 'unused':
            return [{
                name: 'without it',
                lines: without,
                agrees: unrefused,
            }, {
                name: 'with it',
                lines: alone,
                agrees: unrefused,
            }];
        case 'alternative':
            return setChecksOf(declaration, outsideItsSet);
    }
}

// `if-match` as a client writes it, `If-Match`: a Headers read
// ignores case.
function titleCased(name: string): string {
    return name.split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('-');
}

async function responseTo(
    world: World,
    kind: RequestKind,
    lines: readonly string[],
    sent: SentCredential[],
): Promise<Response> {
    const bytes = kind.bodySent
        ? new TextEncoder().encode(JSON.stringify(world.body))
        : new Uint8Array();
    const headers = new Headers();
    for (const name of lines) {
        const value = drivenOf(name).valueOf(world, bytes.byteLength);
        headers.set(titleCased(name), value);
        if (CREDENTIAL_NAMES.has(name)) {
            sent.push({ header: name, kind: labelOf(kind), value });
        }
    }
    return handleRequest(world.db, new Request(
        BASE + '/' + pathOf(kind.routePattern),
        {
            method: kind.method,
            headers,
            ...(kind.bodySent ? { body: bytes } : {}),
        },
    ));
}

// A refusal's body is JSON that carries an `error` text.
async function answerOf(response: Response): Promise<Answer> {
    if (response.ok) return { status: response.status };
    const body: unknown = await response.json();
    return typeof body === 'object' && body !== null
        && 'error' in body && typeof body.error === 'string'
        ? { status: response.status, error: body.error }
        : { status: response.status };
}

// What a credential line carries, bare: what follows its
// scheme or its cookie's name, and the two halves of a Basic
// pair. A log line leaks the credential in any of these forms.
function secretsOf(value: string): string[] {
    const bare = value.slice(value.search(/[ =]/) + 1);
    const basic = parseBasic(value);
    return (basic === null
        ? [bare]
        : [bare, basic.userId, basic.password])
        .filter((secret) => secret !== '');
}

// Each credential that some shown text repeats, by header and
// kind and never by value: this list is a failure message.
function leakedInto(
    shown: readonly string[],
    sent: readonly SentCredential[],
): string[] {
    return [...new Set(
        sent.filter((credential) =>
            secretsOf(credential.value).some((secret) =>
                shown.some((text) => text.includes(secret))))
            .map((credential) =>
                credential.kind + ' ' + credential.header),
    )];
}

// A 5xx is the gate failing (RFC 9110 §15.6), an answer no
// declared state predicts.
const SERVER_ERROR = 500;

// One line per check whose answer the declared state does not
// predict.
async function disagreementsOf(
    declaration: RequestHeaderDeclaration,
    kind: RequestKind,
    sent: SentCredential[],
): Promise<string[]> {
    const disagreements: string[] = [];
    for (const check of checksOf(declaration, kind)) {
        const answer = await answerOf(await responseTo(
            await worldOf(kind, sent), kind, check.lines, sent,
        ));
        if (answer.status >= SERVER_ERROR || !check.agrees(answer)) {
            disagreements.push(
                labelOf(kind) + ' ' + declaration.name
                + ' declared ' + declaration.stateOf(kind) + ': '
                + check.name + ' answered ' + shownOf(answer),
            );
        }
    }
    return disagreements;
}

// Nothing cut short: a credential abbreviated out of the text
// would pass unseen.
const WHOLE: Deno.InspectOptions = {
    depth: Infinity,
    iterableLimit: Infinity,
    strAbbreviateSize: Infinity,
};

for (const declaration of DRIVEN) {
    Deno.test(
        declaration.name
            + ' answers as declared on every request kind',
        async () => {
            const sent: SentCredential[] = [];
            const disagreements: string[] = [];
            const { calls: errors, result: { calls: warnings } } =
                await captureConsole('error', () =>
                    captureConsole('warn', async () => {
                        for (const kind of KINDS) {
                            disagreements.push(
                                ...await disagreementsOf(
                                    declaration, kind, sent,
                                ),
                            );
                        }
                    }));
            const logged = [...errors, ...warnings].flat()
                .map((argument) => Deno.inspect(argument, WHOLE));
            // Asserted first, so that a disagreement which
            // repeats a credential is never printed.
            assertEquals(
                leakedInto([...logged, ...disagreements], sent),
                [],
                'a credential the test sent reached a log line'
                    + ' or an answer',
            );
            assertEquals(disagreements, []);
        },
    );
}

// worldOf states a world for these two sign-in routes alone,
// so the kinds on a bearer-exempt route are exactly theirs:
// the authorize route once, and the token route once per grant
// type and once with none.
Deno.test('each sign-in kind is one this test drives', () => {
    const signInRoutes = [...new Set(
        KINDS.map((kind) => kind.routePattern),
    )].filter((routePattern) =>
        AUTHENTICATION_ROUTES.has(routePattern));
    const grantTypesOf = (routePattern: string) =>
        KINDS.filter((kind) => kind.routePattern === routePattern)
            .map((kind) => kind.grantType);
    assertEquals(
        signInRoutes.sort(),
        [AUTHORIZE_ROUTE, TOKEN_ROUTE].sort(),
    );
    assertEquals(grantTypesOf(AUTHORIZE_ROUTE), [undefined]);
    assertEquals(
        grantTypesOf(TOKEN_ROUTE),
        [...GRANT_TYPES, undefined],
    );
});
