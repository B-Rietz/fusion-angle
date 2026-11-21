import { $inputRequired, $required } from '../app/dom.ts';
import {
    html,
    type SafeHtml,
    setHtml,
    trusted,
} from '../app/safe-html.ts';
import {
    API_DOC_ROOMS,
    API_DOC_STATUSES,
    API_DOC_STEPS,
} from './rooms.ts';
import { API_ELEVATION_SVG } from './elevation.ts';
import {
    endpointHtml,
    sampleAnnouncementText,
    type SampleState,
    searchCountText,
    searchHitsHtml,
    startCardHtml,
    statusHtml,
    stepHtml,
    unknownHtml,
    viewAsHtml,
} from './presenter.ts';
import type { ApiDocSampleRef } from './shapes.ts';
import { getSample } from './sample-source.ts';
import { searchCatalog } from './search.ts';

const LOADING: SampleState = { kind: 'loading' };

// The page's clipboard adapter.
function putClipboardText(text: string): Promise<void> {
    return navigator.clipboard.writeText(text);
}

// A copy button sits beside what it copies: an exchange's
// curl, or one shell line.
const COPY_SCOPE = '.api-doc-exchange, .api-doc-shell-line';
const COPY_SOURCE = '[data-api-docs-curl], [data-api-docs-shell]';

// Copies the text beside the button, as painted: a curl's
// origin is already this page's. The button says how it
// went.
function copyText(button: Element): void {
    const scope = button.closest(COPY_SCOPE);
    if (scope === null) {
        throw new Error('a copy button sits apart from its text');
    }
    const source = $required(COPY_SOURCE, scope);
    putClipboardText(source.textContent).then(
        () => {
            button.textContent = 'Copied';
        },
        () => {
            button.textContent = 'Unable to copy';
        },
    );
}

// The input types a reader types text into.
const TEXT_INPUT_TYPES: ReadonlySet<string> = new Set([
    'text', 'search', 'email', 'url', 'tel', 'password', 'number',
]);

// A key typed in a text field is text, never a shortcut.
function isTextField(target: EventTarget | null): boolean {
    return target instanceof HTMLTextAreaElement
        || (target instanceof HTMLInputElement
            && TEXT_INPUT_TYPES.has(target.type))
        || (target instanceof HTMLElement && target.isContentEditable);
}

// Ctrl, Cmd, and Alt make a key a chord, never the
// search's shortcut.
function isChord(event: KeyboardEvent): boolean {
    return event.ctrlKey || event.metaKey || event.altKey;
}

// The search's shortcut.
const SEARCH_KEY = '/';

// Up and Down move focus from the box through the hits;
// Up from the first returns to the box, and Down from the
// last stays. Enter on a hit is the link's own; Enter in
// the box opens the first.
function moveThroughHits(
    event: KeyboardEvent,
    box: HTMLInputElement,
    hitList: HTMLElement,
): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const links = [...hitList.querySelectorAll('a')];
    const at = links.findIndex((link) => link === document.activeElement);
    const next = event.key === 'ArrowDown' ? at + 1 : at - 1;
    event.preventDefault();
    if (next < 0) {
        box.focus();
        return;
    }
    links[next]?.focus();
}

function hashId(): string {
    const raw = location.hash;
    return raw.startsWith('#') ? raw.slice(1) : raw;
}

