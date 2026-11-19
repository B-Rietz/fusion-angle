import {
    assert, assertAlmostEquals, assertEquals, assertNotEquals,
    assertStrictEquals,
} from '@std/assert';
import {
    VIEWPORT, stays, useBrowser, withAdminPage, withHeldRequests,
    type Origin, type Page, type Point,
} from './fixtures.ts';
import {
    CANVAS, ONBOARDING, STATS_CANVAS, STATS_WRAP, WRAP, WRAPPING,
    flowGraph, flowIdNamed, nodeSelector, openFlow, openStats,
    type GraphNode,
} from './canvas.ts';
import { registryUrl } from
    '../../web-app/app/browser-drive.ts';
import { pollUntil } from
    '../../web-app/app/cdp-client.ts';
import { MIN_ZOOM } from '../../web-app/app/flow-camera.ts';

const browser = useBrowser();
const CARD_HOLD_MS = 500;
const CARD_SHOWN = `!document.querySelector(`
    + `'#flow-stats-card').classList.contains('hidden')`;
const SAVE_TIMEOUT_MS = 5_000;
// Long enough for a request the page sends to reach a hold.
const QUIET_MS = 500;
const RESIZED = { width: 1000, height: 700 };
// getBBox answers in float32, so two fits of one flow can
// differ in the last places.
const VIEWBOX_TOLERANCE = 0.01;
// Over the sidebar: off every state, and off the canvas.
const AWAY: Point = { x: 5, y: 5 };
const NEXT_PATH = '[data-stepper="next"]';
const STATS_VIEWBOX = `document.querySelector('${STATS_CANVAS}')`
    + `.getAttribute('viewBox')`;
// What each grid rect covers, written as a viewBox is.
const GRID_VIEWS = `JSON.stringify([...document.querySelectorAll(
    '${STATS_CANVAS} .flow-stats-grid-bg,'
    + ' ${STATS_CANVAS} .flow-stats-grid-dots')].map((rect) =>
        ['x', 'y', 'width', 'height'].map(
            (name) => rect.getAttribute(name)).join(' ')))`;
const PATH_LABEL = `document.querySelector(`
    + `'.flow-stats-stepper-label').textContent`;
const ON_PATH_2 = `${PATH_LABEL}.startsWith('Path 2 of')`;

// Where each state sits and how each edge runs, by id.
type Placement = {
    nodes: Record<string, string>;
    edges: Record<string, string>;
};

const DESIGNER_PLACEMENT = `JSON.stringify({
    nodes: Object.fromEntries([...document.querySelectorAll(
        '${CANVAS} [data-node-id]')].map((g) => [
            g.getAttribute('data-node-id'),
            g.getAttribute('transform')])),
    edges: Object.fromEntries([...document.querySelectorAll(
        '${CANVAS} [data-edge-ref]')].map((g) => [
            g.getAttribute('data-edge-ref'),
            g.querySelector('path[marker-end]')
                .getAttribute('d')])),
})`;
const STATS_PLACEMENT = `JSON.stringify({
    nodes: Object.fromEntries([...document.querySelectorAll(
        '${STATS_CANVAS} [data-node-id]')].map((g) => [
            g.getAttribute('data-node-id'),
            g.getAttribute('transform')])),
    edges: Object.fromEntries([...document.querySelectorAll(
        '${STATS_CANVAS} [data-edge-id]')].map((g) => [
            g.getAttribute('data-edge-id'),
            g.querySelector('.flow-stats-edge-path')
                .getAttribute('d')])),
})`;

async function placement(
    page: Page, expression: string,
): Promise<Placement> {
    return JSON.parse(
        await page.evaluate<string>(expression),
    ) as Placement;
}

// The grid's rects cover exactly what the canvas shows.
async function assertGridCoversView(page: Page): Promise<void> {
    const view = await page.evaluate<string>(STATS_VIEWBOX);
    assertEquals(
        JSON.parse(await page.evaluate<string>(GRID_VIEWS)),
        [view, view],
    );
}

async function viewBoxOf(
    page: Page, svg: string,
): Promise<number[]> {
    const viewBox = await page.evaluate<string>(
        viewBoxExpression(svg),
    );
    return viewBox.split(' ').map(Number);
}

