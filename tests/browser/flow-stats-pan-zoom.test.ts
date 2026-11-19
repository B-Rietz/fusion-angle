import {
    assert, assertAlmostEquals, assertEquals, assertNotEquals,
    assertStrictEquals,
} from '@std/assert';
import {
    ALT, CTRL, META, SHIFT, stays, useBrowser, withAdminPage,
    type Origin, type Page, type Point,
} from './fixtures.ts';
import {
    ONBOARDING, STATS_CANVAS, STATS_WRAP,
    flowGraph, openFlow, openStats,
} from './canvas.ts';
import { pollUntil } from
    '../../web-app/app/cdp-client.ts';
import {
    KEYBOARD_PAN_STEP_PX,
} from '../../web-app/app/flow-stats-pan-zoom.ts';
import {
    MAX_ZOOM, MIN_ZOOM, ZOOM_STEP,
} from '../../web-app/app/flow-camera.ts';

const browser = useBrowser();
const SAVE_TIMEOUT_MS = 5_000;
// Long enough for a camera move to land and paint.
const QUIET_MS = 500;
const CARD_HOLD_MS = 500;
const RESIZED = { width: 1000, height: 700 };
// The camera's arithmetic runs in float64 from one
// viewBox to the next; a few steps differ in the last
// places.
const UNIT_TOLERANCE = 1e-6;
// The browser maps a client point through its own
// transform, in single precision.
const POINT_TOLERANCE = 0.01;
// Far more wheel steps than the zoom range holds.
const WHEEL_STEPS = 40;
const WHEEL_DELTA = 100;
// Over the sidebar: off every state, and off the canvas.
const AWAY: Point = { x: 5, y: 5 };
const DRAG: Point = { x: 48, y: 32 };
const DRAG_STEPS = 8;
const ZOOM_IN = '[data-action="zoom-in"]';
const ZOOM_OUT = '[data-action="zoom-out"]';
// Layout lands on whole pixels; a subpixel either way
// is the same place.
const BUTTON_TOLERANCE_PX = 1;
const CARD_SHOWN = `!document.querySelector(`
    + `'#flow-stats-card').classList.contains('hidden')`;
const STATS_VIEWBOX = `document.querySelector('${STATS_CANVAS}')`
    + `.getAttribute('viewBox')`;

type ViewBox = { x: number; y: number; w: number; h: number };
// The canvas as drawn: the wrap's inside, in client pixels.
type Canvas = { left: number; top: number; w: number; h: number };

async function viewBoxOf(page: Page): Promise<ViewBox> {
    const [x, y, w, h] = (await page.evaluate<string>(
        STATS_VIEWBOX,
    )).split(' ').map(Number);
    assert(
        x !== undefined && y !== undefined
            && w !== undefined && h !== undefined,
        'the stats canvas has no viewBox',
    );
    return { x, y, w, h };
}

async function canvasOf(page: Page): Promise<Canvas> {
    return JSON.parse(await page.evaluate<string>(`(() => {
        const wrap = document.querySelector('${STATS_WRAP}');
        const r = wrap.getBoundingClientRect();
        return JSON.stringify({
            left: r.left + wrap.clientLeft,
            top: r.top + wrap.clientTop,
            w: wrap.clientWidth,
            h: wrap.clientHeight,
        });
    })()`)) as Canvas;
}

// The content point drawn under a client point.
async function contentPointAt(
    page: Page, at: Point,
): Promise<Point> {
    return JSON.parse(await page.evaluate<string>(`(() => {
        const svg = document.querySelector('${STATS_CANVAS}');
        const p = new DOMPoint(${at.x}, ${at.y})
            .matrixTransform(svg.getScreenCTM().inverse());
        return JSON.stringify({ x: p.x, y: p.y });
    })()`)) as Point;
}

function viewBoxChanged(before: ViewBox): string {
    return `${STATS_VIEWBOX} !== ${JSON.stringify(
        [before.x, before.y, before.w, before.h].join(' '),
    )}`;
}

