import {
    assert,
    assertEquals,
    assertMatch,
    assertNotMatch,
    assertStrictEquals,
    assertStringIncludes,
} from '@std/assert';
import {
    API_DOC_CURL_ADDS,
    API_DOC_GENERIC_ANSWERS,
    API_DOC_STEPS,
    API_DOC_TRANSPORT,
    type ApiDocRoom,
    type ApiDocStatus,
} from '../web-app/api-documentation/rooms.ts';
import {
    endpointHtml,
    sampleAnnouncementText,
    type SampleState,
    startCardHtml,
    statusHtml,
    stepHtml,
    unknownHtml,
} from '../web-app/api-documentation/presenter.ts';
import {
    type ApiDocHeaderLine,
    type ApiDocSample,
    readSample,
} from '../web-app/api-documentation/shapes.ts';
import { escapeForHtml } from '../web-app/app/safe-html.ts';

const status: ApiDocStatus = {
    hash: 'statuses/401',
    code: '401',
    body: '{\n  "error": "invalid_token"\n}',
};

Deno.test('statusHtml paints code and body', () => {
    const markup = statusHtml(status).toString();
    assertMatch(markup, /<h1[^>]*>401<\/h1>/);
    assertMatch(markup, /invalid_token/);
    assertNotMatch(markup, /style=/);
});

Deno.test('unknownHtml names the miss', () => {
    const markup = unknownHtml('not-a-room').toString();
    assert(markup.length > 0);
    assertMatch(markup, /Not a room/);
    assertMatch(markup, /not-a-room/);
    assertNotMatch(markup, /data-api-docs-back/);
    assertNotMatch(markup, /style=/);
});

// A room no route offers, holding one of each fact the
// endpoint view paints.
const ROOM: ApiDocRoom = {
    hash: 'get/organizations/id/invitations',
    verb: 'GET',
    uri: '/api/organizations/:id/invitations/',
    tier: 'admin',
    headerSets: [{
        when: '',
        headers: [
            {
                name: 'authorization',
                state: 'required',
                alternatives: [],
            },
            {
                name: 'request-id',
                state: 'forbidden',
                alternatives: [],
            },
        ],
    }],
    query: [{
        name: 'state',
        values: ['pending', 'revoked'],
        absent: 'every',
    }],
    answers: [
        { code: '200', line: 'The invitations.' },
        { code: '401', line: 'No bearer.' },
    ],
    related: [{
        hash: 'get/organizations/id/invitations/id',
        label: 'the item',
    }],
    sample: {
        kind: 'sample',
        path: 'samples/get/organizations/id/flows.json',
    },
};

const ORIGIN = 'https://docs.example';

const LOADING: SampleState = { kind: 'loading' };

Deno.test('an endpoint with no sample shows its reason', () => {
    const markup = endpointHtml({
        ...ROOM,
        sample: { kind: 'none', reason: 'No recipe writes it.' },
    }, LOADING, ORIGIN).toString();
    assertMatch(markup, /No sample/);
    assertMatch(markup, /No recipe writes it\./);
    assertNotMatch(markup, /Loading/);
    assertNotMatch(markup, /data-api-docs-retry/);
    assertNotMatch(markup, /style=/);
});

Deno.test('a failed sample says so and offers a retry', () => {
    const markup = endpointHtml(ROOM, {
        kind: 'fault',
        reason: 'samples/get/organizations/id/flows.json'
            + ' answered 404',
    }, ORIGIN).toString();
    assertMatch(markup, /did not load/);
    assertMatch(markup, /flows\.json answered 404/);
    assertMatch(
        markup, /<button type="button"[^>]*data-api-docs-retry/,
    );
    assertMatch(markup, /<a href="#statuses\/401">401<\/a>/);
    assertNotMatch(markup, /style=/);
});

const FLOWS_SAMPLE_PATH =
    'web-app/api-documentation/samples/get/organizations/id'
    + '/flows.json';

async function flowsSample(): Promise<ApiDocSample> {
    const read = readSample(JSON.parse(
        await Deno.readTextFile(FLOWS_SAMPLE_PATH),
    ));
    if (read.kind === 'fault') throw new Error(read.reason);
    return read.sample;
}

function occurrencesOf(text: string, part: string): number {
    return text.split(part).length - 1;
}

