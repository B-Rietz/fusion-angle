// The state each declared request header takes on each kind
// of request the API serves. Product code never imports this
// file: the gate decides, and these declarations describe what
// it decides. tests/request-header-states.test.ts holds every
// state to the gate's answers.
//
// Derived states follow the product's own tables:
// authorization outside the sign-in routes from
// AUTHENTICATION_ROUTES, and the precondition pair from
// conditionalOf through PRECONDITION_STATES. Every other
// state is stated, and its line names the gate site that
// decides it.
//
// A kind has no body shape, so two states hold for one body
// only:
// - POST organizations/:organization-id/record-types/ is
//   `optional` for the precondition pair, as conditionalOf
//   says. Its handler refuses If-Match on a create body (400)
//   and requires it on an edit body (428).
// - authentication/authorize's `required` authorization holds
//   for `method: 'password'` only. `passkey`, `provider`, and
//   `oidc` answer 501, and an unknown method 400, before any
//   header is read.

import type { GrantType } from './authentication.ts';
import {
    IF_MATCH_HEADER,
    IF_NONE_MATCH_HEADER,
    REQUEST_HEADERS,
    type RequestHeader,
    type RequestHeaderKey,
} from './request-header-names.ts';
import { AUTHENTICATION_ROUTES } from './request-auth.ts';
import { conditionalOf } from './routes.ts';
import type { Conditional, WriteMethod } from './routes.ts';

// Upper-case, as Request.method and conditionalOf spell it.
export type RequestMethod = 'GET' | 'QUERY' | WriteMethod;

export interface RequestKind {
    readonly routePattern: string;
    readonly method: RequestMethod;
    readonly bodySent: boolean;
    // Only on authentication/token. A token kind without one
    // sends a grant_type outside GRANT_TYPES.
    readonly grantType?: GrantType;
}

// `alternative`: one member of the declaration's
// alternatives must be present. `unused`: the gate never
// reads the header for that kind.
export type RequestHeaderState =
    | 'required'
    | 'optional'
    | 'forbidden'
    | 'unused'
    | 'alternative';

export interface RequestHeaderDeclaration extends RequestHeader {
    readonly stateOf: (kind: RequestKind) => RequestHeaderState;
    readonly alternatives: readonly string[];
}

interface PreconditionStates {
    readonly ifMatch: RequestHeaderState;
    readonly ifNoneMatch: RequestHeaderState;
}

// api.ts preconditionRefusal
const PRECONDITION_STATES: Readonly<
    Record<Conditional, PreconditionStates>
> = {
    none: { ifMatch: 'forbidden', ifNoneMatch: 'forbidden' },
    optional: { ifMatch: 'optional', ifNoneMatch: 'optional' },
    required: { ifMatch: 'alternative', ifNoneMatch: 'alternative' },
    'in-order': { ifMatch: 'required', ifNoneMatch: 'forbidden' },
};

const PRECONDITION_ALTERNATIVES: readonly string[] = [
    IF_MATCH_HEADER,
    IF_NONE_MATCH_HEADER,
];

const NO_ALTERNATIVES: readonly string[] = [];

// authentication/token's Authorization line, by grant type.
const TOKEN_AUTHORIZATION_STATES: Readonly<
    Record<GrantType, RequestHeaderState>
> = {
    // authentication.ts grantAuthorizationCode
    authorization_code: 'required',
    // authentication.ts grantRefresh reads the Cookie line
    refresh: 'unused',
    // authentication.ts postToken, to grantTokenExchange
    'token-exchange': 'required',
    // authentication.ts grantClientCredentials
    client_credentials: 'required',
};

function authorizationStateOf(kind: RequestKind): RequestHeaderState {
    // request-auth.ts authenticateRequest
    if (!AUTHENTICATION_ROUTES.has(kind.routePattern)) {
        return 'required';
    }
    // authentication.ts authorizePassword
    if (kind.routePattern === 'authentication/authorize') {
        return 'required';
    }
    // authentication.ts postToken refuses the grant_type first
    if (kind.grantType === undefined) return 'unused';
    return TOKEN_AUTHORIZATION_STATES[kind.grantType];
}

