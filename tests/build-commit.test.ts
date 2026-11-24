import { assertEquals, assertNotEquals } from '@std/assert';

// A subject that would change a shell program were it
// spliced into one unquoted.
const SUBJECT = `It's a "test" $HOME \\ subject`;

// The suite's --allow-run names sh and not bash, so the
// library must parse under POSIX sh.
const FETCHED_COMMIT =
    '. ./bin/build-lib && fetched_commit "$1" "$2"';

// The commit is made from no one's git config, so a
// signing or hook setting cannot reach it.
const HERMETIC_GIT = {
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
};

async function git(args: string[]): Promise<string> {
    const output = await new Deno.Command('git', {
        args,
        env: HERMETIC_GIT,
        stdout: 'piped',
        stderr: 'piped',
    }).output();
    const decoder = new TextDecoder();
    assertEquals(
        output.success, true, decoder.decode(output.stderr),
    );
    return decoder.decode(output.stdout).trim();
}

// This file names ./bin/build, so each shell it spawns
// is handed /dev/null for the result cache's root, by the
// rule tests/sha-result-cache-isolation.test.ts pins.
async function fetchedCommit(
    url: string, sha: string, scratchTmp: string,
): Promise<{ code: number; stdout: string }> {
    const output = await new Deno.Command('sh', {
        args: ['-c', FETCHED_COMMIT, 'sh', url, sha],
        env: {
            ...HERMETIC_GIT,
            TMPDIR: scratchTmp,
            SHA_RESULT_CACHE_ROOT: '/dev/null',
        },
        stdout: 'piped',
        stderr: 'null',
    }).output();
    return {
        code: output.code,
        stdout: new TextDecoder().decode(output.stdout),
    };
}

Deno.test('fetched_commit reads the commit a URL holds',
async () => {
    const root = await Deno.makeTempDir();
    try {
        const repo = `${root}/repo`;
        const scratchTmp = `${root}/tmp`;
        const empty = `${root}/empty`;
        await Deno.mkdir(scratchTmp);
        await Deno.mkdir(empty);
        await git(['init', '--quiet', repo]);
        await git([
            '-C', repo,
            '-c', 'user.name=Test',
            '-c', 'user.email=test@example.com',
            'commit', '--quiet', '--allow-empty',
            '-m', 'First',
        ]);
        await git([
            '-C', repo,
            '-c', 'user.name=Test',
            '-c', 'user.email=test@example.com',
            'commit', '--quiet', '--allow-empty',
            '-m', SUBJECT,
        ]);
        await git([
            '-C', repo, 'config', 'uploadpack.allowFilter',
            'true',
        ]);
        await git([
            '-C', repo, 'config',
            'uploadpack.allowAnySHA1InWant', 'true',
        ]);
        const sha = await git(['-C', repo, 'rev-parse', 'HEAD']);
        const url = `file://${repo}`;

        const time = await git([
            '-C', repo, 'log', '-1', '--format=%ct',
        ]);
        const firstSha = await git([
            '-C', repo, 'rev-parse', 'HEAD~1',
        ]);
        const firstTime = await git([
            '-C', repo, 'log', '-1', '--format=%ct', 'HEAD~1',
        ]);
        const held = await fetchedCommit(url, sha, scratchTmp);
        assertEquals(held.code, 0);
        assertEquals(
            held.stdout,
            sha + ' ' + time + ' ' + SUBJECT + '\n'
            + sha + ' ' + time + ' ' + SUBJECT + '\n'
            + firstSha + ' ' + firstTime + ' First\n',
        );
        assertEquals([...Deno.readDirSync(scratchTmp)], []);

        const absent = await fetchedCommit(
            url, '0'.repeat(40), scratchTmp,
        );
        assertNotEquals(absent.code, 0);
        assertEquals(absent.stdout, '');
        assertEquals([...Deno.readDirSync(scratchTmp)], []);

        const notRepository = await fetchedCommit(
            `file://${empty}`, sha, scratchTmp,
        );
        assertNotEquals(notRepository.code, 0);
        assertEquals(notRepository.stdout, '');
        assertEquals([...Deno.readDirSync(scratchTmp)], []);
    } finally {
        await Deno.remove(root, { recursive: true });
    }
});

// A local Docker build copies a worktree's .git, a
// pointer to a directory the image lacks, so the host
// hands its commit log into the build encoded.
const HOST_LOG = '. ./bin/build-lib && host_commit_log_base64 "$1"';
const DECODED_LOG = '. ./bin/build-lib && decoded_commit_log "$1"';

