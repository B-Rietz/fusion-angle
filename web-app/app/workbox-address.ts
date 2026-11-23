// The workbox page's address naming the work order its box
// holds, or none. Every other query parameter — the
// organization stamp boot writes among them — stays.
const WORK_ORDER_PARAM = 'id';

export function workOrderAddress(
    href: string,
    id: string | null,
): string {
    const url = new URL(href);
    if (id === null) {
        url.searchParams.delete(WORK_ORDER_PARAM);
    } else {
        url.searchParams.set(WORK_ORDER_PARAM, id);
    }
    return url.pathname + url.search + url.hash;
}
