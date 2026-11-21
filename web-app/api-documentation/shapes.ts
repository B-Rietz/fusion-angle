// The API documentation's shapes: the catalog the page
// imports at boot, and the sample file it fetches when
// an endpoint opens. The generator writes both and the
// page reads both, so this module imports nothing and
// names no DOM type: it rides in the browser bundle,
// which never imports api/ or server/, and it loads
// under Deno.

const TIERS = ['member', 'admin', 'none'] as const;

// The least role an endpoint lets through, and the role
// of the caller who sent an exchange. `none` carries no
// bearer.
export type ApiDocTier = (typeof TIERS)[number];

const MEMBER = 'member';
const ORGANIZATION_ADMIN = 'organization admin';
const NO_TOKEN = 'no token';

// Who may call at each tier, one name each: an endpoint
// paints a chip per name.
export const API_DOC_TIER_ROLES: Readonly<
    Record<ApiDocTier, readonly string[]>
> = {
    member: [MEMBER, ORGANIZATION_ADMIN],
    admin: [ORGANIZATION_ADMIN],
    none: [NO_TOKEN],
};

// The role a caller holds, by name: the page's role
// switch offers each.
export const API_DOC_ROLE_NAMES: Readonly<
    Record<Exclude<ApiDocTier, 'none'>, string>
> = {
    member: MEMBER,
    admin: ORGANIZATION_ADMIN,
};

// Who may call at each tier, in the words the grid's
// legend prints, and an endpoint's chips are named by.
export const API_DOC_TIER_LABELS: Readonly<Record<ApiDocTier, string>> = {
    member: MEMBER + ' and ' + ORGANIZATION_ADMIN,
    admin: ORGANIZATION_ADMIN + ' only',
    none: NO_TOKEN,
};

// `alternative`: one of the header's alternatives must
// be sent.
export type ApiDocHeaderState =
    'required' | 'optional' | 'forbidden' | 'alternative';

export interface ApiDocHeader {
    // Lower-case.
    readonly name: string;
    readonly state: ApiDocHeaderState;
    // Empty unless the state is `alternative`.
    readonly alternatives: readonly string[];
}

export interface ApiDocHeaderSet {
    // What the request must be for the set to apply, such
    // as `grant_type=refresh`; empty when it always does.
    readonly when: string;
    readonly headers: readonly ApiDocHeader[];
}

export interface ApiDocAnswer {
    // A status code, such as `412`.
    readonly code: string;
    // Why the endpoint answers it, and what to do.
    readonly line: string;
}

export interface ApiDocQueryParameter {
    readonly name: string;
    readonly values: readonly string[];
    // What the endpoint does without the parameter.
    readonly absent: string;
}

export interface ApiDocLink {
    readonly hash: string;
    readonly label: string;
}

// The path of a sample file, relative to the page, or
// the reason there is none.
export type ApiDocSampleRef =
    | { readonly kind: 'sample'; readonly path: string }
    | { readonly kind: 'none'; readonly reason: string };

export interface ApiDocRoom {
    readonly hash: string;
    readonly verb: string;
    // The route, under `/api/`.
    readonly uri: string;
    readonly tier: ApiDocTier;
    readonly headerSets: readonly ApiDocHeaderSet[];
    readonly query: readonly ApiDocQueryParameter[];
    readonly answers: readonly ApiDocAnswer[];
    readonly related: readonly ApiDocLink[];
    readonly sample: ApiDocSampleRef;
}

export interface ApiDocStatus {
    readonly hash: string;
    readonly code: string;
    readonly body: string;
}

// One step of the guided start.
export interface ApiDocStep {
    // Such as `start/sign-in`.
    readonly hash: string;
    readonly title: string;
    readonly prose: readonly string[];
    readonly shell: readonly string[];
    readonly sample: ApiDocSampleRef;
}

// A header's name, then its value.
export type ApiDocHeaderLine = readonly [string, string];

