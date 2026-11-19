import {
    html, setHtml, SafeHtml,
} from '../safe-html.ts';
import { formatDateTime } from '../format.ts';
import { DISPLAY_ABSENT } from '../format.ts';
import { mutedEmptyNote } from './empty-note.ts';
import { idLabel } from './id-label.ts';
import type {
    TokenEvent,
    TokenChain,
} from '../../../client/index.ts';

function actionBadgeClass(
    action: TokenEvent['action'],
): string {
    if (action === 'issued') return 'badge badge-success';
    if (action === 'revoked') return 'badge badge-error';
    return 'badge badge-default';
}

// A parent links to its row only when that row is on the
// page; a parent outside every rendered chain stays plain text.
function buildParentLabel(
    parentJti: string,
    firstRows: ReadonlyMap<string, TokenEvent>,
): SafeHtml {
    const label = idLabel('Parent token', parentJti);
    return firstRows.has(parentJti)
        ? html`<a href="#token-${parentJti}">${label}</a>`
        : label;
}

// Only the first row of each jti carries its anchor, so the
// document's ids stay unique.
function buildEventRow(
    event: TokenEvent,
    firstRows: ReadonlyMap<string, TokenEvent>,
): SafeHtml {
    return html`
        <div class="${
            'token-row flex items-center gap-4 py-2'
        }"${firstRows.get(event.jti) === event
            ? html` id="token-${event.jti}"`
            : html``}>
            <div class="flex-fill min-w-0">
                <p class="text-sm font-medium">${
                    idLabel('Token', event.jti)
                }</p>
                <p class="text-xs text-muted">
                    ${event.parentJti === undefined
                        ? `Parent token ${DISPLAY_ABSENT}`
                        : buildParentLabel(
                            event.parentJti, firstRows,
                        )}
                </p>
            </div>
            <div class="${
                'flex flex-col items-end gap-2 ml-6'
            }">
                <span class="${
                    actionBadgeClass(event.action)
                }">${event.action}</span>
                <span class="text-xs text-muted">
                    <time datetime="${event.at}">${
                        formatDateTime(event.at)
                    }</time>
                </span>
            </div>
        </div>`;
}

function buildChainCard(
    chain: TokenChain,
    firstRows: ReadonlyMap<string, TokenEvent>,
): SafeHtml {
    return html`
        <div class="card p-6">
            <h3 class="${
                'font-display font-semibold mb-2'
                + ' text-sm'
            }">${idLabel('Chain', chain.chainId)}</h3>
            <div class="flex flex-col gap-1">
                ${chain.events.map(
                    event => buildEventRow(event, firstRows),
                )}
            </div>
        </div>`;
}

export class IdentityTokensPresenter {
    readonly #chains: readonly TokenChain[];

    constructor(chains: readonly TokenChain[]) {
        this.#chains = chains;
    }

    render(container: HTMLElement): void {
        const firstRows = new Map<string, TokenEvent>();
        for (const event of this.#chains.flatMap(
            chain => chain.events,
        )) {
            if (!firstRows.has(event.jti)) {
                firstRows.set(event.jti, event);
            }
        }
        setHtml(container, html`${
            this.#chains.length === 0
                ? mutedEmptyNote('No tokens.')
                : html`${this.#chains.map(chain =>
                    buildChainCard(chain, firstRows))}`
        }`);
    }
}
