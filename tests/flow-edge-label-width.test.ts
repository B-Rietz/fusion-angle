import { assert, assertEquals, assertStrictEquals } from '@std/assert';
import {
    INTER_400_ADVANCES,
    INTER_400_FALLBACK_ADVANCE,
    INTER_400_UNITS_PER_EM,
    computeInter400TextWidth,
} from '../web-app/app/inter-400-advances.ts';
import {
    LABEL_FONT,
    LABEL_MIN_WIDTH,
    LABEL_SIDE_PADDING,
    computeEdgeLabelWidth,
} from '../web-app/app/flow-graph.ts';

const PRINTABLE_ASCII_FIRST = 0x20;
const PRINTABLE_ASCII_LAST = 0x7e;
const ELLIPSIS = '…';
const TABLED_CHARACTERS = 96;

Deno.test('the table holds printable ASCII and the ellipsis', () => {
    const tabled = new Set([ELLIPSIS]);
    for (
        let codePoint = PRINTABLE_ASCII_FIRST;
        codePoint <= PRINTABLE_ASCII_LAST;
        codePoint++
    ) {
        tabled.add(String.fromCodePoint(codePoint));
    }
    assertEquals(new Set(INTER_400_ADVANCES.keys()), tabled);
    assertStrictEquals(INTER_400_ADVANCES.size, TABLED_CHARACTERS);
    for (const [character, advance] of INTER_400_ADVANCES) {
        assert(
            Number.isInteger(advance) && advance > 0,
            `${character} advances ${advance}`,
        );
    }
});

// At one font unit to the pixel a width is a sum of advances.
Deno.test(
    'a character outside the table takes the widest advance',
    () => {
        assertStrictEquals(
            INTER_400_FALLBACK_ADVANCE,
            Math.max(...INTER_400_ADVANCES.values()),
        );
        for (const outsider of ['é', '🙂', '\ud83d']) {
            assertStrictEquals(
                computeInter400TextWidth(
                    outsider, INTER_400_UNITS_PER_EM,
                ),
                INTER_400_FALLBACK_ADVANCE,
                outsider,
            );
        }
        assertStrictEquals(
            computeInter400TextWidth(
                'é🙂', INTER_400_UNITS_PER_EM,
            ),
            2 * INTER_400_FALLBACK_ADVANCE,
        );
    },
);

function textWidth(name: string): number {
    return computeInter400TextWidth(name, LABEL_FONT);
}

Deno.test(
    'a short and a long name both leave the side padding each'
    + ' side',
    () => {
        for (const name of ['submit', 'needs revision']) {
            assertStrictEquals(
                computeEdgeLabelWidth(name) - textWidth(name),
                2 * LABEL_SIDE_PADDING,
                name,
            );
        }
    },
);

Deno.test('eighteen Ws fit their box', () => {
    const name = 'W'.repeat(18);
    assertStrictEquals(
        computeEdgeLabelWidth(name) - textWidth(name),
        2 * LABEL_SIDE_PADDING,
    );
});

Deno.test(
    'a one-character name and an empty name get the minimum'
    + ' box',
    () => {
        assertStrictEquals(
            computeEdgeLabelWidth('i'), LABEL_MIN_WIDTH,
        );
        assertStrictEquals(
            computeEdgeLabelWidth(''), LABEL_MIN_WIDTH,
        );
    },
);

Deno.test(
    'a truncated name\'s box wraps its seventeen characters'
    + ' and the ellipsis',
    () => {
        assertStrictEquals(
            computeEdgeLabelWidth('abcdefghijklmnopqrs'),
            textWidth('abcdefghijklmnopq…')
                + 2 * LABEL_SIDE_PADDING,
        );
    },
);
