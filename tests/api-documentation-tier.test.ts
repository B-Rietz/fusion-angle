import { assertEquals } from '@std/assert';
import { routes } from '../api/routes.ts';
import { routePatternOf } from '../api/route-surface.ts';
import { API_DOC_ROOMS } from '../web-app/api-documentation/rooms.ts';
import type {
    ApiDocTier,
} from '../web-app/api-documentation/shapes.ts';
import {
    API_DOC_TIER_LABELS,
} from '../web-app/api-documentation/shapes.ts';
import { svgOf } from '../web-app/app/generate-api-documentation.ts';
import {
    openReplayStage,
    type RecordedResponse,
    type ReplayRequest,
    type SignedIn,
} from '../web-app/app/api-documentation-replay.ts';
import {
    castOf,
    endpointsOf,
    planOf,
    sendPlan,
} from '../web-app/app/api-documentation-story.ts';
import {
    TIER_EXCEPTIONS,
    tierOf,
} from '../web-app/app/api-documentation-tier.ts';

const PII_PATTERN = 'identities/:id/pii';

function countOf(tier: ApiDocTier): number {
    return endpointsOf(routes).filter(
        ({ row, verb }) => tierOf(row, verb) === tier,
    ).length;
}

Deno.test('each tier counts its endpoints', () => {
    assertEquals(
        {
            member: countOf('member'),
            admin: countOf('admin'),
            none: countOf('none'),
        },
        { member: 98, admin: 31, none: 3 },
    );
});

Deno.test('a member reaches its own PII', () => {
    const pii = routes.find(
        (row) => routePatternOf(row) === PII_PATTERN,
    );
    if (pii === undefined) {
        throw new Error('no ' + PII_PATTERN + ' route');
    }
    assertEquals(
        (['get', 'put', 'delete'] as const).map(
            (verb) => tierOf(pii, verb),
        ),
        ['member', 'member', 'member'],
    );
});

Deno.test('the PII facet is the one tier exception', () => {
    assertEquals([...TIER_EXCEPTIONS.keys()], [PII_PATTERN]);
});

// The gate's two authorization refusals, as
// api/request-auth.ts words them: authorizeRequest's
// suffix, and authorizeIdentityPii's two messages. Any
// other answer, a 403 of the organization fence included,
// got past authorization.
const ROLE_REFUSAL_SUFFIX = ' requires a role this principal lacks';
const PII_REFUSALS: ReadonlySet<string> = new Set([
    'forbidden: an identity may read only its own pii',
    "forbidden: writing another identity's pii requires an"
        + ' admin role',
]);
const HTTP_FORBIDDEN = 403;
const AUTHORIZATION = 'authorization';
const BEARER_SCHEME = 'Bearer ';
const IDENTITIES = 'identities';
// '/api/identities/<id>/…' split on '/'.
const IDENTITY_ID_INDEX = 3;

function errorOf(response: RecordedResponse): string {
    const document: unknown = JSON.parse(response.body);
    if (
        typeof document !== 'object' || document === null
        || !('error' in document)
        || typeof document.error !== 'string'
    ) {
        throw new Error('a ' + response.status + ' names no error');
    }
    return document.error;
}

function isRefused(response: RecordedResponse): boolean {
    if (response.status !== HTTP_FORBIDDEN) return false;
    const error = errorOf(response);
    return error.endsWith(ROLE_REFUSAL_SUFFIX)
        || PII_REFUSALS.has(error);
}

// The answer as a failure names it: its status, and a
// 403's error. Never a header, so never a bearer.
function answerOf(response: RecordedResponse): string {
    return response.status === HTTP_FORBIDDEN
        ? response.status + ' ' + errorOf(response)
        : String(response.status);
}

// The request as `sender` sends it: its own bearer, and its
// own id in an `identities/:id` segment.
function sentBy(
    sender: SignedIn,
    ownsIdentitySegment: boolean,
): (request: ReplayRequest) => ReplayRequest {
    return (request) => {
        const segments = request.target.split('/');
        if (ownsIdentitySegment) {
            segments[IDENTITY_ID_INDEX] = sender.identityId;
        }
        return {
            ...request,
            target: segments.join('/'),
            headers: request.headers.map(([name, value]) =>
                name === AUTHORIZATION
                    ? [name, BEARER_SCHEME + sender.bearer]
                    : [name, value]
            ),
        };
    };
}

Deno.test('each tier agrees with who gets past authorization',
    async () => {
        const stage = await openReplayStage();
        const cast = await castOf(stage);
        const disagreements: string[] = [];
        for (const endpoint of endpointsOf(routes)) {
            const tier = tierOf(endpoint.row, endpoint.verb);
            if (tier === 'none') continue;
            const plan = await planOf(endpoint, cast, stage);
            if (plan.kind !== 'replay') {
                throw new Error(endpoint.hash + ': ' + plan.reason);
            }
            const ownsIdentitySegment =
                endpoint.row.segments[0] === IDENTITIES
                && endpoint.row.segments[1]?.startsWith(':') === true;
            const member = (await sendPlan(
                stage, plan, sentBy(cast.member, ownsIdentitySegment),
            )).response;
            const admin = (await sendPlan(
                stage, plan, sentBy(cast.admin, ownsIdentitySegment),
            )).response;
            const agrees = tier === 'member'
                ? !isRefused(member)
                : !isRefused(admin) && isRefused(member);
            if (!agrees) {
                disagreements.push(
                    endpoint.hash + ' (' + tier + '): member '
                        + answerOf(member) + '; organization admin '
                        + answerOf(admin),
                );
            }
        }
        assertEquals(disagreements, []);
    });

// A grid link: its shape, then the title that names it.
const GRID_LINK = new RegExp(
    '<a href="#([^"]+)" data-tier="([^"]+)">\\s*<(?:circle|polygon)'
        + ' [^>]*/>\\s*<title>([^<]*)</title>\\s*</a>',
    'g',
);
const LINK_OPEN = /<a href="#/g;
const EM_DASH_REFERENCE = '&#x2014;';

Deno.test('each grid link is named by its endpoint and its tier',
    () => {
        const svg = svgOf(routes);
        const links = [...svg.matchAll(GRID_LINK)];
        assertEquals(links.length, [...svg.matchAll(LINK_OPEN)].length);
        assertEquals(links.length, API_DOC_ROOMS.length);
        for (const [, hash, tier, name] of links) {
            const room = API_DOC_ROOMS.find(
                (candidate) => candidate.hash === hash,
            );
            if (room === undefined) throw new Error('no room ' + hash);
            assertEquals(tier, room.tier, hash);
            assertEquals(
                name,
                room.verb + ' ' + room.uri + ' ' + EM_DASH_REFERENCE + ' '
                    + API_DOC_TIER_LABELS[room.tier],
                hash,
            );
        }
    });
