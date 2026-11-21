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
    );
    assertEquals(
        html.includes('class="git-sha font-mono text-sm"'),
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
    const up = statusPageHtml({ sha }, { api: 'up' }, {});
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
    const down = statusPageHtml({ sha }, { api: 'down' }, {});
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
        { sha }, { api: 'timeout' }, {},
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
    );
    assertStringIncludes(
        named,
        '<p class="git-sha font-mono text-sm">\n'
        + sha + '\n</p>\n'
        + '<p class="git-subject text-sm">\n'
        + '&lt;b&gt;&quot;it\'s&quot; \\ ${x} é\n</p>\n'
        + '</section>',
    );
    const unnamed = statusPageHtml({ sha }, { api: 'up' }, {});
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
        commit, { api: 'up' }, { script },
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
        '<p class="git-sha font-mono text-sm">\n'
        + sha + '\n</p>\n'
        + '<p class="git-subject text-sm">\n'
        + 'Keep the &quot;card&quot; &amp; &lt;sha&gt;\n</p>',
    );
    assertNotMatch(live, /style=/);
    const still = statusPageHtml(commit, { api: 'up' }, {
        styles: '/assets/styles.0123abcd.css',
        icon: '/assets/favicon.0123abcd.svg',
    });
    assertNotMatch(still, /<script/);
    assertNotMatch(still, /status-live/);
    assertNotMatch(still, /<template/);
    assertNotMatch(statusUnavailableHtml(), /<script/);
});
