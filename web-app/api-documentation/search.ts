// The landing's search: the catalog the page already
// imports, filtered by what the reader typed. It fetches
// nothing.

import type {
    ApiDocRoom,
    ApiDocStatus,
    ApiDocTier,
} from './shapes.ts';

// One way into the catalog: a link to a view, its title,
// and who may call it, or `status` for a status code.
export interface SearchHit {
    readonly hash: string;
    // An endpoint's verb and URI, such as `PUT /api/…`, or
    // a status's code, such as `412`.
    readonly label: string;
    readonly tier: ApiDocTier | 'status';
}

function labelOf(room: ApiDocRoom): string {
    return room.verb + ' ' + room.uri;
}

// What a reader may search an endpoint by: its verb and
// URI, read together, each code it answers, and each
// header it declares.
function termsOf(room: ApiDocRoom): readonly string[] {
    return [
        labelOf(room),
        ...room.answers.map((answer) => answer.code),
        ...room.headerSets.flatMap((set) =>
            set.headers.map((header) => header.name)),
    ];
}

// Every endpoint with a term holding the query, then
// every status whose code holds it, each in catalog
// order. Case is folded.
export function searchCatalog(
    query: string,
    rooms: readonly ApiDocRoom[],
    statuses: readonly ApiDocStatus[],
): readonly SearchHit[] {
    const needle = query.toLowerCase();
    const holds = (term: string): boolean =>
        term.toLowerCase().includes(needle);
    return [
        ...rooms
            .filter((room) => termsOf(room).some(holds))
            .map((room): SearchHit => ({
                hash: room.hash,
                label: labelOf(room),
                tier: room.tier,
            })),
        ...statuses
            .filter((status) => holds(status.code))
            .map((status): SearchHit => ({
                hash: status.hash,
                label: status.code,
                tier: 'status',
            })),
    ];
}
