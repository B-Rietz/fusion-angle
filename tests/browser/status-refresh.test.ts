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
const RELOAD_MS = 10_000;

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
    status: Parameters<typeof startOrigin>[0] = STATUS,
): Promise<void> {
    const origin = await startOrigin(status);
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

// A reload destroys the context an evaluate may be
// in; that one error means "not yet", any other fails.
async function untilAcrossReload(
    page: Page, expression: string, label: string,
): Promise<void> {
    const deadline = Date.now() + RELOAD_MS;
    while (Date.now() < deadline) {
        try {
            if (await page.evaluate<boolean>(expression)) {
                return;
            }
        } catch (error) {
            if (!(error instanceof Error)
                || !/context/i.test(error.message)) {
                throw error;
            }
        }
        await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(label + ' timed out');
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

Deno.test('a new status script reloads the page', async () => {
    await withStatusPage(async (page) => {
        await cardReads(page, 'success|UP|');
        await page.evaluate(`(() => {
            window.kept = true;
            const send = window.fetch;
            window.fetch = async (...args) => {
                const response = await send(...args);
                const html = await response.text();
                return new Response(html.replace(
                    /status-refresh\\.[0-9a-f]+\\.js/,
                    'status-refresh.0000000000000000.js',
                ), {
                    status: response.status,
                    headers: response.headers,
                });
            };
        })()`);
        await untilAcrossReload(
            page,
            `window.kept === undefined
                && !!document.getElementById('status-card')`,
            'the reloaded page',
        );
        await page.evaluate('window.settled = true');
        await stays(page, 'window.settled === true', UNCHANGED_MS);
    });
});

Deno.test('no answer shows the timeout card', async () => {
    await withStatusPage(async (page, origin) => {
        await cardReads(page, 'success|UP|');
        await page.evaluate('window.kept = true');
        await withHeldRequests(
            page, origin.baseUrl + '/status', () => true,
            async (hold) => {
                await hold.fail(await hold.next());
                await cardReads(page, 'error|DOWN|Timeout');
                hold.stopHolding();
                await cardReads(page, 'success|UP|');
            },
        );
        assertEquals(
            await page.evaluate<boolean>('window.kept === true'),
            true,
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

// Seconds old, so its age ticks between refreshes.
function agingStatus(): Parameters<typeof startOrigin>[0] {
    const committedMs = Date.now() - 5_000;
    return {
        ...STATUS,
        commit: {
            ...STATUS.commit,
            committedAt: new Date(committedMs).toISOString(),
            history: [{
                sha: 'fedcba9876543210fedcba9876543210fedcba98',
                subject: 'Land the commit before',
                committedAt: new Date(
                    committedMs - 1_000,
                ).toISOString(),
            }],
        },
    };
}

const AGE = `document.querySelector('#status-card .git-age')
    .textContent`;
const HISTORY_AGE = `document.querySelector(
    '#status-card ol .git-age').textContent`;

Deno.test('a ticking age keeps the card and backs off',
async () => {
    await withStatusPage(async (page) => {
        await cardReads(page, 'success|UP|');
        const first = await page.evaluate<string>(AGE);
        const firstHistory = await page.evaluate<string>(
            HISTORY_AGE,
        );
        await page.evaluate(
            `document.getElementById('status-card').kept = true`,
        );
        await page.until<boolean>(
            `${AGE} !== ${JSON.stringify(first)}`,
            'the age ticks',
        );
        await page.until<boolean>(
            `${HISTORY_AGE} !== ${JSON.stringify(firstHistory)}`,
            'the history age ticks',
        );
        assertEquals(
            await page.evaluate<boolean>(
                `document.getElementById('status-card').kept`,
            ),
            true,
        );
        await page.evaluate(RECORD_WAITS);
        try {
            await page.evaluate(
                `window.skewMs = ${PAST_A_MINUTE_MS}`,
            );
            await lastWaitIs(page, OVER_A_MINUTE_WAIT_MS);
        } finally {
            await page.evaluate(RESTORE_WAITS);
        }
    }, agingStatus());
});

Deno.test('the history sits inside the live card', async () => {
    await withStatusPage(async (page) => {
        assertEquals(
            await page.evaluate<string>(`(() => {
                const ol = document
                    .querySelector('#status-card ol');
                return [
                    !!ol.closest('#status-live'),
                    ol.querySelector('.git-subject').textContent,
                    /^\\d+ seconds ago$/.test(
                        ol.querySelector('.git-age').textContent,
                    ),
                    document.getElementById('status-merges')
                        === null,
                ].join('|');
            })()`),
            'true|Land the commit before|true|true',
        );
    }, agingStatus());
});

// Ten entries make the card taller than a 400px viewport.
function longHistoryStatus(): Parameters<typeof startOrigin>[0] {
    return {
        ...STATUS,
        commit: {
            ...STATUS.commit,
            history: Array.from({ length: 10 }, (_, index) => ({
                sha: (index + 1).toString(16).padStart(40, '0'),
                subject: 'Land commit ' + (index + 1),
            })),
        },
    };
}

Deno.test('the card keeps whitespace at a short height',
async () => {
    await withStatusPage(async (page) => {
        await page.setViewport(1280, 400, false);
        await page.until<boolean>(`(() => {
            scrollTo(0, 0);
            const card = document.getElementById('status-card')
                .getBoundingClientRect();
            return [
                card.height > innerHeight,
                card.top >= 32,
                document.documentElement.scrollHeight
                    - card.bottom >= 32,
            ].join('|') === 'true|true|true';
        })()`, 'whitespace around a tall card');
    }, longHistoryStatus());
});

Deno.test('each commit line is one line tall', async () => {
    await withStatusPage(async (page) => {
        // The card is in the DOM before the stylesheet
        // applies; measure the styled line.
        await page.until<boolean>(
            `document.readyState === 'complete'`,
            'the styled page',
        );
        assertEquals(
            await page.evaluate<string>(`[
                ...document.querySelectorAll(
                    '#status-card p:has(> .git-sha)'),
            ].map((line) => Math.abs(
                line.getBoundingClientRect().height
                - parseFloat(getComputedStyle(line).lineHeight),
            ) < 0.5).join(',')`),
            'true,true',
        );
    }, agingStatus());
});
