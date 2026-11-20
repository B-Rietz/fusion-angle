import { assertStrictEquals } from '@std/assert';
import type { FieldLine } from '../shared/http-message/types.ts';
import {
    REQUEST_HEADERS,
    requestFieldOf,
    requestHeaderOf,
} from '../api/request-header-names.ts';

// The two accessors keep the absent value of the reads they
// replace: Headers.get answers null, a find over field lines
// answers undefined. An empty value is present; each call
// site keeps its own rule for it.

Deno.test('a Headers read ignores the case it was sent in', () => {
    const headers = new Headers({ 'If-Match': '"a"' });

    assertStrictEquals(
        requestHeaderOf(headers, REQUEST_HEADERS.ifMatch),
        '"a"',
    );
});

Deno.test(
    'an absent header is null on Headers and undefined ' +
        'on field lines',
    () => {
        const fields: readonly FieldLine[] = [
            { name: 'if-none-match', value: '*' },
        ];

        assertStrictEquals(
            requestHeaderOf(new Headers(), REQUEST_HEADERS.ifMatch),
            null,
        );
        assertStrictEquals(
            requestFieldOf(fields, REQUEST_HEADERS.ifMatch),
            undefined,
        );
    },
);

Deno.test('an empty value is present', () => {
    for (
        const header of [
            REQUEST_HEADERS.operationId,
            REQUEST_HEADERS.cookie,
        ]
    ) {
        const headers = new Headers([[header.name, '']]);
        const fields: readonly FieldLine[] = [
            { name: header.name, value: '' },
        ];

        assertStrictEquals(requestHeaderOf(headers, header), '');
        assertStrictEquals(requestFieldOf(fields, header), '');
    }
});

Deno.test('a field read takes the first line of its name', () => {
    const fields: readonly FieldLine[] = [
        { name: 'operation-id', value: 'x' },
        { name: 'if-match', value: '"first"' },
        { name: 'if-match', value: '"second"' },
    ];

    assertStrictEquals(
        requestFieldOf(fields, REQUEST_HEADERS.ifMatch),
        '"first"',
    );
});

Deno.test('every declared name is lower-case', () => {
    for (const header of Object.values(REQUEST_HEADERS)) {
        assertStrictEquals(header.name, header.name.toLowerCase());
    }
});

Deno.test('the two content-type headers share one name', () => {
    const { contentType, statusPageContentType } = REQUEST_HEADERS;

    assertStrictEquals(contentType.name, statusPageContentType.name);
    assertStrictEquals(contentType.surface, 'endpoint');
    assertStrictEquals(statusPageContentType.surface, 'site');
});