export type ApiDocBody =
    | { readonly kind: 'empty' }
    | {
        readonly kind: 'text';
        readonly mediaType: string;
        readonly text: string;
    }
    | {
        readonly kind: 'multipart';
        readonly boundary: string;
        // The parts kept whole.
        readonly parts: readonly ApiDocPart[];
        // How many parts followed the kept ones.
        readonly more: number;
    };

export interface ApiDocPart {
    readonly status: number;
    readonly headers: readonly ApiDocHeaderLine[];
    // Never multipart.
    readonly body: ApiDocBody;
}

export interface ApiDocRequest {
    readonly method: string;
    // The path as sent, under `/api/`, with real ids.
    readonly target: string;
    readonly headers: readonly ApiDocHeaderLine[];
    readonly body: ApiDocBody;
}

export interface ApiDocResponse {
    readonly status: number;
    readonly headers: readonly ApiDocHeaderLine[];
    readonly body: ApiDocBody;
}

export interface ApiDocExchange {
    // Who sent the request.
    readonly caller: ApiDocTier;
    readonly request: ApiDocRequest;
    readonly response: ApiDocResponse;
    readonly curl: string;
}

export interface ApiDocPathId {
    // The route's parameter, such as `:id`.
    readonly name: string;
    readonly value: string;
    // A hash; empty when the id is the caller's own.
    readonly source: string;
}

export interface ApiDocSample {
    readonly hash: string;
    readonly pathIds: readonly ApiDocPathId[];
    readonly exchanges: readonly ApiDocExchange[];
}

export type SampleRead =
    | { readonly kind: 'sample'; readonly sample: ApiDocSample }
    | { readonly kind: 'fault'; readonly reason: string };

interface Fault {
    readonly kind: 'fault';
    readonly reason: string;
}

type Read<Shape> =
    | { readonly kind: 'value'; readonly value: Shape }
    | Fault;

// `path` names the value, for a fault's reason.
type Reader<Shape> = (value: unknown, path: string) => Read<Shape>;

type FieldReaders<Shape> = {
    readonly [Name in keyof Shape]: Reader<Shape[Name]>;
};

// An object's fields, none of them read yet.
type Fields = Readonly<Record<string, unknown>>;

type BodyKind = ApiDocBody['kind'];

// Where every path starts.
const ROOT = 'sample';
const NOT_AN_OBJECT = 'is not an object';
const PART_BODY_KINDS: readonly BodyKind[] = ['empty', 'text'];
const BODY_KINDS: readonly BodyKind[] =
    [...PART_BODY_KINDS, 'multipart'];

function accept<Shape>(value: Shape): Read<Shape> {
    return { kind: 'value', value };
}

function fault(path: string, problem: string): Fault {
    return { kind: 'fault', reason: path + ' ' + problem };
}

function isObject(value: unknown): value is Fields {
    return typeof value === 'object' && value !== null
        && !Array.isArray(value);
}

function isArray(value: unknown): value is readonly unknown[] {
    return Array.isArray(value);
}

function readString(value: unknown, path: string): Read<string> {
    return typeof value === 'string'
        ? accept(value)
        : fault(path, 'is not a string');
}

function readNonNegativeInteger(
    value: unknown,
    path: string,
): Read<number> {
    return typeof value === 'number'
        && Number.isInteger(value) && value >= 0
        ? accept(value)
        : fault(path, 'is not a non-negative integer');
}

function readHeaderLine(
    value: unknown,
    path: string,
): Read<ApiDocHeaderLine> {
    const problem = 'is not a name and a value, both strings';
    if (!isArray(value)) return fault(path, problem);
    const [name, text, ...extra] = value;
    return typeof name === 'string' && typeof text === 'string'
        && extra.length === 0
        ? accept([name, text])
        : fault(path, problem);
}

function oneOf<Name extends string>(
    names: readonly Name[],
): Reader<Name> {
    return (value, path) => {
        const name = names.find((known) => known === value);
        return name === undefined
            ? fault(path, 'is not one of: ' + names.join(', '))
            : accept(name);
    };
}

