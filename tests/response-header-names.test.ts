import { assertEquals, assertStrictEquals } from '@std/assert';
import { RESPONSE_HEADERS } from '../api/response-header-names.ts';
import {
    OPERATION_ID_HEADER,
    REQUEST_ID_HEADER,
} from '../shared/message-id-fields.ts';
import {
    API_DOC_ROOMS,
    API_DOC_STEPS,
} from '../web-app/api-documentation/rooms.ts';
import { readSample } from '../web-app/api-documentation/shapes.ts';

// The declaration is held to what the product answers: the
// committed samples are replays through the gate, so a name
// no replayed response carries is a name the product does
// not set.

const PAGE_ROOT = 'web-app/api-documentation/';

// Every header name a replayed response carries, on the
// response itself or on a part of a collection.
function answeredNames(): ReadonlySet<string> {
    const names = new Set<string>();
    for (const { hash, sample } of [...API_DOC_ROOMS, ...API_DOC_STEPS]) {
        if (sample.kind === 'none') continue;
        const read = readSample(JSON.parse(
            Deno.readTextFileSync(PAGE_ROOT + sample.path),
        ));
        if (read.kind === 'fault') {
            throw new Error(hash + ': ' + read.reason);
        }
        for (const { response } of read.sample.exchanges) {
            for (const [name] of response.headers) names.add(name);
            if (response.body.kind !== 'multipart') continue;
            for (const part of response.body.parts) {
                for (const [name] of part.headers) names.add(name);
            }
        }
    }
    return names;
}

Deno.test('every declared response header is answered by a'
    + ' replayed sample', () => {
    const answered = answeredNames();
    const unanswered = Object.values(RESPONSE_HEADERS)
        .filter((name) => !answered.has(name));
    assertEquals(unanswered, []);
});

Deno.test('the declaration names the six headers a reader uses',
() => {
    assertEquals(Object.values(RESPONSE_HEADERS), [
        'etag',
        'last-modified',
        'location',
        'content-location',
        'operation-id',
        'request-id',
    ]);
});

Deno.test('every declared response header name is lower-case',
() => {
    for (const name of Object.values(RESPONSE_HEADERS)) {
        assertStrictEquals(name, name.toLowerCase());
    }
});

Deno.test('the two message ids keep the names the client sends'
    + ' and reads', () => {
    assertStrictEquals(RESPONSE_HEADERS.operationId, OPERATION_ID_HEADER);
    assertStrictEquals(RESPONSE_HEADERS.requestId, REQUEST_ID_HEADER);
});
