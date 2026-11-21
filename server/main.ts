// The one binary. The first argument selects the tool:
// serve | seed | wipe. serve takes no options — the
// NO_ARGUMENTS covenant, restated for the dispatcher.

import type { RunningCommit } from '../shared/system-status.ts';
import { main as serve } from './boot.ts';
import { seedMain } from './postgres-seed.ts';
import { wipeMain } from './postgres-wipe.ts';

export { embeddedCommit } from './git-sha.ts';

const enc = new TextEncoder();

export const USAGE =
    'Usage: fusion-angle serve|seed|wipe\n';

export async function dispatch(
    siteRoot: URL,
    args: readonly string[],
    commit?: RunningCommit,
): Promise<number> {
    const verb = args[0];
    const rest = args.slice(1);
    if (verb === 'serve') {
        return serve(siteRoot, rest, commit);
    }
    if (verb === 'seed') return seedMain(rest);
    if (verb === 'wipe') return wipeMain(rest);
    Deno.stderr.writeSync(enc.encode(USAGE));
    return 2;
}
