// The one place a request header is read by name. Every
// header the product reads off a request is declared here,
// once, with the surface that reads it; the two accessors
// take a declaration, never a string. `forwarded` and
// `x-forwarded-for` are set by proxies, not by clients.

import type { FieldLine } from '../shared/http-message/types.ts';
import { CONTENT_TYPE } from '../shared/http-message/body.ts';
import {
    CONTENT_LENGTH,
    TRANSFER_ENCODING,
} from '../shared/http-message/framing.ts';
import {
    OPERATION_ID_HEADER,
    REQUEST_ID_HEADER,
} from '../shared/message-id-fields.ts';

// A conditional PUT or PATCH names its head: If-Match carries
// the strong ETag. Not a credential — stored verbatim so two
// writes differing only in If-Match are different messages
// for replay identity.
export const IF_MATCH_HEADER = 'if-match';

export const IF_NONE_MATCH_HEADER = 'if-none-match';

export type RequestHeaderSurface = 'endpoint' | 'transport' | 'site';

export interface RequestHeader {
    readonly name: string;
    readonly surface: RequestHeaderSurface;
}

// Each name is the lower-case field name. contentType and
// statusPageContentType share CONTENT_TYPE: the QUERY gate
// and the status page read it on two surfaces.
export const REQUEST_HEADERS = {
    authorization: { name: 'authorization', surface: 'endpoint' },
    operationId: { name: OPERATION_ID_HEADER, surface: 'endpoint' },
    contentType: { name: CONTENT_TYPE, surface: 'endpoint' },
    ifMatch: { name: IF_MATCH_HEADER, surface: 'endpoint' },
    ifNoneMatch: { name: IF_NONE_MATCH_HEADER, surface: 'endpoint' },
    cookie: { name: 'cookie', surface: 'endpoint' },
    requestId: { name: REQUEST_ID_HEADER, surface: 'endpoint' },
    contentLength: { name: CONTENT_LENGTH, surface: 'transport' },
    transferEncoding: { name: TRANSFER_ENCODING, surface: 'transport' },
    forwarded: { name: 'forwarded', surface: 'transport' },
    xForwardedFor: { name: 'x-forwarded-for', surface: 'transport' },
    acceptEncoding: { name: 'accept-encoding', surface: 'site' },
    secFetchMode: { name: 'sec-fetch-mode', surface: 'site' },
    accept: { name: 'accept', surface: 'site' },
    statusPageContentType: { name: CONTENT_TYPE, surface: 'site' },
} as const satisfies Readonly<Record<string, RequestHeader>>;

export type RequestHeaderKey = keyof typeof REQUEST_HEADERS;

export type DeclaredRequestHeader =
    (typeof REQUEST_HEADERS)[RequestHeaderKey];

// Headers.get ignores case and answers null when absent.
export function requestHeaderOf(headers: Headers,
    header: DeclaredRequestHeader): string | null {
    return headers.get(header.name);
}

// Stored field names are lower-case. The first line of the
// name answers; undefined when there is none.
export function requestFieldOf(
    fields: readonly FieldLine[],
    header: DeclaredRequestHeader): string | undefined {
    return fields.find((field) => field.name === header.name)?.value;
}
