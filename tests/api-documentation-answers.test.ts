import { assertEquals } from '@std/assert';
import { routes } from '../api/routes.ts';
import { buildMembers } from '../api/mock-data/members.ts';
import {
    assignOrganization,
    ORGANIZATION_TWO,
} from '../api/mock-data/seed-constants.ts';
import { membershipNameOf, parsedMembershipName } from
    '../shared/membership-name.ts';
import {
    HTTP_CREATED,
    HTTP_OK,
} from '../shared/http-errors.ts';
import {
    openReplayStage,
    type RecordedResponse,
    type ReplayRequest,
    type ReplayStage,
} from '../web-app/app/api-documentation-replay.ts';
import {
    castOf,
    type Endpoint,
    endpointsOf,
    planOf,
    type PlannedReplay,
    sendPlan,
} from '../web-app/app/api-documentation-story.ts';
import {
    answersFor,
    GENERIC_ANSWERS,
    type Provocation,
    PROVOCATION_CODES,
    provoke,
} from '../web-app/app/api-documentation-answers.ts';

// A failure names a status and an error document's `error`,
// never a header or a successful body, so never a bearer,
// a code, or a token.

const PROVOCATIONS: readonly Provocation[] = [
    'no-bearer',
    'foreign-path',
    'unknown-id',
    'stale-if-match',
    'no-precondition',
    'malformed',
    'wrong-media-type',
];
// RFC 9110 §15.5: the client error class is 4xx and up.
const ERROR_FROM = 400;
// RFC 9110 §15.6: the server error class is 5xx. A
// provocation or a variant is a client's request, so a fault
// it causes is the server's, never an answer a list may
// hold.
const SERVER_ERROR_FROM = 500;
// RFC 9110 §15.3: the successful class is 2xx.
const SUCCESSFUL_FROM = 200;
const SUCCESSFUL_BELOW = 300;
// A well-formed id nothing writes, where a PUT creates.
const FRESH_ID = 'FreshDocument00000000A';
// '/api/<segments>': a route segment's index in the target
// split on '/'.
const TARGET_OFFSET = 2;
// A route's path owner is its second segment.
const OWNER_INDEX = 1;
const IF_MATCH = 'if-match';
const IF_NONE_MATCH = 'if-none-match';
const ANY_REPRESENTATION = '*';
const ETAG = 'etag';
const MEMBERSHIP_ID = ':membership-id';
const ORGANIZATIONS = 'organizations';
// The seeded organization admin, seated in both
// organizations (api/mock-data.ts).
const ORGANIZATION_ADMIN_ID = 'XXZruirZyAOoRpNxaDnpSA';
// A seeded person seated only in the second organization:
// the one a direct seat in the story's organization creates.
const DIRECT_SEAT_IDENTITY = directSeatIdentity();
const DIRECT_SEAT_TYPE = 'member';
const DIRECT_SEAT_STATE = 'accepted';

function directSeatIdentity(): string {
    const member = buildMembers().find((held, index) =>
        held.id !== ORGANIZATION_ADMIN_ID
        && assignOrganization(index) === ORGANIZATION_TWO
    );
    if (member === undefined) {
        throw new Error('no member seated only in '
            + ORGANIZATION_TWO);
    }
    return member.id;
}
// The PUTs that may create whose only parameter is their
// owner: no fresh id stands beside the story's identities,
// whose own PII and default organization the seed wrote.
const UNVARIED_CREATES: readonly string[] = [
    'put/identities/id/default-organization',
    'put/identities/id/pii',
];

function asSent(request: ReplayRequest): ReplayRequest {
    return request;
}

// The error a refusal names, as the gate words it.
function errorOf(response: RecordedResponse): string {
    if (response.status < ERROR_FROM) return '';
    let document: unknown;
    try {
        document = JSON.parse(response.body);
    } catch {
        return '(not JSON)';
    }
    if (
        typeof document !== 'object' || document === null
        || !('error' in document)
        || typeof document.error !== 'string'
    ) {
        return '(names no error)';
    }
    return document.error;
}

// The status, and a refusal's error.
function answerOf(response: RecordedResponse): string {
    const error = errorOf(response);
    return error === ''
        ? String(response.status)
        : response.status + ' ' + error;
}

