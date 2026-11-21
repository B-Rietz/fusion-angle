import {
    assert,
    assertEquals,
    assertMatch,
    assertNotMatch,
    assertStrictEquals,
} from '@std/assert';
import { routes } from '../api/routes.ts';
import { STATUS_DOCUMENTS } from
    '../api/http-status-documents.ts';
import { API_ELEVATION_SVG } from
    '../web-app/api-documentation/elevation.ts';
import {
    API_DOC_ROOMS,
    API_DOC_STATUSES,
} from '../web-app/api-documentation/rooms.ts';
import { readSample } from '../web-app/api-documentation/shapes.ts';
import {
    roomHashOf,
    roomPathOf,
    svgOf,
} from '../web-app/app/generate-api-documentation.ts';
import { offeredVerbs, uriOf } from
    '../api/route-surface.ts';

Deno.test('test validate runs generate-api-documentation'
    + ' --check', () => {
    const src = Deno.readTextFileSync('test');
    assertMatch(
        src,
        /generate-api-documentation --check/,
    );
    assertNotMatch(src, /API-TREE\.md/);
});

Deno.test('a known collection is drawn with /',
() => {
    const svg = svgOf(routes);
    assertMatch(svg, /\/api\/identities\//);
    assertNotMatch(
        svg, /\/invitations\/sent/,
    );
});

Deno.test('filled GET circle hrefs the identities'
    + ' collection room', () => {
    const row = routes.find((r) =>
        uriOf(r) === '/identities/');
    assert(row);
    assert(offeredVerbs(row).includes('get'));
    assertStrictEquals(
        roomPathOf('get', row.segments),
        'get/identities/index.html',
    );
});

Deno.test('svg draws the /api/ wire prefix',
() => {
    const svg = svgOf(routes);
    assertMatch(svg, /\/api\/identities\//);
    assertMatch(
        svg, /\/api\/authentication\/token/,
    );
});

Deno.test('the map names /invitations/ as backing',
() => {
    const svg = svgOf(routes);
    assertMatch(svg, /\/invitations\//);
    assertMatch(svg, /backing/);
});

Deno.test('rooms stay a page tree, not an /api/ folder',
() => {
    const row = routes.find((r) =>
        uriOf(r) === '/identities/');
    assert(row);
    assertStrictEquals(
        roomPathOf('get', row.segments),
        'get/identities/index.html',
    );
});

Deno.test('roomHashOf drops the html leaf', () => {
    const row = routes.find((r) =>
        uriOf(r) === '/identities/');
    assert(row);
    assertStrictEquals(
        roomHashOf('get', row.segments),
        'get/identities',
    );
    assertStrictEquals(
        roomPathOf('get', row.segments),
        'get/identities/index.html',
    );
});

Deno.test('filled GET circle hrefs the identities hash',
() => {
    const svg = svgOf(routes);
    assertMatch(svg, /href="#get\/identities"/);
    assertNotMatch(
        svg, /href="get\/identities\/index.html"/,
    );
});

Deno.test('compose skips TypeScript sources', () => {
    const src = Deno.readTextFileSync(
        'web-app/app/compose.ts',
    );
    assertMatch(src, /name\.endsWith\('\.ts'\)/);
});

Deno.test('elevation module matches svgOf', () => {
    assertStrictEquals(
        API_ELEVATION_SVG, svgOf(routes),
    );
});

Deno.test('every offered verb has a catalog room',
() => {
    const hashes = new Set(
        API_DOC_ROOMS.map((room) => room.hash),
    );
    for (const row of routes) {
        for (const verb of offeredVerbs(row)) {
            const hash = roomHashOf(
                verb, row.segments,
            );
            assert(hashes.has(hash), hash);
            const room = API_DOC_ROOMS.find(
                (entry) => entry.hash === hash,
            );
            assert(room);
            assertStrictEquals(
                room.hash, hash,
            );
        }
    }
});

Deno.test('every status document has a catalog status',
() => {
    const hashes = new Set(
        API_DOC_STATUSES.map((row) => row.hash),
    );
    for (const doc of STATUS_DOCUMENTS) {
        const hash = 'statuses/' + String(doc.code);
        assert(hashes.has(hash), hash);
    }
});

// The page CSP (style-src 'self') would drop a <style>
// block, so a font the width budget assumes rides on
// the text itself, as each fill does.
Deno.test('every elevation text carries its own font',
() => {
    const texts = svgOf(routes).match(/<text [^>]*>/g);
    assert(texts);
    for (const text of texts) {
        assertMatch(text, / font-family="[^"]+"/);
        assertMatch(text, / font-size="[^"]+"/);
    }
});

// The gate answers the status route before it reads a
// credential or an Operation-ID, and the route stores no
// pair, so its answer carries none of a pair's lines.
const STATUS_HASH = 'get/status';
const CREDENTIAL_LINES = ['authorization', 'operation-id'];
const PAIR_LINES = [
    'last-modified',
    'requester-identity-id',
    'response-at',
];

Deno.test('the status room names no credential line, no'
    + ' stored pair, and its three statuses', () => {
    const room = API_DOC_ROOMS.find(
        (candidate) => candidate.hash === STATUS_HASH,
    );
    assert(room);
    assertStrictEquals(room.tier, 'none');
    const declared = room.headerSets.flatMap(
        (set) => set.headers.map((header) => header.name),
    );
    for (const name of CREDENTIAL_LINES) {
        assert(!declared.includes(name), name);
    }
    assertEquals(
        room.answers.map((answer) => answer.code),
        ['200', '500', '503'],
    );
    assert(room.sample.kind === 'sample');
    const read = readSample(JSON.parse(Deno.readTextFileSync(
        'web-app/api-documentation/' + room.sample.path,
    )));
    assert(read.kind === 'sample', STATUS_HASH);
    for (const exchange of read.sample.exchanges) {
        const sent = exchange.request.headers.map(([name]) => name);
        for (const name of CREDENTIAL_LINES) {
            assert(!sent.includes(name), name);
        }
        const answered = exchange.response.headers.map(
            ([name]) => name,
        );
        for (const name of PAIR_LINES) {
            assert(!answered.includes(name), name);
        }
    }
});
