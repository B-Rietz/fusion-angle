// The documentation's story: every endpoint the route
// table offers, each a route and a verb under the hash
// the page opens it at, and how each is replayed.
//
// A read's path is filled from one story the seed tells
// (plan D13): the story work order, the flow it runs in,
// that flow's record binding and record type, the project
// the flow belongs to, the story member's seat, and the
// caller's own identity.
// Where no story document applies, a listing on a copy
// fills the segment (D14); where nothing lists one, a
// recipe creates it in the plan's setup. A read none of
// these can fill names why, and is declared in NO_SAMPLE
// (D15). A write's recipe is declared below, under Writes.

import {
    assignOrganization,
    ORGANIZATION_TWO,
    STARK_ORGANIZATION,
} from '../../api/mock-data/seed-constants.ts';
import {
    buildMembers,
    buildUnaffiliatedIdentity,
    type SeedHumanMember,
} from '../../api/mock-data/members.ts';
import {
    buildMockDataInvocations,
    defaultOrganizationSeedBody,
    formInvitationSeedInput,
    humanMemberPiiSeedBody,
    identityCredentialSeedBody,
    identityPersonSeedBody,
    mockFlowRecords,
    mockProjectFlows,
    mockStateFieldValues,
    SEED_INSTANCE_ID,
    SEED_RECORD_TYPE_ID,
    seatSeedBody,
    seedSetFor,
    WO01_ID,
    WO01_REVIEW_EVENT_ID,
} from '../../api/mock-data/seed-message-pairs.ts';
import {
    buildFlowWorkOrderJoins,
    buildWorkOrders,
} from '../../api/mock-data/work-orders.ts';
import { conditionalOf, routes } from '../../api/routes.ts';
import type {
    Conditional,
    Route,
    WriteMethod,
} from '../../api/routes.ts';
import {
    offeredVerbs,
    routePatternOf,
} from '../../api/route-surface.ts';
import type { HttpVerb } from '../../api/route-surface.ts';
import { membershipNameOf } from
    '../../shared/membership-name.ts';
import { decodeAccessToken } from
    '../../shared/access-token-decode.ts';
import { generateIdentifier } from '../../shared/identifier.ts';
import { generateSecret } from '../../shared/secret.ts';
import { addUtcSeconds } from '../../shared/work-order-claims.ts';
import { nowUtc } from '../../shared/types.ts';
import type {
    ApiDocHeaderLine,
    ApiDocPathId,
    ApiDocTier,
} from '../api-documentation/shapes.ts';
import { roomHashOf } from './api-documentation-hash.ts';
import {
    authorizeRequestOf,
    CLIENT_CREDENTIALS,
    partsOf,
    type RecordedExchange,
    type RecordedPart,
    type RecordedResponse,
    type ReplayRequest,
    type ReplayStage,
    type ReplayState,
    type SignedIn,
    succeeded,
    TOKEN_TARGET,
} from './api-documentation-replay.ts';
import { tierOf } from './api-documentation-tier.ts';

export interface Endpoint {
    readonly row: Route;
    readonly verb: HttpVerb;
    readonly hash: string;
}

export interface Cast {
    readonly member: SignedIn;
    readonly admin: SignedIn;
}

// A read sent on the plan's copy after its setup, for the
// validator of a head the setup wrote: that head's id is
// minted as the setup replays, so no plan holds it.
export type ReplayLatch =
    | { readonly kind: 'unlatched' }
    // The read's validator is the request's If-Match.
    | { readonly kind: 'if-match'; readonly read: ReplayRequest }
    // The read's opaque tag is the request's last path
    // segment, the route's `:etag`, named and sourced here
    // as pathIds names and sources the others.
    | {
        readonly kind: 'etag-segment';
        readonly read: ReplayRequest;
        readonly name: string;
        readonly source: string;
    };

export interface PlannedReplay {
    readonly kind: 'replay';
    readonly caller: ApiDocTier;
    readonly setup: readonly ReplayRequest[];
    readonly latch: ReplayLatch;
    // For an etag-segment latch, the target stops before
    // the segment the latch fills.
    readonly request: ReplayRequest;
    readonly pathIds: readonly ApiDocPathId[];
}

export type ReplayPlan =
    | PlannedReplay
    | { readonly kind: 'none'; readonly reason: string };

// The endpoints no story document, listing, or recipe can
// replay, each with why. Keyed by hash, in code-unit order.
export const NO_SAMPLE: ReadonlyMap<string, string> =
    new Map<string, string>();

// The seeded organization admin, a member of both
// organizations (api/mock-data.ts).
const ORGANIZATION_ADMIN_ID = 'XXZruirZyAOoRpNxaDnpSA';

const API_MOUNT = '/api';
const AUTHORIZATION = 'authorization';
const BEARER_SCHEME = 'Bearer ';
const CONTENT_TYPE = 'content-type';
const JSON_MEDIA_TYPE = 'application/json';
const IF_NONE_MATCH = 'if-none-match';
// RFC 9110 §13.1.2: matches only when no current
// representation exists, so the setup creates.
const ANY_REPRESENTATION = '*';
const IDENTITIES_COLLECTION = 'identities/';
// The identity facets that exist only under a kind-'service'
// identity (api/routes.ts, requireServiceIdentity). The
// callers are people, so the organization admin creates a
// service, registered, for the read.
const SERVICE_FACETS: ReadonlySet<string> = new Set([
    'identities/:id/registration',
]);
const ETAG = 'etag';
const ETAG_PARAMETER = ':etag';
// RFC 9110 §8.8.3: a strong validator is its opaque tag
// in double quotes.
const STRONG_VALIDATOR = /^"([^"]+)"$/u;

function found<T>(value: T | undefined, what: string): T {
    if (value === undefined) {
        throw new Error('the seed holds no ' + what);
    }
    return value;
}

// The seed seats every human but the organization admin
// as a member of the one organization assignOrganization
// names for its place in buildMembers() (D12).
const STORY_MEMBER_ID = found(
    buildMembers().find((member, index) =>
        member.id !== ORGANIZATION_ADMIN_ID
        && assignOrganization(index) === STARK_ORGANIZATION
    ),
    'member seated at ' + STARK_ORGANIZATION,
).id;

// The story member's seat at the story organization: a
// membership a member may read, where a pending invitation
// is the organization admin's alone.
const STORY_MEMBERSHIP = membershipNameOf(
    STARK_ORGANIZATION, STORY_MEMBER_ID,
);

const STORY_FLOW_ID = found(
    buildFlowWorkOrderJoins().find(
        (join) => join.work_order_id === WO01_ID,
    ),
    'flow running ' + WO01_ID,
).flow_id;

const STORY_PROJECT_ID = found(
    mockProjectFlows.find((join) => join.flow_id === STORY_FLOW_ID),
    'project holding ' + STORY_FLOW_ID,
).project_id;

const STORY_FLOW_RECORD_ID = found(
    mockFlowRecords.find((join) =>
        join.flow_id === STORY_FLOW_ID
        && join.record_id === SEED_RECORD_TYPE_ID
    ),
    'binding of ' + SEED_RECORD_TYPE_ID + ' to ' + STORY_FLOW_ID,
).id;

// The attribute the story work order's review recorded a
// value for.
const STORY_ATTRIBUTE_ID = found(
    mockStateFieldValues.find(
        (value) => value.state_event_id === WO01_REVIEW_EVENT_ID,
    ),
    'value recorded at ' + WO01_REVIEW_EVENT_ID,
).attribute_id;

interface StoryDocument {
    readonly id: string;
    // The pattern of the GET whose listing returns it.
    readonly listing: string;
}

// Keyed by the collection pattern the document's segment
// follows.
const STORY_DOCUMENTS: ReadonlyMap<string, StoryDocument> =
    new Map([
        ['identities/:id/invitations/', {
            id: STORY_MEMBERSHIP,
            listing: 'identities/:id/invitations/',
        }],
        ['organizations/', {
            id: STARK_ORGANIZATION,
            listing: 'identities/:id/organizations/',
        }],
        ['organizations/:id/flows/', {
            id: STORY_FLOW_ID,
            listing: 'organizations/:id/flows/',
        }],
        ['organizations/:id/flows/:id/records/', {
            id: STORY_FLOW_RECORD_ID,
            listing: 'organizations/:id/flows/:id/records/',
        }],
        ['organizations/:id/invitations/', {
            id: STORY_MEMBERSHIP,
            listing: 'organizations/:id/memberships/',
        }],
        ['organizations/:id/projects/', {
            id: STORY_PROJECT_ID,
            listing: 'organizations/:id/projects/',
        }],
        ['organizations/:id/work-orders/', {
            id: WO01_ID,
            listing: 'organizations/:id/work-orders/',
        }],
        ['organizations/:organization-id/record-types/', {
            id: SEED_RECORD_TYPE_ID,
            listing: 'organizations/:organization-id/record-types/',
        }],
        [
            'organizations/:organization-id/record-types'
                + '/:record-type-id/attributes/',
            {
                id: STORY_ATTRIBUTE_ID,
                listing: 'organizations/:organization-id'
                    + '/record-types/:record-type-id/attributes/',
            },
        ],
        [
            'organizations/:organization-id/record-types'
                + '/:record-type-id/instances/',
            {
                id: SEED_INSTANCE_ID,
                listing: 'organizations/:organization-id'
                    + '/record-types/:record-type-id/instances/',
            },
        ],
    ]);

