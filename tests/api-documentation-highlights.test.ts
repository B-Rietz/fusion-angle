// The two highlights on an example exchange's header
// lines. Essential: a header the documentation names.
// Provided: a response header the product sets for a
// reader to use. These tests read the committed catalog
// and samples under web-app/api-documentation/.

import {
    assert,
    assertEquals,
    assertNotMatch,
    assertStrictEquals,
    assertThrows,
} from '@std/assert';
import { RESPONSE_HEADERS } from '../api/response-header-names.ts';
import {
    requestHighlightOf,
    responseHighlightOf,
    roomCalledBy,
} from '../web-app/api-documentation/highlights.ts';
import {
    endpointHtml,
    stepHtml,
} from '../web-app/api-documentation/presenter.ts';
import {
    API_DOC_PROVIDED_HEADERS,
    API_DOC_ROOMS,
    API_DOC_STEPS,
    type ApiDocRoom,
    type ApiDocStep,
} from '../web-app/api-documentation/rooms.ts';
import {
    type ApiDocRequest,
    type ApiDocSample,
    readSample,
} from '../web-app/api-documentation/shapes.ts';
import {
    type Catalog,
    guardCatalog,
    roomsTsOf,
} from '../web-app/app/generate-api-documentation.ts';

const TREE = 'web-app/api-documentation/';
const ORIGIN = 'https://docs.example';

function sampleAt(path: string): ApiDocSample {
    const read = readSample(
        JSON.parse(Deno.readTextFileSync(TREE + path)),
    );
    if (read.kind === 'fault') {
        throw new Error(path + ': ' + read.reason);
    }
    return read.sample;
}

function sampleOf(view: ApiDocRoom | ApiDocStep): ApiDocSample {
    assert(view.sample.kind === 'sample', view.hash);
    return sampleAt(view.sample.path);
}

function roomAt(hash: string): ApiDocRoom {
    const room = API_DOC_ROOMS.find((entry) => entry.hash === hash);
    assert(room !== undefined, hash);
    return room;
}

function stepAt(hash: string): ApiDocStep {
    const step = API_DOC_STEPS.find((entry) => entry.hash === hash);
    assert(step !== undefined, hash);
    return step;
}

Deno.test('the catalog names the response headers the product'
    + ' sets', () => {
    assertEquals(
        API_DOC_PROVIDED_HEADERS, Object.values(RESPONSE_HEADERS),
    );
});

const NO_CATALOG: Catalog = {
    rooms: [],
    statuses: [],
    steps: [],
    transport: [],
    genericAnswers: [],
    curlAdds: [],
};

// The guard searches for each known secret verbatim, so a
// provided name handed to it as one is found only where the
// provided names are among the texts searched.
Deno.test('the provided names pass the guard the catalog passes',
() => {
    guardCatalog(NO_CATALOG, []);
    assertStrictEquals(
        roomsTsOf(NO_CATALOG)
            .includes("'" + RESPONSE_HEADERS.contentLocation + "',"),
        true,
    );
    const refusal = assertThrows(
        () => guardCatalog(
            NO_CATALOG, [RESPONSE_HEADERS.contentLocation],
        ),
        Error,
    );
    assertStrictEquals(
        refusal.message, 'credential-shaped text in rooms.ts (known)',
    );
});

Deno.test('every sample exchange calls exactly one endpoint',
() => {
    let exchanges = 0;
    for (const room of API_DOC_ROOMS) {
        if (room.sample.kind === 'none') continue;
        for (const { request } of sampleOf(room).exchanges) {
            assertStrictEquals(
                roomCalledBy(request, API_DOC_ROOMS), room, room.hash,
            );
            exchanges += 1;
        }
    }
    for (const step of API_DOC_STEPS) {
        for (const { request } of sampleOf(step).exchanges) {
            const called = roomCalledBy(request, API_DOC_ROOMS);
            assertStrictEquals(called.verb, request.method, step.hash);
            exchanges += 1;
        }
    }
    assert(exchanges > API_DOC_ROOMS.length);
});

function roomOn(verb: string, uri: string): ApiDocRoom {
    return {
        hash: verb.toLowerCase() + uri,
        verb,
        uri,
        tier: 'member',
        headerSets: [],
        query: [],
        answers: [],
        related: [],
        sample: { kind: 'none', reason: 'A room of the test.' },
    };
}

function requestOf(method: string, target: string): ApiDocRequest {
    return { method, target, headers: [], body: { kind: 'empty' } };
}

