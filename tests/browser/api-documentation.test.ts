import {
    assert,
    assertEquals,
    assertNotStrictEquals,
    assertStrictEquals,
} from '@std/assert';
import {
    startOrigin,
    useBrowser,
    withHeldRequests,
} from './fixtures.ts';
import { registryUrl } from
    '../../web-app/app/browser-drive.ts';
import {
    API_DOC_ROOMS,
    API_DOC_STATUSES,
    API_DOC_STEPS,
} from '../../web-app/api-documentation/rooms.ts';

const browser = useBrowser();

const ROOM_H1 =
    '#api-room h1';

async function openDocs(
    hash: string,
): Promise<{
    origin: Awaited<ReturnType<typeof startOrigin>>;
    page: Awaited<
        ReturnType<
            ReturnType<typeof browser.get>['newPage']
        >
    >;
}> {
    const origin = await startOrigin();
    const page = await browser.get().newPage();
    const url = registryUrl(
        origin.baseUrl, 'api-documentation',
    ) + hash;
    await page.navigate(url);
    await page.ready('api-documentation');
    return { origin, page };
}

async function closeDocs(
    origin: Awaited<ReturnType<typeof startOrigin>>,
    page: Awaited<
        ReturnType<
            ReturnType<typeof browser.get>['newPage']
        >
    >,
): Promise<void> {
    await browser.get().disposeContext(
        page.contextId,
    );
    await origin.close();
}

Deno.test('api-documentation boots the elevation',
async () => {
    const { origin, page } = await openDocs('');
    try {
        const path = await page.evaluate<string>(
            'location.pathname',
        );
        assert(
            path.includes('/api-documentation/'),
            path,
        );
        assert(
            !(path.includes('/auth/')),
            path,
        );
        assertStrictEquals(
            await page.evaluate<boolean>(
                `document.querySelector('object')`
                + ` === null`,
            ),
            true,
        );
        assertStrictEquals(
            await page.evaluate<boolean>(
                `document.querySelector(`
                + `'#api-elevation svg')`
                + `?.checkVisibility() === true`,
            ),
            true,
        );
        assertStrictEquals(
            await page.evaluate<boolean>(
                `document.querySelector(`
                + `'#api-room')?.hidden === true`,
            ),
            true,
        );
    } finally {
        await closeDocs(origin, page);
    }
});

Deno.test('circle click paints a room',
async () => {
    const { origin, page } = await openDocs('');
    try {
        await page.click('#api-elevation a');
        const hash = await page.until<string>(
            `location.hash.length > 1`
            + ` ? location.hash : null`,
            'room hash after circle click',
        );
        assert(hash.startsWith('#'), hash);
        assert(
            !hash.endsWith('/'),
            hash,
        );
        const heading = await page.until<string>(
            `document.querySelector('${ROOM_H1}')`
            + `?.checkVisibility() === true`
            + ` ? document.querySelector('${ROOM_H1}')`
            + `.textContent.trim() : null`,
            'room heading after circle click',
        );
        assert(heading.length > 0, heading);
        assertStrictEquals(
            await page.evaluate<boolean>(
                `document.querySelector(`
                + `'#api-elevation')?.hidden === true`,
            ),
            true,
        );
    } finally {
        await closeDocs(origin, page);
    }
});

Deno.test('status hash and back walk the stack',
async () => {
    const { origin, page } = await openDocs('');
    try {
        await page.click('#api-elevation a');
        const roomHeading = await page.until<string>(
            `document.querySelector('${ROOM_H1}')`
            + `?.checkVisibility() === true`
            + ` ? document.querySelector('${ROOM_H1}')`
            + `.textContent.trim() : null`,
            'room heading before status',
        );
        await page.click(
            '#api-room a[href^="#statuses/"]',
        );
        const statusHeading = await page.until<string>(
            `document.querySelector('${ROOM_H1}')`
            + `?.checkVisibility() === true`
            + ` && document.querySelector('${ROOM_H1}')`
            + `.textContent.trim() !== ${
                JSON.stringify(roomHeading)
            }`
            + ` ? document.querySelector('${ROOM_H1}')`
            + `.textContent.trim() : null`,
            'status heading',
        );
        assert(statusHeading.length > 0);
        await page.evaluate('history.back(); true');
        assertStrictEquals(
            await page.until<string>(
                `document.querySelector('${ROOM_H1}')`
                + `?.textContent?.trim() === ${
                    JSON.stringify(roomHeading)
                }`
                + ` ? document.querySelector(`
                + `'${ROOM_H1}').textContent.trim()`
                + ` : null`,
                'room heading after first back',
            ),
            roomHeading,
        );
        await page.evaluate('history.back(); true');
        await page.until(
            `document.querySelector(`
            + `'#api-elevation svg')`
            + `?.checkVisibility() === true`
            + ` && document.querySelector(`
            + `'#api-room')?.hidden === true`,
            'elevation after second back',
        );
    } finally {
        await closeDocs(origin, page);
    }
});

