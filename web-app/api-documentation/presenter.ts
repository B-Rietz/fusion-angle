import { html, type SafeHtml } from
    '../app/safe-html.ts';
import {
    API_DOC_CURL_ADDS,
    API_DOC_GENERIC_ANSWERS,
    API_DOC_ROOMS,
    API_DOC_TRANSPORT,
    type ApiDocAnswer,
    type ApiDocRoom,
    type ApiDocStatus,
    type ApiDocStep,
} from './rooms.ts';
import {
    API_DOC_ROLE_NAMES,
    API_DOC_TIER_LABELS,
    API_DOC_TIER_ROLES,
    type ApiDocBody,
    type ApiDocExchange,
    type ApiDocHeader,
    type ApiDocHeaderLine,
    type ApiDocHeaderSet,
    type ApiDocLink,
    type ApiDocPathId,
    type ApiDocQueryParameter,
    type ApiDocSampleRef,
    type ApiDocTier,
    type SampleRead,
} from './shapes.ts';
import {
    type Highlight,
    requestHighlightOf,
    responseHighlightOf,
    roomCalledBy,
} from './highlights.ts';
import type { SearchHit } from './search.ts';
import { curlHtml, jsonHtml } from './syntax.ts';

// What an open endpoint knows of its sample: still on its
// way, or read, or the fault that kept it out.
export type SampleState =
    | { readonly kind: 'loading' }
    | SampleRead;

// The curl text's stand-in for the server it reaches; the
// page puts its own origin there.
const ORIGIN_PLACEHOLDER = '$ORIGIN';

// A multipart body's delimiter is its boundary after two
// dashes, and the close adds two more (RFC 2046 §5.1.1).
const MULTIPART_DASHES = '--';

// The step of the guided start that states what every
// request carries: the transport headers, the headers
// curl adds, and the answers any request may get.
const EVERY_REQUEST_STEP = 'start/operation-id';

// A body is JSON by this media type or its suffix
// (RFC 6839 §3.1), as the generator judges it.
const JSON_MEDIA_TYPE = 'application/json';
const JSON_SUFFIX = '+json';

// A shell line that sets a variable opens with its name.
const SETS_VARIABLE = /^([A-Z_][A-Z0-9_]*)=/;

// A chip for each role that may call: the tier's shape on
// the grid beside the role's name, so a role never rests
// on colour alone.
function roleChipsHtml(tier: ApiDocTier): SafeHtml {
    return html`
        <div class="flex flex-wrap gap-2 mt-2" role="group" data-tier="${
            tier
        }" aria-label="${
            'Who may call: ' + API_DOC_TIER_LABELS[tier]
        }">
            ${API_DOC_TIER_ROLES[tier].map((role) => html`
                <span class="api-doc-role api-doc-role-${tier}">
                <span class="api-doc-role-shape" aria-hidden="true"></span>${
                    role
                }</span>
            `)}
        </div>
    `;
}

function headerStateText(header: ApiDocHeader): string {
    return header.state === 'alternative'
        ? 'one of ' + header.alternatives.join(', ')
        : header.state;
}

function headerLineOf(header: ApiDocHeader): string {
    return header.name + ': ' + headerStateText(header);
}

function headerSetHtml(set: ApiDocHeaderSet): SafeHtml {
    return html`
        ${set.when === '' ? '' : html`
            <p class="text-muted mt-2">${set.when}</p>
        `}
        <ul class="api-doc-list">
            ${set.headers.map((header) => html`
                <li>${headerLineOf(header)}</li>
            `)}
        </ul>
    `;
}

function queryHtml(
    query: readonly ApiDocQueryParameter[],
): SafeHtml | string {
    if (query.length === 0) return '';
    return html`
        <h2 class="mt-4 text-sm font-semibold">
            Query</h2>
        <ul class="api-doc-list">
            ${query.map((parameter) => html`
                <li>
                    <code class="font-mono">${
                        '?' + parameter.name + '='
                    }</code>${
                        ' one of ' + parameter.values.join(', ')
                    }
                    <p class="text-muted">${
                        'Absent: ' + parameter.absent
                    }</p>
                </li>
            `)}
        </ul>
    `;
}

