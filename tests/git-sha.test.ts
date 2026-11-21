import {
    assertEquals,
    assertStrictEquals,
} from '@std/assert';
import {
    commitLogOf,
    embeddedCommit,
    envCommit,
    MERGES_SHOWN,
    parseGitSha,
    parseGitSubject,
    runningCommitFor,
} from '../server/git-sha.ts';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const SECONDS = 1_795_240_408;
const AT = '2026-11-21T05:53:28.000Z';

function mergeSha(index: number): string {
    return index.toString(16).padStart(40, '0');
}

function mergeLine(index: number): string {
    return mergeSha(index) + ' ' + String(SECONDS - index)
        + ' Merge ' + String(index);
}

function mergeOf(index: number): {
    sha: string; subject: string; committedAt: string;
} {
    return {
        sha: mergeSha(index),
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

Deno.test('commitLogOf reads the commit then its merges',
() => {
    assertEquals(
        commitLogOf(
            SHA + ' ' + String(SECONDS) + ' ' + HARD_SUBJECT
            + '\n' + mergeLine(1) + '\n' + mergeLine(2) + '\n',
        ),
        {
            sha: SHA,
            subject: HARD_SUBJECT,
            committedAt: AT,
            merges: [mergeOf(1), mergeOf(2)],
        },
    );
    assertEquals(
        commitLogOf(SHA + ' ' + String(SECONDS) + ' '),
        { sha: SHA, committedAt: AT, merges: [] },
    );
});

Deno.test('commitLogOf keeps ten merges, never the head',
() => {
    const lines = [SHA + ' ' + String(SECONDS) + ' Head'];
    lines.push(SHA + ' ' + String(SECONDS) + ' Head');
    for (let index = 1; index <= MERGES_SHOWN + 1; index++) {
        lines.push(mergeLine(index));
    }
    const commit = commitLogOf(lines.join('\n'));
    assertEquals(
        commit?.merges?.map((merge) => merge.sha),
        Array.from(
            { length: MERGES_SHOWN },
            (_, index) => mergeSha(index + 1),
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
        + HARD_SUBJECT + '\n' + mergeLine(1);
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
            merges: [mergeOf(1)],
        }),
        {
            sha: SHA,
            committedAt: AT,
            merges: [mergeOf(1)],
        },
    );
    assertEquals(
        await runningCommitFor({
            sha: SHA,
            committedAt: 'soon',
            merges: [mergeOf(1), { sha: 'nope' }],
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
                'log', '--merges', '--first-parent',
                '-n', String(MERGES_SHOWN + 1), format, 'HEAD',
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
        { sha: SHA, committedAt: AT, merges: [] },
    );
});
