import {
    assert, assertAlmostEquals, assertEquals,
} from '@std/assert';
import { useBrowser, withAdminPage } from './fixtures.ts';
import { EDGE, ONBOARDING, openFlow } from './canvas.ts';
import {
    INTER_400_ADVANCES,
    INTER_400_UNITS_PER_EM,
} from '../../web-app/app/inter-400-advances.ts';
import {
    LABEL_MIN_WIDTH,
    LABEL_SIDE_PADDING,
} from '../../web-app/app/flow-graph.ts';

const browser = useBrowser();

// One font unit to the pixel, so Chrome reports an advance
// on the table's own grid.
const TABLE_FONT = `400 ${INTER_400_UNITS_PER_EM}px Inter`;

type Mismatch = {
    character: string; tabled: number; chrome: number;
};

const ADVANCE_MISMATCHES = `(async () => {
    await document.fonts.load(${JSON.stringify(TABLE_FONT)});
    const context = document.createElement('canvas')
        .getContext('2d');
    context.font = ${JSON.stringify(TABLE_FONT)};
    return JSON.stringify(
        ${JSON.stringify([...INTER_400_ADVANCES])}.flatMap(
            ([character, tabled]) => {
                const chrome = context.measureText(character)
                    .width;
                return chrome === tabled
                    ? []
                    : [{ character, tabled, chrome }];
            },
        ),
    );
})()`;

Deno.test(
    'Chrome sets each tabled character at the table\'s advance',
    async () => {
        await withAdminPage(
            browser.get(), async (page, origin) => {
                await openFlow(page, origin, ONBOARDING);
                const mismatches = JSON.parse(
                    await page.evaluate<string>(
                        ADVANCE_MISMATCHES,
                    ),
                ) as Mismatch[];
                assertEquals(mismatches, []);
            },
        );
    },
);

// The table does not model kerning. The allowance covers
// the kerning of the seeded labels this test reads.
const KERNING_ALLOWANCE = 2;
const MIN_LABELS_COMPARED = 3;

type Label = { name: string; box: number; text: number };

const LABELS = `(async () => {
    await document.fonts.ready;
    return JSON.stringify(
        [...document.querySelectorAll('${EDGE}')].map((edge) => {
            const text = edge.querySelector('text');
            return {
                name: text.textContent,
                box: edge.querySelector('rect').width.baseVal
                    .value,
                text: text.getComputedTextLength(),
            };
        }),
    );
})()`;

Deno.test(
    'a designer label\'s box clears its text by the side'
    + ' padding',
    async () => {
        await withAdminPage(
            browser.get(), async (page, origin) => {
                await openFlow(page, origin, ONBOARDING);
                const labels = JSON.parse(
                    await page.evaluate<string>(LABELS),
                ) as Label[];
                assert(
                    labels.length >= MIN_LABELS_COMPARED,
                    `${labels.length} labels`,
                );
                for (const { name, box, text } of labels) {
                    // A box held at the minimum says nothing
                    // of its padding.
                    assert(
                        box > LABEL_MIN_WIDTH,
                        `${name} box ${box}`,
                    );
                    assertAlmostEquals(
                        box - text,
                        2 * LABEL_SIDE_PADDING,
                        KERNING_ALLOWANCE,
                        name,
                    );
                }
            },
        );
    },
);
