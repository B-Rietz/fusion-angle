import {
    assert,
    assertEquals,
    assertNotStrictEquals,
    assertStrictEquals,
} from '@std/assert';
import { type Page, startOrigin, useBrowser } from './fixtures.ts';
import { registryUrl } from
    '../../web-app/app/browser-drive.ts';

// An endpoint's example exchange as the browser paints it:
// its request and its response, each a message block.

const browser = useBrowser();

const ROOM = '#api-room';
const MESSAGES = ROOM + ' pre.api-doc-message';

// A write with every kind of header line: essential and
// plain in its request, all three in its response.
const PUT_FLOW = '#put/organizations/id/flows/id';

// Opens the documentation at a hash and hands the page over
// once the view's exchange is painted.
async function withExchange(
    hash: string,
    body: (page: Page) => Promise<void>,
): Promise<void> {
    const origin = await startOrigin();
    const page = await browser.get().newPage();
    try {
        await page.navigate(registryUrl(
            origin.baseUrl, 'api-documentation',
        ) + hash);
        await page.ready('api-documentation');
        await page.until<string>(
            `document.querySelectorAll(${JSON.stringify(MESSAGES)})`
            + `.length === 2 ? 'painted' : null`,
            'the exchange\'s request and response',
        );
        await body(page);
    } finally {
        await browser.get().disposeContext(page.contextId);
        await origin.close();
    }
}

// WCAG 2 AA: text, and a graphic a reader must tell apart.
const TEXT_CONTRAST = 4.5;
const GRAPHIC_CONTRAST = 3;

type Rgb = readonly [number, number, number];

// A computed colour, which Chrome serializes as rgb().
function rgbOf(color: string): Rgb {
    const channels = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(color);
    assert(channels !== null, color);
    return [
        Number(channels[1]), Number(channels[2]), Number(channels[3]),
    ];
}

