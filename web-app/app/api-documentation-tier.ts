// The least role each endpoint lets through, as the gate
// judges it: no bearer on an authentication route or on the
// status route, which the gate answers before its bearer
// check (api/api.ts dispatched), then the route policy
// (api/authorization.ts) asked whether a member may pass,
// else the organization admin. A route the gate judges by a
// rule of its own names that rule in TIER_EXCEPTIONS.

import { isPermitted } from '../../api/authorization.ts';
import {
    AUTHENTICATION_ROUTES,
    STATUS_ROUTE,
} from '../../api/request-auth.ts';
import type { Route } from '../../api/routes.ts';
import { routePatternOf } from '../../api/route-surface.ts';
import type { HttpVerb } from '../../api/route-surface.ts';
import type { ApiDocTier } from '../api-documentation/shapes.ts';

// What each `:x` segment becomes in the path the policy
// judges: the policy matches a parameter by its position,
// never by its value.
const PARAMETER_STAND_IN = 'x';
const MEMBER_ROLES: readonly string[] = ['member'];

export const TIER_EXCEPTIONS: ReadonlyMap<string, {
    readonly tier: ApiDocTier;
    readonly because: string;
}> = new Map([
    ['identities/:id/pii', {
        tier: 'member',
        because: 'The gate judges the PII facet by its own'
            + ' rule, not the route policy: the identity'
            + ' itself, or an organization admin, may read'
            + ' and write it (api/api.ts,'
            + ' authorizeIdentityPii).',
    }],
]);

export function tierOf(row: Route, verb: HttpVerb): ApiDocTier {
    const pattern = routePatternOf(row);
    const exception = TIER_EXCEPTIONS.get(pattern);
    if (exception !== undefined) return exception.tier;
    if (
        AUTHENTICATION_ROUTES.has(pattern) || pattern === STATUS_ROUTE
    ) {
        return 'none';
    }
    const path = '/' + row.segments.map(
        (segment) =>
            segment.startsWith(':') ? PARAMETER_STAND_IN : segment,
    ).join('/');
    return isPermitted(verb.toUpperCase(), path, MEMBER_ROLES)
        ? 'member'
        : 'admin';
}
