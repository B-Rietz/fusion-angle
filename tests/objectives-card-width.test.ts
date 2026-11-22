import { assert, assertEquals } from '@std/assert';
import { cssDeclaration } from './fixtures/css-declaration.ts';

// C4 / K27 covenant: the Objectives box fills the
// remaining width beside the stacked gauge column on
// desktop, at matching height, and the two stack full
// width only under 768px. The TEST-PLAN copy states it;
// this pin keeps the CSS honest.

const dashboardSrc = Deno.readTextFileSync(
    'web-app/app/styles/pages-dashboard.css',
);

Deno.test(
    'the Objectives card fills the overview grid column',
    () => {
        assertEquals(
            cssDeclaration(
                dashboardSrc,
                '.dashboard-overview-objectives'
                + ' .objective-aggregates-card',
                'width',
            ),
            '100%',
        );
    },
);

Deno.test(
    'the Objectives card matches the gauge column height',
    () => {
        assertEquals(
            cssDeclaration(
                dashboardSrc,
                '.dashboard-overview-objectives'
                + ' .objective-aggregates-card',
                'height',
            ),
            '100%',
        );
    },
);

Deno.test('the overview grid stacks full-width under 768px',
() => {
    const src = Deno.readTextFileSync(
        'web-app/app/styles/responsive.css',
    );
    const media = src.indexOf(
        '@media (max-width: 767px) {',
    );
    const stacked = src.indexOf(
        '.dashboard-overview-grid'
        + ' { grid-template-columns: 1fr; }',
    );
    const close = src.indexOf('\n}', media);
    assert(media >= 0);
    assert(stacked > media);
    assert(stacked < close);
});
