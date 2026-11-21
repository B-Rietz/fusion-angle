// Notify channel, payload cap, and pool width. A
// payload over the cap is a full refresh.

import type { NotificationEvent } from
    '../shared/notifications.ts';

export const FUSION_EVENTS_CHANNEL = 'fusion_events';

export const PG_NOTIFY_PAYLOAD_MAX_BYTES = 8000;

export const POOL_MAX = 10;

export function notifyPayload(
    event: NotificationEvent,
): string {
    const json = JSON.stringify(event);
    const size = new TextEncoder().encode(json).length;
    if (size > PG_NOTIFY_PAYLOAD_MAX_BYTES) {
        return '{"kind":"full"}';
    }
    return json;
}
