import { assert, assertEquals } from '@std/assert';
import { connectPostgres } from
    '../api/postgres-client.ts';
import { probePostgres } from '../api/postgres-probe.ts';

// Live probes run only when POSTGRES_URL is set
// (./test postgres).

const POSTGRES_URL = Deno.env.get('POSTGRES_URL');

// The wait /status gives the API: a cold probe opens its
// connection inside it.
const COLD_PROBE_BUDGET_MS = 500;

if (POSTGRES_URL === undefined || POSTGRES_URL === '') {
    Deno.test(
        'live probe skipped without POSTGRES_URL',
        { ignore: true }, // POSTGRES_URL is unset
        () => {},
    );
} else {
    Deno.test('a live probe is up, cold and warm',
    async () => {
        const sql = connectPostgres(POSTGRES_URL);
        try {
            const coldAt = performance.now();
            assertEquals(await probePostgres(sql), 'up');
            const coldMs = performance.now() - coldAt;
            const warmAt = performance.now();
            assertEquals(await probePostgres(sql), 'up');
            const warmMs = performance.now() - warmAt;
            console.log(JSON.stringify({
                probe: 'postgres',
                coldMs,
                warmMs,
            }));
            assert(
                coldMs < COLD_PROBE_BUDGET_MS,
                'cold probe took ' + String(coldMs) + ' ms',
            );
        } finally {
            await sql.end();
        }
    });
}
