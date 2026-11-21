// A replayed exchange as the documentation shows it (spec,
// Placeholders, Whole exchanges, Collections): every
// header sent and received, in order, and both bodies,
// with each credential replaced by its placeholder and
// each replaced value recorded for the credential guard.
// A collection keeps its first parts whole and counts the
// rest; that is the only elision. The `curl` text is a
// pure function of the stored request (plan D9).
//
// Credential headers are found by name, from the lists
// the product keeps for storage redaction, so no
// credential line is shown as sent.

import { parseBasic } from '../../api/authentication.ts';
import {
    REQUEST_CREDENTIAL_NAMES,
    RESPONSE_CREDENTIAL_NAMES,
} from '../../shared/http-message/credentials.ts';
import {
    boundaryOf,
    MULTIPART_MIXED,
} from '../../shared/http-message/multipart.ts';
import { OPERATION_ID_HEADER } from
    '../../shared/message-id-fields.ts';
import type {
    ApiDocBody,
    ApiDocHeaderLine,
    ApiDocPart,
    ApiDocPathId,
    ApiDocRequest,
    ApiDocResponse,
    ApiDocSample,
    ApiDocTier,
} from '../api-documentation/shapes.ts';
import {
    BODY_SECRET_FIELDS,
    PLACEHOLDERS,
} from './api-documentation-credentials.ts';
import {
    AUTHORIZE_TARGET,
    CLIENT_CREDENTIALS,
    partsOf,
    type RecordedExchange,
    type RecordedPart,
    type RecordedResponse,
    type ReplayRequest,
    TOKEN_TARGET,
} from './api-documentation-replay.ts';

// The headers curl sets by itself; the guided start
// states them once (spec, Whole exchanges).
export const CURL_ADDS: readonly string[] =
    ['host', 'user-agent', 'accept', 'content-length'];

// A collection's parts shown whole; the rest are counted.
export const KEPT_PARTS = 2;

// Every value a sample replaced, for the credential
// guard's known list.
export class SecretLedger {
    readonly #values = new Set<string>();

    add(value: string): void {
        this.#values.add(value);
    }