// The word each QUERY route searches for, one the story's
// documents contain.
const QUERY_WORDS: ReadonlyMap<string, string> = new Map([
    // The story project's title and the story flow's name.
    ['organizations/:id', 'Customer'],
    // The story member's first name.
    ['organizations/:id/memberships/', 'Sarah'],
    // The company the story work order's review recorded.
    ['organizations/:id/work-orders/', 'Acme'],
]);

// The tag the story flow's recipe creates.
const STORY_TAG = 'reviewed';

interface Fill {
    readonly kind: 'fill';
    readonly value: string;
    readonly source: string;
    readonly setup: readonly ReplayRequest[];
}

// What a recipe knows: the path filled so far, up to the
// segment it fills, and who sends what.
interface RecipeScene {
    readonly prefix: readonly string[];
    readonly caller: SignedIn;
    readonly lister: SignedIn;
    // Creates what an organization admin alone may create.
    readonly admin: SignedIn;
    readonly stage: ReplayStage;
}

interface Recipe {
    // The pattern of the write the setup sends.
    readonly writes: string;
    readonly verb: HttpVerb;
    create(scene: RecipeScene): Promise<{
        readonly value: string;
        readonly setup: readonly ReplayRequest[];
    }>;
}

// Keyed by the collection pattern the created segment
// follows: where the seed leaves a collection empty, or no
// route lists it, the setup writes what the read names.
const RECIPES: ReadonlyMap<string, Recipe> = new Map([
    // Nothing lists a flow's tags: the setup tags the story
    // flow's head.
    ['organizations/:id/flows/:id/tags/', {
        writes: 'organizations/:id/flows/:id/tags/:name',
        verb: 'put',
        create: async (scene: RecipeScene) => ({
            value: STORY_TAG,
            setup: [await storyTagPutOf(
                scene.prefix, scene.caller, scene.lister,
                scene.stage,
            )],
        }),
    }],
    // The caller links a provider to its own identity.
    ['identities/:id/providers/', {
        writes: 'identities/:id/providers/:eid',
        verb: 'put',
        create: (scene: RecipeScene) => createdAt(
            scene, providerLinkOf(scene.caller),
        ),
    }],
    // The caller revokes its sessions opened before the one
    // its bearer belongs to, which stays live.
    ['identities/:id/token-revocations/', {
        writes: 'identities/:id/token-revocations/:rid',
        verb: 'put',
        create: (scene: RecipeScene) => createdAt(scene, {
            at: momentBeforeBearerOf(scene.caller),
        }),
    }],
    // The organization admin creates a service.
    ['organizations/:id/services/', {
        writes: 'organizations/:id/memberships/',
        verb: 'post',
        create: (scene: RecipeScene) => {
            const serviceId = generateIdentifier();
            return Promise.resolve({
                value: serviceId,
                setup: [serviceCreationOf(scene.admin, serviceId)],
            });
        },
    }],
]);

// A document the caller creates under a fresh id at the
// collection `prefix` names.
function createdAt(
    scene: RecipeScene,
    body: unknown,
): Promise<{
    readonly value: string;
    readonly setup: readonly ReplayRequest[];
}> {
    const value = generateIdentifier();
    return Promise.resolve({
        value,
        setup: [writeRequestOf(
            'PUT', targetOf([...scene.prefix, value]), scene.caller,
            [[IF_NONE_MATCH, ANY_REPRESENTATION]], body,
        )],
    });
}

// RFC 7519 §4.1.6: `iat` counts seconds from the epoch.
const UNIX_EPOCH = '1970-01-01T00:00:00.000000Z';
// A revocation through this many seconds before a bearer's
// issue leaves that bearer live (iat <= revoked through is
// revoked, api/authentication.ts).
const SECONDS_BEFORE_ISSUE = 1;

function momentBeforeBearerOf(signedIn: SignedIn): string {
    return addUtcSeconds(
        UNIX_EPOCH,
        decodeAccessToken(signedIn.bearer).iat - SECONDS_BEFORE_ISSUE,
    );
}

// A link of a provider to the caller's identity
// (IdentityProviderEntity); no seed builder names one.
function providerLinkOf(caller: SignedIn): unknown {
    return {
        identity_id: caller.identityId,
        provider: 'google',
        provider_subject: generateIdentifier(),
        action: 'linked',
        at: nowUtc(),
    };
}

// The story tag's PUT on the flow's tags collection at
// `prefix`, naming the flow's head as the response it tags.
async function storyTagPutOf(
    prefix: readonly string[],
    caller: SignedIn,
    reader: SignedIn,
    stage: ReplayStage,
): Promise<ReplayRequest> {
    const flow = await successfulRead(
        stage, targetOf(prefix.slice(0, -1)), reader,
    );
    const tag = opaqueTagOf(headerOf(flow.headers, ETAG));
    return {
        method: 'PUT',
        target: targetOf([...prefix, STORY_TAG]),
        headers: [
            bearerLineOf(caller),
            [CONTENT_TYPE, JSON_MEDIA_TYPE],
            [IF_NONE_MATCH, ANY_REPRESENTATION],
        ],
        body: JSON.stringify({ flow_response_id: tag }),
    };
}

// By hash, compared by code unit so no locale reorders
// them.
export function endpointsOf(
    rows: readonly Route[],
): readonly Endpoint[] {
    return rows.flatMap((row) => offeredVerbs(row).map(
        (verb): Endpoint => ({
            row, verb, hash: roomHashOf(verb, row.segments),
        }),
    )).sort((a, b) =>
        a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0
    );
}

// Both callers sign in on the base state, the member
// first, before any replay (D12).
export async function castOf(stage: ReplayStage): Promise<Cast> {
    const member = await signedInAs(stage, STORY_MEMBER_ID);
    const admin = await signedInAs(stage, ORGANIZATION_ADMIN_ID);
    return { member, admin };
}

async function signedInAs(
    stage: ReplayStage,
    identityId: string,
): Promise<SignedIn> {
    const seeded = found(
        stage.credentials.identities.find(
            (identity) => identity.identityId === identityId,
        ),
        'sign-in for ' + identityId,
    );
    return stage.signIn(
        stage.base, seeded.username, seeded.password,
        generateSecret(),
    );
}

// A GET or QUERY, sent by the least role its tier lets
// through, on a path filled segment by segment. Every
// listing a fill sends runs on a copy of its own.
export async function planRead(
    endpoint: Endpoint,
    cast: Cast,
    stage: ReplayStage,
): Promise<ReplayPlan> {
    if (endpoint.verb !== 'get' && endpoint.verb !== 'query') {
        throw new Error('planRead plans a read: ' + endpoint.hash);
    }
    const tier = tierOf(endpoint.row, endpoint.verb);
    // A read the gate answers before its bearer check, the
    // system status, carries no bearer: the story member
    // only fills its path.
    const caller = tier === 'none'
        ? cast.member
        : callerOf(tier, cast, endpoint.hash);
    const path = await filledPathOf(
        endpoint.row, endpoint.row.segments, caller, cast, stage,
    );
    if (path.kind === 'none') return noSampleOf(endpoint, path);
    return {
        kind: 'replay',
        caller: tier,
        setup: path.setup,
        latch: path.latch,
        request: tier === 'none'
            ? anonymousReadOf(endpoint, path.values)
            : readRequestOf(endpoint, path.values, caller),
        pathIds: path.pathIds,
    };
}

// What a filled path holds: its segments, where each id in
// it came from, the setup its recipes send, and the latch
// that fills a version segment of a head the setup wrote.
interface FilledPath {
    readonly kind: 'filled';
    readonly values: readonly string[];
    readonly pathIds: readonly ApiDocPathId[];
    readonly setup: readonly ReplayRequest[];
    readonly latch: ReplayLatch;
}

const UNLATCHED: ReplayLatch = { kind: 'unlatched' };

interface Unfilled {
    readonly kind: 'none';
    // Why, for the error a gap in NO_SAMPLE raises.
    readonly reason: string;
}

// The route's leading segments, each parameter filled by
// fillOf in the caller's tree.
async function filledPathOf(
    row: Route,
    segments: readonly string[],
    caller: SignedIn,
    cast: Cast,
    stage: ReplayStage,
): Promise<FilledPath | Unfilled> {
    const values: string[] = [];
    const pathIds: ApiDocPathId[] = [];
    const setup: ReplayRequest[] = [];
    for (const [index, segment] of segments.entries()) {
        if (!segment.startsWith(':')) {
            values.push(segment);
            continue;
        }
        if (segment === ETAG_PARAMETER && setup.length > 0) {
            return {
                kind: 'filled',
                values,
                pathIds,
                setup,
                latch: versionLatchOf(row, values, index, caller),
            };
        }
        const fill = await fillOf(segment, {
            pattern: routePatternOf(row),
            collection: row.segments
                .slice(0, values.length).join('/') + '/',
            prefix: [...values],
            caller,
            lister: values[0] === 'identities' ? caller : cast.admin,
            admin: cast.admin,
            stage,
        });
        if (fill.kind === 'none') return fill;
        values.push(fill.value);
        pathIds.push({
            name: segment, value: fill.value, source: fill.source,
        });
        setup.push(...fill.setup);
    }
    return { kind: 'filled', values, pathIds, setup, latch: UNLATCHED };
}

