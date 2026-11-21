import { assertMatch, assertStrictEquals } from '@std/assert';

type WorktreeAddResult = {
    readonly status: number;
    readonly stdout: string;
    readonly stderr: string;
};

async function runWorktreeAdd(
    args: string[],
): Promise<WorktreeAddResult> {
    const output = await new Deno.Command('./bin/worktree-add', {
        args,
        signal: AbortSignal.timeout(4000),
        stdout: 'piped',
        stderr: 'piped',
    }).output();
    return {
        status: output.code,
        stdout: new TextDecoder().decode(output.stdout),
        stderr: new TextDecoder().decode(output.stderr),
    };
}

Deno.test('worktree-add answers --help with its usage', async () => {
    const result = await runWorktreeAdd(['--help']);
    assertStrictEquals(result.status, 0);
    assertMatch(result.stdout, /Usage: \.\/bin\/worktree-add SLUG/);
});

Deno.test('worktree-add refuses no slug', async () => {
    const result = await runWorktreeAdd([]);
    assertStrictEquals(result.status, 1);
    assertMatch(result.stderr, /Usage:/);
});

Deno.test('worktree-add refuses a second argument', async () => {
    const result = await runWorktreeAdd(['good-slug', '-b']);
    assertStrictEquals(result.status, 1);
    assertMatch(result.stderr, /Usage:/);
});

for (
    const slug of [
        '../escape',
        'nested/slug',
        '-b',
        '--detach',
        'Upper',
        'trailing-',
        '-leading',
        'double--hyphen',
        'dot.slug',
        '',
    ]
) {
    Deno.test(`worktree-add refuses the slug '${slug}'`, async () => {
        const result = await runWorktreeAdd([slug]);
        assertStrictEquals(result.status, 1);
        assertMatch(result.stderr, /SLUG must be lowercase/);
    });
}
