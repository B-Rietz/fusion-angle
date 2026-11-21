import {
    assert,
    assertEquals,
    assertMatch,
    assertNotMatch,
    assertStrictEquals,
    assertStringIncludes,
} from '@std/assert';
import { join } from '@std/path';
import { memoryDbAdapter } from '../api/db-memory.ts';
import {
    HTTP_INTERNAL_ERROR,
    HTTP_NOT_FOUND,
    HTTP_OK,
    HTTP_PAYLOAD_TOO_LARGE,
    HTTP_SERVICE_UNAVAILABLE,
    HTTP_UNAUTHORIZED,
} from '../shared/http-errors.ts';
import {
    CONTENT_SECURITY_POLICY,
    HASHED_CACHE_CONTROL,
    NO_STORE,
    REQUEST_BODY_MAX_BYTES,
    listenHttp,
    type HttpListener,
    type RequestHandler,
} from '../server/http-server.ts';
import type {
    ComponentState,
    RunningCommit,
} from '../shared/system-status.ts';
import {
    REQUEST_HEADERS,
    requestHeaderOf,
} from '../api/request-header-names.ts';
import { fetchDiscardingBody } from
    './fixtures/fetch-discarding-body.ts';
import { withPerformanceNow } from
    './fixtures/performance-now.ts';
import { generateIdentifier } from
    '../shared/identifier.ts';
import { runningCommitFor } from
    '../server/git-sha.ts';

// The Office of Time: RFC-3339 zulu at the fullest
// resolution the environment provides — six digits here.
const ZULU_6 =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

const JSON_ASK = {
    headers: { 'content-type': 'application/json' },
};

const STATUS_SHA =
    '0123456789abcdef0123456789abcdef01234567';

// /status's wait for an API expected to answer. Generous, so
// a loaded run never reads its answer as a timeout: the
// product's own wait is pinned where it is defined.
const ANSWER_WAIT_MS = 10_000;

// A silent API speaks at the backstop, so a wait that never
// expires fails its assertion rather than hanging the suite.
const RELEASE_BACKSTOP_MS = 10_000;

async function gzipBytes(
    text: string,
): Promise<Uint8Array> {
    const source = new Blob([text]).stream()
        .pipeThrough(
            new CompressionStream('gzip'),
        );
    return new Uint8Array(
        await new Response(source).arrayBuffer(),
    );
}

function concatChunks(
    chunks: readonly Uint8Array[],
): Uint8Array {
    let size = 0;
    for (const chunk of chunks) size += chunk.byteLength;
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return bytes;
}

// Deno fetch decompresses gzip and injects Accept-Encoding
// gzip,br, so a pin of sidecar bytes has to speak HTTP/1.1.
async function rawRequest(
    url: string,
    method: string,
    headers: Record<string, string>,
): Promise<{
    status: number;
    header(name: string): string | null;
    body: Uint8Array;
}> {
    const parsed = new URL(url);
    const conn = await Deno.connect({
        hostname: parsed.hostname,
        port: Number(parsed.port),
    });
    try {
        const lines = [
            method + ' ' + parsed.pathname + ' HTTP/1.1',
            'Host: ' + parsed.host,
            'Connection: close',
        ];
        for (const [name, value] of Object.entries(headers)) {
            lines.push(name + ': ' + value);
        }
        await conn.write(
            new TextEncoder().encode(
                lines.join('\r\n') + '\r\n\r\n',
            ),
        );
        const chunks: Uint8Array[] = [];
        const buf = new Uint8Array(8192);
        for (;;) {
            const n = await conn.read(buf);
            if (n === null) break;
            chunks.push(buf.slice(0, n));
        }
        const bytes = concatChunks(chunks);
        const splitAt = new TextDecoder().decode(bytes)
            .indexOf('\r\n\r\n');
        if (splitAt === -1) {
            throw new Error('no HTTP header terminator');
        }
        const head = new TextDecoder().decode(
            bytes.slice(0, splitAt),
        );
        const body = bytes.slice(splitAt + 4);
        const headerLines = head.split('\r\n');
        const status = Number(
            (headerLines[0] ?? '').split(' ')[1],
        );
        const parsedHeaders = new Headers();
        for (const line of headerLines.slice(1)) {
            const colon = line.indexOf(':');
            if (colon === -1) continue;
            parsedHeaders.append(
                line.slice(0, colon).trim(),
                line.slice(colon + 1).trim(),
            );
        }
        return {
            status,
            header: (name) => parsedHeaders.get(name),
            body,
        };
    } finally {
        conn.close();
    }
}

