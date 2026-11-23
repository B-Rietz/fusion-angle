// Test-only mock seed harness. Production postMockDataLoad
// keeps the real hasher; this module and the documentation
// replay's stage inject the cheap test hash. Shared RO DB
// is RO by covenant — writers must call seededMockDb().

import { MemoryStorageBackend } from '../api/backend-memory.ts';
import {
    memoryDbAdapterOver,
    type MemoryDbAdapter,
} from '../api/db-memory.ts';
import { postMockDataLoad } from '../api/mock-data.ts';
export {
    throwawayPasswordHash as testHashPassword,
} from '../api/mock-data/throwaway-password-hash.ts';
import {
    throwawayPasswordHash,
} from '../api/mock-data/throwaway-password-hash.ts';

// The mock seed takes over a second, so a test file lands
// it once, in module state (each test file loads this
// module afresh), and never serves or writes it. Rows are
// appended and never changed in place, so each caller
// takes them under a backend of its own. The file's first
// call stamps the seed for every later test: seed before
// installing a test clock (setClockForTest), or the whole
// file's seed carries that clock's stamps.
let fileSeed: Promise<MemoryStorageBackend> | undefined;

function fileSeedBackend(): Promise<MemoryStorageBackend> {
    fileSeed ??= (async () => {
        const backend = new MemoryStorageBackend();
        await postMockDataLoad(memoryDbAdapterOver(backend), {
            hashPassword: throwawayPasswordHash,
        });
        return backend;
    })();
    return fileSeed;
}

/**
 * Full load; always a new memory DB. Safe for mutations:
 * a copy of the file's one seed, which no caller holds.
 */
export async function seededMockDb(
): Promise<MemoryDbAdapter> {
    return memoryDbAdapterOver((await fileSeedBackend()).copy());
}

let sharedPromise: Promise<MemoryDbAdapter> | undefined;

/**
 * Memoized load for this process / module graph.
 * Read-only use only. Writers must use seededMockDb().
 */
export async function sharedMockDb(
): Promise<MemoryDbAdapter> {
    if (sharedPromise === undefined) {
        sharedPromise = seededMockDb();
    }
    return sharedPromise;
}