function viewBoxExpression(svg: string): string {
    return `document.querySelector('${svg}')`
        + `.getAttribute('viewBox')`;
}

function assertSameFrame(
    stats: number[], designer: number[], label: string,
): void {
    assertStrictEquals(stats.length, 4, label);
    for (const [i, value] of stats.entries()) {
        assertAlmostEquals(
            value, designer[i]!, VIEWBOX_TOLERANCE,
            `${label} viewBox ${stats} vs ${designer}`,
        );
    }
}

function transformOf(node: GraphNode): string {
    return `translate(${node.positionX}, ${node.positionY})`;
}

function statsNode(nodeId: string): string {
    return `${STATS_CANVAS} [data-node-id="${nodeId}"]`;
}

async function nodeNamed(
    origin: Origin, flowId: string, name: string,
): Promise<GraphNode> {
    const node = (await flowGraph(origin, flowId))
        .graph.nodes.find((n) => n.name === name);
    assert(node, `no state named ${name}`);
    return node;
}

type StoredFlow = Awaited<ReturnType<typeof flowGraph>>;

// The designer saves on a debounce; the origin's own store
// says when the write has landed.
function stored(
    origin: Origin, flowId: string,
    landed: (flow: StoredFlow) => boolean, label: string,
): Promise<StoredFlow> {
    return pollUntil(label, SAVE_TIMEOUT_MS, async () => {
        const flow = await flowGraph(origin, flowId);
        return landed(flow) ? flow : null;
    });
}

Deno.test('a hovered stats node keeps its card open',
async () => {
    await withAdminPage(browser.get(), async (page, origin) => {
        const flowId = await flowIdNamed(origin, ONBOARDING);
        const review = (await flowGraph(origin, flowId))
            .graph.nodes.find((n) => n.name === 'Review');
        assert(review);
        await page.navigate(registryUrl(
            origin.baseUrl, 'flow-stats', `flowId=${flowId}`,
        ));
        await page.ready('flow-stats');
        const node = `#flow-stats [data-node-id="${review.id}"]`;
        await page.waitFor(node);
        const r = await page.rect(node);
        const at = { x: r.x + r.width * 0.75,
            y: r.y + r.height / 2 };
        await page.hover(at);
        await page.until(CARD_SHOWN, 'card shown');
        assertStrictEquals(await page.evaluate<string | null>(
            `document.elementFromPoint(${at.x}, ${at.y})`
            + `?.closest('[data-node-id]')`
            + `?.getAttribute('data-node-id') ?? null`,
        ), review.id);
        await stays(page, CARD_SHOWN, CARD_HOLD_MS);
    });
});

Deno.test('stats lays the flow out as the designer does',
async () => {
    for (const name of [ONBOARDING, WRAPPING]) {
        await withAdminPage(browser.get(), async (page, origin) => {
            const flowId = await openFlow(page, origin, name);
            assertStrictEquals(
                (await flowGraph(origin, flowId)).is_auto_layout,
                true, `${name} lays itself out`,
            );
            const designer = await placement(
                page, DESIGNER_PLACEMENT,
            );
            await openStats(page, origin, flowId);
            const stats = await placement(page, STATS_PLACEMENT);
            assert(
                Object.keys(designer.nodes).length > 0,
                `${name} draws no states`,
            );
            assert(
                Object.keys(designer.edges).length > 0,
                `${name} draws no edges`,
            );
            assertEquals(stats.nodes, designer.nodes, name);
            assertEquals(stats.edges, designer.edges, name);
        });
    }
});

Deno.test('with Auto Fit on, stats frames the flow as the'
+ ' designer does', async () => {
    for (const name of [ONBOARDING, WRAPPING]) {
        await withAdminPage(browser.get(), async (page, origin) => {
            const flowId = await openFlow(page, origin, name);
            assertStrictEquals(
                (await flowGraph(origin, flowId)).is_auto_fit,
                true, `${name} fits itself`,
            );
            const designer = await viewBoxOf(page, CANVAS);
            await openStats(page, origin, flowId);
            const stats = await viewBoxOf(page, STATS_CANVAS);
            assertSameFrame(stats, designer, name);
            await assertGridCoversView(page);
        });
    }
});

