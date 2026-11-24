import {
    assertEquals,
    assertMatch,
    assertNotMatch,
    assertStrictEquals,
    assertThrows,
} from '@std/assert';
import { join } from '@std/path';
import {
    type DurationSample,
    parseLedger,
} from '../web-app/app/tool-duration-core.ts';
import {
    commitAll,
    copyFromCheckout,
    GATE_LIBRARIES,
    realDeno,
    runInReplica,
    withRepository,
} from './fixtures/script-replica.ts';

// Where the test command lives in this checkout.
const TEST = 'bin/test';

// A hang bound, never a timing assertion: each spawn is
// two short deno runs around the command.
const SPAWN_BOUND_MS = 60_000;

const decoder = new TextDecoder();

type Spawned = {
    readonly status: number;
    readonly stdout: string;
    readonly stderr: string;
};

function freshLedgerPath(): string {
    return join(
        Deno.makeTempDirSync({ prefix: 'tool-durations-' }),
        'tool-durations.jsonl',
    );
}

// A shell that sources the timer in this checkout, run
// with a ledger of the test's own. It asks the tree only
// to label a sample. The result cache is handed /dev/null
// for its root (tests/sha-result-cache-isolation.test.ts).
async function spawned(
    command: string,
    args: string[],
    ledger: string,
    env: Record<string, string> = {},
): Promise<Spawned> {
    const output = await new Deno.Command(command, {
        args,
        signal: AbortSignal.timeout(SPAWN_BOUND_MS),
        env: {
            SHA_RESULT_CACHE_ROOT: '/dev/null',
            TOOL_DURATIONS_PATH: ledger,
            ...env,
        },
    }).output();
    return {
        status: output.code,
        stdout: decoder.decode(output.stdout),
        stderr: decoder.decode(output.stderr),
    };
}

// Git, as itself: no script runs under it. A commit is
// made from no one's git config, so a signing or hook
// setting cannot reach it.
async function git(args: string[]): Promise<string> {
    const output = await new Deno.Command('git', {
        args: [
            '-c', 'user.name=Test',
            '-c', 'user.email=test@example.com',
            ...args,
        ],
        signal: AbortSignal.timeout(SPAWN_BOUND_MS),
        env: {
            GIT_CONFIG_GLOBAL: '/dev/null',
            GIT_CONFIG_NOSYSTEM: '1',
        },
    }).output();
    assertStrictEquals(
        output.code, 0, decoder.decode(output.stderr),
    );
    return decoder.decode(output.stdout);
}

const SOURCE_THE_TIMER = 'set -eu; . ./bin/duration-lib; ';

// Source the lib as every script does, under errexit, and
// run `script` with the ledger redirected to `ledger`.
function runTimed(
    script: string,
    ledger: string,
    env: Record<string, string> = {},
): Promise<Spawned> {
    return spawned(
        'sh', ['-c', SOURCE_THE_TIMER + script], ledger, env,
    );
}

function samplesIn(ledger: string): DurationSample[] {
    return parseLedger(Deno.readTextFileSync(ledger));
}

function onlySampleIn(ledger: string): DurationSample {
    const samples = samplesIn(ledger);
    assertStrictEquals(samples.length, 1);
    return samples[0]!;
}

async function headSha(): Promise<string> {
    return (await git(['rev-parse', 'HEAD'])).trim();
}

Deno.test('a timed step appends one sample', async () => {
    const ledger = freshLedgerPath();
    const result = await runTimed(
        'timed "./probe green" echo RAN',
        ledger,
    );
    assertStrictEquals(result.status, 0);
    assertStrictEquals(result.stdout, 'RAN\n');
    const sample = onlySampleIn(ledger);
    assertEquals(
        {
            tool: sample.tool,
            arguments: sample.arguments,
            sha: sample.sha,
            worktree: sample.worktree,
            exitStatus: sample.exitStatus,
            cpuCount: sample.machine.cpuCount,
        },
        {
            tool: './probe',
            arguments: ['green'],
            sha: await headSha(),
            worktree: Deno.cwd(),
            exitStatus: 0,
            cpuCount: navigator.hardwareConcurrency,
        },
    );
    // Microseconds: the finest the wall clock gives here.
    assertMatch(sample.startedAt, /\.\d{6}Z$/);
});

