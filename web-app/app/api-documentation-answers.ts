// Why each endpoint answers each status, and the
// provocations that hold those reasons to the gate (spec,
// Status codes). The rules are the declaration: each listed
// code carries the line the rule that listed it gives, and
// tests/api-documentation-answers.test.ts sends each
// provocation through the gate to hold the lists both ways.

import {
    conditionalOf,
    matchRoute,
    routes,
} from '../../api/routes.ts';
import type {
    Conditional,
    Route,
    WriteMethod,
} from '../../api/routes.ts';
import {
    offeredVerbs,
    routePatternOf,
    uriOf,
} from '../../api/route-surface.ts';
import type { HttpVerb } from '../../api/route-surface.ts';
import { documentFamilyWiring } from
    '../../api/document-family.ts';
import { pathSegmentsOf } from '../../api/path-segments.ts';
import { ORGANIZATION_TWO } from
    '../../api/mock-data/seed-constants.ts';
import {
    AUTHENTICATION_ROUTES,
    STATUS_ROUTE,
} from '../../api/request-auth.ts';
import { REQUEST_BODY_MAX_BYTES } from
    '../../server/http-server.ts';
import {
    HTTP_BAD_REQUEST,
    HTTP_CONFLICT,
    HTTP_CREATED,
    HTTP_FORBIDDEN,
    HTTP_GATEWAY_TIMEOUT,
    HTTP_GONE,
    HTTP_INTERNAL_ERROR,
    HTTP_LENGTH_REQUIRED,
    HTTP_METHOD_NOT_ALLOWED,
    HTTP_NO_CONTENT,
    HTTP_NOT_FOUND,
    HTTP_NOT_IMPLEMENTED,
    HTTP_OK,
    HTTP_PAYLOAD_TOO_LARGE,
    HTTP_PRECONDITION_FAILED,
    HTTP_PRECONDITION_REQUIRED,
    HTTP_SERVICE_UNAVAILABLE,
    HTTP_TOO_MANY_REQUESTS,
    HTTP_UNAUTHORIZED,
    HTTP_UNSUPPORTED_MEDIA_TYPE,
} from '../../shared/http-errors.ts';
import { QUERY_TEXT_MAX_LENGTH } from
    '../../shared/search-match.ts';
import {
    type MembershipName,
    membershipNameOf,
    parsedMembershipName,
} from '../../shared/membership-name.ts';
import type { ApiDocTier } from '../api-documentation/shapes.ts';
import type { ReplayRequest } from './api-documentation-replay.ts';
import type {
    Cast,
    Endpoint,
    PlannedReplay,
    ReplayLatch,
    ReplayPlan,
} from './api-documentation-story.ts';
import { tierOf } from './api-documentation-tier.ts';

// A selected head that is deleted answers 410 (spec §5):
// a DELETE head, which only a route offering DELETE can
// store, or a state-`deleted` head in a lifecycle family.
// A family's document is the segment before its id.
export function isDeletableDocument(row: Route): boolean {
    if (offeredVerbs(row).includes('delete')) return true;
    const id = row.segments.at(-1);
    const family = row.segments.at(-2);
    return id !== undefined
        && id.startsWith(':')
        && family !== undefined
        && documentFamilyWiring(family)?.lifecycle === 'state';
}

// The segment before the document id, for a version route.
export function versionFamily(row: Route): string | undefined {
    const at = row.segments.indexOf('versions');
    if (at < 2) return undefined;
    return row.segments[at - 2];
}

// A lifecycle-'state' family, or a document route that
// offers DELETE, can hold a deleted head.
export function familyHoldsDeletedHead(family: string): boolean {
    if (
        documentFamilyWiring(family)?.lifecycle === 'state'
    ) {
        return true;
    }
    return routes.some((candidate) => {
        const last = candidate.segments.at(-1);
        const previous = candidate.segments.at(-2);
        return last !== undefined
            && last.startsWith(':')
            && previous === family
            && offeredVerbs(candidate).includes('delete');
    });
}

export function isMembershipItem(uri: string): boolean {
    return uri
            === '/identities/:id/invitations/:membership-id'
        || uri
            === '/organizations/:id/invitations'
                + '/:membership-id';
}

export function isMembershipConflict(
    verb: HttpVerb,
    uri: string,
): boolean {
    if (verb === 'put' && isMembershipItem(uri)) {
        return true;
    }
    return verb === 'post'
        && (
            uri === '/organizations/:id/invitations/'
            || uri === '/organizations/:id/memberships/'
        );
}

// ---- answers ----

const ORGANIZATIONS = 'organizations';
const IDENTITIES = 'identities';
// A route's path owner, the organization or the identity
// every route under it is fenced to, is its second segment.
const OWNER_INDEX = 1;
const MEMBERSHIP_ID = ':membership-id';
// `identities/:id/<facet>`.
const IDENTITY_FACET_LENGTH = 3;
// The methods that carry a body, and the write methods, as
// Request.method and conditionalOf spell them.
const BODY_METHODS: ReadonlySet<string> = new Set([
    'PUT', 'POST', 'PATCH', 'QUERY',
]);
const WRITE_METHODS: Readonly<Record<string, WriteMethod>> = {
    PUT: 'PUT',
    POST: 'POST',
    PATCH: 'PATCH',
    DELETE: 'DELETE',
};

