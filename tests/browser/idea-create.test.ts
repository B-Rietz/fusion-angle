import {
    useBrowser, withAdminPage, withHeldRequests,
    type Page, type PausedRequest,
} from './fixtures.ts';
import { registryUrl } from
    '../../web-app/app/browser-drive.ts';

const browser = useBrowser();

// A create is two writes: the idea, then its submission.
// Each failure names its own step, so a report says which
// write was lost.

async function openFilledCreate(
    page: Page, baseUrl: string,
): Promise<void> {
    await page.navigate(registryUrl(baseUrl, 'idea-create'));
    await page.ready('idea-create');
    await page.evaluate(`(() => {
        const fill = (id, value) => {
            document.querySelector('#' + id).value = value;
        };
        fill('idea-create-field-title', 'Lost write');
        fill('idea-create-field-problem', 'p');
        fill('idea-create-field-target', 't');
        fill('idea-create-field-solution', 's');
        fill('idea-create-field-outcome', 'o');
        fill('idea-create-field-metrics', 'm');
        return true;
    })()`);
}

function isSubmissionPut(request: PausedRequest): boolean {
    return request.method === 'PUT'
        && request.url.includes('/submissions/');
}

function isIdeaPut(request: PausedRequest): boolean {
    return request.method === 'PUT'
        && !request.url.includes('/submissions/');
}

async function failedCreateToasts(
    page: Page,
    holds: (request: PausedRequest) => boolean,
    expected: string,
): Promise<void> {
    await withHeldRequests(
        page, '*/ideas/*', holds,
        async (hold) => {
            // The button sits below the 800px fold, out
            // of reach of a compositor click.
            await page.evaluate(
                `document.querySelector(`
                + `'#idea-create-step-next').click()`,
            );
            await hold.fail(await hold.next());
            await page.until(
                `[...document.querySelectorAll(`
                + `'.toast-error')].some(t => t.textContent`
                + `.includes(${JSON.stringify(expected)}))`,
                expected + ' toast',
            );
        },
    );
}

Deno.test(
    'a lost idea write toasts that the idea failed',
    async () => {
        await withAdminPage(
            browser.get(),
            async (page, origin) => {
                await openFilledCreate(page, origin.baseUrl);
                await failedCreateToasts(
                    page, isIdeaPut, 'Failed to create idea',
                );
            },
        );
    },
);

Deno.test(
    'a lost submission write toasts that the idea exists',
    async () => {
        await withAdminPage(
            browser.get(),
            async (page, origin) => {
                await openFilledCreate(page, origin.baseUrl);
                await failedCreateToasts(
                    page, isSubmissionPut,
                    'failed to record its submission',
                );
            },
        );
    },
);
