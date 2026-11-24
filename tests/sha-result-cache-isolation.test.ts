import { assertEquals } from '@std/assert';
import { walkSync } from '@std/fs';

// A test that spawns one of the scripts below hands it a
// cache root and a ledger of the test's own:
// SHA_RESULT_CACHE_ROOT and TOOL_DURATIONS_PATH, both, in
// the env of every such spawn. Those are the scripts
// whose steps ask the SHA result cache and are timed into
// the duration ledger, and the scripts that run them.
//
// Beside a repository of its own the root is a directory
// of its own, and the test is about the cache. In this
// checkout it is /dev/null, where no root can be made, so
// the script runs for real on a clean tree and a dirty
// one alike. The checkout's tree is not a test's to keep
// clean, and a script that reached the operator's cache
// from it would record a stand-in's pass under a real
// SHA, or replay an earlier run's recording, and the
// test would prove the replay instead of the script.
//
// The ledger is a file of the test's own where the test
// is about the timer, and /dev/null where it is not,
// which means no ledger: the timer runs the step, runs no
// program of its own, and says nothing. A script that
// reached the operator's ledger would write a stand-in's
// instant pass into it as the recent duration of the real
// step, and the next real run would read as a regression.
//
// The files are read from tests/, never listed, so a
// spawn added tomorrow is held to the rule the day it
// lands. Every `new Deno.Command(` is read by its first
// argument, the program:
//
// - one of the scripts, by its path in any quotes: held;
// - no quoted name at all, but a variable or an
//   expression, which can hold any path: held;
// - a shell, in a file that names one of the scripts'
//   paths anywhere outside a comment, in a string of any
//   kind: held, because the shell can be handed it;
// - any other quoted name, such as git or deno: not held.
//
// A held spawn names both inside its own call. A name in
// a variable beside it does not count: two spawns in one
// test are two calls.
//
// What this cannot see: a spawn reached without `new
// Deno.Command(`, as through an alias; a program that is
// neither a script nor a shell and runs one all the same,
// as `env` or a `deno run` of a program that spawns; a
// shell in a file that builds a script's path from parts
// and never spells it; and what value a name is given.
const RESOURCES = ['SHA_RESULT_CACHE_ROOT', 'TOOL_DURATIONS_PATH'];

// A script's path as source spells it. The two at the
// root are ordinary words without their `./`.
const SCRIPT_PATH = new RegExp(
    '\\./(test|deploy)(?![\\w./-])'
    + '|(?<![\\w-])bin/'
    + '(build|test-browser|test-postgres|measure|develop)'
    + '(?![\\w./-])',
);

const SHELLS = ['sh', 'bash', '/bin/sh', '/bin/bash'];

const SPAWN = /new Deno\.Command(\()\s*([^,\s)]+)/g;

// The source with each comment line blanked, never
// dropped, so every line keeps its number.
function uncommented(src: string): string {
    return src.split('\n')
        .map((line) => line.trimStart().startsWith('//') ? '' : line)
        .join('\n');
}

function canRunAScript(program: string, held: boolean): boolean {
    const quoted = /^(['"`])(.*)\1$/.exec(program);
    if (quoted === null || quoted[2]!.includes('${')) {
        return true;
    }
    return SCRIPT_PATH.test(quoted[2]!)
        || (held && SHELLS.includes(quoted[2]!));
}

// The call that opens at the parenthesis at `from`, to
// the parenthesis that closes it. Quoted text and the
// tail of a line after `//` are passed over whole.
function callText(text: string, from: number): string {
    let depth = 0;
    let quote = '';
    for (let at = from; at < text.length; at += 1) {
        const char = text[at]!;
        if (quote !== '') {
            if (char === '\\') {
                at += 1;
            } else if (char === quote) {
                quote = '';
            }
        } else if (char === "'" || char === '"' || char === '`') {
            quote = char;
        } else if (char === '/' && text[at + 1] === '/') {
            at = text.indexOf('\n', at);
            if (at < 0) break;
        } else if (char === '(') {
            depth += 1;
        } else if (char === ')') {
            depth -= 1;
            if (depth === 0) {
                return text.slice(from, at + 1);
            }
        }
    }
    return text.slice(from);
}

type Walk = {
    readonly spawners: readonly string[];
    readonly unnamed: readonly string[];
};

function walk(): Walk {
    const spawners = new Set<string>();
    const unnamed: string[] = [];
    for (const entry of walkSync('tests', { exts: ['.ts'] })) {
        if (!entry.isFile) continue;
        const text = uncommented(Deno.readTextFileSync(entry.path));
        const held = SCRIPT_PATH.test(text);
        for (const spawn of text.matchAll(SPAWN)) {
            if (!canRunAScript(spawn[2]!, held)) continue;
            spawners.add(entry.path);
            const open = spawn.index + spawn[0].indexOf('(');
            const call = callText(text, open);
            const line = text.slice(0, spawn.index).split('\n').length;
            for (const resource of RESOURCES) {
                if (call.includes(resource)) continue;
                unnamed.push(
                    `${entry.path}:${line} names no ${resource}`,
                );
            }
        }
    }
    return { spawners: [...spawners].sort(), unnamed: unnamed.sort() };
}

Deno.test('every spawned script is handed a root and a ledger',
() => {
    const { spawners, unnamed } = walk();
    assertEquals(
        unnamed,
        [],
        'Each spawn listed can run a build or test script. Name '
        + RESOURCES.join(' and ') + ' in the env of that call:'
        + ' /dev/null in this checkout, or a path of the test\'s'
        + ' own beside a repository of its own.',
    );
    const known = [
        'tests/deploy-cli.test.ts',
        'tests/develop-cli.test.ts',
        'tests/measure-wrapper.test.ts',
        'tests/sha-result-cache.test.ts',
        'tests/test-cli.test.ts',
        'tests/tool-duration-cli.test.ts',
    ];
    assertEquals(
        known.filter((path) => !spawners.includes(path)),
        [],
        'a known spawner is missing from the walk',
    );
});
