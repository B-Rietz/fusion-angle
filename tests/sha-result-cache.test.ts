import {
    assertEquals,
    assertMatch,
    assertNotEquals,
    assertNotMatch,
    assertStrictEquals,
    assertStringIncludes,
} from '@std/assert';
import { basename, dirname, join, relative } from '@std/path';
import {
    type DurationSample,
    parseLedger,
} from '../web-app/app/tool-duration-core.ts';
import {
    commitAll,
    copyFromCheckout,
    GATE_LIBRARIES,
    git,
    HERMETIC_GIT,
    realDeno,
    type Run,
    RUN_TIMEOUT_MS,
    runInReplica,
    searchPath,
    SHELL,
    TIMER_RUNS_FOR_REAL,
    withRepository,
} from './fixtures/script-replica.ts';

// bin/sha-result-cache-lib, driven through /bin/bash: the
// shell its callers' `#!/bin/bash` names. bash and POSIX
// sh differ on exactly what the library guards (`set -e`
// inside `$( )`), so the cases run the shipping shell.
// Every case gets a repository and a cache root of its
// own (tests/fixtures/script-replica.ts), so none reads
// another's entries or this checkout's tree.
const LIBRARY = join(Deno.cwd(), 'bin/sha-result-cache-lib');

const REPLAY_OR_RUN = 'set -eu; . "$0"; replay_or_run "$@"';

const REPLAYING = /^sha-result-cache: replaying /m;

// The shipping scripts time each step they run
// (bin/duration-lib). /dev/null for the ledger means
// there is none: the timer runs no program and says
// nothing, so a case about the cache counts only what the
// script itself runs. A case about the timer names a
// ledger of its own.
const NO_LEDGER = '/dev/null';

type Scene = {
    readonly dir: string;
    readonly repo: string;
    readonly root: string;
    readonly ran: string;
};

// A repository with one commit and a clean tree, beside
// a cache root the library has yet to make and a file
// each real run of a step adds a line to.
function withScene(
    body: (scene: Scene) => Promise<void>,
): Promise<void> {
    return withRepository(({ dir, repo }) =>
        body({
            dir,
            repo,
            root: join(dir, 'root'),
            ran: join(dir, 'ran'),
        })
    );
}

async function sh(
    scene: Scene,
    how: {
        readonly cwd: string;
        readonly env: Record<string, string>;
        readonly script: string;
        readonly args: readonly string[];
    },
): Promise<Run> {
    const output = await new Deno.Command(SHELL, {
        args: ['-c', how.script, LIBRARY, ...how.args],
        cwd: how.cwd,
        clearEnv: true,
        env: {
            PATH: searchPath(),
            SHA_RESULT_CACHE_ROOT: scene.root,
            TOOL_DURATIONS_PATH: NO_LEDGER,
            GIT_CEILING_DIRECTORIES: scene.dir,
            ...HERMETIC_GIT,
            ...how.env,
        },
        signal: AbortSignal.timeout(RUN_TIMEOUT_MS),
    }).output();
    const decoder = new TextDecoder();
    return {
        status: output.code,
        stdout: decoder.decode(output.stdout),
        stderr: decoder.decode(output.stderr),
    };
}

function replayOrRun(
    scene: Scene, ...args: string[]
): Promise<Run> {
    return sh(scene, {
        cwd: scene.repo,
        env: {},
        script: REPLAY_OR_RUN,
        args,
    });
}

// The shape of the timer that goes inside the ask
// (decision 14): its command in a subshell under the
// caller's errexit, the status handed back unchanged.
const TIMER = ' timed() { local errexit=+e status;'
    + ' case $- in *e*) errexit=-e ;; esac;'
    + ' set +e; ( set "$errexit"; "$@" ); status=$?;'
    + ' set "$errexit"; return "$status"; };';

// A held step says it has started and waits to be let
// go in a `read` of its own, with no child between it and
// the signal. A loop of `sleep` would be a false prophet:
// on bash 3.2 a Ctrl-C that lands as a foreground child
// exits normally is dropped by the shell, the loop runs
// on, and nothing lets it go. The fifo is open for
// reading and writing, so the read never ends for want of
// a writer. Its own bound is far inside the spawn's: a
// step never let go says so and fails with a status of
// its own.
const HELD_TOO_LONG = 97;
const HOLD = ' exec 3<> "$RELEASE"; : > "$STARTED";'
    + ' if ! read -t 20 -r _ <&3; then'
    + ' echo "the held step was never let go" >&2;'
    + ` exit ${HELD_TOO_LONG}; fi;`;

// Starts its arguments as a job with a process group of
// its own, as a terminal does, and signals that group, or
// the job's own process alone, once the held step has
// started. Then it lets the step go, through the fifo,
// opened for reading and writing so the write never
// waits: a step the signal ended is past caring, and one
// whose script alone was ended runs on. The job's status
// is its own.
const INTERRUPT = 'set -m; mkfifo "$RELEASE"; "$@" & job=$!;'
    + ' until [ -e "$STARTED" ]'
    + ' || ! kill -0 "$job" 2> /dev/null; do sleep 0.01; done;'
    + ' kill -s "$SIGNAL" -- "$TARGET$job";'
    + ' wait "$job"; status=$?;'
    + ' exec 3<> "$RELEASE"; echo >&3; exit "$status"';

type Interruption = {
    readonly signal: 'HUP' | 'INT' | 'TERM';
    readonly alone: boolean;
};

// Run JOB and interrupt it. The pipes this reads close
// only when the last process of the job has gone, so the
// cleanup is over when it returns, and one scene can be
// interrupted again: each run is held in a directory of
// its own.
async function interrupted(
    scene: Scene,
    how: {
        readonly cwd: string;
        readonly env: Record<string, string>;
        readonly job: readonly string[];
        readonly interruption: Interruption;
    },
): Promise<Run> {
    const held = await Deno.makeTempDir({
        dir: scene.dir, prefix: 'held-',
    });
    const output = await new Deno.Command(SHELL, {
        args: ['-c', INTERRUPT, SHELL, ...how.job],
        cwd: how.cwd,
        clearEnv: true,
        env: {
            PATH: searchPath(),
            SHA_RESULT_CACHE_ROOT: scene.root,
            TOOL_DURATIONS_PATH: NO_LEDGER,
            GIT_CEILING_DIRECTORIES: scene.dir,
            ...HERMETIC_GIT,
            STARTED: join(held, 'started'),
            RELEASE: join(held, 'release'),
            SIGNAL: how.interruption.signal,
            TARGET: how.interruption.alone ? '' : '-',
            ...how.env,
        },
        signal: AbortSignal.timeout(RUN_TIMEOUT_MS),
    }).output();
    const decoder = new TextDecoder();
    return {
        status: output.code,
        stdout: decoder.decode(output.stdout),
        stderr: decoder.decode(output.stderr),
    };
}