// A version of a document the setup wrote is named by its
// validator, minted as the setup replays: a read of the
// document on the same copy names it. `versions/:etag` ends
// the route.
function versionLatchOf(
    row: Route,
    values: readonly string[],
    index: number,
    caller: SignedIn,
): ReplayLatch {
    if (index !== row.segments.length - 1) {
        throw new Error(
            'a version segment ends its route: '
                + routePatternOf(row),
        );
    }
    const document = row.segments.slice(0, VERSIONS_FROM_END);
    return {
        kind: 'etag-segment',
        read: readOf(targetOf(values.slice(0, -1)), caller),
        name: ETAG_PARAMETER,
        source: roomHashOf('get', document),
    };
}

// `<document>/versions/:etag`: the document's own segments
// end two before the route's.
const VERSIONS_FROM_END = -2;

// An endpoint no fill or recipe reaches has no sample, and
// says why in its NO_SAMPLE entry, the one text the page
// prints. One missing from NO_SAMPLE is a gap that fails
// the run.
function noSampleOf(endpoint: Endpoint, unfilled: Unfilled): ReplayPlan {
    const reason = NO_SAMPLE.get(endpoint.hash);
    if (reason === undefined) {
        throw new Error(
            endpoint.hash + ' has no sample and no NO_SAMPLE'
                + ' entry: ' + unfilled.reason,
        );
    }
    return { kind: 'none', reason };
}

function callerOf(
    tier: ApiDocTier,
    cast: Cast,
    hash: string,
): SignedIn {
    switch (tier) {
        case 'member':
            return cast.member;
        case 'admin':
            return cast.admin;
        case 'none':
            throw new Error('a read carries a bearer: ' + hash);
    }
}

interface FillScene extends RecipeScene {
    // The pattern of the route being filled.
    readonly pattern: string;
    // The pattern of the collection the segment follows,
    // such as `organizations/:id/flows/`.
    readonly collection: string;
}

// The caller's own identity (a service the organization
// admin creates, for a service's facet), else a story
// document, else a recipe, else the first
// document a listing returns (its body id, or its strong
// validator for an etag).
async function fillOf(
    segment: string,
    scene: FillScene,
): Promise<Fill | Unfilled> {
    if (scene.collection === IDENTITIES_COLLECTION) {
        if (SERVICE_FACETS.has(scene.pattern)) {
            const serviceId = generateIdentifier();
            return {
                kind: 'fill',
                value: serviceId,
                source: SERVICE_SOURCE,
                setup: [
                    serviceCreationOf(scene.admin, serviceId),
                    registrationPutOf(scene.admin, serviceId, NO_KEYS),
                ],
            };
        }
        return {
            kind: 'fill',
            value: scene.caller.identityId,
            source: '',
            setup: [],
        };
    }
    const story = STORY_DOCUMENTS.get(scene.collection);
    if (story !== undefined) {
        return {
            kind: 'fill',
            value: story.id,
            source: roomHashOf(
                'get', listingRowAt(story.listing).segments,
            ),
            setup: [],
        };
    }
    const recipe = RECIPES.get(scene.collection);
    if (recipe !== undefined) {
        const created = await recipe.create(scene);
        return {
            kind: 'fill',
            ...created,
            source: roomHashOf(recipe.verb, recipe.writes.split('/')),
        };
    }
    const listing = routes.find((row) =>
        routePatternOf(row) === scene.collection
        && offeredVerbs(row).includes('get')
    );
    if (listing === undefined) {
        return {
            kind: 'none',
            reason: 'No route lists ' + scene.collection
                + ', and no story document or recipe fills '
                + segment + '.',
        };
    }
    const listed = await successfulRead(
        scene.stage, targetOf([...scene.prefix, '']), scene.lister,
    );
    const first = partsOf(listed)[0];
    if (first === undefined) {
        return {
            kind: 'none',
            reason: 'GET ' + scene.collection
                + ' lists no document in the seed.',
        };
    }
    return {
        kind: 'fill',
        value: segment === ETAG_PARAMETER
            ? opaqueTagOf(headerOf(first.headers, ETAG))
            : bodyIdOf(first),
        source: roomHashOf('get', listing.segments),
        setup: [],
    };
}

function listingRowAt(pattern: string): Route {
    return found(
        routes.find((row) =>
            routePatternOf(row) === pattern
            && offeredVerbs(row).includes('get')
        ),
        'GET route at ' + pattern,
    );
}

function anonymousReadOf(
    endpoint: Endpoint,
    filled: readonly string[],
): ReplayRequest {
    if (endpoint.verb !== 'get') {
        throw new Error('an anonymous read is a GET: '
            + endpoint.hash);
    }
    return {
        method: 'GET',
        target: targetOf(filled),
        headers: [],
        body: '',
    };
}

function readRequestOf(
    endpoint: Endpoint,
    filled: readonly string[],
    caller: SignedIn,
): ReplayRequest {
    const target = targetOf(filled);
    if (endpoint.verb === 'get') return readOf(target, caller);
    const pattern = routePatternOf(endpoint.row);
    const word = QUERY_WORDS.get(pattern);
    if (word === undefined) {
        throw new Error('no search word for QUERY ' + pattern);
    }
    return {
        method: 'QUERY',
        target,
        headers: [
            bearerLineOf(caller),
            [CONTENT_TYPE, JSON_MEDIA_TYPE],
        ],
        body: JSON.stringify({ q: word }),
    };
}

// A read a fill or a recipe depends on, on a copy of its
// own. Anything but success fails the plan, naming the
// target and never the bearer.
async function successfulRead(
    stage: ReplayStage,
    target: string,
    reader: SignedIn,
): Promise<RecordedResponse> {
    return succeeded(await stage.send(
        stage.copy(), readOf(target, reader),
    )).response;
}

function readOf(target: string, reader: SignedIn): ReplayRequest {
    return {
        method: 'GET',
        target,
        headers: [bearerLineOf(reader)],
        body: '',
    };
}

function targetOf(segments: readonly string[]): string {
    return API_MOUNT + '/' + segments.join('/');
}

function bearerLineOf(signedIn: SignedIn): ApiDocHeaderLine {
    return [AUTHORIZATION, BEARER_SCHEME + signedIn.bearer];
}

function headerOf(
    headers: readonly ApiDocHeaderLine[],
    name: string,
): string {
    const line = headers.find(([held]) => held === name);
    if (line === undefined) {
        throw new Error('the answer carries no ' + name);
    }
    return line[1];
}

function opaqueTagOf(validator: string): string {
    const match = STRONG_VALIDATOR.exec(validator);
    if (match === null) {
        throw new Error('not a strong validator: ' + validator);
    }
    return match[1]!;
}

function bodyIdOf(part: RecordedPart): string {
    const body: unknown = JSON.parse(part.body);
    if (typeof body !== 'object' || body === null) {
        throw new Error('a listed part is not a document');
    }
    const id: unknown = Object.getOwnPropertyDescriptor(
        body, 'id',
    )?.value;
    if (typeof id !== 'string') {
        throw new Error('a listed part names no id');
    }
    return id;
}

// ---- Writes (spec, Writes) ----
//
// Each write replays on a copy of its own, its setup first.
// A PUT on an existing document sends the body the seed
// wrote it with, latched on the head a read of the base
// rows serves. A creation sends a body from the same seed
// builder under fresh ids. An operation is a declared
// recipe built from seeded ids.

type Invocation = ReturnType<typeof buildMockDataInvocations>[number];

// The seed's own writes, each the request body the seed
// formed its pair from.
const INVOCATIONS: readonly Invocation[] = buildMockDataInvocations();

// What a write recipe knows.
interface WriteScene {
    readonly endpoint: Endpoint;
    readonly pattern: string;
    readonly conditional: Conditional;
    readonly caller: SignedIn;
    readonly cast: Cast;
    readonly stage: ReplayStage;
}

interface PlannedWrite {
    readonly kind: 'planned';
    readonly latch: ReplayLatch;
    readonly setup: readonly ReplayRequest[];
    readonly request: ReplayRequest;
    readonly pathIds: readonly ApiDocPathId[];
}

type WriteRecipe = (scene: WriteScene) => Promise<PlannedWrite | Unfilled>;

const IF_MATCH = 'if-match';
// A revocation names no new secret.
const NO_SECRET = '';
const COOKIE = 'cookie';
const SET_COOKIE = 'set-cookie';
// The cookie the token door sets, and reads when a client
// asks it to refresh a session (api/authentication.ts).
const REFRESH_COOKIE = 'refresh_token';