async function withServer(
    files: Record<string, string | Uint8Array>,
    handle: RequestHandler | undefined,
    run: (
        base: string,
        logs: Record<string, unknown>[],
    ) => Promise<void>,
    commit?: RunningCommit,
    probe?: () => Promise<ComponentState>,
    apiStatusWaitMs?: number,
): Promise<void> {
    const root = await Deno.makeTempDir({
        prefix: 'fusion-http-',
    });
    const logs: Record<string, unknown>[] = [];
    let listener: HttpListener | undefined;
    try {
        for (const [rel, body] of Object.entries(files)) {
            const path = join(root, rel);
            await Deno.mkdir(join(path, '..'), {
                recursive: true,
            });
            if (body instanceof Uint8Array) {
                await Deno.writeFile(path, body);
            } else {
                await Deno.writeTextFile(path, body);
            }
        }
        const adapter = memoryDbAdapter();
        if (probe !== undefined) adapter.probe = probe;
        const options = {
            adapter,
            staticRoot: root,
            port: 0,
            host: '127.0.0.1',
            log: (line: Record<string, unknown>) => {
                logs.push(line);
            },
            ...(handle !== undefined ? { handle } : {}),
            ...(commit !== undefined ? { commit } : {}),
            apiStatusWaitMs: apiStatusWaitMs ?? ANSWER_WAIT_MS,
        };
        listener = await listenHttp(options);
        await run(
            'http://127.0.0.1:' + String(listener.port),
            logs,
        );
    } finally {
        if (listener !== undefined) await listener.close();
        await Deno.remove(root, { recursive: true });
    }
}

Deno.test('body over 1 MiB is 413 and is not parsed',
async () => {
    let handled = 0;
    const handle: RequestHandler = async () => {
        handled += 1;
        return new Response('parsed', { status: 200 });
    };
    await withServer({}, handle, async (base, logs) => {
        const res = await fetch(base + '/ideas', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: 'x'.repeat(REQUEST_BODY_MAX_BYTES + 1),
        });
        assertStrictEquals(res.status, HTTP_PAYLOAD_TOO_LARGE);
        assertStrictEquals(
            res.headers.get('cache-control'),
            NO_STORE,
        );
        const body = await res.json() as {
            error: string;
        };
        assertStrictEquals(body.error, 'payload too large');
        assertStrictEquals(handled, 0);
        assertStrictEquals(
            res.headers.get('request-id'), null,
        );
        const last = logs[logs.length - 1];
        assert(last !== undefined);
        assertStrictEquals(last['requestId'], undefined);
        assertStrictEquals(
            last['operationId'], undefined,
        );
    });
});

Deno.test(
    'the request log keeps sub-millisecond latency',
    async () => {
        let nowMs = 2.286459;
        const handle: RequestHandler = async () => {
            nowMs = 2.381417;
            return new Response('handled', { status: 200 });
        };
        await withPerformanceNow(() => nowMs, () =>
            withServer({}, handle, async (base, logs) => {
                const res = await fetch(base + '/api/ideas');
                assertStrictEquals(await res.text(), 'handled');
                const last = logs[logs.length - 1];
                assert(last !== undefined);
                assertStrictEquals(last['latencyMs'], 0.095);
            }),
        );
    },
);

Deno.test(
    'the request log stamps RFC-3339 zulu microseconds',
    async () => {
        await withServer({}, undefined, async (base, logs) => {
            const res = await fetchDiscardingBody(
                base + '/missing.html',
            );
            assertStrictEquals(res.status, HTTP_NOT_FOUND);
            const last = logs[logs.length - 1];
            assert(last !== undefined);
            assertMatch(String(last['at']), ZULU_6);
        });
    },
);