// A step that writes to both streams and passes.
function step(scene: Scene): string[] {
    return [
        'sh', '-c',
        'echo out; echo err >&2; echo ran >> "$0"',
        scene.ran,
    ];
}

function timesRan(scene: Scene): number {
    try {
        return Deno.readTextFileSync(scene.ran)
            .split('\n').filter((line) => line !== '').length;
    } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
            return 0;
        }
        throw error;
    }
}

// Every path under the cache root, relative to it.
function cachePaths(scene: Scene): string[] {
    const paths: string[] = [];
    const walk = (dir: string): void => {
        for (const entry of Deno.readDirSync(dir)) {
            const path = join(dir, entry.name);
            paths.push(relative(scene.root, path));
            if (entry.isDirectory) {
                walk(path);
            }
        }
    };
    try {
        walk(scene.root);
    } catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) {
            throw error;
        }
    }
    return paths.sort();
}

function entries(scene: Scene): string[] {
    return cachePaths(scene).filter((path) =>
        /^[0-9a-f]{40}\/[0-9a-f]{40}$/.test(path)
    );
}

// The caller's next statement runs after a real run and
// after a replay alike: a command made of steps goes on
// to its next step.
Deno.test('a pass replays both streams and says so',
async () => {
    await withScene(async (scene) => {
        const once = () =>
            sh(scene, {
                cwd: scene.repo,
                env: {},
                script: 'set -eu; . "$0";'
                    + ' replay_or_run "$@"; echo after',
                args: ['demo step', '--', ...step(scene)],
            });
        const first = await once();
        const replay = await once();
        assertStrictEquals(first.status, 0);
        assertStrictEquals(first.stdout, 'out\nafter\n');
        assertStrictEquals(first.stderr, 'err\n');
        assertStrictEquals(replay.status, 0);
        assertStrictEquals(replay.stdout, 'out\nafter\n');
        assertStrictEquals(timesRan(scene), 1);
        const sha = await git(scene.repo, ['rev-parse', 'HEAD']);
        const lines = replay.stderr.split('\n');
        assertMatch(
            lines[0]!,
            new RegExp(
                '^sha-result-cache: replaying demo step, '
                + 'which passed at '
                + '\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\dZ '
                + `on ${sha}$`,
            ),
        );
        assertEquals(lines.slice(1), [
            'err',
            'sha-result-cache: replayed demo step;'
            + ' nothing ran',
            '',
        ]);
    });
});

// A caller may close stderr, and a reader may take the
// first line and leave, as `| head -n 1` does. The replay
// then loses its announcement or is cut short, and it is
// still the whole result: the step must not run for real
// behind it.
Deno.test('a replay stands when its reader has gone',
async () => {
    await withScene(async (scene) => {
        // More than a pipe holds, so the replay is still
        // writing when its reader leaves.
        const loud = [
            'sh', '-c',
            'echo ran >> "$0"; yes line | head -n 40000',
            scene.ran,
        ];
        const first = await replayOrRun(
            scene, 'demo', '--', ...loud,
        );
        const closed = await sh(scene, {
            cwd: scene.repo,
            env: {},
            script: 'set -eu; . "$0";'
                + ' replay_or_run "$@" 2>&-',
            args: ['demo', '--', ...loud],
        });
        assertStrictEquals(closed.status, 0);
        assertStrictEquals(closed.stdout, first.stdout);
        const cut = await sh(scene, {
            cwd: scene.repo,
            env: {},
            script: 'set -eu; . "$0";'
                + ' replay_or_run "$@" 2>&1 | head -n 1',
            args: ['demo', '--', ...loud],
        });
        assertMatch(cut.stdout, REPLAYING);
        assertStrictEquals(timesRan(scene), 1);
    });
});

Deno.test('a failed step is never recorded', async () => {
    await withScene(async (scene) => {
        const failing = [
            'sh', '-c',
            'echo out; echo err >&2; echo ran >> "$0"; exit 3',
            scene.ran,
        ];
        for (const _ of [1, 2]) {
            const run = await replayOrRun(
                scene, 'demo', '--', ...failing,
            );
            assertStrictEquals(run.status, 3);
            assertStrictEquals(run.stdout, 'out\n');
            assertStrictEquals(run.stderr, 'err\n');
        }
        assertStrictEquals(timesRan(scene), 2);
        assertEquals(entries(scene), []);
    });
});

Deno.test('set -e still stops a step that fails midway',
async () => {
    await withScene(async (scene) => {
        const script = 'set -eu; . "$0";'
            + ' step() { echo ran >> "$1"; false;'
            + ' echo continued; };'
            + ' replay_or_run demo -- step "$1"';
        const midway = async () => {
            const run = await sh(scene, {
                cwd: scene.repo,
                env: {},
                script,
                args: [scene.ran],
            });
            assertNotEquals(run.status, 0);
            assertNotMatch(run.stdout, /continued/);
        };
        await midway();
        // And where the cache is not asked at all.
        await Deno.writeTextFile(
            join(scene.repo, 'untracked'), 'x',
        );
        await midway();
        assertStrictEquals(timesRan(scene), 2);
        assertEquals(entries(scene), []);
    });
});

// A timer goes inside the ask, after the `--` (decision
// 14), and runs its command in a subshell under the
// caller's errexit. A step that fails midway inside one
// stops there as it does without one, recorded or not,
// so a red first command never becomes a recorded pass.
Deno.test('set -e still stops a step inside a timer',
async () => {
    await withScene(async (scene) => {
        const script = 'set -eu; . "$0";' + TIMER
            + ' step() { echo ran >> "$1"; false;'
            + ' echo continued; };'
            + ' replay_or_run demo -- timed step "$1"';
        const midway = async () => {
            const run = await sh(scene, {
                cwd: scene.repo,
                env: {},
                script,
                args: [scene.ran],
            });
            assertStrictEquals(run.status, 1);
            assertNotMatch(run.stdout, /continued/);
        };
        await midway();
        // And where the cache is not asked at all.
        await Deno.writeTextFile(
            join(scene.repo, 'untracked'), 'x',
        );
        await midway();
        assertStrictEquals(timesRan(scene), 2);
        assertEquals(entries(scene), []);
    });
});

