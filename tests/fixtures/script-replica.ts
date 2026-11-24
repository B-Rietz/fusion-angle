import { assertEquals } from '@std/assert';
import { dirname, join } from '@std/path';

// A repository of a test's own for the scripts that refuse
// a dirty tree: bin/test, bin/test-postgres,
// bin/test-browser, bin/build, and bin/deploy. The replica
// holds the files a test names as this checkout's working
// tree has them, so an edit is tested before it is
// committed, and commits them there, so its tree is clean
// whatever this one is. A test that needs a dirty tree
// dirties its replica.
//
// No test asks whether this checkout is clean. A script
// run here reaches only --help and a usage error, which
// answer before the tree is read. Run past its arguments
// here, it would fail on the edit a test file is run to
// check, and could meet the here-document /bin/bash 3.2
// writes to the current directory inside the agent
// sandbox, where the tree is dirty for an instant.

// The shell each script's first line names. A relative
// program path would be resolved against this checkout,
// so a replica's script is handed to the shell by name.
export const SHELL = '/bin/bash';

// A spawn that outlasts this is hung, not slow. The
// bound is the browser suite's own: the replicas were
// built under loads that stretched a one-second spawn
// past twenty.
export const RUN_TIMEOUT_MS = 120_000;

// A commit is made from no one's git config, so a
// signing or hook setting cannot reach it.
export const HERMETIC_GIT = {
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
};

export type Run = {
    readonly status: number;
    readonly stdout: string;
    readonly stderr: string;
};

export type Repository = {
    // The temp directory the test owns; nothing above it
    // is a repository git will find.
    readonly dir: string;
    readonly repo: string;
};

export function searchPath(): string {
    const path = Deno.env.get('PATH');
    if (path === undefined) {
        throw new Error('PATH is not set');
    }
    return path;
}

export async function git(
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

// A repository with one commit and a clean tree, in a
// temp directory removed when the body returns.
export async function withRepository(
    body: (repository: Repository) => Promise<void>,
): Promise<void> {
    const dir = await Deno.makeTempDir({
        prefix: 'script-replica-',
    });
    try {
        const repo = join(dir, 'repo');
        await Deno.mkdir(repo);
        await git(repo, ['init', '--quiet']);
        await git(repo, [
            'commit', '--quiet', '--allow-empty', '-m', 'First',
        ]);
        await body({ dir, repo });
    } finally {
        await Deno.remove(dir, { recursive: true });
    }
}

// What every script that refuses a dirty tree sources,
// and the three programs the timer runs, which import
// nothing else.
export const GATE_LIBRARIES = [
    'bin/clean-tree-lib',
    'bin/sha-result-cache-lib',
    'bin/duration-lib',
    'web-app/app/tool-duration.ts',
    'web-app/app/tool-duration-core.ts',
    'web-app/app/measure-core.ts',
];

// Copy FILE from this checkout's working tree to the same
// path under DIR, mode kept. MADE holds the directories
// already made under DIR.
function copyOne(dir: string, file: string, made: Set<string>): void {
    const parent = dirname(join(dir, file));
    if (!made.has(parent)) {
        Deno.mkdirSync(parent, { recursive: true });
        made.add(parent);
    }
    Deno.copyFileSync(file, join(dir, file));
}

// Copy FILES from this checkout's working tree to the
// same paths under DIR, modes kept. A file the test names
// must be there.
export function copyFromCheckout(
    dir: string, files: readonly string[],
): void {
    const made = new Set<string>();
    for (const file of files) {
        copyOne(dir, file, made);
    }
}

// Copy each of FILES that is still in this checkout's
// working tree. They were listed a moment ago, and a file
// can go between the listing and its copy: a
// here-document's temp file inside the agent sandbox, or
// an editor's. A path that has gone is no longer in the
// working tree, so it is passed over.
export function copyPresent(
    dir: string, files: readonly string[],
): void {
    const made = new Set<string>();
    for (const file of files) {
        try {
            copyOne(dir, file, made);
        } catch (error) {
            if (!(error instanceof Deno.errors.NotFound)) {
                throw error;
            }
        }
    }
}

// Every file this checkout's working tree holds that git
// tracks or would add: what a commit of everything here
// would hold. A tracked file the tree has lost is left
// out, as that commit would leave it.
async function workingTreeFiles(): Promise<string[]> {
    const listed = async (...flags: string[]) =>
        (await git(Deno.cwd(), ['ls-files', '-z', ...flags]))
            .split('\0').filter((path) => path !== '');
    const deleted = new Set(await listed('--deleted'));
    return (await listed(
        '--cached', '--others', '--exclude-standard',
    )).filter((path) => !deleted.has(path));
}

// Copy this checkout's whole working tree to DIR, for the
// one script step that reads all of it: lint.
export async function copyWorkingTree(dir: string): Promise<void> {
    copyPresent(dir, await workingTreeFiles());
}

export async function commitAll(
    repo: string, subject: string,
): Promise<void> {
    await git(repo, ['add', '--all']);
    await git(repo, ['commit', '--quiet', '-m', subject]);
}

// Run SCRIPT in the replica under the shell its first
// line names, in an environment that holds nothing but
// what is named here and in ENV. The result cache is
// handed /dev/null for its root and the timer /dev/null
// for its ledger unless ENV names one of the test's own
// (tests/sha-result-cache-isolation.test.ts).
export async function runInReplica(
    repository: Repository,
    script: string,
    args: readonly string[],
    env: Record<string, string>,
): Promise<Run> {
    const output = await new Deno.Command(SHELL, {
        args: [script, ...args],
        cwd: repository.repo,
        clearEnv: true,
        env: {
            PATH: searchPath(),
            SHA_RESULT_CACHE_ROOT: '/dev/null',
            TOOL_DURATIONS_PATH: '/dev/null',
            GIT_CEILING_DIRECTORIES: repository.dir,
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
}

// The first lines of a stand-in `deno`: the timer's own
// two runs go to the real one, so a case that names a
// ledger gets real samples.
export const TIMER_RUNS_FOR_REAL = 'case "$*" in\n'
    + '    *web-app/app/tool-duration.ts*)\n'
    + '        exec "$REAL_DENO" "$@"\n'
    + '        ;;\n'
    + 'esac\n';

// The real `deno`, and what it needs to find its cache
// in an environment that is otherwise cleared.
export function realDeno(): Record<string, string> {
    const env: Record<string, string> = {
        REAL_DENO: Deno.execPath(),
    };
    for (const name of ['HOME', 'DENO_DIR']) {
        const value = Deno.env.get(name);
        if (value !== undefined) {
            env[name] = value;
        }
    }
    return env;
}
