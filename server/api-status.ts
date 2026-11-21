// /status learns the system's health from the API over HTTP,
// as it must once the API is a separate service. The address
// is the listener's own loopback port, never anything the
// incoming request carries: its Host, a forwarded line, or a
// query string.

import { HTTP_OK } from '../shared/http-errors.ts';
import type { ComponentState } from '../shared/system-status.ts';

// The probe, the loopback request, and opening a Postgres
// connection when the pool has none.
export const API_STATUS_WAIT_MS = 500;

export function apiStatusUrl(port: number): string {
    return 'http://127.0.0.1:' + String(port) + '/api/status';
}

// One request, no retry. The hop that waited names the state:
// an API that answered is `down` here, never `timeout`,
// whatever it says of its own components.
export async function apiState(
    url: string,
    waitMs: number,
): Promise<ComponentState> {
    const controller = new AbortController();
    const timer = setTimeout(() => { controller.abort(); }, waitMs);
    try {
        return await answeredState(url, controller.signal);
    } finally {
        clearTimeout(timer);
    }
}

async function answeredState(
    url: string,
    signal: AbortSignal,
): Promise<ComponentState> {
    let response: Response;
    try {
        response = await fetch(url, {
            headers: { Accept: 'application/json' },
            signal,
        });
    } catch {
        return unansweredState(signal);
    }
    if (response.status !== HTTP_OK) {
        await response.body?.cancel();
        return 'down';
    }
    let text: string;
    try {
        text = await response.text();
    } catch {
        return unansweredState(signal);
    }
    return saysUp(text) ? 'up' : 'down';
}

// The wait's abort is the one failure that is a timeout. A
// refused connection or a broken body is down.
function unansweredState(signal: AbortSignal): ComponentState {
    return signal.aborted ? 'timeout' : 'down';
}

function saysUp(text: string): boolean {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return false;
    }
    if (parsed === null
        || typeof parsed !== 'object'
        || Array.isArray(parsed)) {
        return false;
    }
    return (parsed as { readonly up?: unknown }).up === true;
}