function arrayOf<Item>(
    readItem: Reader<Item>,
): Reader<readonly Item[]> {
    return (value, path) => {
        if (!isArray(value)) return fault(path, 'is not an array');
        const items: Item[] = [];
        for (const [index, item] of value.entries()) {
            const read = readItem(item, path + '[' + index + ']');
            if (read.kind === 'fault') return read;
            items.push(read.value);
        }
        return accept(items);
    };
}

// Reads each named field of an object, in the readers'
// order, and keeps no other.
function fieldsOf<Shape>(
    readers: FieldReaders<Shape>,
): (fields: Fields, path: string) => Read<Shape> {
    return (fields, path) => {
        const shape: Record<string, unknown> = {};
        for (const name in readers) {
            const fieldPath = path + '.' + name;
            if (!Object.hasOwn(fields, name)) {
                return fault(fieldPath, 'is missing');
            }
            const read = readers[name](fields[name], fieldPath);
            if (read.kind === 'fault') return read;
            shape[name] = read.value;
        }
        // FieldReaders holds one reader for each field of
        // Shape, and each has passed: the compiler cannot
        // follow the loop, so the cast says it.
        return accept(shape as Shape);
    };
}

function objectOf<Shape>(
    readers: FieldReaders<Shape>,
): Reader<Shape> {
    const readFields = fieldsOf(readers);
    return (value, path) =>
        isObject(value)
            ? readFields(value, path)
            : fault(path, NOT_AN_OBJECT);
}

// A body holds parts and a part holds a body, so this
// calls readers declared below it. `kinds` ends the
// descent: a part's body is never multipart.
function bodyAmong(
    kinds: readonly BodyKind[],
): Reader<ApiDocBody> {
    const readKind = fieldsOf({ kind: oneOf(kinds) });
    return (value, path) => {
        if (!isObject(value)) return fault(path, NOT_AN_OBJECT);
        const named = readKind(value, path);
        if (named.kind === 'fault') return named;
        switch (named.value.kind) {
            case 'empty':
                return accept({ kind: 'empty' });
            case 'text': {
                const read = readTextFields(value, path);
                return read.kind === 'fault'
                    ? read
                    : accept({ kind: 'text', ...read.value });
            }
            case 'multipart': {
                const read = readMultipartFields(value, path);
                return read.kind === 'fault'
                    ? read
                    : accept({ kind: 'multipart', ...read.value });
            }
        }
    };
}

const readTier = oneOf(TIERS);

const readHeaderLines = arrayOf(readHeaderLine);

const readTextFields = fieldsOf({
    mediaType: readString,
    text: readString,
});

const readPart = objectOf<ApiDocPart>({
    status: readNonNegativeInteger,
    headers: readHeaderLines,
    body: bodyAmong(PART_BODY_KINDS),
});

const readMultipartFields = fieldsOf({
    boundary: readString,
    parts: arrayOf(readPart),
    more: readNonNegativeInteger,
});

const readBody = bodyAmong(BODY_KINDS);

const readRequest = objectOf<ApiDocRequest>({
    method: readString,
    target: readString,
    headers: readHeaderLines,
    body: readBody,
});

const readResponse = objectOf<ApiDocResponse>({
    status: readNonNegativeInteger,
    headers: readHeaderLines,
    body: readBody,
});

const readExchange = objectOf<ApiDocExchange>({
    caller: readTier,
    request: readRequest,
    response: readResponse,
    curl: readString,
});

const readPathId = objectOf<ApiDocPathId>({
    name: readString,
    value: readString,
    source: readString,
});

const readSampleAt = objectOf<ApiDocSample>({
    hash: readString,
    pathIds: arrayOf(readPathId),
    exchanges: arrayOf(readExchange),
});

// The one gate a fetched sample passes: every field is
// read here, once, and the sample is trusted after it.
// The result is a copy holding the declared fields only.
// A fault's reason names the first field that failed, by
// its path from `sample`. No value JSON.parse returns
// makes this throw.
export function readSample(value: unknown): SampleRead {
    const read = readSampleAt(value, ROOT);
    return read.kind === 'fault'
        ? read
        : { kind: 'sample', sample: read.value };
}