function preconditionStatesOf(
    kind: RequestKind,
    method: WriteMethod,
): PreconditionStates {
    return PRECONDITION_STATES[conditionalOf(kind.routePattern, method)];
}

// The throttle reads the proxy lines on its own paths
// (server/throttle.ts isAuthThrottlePath), except for a
// refresh or a token exchange (server/http-server.ts
// dispatch). api/ cannot import server/, so its paths are
// AUTHENTICATION_ROUTES; tests/request-headers.test.ts pins
// that the two agree.
function proxyStateOf(kind: RequestKind): RequestHeaderState {
    return AUTHENTICATION_ROUTES.has(kind.routePattern)
            && kind.grantType !== 'refresh'
            && kind.grantType !== 'token-exchange'
        ? 'optional'
        : 'unused';
}

const HEADER_STATES: {
    readonly [K in RequestHeaderKey]: Pick<
        RequestHeaderDeclaration,
        'stateOf' | 'alternatives'
    >;
} = {
    authorization: {
        stateOf: authorizationStateOf,
        alternatives: NO_ALTERNATIVES,
    },
    operationId: {
        // api.ts dispatched, before the route match
        stateOf: () => 'required',
        alternatives: NO_ALTERNATIVES,
    },
    contentType: {
        // api.ts queryMediaTypeRefusal
        stateOf: (kind) => kind.method === 'QUERY'
            ? 'required'
            : 'unused',
        alternatives: NO_ALTERNATIVES,
    },
    ifMatch: {
        stateOf: (kind) =>
            kind.method === 'GET' || kind.method === 'QUERY'
                ? 'unused'
                : preconditionStatesOf(kind, kind.method).ifMatch,
        alternatives: PRECONDITION_ALTERNATIVES,
    },
    ifNoneMatch: {
        stateOf: (kind) =>
            kind.method === 'GET' || kind.method === 'QUERY'
                ? 'unused'
                : preconditionStatesOf(kind, kind.method)
                    .ifNoneMatch,
        alternatives: PRECONDITION_ALTERNATIVES,
    },
    cookie: {
        // authentication.ts grantRefresh
        stateOf: (kind) => kind.grantType === 'refresh'
            ? 'required'
            : 'unused',
        alternatives: NO_ALTERNATIVES,
    },
    requestId: {
        // api.ts dispatched
        stateOf: () => 'forbidden',
        alternatives: NO_ALTERNATIVES,
    },
    contentLength: {
        // request-context.ts framingRefusal
        stateOf: (kind) => kind.bodySent ? 'required' : 'optional',
        alternatives: NO_ALTERNATIVES,
    },
    transferEncoding: {
        // request-context.ts framingRefusal
        stateOf: () => 'forbidden',
        alternatives: NO_ALTERNATIVES,
    },
    forwarded: {
        stateOf: proxyStateOf,
        alternatives: NO_ALTERNATIVES,
    },
    xForwardedFor: {
        stateOf: proxyStateOf,
        alternatives: NO_ALTERNATIVES,
    },
    // The site keys are read outside the API: accept-encoding
    // and sec-fetch-mode by server/http-server.ts's static
    // site, accept and content-type by server/status-page.ts.
    acceptEncoding: {
        stateOf: () => 'unused',
        alternatives: NO_ALTERNATIVES,
    },
    secFetchMode: {
        stateOf: () => 'unused',
        alternatives: NO_ALTERNATIVES,
    },
    accept: {
        stateOf: () => 'unused',
        alternatives: NO_ALTERNATIVES,
    },
    statusPageContentType: {
        stateOf: () => 'unused',
        alternatives: NO_ALTERNATIVES,
    },
};

// In REQUEST_HEADERS key order. Object.keys answers string[];
// the keys are REQUEST_HEADERS' own.
const REQUEST_HEADER_KEYS = Object.keys(
    REQUEST_HEADERS,
) as readonly RequestHeaderKey[];

export const REQUEST_HEADER_DECLARATIONS:
    readonly RequestHeaderDeclaration[] = REQUEST_HEADER_KEYS.map(
        (key) => ({ ...REQUEST_HEADERS[key], ...HEADER_STATES[key] }),
    );
