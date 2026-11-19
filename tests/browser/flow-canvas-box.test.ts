import { assert, assertStrictEquals } from '@std/assert';
import { useBrowser, withAdminPage, VIEWPORT } from './fixtures.ts';
import {
    LAYOUT_TEST, ONBOARDING, STATS_WRAP, WRAP, openFlow,
    openStats,
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

type StatsBox = {
    header: number;
    headerClientHeight: number; headerScrollHeight: number;
    canvasWidth: number; canvasHeight: number;
};

const STATS_BOX_OF = `JSON.stringify({
    header: document.querySelector('.flow-stats-header')
        .offsetHeight,
    headerClientHeight: document.querySelector(
        '.flow-stats-header').clientHeight,
    headerScrollHeight: document.querySelector(
        '.flow-stats-header').scrollHeight,
    canvasWidth: document.querySelector('${STATS_WRAP}')
        .clientWidth,
    canvasHeight: document.querySelector('${STATS_WRAP}')
        .clientHeight,
})`;

Deno.test(
    'the stats canvas measures what the designer canvas measures',
    async () => {
        for (const { size, box } of PINNED) {
            await withAdminPage(
                browser.get(), async (page, origin) => {
                    await page.setViewport(
                        size.width, size.height, false,
                    );
                    const flowId = await openFlow(
                        page, origin, ONBOARDING,
                    );
                    const designer = JSON.parse(
                        await page.evaluate<string>(BOX_OF),
                    ) as Box;
                    await openStats(page, origin, flowId);
                    const stats = JSON.parse(
                        await page.evaluate<string>(STATS_BOX_OF),
                    ) as StatsBox;
                    const at = `${size.width}x${size.height}`;
                    assertStrictEquals(
                        stats.canvasWidth, designer.canvasWidth,
                        `canvas width ${at}`,
                    );
                    assertStrictEquals(
                        stats.canvasHeight, designer.canvasHeight,
                        `canvas height ${at}`,
                    );
                    assertStrictEquals(
                        stats.header, box.header, `header ${at}`,
                    );
                    // The header's height is fixed, so content
                    // too tall for it would spill, not grow it.
                    assert(
                        stats.headerScrollHeight
                            <= stats.headerClientHeight,
                        `header content ${stats.headerScrollHeight}`
                        + ` overflows ${stats.headerClientHeight}`
                        + ` ${at}`,
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