// A step whose first command fails and whose second
// passes must stop at the first, or it would pass and the
// pass would be recorded. So the call is refused wherever
// `set -e` is off or cannot bite: with no `set -e`; under
// `if`, where bash ignores it; and inside `$( )`, where
// bash clears it and POSIX sh does not.
Deno.test('a call where set -e is off or cannot bite is refused',
async () => {
    await withScene(async (scene) => {
        const failing = ' step() { echo ran >> "$1"; false;'
            + ' echo continued; };';
        const refusals: [string, RegExp][] = [
            [
                'set -u; . "$0";' + failing
                + ' replay_or_run demo -- step "$1"',
                /needs set -e/,
            ],
            [
                'set -eu; . "$0";' + failing
                + ' if replay_or_run demo -- step "$1";'
                + ' then echo passed; fi',
                /set -e cannot bite/,
            ],
            [
                'set -eu; . "$0";' + failing
                + ' out=$(replay_or_run demo -- step "$1");'
                + ' echo "passed $out"',
                /needs set -e/,
            ],
        ];
        for (const [script, refusal] of refusals) {
            const run = await sh(scene, {
                cwd: scene.repo,
                env: {},
                script,
                args: [scene.ran],
            });
            assertStrictEquals(run.status, 1, script);
            assertMatch(run.stderr, refusal);
            assertNotMatch(run.stdout, /passed/);
        }
        assertStrictEquals(timesRan(scene), 0);
        assertEquals(entries(scene), []);
    });
});

Deno.test('a dirty tree neither reads nor writes the cache',
async () => {
    await withScene(async (scene) => {
        await replayOrRun(scene, 'demo', '--', ...step(scene));
        const recorded = cachePaths(scene);
        await Deno.writeTextFile(
            join(scene.repo, 'untracked'), 'x',
        );
        const run = await replayOrRun(
            scene, 'demo', '--', ...step(scene),
        );
        assertStrictEquals(run.status, 0);
        assertStrictEquals(run.stderr, 'err\n');
        assertStrictEquals(timesRan(scene), 2);
        assertEquals(cachePaths(scene), recorded);
    });
});

// `status.showUntrackedFiles=no` makes a bare `git status`
// leave untracked files out. An untracked test file is
// dirt all the same: the pass it ran under belongs to no
// SHA.
Deno.test('a git setting cannot make a dirty tree clean',
async () => {
    await withScene(async (scene) => {
        await git(scene.repo, [
            'config', 'status.showUntrackedFiles', 'no',
        ]);
        await replayOrRun(scene, 'demo', '--', ...step(scene));
        const recorded = cachePaths(scene);
        await Deno.writeTextFile(
            join(scene.repo, 'untracked'), 'x',
        );
        const run = await replayOrRun(
            scene, 'demo', '--', ...step(scene),
        );
        assertStrictEquals(run.status, 0);
        assertStrictEquals(run.stderr, 'err\n');
        assertStrictEquals(timesRan(scene), 2);
        assertEquals(cachePaths(scene), recorded);
    });
});

// With nothing recorded there is nothing to replay.
Deno.test('a tree with no commit records nothing',
async () => {
    await withScene(async (scene) => {
        const unborn = join(scene.dir, 'unborn');
        await Deno.mkdir(unborn);
        await git(unborn, ['init', '--quiet']);
        const plain = join(scene.dir, 'plain');
        await Deno.mkdir(plain);
        for (const cwd of [unborn, plain]) {
            const run = await sh(scene, {
                cwd,
                env: {},
                script: REPLAY_OR_RUN,
                args: ['demo', '--', ...step(scene)],
            });
            assertStrictEquals(run.status, 0);
            assertStrictEquals(run.stdout, 'out\n');
            assertStrictEquals(run.stderr, 'err\n');
        }
        assertStrictEquals(timesRan(scene), 2);
        assertEquals(cachePaths(scene), []);
    });
});

// The name is taken again after the run. A run that
// moved HEAD or left the tree dirty no longer has the
// name it started with, and its result belongs to no SHA.
Deno.test('a run that changes its own name is not recorded',
async () => {
    await withScene(async (scene) => {
        const committing = [
            'sh', '-c',
            'echo ran >> "$0";'
            + ' git -c user.name=Test'
            + ' -c user.email=test@example.com'
            + ' commit --quiet --allow-empty -m Second',
            scene.ran,
        ];
        const dirtying = [
            'sh', '-c',
            'echo ran >> "$0"; echo x > left-behind',
            scene.ran,
        ];
        for (const changing of [committing, dirtying]) {
            const run = await replayOrRun(
                scene, 'demo', '--', ...changing,
            );
            assertStrictEquals(run.status, 0);
            assertMatch(
                run.stderr,
                /^sha-result-cache: .* demo; not recorded$/m,
            );
        }
        assertStrictEquals(timesRan(scene), 2);
        assertEquals(entries(scene), []);
    });
});

Deno.test('another SHA is another entry', async () => {
    await withScene(async (scene) => {
        const first = await git(scene.repo, ['rev-parse', 'HEAD']);
        await replayOrRun(scene, 'demo', '--', ...step(scene));
        await git(scene.repo, [
            'commit', '--quiet', '--allow-empty', '-m', 'Second',
        ]);
        const second = await replayOrRun(
            scene, 'demo', '--', ...step(scene),
        );
        assertNotMatch(second.stderr, REPLAYING);
        assertStrictEquals(timesRan(scene), 2);
        await git(scene.repo, [
            'checkout', '--quiet', '--detach', first,
        ]);
        const back = await replayOrRun(
            scene, 'demo', '--', ...step(scene),
        );
        assertMatch(back.stderr, REPLAYING);
        assertStringIncludes(back.stderr, ` on ${first}\n`);
        assertStrictEquals(timesRan(scene), 2);
    });
});

Deno.test('another way is another entry', async () => {
    await withScene(async (scene) => {
        await replayOrRun(scene, 'demo', '--', ...step(scene));
        const other = await replayOrRun(
            scene, 'demo --flag', '--', ...step(scene),
        );
        assertNotMatch(other.stderr, REPLAYING);
        assertStrictEquals(timesRan(scene), 2);
        assertStrictEquals(entries(scene).length, 2);
    });
});

