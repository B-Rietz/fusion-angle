import { assertStrictEquals } from '@std/assert';
import { join } from '@std/path';
import { memoryDbAdapter } from '../api/db-memory.ts';
import { HTTP_OK } from '../shared/http-errors.ts';
import { listenHttp } from '../server/http-server.ts';

// The page fetches an endpoint's sample when it opens,
// as a .json file beside it.
const SAMPLE_PATH = 'api-documentation/samples/get/organizations.json';
const SAMPLE_JSON = '{\n  "hash": "get/organizations"\n}\n';

Deno.test('a .json file is served as application/json',
async () => {
    const root = await Deno.makeTempDir({ prefix: 'fusion-http-' });
    try {
        const path = join(root, SAMPLE_PATH);
        await Deno.mkdir(join(path, '..'), { recursive: true });
        await Deno.writeTextFile(path, SAMPLE_JSON);
        const listener = await listenHttp({
            adapter: memoryDbAdapter(),
            staticRoot: root,
            port: 0,
            host: '127.0.0.1',
            log: () => {},
        });
        try {
            const res = await fetch(
                'http://127.0.0.1:' + String(listener.port)
                    + '/' + SAMPLE_PATH,
            );
            assertStrictEquals(res.status, HTTP_OK);
            assertStrictEquals(
                res.headers.get('content-type'), 'application/json',
            );
            assertStrictEquals(
                res.headers.get('cache-control'), 'no-store',
            );
            assertStrictEquals(await res.text(), SAMPLE_JSON);
        } finally {
            await listener.close();
        }
    } finally {
        await Deno.remove(root, { recursive: true });
    }
});
