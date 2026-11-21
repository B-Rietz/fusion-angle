import { assertEquals, assertNotMatch } from '@std/assert';
import type {
    ApiDocBody,
    ApiDocExchange,
    ApiDocPart,
    ApiDocSample,
} from '../web-app/api-documentation/shapes.ts';
import { readSample } from
    '../web-app/api-documentation/shapes.ts';

const FLOWS = '/api/organizations/stark/flows/';

const READ: ApiDocExchange = {
    caller: 'member',
    request: {
        method: 'GET',
        target: FLOWS + 'assembly',
        headers: [
            ['authorization', 'Bearer $TOKEN'],
            ['operation-id', '$OPERATION_ID'],
        ],
        body: { kind: 'empty' },
    },
    response: {
        status: 200,
        headers: [
            ['content-type', 'application/json'],
            ['etag', '"v1"'],
        ],
        body: {
            kind: 'text',
            mediaType: 'application/json',
            text: '{\n  "title": "Assembly"\n}',
        },
    },
    curl: 'curl -i -X GET "$ORIGIN' + FLOWS + 'assembly"',
};

const FIRST_PART: ApiDocPart = {
    status: 200,
    headers: [
        ['content-location', FLOWS + 'assembly'],
        ['content-type', 'application/json'],
    ],
    body: {
        kind: 'text',
        mediaType: 'application/json',
        text: '{\n  "title": "Assembly"\n}',
    },
};

const SECOND_PART: ApiDocPart = {
    status: 200,
    headers: [['content-location', FLOWS + 'paint']],
    body: { kind: 'empty' },
};

const LISTED: ApiDocBody = {
    kind: 'multipart',
    boundary: 'part',
    parts: [FIRST_PART, SECOND_PART],
    more: 3,
};

const LISTING: ApiDocExchange = {
    caller: 'admin',
    request: {
        method: 'GET',
        target: FLOWS,
        headers: [['authorization', 'Bearer $TOKEN']],
        body: { kind: 'empty' },
    },
    response: {
        status: 200,
        headers: [
            ['content-type', 'multipart/mixed; boundary=part'],
        ],
        body: LISTED,
    },
    curl: 'curl -i -X GET "$ORIGIN' + FLOWS + '"',
};

const SAMPLE: ApiDocSample = {
    hash: 'get/organizations/id/flows/id',
    pathIds: [
        { name: ':id', value: 'stark', source: '' },
        {
            name: ':id',
            value: 'assembly',
            source: 'get/organizations/id/flows',
        },
    ],
    exchanges: [READ, LISTING],
};

function sampleOf(
    read: unknown,
    listing: unknown,
): unknown {
    return { ...SAMPLE, exchanges: [read, listing] };
}

function listingOf(body: unknown): unknown {
    return {
        ...LISTING,
        response: { ...LISTING.response, body },
    };
}

function faultOf(reason: string): unknown {
    return { kind: 'fault', reason };
}

Deno.test('readSample returns a well-formed sample', () => {
    const fetched: unknown = JSON.parse(JSON.stringify(SAMPLE));
    assertEquals(
        readSample(fetched),
        { kind: 'sample', sample: SAMPLE },
    );
});

Deno.test('readSample keeps the declared fields only',
() => {
    const read = { ...READ, elapsedMs: 4 };
    const drafted = {
        ...SAMPLE,
        exchanges: [read, LISTING],
        draft: true,
    };
    assertEquals(
        readSample(drafted),
        { kind: 'sample', sample: SAMPLE },
    );
});

Deno.test('readSample faults on a non-object', () => {
    const values: readonly unknown[] =
        [undefined, null, true, 7, 'sample', [SAMPLE]];
    for (const value of values) {
        assertEquals(
            readSample(value),
            faultOf('sample is not an object'),
        );
    }
});

Deno.test('readSample faults on a hash that is not a'
    + ' string', () => {
    assertEquals(
        readSample({ ...SAMPLE, hash: 7 }),
        faultOf('sample.hash is not a string'),
    );
});

Deno.test('readSample faults on exchanges that are not'
    + ' an array', () => {
    assertEquals(
        readSample({ ...SAMPLE, exchanges: { 0: READ } }),
        faultOf('sample.exchanges is not an array'),
    );
});

Deno.test('readSample faults on a missing response', () => {
    const read = {
        caller: READ.caller,
        request: READ.request,
        curl: READ.curl,
    };
    assertEquals(
        readSample(sampleOf(read, LISTING)),
        faultOf('sample.exchanges[0].response is missing'),
    );
});

Deno.test('readSample faults on a status that is not a'
    + ' whole number', () => {
    const statuses: readonly unknown[] = ['200', 200.5, -200];
    for (const status of statuses) {
        const read = {
            ...READ,
            response: { ...READ.response, status },
        };
        assertEquals(
            readSample(sampleOf(read, LISTING)),
            faultOf(
                'sample.exchanges[0].response.status'
                + ' is not a non-negative integer',
            ),
        );
    }
});

Deno.test('readSample faults on a header line that is'
    + ' not two strings', () => {
    const lines: readonly unknown[] = [
        'etag: "v1"',
        ['etag'],
        ['etag', 1],
        ['etag', '"v1"', 'weak'],
    ];
    for (const line of lines) {
        const read = {
            ...READ,
            request: {
                ...READ.request,
                headers: [READ.request.headers[0], line],
            },
        };
        assertEquals(
            readSample(sampleOf(read, LISTING)),
            faultOf(
                'sample.exchanges[0].request.headers[1]'
                + ' is not a name and a value, both strings',
            ),
        );
    }
});

Deno.test('readSample faults on a multipart part whose'
    + ' body is multipart', () => {
    const listing = listingOf({
        ...LISTED,
        parts: [{ ...FIRST_PART, body: LISTED }, SECOND_PART],
    });
    assertEquals(
        readSample(sampleOf(READ, listing)),
        faultOf(
            'sample.exchanges[1].response.body.parts[0]'
            + '.body.kind is not one of: empty, text',
        ),
    );
});

Deno.test('readSample faults on a negative more', () => {
    const listing = listingOf({ ...LISTED, more: -1 });
    assertEquals(
        readSample(sampleOf(READ, listing)),
        faultOf(
            'sample.exchanges[1].response.body.more'
            + ' is not a non-negative integer',
        ),
    );
});

Deno.test('readSample faults on an unknown body kind',
() => {
    const read = {
        ...READ,
        request: {
            ...READ.request,
            body: { kind: 'binary' },
        },
    };
    assertEquals(
        readSample(sampleOf(read, LISTING)),
        faultOf(
            'sample.exchanges[0].request.body.kind'
            + ' is not one of: empty, text, multipart',
        ),
    );
});

Deno.test('readSample faults on a caller outside the'
    + ' tiers', () => {
    const read = { ...READ, caller: 'operator' };
    assertEquals(
        readSample(sampleOf(read, LISTING)),
        faultOf(
            'sample.exchanges[0].caller'
            + ' is not one of: member, admin, none',
        ),
    );
});

Deno.test('shapes imports nothing', () => {
    const src = Deno.readTextFileSync(
        'web-app/api-documentation/shapes.ts',
    );
    assertNotMatch(src, /^import /m);
});