Deno.test(
    'direct hash paints before page ready',
async () => {
    const { origin, page } = await openDocs(
        '#get/organizations/id/ai-agents',
    );
    try {
        assertStrictEquals(
            await page.evaluate<string>(
                'location.hash',
            ),
            '#get/organizations/id/ai-agents',
        );
        assertStrictEquals(
            await page.evaluate<boolean>(
                `document.querySelector('${ROOM_H1}')`
                + `?.checkVisibility() === true`,
            ),
            true,
        );
        assertStrictEquals(
            await page.evaluate<string>(
                `document.querySelector('${ROOM_H1}')`
                + `.textContent.trim()`,
            ),
            'GET /api/organizations/:id/ai-agents/',
        );
        assertStrictEquals(
            await page.evaluate<boolean>(
                `document.querySelector(`
                + `'#api-elevation')?.hidden === true`,
            ),
            true,
        );
    } finally {
        await closeDocs(origin, page);
    }
});

Deno.test('unknown hash is an in-pane miss',
async () => {
    const { origin, page } = await openDocs(
        '#not-a-room',
    );
    try {
        const path = await page.evaluate<string>(
            'location.pathname',
        );
        assert(
            path.includes('/api-documentation/'),
            path,
        );
        assert(
            !(path.includes('/not-found/')),
            path,
        );
        const heading = await page.until<string>(
            `document.querySelector('${ROOM_H1}')`
            + `?.checkVisibility() === true`
            + ` ? document.querySelector('${ROOM_H1}')`
            + `.textContent.trim() : null`,
            'miss heading',
        );
        assert(heading.length > 0, heading);
        await page.click('[data-api-docs-back]');
        await page.until(
            `document.querySelector(`
            + `'#api-elevation svg')`
            + `?.checkVisibility() === true`
            + ` && document.querySelector(`
            + `'#api-room')?.hidden === true`,
            'elevation after miss Back',
        );
        assertStrictEquals(
            await page.evaluate<string>(
                'location.hash',
            ),
            '',
        );
    } finally {
        await closeDocs(origin, page);
    }
});

Deno.test('every catalog hash paints its title',
async () => {
    const { origin, page } = await openDocs('');
    try {
        const entries: {
            hash: string;
            title: string;
        }[] = [
            ...API_DOC_ROOMS.map((room) => ({
                hash: room.hash,
                title: room.verb + ' ' + room.uri,
            })),
            ...API_DOC_STATUSES.map((row) => ({
                hash: row.hash,
                title: row.code,
            })),
        ];
        for (const entry of entries) {
            await page.evaluate(
                `location.hash = ${
                    JSON.stringify('#' + entry.hash)
                }; true`,
            );
            const heading = await page.until<string>(
                `document.querySelector('${ROOM_H1}')`
                + `?.checkVisibility() === true`
                + ` && document.querySelector(`
                + `'${ROOM_H1}').textContent.trim()`
                + ` === ${JSON.stringify(entry.title)}`
                + ` ? document.querySelector(`
                + `'${ROOM_H1}').textContent.trim()`
                + ` : null`,
                'title for #' + entry.hash,
            );
            assertStrictEquals(heading, entry.title);
        }
    } finally {
        await closeDocs(origin, page);
    }
});

const CURL = '#api-room [data-api-docs-curl]';