export interface AnswerRule {
    readonly code: number;
    // Why this endpoint answers it, and what to do.
    readonly line: string;
    // True where a provocation answers it on every replay
    // (PROVOCATION_CODES); false where it needs a state the
    // replay does not make, so it is stated.
    readonly provoked: boolean;
}

function stated(code: number, line: string): AnswerRule {
    return { code, line, provoked: false };
}

function provokedBy(code: number, line: string): AnswerRule {
    return { code, line, provoked: true };
}

// The answers any request may get, from the gate before it
// knows the route (api/api.ts dispatched, api/request-context.ts
// framingRefusal), the server around it (server/http-server.ts
// dispatch), and a database fault (api/errors-postgres.ts).
// Stated once, in the guided start, never on an endpoint.
export const GENERIC_ANSWERS: readonly AnswerRule[] = [
    stated(HTTP_BAD_REQUEST, 'Operation-ID is missing, or is not a'
        + ' 22-character identifier. Send a fresh one on every'
        + ' request.'),
    stated(HTTP_BAD_REQUEST, 'The request carries a Request-ID. The'
        + ' server mints it; send none.'),
    stated(HTTP_BAD_REQUEST, 'Content-Length does not match the'
        + ' body. Send the body\'s length in bytes.'),
    stated(HTTP_BAD_REQUEST, 'A path id is not a 22-character'
        + ' identifier, or a membership id is not two joined by a'
        + ' colon. Use an id a listing returns.'),
    stated(HTTP_BAD_REQUEST, 'If-Match is not one strong'
        + ' validator, If-None-Match is not *, or If-None-Match'
        + ' comes where the route takes only If-Match. Send the'
        + ' ETag you read, quotes included.'),
    stated(HTTP_LENGTH_REQUIRED, 'A body came without Content-Length,'
        + ' or with Transfer-Encoding. Send the body with its'
        + ' length.'),
    stated(HTTP_PAYLOAD_TOO_LARGE, 'The body is over '
        + REQUEST_BODY_MAX_BYTES + ' bytes. Send a smaller one.'),
    stated(HTTP_INTERNAL_ERROR, 'The server failed. The error is'
        + ' "internal error", or names a database fault\'s class,'
        + ' such as a deadlock: retry, and report the Request-ID'
        + ' if it persists.'),
    stated(HTTP_GATEWAY_TIMEOUT, 'The database did not answer in'
        + ' time. Retry later.'),
];

// What the rules read of one endpoint.
interface Facts {
    readonly row: Route;
    readonly verb: HttpVerb;
    readonly pattern: string;
    readonly uri: string;
    readonly tier: ApiDocTier;
    readonly conditional: Conditional;
    readonly signIn: boolean;
    // The first segment, under which the owner segment
    // fences every route.
    readonly nest: string | undefined;
    readonly owned: boolean;
    // Whether a parameter follows the owner: unknown-id's to
    // make unknown.
    readonly identified: boolean;
    // A GET that selects heads.
    readonly selects: boolean;
    readonly collection: boolean;
}

const VERSIONS_COLLECTION = '/versions/';
const AUTHORIZE_PATTERN = 'authentication/authorize';
const INVITATIONS_COLLECTION = 'organizations/:id/invitations/';
const WORK_ORDERS_COLLECTION = 'organizations/:id/work-orders/';
const RECORD_TYPES_COLLECTION =
    'organizations/:organization-id/record-types/';
const REGISTRATION_PATTERN = 'identities/:id/registration';
const ROTATION_PATTERN = 'identities/:id/tokens/:jti/rotation';
// The organization document and its versions, which the gate
// fences to the caller's memberships, not the token's
// organization (api/api.ts isOrganizationDocumentPath).
const ORGANIZATION_DOCUMENT_READS: ReadonlySet<string> = new Set([
    'organizations/:id',
    'organizations/:id/versions/',
    'organizations/:id/versions/:etag',
]);
// The sub-collections that probe their parent before they
// select, so an unknown parent is 404, not an empty 204.
const PARENT_PROBED_COLLECTIONS: ReadonlySet<string> = new Set([
    'organizations/:organization-id/record-types/:record-type-id'
        + '/attributes/',
    'organizations/:organization-id/record-types/:record-type-id'
        + '/instances/',
]);
// The document PUTs that create nothing: a POST mints the
// work order and the identity, the roster the AI agent and
// the service, and an organization's PUT names the token's
// own. An unknown id is 404 where any other PUT may create.
const PUT_NEVER_CREATES: ReadonlySet<string> = new Set([
    'organizations/:id/work-orders/:id',
    'organizations/:id/ai-agents/:id',
    'organizations/:id/services/:id',
    'organizations/:id',
    'identities/:id',
]);