// Each code a provocation stands for, and the one provocation
// that stands for it.
function provocationOf(code: number): Provocation | undefined {
    return PROVOCATIONS.find(
        (provocation) => PROVOCATION_CODES[provocation] === code,
    );
}

function withoutPreconditions(request: ReplayRequest): ReplayRequest {
    return {
        ...request,
        headers: request.headers.filter(
            ([name]) => name !== IF_MATCH && name !== IF_NONE_MATCH,
        ),
    };
}

function withHeader(
    request: ReplayRequest,
    name: string,
    value: string,
): ReplayRequest {
    return { ...request, headers: [...request.headers, [name, value]] };
}

function successful(
    response: RecordedResponse,
    what: string,
): RecordedResponse {
    if (
        response.status < SUCCESSFUL_FROM
        || response.status >= SUCCESSFUL_BELOW
    ) {
        throw new Error(what + ' answered ' + answerOf(response));
    }
    return response;
}

// The sample at a fresh id under If-None-Match: *, which a
// write that may create answers 201; undefined where the
// only parameter is the owner. The organization nest's
// membership is created by a direct seat: an identity
// seated elsewhere, accepted with its type.
async function createdAtFreshId(
    stage: ReplayStage,
    endpoint: Endpoint,
    plan: PlannedReplay,
): Promise<RecordedResponse | undefined> {
    const at = endpoint.row.segments.findLastIndex(
        (segment) => segment.startsWith(':'),
    );
    if (at <= OWNER_INDEX) return undefined;
    const membership = endpoint.row.segments[at] === MEMBERSHIP_ID;
    const seat = membership
        && endpoint.row.segments[0] === ORGANIZATIONS;
    const exchange = await sendPlan(
        stage, { ...plan, latch: { kind: 'unlatched' } },
        (request) => {
            const segments = request.target.split('/');
            const held = segments[at + TARGET_OFFSET];
            if (held === undefined) {
                throw new Error(endpoint.hash + ' has no id to'
                    + ' freshen');
            }
            segments[at + TARGET_OFFSET] = membership
                ? membershipOf(
                    held, seat ? DIRECT_SEAT_IDENTITY : FRESH_ID,
                )
                : FRESH_ID;
            return withHeader(
                withoutPreconditions({
                    ...request,
                    target: segments.join('/'),
                    body: seat ? directSeatBody(request) : request.body,
                }),
                IF_NONE_MATCH, ANY_REPRESENTATION,
            );
        },
    );
    return exchange.response;
}

// The organization's half kept, the identity's given.
function membershipOf(held: string, identityId: string): string {
    const name = parsedMembershipName(held);
    if (name === undefined) {
        throw new Error('not a membership name: ' + held);
    }
    return membershipNameOf(name.organizationId, identityId);
}

// A direct seat's body, at the moment the sample's
// transition names.
function directSeatBody(request: ReplayRequest): string {
    const sample: unknown = JSON.parse(request.body);
    if (
        typeof sample !== 'object' || sample === null
        || !('at' in sample) || typeof sample.at !== 'string'
    ) {
        throw new Error('a membership sample names no at');
    }
    return JSON.stringify({
        state: DIRECT_SEAT_STATE,
        type: DIRECT_SEAT_TYPE,
        at: sample.at,
    });
}

// The sample sent twice on one copy: its create, then the
// same body under the If-Match the create answered, which a
// PUT that may create answers 200.
async function replacedAfterCreate(
    stage: ReplayStage,
    endpoint: Endpoint,
    plan: PlannedReplay,
): Promise<RecordedResponse> {
    if (plan.latch.kind !== 'unlatched') {
        throw new Error(endpoint.hash + ': a creating sample is'
            + ' unlatched');
    }
    const on = stage.copy();
    for (const request of plan.setup) {
        successful(
            (await stage.send(on, request)).response,
            endpoint.hash + ' setup',
        );
    }
    const created = successful(
        (await stage.send(on, plan.request)).response,
        endpoint.hash + ' create',
    );
    const etag = created.headers.find(([name]) => name === ETAG);
    if (etag === undefined) {
        throw new Error(endpoint.hash + ': a create names no etag');
    }
    return (await stage.send(on, withHeader(
        withoutPreconditions(plan.request), IF_MATCH, etag[1],
    ))).response;
}

