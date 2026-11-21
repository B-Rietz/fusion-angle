// Rehearse the mock-data seed under the replay's pins and
// print one JSON line: the SHA-256 of its statements and
// its row count. It prints nothing else, never a
// credential. The pins load first, statically; the seed
// loads after them, so its day is the pinned one.

import {
    installReplayPins,
} from '../web-app/app/api-documentation-pins.ts';

const HEX_RADIX = 16;
const HEX_DIGITS_PER_BYTE = 2;

await installReplayPins();
const { rehearseMockData } = await import('../api/mock-data.ts');
const { testHashPassword } = await import('./mock-seed.ts');

const { rehearsal } = await rehearseMockData({
    hashPassword: testHashPassword,
});
const digest = new Uint8Array(await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(rehearsal.statements)),
));
const rows = rehearsal.statements.reduce(
    (total, statement) => total + statement.rows.length, 0,
);
console.log(JSON.stringify({
    digest: Array.from(
        digest,
        (byte) => byte.toString(HEX_RADIX)
            .padStart(HEX_DIGITS_PER_BYTE, '0'),
    ).join(''),
    rows,
}));
