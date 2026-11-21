// A duration read by a person: the largest unit it has
// reached, alone, rounded to a whole count. A month is 30
// days. Under a second there is no unit to name.

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;

const UNITS: readonly {
    readonly name: string;
    readonly ms: number;
}[] = [
    { name: 'month', ms: MONTH_MS },
    { name: 'week', ms: WEEK_MS },
    { name: 'day', ms: DAY_MS },
    { name: 'hour', ms: HOUR_MS },
    { name: 'minute', ms: MINUTE_MS },
    { name: 'second', ms: SECOND_MS },
];

export const NO_DURATION = 'now';

export function durationText(elapsedMs: number): string {
    const unit = UNITS.find(({ ms }) => elapsedMs >= ms);
    if (unit === undefined) return NO_DURATION;
    const count = Math.round(elapsedMs / unit.ms);
    return String(count) + ' ' + unit.name
        + (count === 1 ? '' : 's');
}