function factsOf(endpoint: Endpoint): Facts {
    const { row, verb } = endpoint;
    const pattern = routePatternOf(row);
    const method = WRITE_METHODS[verb.toUpperCase()];
    const owner = row.segments[OWNER_INDEX];
    const owned = owner !== undefined && owner.startsWith(':');
    const lastParameter = row.segments.findLastIndex(
        (segment) => segment.startsWith(':'),
    );
    const uri = uriOf(row);
    return {
        row,
        verb,
        pattern,
        uri,
        tier: tierOf(row, verb),
        conditional: method === undefined
            ? 'none'
            : conditionalOf(pattern, method),
        signIn: AUTHENTICATION_ROUTES.has(pattern),
        nest: row.segments[0],
        owned,
        identified: lastParameter > OWNER_INDEX,
        selects: verb === 'get' && row.select !== undefined,
        collection: uri.endsWith('/'),
    };
}

// Each endpoint's answers, by code: the witnessed success and
// the rules' codes, each with the line its rule gives (D16 to
// D19). `witnessed` is the sample's status; with no sample
// the verb's class default stands in.
export function answersFor(
    endpoint: Endpoint,
    witnessed: number | undefined,
): readonly AnswerRule[] {
    const facts = factsOf(endpoint);
    const success = witnessed ?? classDefaultOf(facts);
    if (facts.pattern === STATUS_ROUTE) {
        return systemStatusAnswers(success);
    }
    const rules = [
        successOf(facts, success),
        secondSuccessOf(facts, success),
        emptySelectionOf(facts, success),
        badRequestOf(facts),
        unauthorizedOf(facts),
        forbiddenOf(facts),
        notFoundOf(facts),
        notAllowedOf(facts),
        conflictOf(facts),
        goneOf(facts),
        preconditionFailedOf(facts),
        preconditionRequiredOf(facts),
        unsupportedMediaTypeOf(facts),
        tooManyRequestsOf(facts),
        notImplementedOf(facts),
    ].filter((rule): rule is AnswerRule => rule !== undefined);
    const codes = new Set(rules.map((rule) => rule.code));
    if (codes.size !== rules.length) {
        throw new Error('two rules list one code at ' + endpoint.hash);
    }
    return rules.sort((a, b) => a.code - b.code);
}

// The gate answers the status route ahead of the bearer
// check and the route match (api/api.ts dispatched), so it is
// never 401, 403, or 404: its document, 500 when the API is
// handed no commit, and 503 when a component is not up.
function systemStatusAnswers(success: number): readonly AnswerRule[] {
    return [
        stated(success, 'Every component is up. The body names'
            + ' the running commit and each component\'s state.'),
        stated(HTTP_INTERNAL_ERROR, 'The API was started without'
            + ' its commit, so it has none to report. Report the'
            + ' Request-ID.'),
        stated(HTTP_SERVICE_UNAVAILABLE, 'A component is not up.'
            + ' The body names each component\'s state and the'
            + ' running commit. Retry later.'),
    ];
}

function classDefaultOf(facts: Facts): number {
    return facts.verb === 'delete' ? HTTP_NO_CONTENT : HTTP_OK;
}

function successOf(facts: Facts, code: number): AnswerRule {
    if (code === HTTP_NO_CONTENT && isSelection(facts)) {
        return emptySelection();
    }
    if (code === HTTP_NO_CONTENT) {
        return stated(code, 'Deleted, or already gone. No body.');
    }
    if (code === HTTP_CREATED && isMembershipItem(facts.uri)) {
        return stated(code, 'Seated: the organization admin'
            + ' seated an identity directly, as accepted with its'
            + ' type. The body is the membership.');
    }
    if (code === HTTP_CREATED) {
        return stated(code, 'Created. The body is the stored'
            + ' document.');
    }
    if (facts.verb === 'query') {
        return stated(code, 'The matching documents, one part'
            + ' each.');
    }
    if (facts.verb === 'get') {
        return stated(code, facts.collection
            ? 'The selected documents, one part each.'
            : 'The document, under its ETag.');
    }
    if (facts.verb === 'put' && isMembershipItem(facts.uri)) {
        return stated(code, 'Changed: the membership took the'
            + ' state or type sent. The same body sent again under'
            + ' the new ETag answers 409.');
    }
    return stated(code, facts.verb === 'put'
        ? 'Replaced. A body equal to the stored one writes'
            + ' nothing and answers the same ETag.'
        : 'Done. The body is the outcome.');
}

// A PUT or PATCH that may create: one that is no in-order
// operation and that no POST or roster alone mints. It
// answers 201 where nothing stood and 200 where it
// replaced. The organization nest's membership PUT creates
// a seat directly (api/memberships.ts, admin: none to
// accepted), and a record instance's PATCH creates it
// under If-None-Match: *.
function mayCreate(facts: Facts): boolean {
    return (facts.verb === 'put' || facts.verb === 'patch')
        && facts.conditional !== 'in-order'
        && !PUT_NEVER_CREATES.has(facts.pattern);
}

