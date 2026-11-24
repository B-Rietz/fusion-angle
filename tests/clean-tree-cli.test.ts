import {
    assertEquals,
    assertMatch,
    assertNotMatch,
    assertStrictEquals,
    assertThrows,
} from '@std/assert';
import { join } from '@std/path';
import {
    commitAll,
    copyFromCheckout,
    GATE_LIBRARIES,
    git,
    type Repository,
    type Run,
    runInReplica,
    searchPath,
    withRepository,
} from './fixtures/script-replica.ts';

// Every script that tests, builds, or deploys this tree
// refuses a dirty one before any work, with one message
// from one place (bin/clean-tree-lib). The real scripts
// run here in a repository of the test's own, beside
// stand-ins for every program they would run: each
// stand-in notes its call, so "nothing ran" is a file
// that was never made.
const TEST = './bin/test';
const DEPLOY = './bin/deploy';
const BUILD = './bin/build';
const TEST_POSTGRES = './bin/test-postgres';
const TEST_BROWSER = './bin/test-browser';

// The five scripts and every library one of them sources.
const SCRIPTS = [
    'bin/test',
    'bin/deploy',
    'bin/build',
    'bin/test-postgres',
    'bin/test-browser',
    'bin/build-lib',
    'bin/compose-lib',
    'bin/postgres-lib',
    ...GATE_LIBRARIES,
];

const STAND_INS = ['deno', 'docker', 'render', 'curl', 'chrome'];

const NOT_CLEAN = 'Error: working directory is not clean.';
const WAY_FORWARD = 'Commit, then run this again;'
    + ' amend the commit to fix what a run finds.';

type Scene = Repository & {
    // Where the stand-ins note their calls.
    readonly calls: string;
    // A cache root and a ledger nothing has made yet.
    readonly root: string;
    readonly ledger: string;
    readonly run: (
        script: string, ...args: string[]
    ) => Promise<Run>;
};

// The scripts, copied to DIR beside stand-ins in a
// directory outside it. A cache root and a ledger are
// named, so a script that got past its door would leave
// both behind.
async function sceneAt(
    repository: Repository,
    body: (scene: Scene) => Promise<void>,
): Promise<void> {
    const stubs = join(repository.dir, 'stubs');
    await Deno.mkdir(stubs);
    for (const program of STAND_INS) {
        await Deno.writeTextFile(
            join(stubs, program),
            `#!/bin/sh\necho "${program} $*" >> "$CALLS"\n`,
            { mode: 0o755 },
        );
    }
    copyFromCheckout(repository.repo, SCRIPTS);
    const calls = join(repository.dir, 'calls');
    const root = join(repository.dir, 'root');
    const ledger = join(repository.dir, 'tool-durations.jsonl');
    await body({
        ...repository,
        calls,
        root,
        ledger,
        run: (script, ...args) =>
            runInReplica(repository, script, args, {
                PATH: `${stubs}:${searchPath()}`,
                CALLS: calls,
                CHROME: join(stubs, 'chrome'),
                SHA_RESULT_CACHE_ROOT: root,
                TOOL_DURATIONS_PATH: ledger,
            }),
    });
}

// A replica with the scripts committed: a clean tree.
function withScene(
    body: (scene: Scene) => Promise<void>,
): Promise<void> {
    return withRepository((repository) =>
        sceneAt(repository, async (scene) => {
            await commitAll(scene.repo, 'The scripts');
            await body(scene);
        })
    );
}

function absent(path: string): void {
    assertThrows(() => Deno.statSync(path), Deno.errors.NotFound);
}

// Refused at the door: the one message with what git
// listed, nothing on stdout, and nothing run, recorded, or
// sampled.
function assertRefused(
    scene: Scene, run: Run, listed: string, what: string,
): void {
    assertStrictEquals(
        run.stderr, `${NOT_CLEAN}\n${listed}\n${WAY_FORWARD}\n`, what,
    );
    assertStrictEquals(run.status, 1, what);
    assertStrictEquals(run.stdout, '', what);
    absent(scene.calls);
    absent(scene.root);
    absent(scene.ledger);
}

async function dirty(scene: Scene): Promise<string> {
    await Deno.writeTextFile(join(scene.repo, 'scratch'), 'x');
    return '?? scratch';
}

// Each line of the usage is a form; a word in brackets
// may be left out.
function formsIn(usage: string): string[][] {
    return usage.trimEnd().split('\n').flatMap((line) => {
        const words = line.replace(/^Usage:/, '').trim()
            .split(/\s+/).slice(1);
        const optional = words.findIndex((word) =>
            word.startsWith('[')
        );
        if (optional < 0) {
            return [words];
        }
        return [
            words.filter((_, at) => at !== optional),
            words.map((word) => word.replace(/^\[|\]$/g, '')),
        ];
    });
}

