import { assertEquals } from '@std/assert';

// Every operator script lives under bin/ and execs deno
// or a deno-compiled binary; none invokes node, npm, or
// npx, and neither does a file a build reads at the
// repository root: the Dockerfile, compose.yaml, deno.json,
// and deno.lock. The set is read from those two
// directories, never listed, so a wrapper added tomorrow
// is covered the day it lands. Markdown is prose about the
// runtimes and is exempt; directories are other pins'
// trees. A binary file (a null byte) is never decoded as
// text. The match is invocation-shaped: the word at a line
// start or after a shell separator, followed by whitespace
// — `npm:postgres` in the lock and `--exclude-unused-npm`
// in build are not invocations.
const INVOCATION = /(^|[\s|;&(])(node|npm|npx)\s/m;

function operatorFiles(): string[] {
    const names: string[] = [];
    for (const dir of ['.', 'bin']) {
        for (const entry of Deno.readDirSync(dir)) {
            if (!entry.isFile) continue;
            if (entry.name.endsWith('.md')) continue;
            names.push(
                dir === '.' ? entry.name : `bin/${entry.name}`,
            );
        }
    }
    return names.sort();
}

function invokesNode(path: string): boolean {
    const buf = Deno.readFileSync(path);
    if (buf.includes(0)) {
        return false;
    }
    return INVOCATION.test(new TextDecoder().decode(buf));
}

Deno.test('no operator script or build file invokes node, npm,'
    + ' or npx', () => {
    const files = operatorFiles();
    assertEquals(
        files.filter(invokesNode), [],
    );
    assertEquals(
        files.includes('bin/postgres-lib')
        && files.includes('bin/postgres-seed')
        && files.includes('bin/postgres-wipe'),
        true,
        'the three postgres wrappers are in the walk',
    );
    assertEquals(
        ['bin/test', 'bin/deploy', 'Dockerfile', 'compose.yaml']
            .filter((path) => !files.includes(path)),
        [],
        'the moved scripts and the build files are in the walk',
    );
});