Deno.test('another Deno is another entry', async () => {
    await withScene(async (scene) => {
        const withDeno = async (version: string) => {
            const bin = join(scene.dir, `deno-${version}`);
            await Deno.mkdir(bin, { recursive: true });
            await Deno.writeTextFile(
                join(bin, 'deno'),
                `#!/bin/sh\necho "deno ${version}"\n`,
                { mode: 0o755 },
            );
            return await sh(scene, {
                cwd: scene.repo,
                env: { PATH: `${bin}:${searchPath()}` },
                script: REPLAY_OR_RUN,
                args: ['demo', '--', ...step(scene)],
            });
        };
        assertNotMatch((await withDeno('1.0.0')).stderr, REPLAYING);
        assertNotMatch((await withDeno('2.0.0')).stderr, REPLAYING);
        assertMatch((await withDeno('1.0.0')).stderr, REPLAYING);
        assertStrictEquals(timesRan(scene), 2);
    });
});

Deno.test('NO_COLOR is another entry', async () => {
    await withScene(async (scene) => {
        const withEnv = (env: Record<string, string>) =>
            sh(scene, {
                cwd: scene.repo,
                env,
                script: REPLAY_OR_RUN,
                args: ['demo', '--', ...step(scene)],
            });
        assertNotMatch((await withEnv({})).stderr, REPLAYING);
        assertNotMatch(
            (await withEnv({ NO_COLOR: '1' })).stderr, REPLAYING,
        );
        assertMatch((await withEnv({})).stderr, REPLAYING);
        assertStrictEquals(timesRan(scene), 2);
    });
});

// A step that leaves a file outside the tree, as the
// build leaves its ZIP.
function building(scene: Scene, artifact: string): string[] {
    return [
        'demo', artifact, '--',
        'sh', '-c',
        'echo ran >> "$0"; echo "built $1"; echo bytes > "$1"',
        scene.ran, artifact,
    ];
}

// The file a step leaves is part of what it was asked
// for: the same step asked for another file is another
// run, and never a replay that claims the first file.
Deno.test('another artifact is another entry', async () => {
    await withScene(async (scene) => {
        const first = join(scene.dir, 'first.zip');
        const second = join(scene.dir, 'second.zip');
        await replayOrRun(scene, ...building(scene, first));
        const other = await replayOrRun(
            scene, ...building(scene, second),
        );
        assertNotMatch(other.stderr, REPLAYING);
        assertStrictEquals(other.stdout, `built ${second}\n`);
        assertStrictEquals(
            await Deno.readTextFile(second), 'bytes\n',
        );
        assertStrictEquals(timesRan(scene), 2);
        for (const artifact of [first, second]) {
            const replay = await replayOrRun(
                scene, ...building(scene, artifact),
            );
            assertMatch(replay.stderr, REPLAYING);
            assertStrictEquals(
                replay.stdout, `built ${artifact}\n`,
            );
        }
        assertStrictEquals(timesRan(scene), 2);
    });
});

Deno.test('a missing artifact is built again', async () => {
    await withScene(async (scene) => {
        const artifact = join(scene.dir, 'artifact.zip');
        await replayOrRun(scene, ...building(scene, artifact));
        await Deno.remove(artifact);
        const again = await replayOrRun(
            scene, ...building(scene, artifact),
        );
        assertStrictEquals(again.status, 0);
        assertNotMatch(again.stderr, REPLAYING);
        assertStringIncludes(
            again.stderr,
            `sha-result-cache: ${artifact} is not the file`
            + ' demo left; running it\n',
        );
        assertStrictEquals(
            await Deno.readTextFile(artifact), 'bytes\n',
        );
        assertStrictEquals(timesRan(scene), 2);
        const replay = await replayOrRun(
            scene, ...building(scene, artifact),
        );
        assertMatch(replay.stderr, REPLAYING);
        assertStrictEquals(timesRan(scene), 2);
    });
});

// Git hashes a file in the tree as it would store it,
// line endings normalised. The proof is of the bytes on
// disk, so a file that differs only there is another
// file.
Deno.test('an artifact is proved byte for byte', async () => {
    await withScene(async (scene) => {
        await Deno.writeTextFile(
            join(scene.repo, '.gitattributes'),
            'artifact.txt text\n',
        );
        await Deno.writeTextFile(
            join(scene.repo, '.gitignore'), 'artifact.txt\n',
        );
        await git(scene.repo, [
            'add', '.gitattributes', '.gitignore',
        ]);
        await git(scene.repo, [
            'commit', '--quiet', '-m', 'Attributes',
        ]);
        const build = [
            'demo', 'artifact.txt', '--',
            'sh', '-c',
            'echo ran >> "$0";'
            + ' printf "bytes\\r\\n" > artifact.txt',
            scene.ran,
        ];
        await replayOrRun(scene, ...build);
        const replay = await replayOrRun(scene, ...build);
        assertMatch(replay.stderr, REPLAYING);
        await Deno.writeTextFile(
            join(scene.repo, 'artifact.txt'), 'bytes\n',
        );
        const again = await replayOrRun(scene, ...build);
        assertNotMatch(again.stderr, REPLAYING);
        assertStrictEquals(timesRan(scene), 2);
    });
});

Deno.test('a pass that leaves no artifact is not recorded',
async () => {
    await withScene(async (scene) => {
        const artifact = join(scene.dir, 'artifact.zip');
        const run = await replayOrRun(
            scene, 'demo', artifact, '--', ...step(scene),
        );
        assertStrictEquals(run.status, 0);
        assertStringIncludes(
            run.stderr,
            `sha-result-cache: demo left no ${artifact};`
            + ' not recorded\n',
        );
        assertEquals(entries(scene), []);
    });
});

Deno.test('an unreadable entry runs for real and is replaced',
async () => {
    await withScene(async (scene) => {
        await replayOrRun(scene, 'demo', '--', ...step(scene));
        const [entry] = entries(scene);
        await Deno.writeTextFile(
            join(scene.root, entry!), 'not an entry',
        );
        const real = await replayOrRun(
            scene, 'demo', '--', ...step(scene),
        );
        assertStrictEquals(real.status, 0);
        assertStrictEquals(real.stdout, 'out\n');
        assertStrictEquals(
            real.stderr,
            'sha-result-cache: the entry for demo is'
            + ' unreadable; running it\nerr\n',
        );
        assertStrictEquals(timesRan(scene), 2);
        const replay = await replayOrRun(
            scene, 'demo', '--', ...step(scene),
        );
        assertMatch(replay.stderr, REPLAYING);
        assertStrictEquals(timesRan(scene), 2);
    });
});