    known(): readonly string[] {
        return [...this.#values];
    }
}

export interface Sent {
    readonly caller: ApiDocTier;
    readonly exchange: RecordedExchange;
}

function placeholderOf(role: string): string {
    const placeholder = PLACEHOLDERS[role];
    if (placeholder === undefined) {
        throw new Error('no placeholder for ' + role);
    }
    return placeholder;
}

const ORIGIN = placeholderOf('origin');
const TOKEN = placeholderOf('token');
const OPERATION_ID = placeholderOf('operationId');
const ETAG = placeholderOf('etag');
const REFRESH_TOKEN = placeholderOf('refreshToken');
const CLIENT_ASSERTION = placeholderOf('clientAssertion');

const AUTHORIZATION = 'authorization';
const COOKIE = 'cookie';
const SET_COOKIE = 'set-cookie';
const AUTHENTICATION_INFO = 'authentication-info';
const CONTENT_TYPE = 'content-type';
const IF_MATCH = 'if-match';
const IF_NONE_MATCH = 'if-none-match';
// RFC 9110 §13.1.1: `*` names any current representation,
// which the reader sends as it is.
const ANY_REPRESENTATION = '*';
const JSON_MEDIA_TYPE = 'application/json';
// RFC 6839 §3.1: a JSON-based media type.
const JSON_SUFFIX = '+json';
const BEARER = 'bearer';
const BASIC = 'basic';

const CREDENTIAL_NAMES: readonly string[] = [
    ...REQUEST_CREDENTIAL_NAMES,
    ...RESPONSE_CREDENTIAL_NAMES,
];

// The cookies a credential line may carry, each with its
// placeholder.
const COOKIE_PLACEHOLDERS: ReadonlyMap<string, string> = new Map([
    ['refresh_token', REFRESH_TOKEN],
]);

// The authentication-info parameters, each with its
// placeholder: the product sends no other.
const AUTHENTICATION_INFO_PLACEHOLDERS: ReadonlyMap<string, string> =
    new Map([
        ['code', placeholderOf('code')],
        ['access_token', TOKEN],
    ]);

// A Basic credential's user-id and password, by the door
// it is sent to. The reader's username is replaced, as
// the reader sends their own, but it is no secret: a
// sample of the reader's own identity shows it, so it
// stays out of the ledger.
interface BasicPair {
    readonly userId: string;
    readonly password: string;
    readonly userIdIsSecret: boolean;
}

const BASIC_PAIRS: ReadonlyMap<string, BasicPair> = new Map([
    [AUTHORIZE_TARGET, {
        userId: placeholderOf('username'),
        password: placeholderOf('password'),
        userIdIsSecret: false,
    }],
    [TOKEN_TARGET, {
        userId: placeholderOf('code'),
        password: placeholderOf('verifier'),
        userIdIsSecret: true,
    }],
]);

// The body fields whose value is replaced: the secrets,
// and the sign-in's PKCE challenge (plan D10).
const BODY_PLACEHOLDERS: ReadonlyMap<string, string> = new Map([
    ...Object.entries(BODY_SECRET_FIELDS),
    ['code_challenge', placeholderOf('challenge')],
]);

// A registration's key set, a JSON text in its `jwks`
// field. A public key is no secret, but the guided start's
// is fresh each run (plan D21), so its coordinates show
// placeholders and the guard's list holds them.
const KEY_SET_FIELD = 'jwks';
const KEY_COORDINATE_PLACEHOLDERS: ReadonlyMap<string, string> =
    new Map([
        ['x', placeholderOf('jwkX')],
        ['y', placeholderOf('jwkY')],
    ]);
// RFC 7518 §6.2.1: a coordinate is base64url, which JSON
// never escapes, so it reads the same at any depth of
// quoting.
const BASE64URL = /^[A-Za-z0-9_-]+$/u;

// Headers whose stored value is shell text by
// construction: placeholders, written to expand.
const SHELL_TEXT_HEADERS: readonly string[] =
    [...CREDENTIAL_NAMES, OPERATION_ID_HEADER];

// What a double-quoted shell word would expand or end on.
const DOUBLE_QUOTE_SPECIAL = /[$`"\\]/u;
const SINGLE_QUOTE = "'";
// POSIX sh: end the quote, an escaped quote, reopen.
const QUOTED_SINGLE_QUOTE = "'\\''";
// A placeholder in a body, as the reader's shell must
// expand it: the single quote closed, the variable
// double-quoted, the single quote reopened (plan D9).
// A name is matched whole, so `$TOKEN` never matches the
// start of a longer name.
const BODY_PLACEHOLDER = new RegExp(
    '\\$(?:' + [
        ...Object.values(PLACEHOLDERS),
        ...Object.values(BODY_SECRET_FIELDS),
    ].map((placeholder) => placeholder.slice(1)).join('|')
        + ')(?![A-Za-z0-9_])',
    'gu',
);
const EXPANDED_PLACEHOLDER = "'\"$&\"'";
const CONTINUATION = ' \\\n  ';

// RFC 9110 §11.2 auth-param: a token, `=`, then a token
// or a quoted-string, the list comma-separated. Read with
// a sticky expression of its own per line.
const TOKEN_CHARACTER = "[!#$%&'*+.^_`|~0-9A-Za-z-]";
const QUOTED_STRING = '"(?:[^"\\\\]|\\\\.)*"';
const AUTH_PARAM = '\\s*(' + TOKEN_CHARACTER + '+)\\s*=\\s*('
    + QUOTED_STRING + '|' + TOKEN_CHARACTER + '*)\\s*(?:,|$)';
const STICKY_UNICODE = 'uy';
const QUOTED_PAIR = /\\(.)/gu;

// A name an error may print: the shape of a protocol name,
// a lower-case letter, then lower-case letters, digits,
// `_`, or `-`. Text of any other shape, or a value the
// ledger holds, may be part of a value in a malformed line.
const PROTOCOL_NAME = /^[a-z][a-z0-9_-]*$/u;
const PROTOCOL_NAME_MAX_LENGTH = 32;

function isPrintableName(name: string, ledger: SecretLedger): boolean {
    return PROTOCOL_NAME.test(name)
        && name.length <= PROTOCOL_NAME_MAX_LENGTH
        && !ledger.known().includes(name);
}

// The request a replayed exchange sends, whose target
// a Basic credential's placeholders depend on, and whose
// grant a Bearer credential's does.
interface Scene {
    readonly target: string;
    readonly bearer: string;
    readonly ledger: SecretLedger;
}

export function sampleOf(
    hash: string,
    pathIds: readonly ApiDocPathId[],
    sent: readonly Sent[],
    ledger: SecretLedger,
): ApiDocSample {
    return {
        hash,
        pathIds,
        exchanges: sent.map(({ caller, exchange }) => {
            const request = requestOf(exchange.request, ledger);
            return {
                caller,
                request,
                response: responseOf(exchange, ledger),
                curl: curlOf(request),
            };
        }),
    };
}

function requestOf(
    request: ReplayRequest,
    ledger: SecretLedger,
): ApiDocRequest {
    const scene = {
        target: request.target,
        bearer: bearerPlaceholderOf(request),
        ledger,
    };
    return {
        method: request.method,
        target: request.target,
        headers: request.headers.map(([name, value]) =>
            name === OPERATION_ID_HEADER
                ? [name, OPERATION_ID]
                : headerLineOf(name, value, scene)
        ),
        body: textBodyOf(
            request.headers, unplaceholderedOf(request.body), ledger,
        ),
    };
}

// The curl expands every placeholder name in a body, so a
// body that held one as sent would send the reader's own
// variable in its place: fail closed. The body is not
// printed: it may hold a secret.
function unplaceholderedOf(body: string): string {
    if (body.search(BODY_PLACEHOLDER) >= 0) {
        throw new Error(
            'a request body already holds a placeholder name',
        );
    }
    return body;
}

// The response's echo of the request's operation-id shows
// its placeholder; a head's own operation-id stays real. A
// request the gate answers before it reads one, the system
// status, sends none, so nothing echoes it.
function responseOf(
    exchange: RecordedExchange,
    ledger: SecretLedger,
): ApiDocResponse {
    const operationId = exchange.request.headers.find(
        ([held]) => held === OPERATION_ID_HEADER,
    )?.[1];
    const scene = {
        target: exchange.request.target,
        bearer: TOKEN,
        ledger,
    };
    const { response } = exchange;
    return {
        status: response.status,
        headers: response.headers.map(([name, value]) =>
            name === OPERATION_ID_HEADER && value === operationId
                ? [name, OPERATION_ID]
                : headerLineOf(name, value, scene)
        ),
        body: responseBodyOf(response, scene),
    };
}

// A client_credentials exchange's bearer is the client's
// assertion; every other bearer is an access token.
function bearerPlaceholderOf(request: ReplayRequest): string {
    if (request.target !== TOKEN_TARGET || request.body === '') {
        return TOKEN;
    }
    const body = jsonOf(request.body);
    return isObject(body) && body['grant_type'] === CLIENT_CREDENTIALS
        ? CLIENT_ASSERTION
        : TOKEN;
}

function isObject(
    value: unknown,
): value is Readonly<Record<string, unknown>> {
    return typeof value === 'object' && value !== null
        && !Array.isArray(value);
}

function headerLineOf(
    name: string,
    value: string,
    scene: Scene,
): ApiDocHeaderLine {
    if (!CREDENTIAL_NAMES.includes(name)) return [name, value];
    switch (name) {
        case AUTHORIZATION:
            return [name, authorizationOf(value, scene)];
        case COOKIE:
            return [name, cookieLineOf(value, scene.ledger)];
        case SET_COOKIE:
            return [name, setCookieOf(value, scene.ledger)];
        case AUTHENTICATION_INFO:
            return [name, authenticationInfoOf(value, scene.ledger)];
        default:
            // A credential name with no reader of its own:
            // its whole value is the secret.
            scene.ledger.add(value);
            return [name, wholeValuePlaceholderOf(name)];
    }
}

function wholeValuePlaceholderOf(name: string): string {
    return '$' + name.toUpperCase().replaceAll('-', '_');
}

// The scheme is kept; its credential is replaced.
function authorizationOf(value: string, scene: Scene): string {
    const space = value.indexOf(' ');
    if (space < 0) {
        throw new Error(AUTHORIZATION + ' carries no credential');
    }
    const scheme = value.slice(0, space);
    const credential = value.slice(space + 1);
    switch (scheme.toLowerCase()) {
        case BEARER:
            scene.ledger.add(credential);
            return scheme + ' ' + scene.bearer;
        case BASIC:
            return scheme + ' ' + basicOf(value, scene);
        default:
            // The scheme is not named: in a malformed line the
            // first word may be the credential.
            throw new Error(
                AUTHORIZATION + ' carries a scheme no placeholder maps',
            );
    }
}

// The shell that encodes the pair as the reader sends it
// (plan D9).
function basicOf(value: string, scene: Scene): string {
    const pair = BASIC_PAIRS.get(scene.target);
    if (pair === undefined) {
        throw new Error(
            AUTHORIZATION + ' carries Basic to ' + scene.target
                + ', which no placeholder pair maps',
        );
    }
    const decoded = parseBasic(value);
    if (decoded === null) {
        throw new Error(
            AUTHORIZATION + ' to ' + scene.target
                + ' is not a Basic credential',
        );
    }
    scene.ledger.add(value.slice(value.indexOf(' ') + 1));
    scene.ledger.add(decoded.password);
    if (pair.userIdIsSecret) scene.ledger.add(decoded.userId);
    return "$(printf '%s:%s' \"" + pair.userId + '" "'
        + pair.password + "\" | base64 | tr -d '\\n')";
}

// RFC 6265 §4.2.1: `name=value` pairs, `; `-separated.
function cookieLineOf(value: string, ledger: SecretLedger): string {
    return value.split('; ')
        .map((pair) => cookiePairOf(COOKIE, pair, ledger))
        .join('; ');
}

// RFC 6265 §4.1.1: the cookie's pair, then its attributes,
// which are kept.
function setCookieOf(value: string, ledger: SecretLedger): string {
    const semicolon = value.indexOf(';');
    const pair = semicolon < 0 ? value : value.slice(0, semicolon);
    const attributes = semicolon < 0 ? '' : value.slice(semicolon);
    return cookiePairOf(SET_COOKIE, pair, ledger) + attributes;
}

// A cleared cookie's empty value names no secret, and is
// kept.
function cookiePairOf(
    header: string,
    pair: string,
    ledger: SecretLedger,
): string {
    const equals = pair.indexOf('=');
    if (equals < 0) {
        throw new Error(header + ' carries a cookie with no value');
    }
    const name = pair.slice(0, equals);
    const placeholder = COOKIE_PLACEHOLDERS.get(name);
    if (placeholder === undefined) {
        throw new Error(
            isPrintableName(name, ledger)
                ? header + ' carries the cookie ' + name
                    + ', which no placeholder maps'
                : header + ' carries a cookie that does not parse',
        );
    }
    const value = pair.slice(equals + 1);
    if (value === '') return pair;
    ledger.add(value);
    return name + '=' + placeholder;
}

// Each parameter is mapped or the run fails: no parameter
// of a credential line is shown as sent (plan D10).
function authenticationInfoOf(
    value: string,
    ledger: SecretLedger,
): string {
    const shown: string[] = [];
    const parameter = new RegExp(AUTH_PARAM, STICKY_UNICODE);
    while (parameter.lastIndex < value.length) {
        const match = parameter.exec(value);
        if (match === null) {
            throw new Error(
                AUTHENTICATION_INFO + ' is not a list of parameters',
            );
        }
        const name = match[1]!;
        const raw = match[2]!;
        const placeholder = AUTHENTICATION_INFO_PLACEHOLDERS.get(name);
        if (placeholder === undefined) {
            throw new Error(
                isPrintableName(name, ledger)
                    ? AUTHENTICATION_INFO + ' carries ' + name
                        + ', which no placeholder maps'
                    : AUTHENTICATION_INFO
                        + ' carries a parameter that does not parse',
            );
        }
        const quoted = raw.startsWith('"');
        ledger.add(
            quoted ? raw.slice(1, -1).replace(QUOTED_PAIR, '$1') : raw,
        );
        shown.push(
            name + '=' + (quoted ? '"' + placeholder + '"' : placeholder),
        );
    }
    return shown.join(', ');
}

function mediaTypeOf(contentType: string): string {
    const [mediaType] = contentType.split(';');
    return mediaType!.trim().toLowerCase();
}

function contentTypeOf(
    headers: readonly ApiDocHeaderLine[],
): string | undefined {
    return headers.find(([name]) => name === CONTENT_TYPE)?.[1];
}

// A body as text, or none. `body` is '' when nothing was
// sent.
function textBodyOf(
    headers: readonly ApiDocHeaderLine[],
    body: string,
    ledger: SecretLedger,
): ApiDocBody {
    if (body === '') return { kind: 'empty' };
    const contentType = contentTypeOf(headers);
    if (contentType === undefined) {
        throw new Error('a body is carried with no ' + CONTENT_TYPE);
    }
    const mediaType = mediaTypeOf(contentType);
    if (mediaType === MULTIPART_MIXED) {
        throw new Error('a ' + MULTIPART_MIXED + ' body is no text');
    }
    return {
        kind: 'text',
        mediaType,
        text: isJson(mediaType)
            ? jsonPlaceholderedOf(body, ledger)
            : body,
    };
}

function responseBodyOf(
    response: RecordedResponse,
    scene: Scene,
): ApiDocBody {
    const contentType = contentTypeOf(response.headers);
    if (
        response.body === '' || contentType === undefined
        || mediaTypeOf(contentType) !== MULTIPART_MIXED
    ) {
        return textBodyOf(response.headers, response.body, scene.ledger);
    }
    // Every part is read, so the ledger holds the secrets of
    // the counted ones too.
    const parts = partsOf(response).map((part) => partOf(part, scene));
    return {
        kind: 'multipart',
        boundary: boundaryOf(contentType),
        parts: parts.slice(0, KEPT_PARTS),
        more: Math.max(0, parts.length - KEPT_PARTS),
    };
}

function partOf(part: RecordedPart, scene: Scene): ApiDocPart {
    return {
        status: part.status,
        headers: part.headers.map(([name, value]) =>
            headerLineOf(name, value, scene)
        ),
        body: textBodyOf(part.headers, part.body, scene.ledger),
    };
}

function isJson(mediaType: string): boolean {
    return mediaType === JSON_MEDIA_TYPE
        || mediaType.endsWith(JSON_SUFFIX);
}

// A value a JSON body's text shows as its placeholder:
// the text to find, the text put in its place, and the
// value the ledger records.
interface BodyReplacement {
    readonly find: string;
    readonly put: string;
    readonly value: string;
}

// Each secret field's value, wherever it sits, is replaced
// in the text as JSON wrote it, so every other byte stays
// as sent.
function jsonPlaceholderedOf(
    text: string,
    ledger: SecretLedger,
): string {
    let shown = text;
    for (const { find, put, value } of secretFieldsOf(jsonOf(text))) {
        shown = shown.replaceAll(find, put);
        if (shown.includes(value)) {
            throw new Error('a body secret is written unquoted');
        }
        ledger.add(value);
    }
    return shown;
}

// V8's parse error quotes the text it failed on, which may
// hold a secret, so the error names neither.
function jsonOf(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new Error('a JSON body does not parse');
        }
        throw error;
    }
}

