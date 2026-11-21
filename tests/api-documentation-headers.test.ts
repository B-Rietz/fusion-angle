// The headers each endpoint prints are the declarations'
// own states (spec, Headers). Every expectation is drawn
// from api/request-headers.ts: a declaration's surface
// and its stateOf for the kind a set names.

import { assert, assertEquals, equal } from '@std/assert';
import { GRANT_TYPES } from '../api/authentication.ts';
import { AUTHENTICATION_ROUTES } from '../api/request-auth.ts';
import { REQUEST_HEADERS } from '../api/request-header-names.ts';
import {
    REQUEST_HEADER_DECLARATIONS,
    type RequestHeaderDeclaration,
    type RequestKind,
    type RequestMethod,
} from '../api/request-headers.ts';
import {
    offeredVerbs,
    routePatternOf,
    type HttpVerb,
} from '../api/route-surface.ts';
import { routes } from '../api/routes.ts';
import type {
    ApiDocHeader,
    ApiDocHeaderSet,
} from '../web-app/api-documentation/shapes.ts';
import {
    headerSetsOf,
    TRANSPORT_HEADERS,
} from '../web-app/app/api-documentation-headers.ts';
import {
    type Endpoint,
    endpointsOf,
} from '../web-app/app/api-documentation-story.ts';

const TOKEN_ROUTE = 'authentication/token';
const NO_CONDITION = '';

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

const ENDPOINTS = endpointsOf(routes);

function declarationsOn(
    surface: RequestHeaderDeclaration['surface'],
): readonly RequestHeaderDeclaration[] {
    return REQUEST_HEADER_DECLARATIONS.filter(
        (declaration) => declaration.surface === surface,
    );
}

const ENDPOINT_DECLARATIONS = declarationsOn('endpoint');
const TRANSPORT_DECLARATIONS = declarationsOn('transport');

// What the gate reads for `kind`, as the declarations
// say: each one it reads, in declaration order.
function expectedHeaders(
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
                ? declaration.alternatives
                : [],
        }];
    });
}

function endpointKind(endpoint: Endpoint): RequestKind {
    const method = METHODS[endpoint.verb];
    return {
        routePattern: routePatternOf(endpoint.row),
        method,
        bodySent: BODY_METHODS.has(method),
    };
}

function labelOf(endpoint: Endpoint): string {
    return endpoint.verb + ' ' + routePatternOf(endpoint.row);
}

function namesOf(set: ApiDocHeaderSet): readonly string[] {
    return set.headers.map((header) => header.name);
}

Deno.test("each endpoint's headers equal the declarations' states",
    () => {
        for (const endpoint of ENDPOINTS) {
            const kind = endpointKind(endpoint);
            const expected: readonly ApiDocHeaderSet[] =
                kind.routePattern === TOKEN_ROUTE
                    ? GRANT_TYPES.map((grantType) => ({
                        when: 'grant_type=' + grantType,
                        headers: expectedHeaders(
                            ENDPOINT_DECLARATIONS,
                            { ...kind, grantType },
                        ),
                    }))
                    : [{
                        when: NO_CONDITION,
                        headers: expectedHeaders(
                            ENDPOINT_DECLARATIONS, kind),
                    }];
            assertEquals(
                headerSetsOf(endpoint),
                expected,
                labelOf(endpoint),
            );
        }
    });

Deno.test('every set lists request-id as forbidden', () => {
    for (const endpoint of ENDPOINTS) {
        for (const set of headerSetsOf(endpoint)) {
            const listed = set.headers.filter(
                (header) =>
                    header.name === REQUEST_HEADERS.requestId.name,
            );
            assertEquals(
                listed.map((header) => header.state),
                ['forbidden'],
                labelOf(endpoint) + ' ' + set.when,
            );
        }
    }
});

Deno.test('no set lists a header only the site reads', () => {
    const elsewhere = new Set(
        REQUEST_HEADER_DECLARATIONS
            .filter((declaration) => declaration.surface !== 'site')
            .map((declaration) => declaration.name),
    );
    const siteOnly = declarationsOn('site')
        .map((declaration) => declaration.name)
        .filter((name) => !elsewhere.has(name));
    assert(siteOnly.length > 0, 'the site reads a header of its own');
    const sets = [
        ...ENDPOINTS.flatMap((endpoint) => headerSetsOf(endpoint)),
        ...TRANSPORT_HEADERS,
    ];
    for (const set of sets) {
        for (const name of siteOnly) {
            assert(
                !namesOf(set).includes(name),
                name + ' is listed when ' + JSON.stringify(set.when),
            );
        }
    }
});

Deno.test('content-type is listed on exactly the QUERY endpoints',
    () => {
        const contentType = REQUEST_HEADERS.contentType.name;
        const listing = ENDPOINTS.filter((endpoint) =>
            headerSetsOf(endpoint).some(
                (set) => namesOf(set).includes(contentType),
            )
        ).map(labelOf);
        const queries = ENDPOINTS
            .filter((endpoint) => endpoint.verb === 'query')
            .map(labelOf);
        assert(queries.length > 0, 'the route table offers a QUERY');
        assertEquals(listing, queries);
    });

// Every request outside the sign-in routes, each taken as
// carrying a body.
function outsideKinds(): readonly RequestKind[] {
    return ENDPOINTS
        .filter((endpoint) =>
            !AUTHENTICATION_ROUTES.has(routePatternOf(endpoint.row))
        )
        .map((endpoint) => ({
            ...endpointKind(endpoint),
            bodySent: true,
        }));
}

interface SignInKind {
    readonly when: string;
    readonly kind: RequestKind;
}

// In route table order, the token route once per grant
// type, each taken as carrying a body.
function signInKinds(): readonly SignInKind[] {
    return routes.flatMap((row) => {
        const routePattern = routePatternOf(row);
        if (!AUTHENTICATION_ROUTES.has(routePattern)) return [];
        return offeredVerbs(row).flatMap((verb) => {
            const method = METHODS[verb];
            const kind: RequestKind = {
                routePattern,
                method,
                bodySent: true,
            };
            const when = method + ' /api/' + routePattern;
            return routePattern === TOKEN_ROUTE
                ? GRANT_TYPES.map((grantType) => ({
                    when: when + ' grant_type=' + grantType,
                    kind: { ...kind, grantType },
                }))
                : [{ when, kind }];
        });
    });
}

Deno.test('the transport headers are stated once, by kind', () => {
    const [first, ...rest] = TRANSPORT_HEADERS;
    assert(first !== undefined, 'a transport set is stated');
    assertEquals(first.when, NO_CONDITION);
    const stateOfName = new Map(
        first.headers.map((header) => [header.name, header.state]),
    );
    assertEquals(
        stateOfName.get(REQUEST_HEADERS.contentLength.name),
        'required',
    );
    assertEquals(
        stateOfName.get(REQUEST_HEADERS.transferEncoding.name),
        'forbidden',
    );
    for (const kind of outsideKinds()) {
        assertEquals(
            first.headers,
            expectedHeaders(TRANSPORT_DECLARATIONS, kind),
            kind.method + ' ' + kind.routePattern,
        );
    }
    const differing = signInKinds().flatMap(({ when, kind }) => {
        const headers = expectedHeaders(TRANSPORT_DECLARATIONS, kind);
        return equal(headers, first.headers) ? [] : [{ when, headers }];
    });
    assert(differing.length > 0, 'a sign-in kind reads a proxy line');
    assertEquals(rest, differing);
});
