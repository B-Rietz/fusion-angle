import { assert, assertEquals, assertStrictEquals } from '@std/assert';
import { type Page, startOrigin, useBrowser } from './fixtures.ts';
import {
    PANE_CHROME_PX,
    PANE_COLUMNS,
    PANE_LINE_PX,
    SIDE_BY_SIDE_WIDTH,
} from '../fixtures/api-documentation-pane.ts';
import { registryUrl } from
    '../../web-app/app/browser-drive.ts';

// An example exchange's request and response: side by side
// in panes of one height from SIDE_BY_SIDE_WIDTH up, each
// scrolling inside; stacked below it, every line shown.
// The page never scrolls sideways at any width.

const browser = useBrowser();

const ROOM = '#api-room';
const MESSAGES = ROOM + ' pre.api-doc-message';

// A write whose request body runs past its pane.
const PUT_FLOW = '#put/organizations/id/flows/id';
// A collection whose response runs past its pane.
const FLOWS = '#get/organizations/id/flows';
const VIEWS = [PUT_FLOW, FLOWS];

// Each view's block that runs past its pane: 0 the
// request, 1 the response.
const LONG_BLOCK: Readonly<Record<string, number>> = {
    [PUT_FLOW]: 0,
    [FLOWS]: 1,
};

const HEIGHT = 900;

// Opens the documentation at each view and width, all on
// one origin, the viewport set before the page opens as a
// phone's would be, and hands each page over once its
// exchange is painted.
async function eachExchange(
    hashes: readonly string[],
    widths: readonly number[],
    body: (page: Page, hash: string, width: number) => Promise<void>,
): Promise<void> {
    const origin = await startOrigin();
    try {
        for (const width of widths) {
            for (const hash of hashes) {
                const page = await browser.get().newPage();
                try {
                    await page.setViewport(width, HEIGHT, false);
                    await page.navigate(registryUrl(
                        origin.baseUrl, 'api-documentation',
                    ) + hash);
                    await page.ready('api-documentation');
                    await page.until<string>(
                        `document.querySelectorAll(${
                            JSON.stringify(MESSAGES)
                        }).length >= 2 ? 'painted' : null`,
                        'the exchange\'s request and response',
                    );
                    await body(page, hash, width);
                } finally {
                    await browser.get().disposeContext(page.contextId);
                }
            }
        }
    } finally {
        await origin.close();
    }
}

interface Box {
    readonly top: number;
    readonly bottom: number;
    readonly left: number;
    readonly right: number;
}

interface PaintedBlock {
    readonly box: Box;
    readonly height: string;
    readonly clientHeight: number;
    readonly scrollHeight: number;
    readonly overflowY: string;
}

interface PaintedExchange {
    // The named pane height, as the stylesheet resolves it.
    readonly paneHeight: string;
    readonly facts: Box;
    readonly curl: Box;
    readonly legend: Box;
    readonly request: PaintedBlock;
    readonly response: PaintedBlock;
}

const PAINTED_EXCHANGE = `(() => {
    const boxOf = (element) => {
        const { top, bottom, left, right } =
            element.getBoundingClientRect();
        return { top, bottom, left, right };
    };
    const blockOf = (pre) => {
        const style = getComputedStyle(pre);
        return {
            box: boxOf(pre),
            height: style.height,
            clientHeight: pre.clientHeight,
            scrollHeight: pre.scrollHeight,
            overflowY: style.overflowY,
        };
    };
    const room = document.querySelector('${ROOM}');
    const [request, response] =
        room.querySelectorAll('pre.api-doc-message');
    return {
        paneHeight: getComputedStyle(request)
            .getPropertyValue('--api-doc-pane-height').trim(),
        facts: boxOf(room.querySelector('.api-doc-facts')),
        curl: boxOf(room.querySelector('[data-api-docs-curl]')),
        legend: boxOf(room.querySelector('.api-doc-legend')),
        request: blockOf(request),
        response: blockOf(response),
    };
})()`;

function painted(page: Page): Promise<PaintedExchange> {
    return page.evaluate<PaintedExchange>(PAINTED_EXCHANGE);
}

// Layout rounds a box's edges to a fraction of a pixel.
const EDGE_TOLERANCE = 1;

function near(one: number, other: number): boolean {
    return Math.abs(one - other) <= EDGE_TOLERANCE;
}

Deno.test('from the side-by-side width the request and response'
    + ' sit side by side under the facts and the curl', async () => {
    await eachExchange(VIEWS, [SIDE_BY_SIDE_WIDTH], async (page, hash) => {
        const { facts, curl, legend, request, response } =
            await painted(page);
        const shown = JSON.stringify({
            hash, facts, curl, legend, request, response,
        });
        assert(near(request.box.top, response.box.top), shown);
        assert(request.box.right < response.box.left, shown);
        // One row across the room, under its facts and
        // its curl.
        assert(near(request.box.left, legend.left), shown);
        assert(near(response.box.right, legend.right), shown);
        assert(near(request.box.left, facts.left), shown);
        assert(request.box.top > facts.bottom, shown);
        assert(request.box.top > curl.bottom, shown);
        assert(
            near(
                request.box.right - request.box.left,
                response.box.right - response.box.left,
            ),
            shown,
        );
    });
});

