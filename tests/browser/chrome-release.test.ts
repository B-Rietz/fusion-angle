import { assertStrictEquals, assertThrows } from '@std/assert';
import {
    CHROME_READY_MS,
    launchChrome,
    waitDevtoolsPort,
} from '../../web-app/app/cdp-client.ts';
import { releaseChrome } from './fixtures.ts';

// An attached run launches no Chrome and may have none it
// could launch, so it has no release to pin.
const ATTACHED = Deno.env.get('CHROME_DEBUG_URL');

// A Chrome still exiting writes into its profile, so the
// profile may go only once the killed Chrome is gone. The
// exit is read the moment the release returns, before the
// event loop turns: only a release that waited for the
// exit has seen it by then.
Deno.test({
    name: 'a released Chrome has exited and left no profile',
    ignore: ATTACHED !== undefined && ATTACHED !== '',
    fn: async () => {
        const userDataDir = Deno.makeTempDirSync({
            prefix: 'fusion-browser-',
        });
        const chrome = launchChrome({ userDataDir });
        let exited = false;
        const exit = chrome.status.then(() => {
            exited = true;
        });
        try {
            await waitDevtoolsPort(
                userDataDir, CHROME_READY_MS,
            );
        } finally {
            await releaseChrome(chrome, userDataDir);
        }
        const exitedOnReturn = exited;
        await exit;
        assertStrictEquals(exitedOnReturn, true);
        assertThrows(
            () => Deno.statSync(userDataDir),
            Deno.errors.NotFound,
        );
    },
});
