import {
    assert,
    assertEquals,
    assertMatch,
    assertNotMatch,
    assertStrictEquals,
    assertStringIncludes,
} from '@std/assert';
import { fromFileUrl, relative } from '@std/path';
import { embeddedCommit } from '../server/git-sha.ts';

const BUILD_SCRIPT = Deno.readTextFileSync('bin/build');
const BUILD_LIB_SCRIPT = Deno.readTextFileSync(
    'bin/build-lib',
);
// The package list of the Dockerfile's apt-get install.
const DOCKER_INSTALL =
    /apt-get install -y\s+--no-install-recommends\s+([^\\&\n]+)/;

// Deleted names no longer appear in live source. Hunt
// the live mint symbols too, or a server-core import of
// access-token would pass this pin.
const FORBIDDEN_INPUTS = [
    'api/access-token.ts',
] as const;
const FORBIDDEN_SOURCES = [
    'SIGNING_KEY_MATERIAL',
    'fekPpDYfJoFZmvUBauTxHA',
    'hmacSigningKeyMaterial',
    'mintAccessToken',
] as const;

function clientGraphHits(
    input: string,
    src: string,
): string[] {
    const hits: string[] = [];
    for (const fragment of FORBIDDEN_INPUTS) {
        if (input.includes(fragment)) {
            hits.push(input + ':' + fragment);
        }
    }
    for (const fragment of FORBIDDEN_SOURCES) {
        if (src.includes(fragment)) {
            hits.push(input + ':' + fragment);
        }
    }
    return hits;
}

Deno.test('build emits one ZIP from the server-core entry', () => {
    assertMatch(
        BUILD_SCRIPT,
        /fusion-angle-\$\{SHA\}\.zip/,
    );
    assertNotMatch(
        BUILD_SCRIPT,
        /fusion-ai-browser/,
    );
    assertNotMatch(
        BUILD_SCRIPT,
        /fusion-angle-browser/,
    );
    assertMatch(
        BUILD_LIB_SCRIPT,
        /web-app\/app\/server-core\.ts/,
    );
    assertNotMatch(
        BUILD_LIB_SCRIPT,
        /web-app\/app\/core\.ts/,
    );
});

Deno.test('client-graph pin matches mint and deleted names',
() => {
    const input = 'api/access-token.ts';
    const src = Deno.readTextFileSync(input);
    assertEquals(
        clientGraphHits(input, src),
        [
            'api/access-token.ts:api/access-token.ts',
            'api/access-token.ts:hmacSigningKeyMaterial',
            'api/access-token.ts:mintAccessToken',
        ],
    );
    assertEquals(
        clientGraphHits(
            'sample/path.ts',
            'SIGNING_KEY_MATERIAL',
        ),
        [
            'sample/path.ts:SIGNING_KEY_MATERIAL',
        ],
    );
});

Deno.test(
    'client graph omits token mint and signing key',
    () => {
        // No env override: Deno.Command already inherits
        // the full ambient environment when env is omitted,
        // same as Node's own spawnSync default.
        const info = new Deno.Command('deno', {
            args: [
                'info', '--frozen', '--json',
                'web-app/app/server-core.ts',
            ],
        }).outputSync();
        const decoder = new TextDecoder();
        assertStrictEquals(
            info.code, 0, decoder.decode(info.stderr),
        );
        const graph = JSON.parse(
            decoder.decode(info.stdout),
        ) as {
            roots: string[];
            modules: {
                specifier: string;
                dependencies?: {
                    code?: { specifier: string };
                }[];
            }[];
        };
        const bySpecifier = new Map(
            graph.modules.map((m) => [m.specifier, m]),
        );
        const seen = new Set<string>();
        const queue = [...graph.roots];
        while (queue.length > 0) {
            const at = queue.pop()!;
            if (seen.has(at)) continue;
            seen.add(at);
            const mod = bySpecifier.get(at);
            if (mod === undefined) continue;
            for (const dep of mod.dependencies ?? []) {
                if (dep.code === undefined) continue;
                queue.push(dep.code.specifier);
            }
        }
        const hits: string[] = [];
        for (const specifier of seen) {
            if (!specifier.startsWith('file://')) continue;
            const path = relative(
                Deno.cwd(),
                fromFileUrl(specifier),
            );
            hits.push(...clientGraphHits(
                path, Deno.readTextFileSync(path),
            ));
        }
        assertEquals(hits, []);
    },
);

