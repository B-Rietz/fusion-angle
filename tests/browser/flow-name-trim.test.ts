import { assertStrictEquals } from '@std/assert';
import { pollUntil } from '../../web-app/app/cdp-client.ts';
import {
    useBrowser, withAdminPage, type Origin, type Page,
} from './fixtures.ts';
import {
    CANVAS, ONBOARDING,
    edgeCount, flowGraph, nodeCount, nodeIdNamed,
    nodeSelector, openFlow,
} from './canvas.ts';

const browser = useBrowser();
const SAVE_TIMEOUT_MS = 5_000;

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

async function openNodeName(
    page: Page, origin: Origin, name: string,
): Promise<{ flowId: string; nodeId: string }> {
    const flowId = await openFlow(
        page, origin, ONBOARDING,
    );
    const nodeId = await nodeIdNamed(page, name);
    await page.evaluate(
        `document.querySelector('${CANVAS}').focus()`,
    );
    await tabToNode(page, nodeId);
    await page.key('Enter');
    await page.waitFor('#prop-node-name');
    return { flowId, nodeId };
}

function commitName(
    page: Page, value: string, caret: number,
): Promise<unknown> {
    return page.evaluate(
        `(() => {
            const input = document.querySelector(
                '#prop-node-name');
            input.focus();
            input.value = ${JSON.stringify(value)};
            input.setSelectionRange(${caret}, ${caret});
            input.dispatchEvent(new Event(
                'input', { bubbles: true }));
        })()`,
    );
}

function nameIs(
    value: string, caret: number,
): string {
    return `(() => {
        const input = document.querySelector(
            '#prop-node-name');
        return !!input
            && input.value === ${JSON.stringify(value)}
            && input.selectionStart === ${caret}
            && input.selectionEnd === ${caret}
            && document.activeElement === input;
    })()`;
}

async function canvasName(
    page: Page, nodeId: string,
): Promise<string | null> {
    return await page.evaluate<string | null>(
        `document.querySelector(${
            JSON.stringify(nodeSelector(nodeId))
        }).getAttribute('aria-label')`,
    );
}

Deno.test(
    'pausing on a name plus a trailing space keeps'
    + ' the stored name and clears the space',
    async () => {
        await withAdminPage(
            browser.get(),
            async (page, origin) => {
                const { flowId, nodeId } =
                    await openNodeName(
                        page, origin, 'Review',
                    );
                await commitName(page, 'Review ', 7);
                await page.until(
                    nameIs('Review', 6),
                    'trailing space collapsed',
                );
                assertStrictEquals(
                    await canvasName(page, nodeId),
                    'Review',
                );
                const stored = (await flowGraph(
                    origin, flowId,
                )).graph.nodes.find(
                    (n) => n.id === nodeId,
                );
                assertStrictEquals(stored?.name, 'Review');
            },
        );
    },
);

Deno.test(
    'a name whose trim changes it is written back'
    + ' with the caret on the same character',
    async () => {
        await withAdminPage(
            browser.get(),
            async (page, origin) => {
                const { flowId, nodeId } =
                    await openNodeName(
                        page, origin, 'Review',
                    );
                // "  Reviewed  ", caret before the v.
                await commitName(
                    page, '  Reviewed  ', 4,
                );
                await page.until(
                    nameIs('Reviewed', 2),
                    'trimmed name and caret',
                );
                assertStrictEquals(
                    await canvasName(page, nodeId),
                    'Reviewed',
                );
                await pollUntil(
                    'trimmed name saved',
                    SAVE_TIMEOUT_MS,
                    async () => {
                        const node = (await flowGraph(
                            origin, flowId,
                        )).graph.nodes.find(
                            (n) => n.id === nodeId,
                        );
                        return node?.name === 'Reviewed'
                            ? true : null;
                    },
                );
            },
        );
    },
);