// D16's named second successes, a creating write's pair, and
// a selection's pair: a collection or a QUERY that selects
// something answers 200, and one that selects nothing 204.
function secondSuccessOf(
    facts: Facts,
    success: number,
): AnswerRule | undefined {
    if (
        isSelection(facts)
        && success === HTTP_NO_CONTENT
    ) {
        return stated(HTTP_OK, facts.verb === 'query'
            ? 'The matching documents, one part each.'
            : 'The selected documents, one part each.');
    }
    if (mayCreate(facts)) {
        return successOf(
            facts, success === HTTP_CREATED ? HTTP_OK : HTTP_CREATED,
        );
    }
    if (facts.verb !== 'post') return undefined;
    if (facts.pattern === INVITATIONS_COLLECTION) {
        return stated(HTTP_OK, 'The invitation is already'
            + ' pending: its head is served again.');
    }
    if (facts.pattern === RECORD_TYPES_COLLECTION) {
        return stated(HTTP_OK, 'An edit: the body names an existing'
            + ' record type, under its If-Match.');
    }
    return undefined;
}

function emptySelection(): AnswerRule {
    return stated(HTTP_NO_CONTENT, 'Nothing is selected: the'
        + ' collection is empty, or nothing matches. No body.');
}

// A collection that selects no head answers 204, and so
// does a QUERY that matches nothing. A versions/ list never
// does: a written document has a PUT.
function isSelection(facts: Facts): boolean {
    if (facts.verb === 'query') return true;
    return facts.selects
        && facts.collection
        && !facts.uri.endsWith(VERSIONS_COLLECTION);
}

function emptySelectionOf(
    facts: Facts,
    success: number,
): AnswerRule | undefined {
    if (success === HTTP_NO_CONTENT) return undefined;
    return isSelection(facts) ? emptySelection() : undefined;
}

// A body the gate cannot parse or a validator refuses, or a
// `?state=` no judge accepts.
function badRequestOf(facts: Facts): AnswerRule | undefined {
    if (BODY_METHODS.has(facts.verb.toUpperCase())) {
        if (facts.verb === 'query') {
            return provokedBy(HTTP_BAD_REQUEST, 'The body is not a'
                + ' JSON object with a string q of at most '
                + QUERY_TEXT_MAX_LENGTH + ' characters'
                + (facts.row.query === undefined
                    ? '.'
                    : ', or ?state= names no state this list'
                        + ' takes.')
                + ' Fix it and send it again.');
        }
        return provokedBy(HTTP_BAD_REQUEST, 'The body is not a'
            + ' JSON object, or a field fails validation'
            + (facts.conditional === 'none'
                ? ', or the request carries a precondition this'
                    + ' route does not take'
                : '')
            + (facts.pattern === REGISTRATION_PATTERN
                ? ', or the identity is not a service'
                : '')
            + '. The error names which; fix it and send it again.');
    }
    if (facts.row.query !== undefined) {
        return provokedBy(HTTP_BAD_REQUEST, '?state= names no state'
            + ' this list takes. Send one the error lists, or'
            + ' none.');
    }
    if (
        facts.verb === 'get'
        && facts.pattern === REGISTRATION_PATTERN
    ) {
        return stated(HTTP_BAD_REQUEST, 'The identity is not a'
            + ' service: only a service has a registration.');
    }
    return undefined;
}

function unauthorizedOf(facts: Facts): AnswerRule {
    if (!facts.signIn) {
        return provokedBy(HTTP_UNAUTHORIZED, 'No bearer, or one'
            + ' expired or revoked. Refresh the session, or sign in'
            + ' again.');
    }
    if (facts.pattern === AUTHORIZE_PATTERN) {
        return provokedBy(HTTP_UNAUTHORIZED, 'The Basic credentials'
            + ' name no identity, or the password does not match.'
            + ' Check both and retry.');
    }
    return stated(HTTP_UNAUTHORIZED, 'The credential the token'
        + ' request carries is missing, unknown, used, or revoked:'
        + ' the code, the refresh cookie, or the assertion. Sign in'
        + ' again.');
}

// D18: a path the caller does not own, and the role a route
// asks for.
function forbiddenOf(facts: Facts): AnswerRule | undefined {
    const role = facts.tier === 'admin'
        ? ' Or your role is below organization admin.'
        : '';
    if (facts.nest === ORGANIZATIONS && facts.owned) {
        if (
            facts.verb === 'get'
            && ORGANIZATION_DOCUMENT_READS.has(facts.pattern)
        ) {
            return provokedBy(HTTP_FORBIDDEN, 'You are no member of'
                + ' this organization.' + role);
        }
        return provokedBy(HTTP_FORBIDDEN, 'The path names another'
            + ' organization than your token\'s. Exchange the token'
            + ' for that organization first.' + role);
    }
    if (facts.nest === IDENTITIES && facts.owned) {
        if (
            facts.tier === 'member'
            && facts.row.segments.includes(MEMBERSHIP_ID)
        ) {
            return provokedBy(HTTP_FORBIDDEN, 'The path names an'
                + ' identity other than yours: only the invitee'
                + ' reads or answers an invitation.');
        }
        if (facts.tier === 'member') {
            return provokedBy(HTTP_FORBIDDEN, 'The path names an'
                + ' identity other than yours that your role may not'
                + ' act for, or one outside your organization.');
        }
        return stated(HTTP_FORBIDDEN, 'The path names an identity'
            + ' outside your organization.' + role);
    }
    if (facts.tier === 'admin') {
        return stated(HTTP_FORBIDDEN, 'Your role is below'
            + ' organization admin.');
    }
    if (facts.signIn && facts.pattern !== AUTHORIZE_PATTERN) {
        return stated(HTTP_FORBIDDEN, 'The token request names an'
            + ' organization the subject is no member of, or a'
            + ' token exchange names an actor other than its'
            + ' subject.');
    }
    return undefined;
}

