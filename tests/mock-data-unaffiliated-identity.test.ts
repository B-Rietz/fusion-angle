import { assert, assertEquals, assertStrictEquals } from '@std/assert';
import { handleRequest } from '../api/api.ts';
import type { MemoryDbAdapter } from '../api/db-memory.ts';
import {
    membershipsOfIdentity,
} from '../api/memberships.ts';
import {
    deriveCredentialsFor,
    deriveIdentityPiiRows,
} from '../api/derive-identity-spine.ts';
import {
    deriveInvitations,
} from '../api/derive-invitations.ts';
import { bodyOf } from '../api/derive-documents.ts';
import {
    getIdentityInvitations,
    getInvitationOnIdentityNest,
} from '../api/invitations-domain.ts';
import {
    buildUnaffiliatedIdentity,
} from '../api/mock-data/members.ts';
import {
    MOCK_SEED_INVITATION_LIFETIME_DAYS,
    STARK_ORGANIZATION,
} from '../api/mock-data/seed-constants.ts';
import { now as seedDay } from '../api/mock-data/seed-kit.ts';
import { membershipNameOf } from
    '../shared/membership-name.ts';
import {
    MS_PER_DAY,
    nowUtc,
    resetClock,
    setClockForTest,
} from '../shared/types.ts';
import { apiRequest, invitationLatched } from './http-fixtures.ts';
import { seededMockDb, sharedMockDb } from './mock-seed.ts';
import { organizationToken } from './token-fixtures.ts';

// The zero-membership identity: TEST-PLAN B25–B29's
// fixture. These pin the WORLD the seed creates — the
// projection/gate logic is pinned elsewhere
// (boot-organization-gate, presenter-invitation-list,
// api-invitations-fence).

Deno.test('the seed yields a login-capable identity whose'
+ ' derived membership ledger is empty', async () => {
    const db = await sharedMockDb();
    const unaffiliated = buildUnaffiliatedIdentity();
    assertEquals(
        await membershipsOfIdentity(
            db, unaffiliated.id,
        ),
        [],
    );
    const credentials = await deriveCredentialsFor(
        db, unaffiliated.id,
    );
    assertStrictEquals(credentials.length, 1);
    assertStrictEquals(credentials[0]!.kind, 'password');
    const pii = (await deriveIdentityPiiRows(db)).find(
        (row) => row.id === unaffiliated.id,
    );
    assert(pii, 'unaffiliated identity has a PII row');
    assertStrictEquals(pii.email, 'riley.okafor@example.net');
});

Deno.test('the unaffiliated identity holds exactly one'
+ ' pending Stark invitation', async () => {
    const db = await sharedMockDb();
    const unaffiliated = buildUnaffiliatedIdentity();
    const mine = (await deriveInvitations(db)).filter(
        (row) => row.identity_id === unaffiliated.id,
    );
    assertStrictEquals(mine.length, 1);
    const invitation = mine[0]!;
    assertStrictEquals(
        invitation.organization_id, STARK_ORGANIZATION,
    );
    assertStrictEquals(invitation.state, 'pending');
    // The invitee's own read of the invitation's head agrees.
    const read = await getInvitationOnIdentityNest(
        db, [unaffiliated.id, invitation.id], unaffiliated.id,
        undefined, [],
    );
    assert(read.kind === 'document');
    assertStrictEquals(bodyOf(read.head.response)['state'], 'pending');
});

Deno.test('the invitee view omits the org name and the'
+ ' inviting admin', async () => {
    const db = await sharedMockDb();
    const unaffiliated = buildUnaffiliatedIdentity();
    const views = await getIdentityInvitations(
        db, [unaffiliated.id], unaffiliated.id,
        undefined, [],
    );
    assert(views.kind === 'collection');
    assertStrictEquals(views.heads.length, 1);
    const view = bodyOf(views.heads[0]!.response);
    assertStrictEquals(view['organization_name'], undefined);
    assertStrictEquals(view['invited_by_name'], undefined);
    assertStrictEquals(view['state'], 'pending');
});

// The seeded invitation follows the seed's day, as the
// rest of the seed does, and never a calendar date. It
// once expired at 2027-01-01: every seed made on a day
// less than a year before that held an invitation its
// invitee could not accept from that instant on, and
// every seed made after it held one already expired. The
// clock below sits most of a year past the seed's day,
// so past that date for any seed made from 2026 on.
const INVITEE = buildUnaffiliatedIdentity().id;
const INVITATION_PATH = '/identities/' + INVITEE + '/invitations/'
    + membershipNameOf(STARK_ORGANIZATION, INVITEE);
const LIFETIME_MS = MOCK_SEED_INVITATION_LIFETIME_DAYS * MS_PER_DAY;

// The invitee's accept of the seeded invitation, with the
// product clock at AT_MS. The clock steps on every read:
// a frozen one would spin nowUtc's same-millisecond
// sequence forever.
async function acceptedAt(
    db: MemoryDbAdapter,
    atMs: number,
): Promise<number> {
    let nextMs = atMs;
    setClockForTest(() => nextMs++);
    try {
        const response = await handleRequest(
            db,
            await invitationLatched(db, apiRequest({
                method: 'PUT',
                path: INVITATION_PATH,
                token: await organizationToken(
                    INVITEE, STARK_ORGANIZATION,
                ),
                body: { state: 'accepted', at: nowUtc() },
            })),
        );
        await response.body?.cancel();
        return response.status;
    } finally {
        resetClock();
    }
}

Deno.test('the seeded invitation is open until the lifetime'
+ ' the seed names has passed since the seed\'s day',
async () => {
    const day = seedDay.getTime();
    assertStrictEquals(
        await acceptedAt(
            await seededMockDb(), day + LIFETIME_MS - MS_PER_DAY,
        ),
        200,
    );
    assertStrictEquals(
        await acceptedAt(await seededMockDb(), day + LIFETIME_MS),
        409,
    );
});