// What a step printed is kept beside its entry while it
// runs. If that goes missing under it, the step has still
// passed: one line says the result was not kept, and no
// raw shell error leaks beside it.
Deno.test('a recording lost mid-run changes nothing but speed',
async () => {
    await withScene(async (scene) => {
        const losing = [
            'sh', '-c',
            'echo out; echo err >&2; echo ran >> "$0";'
            + ' rm -rf "$SHA_RESULT_CACHE_ROOT"/*/aside.*',
            scene.ran,
        ];
        const run = await replayOrRun(
            scene, 'demo', '--', ...losing,
        );
        assertStrictEquals(run.status, 0);
        assertStrictEquals(run.stdout, 'out\n');
        assertStrictEquals(
            run.stderr,
            'err\nsha-result-cache: cannot write the entry'
            + ' for demo; not recorded\n',
        );
        assertEquals(entries(scene), []);
    });
});

// /tmp is every user's to write. A root this user made
// open, by hand or by another tool, is closed before it
// is used.
Deno.test('the root is private, even one found open',
async () => {
    await withScene(async (scene) => {
        const mode = () =>
            Deno.statSync(scene.root).mode! & 0o777;
        await replayOrRun(scene, 'demo', '--', ...step(scene));
        assertStrictEquals(mode(), 0o700);
        await Deno.chmod(scene.root, 0o777);
        await replayOrRun(scene, 'demo', '--', ...step(scene));
        assertStrictEquals(mode(), 0o700);
    });
});

Deno.test('an unusable root changes nothing but speed',
async () => {
    await withScene(async (scene) => {
        const file = join(scene.dir, 'file');
        await Deno.writeTextFile(file, 'x');
        const target = join(scene.dir, 'target');
        await Deno.mkdir(target);
        const link = join(scene.dir, 'link');
        await Deno.symlink(target, link);
        for (const root of [join(file, 'root'), link]) {
            const env = { SHA_RESULT_CACHE_ROOT: root };
            const green = await sh(scene, {
                cwd: scene.repo,
                env,
                script: REPLAY_OR_RUN,
                args: ['demo', '--', ...step(scene)],
            });
            assertStrictEquals(green.status, 0);
            assertStrictEquals(green.stdout, 'out\n');
            assertStrictEquals(
                green.stderr,
                `sha-result-cache: cannot use ${root};`
                + ' running without it\nerr\n',
            );
            const red = await sh(scene, {
                cwd: scene.repo,
                env,
                script: REPLAY_OR_RUN,
                args: ['demo', '--', 'sh', '-c', 'exit 3'],
            });
            assertStrictEquals(red.status, 3);
        }
        assertStrictEquals(timesRan(scene), 2);
        assertEquals(Array.from(Deno.readDirSync(target)), []);
    });
});

// Each step waits on a fifo for the other, so neither
// can finish alone: that both finish proves both were
// recording at once, with no clock.
Deno.test('two runs at once leave one whole entry',
async () => {
    await withScene(async (scene) => {
        const meeting = join(scene.dir, 'meeting');
        await sh(scene, {
            cwd: scene.dir,
            env: {},
            script: 'mkfifo "$1"',
            args: [meeting],
        });
        const listening = [
            'sh', '-c',
            'echo out; echo ran >> "$0"; cat "$1" > /dev/null',
            scene.ran, meeting,
        ];
        const calling = [
            'sh', '-c',
            'echo out; echo ran >> "$0"; echo here > "$1"',
            scene.ran, meeting,
        ];
        const runs = await Promise.all([
            replayOrRun(scene, 'demo', '--', ...listening),
            replayOrRun(scene, 'demo', '--', ...calling),
        ]);
        for (const run of runs) {
            assertStrictEquals(run.status, 0);
            assertStrictEquals(run.stdout, 'out\n');
            assertNotMatch(run.stderr, REPLAYING);
        }
        assertStrictEquals(timesRan(scene), 2);
        assertStrictEquals(entries(scene).length, 1);
        const replay = await replayOrRun(
            scene, 'demo', '--', ...listening,
        );
        assertMatch(replay.stderr, REPLAYING);
        assertStrictEquals(replay.stdout, 'out\n');
        assertStrictEquals(timesRan(scene), 2);
    });
});

Deno.test('nothing is left beside the entries', async () => {
    await withScene(async (scene) => {
        await replayOrRun(scene, 'green', '--', ...step(scene));
        await replayOrRun(scene, 'green', '--', ...step(scene));
        await replayOrRun(
            scene, 'red', '--', 'sh', '-c', 'echo out; exit 3',
        );
        const sha = await git(scene.repo, ['rev-parse', 'HEAD']);
        const paths = cachePaths(scene);
        assertStrictEquals(paths.length, 2);
        assertStrictEquals(paths[0], sha);
        assertEquals(entries(scene), [paths[1]]);
    });
});

// A step cleans up after itself with an EXIT trap, as the
// browser suite removes its run directory. A recorded
// step runs in a subshell, and bash 3.2, the /bin/bash of
// macOS, runs an EXIT trap on a signal that ends a
// subshell only where no shell above it has ever set
// one. So the recording sets none: the step's own trap
// runs on a hangup, on Ctrl-C, and on a termination, its
// cleanup can still print, and nothing is left or
// recorded. The step here is a subshell further down
// than a script puts it, through a timer; the real
// browser script below is the step with none between.
// The script is a file, as every caller is: handed its
// commands by -c, that bash ends on Ctrl-C without its
// exit trap, with this library or without.
Deno.test('a step still cleans up when a signal ends its run',
async () => {
    const signals: [Interruption['signal'], number][] = [
        ['HUP', 129], ['INT', 130], ['TERM', 143],
    ];
    await withScene(async (scene) => {
        const script = join(scene.dir, 'script');
        await Deno.writeTextFile(
            script,
            'set -eu; . "$1";' + TIMER + ' step() {'
            + " trap 'echo cleaning;"
            + ' echo cleaned >> "$CLEANED"\' EXIT;'
            + HOLD + ' };'
            + ' replay_or_run demo -- timed step\n',
        );
        const sha = await git(scene.repo, ['rev-parse', 'HEAD']);
        // No run is recorded, so each signal meets a step
        // that runs for real.
        for (const [signal, status] of signals) {
            const cleaned = join(scene.dir, `cleaned-${signal}`);
            const run = await interrupted(scene, {
                cwd: scene.repo,
                env: { CLEANED: cleaned },
                job: [SHELL, script, LIBRARY],
                interruption: { signal, alone: false },
            });
            assertStrictEquals(run.status, status, signal);
            assertStrictEquals(run.stdout, 'cleaning\n', signal);
            assertStrictEquals(
                Deno.readTextFileSync(cleaned),
                'cleaned\n',
                signal,
            );
            assertEquals(cachePaths(scene), [sha], signal);
        }
    });
});