function answersHtml(answers: readonly ApiDocAnswer[]): SafeHtml {
    return html`
        <ul class="api-doc-list">
            ${answers.map((answer) => html`
                <li><a href="${
                    '#statuses/' + answer.code
                }">${answer.code}</a>${
                    ' ' + answer.line
                }</li>
            `)}
        </ul>
    `;
}

function relatedHtml(
    links: readonly ApiDocLink[],
): SafeHtml | string {
    if (links.length === 0) return '';
    return html`
        <h2 class="mt-4 text-sm font-semibold">
            Related</h2>
        <ul class="api-doc-list">
            ${links.map((link) => html`
                <li><a href="${
                    '#' + link.hash
                }">${link.label}</a></li>
            `)}
        </ul>
    `;
}

function noSampleHtml(
    sample: ApiDocSampleRef,
): SafeHtml | string {
    if (sample.kind === 'sample') return '';
    return html`
        <h2 class="mt-4 text-sm font-semibold">
            No sample</h2>
        <p class="mt-2">${sample.reason}</p>
    `;
}

// An endpoint's facts: who may call, what to send, what
// comes back, and where to go next.
export function roomHtml(room: ApiDocRoom): SafeHtml {
    return html`
        <h1 class="font-mono text-xl api-doc-title" tabindex="-1">${
            room.verb + ' ' + room.uri
        }</h1>
        ${roleChipsHtml(room.tier)}
        <h2 class="mt-4 text-sm font-semibold">
            Headers</h2>
        ${room.headerSets.map(headerSetHtml)}
        ${queryHtml(room.query)}
        <h2 class="mt-4 text-sm font-semibold">
            Answers</h2>
        ${answersHtml(room.answers)}
        ${relatedHtml(room.related)}
        ${noSampleHtml(room.sample)}
    `;
}

// A highlight a header line takes.
type Highlighted = Exclude<Highlight, 'plain'>;

// Each highlight's name, which labels its lines, and what
// the legend says of it.
const HIGHLIGHT_WORDS: Readonly<Record<Highlighted, {
    readonly name: string;
    readonly meaning: string;
}>> = {
    essential: {
        name: 'Essential',
        meaning: 'a header this documentation names',
    },
    provided: {
        name: 'Provided',
        meaning: 'a header the API sets for you to use',
    },
};

// The highlights, in the legend's order.
const HIGHLIGHTS: readonly Highlighted[] = ['essential', 'provided'];

// A highlight's band, with its shape before its words: a
// highlight never rests on colour alone.
function highlightHtml(
    highlight: Highlighted,
    shape: SafeHtml,
    words: string,
): SafeHtml {
    return html`<mark class="api-doc-highlight api-doc-highlight-${
        highlight
    }">${shape}${words}</mark>`;
}

// The shape where words beside it name the highlight.
const UNNAMED_SHAPE =
    html`<span class="api-doc-highlight-shape" aria-hidden="true"></span>`;

// The shape where it alone names the highlight: on a
// message's line, whose text is the header as sent, so a
// copied line holds no highlight's name.
function namedShapeHtml(highlight: Highlighted): SafeHtml {
    return html`<span class="api-doc-highlight-shape" aria-label="${
        HIGHLIGHT_WORDS[highlight].name
    }" role="img"></span>`;
}

// What each highlight means, above the messages it marks.
function legendHtml(): SafeHtml {
    return html`
        <ul class="api-doc-legend" aria-label="Header highlights">
            ${HIGHLIGHTS.map((highlight) => html`
                <li>${
                    highlightHtml(
                        highlight, UNNAMED_SHAPE,
                        HIGHLIGHT_WORDS[highlight].name,
                    )
                }${' ' + HIGHLIGHT_WORDS[highlight].meaning}</li>
            `)}
        </ul>
    `;
}

// The highlight a header takes, by its name.
type HighlightOf = (name: string) => Highlight;

// A line of a message: plain text, a highlighted header,
// or a body coloured by its media type.
type MessageLine = string | SafeHtml;

// A header line as sent: its name, then its value. A
// highlighted line's shape carries its highlight's name,
// for a reader who sees neither its shape nor its colour.
function headerLineHtml(
    [name, value]: ApiDocHeaderLine,
    highlightOf: HighlightOf,
): MessageLine {
    const text = name + ': ' + value;
    const highlight = highlightOf(name);
    if (highlight === 'plain') return text;
    return highlightHtml(highlight, namedShapeHtml(highlight), text);
}

