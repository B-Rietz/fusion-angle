// The request headers each endpoint prints (spec,
// Headers): its `endpoint` declarations with their
// states, from api/request-headers.ts, forbidden ones
// included. The `transport` declarations are stated once,
// in the guided start. The `site` ones are read outside
// the API and are printed nowhere. A declaration the gate
// never reads for a kind (`unused`) is absent.

import { GRANT_TYPES } from '../../api/authentication.ts';
import { AUTHENTICATION_ROUTES } from
    '../../api/request-auth.ts';
import {
    REQUEST_HEADER_DECLARATIONS,
    type RequestHeaderDeclaration,
    type RequestKind,
    type RequestMethod,
} from '../../api/request-headers.ts';
import {
    offeredVerbs,
    routePatternOf,
} from '../../api/route-surface.ts';
import type { HttpVerb } from '../../api/route-surface.ts';
import { routes } from '../../api/routes.ts';
import type {
    ApiDocHeader,
    ApiDocHeaderSet,
} from '../api-documentation/shapes.ts';
import type { Endpoint } from './api-documentation-story.ts';

// The one route whose headers differ by grant_type. A
// grant_type outside GRANT_TYPES is refused with 400, so
// that kind prints no set.
const TOKEN_ROUTE = 'authentication/token';
const API_MOUNT = '/api/';
const ALWAYS = '';

const METHODS: Readonly<Record<HttpVerb, RequestMethod>> = {
    get: 'GET',
    query: 'QUERY',
    put: 'PUT',
    post: 'POST',
    patch: 'PATCH',
    delete: 'DELETE',
};

const BODY_METHODS: ReadonlySet<RequestMethod> =
    new Set<RequestMethod>(['PUT', 'POST', 'PATCH', 'QUERY']);

function declarationsOn(
    surface: RequestHeaderDeclaration['surface'],
): readonly RequestHeaderDeclaration[] {
    return REQUEST_HEADER_DECLARATIONS.filter(
        (declaration) => declaration.surface === surface,
    );
}

const ENDPOINT_DECLARATIONS = declarationsOn('endpoint');
const TRANSPORT_DECLARATIONS = declarationsOn('transport');

// In declaration order. An alternative carries its
// declaration's set; every other state carries none.
function headersOf(
    declarations: readonly RequestHeaderDeclaration[],
    kind: RequestKind,
): readonly ApiDocHeader[] {
    return declarations.flatMap((declaration) => {
        const state = declaration.stateOf(kind);
        if (state === 'unused') return [];
        return [{
            name: declaration.name,
            state,
            alternatives: state === 'alternative'
                ? [...declaration.alternatives]
                : [],
        }];
    });
}

function kindOf(
    routePattern: string,
    verb: HttpVerb,
    bodySent: boolean,
): RequestKind {
    return { routePattern, method: METHODS[verb], bodySent };
}

function sameNames(
    left: readonly string[],
    right: readonly string[],
): boolean {
    return left.length === right.length
        && left.every((name, index) => name === right[index]);
}

function sameHeaders(
    left: readonly ApiDocHeader[],
    right: readonly ApiDocHeader[],
): boolean {
    return left.length === right.length
        && left.every((header, index) => {
            const other = right[index];
            return other !== undefined
                && header.name === other.name
                && header.state === other.state
                && sameNames(header.alternatives, other.alternatives);
        });
}

export function headerSetsOf(
    endpoint: Endpoint,
): readonly ApiDocHeaderSet[] {
    const routePattern = routePatternOf(endpoint.row);
    const kind = kindOf(
        routePattern,
        endpoint.verb,
        BODY_METHODS.has(METHODS[endpoint.verb]),
    );
    if (routePattern !== TOKEN_ROUTE) {
        return [{
            when: ALWAYS,
            headers: headersOf(ENDPOINT_DECLARATIONS, kind),
        }];
    }
    return GRANT_TYPES.map((grantType) => ({
        when: 'grant_type=' + grantType,
        headers: headersOf(
            ENDPOINT_DECLARATIONS,
            { ...kind, grantType },
        ),
    }));
}

// A request outside the sign-in routes: the first route
// the table offers outside them, under its first verb.
function outsideKind(): RequestKind {
    const row = routes.find(
        (candidate) =>
            !AUTHENTICATION_ROUTES.has(routePatternOf(candidate)),
    );
    if (row === undefined) {
        throw new Error('the route table offers no route'
            + ' outside the sign-in routes');
    }
    const [verb] = offeredVerbs(row);
    if (verb === undefined) {
        throw new Error(routePatternOf(row) + ' offers no verb');
    }
    return kindOf(routePatternOf(row), verb, true);
}

// The sign-in routes in route table order, the token
// route once per grant type.
function signInSets(): readonly ApiDocHeaderSet[] {
    return routes.flatMap((row) => {
        const routePattern = routePatternOf(row);
        if (!AUTHENTICATION_ROUTES.has(routePattern)) return [];
        return offeredVerbs(row).flatMap((verb) => {
            const kind = kindOf(routePattern, verb, true);
            const when = kind.method + ' ' + API_MOUNT + routePattern;
            if (routePattern !== TOKEN_ROUTE) {
                return [{
                    when,
                    headers: headersOf(TRANSPORT_DECLARATIONS, kind),
                }];
            }
            return GRANT_TYPES.map((grantType) => ({
                when: when + ' grant_type=' + grantType,
                headers: headersOf(
                    TRANSPORT_DECLARATIONS,
                    { ...kind, grantType },
                ),
            }));
        });
    });
}

function transportHeadersOf(): readonly ApiDocHeaderSet[] {
    const outside: ApiDocHeaderSet = {
        when: ALWAYS,
        headers: headersOf(TRANSPORT_DECLARATIONS, outsideKind()),
    };
    return [
        outside,
        ...signInSets().filter(
            (set) => !sameHeaders(set.headers, outside.headers),
        ),
    ];
}

// The transport states, each kind taken as carrying a
// body: first for a request outside the sign-in routes,
// then each sign-in kind whose states differ from those.
export const TRANSPORT_HEADERS: readonly ApiDocHeaderSet[] =
    transportHeadersOf();