function centreOf(viewBox: ViewBox): Point {
    return {
        x: viewBox.x + viewBox.w / 2,
        y: viewBox.y + viewBox.h / 2,
    };
}

function assertSameView(
    seen: ViewBox, expected: ViewBox, label: string,
): void {
    for (const key of ['x', 'y', 'w', 'h'] as const) {
        assertAlmostEquals(
            seen[key], expected[key], UNIT_TOLERANCE,
            `${label}: ${key}`,
        );
    }
}

// A state the canvas shows, and a whole client pixel at
// its centre, which nothing covers. Whole pixels, so the
// mouse events report the point exactly.
async function visibleNode(
    page: Page,
): Promise<{ id: string; at: Point }> {
    const found = JSON.parse(await page.evaluate<string>(`(() => {
        const wrap = document.querySelector('${STATS_WRAP}')
            .getBoundingClientRect();
        for (const g of document.querySelectorAll(
            '${STATS_CANVAS} [data-node-id]')) {
            const r = g.getBoundingClientRect();
            const x = Math.round(r.left + r.width / 2);
            const y = Math.round(r.top + r.height / 2);
            const inside = x > wrap.left && x < wrap.right
                && y > wrap.top && y < wrap.bottom;
            const hit = document.elementFromPoint(x, y)
                ?.closest('[data-node-id]');
            if (inside && hit === g) {
                return JSON.stringify({
                    id: g.getAttribute('data-node-id'),
                    at: { x, y },
                });
            }
        }
        return 'null';
    })()`)) as { id: string; at: Point } | null;
    assert(found !== null, 'the canvas shows no state');
    return found;
}

// A press and a drag's moves, not yet released, so a test
// can look mid-drag. Answers where the pointer rests.
async function pressAndMove(
    page: Page, from: Point, by: Point,
): Promise<Point> {
    await page.press(from);
    for (let i = 1; i <= DRAG_STEPS; i += 1) {
        await page.move({
            x: from.x + by.x * i / DRAG_STEPS,
            y: from.y + by.y * i / DRAG_STEPS,
        });
    }
    return { x: from.x + by.x, y: from.y + by.y };
}

async function openStatsWithAutoFitOff(
    page: Page, origin: Origin,
): Promise<void> {
    const flowId = await openFlow(page, origin, ONBOARDING);
    await page.click('#flow-auto-fit-switch');
    await pollUntil('Auto Fit off saved', SAVE_TIMEOUT_MS,
        async () => (await flowGraph(origin, flowId)).is_auto_fit
            ? null
            : true);
    await openStats(page, origin, flowId);
}

// Focus where no text field holds it.
async function blur(page: Page): Promise<void> {
    await page.evaluate(`document.activeElement?.blur()`);
}

Deno.test('a drag pans and does not pin', async () => {
    await withAdminPage(browser.get(), async (page, origin) => {
        await openStatsWithAutoFitOff(page, origin);
        const before = await viewBoxOf(page);
        const canvas = await canvasOf(page);
        const { at } = await visibleNode(page);
        const to = await pressAndMove(page, at, DRAG);
        await page.until(`!(${CARD_SHOWN})`, 'no card while panning');
        await page.release(to);
        await page.until(viewBoxChanged(before), 'viewBox panned');
        assertSameView(await viewBoxOf(page), {
            ...before,
            x: before.x - DRAG.x * before.w / canvas.w,
            y: before.y - DRAG.y * before.h / canvas.h,
        }, 'panned');
        await page.hover(AWAY);
        assertStrictEquals(
            await page.evaluate<boolean>(CARD_SHOWN), false,
        );
        await stays(page, CARD_SHOWN, CARD_HOLD_MS);
    });
});

