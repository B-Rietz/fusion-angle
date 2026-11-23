import {
    assert,
    assertEquals,
    assertMatch,
    assertNotMatch,
    assertStrictEquals,
} from '@std/assert';
import { join } from '@std/path';

function headSha(): string {
    const output = new Deno.Command('sh', {
        args: ['-c', 'git rev-parse HEAD'],
    }).outputSync();
    const decoder = new TextDecoder();
    if (!output.success) {
        throw new Error(
            'git rev-parse HEAD failed: '
            + decoder.decode(output.stderr),
        );
    }
    return decoder.decode(output.stdout).trim();
}

async function runTest(
    args: string[],
    env: Record<string, string> = {},
): Promise<{
    readonly status: number;
    readonly stdout: string;
    readonly stderr: string;
}> {
    const output = await new Deno.Command('./test', {
        args,
        signal: AbortSignal.timeout(4000),
        env: {
            POSTGRES_URL: '',
            JWT_HMAC_SIGNING_KEY: '',
            ...env,
        },
    }).output();
    const decoder = new TextDecoder();
    return {
        status: output.code,
        stdout: decoder.decode(output.stdout),
        stderr: decoder.decode(output.stderr),
    };
}

// ./test runs with deno stubbed on PATH. The stub appends
// one line per call: the worker count, whether the call
// runs files in parallel (deno reads DENO_JOBS only then),
// the time zone, and the subcommand, "unset" for what the
// call was not handed. The environment is cleared, so a
// worker count this suite itself runs under is no decoy.
async function denoCalls(
    args: readonly string[],
    env: Record<string, string>,
    timeoutMs: number,
): Promise<{
    readonly status: number;
    readonly stderr: string;
    readonly calls: readonly string[];
}> {
    const dir = Deno.makeTempDirSync({
        prefix: 'fusion-test-workers-',
    });
    const log = join(dir, 'calls.log');
    try {
        Deno.writeTextFileSync(
            join(dir, 'deno'),
            '#!/bin/bash\n'
            + 'parallel=serial\n'
            + 'for arg in "$@"; do\n'
            + '    if [ "$arg" = --parallel ]; then\n'
            + '        parallel=parallel\n'
            + '    fi\n'
            + 'done\n'
            + 'printf \'%s %s %s %s\\n\' "${DENO_JOBS-unset}" \\\n'
            + '    "$parallel" "${TZ-unset}" "$1" \\\n'
            + `    >> "${log}"\n`,
            { mode: 0o755 },
        );
        Deno.writeTextFileSync(log, '');
        const output = await new Deno.Command('./test', {
            args: [...args],
            signal: AbortSignal.timeout(timeoutMs),
            clearEnv: true,
            env: {
                PATH: `${dir}:${Deno.env.get('PATH') ?? ''}`,
                ...env,
            },
            stdout: 'null',
            stderr: 'piped',
        }).output();
        const calls = Deno.readTextFileSync(log);
        return {
            status: output.code,
            stderr: new TextDecoder().decode(output.stderr),
            calls: calls === '' ? [] : calls.trimEnd().split('\n'),
        };
    } finally {
        Deno.removeSync(dir, { recursive: true });
    }
}

// The memory passes are stubs; validate also lints the
// tree, a few seconds on a quiet machine.
const MEMORY_TIMEOUT_MS = 10_000;
const VALIDATE_TIMEOUT_MS = 60_000;

// The operator's machine is usually running other work, so
// the suite takes four workers unless one run asks.
Deno.test('test memory runs each pass on four workers',
async () => {
    const run = await denoCalls(['memory'], {}, MEMORY_TIMEOUT_MS);
    assertStrictEquals(run.status, 0);
    assertEquals(run.calls, [
        '4 parallel UTC test',
        '4 parallel Pacific/Honolulu test',
    ]);
});

Deno.test('test memory keeps a worker count it is given',
async () => {
    const run = await denoCalls(
        ['memory'], { DENO_JOBS: '16' }, MEMORY_TIMEOUT_MS,
    );
    assertStrictEquals(run.status, 0);
    assertEquals(run.calls, [
        '16 parallel UTC test',
        '16 parallel Pacific/Honolulu test',
    ]);
});

// Deno reads a DENO_JOBS that names no count as one worker,
// so the suite would run serially and say nothing.
Deno.test('test memory refuses a worker count that is none',
async () => {
    for (const jobs of ['abc', '0', '-4', '4x', ' 4']) {
        const run = await denoCalls(
            ['memory'], { DENO_JOBS: jobs }, MEMORY_TIMEOUT_MS,
        );
        assertStrictEquals(run.status, 1, jobs);
        assertMatch(run.stderr, /DENO_JOBS/, jobs);
        assertEquals(run.calls, [], jobs);
    }
});