// The canvas's viewBox once the page, laid out at load,
// has settled and then fitted itself to the RESIZED window.
async function viewBoxAfterResize(
    page: Page, svg: string,
): Promise<number[]> {
    const expression = viewBoxExpression(svg);
    await stays(page, expression, QUIET_MS);
    const loaded = await page.evaluate<string>(expression);
    await page.setViewport(RESIZED.width, RESIZED.height, false);
    await page.until(
        `${expression} !== ${JSON.stringify(loaded)}`,
        `${svg} refitted`,
    );
    await stays(page, expression, QUIET_MS);
    return viewBoxOf(page, svg);
}

// Each page lays the flow out at load, at the default
// window; a resize keeps that arrangement and refits. A
// page loaded after the resize would lay out afresh.
Deno.test('with Auto Fit on, stats refits a resize as the'
+ ' designer does', async () => {
    for (const name of [ONBOARDING, WRAPPING]) {
        await withAdminPage(browser.get(), async (page, origin) => {
            const flowId = await openFlow(page, origin, name);
            assertStrictEquals(
                (await flowGraph(origin, flowId)).is_auto_fit,
                true, `${name} fits itself`,
            );
            const designer = await viewBoxAfterResize(page, CANVAS);
            await page.setViewport(
                VIEWPORT.width, VIEWPORT.height, false,
            );
            await openStats(page, origin, flowId);
            const stats = await viewBoxAfterResize(
                page, STATS_CANVAS,
            );
            assertSameFrame(stats, designer, name);
            await assertGridCoversView(page);
        });
    }
});

// The designer neither lays out a locked flow nor routes its
// edges round states, nor fits its connection ports. A
// window wide enough that the designer's fit of the locked
// flow does not crop at its least zoom, where stats would
// show the whole flow smaller.
const WIDE = { width: 1920, height: 1080 };

Deno.test('stats shows a locked flow as the designer does',
async () => {
    await withAdminPage(browser.get(), async (page, origin) => {
        await page.setViewport(WIDE.width, WIDE.height, false);
        const flowId = await openFlow(page, origin, WRAPPING);
        const unlocked = await placement(page, DESIGNER_PLACEMENT);
        await page.click('#flow-lock-switch');
        await stored(
            origin, flowId, (flow) => flow.is_locked,
            'lock saved',
        );
        await openFlow(page, origin, WRAPPING);
        const designer = await placement(page, DESIGNER_PLACEMENT);
        assertNotEquals(designer, unlocked, 'the lock shows nothing');
        const designerView = await viewBoxOf(page, CANVAS);
        const canvasWidth = await page.evaluate<number>(
            `document.querySelector('${WRAP}').clientWidth`,
        );
        assert(
            canvasWidth / designerView[2]! > MIN_ZOOM,
            `the designer crops at ${designerView}`,
        );
        await openStats(page, origin, flowId);
        const stats = await placement(page, STATS_PLACEMENT);
        assertEquals(stats.nodes, designer.nodes);
        assertEquals(stats.edges, designer.edges);
        assertSameFrame(
            await viewBoxOf(page, STATS_CANVAS), designerView,
            WRAPPING,
        );
    });
});

Deno.test('with Auto Fit off, stats opens at the designer\'s'
+ ' opening view', async () => {
    await withAdminPage(browser.get(), async (page, origin) => {
        const flowId = await openFlow(page, origin, ONBOARDING);
        await page.click('#flow-auto-fit-switch');
        await stored(
            origin, flowId, (flow) => !flow.is_auto_fit,
            'Auto Fit off saved',
        );
        await openFlow(page, origin, ONBOARDING);
        const designer = await viewBoxOf(page, CANVAS);
        await openStats(page, origin, flowId);
        const stats = await viewBoxOf(page, STATS_CANVAS);
        assertEquals(stats, designer);
        const [w, h] = await page.evaluate<[number, number]>(
            `[document.querySelector('${STATS_WRAP}').clientWidth,`
            + ` document.querySelector('${STATS_WRAP}')`
            + `.clientHeight]`,
        );
        assertEquals(stats, [-w / 2, -h / 2, w, h]);
    });
});