Deno.test('an empty history says no baseline yet',
async () => {
    const result = await runTimed(
        'timed "./probe green" true',
        freshLedgerPath(),
    );
    assertStrictEquals(result.status, 0);
    assertMatch(
        result.stderr,
        new RegExp(
            '^duration: \\./probe green took \\d+\\.\\d s;'
            + ' no baseline yet \\(0 of 3 quiet green runs'
            + ' in the last 14 days\\)',
        ),
    );
});

// No variable says a tree is clean: the timer asks git, as
// the result cache does. So git is told of a repository
// of the test's own, first as committed and then with a
// file it does not know. And no git setting answers for
// the tree: `status.showUntrackedFiles=no` makes a bare
// `git status` leave that file out, so the timer asks for
// untracked files by name.
Deno.test('a sample says whether the tree was clean',
async () => {
    for (const hidesUntracked of [false, true]) {
        const dir = await Deno.makeTempDir({
            prefix: 'tool-durations-tree-',
        });
        try {
            await git(['-C', dir, 'init', '--quiet']);
            await git([
                '-C', dir, 'commit', '--quiet', '--allow-empty',
                '-m', 'Empty',
            ]);
            if (hidesUntracked) {
                await git([
                    '-C', dir, 'config',
                    'status.showUntrackedFiles', 'no',
                ]);
            }
            const ledger = freshLedgerPath();
            const result = await runTimed(
                'timed "./probe clean" true;'
                + ' echo x > "$GIT_WORK_TREE/untracked";'
                + ' timed "./probe dirty" true',
                ledger,
                { GIT_DIR: join(dir, '.git'), GIT_WORK_TREE: dir },
            );
            assertStrictEquals(result.status, 0);
            assertEquals(
                samplesIn(ledger).map((sample) => [
                    sample.arguments, sample.tree,
                ]),
                [[['clean'], 'clean'], [['dirty'], 'dirty']],
                `hidesUntracked=${hidesUntracked}`,
            );
        } finally {
            await Deno.remove(dir, { recursive: true });
        }
    }
});