// The count is the memory suite's alone: the steps after
// it, and a browser or Postgres suite validate goes on to,
// keep deno's own. Validate runs the lint for real.
Deno.test('test validate hands the worker count to no other step',
async () => {
    const dir = Deno.makeTempDirSync({
        prefix: 'most-recently-validated-sha-',
    });
    try {
        const run = await denoCalls(['validate'], {
            MOST_RECENTLY_VALIDATED_SHA_PATH: join(
                dir, 'most-recently-validated-sha',
            ),
            WORKING_TREE_PORCELAIN: ' M test',
        }, VALIDATE_TIMEOUT_MS);
        assertStrictEquals(run.status, 0, run.stderr);
        assertEquals(run.calls, [
            'unset serial unset --version',
            'unset serial unset check',
            '4 parallel UTC test',
            '4 parallel Pacific/Honolulu test',
            'unset serial unset run',
            'unset serial unset run',
        ]);
    } finally {
        Deno.removeSync(dir, { recursive: true });
    }
});

Deno.test('test unknown suite exits 1 with usage',
async () => {
    const result = await runTest(['bogus']);
    assertStrictEquals(result.status, 1);
    assertMatch(result.stderr, /Usage: \.\/test/);
});

Deno.test('test validate skips when HEAD already passed',
async () => {
    const stamp = join(
        Deno.makeTempDirSync({
            prefix: 'most-recently-validated-sha-',
        }),
        'most-recently-validated-sha',
    );
    Deno.writeTextFileSync(stamp, `${headSha()}\n`);
    const result = await runTest(['validate'], {
        MOST_RECENTLY_VALIDATED_SHA_PATH: stamp,
        WORKING_TREE_PORCELAIN: '',
    });
    assertStrictEquals(result.status, 0);
    assertMatch(
        result.stdout,
        /already validated [0-9a-f]{40}/,
    );
});

Deno.test('test memory does not SHA-skip', () => {
    const src = Deno.readTextFileSync('test');
    const skipAt = src.indexOf('already validated');
    const memoryAt = src.indexOf('run_memory()');
    assert(skipAt >= 0, 'skip message missing');
    assert(memoryAt >= 0, 'run_memory missing');
    assert(
        src.includes('MOST_RECENTLY_VALIDATED_SHA_PATH'),
    );
    assertNotMatch(
        src,
        /VALIDATE_OK|validate-ok/,
    );
});

Deno.test('test dispatcher names combinations', () => {
    const src = Deno.readTextFileSync('test');
    assertMatch(src, /validate browser/);
    assertMatch(src, /validate \[--syntax\]/);
    assertNotMatch(src, /VALIDATE_OK/);
    assertNotMatch(src, /validate-ok/);
});

Deno.test('validate --syntax is check and does not stamp',
() => {
    const src = Deno.readTextFileSync('test');
    const at = src.indexOf('"$1" = "--syntax"');
    assert(at >= 0, '--syntax branch missing');
    const end = src.indexOf('elif', at);
    assert(end > at, '--syntax branch unclosed');
    const branch = src.slice(at, end);
    assertMatch(branch, /run_check/);
    assertNotMatch(branch, /run_memory/);
    assertNotMatch(branch, /run_validate/);
    assertNotMatch(branch, /most-recently-validated-sha/);
});

Deno.test('validate --syntax rejects an extra argument',
async () => {
    const result = await runTest([
        'validate', '--syntax', 'browser',
    ]);
    assertStrictEquals(result.status, 1);
    assertMatch(result.stderr, /Usage: \.\/test/);
});

Deno.test(
    'test validate skip returns so combinations continue',
() => {
    const src = Deno.readTextFileSync('test');
    const skipAt = src.indexOf('already validated');
    assert(skipAt >= 0, 'skip message missing');
    const skipEnd = src.indexOf('\n    fi', skipAt);
    assert(skipEnd > skipAt, 'skip branch unclosed');
    const skipBranch = src.slice(skipAt, skipEnd);
    assertMatch(skipBranch, /\breturn\b/);
    assertNotMatch(skipBranch, /exit 0/);

    const comboAt = src.indexOf('"$1" = "browser"');
    assert(comboAt >= 0, 'browser combination missing');
    const comboEnd = src.indexOf('elif', comboAt + 1);
    assert(comboEnd > comboAt, 'browser combo unclosed');
    const combo = src.slice(comboAt, comboEnd);
    const runAt = combo.indexOf('run_validate');
    const execAt = combo.indexOf('bin/test-browser');
    assert(runAt >= 0, 'run_validate missing in combo');
    assert(execAt >= 0, 'test-browser exec missing');
    assert(
        runAt < execAt,
        'browser exec before run_validate',
    );
});

// compose-lib's mint and teardown are exercised through
// bin/measure in tests/measure-wrapper.test.ts.
Deno.test('test-postgres mints its stack through compose-lib',
() => {
    const src = Deno.readTextFileSync('bin/test-postgres');
    assertMatch(src, /\. "\$BIN\/compose-lib"/);
    assertMatch(src, /mint_compose_env 8080/);
    assertMatch(
        src,
        /COMPOSE_PROJECT_NAME="fusion-test-postgres-\$\$"/,
    );
    assertMatch(src, /trap compose_down_once EXIT INT TERM/);
    assertNotMatch(src, /openssl rand/);
    assertNotMatch(src, /docker compose -p/);
});