function moreText(count: number): string {
    return '… ' + count + ' more '
        + (count === 1 ? 'part' : 'parts');
}

// A message as it reads on the wire: the start line, each
// header, a blank line, then the body. A collection's
// parts follow their delimiters, and the parts not kept
// are counted before the close. A part's headers take the
// highlights the message's own do.
function messageLines(
    start: string,
    headers: readonly ApiDocHeaderLine[],
    body: ApiDocBody,
    highlightOf: HighlightOf,
): readonly MessageLine[] {
    return [
        start,
        ...headers.map((line) => headerLineHtml(line, highlightOf)),
        ...bodyLines(body, highlightOf),
    ];
}

function isJsonMediaType(mediaType: string): boolean {
    return mediaType === JSON_MEDIA_TYPE
        || mediaType.endsWith(JSON_SUFFIX);
}

function bodyLines(
    body: ApiDocBody,
    highlightOf: HighlightOf,
): readonly MessageLine[] {
    switch (body.kind) {
        case 'empty':
            return [];
        case 'text':
            return [
                '',
                isJsonMediaType(body.mediaType)
                    ? jsonHtml(body.text)
                    : body.text,
            ];
        case 'multipart': {
            const delimiter = MULTIPART_DASHES + body.boundary;
            return [
                '',
                ...body.parts.flatMap((part) => [
                    delimiter,
                    ...messageLines(
                        String(part.status), part.headers, part.body,
                        highlightOf,
                    ),
                ]),
                ...(body.more === 0 ? [] : [moreText(body.more)]),
                delimiter + MULTIPART_DASHES,
            ];
        }
    }
}

function linesHtml(lines: readonly MessageLine[]): SafeHtml {
    return html`${lines.map((line, index) =>
        index === 0 ? line : html`\n${line}`
    )}`;
}

// What decides an exchange's highlights: the endpoint it
// calls, whose header sets list what a request sends, and
// the open view's words, which name what a response
// carries.
interface ExchangeFacts {
    readonly room: ApiDocRoom;
    readonly words: readonly string[];
}

type ExchangeFactsOf = (exchange: ApiDocExchange) => ExchangeFacts;

function answerLinesOf(room: ApiDocRoom): readonly string[] {
    return room.answers.map((answer) => answer.line);
}

// The curl text is painted as stored, its origin aside:
// every other byte is what the replay sent.
export function exchangeHtml(
    exchange: ApiDocExchange,
    origin: string,
    { room, words }: ExchangeFacts,
): SafeHtml {
    const curl = exchange.curl
        .split(ORIGIN_PLACEHOLDER).join(origin);
    const { request, response } = exchange;
    const requestHtml = linesHtml(messageLines(
        request.method + ' ' + request.target,
        request.headers,
        request.body,
        (name) => requestHighlightOf(name, room),
    ));
    const responseHtml = linesHtml(messageLines(
        String(response.status), response.headers, response.body,
        (name) => responseHighlightOf(name, words),
    ));
    return html`
        <section class="api-doc-exchange">
            <div class="flex items-center justify-between gap-2">
                <h3 class="text-sm font-semibold">curl</h3>
                <button type="button"
                    class="btn btn-outline btn-sm"
                    aria-label="${
                        'Copy the curl for ' + request.method + ' '
                            + request.target
                    }"
                    data-api-docs-copy>Copy</button>
            </div>
            <pre class="api-doc-pre api-doc-shell"
                data-api-docs-curl>${curlHtml(curl)}</pre>
            ${legendHtml()}
            <div class="api-doc-panes">
                <div>
                    <h3 class="mt-4 text-sm font-semibold">Request</h3>
                    <pre class="api-doc-pre api-doc-message">${
                        requestHtml
                    }</pre>
                </div>
                <div>
                    <h3 class="mt-4 text-sm font-semibold">Response</h3>
                    <pre class="api-doc-pre api-doc-message">${
                        responseHtml
                    }</pre>
                </div>
            </div>
        </section>
    `;
}

function endpointTitleOf(hash: string): string {
    const room = API_DOC_ROOMS.find((entry) => entry.hash === hash);
    return room === undefined ? hash : room.verb + ' ' + room.uri;
}