const ENTITIES: Readonly<Record<string, string>> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
};

// What a browser's `textContent` reads from this markup:
// its tags dropped and its five escapes undone.
function textContentOf(markup: string): string {
    return markup.replace(/<[^>]*>/g, '')
        .replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) =>
            ENTITIES[entity]!
        );
}

// The text each curl block paints, in order: what its
// copy button copies.
function curlTextsOf(markup: string): string[] {
    return [...markup.matchAll(
        /<pre[^>]*data-api-docs-curl>([\s\S]*?)<\/pre>/g,
    )].map((pre) => textContentOf(pre[1]!));
}

Deno.test('the endpoint view paints facts beside the sample',
async () => {
    const sample = await flowsSample();
    const markup = endpointHtml(
        ROOM, { kind: 'sample', sample }, ORIGIN,
    ).toString();
    const facts = markup.indexOf('class="api-doc-facts"');
    const beside = markup.indexOf('class="api-doc-sample"');
    assert(facts > 0 && beside > facts);
    assertMatch(markup, new RegExp(
        '<span class="api-doc-role api-doc-role-admin">\\s*'
        + '<span class="api-doc-role-shape" aria-hidden="true">'
        + '</span>\\s*organization admin</span>',
    ));
    assertMatch(markup, /authorization: required/);
    assertMatch(markup, /request-id: forbidden/);
    assertMatch(markup, /\?state=/);
    assertMatch(markup, /pending, revoked/);
    assertMatch(markup, /Absent: every/);
    assertMatch(
        markup, /<a href="#statuses\/200">200<\/a> The invitations\./,
    );
    assertMatch(
        markup,
        /<a href="#get\/organizations\/id\/invitations\/id">the item<\/a>/,
    );
    const curls = curlTextsOf(markup);
    assertEquals(curls, sample.exchanges.map(
        (exchange) => exchange.curl.split('$ORIGIN').join(ORIGIN),
    ));
    assertMatch(
        curls[0]!,
        /curl -i -X GET "https:\/\/docs\.example\/api\/organizations\//,
    );
    assertNotMatch(markup, /\$ORIGIN/);
    assertMatch(
        markup, /<button type="button"[^>]*data-api-docs-copy/,
    );
    assertNotMatch(markup, /Loading/);
    assertNotMatch(markup, /style=/);
});

Deno.test('a multipart sample shows two parts and the count',
async () => {
    const sample = await flowsSample();
    const body = sample.exchanges[0]!.response.body;
    assert(body.kind === 'multipart');
    assertStrictEquals(body.parts.length, 2);
    const markup = endpointHtml(
        ROOM, { kind: 'sample', sample }, ORIGIN,
    ).toString();
    // Two parts open with the delimiter, and the close
    // carries it once more.
    assertStrictEquals(
        occurrencesOf(markup, '--' + body.boundary), 3,
    );
    assertStrictEquals(
        occurrencesOf(markup, '--' + body.boundary + '--'), 1,
    );
    assertMatch(
        markup,
        new RegExp('… ' + body.more + ' more part'
            + (body.more === 1 ? '' : 's')),
    );
});

Deno.test('every header the replay sent and received is painted',
async () => {
    const sample = await flowsSample();
    const markup = endpointHtml(
        ROOM, { kind: 'sample', sample }, ORIGIN,
    ).toString();
    const lines: ApiDocHeaderLine[] = [];
    for (const exchange of sample.exchanges) {
        lines.push(...exchange.request.headers);
        lines.push(...exchange.response.headers);
        const body = exchange.response.body;
        if (body.kind === 'multipart') {
            for (const part of body.parts) {
                lines.push(...part.headers);
            }
        }
    }
    assert(lines.length > 0);
    for (const [name, value] of lines) {
        assertStringIncludes(
            markup, escapeForHtml(name + ': ' + value),
        );
    }
});

