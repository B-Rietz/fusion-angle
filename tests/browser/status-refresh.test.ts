import { assertEquals } from '@std/assert';
import {
    type Origin,
    type Page,
    stays,
    startOrigin,
    useBrowser,
    withHeldRequests,
} from './fixtures.ts';

const browser = useBrowser();

// A fixed commit, so no refresh waits on git, and an API
// wait no loaded machine reaches: these tests hold or fail
// the page's own requests, never the API's.
const STATUS = {
    commit: {
        sha: '0123456789abcdef0123456789abcdef01234567',
        subject: 'Refresh the status page when its card changes',
    },
    apiStatusWaitMs: 10_000,
};
const UNCHANGED_MS = 3_000;
const HELD_MS = 3_000;

// The table's first two rungs, and a skew of the page's
// clock past the first.
const UNDER_A_MINUTE_WAIT_MS = 1_000;
const OVER_A_MINUTE_WAIT_MS = 10_000;
const PAST_A_MINUTE_MS = 61_000;

// The page's clock reads skewMs ahead, and each timer it
// sets records the wait it asked for, then runs after a
// short tick, so the table's waits pass in real seconds.
const RECORDED_TICK_MS = 50;
const RECORD_WAITS = `(() => {
    window.waits = [];
    window.skewMs = 0;
    window.realNow = performance.now.bind(performance);
    window.realSetTimeout = window.setTimeout;
    performance.now = () => window.realNow() + window.skewMs;
    window.setTimeout = (callback, waitMs, ...rest) => {
        window.waits.push(waitMs);
        return window.realSetTimeout(
            callback, ${RECORDED_TICK_MS}, ...rest,
        );
    };
})()`;
const RESTORE_WAITS = `(() => {
    delete performance.now;
    window.setTimeout = window.realSetTimeout;
})()`;

// The card as a viewer reads it: tone, rating, pills.
const CARD = `(() => {
    const card = document.getElementById('status-card');
    return [
        card.dataset.tone,
        card.querySelector('.status-rating')
            .textContent.trim(),
        [...card.querySelectorAll('.pill')]
            .map((pill) => pill.textContent).join(','),
    ].join('|');
})()`;

async function withStatusPage(
    fn: (page: Page, origin: Origin) => Promise<void>,
): Promise<void> {
    const origin = await startOrigin(STATUS);
    try {
        const page = await browser.get().newPage();
        try {
            await page.navigate(origin.baseUrl + '/status');
            await page.waitFor('#status-card');
            await fn(page, origin);
        } finally {
            await browser.get()
                .disposeContext(page.contextId);
        }
    } finally {
        await origin.close();
    }
}

function cardReads(page: Page, card: string): Promise<boolean> {
    return page.until<boolean>(
        `${CARD} === ${JSON.stringify(card)}`,
        `card ${card}`,
    );
}

function lastWaitIs(page: Page, waitMs: number): Promise<boolean> {
    return page.until<boolean>(
        `window.waits.at(-1) === ${waitMs}`,
        `a wait of ${waitMs} ms`,
    );
}

Deno.test('the status card changes without a reload',
async () => {
    await withStatusPage(async (page, origin) => {
        await cardReads(page, 'success|UP|');
        await page.evaluate('window.kept = true');
        origin.db.probe = () => Promise.resolve('down');
        try {
            await cardReads(page, 'error|DOWN|API down');
            assertEquals(
                await page.evaluate<boolean>(
                    'window.kept === true',
                ),
                true,
            );
        } finally {
            Reflect.deleteProperty(origin.db, 'probe');
        }
        await cardReads(page, 'success|UP|');
    });
});

Deno.test('an unchanged status leaves the card in place',
async () => {
    await withStatusPage(async (page) => {
        await page.evaluate(`(() => {
            window.asked = 0;
            const send = window.fetch;
            window.fetch = (...args) => {
                window.asked += 1;
                return send(...args);
            };
            document.getElementById('status-card').kept = true;
        })()`);
        await stays(
            page,
            `document.getElementById('status-card').kept`,
            UNCHANGED_MS,
        );
        assertEquals(
            await page.evaluate<boolean>('window.asked >= 2'),
            true,
        );
    });
});

Deno.test('no answer shows the timeout card', async () => {
    await withStatusPage(async (page, origin) => {
        await cardReads(page, 'success|UP|');
        await withHeldRequests(
            page, origin.baseUrl + '/status', () => true,
            async (hold) => {
                await hold.fail(await hold.next());
                await cardReads(page, 'error|DOWN|Timeout');
                hold.stopHolding();
                await cardReads(page, 'success|UP|');
            },
        );
    });
});

Deno.test('a hung refresh shows the timeout card', async () => {
    await withStatusPage(async (page, origin) => {
        await cardReads(page, 'success|UP|');
        await withHeldRequests(
            page, origin.baseUrl + '/status', () => true,
            async (hold) => {
                await hold.next();
                await cardReads(page, 'error|DOWN|Timeout');
                hold.stopHolding();
                await cardReads(page, 'success|UP|');
            },
        );
    });
});

Deno.test('the refresh wait follows the table', async () => {
    await withStatusPage(async (page, origin) => {
        await cardReads(page, 'success|UP|');
        await page.evaluate(RECORD_WAITS);
        try {
            await lastWaitIs(page, UNDER_A_MINUTE_WAIT_MS);
            await page.evaluate(
                `window.skewMs = ${PAST_A_MINUTE_MS}`,
            );
            await lastWaitIs(page, OVER_A_MINUTE_WAIT_MS);
            origin.db.probe = () => Promise.resolve('down');
            try {
                await cardReads(page, 'error|DOWN|API down');
                await lastWaitIs(page, UNDER_A_MINUTE_WAIT_MS);
            } finally {
                Reflect.deleteProperty(origin.db, 'probe');
            }
        } finally {
            await page.evaluate(RESTORE_WAITS);
        }
    });
});

Deno.test('status requests never overlap', async () => {
    await withStatusPage(async (page, origin) => {
        await page.evaluate(`(() => {
            window.started = 0;
            window.inFlight = 0;
            window.peak = 0;
            const send = window.fetch;
            window.fetch = (...args) => {
                window.started += 1;
                window.inFlight += 1;
                window.peak = Math.max(
                    window.peak, window.inFlight,
                );
                return send(...args).finally(() => {
                    window.inFlight -= 1;
                });
            };
        })()`);
        await withHeldRequests(
            page, origin.baseUrl + '/status', () => true,
            async () => {
                await stays(page, 'window.peak <= 1', HELD_MS);
                await page.until<boolean>(
                    'window.started >= 2',
                    'a second held request',
                );
            },
        );
        assertEquals(await page.evaluate<number>('window.peak'), 1);
    });
});

Deno.test('the timeout card follows the server', async () => {
    await withStatusPage(async (page) => {
        await page.evaluate(`(() => {
            const timeout =
                document.getElementById('status-timeout');
            window.served = timeout.innerHTML;
            timeout.innerHTML = '<p>stale</p>';
        })()`);
        await page.until<boolean>(
            `document.getElementById('status-timeout')
                .innerHTML === window.served`,
            'the served timeout card',
        );
    });
});
