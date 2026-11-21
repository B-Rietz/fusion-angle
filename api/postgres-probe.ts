// SELECT 1 on one pooled connection. The
// transaction is read only, so the probe cannot
// write, and it stores no message pair. Its
// statement_timeout is this budget, not the pool's
// 30s. The state is all that leaves: the request log
// already records the status, and a probe must not
// echo a server message.

import type { ComponentState } from
    '../shared/system-status.ts';
import { errorCodeOf } from './errors-postgres.ts';
import type { SqlClient } from
    './postgres-client.ts';

export const POSTGRES_PROBE_TIMEOUT_MS = 100;

// Postgres's query_canceled: statement_timeout fired.
const STATEMENT_CANCELLED = '57014';
// postgres.js: the connection did not open within
// its connect_timeout.
const CONNECTION_NOT_OPENED = 'CONNECT_TIMEOUT';

export async function probePostgres(
    sql: SqlClient,
): Promise<ComponentState> {
    try {
        const rows = await sql.begin(async (tx) => {
            await tx.unsafe(
                'SELECT set_config($1, $2, true)',
                [
                    'statement_timeout',
                    String(POSTGRES_PROBE_TIMEOUT_MS),
                ],
            );
            return await tx.unsafe('SELECT 1 AS up');
        }, 'read only');
        return rows.length === 1 ? 'up' : 'down';
    } catch (error) {
        return failedStateOf(error);
    }
}

function failedStateOf(error: unknown): ComponentState {
    const code = errorCodeOf(error);
    if (
        code === STATEMENT_CANCELLED
        || code === CONNECTION_NOT_OPENED
    ) {
        return 'timeout';
    }
    return 'down';
}
