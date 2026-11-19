import { assert, assertStrictEquals } from '@std/assert';
import { useBrowser, withAdminPage, VIEWPORT } from './fixtures.ts';
import {
    LAYOUT_TEST, ONBOARDING, WRAP, openFlow,
} from './canvas.ts';

const browser = useBrowser();

// The designer's box as measured on the tree before the
// shared size tokens, in CSS pixels. The arrangement
// wraps by canvas size, so stats must match these.
type Box = {
    header: number; tools: number;
    canvasWidth: number; canvasHeight: number;
};
type Size = { width: number; height: number };
const PINNED: ReadonlyArray<{ size: Size; box: Box }> = [
    {
        size: VIEWPORT,
        box: {
            header: 121, tools: 48,
            canvasWidth: 910, canvasHeight: 549,
        },
    },
    {
        size: { width: 1024, height: 768 },
        box: {
            header: 121, tools: 48,
            canvasWidth: 654, canvasHeight: 517,
        },
    },
];

const BOX_OF = `JSON.stringify({
    header: document.querySelector('.flow-designer-header')
        .offsetHeight,
    tools: document.querySelector('.flow-toolbar').offsetWidth,
    canvasWidth: document.querySelector('${WRAP}').clientWidth,
    canvasHeight: document.querySelector('${WRAP}').clientHeight,
})`;

Deno.test(
    'the designer header, tool column, and canvas keep their size',
    async () => {
        for (const { size, box } of PINNED) {
            await withAdminPage(
                browser.get(), async (page, origin) => {
                    await page.setViewport(
                        size.width, size.height, false,
                    );
                    await openFlow(page, origin, ONBOARDING);
                    const seen = JSON.parse(
                        await page.evaluate<string>(BOX_OF),
                    ) as Box;
                    const at = `${size.width}x${size.height}`;
                    assertStrictEquals(
                        seen.header, box.header, `header ${at}`,
                    );
                    assertStrictEquals(
                        seen.tools, box.tools, `tools ${at}`,
                    );
                    assertStrictEquals(
                        seen.canvasWidth, box.canvasWidth,
                        `canvas width ${at}`,
                    );
                    assertStrictEquals(
                        seen.canvasHeight, box.canvasHeight,
                        `canvas height ${at}`,
                    );
                },
            );
        }
    },
);

// The designer header grows to hold a long flow name, as it
// did before the shared height token: below ~860 px this
// one wraps, and its switches must stay above the canvas.
type DesignerHeader = {
    clientHeight: number; scrollHeight: number;
    autoFitBottom: number; canvasTop: number;
};
const DESIGNER_HEADER_OF = `JSON.stringify((() => {
    const header = document.querySelector(
        '.flow-designer-header');
    return {
        clientHeight: header.clientHeight,
        scrollHeight: header.scrollHeight,
        autoFitBottom: document.querySelector(
            '#flow-auto-fit-switch').getBoundingClientRect()
            .bottom,
        canvasTop: document.querySelector('${WRAP}')
            .getBoundingClientRect().top,
    };
})())`;

Deno.test(
    'the designer header holds a long flow name at 800 px',
    async () => {
        await withAdminPage(
            browser.get(), async (page, origin) => {
                await page.setViewport(800, 700, false);
                await openFlow(page, origin, LAYOUT_TEST);
                const seen = JSON.parse(
                    await page.evaluate<string>(
                        DESIGNER_HEADER_OF,
                    ),
                ) as DesignerHeader;
                assert(
                    seen.scrollHeight <= seen.clientHeight,
                    `header content ${seen.scrollHeight}`
                    + ` overflows ${seen.clientHeight}`,
                );
                assert(
                    seen.autoFitBottom <= seen.canvasTop,
                    `Auto Fit ends at ${seen.autoFitBottom},`
                    + ` under the canvas at ${seen.canvasTop}`,
                );
            },
        );
    },
);
