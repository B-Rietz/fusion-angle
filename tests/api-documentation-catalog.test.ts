// The committed catalog and the samples it names, held to
// the modules that state them: these tests read the
// committed tree under web-app/api-documentation/. The
// last two hand the presenter a room of their own.

import {
    assert,
    assertEquals,
    assertMatch,
    assertNotMatch,
    assertStrictEquals,
} from '@std/assert';
import {
    AUTHENTICATION_ROUTES,
    STATUS_ROUTE,
} from '../api/request-auth.ts';
import { routes } from '../api/routes.ts';
import { roomHtml } from
    '../web-app/api-documentation/presenter.ts';
import {
    API_DOC_CURL_ADDS,
    API_DOC_GENERIC_ANSWERS,
    API_DOC_ROOMS,
    API_DOC_STATUSES,
    API_DOC_STEPS,
    API_DOC_TRANSPORT,
    type ApiDocRoom,
} from '../web-app/api-documentation/rooms.ts';
import {
    type ApiDocAnswer,
    type ApiDocSample,
    readSample,
} from '../web-app/api-documentation/shapes.ts';
import {
    type AnswerRule,
    answersFor,
    GENERIC_ANSWERS,
} from '../web-app/app/api-documentation-answers.ts';
import {
    CURL_ADDS,
    curlOf,
} from '../web-app/app/api-documentation-exchange.ts';
import { STEPS } from
    '../web-app/app/api-documentation-guided-start.ts';
import {
    headerSetsOf,
    TRANSPORT_HEADERS,
} from '../web-app/app/api-documentation-headers.ts';
import {
    queryParametersOf,
    relatedOf,
} from '../web-app/app/api-documentation-related.ts';
import { endpointsOf } from
    '../web-app/app/api-documentation-story.ts';
import { tierOf } from '../web-app/app/api-documentation-tier.ts';

const TREE = 'web-app/api-documentation/';
// What the HTML rooms were filed under, at the tree's root.
const RETIRED_DIRECTORIES = [
    'get', 'post', 'put', 'patch', 'delete', 'query', 'statuses',
];
const OPERATION_ID = 'operation-id';
const AUTHORIZATION = 'authorization';
// The two requests that carry no bearer, as a sample's
// request names them.
const SIGN_IN_TARGETS: ReadonlySet<string> = new Set(
    [...AUTHENTICATION_ROUTES].map((pattern) => '/api/' + pattern),
);
// The request the gate answers before it reads an
// Operation-ID or a bearer (api/api.ts dispatched): it
// carries neither.
const STATUS_TARGET = '/api/' + STATUS_ROUTE;

const ENDPOINTS = endpointsOf(routes);
// Every catalog entry that names a sample: the rooms, then
// the steps of the guided start.
const SAMPLED = [...API_DOC_ROOMS, ...API_DOC_STEPS];

function sampleAt(path: string): ApiDocSample {
    const read = readSample(
        JSON.parse(Deno.readTextFileSync(TREE + path)),
    );
    if (read.kind === 'fault') {
        throw new Error(path + ': ' + read.reason);
    }
    return read.sample;
}

// Every sample the catalog names, read as the page reads
// it.
function committedSamples(): readonly ApiDocSample[] {
    return SAMPLED.flatMap(({ sample }) =>
        sample.kind === 'sample' ? [sampleAt(sample.path)] : []
    );
}

function answerOf({ code, line }: AnswerRule): ApiDocAnswer {
    return { code: String(code), line };
}

// The status a room's sample witnessed; none where the room
// has no sample.
function witnessedOf(room: ApiDocRoom): number | undefined {
    if (room.sample.kind === 'none') return undefined;
    const [exchange, ...more] = sampleAt(room.sample.path).exchanges;
    assert(exchange !== undefined && more.length === 0, room.hash);
    return exchange.response.status;
}

// The codes a room lists, by its verb and its route.
function codesOf(verb: string, uri: string): readonly string[] {
    const room = API_DOC_ROOMS.find(
        (held) => held.verb === verb && held.uri === '/api' + uri,
    );
    assert(room, verb + ' ' + uri);
    return room.answers.map(({ code }) => code);
}

Deno.test('the generated tree holds the catalog, the grid, and'
    + ' the samples', () => {
    for (const name of ['API.svg', 'elevation.ts', 'rooms.ts']) {
        assert(Deno.statSync(TREE + name).isFile, name);
    }
    assert(Deno.statSync(TREE + 'samples').isDirectory);
    const names = [...Deno.readDirSync(TREE)].map(
        (entry) => entry.name,
    );
    for (const retired of RETIRED_DIRECTORIES) {
        assert(!names.includes(retired), retired);
    }
});