// The recording's own directory is made before the step
// starts, and a signal can land before that. The three
// signals are named before the directory is made, so one
// that lands while its fifos are being made still leaves
// nothing beside the entries, and the step never starts.
// The stand-in `mkfifo` is where the run is held.
Deno.test('a signal before the step starts leaves nothing',
async () => {
    const signals: [Interruption['signal'], number][] = [
        ['HUP', 129], ['INT', 130], ['TERM', 143],
    ];
    await withScene(async (scene) => {
        const stubs = join(scene.dir, 'stubs');
        await Deno.mkdir(stubs);
        await Deno.writeTextFile(
            join(stubs, 'mkfifo'),
            `#!/bin/bash\n${HOLD}\n`,
            { mode: 0o755 },
        );
        const script = join(scene.dir, 'script');
        await Deno.writeTextFile(
            script,
            'PATH="$STUBS:$PATH"; set -eu; . "$1";'
            + ' step() { echo ran >> "$RAN"; };'
            + ' replay_or_run demo -- step\n',
        );
        const sha = await git(scene.repo, ['rev-parse', 'HEAD']);
        for (const [signal, status] of signals) {
            const run = await interrupted(scene, {
                cwd: scene.repo,
                env: { STUBS: stubs, RAN: scene.ran },
                job: [SHELL, script, LIBRARY],
                interruption: { signal, alone: false },
            });
            assertStrictEquals(run.status, status, signal);
            assertStrictEquals(timesRan(scene), 0, signal);
            assertEquals(cachePaths(scene), [sha], signal);
        }
    });
});

// A step's own exit trap runs on a hangup or a termination
// only where no shell above it has ever set one. A caller
// that holds one is refused before the step runs, asked
// or not. One that set a trap and cleared it again cannot
// be seen from here, and is the caller's to avoid.
Deno.test('a caller that holds an EXIT trap is refused',
async () => {
    await withScene(async (scene) => {
        const refused = async () => {
            const run = await sh(scene, {
                cwd: scene.repo,
                env: {},
                script: 'set -eu; . "$0"; trap "echo left" EXIT;'
                    + ' replay_or_run demo -- "$@"; echo passed',
                args: step(scene),
            });
            assertStrictEquals(run.status, 1);
            assertMatch(run.stderr, /an EXIT trap/);
            assertNotMatch(run.stdout, /passed/);
        };
        await refused();
        // And where the cache is not asked at all.
        await Deno.writeTextFile(
            join(scene.repo, 'untracked'), 'x',
        );
        await refused();
        assertStrictEquals(timesRan(scene), 0);
        assertEquals(entries(scene), []);
    });
});

function samplesIn(ledger: string): DurationSample[] {
    return parseLedger(Deno.readTextFileSync(ledger));
}

const DURATION_LINE = /^duration: /gm;

// Where the test command lives in this checkout.
const TEST = 'bin/test';

// The real `bin/test` script and the real libraries, copied
// into a repository of their own beside stand-ins for
// what the script runs: a `deno` that answers
// `--version`, notes each other call with its TZ, and
// exits as told for the UTC pass; and a generator that
// notes its call and says its line. The script runs
// under the shell its own first line names.
type Replica = {
    readonly scene: Scene;
    readonly run: (
        args: string[], env: Record<string, string>,
    ) => Promise<Run>;
    readonly calls: () => string[];
};

async function withReplica(
    body: (replica: Replica) => Promise<void>,
): Promise<void> {
    await withScene(async (scene) => {
        const stubs = join(scene.dir, 'stubs');
        await Deno.mkdir(stubs);
        await Deno.writeTextFile(
            join(stubs, 'deno'),
            '#!/bin/sh\n'
            + TIMER_RUNS_FOR_REAL
            + 'if [ "$1" = "--version" ]; then\n'
            + '    echo "deno 0.0.0 (stand-in)"\n'
            + '    exit 0\n'
            + 'fi\n'
            + 'echo "deno $1 TZ=$TZ" >> "$CALLS"\n'
            + 'if [ "$TZ" = UTC ]; then\n'
            + '    exit "$UTC_PASS_STATUS"\n'
            + 'fi\n',
            { mode: 0o755 },
        );
        copyFromCheckout(scene.repo, [TEST, ...GATE_LIBRARIES]);
        await Deno.writeTextFile(
            join(scene.repo, 'bin/generate-api-documentation'),
            '#!/bin/sh\n'
            + 'echo "generator $1" >> "$CALLS"\n'
            + 'echo "api-documentation is up to date"\n',
            { mode: 0o755 },
        );
        await commitAll(scene.repo, 'The test script');
        await body({
            scene,
            run: (args, env) =>
                runInReplica(scene, `./${TEST}`, args, {
                    PATH: `${stubs}:${searchPath()}`,
                    CALLS: scene.ran,
                    UTC_PASS_STATUS: '0',
                    SHA_RESULT_CACHE_ROOT: scene.root,
                    TOOL_DURATIONS_PATH: NO_LEDGER,
                    ...realDeno(),
                    ...env,
                }),
            calls: () =>
                timesRan(scene) === 0
                    ? []
                    : Deno.readTextFileSync(scene.ran)
                        .trimEnd().split('\n'),
        });
    });
}

const BOTH_PASSES = [
    'deno test TZ=UTC',
    'deno test TZ=Pacific/Honolulu',
];

Deno.test('the real test script replays the steps that passed',
async () => {
    await withReplica(async ({ run, calls }) => {
        const first = await run([], {});
        assertStrictEquals(first.status, 0);
        assertNotMatch(first.stderr, REPLAYING);
        assertEquals(calls(), BOTH_PASSES);

        const replay = await run([], {});
        assertStrictEquals(replay.status, 0);
        assertMatch(
            replay.stderr,
            /^sha-result-cache: replaying memory, /m,
        );
        assertEquals(calls(), BOTH_PASSES);

        // With POSTGRES_URL set the suite also runs its
        // Postgres files against that database, and no
        // SHA names a database.
        const named = await run(
            [], { POSTGRES_URL: 'postgres://stand-in' },
        );
        assertStrictEquals(named.status, 0);
        assertNotMatch(named.stderr, REPLAYING);
        assertEquals(calls(), [...BOTH_PASSES, ...BOTH_PASSES]);

        const checked = await run(['api-docs'], {});
        const again = await run(['api-docs'], {});
        assertStrictEquals(checked.status, 0);
        assertStrictEquals(again.status, 0);
        assertStrictEquals(
            again.stdout, 'api-documentation is up to date\n',
        );
        assertMatch(
            again.stderr,
            /^sha-result-cache: replaying api-docs, /m,
        );
        assertEquals(calls(), [
            ...BOTH_PASSES, ...BOTH_PASSES, 'generator --check',
        ]);
    });
});

