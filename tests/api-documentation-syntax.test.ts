import {
    assert,
    assertEquals,
    assertNotMatch,
    assertStrictEquals,
    assertStringIncludes,
} from '@std/assert';
import {
    API_DOC_ROOMS,
    API_DOC_STEPS,
    type ApiDocRoom,
} from '../web-app/api-documentation/rooms.ts';
import { endpointHtml } from
    '../web-app/api-documentation/presenter.ts';
import {
    type ApiDocBody,
    type ApiDocSample,
    readSample,
} from '../web-app/api-documentation/shapes.ts';
import {
    curlHtml,
    jsonHtml,
} from '../web-app/api-documentation/syntax.ts';
import { escapeForHtml } from '../web-app/app/safe-html.ts';

// The page's samples sit beside its catalog, at the path
// each entry names.
const PAGE_DIRECTORY = 'web-app/api-documentation/';

const ENTITIES: Readonly<Record<string, string>> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
};

// What a browser's `textContent` reads from this markup:
// its tags dropped and its five escapes undone.
function textContentOf(markup: string): string {
    return markup.replace(/<[^>]*>/g, '')
        .replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) =>
            ENTITIES[entity]!
        );
}

function committedSamples(): readonly ApiDocSample[] {
    const paths = [...API_DOC_ROOMS, ...API_DOC_STEPS]
        .flatMap(({ sample }) =>
            sample.kind === 'sample' ? [sample.path] : []
        );
    assert(paths.length > 0);
    return paths.map((path) => {
        const read = readSample(JSON.parse(
            Deno.readTextFileSync(PAGE_DIRECTORY + path),
        ));
        if (read.kind === 'fault') {
            throw new Error(path + ': ' + read.reason);
        }
        return read.sample;
    });
}

function textsOf(body: ApiDocBody): readonly string[] {
    switch (body.kind) {
        case 'empty':
            return [];
        case 'text':
            return [body.text];
        case 'multipart':
            return body.parts.flatMap((part) => textsOf(part.body));
    }
}

Deno.test('every character of a sample survives its colour', () => {
    let curls = 0;
    let bodies = 0;
    for (const sample of committedSamples()) {
        for (const exchange of sample.exchanges) {
            assertStrictEquals(
                textContentOf(curlHtml(exchange.curl).toString()),
                exchange.curl,
            );
            curls += 1;
            const texts = [
                ...textsOf(exchange.request.body),
                ...textsOf(exchange.response.body),
            ];
            for (const text of texts) {
                assertStrictEquals(
                    textContentOf(jsonHtml(text).toString()), text,
                );
                bodies += 1;
            }
        }
    }
    assert(curls > 0 && bodies > 0);
    const odd = '{\n\t"a\\"b": "x\\\\y \\u2028 \'q\' & <z>",'
        + ' "n": [-0.5e-3, 0, 12] }';
    assertStrictEquals(textContentOf(jsonHtml(odd).toString()), odd);
    const shell = 'curl -d \'it\'\\\'\'s\' "a\\"b $X" \\\n  -H "c"';
    assertStrictEquals(
        textContentOf(curlHtml(shell).toString()), shell,
    );
});

Deno.test('keys, strings, numbers, and literals carry their'
    + ' classes', () => {
    const markup = jsonHtml(
        '{"name": "Owner\'s", "count": -1.5e3,'
            + ' "on": true, "off": false, "gone": null}',
    ).toString();
    for (const span of [
        '<span class="tok-punct">{</span>',
        '<span class="tok-key">&quot;name&quot;</span>',
        '<span class="tok-punct">:</span>',
        '<span class="tok-string">&quot;Owner&#39;s&quot;</span>',
        '<span class="tok-punct">,</span>',
        '<span class="tok-key">&quot;count&quot;</span>',
        '<span class="tok-number">-1.5e3</span>',
        '<span class="tok-literal">true</span>',
        '<span class="tok-literal">false</span>',
        '<span class="tok-literal">null</span>',
        '<span class="tok-punct">}</span>',
    ]) {
        assertStringIncludes(markup, span);
    }
});

Deno.test('$TOKEN inside a curl string carries tok-var', () => {
    const markup = curlHtml(
        'curl -i -X GET "$ORIGIN/api/x" \\\n'
            + '  -H "authorization: Bearer $TOKEN" \\\n'
            + '  -d \'{"code":"\'"$CHALLENGE"\'"}\'',
    ).toString();
    assertStringIncludes(
        markup,
        '<span class="tok-string">&quot;authorization: Bearer '
            + '<span class="tok-var">$TOKEN</span>&quot;</span>',
    );
    // The body closes its single quote so the shell
    // expands the placeholder.
    assertStringIncludes(
        markup,
        '<span class="tok-string">&#39;{&quot;code&quot;:'
            + '&quot;&#39;</span><span class="tok-string">&quot;'
            + '<span class="tok-var">$CHALLENGE</span>'
            + '&quot;</span>',
    );
    for (const flag of ['-i', '-X', '-H', '-d']) {
        assertStringIncludes(
            markup, '<span class="tok-flag">' + flag + '</span>',
        );
    }
});

