import { assert, assertEquals } from '@std/assert';

// The page's code-split chunk enters here: page-registry's
// loader imports it, and the bundle holds its graph.
const PAGE_ENTRY = 'web-app/api-documentation/index.ts';

const ROOT = new URL('../', import.meta.url);

// The server's code, which the browser never loads: the
// catalog and the sample files are the only bridge.
const FENCED = ['api/', 'server/'].map((dir) => new URL(dir, ROOT).href);

// One module graph resolves in about a second; a minute
// bounds a stalled resolve, not a slow one.
const INFO_TIMEOUT_MS = 60_000;

// What `deno info --json` says of the graph: each module's
// specifier, read once here and trusted after.
function specifiersOf(json: unknown): readonly string[] {
    if (typeof json !== 'object' || json === null
        || !('modules' in json) || !Array.isArray(json.modules)) {
        throw new Error('deno info names no modules');
    }
    return json.modules.map((module: unknown) => {
        if (typeof module !== 'object' || module === null
            || !('specifier' in module)
            || typeof module.specifier !== 'string') {
            throw new Error('a module in deno info has no specifier');
        }
        return module.specifier;
    });
}

Deno.test('the page\'s bundle never imports api/ or server/',
async () => {
    const result = await new Deno.Command('deno', {
        args: ['info', '--frozen', '--json', PAGE_ENTRY],
        cwd: ROOT,
        signal: AbortSignal.timeout(INFO_TIMEOUT_MS),
    }).output();
    assertEquals(
        result.code, 0, new TextDecoder().decode(result.stderr),
    );
    const specifiers = specifiersOf(
        JSON.parse(new TextDecoder().decode(result.stdout)),
    );
    assert(
        specifiers.includes(new URL(PAGE_ENTRY, ROOT).href),
        'the graph lacks its own entry',
    );
    assertEquals(
        specifiers.filter((specifier) =>
            FENCED.some((fenced) => specifier.startsWith(fenced))),
        [],
    );
});