// A PUT, POST, PATCH, or DELETE, sent by the least role its
// tier lets through, as its recipe declares. A write with no
// recipe has no sample, and NO_SAMPLE says why.
export async function planWrite(
    endpoint: Endpoint,
    cast: Cast,
    stage: ReplayStage,
): Promise<ReplayPlan> {
    if (endpoint.verb === 'get' || endpoint.verb === 'query') {
        throw new Error('planWrite plans a write: ' + endpoint.hash);
    }
    const pattern = routePatternOf(endpoint.row);
    const method = methodOf(endpoint.verb);
    const recipe = WRITE_RECIPES.get(writeKeyOf(method, pattern));
    if (recipe === undefined) {
        return noSampleOf(endpoint, {
            kind: 'none',
            reason: 'no recipe writes ' + method + ' ' + pattern,
        });
    }
    const tier = tierOf(endpoint.row, endpoint.verb);
    const planned = await recipe({
        endpoint,
        pattern,
        conditional: conditionalOf(pattern, method),
        // The sign-in routes take no bearer: their recipes
        // sign the story member in.
        caller: tier === 'none'
            ? cast.member
            : callerOf(tier, cast, endpoint.hash),
        cast,
        stage,
    });
    if (planned.kind === 'none') return noSampleOf(endpoint, planned);
    return {
        kind: 'replay',
        caller: tier,
        setup: planned.setup,
        latch: planned.latch,
        request: planned.request,
        pathIds: planned.pathIds,
    };
}

// Every endpoint's plan: a read's or a write's.
export function planOf(
    endpoint: Endpoint,
    cast: Cast,
    stage: ReplayStage,
): Promise<ReplayPlan> {
    return endpoint.verb === 'get' || endpoint.verb === 'query'
        ? planRead(endpoint, cast, stage)
        : planWrite(endpoint, cast, stage);
}

// A plan sent on a copy of its own: its setup, then its
// latch's read, then its request, as `transform` leaves it.
// A setup or latch read that fails fails the run, naming
// its target and never its bearer; the request's answer is
// the caller's to judge.
export async function sendPlan(
    stage: ReplayStage,
    plan: PlannedReplay,
    transform: (request: ReplayRequest) => ReplayRequest,
): Promise<RecordedExchange> {
    const on = stage.copy();
    for (const request of plan.setup) {
        succeeded(await stage.send(on, request));
    }
    const request = await latchedRequestOf(stage, on, plan);
    return await stage.send(on, transform(request));
}

// A sent plan's path ids: its pathIds, then the `:etag` an
// etag-segment latch filled, as the sent target names it.
export function sentPathIdsOf(
    plan: PlannedReplay,
    exchange: RecordedExchange,
): readonly ApiDocPathId[] {
    const { latch } = plan;
    if (latch.kind !== 'etag-segment') return plan.pathIds;
    const prefix = plan.request.target + '/';
    const { target } = exchange.request;
    if (!target.startsWith(prefix)) {
        throw new Error(
            target + ' is not ' + plan.request.target
                + ' with its latched segment',
        );
    }
    return [...plan.pathIds, {
        name: latch.name,
        value: target.slice(prefix.length),
        source: latch.source,
    }];
}

async function latchedRequestOf(
    stage: ReplayStage,
    on: ReplayState,
    plan: PlannedReplay,
): Promise<ReplayRequest> {
    const { latch, request } = plan;
    switch (latch.kind) {
        case 'unlatched':
            return request;
        case 'if-match': {
            const { response: read } =
                succeeded(await stage.send(on, latch.read));
            return {
                ...request,
                headers: [
                    ...request.headers,
                    [IF_MATCH, headerOf(read.headers, ETAG)],
                ],
            };
        }
        case 'etag-segment': {
            const { response: read } =
                succeeded(await stage.send(on, latch.read));
            return {
                ...request,
                target: request.target + '/'
                    + opaqueTagOf(headerOf(read.headers, ETAG)),
            };
        }
    }
}

function methodOf(verb: HttpVerb): WriteMethod {
    switch (verb) {
        case 'put':
            return 'PUT';
        case 'post':
            return 'POST';
        case 'patch':
            return 'PATCH';
        case 'delete':
            return 'DELETE';
        case 'get':
        case 'query':
            throw new Error('a read is no write: ' + verb);
    }
}

function writeKeyOf(method: WriteMethod, pattern: string): string {
    return method + ' ' + pattern;
}

// ---- generic recipes ----

// The route's whole path, filled as a read fills it, and
// the body the seed wrote the document there with, latched
// on its current head.
async function seededDocumentPut(
    scene: WriteScene,
): Promise<PlannedWrite | Unfilled> {
    const path = await wholePathOf(scene);
    if (path.kind === 'none') return path;
    const body = seededBodyAt(
        scene.pattern, path.pathIds.map(({ value }) => value),
    );
    return latchedWrite(scene, path, 'PUT', body, path.values);
}

// A story or listed document, latched on its head wherever
// the route's conditional takes a latch.
async function seededDocumentDelete(
    scene: WriteScene,
): Promise<PlannedWrite | Unfilled> {
    const path = await wholePathOf(scene);
    if (path.kind === 'none') return path;
    return latchedWrite(
        scene, path, 'DELETE', undefined, path.values,
    );
}

async function wholePathOf(
    scene: WriteScene,
): Promise<FilledPath | Unfilled> {
    return await filledPathOf(
        scene.endpoint.row, scene.endpoint.row.segments,
        scene.caller, scene.cast, scene.stage,
    );
}

// The head's validator, read on a copy of the base rows:
// the copy the write replays on holds the same head.
async function latchedWrite(
    scene: WriteScene,
    path: FilledPath,
    method: WriteMethod,
    body: unknown,
    latched: readonly string[],
): Promise<PlannedWrite> {
    const target = targetOf(path.values);
    const latch: ApiDocHeaderLine[] = scene.conditional === 'none'
        ? []
        : [[IF_MATCH, await validatorAt(scene, latched)]];
    return {
        kind: 'planned',
        latch: UNLATCHED,
        setup: path.setup,
        request: writeRequestOf(
            method, target, scene.caller, latch, body,
        ),
        pathIds: path.pathIds,
    };
}

// The current validator of the document at `values`: its
// own GET's, or, where the route serves no GET, the one its
// collection's part carries.
async function validatorAt(
    scene: WriteScene,
    values: readonly string[],
): Promise<string> {
    const pattern = scene.endpoint.row.segments
        .slice(0, values.length).join('/');
    const row = found(
        routes.find((held) => routePatternOf(held) === pattern),
        'route at ' + pattern,
    );
    if (offeredVerbs(row).includes('get')) {
        return headerOf(
            (await successfulRead(
                scene.stage, targetOf(values), scene.caller,
            )).headers,
            ETAG,
        );
    }
    const name = values[values.length - 1]!;
    const listed = await successfulRead(
        scene.stage,
        targetOf([...values.slice(0, -1), '']),
        scene.caller,
    );
    return headerOf(
        found(
            partsOf(listed).find((part) => bodyIdOf(part) === name),
            'listed part ' + name,
        ).headers,
        ETAG,
    );
}

// The route's path to its collection, then a fresh id the
// write creates, under the route's create precondition.
async function createdPathOf(
    scene: WriteScene,
): Promise<FilledPath | Unfilled> {
    const segments = scene.endpoint.row.segments;
    const name = segments[segments.length - 1]!;
    const prefix = await filledPathOf(
        scene.endpoint.row, segments.slice(0, -1),
        scene.caller, scene.cast, scene.stage,
    );
    if (prefix.kind === 'none') return prefix;
    const fresh = generateIdentifier();
    return {
        kind: 'filled',
        latch: UNLATCHED,
        values: [...prefix.values, fresh],
        pathIds: [
            ...prefix.pathIds,
            { name, value: fresh, source: scene.endpoint.hash },
        ],
        setup: prefix.setup,
    };
}

// RFC 9110 §13.1.2: If-None-Match: * asks that nothing be
// there yet, the precondition a route that creates on PUT
// takes.
function createConditionOf(
    conditional: Conditional,
): ApiDocHeaderLine[] {
    switch (conditional) {
        case 'none':
            return [];
        case 'optional':
        case 'required':
            return [[IF_NONE_MATCH, ANY_REPRESENTATION]];
        case 'in-order':
            throw new Error('an in-order write creates nothing');
    }
}

// A creating PUT: the body a seed builder supplies, at a
// fresh id.
function creatingPut(
    bodyOf: (scene: WriteScene, path: FilledPath) => unknown,
): WriteRecipe {
    return async (scene) => {
        const path = await createdPathOf(scene);
        if (path.kind === 'none') return path;
        return {
            kind: 'planned',
            latch: UNLATCHED,
            setup: path.setup,
            request: writeRequestOf(
                'PUT', targetOf(path.values), scene.caller,
                createConditionOf(scene.conditional),
                bodyOf(scene, path),
            ),
            pathIds: path.pathIds,
        };
    };
}

// A POST to a collection or an operation route: the path
// filled as a read fills it, and the body the recipe forms
// from it.
function posting(
    bodyOf: (scene: WriteScene, path: FilledPath) => unknown,
): WriteRecipe {
    return async (scene) => {
        const path = await wholePathOf(scene);
        if (path.kind === 'none') return path;
        return {
            kind: 'planned',
            latch: UNLATCHED,
            setup: path.setup,
            request: writeRequestOf(
                'POST', targetOf(path.values), scene.caller, [],
                bodyOf(scene, path),
            ),
            pathIds: path.pathIds,
        };
    };
}

