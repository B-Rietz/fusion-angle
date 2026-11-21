import {
    assertEquals,
    assertMatch,
    assertNotMatch,
    assertStringIncludes,
} from '@std/assert';
import { join } from '@std/path';
import { cssDeclaration } from './fixtures/css-declaration.ts';
import {
    jsonRequested,
    statusAssets,
    statusPageHtml,
    statusUnavailableHtml,
} from '../server/status-page.ts';

// A commit with no commit time renders the same at any
// clock.
const NOW = 0;

function headers(
    init: Record<string, string>,
): Headers {
    return new Headers(init);
}

Deno.test('json is requested only when it wins', () => {
    assertEquals(jsonRequested(headers({})), false);
    assertEquals(jsonRequested(headers({
        accept: '',
    })), false);
    assertEquals(jsonRequested(headers({
        accept: '*/*',
    })), false);
    assertEquals(jsonRequested(headers({
        accept: 'text/json',
    })), false);
    assertEquals(jsonRequested(headers({
        accept: 'application/vnd.api+json',
    })), false);
    assertEquals(jsonRequested(headers({
        accept: 'application/json;q=0',
    })), false);
    assertEquals(jsonRequested(headers({
        accept: 'application/json, text/html',
    })), false);
    assertEquals(jsonRequested(headers({
        accept: 'application/json;q=1.5, text/html',
    })), false);
    assertEquals(jsonRequested(headers({
        accept: 'application/json;q=nan',
    })), false);
    assertEquals(jsonRequested(headers({
        accept: 'application/xhtml+xml,'
            + ' application/json;q=0.5',
    })), false);
    assertEquals(jsonRequested(headers({
        accept: 'application/json',
    })), true);
    assertEquals(jsonRequested(headers({
        accept: 'text/html;q=0.5,'
            + ' application/json;q=0.2,'
            + ' application/json;q=0.9',
    })), true);
    assertEquals(jsonRequested(headers({
        accept: 'application/json;q=2',
    })), true);
    assertEquals(jsonRequested(headers({
        'content-type':
            'application/json; charset=utf-8',
        accept: 'text/html',
    })), true);
});

Deno.test('the status page escapes text', () => {
    const html = statusPageHtml(
        { sha: 'a<b&"c>' },
        { api: 'down' },
        {
            styles: '/assets/styles.0123abcd.css',
            icon: '/assets/favicon.0123abcd.svg',
        },
        NOW,
    );
    assertEquals(
        html.includes('a&lt;b&amp;&quot;c&gt;'),
        true,
    );
    assertEquals(html.includes('a<b'), false);
    const nameAt = html.indexOf(
        '<a class="status-name" href="/">'
        + 'Fusion Angle</a>',
    );
    const ratingAt = html.indexOf('>DOWN</p>');
    const apiAt = html.indexOf(
        '<span class="pill" data-tone="error">'
        + 'API down</span>',
    );
    const shaAt = html.indexOf('class="git-sha');
    assertEquals(nameAt >= 0, true);
    assertEquals(ratingAt > nameAt, true);
    assertEquals(apiAt > ratingAt, true);
    assertEquals(shaAt > apiAt, true);
    assertNotMatch(html, /style=/);
    assertEquals(
        html.includes(
            'href="/assets/styles.0123abcd.css"',
        ),
        true,
    );
});

Deno.test('the status sha clips to seven digits', () => {
    const css = Deno.readTextFileSync(
        'web-app/app/styles/base.css',
    );
    const html = statusPageHtml(
        { sha: '0123456789abcdef0123456789abcdef01234567' },
        { api: 'up' },
        {},
        NOW,
    );
    assertEquals(
        html.includes(
            'class="git-sha font-mono text-foreground"',
        ),
        true,
    );
    assertMatch(
        css,
        /\.git-sha \{[^}]*width: 7ch;[^}]*\}/,
    );
    assertMatch(
        css,
        /\.git-sha \{[^}]*overflow: hidden;[^}]*\}/,
    );
    assertMatch(
        css,
        /\.git-sha \{[^}]*white-space: nowrap;[^}]*\}/,
    );
    assertMatch(
        css,
        /\.git-sha \{[^}]*vertical-align: bottom;[^}]*\}/,
    );
    assertMatch(
        css,
        /\.font-mono \{ font-family: var\(--font-mono\); \}/,
    );
});