Deno.test('HTML is no-store and hashed assets are immutable',
async () => {
    await withServer({
        'landing/index.html': '<p>hi</p>',
        'assets/app.js': 'console.log(1)',
        'assets/app.deadbeef.js': 'ok',
    }, undefined, async (base) => {
        const page = await fetch(
            base + '/landing/index.html',
        );
        assertStrictEquals(page.status, 200);
        assertStrictEquals(
            page.headers.get('cache-control'),
            NO_STORE,
        );
        assertStrictEquals(await page.text(), '<p>hi</p>');

        const app = await fetchDiscardingBody(base + '/assets/app.js');
        assertStrictEquals(app.status, 200);
        assertStrictEquals(
            app.headers.get('cache-control'),
            NO_STORE,
        );

        const hashed = await fetchDiscardingBody(
            base + '/assets/app.deadbeef.js',
        );
        assertStrictEquals(hashed.status, 200);
        assertStrictEquals(
            hashed.headers.get('cache-control'),
            HASHED_CACHE_CONTROL,
        );
    });
});

Deno.test('HTML carries the Content-Security-Policy header',
async () => {
    await withServer({
        'landing/index.html': '<p>hi</p>',
        'assets/app.js': 'console.log(1)',
    }, undefined, async (base) => {
        const page = await fetchDiscardingBody(
            base + '/landing/index.html',
        );
        assertStrictEquals(page.status, 200);
        assertStrictEquals(
            page.headers.get('content-security-policy'),
            "default-src 'self'; script-src 'self';"
            + " style-src 'self';"
            + " style-src-attr 'unsafe-inline';"
            + " font-src 'self'; img-src 'self' data:;"
            + " frame-ancestors 'none'; base-uri 'self';"
            + " form-action 'self'",
        );
        assertStrictEquals(
            page.headers.get('content-security-policy'),
            CONTENT_SECURITY_POLICY,
        );

        const head = await fetchDiscardingBody(
            base + '/landing/index.html',
            { method: 'HEAD' },
        );
        assertStrictEquals(head.status, 200);
        assertStrictEquals(
            head.headers.get('content-security-policy'),
            CONTENT_SECURITY_POLICY,
        );

        const app = await fetchDiscardingBody(base + '/assets/app.js');
        assertStrictEquals(app.status, 200);
        assertStrictEquals(
            app.headers.get('content-security-policy'),
            null,
        );

        const miss = await fetchDiscardingBody(base + '/assets/no.js');
        assertStrictEquals(miss.status, 404);
        assertStrictEquals(
            miss.headers.get('content-security-policy'),
            null,
        );
    });
});

Deno.test('missing static file is 404', async () => {
    await withServer({}, undefined, async (base) => {
        const res = await fetchDiscardingBody(base + '/assets/no.js');
        assertStrictEquals(res.status, HTTP_NOT_FOUND);
    });
});

Deno.test('API path without a token is 401 before 404',
async () => {
    await withServer({}, undefined, async (base, logs) => {
        const operationId = generateIdentifier();
        const res = await fetchDiscardingBody(
            base
            + '/api/organizations/AjdvjuECVZEgZoFajaIEkg'
            + '/ideas?secret=1',
            {
                headers: {
                    'operation-id': operationId,
                },
            },
        );
        assertStrictEquals(res.status, HTTP_UNAUTHORIZED);
        const requestId = res.headers.get('request-id');
        const last = logs[logs.length - 1];
        assert(last !== undefined);
        assertStrictEquals(
            last['path'],
            '/api/organizations/AjdvjuECVZEgZoFajaIEkg/ideas',
        );
        assertStrictEquals(last['method'], 'GET');
        assertStrictEquals(last['status'], HTTP_UNAUTHORIZED);
        assertStrictEquals(typeof last['at'], 'string');
        assertMatch(
            String(last['at']),
            /^\d{4}-\d{2}-\d{2}T/,
        );
        assertStrictEquals(typeof requestId, 'string');
        assertStrictEquals(last['operationId'], operationId);
        assertStrictEquals(last['requestId'], requestId);
    });
});

