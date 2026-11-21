import {
    assertEquals,
    assertStrictEquals,
} from '@std/assert';
import { fromFileUrl } from '@std/path';
import {
    commitLogOf,
    embeddedCommit,
    envCommit,
    HISTORY_SHOWN,
    parseGitSha,
    parseGitSubject,
    runningCommitFor,
} from '../server/git-sha.ts';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const SECONDS = 1_795_240_408;
const AT = '2026-11-21T05:53:28.000Z';

function historySha(index: number): string {
    return index.toString(16).padStart(40, '0');
}

function historyLine(index: number): string {
    return historySha(index) + ' ' + String(SECONDS - index)
        + ' Merge ' + String(index);
}

function historyOf(index: number): {
    sha: string; subject: string; committedAt: string;
} {
    return {
        sha: historySha(index),
        subject: 'Merge ' + String(index),
        committedAt: new Date(
            (SECONDS - index) * 1_000,
        ).toISOString(),
    };
}

// A subject that would change the program were it spliced
// into source, and that is not ASCII.
const HARD_SUBJECT = `<b>"it's" \\ \${x} é`;

function reader(
    env: Record<string, string>,
): (name: string) => string | undefined {
    return (name) => env[name];
}

function base64Of(text: string): string {
    return btoa(String.fromCharCode(
        ...new TextEncoder().encode(text),
    ));
}

async function gitOutput(args: string[]): Promise<string> {
    const output = await new Deno.Command('git', {
        args,
        stdout: 'piped',
        stderr: 'null',
    }).output();
    assertStrictEquals(output.success, true);
    return new TextDecoder().decode(output.stdout).trim();
}

Deno.test('parseGitSha accepts 40 lowercase hex', () => {
    assertStrictEquals(parseGitSha(SHA), SHA);
    assertStrictEquals(parseGitSha(SHA + '\n'), SHA);
});

Deno.test('parseGitSha rejects other text', () => {
    assertStrictEquals(parseGitSha(''), undefined);
    assertStrictEquals(parseGitSha('nope'), undefined);
    assertStrictEquals(
        parseGitSha(SHA.slice(0, 39)), undefined,
    );
    assertStrictEquals(
        parseGitSha(SHA.toUpperCase()), undefined,
    );
});

Deno.test('parseGitSubject accepts one non-empty line', () => {
    assertEquals(parseGitSubject('Add a thing\n'),
        'Add a thing');
    assertEquals(parseGitSubject(''), undefined);
    assertEquals(parseGitSubject('  \n'), undefined);
    assertEquals(parseGitSubject('one\ntwo'), undefined);
});

Deno.test('commitLogOf reads the commit then its history',
() => {
    assertEquals(
        commitLogOf(
            SHA + ' ' + String(SECONDS) + ' ' + HARD_SUBJECT
            + '\n' + historyLine(1) + '\n' + historyLine(2) + '\n',
        ),
        {
            sha: SHA,
            subject: HARD_SUBJECT,
            committedAt: AT,
            history: [historyOf(1), historyOf(2)],
        },
    );
    assertEquals(
        commitLogOf(SHA + ' ' + String(SECONDS) + ' '),
        { sha: SHA, committedAt: AT, history: [] },
    );
});

Deno.test('commitLogOf keeps ten, never the head',
() => {
    const lines = [SHA + ' ' + String(SECONDS) + ' Head'];
    lines.push(SHA + ' ' + String(SECONDS) + ' Head');
    for (let index = 1; index <= HISTORY_SHOWN + 1; index++) {
        lines.push(historyLine(index));
    }
    const commit = commitLogOf(lines.join('\n'));
    assertEquals(
        commit?.history?.map((entry) => entry.sha),
        Array.from(
            { length: HISTORY_SHOWN },
            (_, index) => historySha(index + 1),
        ),
    );
});

Deno.test('commitLogOf rejects a bad line', () => {
    assertStrictEquals(commitLogOf(''), undefined);
    assertStrictEquals(commitLogOf('nope 1 x'), undefined);
    assertStrictEquals(
        commitLogOf(SHA + ' soon x'), undefined,
    );
    assertEquals(
        commitLogOf(
            SHA + ' ' + String(SECONDS) + ' Head\nnope 1 x',
        ),
        { sha: SHA, subject: 'Head', committedAt: AT },
    );
});

Deno.test('embeddedCommit decodes the log', () => {
    const log = SHA + ' ' + String(SECONDS) + ' '
        + HARD_SUBJECT + '\n' + historyLine(1);
    assertEquals(
        embeddedCommit(base64Of(log)),
        commitLogOf(log),
    );
    assertStrictEquals(embeddedCommit(''), undefined);
});

