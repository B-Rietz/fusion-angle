import { assert } from '@std/assert';
import {
    useBrowser, withAdminPage, type Origin, type Page,
} from './fixtures.ts';
import { registryUrl } from
    '../../web-app/app/browser-drive.ts';

const browser = useBrowser();
const VIEWPORT_HEIGHT = 800;
// Two inbox columns beside the desktop sidebar, each
// narrower than a card holding a full id.
const TWO_COLUMNS = 900;
const NARROW_PHONE = 320;

const AVAILABLE_CARDS = `document.querySelectorAll(`
    + `'#available-list [data-work-order-card]')`
    + `.length > 0`;

// Desktop emulation at every width: under mobile
// emulation the overflowing page still read 0px here.
async function horizontalOverflow(
    page: Page, origin: Origin, width: number,
): Promise<number> {
    await page.setViewport(width, VIEWPORT_HEIGHT, false);
    await page.navigate(
        registryUrl(origin.baseUrl, 'workbox'),
    );
    await page.ready('workbox');
    await page.until(AVAILABLE_CARDS, 'available cards');
    return page.evaluate<number>(
        `document.documentElement.scrollWidth`
        + ` - innerWidth`,
    );
}

for (const width of [TWO_COLUMNS, NARROW_PHONE]) {
    Deno.test(
        `the inbox fits a ${width}px viewport`,
        async () => {
            await withAdminPage(
                browser.get(),
                async (page, origin) => {
                    const overflow =
                        await horizontalOverflow(
                            page, origin, width,
                        );
                    assert(
                        overflow <= 0,
                        `the page scrolls sideways by`
                        + ` ${overflow}px`,
                    );
                },
            );
        },
    );
}