// An id in the sample's path is the sample server's, so a
// reader puts their own in its place: the caller's own id,
// or one the listing named by `source` returns.
function pathIdHtml(pathId: ApiDocPathId): SafeHtml {
    if (pathId.source === '') {
        return html`
            <li><mark data-path-id class="api-doc-path-id" title="${
                'Replace with your own ' + pathId.name + '.'
            }">${pathId.value}</mark>${
                ' is ' + pathId.name + ', the caller\'s own.'
            }</li>
        `;
    }
    const source = endpointTitleOf(pathId.source);
    return html`
        <li><mark data-path-id class="api-doc-path-id" title="${
            'Replace with your ' + pathId.name + '; '
                + source + ' lists it.'
        }">${pathId.value}</mark>${
            ' is ' + pathId.name + '; '
        }<a href="${'#' + pathId.source}">${source}</a>${
            ' lists yours.'
        }</li>
    `;
}

function pathIdsHtml(
    pathIds: readonly ApiDocPathId[],
): SafeHtml | string {
    if (pathIds.length === 0) return '';
    return html`
        <h3 class="text-sm font-semibold">Ids in this sample</h3>
        <ul class="api-doc-list mb-4">${pathIds.map(pathIdHtml)}</ul>
    `;
}

const LOADING_WORDS = 'Loading the sample.';

function faultWords(reason: string): string {
    return 'The sample did not load: ' + reason;
}

// What the page's one sample live region says of the open
// view's sample: the page keeps that region and changes its
// text, so a reader hears each change, and the view paints
// the same words where they are seen. A sample read says
// nothing.
export function sampleAnnouncementText(state: SampleState): string {
    switch (state.kind) {
        case 'loading':
            return LOADING_WORDS;
        case 'fault':
            return faultWords(state.reason);
        case 'sample':
            return '';
    }
}

function sampleStateHtml(
    state: SampleState,
    origin: string,
    factsOf: ExchangeFactsOf,
): SafeHtml {
    switch (state.kind) {
        case 'loading':
            return html`
                <p class="text-muted">${LOADING_WORDS}</p>
            `;
        case 'fault':
            return html`
                <p>${faultWords(state.reason)}</p>
                <button type="button"
                    class="btn btn-outline btn-sm mt-2"
                    data-api-docs-retry>Retry</button>
            `;
        case 'sample':
            return html`
                ${pathIdsHtml(state.sample.pathIds)}
                ${state.sample.exchanges.map((exchange) =>
                    exchangeHtml(exchange, origin, factsOf(exchange))
                )}
            `;
    }
}

// The view a sample stands in: from 1440 px up an
// endpoint keeps its curl beside its facts, while a step
// runs each exchange under its prose.
type SampleView = 'endpoint' | 'step';

// The facts beside the sample from lg up, an endpoint's
// messages below both from 1440 px; below lg, and for a
// step from 1440 px up, the facts above the sample. With
// no sample the facts stand alone, the reason among them,
// whatever the state.
function besideSampleHtml(
    view: SampleView,
    facts: SafeHtml,
    sample: ApiDocSampleRef,
    state: SampleState,
    origin: string,
    factsOf: ExchangeFactsOf,
): SafeHtml {
    if (sample.kind === 'none') return facts;
    return html`
        <div class="api-doc-beside api-doc-beside-${view}">
            <div class="api-doc-facts">${facts}</div>
            <section class="api-doc-sample"
                aria-label="Sample">${
                sampleStateHtml(state, origin, factsOf)
            }</section>
        </div>
    `;
}

// An endpoint's exchange is highlighted by the endpoint's
// own header sets and answer lines.
export function endpointHtml(
    room: ApiDocRoom,
    state: SampleState,
    origin: string,
): SafeHtml {
    const facts = { room, words: answerLinesOf(room) };
    return besideSampleHtml(
        'endpoint', roomHtml(room), room.sample, state, origin,
        () => facts,
    );
}

function shellCopyLabel(line: string, index: number): string {
    const sets = SETS_VARIABLE.exec(line);
    return sets === null
        ? 'Copy shell line ' + (index + 1)
        : 'Copy the shell line that sets ' + sets[1];
}

