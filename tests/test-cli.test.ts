import {
    assert,
    assertEquals,
    assertMatch,
    assertNotMatch,
    assertStrictEquals,
    assertStringIncludes,
} from '@std/assert';
import { join } from '@std/path';

// The source of one shell function, header to closing
// brace.
function functionBody(src: string, name: string): string {
    const at = src.indexOf(`\n${name}() {\n`);
    assert(at >= 0, `${name} missing`);
    const end = src.indexOf('\n}\n', at);
    assert(end > at, `${name} unclosed`);
    return src.slice(at, end);
}

// No case run through here reaches a step. The result
// cache is handed /dev/null for its root all the same, by
// the rule tests/sha-result-cache-isolation.test.ts pins.
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
            SHA_RESULT_CACHE_ROOT: '/dev/null',
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
//
// The result cache is handed /dev/null for its root, where
// no root can be made. This checkout's tree is not the
// test's to keep clean. On a clean one the script would
// otherwise record the stub's pass under the real SHA, in
// the operator's cache, replay it to the next case, and
// ask deno its version twice more for every step.
//
// The timer is handed /dev/null for its ledger, which
// means there is none. With one it would run the stub
// twice more for every step, and write the stub's
// instant passes into the operator's ledger as the
// recent duration of the real suite.
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
                SHA_RESULT_CACHE_ROOT: '/dev/null',
                TOOL_DURATIONS_PATH: '/dev/null',
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
    const run = await denoCalls(
        ['validate'], {}, VALIDATE_TIMEOUT_MS,
    );
    assertStrictEquals(run.status, 0, run.stderr);
    assertEquals(run.calls, [
        'unset serial unset --version',
        'unset serial unset check',
        '4 parallel UTC test',
        '4 parallel Pacific/Honolulu test',
        'unset serial unset run',
        'unset serial unset run',
    ]);
});

Deno.test('test unknown suite exits 1 with usage',
async () => {
    const result = await runTest(['bogus']);
    assertStrictEquals(result.status, 1);
    assertMatch(result.stderr, /Usage: \.\/test/);
});

// Each script that does a step's work asks the result
// cache at its own door. test does three steps itself and
// execs the scripts that do the other two, which keeps
// their process ids the ones a signal reaches.
Deno.test('test asks the result cache for its own three steps',
() => {
    const src = Deno.readTextFileSync('test');
    assertMatch(src, /\. "\$ROOT\/bin\/sha-result-cache-lib"/);
    assertMatch(src, /replay_or_run memory -- .*run_memory/);
    assertMatch(src, /replay_or_run lint -- .*run_lint/);
    assertMatch(
        src, /replay_or_run api-docs -- .*run_api_docs/,
    );
    assertNotMatch(src, /replay_or_run (postgres|browser)/);
    assertMatch(
        src, /postgres\) exec "\$ROOT\/bin\/test-postgres" ;;/,
    );
    assertMatch(
        src, /browser\) exec "\$ROOT\/bin\/test-browser" ;;/,
    );
    assertNotMatch(
        src, /most-recently-validated-sha|already validated/,
    );
    assertNotMatch(src, /MOST_RECENTLY_VALIDATED_SHA_PATH/);
    assertNotMatch(src, /WORKING_TREE_PORCELAIN/);
    assertNotMatch(src, /VALIDATE_OK|validate-ok/);
});

Deno.test('validate composes cached and uncached steps',
() => {
    const body = functionBody(
        Deno.readTextFileSync('test'), 'run_validate',
    );
    const order = [
        'run_check',
        'replay_or_run_memory',
        'replay_or_run_lint',
        'run_schema',
        'replay_or_run_api_docs',
    ].map((step) => body.indexOf(step));
    assert(order.every((at) => at >= 0), 'a step is missing');
    assertEquals(order, order.toSorted((a, b) => a - b));
    assertNotMatch(
        body, /^\s*run_(memory|lint|api_docs)\b/m,
    );
});

// check and schema repeat in under a second; a cache
// over them would guard a cost that is not there.
Deno.test('check and schema run every time', () => {
    const src = Deno.readTextFileSync('test');
    assertNotMatch(src, /replay_or_run.*run_(check|schema)/);
    assertNotMatch(src, /replay_or_run (check|schema)/);
});

Deno.test('test dispatcher names combinations', () => {
    const src = Deno.readTextFileSync('test');
    assertMatch(src, /validate browser/);
    assertMatch(src, /validate \[--syntax\]/);
    assertNotMatch(src, /VALIDATE_OK/);
    assertNotMatch(src, /validate-ok/);
});

Deno.test('validate --syntax is check and records nothing',
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
    assertNotMatch(branch, /replay_or_run/);
    // check has no entry to write, so a syntax pass
    // cannot excuse a later full validate.
    assertNotMatch(
        functionBody(src, 'run_check'), /replay_or_run/,
    );
});

Deno.test('validate --syntax rejects an extra argument',
async () => {
    const result = await runTest([
        'validate', '--syntax', 'browser',
    ]);
    assertStrictEquals(result.status, 1);
    assertMatch(result.stderr, /Usage: \.\/test/);
});