// The seed's first create at the collection, the ids it
// mints replaced by fresh ones wherever they appear.
function seededCreateBodyOf(
    pattern: string,
    mintedOf: (body: Record<string, unknown>) => readonly string[],
): Record<string, unknown> {
    const seeded = found(
        INVOCATIONS.find((invocation) =>
            invocation.routePattern === pattern),
        'create at ' + pattern,
    ).body;
    return withFreshIds(seeded, mintedOf(seeded));
}

function seededCreation(
    pattern: string,
    mintedOf: (body: Record<string, unknown>) => readonly string[],
): () => Record<string, unknown> {
    return () => seededCreateBodyOf(pattern, mintedOf);
}

// The named member's ids: itself when a string, each string
// when an array of them, each `id` when an array of
// documents.
function mintedAt(
    body: Record<string, unknown>,
    key: string,
): readonly string[] {
    const value = body[key];
    if (typeof value === 'string') return [value];
    if (!Array.isArray(value)) {
        throw new Error('the seed mints no ' + key);
    }
    return value.map((item: unknown) => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null
            && 'id' in item && typeof item.id === 'string') {
            return item.id;
        }
        throw new Error('the seed mints no id in ' + key);
    });
}

function mintedAtEach(
    ...keys: readonly string[]
): (body: Record<string, unknown>) => readonly string[] {
    return (body) => keys.flatMap((key) => mintedAt(body, key));
}

// A copy of the value with each named id replaced, wherever
// it appears, by a fresh one.
function withFreshIds(
    value: Record<string, unknown>,
    minted: readonly string[],
): Record<string, unknown> {
    const fresh = new Map(minted.map(
        (id) => [id, generateIdentifier()],
    ));
    return documentOf(JSON.stringify(value, (_key, held) => {
        if (typeof held !== 'string') return held;
        const replacing = fresh.get(held);
        return replacing === undefined ? held : replacing;
    }));
}

// The body of the seed's PUT of the document at `ids`, its
// path parameters in route order.
function seededBodyAt(
    pattern: string,
    ids: readonly string[],
): Record<string, unknown> {
    return found(
        INVOCATIONS.find(({ routePattern, op, idParams }) =>
            routePattern === pattern
            && op !== true
            && idParams !== undefined
            && idParams.length === ids.length
            && idParams.every((id, index) => id === ids[index])),
        pattern + ' write at ' + ids.join(' '),
    ).body;
}

export function writeRequestOf(
    method: WriteMethod,
    target: string,
    caller: SignedIn,
    preconditions: readonly ApiDocHeaderLine[],
    body: unknown,
): ReplayRequest {
    if (body === undefined) {
        return {
            method,
            target,
            headers: [bearerLineOf(caller), ...preconditions],
            body: '',
        };
    }
    return {
        method,
        target,
        headers: [
            bearerLineOf(caller),
            [CONTENT_TYPE, JSON_MEDIA_TYPE],
            ...preconditions,
        ],
        body: JSON.stringify(body),
    };
}

// ---- operation recipes ----

// The member a seeded identity's PII names, by the
// organization the seed seats them at (D12's partition).
function seatedMember(organization: string): SeedHumanMember {
    return found(
        buildMembers().find((member, index) =>
            member.id !== ORGANIZATION_ADMIN_ID
            && assignOrganization(index) === organization),
        'member seated at ' + organization,
    );
}

// A work order the seed creates (buildWorkOrders()), named
// by the case its seed comment gives it.
function seededWorkOrderId(id: string): string {
    return found(
        buildWorkOrders().find((workOrder) => workOrder.id === id),
        'work order ' + id,
    ).id;
}

// prc06, stuck at Decision: no exit from it requires a
// value, so a pure move leaves it.
const DECIDING_WORK_ORDER_ID =
    seededWorkOrderId('FCEBEWzmelSFTOlqcZsbdQ');
// At Data Capture under the story member's lapsed claim.
const LAPSED_CLAIM_WORK_ORDER_ID =
    seededWorkOrderId('nTIlwHvYCLLpcgDPpZfJsw');
// The gate-violation case: at Data Capture, no instance
// bound.
const UNBOUND_WORK_ORDER_ID =
    seededWorkOrderId('eOlNZpGQfmCdpSFWXGkzFQ');

const WORK_ORDERS_COLLECTION = 'organizations/:id/work-orders/';

// The place of a document's id in its routes: the segment
// after its collection's name.
function idIndexOf(collection: string): number {
    return collection.split('/').length - 1;
}

const WORK_ORDER_ID_INDEX = idIndexOf(WORK_ORDERS_COLLECTION);
// A work order's own path: its collection, then its id.
const WORK_ORDER_SEGMENTS = WORK_ORDER_ID_INDEX + 1;

// The route's path through `collection`, filled as a read
// fills it, with the document the recipe names in its id's
// place, then the route's own segments.
async function namedPathOf(
    scene: WriteScene,
    collection: string,
    id: string,
): Promise<FilledPath | Unfilled> {
    const segments = scene.endpoint.row.segments;
    const index = idIndexOf(collection);
    const prefix = await filledPathOf(
        scene.endpoint.row, segments.slice(0, index),
        scene.caller, scene.cast, scene.stage,
    );
    if (prefix.kind === 'none') return prefix;
    return {
        kind: 'filled',
        latch: UNLATCHED,
        values: [...prefix.values, id, ...segments.slice(index + 1)],
        pathIds: [...prefix.pathIds, {
            name: segments[index]!,
            value: id,
            source: roomHashOf(
                'get', listingRowAt(collection).segments,
            ),
        }],
        setup: prefix.setup,
    };
}

function workOrderPathOf(
    scene: WriteScene,
    workOrderId: string,
): Promise<FilledPath | Unfilled> {
    return namedPathOf(scene, WORK_ORDERS_COLLECTION, workOrderId);
}

// An operation on a seeded work order, latched on its head.
function workOrderOperation(
    workOrderId: string,
    method: WriteMethod,
    bodyOf: (workOrder: Record<string, unknown>) => unknown,
): WriteRecipe {
    return async (scene) => {
        const path = await workOrderPathOf(scene, workOrderId);
        if (path.kind === 'none') return path;
        const head = await successfulRead(
            scene.stage,
            targetOf(path.values.slice(0, WORK_ORDER_SEGMENTS)),
            scene.caller,
        );
        return {
            kind: 'planned',
            latch: UNLATCHED,
            setup: path.setup,
            request: writeRequestOf(
                method, targetOf(path.values), scene.caller,
                [[IF_MATCH, headerOf(head.headers, ETAG)]],
                bodyOf(documentOf(head.body)),
            ),
            pathIds: path.pathIds,
        };
    };
}

// The claim the web app sends (client/work-orders-mutations
// .ts): the expiry event minted first, so it orders first.
function claimBody(): unknown {
    const expireAt = nowUtc();
    return {
        claimEventId: generateIdentifier(),
        claimAt: nowUtc(),
        expireEventId: generateIdentifier(),
        expireAt,
    };
}

// A pure move along the first edge leaving the work order's
// node, with no claim of the caller's to release.
function moveBody(workOrder: Record<string, unknown>): unknown {
    const state = workOrder['state'];
    const graph = workOrder['flow_graph'];
    if (typeof graph !== 'object' || graph === null
        || !('edges' in graph) || !Array.isArray(graph.edges)) {
        throw new Error('a work order carries no flow graph');
    }
    const edge: unknown = graph.edges.find((held: unknown) =>
        typeof held === 'object' && held !== null
        && 'fromNodeId' in held && held.fromNodeId === state);
    if (typeof edge !== 'object' || edge === null
        || !('toNodeId' in edge) || typeof edge.toNodeId !== 'string') {
        throw new Error('no edge leaves ' + String(state));
    }
    return {
        transitionEventId: generateIdentifier(),
        targetState: edge.toNodeId,
        release: null,
        transitionAt: nowUtc(),
    };
}

export function documentOf(body: string): Record<string, unknown> {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== 'object' || parsed === null
        || Array.isArray(parsed)) {
        throw new Error('the answer is no document');
    }
    return Object.fromEntries(Object.entries(parsed));
}

// A latched write whose body the recipe forms from the
// filled path.
function latchedOperation(
    method: WriteMethod,
    bodyOf: (scene: WriteScene, path: FilledPath) => unknown,
): WriteRecipe {
    return async (scene) => {
        const path = await wholePathOf(scene);
        if (path.kind === 'none') return path;
        return latchedWrite(
            scene, path, method, bodyOf(scene, path), path.values,
        );
    };
}

// An operation on the document its path names, latched on
// that document's head.
function documentOperation(
    bodyOf: (scene: WriteScene, path: FilledPath) => unknown,
): WriteRecipe {
    return async (scene) => {
        const path = await wholePathOf(scene);
        if (path.kind === 'none') return path;
        return latchedWrite(
            scene, path, 'POST', bodyOf(scene, path),
            path.values.slice(0, -1),
        );
    };
}

