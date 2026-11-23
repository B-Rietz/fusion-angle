import {
    assert,
    assertEquals,
    assertMatch,
    assertNotStrictEquals,
    assertStrictEquals,
    equal,
} from '@std/assert';
import { MemoryStorageBackend } from '../api/backend-memory.ts';
import { memoryDbAdapterOver } from '../api/db-memory.ts';
import { rootBind } from '../api/ledger-root.ts';
import { postMockDataLoad } from '../api/mock-data.ts';
import { generateIdentifier } from '../shared/identifier.ts';
import type { StatementBind } from
    '../shared/ledger-statement.ts';
import { verifyPassword } from
    '../shared/password-hash.ts';
import {
    testHashPassword,
    seededMockDb,
    sharedMockDb,
} from './mock-seed.ts';
import { deriveCredentialsFor } from
    '../api/derive-identity-spine.ts';

Deno.test('testHashPassword emits pbkdf2 PHC with i=1',
async () => {
    const phc = await testHashPassword('s3cret');
    assertMatch(
        phc,
        /^\$pbkdf2-sha256\$i=1\$[^$]+\$[^$]+$/,
    );
    assertStrictEquals(
        await verifyPassword('s3cret', phc),
        true,
    );
    assertStrictEquals(
        await verifyPassword('wrong', phc),
        false,
    );
});

Deno.test('seededMockDb seeds verifying current password',
async () => {
    const db = await seededMockDb();
    const rows = await deriveCredentialsFor(
        db, 'XXZruirZyAOoRpNxaDnpSA',
    );
    const passwordCred = rows.find(
        r => r.kind === 'password',
    );
    assert(passwordCred, 'password credential present');
    assertMatch(
        passwordCred.secret,
        /^\$pbkdf2-sha256\$i=1\$/,
    );
});

Deno.test('sharedMockDb returns the same adapter instance',
async () => {
    const a = await sharedMockDb();
    const b = await sharedMockDb();
    assertStrictEquals(a, b);
});

Deno.test('seededMockDb returns a fresh adapter each call',
async () => {
    const a = await seededMockDb();
    const b = await seededMockDb();
    assertNotStrictEquals(a, b);
});

// A collection no seed holds; each pin writes a document
// of its own there.
const PIN_PATH = '/mock-seed-pin/';

function pinBind(name: string): StatementBind {
    return {
        ...rootBind(generateIdentifier()),
        id: generateIdentifier(),
        path: PIN_PATH,
        name,
    };
}

// However a file comes by its seeded databases, each is a
// world of its own: a write through one is read through
// no other, neither one taken beside it nor one after.
Deno.test('a write through one seeded db is read through no other',
async () => {
    const name = generateIdentifier();
    const written = await seededMockDb();
    const beside = await seededMockDb();
    await written.executeLedger('blind', [pinBind(name)]);
    assert(
        await written.messagePairs.getHeadPair(PIN_PATH, name)
            !== null,
    );
    assertStrictEquals(
        await beside.messagePairs.getHeadPair(PIN_PATH, name),
        null,
    );
    const after = await seededMockDb();
    assertStrictEquals(
        await after.messagePairs.getHeadPair(PIN_PATH, name),
        null,
    );
});

// The count, then the first row that differs: a failing
// diff of a whole seed's 2,553 rows takes seconds to print.
function assertSameRows<T>(
    actual: readonly T[],
    expected: readonly T[],
): void {
    assertStrictEquals(actual.length, expected.length, 'rows');
    const at = actual.findIndex(
        (row, index) => !equal(row, expected[index]),
    );
    if (at !== -1) {
        assertEquals(actual[at], expected[at], 'row ' + at);
    }
}

// A file seeds once: every seeded db it takes holds the
// same rows, field for field, whatever an earlier one was
// handed and wrote.
Deno.test('every seeded db in a file holds the same seed',
async () => {
    const first = await seededMockDb();
    const rows = await first.messagePairs.getAll();
    await first.executeLedger(
        'blind', [pinBind(generateIdentifier())],
    );
    const second = await seededMockDb();
    assertSameRows(await second.messagePairs.getAll(), rows);
});

type SeededRow = {
    readonly path: string,
    readonly name: string,
    readonly method: string,
    readonly response: string,
};

// What two seeds share: each row's place, in order, and its
// response body, but for a password credential's, salted
// anew by each seed. Ids, stamps, hashes, and the date,
// operation-id, and etag lines are each seed's own.
function sharedOf(row: SeededRow): readonly string[] {
    const place = [row.path, row.name, row.method];
    if (row.path.endsWith('/credentials/')) return place;
    return [
        ...place,
        row.response.slice(row.response.indexOf('\r\n\r\n')),
    ];
}

// A copy keeps every field of the seed it copies: ids,
// stamps, hashes, and bytes. And the file's seed is the
// mock seed: a fresh one, made as the helper makes it, has
// the same rows in the same order with the same bodies.
Deno.test('a seeded db is a fresh seed, copied field for field',
async () => {
    const source = new MemoryStorageBackend();
    await postMockDataLoad(memoryDbAdapterOver(source), {
        hashPassword: testHashPassword,
    });
    const fresh = await memoryDbAdapterOver(source)
        .messagePairs.getAll();
    assertSameRows(
        await memoryDbAdapterOver(source.copy())
            .messagePairs.getAll(),
        fresh,
    );
    assertSameRows(
        (await (await seededMockDb()).messagePairs.getAll())
            .map(sharedOf),
        fresh.map(sharedOf),
    );
});
