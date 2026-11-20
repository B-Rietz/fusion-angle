import { assert, assertFalse, assertStrictEquals } from
    '@std/assert';
import {
    ORGANIZATION_TWO, STARK_ORGANIZATION,
} from '../../api/mock-data/seed-constants.ts';
import {
    signIn, startOrigin, stays, useBrowser, withAdminPage,
    withHeldRequests, withTimeout, type Origin, type Page,
} from './fixtures.ts';
import { registryUrl } from
    '../../web-app/app/browser-drive.ts';

const browser = useBrowser();
// Seed index 0, so a Stark idea.
const STARK_IDEA = 'YvOylAxOjQcgmNmsSoVBPQ';
// Wayne's seeded approved idea, "Automated Report
// Generation".
const WAYNE_IDEA = 'WurwPqXxGtLhRAoCEcPzfQ';
const WAYNE_IDEA_QUERY = 'ideaId=' + WAYNE_IDEA
    + '&organization=' + ORGANIZATION_TWO;
// A Wayne-only member of the seed.
const WAYNE_MEMBER_EMAIL = 'mike.thompson@company.com';
const ACTIVE_ORGANIZATION =
    `localStorage.getItem(`
    + `'fusion-angle:active-organization-id')`;
const ADDRESS_ORGANIZATION =
    `new URLSearchParams(location.search)`
    + `.get('organization')`;
const CONTENT_TEXT =
    `document.querySelector('.page-content').textContent`;
const SWITCH_BUTTON =
    `document.querySelector('[data-switch-organization-btn]')`
    + ` !== null`;
const RETRY_BUTTON =
    `document.querySelector('[data-retry-btn]') !== null`;
// How long the first organization lookup stays held while
// the content must show no error state.
const LOOKUP_HELD_MS = 1_000;

// withAdminPage, signed in as another seeded member.
async function withPageAs(
    email: string,
    fn: (page: Page, origin: Origin) => Promise<void>,
): Promise<void> {
    await withTimeout((async () => {
        const origin = await startOrigin();
        try {
            const page = await browser.get().newPage();
            try {
                await signIn(page, origin, email);
                await fn(page, origin);
            } finally {
                await browser.get().disposeContext(
                    page.contextId,
                );
            }
        } finally {
            await origin.close();
        }
    })(), 'withPageAs');
}

Deno.test(
    'an organization-scoped page gains its organization'
    + ' in the address',
    async () => {
        await withAdminPage(browser.get(), async (page, origin) => {
            await page.navigate(registryUrl(origin.baseUrl, 'ideas'));
            await page.ready('ideas');
            assertStrictEquals(
                await page.evaluate<string>(ACTIVE_ORGANIZATION),
                STARK_ORGANIZATION,
            );
            assertStrictEquals(
                await page.evaluate<string>(ADDRESS_ORGANIZATION),
                STARK_ORGANIZATION,
            );
            await page.navigate(registryUrl(
                origin.baseUrl, 'idea-detail',
                'ideaId=' + STARK_IDEA,
            ));
            await page.ready('idea-detail');
            assertStrictEquals(
                await page.evaluate<string>(
                    `new URLSearchParams(location.search)`
                    + `.get('ideaId')`,
                ),
                STARK_IDEA,
            );
            assertStrictEquals(
                await page.evaluate<string>(ADDRESS_ORGANIZATION),
                STARK_ORGANIZATION,
            );
        });
    },
);