function luminance(rgb: Rgb): number {
    const [red, green, blue] = rgb.map((channel) => {
        const level = channel / 255;
        return level <= 0.04045
            ? level / 12.92
            : ((level + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(one: string, other: string): number {
    const [high, low] = [luminance(rgbOf(one)), luminance(rgbOf(other))]
        .sort((a, b) => b - a) as [number, number];
    return (high + 0.05) / (low + 0.05);
}

// A highlighted header line, or a legend's entry, as
// painted.
interface PaintedHighlight {
    readonly kinds: readonly string[];
    readonly color: string;
    readonly background: string;
    // The words a reader who sees no shape or colour gets.
    readonly label: string | null;
    // Whether the line's own text holds those words.
    readonly textHoldsLabel: boolean;
    readonly shape: {
        readonly visible: boolean;
        readonly left: number;
        readonly right: number;
        readonly height: number;
        readonly color: string;
        readonly clipPath: string;
    };
    // Where the line's own text starts.
    readonly textLeft: number;
}

interface PaintedExchange {
    readonly blockBackground: string;
    // The request block's border edge, and where its start
    // line's text starts.
    readonly blockLeft: number;
    readonly plainTextLeft: number;
    readonly ifMatch: PaintedHighlight | null;
    readonly etag: PaintedHighlight | null;
    readonly lastModified: PaintedHighlight | null;
    // The response's content-type line sits in no highlight.
    readonly contentTypeIsPlain: boolean;
    readonly legend: {
        readonly visible: boolean;
        readonly bottom: number;
        readonly requestTop: number;
        readonly text: string;
        readonly entries: readonly PaintedHighlight[];
    };
}

const PAINTED_EXCHANGE = `(() => {
    const [request, response] = document.querySelectorAll(${
        JSON.stringify(MESSAGES)
    });
    const leftOf = (text) => {
        const range = document.createRange();
        range.setStart(text, 0);
        range.setEnd(text, 1);
        return range.getBoundingClientRect().left;
    };
    const painted = (mark) => {
        if (!mark) return null;
        const style = getComputedStyle(mark);
        const shape = mark.querySelector('.api-doc-highlight-shape');
        const box = shape.getBoundingClientRect();
        const label = shape.getAttribute('role') === 'img'
            ? shape.getAttribute('aria-label') : null;
        return {
            kinds: [...mark.classList],
            color: style.color,
            background: style.backgroundColor,
            label,
            textHoldsLabel: label !== null
                && mark.textContent.includes(label),
            shape: {
                visible: shape.checkVisibility(),
                left: box.left,
                right: box.right,
                height: box.height,
                color: getComputedStyle(shape).backgroundColor,
                clipPath: getComputedStyle(shape).clipPath,
            },
            textLeft: leftOf(mark.lastChild),
        };
    };
    const lineOf = (block, name) => painted(
        [...block.querySelectorAll('mark.api-doc-highlight')].find(
            (mark) => mark.lastChild.data.startsWith(name + ': ')));
    const legend = document.querySelector('${ROOM} .api-doc-legend');
    return {
        blockBackground: getComputedStyle(request).backgroundColor,
        blockLeft: request.getBoundingClientRect().left,
        plainTextLeft: leftOf(request.firstChild),
        ifMatch: lineOf(request, 'if-match'),
        etag: lineOf(response, 'etag'),
        lastModified: lineOf(response, 'last-modified'),
        contentTypeIsPlain: [...response.childNodes].some((node) =>
            node.nodeType === Node.TEXT_NODE
                && node.data.includes('\\ncontent-type: ')),
        legend: {
            visible: legend.checkVisibility(),
            bottom: legend.getBoundingClientRect().bottom,
            requestTop: request.getBoundingClientRect().top,
            text: legend.textContent.replace(/\\s+/g, ' ').trim(),
            entries: [...legend.querySelectorAll('mark')].map(painted),
        },
    };
})()`;

const ESSENTIAL = 'api-doc-highlight-essential';
const PROVIDED = 'api-doc-highlight-provided';

Deno.test('a highlighted header line shows its shape and its name'
    + ' beside its colour', async () => {
    await withExchange(PUT_FLOW, async (page) => {
        const painted = await page.evaluate<PaintedExchange>(
            PAINTED_EXCHANGE,
        );
        const { ifMatch, etag, lastModified } = painted;
        assert(ifMatch !== null && etag !== null);
        assert(lastModified !== null);
        assert(ifMatch.kinds.includes(ESSENTIAL), 'if-match');
        assert(etag.kinds.includes(ESSENTIAL), 'etag');
        assert(lastModified.kinds.includes(PROVIDED), 'last-modified');
        assertStrictEquals(painted.contentTypeIsPlain, true);
        assertStrictEquals(ifMatch.label, 'Essential');
        assertStrictEquals(etag.label, 'Essential');
        assertStrictEquals(lastModified.label, 'Provided');
        assertStrictEquals(ifMatch.textHoldsLabel, false);
        assertStrictEquals(etag.textHoldsLabel, false);
        assertStrictEquals(lastModified.textHoldsLabel, false);
        // The two kinds differ in colour, in band, and in
        // shape; one kind is painted one way.
        assertStrictEquals(etag.color, ifMatch.color);
        assertStrictEquals(etag.background, ifMatch.background);
        assertNotStrictEquals(lastModified.color, etag.color);
        assertNotStrictEquals(lastModified.background, etag.background);
        assertNotStrictEquals(
            lastModified.shape.clipPath, etag.shape.clipPath,
        );
        for (const line of [ifMatch, etag, lastModified]) {
            const name = line.kinds.join(' ');
            assert(
                contrast(line.color, line.background) >= TEXT_CONTRAST,
                name + ' text ' + line.color + ' on ' + line.background,
            );
            assert(line.shape.visible && line.shape.height > 0, name);
            assertStrictEquals(line.shape.color, line.color, name);
            assert(
                contrast(line.shape.color, painted.blockBackground)
                    >= GRAPHIC_CONTRAST,
                name + ' shape ' + line.shape.color + ' on '
                    + painted.blockBackground,
            );
            // The line's text starts where a plain line's
            // does, and the shape stands before it, inside
            // the block.
            assertStrictEquals(line.textLeft, painted.plainTextLeft, name);
            assert(
                line.shape.right <= line.textLeft
                    && line.shape.left >= painted.blockLeft,
                name + ' ' + JSON.stringify(line.shape),
            );
        }
    });
});

Deno.test('the legend above the request shows each highlight as a'
    + ' line wears it', async () => {
    await withExchange(PUT_FLOW, async (page) => {
        const { legend, etag, lastModified } = await page.evaluate<
            PaintedExchange
        >(PAINTED_EXCHANGE);
        assert(etag !== null && lastModified !== null);
        assertStrictEquals(legend.visible, true);
        assert(
            legend.bottom <= legend.requestTop, JSON.stringify(legend),
        );
        assertStrictEquals(
            legend.text,
            'Essential a header this documentation names'
                + ' Provided a header the API sets for you to use',
        );
        assertEquals(
            legend.entries.map(({ kinds, color, background, shape }) => ({
                kinds, color, background, clipPath: shape.clipPath,
                shown: shape.visible && shape.height > 0,
            })),
            [etag, lastModified].map(
                ({ kinds, color, background, shape }) => ({
                    kinds, color, background, clipPath: shape.clipPath,
                    shown: true,
                }),
            ),
        );
    });
});