Deno.test('each path id is marked with its source', async () => {
    const sample = await flowsSample();
    const markup = endpointHtml(
        ROOM, { kind: 'sample', sample }, ORIGIN,
    ).toString();
    assertStringIncludes(
        markup,
        '<mark data-path-id class="api-doc-path-id" title="'
            + 'Replace with your :id; GET'
            + ' /api/identities/:id/organizations/ lists it.">'
            + 'AjdvjuECVZEgZoFajaIEkg</mark>',
    );
    assertStringIncludes(
        markup,
        '<a href="#get/identities/id/organizations">'
            + 'GET /api/identities/:id/organizations/</a>',
    );
    const own = endpointHtml(ROOM, {
        kind: 'sample',
        sample: {
            ...sample,
            pathIds: [{
                name: ':id',
                value: 'AAAAAAAAAAAAAAAAAAAAAA',
                source: '',
            }],
        },
    }, ORIGIN).toString();
    assertStringIncludes(
        own,
        '<mark data-path-id class="api-doc-path-id" title="'
            + 'Replace with your own :id.">'
            + 'AAAAAAAAAAAAAAAAAAAAAA</mark>',
    );
    assertNotMatch(own, /href="#get\/identities\/id\/organizations"/);
});

function chipsOf(markup: string): string[] {
    return [...markup.matchAll(new RegExp(
        '<span class="api-doc-role api-doc-role-(\\w+)">\\s*'
        + '<span class="api-doc-role-shape" aria-hidden="true">'
        + '</span>([^<]*)</span>',
        'g',
    ))].map((chip) => chip[1] + ': ' + chip[2]!.trim());
}

Deno.test('each role that may call has its own chip', () => {
    const member = endpointHtml(
        { ...ROOM, tier: 'member' }, LOADING, ORIGIN,
    ).toString();
    assertEquals(chipsOf(member), [
        'member: member',
        'member: organization admin',
    ]);
    assertMatch(member, new RegExp(
        '<div class="[^"]*" role="group" data-tier="member"'
        + ' aria-label="Who may call: member and organization'
        + ' admin">',
    ));
    const admin = endpointHtml(ROOM, LOADING, ORIGIN).toString();
    assertEquals(chipsOf(admin), ['admin: organization admin']);
    assertMatch(admin, /data-tier="admin"/);
    const none = endpointHtml(
        { ...ROOM, tier: 'none' }, LOADING, ORIGIN,
    ).toString();
    assertEquals(chipsOf(none), ['none: no token']);
    assertMatch(none, /data-tier="none"/);
});

Deno.test('each copy button names what it copies', async () => {
    const sample = await flowsSample();
    const exchange = sample.exchanges[0]!;
    const second = {
        ...exchange,
        request: { ...exchange.request, method: 'QUERY' },
    };
    const markup = endpointHtml(ROOM, {
        kind: 'sample',
        sample: { ...sample, exchanges: [exchange, second] },
    }, ORIGIN).toString();
    const names = [...markup.matchAll(new RegExp(
        '<button type="button"[^>]*aria-label="([^"]*)"[^>]*'
        + 'data-api-docs-copy',
        'g',
    ))].map((button) => button[1]);
    assertEquals(names, [
        'Copy the curl for GET ' + exchange.request.target,
        'Copy the curl for QUERY ' + exchange.request.target,
    ]);
});

const SAMPLES_DIRECTORY = 'web-app/api-documentation/';

async function sampleAt(path: string): Promise<ApiDocSample> {
    const read = readSample(JSON.parse(
        await Deno.readTextFile(SAMPLES_DIRECTORY + path),
    ));
    if (read.kind === 'fault') throw new Error(read.reason);
    return read.sample;
}

// Each part appears in the markup, each after the one
// before it.
function assertInOrder(
    markup: string,
    parts: readonly string[],
): void {
    let from = 0;
    for (const part of parts) {
        const at = markup.indexOf(part, from);
        assert(at >= 0, 'missing or out of order: ' + part);
        from = at + part.length;
    }
}

// The step that states what every request carries.
const EVERY_REQUEST_HASH = 'start/operation-id';

const CURL_ADDS_HEADING = 'Headers curl adds</h2>';
const TRANSPORT_HEADING = 'Transport headers</h2>';
const ANSWERS_HEADING = 'Answers any request may get</h2>';