Deno.test('the wheel zooms about the pointer within 0.25..2',
async () => {
    await withAdminPage(browser.get(), async (page, origin) => {
        await openStatsWithAutoFitOff(page, origin);
        const canvas = await canvasOf(page);
        const at = {
            x: Math.round(canvas.left + canvas.w * 0.3),
            y: Math.round(canvas.top + canvas.h * 0.4),
        };
        const under = await contentPointAt(page, at);
        for (const [deltaY, zoom] of [
            [-WHEEL_DELTA, MAX_ZOOM], [WHEEL_DELTA, MIN_ZOOM],
        ] as const) {
            for (let i = 0; i < WHEEL_STEPS; i += 1) {
                await page.wheel(at, deltaY);
            }
            await page.until(
                `Math.abs(document.querySelector('${STATS_WRAP}')`
                + `.clientWidth / ${STATS_VIEWBOX}.split(' ')[2]`
                + ` - ${zoom}) < ${UNIT_TOLERANCE}`,
                `zoom ${zoom}`,
            );
            await stays(page, STATS_VIEWBOX, QUIET_MS);
            const seen = await viewBoxOf(page);
            assertAlmostEquals(
                canvas.w / seen.w, zoom, UNIT_TOLERANCE,
            );
            const still = await contentPointAt(page, at);
            assertAlmostEquals(still.x, under.x, POINT_TOLERANCE);
            assertAlmostEquals(still.y, under.y, POINT_TOLERANCE);
        }
    });
});

Deno.test('the buttons zoom by the designer\'s step', async () => {
    await withAdminPage(browser.get(), async (page, origin) => {
        await openStatsWithAutoFitOff(page, origin);
        const before = await viewBoxOf(page);
        await page.click(ZOOM_IN);
        await page.until(viewBoxChanged(before), 'zoomed in');
        const ratio = 1 / (1 + ZOOM_STEP);
        const centre = centreOf(before);
        assertSameView(await viewBoxOf(page), {
            x: centre.x - before.w * ratio / 2,
            y: centre.y - before.h * ratio / 2,
            w: before.w * ratio,
            h: before.h * ratio,
        }, 'zoomed in');
        const zoomed = await viewBoxOf(page);
        await page.click('[data-action="zoom-out"]');
        await page.until(viewBoxChanged(zoomed), 'zoomed out');
        assertSameView(await viewBoxOf(page), before, 'zoomed out');
    });
});

Deno.test('the zoom buttons stand where the designer keeps them',
async () => {
    await withAdminPage(browser.get(), async (page, origin) => {
        const flowId = await openFlow(page, origin, ONBOARDING);
        await page.click('#flow-auto-fit-switch');
        await pollUntil('Auto Fit off saved', SAVE_TIMEOUT_MS,
            async () => (await flowGraph(origin, flowId)).is_auto_fit
                ? null
                : true);
        const designer = [
            await page.rect(ZOOM_OUT), await page.rect(ZOOM_IN),
        ];
        await openStats(page, origin, flowId);
        const stats = [
            await page.rect(ZOOM_OUT), await page.rect(ZOOM_IN),
        ];
        designer.forEach((was, i) => {
            const now = stats[i]!;
            const label = `${i === 0 ? ZOOM_OUT : ZOOM_IN} at`
                + ` ${JSON.stringify(now)} vs the designer's`
                + ` ${JSON.stringify(was)}`;
            assertAlmostEquals(now.x, was.x, BUTTON_TOLERANCE_PX,
                label);
            assertAlmostEquals(now.y, was.y, BUTTON_TOLERANCE_PX,
                label);
        });
    });
});

