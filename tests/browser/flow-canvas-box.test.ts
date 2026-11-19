import {
    assert, assertEquals, assertStrictEquals,
} from '@std/assert';
import { useBrowser, withAdminPage, VIEWPORT } from './fixtures.ts';
import {
    LAYOUT_TEST, ONBOARDING, STATS_WRAP, WRAP, flowGraph,
    nodeSelector, openFlow, openStats,
} from './canvas.ts';
import { pollUntil } from '../../web-app/app/cdp-client.ts';

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

// Below lg the stats bar takes a second row inside the
// header, which keeps the designer's height. At 800 the
// designer's own header outgrows its page (the page scrolls
// sideways and its canvas runs past the window), so the
// canvases are compared where the designer fits.
const TWO_ROW_WINDOWS: ReadonlyArray<{
    size: Size; designerFits: boolean;
}> = [
    { size: { width: 800, height: 700 }, designerFits: false },
    { size: { width: 900, height: 700 }, designerFits: true },
];
type Rows = {
    back: number; badge: number; titleWidth: number;
    barTop: number; wrapRight: number; pageWidth: number;
};
const ROWS_OF = `JSON.stringify((() => {
    const box = (selector) => document.querySelector(selector)
        .getBoundingClientRect();
    return {
        back: box('#flow-stats-back').bottom,
        badge: box('.flow-stats-window-badge').bottom,
        titleWidth: box('.flow-stats-title-block').width,
        barTop: box('.flow-stats-bar').top,
        wrapRight: box('${STATS_WRAP}').right,
        pageWidth: document.documentElement.scrollWidth,
    };
})())`;

Deno.test(
    'below lg the stats header holds two rows in the designer\'s'
    + ' height',
    async () => {
        for (const { size, designerFits } of TWO_ROW_WINDOWS) {
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
                    // The header token's height, as every
                    // pinned window measures it.
                    for (const { box } of PINNED) {
                        assertStrictEquals(
                            stats.header, box.header,
                            `header ${at}`,
                        );
                    }
                    assertStrictEquals(
                        stats.header, designer.header,
                        `header ${at}`,
                    );
                    assert(
                        stats.headerScrollHeight
                            <= stats.headerClientHeight,
                        `header content ${stats.headerScrollHeight}`
                        + ` overflows ${stats.headerClientHeight}`
                        + ` ${at}`,
                    );
                    const rows = JSON.parse(
                        await page.evaluate<string>(ROWS_OF),
                    ) as Rows;
                    assert(
                        rows.titleWidth > 0,
                        `the title has no room ${at}`,
                    );
                    assert(
                        rows.barTop
                            >= Math.max(rows.back, rows.badge),
                        `bar at ${rows.barTop} is not below`
                        + ` row one ${at}`,
                    );
                    assertStrictEquals(
                        rows.pageWidth, size.width,
                        `page width ${at}`,
                    );
                    assert(
                        rows.wrapRight <= size.width,
                        `canvas ends at ${rows.wrapRight} ${at}`,
                    );
                    if (designerFits) {
                        assertStrictEquals(
                            stats.canvasWidth,
                            designer.canvasWidth,
                            `canvas width ${at}`,
                        );
                        assertStrictEquals(
                            stats.canvasHeight,
                            designer.canvasHeight,
                            `canvas height ${at}`,
                        );
                    }
                },
            );
        }
    },
);

// A node deleted after work orders passed through it drops
// out of stats, and the header's title block takes a
// footnote line saying so: the tallest the two-row header
// gets.
const FOOTNOTE_WINDOWS: ReadonlyArray<Size> = [
    { width: 800, height: 700 },
    { width: 1023, height: 700 },
];
const DROPPED = 'Review';
const SAVE_TIMEOUT_MS = 5_000;
// Each of the header's children that runs past its content
// box, the inside of its padding and border, with how far.
// A centred row that overflows spills both ways, which
// scrollHeight does not count above the top.
const HEADER_SPILLS = `JSON.stringify((() => {
    const header = document.querySelector('.flow-stats-header');
    const style = getComputedStyle(header);
    const r = header.getBoundingClientRect();
    const top = r.top + parseFloat(style.borderTopWidth)
        + parseFloat(style.paddingTop);
    const bottom = r.bottom - parseFloat(style.borderBottomWidth)
        - parseFloat(style.paddingBottom);
    return [...header.children].flatMap((child) => {
        const c = child.getBoundingClientRect();
        const name = child.id || child.className;
        return [
            ...(c.top < top ? [name + ' above by ' + (top - c.top)]
                : []),
            ...(c.bottom > bottom
                ? [name + ' below by ' + (c.bottom - bottom)]
                : []),
        ];
    });
})())`;

Deno.test(
    'below lg the stats header holds the dropped-nodes footnote',
    async () => {
        for (const size of FOOTNOTE_WINDOWS) {
            await withAdminPage(
                browser.get(), async (page, origin) => {
                    const flowId = await openFlow(
                        page, origin, ONBOARDING,
                    );
                    const before = await flowGraph(origin, flowId);
                    const node = before.graph.nodes.find(
                        (n) => n.name === DROPPED,
                    );
                    assert(node !== undefined, `no ${DROPPED}`);
                    await page.click(nodeSelector(node.id));
                    await page.click(
                        '[data-action="delete-selected"]',
                    );
                    await pollUntil(
                        `${DROPPED} deleted`, SAVE_TIMEOUT_MS,
                        async () => (await flowGraph(
                            origin, flowId,
                        )).graph.nodes.some((n) => n.id === node.id)
                            ? null
                            : true,
                    );
                    await page.setViewport(
                        size.width, size.height, false,
                    );
                    await openStats(page, origin, flowId);
                    await page.waitFor('.flow-stats-footnote');
                    const stats = JSON.parse(
                        await page.evaluate<string>(STATS_BOX_OF),
                    ) as StatsBox;
                    const at = `${size.width}x${size.height}`;
                    for (const { box } of PINNED) {
                        assertStrictEquals(
                            stats.header, box.header,
                            `header ${at}`,
                        );
                    }
                    assert(
                        stats.headerScrollHeight
                            <= stats.headerClientHeight,
                        `header content ${stats.headerScrollHeight}`
                        + ` overflows ${stats.headerClientHeight}`
                        + ` ${at}`,
                    );
                    assertEquals(
                        JSON.parse(await page.evaluate<string>(
                            HEADER_SPILLS,
                        )),
                        [],
                        `header spills ${at}`,
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
