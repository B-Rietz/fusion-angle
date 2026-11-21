import { assert, assertEquals } from '@std/assert';

const MODULE_PATH = 'api/mock-data/throwaway-password-hash.ts';
const MODULE_NAME = 'throwaway-password-hash';

function typeScriptFilesUnder(dir: string): string[] {
    const found: string[] = [];
    for (const entry of Deno.readDirSync(dir)) {
        const path = dir + '/' + entry.name;
        if (entry.isDirectory) {
            found.push(...typeScriptFilesUnder(path));
        } else if (entry.name.endsWith('.ts')) {
            found.push(path);
        }
    }
    return found;
}

Deno.test(
    'the throwaway hash stays out of the server',
    () => {
        assert(Deno.statSync(MODULE_PATH).isFile);
        const mentions = [
            ...typeScriptFilesUnder('server'),
            ...typeScriptFilesUnder('api'),
        ].filter((path) => path !== MODULE_PATH)
            .filter((path) => Deno.readTextFileSync(path)
                .includes(MODULE_NAME));
        assertEquals(mentions, []);
    },
);