Deno.test('no web-app HTML carries a CSP meta; the server does',
() => {
    const files: string[] = [];
    const walk = (dir: string): void => {
        for (const entry of Deno.readDirSync(dir)) {
            const path = join(dir, entry.name);
            if (entry.isDirectory) {
                walk(path);
            } else if (entry.name.endsWith('.html')) {
                files.push(path);
            }
        }
    };
    walk('web-app');
    assert(files.length >= 30);
    for (const path of files) {
        assertNotMatch(
            Deno.readTextFileSync(path),
            /Content-Security-Policy/,
            path + ' carries a CSP meta',
        );
    }
    assertMatch(
        Deno.readTextFileSync('server/http-server.ts'),
        /Content-Security-Policy/,
    );
});

Deno.test(
    'gzip sidecar is served when accepted',
    async () => {
        const body = 'console.log(1)';
        const gz = await gzipBytes(body);
        await withServer({
            'assets/app.deadbeef.js': body,
            'assets/app.deadbeef.js.gz': gz,
        }, undefined, async (base) => {
            const res = await rawRequest(
                base + '/assets/app.deadbeef.js',
                'GET',
                { 'Accept-Encoding': 'gzip' },
            );
            assertStrictEquals(res.status, 200);
            assertStrictEquals(
                res.header('content-encoding'),
                'gzip',
            );
            assertStrictEquals(
                res.header('vary'),
                'Accept-Encoding',
            );
            assertStrictEquals(
                res.header('cache-control'),
                HASHED_CACHE_CONTROL,
            );
            assertStrictEquals(
                res.header('content-type')
                    ?.startsWith(
                        'text/javascript',
                    )
                    || res.header(
                        'content-type',
                    )?.includes('javascript'),
                true,
            );
            assertStrictEquals(
                res.header('content-length'),
                String(gz.length),
            );
            assertEquals([...res.body], [...gz]);
        });
    },
);

Deno.test(
    'identity body when gzip is not accepted',
    async () => {
        const body = 'console.log(1)';
        const gz = await gzipBytes(body);
        await withServer({
            'assets/app.deadbeef.js': body,
            'assets/app.deadbeef.js.gz': gz,
        }, undefined, async (base) => {
            const res = await fetch(
                base + '/assets/app.deadbeef.js',
                {
                    headers: {
                        'Accept-Encoding': 'identity',
                    },
                },
            );
            assertStrictEquals(res.status, 200);
            assertStrictEquals(
                res.headers.get('content-encoding'),
                null,
            );
            assertStrictEquals(
                res.headers.get('vary'),
                'Accept-Encoding',
            );
            assertStrictEquals(
                await res.text(), body,
            );
        });
    },
);

Deno.test(
    'HEAD reports the gzip Content-Length',
    async () => {
        const body = 'console.log(1)';
        const gz = await gzipBytes(body);
        await withServer({
            'assets/app.deadbeef.js': body,
            'assets/app.deadbeef.js.gz': gz,
        }, undefined, async (base) => {
            const res = await fetch(
                base + '/assets/app.deadbeef.js',
                {
                    method: 'HEAD',
                    headers: {
                        'Accept-Encoding': 'gzip',
                    },
                },
            );
            assertStrictEquals(res.status, 200);
            assertStrictEquals(
                res.headers.get('content-encoding'),
                'gzip',
            );
            assertStrictEquals(
                res.headers.get('content-length'),
                String(gz.length),
            );
            assertStrictEquals(
                await res.text(), '',
            );
        });
    },
);

Deno.test(
    'gzip;q=0 does not accept the sidecar',
    async () => {
        const body = 'console.log(1)';
        const gz = await gzipBytes(body);
        await withServer({
            'assets/app.deadbeef.js': body,
            'assets/app.deadbeef.js.gz': gz,
        }, undefined, async (base) => {
            const res = await fetch(
                base + '/assets/app.deadbeef.js',
                {
                    headers: {
                        'Accept-Encoding': 'gzip;q=0',
                    },
                },
            );
            assertStrictEquals(res.status, 200);
            assertStrictEquals(
                res.headers.get('content-encoding'),
                null,
            );
            assertStrictEquals(
                await res.text(), body,
            );
        });
    },
);