// D19: the last id after the owner, never written. Where it
// answers something else (an empty collection, a create, a
// stale validator, or reuse), no 404 is provoked. The gate
// states the others: a membership whose identity half is not
// the path's (api/api.ts membershipNameGate), a direct seat
// of an identity that does not exist, a write under a
// parent that does not exist, a work order born bound to a
// record type deleted while its flow still joins it
// (api/routes.ts postWorkOrderCreationOp), an identity's
// facet or a DELETE's document never written, and a read of
// an organization that does not exist.
function notFoundOf(facts: Facts): AnswerRule | undefined {
    if (facts.identified && unknownIdIsNotFound(facts)) {
        return provokedBy(HTTP_NOT_FOUND, 'Nothing has this id'
            + ' here. Use an id the listing returns.');
    }
    if (
        facts.nest === IDENTITIES
        && facts.row.segments.includes(MEMBERSHIP_ID)
    ) {
        return stated(HTTP_NOT_FOUND, 'The membership names'
            + ' another identity than the path\'s.');
    }
    if (
        (facts.verb === 'put' || facts.verb === 'patch')
        && isUnderProbedParent(facts)
    ) {
        return stated(HTTP_NOT_FOUND, 'No record type has this'
            + ' id. Use one the listing returns.');
    }
    if (
        facts.verb === 'put'
        && facts.nest === ORGANIZATIONS
        && isMembershipItem(facts.uri)
    ) {
        return stated(HTTP_NOT_FOUND, 'No identity has this id:'
            + ' a direct seat names an identity that exists.');
    }
    if (
        facts.verb === 'post'
        && facts.pattern === WORK_ORDERS_COLLECTION
    ) {
        return stated(HTTP_NOT_FOUND, 'The instance names a record'
            + ' type that was deleted, though the flow still joins'
            + ' it. Name another type the flow joins.');
    }
    if (facts.identified) return undefined;
    if (
        (facts.verb === 'delete' && facts.conditional !== 'in-order')
        || isIdentityFacetRead(facts)
    ) {
        return stated(HTTP_NOT_FOUND, NEVER_WRITTEN);
    }
    if (
        facts.verb === 'get'
        && ORGANIZATION_DOCUMENT_READS.has(facts.pattern)
    ) {
        return stated(HTTP_NOT_FOUND, 'No organization has this'
            + ' id.');
    }
    return undefined;
}

const NEVER_WRITTEN = 'Nothing was ever written here.';

// A route under a parent-probed collection reads its parent
// first, so an unknown parent is 404 whatever the last id.
function isUnderProbedParent(facts: Facts): boolean {
    return [...PARENT_PROBED_COLLECTIONS].some(
        (collection) => facts.pattern.startsWith(collection),
    );
}

// An identity's own document beside it, such as its PII,
// its registration, or its default organization, which a
// seated identity may never have written.
function isIdentityFacetRead(facts: Facts): boolean {
    return facts.verb === 'get'
        && facts.nest === IDENTITIES
        && facts.owned
        && !facts.collection
        && facts.row.segments.length === IDENTITY_FACET_LENGTH;
}

function unknownIdIsNotFound(facts: Facts): boolean {
    switch (facts.verb) {
        case 'get':
        case 'query':
            return !facts.collection
                || facts.uri.endsWith(VERSIONS_COLLECTION)
                || PARENT_PROBED_COLLECTIONS.has(facts.pattern);
        case 'delete':
            return true;
        case 'post':
            // Rotating a jti that is not live is reuse (409).
            return facts.pattern !== ROTATION_PATTERN;
        // An in-order PUT acts on the document it names: the
        // work order a claim or binding moves, which is 404
        // when absent, or the membership itself, whose absent
        // head fails the If-Match (412).
        case 'put':
        case 'patch':
            return (
                facts.conditional === 'in-order'
                && !isMembershipItem(facts.uri)
            )
                || PUT_NEVER_CREATES.has(facts.pattern);
    }
}

// DELETE is not offered, so the catalog has no DELETE room.
// The item still answers 405.
function notAllowedOf(facts: Facts): AnswerRule | undefined {
    if (!isMembershipItem(facts.uri)) return undefined;
    return stated(HTTP_METHOD_NOT_ALLOWED, 'A membership is never'
        + ' deleted: PUT its state instead.');
}

