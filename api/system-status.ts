// The status route's answer. The gate gives it ahead of the
// Operation-ID and bearer checks (api.ts dispatched), so an
// anonymous caller reads it: the commit, one boolean, and one
// component state. It stores nothing, and reads nothing
// before its probe.

import type { DbAdapter } from './db.ts';
import { pathSegmentsOf } from './path-segments.ts';
import { STATUS_ROUTE } from './request-auth.ts';
import {
    errorJson,
    HTTP_INTERNAL_ERROR,
    HTTP_METHOD_NOT_ALLOWED,
    HTTP_OK,
    HTTP_SERVICE_UNAVAILABLE,
} from '../shared/http-errors.ts';
import {
    systemStatusOf,
    type RunningCommit,
} from '../shared/system-status.ts';

// The paths matchRoute resolves to the status row.
export function isSystemStatusPath(pathname: string): boolean {
    return pathSegmentsOf(pathname).join('/') === STATUS_ROUTE;
}

export async function systemStatusResponse(
    adapter: DbAdapter,
    method: string,
    pathname: string,
    commit: RunningCommit | undefined,
): Promise<Response> {
    if (method !== 'GET') {
        // RFC 9110 §15.5.6: a 405 names the verbs offered.
        return Response.json(
            {
                error: 'Method ' + method
                    + ' not allowed on ' + pathname,
            },
            {
                status: HTTP_METHOD_NOT_ALLOWED,
                headers: { Allow: 'GET' },
            },
        );
    }
    // A handler built with no commit has none to report, and
    // never makes one up.
    if (commit === undefined) {
        return errorJson(
            'git sha unavailable', HTTP_INTERNAL_ERROR,
        );
    }
    const systemStatus = systemStatusOf(commit, {
        postgres: await adapter.probe(),
    });
    return Response.json(systemStatus, {
        status: systemStatus.up
            ? HTTP_OK
            : HTTP_SERVICE_UNAVAILABLE,
    });
}
