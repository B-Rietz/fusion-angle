import { assertEquals } from '@std/assert';
import type { SqlClient } from
    '../api/postgres-client.ts';
import { memoryDbAdapter } from '../api/db-memory.ts';
import { probePostgres } from '../api/postgres-probe.ts';

function recordingClient(
    select: () => Promise<unknown[]>,
): {
    readonly sql: SqlClient;
    readonly queries: string[];
    readonly parameters: unknown[][];
    readonly beginOptions: Array<string | undefined>;
} {
    const queries: string[] = [];
    const parameters: unknown[][] = [];
    const beginOptions: Array<string | undefined> = [];
    const sql: SqlClient = {
        query: () => Promise.resolve([]),
        begin: (fn, options) => {
            beginOptions.push(options);
            return fn(sql);
        },
        unsafe: async <T>(
            query: string,
            values?: readonly unknown[],
        ) => {
            queries.push(query);
            parameters.push([...(values ?? [])]);
            if (query === 'SELECT 1 AS up') {
                return await select() as T[];
            }
            return [] as T[];
        },
        end: () => Promise.resolve(),
    };
    return { sql, queries, parameters, beginOptions };
}

function throwing(thrown: unknown): SqlClient {
    return recordingClient(() => Promise.reject(thrown)).sql;
}

function coded(code: string): Error {
    return Object.assign(new Error('probe failed'), { code });
}

Deno.test('probePostgres is a read-only SELECT 1',
async () => {
    const fake = recordingClient(
        () => Promise.resolve([{ up: 1 }]),
    );
    assertEquals(await probePostgres(fake.sql), 'up');
    assertEquals(fake.beginOptions, ['read only']);
    assertEquals(fake.queries, [
        'SELECT set_config($1, $2, true)',
        'SELECT 1 AS up',
    ]);
    assertEquals(fake.parameters[0], [
        'statement_timeout',
        '100',
    ]);
});

Deno.test('probePostgres is down when SELECT 1 is empty',
async () => {
    const fake = recordingClient(
        () => Promise.resolve([]),
    );
    assertEquals(await probePostgres(fake.sql), 'down');
});

Deno.test('probePostgres times out on a cancelled statement',
async () => {
    assertEquals(
        await probePostgres(throwing(coded('57014'))),
        'timeout',
    );
});

Deno.test('probePostgres times out on a slow connection',
async () => {
    assertEquals(
        await probePostgres(
            throwing(coded('CONNECT_TIMEOUT')),
        ),
        'timeout',
    );
});

Deno.test('probePostgres is down on any other throw',
async () => {
    assertEquals(
        await probePostgres(throwing(new Error('timeout'))),
        'down',
    );
    assertEquals(
        await probePostgres(throwing(coded('ECONNREFUSED'))),
        'down',
    );
    assertEquals(
        await probePostgres(throwing('57014')),
        'down',
    );
});

Deno.test('the memory adapter probe is up, in a view too',
async () => {
    const adapter = memoryDbAdapter();
    await adapter.ensureTable();
    assertEquals(await adapter.probe(), 'up');
    assertEquals(
        await adapter.readTransaction(
            (view) => view.probe(),
        ),
        'up',
    );
});