Deno.test('a route parameter stands for one segment, never an'
    + ' empty one', () => {
    const collection = roomOn('GET', '/api/things/');
    const item = roomOn('GET', '/api/things/:id');
    const write = roomOn('PUT', '/api/things/:id');
    const rooms = [collection, item, write];
    assertStrictEquals(
        roomCalledBy(requestOf('GET', '/api/things/'), rooms),
        collection,
    );
    assertStrictEquals(
        roomCalledBy(requestOf('GET', '/api/things/one'), rooms), item,
    );
    assertStrictEquals(
        roomCalledBy(requestOf('PUT', '/api/things/one'), rooms), write,
    );
    assertStrictEquals(
        roomCalledBy(
            requestOf('GET', '/api/things/one?state=pending'), rooms,
        ),
        item,
    );
    assertStrictEquals(
        roomCalledBy(requestOf('GET', '/api/things/?state=a/b'), rooms),
        collection,
    );
});

Deno.test('an exchange that calls no endpoint, or two, is refused',
() => {
    const item = roomOn('GET', '/api/things/:id');
    const rooms = [item, roomOn('GET', '/api/things/:name')];
    const none = assertThrows(
        () => roomCalledBy(requestOf('DELETE', '/api/things/one'), rooms),
        Error,
    );
    assertStrictEquals(
        none.message,
        'DELETE /api/things/one calls 0 endpoints, not one',
    );
    const deeper = assertThrows(
        () => roomCalledBy(
            requestOf('GET', '/api/things/one/more'), [item],
        ),
        Error,
    );
    assertStrictEquals(
        deeper.message,
        'GET /api/things/one/more calls 0 endpoints, not one',
    );
    const two = assertThrows(
        () => roomCalledBy(requestOf('GET', '/api/things/one'), rooms),
        Error,
    );
    assertStrictEquals(
        two.message, 'GET /api/things/one calls 2 endpoints, not one',
    );
});

const PUT_FLOW = 'put/organizations/id/flows/id';

Deno.test('a request header the endpoint or the transport lists'
    + ' is essential', () => {
    const room = roomAt(PUT_FLOW);
    for (const name of ['authorization', 'operation-id', 'if-match']) {
        assertStrictEquals(
            requestHighlightOf(name, room), 'essential', name,
        );
    }
    // The transport sets list it, the endpoint's own do not.
    assertStrictEquals(
        requestHighlightOf('content-length', room), 'essential',
    );
    // Declared for a QUERY alone, so plain on a PUT.
    assertStrictEquals(
        requestHighlightOf('content-type', room), 'plain',
    );
    assertStrictEquals(
        requestHighlightOf(
            'content-type', roomAt('query/organizations/id/memberships'),
        ),
        'essential',
    );
    assertStrictEquals(requestHighlightOf('accept', room), 'plain');
    // A provided name is a response's: a request never
    // takes that highlight.
    assertStrictEquals(
        requestHighlightOf('last-modified', room), 'plain',
    );
});

Deno.test('a response header is essential where the words name it'
    + ' whole, in any case', () => {
    assertStrictEquals(
        responseHighlightOf('etag', ['Read again for the ETag.']),
        'essential',
    );
    assertStrictEquals(
        responseHighlightOf(
            'authentication-info',
            ['First.', 'It answers a code in Authentication-Info.'],
        ),
        'essential',
    );
    assertStrictEquals(
        responseHighlightOf('date', ['It adds date where none is.']),
        'essential',
    );
    // A name inside a longer one, or inside a word, is not
    // named.
    assertStrictEquals(
        responseHighlightOf('date', ['The copy is up-to-date.']),
        'plain',
    );
    assertStrictEquals(
        responseHighlightOf('date', ['Send the update again.']), 'plain',
    );
    assertStrictEquals(
        responseHighlightOf('location', ['Read Content-Location.']),
        'provided',
    );
});

Deno.test('a header the product sets is provided, and essential'
    + ' when it is both', () => {
    for (const name of API_DOC_PROVIDED_HEADERS) {
        assertStrictEquals(responseHighlightOf(name, []), 'provided');
    }
    assertStrictEquals(
        responseHighlightOf('etag', ['Keep its ETag.']), 'essential',
    );
    for (const name of ['content-length', 'date', 'content-type']) {
        assertStrictEquals(responseHighlightOf(name, []), 'plain', name);
    }
});

const MESSAGE_OPEN = '<pre class="api-doc-pre api-doc-message">';

// The message blocks of a view's markup, in order: each
// request, then its response.
function messagesOf(markup: string): readonly string[] {
    return [...markup.matchAll(
        /<pre class="api-doc-pre api-doc-message">([\s\S]*?)<\/pre>/g,
    )].map((pre) => pre[1]!);
}

const HIGHLIGHT_NAMES: Readonly<Record<string, string>> = {
    essential: 'Essential',
    provided: 'Provided',
};

