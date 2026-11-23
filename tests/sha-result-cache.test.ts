import {
    assertEquals,
    assertMatch,
    assertNotEquals,
    assertNotMatch,
    assertStrictEquals,
    assertStringIncludes,
} from '@std/assert';
import { basename, dirname, join, relative } from '@std/path';

// bin/sha-result-cache-lib, driven through /bin/bash: the
// shell its callers' `#!/bin/bash` names. bash and POSIX
// sh differ on exactly what the library guards (`set -e`
// inside `$( )`), so the cases run the shipping shell.
// Every case gets a repository and a cache root of its
// own, so none reads another's entries or this checkout's
// tree.
const SHELL = '/bin/bash';

const LIBRARY = join(Deno.cwd(), 'bin/sha-result-cache-lib');

const REPLAY_OR_RUN = 'set -eu; . "$0"; replay_or_run "$@"';

// A spawn that outlasts this is hung, not slow. The
// bound is the browser suite's own: this unit was built
// under loads that stretched a one-second spawn past
// twenty.
const RUN_TIMEOUT_MS = 120_000;

// The commit is made from no one's git config, so a
// signing or hook setting cannot reach it.
const HERMETIC_GIT = {
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
};

const REPLAYING = /^sha-result-cache: replaying /m;

type Scene = {
    readonly dir: string;
    readonly repo: string;
    readonly root: string;
    readonly ran: string;
};

type Run = {
    readonly status: number;
    readonly stdout: string;
    readonly stderr: string;
};

function searchPath(): string {
    const path = Deno.env.get('PATH');
    if (path === undefined) {
        throw new Error('PATH is not set');
    }
    return path;
}

async function git(
    cwd: string, args: string[],
): Promise<string> {
    const output = await new Deno.Command('git', {
        args: [
            '-c', 'user.name=Test',
            '-c', 'user.email=test@example.com',
            ...args,
        ],
        cwd,
        clearEnv: true,
        env: { PATH: searchPath(), ...HERMETIC_GIT },
        stdout: 'piped',
        stderr: 'piped',
    }).output();
    const decoder = new TextDecoder();
    assertEquals(
        output.success, true, decoder.decode(output.stderr),
    );
    return decoder.decode(output.stdout).trim();
}

