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
        /COMMIT_LOG="\$\(commit_log \. "\$GIT_SHA"\)"/,
    );
    // Render's build has no repository: it fetches the
    // commit Render names and reads the log from it.
    assertStringIncludes(
        BUILD_SCRIPT,
        'fetched_commit \\\n'
        + '        "https://github.com/${RENDER_GIT_REPO_SLUG}.git"'
        + ' \\\n'
        + '        "$RENDER_GIT_COMMIT")',
    );
    assertNotMatch(BUILD_SCRIPT, /GIT_SHA="\$\{?RENDER_GIT_COMMIT/);
    assertStringIncludes(
        BUILD_SCRIPT,
        '[ "${COMMIT_LOG%% *}" != "$RENDER_GIT_COMMIT" ]',
    );
    assertMatch(
        BUILD_SCRIPT,
        /Error: no commit SHA to embed\./,
    );
    // A subject is arbitrary text, so the entry carries the
    // log encoded and never spliced into source.
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
        "Deno.args,\n    embeddedCommit('${COMMIT_LOG_BASE64}'),",
    );
    assertNotMatch(entry, /\$\{COMMIT_LOG\}/);
    assertNotMatch(entry, /\$\{GIT_SHA\}/);
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

// GNU base64 wraps at 76 columns, so the log runs past
// that and must still arrive as one line, byte for byte.
Deno.test('build encodes the log the entry decodes',
async () => {
    const line = /^COMMIT_LOG_BASE64=.*$/m.exec(BUILD_SCRIPT);
    assert(line !== null, 'the encoding line');
    const subject = `-n <b>"it's" \\ \${x} $HOME é`.repeat(4);
    const sha = '0123456789abcdef0123456789abcdef01234567';
    const merge = 'fedcba9876543210fedcba9876543210fedcba98';
    const log = sha + ' 1795240408 ' + subject + '\n'
        + merge + ' 1795239823 Land a merge';
    const output = await new Deno.Command('sh', {
        args: [
            '-c',
            line[0] + '\nprintf %s "$COMMIT_LOG_BASE64"',
        ],
        // This file names ./bin/build, so the shell is
        // handed /dev/null for the result cache's root
        // and for the timer's ledger
        // (tests/sha-result-cache-isolation.test.ts).
        env: {
            COMMIT_LOG: log,
            SHA_RESULT_CACHE_ROOT: '/dev/null',
            TOOL_DURATIONS_PATH: '/dev/null',
        },
        stdout: 'piped',
    }).output();
    assertStrictEquals(output.success, true);
    const encoded = new TextDecoder().decode(output.stdout);
    assertNotMatch(encoded, /\n/);
    assertEquals(embeddedCommit(encoded), {
        sha,
        subject,
        committedAt: '2026-11-21T05:53:28.000Z',
        history: [{
            sha: merge,
            subject: 'Land a merge',
            committedAt: '2026-11-21T05:43:43.000Z',
        }],
    });
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