Deno.test('with Auto Layout off, every node sits at its stored'
+ ' position', async () => {
    await withAdminPage(browser.get(), async (page, origin) => {
        const flowId = await openFlow(page, origin, ONBOARDING);
        await page.click('#flow-auto-layout-switch');
        const laidOut = await stored(
            origin, flowId, (flow) => !flow.is_auto_layout,
            'Auto Layout off saved',
        );
        // A hand-placed state sits where no layout puts it.
        const review = laidOut.graph.nodes.find(
            (n) => n.name === 'Review',
        );
        assert(review);
        const from = await page.center(nodeSelector(review.id));
        await page.drag(from, { x: from.x + 60, y: from.y + 40 });
        await stored(
            origin, flowId,
            (flow) => flow.graph.nodes.some((n) =>
                n.id === review.id
                && transformOf(n) !== transformOf(review)),
            'hand-placed Review saved',
        );
        await openStats(page, origin, flowId);
        const stats = await placement(page, STATS_PLACEMENT);
        const flow = await flowGraph(origin, flowId);
        assertStrictEquals(flow.is_auto_layout, false);
        assertEquals(stats.nodes, Object.fromEntries(
            flow.graph.nodes.map((n) => [n.id, transformOf(n)]),
        ));
        assertNotEquals(
            stats.nodes[review.id], transformOf(review),
        );
    });
});

Deno.test('a resize keeps every node where it was', async () => {
    await withAdminPage(browser.get(), async (page, origin) => {
        const flowId = await flowIdNamed(origin, ONBOARDING);
        const review = await nodeNamed(origin, flowId, 'Review');
        await openStats(page, origin, flowId);
        await page.click(NEXT_PATH);
        await page.until(ON_PATH_2, 'path 2 selected');
        const node = statsNode(review.id);
        await page.hover(await page.center(node));
        await page.click(node);
        await page.hover(AWAY);
        await page.until(CARD_SHOWN, 'card pinned');
        const before = await placement(page, STATS_PLACEMENT);
        const viewBox = await page.evaluate<string>(STATS_VIEWBOX);
        // The card's anchor, and its state's centre in the
        // canvas area: the card sits beside its state.
        const anchors = `(() => {
            const area = document.querySelector(
                '.flow-stats-canvas-area').getBoundingClientRect();
            const g = document.querySelector(
                ${JSON.stringify(node)}).getBoundingClientRect();
            const card = document.querySelector('#flow-stats-card');
            return JSON.stringify({
                card: [
                    card.style.getPropertyValue('--card-x'),
                    card.style.getPropertyValue('--card-y'),
                ],
                node: [
                    String(Math.round(
                        g.left + g.width / 2 - area.left)),
                    String(Math.round(
                        g.top + g.height / 2 - area.top)),
                ],
            });
        })()`;
        type Anchors = { card: string[]; node: string[] };
        const pinned = JSON.parse(
            await page.evaluate<string>(anchors),
        ) as Anchors;
        assertEquals(pinned.card, pinned.node);
        await withHeldRequests(
            page, '*/api/*', () => true, async (hold) => {
                await page.setViewport(
                    RESIZED.width, RESIZED.height, false,
                );
                await page.until(
                    `${STATS_VIEWBOX} !== ${
                        JSON.stringify(viewBox)}`,
                    'viewBox changed',
                );
                await stays(page, STATS_VIEWBOX, QUIET_MS);
                assertStrictEquals(
                    hold.heldCount(), 0,
                    'requests during the resize',
                );
            },
        );
        assertEquals(
            await placement(page, STATS_PLACEMENT), before,
        );
        assertStrictEquals(
            await page.evaluate<boolean>(ON_PATH_2), true,
        );
        assertStrictEquals(
            await page.evaluate<boolean>(CARD_SHOWN), true,
        );
        await assertGridCoversView(page);
        const resized = JSON.parse(
            await page.evaluate<string>(anchors),
        ) as Anchors;
        assertEquals(resized.card, resized.node);
        assertNotEquals(resized.node, pinned.node);
    });
});