// A replay returns to its caller, which
// tests/sha-result-cache.test.ts pins, so a validate that
// replays every step still reaches the suite after it.
Deno.test('validate browser reaches the browser suite', () => {
    const src = Deno.readTextFileSync('test');
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

// bin/test-postgres asks at its own door, with Docker,
// the minted stack, and its teardown all inside the step:
// a replay needs none of them.
Deno.test('test-postgres asks the result cache at its own door',
() => {
    const src = Deno.readTextFileSync('bin/test-postgres');
    assertMatch(src, /\. "\$BIN\/sha-result-cache-lib"/);
    const suite = functionBody(src, 'postgres_suite');
    assertMatch(suite, /command -v docker/);
    assertMatch(suite, /mint_compose_env 8080/);
    assertMatch(suite, /trap compose_down_once EXIT INT TERM/);
    assertMatch(suite, /docker compose up -d --wait postgres/);
    assertMatch(suite, /tests\/pg-acceptance\.test\.ts/);
    assertMatch(
        src, /\nreplay_or_run postgres -- .*postgres_suite\n/,
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

// An attached Chrome is one browser for every file, so
// only a run that launches its own Chromes runs its
// files together. The guard stands inside the step the
// result cache asks about: a replay schedules nothing.
Deno.test('test-browser runs files together only unattached',
() => {
    const src = Deno.readTextFileSync('bin/test-browser');
    const suite = functionBody(src, 'browser_suite');
    const guard = "    SCHEDULE=''\n"
        + '    if [ -z "${CHROME_DEBUG_URL:-}" ]; then\n'
        + "        SCHEDULE='--parallel'\n";
    assert(suite.includes(guard), 'unattached guard missing');
    const named = src.split('\n').filter((line) =>
        !line.trimStart().startsWith('#')
        && line.includes('--parallel')
    );
    assertStrictEquals(named.length, 1);
    assertMatch(
        suite, /deno test --frozen --no-check \$SCHEDULE /,
    );
});

// A file with no run seed named seeds its own, so a run
// that forgot to land one would stay green and seed once
// per file. The script names the seed in the run's
// directory and lands it before any file starts, inside
// the step the result cache asks about: a replay lands
// none.
Deno.test('test-browser lands one seed before the files',
() => {
    const suite = functionBody(
        Deno.readTextFileSync('bin/test-browser'),
        'browser_suite',
    );
    const named = 'export FUSION_ANGLE_BROWSER_SEED='
        + '"$RUN_DIR/seed.json"\n';
    const run = 'deno run --frozen'
        + ' --allow-env=JWT_HMAC_SIGNING_KEY \\\n'
        + '        --allow-write="$RUN_DIR" \\\n';
    const landed = 'tests/browser/land-run-seed.ts'
        + ' "$FUSION_ANGLE_BROWSER_SEED"\n';
    const namedAt = suite.indexOf(named);
    const runAt = suite.indexOf(run);
    const landedAt = suite.indexOf(landed);
    const filesAt = suite.indexOf('deno test --frozen');
    assert(namedAt >= 0, 'run seed not named');
    assert(runAt > namedAt, 'landing not scoped');
    assert(
        landedAt === runAt + run.length + '        '.length,
        'run seed not landed',
    );
    assert(filesAt > landedAt, 'files start before the seed');
});

// Only bin/test-browser knows which browser it will
// drive, so it asks the result cache at its own door,
// naming the browser by what Chrome says it is: Chrome
// replaces itself in place, and a path would not see it.
// The run's directory and the trap that removes it are
// the step's own, so a replay makes neither.
Deno.test('test-browser asks the result cache per browser',
() => {
    const src = Deno.readTextFileSync('bin/test-browser');
    assertMatch(src, /source "\$BIN\/sha-result-cache-lib"/);
    const suite = functionBody(src, 'browser_suite');
    assertMatch(suite, /mktemp -d/);
    assertMatch(suite, /trap 'rm -rf "\$RUN_DIR"' EXIT/);
    assertMatch(suite, /bundle_client "\$BUNDLE"/);
    assertMatch(suite, /tests\/browser\/\*\.test\.ts/);
    // Each ask's command is the timed suite, so a replay
    // is never a sample.
    const timed = " -- \\\n        timed './test browser' browser_suite\n";
    assertStringIncludes(
        src, 'replay_or_run "browser $CHROME_DEBUG_URL"' + timed,
    );
    assertMatch(src, /BROWSER="\$\("\$CHROME" --version/);
    // A Chrome that says nothing names no browser.
    assertMatch(src, /&& \[ -n "\$BROWSER" \]\nthen\n/);
    assertStringIncludes(
        src, 'replay_or_run "browser $BROWSER"' + timed,
    );
});

// The ZIP build crosses the five-second line and leaves
// a file, so it asks the result cache and names its ZIP,
// which a replay proves first. The --no-zip build
// measured under the line and builds every time.
Deno.test('build replays only its ZIP', () => {
    const src = Deno.readTextFileSync('bin/build');
    assertMatch(src, /source "\$BIN\/sha-result-cache-lib"/);
    const work = functionBody(src, 'build');
    assertMatch(work, /bundle_client "\$BUILD_DIR\/site"/);
    assertMatch(work, /deno compile --frozen/);
    assertMatch(work, /zip -r "\$SERVER_ZIP" \./);
    const noZipAt = src.indexOf(
        '\nif [ "$NO_ZIP" = true ]; then\n',
    );
    const elseAt = src.indexOf('\nelse\n', noZipAt);
    assert(noZipAt >= 0, 'the --no-zip branch is missing');
    assert(elseAt > noZipAt, 'the ZIP branch is missing');
    const noZip = src.slice(noZipAt, elseAt);
    assertMatch(
        noZip, /^    timed '\.\/bin\/build --no-zip' build$/m,
    );
    assertNotMatch(noZip, /replay_or_run/);
    assertStringIncludes(
        src.slice(elseAt),
        'replay_or_run build "$SERVER_ZIP"'
        + " -- timed './bin/build' build\n",
    );
});