// The forms are read from --help, so a form added
// tomorrow is held to the rule the day it is offered.
Deno.test('every form of the test command refuses a dirty tree',
async () => {
    await withScene(async (scene) => {
        const listed = await dirty(scene);
        const help = await scene.run(TEST, '--help');
        assertStrictEquals(help.status, 0);
        const forms = formsIn(help.stdout);
        assertEquals(forms, [
            [],
            ['memory'],
            ['check'],
            ['lint'],
            ['schema'],
            ['api-docs'],
            ['postgres'],
            ['browser'],
            ['validate'],
            ['validate', '--syntax'],
            ['validate', 'browser'],
            ['validate', 'postgres'],
        ]);
        for (const form of forms) {
            assertRefused(
                scene,
                await scene.run(TEST, ...form),
                listed,
                form.join(' '),
            );
        }
    });
});

// The suites' own scripts are run directly too, and the
// build has two forms.
Deno.test('the door scripts and the build refuse a dirty tree',
async () => {
    await withScene(async (scene) => {
        const listed = await dirty(scene);
        const out = join(scene.dir, 'out') + '/';
        const runs: [string, ...string[]][] = [
            [TEST_POSTGRES],
            [TEST_BROWSER],
            [BUILD, out],
            [BUILD, '--no-zip', out],
        ];
        for (const [script, ...args] of runs) {
            assertRefused(
                scene,
                await scene.run(script, ...args),
                listed,
                [script, ...args].join(' '),
            );
        }
        absent(out);
    });
});

// --render builds nothing from the tree and deploys the
// SHA it is handed. It refuses all the same: no
// uncommitted edit to the deploy, wipe, or seed scripts
// acts on production.
Deno.test('deploy refuses a dirty tree in every form',
async () => {
    await withScene(async (scene) => {
        const listed = await dirty(scene);
        const sha = await git(scene.repo, ['rev-parse', 'HEAD']);
        const forms = [
            ['--local', '18080', '--postgres', 'mock-data'],
            ['--local', '18080', '--postgres', 'bootstrap'],
            ['--render', 'token', '--commit', sha],
            ['--render', 'token', '--postgres', 'mock-data'],
        ];
        for (const form of forms) {
            assertRefused(
                scene,
                await scene.run(DEPLOY, ...form),
                listed,
                form.join(' '),
            );
        }
    });
});

// Dirty is what `git status --porcelain` prints. An
// ignored file is not listed, and the step runs.
Deno.test('a change of any kind is dirty and an ignored file is not',
async () => {
    const kinds: [string, (repo: string) => Promise<void>][] = [
        ['?? scratch', (repo) =>
            Deno.writeTextFile(join(repo, 'scratch'), 'x')],
        [' M tracked', (repo) =>
            Deno.writeTextFile(join(repo, 'tracked'), 'changed')],
        ['M  tracked', async (repo) => {
            await Deno.writeTextFile(join(repo, 'tracked'), 'changed');
            await git(repo, ['add', 'tracked']);
        }],
        [' D tracked', (repo) => Deno.remove(join(repo, 'tracked'))],
    ];
    const tracked = async (scene: Scene) => {
        await Deno.writeTextFile(join(scene.repo, 'tracked'), 'x');
        await Deno.writeTextFile(
            join(scene.repo, '.gitignore'), 'ignored\n',
        );
        await commitAll(scene.repo, 'A tracked file');
    };
    for (const [listed, change] of kinds) {
        await withScene(async (scene) => {
            await tracked(scene);
            await change(scene.repo);
            assertRefused(
                scene, await scene.run(TEST, 'check'), listed, listed,
            );
        });
    }
    await withScene(async (scene) => {
        await tracked(scene);
        await Deno.writeTextFile(join(scene.repo, 'ignored'), 'x');
        const run = await scene.run(TEST, 'check');
        assertStrictEquals(run.status, 0, run.stderr);
        assertNotMatch(run.stderr, /not clean/);
        assertMatch(
            Deno.readTextFileSync(scene.calls), /^deno check /m,
        );
    });
});

