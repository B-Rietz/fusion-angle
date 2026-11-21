// getSample is the page's one door for a sample file:
// whatever goes wrong on the way in comes back as a fault
// that names the file and the cause, never a rejection.

import { assert, assertStringIncludes } from '@std/assert';
import {
    getSample,
} from '../web-app/api-documentation/sample-source.ts';
import type {
    SampleRead,
} from '../web-app/api-documentation/shapes.ts';

const PATH = 'samples/get/organizations/id/flows.json';

// Runs one getSample with `fetch` answering as `answer`
// does, and puts the real `fetch` back after.
async function readThrough(
    answer: () => Promise<Response>,
): Promise<SampleRead> {
    const real = globalThis.fetch;
    globalThis.fetch = () => answer();
    try {
        return await getSample(PATH);
    } finally {
        globalThis.fetch = real;
    }
}

function assertFault(read: SampleRead, cause: string): void {
    assert(read.kind === 'fault', JSON.stringify(read));
    assertStringIncludes(read.reason, PATH);
    assertStringIncludes(read.reason, cause);
}

Deno.test('a sample that answers 404 is a fault', async () => {
    const read = await readThrough(() =>
        Promise.resolve(new Response('gone', { status: 404 }))
    );
    assertFault(read, 'answered 404');
});

Deno.test('a sample that is not JSON is a fault', async () => {
    const read = await readThrough(() =>
        Promise.resolve(new Response('{not json'))
    );
    assertFault(read, 'could not be read: SyntaxError');
});

Deno.test('a sample that does not arrive in time is a fault',
async () => {
    const read = await readThrough(() =>
        Promise.reject(new DOMException('slow', 'TimeoutError'))
    );
    assertFault(read, 'did not arrive within 10 seconds');
});

Deno.test('a sample of another shape is a fault', async () => {
    const read = await readThrough(() =>
        Promise.resolve(new Response('{"hash":1}'))
    );
    assertFault(read, 'sample.hash is not a string');
});
