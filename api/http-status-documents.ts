import {
    type RunningCommit,
    systemStatusOf,
} from '../shared/system-status.ts';

export interface StatusDocument {
    readonly code: number;
    readonly body: unknown | null;
}

// The commit the 503 example names, sha and subject, and
// the one the documentation's replay reports. It carries
// no commit time, so the documentation holds no age.
export const EXAMPLE_COMMIT: RunningCommit = {
    sha: '0123456789abcdef0123456789abcdef01234567',
    subject: 'Answer system status at /api/status',
};

// body: null means empty (204) or "the verb room
// shows the success representation."
export const STATUS_DOCUMENTS: readonly
    StatusDocument[] = [
    { code: 200, body: null },
    { code: 201, body: null },
    { code: 204, body: null },
    {
        code: 400,
        body: { error: 'validation message' },
    },
    {
        code: 401,
        body: { error: 'invalid_token' },
    },
    {
        code: 403,
        body: {
            error:
                'forbidden: path organization'
                + ' does not match the token'
                + ' organization',
        },
    },
    {
        code: 404,
        body: { error: 'Not found: /path' },
    },
    {
        code: 405,
        body: {
            error:
                'Method GET not allowed on /path',
        },
    },
    {
        code: 409,
        body: { error: 'conflict message' },
    },
    {
        code: 410,
        body: { error: 'Gone: table/id' },
    },
    {
        code: 411,
        body: {
            error: 'A request body requires Content-Length',
        },
    },
    {
        code: 412,
        body: { error: 'precondition failed' },
    },
    {
        code: 413,
        body: { error: 'payload too large' },
    },
    {
        code: 415,
        body: {
            error: 'QUERY /path takes application/json',
        },
    },
    {
        code: 428,
        body: { error: 'If-Match required' },
    },
    {
        code: 429,
        body: { error: 'too many requests' },
    },
    {
        code: 500,
        body: { error: 'git sha unavailable' },
    },
    {
        code: 501,
        body: {
            error: 'passkey auth is a server-tier seam',
        },
    },
    {
        code: 503,
        body: systemStatusOf(
            EXAMPLE_COMMIT,
            { postgres: 'down' },
            Date.now(),
        ),
    },
    {
        code: 504,
        body: { error: 'gateway timeout' },
    },
];