// The memory suite is two passes. If the first failed and
// the second passed with `set -e` off, the suite would
// pass and the pass would be recorded: the unit's worst
// failure, pinned through the script that ships.
Deno.test('the real test script never records a red first pass',
async () => {
    await withReplica(async ({ scene, run, calls }) => {
        const red = await run([], { UTC_PASS_STATUS: '1' });
        assertStrictEquals(red.status, 1);
        assertEquals(calls(), ['deno test TZ=UTC']);
        assertEquals(entries(scene), []);
        // And where the cache is not asked at all: with
        // POSTGRES_URL set no SHA names the run. The script
        // refuses a dirty tree at its door, so a dirty one
        // no longer reaches the step.
        const unasked = await run([], {
            UTC_PASS_STATUS: '1',
            POSTGRES_URL: 'postgres://stand-in',
        });
        assertStrictEquals(unasked.status, 1);
        assertEquals(
            calls(), ['deno test TZ=UTC', 'deno test TZ=UTC'],
        );
        assertEquals(entries(scene), []);
    });
});

// The suite refuses a worker count that is none before
// either pass. A refusal is red like any other: it is not
// recorded, so the next run still runs both passes.
Deno.test('the real test script never records a refused count',
async () => {
    await withReplica(async ({ scene, run, calls }) => {
        const refused = await run([], { DENO_JOBS: 'abc' });
        assertStrictEquals(refused.status, 1);
        assertMatch(refused.stderr, /DENO_JOBS/);
        assertEquals(calls(), []);
        assertEquals(entries(scene), []);
        const counted = await run([], { DENO_JOBS: '2' });
        assertStrictEquals(counted.status, 0);
        assertNotMatch(counted.stderr, REPLAYING);
        assertEquals(calls(), BOTH_PASSES);
    });
});

// A replay is not a run. The timer sits inside the ask, so
// a step that really runs appends one sample and prints
// one `duration:` line; its replay appends none and
// prints none. The line travels on the script's own
// stderr and is no part of what the entry keeps.
Deno.test('the real test script times a run and never its replay',
async () => {
    await withReplica(async ({ scene, run }) => {
        const ledger = join(scene.dir, 'tool-durations.jsonl');
        const timed = { TOOL_DURATIONS_PATH: ledger };
        const first = await run([], timed);
        assertStrictEquals(first.status, 0);
        assertNotMatch(first.stderr, REPLAYING);
        assertMatch(
            first.stderr, /^duration: \.\/bin\/test memory took /m,
        );
        assertStrictEquals(
            first.stderr.match(DURATION_LINE)?.length, 1,
        );
        const samples = samplesIn(ledger);
        assertEquals(
            samples.map((sample) => [
                sample.tool,
                sample.arguments,
                sample.exitStatus,
                sample.tree,
            ]),
            [['./bin/test', ['memory'], 0, 'clean']],
        );

        const replay = await run([], timed);
        assertStrictEquals(replay.status, 0);
        assertMatch(
            replay.stderr,
            /^sha-result-cache: replaying memory, /m,
        );
        assertNotMatch(replay.stderr, /duration/i);
        assertEquals(samplesIn(ledger), samples);
    });
});

// The real `bin/test-browser` and the real library,
// copied into a repository of their own beside stand-ins
// for what the script runs: a build library whose
// bundle_client makes the site directory, notes its call,
// and returns as told; a `deno` that answers `--version`,
// notes each other call and exits as told, the files'
// call with the temp directory it was handed; and a
// Chrome that states a version. The script runs under the
// shell its own first line names, with a temp directory
// of its own to make its run directory in.
type BrowserReplica = {
    readonly scene: Scene;
    readonly tmp: string;
    readonly run: (env: Record<string, string>) => Promise<Run>;
    readonly interrupt: (
        interruption: Interruption,
    ) => Promise<Run>;
    readonly calls: () => string[];
};

async function withBrowserReplica(
    body: (replica: BrowserReplica) => Promise<void>,
): Promise<void> {
    await withScene(async (scene) => {
        const stubs = join(scene.dir, 'stubs');
        await Deno.mkdir(stubs);
        await Deno.writeTextFile(
            join(stubs, 'deno'),
            '#!/bin/bash\n'
            + TIMER_RUNS_FOR_REAL
            + 'case "$1" in\n'
            + '    --version)\n'
            + '        echo "deno 0.0.0 (stand-in)"\n'
            + '        ;;\n'
            + '    run)\n'
            + '        echo "deno run" >> "$CALLS"\n'
            + '        exit "$SEED_STATUS"\n'
            + '        ;;\n'
            + '    test)\n'
            + '        [ -d "$TMPDIR" ] || exit 2\n'
            + '        echo "deno test $TMPDIR" >> "$CALLS"\n'
            + '        if [ -n "${STARTED:-}" ]; then\n'
            + `           ${HOLD}\n`
            + '        fi\n'
            + '        exit "$FILES_STATUS"\n'
            + '        ;;\n'
            + 'esac\n',
            { mode: 0o755 },
        );
        await Deno.writeTextFile(
            join(stubs, 'chrome'),
            '#!/bin/sh\n'
            + 'if [ -z "${CHROME_SAYS_NOTHING:-}" ]; then\n'
            + '    echo "Google Chrome 0.0.0 (stand-in)"\n'
            + 'fi\n',
            { mode: 0o755 },
        );
        const tmp = join(scene.dir, 'tmp');
        await Deno.mkdir(tmp);
        copyFromCheckout(
            scene.repo, ['bin/test-browser', ...GATE_LIBRARIES],
        );
        await Deno.writeTextFile(
            join(scene.repo, 'bin/build-lib'),
            'bundle_client() {\n'
            + '    echo "bundle" >> "$CALLS"\n'
            + '    mkdir -p "$1"\n'
            + '    return "$BUNDLE_STATUS"\n'
            + '}\n',
        );
        await commitAll(scene.repo, 'The browser script');
        const standIns = {
            PATH: `${stubs}:${searchPath()}`,
            CALLS: scene.ran,
            CHROME: join(stubs, 'chrome'),
            TMPDIR: tmp,
            BUNDLE_STATUS: '0',
            SEED_STATUS: '0',
            FILES_STATUS: '0',
            ...realDeno(),
        };
        await body({
            scene,
            tmp,
            run: (env) =>
                runInReplica(scene, './bin/test-browser', [], {
                    ...standIns,
                    SHA_RESULT_CACHE_ROOT: scene.root,
                    TOOL_DURATIONS_PATH: NO_LEDGER,
                    ...env,
                }),
            interrupt: (interruption) =>
                interrupted(scene, {
                    cwd: scene.repo,
                    env: standIns,
                    job: [SHELL, './bin/test-browser'],
                    interruption,
                }),
            calls: () =>
                timesRan(scene) === 0
                    ? []
                    : Deno.readTextFileSync(scene.ran)
                        .trimEnd().split('\n'),
        });
    });
}