Deno.test('every provocation stands for its own code', () => {
    assertEquals(
        Object.keys(PROVOCATION_CODES).sort(),
        [...PROVOCATIONS].sort(),
    );
    assertEquals(
        new Set(Object.values(PROVOCATION_CODES)).size,
        PROVOCATIONS.length,
    );
});

Deno.test("each listed status is the gate's, in both directions",
    async () => {
        const stage = await openReplayStage();
        const cast = await castOf(stage);
        const generic = new Set(
            GENERIC_ANSWERS.map((rule) => rule.code),
        );
        const mismatches: string[] = [];
        const unvaried: string[] = [];
        for (const endpoint of endpointsOf(routes)) {
            const plan = await planOf(endpoint, cast, stage);
            if (plan.kind !== 'replay') continue;
            const { hash } = endpoint;
            const witnessed = (
                await sendPlan(stage, plan, asSent)
            ).response.status;
            const rules = answersFor(endpoint, witnessed);
            const listed = new Set(rules.map((rule) => rule.code));
            if (!listed.has(witnessed)) {
                mismatches.push(
                    hash + ': the sample answers ' + witnessed
                        + ', which is not listed',
                );
            }
            const answered = new Map<Provocation, RecordedResponse>();
            for (const provocation of PROVOCATIONS) {
                const provoked = provoke(plan, provocation, cast);
                if (provoked === undefined) continue;
                if (provoked.kind !== 'replay') {
                    throw new Error(
                        hash + ' ' + provocation + ' plans no replay',
                    );
                }
                const response = (
                    await sendPlan(stage, provoked, asSent)
                ).response;
                answered.set(provocation, response);
                if (response.status >= SERVER_ERROR_FROM) {
                    mismatches.push(
                        hash + ' ' + provocation + ': answered a'
                            + ' server error, '
                            + answerOf(response),
                    );
                } else if (
                    !listed.has(response.status)
                    && !generic.has(response.status)
                ) {
                    mismatches.push(
                        hash + ' ' + provocation + ': expected one of '
                            + [...listed].join(' ') + ', answered '
                            + answerOf(response),
                    );
                }
            }
            for (const rule of rules) {
                if (!rule.provoked) continue;
                const provocation = provocationOf(rule.code);
                if (provocation === undefined) {
                    mismatches.push(
                        hash + ': ' + rule.code
                            + ' is provoked, by no provocation',
                    );
                    continue;
                }
                const response = answered.get(provocation);
                if (response === undefined) {
                    mismatches.push(
                        hash + ' ' + provocation + ': expected '
                            + rule.code + ', which it does not apply'
                            + ' to provoke',
                    );
                    continue;
                }
                if (response.status !== rule.code) {
                    mismatches.push(
                        hash + ' ' + provocation + ': expected '
                            + rule.code + ', answered '
                            + answerOf(response),
                    );
                }
            }
            // A PUT's or a PATCH's other success, by one
            // variant send: a create replaced, or the sample at
            // a fresh id. The answer is listed, and a listed
            // other success is the answer.
            if (endpoint.verb !== 'put' && endpoint.verb !== 'patch') {
                continue;
            }
            const other = witnessed === HTTP_CREATED
                ? HTTP_OK
                : HTTP_CREATED;
            const variant = other === HTTP_OK
                ? 'replaced'
                : 'created at a fresh id';
            const varied = other === HTTP_OK
                ? await replacedAfterCreate(stage, endpoint, plan)
                : await createdAtFreshId(stage, endpoint, plan);
            if (varied === undefined) {
                if (listed.has(other)) unvaried.push(hash);
                continue;
            }
            if (varied.status >= SERVER_ERROR_FROM) {
                mismatches.push(
                    hash + ' ' + variant + ': answered a server'
                        + ' error, ' + answerOf(varied),
                );
            } else if (
                !listed.has(varied.status)
                && !generic.has(varied.status)
            ) {
                mismatches.push(
                    hash + ' ' + variant + ': expected one of '
                        + [...listed].join(' ') + ', answered '
                        + answerOf(varied),
                );
            } else if (
                listed.has(other) && varied.status !== other
            ) {
                mismatches.push(
                    hash + ' ' + variant + ': expected ' + other
                        + ', answered ' + answerOf(varied),
                );
            }
        }
        assertEquals(
            { mismatches, unvaried },
            { mismatches: [], unvaried: [...UNVARIED_CREATES] },
        );
    });
