import { assertEquals, assertNotEquals } from '@std/assert';

// A subject that would change a shell program were it
// spliced into one unquoted.
const SUBJECT = `It's a "test" $HOME \\ subject`;

// The suite's --allow-run names sh and not bash, so the
// library must parse under POSIX sh.
const FETCHED_COMMIT =
    '. ./bin/build-lib && fetched_commit "$1" "$2"';

// The commit is made from no one's git config, so a
// signing or hook setting cannot reach it.
const HERMETIC_GIT = {
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
};

async function git(args: string[]): Promise<string> {
    const output = await new Deno.Command('git', {
        args,
        env: HERMETIC_GIT,
        stdout: 'piped',
        stderr: 'piped',
    }).output();
    const decoder = new TextDecoder();
    assertEquals(
        output.success, true, decoder.decode(output.stderr),
    );
    return decoder.decode(output.stdout).trim();
}

async function fetchedCommit(
    url: string, sha: string, scratchTmp: string,
): Promise<{ code: number; stdout: string }> {
    const output = await new Deno.Command('sh', {
        args: ['-c', FETCHED_COMMIT, 'sh', url, sha],
        env: { ...HERMETIC_GIT, TMPDIR: scratchTmp },
        stdout: 'piped',
        stderr: 'null',
    }).output();
    return {
        code: output.code,
        stdout: new TextDecoder().decode(output.stdout),
    };
}

Deno.test('fetched_commit reads the commit a URL holds',
async () => {
    const root = await Deno.makeTempDir();
    try {
        const repo = `${root}/repo`;
        const scratchTmp = `${root}/tmp`;
        const empty = `${root}/empty`;
        await Deno.mkdir(scratchTmp);
        await Deno.mkdir(empty);
        await git(['init', '--quiet', repo]);
        await git([
            '-C', repo,
            '-c', 'user.name=Test',
            '-c', 'user.email=test@example.com',
            'commit', '--quiet', '--allow-empty',
            '-m', SUBJECT,
        ]);
        await git([
            '-C', repo, 'config', 'uploadpack.allowFilter',
            'true',
        ]);
        await git([
            '-C', repo, 'config',
            'uploadpack.allowAnySHA1InWant', 'true',
        ]);
        const sha = await git(['-C', repo, 'rev-parse', 'HEAD']);
        const url = `file://${repo}`;

        const held = await fetchedCommit(url, sha, scratchTmp);
        assertEquals(held.code, 0);
        assertEquals(held.stdout, sha + '\n' + SUBJECT + '\n');
        assertEquals([...Deno.readDirSync(scratchTmp)], []);

        const absent = await fetchedCommit(
            url, '0'.repeat(40), scratchTmp,
        );
        assertNotEquals(absent.code, 0);
        assertEquals(absent.stdout, '');
        assertEquals([...Deno.readDirSync(scratchTmp)], []);

        const notRepository = await fetchedCommit(
            `file://${empty}`, sha, scratchTmp,
        );
        assertNotEquals(notRepository.code, 0);
        assertEquals(notRepository.stdout, '');
        assertEquals([...Deno.readDirSync(scratchTmp)], []);
    } finally {
        await Deno.remove(root, { recursive: true });
    }
});
