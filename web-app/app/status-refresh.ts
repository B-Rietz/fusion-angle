// The status page keeps itself current. It fetches its
// own URL, and shows the card the server rendered there
// only when that card's markup differs from the one on
// screen, ages aside, so an unchanged status touches
// nothing and the live region announces only a change. A
// changed age is written in place, unannounced, and does
// not count as a change, so the refresh still backs off.
// When the answered page names another status script, the
// page reloads instead, so a deploy's new card never meets
// an old script; the reloaded page runs the script it
// names, so it cannot loop. A page that gets no answer
// shows the timeout card the server rendered into its
// template. The server writes every card; this script
// holds no markup. Loaded from a same-origin file
// so the page's Content-Security-Policy (script-src
// 'self') can forbid inline scripts. `deno bundle` folds
// the import below into a self-contained IIFE.

import {
    refreshWaitMs,
    STATUS_PAGE_WAIT_MS,
} from './status-backoff.ts';

const CARD_ID = 'status-card';
const AGE = '.git-age';

type RefreshOutcome = 'shown' | 'reloading';

// The attribute, not `.src`, which the browser makes
// absolute: the server writes the attribute.
function runningScript(): string {
    const src = document.currentScript?.getAttribute('src');
    if (src === undefined || src === null) {
        throw new Error('the status script cannot name itself');
    }
    return src;
}

function servedScript(answer: Document): string | undefined {
    const src = answer.querySelector('script[src]')
        ?.getAttribute('src');
    return src === null ? undefined : src;
}

function elementOf(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (element === null) {
        throw new Error('the status page has no #' + id);
    }
    return element;
}

function templateOf(id: string): HTMLTemplateElement {
    const element = elementOf(id);
    if (!(element instanceof HTMLTemplateElement)) {
        throw new Error('#' + id + ' is not a template');
    }
    return element;
}

function cardIn(root: DocumentFragment | Document): Element {
    const card = root.getElementById(CARD_ID);
    if (card === null) {
        throw new Error('no #' + CARD_ID + ' to show');
    }
    return card;
}

// A failed request is a TypeError; an expired wait is
// the signal's TimeoutError. Either is no answer.
function unanswered(error: unknown): boolean {
    return error instanceof TypeError
        || (error instanceof DOMException
            && error.name === 'TimeoutError');
}

async function answeredPage(): Promise<Document | undefined> {
    // The signal bounds the body's read as well as the
    // headers'.
    const signal = AbortSignal.timeout(STATUS_PAGE_WAIT_MS);
    let response: Response;
    try {
        response = await fetch(location.href, {
            headers: { Accept: 'text/html' },
            cache: 'no-store',
            signal,
        });
    } catch (error) {
        if (unanswered(error)) return undefined;
        throw error;
    }
    let html: string;
    try {
        html = await response.text();
    } catch (error) {
        if (unanswered(error)) return undefined;
        throw error;
    }
    return new DOMParser().parseFromString(html, 'text/html');
}

function agelessMarkup(card: Element): string {
    const copy = card.cloneNode(true) as Element;
    for (const age of copy.querySelectorAll(AGE)) {
        age.textContent = '';
    }
    return copy.outerHTML;
}

// Called only when the two cards differ in ages alone, so
// their ages pair up one for one.
function copyAges(from: Element, to: Element): void {
    const ages = to.querySelectorAll(AGE);
    from.querySelectorAll(AGE).forEach((age, index) => {
        const target = ages[index];
        if (target !== undefined
            && target.textContent !== age.textContent) {
            target.textContent = age.textContent;
        }
    });
}

(function refreshStatus(): void {
    const running = runningScript();
    const live = elementOf('status-live');
    const timeout = templateOf('status-timeout');
    let changedAt = performance.now();

    function showCard(card: Element): void {
        const shown = cardIn(document);
        if (agelessMarkup(card) !== agelessMarkup(shown)) {
            live.replaceChildren(document.importNode(card, true));
            changedAt = performance.now();
            return;
        }
        copyAges(card, shown);
    }

    async function showAnswer(): Promise<RefreshOutcome> {
        const answer = await answeredPage();
        if (answer !== undefined
            && servedScript(answer) !== running) {
            location.reload();
            return 'reloading';
        }
        const served = answer?.getElementById('status-timeout');
        if (served instanceof HTMLTemplateElement
            && served.innerHTML !== timeout.innerHTML) {
            timeout.content.replaceChildren(
                document.importNode(served.content, true),
            );
        }
        showCard(
            answer?.getElementById(CARD_ID)
                ?? cardIn(timeout.content),
        );
        return 'shown';
    }

    // An error no branch expects still shows the timeout
    // card, so the page never reads UP on it, and still
    // reaches the console; the refresh goes on. A reload
    // schedules nothing.
    async function refresh(): Promise<void> {
        // Absent when the answer threw.
        let outcome: RefreshOutcome | undefined;
        try {
            outcome = await showAnswer();
        } catch (error) {
            showCard(cardIn(timeout.content));
            throw error;
        } finally {
            if (outcome !== 'reloading') schedule();
        }
    }

    // The next request starts only once the last has
    // settled, so no two overlap.
    function schedule(): void {
        setTimeout(
            () => void refresh(),
            refreshWaitMs(performance.now() - changedAt),
        );
    }

    schedule();
})();