Deno.test('opening an endpoint shows its sample with $ORIGIN'
    + ' replaced', async () => {
    const { origin, page } = await openDocs(
        '#get/organizations/id/flows',
    );
    try {
        const curl = await page.until<string>(
            `document.querySelector('${CURL}')`
            + `?.checkVisibility() === true`
            + ` ? document.querySelector('${CURL}')`
            + `.textContent : null`,
            'the sample\'s curl',
        );
        const pageOrigin = await page.evaluate<string>(
            'location.origin',
        );
        assert(curl.includes(pageOrigin), curl);
        assert(!curl.includes('$ORIGIN'), curl);
    } finally {
        await closeDocs(origin, page);
    }
});

// Below lg the endpoint view is one column.
const PHONE_WIDTH = 375;
const PHONE_HEIGHT = 812;

Deno.test('at a narrow width the endpoint view is one column',
async () => {
    // A phone loads the page at its own width, so the
    // viewport is set before the page opens.
    const origin = await startOrigin();
    const page = await browser.get().newPage();
    try {
        await page.setViewport(PHONE_WIDTH, PHONE_HEIGHT, false);
        await page.navigate(registryUrl(
            origin.baseUrl, 'api-documentation',
        ) + '#get/organizations/id/flows');
        await page.ready('api-documentation');
        await page.until<string>(
            `document.querySelector('${CURL}')`
            + `?.checkVisibility() === true`
            + ` ? 'painted' : null`,
            'the sample at phone width',
        );
        const facts = await page.rect('#api-room .api-doc-facts');
        const sample = await page.rect(
            '#api-room .api-doc-sample',
        );
        assert(
            sample.y >= facts.y + facts.height,
            JSON.stringify({ facts, sample }),
        );
        const widths = await page.evaluate<{
            scroll: number;
            inner: number;
        }>(
            `({ scroll: document.documentElement.scrollWidth,`
            + ` inner: innerWidth })`,
        );
        assert(
            widths.scroll <= widths.inner,
            JSON.stringify(widths),
        );
    } finally {
        await closeDocs(origin, page);
    }
});

Deno.test('every step hash paints its title', async () => {
    const { origin, page } = await openDocs('');
    try {
        for (const step of API_DOC_STEPS) {
            await page.evaluate(
                `location.hash = ${
                    JSON.stringify('#' + step.hash)
                }; true`,
            );
            const heading = await page.until<string>(
                `document.querySelector('${ROOM_H1}')`
                + `?.checkVisibility() === true`
                + ` && document.querySelector(`
                + `'${ROOM_H1}').textContent.trim()`
                + ` === ${JSON.stringify(step.title)}`
                + ` ? document.querySelector(`
                + `'${ROOM_H1}').textContent.trim()`
                + ` : null`,
                'title for #' + step.hash,
            );
            assertStrictEquals(heading, step.title);
            assertStrictEquals(
                await page.evaluate<boolean>(
                    `document.querySelector('#api-start')`
                    + `?.checkVisibility() === false`,
                ),
                true,
            );
        }
    } finally {
        await closeDocs(origin, page);
    }
});

Deno.test('Back from a step returns to the landing', async () => {
    const { origin, page } = await openDocs('');
    try {
        const [first] = API_DOC_STEPS;
        assert(first !== undefined);
        await page.click(`#api-start a[href="#${first.hash}"]`);
        await page.until<string>(
            `document.querySelector('${ROOM_H1}')`
            + `?.checkVisibility() === true`
            + ` && document.querySelector(`
            + `'${ROOM_H1}').textContent.trim()`
            + ` === ${JSON.stringify(first.title)}`
            + ` ? 'painted' : null`,
            'the first step',
        );
        await page.click('[data-api-docs-back]');
        await page.until(
            `document.querySelector('#api-start')`
            + `?.checkVisibility() === true`
            + ` && document.querySelector(`
            + `'#api-elevation svg')`
            + `?.checkVisibility() === true`
            + ` && document.querySelector(`
            + `'#api-room')?.hidden === true`,
            'the landing after Back from a step',
        );
        assertStrictEquals(
            await page.evaluate<string>('location.hash'),
            '',
        );
    } finally {
        await closeDocs(origin, page);
    }
});

const SEARCH = '#api-search';
const HITS = '#api-search-hits a';

function visible(selector: string): string {
    return `document.querySelector(${JSON.stringify(selector)})`
        + `?.checkVisibility() === true`;
}

