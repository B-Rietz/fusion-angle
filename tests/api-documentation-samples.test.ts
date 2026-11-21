import { assertEquals } from '@std/assert';
import { routes } from '../api/routes.ts';
import { readSample } from '../web-app/api-documentation/shapes.ts';
import {
    endpointsOf,
    NO_SAMPLE,
} from '../web-app/app/api-documentation-story.ts';

const SAMPLES_ROOT = 'web-app/api-documentation/samples/';

Deno.test('every endpoint sample names its route\'s path'
    + ' parameters', () => {
    for (const { row, hash } of endpointsOf(routes)) {
        if (NO_SAMPLE.has(hash)) continue;
        const read = readSample(JSON.parse(
            Deno.readTextFileSync(SAMPLES_ROOT + hash + '.json'),
        ));
        if (read.kind === 'fault') {
            throw new Error(hash + ': ' + read.reason);
        }
        assertEquals(
            read.sample.pathIds.map(({ name }) => name),
            row.segments.filter((segment) => segment.startsWith(':')),
            hash,
        );
    }
});