// One thing says whether a tree is clean to the timer and
// to the result cache alike: the tree. Each asks git, and
// neither reads the variable the validate stamp used to
// take the answer from.
Deno.test('only the tree says whether it is clean', () => {
    for (const lib of [
        'bin/duration-lib', 'bin/sha-result-cache-lib',
    ]) {
        const src = Deno.readTextFileSync(lib);
        assertMatch(src, /=\$\(git status --porcelain /, lib);
        assertNotMatch(src, /WORKING_TREE_PORCELAIN/, lib);
    }
});

Deno.test('a failing step keeps its status and is recorded',
async () => {
    const ledger = freshLedgerPath();
    const result = await runTimed(
        'timed "./probe red" sh -c "exit 7"',
        ledger,
    );
    assertStrictEquals(result.status, 7);
    assertStrictEquals(onlySampleIn(ledger).exitStatus, 7);
    // A failure is its own news: no duration line follows.
    assertStrictEquals(result.stderr, '');
});

// `two || status=$?` would switch errexit off inside
// `two`, and SECOND would print.
Deno.test('a timed function stops at its first failure',
async () => {
    const ledger = freshLedgerPath();
    const result = await runTimed(
        'two() { false; echo SECOND; };'
        + ' timed "./probe two" two',
        ledger,
    );
    assertStrictEquals(result.status, 1);
    assertNotMatch(result.stdout, /SECOND/);
    assertStrictEquals(onlySampleIn(ledger).exitStatus, 1);
});

Deno.test('a failing step stops the script that timed it',
async () => {
    const ledger = freshLedgerPath();
    const result = await runTimed(
        'timed "./probe red" false; echo AFTER',
        ledger,
    );
    assertStrictEquals(result.status, 1);
    assertNotMatch(result.stdout, /AFTER/);
    assertStrictEquals(onlySampleIn(ledger).exitStatus, 1);
});

// A caller that never asked for errexit must not leave
// `timed` with it switched on.
Deno.test('timed leaves the caller its own errexit setting',
async () => {
    const ledger = freshLedgerPath();
    const result = await spawned(
        'sh',
        [
            '-c',
            '. ./bin/duration-lib;'
            + ' loose() { false; echo SECOND; };'
            + ' timed "./probe loose" loose;'
            + ' false; echo AFTER',
        ],
        ledger,
    );
    assertStrictEquals(result.status, 0);
    assertStrictEquals(result.stdout, 'SECOND\nAFTER\n');
    assertStrictEquals(onlySampleIn(ledger).exitStatus, 0);
});

Deno.test('an unwritable ledger changes nothing but a line',
async () => {
    const ledger = join(
        Deno.makeTempDirSync({ prefix: 'tool-durations-' }),
        'absent-directory',
        'tool-durations.jsonl',
    );
    const result = await runTimed(
        'timed "./probe green" echo RAN',
        ledger,
    );
    assertStrictEquals(result.status, 0);
    assertStrictEquals(result.stdout, 'RAN\n');
    assertStrictEquals(
        result.stderr.trimEnd().split('\n').at(-1),
        `duration: ./probe green not recorded in ${ledger}`,
    );
});

// Deno asks on a terminal before it refuses a permission,
// and a question would stall the tool being timed.
Deno.test('the timer never prompts', () => {
    const lib = Deno.readTextFileSync('bin/duration-lib');
    assertStrictEquals(
        [...lib.matchAll(/deno run --frozen --no-prompt/g)]
            .length,
        [...lib.matchAll(/deno run/g)].length,
    );
});

Deno.test('a ledger line that is no sample stops recording',
async () => {
    const ledger = freshLedgerPath();
    Deno.writeTextFileSync(ledger, 'not a sample\n');
    const result = await runTimed(
        'timed "./probe green" echo RAN',
        ledger,
    );
    assertStrictEquals(result.status, 0);
    assertStrictEquals(result.stdout, 'RAN\n');
    assertMatch(
        result.stderr,
        /^duration: duration ledger line 1 is not a sample: /m,
    );
    assertStrictEquals(
        result.stderr.trimEnd().split('\n').at(-1),
        `duration: ./probe green not recorded in ${ledger}`,
    );
    assertStrictEquals(
        Deno.readTextFileSync(ledger),
        'not a sample\n',
    );
});

// A hand repair is how a final newline gets lost. The
// next sample must not be glued onto the last line.
Deno.test('a ledger with no final newline keeps every sample',
async () => {
    const ledger = freshLedgerPath();
    await runTimed('timed "./probe green" true', ledger);
    Deno.writeTextFileSync(
        ledger,
        Deno.readTextFileSync(ledger).trimEnd(),
    );
    const result = await runTimed(
        'timed "./probe green" true',
        ledger,
    );
    assertStrictEquals(result.status, 0);
    assertStrictEquals(samplesIn(ledger).length, 2);
});

// The crafted runs took ten minutes, so the real one is
// steady however slow this machine is today.
Deno.test('a baseline is the median of the recent runs',
async () => {
    const ledger = freshLedgerPath();
    await runTimed('timed "./probe green" true', ledger);
    const anHourAgo = new Date(
        Date.now() - 3_600_000,
    ).toISOString();
    const crafted: DurationSample = {
        ...onlySampleIn(ledger),
        startedAt: anHourAgo,
        durationMs: 600_000,
        loadAtStart: 0,
        loadAtEnd: 0,
    };
    Deno.writeTextFileSync(
        ledger,
        (JSON.stringify(crafted) + '\n').repeat(3),
    );
    const result = await runTimed(
        'timed "./probe green" true',
        ledger,
    );
    assertMatch(
        result.stderr,
        new RegExp(
            '^duration: \\./probe green took \\d+\\.\\d s;'
            + ' recent median 600\\.0 s'
            + ' \\(3 runs in the last 14 days\\)',
        ),
    );
    assertStrictEquals(samplesIn(ledger).length, 4);
});

// /dev/null for the ledger means there is none. The
// command still runs under the caller's errexit, and the
// timer runs no program of its own and says nothing. A
// test that spawns a script it does not mean to time
// hands it that, and may count every program the script
// runs.
Deno.test('no ledger means an untimed, silent run', async () => {
    const dir = Deno.makeTempDirSync({ prefix: 'tool-durations-' });
    const called = join(dir, 'called');
    for (const program of ['deno', 'git']) {
        Deno.writeTextFileSync(
            join(dir, program),
            `#!/bin/sh\necho ${program} >> "${called}"\n`,
            { mode: 0o755 },
        );
    }
    const result = await runTimed(
        'two() { echo FIRST; false; echo SECOND; };'
        + ' timed "./probe two" two; echo AFTER',
        '/dev/null',
        { PATH: `${dir}:${Deno.env.get('PATH') ?? ''}` },
    );
    assertStrictEquals(result.status, 1);
    assertStrictEquals(result.stdout, 'FIRST\n');
    assertStrictEquals(result.stderr, '');
    assertThrows(
        () => Deno.statSync(called),
        Deno.errors.NotFound,
    );
});

// The timer speaks on the script's own stderr, a copy
// taken as the library is sourced. Inside an ask the
// step's stderr is recorded for the SHA and replayed, and
// what the timer says is news of one run. So a call whose
// stderr goes elsewhere is still reported here, the
// step's own stderr goes where the call sent it, and the
// step cannot write to the timer's descriptor. The line
// is the one for a checkout git cannot describe, where
// the step runs untimed.
Deno.test('the timer speaks on the script stderr, not the call',
async () => {
    const ledger = freshLedgerPath();
    const result = await runTimed(
        'timed "./probe green" sh -c'
        + ' "echo STEP >&2; echo LEAK >&9 || echo CLOSED"'
        + ' 2> /dev/null',
        ledger,
        { GIT_DIR: join(ledger, 'no-repository') },
    );
    assertStrictEquals(result.status, 0);
    assertStrictEquals(result.stdout, 'CLOSED\n');
    assertStrictEquals(
        result.stderr,
        'duration: ./probe green not recorded:'
        + ' git could not describe this checkout\n',
    );
    assertThrows(
        () => Deno.statSync(ledger),
        Deno.errors.NotFound,
    );
});

// ── ./bin/test ──────

// The test command in a repository of its own, with a
// ledger of the test's own: the script refuses a dirty
// tree, and this checkout's tree is not a test's to keep
// clean (tests/fixtures/script-replica.ts). The replica
// holds the script, the browser door it execs, and a
// stand-in for the schema generator; the timer's own
// programs are the real ones, run by the real deno.
async function runTest(
    args: string[],
    ledger: string,
    env: Record<string, string> = {},
): Promise<Spawned> {
    const runs: Spawned[] = [];
    await withRepository(async (repository) => {
        copyFromCheckout(repository.repo, [
            TEST,
            'bin/test-browser',
            'bin/build-lib',
            ...GATE_LIBRARIES,
        ]);
        await Deno.writeTextFile(
            join(repository.repo, 'bin/generate-schema-svg'),
            '#!/bin/sh\necho "SCHEMA.svg is up to date"\n',
            { mode: 0o755 },
        );
        await commitAll(repository.repo, 'The test script');
        runs.push(await runInReplica(
            repository, `./${TEST}`, args,
            {
                TOOL_DURATIONS_PATH: ledger,
                ...realDeno(),
                ...env,
            },
        ));
    });
    return runs[0]!;
}

Deno.test('./bin/test schema records a green sample', async () => {
    const ledger = freshLedgerPath();
    const result = await runTest(['schema'], ledger);
    assertStrictEquals(result.status, 0);
    const sample = onlySampleIn(ledger);
    assertEquals(
        [sample.tool, sample.arguments, sample.exitStatus],
        ['./bin/test', ['schema'], 0],
    );
    assertMatch(
        result.stderr,
        /^duration: \.\/bin\/test schema took \d+\.\d s; /m,
    );
});

// Chrome is found before the suite is asked of the result
// cache, so a run with none is refused before any step
// begins. It is no run, and leaves no sample. A step that
// begins and then fails is recorded red, and a replay is
// no run either: tests/sha-result-cache.test.ts pins both
// on the real scripts, in a repository of their own.
Deno.test('./bin/test browser with no Chrome records nothing',
async () => {
    const ledger = freshLedgerPath();
    const result = await runTest(['browser'], ledger, {
        CHROME: '/nonexistent/chrome',
        CHROME_DEBUG_URL: '',
    });
    assertStrictEquals(result.status, 1);
    assertMatch(result.stderr, /Chrome not found/);
    assertNotMatch(result.stderr, /duration/);
    assertThrows(
        () => Deno.statSync(ledger),
        Deno.errors.NotFound,
    );
});

// The command each step ./bin/test runs itself is timed
// with. `./bin/test validate` is a composition of these, not
// a step of its own.
const STEP_COMMANDS: Record<string, string> = {
    'check': 'run_check',
    'memory': 'run_memory',
    'lint': 'run_lint',
    'schema': 'run_schema',
    'api-docs': 'run_api_docs',
};

// The suites ./bin/test hands to a script of their own. Each
// script asks the result cache at its own door and times
// its work there, under the suite's name: the script,
// and the command it times.
const DOOR_SUITES: Record<
    string,
    { readonly script: string; readonly command: string }
> = {
    'postgres': {
        script: 'bin/test-postgres',
        command: 'postgres_suite',
    },
    'browser': {
        script: 'bin/test-browser',
        command: 'browser_suite',
    },
};

const TIMED_STEP =
    /timed '\.\/bin\/test ([a-z-]+)'(?: \\\n)?\s+(\S+)/g;

// The source of one shell function, header to closing
// brace.
function functionBody(src: string, name: string): string {
    const at = src.indexOf(`\n${name}() {\n`);
    assertEquals(at >= 0, true, `${name} missing`);
    const end = src.indexOf('\n}\n', at);
    assertEquals(end > at, true, `${name} unclosed`);
    return src.slice(at, end);
}

Deno.test('./bin/test times every suite it offers', () => {
    const src = Deno.readTextFileSync('bin/test');
    const offered = [...src.matchAll(/^ {4}(\S+)\)$/gm)]
        .flatMap((arm) => arm[1]!.split('|'))
        .filter((name) =>
            name !== '--help' && name !== '-h'
            && name !== 'validate' && name !== '*'
        );
    assertEquals(
        offered.sort(),
        [
            ...Object.keys(STEP_COMMANDS),
            ...Object.keys(DOOR_SUITES),
        ].sort(),
    );
    // Its own steps: each in a timed call, always with the
    // same command.
    const timed = [...src.matchAll(TIMED_STEP)];
    assertEquals(
        [...new Set(timed.map((call) => call[1]!))].sort(),
        Object.keys(STEP_COMMANDS).sort(),
    );
    for (const [, name, command] of timed) {
        assertStrictEquals(command, STEP_COMMANDS[name!]);
    }
    // The suites it execs: each timed by its own script,
    // under the suite's name and with the one command.
    for (const [name, door] of Object.entries(DOOR_SUITES)) {
        const calls = [
            ...Deno.readTextFileSync(door.script)
                .matchAll(TIMED_STEP),
        ];
        assertEquals(
            calls.length > 0, true, `${door.script} times nothing`,
        );
        for (const [, timedName, command] of calls) {
            assertStrictEquals(timedName, name);
            assertStrictEquals(command, door.command);
        }
    }
});