// A transition outside the table, the last accepted
// organization admin, a repeated accept, decline, or revoke,
// a seat for the system identity, and the statement's
// resend; a create sent again, whose body names an id that
// stands (the invitation POST serves its head instead); and
// a rotation of a jti that is not live.
function conflictOf(facts: Facts): AnswerRule | undefined {
    if (isMembershipConflict(facts.verb, facts.uri)) {
        return stated(HTTP_CONFLICT, 'The membership\'s state does'
            + ' not allow this change. Read it again; the error'
            + ' names the rule.');
    }
    if (
        facts.verb === 'post'
        && facts.collection
        && facts.pattern !== INVITATIONS_COLLECTION
    ) {
        return stated(HTTP_CONFLICT, 'A document already exists at'
            + ' the id the body names, as when a create is sent'
            + ' twice. Read it, or create under a fresh id.');
    }
    if (facts.pattern === ROTATION_PATTERN) {
        return stated(HTTP_CONFLICT, 'The jti is not live: rotating'
            + ' an unknown or used token is reuse, which revokes its'
            + ' chain. Sign in again.');
    }
    return undefined;
}

// State families, and any family whose document route offers
// DELETE, list 410. A select version route lists it too: the
// ladder answers Gone for a DELETE head of every lifecycle.
// A deleted record instance refuses its PATCH with 410, and
// a work order's create refuses to be born bound to one.
function goneOf(facts: Facts): AnswerRule | undefined {
    if (
        facts.verb === 'post'
        && facts.pattern === WORK_ORDERS_COLLECTION
    ) {
        return stated(HTTP_GONE, 'The instance id names a deleted'
            + ' instance, and a deleted name is never written'
            + ' again. Send a fresh instance id.');
    }
    if (facts.verb === 'patch' && isDeletableDocument(facts.row)) {
        return stated(HTTP_GONE, 'The document was deleted, and'
            + ' a deleted document takes no write.');
    }
    const family = versionFamily(facts.row);
    const deletedVersion = family !== undefined
        && (
            familyHoldsDeletedHead(family)
            || (
                facts.selects
                && documentFamilyWiring(family) !== undefined
            )
        );
    if (
        !(facts.selects && isDeletableDocument(facts.row))
        && !deletedVersion
    ) {
        return undefined;
    }
    return stated(HTTP_GONE, 'The document was deleted. Its'
        + ' versions/ still list its history.');
}

// The sample creates a record type, where If-Match is refused;
// the edit body that takes it is stated.
function preconditionFailedOf(facts: Facts): AnswerRule | undefined {
    if (facts.conditional === 'none') return undefined;
    const line = 'If-Match names no current version. Read the'
        + ' document again and retry under its ETag.';
    return facts.pattern === RECORD_TYPES_COLLECTION
        ? stated(HTTP_PRECONDITION_FAILED, line)
        : provokedBy(HTTP_PRECONDITION_FAILED, line);
}

function preconditionRequiredOf(
    facts: Facts,
): AnswerRule | undefined {
    if (
        facts.verb === 'post'
        && facts.pattern === RECORD_TYPES_COLLECTION
    ) {
        return stated(HTTP_PRECONDITION_REQUIRED, 'An edit body'
            + ' needs If-Match. Read the record type and send its'
            + ' ETag.');
    }
    if (
        facts.conditional !== 'required'
        && facts.conditional !== 'in-order'
    ) {
        return undefined;
    }
    return provokedBy(HTTP_PRECONDITION_REQUIRED, mayCreate(facts)
        ? 'Send If-Match with the ETag you read, or If-None-Match:'
            + ' * to create.'
        : 'Send If-Match with the ETag you read.');
}

function unsupportedMediaTypeOf(
    facts: Facts,
): AnswerRule | undefined {
    if (facts.verb !== 'query') return undefined;
    return provokedBy(HTTP_UNSUPPORTED_MEDIA_TYPE, 'A QUERY body'
        + ' is application/json. Send that Content-Type.');
}

// The server's sign-in throttle (server/throttle.ts), which a
// refresh and a token exchange pass.
function tooManyRequestsOf(facts: Facts): AnswerRule | undefined {
    if (!facts.signIn) return undefined;
    return stated(HTTP_TOO_MANY_REQUESTS, 'Too many sign-in'
        + ' attempts from this address. Wait, then retry.');
}

// D17: the password method is real; the others are seams
// (api/authentication.ts postAuthorize).
function notImplementedOf(facts: Facts): AnswerRule | undefined {
    if (facts.pattern !== AUTHORIZE_PATTERN) return undefined;
    return stated(HTTP_NOT_IMPLEMENTED, 'The method is passkey,'
        + ' provider, or oidc, which this server does not offer'
        + ' yet. Use password.');
}

// ---- provocations ----

export type Provocation = 'no-bearer' | 'foreign-path'
    | 'unknown-id' | 'stale-if-match' | 'no-precondition'
    | 'malformed' | 'wrong-media-type';

