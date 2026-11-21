import { assertEquals } from '@std/assert';
import { handleRequest } from '../api/api.ts';
import { memoryDbAdapter } from '../api/db-memory.ts';
import type { DbAdapter } from '../api/db.ts';
import { membershipNameOf } from '../shared/membership-name.ts';
import { apiRequest, invitationLatched } from './http-fixtures.ts';
import { seedPersonIdentity } from './identity-fixtures.ts';
import { seedSeat } from './root-admin-fixture.ts';
import { seedOrganizationDocument } from './test-fixtures.ts';
import { organizationToken } from './token-fixtures.ts';

// An invitee's PUT names its invitation by organization and
// identity. An organization that was never written holds no
// invitation, so the PUT answers as it does at a real
// organization that never invited the identity: the If-Match
// names no current invitation (412). A different answer would
// tell the caller which organization ids exist.

const AT = '2026-01-01T00:00:00.000000Z';
const EXPIRES_AT = '2099-12-31T00:00:00.000000Z';
const ANSWERED_AT = '2026-01-01T00:00:01.000000Z';
const STARK = 'AjdvjuECVZEgZoFajaIEkg';
const WAYNE = 'BBjWJsjYIDkTRKIIPrzWRw';
// A real organization that invites no one here.
const ACME = 'CCkXKtkZJElUSLJJQsaXSw';
// A well-formed organization id no write names.
const UNWRITTEN_ORGANIZATION = 'UnwrittenId0000000000A';
const TONY = 'XXZruirZyAOoRpNxaDnpSA';
const SARAH = 'toccYYkLEABmlbpHJalgtQ';
const HTTP_PRECONDITION_FAILED = 412;

async function seedWorld(): Promise<DbAdapter> {
    const db = memoryDbAdapter();
    await db.postSchemaCreation();
    await seedOrganizationDocument(db, STARK, 'Stark');
    await seedOrganizationDocument(db, WAYNE, 'Wayne');
    await seedOrganizationDocument(db, ACME, 'Acme');
    await seedSeat(db, WAYNE, TONY, 'admin', AT);
    await seedPersonIdentity(db, SARAH, {
        name: 'Sarah', email: 'sarah@x.com', phone: '', bio: '',
    });
    await seedSeat(db, STARK, SARAH, 'member', AT);
    const invited = await handleRequest(db, apiRequest({
        method: 'POST',
        path: '/organizations/' + WAYNE + '/invitations/',
        token: await organizationToken(TONY, WAYNE),
        body: { email: 'sarah@x.com', at: AT, expiresAt: EXPIRES_AT },
    }));
    assertEquals(invited.status, 201);
    return db;
}

// Sarah accepts the invitation at `organization` under the
// If-Match of her pending invitation from Wayne.
async function acceptedAt(
    db: DbAdapter,
    organization: string,
): Promise<{ readonly status: number; readonly error: unknown }> {
    const latched = await invitationLatched(db, apiRequest({
        method: 'PUT',
        path: '/identities/' + SARAH + '/invitations/'
            + membershipNameOf(WAYNE, SARAH),
        token: await organizationToken(SARAH, STARK),
        body: { state: 'accepted', at: ANSWERED_AT },
    }));
    const response = await handleRequest(db, new Request(
        latched.url.replace(
            membershipNameOf(WAYNE, SARAH),
            membershipNameOf(organization, SARAH),
        ),
        latched,
    ));
    const document: unknown = await response.json();
    return {
        status: response.status,
        error: typeof document === 'object' && document !== null
            && 'error' in document
            ? document.error
            : undefined,
    };
}

Deno.test('an invitation at a real organization that never'
    + ' invited answers 412', async () => {
    const db = await seedWorld();
    assertEquals(await acceptedAt(db, ACME), {
        status: HTTP_PRECONDITION_FAILED,
        error: 'If-Match does not match the current document at'
            + ' /invitations/' + membershipNameOf(ACME, SARAH),
    });
});

Deno.test('an invitation at an absent organization answers as'
    + ' an absent invitation does', async () => {
    const db = await seedWorld();
    assertEquals(await acceptedAt(db, UNWRITTEN_ORGANIZATION), {
        status: HTTP_PRECONDITION_FAILED,
        error: 'If-Match does not match the current document at'
            + ' /invitations/'
            + membershipNameOf(UNWRITTEN_ORGANIZATION, SARAH),
    });
});