Deno.test('every endpoint has a sample or a reason', () => {
    for (const { hash, sample } of SAMPLED) {
        if (sample.kind === 'none') {
            assert(sample.reason !== '', hash);
            continue;
        }
        assertStrictEquals(sampleAt(sample.path).hash, hash);
    }
});

Deno.test('every answer an endpoint lists has its status page',
() => {
    const pages = new Set(
        API_DOC_STATUSES.map(({ hash }) => hash),
    );
    for (const { hash, answers } of API_DOC_ROOMS) {
        assert(answers.length > 0, hash);
        for (const { code } of answers) {
            assert(pages.has('statuses/' + code), hash + ' ' + code);
        }
    }
});

Deno.test('every listed code carries a line', () => {
    for (const { hash, answers } of API_DOC_ROOMS) {
        for (const { code, line } of answers) {
            assert(line !== '', hash + ' ' + code);
        }
    }
    for (const { code, line } of API_DOC_GENERIC_ANSWERS) {
        assert(line !== '', code);
    }
});

Deno.test('the catalog\'s tiers are tierOf\'s', () => {
    assertEquals(
        API_DOC_ROOMS.map(({ hash, tier }) => [hash, tier]),
        ENDPOINTS.map(
            ({ hash, row, verb }) => [hash, tierOf(row, verb)],
        ),
    );
});

Deno.test('each room\'s headers are headerSetsOf\'s', () => {
    assertEquals(
        API_DOC_ROOMS.map(
            ({ hash, headerSets }) => [hash, headerSets],
        ),
        ENDPOINTS.map(
            (endpoint) => [endpoint.hash, headerSetsOf(endpoint)],
        ),
    );
});

Deno.test('the transport headers are TRANSPORT_HEADERS', () => {
    assertEquals(API_DOC_TRANSPORT, TRANSPORT_HEADERS);
});

Deno.test('each room\'s answers are answersFor\'s, at the status'
    + ' its sample witnessed', () => {
    assertEquals(
        API_DOC_ROOMS.map(({ hash, answers }) => [hash, answers]),
        ENDPOINTS.map((endpoint, index) => [
            endpoint.hash,
            answersFor(
                endpoint, witnessedOf(API_DOC_ROOMS[index]!),
            ).map(answerOf),
        ]),
    );
});

// The gate judges a route's query string on its GET and its
// QUERY alone (api/api.ts).
Deno.test('each room\'s neighbours are relatedOf\'s, and a'
    + ' read\'s parameters queryParametersOf\'s', () => {
    assertEquals(
        API_DOC_ROOMS.map(
            ({ hash, related, query }) => [hash, related, query],
        ),
        ENDPOINTS.map((endpoint) => [
            endpoint.hash,
            relatedOf(endpoint, ENDPOINTS),
            endpoint.verb === 'get' || endpoint.verb === 'query'
                ? queryParametersOf(endpoint.row)
                : [],
        ]),
    );
});

Deno.test('the steps, the generic answers, and the headers curl'
    + ' adds are their modules\'', () => {
    assertEquals(
        API_DOC_STEPS.map(({ hash, title, prose, shell }) => ({
            hash, title, prose, shell,
        })),
        STEPS.map(({ slug, title, prose, shell }) => ({
            hash: 'start/' + slug, title, prose, shell,
        })),
    );
    assertEquals(
        API_DOC_GENERIC_ANSWERS, GENERIC_ANSWERS.map(answerOf),
    );
    assertEquals(API_DOC_CURL_ADDS, CURL_ADDS);
});

Deno.test('each exchange\'s curl is its request\'s', () => {
    for (const { hash, exchanges } of committedSamples()) {
        for (const { request, curl } of exchanges) {
            assertStrictEquals(curlOf(request), curl, hash);
        }
    }
});

Deno.test('every exchange is whole', () => {
    for (const { hash, exchanges } of committedSamples()) {
        assert(exchanges.length > 0, hash);
        for (const { request, response } of exchanges) {
            const sent = request.headers.map(([name]) => name);
            if (request.target === STATUS_TARGET) {
                assert(!sent.includes(OPERATION_ID), hash);
                assert(!sent.includes(AUTHORIZATION), hash);
            } else {
                assert(sent.includes(OPERATION_ID), hash);
                assert(
                    SIGN_IN_TARGETS.has(request.target)
                        || sent.includes(AUTHORIZATION),
                    hash,
                );
            }
            assert(response.headers.length > 0, hash);
        }
    }
});