Deno.test('arrow and plus/minus keys pan and zoom', async () => {
    await withAdminPage(browser.get(), async (page, origin) => {
        await openStatsWithAutoFitOff(page, origin);
        await blur(page);
        const canvas = await canvasOf(page);
        const start = await viewBoxOf(page);
        const stepX = KEYBOARD_PAN_STEP_PX * start.w / canvas.w;
        const stepY = KEYBOARD_PAN_STEP_PX * start.h / canvas.h;
        const steps: ReadonlyArray<[string, Partial<ViewBox>]> = [
            ['ArrowRight', { x: start.x + stepX }],
            ['ArrowDown', { x: start.x + stepX, y: start.y + stepY }],
            ['ArrowLeft', { y: start.y + stepY }],
            ['ArrowUp', {}],
        ];
        for (const [key, moved] of steps) {
            const before = await viewBoxOf(page);
            await page.key(key);
            await page.until(viewBoxChanged(before), key);
            assertSameView(
                await viewBoxOf(page), { ...start, ...moved }, key,
            );
        }
        const ratio = 1 / (1 + ZOOM_STEP);
        const centre = centreOf(start);
        const zoomedIn: ViewBox = {
            x: centre.x - start.w * ratio / 2,
            y: centre.y - start.h * ratio / 2,
            w: start.w * ratio,
            h: start.h * ratio,
        };
        for (const [key, expected] of [
            ['+', zoomedIn], ['-', start], ['=', zoomedIn],
        ] as const) {
            const before = await viewBoxOf(page);
            await page.key(key);
            await page.until(viewBoxChanged(before), key);
            assertSameView(await viewBoxOf(page), expected, key);
        }
    });
});

// Each key that moves the camera, so a held one is seen.
const CAMERA_KEYS = ['ArrowLeft', 'ArrowDown', '+', '=', '-'];

// The keys moved nothing; then, with focus off any text
// field and no modifier, one still does, so the camera was
// listening all along.
async function assertKeysIgnoredWhileLive(
    page: Page, before: string,
): Promise<void> {
    await stays(page, STATS_VIEWBOX, QUIET_MS);
    assertStrictEquals(
        await page.evaluate<string>(STATS_VIEWBOX), before,
    );
    await blur(page);
    await page.key('+');
    await page.until(
        `${STATS_VIEWBOX} !== ${JSON.stringify(before)}`,
        'the camera listens',
    );
}

Deno.test('typing in the top bar search does not move the camera',
async () => {
    await withAdminPage(browser.get(), async (page, origin) => {
        await openStatsWithAutoFitOff(page, origin);
        const before = await page.evaluate<string>(STATS_VIEWBOX);
        await page.click('#search-input');
        await page.until(
            `document.activeElement instanceof HTMLInputElement`,
            'a search field focused',
        );
        for (const key of CAMERA_KEYS) await page.key(key);
        await assertKeysIgnoredWhileLive(page, before);
    });
});

Deno.test('Ctrl, Cmd, or Alt with a key does not move the camera',
async () => {
    await withAdminPage(browser.get(), async (page, origin) => {
        await openStatsWithAutoFitOff(page, origin);
        await blur(page);
        const before = await page.evaluate<string>(STATS_VIEWBOX);
        for (const modifiers of [CTRL, META, ALT]) {
            for (const key of CAMERA_KEYS) {
                await page.key(key, modifiers);
            }
        }
        await assertKeysIgnoredWhileLive(page, before);
    });
});

Deno.test('Shift with + zooms in, since + is a shifted key',
async () => {
    await withAdminPage(browser.get(), async (page, origin) => {
        await openStatsWithAutoFitOff(page, origin);
        await blur(page);
        const start = await viewBoxOf(page);
        await page.key('+', SHIFT);
        await page.until(viewBoxChanged(start), 'Shift with +');
        const ratio = 1 / (1 + ZOOM_STEP);
        const centre = centreOf(start);
        assertSameView(await viewBoxOf(page), {
            x: centre.x - start.w * ratio / 2,
            y: centre.y - start.h * ratio / 2,
            w: start.w * ratio,
            h: start.h * ratio,
        }, 'Shift with +');
    });
});

// The canvas measures nothing while its wrap is hidden, as
// it can mid-reload. Test-only: the page never hides it.
const HIDE_WRAP = `document.querySelector('${STATS_WRAP}')`
    + `.style.display = 'none'`;