Deno.test('status assets keep published names only',
async () => {
    const root = await Deno.makeTempDir({
        prefix: 'fusion-status-assets-',
    });
    try {
        assertEquals(await statusAssets(root), {});
        await Deno.writeTextFile(
            join(root, 'asset-manifest.json'),
            '[]',
        );
        assertEquals(await statusAssets(root), {});
        await Deno.writeTextFile(
            join(root, 'asset-manifest.json'),
            '{',
        );
        assertEquals(await statusAssets(root), {});
        await Deno.writeTextFile(
            join(root, 'asset-manifest.json'),
            JSON.stringify({
                'styles.css':
                    'styles.0123abcd0123abcd.css',
                'favicon.svg': 'not-a-hash.svg',
            }),
        );
        assertEquals(await statusAssets(root), {
            styles: '/assets/'
                + 'styles.0123abcd0123abcd.css',
        });
        await Deno.writeTextFile(
            join(root, 'asset-manifest.json'),
            JSON.stringify({
                'status-refresh.js':
                    'status-refresh.0123abcd0123abcd.js',
            }),
        );
        assertEquals(await statusAssets(root), {
            script: '/assets/'
                + 'status-refresh.0123abcd0123abcd.js',
        });
        await Deno.writeTextFile(
            join(root, 'asset-manifest.json'),
            JSON.stringify({
                'status-refresh.js': '../status-refresh.js',
            }),
        );
        assertEquals(await statusAssets(root), {});
    } finally {
        await Deno.remove(root, { recursive: true });
    }
});

Deno.test('the status card gives one verdict', () => {
    const sha = '0123456789abcdef0123456789abcdef01234567';
    const up = statusPageHtml({ sha }, { api: 'up' }, {}, NOW);
    assertStringIncludes(up, 'id="status-card"');
    assertStringIncludes(
        up,
        'status-card max-w-md p-8 text-center"\n'
        + ' data-tone="success">',
    );
    assertStringIncludes(up, '>UP</p>');
    assertNotMatch(up, /class="pill"/);
    assertStringIncludes(
        up,
        '<a class="status-name" href="/">Fusion Angle</a>',
    );
    const down = statusPageHtml({ sha }, { api: 'down' }, {}, NOW);
    assertStringIncludes(
        down,
        'status-card max-w-md p-8 text-center"\n'
        + ' data-tone="error">',
    );
    assertStringIncludes(down, '>DOWN</p>');
    assertStringIncludes(
        down,
        '<span class="pill" data-tone="error">API down</span>',
    );
    const late = statusPageHtml(
        { sha }, { api: 'timeout' }, {}, NOW,
    );
    assertStringIncludes(
        late,
        '<span class="pill" data-tone="error">API timeout'
        + '</span>',
    );
    assertStringIncludes(
        late,
        'status-card max-w-md p-8 text-center"\n'
        + ' data-tone="error">',
    );
    assertNotMatch(up + down + late, /style=/);
    assertStringIncludes(
        statusUnavailableHtml(),
        '<a href="/">Fusion Angle</a>',
    );
});

Deno.test('the status card names the commit by its subject',
() => {
    const sha = '0123456789abcdef0123456789abcdef01234567';
    const named = statusPageHtml(
        { sha, subject: `<b>"it's" \\ \${x} é` },
        { api: 'up' },
        {},
        NOW,
    );
    assertStringIncludes(
        named,
        '<p class="text-muted text-sm">\n'
        + '<span class="git-sha font-mono text-foreground">'
        + sha + '</span>\n'
        + '</p>\n'
        + '<p class="git-subject text-base">'
        + '&lt;b&gt;&quot;it\'s&quot; \\ ${x} é</p>\n'
        + '</section>',
    );
    assertNotMatch(named, />git sha</);
    assertNotMatch(named, /•/);
    const unnamed = statusPageHtml({ sha }, { api: 'up' }, {}, NOW);
    assertNotMatch(unnamed, /git-subject/);
});