Deno.test(
    'request path ending in .gz is 404',
    async () => {
        const body = 'console.log(1)';
        const gz = await gzipBytes(body);
        await withServer({
            'assets/app.deadbeef.js': body,
            'assets/app.deadbeef.js.gz': gz,
        }, undefined, async (base) => {
            const res = await fetchDiscardingBody(
                base + '/assets/app.deadbeef.js.gz',
            );
            assertStrictEquals(res.status, HTTP_NOT_FOUND);
        });
    },
);

Deno.test('GET /status returns the given git sha',
async () => {
    const sha =
        '0123456789abcdef0123456789abcdef01234567';
    await withServer({}, undefined, async (base) => {
        const res = await fetch(base + '/status', JSON_ASK);
        assertStrictEquals(res.status, HTTP_OK);
        assertStrictEquals(
            res.headers.get('cache-control'),
            NO_STORE,
        );
        assertStrictEquals(
            res.headers.get('content-type'),
            'application/json; charset=utf-8',
        );
        assertStrictEquals(
            res.headers.get('vary'),
            'Accept, Content-Type',
        );
        assertEquals(
            await res.json(),
            {
                'git-sha': sha,
                up: true,
                components: { api: 'up' },
            },
        );
        assertStrictEquals(
            res.headers.get('request-id'), null,
        );
    }, { sha });
});

Deno.test('GET /status asks the API over HTTP',
async () => {
    const seen: (string | null)[][] = [];
    const handle: RequestHandler = async (_adapter, request) => {
        seen.push([
            request.method,
            new URL(request.url).pathname,
            requestHeaderOf(
                request.headers, REQUEST_HEADERS.accept,
            ),
        ]);
        return Response.json({ up: true });
    };
    await withServer({}, handle, async (base) => {
        const res = await fetch(base + '/status', JSON_ASK);
        assertStrictEquals(res.status, HTTP_OK);
        assertEquals(await res.json(), {
            'git-sha': STATUS_SHA,
            up: true,
            components: { api: 'up' },
        });
    }, { sha: STATUS_SHA });
    assertEquals(seen, [['GET', '/status', 'application/json']]);
});

Deno.test('GET /status reads the worktree when unset',
async () => {
    const expected = await runningCommitFor(undefined);
    assert(expected !== undefined, 'worktree commit');
    assert(expected.subject !== undefined, 'HEAD subject');
    assert(expected.committedAt !== undefined, 'HEAD time');
    assert(expected.merges !== undefined, 'HEAD merges');
    // An age is read at the request's own clock: each is
    // checked for its shape, and set aside.
    const unaged = (
        { 'git-age': age, ...rest }: Record<string, unknown>,
    ): Record<string, unknown> => {
        assertMatch(String(age), /^(now|\d+ [a-z]+)$/);
        return rest;
    };
    await withServer({}, undefined, async (base) => {
        const res = await fetch(base + '/status', JSON_ASK);
        assertStrictEquals(res.status, HTTP_OK);
        const document = await res.json();
        const merges: Record<string, unknown>[] =
            document['git-merges'];
        assertEquals(unaged(document), {
            'git-sha': expected.sha,
            'git-subject': expected.subject,
            'git-committed-at': expected.committedAt,
            up: true,
            components: { api: 'up' },
            'git-merges': merges,
        });
        assertEquals(
            merges.map(unaged),
            expected.merges?.map((merge) => ({
                'git-sha': merge.sha,
                ...(merge.subject !== undefined
                    ? { 'git-subject': merge.subject }
                    : {}),
                'git-committed-at': merge.committedAt,
            })),
        );
    });
});

Deno.test('GET /status names the commit by its subject',
async () => {
    const subject = `<b>"it's" \\ \${x} é`;
    await withServer({}, undefined, async (base) => {
        for (const path of ['/status', '/api/status']) {
            const res = await fetch(base + path, JSON_ASK);
            assertStrictEquals(res.status, HTTP_OK);
            const document = await res.json();
            assertStrictEquals(
                document['git-subject'], subject,
            );
            assertEquals(
                Object.keys(document),
                ['git-sha', 'git-subject', 'up', 'components'],
            );
        }
        const page = await fetch(base + '/status');
        assertStringIncludes(
            await page.text(),
            '<p class="git-subject text-sm">\n'
            + '&lt;b&gt;&quot;it\'s&quot; \\ ${x} é\n</p>',
        );
    }, { sha: STATUS_SHA, subject });
});

