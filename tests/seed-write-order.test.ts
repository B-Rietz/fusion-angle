import { assert, assertStrictEquals } from '@std/assert';

async function probe(): Promise<{
    digest: string; rows: number;
}> {
    const out = await new Deno.Command('deno', {
        args: ['run', '--frozen', '--allow-read',
            '--allow-env', 'tests/seed-determinism-probe.ts'],
        stdout: 'piped', stderr: 'piped',
    }).output();
    assert(out.success, new TextDecoder().decode(out.stderr));
    return probeResultOf(
        JSON.parse(new TextDecoder().decode(out.stdout)) as unknown,
    );
}

// The probe's line, checked once at the process boundary.
function probeResultOf(parsed: unknown): {
    digest: string; rows: number;
} {
    assert(
        typeof parsed === 'object' && parsed !== null,
        'the probe printed no JSON object',
    );
    const { digest, rows } = parsed as Record<string, unknown>;
    assert(typeof digest === 'string',
        'the probe printed no string digest');
    assert(typeof rows === 'number',
        'the probe printed no numeric rows');
    return { digest, rows };
}

Deno.test('two pinned seeds write identical rows',
async () => {
    const [first, second] = await Promise.all([
        probe(), probe(),
    ]);
    assert(first.rows > 0);
    assertStrictEquals(first.digest, second.digest);
});