Deno.test('a <script> inside a JSON string comes out escaped',
() => {
    const script = '<script>alert(1)</script>';
    for (const markup of [
        jsonHtml('{"title":"' + script + '"}').toString(),
        curlHtml('curl -d \'{"title":"' + script + '"}\'')
            .toString(),
    ]) {
        assertStringIncludes(markup, escapeForHtml(script));
        assertNotMatch(markup, /<script/);
    }
});

Deno.test('text that is not JSON stays escaped plain text', () => {
    const text = 'not json: <b>"bold"</b> & \'more\'';
    const markup = jsonHtml(text).toString();
    assertStrictEquals(markup, escapeForHtml(text));
    assertNotMatch(markup, /tok-/);
});

// A placeholder the reader sets in their shell.
const PLACEHOLDER = /\$[A-Z_][A-Z0-9_]*/g;

Deno.test('every placeholder in a committed curl carries tok-var',
() => {
    for (const sample of committedSamples()) {
        for (const { curl } of sample.exchanges) {
            const markup = curlHtml(curl).toString();
            assertStrictEquals(
                [...markup.matchAll(
                    /<span class="tok-var">([^<]*)<\/span>/g,
                )].map((span) => span[1]).join(' '),
                [...curl.matchAll(PLACEHOLDER)]
                    .map((placeholder) => placeholder[0]).join(' '),
                curl,
            );
        }
    }
});

const ORIGIN = 'https://docs.example';

// The message blocks of an endpoint's markup, in order:
// each request, then its response.
function messagesOf(markup: string): readonly string[] {
    return [...markup.matchAll(
        /<pre class="api-doc-pre api-doc-message">([\s\S]*?)<\/pre>/g,
    )].map((pre) => pre[1]!);
}

// A search of the memberships: a JSON request body, and
// a response whose parts are JSON.
const QUERY_HASH = 'query/organizations/id/memberships';

function querySample(): ApiDocSample {
    const sample = committedSamples().find((sample) =>
        sample.hash === QUERY_HASH
    );
    assert(sample !== undefined);
    return sample;
}

function queryRoom(): ApiDocRoom {
    const room = API_DOC_ROOMS.find((entry) =>
        entry.hash === QUERY_HASH
    );
    assert(room !== undefined);
    return room;
}

Deno.test('a JSON body is coloured, its headers plain',
() => {
    const sample = querySample();
    const markup = endpointHtml(
        queryRoom(), { kind: 'sample', sample }, ORIGIN,
    ).toString();
    const [request, response] = messagesOf(markup);
    assert(request !== undefined && response !== undefined);
    const exchange = sample.exchanges[0]!;
    const sent = textsOf(exchange.request.body);
    const parts = textsOf(exchange.response.body);
    assert(sent.length === 1 && parts.length > 0);
    assert(exchange.response.body.kind === 'multipart');
    for (const [message, texts] of [
        [request, sent],
        [response, parts],
    ] as const) {
        assertStringIncludes(message, '<span class="tok-key">');
        for (const text of texts) {
            assertStringIncludes(textContentOf(message), text);
        }
    }
    for (const [name, value] of exchange.request.headers) {
        assertStringIncludes(request, escapeForHtml(name + ': ' + value));
    }
    assertEquals(
        [...markup.matchAll(
            /<pre[^>]*data-api-docs-curl>([\s\S]*?)<\/pre>/g,
        )].map((pre) => textContentOf(pre[1]!)),
        sample.exchanges.map(
            (each) => each.curl.split('$ORIGIN').join(ORIGIN),
        ),
    );
});

Deno.test('a body of another media type stays plain', () => {
    const sample = querySample();
    const exchange = sample.exchanges[0]!;
    const text = '{"looks":"like JSON"}';
    const markup = endpointHtml(queryRoom(), {
        kind: 'sample',
        sample: {
            ...sample,
            exchanges: [{
                ...exchange,
                request: {
                    ...exchange.request,
                    body: { kind: 'text', mediaType: 'text/plain', text },
                },
                response: { ...exchange.response, body: { kind: 'empty' } },
            }],
        },
    }, ORIGIN).toString();
    const [request] = messagesOf(markup);
    assert(request !== undefined);
    assertStringIncludes(request, escapeForHtml(text));
    assertNotMatch(request, /tok-/);
});