// Each line stands alone, with its own copy button, in
// the order the prose runs them.
function shellHtml(shell: readonly string[]): SafeHtml | string {
    if (shell.length === 0) return '';
    return html`
        <h2 class="mt-4 text-sm font-semibold">Shell</h2>
        <ul class="api-doc-list">
            ${shell.map((line, index) => html`
                <li class="api-doc-shell-line">
                    <pre class="api-doc-pre api-doc-shell"
                        data-api-docs-shell>${line}</pre>
                    <button type="button"
                        class="btn btn-outline btn-sm"
                        aria-label="${shellCopyLabel(line, index)}"
                        data-api-docs-copy>Copy</button>
                </li>
            `)}
        </ul>
    `;
}

// The header lines some requests add to the first
// transport set's, and the requests that add them.
interface TransportAddition {
    readonly whens: readonly string[];
    readonly lines: readonly string[];
}

// Each later set as what it adds over the first: a header
// the first lacks, or one in another state. Sets that add
// the same lines share one entry, so no line repeats.
function transportAdditionsOf(
    first: ApiDocHeaderSet,
    later: readonly ApiDocHeaderSet[],
): readonly TransportAddition[] {
    const firstLines = new Set(first.headers.map(headerLineOf));
    const byLines = new Map<string, TransportAddition>();
    for (const set of later) {
        const lines = set.headers.map(headerLineOf)
            .filter((line) => !firstLines.has(line));
        const key = lines.join('\n');
        const shared = byLines.get(key);
        const whens = shared === undefined
            ? [set.when]
            : [...shared.whens, set.when];
        byLines.set(key, { whens, lines });
    }
    return [...byLines.values()];
}

// The catalog's first set holds for every request, each
// taken as carrying a body; each later set names a
// sign-in request and repeats the first set's headers.
function transportHtml(): SafeHtml {
    const [first, ...later] = API_DOC_TRANSPORT;
    if (first === undefined) {
        throw new Error('the catalog states no transport headers');
    }
    return html`
        <p class="text-muted mt-2">On every request with a body</p>
        <ul class="api-doc-list">
            ${first.headers.map((header) => html`
                <li>${headerLineOf(header)}</li>
            `)}
        </ul>
        ${transportAdditionsOf(first, later).map((addition) => html`
            <p class="text-muted mt-2">${
                'Added on ' + addition.whens.join('; ')
            }</p>
            <ul class="api-doc-list">
                ${addition.lines.map((line) => html`
                    <li>${line}</li>
                `)}
            </ul>
        `)}
    `;
}

// Facts about every request, stated once, from the
// catalog: curl's own headers first, beside the prose's
// word on the HTTP layer's framing.
function everyRequestHtml(): SafeHtml {
    return html`
        <h2 class="mt-4 text-sm font-semibold">
            Headers curl adds</h2>
        <ul class="api-doc-list">
            ${API_DOC_CURL_ADDS.map((name) => html`
                <li><code class="font-mono">${name}</code></li>
            `)}
        </ul>
        <h2 class="mt-4 text-sm font-semibold">
            Transport headers</h2>
        ${transportHtml()}
        <h2 class="mt-4 text-sm font-semibold">
            Answers any request may get</h2>
        ${answersHtml(API_DOC_GENERIC_ANSWERS)}
    `;
}

function stepFactsHtml(step: ApiDocStep): SafeHtml {
    return html`
        <h1 class="text-xl api-doc-title" tabindex="-1">${
            step.title
        }</h1>
        ${step.prose.map((paragraph) => html`
            <p class="mt-2">${paragraph}</p>
        `)}
        ${shellHtml(step.shell)}
        ${step.hash === EVERY_REQUEST_STEP ? everyRequestHtml() : ''}
        ${noSampleHtml(step.sample)}
    `;
}

// A step of the guided start: what to do, the shell lines
// that do it, and the exchanges it makes. Each exchange is
// highlighted by the endpoint it calls, as on that
// endpoint's own view, and by the step's prose.
export function stepHtml(
    step: ApiDocStep,
    state: SampleState,
    origin: string,
): SafeHtml {
    return besideSampleHtml(
        'step',
        stepFactsHtml(step),
        step.sample,
        state,
        origin,
        (exchange) => {
            const room = roomCalledBy(exchange.request, API_DOC_ROOMS);
            return {
                room,
                words: [...step.prose, ...answerLinesOf(room)],
            };
        },
    );
}