Deno.test(
    "another of the viewer's organizations offers the switch",
    async () => {
        await withAdminPage(browser.get(), async (page, origin) => {
            await page.navigate(registryUrl(origin.baseUrl, 'ideas'));
            await page.ready('ideas');
            assertStrictEquals(
                await page.evaluate<string>(ACTIVE_ORGANIZATION),
                STARK_ORGANIZATION,
            );
            await page.navigate(registryUrl(
                origin.baseUrl, 'idea-detail', WAYNE_IDEA_QUERY,
            ));
            await page.waitFor('[data-switch-organization-btn]');
            assert(await page.evaluate<boolean>(
                `${CONTENT_TEXT}.includes(${JSON.stringify(
                    'This page is in Wayne Enterprises',
                )})`,
            ));
            assert(await page.evaluate<boolean>(
                `${CONTENT_TEXT}.includes(${JSON.stringify(
                    "You're currently viewing Stark Industries.",
                )})`,
            ));
            assertFalse(await page.evaluate<boolean>(RETRY_BUTTON));
            assertStrictEquals(
                await page.evaluate<string>('location.search'),
                '?' + WAYNE_IDEA_QUERY,
            );
            assertStrictEquals(
                await page.evaluate<string>(ACTIVE_ORGANIZATION),
                STARK_ORGANIZATION,
            );
            await page.click('[data-switch-organization-btn]');
            await page.ready('idea-detail');
            assertStrictEquals(
                await page.evaluate<string>(ACTIVE_ORGANIZATION),
                ORGANIZATION_TWO,
            );
            await page.until<boolean>(
                `${CONTENT_TEXT}.includes(${JSON.stringify(
                    'Automated Report Generation',
                )})`,
                'the Wayne idea',
            );
            assertStrictEquals(
                await page.evaluate<string>(ADDRESS_ORGANIZATION),
                ORGANIZATION_TWO,
            );
        });
    },
);

Deno.test(
    "a foreign organization's page shows no access and no name",
    async () => {
        await withPageAs(WAYNE_MEMBER_EMAIL, async (page, origin) => {
            await page.navigate(registryUrl(
                origin.baseUrl, 'ideas',
                'organization=' + STARK_ORGANIZATION,
            ));
            await page.until<boolean>(
                `[...document.querySelectorAll('.page-content a')]`
                + `.some(a => a.textContent.trim()`
                + ` === 'Go to Dashboard')`,
                'the Go to Dashboard link',
            );
            assert(await page.evaluate<boolean>(
                `${CONTENT_TEXT}.includes(${JSON.stringify(
                    "You don't have access to this page",
                )})`,
            ));
            assertFalse(await page.evaluate<boolean>(
                `${CONTENT_TEXT}.includes(${JSON.stringify(
                    'Stark Industries',
                )})`,
            ));
            assertFalse(await page.evaluate<boolean>(
                `${CONTENT_TEXT}.includes(${JSON.stringify(
                    STARK_ORGANIZATION,
                )})`,
            ));
            assertFalse(await page.evaluate<boolean>(SWITCH_BUTTON));
        });
    },
);

Deno.test(
    'a failed organization lookup shows the error state',
    async () => {
        await withAdminPage(browser.get(), async (page, origin) => {
            await page.navigate(registryUrl(origin.baseUrl, 'ideas'));
            await page.ready('ideas');
            assertStrictEquals(
                await page.evaluate<string>(ACTIVE_ORGANIZATION),
                STARK_ORGANIZATION,
            );
            await withHeldRequests(
                page,
                '*/identities/*/organizations/*',
                () => true,
                async (hold) => {
                    await page.navigate(registryUrl(
                        origin.baseUrl, 'idea-detail',
                        WAYNE_IDEA_QUERY,
                    ));
                    // The boot waits on the lookup, so while it
                    // is held no error state may show.
                    const lookup = await hold.next();
                    assertFalse(
                        await page.evaluate<boolean>(RETRY_BUTTON),
                    );
                    await stays(page, RETRY_BUTTON, LOOKUP_HELD_MS);
                    await hold.fail(lookup);
                    // next() throws when no request arrives
                    // within its bound, so the loop ends.
                    while (
                        !(await page.evaluate<boolean>(RETRY_BUTTON))
                    ) {
                        await hold.fail(await hold.next());
                    }
                },
            );
            assertFalse(await page.evaluate<boolean>(SWITCH_BUTTON));
        });
    },
);