// What a reader types lands as text, as a paste does.
function typeText(
    page: Awaited<ReturnType<typeof openDocs>>['page'],
    text: string,
): Promise<unknown> {
    return page.session.send('Input.insertText', { text });
}

function isActive(selector: string): string {
    return `document.activeElement === document.querySelector(${
        JSON.stringify(selector)
    })`;
}

Deno.test('the landing view shows the guided start, the search,'
    + ' and the grid', async () => {
    const { origin, page } = await openDocs('');
    try {
        for (
            const selector of ['#api-start', SEARCH, '#api-elevation svg']
        ) {
            assertStrictEquals(
                await page.evaluate<boolean>(visible(selector)),
                true,
                selector,
            );
        }
    } finally {
        await closeDocs(origin, page);
    }
});

// It names one endpoint, by its verb and URI.
const KNOWN_QUERY = 'delete /api/identities/:id/pii';
const KNOWN_HASH = '#delete/identities/id/pii';
const KNOWN_TITLE = 'DELETE /api/identities/:id/pii';

Deno.test('typing in search narrows to a known endpoint; Enter'
    + ' opens it; / focuses the box', async () => {
    const { origin, page } = await openDocs('');
    try {
        await page.key('/');
        assertStrictEquals(
            await page.evaluate<boolean>(isActive(SEARCH)),
            true,
        );
        assertStrictEquals(
            await page.evaluate<string>(
                `document.querySelector('${SEARCH}').value`,
            ),
            '',
        );
        await typeText(page, KNOWN_QUERY);
        const href = await page.until<string>(
            `(() => {
                const links = [...document.querySelectorAll(
                    '${HITS}')];
                return links.length === 1
                    && links[0].checkVisibility()
                    ? links[0].getAttribute('href')
                    : null;
            })()`,
            'one hit for the known endpoint',
        );
        assertStrictEquals(href, KNOWN_HASH);
        assertStrictEquals(
            await page.evaluate<boolean>(visible('#api-elevation svg')),
            false,
        );
        await page.key('ArrowDown');
        assertStrictEquals(
            await page.evaluate<boolean>(isActive(HITS)),
            true,
        );
        await page.key('ArrowUp');
        assertStrictEquals(
            await page.evaluate<boolean>(isActive(SEARCH)),
            true,
        );
        await page.key('ArrowDown');
        await page.key('Enter');
        const heading = await page.until<string>(
            `${visible(ROOM_H1)}`
            + ` ? document.querySelector('${ROOM_H1}')`
            + `.textContent.trim() : null`,
            'the known endpoint, opened',
        );
        assertStrictEquals(heading, KNOWN_TITLE);
        assertStrictEquals(
            await page.evaluate<string>('location.hash'),
            KNOWN_HASH,
        );
    } finally {
        await closeDocs(origin, page);
    }
});

Deno.test('typing / inside the search box types a slash',
async () => {
    const { origin, page } = await openDocs('');
    try {
        await page.click(SEARCH);
        await typeText(page, 'organizations');
        await page.key('/');
        assertStrictEquals(
            await page.until<string>(
                `document.querySelector('${SEARCH}').value`
                + ` === 'organizations/' ? 'typed' : null`,
                'the slash in the box',
            ),
            'typed',
        );
        assertStrictEquals(
            await page.evaluate<boolean>(isActive(SEARCH)),
            true,
        );
    } finally {
        await closeDocs(origin, page);
    }
});

// The computed opacity of the first element the selector
// names.
function opacityOf(selector: string): string {
    return `getComputedStyle(document.querySelector(${
        JSON.stringify(selector)
    })).opacity`;
}

const GRID_ADMIN = '#api-elevation a[data-tier="admin"]';
const GRID_MEMBER = '#api-elevation a[data-tier="member"]';
const HIT_ADMIN = '#api-search-hits a[data-tier="admin"]';
const HIT_MEMBER = '#api-search-hits a[data-tier="member"]';

function chooseRole(value: string): string {
    return `#api-view-as input[value="${value}"]`;
}

// Its hits hold endpoints of both tiers.
const MIXED_QUERY = 'identities';