// The membership PUT's body: a state and its moment.
function membershipStateBody(state: string): () => unknown {
    return () => ({ state, at: nowUtc() });
}

// The seeded document's body without the members a
// conversion stamps itself.
function withoutStamps(
    body: Record<string, unknown>,
): Record<string, unknown> {
    const { state: _state, organization_id: _organization,
        ...fields } = body;
    return fields;
}

// The web app's conversion (client/ideas.ts): the listed
// idea promoted, the story project's seed body under a
// fresh id, and that project's seeded baselines copied to
// it.
function conversionBody(
    _scene: WriteScene,
    path: FilledPath,
): unknown {
    const [organization, ideaId] = path.pathIds.map(
        ({ value }) => value,
    );
    const idea = seededBodyAt(
        'organizations/:id/ideas/:id', [organization!, ideaId!],
    );
    const project = seededBodyAt(
        'organizations/:id/projects/:id',
        [organization!, STORY_PROJECT_ID],
    );
    const projectId = generateIdentifier();
    const ideaStateAt = nowUtc();
    return {
        projectId,
        project: withoutStamps(project),
        idea: withoutStamps(idea),
        ideaStateEventId: generateIdentifier(),
        ideaState: 'promoted',
        ideaStateAt,
        projectStateEventId: generateIdentifier(),
        projectState: project['state'],
        projectStateAt: nowUtc(),
        baselines: INVOCATIONS.filter((invocation) =>
            invocation.routePattern === BASELINE_SCORES
            && invocation.idParams?.[SCORE_PROJECT_PARAMETER]
                === STORY_PROJECT_ID)
            .map((invocation) => ({
                id: generateIdentifier(),
                fields: { ...invocation.body, project_id: projectId },
            })),
    };
}

const PROJECT_ID_INDEX = idIndexOf('organizations/:id/projects/');
// A score's path parameters: organization, project, score.
const SCORE_PROJECT_PARAMETER = 1;

const BASELINE_SCORES = 'organizations/:id/projects/:id'
    + '/objective-baseline-scores/:sid';
const ACTUAL_SCORES = 'organizations/:id/projects/:id'
    + '/objective-actual-scores/:sid';

// A score the seed recorded for the project, recorded again
// under a fresh id: the seed names its scores
// project:objective:moment, which the item PUT does not
// take.
function seededScoreBody(scene: WriteScene, path: FilledPath): unknown {
    const projectId = path.values[PROJECT_ID_INDEX]!;
    return found(
        INVOCATIONS.find((invocation) =>
            invocation.routePattern === scene.pattern
            && invocation.idParams?.[SCORE_PROJECT_PARAMETER]
                === projectId),
        scene.pattern + ' write for ' + projectId,
    ).body;
}

// The seed's own invitation (formInvitationSeedInput), sent
// to a member the seed seats at the other organization, so
// the invitation is new.
function invitationBody(): unknown {
    return invitationBodyFor(seatedMember(ORGANIZATION_TWO));
}

function invitationBodyFor(invitee: SeedHumanMember): unknown {
    return {
        ...formInvitationSeedInput(nowUtc()).body,
        email: humanMemberPiiSeedBody(invitee)['email'],
    };
}

const INVITATIONS_COLLECTION = 'organizations/:id/invitations/';

// The organization admin ends the story member's seat
// under its seeded head and invites the member again; the
// member accepts (client/invitations.ts) under the
// validator a read of the invitation answers. The seed
// sends neither caller a pending invitation.
async function invitationAcceptance(
    scene: WriteScene,
): Promise<PlannedWrite | Unfilled> {
    const segments = scene.endpoint.row.segments;
    const path = await wholePathOf(scene);
    if (path.kind === 'none') return path;
    const name = path.values[path.values.length - 1]!;
    const organization = targetOf(
        ['organizations', STARK_ORGANIZATION, 'invitations', ''],
    );
    const seat = await successfulRead(
        scene.stage, organization + name, scene.cast.admin,
    );
    const target = targetOf(path.values);
    return {
        kind: 'planned',
        latch: { kind: 'if-match', read: readOf(target, scene.caller) },
        setup: [
            ...path.setup,
            writeRequestOf(
                'PUT', organization + name, scene.cast.admin,
                [[IF_MATCH, headerOf(seat.headers, ETAG)]],
                membershipStateBody('removed')(),
            ),
            writeRequestOf(
                'POST', organization, scene.cast.admin, [],
                invitationBodyFor(found(
                    buildMembers().find(
                        ({ id }) => id === scene.caller.identityId,
                    ),
                    'member ' + scene.caller.identityId,
                )),
            ),
        ],
        request: writeRequestOf(
            'PUT', target, scene.caller, [],
            membershipStateBody('accepted')(),
        ),
        pathIds: [...path.pathIds.slice(0, -1), {
            name: segments[segments.length - 1]!,
            value: name,
            source: roomHashOf('post', INVITATIONS_COLLECTION.split('/')),
        }],
    };
}

const FLOW_ITEM = 'organizations/:id/flows/:id';

// The story flow renamed by a setup PUT under its seeded
// head, then the rename undone under the validator a read
// of the flow answers.
async function storyFlowUndo(
    scene: WriteScene,
): Promise<PlannedWrite | Unfilled> {
    const path = await wholePathOf(scene);
    if (path.kind === 'none') return path;
    const flow = path.values.slice(0, -1);
    const seeded = seededBodyAt(
        FLOW_ITEM, path.pathIds.map(({ value }) => value),
    );
    const flowTarget = targetOf(flow);
    return {
        kind: 'planned',
        latch: {
            kind: 'if-match', read: readOf(flowTarget, scene.caller),
        },
        setup: [...path.setup, writeRequestOf(
            'PUT', flowTarget, scene.caller,
            [[IF_MATCH, await validatorAt(scene, flow)]],
            draftOf(seeded),
        )],
        request: writeRequestOf(
            'POST', targetOf(path.values), scene.caller, [],
            { eventId: generateIdentifier(), at: nowUtc() },
        ),
        pathIds: path.pathIds,
    };
}

const DRAFT_SUFFIX = ' (draft)';

// A flow's document renamed as a draft of itself, every
// other field as read.
export function draftOf(
    flow: Record<string, unknown>,
): Record<string, unknown> {
    const name = flow['name'];
    if (typeof name !== 'string') {
        throw new Error('the flow names no name');
    }
    return { ...flow, name: name + DRAFT_SUFFIX };
}

// The story member claims the work order under its seeded
// head, then releases the claim under the validator a read
// of the work order answers.
function claimRelease(workOrderId: string): WriteRecipe {
    return async (scene) => {
        const path = await workOrderPathOf(scene, workOrderId);
        if (path.kind === 'none') return path;
        const workOrder = targetOf(
            path.values.slice(0, WORK_ORDER_SEGMENTS),
        );
        const head = await successfulRead(
            scene.stage, workOrder, scene.caller,
        );
        return {
            kind: 'planned',
            latch: {
                kind: 'if-match', read: readOf(workOrder, scene.caller),
            },
            setup: [...path.setup, writeRequestOf(
                'PUT', targetOf(path.values), scene.caller,
                [[IF_MATCH, headerOf(head.headers, ETAG)]],
                claimBody(),
            )],
            request: writeRequestOf(
                'DELETE', targetOf(path.values), scene.caller, [],
                undefined,
            ),
            pathIds: path.pathIds,
        };
    };
}

// The web app's human member creation (client/members.ts):
// the seat, the identity, and the PII the seed builds for
// the identity no organization seats.
function humanMembershipBody(): unknown {
    const person = buildUnaffiliatedIdentity();
    const { kind: _kind, ...identity } = identityPersonSeedBody(
        person,
    );
    return {
        id: generateIdentifier(),
        kind: 'human',
        membership: seatSeedBody('member', nowUtc()),
        identity,
        pii: humanMemberPiiSeedBody(person),
    };
}

// The refresh cookie the caller's sign-in set.
function refreshCookieOf(signedIn: SignedIn): string {
    const prefix = REFRESH_COOKIE + '=';
    const line = found(
        signedIn.exchanges.flatMap((exchange) =>
            exchange.response.headers)
            .find(([name, value]) =>
                name === SET_COOKIE && value.startsWith(prefix)),
        'refresh cookie',
    );
    return line[1].split(';')[0]!;
}

// The refresh token's own id, the jti its tokens/ document
// is named by.
function refreshJtiOf(signedIn: SignedIn): string {
    return decodeAccessToken(
        refreshCookieOf(signedIn).slice(REFRESH_COOKIE.length + 1),
    ).jti;
}

// The caller's own refresh token, under the caller's own
// identity.
function ownRefreshPathOf(
    scene: WriteScene,
): Promise<FilledPath | Unfilled> {
    return namedPathOf(
        scene, TOKENS_COLLECTION, refreshJtiOf(scene.caller),
    );
}

const TOKENS_COLLECTION = 'identities/:id/tokens/';

// Rotation and revocation of the caller's refresh token:
// operations whose JSON body is empty.
async function refreshTokenOperation(
    scene: WriteScene,
): Promise<PlannedWrite | Unfilled> {
    const path = await ownRefreshPathOf(scene);
    if (path.kind === 'none') return path;
    return {
        kind: 'planned',
        latch: UNLATCHED,
        setup: path.setup,
        request: writeRequestOf(
            'POST', targetOf(path.values), scene.caller, [], {},
        ),
        pathIds: path.pathIds,
    };
}