function namesIn(dir: string): string[] {
    return Array.from(Deno.readDirSync(dir), (entry) => entry.name);
}

// Everything a run makes is the step's own: its directory,
// the bundle, the seed, and the files' run. A replay makes
// and starts none of them.
Deno.test('the real browser script replays with no run of its own',
async () => {
    await withBrowserReplica(async ({ tmp, run, calls }) => {
        const first = await run({});
        assertStrictEquals(first.status, 0);
        assertNotMatch(first.stderr, REPLAYING);
        const [bundle, seed, files] = calls();
        assertEquals([bundle, seed], ['bundle', 'deno run']);
        // The files ran with a temp directory inside the
        // run's own, which stood while they ran.
        const held = files!.slice('deno test '.length);
        assertStrictEquals(basename(held), 'tmp');
        assertMatch(basename(dirname(held)), /^fusion-browser\./);
        assertStrictEquals(dirname(dirname(held)), tmp);
        assertEquals(namesIn(tmp), []);

        const replay = await run({});
        assertStrictEquals(replay.status, 0);
        assertMatch(
            replay.stderr,
            /^sha-result-cache: replaying browser Google Chrome /m,
        );
        assertStrictEquals(calls().length, 3);
        assertEquals(namesIn(tmp), []);
    });
});

// The trap that removes the run's directory is set
// inside the step, which runs in a subshell when it is
// recorded and in the script's own shell when the cache
// is not asked. Either way a run that fails, at its
// bundle, its seed, or its files, exits with the status
// that failed it, leaves no directory, and is never
// recorded.
Deno.test('the real browser script cleans up a failed run',
async () => {
    await withBrowserReplica(async ({ scene, tmp, run, calls }) => {
        const failures: [Record<string, string>, number, number][] = [
            [{ BUNDLE_STATUS: '3' }, 3, 1],
            [{ SEED_STATUS: '4' }, 4, 2],
            [{ FILES_STATUS: '5' }, 5, 3],
        ];
        const fail = async (how: Record<string, string>) => {
            for (const [env, status, steps] of failures) {
                const before = calls().length;
                const failed = await run({ ...how, ...env });
                assertStrictEquals(failed.status, status);
                assertStrictEquals(calls().length, before + steps);
                assertEquals(namesIn(tmp), []);
                assertEquals(entries(scene), []);
            }
        };
        await fail({});
        // And where the cache is not asked at all: a Chrome
        // that says nothing names no browser, and the suite
        // runs in the script's own shell. The script refuses
        // a dirty tree at its door, so a dirty one no longer
        // reaches the step.
        const silent = { CHROME_SAYS_NOTHING: '1' };
        await fail(silent);
        const unasked = await run(silent);
        assertStrictEquals(unasked.status, 0);
        assertNotMatch(unasked.stderr, /sha-result-cache/);
        assertEquals(namesIn(tmp), []);
        assertEquals(entries(scene), []);
    });
});

// A run that is interrupted removes its directory as a
// failed one does: on Ctrl-C, a hangup, and a termination,
// each sent to the whole process group as a terminal or a
// supervisor sends it, and on a termination of the script
// alone. The run is recorded, so its trap is set in a
// subshell of the recording; a run that is not asked is
// the script's own shell and bash's own business. No
// interrupted run is recorded, with one exception that is
// no interruption of the suite: a run whose script alone
// is terminated goes on behind it, passes, and is kept.
Deno.test('the real browser script cleans up an interrupted run',
async () => {
    // The run that is kept comes last: until then every
    // run in this one repository is a real one.
    const interruptions: [Interruption, number, number][] = [
        [{ signal: 'INT', alone: false }, 130, 0],
        [{ signal: 'HUP', alone: false }, 129, 0],
        [{ signal: 'TERM', alone: false }, 143, 0],
        [{ signal: 'TERM', alone: true }, 143, 1],
    ];
    await withBrowserReplica(
    async ({ scene, tmp, interrupt, calls }) => {
        for (const [interruption, status, kept] of interruptions) {
            const before = calls().length;
            const run = await interrupt(interruption);
            const where = `${interruption.signal}`
                + ` alone=${interruption.alone}`;
            assertStrictEquals(run.status, status, where);
            assertStrictEquals(calls().length, before + 3, where);
            assertEquals(namesIn(tmp), [], where);
            assertStrictEquals(entries(scene).length, kept, where);
        }
    });
});

// The same at a door of its own: the browser script times
// its suite inside its ask. A run that begins and fails
// is a run, recorded red with no line of its own; a run
// that passes is one sample and one line; its replay is
// neither.
Deno.test('the real browser script times a run and never its replay',
async () => {
    await withBrowserReplica(async ({ scene, run }) => {
        const ledger = join(scene.dir, 'tool-durations.jsonl');
        const timed = { TOOL_DURATIONS_PATH: ledger };
        const taken = () =>
            samplesIn(ledger).map((sample) => [
                sample.tool, sample.arguments, sample.exitStatus,
            ]);

        const red = await run({ ...timed, FILES_STATUS: '5' });
        assertStrictEquals(red.status, 5);
        assertNotMatch(red.stderr, /duration/i);
        assertEquals(taken(), [['./bin/test', ['browser'], 5]]);
        assertEquals(entries(scene), []);

        const green = await run(timed);
        assertStrictEquals(green.status, 0);
        assertMatch(
            green.stderr, /^duration: \.\/bin\/test browser took /m,
        );
        assertStrictEquals(
            green.stderr.match(DURATION_LINE)?.length, 1,
        );
        assertEquals(taken(), [
            ['./bin/test', ['browser'], 5],
            ['./bin/test', ['browser'], 0],
        ]);

        const replay = await run(timed);
        assertStrictEquals(replay.status, 0);
        assertMatch(replay.stderr, REPLAYING);
        assertNotMatch(replay.stderr, /duration/i);
        assertStrictEquals(taken().length, 2);
    });
});
