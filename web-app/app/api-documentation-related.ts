import type { Route } from '../../api/routes.ts';
import {
    offeredVerbs,
} from '../../api/route-surface.ts';
import { INVITATION_STATES } from '../../shared/types.ts';
import type {
    ApiDocLink,
    ApiDocQueryParameter,
} from '../api-documentation/shapes.ts';
import type { Endpoint } from './api-documentation-story.ts';

const VERSIONS = 'versions';
const PARAMETER_PREFIX = ':';
const COLLECTION_TAIL = '';

type Segments = readonly string[];

function keyOf(segments: Segments): string {
    return segments.join('/');
}

function isParameter(segment: string | undefined): boolean {
    return segment !== undefined
        && segment.startsWith(PARAMETER_PREFIX);
}

function isItem(segments: Segments): boolean {
    return isParameter(segments.at(-1))
        && segments.at(-2) !== VERSIONS;
}

function isCollection(segments: Segments): boolean {
    return segments.at(-1) === COLLECTION_TAIL
        && segments.at(-2) !== VERSIONS;
}

function isOperation(segments: Segments): boolean {
    const last = segments.at(-1);
    return last !== undefined
        && last !== COLLECTION_TAIL
        && last !== VERSIONS
        && !isParameter(last);
}

function startsWith(
    segments: Segments,
    prefix: Segments,
): boolean {
    return prefix.every((s, i) => segments[i] === s);
}

// D23: the neighbours the route table gives an endpoint.
export function relatedOf(
    endpoint: Endpoint,
    all: readonly Endpoint[],
): readonly ApiDocLink[] {
    const segments = endpoint.row.segments;
    const rows = new Map<string, Route>();
    for (const { row } of all) {
        rows.set(keyOf(row.segments), row);
    }
    const links: ApiDocLink[] = [];
    const link = (
        target: Segments,
        label: string,
    ): void => {
        const row = rows.get(keyOf(target));
        if (row === undefined) return;
        const verb = offeredVerbs(row)[0];
        const chosen = all.find(
            (e) => e.row === row && e.verb === verb,
        )!;
        links.push({ hash: chosen.hash, label });
    };
    const linkItem = (item: Segments): void => {
        if (rows.has(keyOf(item)) && isItem(item)) {
            link(item, 'the item');
        }
    };
    if (isItem(segments)) {
        const parent = segments.slice(0, -1);
        link([...parent, COLLECTION_TAIL], 'the collection');
        link([...segments, VERSIONS, COLLECTION_TAIL], 'versions');
        for (const row of rows.values()) {
            const under = row.segments;
            if (
                under.length === segments.length + 1
                && startsWith(under, segments)
                && isOperation(under)
            ) {
                link(under, under[under.length - 1]!);
            }
        }
    } else if (isCollection(segments)) {
        const parent = segments.slice(0, -1);
        for (const row of rows.values()) {
            const under = row.segments;
            if (
                under.length === parent.length + 1
                && startsWith(under, parent)
                && isItem(under)
            ) {
                link(under, 'the item');
            }
        }
    } else if (segments.at(-2) === VERSIONS) {
        linkItem(segments.slice(0, -2));
    } else if (isOperation(segments)) {
        linkItem(segments.slice(0, -1));
    }
    return links;
}

const STATE_NAME = 'state';
const EVERY_STATE = 'every';

// D24: the values the route's judge accepts, found by asking
// it, and what it does when the parameter is absent.
export function queryParametersOf(
    row: Route,
): readonly ApiDocQueryParameter[] {
    const judge = row.query;
    if (judge === undefined) return [];
    const values = INVITATION_STATES.filter(
        (s) => judge(`?${STATE_NAME}=${s}`).kind !== 'refused',
    );
    const without = judge('');
    if (without.kind === 'refused') {
        throw new Error(
            `a route's query judge refuses an empty search: `
            + without.error,
        );
    }
    return [{
        name: STATE_NAME,
        values,
        absent: without.kind === 'every'
            ? EVERY_STATE
            : without.state,
    }];
}