Deno.test('./bin/test runs no step outside a timed call', () => {
    const src = Deno.readTextFileSync('bin/test');
    let untimed = src.replaceAll(TIMED_STEP, '');
    for (const command of Object.values(STEP_COMMANDS)) {
        untimed = untimed.replaceAll(`${command}() {`, '');
        // As a word: replay_or_run_memory is not run_memory.
        assertNotMatch(
            untimed,
            new RegExp(`(?<![A-Za-z0-9_])${command}(?![A-Za-z0-9_])`),
            `${command} runs untimed`,
        );
    }
    // A shell that execs is gone before its step ends, and
    // records nothing. So ./bin/test execs only a script that
    // times its own work. As a command: find's -exec is
    // an argument.
    const execed = [...src.matchAll(/(?<![-\w])exec\s+(\S+)/g)]
        .map((call) => call[1]!);
    assertEquals(
        [...new Set(execed)].sort(),
        Object.values(DOOR_SUITES)
            .map((door) =>
                `"${door.script.replace(/^bin\//, '$BIN/')}"`
            ).sort(),
    );
    // And names that script nowhere but in its exec and
    // the lint list: timed here as well, one run would be
    // two samples.
    const strays = src.split('\n').filter((line) =>
        /test-(postgres|browser)/.test(line)
        && !/^\s+(\w+\) )?exec "\$BIN\/test-\w+"( ;;)?$/
            .test(line)
        && line.trim() !== 'bin/test-postgres bin/test-browser \\'
    );
    assertEquals(strays, []);
});

