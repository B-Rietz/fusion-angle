import { assertEquals, assertThrows } from '@std/assert';
import { join } from '@std/path';
import {
    copyFromCheckout,
    copyPresent,
} from './fixtures/script-replica.ts';

// The working tree is listed, then copied, and a file can
// go in between: /bin/bash 3.2 writes a here-document's
// temp file to the current directory inside the agent
// sandbox and unlinks it at once. A listed path that has
// gone is no longer in the working tree, so its copy is
// passed over. A file a test names is another matter: its
// absence is the test's error.
Deno.test('the working-tree copy passes over a path that has gone',
async () => {
    const dir = await Deno.makeTempDir({ prefix: 'script-replica-' });
    try {
        const gone = 'bin/sh-thd-gone-before-the-copy';
        copyPresent(dir, ['bin/clean-tree-lib', gone, 'deno.json']);
        assertEquals(
            Array.from(Deno.readDirSync(dir), (entry) => entry.name)
                .sort(),
            ['bin', 'deno.json'],
        );
        assertEquals(
            Array.from(
                Deno.readDirSync(join(dir, 'bin')),
                (entry) => entry.name,
            ),
            ['clean-tree-lib'],
        );
        assertThrows(
            () => copyFromCheckout(dir, [gone]),
            Deno.errors.NotFound,
        );
    } finally {
        await Deno.remove(dir, { recursive: true });
    }
});
