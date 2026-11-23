import { assert, assertStrictEquals } from '@std/assert';
import {
    getWorkOrders,
    putWorkOrderClaim,
    type RequestContext,
    type WorkOrder,
} from '../../client/index.ts';
import { inPageContext } from '../in-page-facade.ts';
import {
    adminToken,
    useBrowser,
    withAdminPage,
    type Origin,
} from './fixtures.ts';
import { registryUrl } from
    '../../web-app/app/browser-drive.ts';

const browser = useBrowser();

// A seeded Customer Onboarding work order the admin claims
// first, so the claimed list holds a row of the flow.
const DATA_CAPTURE = 'gButmqAicxcpsNuiTYQNKA';
const FLOW = 'Customer Onboarding';
const PILL = `[data-workbox-pill="flow"]`
    + `[data-flow-name="${FLOW}"]`;

// Every row in the left box, placed or not.
const ROWS = `#work-order-lists [data-inbox-list] > .card`;

const ROW_IDS = `JSON.stringify([...document`
    + `.querySelectorAll('${ROWS}')]`
    + `.map(c => c.getAttribute('data-work-order-card')))`;

const ROW_FLOWS = `[...document.querySelectorAll('${ROWS}')]`
    + `.map(c => c.querySelector('.font-semibold')`
    + `.textContent.trim())`;

async function workOrderOf(
    ctx: RequestContext,
    workOrderId: string,
): Promise<WorkOrder> {
    const found = (await getWorkOrders(ctx)).find(
        (wo) => wo.id === workOrderId,
    );
    assert(found !== undefined, workOrderId);
    return found;
}

async function claimedFirst(origin: Origin): Promise<void> {
    const ctx = inPageContext(origin.db, await adminToken());
    await putWorkOrderClaim(
        ctx, await workOrderOf(ctx, DATA_CAPTURE),
    );
}

Deno.test(
    'pressing a flow pill narrows both lists and pressing'
    + ' it again restores them',
    async () => {
        await withAdminPage(browser.get(), async (page, origin) => {
            await claimedFirst(origin);
            await page.navigate(
                registryUrl(origin.baseUrl, 'workbox'),
            );
            await page.ready('workbox');
            await page.waitFor(
                `#claimed-list [data-work-order-card=`
                + `"${DATA_CAPTURE}"]`,
            );
            await page.waitFor(PILL);
            const before = await page.evaluate<string>(ROW_IDS);
            assert(
                await page.evaluate<boolean>(
                    `${ROW_FLOWS}.some(name => name !== `
                    + `${JSON.stringify(FLOW)})`,
                ),
                'another flow is listed before the press',
            );
            const count = await page.evaluate<string>(
                `document.querySelector(${JSON.stringify(PILL)})`
                + `.querySelector('.workbox-pill-count')`
                + `.textContent`,
            );
            const [claimed, total] = count.split('/').map(Number);
            assert(claimed !== undefined && total !== undefined);
            await page.click(PILL);
            assert(await page.until<boolean>(
                `document.querySelector(${JSON.stringify(PILL)})`
                + `?.getAttribute('aria-pressed') === 'true'`,
                'the pill pressed',
            ));
            assert(await page.evaluate<boolean>(
                `[...document.querySelectorAll(`
                + `'[data-workbox-pill]')]`
                + `.filter(p => p.getAttribute('aria-pressed')`
                + ` !== 'true')`
                + `.every(p => p.getAttribute('data-dimmed')`
                + ` === 'true')`,
            ));
            assert(await page.evaluate<boolean>(
                `${ROW_FLOWS}.every(name => name === `
                + `${JSON.stringify(FLOW)})`,
            ));
            assertStrictEquals(
                await page.evaluate<number>(
                    `document.querySelectorAll(`
                    + `'#claimed-list > .card').length`,
                ),
                claimed,
            );
            assertStrictEquals(
                await page.evaluate<number>(
                    `document.querySelectorAll('${ROWS}')`
                    + `.length`,
                ),
                total,
            );
            await page.click(PILL);
            assert(await page.until<boolean>(
                `${ROW_IDS} === ${JSON.stringify(before)}`,
                'today\'s lists',
            ));
            assert(await page.evaluate<boolean>(
                `document.querySelector(${JSON.stringify(PILL)})`
                + `.getAttribute('aria-pressed') === 'false'`,
            ));
        });
    },
);