Deno.test('stats writes nothing', async () => {
    await withAdminPage(browser.get(), async (page, origin) => {
        const flowId = await flowIdNamed(origin, ONBOARDING);
        const review = await nodeNamed(origin, flowId, 'Review');
        const node = statsNode(review.id);
        await withHeldRequests(
            page, '*/flows/*',
            (request) => request.method !== 'GET',
            async (hold) => {
                await openStats(page, origin, flowId);
                await page.click(NEXT_PATH);
                await page.until(ON_PATH_2, 'path 2 selected');
                await page.click(node);
                await page.until(CARD_SHOWN, 'card pinned');
                await page.click(node);
                await page.hover(AWAY);
                await page.until(
                    `!(${CARD_SHOWN})`, 'card unpinned',
                );
                const viewBox = await page.evaluate<string>(
                    STATS_VIEWBOX,
                );
                await page.setViewport(
                    RESIZED.width, RESIZED.height, false,
                );
                await page.until(
                    `${STATS_VIEWBOX} !== ${
                        JSON.stringify(viewBox)}`,
                    'viewBox changed',
                );
                await stays(page, STATS_VIEWBOX, QUIET_MS);
                assertStrictEquals(
                    hold.heldCount(), 0, 'held writes',
                );
            },
        );
    });
});

// The bar's label, its hover text, and the same text as
// assistive technology hears it.
type BarText = { label: string; title: string; detail: string };
const BAR_TEXT = `JSON.stringify({
    label: ${PATH_LABEL},
    title: document.querySelector('.flow-stats-bar')
        .getAttribute('title'),
    detail: document.querySelector('#flow-stats-path-detail')
        .textContent,
})`;

Deno.test('the bar\'s hover text follows the selected path',
async () => {
    await withAdminPage(browser.get(), async (page, origin) => {
        const flowId = await flowIdNamed(origin, ONBOARDING);
        await openStats(page, origin, flowId);
        const first = JSON.parse(
            await page.evaluate<string>(BAR_TEXT),
        ) as BarText;
        await page.click(NEXT_PATH);
        await page.until(ON_PATH_2, 'path 2 selected');
        const second = JSON.parse(
            await page.evaluate<string>(BAR_TEXT),
        ) as BarText;
        for (const bar of [first, second]) {
            // "Path 2 of 3 · 15%" is told as "15% of …".
            const share = bar.label.split(' · ')[1];
            assert(share, `no share in ${bar.label}`);
            assert(
                bar.title.startsWith(`${share} of `),
                `${bar.title} is not ${bar.label}'s`,
            );
            assertStrictEquals(bar.detail, bar.title);
        }
        assertNotEquals(second.title, first.title);
    });
});

const NARROW_DESKTOP = { width: 1024, height: 768 };
// What sits at a point: the back button, the bar, or neither.
function controlAt(x: string, y: string): string {
    return `(() => {
        const el = document.elementFromPoint(${x}, ${y});
        if (el === null) return 'nothing';
        if (el.closest('#flow-stats-back')) return 'back';
        if (el.closest('.flow-stats-bar')) return 'bar';
        return 'other';
    })()`;
}

Deno.test('at 1024x768 the header keeps its back button and its'
+ ' whole bar', async () => {
    await withAdminPage(browser.get(), async (page, origin) => {
        await page.setViewport(
            NARROW_DESKTOP.width, NARROW_DESKTOP.height, false,
        );
        const flowId = await openFlow(page, origin, ONBOARDING);
        const designerBack = await page.rect('#flow-back-btn');
        await openStats(page, origin, flowId);
        const back = await page.rect('#flow-stats-back');
        assertStrictEquals(back.width, designerBack.width);
        assertStrictEquals(await page.evaluate<string>(controlAt(
            String(back.x + back.width / 2),
            String(back.y + back.height / 2),
        )), 'back');
        // Each end of the bar is on screen and uncovered,
        // whichever path it names.
        for (const label of ['Path 1 of', 'Path 2 of', 'Path 3 of']) {
            await page.until(
                `${PATH_LABEL}.startsWith(${JSON.stringify(label)})`,
                label,
            );
            const bar = await page.rect('.flow-stats-bar');
            const midY = String(bar.y + bar.height / 2);
            for (const x of [bar.x + 1, bar.x + bar.width - 1]) {
                assertStrictEquals(
                    await page.evaluate<string>(
                        controlAt(String(x), midY),
                    ),
                    'bar', `${label} at x ${x}`,
                );
            }
            if (label !== 'Path 3 of') await page.click(NEXT_PATH);
        }
    });
});