// `status.showUntrackedFiles=no` makes a bare `git status`
// leave untracked files out, in the repository's config or
// in the operator's own. A new test file is untracked, so
// the library asks for them by name.
Deno.test('a git setting cannot hide an untracked file',
async () => {
    await withScene(async (scene) => {
        await git(scene.repo, [
            'config', 'status.showUntrackedFiles', 'no',
        ]);
        const listed = await dirty(scene);
        const runs: [string, ...string[]][] = [
            [TEST, 'check'],
            [BUILD, '--no-zip', join(scene.dir, 'out') + '/'],
        ];
        for (const [script, ...args] of runs) {
            assertRefused(
                scene,
                await scene.run(script, ...args),
                listed,
                [script, ...args].join(' '),
            );
        }
    });
});

// Help and a usage error are about the command line, so
// they answer before the tree is read. The tests that
// spawn a script in this checkout rest on that order:
// they reach nothing else.
Deno.test('help and a usage error answer on a dirty tree',
async () => {
    await withScene(async (scene) => {
        await dirty(scene);
        const helps: [string, ...string[]][] = [
            [TEST, '--help'],
            [TEST, '-h'],
            [DEPLOY, '--help'],
            [BUILD, '--help'],
        ];
        for (const [script, ...args] of helps) {
            const run = await scene.run(script, ...args);
            const what = [script, ...args].join(' ');
            assertStrictEquals(run.status, 0, what);
            assertMatch(run.stdout, /^Usage: /, what);
            assertStrictEquals(run.stderr, '', what);
        }
        const errors: [string, ...string[]][] = [
            [TEST, 'bogus'],
            [TEST, 'memory', 'extra'],
            [TEST, 'lint', 'extra'],
            [TEST, 'validate', 'bogus'],
            [TEST, 'validate', '--syntax', 'browser'],
            [DEPLOY],
            [DEPLOY, '--local', '18080'],
            [DEPLOY, '--bogus'],
            [BUILD, '--bogus'],
        ];
        for (const [script, ...args] of errors) {
            const run = await scene.run(script, ...args);
            const what = [script, ...args].join(' ');
            assertStrictEquals(run.status, 1, what);
            assertMatch(run.stderr, /^Error: /, what);
            assertMatch(run.stderr, /^Usage: /m, what);
            assertNotMatch(run.stderr, /not clean/, what);
        }
        absent(scene.calls);
    });
});

// A git that cannot answer is never read as clean: a test
// run outside a repository has no SHA to belong to.
Deno.test('a tree git cannot describe is refused in git\'s words',
async () => {
    await withRepository(async (repository) => {
        const plain = join(repository.dir, 'plain');
        await Deno.mkdir(plain);
        await sceneAt({ dir: repository.dir, repo: plain },
        async (scene) => {
            for (const script of [TEST, TEST_POSTGRES, TEST_BROWSER]) {
                const run = await scene.run(script);
                assertStrictEquals(run.status, 1, script);
                assertStrictEquals(run.stdout, '', script);
                const lines = run.stderr.trimEnd().split('\n');
                assertMatch(
                    lines[0]!, /not a git repository/, script,
                );
                assertStrictEquals(
                    lines.at(-1),
                    'Error: git could not say whether the'
                    + ' working directory is clean.',
                    script,
                );
                absent(scene.calls);
                absent(scene.root);
                absent(scene.ledger);
            }
        });
    });
});

// An image build may hold no repository: Render deletes
// .git, and a worktree's .git names a directory the
// image lacks. There is no tree to ask about, and the
// build goes on to name its commit, here with nothing to
// name it from.
Deno.test('the build asks about the tree only in a repository',
async () => {
    await withRepository(async (repository) => {
        const plain = join(repository.dir, 'plain');
        await Deno.mkdir(plain);
        await sceneAt({ dir: repository.dir, repo: plain },
        async (scene) => {
            const out = join(scene.dir, 'out') + '/';
            const unnamed = async (where: string) => {
                const run = await scene.run(BUILD, '--no-zip', out);
                assertStrictEquals(run.status, 1, where);
                assertMatch(
                    run.stderr,
                    /^Error: no commit SHA to embed\. /,
                    where,
                );
                assertStrictEquals(
                    run.stderr.trimEnd().split('\n').length, 1, where,
                );
                absent(scene.calls);
            };
            await unnamed('no .git');
            await Deno.writeTextFile(
                join(plain, '.git'),
                `gitdir: ${join(scene.dir, 'absent')}\n`,
            );
            await unnamed('a .git that points nowhere');
        });
    });
});