// A highlighted line as the presenter paints it: the
// kind's class, its shape, its name for a reader who sees
// neither, then the header line. A value's `<` is escaped,
// so the line ends at the first tag.
const HIGHLIGHTED = new RegExp(
    '<mark class="api-doc-highlight api-doc-highlight-(\\w+)">'
    + '<span class="api-doc-highlight-shape" aria-label="(\\w+)"'
    + ' role="img"></span>'
    + '([a-z0-9-]+): [^<]*</mark>',
    'g',
);

// A highlighted header line: its kind, then its name.
type Painted = readonly [string, string];

// Each highlighted header line of one message block, in
// the order painted.
function paintedIn(message: string): readonly Painted[] {
    return [...message.matchAll(HIGHLIGHTED)].map(
        ([, kind, , name]) => [kind!, name!] as const,
    );
}

// Each highlighted header of one message block, by name.
function highlightsOf(message: string): Record<string, string> {
    return Object.fromEntries(
        paintedIn(message).map(([kind, name]) => [name, kind]),
    );
}

function endpointMarkup(room: ApiDocRoom): string {
    return endpointHtml(
        room, { kind: 'sample', sample: sampleOf(room) }, ORIGIN,
    ).toString();
}

function stepMarkup(step: ApiDocStep): string {
    return stepHtml(
        step, { kind: 'sample', sample: sampleOf(step) }, ORIGIN,
    ).toString();
}

Deno.test('an endpoint\'s exchange highlights what its facts name'
    + ' and what the product sets', () => {
    const markup = endpointMarkup(roomAt(PUT_FLOW));
    const [request, response, ...more] = messagesOf(markup);
    assert(request !== undefined && response !== undefined);
    assertStrictEquals(more.length, 0);
    assertEquals(highlightsOf(request), {
        authorization: 'essential',
        'if-match': 'essential',
        'operation-id': 'essential',
        'content-length': 'essential',
    });
    // The answers name the ETag, which the product also
    // sets: both, so essential. content-length, date, and
    // content-type are named by no rule, and stay plain.
    assertEquals(highlightsOf(response), {
        etag: 'essential',
        'last-modified': 'provided',
        'operation-id': 'provided',
        'request-id': 'provided',
    });
    assertNotMatch(markup, /style=/);
});

function answerLinesOf(room: ApiDocRoom): readonly string[] {
    return room.answers.map(({ line }) => line);
}

function highlighted(
    names: readonly string[],
    kindOf: (name: string) => string,
): readonly Painted[] {
    return names
        .map((name) => [kindOf(name), name] as const)
        .filter(([kind]) => kind !== 'plain');
}

// What each message block of a view must paint, in order:
// a request by the endpoint's header sets, and a response,
// its parts included, by the words.
function expectedOf(
    sample: ApiDocSample,
    roomOf: (request: ApiDocRequest) => ApiDocRoom,
    wordsOf: (room: ApiDocRoom) => readonly string[],
): readonly (readonly Painted[])[] {
    return sample.exchanges.flatMap(({ request, response }) => {
        const room = roomOf(request);
        const words = wordsOf(room);
        const { body } = response;
        const answered = [
            ...response.headers,
            ...(body.kind === 'multipart'
                ? body.parts.flatMap((part) => part.headers)
                : []),
        ];
        return [
            highlighted(
                request.headers.map(([name]) => name),
                (name) => requestHighlightOf(name, room),
            ),
            highlighted(
                answered.map(([name]) => name),
                (name) => responseHighlightOf(name, words),
            ),
        ];
    });
}

Deno.test('every endpoint paints each header line by its own'
    + ' header sets and answer lines', () => {
    for (const room of API_DOC_ROOMS) {
        if (room.sample.kind === 'none') continue;
        assertEquals(
            messagesOf(endpointMarkup(room)).map(paintedIn),
            expectedOf(sampleOf(room), () => room, answerLinesOf),
            room.hash,
        );
    }
});

Deno.test('every step paints each header line by the endpoint'
    + ' its exchange calls and by its own prose', () => {
    for (const step of API_DOC_STEPS) {
        assertEquals(
            messagesOf(stepMarkup(step)).map(paintedIn),
            expectedOf(
                sampleOf(step),
                (request) => roomCalledBy(request, API_DOC_ROOMS),
                (room) => [...step.prose, ...answerLinesOf(room)],
            ),
            step.hash,
        );
    }
});