// Validate is nothing but steps that are timed where they
// run: a timed step as it stands, or an ask whose command
// is a timed step. A step added there plainly would run
// unrecorded.
Deno.test('./bin/test validate composes only timed steps', () => {
    const src = Deno.readTextFileSync('bin/test');
    const steps = functionBody(src, 'run_validate')
        .split('\n').slice(2);
    assertEquals(
        steps.filter((line) =>
            !/^ {4}timed '\.\/bin\/test [a-z-]+' \S+$/.test(line)
            && !/^ {4}replay_or_run_[a-z_]+$/.test(line)
        ),
        [],
    );
    assertStrictEquals(steps.length, 5);
    const asks = steps
        .filter((line) => line.includes('replay_or_run_'))
        .map((line) => line.trim());
    assertStrictEquals(asks.length, 3);
    for (const ask of asks) {
        const runs = functionBody(src, ask).split('\n').slice(2)
            .filter((line) =>
                !/^\s+(if .*; then|else|fi)$/.test(line)
            );
        const timedStep = new RegExp(
            '^\\s+(replay_or_run \\S+ -- )?'
            + "timed '\\./bin/test [a-z-]+' \\S+$",
        );
        assertEquals(
            runs.filter((line) => !timedStep.test(line)),
            [],
            ask,
        );
        assertEquals(runs.length > 0, true, ask);
    }
});