// Step 2's three lists run curl's headers, then the
// transport headers, then the answers; within the
// transport list each header line is painted once, the
// first set labelled as holding for a request with a body
// and every later set's request named.
function assertTransportStatedOnce(markup: string): void {
    const curlAdds = markup.indexOf(CURL_ADDS_HEADING);
    const transport = markup.indexOf(TRANSPORT_HEADING);
    const answers = markup.indexOf(ANSWERS_HEADING);
    assert(
        curlAdds >= 0 && transport > curlAdds && answers > transport,
        'the lists run curl, transport, answers',
    );
    const section = markup.slice(transport, answers);
    assertMatch(
        section,
        /<p class="text-muted mt-2">[^<]*with a body[^<]*<\/p>/,
    );
    const names = new Set(API_DOC_TRANSPORT.flatMap(
        (set) => set.headers.map((header) => header.name),
    ));
    assert(names.size > 0);
    for (const name of names) {
        assertStrictEquals(
            occurrencesOf(section, '<li>' + name + ': '), 1, name,
        );
    }
    for (const set of API_DOC_TRANSPORT) {
        if (set.when === '') continue;
        assertStringIncludes(section, escapeForHtml(set.when));
    }
}

Deno.test('the guided start paints its steps in order with'
    + ' every exchange', async () => {
    const card = startCardHtml(API_DOC_STEPS).toString();
    assertEquals(
        [...card.matchAll(/<a href="#(start\/[^"]+)"/g)]
            .map((link) => link[1]),
        API_DOC_STEPS.map((step) => step.hash),
    );
    assertInOrder(card, API_DOC_STEPS.map(
        (step) => escapeForHtml(step.title),
    ));
    assertStringIncludes(
        card, escapeForHtml(API_DOC_STEPS[0]!.prose[0]!),
    );
    assertNotMatch(card, /style=/);
    for (const step of API_DOC_STEPS) {
        assert(step.sample.kind === 'sample', step.hash);
        const sample = await sampleAt(step.sample.path);
        const markup = stepHtml(
            step, { kind: 'sample', sample }, ORIGIN,
        ).toString();
        assertStringIncludes(
            markup, '>' + escapeForHtml(step.title) + '</h1>',
        );
        assertInOrder(markup, step.prose.map(escapeForHtml));
        assertInOrder(markup, step.shell.map(escapeForHtml));
        assertStrictEquals(
            occurrencesOf(markup, 'data-api-docs-copy>'),
            step.shell.length + sample.exchanges.length,
            step.hash,
        );
        assertEquals(curlTextsOf(markup), sample.exchanges.map(
            (exchange) => exchange.curl.split('$ORIGIN').join(ORIGIN),
        ), step.hash);
        assertNotMatch(markup, /\$ORIGIN/);
        for (const pathId of sample.pathIds) {
            assertStringIncludes(
                markup, '>' + pathId.value + '</mark>',
            );
        }
        const everyRequest = step.hash === EVERY_REQUEST_HASH;
        assertStrictEquals(
            markup.includes(TRANSPORT_HEADING),
            everyRequest,
            step.hash + ': transport headers',
        );
        if (everyRequest) assertTransportStatedOnce(markup);
        for (const name of API_DOC_CURL_ADDS) {
            assertStrictEquals(
                markup.includes('<code class="font-mono">'
                    + name + '</code>'),
                everyRequest,
                step.hash + ': ' + name,
            );
        }
        for (const answer of API_DOC_GENERIC_ANSWERS) {
            assertStrictEquals(
                markup.includes('<a href="#statuses/'
                    + answer.code + '">' + answer.code + '</a> '
                    + escapeForHtml(answer.line)),
                everyRequest,
                step.hash + ': ' + answer.line,
            );
        }
        assertNotMatch(markup, /style=/);
    }
});

Deno.test('a sample\'s state is announced in words, never by a'
    + ' region of its own', async () => {
    const fault: SampleState = {
        kind: 'fault',
        reason: 'samples/get/organizations/id/flows.json answered 404',
    };
    assertStrictEquals(
        sampleAnnouncementText(LOADING), 'Loading the sample.',
    );
    assertStrictEquals(
        sampleAnnouncementText(fault),
        'The sample did not load: ' + fault.reason,
    );
    assertStrictEquals(
        sampleAnnouncementText(
            { kind: 'sample', sample: await flowsSample() },
        ),
        '',
    );
    for (const state of [LOADING, fault]) {
        const markup = endpointHtml(ROOM, state, ORIGIN).toString();
        assertStringIncludes(markup, sampleAnnouncementText(state));
        assertNotMatch(markup, /role="(?:status|alert)"|aria-live/);
    }
});
