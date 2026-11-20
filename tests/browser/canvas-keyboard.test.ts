import { assertStrictEquals } from '@std/assert';
import { pollUntil } from '../../web-app/app/cdp-client.ts';
import {
    stays, useBrowser, withAdminPage, type Origin, type Page,
} from './fixtures.ts';
import {
    CANVAS, NODE, ONBOARDING,
    edgeCount, flowGraph, nodeCount, nodeIdNamed, openFlow,
} from './canvas.ts';

const browser = useBrowser();

const INSTRUCTIONS = 'prop-node-instructions';
// Each node's place on the canvas, in document order.
const LAYOUT =
    `[...document.querySelectorAll('${NODE}')]`
    + `.map(n => n.getAttribute('transform')).join(';')`;
const SAVE_TIMEOUT_MS = 5_000;
const STAY_MS = 600;

// wrap.querySelectorAll('.flow-node, .flow-edge') returns
// document order, and buildCanvas (flow-graph.ts) emits
// edgeMarkup before nodeMarkup, so every edge precedes
// every node in the tab ring — the first node the ring
// reaches on Customer Onboarding is Archive. Archive and
// Create are special nodes (see canShowPort in
// flow-graph.ts) whose properties panel is a read-only
// form with no #prop-node-name, so only an editable node
// makes "Enter opens the panel" observable. Advance the
// ring to a node id by name instead of to the first node
// reached; the bound is the whole ring so an absent
// target fails loudly instead of hanging.
async function tabToNode(
    page: Page, nodeId: string,
): Promise<void> {
    const bound =
        await nodeCount(page) + await edgeCount(page);
    for (let i = 0; i < bound; i += 1) {
        await page.key('Tab');
        const onTarget = await page.evaluate<boolean>(
            `document.activeElement`
            + `?.closest('[data-node-id]')`
            + `?.getAttribute('data-node-id')`
            + ` === ${JSON.stringify(nodeId)}`,
        );
        if (onTarget) return;
    }
    throw new Error(`Tab never reached node ${nodeId}`);
}

Deno.test('Tab from the canvas enters the ring and marks the node',
async () => {
    await withAdminPage(browser.get(), async (page, origin) => {
        await openFlow(page, origin, ONBOARDING);
        const target = await nodeIdNamed(page, 'Data Capture');
        await page.evaluate(
            `document.querySelector('${CANVAS}').focus()`,
        );
        await tabToNode(page, target);
        const current = await page.until<string>(
            `(() => {
                const a = document.activeElement;
                if (!a || !a.classList.contains('flow-node'))
                    return null;
                return a.getAttribute('aria-current');
            })()`,
            'a focused node',
        );
        assertStrictEquals(current, 'true');
        await page.key('Enter');
        await page.waitFor('#prop-node-name');
        const count = await page.evaluate<number>(
            `document.querySelectorAll(`
            + `'${NODE}[aria-current="true"]').length`,
        );
        assertStrictEquals(count, 1);
    });
});

// Opens Review's panel from the keyboard and puts the
// caret in its Task Instructions.
async function editReviewInstructions(
    page: Page, origin: Origin,
): Promise<{ flowId: string; review: string }> {
    const flowId = await openFlow(page, origin, ONBOARDING);
    const review = await nodeIdNamed(page, 'Review');
    await page.evaluate(
        `document.querySelector('${CANVAS}').focus()`,
    );
    await tabToNode(page, review);
    await page.key('Enter');
    await page.waitFor(`#${INSTRUCTIONS}`);
    await page.evaluate(
        `document.querySelector('#${INSTRUCTIONS}').focus()`,
    );
    return { flowId, review };
}

// Resolves once the node's stored instructions read
// `text`: the panel's save has landed.
function instructionsSaved(
    origin: Origin, flowId: string, nodeId: string,
    text: string,
): Promise<unknown> {
    return pollUntil(
        `instructions saved as ${JSON.stringify(text)}`,
        SAVE_TIMEOUT_MS,
        async () => (await flowGraph(origin, flowId))
            .graph.nodes.find((n) => n.id === nodeId)
            ?.taskInstructions === text,
    );
}

// Customer Onboarding is an Auto Layout flow, and an open
// panel wraps its row in two. The save's own echo reads
// the flow laid out for no canvas; taken for another's
// edit, it would put the nodes back in one row.
Deno.test('a save under an open panel leaves Auto Layout'
+ ' standing', async () => {
    await withAdminPage(browser.get(), async (page, origin) => {
        const { flowId, review } =
            await editReviewInstructions(page, origin);
        const laidOut = await page.evaluate<string>(LAYOUT);
        await page.type('Decide');
        await instructionsSaved(origin, flowId, review, 'Decide');
        await stays(page, LAYOUT, STAY_MS);
        assertStrictEquals(
            await page.evaluate<string>(LAYOUT), laidOut,
        );
    });
});
