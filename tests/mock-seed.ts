// Test-only mock seed harness. Production postMockDataLoad
// keeps the real hasher; this module and the documentation
// replay's stage inject the cheap test hash. Shared RO DB
// is RO by covenant — writers must call seededMockDb().

import {
    memoryDbAdapter,
    type MemoryDbAdapter,
} from '../api/db-memory.ts';
import { postMockDataLoad } from '../api/mock-data.ts';
export {
    throwawayPasswordHash as testHashPassword,
} from '../api/mock-data/throwaway-password-hash.ts';
import {
    throwawayPasswordHash,
} from '../api/mock-data/throwaway-password-hash.ts';

/** Full load; always a new memory DB. Safe for mutations. */
export async function seededMockDb(
): Promise<MemoryDbAdapter> {
    const db = memoryDbAdapter();
    await postMockDataLoad(db, {
        hashPassword: throwawayPasswordHash,
    });
    return db;
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