Deno.test('choosing Member dims an organization-admin-only'
    + ' endpoint and leaves a member one lit', async () => {
    const { origin, page } = await openDocs('');
    try {
        assertStrictEquals(
            await page.evaluate<string>(opacityOf(GRID_ADMIN)),
            '1',
        );
        await page.click(chooseRole('member'));
        const dimmed = Number(await page.until<string>(
            `${opacityOf(GRID_ADMIN)} !== '1'`
            + ` ? ${opacityOf(GRID_ADMIN)} : null`,
            'the admin endpoint dimmed',
        ));
        assert(dimmed > 0 && dimmed < 1, String(dimmed));
        assertStrictEquals(
            await page.evaluate<string>(opacityOf(GRID_MEMBER)),
            '1',
        );
        assertStrictEquals(
            await page.evaluate<boolean>(
                `document.querySelector(${
                    JSON.stringify(GRID_ADMIN)
                }).firstElementChild.checkVisibility()`,
            ),
            true,
        );
        await page.click(SEARCH);
        await typeText(page, MIXED_QUERY);
        await page.waitFor(HIT_ADMIN);
        await page.waitFor(HIT_MEMBER);
        assert(
            Number(await page.evaluate<string>(opacityOf(HIT_ADMIN)))
                < 1,
        );
        assertStrictEquals(
            await page.evaluate<string>(opacityOf(HIT_MEMBER)),
            '1',
        );
        assertStrictEquals(
            await page.evaluate<boolean>(
                `document.querySelector(${
                    JSON.stringify(HIT_ADMIN)
                }).textContent.includes('organization admin only')`,
            ),
            true,
        );
        await page.click(chooseRole('admin'));
        assertStrictEquals(
            await page.until<string>(
                `${opacityOf(HIT_ADMIN)} === '1' ? 'lit' : null`,
                'the admin hit lit for an organization admin',
            ),
            'lit',
        );
    } finally {
        await closeDocs(origin, page);
    }
});

// The sidebar's stops come before the page's own; a bound
// past every stop on the page fails a Tab that never
// arrives instead of hanging.
const TAB_BOUND = 200;

// Where focus rests after a Tab, by what the reader
// reached, and how its outline paints. A stop outside the
// page is the shell's.
interface FocusStop {
    readonly name: string;
    readonly outline: string;
}

const OUTSIDE = 'outside';

const FOCUS_STOP = `(() => {
    const at = document.activeElement;
    if (at === null || at.closest('.api-documentation') === null) {
        return { name: '${OUTSIDE}', outline: '' };
    }
    const href = at.getAttribute('href');
    const name = at.matches('#api-view-as input')
        ? 'view-as ' + at.value
        : at.matches('#api-search') ? 'search'
        : at.matches('#api-start a') ? 'step ' + href
        : at.matches('#api-elevation a') ? 'grid ' + href
        : at.matches('[data-api-docs-copy]') ? 'copy'
        : at.tagName.toLowerCase() + ' ' + href;
    return { name, outline: getComputedStyle(at).outlineStyle };
})()`;

// Tabs until `last` names the stop, and returns each stop
// in the page on the way, `last` included.
async function tabTo(
    page: Awaited<ReturnType<typeof openDocs>>['page'],
    last: (name: string) => boolean,
): Promise<readonly FocusStop[]> {
    const stops: FocusStop[] = [];
    for (let tab = 0; tab < TAB_BOUND; tab += 1) {
        await page.key('Tab');
        const stop = await page.evaluate<FocusStop>(FOCUS_STOP);
        if (stop.name === OUTSIDE) continue;
        stops.push(stop);
        if (last(stop.name)) return stops;
    }
    throw new Error('Tab never arrived: ' + JSON.stringify(stops));
}

function assertOutlined(stops: readonly FocusStop[]): void {
    for (const stop of stops) {
        assertNotStrictEquals(stop.outline, 'none', stop.name);
    }
}