// Four places read the tree: the library that refuses,
// the result cache, the timer, and the measure's own
// check. Each names the untracked files it wants, so no
// git setting answers for it.
Deno.test('every reader of the tree asks for untracked files',
() => {
    for (const library of [
        'bin/clean-tree-lib',
        'bin/sha-result-cache-lib',
        'bin/duration-lib',
    ]) {
        const asks = Deno.readTextFileSync(library).split('\n')
            .filter((line) =>
                !line.trimStart().startsWith('#')
                && line.includes('git status')
            );
        assertEquals(asks.length > 0, true, library);
        assertEquals(
            asks.filter((line) =>
                !line.includes(
                    '$(git status --porcelain'
                    + ' --untracked-files=normal',
                )
            ),
            [],
            library,
        );
    }
    const measure = Deno.readTextFileSync('web-app/app/measure.ts');
    const statuses = [...measure.matchAll(/'status'/g)];
    assertStrictEquals(statuses.length, 1);
    assertMatch(
        measure,
        /'status', '--porcelain', '--untracked-files=normal'\]/,
    );
});

// One rule, one place: the refusal is spelled in the
// library alone, and no script reads the tree for itself.
Deno.test('only the library refuses a dirty tree', () => {
    const scripts: string[] = [];
    for (const entry of Deno.readDirSync('bin')) {
        if (entry.isFile) {
            scripts.push(`bin/${entry.name}`);
        }
    }
    const sources = new Map(scripts.map((path) =>
        [path, Deno.readTextFileSync(path)] as const
    ));
    assertEquals(
        scripts.filter((path) =>
            sources.get(path)!.includes('is not clean')
        ),
        ['bin/clean-tree-lib'],
    );
    assertEquals(
        scripts.filter((path) =>
            /git status/.test(
                sources.get(path)!.split('\n')
                    .filter((line) =>
                        !line.trimStart().startsWith('#')
                    ).join('\n'),
            )
        ).sort(),
        [
            'bin/clean-tree-lib',
            'bin/duration-lib',
            'bin/sha-result-cache-lib',
        ],
    );
    for (const path of [
        'bin/test', 'bin/deploy', 'bin/build',
        'bin/test-postgres', 'bin/test-browser',
    ]) {
        assertMatch(
            sources.get(path)!, /^\s*require_clean_tree$/m, path,
        );
    }
});

// One line of .dockerignore, read as Docker reads the
// kinds this repository's file uses: a path from the
// context's root, a directory with its trailing `/`, a
// `*` within one segment, and a leading `!` that keeps
// what an earlier line dropped.
type IgnoreRule = {
    readonly keeps: boolean;
    readonly segments: readonly RegExp[];
};

// A line of any other kind is refused: the pin must not
// pass for want of understanding one.
function ignoreRules(text: string): IgnoreRule[] {
    return text.split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '' && !line.startsWith('#'))
        .map((line) => {
            const keeps = line.startsWith('!');
            const pattern = (keeps ? line.slice(1) : line)
                .replace(/\/$/, '');
            if (pattern === '' || /\*\*|[?[\]\\]|^\//.test(pattern)) {
                throw new Error(
                    `teach this pin the .dockerignore line: ${line}`,
                );
            }
            return {
                keeps,
                segments: pattern.split('/').map((segment) =>
                    new RegExp(
                        '^' + segment.split('*').map((literal) =>
                            literal.replace(/[.+^${}()|]/g, '\\$&')
                        ).join('[^/]*') + '$',
                    )
                ),
            };
        });
}

// A line matches a path and everything under it, since a
// dropped directory takes its contents with it. The last
// line that matches decides.
function droppedFromContext(
    rules: readonly IgnoreRule[], path: string,
): boolean {
    const parts = path.split('/');
    let dropped = false;
    for (const rule of rules) {
        if (rule.segments.length <= parts.length
            && rule.segments.every((segment, at) =>
                segment.test(parts[at]!)
            )) {
            dropped = !rule.keeps;
        }
    }
    return dropped;
}

// A build from the main checkout carries .git into the
// image. A tracked file the context dropped reads there
// as deleted, and bin/build refuses the image as dirty:
// .claude/settings.json did, from the day it was tracked.
// So the context drops nothing git tracks.
Deno.test('the image build context drops no tracked file',
async () => {
    const rules = ignoreRules(Deno.readTextFileSync('.dockerignore'));
    const tracked = (await git(Deno.cwd(), ['ls-files', '-z']))
        .split('\0').filter((path) => path !== '');
    assertEquals(
        tracked.filter((path) => droppedFromContext(rules, path)),
        [],
    );
    // And the reading still drops what the file is for,
    // so nothing above passed for want of a match.
    assertEquals(
        [
            '.DS_Store',
            '.claude/settings.local.json',
            '.claude/worktrees/one/AGENTS.md',
            '.worktrees/one/bin/test',
            '.git/tool-durations.jsonl',
        ].filter((path) => !droppedFromContext(rules, path)),
        [],
    );
});