// Each secret field's value and its placeholder. An empty
// value, such as a revoked credential's, names no secret
// and is kept.
function secretFieldsOf(value: unknown): readonly BodyReplacement[] {
    if (Array.isArray(value)) return value.flatMap(secretFieldsOf);
    if (typeof value !== 'object' || value === null) return [];
    return Object.entries(value).flatMap(([name, field]) => {
        if (name === KEY_SET_FIELD) return keyCoordinatesOf(field);
        const placeholder = BODY_PLACEHOLDERS.get(name);
        if (placeholder === undefined) return secretFieldsOf(field);
        if (typeof field !== 'string') {
            throw new Error('the body field ' + name + ' is no string');
        }
        if (field === '') return [];
        return [{
            find: JSON.stringify(field),
            put: JSON.stringify(placeholder),
            value: field,
        }];
    });
}

// Each coordinate of each key in a key set's JSON text,
// replaced bare wherever the text quotes it.
function keyCoordinatesOf(field: unknown): readonly BodyReplacement[] {
    if (typeof field !== 'string') {
        throw new Error('the body field ' + KEY_SET_FIELD + ' is no string');
    }
    const keySet = jsonOf(field);
    const keys = isObject(keySet) ? keySet['keys'] : undefined;
    if (!Array.isArray(keys)) {
        throw new Error(KEY_SET_FIELD + ' holds no list of keys');
    }
    return keys.flatMap((key: unknown) => {
        if (!isObject(key)) {
            throw new Error(KEY_SET_FIELD + ' holds a key that is no object');
        }
        return [...KEY_COORDINATE_PLACEHOLDERS].flatMap(
            ([member, placeholder]) => {
                const coordinate = key[member];
                if (coordinate === undefined) return [];
                if (
                    typeof coordinate !== 'string'
                    || !BASE64URL.test(coordinate)
                ) {
                    throw new Error(
                        KEY_SET_FIELD + ' holds a key whose ' + member
                            + ' is not base64url',
                    );
                }
                return [{
                    find: coordinate, put: placeholder, value: coordinate,
                }];
            },
        );
    });
}