Deno.test('the keyboard reaches what the pointer does', async () => {
    const { origin, page } = await openDocs('');
    try {
        const gridHref = await page.evaluate<string>(
            `document.querySelector('#api-elevation a')`
            + `.getAttribute('href')`,
        );
        const landing = await tabTo(
            page, (name) => name.startsWith('grid '),
        );
        assertEquals(landing.map((stop) => stop.name), [
            'view-as everyone',
            'search',
            ...API_DOC_STEPS.map((step) => 'step #' + step.hash),
            'grid ' + gridHref,
        ]);
        assertOutlined(landing);
        const room = API_DOC_ROOMS.find(
            (entry) => '#' + entry.hash === gridHref,
        );
        assert(room !== undefined, gridHref);
        await page.key('Enter');
        const title = room.verb + ' ' + room.uri;
        await page.until<string>(
            `${visible(ROOM_H1)}`
            + ` && document.querySelector('${ROOM_H1}')`
            + `.textContent.trim() === ${JSON.stringify(title)}`
            + ` && ${visible(CURL)} ? 'opened' : null`,
            'the grid endpoint, opened by Enter',
        );
        const opened = await tabTo(page, (name) => name === 'copy');
        assertOutlined(opened);
    } finally {
        await closeDocs(origin, page);
    }
});

Deno.test('Enter typed straight after a narrowing query opens'
    + ' the first hit', async () => {
    const { origin, page } = await openDocs('');
    try {
        await page.key('/');
        await typeText(page, MIXED_QUERY);
        const href = await page.until<string>(
            `(() => {
                const links = [...document.querySelectorAll(
                    '${HITS}')];
                return links.length > 1 && links[0].checkVisibility()
                    ? links[0].getAttribute('href')
                    : null;
            })()`,
            'the hits for a narrowing query',
        );
        await page.key('Enter');
        const room = API_DOC_ROOMS.find(
            (entry) => '#' + entry.hash === href,
        );
        assert(room !== undefined, href);
        assertStrictEquals(
            await page.until<string>(
                `${visible(ROOM_H1)}`
                + ` ? document.querySelector('${ROOM_H1}')`
                + `.textContent.trim() : null`,
                'the first hit, opened',
            ),
            room.verb + ' ' + room.uri,
        );
        assertStrictEquals(
            await page.evaluate<string>('location.hash'),
            href,
        );
    } finally {
        await closeDocs(origin, page);
    }
});

// It names several endpoints, in five letters.
const SHORT_QUERY = 'flows';

Deno.test('emptying the search clears its hits and leaves'
    + ' ArrowDown to the box', async () => {
    const { origin, page } = await openDocs('');
    try {
        await page.click(SEARCH);
        await typeText(page, SHORT_QUERY);
        await page.waitFor(HITS);
        for (const _letter of SHORT_QUERY) {
            await page.key('Backspace');
        }
        await page.until(
            `document.querySelector('#api-search-results').hidden`
            + ` && ${visible('#api-elevation svg')}`,
            'the landing after the query is emptied',
        );
        assertStrictEquals(
            await page.evaluate<number>(
                `document.querySelector('#api-search-hits')`
                + `.childElementCount`,
            ),
            0,
        );
        assertStrictEquals(
            await page.evaluate<string>(
                `document.querySelector('#api-search-count')`
                + `.textContent`,
            ),
            '',
        );
        await page.evaluate(
            `document.addEventListener('keydown', (event) => {
                globalThis.arrowDownPrevented = event.defaultPrevented;
            }); true`,
        );
        await page.key('ArrowDown');
        assertStrictEquals(
            await page.evaluate<boolean>('globalThis.arrowDownPrevented'),
            false,
        );
        assertStrictEquals(
            await page.evaluate<boolean>(isActive(SEARCH)),
            true,
        );
    } finally {
        await closeDocs(origin, page);
    }
});

const SEARCH_COUNT = '#api-search-count';

Deno.test('the search count is a live region before the first'
    + ' query', async () => {
    const { origin, page } = await openDocs('');
    try {
        assertStrictEquals(
            await page.evaluate<boolean>(
                `(() => {
                    const count = document.querySelector(
                        '${SEARCH_COUNT}');
                    globalThis.searchCount = count;
                    return count.getAttribute('role') === 'status'
                        && count.closest('[hidden]') === null
                        && count.checkVisibility();
                })()`,
            ),
            true,
        );
        await page.click(SEARCH);
        await typeText(page, 'zzz');
        await page.until(
            `document.querySelector('${SEARCH_COUNT}').textContent`
            + ` === 'No endpoint matches.'`,
            'the count for a query with no hits',
        );
        assertStrictEquals(
            await page.evaluate<boolean>(
                `document.querySelector('${SEARCH_COUNT}')`
                + ` === globalThis.searchCount`,
            ),
            true,
        );
    } finally {
        await closeDocs(origin, page);
    }
});

