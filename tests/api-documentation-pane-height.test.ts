// The pane height the stylesheet names is the operator's
// formula over every sample's request and response block
// as the side-by-side pane paints it: exp(mean(ln h) +
// sd(ln h)), population SD, to a whole pixel. A block's
// height h is its lines, wrapped as Chrome wraps a
// pre-wrap block at PANE_COLUMNS, by PANE_LINE_PX, plus
// PANE_CHROME_PX. The browser checks those three against
// the real pane, so a sample whose height moves the
// formula fails here until the stylesheet follows.

import { assert, assertStrictEquals } from '@std/assert';
import {
    PANE_CHROME_PX,
    PANE_COLUMNS,
    PANE_LINE_PX,
} from './fixtures/api-documentation-pane.ts';
import { cssDeclaration } from './fixtures/css-declaration.ts';
import {
    endpointHtml,
    stepHtml,
} from '../web-app/api-documentation/presenter.ts';
import {
    API_DOC_ROOMS,
    API_DOC_STEPS,
} from '../web-app/api-documentation/rooms.ts';
import {
    type ApiDocSample,
    readSample,
} from '../web-app/api-documentation/shapes.ts';

const TREE = 'web-app/api-documentation/';
const STYLESHEET = 'web-app/app/styles/pages-api-documentation.css';
const ORIGIN = 'https://docs.example';

function sampleAt(path: string): ApiDocSample {
    const read = readSample(
        JSON.parse(Deno.readTextFileSync(TREE + path)),
    );
    if (read.kind === 'fault') {
        throw new Error(path + ': ' + read.reason);
    }
    return read.sample;
}

// Every view's markup with its sample painted.
function viewsMarkup(): readonly string[] {
    const endpoints = API_DOC_ROOMS.flatMap((room) =>
        room.sample.kind === 'sample'
            ? [endpointHtml(room, {
                kind: 'sample', sample: sampleAt(room.sample.path),
            }, ORIGIN).toString()]
            : []
    );
    const steps = API_DOC_STEPS.map((step) => {
        assert(step.sample.kind === 'sample', step.hash);
        return stepHtml(step, {
            kind: 'sample', sample: sampleAt(step.sample.path),
        }, ORIGIN).toString();
    });
    return [...endpoints, ...steps];
}

const MESSAGE_BLOCK =
    /<pre class="api-doc-pre api-doc-message">([\s\S]*?)<\/pre>/g;

// A highlight's name is for a reader who sees no shape or
// colour, and takes no room on its line.
const UNSEEN_LABEL = /<span class="sr-only">[^<]*<\/span>/g;
const TAG = /<[^>]*>/g;
const ESCAPE = /&(?:amp|lt|gt|quot|#39);/g;
const ESCAPED: Readonly<Record<string, string>> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
};

// The text a message block shows.
function blocksOf(markup: string): readonly string[] {
    return [...markup.matchAll(MESSAGE_BLOCK)].map(([, inner]) =>
        inner!
            .replace(UNSEEN_LABEL, '')
            .replace(TAG, '')
            .replace(ESCAPE, (escape) => ESCAPED[escape]!)
    );
}

const WORD_CHARACTER = /[A-Za-z0-9]/;
const OPENS = '[{(';
const BEFORE_OPEN = ',:}]';

// Where Chrome may break a line of a sample, after the
// character at `at`: after a space a non-space follows,
// after a hyphen inside a word, and between a separator
// or a close and an opening bracket.
function breaksAfter(line: string, at: number): boolean {
    const here = line[at]!;
    const next = line[at + 1]!;
    return (here === ' ' && next !== ' ')
        || (here === '-'
            && at > 0
            && WORD_CHARACTER.test(line[at - 1]!)
            && WORD_CHARACTER.test(next))
        || (BEFORE_OPEN.includes(here) && OPENS.includes(next));
}

// A line's pieces, each ending where a break may fall.
function piecesOf(line: string): readonly string[] {
    const pieces: string[] = [];
    let from = 0;
    for (let at = 0; at < line.length - 1; at += 1) {
        if (breaksAfter(line, at)) {
            pieces.push(line.slice(from, at + 1));
            from = at + 1;
        }
    }
    return [...pieces, line.slice(from)];
}

// The lines one line of text fills: each piece goes on
// the current line when it fits, spaces at a line's end
// hanging past it; one wider than a line is cut, as
// overflow-wrap: anywhere cuts it.
function wrappedLines(line: string): number {
    let lines = 1;
    let used = 0;
    for (const piece of piecesOf(line)) {
        const shown = piece.replace(/ +$/, '').length;
        if (used + shown <= PANE_COLUMNS) {
            used += piece.length;
            continue;
        }
        if (used > 0) {
            lines += 1;
            used = 0;
        }
        const cuts = Math.max(0, Math.ceil(shown / PANE_COLUMNS) - 1);
        lines += cuts;
        used = piece.length - cuts * PANE_COLUMNS;
    }
    return lines;
}

function heightOf(block: string): number {
    const lines = block.split('\n')
        .reduce((sum, line) => sum + wrappedLines(line), 0);
    return lines * PANE_LINE_PX + PANE_CHROME_PX;
}

function paneHeightOf(heights: readonly number[]): number {
    const logs = heights.map(Math.log);
    const mean = logs.reduce((sum, log) => sum + log, 0) / logs.length;
    const variance = logs
        .reduce((sum, log) => sum + (log - mean) ** 2, 0) / logs.length;
    return Math.round(Math.exp(mean + Math.sqrt(variance)));
}

Deno.test('the named pane height is the formula over every'
    + ' sample block', () => {
    const blocks = viewsMarkup().flatMap(blocksOf);
    assert(blocks.length > 0);
    const declared = cssDeclaration(
        Deno.readTextFileSync(STYLESHEET),
        '.api-doc-panes',
        '--api-doc-pane-height',
    );
    assertStrictEquals(
        declared, paneHeightOf(blocks.map(heightOf)) + 'px',
    );
});
