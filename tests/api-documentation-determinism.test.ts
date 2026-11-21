import { assert, assertEquals } from '@std/assert';
import { join } from '@std/path';
import { routes } from '../api/routes.ts';
import {
    endpointsOf,
    NO_SAMPLE,
} from '../web-app/app/api-documentation-story.ts';
import { STEPS } from
    '../web-app/app/api-documentation-guided-start.ts';

const MAIN_ENTRY = 'web-app/app/generate-api-documentation-main.ts';
// A whole generation replays every endpoint; two run at
// once beside the rest of the suite.
const GENERATION_TIMEOUT_MS = 180_000;

// Every file under root, by path relative to it.
function filesUnder(root: string): Map<string, string> {
    const files = new Map<string, string>();
    const walk = (abs: string, rel: string): void => {
        const names = [...Deno.readDirSync(abs)]
            .map((entry) => entry.name)
            .sort();
        for (const name of names) {
            const childAbs = join(abs, name);
            const childRel = rel === '' ? name : rel + '/' + name;
            if (Deno.statSync(childAbs).isDirectory) {
                walk(childAbs, childRel);
            } else {
                files.set(childRel, Deno.readTextFileSync(childAbs));
            }
        }
    };
    walk(root, '');
    return files;
}

async function generateInto(
    out: string,
    env: Record<string, string>,
): Promise<void> {
    const result = await new Deno.Command('deno', {
        args: [
            'run', '--frozen', '--allow-read',
            '--allow-write=' + out,
            '--allow-env=JWT_HMAC_SIGNING_KEY',
            MAIN_ENTRY, '--out', out,
        ],
        env,
        stdout: 'null',
        stderr: 'piped',
        signal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
    }).output();
    assertEquals(
        result.code, 0, new TextDecoder().decode(result.stderr),
    );
}

Deno.test('two generations write the same bytes', async () => {
    const utc = await Deno.makeTempDir({ prefix: 'fusion-docs-' });
    const honolulu = await Deno.makeTempDir({ prefix: 'fusion-docs-' });
    try {
        await Promise.all([
            generateInto(utc, { TZ: 'UTC' }),
            generateInto(honolulu, {
                TZ: 'Pacific/Honolulu',
                JWT_HMAC_SIGNING_KEY: 'operator-key-sentinel',
            }),
        ]);
        const first = filesUnder(utc);
        assertEquals(first, filesUnder(honolulu));
        for (const { hash } of endpointsOf(routes)) {
            if (NO_SAMPLE.has(hash)) continue;
            assert(
                first.has('samples/' + hash + '.json'),
                'no sample for ' + hash,
            );
        }
        for (const { slug } of STEPS) {
            assert(
                first.has('samples/start/' + slug + '.json'),
                'no sample for step ' + slug,
            );
        }
    } finally {
        await Deno.remove(utc, { recursive: true });
        await Deno.remove(honolulu, { recursive: true });
    }
});