Deno.test('GET /status hides an unacceptable sha',
async () => {
    let handled = 0;
    const handle: RequestHandler = async () => {
        handled += 1;
        return Response.json({ up: true });
    };
    await withServer({}, handle, async (base) => {
        const res = await fetch(base + '/status', JSON_ASK);
        assertStrictEquals(
            res.status, HTTP_INTERNAL_ERROR,
        );
        assertStrictEquals(
            res.headers.get('content-type'),
            'application/json; charset=utf-8',
        );
        const body = await res.json() as {
            error: string;
        };
        assertStrictEquals(
            body.error, 'git sha unavailable',
        );
        assertEquals(
            JSON.stringify(body).includes('nope'),
            false,
        );
        assertStrictEquals(handled, 0);
    }, { sha: 'nope' });
});

Deno.test('GET /status is 503 when postgres is down',
async () => {
    const sha =
        '0123456789abcdef0123456789abcdef01234567';
    await withServer({}, undefined, async (base, logs) => {
        const res = await fetch(base + '/status', JSON_ASK);
        assertStrictEquals(
            res.status, HTTP_SERVICE_UNAVAILABLE,
        );
        assertStrictEquals(
            res.headers.get('cache-control'),
            NO_STORE,
        );
        assertEquals(await res.json(), {
            'git-sha': sha,
            up: false,
            components: { api: 'down' },
        });
        assertEquals(
            logs.map((line) => [
                line['path'],
                line['status'],
                line['level'],
                line['operationId'],
            ]),
            [
                ['/api/status', 503, 'error', undefined],
                ['/status', 503, 'error', undefined],
            ],
        );
    }, { sha }, async () => 'down');
});

Deno.test('GET /status is a timeout when the API is silent',
async () => {
    const { promise: released, resolve: release } =
        Promise.withResolvers<void>();
    const handle: RequestHandler = async () => {
        await released;
        return Response.json({ up: true });
    };
    await withServer({}, handle, async (base) => {
        const backstop = setTimeout(
            release, RELEASE_BACKSTOP_MS,
        );
        try {
            const res = await fetch(
                base + '/status', JSON_ASK,
            );
            assertStrictEquals(
                res.status, HTTP_SERVICE_UNAVAILABLE,
            );
            assertEquals(await res.json(), {
                'git-sha': STATUS_SHA,
                up: false,
                components: { api: 'timeout' },
            });
            const page = await fetch(base + '/status');
            const html = await page.text();
            assertHtmlStatus(
                page, html, HTTP_SERVICE_UNAVAILABLE,
            );
            assertStringIncludes(
                html,
                '<span class="pill" data-tone="error">'
                + 'API timeout</span>',
            );
        } finally {
            clearTimeout(backstop);
            release();
        }
    }, { sha: STATUS_SHA }, undefined, 20);
});

Deno.test('GET /status is outside the auth throttle',
async () => {
    const sha =
        '0123456789abcdef0123456789abcdef01234567';
    await withServer({}, undefined, async (base) => {
        for (let n = 0; n < 6; n += 1) {
            const res = await fetch(base + '/status', JSON_ASK);
            assertStrictEquals(res.status, HTTP_OK);
            await res.text();
        }
    }, { sha });
});

Deno.test('POST /status is not the status document',
async () => {
    let probes = 0;
    await withServer({}, undefined, async (base) => {
        const res = await fetchDiscardingBody(
            base + '/status',
            { method: 'POST' },
        );
        assertStrictEquals(res.status, HTTP_NOT_FOUND);
        assertStrictEquals(probes, 0);
    }, undefined, async () => {
        probes += 1;
        return 'up';
    });
});

