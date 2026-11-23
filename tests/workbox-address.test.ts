import { assertStrictEquals } from '@std/assert';
import { workOrderAddress } from
    '../web-app/app/workbox-address.ts';

const PAGE = 'http://local/workbox/index.html';

Deno.test(
    'opening names the work order beside the organization',
    () => {
        assertStrictEquals(
            workOrderAddress(PAGE + '?organization=O1', 'W1'),
            '/workbox/index.html?organization=O1&id=W1',
        );
    },
);

Deno.test('opening another replaces the id', () => {
    assertStrictEquals(
        workOrderAddress(
            PAGE + '?organization=O1&id=W1', 'W2',
        ),
        '/workbox/index.html?organization=O1&id=W2',
    );
});

Deno.test('closing removes the id and keeps the rest', () => {
    assertStrictEquals(
        workOrderAddress(
            PAGE + '?organization=O1&id=W1', null,
        ),
        '/workbox/index.html?organization=O1',
    );
    assertStrictEquals(
        workOrderAddress(PAGE + '?id=W1', null),
        '/workbox/index.html',
    );
});