// The code each provocation stands for: the one a listed,
// provoked rule must see it answer.
export const PROVOCATION_CODES: Readonly<Record<Provocation, number>> = {
    'no-bearer': HTTP_UNAUTHORIZED,
    'foreign-path': HTTP_FORBIDDEN,
    'unknown-id': HTTP_NOT_FOUND,
    'stale-if-match': HTTP_PRECONDITION_FAILED,
    'no-precondition': HTTP_PRECONDITION_REQUIRED,
    'malformed': HTTP_BAD_REQUEST,
    'wrong-media-type': HTTP_UNSUPPORTED_MEDIA_TYPE,
};

const API_PREFIX = '/api/';
const QUERY_MARK = '?';
const AUTHORIZATION = 'authorization';
const CONTENT_TYPE = 'content-type';
const IF_MATCH = 'if-match';
const IF_NONE_MATCH = 'if-none-match';
// A well-formed identifier no seed or replay writes: an
// unknown id, an unknown version, and the opaque tag of a
// validator no head carries.
const UNWRITTEN_ID = 'UnwrittenId0000000000A';
const STALE_VALIDATOR = '"' + UNWRITTEN_ID + '"';
const MALFORMED_BODY = '{';
const BOGUS_STATE = '?state=bogus';
const WRONG_MEDIA_TYPE = 'text/plain';
const UNLATCHED: ReplayLatch = { kind: 'unlatched' };

// The plan with one part of its request made wrong, the rest
// as the sample sends it, or undefined where the provocation
// has nothing to make wrong. A provocation the latch would
// undo leaves the plan unlatched.
export function provoke(
    plan: ReplayPlan,
    provocation: Provocation,
    cast: Cast,
): ReplayPlan | undefined {
    if (plan.kind !== 'replay') return undefined;
    switch (provocation) {
        case 'no-bearer':
            return withoutBearer(plan);
        case 'foreign-path':
            return onForeignPath(plan, cast);
        case 'unknown-id':
            return atUnknownId(plan);
        case 'stale-if-match':
            return withStaleIfMatch(plan);
        case 'no-precondition':
            return withoutPrecondition(plan);
        case 'malformed':
            return malformed(plan);
        case 'wrong-media-type':
            return withWrongMediaType(plan);
    }
}

interface Target {
    // The segments after '/api/', as pathSegmentsOf splits
    // them.
    readonly segments: readonly string[];
    // '' or '?…'.
    readonly search: string;
}

function targetOf(request: ReplayRequest): Target {
    if (!request.target.startsWith(API_PREFIX)) {
        throw new Error('not an API target: ' + request.target);
    }
    const at = request.target.indexOf(QUERY_MARK);
    const path = at < 0
        ? request.target
        : request.target.slice(0, at);
    return {
        segments: pathSegmentsOf(path.slice(API_PREFIX.length)),
        search: at < 0 ? '' : request.target.slice(at),
    };
}

function joined(target: Target): string {
    return API_PREFIX + target.segments.join('/') + target.search;
}

// The route the request reaches once its latch has filled
// the segment it fills, as the gate matches it.
function routeOf(plan: PlannedReplay): Route {
    const { segments } = targetOf(plan.request);
    const reached = plan.latch.kind === 'etag-segment'
        ? [...segments, UNWRITTEN_ID]
        : [...segments];
    const match = matchRoute(routes, reached);
    if (match === null) {
        throw new Error('no route reaches ' + plan.request.target);
    }
    return match.route;
}

function hasHeader(request: ReplayRequest, name: string): boolean {
    return request.headers.some(([held]) => held === name);
}

function withoutHeaders(
    request: ReplayRequest,
    names: readonly string[],
): ReplayRequest {
    return {
        ...request,
        headers: request.headers.filter(
            ([name]) => !names.includes(name),
        ),
    };
}

function withHeader(
    request: ReplayRequest,
    name: string,
    value: string,
): ReplayRequest {
    const kept = withoutHeaders(request, [name]);
    return { ...kept, headers: [...kept.headers, [name, value]] };
}

function withoutBearer(plan: PlannedReplay): PlannedReplay | undefined {
    if (!hasHeader(plan.request, AUTHORIZATION)) return undefined;
    return {
        ...plan,
        request: withoutHeaders(plan.request, [AUTHORIZATION]),
    };
}

// D18: another organization's path in place of Stark's, or
// another seeded Stark identity in place of the path's. A
// membership id's owner half follows the owner, so the name
// stays the path's own and the fence, not the name, answers.
function onForeignPath(
    plan: PlannedReplay,
    cast: Cast,
): PlannedReplay | undefined {
    const target = targetOf(plan.request);
    const owner = target.segments[OWNER_INDEX];
    if (owner === undefined || owner === '') return undefined;
    const nest = target.segments[0];
    let foreign: string;
    switch (nest) {
        case ORGANIZATIONS:
            foreign = ORGANIZATION_TWO;
            break;
        case IDENTITIES:
            foreign = otherIdentityOf(owner, cast);
            break;
        default:
            return undefined;
    }
    const segments = [...target.segments];
    segments[OWNER_INDEX] = foreign;
    const at = routeOf(plan).segments.indexOf(MEMBERSHIP_ID);
    if (at >= 0) {
        segments[at] = membershipOwnedBy(
            nest, heldSegment(segments, at, plan), foreign,
        );
    }
    return {
        ...plan,
        request: {
            ...plan.request,
            target: joined({ ...target, segments }),
        },
    };
}

