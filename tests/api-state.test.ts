import { assertEquals } from '@std/assert';
import {
    REQUEST_HEADERS,
    requestHeaderOf,
} from '../api/request-header-names.ts';
import { apiState, apiStatusUrl } from '../server/api-status.ts';

// /status's question to the API, asked of a throwaway listener
// on port 0 that answers as each test says. The hop that waits
// names the state: an answer of any kind is never `timeout`.

// The wait for an API that answers. Generous, so a loaded run
// never reads an answer as a timeout: an answer that comes at
// any time is never `timeout`.
const ANSWER_WAIT_MS = 10_000;

// A silent API speaks once apiState returns, or at the
// backstop, so a wait that never expires fails its assertion
// rather than hanging the suite.
const RELEASE_BACKSTOP_MS = 10_000;

async function withApi(
    answer: (request: Request) => Response | Promise<Response>,
    run: (url: string) => Promise<void>,
): Promise<void> {
    const server = Deno.serve({
        hostname: '127.0.0.1',
        port: 0,
        onListen: () => {},
    }, answer);
    try {
        await run(apiStatusUrl(server.addr.port));
    } finally {
        await server.shutdown();
    }
}

Deno.test('the API status URL is the loopback port', () => {
    assertEquals(
        apiStatusUrl(8080),
        'http://127.0.0.1:8080/api/status',
    );
});

Deno.test('a 200 that says up is up', async () => {
    await withApi(
        () => Response.json({ up: true }),
        async (url) => {
            assertEquals(await apiState(url, ANSWER_WAIT_MS), 'up');
        },
    );
});

Deno.test('the API is asked for JSON, anonymously', async () => {
    const seen: (string | null)[][] = [];
    await withApi(
        (request) => {
            seen.push([
                request.method,
                new URL(request.url).pathname,
                requestHeaderOf(
                    request.headers, REQUEST_HEADERS.accept,
                ),
                requestHeaderOf(
                    request.headers, REQUEST_HEADERS.operationId,
                ),
                requestHeaderOf(
                    request.headers, REQUEST_HEADERS.authorization,
                ),
            ]);
            return Response.json({ up: true });
        },
        async (url) => {
            await apiState(url, ANSWER_WAIT_MS);
        },
    );
    assertEquals(seen, [
        ['GET', '/api/status', 'application/json', null, null],
    ]);
});

const DOWN_ANSWERS: readonly {
    readonly name: string;
    readonly answer: () => Response;
}[] = [
    {
        name: 'a 503 that says down',
        answer: () => Response.json({ up: false }, { status: 503 }),
    },
    {
        name: 'a 200 whose up is the string true',
        answer: () => Response.json({ up: 'true' }),
    },
    {
        name: 'a 200 whose body is not JSON',
        answer: () => new Response('up', { status: 200 }),
    },
    {
        name: 'a 404',
        answer: () => Response.json(
            { error: 'Not found' }, { status: 404 },
        ),
    },
];

for (const { name, answer } of DOWN_ANSWERS) {
    Deno.test(name + ' is down', async () => {
        await withApi(answer, async (url) => {
            assertEquals(await apiState(url, ANSWER_WAIT_MS), 'down');
        });
    });
}

Deno.test('a refused connection is down', async () => {
    const vacant = Deno.listen({ hostname: '127.0.0.1', port: 0 });
    const port = vacant.addr.port;
    vacant.close();
    assertEquals(
        await apiState(apiStatusUrl(port), ANSWER_WAIT_MS),
        'down',
    );
});

Deno.test('an answer after the wait is a timeout', async () => {
    const { promise: released, resolve: release } =
        Promise.withResolvers<void>();
    await withApi(
        async () => {
            await released;
            return Response.json({ up: true });
        },
        async (url) => {
            const backstop = setTimeout(
                release, RELEASE_BACKSTOP_MS,
            );
            try {
                assertEquals(await apiState(url, 20), 'timeout');
            } finally {
                clearTimeout(backstop);
                release();
            }
        },
    );
});

Deno.test('a body after the wait is a timeout', async () => {
    const { promise: released, resolve: release } =
        Promise.withResolvers<void>();
    await withApi(
        () => new Response(
            new ReadableStream<Uint8Array>({
                async pull(controller) {
                    await released;
                    controller.enqueue(new TextEncoder().encode(
                        JSON.stringify({ up: true }),
                    ));
                    controller.close();
                },
            }),
            { status: 200 },
        ),
        async (url) => {
            const backstop = setTimeout(
                release, RELEASE_BACKSTOP_MS,
            );
            try {
                assertEquals(await apiState(url, 20), 'timeout');
            } finally {
                clearTimeout(backstop);
                release();
            }
        },
    );
});
