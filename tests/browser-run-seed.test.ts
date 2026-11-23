import {
    assertEquals,
    assertRejects,
    assertStrictEquals,
} from '@std/assert';
import { join } from '@std/path';
import { MemoryStorageBackend } from
    '../api/backend-memory.ts';
import {
    fileSeedFrom,
    landRunSeed,
    RUN_SEED_ENV,
    writeRunSeed,
} from './browser/fixtures.ts';

const READ_ONLY = 0o444;
const PERMISSION_BITS = 0o777;

function rowsOf(
    backend: MemoryStorageBackend,
): Promise<{ id: string }[]> {
    return backend.read((tx) => tx.getAll());
}

// One temp directory for one body, removed whatever the
// body does.
async function withRunDirectory(
    body: (directory: string) => Promise<void>,
): Promise<void> {
    const directory = Deno.makeTempDirSync({
        prefix: 'fusion-run-seed-',
    });
    try {
        await body(directory);
    } finally {
        Deno.removeSync(directory, { recursive: true });
    }
}

// A browser run seeds once and every file rebuilds its
// backend from the landed rows, so the rebuild must hold
// what a seed holds: every row, in the order it landed,
// and the sign-ins the seed minted.
Deno.test('a backend rebuilt from the run seed holds its rows',
async () => {
    await withRunDirectory(async (directory) => {
        const path = join(directory, 'seed.json');
        const seeded = await landRunSeed(path);
        const rebuilt = await fileSeedFrom(path);
        assertEquals(
            await rowsOf(rebuilt.backend),
            await rowsOf(seeded.backend),
        );
        assertEquals(rebuilt.credentials, seeded.credentials);
    });
});

// Four workers read the file at once, so it is written
// once and then only read. A table with its root row alone
// stands in for a seed: the write is what is pinned.
Deno.test('a run seed is written once, read-only',
async () => {
    await withRunDirectory(async (directory) => {
        const path = join(directory, 'seed.json');
        const backend = new MemoryStorageBackend();
        await backend.ensureTable();
        const seed = { backend, credentials: { identities: [] } };
        await writeRunSeed(path, seed);
        assertStrictEquals(
            Deno.statSync(path).mode! & PERMISSION_BITS,
            READ_ONLY,
        );
        await assertRejects(
            () => writeRunSeed(path, seed),
            Deno.errors.AlreadyExists,
        );
    });
});

// A named seed that cannot be read fails the file that
// needs it; it never quietly seeds in its place.
Deno.test('a run seed named but missing is refused',
async () => {
    await withRunDirectory(async (directory) => {
        await assertRejects(
            () => fileSeedFrom(join(directory, 'seed.json')),
            Deno.errors.NotFound,
        );
    });
});

Deno.test('a run seed named empty is refused by its name',
async () => {
    await assertRejects(
        () => fileSeedFrom(''),
        Error,
        RUN_SEED_ENV,
    );
});

// The file holds sign-ins, so a refusal names the file and
// never quotes what is in it.
Deno.test('a run seed cut short is refused, quoting nothing',
async () => {
    await withRunDirectory(async (directory) => {
        const path = join(directory, 'seed.json');
        Deno.writeTextFileSync(
            path, '{"credentials":{"password":hunter2',
        );
        const refusal = await assertRejects(
            () => fileSeedFrom(path),
            Error,
        );
        assertStrictEquals(
            refusal.message, `${path} is not a run seed`,
        );
        assertStrictEquals(refusal.cause, undefined);
    });
});

// The table keeps one row per id and answers a repeat by
// not appending it, so a rebuild that took that answer
// quietly would hold one row fewer than its file.
Deno.test('a run seed that repeats a row is refused',
async () => {
    await withRunDirectory(async (directory) => {
        const path = join(directory, 'seed.json');
        Deno.writeTextFileSync(path, JSON.stringify({
            rows: [{ id: 'a' }, { id: 'a' }],
            credentials: { identities: [] },
        }));
        await assertRejects(
            () => fileSeedFrom(path),
            Error,
            `${path} repeats row a`,
        );
    });
});

Deno.test('a run seed not in the landed shape is refused',
async () => {
    await withRunDirectory(async (directory) => {
        const path = join(directory, 'seed.json');
        Deno.writeTextFileSync(path, JSON.stringify({
            rows: [{ id: 1 }],
            credentials: { identities: [] },
        }));
        await assertRejects(
            () => fileSeedFrom(path),
            Error,
            `${path} is not a run seed`,
        );
    });
});