export async function init(): Promise<void> {
    const start = $required('#api-start', document);
    const elevation = $required(
        '#api-elevation', document,
    );
    const room = $required('#api-room', document);
    const page = $required('.api-documentation', document);
    const tools = $required('#api-tools', document);
    const viewAs = $required('#api-view-as', tools);
    const box = $inputRequired('#api-search', tools);
    const results = $required('#api-search-results', tools);
    const count = $required('#api-search-count', tools);
    const hitList = $required('#api-search-hits', results);
    setHtml(viewAs, viewAsHtml());
    // The chosen role names the view; CSS dims what it
    // cannot call.
    const applyViewAs = (): void => {
        page.dataset['viewAs'] = $inputRequired(
            'input:checked', viewAs,
        ).value;
    };
    applyViewAs();
    viewAs.addEventListener('change', applyViewAs);
    setHtml(start, startCardHtml(API_DOC_STEPS));
    setHtml(elevation, trusted(API_ELEVATION_SVG));
    setHtml(room, html`
        <button type="button"
            class="btn btn-ghost"
            data-api-docs-back>Back</button>
        <div id="api-room-body"></div>
    `);
    const body = $required(
        '#api-room-body', room,
    );
    // The page's one live region for a sample: always in
    // the page, never inside a hidden view, so the first
    // text it takes is heard; it changes as the open view's
    // sample loads or fails.
    const sampleStatus = $required('#api-sample-status', page);
    const announce = (state: SampleState): void => {
        sampleStatus.textContent = sampleAnnouncementText(state);
    };
    let sawHashChange = false;
    // A view's heading takes focus as the view opens, so a
    // screen reader speaks the new view.
    const headingOf = (): HTMLElement => $required('h1', body);
    // Counts the views painted, so a sample that arrives
    // after the reader has moved on paints nothing.
    let painted = 0;
    // Paints a view as its sample loads, then again once
    // the sample is read or has failed.
    const showWithSample = (
        sample: ApiDocSampleRef,
        viewOf: (state: SampleState) => SafeHtml,
    ): void => {
        const view = painted;
        setHtml(body, viewOf(LOADING));
        if (sample.kind === 'none') return;
        announce(LOADING);
        void getSample(sample.path).then((state) => {
            if (view !== painted) return;
            const headingHeld = document.activeElement === headingOf();
            setHtml(body, viewOf(state));
            if (headingHeld) headingOf().focus();
            announce(state);
        });
    };
    // The landing filtered by the search: while the box
    // holds a query, its hits stand in for the guided
    // start and the grid. An empty box keeps no hits and
    // no count.
    const paintLanding = (): void => {
        const query = box.value.trim();
        const searching = query !== '';
        start.hidden = searching;
        elevation.hidden = searching;
        results.hidden = !searching;
        if (!searching) {
            count.textContent = '';
            hitList.replaceChildren();
            return;
        }
        const hits = searchCatalog(
            query, API_DOC_ROOMS, API_DOC_STATUSES,
        );
        count.textContent = searchCountText(hits);
        setHtml(hitList, searchHitsHtml(hits));
    };
    const paint = (): void => {
        painted += 1;
        sampleStatus.textContent = '';
        const id = hashId();
        if (id === '') {
            tools.hidden = false;
            room.hidden = true;
            paintLanding();
            return;
        }
        tools.hidden = true;
        start.hidden = true;
        elevation.hidden = true;
        room.hidden = false;
        const foundRoom = API_DOC_ROOMS.find(
            (entry) => entry.hash === id,
        );
        if (foundRoom !== undefined) {
            showWithSample(foundRoom.sample, (state) =>
                endpointHtml(foundRoom, state, location.origin));
            return;
        }
        const foundStep = API_DOC_STEPS.find(
            (entry) => entry.hash === id,
        );
        if (foundStep !== undefined) {
            showWithSample(foundStep.sample, (state) =>
                stepHtml(foundStep, state, location.origin));
            return;
        }
        const foundStatus = API_DOC_STATUSES.find(
            (entry) => entry.hash === id,
        );
        if (foundStatus !== undefined) {
            setHtml(body, statusHtml(foundStatus));
            return;
        }
        setHtml(body, unknownHtml(id));
    };
    // Where the reader stood on the landing when a view
    // opened: the search box, or the link they took.
    let returnTo: Element | null = null;
    // Back puts the reader where they stood: the box, or the
    // link to the view they left, which the hits may have
    // painted again. Failing those, the landing's heading,
    // or the box while it holds a query.
    const landingFocusOf = (): HTMLElement | SVGElement => {
        const searching = !results.hidden;
        if (returnTo === box) return box;
        const href = returnTo?.getAttribute('href');
        const shown = searching ? [hitList] : [start, elevation];
        for (const links of shown) {
            const link = [
                ...links.querySelectorAll<HTMLElement | SVGElement>('a'),
            ].find((candidate) => candidate.getAttribute('href') === href);
            if (link !== undefined) return link;
        }
        return searching ? box : $required('#api-start-title', start);
    };
    window.addEventListener('hashchange', () => {
        sawHashChange = true;
        if (room.hidden) returnTo = document.activeElement;
        paint();
        if (room.hidden) {
            landingFocusOf().focus();
            returnTo = null;
            return;
        }
        headingOf().focus();
    });
    body.addEventListener('click', (event) => {
        if (!(event.target instanceof Element)) return;
        if (event.target.closest('[data-api-docs-retry]')) {
            paint();
            return;
        }
        const copy = event.target.closest('[data-api-docs-copy]');
        if (copy !== null) copyText(copy);
    });
    box.addEventListener('input', paintLanding);
    for (const from of [box, hitList]) {
        from.addEventListener('keydown', (event) => {
            if (results.hidden) return;
            moveThroughHits(event, box, hitList);
        });
    }
    // An Enter that ends an input method's composition
    // commits its text; it opens nothing.
    box.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' || event.isComposing) return;
        if (results.hidden) return;
        hitList.querySelector('a')?.click();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key !== SEARCH_KEY || isChord(event)) return;
        if (tools.hidden || isTextField(event.target)) return;
        event.preventDefault();
        box.focus();
    });
    $required(
        '[data-api-docs-back]', room,
    ).addEventListener('click', () => {
        if (sawHashChange) {
            history.back();
            return;
        }
        location.hash = '';
    });
    paint();
}