// The landing's way in: a link to each step, in order,
// and the first step's lead.
export function startCardHtml(steps: readonly ApiDocStep[]): SafeHtml {
    const lead = steps[0]?.prose[0];
    return html`
        <section class="card p-6 mb-6"
            aria-labelledby="api-start-title">
            <h2 id="api-start-title" class="font-semibold"
                tabindex="-1">Start here</h2>
            <ol class="api-doc-steps">
                ${steps.map((step, index) => html`
                    <li><a href="${
                        '#' + step.hash
                    }" class="api-doc-step-link"><span
                        class="api-doc-step-number"
                        aria-hidden="true">${index + 1}</span>${
                        step.title
                    }</a></li>
                `)}
            </ol>
            ${lead === undefined ? '' : html`
                <p class="mt-4">${lead}</p>
            `}
        </section>
    `;
}

export function statusHtml(
    status: ApiDocStatus,
): SafeHtml {
    return html`
        <h1 class="font-mono text-xl" tabindex="-1">${
            status.code
        }</h1>
        <pre class="api-doc-pre">${status.body}</pre>
    `;
}

export function unknownHtml(hash: string): SafeHtml {
    return html`
        <h1 tabindex="-1">Not a room</h1>
        <p class="text-muted mt-2">
            No documentation room is named
            ${' ' + hash}.</p>
    `;
}

// What a status hit says in place of who may call.
const STATUS_HIT_WORDS = 'status code';

// A hit's classes: an endpoint's carries its tier's, so
// its shape paints as on the grid; a status has none.
function hitClassOf(tier: SearchHit['tier']): string {
    return tier === 'status'
        ? 'api-doc-hit'
        : 'api-doc-hit api-doc-role-' + tier;
}

// Each hit links to its view and keeps its tier as shape
// and words beside its label, so a hit dimmed for the
// chosen role still says why.
export function searchHitsHtml(hits: readonly SearchHit[]): SafeHtml {
    return html`${hits.map((hit) => html`
        <li><a href="${'#' + hit.hash}" class="${hitClassOf(hit.tier)}"
            data-tier="${hit.tier}">
            ${hit.tier === 'status' ? '' : html`
                <span class="api-doc-role-shape" aria-hidden="true"></span>
            `}
            <span class="font-mono api-doc-hit-label">${hit.label}</span>
            <span class="api-doc-hit-tier">${
                hit.tier === 'status'
                    ? STATUS_HIT_WORDS
                    : API_DOC_TIER_LABELS[hit.tier]
            }</span>
        </a></li>
    `)}`;
}

// The role switch's first choice, and its default on
// every load: nothing is dimmed.
const VIEW_AS_EVERYONE = 'everyone';

// The roles the switch offers after everyone, as the
// value each sets on the page's `data-view-as`.
const VIEW_AS_ROLES = ['member', 'admin'] as const;

function sentenceCase(words: string): string {
    return words.charAt(0).toUpperCase() + words.slice(1);
}

function viewAsOptionHtml(
    value: string,
    words: string,
): SafeHtml {
    const checked = value === VIEW_AS_EVERYONE ? html` checked` : '';
    return html`
        <label class="api-doc-view-as-option"><input type="radio"
            name="api-view-as" value="${value}"${checked}>${words}</label>
    `;
}

// Who the reader views the catalog as. A role dims what
// it cannot call; the choice is never stored.
export function viewAsHtml(): SafeHtml {
    return html`
        <fieldset class="api-doc-view-as">
            <legend class="api-doc-view-as-legend">View as</legend>
            ${viewAsOptionHtml(VIEW_AS_EVERYONE, 'Everyone')}
            ${VIEW_AS_ROLES.map((role) => viewAsOptionHtml(
                role, sentenceCase(API_DOC_ROLE_NAMES[role]),
            ))}
        </fieldset>
    `;
}

export function searchCountText(hits: readonly SearchHit[]): string {
    const count = hits.length;
    if (count === 0) return 'No endpoint matches.';
    return count + ' ' + (count === 1 ? 'match' : 'matches');
}
