// The page's fetch adapter: the one place a sample file
// crosses into the page. Whatever goes wrong on the way
// in becomes a fault the view paints in place, with its
// reason; the rest of the page stands.

import { readSample, type SampleRead } from './shapes.ts';

// A sample is a small static file beside the page; ten
// seconds bounds a stalled connection, not a slow read.
export const SAMPLE_TIMEOUT_MS = 10_000;

const HTTP_OK = 200;

function fault(path: string, problem: string): SampleRead {
    return { kind: 'fault', reason: path + ' ' + problem };
}

function problemOf(error: unknown): string {
    if (error instanceof DOMException
        && error.name === 'TimeoutError') {
        return 'did not arrive within '
            + SAMPLE_TIMEOUT_MS / 1000 + ' seconds';
    }
    return 'could not be read: ' + String(error);
}

// `path` is relative to the page, as the catalog stores
// it.
export async function getSample(path: string): Promise<SampleRead> {
    const signal = AbortSignal.timeout(SAMPLE_TIMEOUT_MS);
    let response: Response;
    try {
        response = await fetch(path, { signal });
    } catch (error) {
        return fault(path, problemOf(error));
    }
    if (response.status !== HTTP_OK) {
        await response.body?.cancel();
        return fault(path, 'answered ' + response.status);
    }
    let parsed: unknown;
    try {
        parsed = await response.json();
    } catch (error) {
        return fault(path, problemOf(error));
    }
    const read = readSample(parsed);
    return read.kind === 'fault'
        ? fault(path, 'is not a sample: ' + read.reason)
        : read;
}
