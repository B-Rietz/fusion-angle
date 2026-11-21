import { assert, assertEquals } from '@std/assert';
import {
    handleRequest,
    requestHandlerFor,
} from '../api/api.ts';
import { memoryDbAdapter } from '../api/db-memory.ts';
import { generateIdentifier } from
    '../shared/identifier.ts';
import type { ComponentState } from
    '../shared/system-status.ts';

// The status route, as the gate answers it. A request here
// carries no Operation-ID and no Authorization line, but for
// the test that sends junk ones. An adapter has no schema,
// but for the test that counts the message plane, so a read
// before the probe would throw.

const COMMIT = { sha: 'a'.repeat(40) };

const STATUS_URL = 'http://x/status';

Deno.test('GET /status answers the commit and its components',
async () => {
    const response = await requestHandlerFor(COMMIT)(
        memoryDbAdapter(), new Request(STATUS_URL),
    );
    assertEquals(response.status, 200);
    assertEquals(await response.json(), {
        'git-sha': COMMIT.sha,
        up: true,
        components: { postgres: 'up' },
    });
    assert(response.headers.has('request-id'));
});

Deno.test('GET /status names the commit by its subject',
async () => {
    const subject = `<b>"it's" \\ \${x} é`;
    const response = await requestHandlerFor(
        { sha: COMMIT.sha, subject },
    )(memoryDbAdapter(), new Request(STATUS_URL));
    assertEquals(response.status, 200);
    const document = await response.json();
    assertEquals(document, {
        'git-sha': COMMIT.sha,
        'git-subject': subject,
        up: true,
        components: { postgres: 'up' },
    });
    assertEquals(
        Object.keys(document),
        ['git-sha', 'git-subject', 'up', 'components'],
    );
});

for (const state of ['down', 'timeout'] as const) {
    Deno.test('GET /status is 503 when postgres is ' + state,
    async () => {
        const adapter = memoryDbAdapter();
        adapter.probe = async () => state;
        const response = await requestHandlerFor(COMMIT)(
            adapter, new Request(STATUS_URL),
        );
        assertEquals(response.status, 503);
        assertEquals(await response.json(), {
            'git-sha': COMMIT.sha,
            up: false,
            components: { postgres: state },
        });
        assert(response.headers.has('request-id'));
    });
}

Deno.test('GET /status with no commit is 500 and probes nothing',
async () => {
    let probes = 0;
    const adapter = memoryDbAdapter();
    adapter.probe = async (): Promise<ComponentState> => {
        probes += 1;
        return 'up';
    };
    const response = await handleRequest(
        adapter, new Request(STATUS_URL),
    );
    assertEquals(response.status, 500);
    assertEquals(
        await response.json(),
        { error: 'git sha unavailable' },
    );
    assertEquals(probes, 0);
});

Deno.test('GET /status refuses a carried Request-ID',
async () => {
    const response = await requestHandlerFor(COMMIT)(
        memoryDbAdapter(),
        new Request(STATUS_URL, {
            headers: { 'Request-ID': generateIdentifier() },
        }),
    );
    assertEquals(response.status, 400);
    assertEquals(
        await response.json(),
        { error: 'Request-ID is minted by the server' },
    );
});

for (const method of ['POST', 'PUT', 'DELETE']) {
    Deno.test(method + ' /status is 405 and allows GET',
    async () => {
        let probes = 0;
        const adapter = memoryDbAdapter();
        adapter.probe = async (): Promise<ComponentState> => {
            probes += 1;
            return 'up';
        };
        const response = await requestHandlerFor(COMMIT)(
            adapter, new Request(STATUS_URL, { method }),
        );
        assertEquals(response.status, 405);
        assertEquals(response.headers.get('allow'), 'GET');
        assertEquals(await response.json(), {
            error: 'Method ' + method + ' not allowed on /status',
        });
        assertEquals(probes, 0);
    });
}

Deno.test('GET /status reads neither Operation-ID nor a bearer',
async () => {
    const response = await requestHandlerFor(COMMIT)(
        memoryDbAdapter(),
        new Request(STATUS_URL, {
            headers: {
                'Operation-ID': 'not an identifier',
                Authorization: 'Bearer junk',
            },
        }),
    );
    assertEquals(response.status, 200);
    assertEquals(await response.json(), {
        'git-sha': COMMIT.sha,
        up: true,
        components: { postgres: 'up' },
    });
});

Deno.test('GET /status stores nothing', async () => {
    const adapter = memoryDbAdapter();
    await adapter.postSchemaCreation();
    const before = (await adapter.messagePairs.getAll()).length;
    const response = await requestHandlerFor(COMMIT)(
        adapter, new Request(STATUS_URL),
    );
    assertEquals(response.status, 200);
    assertEquals(
        (await adapter.messagePairs.getAll()).length, before,
    );
});