// Another seeded Stark identity than the one the path names:
// the story member's, or, where the path names the story
// member, the organization admin's. The path names the
// caller's own identity, or a service the setup created.
function otherIdentityOf(held: string, cast: Cast): string {
    return held === cast.member.identityId
        ? cast.admin.identityId
        : cast.member.identityId;
}

// D19: the last path parameter, well formed and never
// written. The path owner is foreign-path's to provoke, so a
// route whose only parameter is its owner has no id here.
function atUnknownId(plan: PlannedReplay): PlannedReplay | undefined {
    const row = routeOf(plan);
    const at = row.segments.findLastIndex(
        (segment) => segment.startsWith(':'),
    );
    if (at <= OWNER_INDEX) return undefined;
    const target = targetOf(plan.request);
    const segments = [...target.segments];
    if (plan.latch.kind === 'etag-segment') {
        segments.push(UNWRITTEN_ID);
    } else {
        const held = heldSegment(segments, at, plan);
        segments[at] = row.segments[at] === MEMBERSHIP_ID
            ? unknownMembershipOf(target.segments[0], held)
            : UNWRITTEN_ID;
    }
    return {
        ...plan,
        latch: plan.latch.kind === 'etag-segment'
            ? UNLATCHED
            : plan.latch,
        request: {
            ...plan.request,
            target: joined({ ...target, segments }),
        },
    };
}

// A membership name the path's nest admits: the path owner's
// half kept, the other half never written.
function unknownMembershipOf(
    nest: string | undefined,
    held: string,
): string {
    const name = membershipNameAt(held);
    return nest === ORGANIZATIONS
        ? membershipNameOf(name.organizationId, UNWRITTEN_ID)
        : membershipNameOf(UNWRITTEN_ID, name.identityId);
}

// The membership name with the nest's owner half replaced.
function membershipOwnedBy(
    nest: string | undefined,
    held: string,
    owner: string,
): string {
    const name = membershipNameAt(held);
    return nest === ORGANIZATIONS
        ? membershipNameOf(owner, name.identityId)
        : membershipNameOf(name.organizationId, owner);
}

function membershipNameAt(held: string): MembershipName {
    const name = parsedMembershipName(held);
    if (name === undefined) {
        throw new Error('not a membership name: ' + held);
    }
    return name;
}

function heldSegment(
    segments: readonly string[],
    at: number,
    plan: PlannedReplay,
): string {
    const held = segments[at];
    if (held === undefined) {
        throw new Error('no segment ' + at + ' in '
            + plan.request.target);
    }
    return held;
}

function conditionalOfPlan(plan: PlannedReplay): Conditional {
    const method = WRITE_METHODS[plan.request.method];
    if (method === undefined) return 'none';
    return conditionalOf(routePatternOf(routeOf(plan)), method);
}

function withStaleIfMatch(
    plan: PlannedReplay,
): PlannedReplay | undefined {
    if (conditionalOfPlan(plan) === 'none') return undefined;
    return {
        ...plan,
        latch: UNLATCHED,
        request: withHeader(
            withoutHeaders(plan.request, [IF_NONE_MATCH]),
            IF_MATCH,
            STALE_VALIDATOR,
        ),
    };
}

function withoutPrecondition(
    plan: PlannedReplay,
): PlannedReplay | undefined {
    const carries = plan.latch.kind === 'if-match'
        || hasHeader(plan.request, IF_MATCH)
        || hasHeader(plan.request, IF_NONE_MATCH);
    if (!carries) return undefined;
    return {
        ...plan,
        latch: UNLATCHED,
        request: withoutHeaders(
            plan.request, [IF_MATCH, IF_NONE_MATCH],
        ),
    };
}

// A `{` body where the method carries one; else, on a route
// that judges its query, a state no judge accepts.
function malformed(plan: PlannedReplay): PlannedReplay | undefined {
    if (BODY_METHODS.has(plan.request.method)) {
        return {
            ...plan,
            request: { ...plan.request, body: MALFORMED_BODY },
        };
    }
    if (routeOf(plan).query === undefined) return undefined;
    const target = targetOf(plan.request);
    return {
        ...plan,
        request: {
            ...plan.request,
            target: joined({ ...target, search: BOGUS_STATE }),
        },
    };
}

function withWrongMediaType(
    plan: PlannedReplay,
): PlannedReplay | undefined {
    if (plan.request.method !== 'QUERY') return undefined;
    return {
        ...plan,
        request: withHeader(
            plan.request, CONTENT_TYPE, WRONG_MEDIA_TYPE,
        ),
    };
}