const SHOW_WRAP = `document.querySelector('${STATS_WRAP}')`
    + `.style.removeProperty('display')`;
// Two frames, so a drag's frame and a resize's observer
// have both run.
const TWO_FRAMES = 'new Promise((done) => requestAnimationFrame('
    + '() => requestAnimationFrame(() => done(true))))';

function assertFinite(viewBox: ViewBox, label: string): void {
    for (const key of ['x', 'y', 'w', 'h'] as const) {
        assert(
            Number.isFinite(viewBox[key]),
            `${label}: ${key} is ${viewBox[key]}`,
        );
    }
}

Deno.test('keys move nothing while the canvas measures nothing',
async () => {
    await withAdminPage(browser.get(), async (page, origin) => {
        await openStatsWithAutoFitOff(page, origin);
        await blur(page);
        const before = await viewBoxOf(page);
        const attribute = await page.evaluate<string>(STATS_VIEWBOX);
        await page.evaluate(HIDE_WRAP);
        for (const key of ['ArrowLeft', '+']) await page.key(key);
        await stays(page, STATS_VIEWBOX, QUIET_MS);
        assertStrictEquals(
            await page.evaluate<string>(STATS_VIEWBOX), attribute,
        );
        await page.evaluate(SHOW_WRAP);
        await page.evaluate(TWO_FRAMES);
        const shown = await viewBoxOf(page);
        assertFinite(shown, 'shown');
        assertSameView(shown, before, 'shown');
    });
});

Deno.test('a drag moves nothing while the canvas measures nothing',
async () => {
    await withAdminPage(browser.get(), async (page, origin) => {
        await openStatsWithAutoFitOff(page, origin);
        const opening = await viewBoxOf(page);
        const { at } = await visibleNode(page);
        const from = await pressAndMove(page, at, DRAG);
        await page.until(viewBoxChanged(opening), 'viewBox panned');
        await page.evaluate(TWO_FRAMES);
        const panned = await viewBoxOf(page);
        const attribute = await page.evaluate<string>(STATS_VIEWBOX);
        await page.evaluate(HIDE_WRAP);
        for (let i = 1; i <= DRAG_STEPS; i += 1) {
            await page.move({
                x: from.x + DRAG.x * i / DRAG_STEPS,
                y: from.y + DRAG.y * i / DRAG_STEPS,
            });
        }
        await page.evaluate(TWO_FRAMES);
        await stays(page, STATS_VIEWBOX, QUIET_MS);
        assertStrictEquals(
            await page.evaluate<string>(STATS_VIEWBOX), attribute,
        );
        await page.evaluate(SHOW_WRAP);
        await page.evaluate(TWO_FRAMES);
        await page.release({ x: from.x + DRAG.x, y: from.y + DRAG.y });
        await page.evaluate(TWO_FRAMES);
        const shown = await viewBoxOf(page);
        assertFinite(shown, 'shown');
        assertSameView(shown, panned, 'shown');
    });
});

// The pinned card's anchor, and its state's centre in the
// canvas area.
type Anchors = { card: number[]; node: number[] };
function anchorsOf(nodeId: string): string {
    return `(() => {
        const area = document.querySelector(
            '.flow-stats-canvas-area').getBoundingClientRect();
        const g = document.querySelector(
            '${STATS_CANVAS} [data-node-id="${nodeId}"]')
            .getBoundingClientRect();
        const card = document.querySelector('#flow-stats-card');
        return JSON.stringify({
            card: [
                Number(card.style.getPropertyValue('--card-x')),
                Number(card.style.getPropertyValue('--card-y')),
            ],
            node: [
                Math.round(g.left + g.width / 2 - area.left),
                Math.round(g.top + g.height / 2 - area.top),
            ],
        });
    })()`;
}