// Each part of the bar, end to end, that is not on screen,
// not inside the header, or not the element at its own
// centre: the bar's parts that are out of reach. A disabled
// arrow takes no pointer, so the bar behind it answers.
const BAR_PARTS_OUT_OF_REACH = `JSON.stringify((() => {
    const header = document.querySelector('.flow-stats-header')
        .getBoundingClientRect();
    const parts = [...document.querySelectorAll(
        '.flow-stats-bar, .flow-stats-bar [data-stepper],'
        + ' .flow-stats-stepper-label, .flow-stats-legend-end,'
        + ' .flow-stats-legend-bar')];
    return parts.flatMap((part) => {
        const r = part.getBoundingClientRect();
        const name = part.dataset.stepper ?? part.className;
        const inside = (box) => r.left >= box.left
            && r.right <= box.right && r.top >= box.top
            && r.bottom <= box.bottom;
        const hit = document.elementFromPoint(
            r.left + r.width / 2, r.top + r.height / 2);
        const answers = part.matches(':disabled')
            ? part.closest('.flow-stats-bar')
            : part;
        return [
            ...(inside({ left: 0, top: 0,
                right: innerWidth, bottom: innerHeight })
                ? [] : [name + ' off screen']),
            ...(inside(header) ? [] : [name + ' outside header']),
            ...(hit !== null && answers.contains(hit)
                ? [] : [name + ' covered']),
        ];
    });
})())`;

const NARROW_WINDOWS = [
    NARROW_DESKTOP,
    { width: 800, height: 700 },
    { width: 375, height: 800 },
];

Deno.test('below xl the whole bar fits in the header',
async () => {
    for (const size of NARROW_WINDOWS) {
        await withAdminPage(browser.get(), async (page, origin) => {
            await page.setViewport(size.width, size.height, false);
            await openStats(
                page, origin, await flowIdNamed(origin, ONBOARDING),
            );
            for (const label of ['Path 1 of', 'Path 2 of',
                'Path 3 of']) {
                await page.until(
                    `${PATH_LABEL}.startsWith(${
                        JSON.stringify(label)})`,
                    label,
                );
                assertEquals(
                    JSON.parse(await page.evaluate<string>(
                        BAR_PARTS_OUT_OF_REACH,
                    )),
                    [],
                    `${label} at ${size.width}x${size.height}`,
                );
                if (label !== 'Path 3 of') {
                    await page.click(NEXT_PATH);
                }
            }
        });
    }
});

const WIDE_DESKTOP = { width: 1280, height: 800 };
type Caption = {
    text: string; width: number; height: number; seen: boolean;
};
const CAPTION = `JSON.stringify((() => {
    const caption = document.querySelector(
        '.flow-stats-legend-caption');
    const r = caption.getBoundingClientRect();
    const hit = document.elementFromPoint(
        r.left + r.width / 2, r.top + r.height / 2);
    return {
        text: caption.textContent,
        width: r.width,
        height: r.height,
        seen: hit !== null && caption.contains(hit),
    };
})())`;

Deno.test('the bar\'s caption is seen at xl and only heard'
+ ' below it', async () => {
    await withAdminPage(browser.get(), async (page, origin) => {
        const flowId = await flowIdNamed(origin, ONBOARDING);
        await page.setViewport(
            WIDE_DESKTOP.width, WIDE_DESKTOP.height, false,
        );
        await openStats(page, origin, flowId);
        const wide = JSON.parse(
            await page.evaluate<string>(CAPTION),
        ) as Caption;
        assertStrictEquals(wide.text, 'share of flow time');
        assert(wide.seen, 'caption not seen at xl');
        assert(wide.width > 1, `caption ${wide.width}px wide`);
        await page.setViewport(
            NARROW_DESKTOP.width, NARROW_DESKTOP.height, false,
        );
        await openStats(page, origin, flowId);
        const narrow = JSON.parse(
            await page.evaluate<string>(CAPTION),
        ) as Caption;
        assertStrictEquals(narrow.text, 'share of flow time');
        assert(
            narrow.width <= 1 && narrow.height <= 1,
            `caption ${narrow.width}x${narrow.height} below xl`,
        );
    });
});