// The member's password sign-in's first call, as the web
// app sends it.
async function authorizeRecipe(
    scene: WriteScene,
): Promise<PlannedWrite> {
    const seeded = found(
        scene.stage.credentials.identities.find(
            (identity) => identity.identityId === STORY_MEMBER_ID,
        ),
        'sign-in for ' + STORY_MEMBER_ID,
    );
    return {
        kind: 'planned',
        latch: UNLATCHED,
        setup: [],
        request: await authorizeRequestOf(
            seeded.username, seeded.password, generateSecret(),
        ),
        pathIds: [],
    };
}

// The refresh the web app asks for
// (client/session-refresh.ts): the member's refresh cookie,
// set at sign-in on the base rows, on the cookie line.
function refreshRecipe(scene: WriteScene): Promise<PlannedWrite> {
    return Promise.resolve({
        kind: 'planned',
        latch: UNLATCHED,
        setup: [],
        request: {
            method: 'POST',
            target: TOKEN_TARGET,
            headers: [
                [CONTENT_TYPE, JSON_MEDIA_TYPE],
                [COOKIE, refreshCookieOf(scene.caller)],
            ],
            body: JSON.stringify({ grant_type: 'refresh' }),
        },
        pathIds: [],
    });
}

// A service the organization admin creates, as the web app
// does (client/service-members.ts): its identity, of kind
// 'service', and its seat at the story organization.
export function serviceCreationOf(
    admin: SignedIn,
    serviceId: string,
): ReplayRequest {
    return writeRequestOf(
        'POST',
        targetOf(
            ['organizations', STARK_ORGANIZATION, 'memberships', ''],
        ),
        admin,
        [],
        {
            id: serviceId,
            kind: 'service',
            membership: seatSeedBody('member', nowUtc()),
            service: SERVICE_FIELDS,
        },
    );
}

// The POST that creates a service, the source of its id.
const SERVICE_SOURCE = roomHashOf(
    'post', 'organizations/:id/memberships/'.split('/'),
);

// No seed builder names a service: the setup's own.
const SERVICE_FIELDS = {
    name: 'Nightly export',
    description: 'Exports the day\'s work orders.',
};

// A headless client's registration (RFC 7591 §2): it signs
// in with client credentials, takes no redirect, and lists
// the key set `jwks`.
function registrationBodyOf(jwks: string): unknown {
    return {
        grant_types: CLIENT_CREDENTIALS,
        redirect_uris: '',
        jwks,
        aud: TOKEN_TARGET,
        status: 'active',
    };
}

// An empty key set, so no key is published whose private
// half is known.
const NO_KEYS = JSON.stringify({ keys: [] });

function registrationTargetOf(serviceId: string): string {
    return targetOf(['identities', serviceId, 'registration']);
}

// The service's first registration, created where none is.
export function registrationPutOf(
    caller: SignedIn,
    serviceId: string,
    jwks: string,
): ReplayRequest {
    return writeRequestOf(
        'PUT', registrationTargetOf(serviceId), caller,
        createConditionOf(conditionalOf(REGISTRATION, 'PUT')),
        registrationBodyOf(jwks),
    );
}

const REGISTRATION = 'identities/:id/registration';

// A service the setup creates, and its id's path entry.
export function servicePathIdOf(serviceId: string): ApiDocPathId {
    return { name: ':id', value: serviceId, source: SERVICE_SOURCE };
}

// The first registration of a service the setup creates.
function registrationCreation(
    scene: WriteScene,
): Promise<PlannedWrite> {
    const serviceId = generateIdentifier();
    return Promise.resolve({
        kind: 'planned',
        latch: UNLATCHED,
        setup: [serviceCreationOf(scene.cast.admin, serviceId)],
        request: registrationPutOf(scene.caller, serviceId, NO_KEYS),
        pathIds: [servicePathIdOf(serviceId)],
    });
}

// The registration of a service the setup creates and
// registers, deleted under the validator its read names.
function registrationDeletion(
    scene: WriteScene,
): Promise<PlannedWrite> {
    const serviceId = generateIdentifier();
    const target = registrationTargetOf(serviceId);
    return Promise.resolve({
        kind: 'planned',
        latch: { kind: 'if-match', read: readOf(target, scene.caller) },
        setup: [
            serviceCreationOf(scene.cast.admin, serviceId),
            registrationPutOf(scene.caller, serviceId, NO_KEYS),
        ],
        request: writeRequestOf(
            'DELETE', target, scene.caller, [], undefined,
        ),
        pathIds: [servicePathIdOf(serviceId)],
    });
}

// A service the setup creates, renamed under the validator
// its read names.
async function serviceEdit(
    scene: WriteScene,
): Promise<PlannedWrite | Unfilled> {
    const segments = scene.endpoint.row.segments;
    const services = await filledPathOf(
        scene.endpoint.row, segments.slice(0, -1),
        scene.caller, scene.cast, scene.stage,
    );
    if (services.kind === 'none') return services;
    const serviceId = generateIdentifier();
    const target = targetOf([...services.values, serviceId]);
    return {
        kind: 'planned',
        latch: { kind: 'if-match', read: readOf(target, scene.caller) },
        setup: [
            ...services.setup,
            serviceCreationOf(scene.cast.admin, serviceId),
        ],
        request: writeRequestOf(
            'PUT', target, scene.caller, [], RENAMED_SERVICE_FIELDS,
        ),
        pathIds: [...services.pathIds, servicePathIdOf(serviceId)],
    };
}

const RENAMED_SERVICE_FIELDS = {
    ...SERVICE_FIELDS,
    name: 'Nightly archive',
};

// The story tag, on the story flow (STORY_TAG).
async function storyTagPut(
    scene: WriteScene,
): Promise<PlannedWrite | Unfilled> {
    const segments = scene.endpoint.row.segments;
    const tags = await filledPathOf(
        scene.endpoint.row, segments.slice(0, -1),
        scene.caller, scene.cast, scene.stage,
    );
    if (tags.kind === 'none') return tags;
    return {
        kind: 'planned',
        latch: UNLATCHED,
        setup: tags.setup,
        request: await storyTagPutOf(
            tags.values, scene.caller, scene.cast.admin, scene.stage,
        ),
        pathIds: [...tags.pathIds, {
            name: segments[segments.length - 1]!,
            value: STORY_TAG,
            source: scene.endpoint.hash,
        }],
    };
}

// A document the setup writes, deleted under the validator
// a read of it answers.
async function setupDocumentDelete(
    scene: WriteScene,
): Promise<PlannedWrite | Unfilled> {
    const path = await wholePathOf(scene);
    if (path.kind === 'none') return path;
    const target = targetOf(path.values);
    return {
        kind: 'planned',
        latch: { kind: 'if-match', read: readOf(target, scene.caller) },
        setup: path.setup,
        request: writeRequestOf(
            'DELETE', target, scene.caller, [], undefined,
        ),
        pathIds: path.pathIds,
    };
}

// Each part of the seed's work-order create
// (workOrderCreateSeedBody), by the member naming it.
const WORK_ORDER_CREATE_PARTS = {
    workOrder: 'id',
    flowWorkOrder: 'flowWorkOrderId',
} as const;

// The part the seed's create of the named document carried.
function workOrderCreatePartOf(
    part: keyof typeof WORK_ORDER_CREATE_PARTS,
    id: string,
): Record<string, unknown> {
    const naming = WORK_ORDER_CREATE_PARTS[part];
    return documentOf(JSON.stringify(found(
        INVOCATIONS.find((invocation) =>
            invocation.routePattern === WORK_ORDERS_COLLECTION
            && invocation.body[naming] === id),
        'work order create naming ' + id,
    ).body[part]));
}

// The work order's fields as its seeded create wrote them.
function workOrderBody(
    _scene: WriteScene,
    path: FilledPath,
): unknown {
    return workOrderCreatePartOf(
        'workOrder', path.values[WORK_ORDER_ID_INDEX]!,
    );
}

// The listed join as its work order's seeded create wrote
// it.
function flowWorkOrderBody(
    _scene: WriteScene,
    path: FilledPath,
): unknown {
    return workOrderCreatePartOf(
        'flowWorkOrder', path.values[path.values.length - 1]!,
    );
}

const RECORD_TYPES_COLLECTION =
    'organizations/:organization-id/record-types/';
const ATTRIBUTES_ITEM = 'organizations/:organization-id'
    + '/record-types/:record-type-id/attributes/:attribute-id';

