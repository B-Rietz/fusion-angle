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
// of its own where the test is about the cache, and
// /dev/null where it is not. In this checkout it is
// /dev/null, where no root can be made: a script that
// reached the operator's cache from here would record a
// stand-in's pass under a real SHA, or replay an earlier
// run's recording, and the test would prove the replay
// instead of the script.
//
// Five of the scripts refuse a dirty tree
// (bin/clean-tree-lib), and this checkout's tree is not a
// test's to keep clean. So a test runs one of those past
// its arguments only in a repository of its own
// (tests/fixtures/script-replica.ts). Here it reaches
// --help and a usage error and nothing else: the script
// answers both before it reads the tree. A spawn of one
// here, by its own path, makes that so: it hands the
// script GIT_DIR=/dev/null, which is no repository, so a
// case that got past the arguments would be refused on
// any tree, clean or not.
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

// The five that refuse a dirty tree, as a spawn names its
// program.
const REFUSES_A_DIRTY_TREE = new RegExp(
    '^\\./(test|deploy)$'
    + '|^(\\./)?bin/(build|test-browser|test-postgres)$',
);

// What a spawn of one of those in this checkout names in
// its env, as /dev/null: no repository, so the script can
// answer from its arguments and from nothing else.
const NO_REPOSITORY = 'GIT_DIR';

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
    // The files that spawn, by its own quoted path, a
    // script that refuses a dirty tree, and each such
    // spawn that leaves it a repository to read.
    readonly refusable: readonly string[];
    readonly unshielded: readonly string[];
};

function walk(): Walk {
    const spawners = new Set<string>();
    const unnamed: string[] = [];
    const refusable = new Set<string>();
    const unshielded: string[] = [];
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
            const named = /^(['"`])(.*)\1$/.exec(spawn[2]!);
            if (named !== null
                && REFUSES_A_DIRTY_TREE.test(named[2]!)) {
                refusable.add(entry.path);
                if (!call.includes(NO_REPOSITORY)) {
                    unshielded.push(
                        `${entry.path}:${line} names no`
                        + ` ${NO_REPOSITORY}`,
                    );
                }
            }
            for (const resource of RESOURCES) {
                if (call.includes(resource)) continue;
                unnamed.push(
                    `${entry.path}:${line} names no ${resource}`,
                );
            }
        }
    }
    return {
        spawners: [...spawners].sort(),
        unnamed: unnamed.sort(),
        refusable: [...refusable].sort(),
        unshielded: unshielded.sort(),
    };
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

Deno.test('a script that refuses a dirty tree is spawned here'
    + ' with no repository to read', () => {
    const { refusable, unshielded } = walk();
    assertEquals(
        unshielded,
        [],
        'Each spawn listed runs, in this checkout, a script that'
        + ' refuses a dirty tree. Name ' + NO_REPOSITORY
        + ' in the env of that call, as /dev/null: --help and a'
        + ' usage error still answer, and anything past the'
        + ' arguments is refused on any tree. To run a script'
        + ' past its arguments, use a repository of the test\'s'
        + ' own: tests/fixtures/script-replica.ts.',
    );
    const known = [
        'tests/deploy-cli.test.ts', 'tests/test-cli.test.ts',
    ];
    assertEquals(
        known.filter((path) => !refusable.includes(path)),
        [],
        'a known spawn of a refusing script is missing from'
        + ' the walk',
    );
});