Deno.test('the status card tints like the gauge card', () => {
    const css = Deno.readTextFileSync(
        'web-app/app/styles/components-cards.css',
    );
    for (const tone of ['success', 'error']) {
        const selector = `.status-card[data-tone="${tone}"]`;
        assertEquals(
            cssDeclaration(css, selector, 'background'),
            `hsl(var(--${tone}-soft))`,
        );
        assertEquals(
            cssDeclaration(css, selector, 'border-color'),
            `hsl(var(--${tone}) / 0.4)`,
        );
    }
});

Deno.test('the status page refreshes only with its script',
() => {
    const sha = '0123456789abcdef0123456789abcdef01234567';
    const commit = { sha, subject: 'Keep the "card" & <sha>' };
    const script = '/assets/status-refresh.0123abcd0123abcd.js';
    const live = statusPageHtml(
        commit, { api: 'up' }, { script }, NOW,
    );
    const tag = '<script src="' + script + '" defer></script>';
    assertStringIncludes(live, tag);
    assertEquals(
        live.indexOf(tag) < live.indexOf('</head>'),
        true,
    );
    assertStringIncludes(
        live,
        '<div id="status-live" aria-live="polite">\n'
        + '<section id="status-card"',
    );
    const open = '<template id="status-timeout">';
    const templateAt = live.indexOf(open);
    assertEquals(templateAt > live.indexOf('</div>'), true);
    const timeout = live.slice(
        templateAt + open.length,
        live.indexOf('</template>'),
    );
    assertStringIncludes(
        timeout,
        'status-card max-w-md p-8 text-center"\n'
        + ' data-tone="error">',
    );
    assertStringIncludes(timeout, '>DOWN</p>');
    assertEquals(timeout.match(/class="pill"/g)?.length, 1);
    assertStringIncludes(
        timeout,
        '<span class="pill" data-tone="error">Timeout</span>',
    );
    assertStringIncludes(
        timeout,
        '<p class="text-muted text-sm">\n'
        + '<span class="git-sha font-mono text-foreground">'
        + sha + '</span>\n'
        + '</p>\n'
        + '<p class="git-subject text-base">'
        + 'Keep the &quot;card&quot; &amp; &lt;sha&gt;</p>',
    );
    assertNotMatch(live, /style=/);
    const still = statusPageHtml(commit, { api: 'up' }, {
        styles: '/assets/styles.0123abcd.css',
        icon: '/assets/favicon.0123abcd.svg',
    }, NOW);
    assertNotMatch(still, /<script/);
    assertNotMatch(still, /status-live/);
    assertNotMatch(still, /<template/);
    assertNotMatch(statusUnavailableHtml(), /<script/);
});

const SHA = '0123456789abcdef0123456789abcdef01234567';
const HISTORY_SHA = 'fedcba9876543210fedcba9876543210fedcba98';
const OLDER_SHA = 'abcdefabcdefabcdefabcdefabcdefabcdefabcd';
const COMMITTED_AT = '2026-11-20T00:00:00.000Z';
const COMMITTED_MS = Date.parse(COMMITTED_AT);

function ageTag(age: string): string {
    return '<time class="git-age" aria-live="off" datetime="'
        + COMMITTED_AT + '">' + age + '</time>';
}

