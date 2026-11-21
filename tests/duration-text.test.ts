import { assertEquals } from '@std/assert';
import { durationText } from '../shared/duration-text.ts';

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

Deno.test('a duration names its largest unit alone', () => {
    const cases: readonly [number, string][] = [
        [-5 * SECOND, 'now'],
        [0, 'now'],
        [999, 'now'],
        [SECOND, '1 second'],
        [59 * SECOND, '59 seconds'],
        [MINUTE, '1 minute'],
        [90 * SECOND, '2 minutes'],
        [89 * SECOND, '1 minute'],
        [59.6 * MINUTE, '60 minutes'],
        [HOUR, '1 hour'],
        [36 * HOUR, '2 days'],
        [6 * DAY + 13 * HOUR, '7 days'],
        [WEEK, '1 week'],
        [29 * DAY, '4 weeks'],
        [MONTH, '1 month'],
        [400 * DAY, '13 months'],
    ];
    for (const [elapsedMs, text] of cases) {
        assertEquals(durationText(elapsedMs), text, String(elapsedMs));
    }
});