// `curl -i -X <METHOD> "$ORIGIN<target>"`, a `-H` per
// header curl does not add itself, then the body as sent
// (plan D9).
export function curlOf(request: ApiDocRequest): string {
    const lines = [
        'curl -i -X ' + request.method + ' "' + ORIGIN
            + doubleQuotableOf('the target', request.target) + '"',
        ...request.headers
            .filter(([name]) => !CURL_ADDS.includes(name))
            .map(([name, value]) =>
                '-H "' + name + ': ' + shellValueOf(name, value) + '"'
            ),
        ...dataOf(request.body),
    ];
    return lines.join(CONTINUATION);
}

// A validator is the reader's own, from their read.
function shellValueOf(name: string, value: string): string {
    if (
        (name === IF_MATCH || name === IF_NONE_MATCH)
        && value !== ANY_REPRESENTATION
    ) {
        return ETAG;
    }
    if (SHELL_TEXT_HEADERS.includes(name)) return value;
    return doubleQuotableOf(name, value);
}

function doubleQuotableOf(what: string, text: string): string {
    if (DOUBLE_QUOTE_SPECIAL.test(text)) {
        throw new Error(
            what + ' holds a character a double-quoted shell word'
                + ' would not keep',
        );
    }
    return text;
}

function dataOf(body: ApiDocBody): readonly string[] {
    switch (body.kind) {
        case 'empty':
            return [];
        case 'text':
            return [
                '-d ' + SINGLE_QUOTE
                    + body.text
                        .replaceAll(SINGLE_QUOTE, QUOTED_SINGLE_QUOTE)
                        .replace(BODY_PLACEHOLDER, EXPANDED_PLACEHOLDER)
                    + SINGLE_QUOTE,
            ];
        case 'multipart':
            throw new Error('a request body is never multipart');
    }
}
