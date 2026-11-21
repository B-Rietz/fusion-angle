// How long the status page waits for its own refresh,
// and how long it waits between refreshes. The page's
// wait covers /status's own wait for /api/status, plus
// a second for the viewer's network.

const SECOND_MS = 1_000;
const TEN_SECONDS_MS = 10 * SECOND_MS;
const MINUTE_MS = 60 * SECOND_MS;
const TEN_MINUTES_MS = 10 * MINUTE_MS;
const HOUR_MS = 60 * MINUTE_MS;

export const STATUS_PAGE_WAIT_MS = 1_500;

// The longer the card has held, the longer the wait. The
// operator capped it, so an outage shows within that.
const LADDER: readonly {
    readonly underMs: number;
    readonly waitMs: number;
}[] = [
    { underMs: MINUTE_MS, waitMs: SECOND_MS },
    { underMs: TEN_MINUTES_MS, waitMs: TEN_SECONDS_MS },
    { underMs: HOUR_MS, waitMs: MINUTE_MS },
];
const LONGEST_WAIT_MS = TEN_MINUTES_MS;

export function refreshWaitMs(sinceChangeMs: number): number {
    const rung = LADDER.find(
        ({ underMs }) => sinceChangeMs < underMs,
    );
    return rung === undefined ? LONGEST_WAIT_MS : rung.waitMs;
}