function assertHtmlStatus(
    res: Response,
    html: string,
    status: number,
): void {
    assertStrictEquals(res.status, status);
    assertStrictEquals(
        res.headers.get('content-type'),
        'text/html; charset=utf-8',
    );
    assertStrictEquals(
        res.headers.get('cache-control'),
        NO_STORE,
    );
    assertStrictEquals(
        res.headers.get('vary'),
        'Accept, Content-Type',
    );
    assertStrictEquals(
        res.headers.get('content-security-policy'),
        CONTENT_SECURITY_POLICY,
    );
    assertNotMatch(html, /style=/);
}

Deno.test('GET /status is a page for a browser',
async () => {
    const manifest = JSON.stringify({
        'styles.css':
            'styles.0123abcd0123abcd.css',
        'favicon.svg':
            'favicon.0123abcd0123abcd.svg',
    });
    await withServer({
        'asset-manifest.json': manifest,
    }, undefined, async (base) => {
        const res = await fetch(base + '/status');
        const html = await res.text();
        assertHtmlStatus(res, html, HTTP_OK);
        assertStringIncludes(html, STATUS_SHA);
        assertStringIncludes(
            html, 'class="git-sha font-mono text-sm"',
        );
        assertEquals(html.includes('break-all'), false);
        assertStringIncludes(
            html,
            'status-card max-w-md p-8 text-center"\n'
            + ' data-tone="success">',
        );
        assertStringIncludes(html, '>UP</p>');
        assertNotMatch(html, /class="pill"/);
        const nameAt = html.indexOf('class="status-name"');
        const upAt = html.indexOf('>UP</p>');
        assertEquals(nameAt >= 0 && nameAt < upAt, true);
        assertStringIncludes(
            html,
            'href="/assets/'
            + 'styles.0123abcd0123abcd.css"',
        );
        assertStringIncludes(
            html,
            'href="/assets/'
            + 'favicon.0123abcd0123abcd.svg"',
        );
        const browser = await fetch(
            base + '/status',
            {
                headers: {
                    accept: 'text/html,'
                        + 'application/xhtml+xml,'
                        + 'application/xml;q=0.9,'
                        + '*/*;q=0.8',
                },
            },
        );
        const page = await browser.text();
        assertHtmlStatus(browser, page, HTTP_OK);
        assertStringIncludes(page, '>UP</p>');
        assertNotMatch(page, /class="pill"/);
        assertNotMatch(page, /<script/);
    }, { sha: STATUS_SHA });
});

Deno.test(
    'GET /status returns JSON for Content-Type',
    async () => {
        await withServer({}, undefined, async (base) => {
            const res = await fetch(base + '/status', {
                headers: {
                    'content-type':
                        'application/json; charset=utf-8',
                    accept: 'text/html',
                },
            });
            assertStrictEquals(res.status, HTTP_OK);
            assertStrictEquals(
                res.headers.get('content-type'),
                'application/json; charset=utf-8',
            );
            assertEquals(await res.json(), {
                'git-sha': STATUS_SHA,
                up: true,
                components: { api: 'up' },
            });
        }, { sha: STATUS_SHA });
    },
);

Deno.test('GET /status returns JSON for Accept',
async () => {
    await withServer({}, undefined, async (base) => {
        const res = await fetch(base + '/status', {
            headers: { accept: 'application/json' },
        });
        assertStrictEquals(res.status, HTTP_OK);
        assertEquals(await res.json(), {
            'git-sha': STATUS_SHA,
            up: true,
            components: { api: 'up' },
        });
    }, { sha: STATUS_SHA });
});

Deno.test(
    'GET /status stays HTML when HTML ranks higher',
    async () => {
        await withServer({}, undefined, async (base) => {
            const res = await fetch(base + '/status', {
                headers: {
                    accept: 'text/html,'
                        + ' application/json;q=0.8',
                },
            });
            const html = await res.text();
            assertHtmlStatus(res, html, HTTP_OK);
            assertStringIncludes(html, '>UP</p>');
            assertNotMatch(html, /class="pill"/);
        }, { sha: STATUS_SHA });
    },
);