// A repository with one commit and a clean tree, beside
// a cache root the library has yet to make and a file
// each real run of a step adds a line to.
async function withScene(
    body: (scene: Scene) => Promise<void>,
): Promise<void> {
    const dir = await Deno.makeTempDir({
        prefix: 'sha-result-cache-',
    });
    try {
        const repo = join(dir, 'repo');
        await Deno.mkdir(repo);
        await git(repo, ['init', '--quiet']);
        await git(repo, [
            'commit', '--quiet', '--allow-empty', '-m', 'First',
        ]);
        await body({
            dir,
            repo,
            root: join(dir, 'root'),
            ran: join(dir, 'ran'),
        });
    } finally {
        await Deno.remove(dir, { recursive: true });
    }
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

// The real `test` script and the real library, copied
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
        await Deno.mkdir(join(scene.repo, 'bin'));
        await Deno.copyFile('test', join(scene.repo, 'test'));
        await Deno.copyFile(
            LIBRARY, join(scene.repo, 'bin/sha-result-cache-lib'),
        );
        await Deno.writeTextFile(
            join(scene.repo, 'bin/generate-api-documentation'),
            '#!/bin/sh\n'
            + 'echo "generator $1" >> "$CALLS"\n'
            + 'echo "api-documentation is up to date"\n',
            { mode: 0o755 },
        );
        await git(scene.repo, ['add', '.']);
        await git(scene.repo, [
            'commit', '--quiet', '-m', 'The test script',
        ]);
        await body({
            scene,
            run: async (args, env) => {
                const output = await new Deno.Command(SHELL, {
                    args: ['./test', ...args],
                    cwd: scene.repo,
                    clearEnv: true,
                    env: {
                        PATH: `${stubs}:${searchPath()}`,
                        CALLS: scene.ran,
                        UTC_PASS_STATUS: '0',
                        SHA_RESULT_CACHE_ROOT: scene.root,
                        GIT_CEILING_DIRECTORIES: scene.dir,
                        ...HERMETIC_GIT,
                        ...env,
                    },
                    signal: AbortSignal.timeout(RUN_TIMEOUT_MS),
                }).output();
                const decoder = new TextDecoder();
                return {
                    status: output.code,
                    stdout: decoder.decode(output.stdout),
                    stderr: decoder.decode(output.stderr),
                };
            },
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
        // And where the cache is not asked at all.
        await Deno.writeTextFile(
            join(scene.repo, 'untracked'), 'x',
        );
        const unasked = await run([], { UTC_PASS_STATUS: '1' });
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
            '#!/bin/sh\n'
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
            + '        exit "$FILES_STATUS"\n'
            + '        ;;\n'
            + 'esac\n',
            { mode: 0o755 },
        );
        await Deno.writeTextFile(
            join(stubs, 'chrome'),
            '#!/bin/sh\n'
            + 'echo "Google Chrome 0.0.0 (stand-in)"\n',
            { mode: 0o755 },
        );
        const tmp = join(scene.dir, 'tmp');
        await Deno.mkdir(tmp);
        await Deno.mkdir(join(scene.repo, 'bin'));
        await Deno.copyFile(
            'bin/test-browser',
            join(scene.repo, 'bin/test-browser'),
        );
        await Deno.copyFile(
            LIBRARY, join(scene.repo, 'bin/sha-result-cache-lib'),
        );
        await Deno.writeTextFile(
            join(scene.repo, 'bin/build-lib'),
            'bundle_client() {\n'
            + '    echo "bundle" >> "$CALLS"\n'
            + '    mkdir -p "$1"\n'
            + '    return "$BUNDLE_STATUS"\n'
            + '}\n',
        );
        await git(scene.repo, ['add', '.']);
        await git(scene.repo, [
            'commit', '--quiet', '-m', 'The browser script',
        ]);
        await body({
            scene,
            tmp,
            run: async (env) => {
                const output = await new Deno.Command(SHELL, {
                    args: ['./bin/test-browser'],
                    cwd: scene.repo,
                    clearEnv: true,
                    env: {
                        PATH: `${stubs}:${searchPath()}`,
                        CALLS: scene.ran,
                        CHROME: join(stubs, 'chrome'),
                        TMPDIR: tmp,
                        BUNDLE_STATUS: '0',
                        SEED_STATUS: '0',
                        FILES_STATUS: '0',
                        SHA_RESULT_CACHE_ROOT: scene.root,
                        GIT_CEILING_DIRECTORIES: scene.dir,
                        ...HERMETIC_GIT,
                        ...env,
                    },
                    signal: AbortSignal.timeout(RUN_TIMEOUT_MS),
                }).output();
                const decoder = new TextDecoder();
                return {
                    status: output.code,
                    stdout: decoder.decode(output.stdout),
                    stderr: decoder.decode(output.stderr),
                };
            },
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
        const fail = async () => {
            for (const [env, status, steps] of failures) {
                const before = calls().length;
                const failed = await run(env);
                assertStrictEquals(failed.status, status);
                assertStrictEquals(calls().length, before + steps);
                assertEquals(namesIn(tmp), []);
                assertEquals(entries(scene), []);
            }
        };
        await fail();
        // And where the cache is not asked at all.
        await Deno.writeTextFile(
            join(scene.repo, 'untracked'), 'x',
        );
        await fail();
        const unasked = await run({});
        assertStrictEquals(unasked.status, 0);
        assertEquals(namesIn(tmp), []);
        assertEquals(entries(scene), []);
    });
});