Deno.test('build entry carries the running commit', () => {
    assertMatch(
        BUILD_SCRIPT,
        /GIT_SHA="\$\(git rev-parse HEAD 2>\/dev\/null \|\| true\)"/,
    );
    assertMatch(
        BUILD_SCRIPT,
        /GIT_SUBJECT="\$\(git log -1 --format=%s "\$GIT_SHA"\)"/,
    );
    // Render's build has no repository: it fetches the
    // one commit Render names and reads both from it.
    assertStringIncludes(
        BUILD_SCRIPT,
        'fetched_commit \\\n'
        + '        "https://github.com/${RENDER_GIT_REPO_SLUG}.git"'
        + ' \\\n'
        + '        "$RENDER_GIT_COMMIT")',
    );
    assertNotMatch(BUILD_SCRIPT, /GIT_SHA="\$\{?RENDER_GIT_COMMIT/);
    assertMatch(
        BUILD_SCRIPT,
        /Error: no commit SHA to embed\./,
    );
    // A subject is arbitrary text, so the entry carries it
    // encoded and never spliced into source.
    const entryAt = BUILD_SCRIPT.indexOf('<<ENTRY\n');
    const entry = BUILD_SCRIPT.slice(
        entryAt,
        BUILD_SCRIPT.indexOf('\nENTRY\n', entryAt),
    );
    assertStrictEquals(entryAt > 0, true);
    assertMatch(
        entry,
        /import \{ dispatch, embeddedCommit \} from/,
    );
    assertStringIncludes(
        entry,
        "Deno.args,\n    embeddedCommit('${GIT_SHA}',"
        + " '${GIT_SUBJECT_BASE64}'),",
    );
    assertNotMatch(entry, /\$\{GIT_SUBJECT\}/);
    const compileAt = BUILD_SCRIPT.indexOf(
        'deno compile',
    );
    const refuseAt = BUILD_SCRIPT.indexOf(
        'Error: no commit SHA to embed.',
    );
    assertStrictEquals(refuseAt < compileAt, true);
    const docker = Deno.readTextFileSync('Dockerfile');
    const runtimeAt = docker.indexOf(
        'FROM denoland/deno:2.9.8 AS runtime',
    );
    const builder = docker.slice(0, runtimeAt);
    assertMatch(builder, /\nARG RENDER_GIT_COMMIT\n/);
    assertMatch(builder, /\nARG RENDER_GIT_REPO_SLUG\n/);
    const commitArgAt = builder.indexOf(
        'ARG RENDER_GIT_COMMIT',
    );
    const slugArgAt = builder.indexOf(
        'ARG RENDER_GIT_REPO_SLUG',
    );
    const buildAt = builder.indexOf(
        'RUN ./bin/build --no-zip render-out/',
    );
    assertStrictEquals(
        commitArgAt > 0 && commitArgAt < slugArgAt
            && slugArgAt < buildAt,
        true,
    );
    const runtime = docker.slice(runtimeAt);
    assertEquals(runtime.includes('RENDER_GIT_COMMIT'), false);
    assertEquals(
        runtime.includes('RENDER_GIT_REPO_SLUG'), false,
    );
    // The fetch speaks HTTPS to GitHub, and the base image
    // trusts no certificate authority of its own.
    const install = DOCKER_INSTALL.exec(builder);
    assert(install !== null, 'the builder installs packages');
    const packages = install[1]!.trim().split(/\s+/);
    assertEquals(packages.includes('git'), true);
    assertEquals(packages.includes('ca-certificates'), true);
    assertNotMatch(runtime, /apt-get|ca-certificates|\bgit\b/);
});

// GNU base64 wraps at 76 columns, so the subject runs past
// that and must still arrive as one line, byte for byte.
Deno.test('build encodes the subject the entry decodes',
async () => {
    const line = /^GIT_SUBJECT_BASE64=.*$/m.exec(BUILD_SCRIPT);
    assert(line !== null, 'the encoding line');
    const subject = `-n <b>"it's" \\ \${x} $HOME é `.repeat(4);
    const sha = '0123456789abcdef0123456789abcdef01234567';
    const output = await new Deno.Command('sh', {
        args: [
            '-c',
            line[0] + '\nprintf %s "$GIT_SUBJECT_BASE64"',
        ],
        env: { GIT_SUBJECT: subject },
        stdout: 'piped',
    }).output();
    assertStrictEquals(output.success, true);
    const encoded = new TextDecoder().decode(output.stdout);
    assertNotMatch(encoded, /\n/);
    assertEquals(
        embeddedCommit(sha, encoded),
        { sha, subject },
    );
});

Deno.test('build --no-zip help names deploy', () => {
    assertMatch(
        BUILD_SCRIPT,
        /Usage: \.\/bin\/build/,
    );
    assertMatch(
        BUILD_SCRIPT,
        /the fusion-angle executable — for \.\/deploy/,
    );
    assertNotMatch(
        BUILD_SCRIPT,
        /for \.\/serve/,
    );
    assertNotMatch(
        BUILD_SCRIPT,
        /\.\/crank/,
    );
});
