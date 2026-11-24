// Directories of a test file's own, all under one that
// the file makes before its first test and removes after
// its last. A test that fails or throws leaves what it
// made there, and the directory goes all the same:
// nothing the file makes outlives it, even run alone
// under `deno test`, where TMPDIR is the shared one.
//
// Call it once, at the top level of the test file: it
// registers the file's beforeAll and afterAll. Each call
// of what it returns makes a new directory under the
// file's.
export function scratchDirectories(prefix: string): () => string {
    let home = '';
    Deno.test.beforeAll(() => {
        home = Deno.makeTempDirSync({ prefix });
    });
    Deno.test.afterAll(() => {
        Deno.removeSync(home, { recursive: true });
    });
    return () => Deno.makeTempDirSync({ dir: home });
}