Deno.test('the status card ages the commit', () => {
    const commit = { sha: SHA, committedAt: COMMITTED_AT };
    const aged = statusPageHtml(
        commit, { api: 'up' }, {}, COMMITTED_MS + 90_000,
    );
    assertStringIncludes(
        aged,
        '<p class="text-muted text-sm">\n'
        + ageTag('2 minutes ago')
        + '\n<span aria-hidden="true">•</span>\n'
        + '<span class="git-sha font-mono text-foreground">'
        + SHA + '</span>\n</p>',
    );
    const ageAt = aged.indexOf(ageTag('2 minutes ago'));
    assertEquals(ageAt < aged.indexOf('class="git-sha'), true);
    assertEquals(ageAt < aged.indexOf('</section>'), true);
    assertStringIncludes(
        statusPageHtml(commit, { api: 'up' }, {}, COMMITTED_MS),
        ageTag('now'),
    );
});

Deno.test('the history follows the commit inside the card',
() => {
    const html = statusPageHtml(
        {
            sha: SHA,
            subject: 'Head',
            history: [{
                sha: HISTORY_SHA,
                subject: 'Land <the> commit',
                committedAt: COMMITTED_AT,
            }, { sha: OLDER_SHA }],
        },
        { api: 'up' },
        { script: '/assets/status-refresh.0123abcd.js' },
        COMMITTED_MS + 3 * 60 * 60 * 1_000,
    );
    assertStringIncludes(
        html,
        '<p class="git-subject text-base">Head</p>\n'
        + '<hr class="status-rule mt-8 mb-8">\n'
        + '<ol class="flex flex-col gap-5"'
        + ' aria-label="Recent commits">\n'
        + '<li>\n<p class="text-muted text-xsm">\n'
        + ageTag('3 hours ago') + '\n'
        + '<span aria-hidden="true">•</span>\n'
        + '<span class="git-sha font-mono">' + HISTORY_SHA
        + '</span>\n</p>\n'
        + '<p class="git-subject text-sm text-soft">'
        + 'Land &lt;the&gt; commit</p>\n</li>\n'
        + '<li>\n<p class="text-muted text-xsm">\n'
        + '<span class="git-sha font-mono">' + OLDER_SHA
        + '</span>\n</p>\n</li>\n'
        + '</ol>\n</section>',
    );
    assertEquals(
        html.match(/aria-label="Recent commits"/g)?.length,
        2,
    );
    assertNotMatch(html, /status-merges|Recent merges/);
    assertNotMatch(html, /style=/);
    for (const history of [undefined, []]) {
        const bare = statusPageHtml(
            { sha: SHA, ...(history ? { history } : {}) },
            { api: 'up' },
            {},
            NOW,
        );
        assertNotMatch(bare, /<hr/);
        assertNotMatch(bare, /<ol/);
    }
});

Deno.test('both status pages pad the main', () => {
    const padded = ' bg-background py-8">';
    assertStringIncludes(
        statusPageHtml({ sha: SHA }, { api: 'up' }, {}, NOW),
        padded,
    );
    assertStringIncludes(statusUnavailableHtml(), padded);
});

Deno.test('the status history has its type, tone, and rule',
() => {
    const read = (name: string): string =>
        Deno.readTextFileSync(
            'web-app/app/styles/' + name,
        );
    assertStringIncludes(
        read('tokens.css'), '--text-xsm: 0.8125rem;',
    );
    assertStringIncludes(
        read('base.css'),
        '.text-xsm { font-size: var(--text-xsm);'
        + ' line-height: 1.125rem; }',
    );
    assertStringIncludes(
        read('palette.css'),
        '--soft-foreground: var(--gray-300);',
    );
    assertStringIncludes(
        read('utilities.css'),
        '.text-soft { color: hsl(var(--soft-foreground)); }',
    );
    const cards = read('components-cards.css');
    assertEquals(
        cssDeclaration(cards, '.status-rule', 'border'),
        'none',
    );
    assertEquals(
        cssDeclaration(cards, '.status-rule', 'border-top'),
        '1px solid',
    );
    assertEquals(
        cssDeclaration(
            cards, '.status-rule', 'border-top-color',
        ),
        'inherit',
    );
});