Deno.test('a step\'s words and its endpoints\' reach its exchanges',
() => {
    // The sign-in step's prose names Authentication-Info.
    const signIn = messagesOf(stepMarkup(stepAt('start/sign-in')));
    assertStrictEquals(signIn.length, 4);
    for (const response of [signIn[1]!, signIn[3]!]) {
        assertStrictEquals(
            highlightsOf(response)['authentication-info'], 'essential',
        );
    }
    // The registration's own header sets list If-None-Match.
    const unattended = messagesOf(
        stepMarkup(stepAt('start/unattended')),
    );
    assertStrictEquals(unattended.length, 6);
    assertEquals(highlightsOf(unattended[2]!), {
        authorization: 'essential',
        'if-none-match': 'essential',
        'operation-id': 'essential',
        'content-length': 'essential',
    });
});

Deno.test('the framing headers are highlighted only where the'
    + ' open view names them', () => {
    const [, everyRequest] = messagesOf(
        stepMarkup(stepAt('start/operation-id')),
    );
    assert(everyRequest !== undefined);
    const named = highlightsOf(everyRequest);
    assertStrictEquals(named['content-length'], 'essential');
    assertStrictEquals(named['date'], 'essential');
    const [, read] = messagesOf(stepMarkup(stepAt('start/read')));
    assert(read !== undefined);
    const unnamed = highlightsOf(read);
    assertStrictEquals(unnamed['content-length'], undefined);
    assertStrictEquals(unnamed['date'], undefined);
});

const FLOWS = 'get/organizations/id/flows';

Deno.test('a part\'s headers are highlighted as the response\'s'
    + ' are', () => {
    const room = roomAt(FLOWS);
    const [, response] = messagesOf(endpointMarkup(room));
    assert(response !== undefined);
    const body = sampleOf(room).exchanges[0]!.response.body;
    assert(body.kind === 'multipart' && body.parts.length > 0);
    // The response's own request-id, then each part's.
    assertStrictEquals(
        paintedIn(response)
            .filter(([, name]) => name === 'request-id').length,
        1 + body.parts.length,
    );
    assertStrictEquals(highlightsOf(response)['last-modified'], 'provided');
});

Deno.test('each highlight carries its shape and its name, never'
    + ' colour alone', () => {
    const markup = endpointMarkup(roomAt(PUT_FLOW));
    const marks = [...markup.matchAll(/<mark class="api-doc-highlight /g)];
    const lines = [...messagesOf(markup).join('\n').matchAll(HIGHLIGHTED)];
    assert(lines.length > 0);
    for (const [, kind, label] of lines) {
        assertStrictEquals(label, HIGHLIGHT_NAMES[kind!]);
    }
    // Every other mark of the kind is the legend's, one for
    // each highlight.
    const legends = [...markup.matchAll(/<ul class="api-doc-legend"/g)];
    assertStrictEquals(legends.length, 1);
    assertStrictEquals(
        marks.length,
        lines.length + Object.keys(HIGHLIGHT_NAMES).length,
    );
});

const LEGEND_OPEN = '<ul class="api-doc-legend"';
const CURL_OPEN = 'data-api-docs-curl>';

Deno.test('a legend above each exchange\'s request says what each'
    + ' highlight means', () => {
    const legend = new RegExp(
        LEGEND_OPEN + ' aria-label="Header highlights">\\s*'
        + Object.entries(HIGHLIGHT_NAMES).map(([kind, name]) =>
            '<li><mark class="api-doc-highlight api-doc-highlight-'
            + kind + '">'
            + '<span class="api-doc-highlight-shape" aria-hidden="true">'
            + '</span>' + name + '</mark>([^<]+)</li>\\s*'
        ).join('')
        + '</ul>',
        'g',
    );
    const blocks = new RegExp(
        [CURL_OPEN, LEGEND_OPEN, MESSAGE_OPEN].join('|'), 'g',
    );
    for (const step of API_DOC_STEPS) {
        const markup = stepMarkup(step);
        const { exchanges } = sampleOf(step);
        const legends = [...markup.matchAll(legend)];
        assertStrictEquals(legends.length, exchanges.length, step.hash);
        for (const [, essential, provided] of legends) {
            assertStrictEquals(
                essential, ' a header this documentation names',
            );
            assertStrictEquals(
                provided, ' a header the API sets for you to use',
            );
        }
        // Each exchange runs its curl, the legend, the
        // request, then the response.
        assertEquals(
            [...markup.matchAll(blocks)].map(([found]) => found),
            exchanges.flatMap(() => [
                CURL_OPEN, LEGEND_OPEN, MESSAGE_OPEN, MESSAGE_OPEN,
            ]),
            step.hash,
        );
    }
});

Deno.test('a view whose sample is not read paints no legend', () => {
    const markup = endpointHtml(
        roomAt(PUT_FLOW), { kind: 'loading' }, ORIGIN,
    ).toString();
    assertNotMatch(markup, /api-doc-legend|api-doc-highlight/);
});
