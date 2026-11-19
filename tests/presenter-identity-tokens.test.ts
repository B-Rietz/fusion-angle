import {
    assert,
    assertEquals,
    assertMatch,
    assertNotMatch,
    assertStringIncludes,
} from '@std/assert';
import {
    IdentityTokensPresenter,
} from '../web-app/app/presenters/identity-tokens.ts';
import { idLabel } from '../web-app/app/presenters/id-label.ts';
import { cssDeclaration } from './fixtures/css-declaration.ts';

// identity-tokens.ts never reads localStorage (checked
// against the full product tree); window/document are
// stubbed because IdentityTokensPresenter.render walks a
// real DOM element.
globalThis.window = {
    addEventListener: () => {},
} as unknown as Window & typeof globalThis;
// @ts-expect-error — Node global stub
globalThis.document = { addEventListener: () => {} };

function record(): {
    container: HTMLElement;
    html: () => string;
} {
    let value = '';
    const el = {
        set innerHTML(v: string) {
            value = v;
        },
        get innerHTML(): string {
            return value;
        },
    };
    return {
        container: el as unknown as HTMLElement,
        html: () => value,
    };
}

Deno.test('renders a card per chain with each jti event', () => {
    const rec = record();
    new IdentityTokensPresenter([
        {
            chainId: 'WeXjAaAxGSpLpamfEuvcww',
            events: [
                {
                    jti: 'jmvogLnzTmiQlAkVvDHrvQ',
                    action: 'issued',
                    at: '2026-01-01T00:00:00.000000Z',
                },
                {
                    jti: 'j2', parentJti: 'jmvogLnzTmiQlAkVvDHrvQ',
                    action: 'rotated',
                    at: '2026-01-02T00:00:00.000000Z',
                },
            ],
        },
    ]).render(rec.container);
    const out = rec.html();
    assertMatch(out, /WeXjAaAxGSpLpamfEuvcww/);
    assertMatch(out, /jmvogLnzTmiQlAkVvDHrvQ/);
    assertMatch(out, /j2/);
    assertMatch(out, /issued/);
    assertMatch(out, /rotated/);
    assertMatch(
        out,
        new RegExp(
            'Chain <code class="displayed-id">'
            + 'WeXjAaAxGSpLpamfEuvcww</code>',
        ),
    );
    assertMatch(
        out,
        new RegExp(
            'Token <code class="displayed-id">'
            + 'jmvogLnzTmiQlAkVvDHrvQ</code>',
        ),
    );
    assertMatch(
        out, /Token <code class="displayed-id">j2<\/code>/,
    );
    assertMatch(out, /Parent token —\s*<\/p>/);
    assertMatch(
        out,
        new RegExp(
            'Parent token <code class="displayed-id">'
            + 'jmvogLnzTmiQlAkVvDHrvQ</code>',
        ),
    );
    assertNotMatch(out, /parent:/);
});

Deno.test('renders an empty state when no chains', () => {
    const rec = record();
    new IdentityTokensPresenter([])
        .render(rec.container);
    assertMatch(rec.html(), /No tokens/);
});

function renderChains(
    events: readonly {
        jti: string;
        parentJti?: string;
        action: 'issued' | 'rotated';
    }[],
): string {
    const rec = record();
    new IdentityTokensPresenter([
        {
            chainId: 'c1',
            events: events.map(e => ({
                ...e,
                at: '2026-01-01T00:00:00.000000Z',
            })),
        },
    ]).render(rec.container);
    return rec.html();
}

Deno.test('the first row of each token carries its anchor', () => {
    const out = renderChains([
        { jti: 't1', action: 'issued' },
        { jti: 't1', action: 'rotated' },
    ]);
    assertEquals(out.split('id="token-t1"').length - 1, 1);
    assert(
        out.indexOf('id="token-t1"') < out.indexOf('>issued<'),
        'the anchor sits on the first row, ahead of its badge',
    );
});

Deno.test('a parent token on the page is a link to its row', () => {
    const out = renderChains([
        { jti: 't1', action: 'issued' },
        { jti: 't2', parentJti: 't1', action: 'rotated' },
    ]);
    assertStringIncludes(
        out,
        '<a href="#token-t1">'
        + idLabel('Parent token', 't1').toString()
        + '</a>',
    );
});

Deno.test('a parent token absent from the page is not a link', () => {
    const out = renderChains([
        { jti: 't2', parentJti: 'gone', action: 'rotated' },
    ]);
    assertNotMatch(out, /href="#token-gone"/);
    assertStringIncludes(
        out, idLabel('Parent token', 'gone').toString(),
    );
});

Deno.test('an anchored row clears the sticky header', () => {
    const out = renderChains([{ jti: 't1', action: 'issued' }]);
    assertMatch(
        out, /class="[^"]*\btoken-row\b[^"]*" id="token-t1"/,
    );
});

// A fragment jump aligns its target to the viewport top,
// under the sticky `.top-header`; the row's scroll margin
// lands it below.

const identitiesCss = Deno.readTextFileSync(
    'web-app/app/styles/pages-identities.css',
);
const layoutCss = Deno.readTextFileSync(
    'web-app/app/styles/layout.css',
);

Deno.test('a token row keeps a header-high scroll margin', () => {
    const headerHeight = cssDeclaration(
        layoutCss, '.top-header', 'height',
    );
    assert(headerHeight !== undefined, 'the header height');
    assertEquals(
        cssDeclaration(
            identitiesCss, '.token-row', 'scroll-margin-top',
        ),
        `calc(${headerHeight} + var(--space-2))`,
    );
});