Deno.test('from the side-by-side width both panes take the named'
    + ' height and scroll inside it', async () => {
    await eachExchange(VIEWS, [SIDE_BY_SIDE_WIDTH], async (page, hash) => {
        const { paneHeight, request, response } = await painted(page);
        assert(/^\d+px$/.test(paneHeight), paneHeight);
        for (const block of [request, response]) {
            assertStrictEquals(block.height, paneHeight, hash);
            assertStrictEquals(block.overflowY, 'auto', hash);
        }
        // The long block holds more than its pane shows,
        // and scrolls inside it.
        const index = LONG_BLOCK[hash]!;
        const long = [request, response][index]!;
        assert(long.scrollHeight > long.clientHeight, hash);
        const scrolled = await page.evaluate<number>(`(() => {
            const pre = document.querySelectorAll(
                ${JSON.stringify(MESSAGES)})[${index}];
            pre.scrollTop = ${PANE_LINE_PX};
            return pre.scrollTop;
        })()`);
        assertStrictEquals(scrolled, PANE_LINE_PX, hash);
    });
});

interface PaneMetrics {
    readonly columns: number;
    readonly lineHeight: number;
    readonly chrome: number;
}

// The pane's character width: its content box over one
// character's advance in its font, which is monospaced,
// read off the request's method, which never wraps.
const PANE_METRICS = `(() => {
    const pre = document.querySelector(${JSON.stringify(MESSAGES)});
    const style = getComputedStyle(pre);
    const px = (name) => parseFloat(style.getPropertyValue(name));
    const text = pre.firstChild;
    const method = text.data.indexOf(' ');
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, method);
    const advance = range.getBoundingClientRect().width / method;
    const content = pre.clientWidth
        - px('padding-left') - px('padding-right');
    return {
        columns: Math.floor(content / advance),
        lineHeight: px('line-height'),
        chrome: px('padding-top') + px('padding-bottom')
            + px('border-top-width') + px('border-bottom-width'),
    };
})()`;

Deno.test('the pane holds the characters its height was derived'
    + ' at', async () => {
    await eachExchange([PUT_FLOW], [SIDE_BY_SIDE_WIDTH], async (page) => {
        assertEquals(
            await page.evaluate<PaneMetrics>(PANE_METRICS),
            {
                columns: PANE_COLUMNS,
                lineHeight: PANE_LINE_PX,
                chrome: PANE_CHROME_PX,
            },
        );
    });
});

// Widths below the side-by-side one: the widest, the
// lg two-column view, and a phone.
const STACKED_WIDTHS = [SIDE_BY_SIDE_WIDTH - 1, 1024, 375];

Deno.test('below the side-by-side width the request and response'
    + ' stack and show every line', async () => {
    await eachExchange(VIEWS, STACKED_WIDTHS, async (page, hash, width) => {
        const { request, response } = await painted(page);
        const shown = JSON.stringify({ width, hash, request, response });
        assert(response.box.top > request.box.bottom, shown);
        for (const block of [request, response]) {
            assertStrictEquals(
                block.scrollHeight, block.clientHeight, shown,
            );
        }
    });
});

// Every width the page lays out differently at, and one
// wider than them all.
const EVERY_WIDTH = [
    375, 1024, SIDE_BY_SIDE_WIDTH - 1, SIDE_BY_SIDE_WIDTH, 1920,
];

Deno.test('the page never scrolls sideways', async () => {
    await eachExchange(VIEWS, EVERY_WIDTH, async (page, hash, width) => {
        const widths = await page.evaluate<{
            scroll: number;
            inner: number;
        }>(
            `({ scroll: document.documentElement.scrollWidth,`
            + ` inner: innerWidth })`,
        );
        assert(
            widths.scroll <= widths.inner,
            JSON.stringify({ width, hash, widths }),
        );
    });
});

// A step of the guided start, whose exchanges each run
// curl, legend, then panes, under its prose.
const SIGN_IN = '#start/sign-in';

Deno.test('from the side-by-side width an endpoint shows its'
    + ' facts and its curl side by side in the first view',
async () => {
    await eachExchange(VIEWS, [SIDE_BY_SIDE_WIDTH], async (page, hash) => {
        const { facts, curl } = await painted(page);
        const shown = JSON.stringify({ hash, facts, curl });
        assert(curl.left > facts.right, shown);
        for (const top of [facts.top, curl.top]) {
            assert(top >= 0 && top < HEIGHT, shown);
        }
    });
});

Deno.test('from the side-by-side width a step stands in one'
    + ' column, its curl under its prose', async () => {
    await eachExchange([SIGN_IN], [SIDE_BY_SIDE_WIDTH], async (page) => {
        const { facts, curl } = await painted(page);
        assert(curl.top > facts.bottom, JSON.stringify({ facts, curl }));
    });
});

// The gap between the sample's ids and its curl, beside
// the gap the facts open before each of their sections.
const SECTION_GAPS = `(() => {
    const room = document.querySelector('${ROOM}');
    const ids = room.querySelector('.api-doc-sample ul.api-doc-list');
    const curlHead = room.querySelector('.api-doc-exchange')
        .firstElementChild;
    const section = room.querySelector('.api-doc-facts h2');
    return {
        idsToCurl: curlHead.getBoundingClientRect().top
            - ids.getBoundingClientRect().bottom,
        section: parseFloat(getComputedStyle(section).marginTop),
    };
})()`;

Deno.test('the sample\'s ids stand as far from its curl as the'
    + ' facts\' sections stand apart', async () => {
    const widths = [SIDE_BY_SIDE_WIDTH - 1, SIDE_BY_SIDE_WIDTH];
    await eachExchange([PUT_FLOW], widths, async (page, _hash, width) => {
        const gaps = await page.evaluate<{
            idsToCurl: number;
            section: number;
        }>(SECTION_GAPS);
        assert(gaps.section > 0, JSON.stringify({ width, gaps }));
        assert(
            near(gaps.idsToCurl, gaps.section),
            JSON.stringify({ width, gaps }),
        );
    });
});
