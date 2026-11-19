import { latchPageLeaving } from '../error-helpers.ts';

export function getQueryString(): string {
    return window.location.search;
}

export function putLocation(url: string): void {
    latchPageLeaving();
    window.location.href = url;
}

export function getHref(): string {
    return window.location.href;
}

// Rewrites the address bar without a reload or a history
// entry.
export function putAddress(url: string): void {
    history.replaceState(history.state, '', url);
}

export function reloadLocation(): void {
    latchPageLeaving();
    window.location.reload();
}