Deno.test('runningCommitFor judges what it is given',
async () => {
    assertEquals(
        await runningCommitFor({ sha: SHA, subject: 'x' }),
        { sha: SHA, subject: 'x' },
    );
    assertEquals(
        await runningCommitFor({ sha: SHA, subject: '' }),
        { sha: SHA },
    );
    assertEquals(
        await runningCommitFor({ sha: SHA }),
        { sha: SHA },
    );
    assertEquals(
        await runningCommitFor({ sha: 'nope', subject: 'x' }),
        undefined,
    );
    assertEquals(
        await runningCommitFor({
            sha: SHA,
            committedAt: '2026-11-21T13:53:28+08:00',
            history: [historyOf(1)],
        }),
        {
            sha: SHA,
            committedAt: AT,
            history: [historyOf(1)],
        },
    );
    assertEquals(
        await runningCommitFor({
            sha: SHA,
            committedAt: 'soon',
            history: [historyOf(1), { sha: 'nope' }],
        }),
        { sha: SHA },
    );
});

Deno.test('runningCommitFor reads HEAD when given nothing',
async () => {
    const format = '--format=%H %ct %s';
    assertEquals(
        await runningCommitFor(undefined),
        commitLogOf(
            await gitOutput(['log', '-1', format, 'HEAD'])
            + '\n'
            + await gitOutput([
                'log', '--first-parent',
                '-n', String(HISTORY_SHOWN + 1), format, 'HEAD',
            ]),
        ),
    );
});

Deno.test('envCommit reads the log', () => {
    const log = SHA + ' ' + String(SECONDS) + ' x';
    assertEquals(
        envCommit(reader({ GIT_COMMIT_LOG: log })),
        commitLogOf(log),
    );
    assertEquals(envCommit(reader({ GIT_COMMIT_LOG: '' })),
        undefined);
    assertEquals(envCommit(reader({})), undefined);
});

// The env is process-wide, so a child holds the log. In
// this checkout git would answer HEAD's sha: a foreign
// one proves git was not asked.
Deno.test('an env log does not ask git',
async () => {
    const program = 'import { runningCommitFor } from '
        + `'${import.meta.resolve('../server/git-sha.ts')}';\n`
        + 'console.log(JSON.stringify('
        + 'await runningCommitFor(undefined)));\n';
    const inherited = Object.fromEntries(
        ['PATH', 'HOME', 'DENO_DIR'].flatMap((name) => {
            const value = Deno.env.get(name);
            return value === undefined ? [] : [[name, value]];
        }),
    );
    const result = await new Deno.Command('deno', {
        args: [
            'eval', '--frozen', '--config', 'deno.json',
            '--allow-env', '--allow-run=git', program,
        ],
        signal: AbortSignal.timeout(60_000),
        clearEnv: true,
        env: {
            ...inherited,
            GIT_COMMIT_LOG: SHA + ' ' + String(SECONDS),
        },
        stderr: 'inherit',
    }).output();
    assertStrictEquals(result.code, 0);
    assertEquals(
        JSON.parse(new TextDecoder().decode(result.stdout)),
        { sha: SHA, committedAt: AT, history: [] },
    );
});

Deno.test('a direct commit on the first-parent line'
    + ' joins the history',
async () => {
    const repo = await Deno.makeTempDir({
        prefix: 'fusion-git-history-',
    });
    const hermetic = {
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_NOSYSTEM: '1',
    };
    const git = async (...args: string[]): Promise<void> => {
        const output = await new Deno.Command('git', {
            args: [
                '-c', 'user.name=Test',
                '-c', 'user.email=test@example.com',
                ...args,
            ],
            cwd: repo,
            env: hermetic,
            stdout: 'null',
            stderr: 'piped',
        }).output();
        assertStrictEquals(
            output.success, true,
            new TextDecoder().decode(output.stderr),
        );
    };
    const empty = (subject: string): Promise<void> =>
        git('commit', '--quiet', '--allow-empty', '-m', subject);
    try {
        await git('init', '--quiet', '-b', 'main');
        await empty('Base');
        await git('checkout', '--quiet', '-b', 'side');
        await empty('Side');
        await git('checkout', '--quiet', 'main');
        await git(
            'merge', '--quiet', '--no-ff', 'side',
            '-m', 'Merge side',
        );
        await empty('Direct');
        const program = 'import { runningCommitFor } from '
            + `'${import.meta.resolve('../server/git-sha.ts')}';\n`
            + 'console.log(JSON.stringify('
            + 'await runningCommitFor(undefined)));\n';
        const inherited = Object.fromEntries(
            ['PATH', 'HOME', 'DENO_DIR'].flatMap((name) => {
                const value = Deno.env.get(name);
                return value === undefined
                    ? []
                    : [[name, value]];
            }),
        );
        const result = await new Deno.Command('deno', {
            args: [
                'eval', '--frozen', '--config',
                fromFileUrl(import.meta.resolve('../deno.json')),
                '--allow-env', '--allow-run=git', program,
            ],
            cwd: repo,
            signal: AbortSignal.timeout(60_000),
            clearEnv: true,
            env: { ...inherited, ...hermetic },
            stderr: 'inherit',
        }).output();
        assertStrictEquals(result.code, 0);
        const commit = JSON.parse(
            new TextDecoder().decode(result.stdout),
        );
        assertEquals(commit.subject, 'Direct');
        assertEquals(
            commit.history.map(
                (entry: { subject: string }) => entry.subject,
            ),
            ['Merge side', 'Base'],
        );
    } finally {
        await Deno.remove(repo, { recursive: true });
    }
});
