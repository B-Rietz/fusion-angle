// Which header lines of an example exchange the page
// highlights. Essential: a header the documentation
// names. Provided: a response header the product sets for
// a reader to use. A header that is both is essential,
// and every other header stays plain.

import {
    API_DOC_PROVIDED_HEADERS,
    API_DOC_TRANSPORT,
    type ApiDocHeaderSet,
    type ApiDocRoom,
} from './rooms.ts';
import type { ApiDocRequest } from './shapes.ts';

export type Highlight = 'essential' | 'provided' | 'plain';

const SEGMENT_SEPARATOR = '/';
const QUERY_SEPARATOR = '?';

// What a route's parameter, such as `:id`, opens with.
const PARAMETER_PREFIX = ':';

// A path fits a route when each of its segments is the
// route's own, or the route's is a parameter and the
// path's is not empty.
function fitsRoute(path: string, route: string): boolean {
    const sent = path.split(SEGMENT_SEPARATOR);
    const declared = route.split(SEGMENT_SEPARATOR);
    return sent.length === declared.length
        && declared.every((segment, index) =>
            segment.startsWith(PARAMETER_PREFIX)
                ? sent[index] !== ''
                : sent[index] === segment
        );
}

// The query string is no part of the path.
function pathOf(target: string): string {
    const query = target.indexOf(QUERY_SEPARATOR);
    return query < 0 ? target : target.slice(0, query);
}

// The endpoint a request calls: the one room whose verb
// is the request's method and whose route its path fits.
// A request that calls none, or more than one, is a fault
// in the catalog, so it throws rather than paint plain.
export function roomCalledBy(
    request: ApiDocRequest,
    rooms: readonly ApiDocRoom[],
): ApiDocRoom {
    const path = pathOf(request.target);
    const called = rooms.filter((room) =>
        room.verb === request.method && fitsRoute(path, room.uri)
    );
    const [room, ...more] = called;
    if (room === undefined || more.length > 0) {
        throw new Error(
            request.method + ' ' + request.target + ' calls '
                + called.length + ' endpoints, not one',
        );
    }
    return room;
}

function lists(
    sets: readonly ApiDocHeaderSet[],
    name: string,
): boolean {
    return sets.some((set) =>
        set.headers.some((header) => header.name === name)
    );
}

// A request header is essential when the endpoint's own
// header sets or the transport sets list it.
export function requestHighlightOf(
    name: string,
    room: ApiDocRoom,
): Highlight {
    return lists(room.headerSets, name)
        || lists(API_DOC_TRANSPORT, name)
        ? 'essential'
        : 'plain';
}

// A character a header's name or a word may hold: a name
// with one on either side is part of a longer one.
const NAME_CHARACTER = '[A-Za-z0-9_-]';

// The characters a pattern reads as other than
// themselves.
const PATTERN_SYNTAX = /[.*+?^${}()|[\]\\]/g;

// Whether the text names the header: its name standing
// whole, in any case.
function namesHeader(text: string, name: string): boolean {
    return new RegExp(
        '(?<!' + NAME_CHARACTER + ')'
            + name.replace(PATTERN_SYNTAX, '\\$&')
            + '(?!' + NAME_CHARACTER + ')',
        'i',
    ).test(text);
}

// A response header is essential when the words name it,
// and provided when the product sets it for a reader to
// use and no word names it.
export function responseHighlightOf(
    name: string,
    words: readonly string[],
): Highlight {
    if (words.some((text) => namesHeader(text, name))) {
        return 'essential';
    }
    return API_DOC_PROVIDED_HEADERS.includes(name)
        ? 'provided'
        : 'plain';
}
