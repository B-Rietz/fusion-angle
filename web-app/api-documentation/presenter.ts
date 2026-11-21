import { html, type SafeHtml } from
    '../app/safe-html.ts';
import type {
    ApiDocRoom,
    ApiDocStatus,
} from './rooms.ts';
import type {
    ApiDocHeader,
    ApiDocHeaderSet,
    ApiDocLink,
    ApiDocSampleRef,
    ApiDocTier,
} from './shapes.ts';

// Who may call, in the grid legend's words.
const TIER_TEXT: Readonly<Record<ApiDocTier, string>> = {
    member: 'member and organization admin',
    admin: 'organization admin only',
    none: 'no token',
};

function headerStateText(header: ApiDocHeader): string {
    return header.state === 'alternative'
        ? 'one of ' + header.alternatives.join(', ')
        : header.state;
}

function headerSetHtml(set: ApiDocHeaderSet): SafeHtml {
    return html`
        ${set.when === '' ? '' : html`
            <p class="text-muted mt-2">${set.when}</p>
        `}
        <ul class="api-doc-list">
            ${set.headers.map((header) => html`
                <li>${
                    header.name + ': ' + headerStateText(header)
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

export function roomHtml(room: ApiDocRoom): SafeHtml {
    return html`
        <h1 class="font-mono text-xl">${
            room.verb + ' ' + room.uri
        }</h1>
        <p class="text-muted mt-2">${TIER_TEXT[room.tier]}</p>
        <h2 class="mt-4 text-sm font-semibold">
            Headers</h2>
        ${room.headerSets.map(headerSetHtml)}
        <h2 class="mt-4 text-sm font-semibold">
            Status</h2>
        <ul class="api-doc-list">
            ${room.answers.map((answer) => html`
                <li><a href="${
                    '#statuses/' + answer.code
                }">${answer.code}</a>${
                    ' ' + answer.line
                }</li>
            `)}
        </ul>
        ${relatedHtml(room.related)}
        ${noSampleHtml(room.sample)}
    `;
}

export function statusHtml(
    status: ApiDocStatus,
): SafeHtml {
    return html`
        <h1 class="font-mono text-xl">${
            status.code
        }</h1>
        <pre class="api-doc-pre">${status.body}</pre>
    `;
}

export function unknownHtml(hash: string): SafeHtml {
    return html`
        <h1>Not a room</h1>
        <p class="text-muted mt-2">
            No documentation room is named
            ${' ' + hash}.</p>
    `;
}