// ── every script ──────

// Every executable git tracks either times its work or is
// named here with its reason. The set is read from git,
// wherever in the tree it finds one, never listed, so a
// script added tomorrow fails this pin until someone
// decides.
const TIMED_SCRIPTS = [
    'bin/build', 'bin/test', 'bin/test-browser', 'bin/test-postgres',
];
const UNTIMED: Record<string, string> = {
    'bin/develop':
        'an edit session ends when the operator ends it',
    'bin/generate-api-documentation':
        './bin/test times its check as ./bin/test api-docs',
    'bin/generate-schema-svg':
        './bin/test times its check as ./bin/test schema',
    'bin/measure':
        'a benchmark whose duration its own flags set',
    'bin/postgres-seed':
        'an operator verb on a database, not a gate',
    'bin/postgres-wipe':
        'an operator verb on a database, not a gate',
    'bin/serve':
        'a server ends when the operator ends it',
    'bin/worktree-add':
        'it adds a worktree and is done',
    'bin/deploy':
        'its gates are ./bin/test steps; its stand-up is an image'
        + ' build, as long as the layer cache makes it',
};
// What git records for a file a shell can run by name: an
// executable, or a symbolic link, which can stand in for
// one anywhere.
const RUNNABLE_MODES = ['100755', '120000'];

// Every executable and every symbolic link git tracks,
// anywhere in the tree. Tracked, so an editor's stray
// copy is no script; a new script joins the day it is
// added.
async function executableScripts(): Promise<string[]> {
    const listed = await git(['ls-files', '--stage']);
    return listed.trimEnd().split('\n')
        .map((line) => {
            const [stage, path] = line.split('\t');
            return { mode: stage!.split(' ')[0]!, path: path! };
        })
        .filter(({ mode }) => RUNNABLE_MODES.includes(mode))
        .map(({ path }) => path)
        .sort();
}

// A timed call stands as a statement of its own or as the
// command of an ask, after its `--`. A comment that names
// one is no call.
function callsTimed(path: string): boolean {
    const code = Deno.readTextFileSync(path).split('\n')
        .filter((line) => !line.trimStart().startsWith('#'))
        .join('\n');
    return /(^\s*|-- (\\\n\s+)?)timed ['"]/m.test(code);
}

Deno.test('every executable script is timed or says why not',
async () => {
    const scripts = await executableScripts();
    assertEquals(scripts.filter(callsTimed), TIMED_SCRIPTS);
    assertEquals(
        scripts.filter((path) => !callsTimed(path)),
        Object.keys(UNTIMED).sort(),
    );
});

// One place for scripts: directly under bin/. None sits
// at the root, where test and deploy once did, none sits
// in a directory of its own, and no symbolic link stands
// in for one anywhere else.
Deno.test('every executable script lives under bin/',
async () => {
    const scripts = await executableScripts();
    assertEquals(
        scripts.filter((path) => !/^bin\/[^/]+$/.test(path)), [],
    );
    assertEquals(
        ['bin/deploy', 'bin/test']
            .filter((path) => !scripts.includes(path)),
        [],
    );
});

// From the main checkout the git directory is inside the
// image build context. A ledger that changed before every
// build would defeat Docker's layer cache.
Deno.test('the ledger stays out of the image build context',
() => {
    assertStrictEquals(
        Deno.readTextFileSync('.dockerignore').split('\n')
            .includes('.git/tool-durations.jsonl'),
        true,
    );
});
