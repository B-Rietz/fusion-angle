import {
    assert,
    assertMatch,
    assertNotMatch,
} from '@std/assert';
import type {
    ApiDocStatus,
} from '../web-app/api-documentation/rooms.ts';
import {
    statusHtml,
    unknownHtml,
} from '../web-app/api-documentation/presenter.ts';

const status: ApiDocStatus = {
    hash: 'statuses/401',
    code: '401',
    body: '{\n  "error": "invalid_token"\n}',
};

Deno.test('statusHtml paints code and body', () => {
    const markup = statusHtml(status).toString();
    assertMatch(markup, /<h1[^>]*>401<\/h1>/);
    assertMatch(markup, /invalid_token/);
    assertNotMatch(markup, /style=/);
});

Deno.test('unknownHtml names the miss', () => {
    const markup = unknownHtml('not-a-room').toString();
    assert(markup.length > 0);
    assertMatch(markup, /Not a room/);
    assertMatch(markup, /not-a-room/);
    assertNotMatch(markup, /data-api-docs-back/);
    assertNotMatch(markup, /style=/);
});
