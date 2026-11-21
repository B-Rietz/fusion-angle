import {
    assert,
    assertEquals,
    assertMatch,
    assertNotMatch,
    assertStrictEquals,
    assertStringIncludes,
} from '@std/assert';
import {
    API_DOC_ROOMS,
    API_DOC_STATUSES,
} from '../web-app/api-documentation/rooms.ts';
import {
    type SearchHit,
    searchCatalog,
} from '../web-app/api-documentation/search.ts';
import {
    searchCountText,
    searchHitsHtml,
    viewAsHtml,
} from '../web-app/api-documentation/presenter.ts';

function search(query: string): readonly SearchHit[] {
    return searchCatalog(query, API_DOC_ROOMS, API_DOC_STATUSES);
}

function hashesOf(hits: readonly SearchHit[]): readonly string[] {
    return hits.map((hit) => hit.hash);
}

Deno.test("'412' finds every room listing 412, plus statuses/412",
() => {
    const listing = API_DOC_ROOMS
        .filter((room) =>
            room.answers.some((answer) => answer.code === '412'))
        .map((room) => room.hash);
    assert(listing.length > 0);
    const hits = search('412');
    assertEquals(hashesOf(hits), [...listing, 'statuses/412']);
    assertEquals(hits.at(-1), {
        hash: 'statuses/412',
        label: '412',
        tier: 'status',
    });
});

Deno.test("'if-match' finds rooms with that header", () => {
    const declaring = API_DOC_ROOMS
        .filter((room) => room.headerSets.some((set) =>
            set.headers.some((header) => header.name === 'if-match')))
        .map((room) => room.hash);
    assert(declaring.length > 0);
    assertEquals(hashesOf(search('if-match')), declaring);
    assertEquals(search('If-Match'), search('if-match'));
});

Deno.test("'flows' finds the flow URIs", () => {
    const flows = API_DOC_ROOMS
        .filter((room) => room.uri.includes('flows'));
    const hits = search('flows');
    assertEquals(
        hits,
        flows.map((room) => ({
            hash: room.hash,
            label: room.verb + ' ' + room.uri,
            tier: room.tier,
        })),
    );
    assert(hashesOf(hits).includes('get/organizations/id/flows'));
});

Deno.test('a verb and URI together find their endpoint', () => {
    assertEquals(
        hashesOf(search('delete /api/identities/:id/pii')),
        ['delete/identities/id/pii'],
    );
});

Deno.test("'zzz' finds nothing, and the page says so", () => {
    const hits = search('zzz');
    assertEquals(hits, []);
    assertStrictEquals(searchCountText(hits), 'No endpoint matches.');
    assertNotMatch(searchHitsHtml(hits).toString(), /<a/);
});

Deno.test('the count names how many hits', () => {
    const one: SearchHit = {
        hash: 'statuses/412',
        label: '412',
        tier: 'status',
    };
    assertStrictEquals(searchCountText([one]), '1 match');
    assertStrictEquals(searchCountText([one, one]), '2 matches');
});

Deno.test('a hit links to its view and shows its tier as shape'
    + ' and text', () => {
    const markup = searchHitsHtml([
        {
            hash: 'get/identities',
            label: 'GET /api/identities/',
            tier: 'admin',
        },
        { hash: 'statuses/412', label: '412', tier: 'status' },
    ]).toString();
    assertMatch(
        markup,
        /<a href="#get\/identities"[^>]*data-tier="admin"/,
    );
    assertStringIncludes(markup, 'GET /api/identities/');
    assertStringIncludes(markup, 'organization admin only');
    assertMatch(
        markup,
        /api-doc-role-admin[\s\S]*api-doc-role-shape/,
    );
    assertMatch(
        markup,
        /<a href="#statuses\/412"[^>]*data-tier="status"/,
    );
    assertStringIncludes(markup, 'status code');
    assertNotMatch(markup, /style=/);
});

// A radio of the role switch: its value, whether it is
// chosen, and its words.
const RADIO = new RegExp(
    '<input\\s+type="radio"\\s+name="api-view-as"\\s+'
        + 'value="(\\w+)"(\\s+checked)?\\s*/?>\\s*([^<]+?)\\s*'
        + '</label>',
    'g',
);

Deno.test('the role switch offers Everyone, Member, and'
    + ' Organization admin, with Everyone chosen', () => {
    const markup = viewAsHtml().toString();
    const options = [...markup.matchAll(RADIO)]
        .map((match) => [match[1], match[2] !== undefined, match[3]]);
    assertEquals(options, [
        ['everyone', true, 'Everyone'],
        ['member', false, 'Member'],
        ['admin', false, 'Organization admin'],
    ]);
    assertStringIncludes(markup, 'View as');
    assertNotMatch(markup, /style=/);
});