// Every seeded record type is bound to flows, so the
// setup creates one from the seed's create, and the DELETE
// names the validator a read of it answers.
async function setupRecordTypeDelete(
    scene: WriteScene,
): Promise<PlannedWrite | Unfilled> {
    const segments = scene.endpoint.row.segments;
    const collection = await filledPathOf(
        scene.endpoint.row, segments.slice(0, -1),
        scene.caller, scene.cast, scene.stage,
    );
    if (collection.kind === 'none') return collection;
    const created = seededCreateBodyOf(
        RECORD_TYPES_COLLECTION, mintedAtEach('id', 'attributes'),
    );
    const [id] = mintedAt(created, 'id');
    const target = targetOf([...collection.values, id!]);
    return {
        kind: 'planned',
        latch: { kind: 'if-match', read: readOf(target, scene.caller) },
        setup: [writeRequestOf(
            'POST', targetOf([...collection.values, '']),
            scene.caller, [], created,
        )],
        request: writeRequestOf(
            'DELETE', target, scene.caller, [], undefined,
        ),
        pathIds: [...collection.pathIds, {
            name: segments[segments.length - 1]!,
            value: id!,
            source: roomHashOf(
                'post', RECORD_TYPES_COLLECTION.split('/'),
            ),
        }],
    };
}

// Every seeded attribute is referenced, so the setup writes
// the story attribute's seed body under a fresh id on the
// story record type, and the DELETE names the validator a
// read of it answers.
async function setupAttributeDelete(
    scene: WriteScene,
): Promise<PlannedWrite | Unfilled> {
    const path = await createdPathOf(scene);
    if (path.kind === 'none') return path;
    const [organization, recordType] = path.pathIds.map(
        ({ value }) => value,
    );
    const target = targetOf(path.values);
    return {
        kind: 'planned',
        latch: { kind: 'if-match', read: readOf(target, scene.caller) },
        setup: [...path.setup, writeRequestOf(
            'PUT', target, scene.caller,
            [[IF_NONE_MATCH, ANY_REPRESENTATION]],
            seededBodyAt(
                ATTRIBUTES_ITEM,
                [organization!, recordType!, STORY_ATTRIBUTE_ID],
            ),
        )],
        request: writeRequestOf(
            'DELETE', target, scene.caller, [], undefined,
        ),
        pathIds: [...path.pathIds.slice(0, -1), {
            ...path.pathIds[path.pathIds.length - 1]!,
            source: roomHashOf('put', ATTRIBUTES_ITEM.split('/')),
        }],
    };
}

// ---- the recipes, keyed by method and route pattern ----

const WRITE_RECIPES: ReadonlyMap<string, WriteRecipe> = new Map([
    ['POST authentication/authorize', authorizeRecipe],
    ['POST authentication/token', refreshRecipe],
    ['POST identities/', posting(() => ({
        id: generateIdentifier(),
        kind: identityPersonSeedBody(
            buildUnaffiliatedIdentity(),
        )['kind'],
    }))],
    ['PUT identities/:id', seededDocumentPut],
    // A revocation of the caller's password: the seed's
    // credential, revoked now, carries no secret
    // (client/identity-credentials.ts).
    ['PUT identities/:id/credentials/:cid', creatingPut(
        (scene) => ({
            ...identityCredentialSeedBody(
                scene.caller.identityId, 'password', NO_SECRET,
            ),
            status: 'revoked',
            at: nowUtc(),
        }),
    )],
    ['PUT identities/:id/default-organization', latchedOperation(
        'PUT', () => defaultOrganizationSeedBody(STARK_ORGANIZATION),
    )],
    ['PUT identities/:id/invitations/:membership-id',
        invitationAcceptance],
    ['PUT identities/:id/pii', seededDocumentPut],
    ['DELETE identities/:id/pii', seededDocumentDelete],
    ['PUT identities/:id/providers/:eid', creatingPut(
        (scene) => providerLinkOf(scene.caller),
    )],
    ['PUT ' + REGISTRATION, registrationCreation],
    ['DELETE ' + REGISTRATION, registrationDeletion],
    // Sign the caller out everywhere
    // (client/identity-token-revocations.ts).
    ['PUT identities/:id/token-revocations/:rid', creatingPut(
        () => ({ at: nowUtc() }),
    )],
    ['PUT identities/:id/tokens/:jti', creatingPut(
        (_scene, path) => ({
            action: 'issued',
            chain_id: path.values[path.values.length - 1],
            at: nowUtc(),
        }),
    )],
    ['POST identities/:id/tokens/:jti/rotation',
        refreshTokenOperation],
    ['POST identities/:id/tokens/:jti/revocation',
        refreshTokenOperation],
    ['PUT organizations/:id', seededDocumentPut],
    ['PUT organizations/:id/ai-agents/:id', seededDocumentPut],
    ['POST organizations/:id/flows/', posting(seededCreation(
        'organizations/:id/flows/',
        mintedAtEach('id', 'projectFlowId', 'initialStateEventId'),
    ))],
    ['PUT organizations/:id/flows/:id', seededDocumentPut],
    ['POST organizations/:id/flows/:id/undo', storyFlowUndo],
    ['PUT organizations/:id/flows/:id/records/:frid',
        seededDocumentPut],
    ['DELETE organizations/:id/flows/:id/records/:frid',
        seededDocumentDelete],
    ['PUT organizations/:id/flows/:id/tags/:name', storyTagPut],
    // The story tag the setup writes, deleted under its
    // validator.
    ['DELETE organizations/:id/flows/:id/tags/:name',
        setupDocumentDelete],
    ['PUT organizations/:id/flows/:id/work-orders/:woid',
        latchedOperation('PUT', flowWorkOrderBody)],
    ['PUT organizations/:id/ideas/:id', seededDocumentPut],
    ['POST organizations/:id/ideas/:id/conversion',
        documentOperation(conversionBody)],
    ['PUT organizations/:id/ideas/:id/submissions/:sid',
        seededDocumentPut],
    ['POST organizations/:id/invitations/', posting(invitationBody)],
    // End the story member's seat (client/members.ts).
    ['PUT organizations/:id/invitations/:membership-id',
        latchedOperation('PUT', membershipStateBody('removed'))],
    ['POST organizations/:id/memberships/',
        posting(humanMembershipBody)],
    ['POST organizations/:id/objectives/', posting(seededCreation(
        'organizations/:id/objectives/',
        mintedAtEach('id', 'revisionId'),
    ))],
    ['PUT organizations/:id/objectives/:id', seededDocumentPut],
    ['PUT organizations/:id/objectives/:id/revisions/:rid',
        seededDocumentPut],
    ['PUT organizations/:id/projects/:id', seededDocumentPut],
    ['PUT organizations/:id/projects/:id/flows/:pfid',
        seededDocumentPut],
    ['DELETE organizations/:id/projects/:id/flows/:pfid',
        seededDocumentDelete],
    ['PUT ' + ACTUAL_SCORES, creatingPut(seededScoreBody)],
    ['PUT ' + BASELINE_SCORES, creatingPut(seededScoreBody)],
    // The seed creates before any flow-record join, so its
    // body names no instance. Its flow joins the seed record
    // type by now, so the create requires an instance of it.
    ['POST organizations/:id/work-orders/', posting(() => ({
        ...seededCreateBodyOf(
            'organizations/:id/work-orders/',
            mintedAtEach('id', 'flowWorkOrderId', 'stateEventIds'),
        ),
        instance: {
            instance_id: generateIdentifier(),
            record_type_id: SEED_RECORD_TYPE_ID,
        },
    }))],
    ['PUT organizations/:id/services/:id', serviceEdit],
    ['PUT organizations/:id/work-orders/:id',
        latchedOperation('PUT', workOrderBody)],
    ['PUT organizations/:id/work-orders/:id/binding',
        workOrderOperation(UNBOUND_WORK_ORDER_ID, 'PUT', () => ({
            instance_id: SEED_INSTANCE_ID,
            record_type_id: SEED_RECORD_TYPE_ID,
        }))],
    ['PUT organizations/:id/work-orders/:id/claim',
        workOrderOperation(
            LAPSED_CLAIM_WORK_ORDER_ID, 'PUT', claimBody,
        )],
    ['DELETE organizations/:id/work-orders/:id/claim',
        claimRelease(LAPSED_CLAIM_WORK_ORDER_ID)],
    ['POST organizations/:id/work-orders/:id/transition',
        workOrderOperation(DECIDING_WORK_ORDER_ID, 'POST', moveBody)],
    ['POST organizations/:organization-id/record-types/',
        posting(seededCreation(
            'organizations/:organization-id/record-types/',
            mintedAtEach('id', 'attributes'),
        ))],
    ['PUT organizations/:organization-id/record-types'
        + '/:record-type-id', seededDocumentPut],
    ['DELETE organizations/:organization-id/record-types'
        + '/:record-type-id', setupRecordTypeDelete],
    ['PUT organizations/:organization-id/record-types'
        + '/:record-type-id/attributes/:attribute-id',
        seededDocumentPut],
    ['DELETE organizations/:organization-id/record-types'
        + '/:record-type-id/attributes/:attribute-id',
        setupAttributeDelete],

    // The values the story work order's review recorded,
    // set again on the instance it is bound to.
    ['PATCH organizations/:organization-id/record-types'
        + '/:record-type-id/instances/:instance-id',
        latchedOperation('PATCH', () => ({
            set: seedSetFor(WO01_REVIEW_EVENT_ID),
        }))],
    ['DELETE organizations/:organization-id/record-types'
        + '/:record-type-id/instances/:instance-id',
        seededDocumentDelete],
]);