// The one live region the page keeps for a sample, apart
// from the search's own in its tools: its text, whether it
// is the region first seen, and whether a hidden ancestor
// keeps it out of the page; null while the page holds
// other than one.
const SAMPLE_REGION = `(() => {
    const regions = [...document.querySelectorAll(
        '.api-documentation :is([role="status"], [role="alert"],'
        + ' [aria-live])')].filter(
        (region) => region.closest('#api-tools') === null);
    if (regions.length !== 1) return null;
    globalThis.sampleRegion ??= regions[0];
    return {
        text: regions[0].textContent.trim(),
        same: regions[0] === globalThis.sampleRegion,
        hidden: regions[0].closest('[hidden]') !== null,
    };
})()`;

interface SampleRegion {
    readonly text: string;
    readonly same: boolean;
    readonly hidden: boolean;
}

Deno.test('a sample\'s loading and its fault speak from one'
    + ' live region', async () => {
    const { origin, page } = await openDocs('');
    try {
        // The region is in the page before the first open,
        // so the first text it takes is heard.
        assertEquals(
            await page.evaluate<SampleRegion | null>(SAMPLE_REGION),
            { text: '', same: true, hidden: false },
        );
        await withHeldRequests(
            page, '*/samples/*', () => true, async (hold) => {
                await page.evaluate(
                    `location.hash = '#get/organizations/id/flows'; true`,
                );
                const request = await hold.next();
                const loading = await page.until<SampleRegion>(
                    `${SAMPLE_REGION}?.text === 'Loading the sample.'`
                    + ` ? ${SAMPLE_REGION} : null`,
                    'the loading announced',
                );
                assertStrictEquals(loading.same, true);
                await hold.fail(request);
                const fault = await page.until<SampleRegion>(
                    `${SAMPLE_REGION}?.text.startsWith(`
                    + `'The sample did not load') ? ${SAMPLE_REGION}`
                    + ` : null`,
                    'the fault announced',
                );
                assertStrictEquals(fault.same, true);
            },
        );
    } finally {
        await closeDocs(origin, page);
    }
});

Deno.test('Enter that ends an IME composition opens no hit',
async () => {
    const { origin, page } = await openDocs('');
    try {
        await page.click(SEARCH);
        await typeText(page, MIXED_QUERY);
        await page.waitFor(HITS);
        // CDP cannot compose, so the box gets the Enter an
        // input method sends as it commits its text.
        assertStrictEquals(
            await page.evaluate<string>(
                `document.querySelector('${SEARCH}').dispatchEvent(
                    new KeyboardEvent('keydown', {
                        key: 'Enter', isComposing: true, bubbles: true,
                    }));
                location.hash`,
            ),
            '',
        );
        assertStrictEquals(
            await page.evaluate<boolean>(visible(HITS)),
            true,
        );
    } finally {
        await closeDocs(origin, page);
    }
});

const BACK = '[data-api-docs-back]';

// The view's heading holds focus once its sample has
// painted.
function headingHeld(): string {
    return `${visible(CURL)} && ${isActive(ROOM_H1)}`
        + ` ? 'held' : null`;
}

Deno.test('a view takes focus to its heading, and Back returns'
    + ' it to where the reader was', async () => {
    const { origin, page } = await openDocs('');
    try {
        // Focused as a Tab would leave it; tabbing through the
        // shell would open its command palette over the page.
        const gridHref = await page.evaluate<string>(
            `(() => {
                const link = document.querySelector('#api-elevation a');
                link.focus();
                return link.getAttribute('href');
            })()`,
        );
        await page.key('Enter');
        await page.until(headingHeld(), 'the grid endpoint heading');
        await page.click(BACK);
        await page.until(
            isActive(`#api-elevation a[href="${gridHref}"]`)
                + ` ? 'returned' : null`,
            'the grid link after Back',
        );
        await page.key('/');
        await typeText(page, KNOWN_QUERY);
        await page.until(
            `${visible(HITS)} ? 'hit' : null`, 'the known hit',
        );
        await page.key('Enter');
        await page.until(headingHeld(), 'the hit opened from the box');
        await page.click(BACK);
        await page.until(
            `${isActive(SEARCH)} ? 'returned' : null`,
            'the search box after Back',
        );
        await page.until(
            `${visible(HITS)} ? 'hit' : null`, 'the hit again',
        );
        await page.key('ArrowDown');
        await page.key('Enter');
        await page.until(headingHeld(), 'the hit opened from its link');
        await page.click(BACK);
        await page.until(
            isActive(`${HITS}[href="${KNOWN_HASH}"]`)
                + ` ? 'returned' : null`,
            'the hit link after Back',
        );
    } finally {
        await closeDocs(origin, page);
    }
});

