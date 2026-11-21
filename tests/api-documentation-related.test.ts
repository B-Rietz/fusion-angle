import { assert, assertEquals } from '@std/assert';
import { routes } from '../api/routes.ts';
import {
    endpointsOf,
} from '../web-app/app/api-documentation-story.ts';
import { INVITATION_STATES } from '../shared/types.ts';
import {
    queryParametersOf,
    relatedOf,
} from '../web-app/app/api-documentation-related.ts';

const ENDPOINTS = endpointsOf(routes);
const HASHES = new Set(ENDPOINTS.map((e) => e.hash));

function endpointAt(hash: string) {
    const found = ENDPOINTS.find((e) => e.hash === hash);
    assert(found !== undefined, hash);
    return found;
}

Deno.test('a work order item links its neighbours', () => {
    const links = relatedOf(
        endpointAt('get/organizations/id/work-orders/id'),
        ENDPOINTS,
    );
    const hashes = links.map((l) => l.hash);
    for (
        const want of [
            'get/organizations/id/work-orders',
            'get/organizations/id/work-orders/id/versions',
            'post/organizations/id/work-orders/id/transition',
        ]
    ) {
        assert(hashes.includes(want), want);
    }
    assertEquals(
        links.map((l) => l.label).slice(0, 3),
        ['the collection', 'versions', 'claim'],
    );
});

Deno.test('every link names an endpoint', () => {
    for (const endpoint of ENDPOINTS) {
        for (const link of relatedOf(endpoint, ENDPOINTS)) {
            assert(HASHES.has(link.hash), link.hash);
        }
    }
});

Deno.test('a collection, versions, and an operation link up', () => {
    const item = 'get/organizations/id/work-orders/id';
    for (
        const from of [
            'get/organizations/id/work-orders',
            'get/organizations/id/work-orders/id/versions',
            'post/organizations/id/work-orders/id/transition',
        ]
    ) {
        assertEquals(
            relatedOf(endpointAt(from), ENDPOINTS)[0],
            { hash: item, label: 'the item' },
        );
    }
});

function rowOf(pattern: string) {
    const row = routes.find(
        (r) => r.segments.join('/') === pattern,
    );
    assert(row !== undefined, pattern);
    return row;
}

Deno.test('an identity lists every state it holds', () => {
    assertEquals(
        queryParametersOf(rowOf('identities/:id/invitations/')),
        [{
            name: 'state',
            values: [...INVITATION_STATES],
            absent: 'every',
        }],
    );
});

Deno.test('an organization names its invitation states', () => {
    assertEquals(
        queryParametersOf(
            rowOf('organizations/:id/invitations/'),
        ),
        [{
            name: 'state',
            values: ['pending', 'declined', 'revoked'],
            absent: 'pending',
        }],
    );
});

Deno.test('an organization names its membership states', () => {
    assertEquals(
        queryParametersOf(
            rowOf('organizations/:id/memberships/'),
        ),
        [{
            name: 'state',
            values: ['accepted', 'removed'],
            absent: 'accepted',
        }],
    );
});

Deno.test('a route without a judge has no parameters', () => {
    assertEquals(
        queryParametersOf(rowOf('organizations/:id/work-orders/')),
        [],
    );
});

Deno.test('a link takes the first verb a route offers', () => {
    const links = relatedOf(
        endpointAt('get/organizations/id/work-orders/id'),
        ENDPOINTS,
    );
    assert(
        links.some((l) => l.hash
            === 'put/organizations/id/work-orders/id/claim'),
    );
    assert(
        !links.some((l) => l.hash
            === 'delete/organizations/id/work-orders/id/claim'),
    );
});

Deno.test('no endpoint links a neighbour twice', () => {
    for (const endpoint of ENDPOINTS) {
        const hashes = relatedOf(endpoint, ENDPOINTS).map(
            (l) => l.hash,
        );
        assertEquals(
            hashes, [...new Set(hashes)], endpoint.hash,
        );
    }
});