async function shLibrary(
    program: string, arg: string,
): Promise<{ code: number; stdout: string }> {
    const output = await new Deno.Command('sh', {
        args: ['-c', program, 'sh', arg],
        env: { ...HERMETIC_GIT, SHA_RESULT_CACHE_ROOT: '/dev/null' },
        stdout: 'piped',
        stderr: 'null',
    }).output();
    return {
        code: output.code,
        stdout: new TextDecoder().decode(output.stdout),
    };
}

Deno.test('the host commit log survives a Docker build',
async () => {
    const root = await Deno.makeTempDir();
    try {
        const repo = `${root}/repo`;
        await git(['init', '--quiet', repo]);
        await git([
            '-C', repo,
            '-c', 'user.name=Test',
            '-c', 'user.email=test@example.com',
            'commit', '--quiet', '--allow-empty',
            '-m', SUBJECT,
        ]);
        const sha = await git(['-C', repo, 'rev-parse', 'HEAD']);
        const time = await git([
            '-C', repo, 'log', '-1', '--format=%ct',
        ]);

        const encoded = await shLibrary(HOST_LOG, repo);
        assertEquals(encoded.code, 0);
        assertEquals(/^[A-Za-z0-9+/=]+$/.test(encoded.stdout), true);

        const decoded = await shLibrary(
            DECODED_LOG, encoded.stdout,
        );
        assertEquals(decoded.code, 0);
        assertEquals(
            decoded.stdout,
            sha + ' ' + time + ' ' + SUBJECT + '\n'
            + sha + ' ' + time + ' ' + SUBJECT + '\n',
        );

        const notALog = await shLibrary(
            DECODED_LOG, btoa('not a commit log\n'),
        );
        assertNotEquals(notALog.code, 0);
        assertEquals(notALog.stdout, '');

        const empty = await shLibrary(DECODED_LOG, '');
        assertNotEquals(empty.code, 0);
        assertEquals(empty.stdout, '');
    } finally {
        await Deno.remove(root, { recursive: true });
    }
});

Deno.test('a local compose stack carries the host commit log',
async () => {
    const minted = await new Deno.Command('sh', {
        args: [
            '-c',
            '. ./bin/compose-lib && mint_compose_env 8080'
            + ' && printf %s "$FUSION_COMMIT_LOG_BASE64"',
        ],
        env: { SHA_RESULT_CACHE_ROOT: '/dev/null' },
        stdout: 'piped',
        stderr: 'null',
    }).output();
    assertEquals(minted.code, 0);
    const encoded = new TextDecoder().decode(minted.stdout);
    const decoded = await shLibrary(DECODED_LOG, encoded);
    assertEquals(decoded.code, 0);
    const head = await git(['log', '-1', '--format=%H %ct %s']);
    assertEquals(decoded.stdout.split('\n')[0], head);
});

const COMPOSE_LOG_ARG = new RegExp(
    '^ {16}FUSION_COMMIT_LOG_BASE64: '
    + '\\$\\{FUSION_COMMIT_LOG_BASE64:-\\}$',
    'gm',
);

Deno.test('every local image build receives the host log', () => {
    const build = Deno.readTextFileSync('bin/build');
    const gitAt = build.indexOf(
        'COMMIT_LOG="$(commit_log . "$GIT_SHA")"',
    );
    const hostAt = build.indexOf(
        'elif [ -n "${FUSION_COMMIT_LOG_BASE64:-}" ]; then',
    );
    const decodeAt = build.indexOf(
        'decoded_commit_log \\\n'
        + '        "$FUSION_COMMIT_LOG_BASE64")"',
    );
    const renderAt = build.indexOf('fetched_commit \\');
    assertEquals(
        gitAt > 0 && gitAt < hostAt && hostAt < decodeAt
            && decodeAt < renderAt,
        true,
    );

    const docker = Deno.readTextFileSync('Dockerfile');
    const runtimeAt = docker.indexOf(' AS runtime');
    const builder = docker.slice(0, runtimeAt);
    const argAt = builder.indexOf(
        '\nARG FUSION_COMMIT_LOG_BASE64\n',
    );
    const runAt = builder.indexOf(
        'RUN ./bin/build --no-zip render-out/',
    );
    assertEquals(argAt > 0 && argAt < runAt, true);
    assertEquals(
        docker.slice(runtimeAt).includes('FUSION_COMMIT_LOG'),
        false,
    );

    const compose = Deno.readTextFileSync('compose.yaml');
    const builds = compose.match(/^ {8}build:/gm) ?? [];
    const args = compose.match(COMPOSE_LOG_ARG) ?? [];
    assertEquals(builds.length, 3);
    assertEquals(args.length, builds.length);
});