Deno.test('GET /status page is Down when postgres is',
async () => {
    await withServer({}, undefined, async (base) => {
        const res = await fetch(base + '/status');
        const html = await res.text();
        assertHtmlStatus(
            res, html, HTTP_SERVICE_UNAVAILABLE,
        );
        assertStringIncludes(
            html,
            'status-card max-w-md p-8 text-center"\n'
            + ' data-tone="error">',
        );
        assertStringIncludes(html, '>DOWN</p>');
        assertStringIncludes(
            html,
            '<span class="pill" data-tone="error">'
            + 'API down</span>',
        );
    }, { sha: STATUS_SHA }, async () => 'down');
});

// The API answered, so /status names it down: a timeout is
// reported only by the hop that waited.
Deno.test('GET /status is down when the probe times out',
async () => {
    await withServer({}, undefined, async (base) => {
        const res = await fetch(base + '/status', JSON_ASK);
        assertStrictEquals(
            res.status, HTTP_SERVICE_UNAVAILABLE,
        );
        assertEquals(await res.json(), {
            'git-sha': STATUS_SHA,
            up: false,
            components: { api: 'down' },
        });
        const page = await fetch(base + '/status');
        const html = await page.text();
        assertHtmlStatus(
            page, html, HTTP_SERVICE_UNAVAILABLE,
        );
        assertStringIncludes(
            html,
            '<span class="pill" data-tone="error">'
            + 'API down</span>',
        );
    }, { sha: STATUS_SHA }, async () => 'timeout');
});

Deno.test('GET /status page hides an unacceptable sha',
async () => {
    let handled = 0;
    const handle: RequestHandler = async () => {
        handled += 1;
        return Response.json({ up: true });
    };
    await withServer({}, handle, async (base) => {
        const res = await fetch(base + '/status');
        const html = await res.text();
        assertHtmlStatus(
            res, html, HTTP_INTERNAL_ERROR,
        );
        assertStringIncludes(
            html, 'git sha unavailable',
        );
        assertEquals(html.includes('nope'), false);
        assertStrictEquals(handled, 0);
    }, { sha: 'nope' });
});

Deno.test(
    'GET /status omits an unpublished asset link',
    async () => {
        await withServer({
            'asset-manifest.json': JSON.stringify({
                'styles.css': '../styles.css',
                'favicon.svg': 'favicon.svg',
            }),
        }, undefined, async (base) => {
            const res = await fetch(base + '/status');
            const html = await res.text();
            assertHtmlStatus(res, html, HTTP_OK);
            assertNotMatch(html, /<link/);
            assertStringIncludes(html, '>UP</p>');
        }, { sha: STATUS_SHA });
    },
);

Deno.test('GET /status loads its published script',
async () => {
    await withServer({
        'asset-manifest.json': JSON.stringify({
            'status-refresh.js':
                'status-refresh.0123abcd0123abcd.js',
        }),
    }, undefined, async (base) => {
        const res = await fetch(base + '/status');
        const html = await res.text();
        assertHtmlStatus(res, html, HTTP_OK);
        assertStringIncludes(
            html,
            '<script src="/assets/'
            + 'status-refresh.0123abcd0123abcd.js"'
            + ' defer></script>',
        );
        assertStringIncludes(
            html, '<div id="status-live" aria-live="polite">',
        );
        assertStringIncludes(
            html,
            '<span class="pill" data-tone="error">'
            + 'Timeout</span>',
        );
    }, { sha: STATUS_SHA });
});

Deno.test('GET /api/status answers the system status',
async () => {
    await withServer({}, undefined, async (base, logs) => {
        const res = await fetch(base + '/api/status');
        assertStrictEquals(res.status, HTTP_OK);
        assertStrictEquals(
            res.headers.get('cache-control'),
            NO_STORE,
        );
        assertEquals(await res.json(), {
            'git-sha': STATUS_SHA,
            up: true,
            components: { postgres: 'up' },
        });
        const requestId = res.headers.get('request-id');
        assertStrictEquals(typeof requestId, 'string');
        const last = logs[logs.length - 1];
        assert(last !== undefined);
        assertStrictEquals(last['path'], '/api/status');
        assertStrictEquals(last['status'], HTTP_OK);
        assertStrictEquals(last['requestId'], requestId);
        assertStrictEquals(
            last['operationId'], undefined,
        );
    }, { sha: STATUS_SHA });
});
