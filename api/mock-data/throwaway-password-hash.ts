// One PBKDF2 iteration, for throwaway seeds only: the test
// seeds and the documentation generator. Never the operator's
// seed, which keeps the real hasher.

import {
    bytesToBase64Url,
} from '../../shared/base64url.ts';

const ALGO_ID = 'pbkdf2-sha256';
const TEST_PBKDF2_ITERATIONS = 1;
const SALT_BYTES = 16;
const DIGEST_BITS = 256;

/**
 * Low-iteration PBKDF2 for CLI test seeds only.
 * Emits a valid PHC string so verifyPassword works.
 */
export async function throwawayPasswordHash(
    plaintext: string,
): Promise<string> {
    const salt = crypto.getRandomValues(
        new Uint8Array(SALT_BYTES),
    );
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(plaintext),
        'PBKDF2',
        false,
        ['deriveBits'],
    );
    const derived = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt,
            iterations: TEST_PBKDF2_ITERATIONS,
            hash: 'SHA-256',
        },
        keyMaterial,
        DIGEST_BITS,
    );
    return '$' + ALGO_ID
        + '$i=' + TEST_PBKDF2_ITERATIONS
        + '$' + bytesToBase64Url(salt)
        + '$' + bytesToBase64Url(new Uint8Array(derived));
}