Deno.test('a GET of a document that can be deleted lists 410',
() => {
    for (const uri of [
        '/organizations/:id/ideas/:id',
        '/organizations/:id/flows/:id',
        '/organizations/:organization-id/record-types/'
            + ':record-type-id',
        '/identities/:id/pii',
    ]) {
        assert(codesOf('GET', uri).includes('410'), uri);
    }
    for (const uri of [
        '/identities/:id',
        '/organizations/:id',
        '/organizations/:id/ideas/',
        '/organizations/:id/invitations/:membership-id',
    ]) {
        assert(!codesOf('GET', uri).includes('410'), uri);
    }
});

Deno.test('a GET of a selected collection lists 204', () => {
    for (const uri of [
        '/identities/',
        '/identities/:id/invitations/',
        '/organizations/:id/ideas/',
        '/organizations/:id/invitations/',
    ]) {
        assert(codesOf('GET', uri).includes('204'), uri);
    }
    assert(!codesOf('GET', '/identities/:id').includes('204'));
});

Deno.test('a membership item lists 405 and no DELETE room, and'
    + ' its writes list 409', () => {
    for (const uri of [
        '/organizations/:id/invitations/:membership-id',
        '/identities/:id/invitations/:membership-id',
    ]) {
        assertStrictEquals(
            API_DOC_ROOMS.find((room) =>
                room.verb === 'DELETE' && room.uri === '/api' + uri
            ),
            undefined,
            uri,
        );
        const got = codesOf('GET', uri);
        assert(got.includes('405'), uri);
        assert(!got.includes('410'), uri);
        assert(!got.includes('409'), uri);
        const put = codesOf('PUT', uri);
        assert(put.includes('405'), uri);
        assert(put.includes('409'), uri);
    }
    const invite = codesOf('POST', '/organizations/:id/invitations/');
    assert(invite.includes('409'));
    assert(!invite.includes('405'));
});

Deno.test('a POST that only creates lists 201 and not 200', () => {
    for (const uri of [
        '/identities/',
        '/organizations/:id/flows/',
        '/organizations/:id/work-orders/',
        '/organizations/:id/objectives/',
        '/organizations/:id/memberships/',
    ]) {
        const codes = codesOf('POST', uri);
        assert(codes.includes('201'), uri + ' ' + codes.join(','));
        assert(!codes.includes('200'), uri + ' ' + codes.join(','));
    }
    for (const uri of [
        '/organizations/:id/invitations/',
        '/organizations/:organization-id/record-types/',
    ]) {
        const codes = codesOf('POST', uri);
        assert(
            codes.includes('200') && codes.includes('201'),
            uri + ' ' + codes.join(','),
        );
    }
});

// A room no route offers, holding one of each thing the
// presenter paints.
const ROOM: ApiDocRoom = {
    hash: 'patch/organizations/id/flows/id',
    verb: 'PATCH',
    uri: '/api/organizations/:id/flows/:id',
    tier: 'admin',
    headerSets: [{
        when: 'grant_type=refresh',
        headers: [
            { name: 'cookie', state: 'required', alternatives: [] },
            {
                name: 'if-match',
                state: 'alternative',
                alternatives: ['if-match', 'if-none-match'],
            },
        ],
    }],
    query: [],
    answers: [
        { code: '200', line: 'Replaced.' },
        { code: '412', line: 'The ETag is stale. Read again.' },
    ],
    related: [
        { hash: 'get/organizations/id/flows', label: 'the collection' },
    ],
    sample: {
        kind: 'sample',
        path: 'samples/patch/organizations/id/flows/id.json',
    },
};

Deno.test('roomHtml paints the title, answers with lines, and'
    + ' status links', () => {
    const markup = roomHtml(ROOM).toString();
    assertMatch(
        markup,
        /<h1[^>]*>PATCH \/api\/organizations\/:id\/flows\/:id<\/h1>/,
    );
    assertMatch(markup, /organization admin only/);
    assertMatch(markup, /grant_type=refresh/);
    assertMatch(markup, /cookie: required/);
    assertMatch(markup, /if-match: one of if-match, if-none-match/);
    assertMatch(
        markup, /<a href="#statuses\/200">200<\/a> Replaced\./,
    );
    assertMatch(
        markup,
        /<a href="#statuses\/412">412<\/a> The ETag is stale\./,
    );
    assertNotMatch(markup, /statuses\/412\//);
    assertMatch(
        markup,
        /<a href="#get\/organizations\/id\/flows">the collection<\/a>/,
    );
    assertNotMatch(markup, /No sample/);
    assertNotMatch(markup, /style=/);
});

Deno.test('roomHtml paints the reason a room has no sample',
() => {
    const markup = roomHtml({
        ...ROOM,
        related: [],
        sample: { kind: 'none', reason: 'No recipe writes it.' },
    }).toString();
    assertMatch(markup, /No sample/);
    assertMatch(markup, /No recipe writes it\./);
    assertNotMatch(markup, /Related/);
});
