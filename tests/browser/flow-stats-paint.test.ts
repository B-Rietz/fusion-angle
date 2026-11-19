import { assert, assertStrictEquals } from '@std/assert';
import { useBrowser, withAdminPage } from './fixtures.ts';
import {
    ONBOARDING, STATS_CANVAS, flowIdNamed, openStats,
} from './canvas.ts';

const browser = useBrowser();

// WCAG 2.x AA for normal-size text.
const AA_CONTRAST = 4.5;
// The ramp's stops sit at 0, 0.5, 0.75, and 1; eighths
// land on each stop and between every pair.
const RAMP_STEPS = 8;
// A regular state on the lit path: it wears full paint.
const REGULAR = `${STATS_CANVAS}`
    + ' .flow-stats-node[data-on-path="true"]:not([data-special])';

type Rgb = [number, number, number];
// A fill as the canvas read it, and whether the canvas took
// the colour at all: one it cannot parse leaves the fill it
// had, which would read as that colour, not as a failure.
type Read = { parsed: boolean; rgb: Rgb };
type Painted = { strokeWidth: string; rect: Read; texts: Read[] };

// A fill no computed paint here resolves to.
const SENTINEL = '#010203';

// Set the state's heat, then paint each computed fill into
// a 1x1 canvas and read it back as sRGB: the browser, not
// this test, resolves the oklch mix.
function paintedAt(t: number): string {
    return `JSON.stringify((() => {
        const g = document.querySelector(${JSON.stringify(REGULAR)});
        g.style.setProperty('--heat-t', ${JSON.stringify(String(t))});
        const ctx = document.createElement('canvas')
            .getContext('2d');
        const srgb = (colour) => {
            ctx.clearRect(0, 0, 1, 1);
            ctx.fillStyle = ${JSON.stringify(SENTINEL)};
            const sentinel = ctx.fillStyle;
            ctx.fillStyle = colour;
            const parsed = ctx.fillStyle !== sentinel;
            ctx.fillRect(0, 0, 1, 1);
            return {
                parsed,
                rgb: [...ctx.getImageData(0, 0, 1, 1).data]
                    .slice(0, 3),
            };
        };
        const rect = g.querySelector('.flow-stats-node-rect');
        const style = getComputedStyle(rect);
        return {
            strokeWidth: style.strokeWidth,
            rect: srgb(style.fill),
            texts: [...g.querySelectorAll('text')].map(
                (text) => srgb(getComputedStyle(text).fill)),
        };
    })())`;
}

function luminance([r, g, b]: Rgb): number {
    const [lr, lg, lb] = [r, g, b].map((channel) => {
        const c = channel / 255;
        return c <= 0.04045
            ? c / 12.92
            : ((c + 0.055) / 1.055) ** 2.4;
    }) as Rgb;
    return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(a: Rgb, b: Rgb): number {
    const [hi, lo] = [luminance(a), luminance(b)]
        .sort((x, y) => y - x) as [number, number];
    return (hi + 0.05) / (lo + 0.05);
}

Deno.test('node text holds 4.5:1 across the ramp', async () => {
    await withAdminPage(browser.get(), async (page, origin) => {
        const flowId = await flowIdNamed(origin, ONBOARDING);
        await openStats(page, origin, flowId);
        await page.waitFor(REGULAR);
        for (let step = 0; step <= RAMP_STEPS; step += 1) {
            const t = step / RAMP_STEPS;
            const painted = JSON.parse(
                await page.evaluate<string>(paintedAt(t)),
            ) as Painted;
            assertStrictEquals(
                painted.strokeWidth, '2px', `stroke at t ${t}`,
            );
            assertStrictEquals(
                painted.texts.length, 2, `name and second line`,
            );
            assert(painted.rect.parsed, `rect fill unread at t ${t}`);
            for (const [i, text] of painted.texts.entries()) {
                assert(text.parsed, `text ${i} fill unread at t ${t}`);
                const ratio = contrast(text.rgb, painted.rect.rgb);
                assert(
                    ratio >= AA_CONTRAST,
                    `text ${i} at t ${t}: ${ratio.toFixed(2)}:1`
                    + ` (${text.rgb} on ${painted.rect.rgb})`,
                );
            }
        }
    });
});
