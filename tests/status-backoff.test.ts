import { assertEquals } from '@std/assert';
import { refreshWaitMs } from '../web-app/app/status-backoff.ts';

Deno.test('the refresh backs off from the last change', () => {
    assertEquals(refreshWaitMs(0), 1_000);
    assertEquals(refreshWaitMs(59_999), 1_000);
    assertEquals(refreshWaitMs(60_000), 10_000);
    assertEquals(refreshWaitMs(599_999), 10_000);
    assertEquals(refreshWaitMs(600_000), 60_000);
    assertEquals(refreshWaitMs(3_599_999), 60_000);
    assertEquals(refreshWaitMs(3_600_000), 600_000);
    assertEquals(refreshWaitMs(86_400_000), 600_000);
});
