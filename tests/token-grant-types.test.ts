import { assert, assertEquals } from '@std/assert';
import { memoryDbAdapter } from '../api/db-memory.ts';
import { handleRequest } from '../api/api.ts';
import { GRANT_TYPES } from '../api/authentication.ts';
import { framedRequest } from './http-fixtures.ts';
import { captureConsole } from './fixtures/console-capture.ts';

const BASE = 'http://localhost';

async function postGrantType(
    grantType: unknown,
): Promise<{ status: number; error: unknown }> {
    const db = memoryDbAdapter();
    await db.postSchemaCreation();
    const body = new TextEncoder().encode(
        JSON.stringify({ grant_type: grantType }),
    );
    const { result } = await captureConsole('warn', async () => {
        const response = await handleRequest(db, framedRequest(
            `${BASE}/authentication/token`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'content-length': String(body.byteLength),
                },
                body,
            }));
        const text = await response.text();
        const parsed: unknown = text === ''
            ? null
            : JSON.parse(text);
        const error = parsed !== null && typeof parsed === 'object'
            ? (parsed as Record<string, unknown>).error
            : undefined;
        return { status: response.status, error };
    });
    return result;
}

Deno.test('each grant type is dispatched', async () => {
    for (const grantType of GRANT_TYPES) {
        const { status, error } = await postGrantType(grantType);
        assert(
            status !== 400
            || typeof error !== 'string'
            || !error.startsWith('unsupported grant_type'),
            `${grantType} was refused as unsupported`,
        );
    }
});

Deno.test('an unknown grant type answers 400 as before',
async () => {
    assertEquals(await postGrantType('password'), {
        status: 400,
        error: 'unsupported grant_type: password',
    });
    assertEquals(await postGrantType(42), {
        status: 400,
        error: 'unsupported grant_type: ',
    });
});
