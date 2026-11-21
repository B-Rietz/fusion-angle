import {
    assertEquals,
    assertStrictEquals,
} from '@std/assert';
import {
    embeddedCommit,
    envCommit,
    parseGitSha,
    parseGitSubject,
    runningCommitFor,
} from '../server/git-sha.ts';

const SHA = '0123456789abcdef0123456789abcdef01234567';

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

Deno.test('embeddedCommit decodes the subject unjudged', () => {
    assertEquals(
        embeddedCommit(SHA, base64Of(HARD_SUBJECT)),
        { sha: SHA, subject: HARD_SUBJECT },
    );
    assertEquals(embeddedCommit(SHA, ''),
        { sha: SHA, subject: '' });
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
});

Deno.test('runningCommitFor reads HEAD when given nothing',
async () => {
    assertEquals(await runningCommitFor(undefined), {
        sha: await gitOutput(['rev-parse', 'HEAD']),
        subject: await gitOutput(
            ['log', '-1', '--format=%s'],
        ),
    });
});

Deno.test('envCommit needs a sha', () => {
    assertEquals(envCommit(reader({ GIT_SHA: SHA })),
        { sha: SHA });
    assertEquals(
        envCommit(reader({ GIT_SHA: SHA, GIT_SUBJECT: 'x' })),
        { sha: SHA, subject: 'x' },
    );
    assertEquals(envCommit(reader({ GIT_SUBJECT: 'x' })),
        undefined);
    assertEquals(envCommit(reader({})), undefined);
});

// The env is process-wide, so a child holds the sha. In
// this checkout git would answer HEAD's subject: an absent
// one proves git was not asked.
Deno.test('an env sha with no subject does not ask git',
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
        env: { ...inherited, GIT_SHA: SHA },
        stderr: 'inherit',
    }).output();
    assertStrictEquals(result.code, 0);
    assertEquals(
        JSON.parse(new TextDecoder().decode(result.stdout)),
        { sha: SHA },
    );
});