Deno.test('a pinned card follows its node', async () => {
    await withAdminPage(browser.get(), async (page, origin) => {
        await openStatsWithAutoFitOff(page, origin);
        const { id, at } = await visibleNode(page);
        await page.press(at);
        await page.release(at);
        await page.hover(AWAY);
        await page.until(CARD_SHOWN, 'card pinned');
        const pinned = JSON.parse(
            await page.evaluate<string>(anchorsOf(id)),
        ) as Anchors;
        assertEquals(pinned.card, pinned.node);
        const before = await viewBoxOf(page);
        await page.release(await pressAndMove(page, at, DRAG));
        await page.until(viewBoxChanged(before), 'viewBox panned');
        await page.hover(AWAY);
        assertStrictEquals(
            await page.evaluate<boolean>(CARD_SHOWN), true,
        );
        const panned = JSON.parse(
            await page.evaluate<string>(anchorsOf(id)),
        ) as Anchors;
        assertEquals(panned.card, panned.node);
        for (const axis of [0, 1]) {
            const nodeDelta = panned.node[axis]! - pinned.node[axis]!;
            assertStrictEquals(
                panned.card[axis]! - pinned.card[axis]!, nodeDelta,
            );
            assertAlmostEquals(
                nodeDelta, axis === 0 ? DRAG.x : DRAG.y, 1,
            );
        }
    });
});

Deno.test('a resize after a pan keeps centre and zoom', async () => {
    await withAdminPage(browser.get(), async (page, origin) => {
        await openStatsWithAutoFitOff(page, origin);
        const opening = await viewBoxOf(page);
        await page.click(ZOOM_IN);
        await page.until(viewBoxChanged(opening), 'zoomed in');
        const zoomed = await viewBoxOf(page);
        const { at } = await visibleNode(page);
        await page.release(await pressAndMove(page, at, DRAG));
        await page.until(viewBoxChanged(zoomed), 'viewBox panned');
        const panned = await viewBoxOf(page);
        const zoom = (await canvasOf(page)).w / panned.w;
        await page.setViewport(RESIZED.width, RESIZED.height, false);
        await page.until(viewBoxChanged(panned), 'viewBox resized');
        await stays(page, STATS_VIEWBOX, QUIET_MS);
        const resized = await viewBoxOf(page);
        const canvas = await canvasOf(page);
        assertNotEquals(resized.w, panned.w);
        assertAlmostEquals(
            canvas.w / resized.w, zoom, UNIT_TOLERANCE,
        );
        assertAlmostEquals(
            canvas.h / resized.h, zoom, UNIT_TOLERANCE,
        );
        const was = centreOf(panned);
        const now = centreOf(resized);
        assertAlmostEquals(now.x, was.x, UNIT_TOLERANCE);
        assertAlmostEquals(now.y, was.y, UNIT_TOLERANCE);
    });
});

Deno.test('with Auto Fit on, nothing moves the camera and there'
+ ' are no zoom buttons', async () => {
    await withAdminPage(browser.get(), async (page, origin) => {
        const flowId = await openFlow(page, origin, ONBOARDING);
        await openStats(page, origin, flowId);
        assertStrictEquals(await page.evaluate<boolean>(
            `document.querySelector('[data-action^="zoom"]')`
            + ` === null`,
        ), true);
        await stays(page, STATS_VIEWBOX, QUIET_MS);
        const before = await page.evaluate<string>(STATS_VIEWBOX);
        const canvas = await canvasOf(page);
        const at = {
            x: canvas.left + canvas.w / 2,
            y: canvas.top + canvas.h / 2,
        };
        await page.release(await pressAndMove(page, at, DRAG));
        for (const deltaY of [-WHEEL_DELTA, WHEEL_DELTA]) {
            await page.wheel(at, deltaY);
        }
        await blur(page);
        for (const key of CAMERA_KEYS) await page.key(key);
        await stays(page, STATS_VIEWBOX, QUIET_MS);
        assertStrictEquals(
            await page.evaluate<string>(STATS_VIEWBOX), before,
        );
    });
});
