import {
    assertRejects,
    assertStrictEquals,
} from '@std/assert';
import { MemoryStorageBackend }
    from '../api/backend-memory.ts';
import { MissingTableError } from '../api/db.ts';
import { SuccessionConflict } from '../api/ledger-statement.ts';
import { rootBind } from '../api/ledger-root.ts';
import type { StatementBind } from
    '../shared/ledger-statement.ts';
import {
    generateIdentifier,
    NIL_IDENTIFIER,
} from '../shared/identifier.ts';

interface Row { id: string; n: number }

Deno.test(
    'ensureTable creates the nil root',
    async () => {
        const backend = new MemoryStorageBackend();
        await backend.ensureTable();
        const rows = await backend.transaction('readonly',
            tx => tx.getAll<{ id: string }>(),
        );
        assertStrictEquals(rows.length, 1);
        assertStrictEquals(rows[0]!.id, NIL_IDENTIFIER);
    },
);

Deno.test(
    'ensureTable leaves an existing table intact',
    async () => {
        const backend = new MemoryStorageBackend();
        await backend.ensureTable();
        await backend.transaction('readwrite',
            tx => tx.append<Row>({ id: 'a', n: 1 }),
        );
        await backend.ensureTable();
        const rows = await backend.transaction('readonly',
            tx => tx.getAll<Row>(),
        );
        assertStrictEquals(rows.length, 2);
        assertStrictEquals(
            rows.some((row) => row.id === 'a'),
            true,
        );
    },
);

Deno.test(
    'transaction before ensureTable throws',
    async () => {
        const backend = new MemoryStorageBackend();
        await assertRejects(
            () => backend.transaction('readonly',
                tx => tx.getAll(),
            ),
            MissingTableError,
        );
    },
);

Deno.test(
    'a single put in a tx persists and reads back',
    async () => {
        const backend = new MemoryStorageBackend();
        await backend.ensureTable();
        await backend.transaction('readwrite',
            tx => tx.append<Row>({ id: 'a', n: 7 }),
        );
        const got = await backend.transaction('readonly',
            tx => tx.getById<Row>('a'),
        );
        assertStrictEquals(got!.n, 7);
    },
);

Deno.test(
    'get returns null for an absent row',
    async () => {
        const backend = new MemoryStorageBackend();
        await backend.ensureTable();
        const got = await backend.transaction('readonly',
            tx => tx.getById<Row>('nope'),
        );
        assertStrictEquals(got, null);
    },
);

Deno.test(
    'a NULL field rejects the put and rolls back',
    async () => {
        const backend = new MemoryStorageBackend();
        await backend.ensureTable();
        await assertRejects(
            () => backend.transaction('readwrite',
                tx => tx.append({ id: 'a', x: null } as {
                        id: string;
                    },
                ),
            ),
            Error,
            'NOT NULL',
        );
        const rows = await backend.transaction('readonly',
            tx => tx.getAll<Row>(),
        );
        assertStrictEquals(rows.length, 1);
        assertStrictEquals(rows[0]!.id, NIL_IDENTIFIER);
    },
);

Deno.test(
    'a readonly tx rejects a put',
    async () => {
        const backend = new MemoryStorageBackend();
        await backend.ensureTable();
        await assertRejects(
            () => backend.transaction('readonly',
                tx => tx.append<Row>({ id: 'a', n: 1 }),
            ),
            Error,
            'readonly',
        );
    },
);

Deno.test(
    'concurrent transactions on one table both persist',
    async () => {
        const backend = new MemoryStorageBackend();
        await backend.ensureTable();
        const append = () => backend.transaction('readwrite',
            async (tx) => {
                const rows = await tx.getAll<Row>();
                await tx.append<Row>({
                    id: `r${rows.length}`,
                    n: rows.length,
                });
            },
        );
        await Promise.all([append(), append()]);
        const rows = await backend.transaction('readonly',
            tx => tx.getAll<Row>(),
        );
        assertStrictEquals(rows.length, 3);
    },
);

// A blind first version of one document; each call is a
// row of its own.
function firstVersionBind(): StatementBind {
    return {
        ...rootBind(generateIdentifier()),
        id: generateIdentifier(),
        path: '/succession/',
        name: 'document',
    };
}

// Both statements read the document's heads, find none,
// and await their hashes before either lands. The second
// to land must still see the first's claim, so the claims
// are read after the hashes, not with the heads.
Deno.test(
    'two first versions of one document in a tx: one conflicts',
    async () => {
        const backend = new MemoryStorageBackend();
        await backend.ensureTable();
        const settled = await backend.transaction('readwrite',
            (tx) => Promise.allSettled([
                backend.executeLedger(
                    'blind', [firstVersionBind()], undefined, tx,
                ),
                backend.executeLedger(
                    'blind', [firstVersionBind()], undefined, tx,
                ),
            ]),
        );
        assertStrictEquals(
            settled.filter((result) =>
                result.status === 'fulfilled').length,
            1,
        );
        assertStrictEquals(
            settled.filter((result) =>
                result.status === 'rejected'
                && result.reason instanceof SuccessionConflict,
            ).length,
            1,
        );
    },
);