const GRID_LINKS = '#api-elevation a';
// The dash between an endpoint and its tier's words.
const NAME_DASH = ' — ';

// The accessible name and role Chromium computes for the
// grid link at `index`.
async function gridLinkNodeOf(
    page: Awaited<ReturnType<typeof openDocs>>['page'],
    index: number,
): Promise<{ readonly role: unknown; readonly name: unknown }> {
    const handle = await page.session.send('Runtime.evaluate', {
        expression: `document.querySelectorAll(${
            JSON.stringify(GRID_LINKS)
        })[${index}]`,
    }) as { result?: { objectId?: string } };
    const objectId = handle.result?.objectId;
    assert(objectId !== undefined, 'no grid link ' + index);
    const tree = await page.session.send(
        'Accessibility.getPartialAXTree',
        { objectId, fetchRelatives: false },
    ) as {
        nodes?: readonly {
            role?: { value?: unknown };
            name?: { value?: unknown };
        }[];
    };
    const [node] = tree.nodes ?? [];
    assert(node !== undefined, 'no node for grid link ' + index);
    return { role: node.role?.value, name: node.name?.value };
}

Deno.test('each grid link is named by the title after its shape',
    async () => {
        const { origin, page } = await openDocs('');
        try {
            const links = await page.evaluate<
                readonly (readonly [string, string])[]
            >(
                `[...document.querySelectorAll(${
                    JSON.stringify(GRID_LINKS)
                })].map((link) => [
                    link.getAttribute('href'),
                    link.lastElementChild.tagName === 'title'
                        ? link.lastElementChild.textContent : '',
                ])`,
            );
            assertStrictEquals(links.length, API_DOC_ROOMS.length);
            for (const [index, [href, title]] of links.entries()) {
                const room = API_DOC_ROOMS.find(
                    (entry) => '#' + entry.hash === href,
                );
                assert(room !== undefined, href);
                const { role, name } = await gridLinkNodeOf(page, index);
                assertStrictEquals(role, 'link', href);
                assert(typeof name === 'string', href);
                assert(
                    name.startsWith(room.verb + ' ' + room.uri + NAME_DASH),
                    name,
                );
                assertStrictEquals(name, title, href);
            }
        } finally {
            await closeDocs(origin, page);
        }
    });

const LAPTOP_VIEWPORTS = [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
] as const;

// The widest reach of any elevation label past the
// svg's right edge, or past the viewport's if that is
// nearer, in CSS pixels; zero or less means it fits.
const ELEVATION_TEXT_OVERRUN = `(() => {
    const svg = document.querySelector(
        '#api-elevation svg');
    const edge = Math.min(
        svg.getBoundingClientRect().right, innerWidth);
    let worst = { overrun: -Infinity, text: '' };
    for (const text of svg.querySelectorAll('text')) {
        const overrun =
            text.getBoundingClientRect().right - edge;
        if (overrun > worst.overrun) {
            worst = { overrun, text: text.textContent };
        }
    }
    return worst;
})()`;

for (const viewport of LAPTOP_VIEWPORTS) {
    Deno.test(
        `the elevation fits a ${viewport.width}px laptop`,
    async () => {
        const { origin, page } = await openDocs('');
        try {
            // Desktop emulation, as a laptop browser
            // full screen draws it.
            await page.setViewport(
                viewport.width, viewport.height, false,
            );
            await page.until(
                `innerWidth === ${viewport.width}`,
                'laptop viewport width',
            );
            const worst = await page.evaluate<{
                overrun: number;
                text: string;
            }>(ELEVATION_TEXT_OVERRUN);
            assert(
                worst.overrun <= 0,
                `"${worst.text}" runs ${worst.overrun}px`
                + ` past the elevation's right edge`,
            );
        } finally {
            await closeDocs(origin, page);
        }
    });
}
