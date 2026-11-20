import { assertEquals } from '@std/assert';
import {
    resolveOrganizationMismatch,
    resolvePageArrival,
    stampOrganization,
} from '../web-app/app/organization-address.ts';

const STARK = 'AjdvjuECVZEgZoFajaIEkg';
const WAYNE = 'BBjWJsjYIDkTRKIIPrzWRw';
const FOREIGN = 'QQQQQQQQQQQQQQQQQQQQQQ';

Deno.test('an absent organization proceeds', () => {
    assertEquals(
        resolvePageArrival(null, STARK),
        { kind: 'proceed' },
    );
});

Deno.test('the active organization proceeds', () => {
    assertEquals(
        resolvePageArrival(STARK, STARK),
        { kind: 'proceed' },
    );
});

Deno.test('another organization is a mismatch', () => {
    assertEquals(
        resolvePageArrival(WAYNE, STARK),
        { kind: 'mismatch', organization: WAYNE },
    );
});

Deno.test('a reachable mismatch offers the switch', () => {
    assertEquals(
        resolveOrganizationMismatch(
            WAYNE, [STARK, WAYNE],
        ),
        'switch-offer',
    );
});

Deno.test('an unreachable mismatch has no access', () => {
    assertEquals(
        resolveOrganizationMismatch(
            FOREIGN, [STARK, WAYNE],
        ),
        'no-access',
    );
});

Deno.test('an empty organization has no access', () => {
    assertEquals(
        resolvePageArrival('', STARK),
        { kind: 'mismatch', organization: '' },
    );
    assertEquals(
        resolveOrganizationMismatch('', [STARK, WAYNE]),
        'no-access',
    );
});

Deno.test('a stamp adds the organization', () => {
    assertEquals(
        stampOrganization(
            'http://local/dashboard/index.html', STARK,
        ),
        '/dashboard/index.html?organization=' + STARK,
    );
});

Deno.test('a stamp keeps other parameters and the fragment', () => {
    assertEquals(
        stampOrganization(
            'http://local/flows/detail.html?flowId=F1#node',
            STARK,
        ),
        '/flows/detail.html?flowId=F1&organization=' +
            STARK + '#node',
    );
});

Deno.test('a stamp replaces a stale organization', () => {
    assertEquals(
        stampOrganization(
            'http://local/ideas/index.html?organization=' +
                WAYNE + '&x=1',
            STARK,
        ),
        '/ideas/index.html?organization=' + STARK + '&x=1',
    );
});

Deno.test('a stamp collapses duplicates', () => {
    assertEquals(
        stampOrganization(
            'http://local/ideas/index.html?organization=' +
                WAYNE + '&x=1&organization=' + FOREIGN,
            STARK,
        ),
        '/ideas/index.html?organization=' + STARK + '&x=1',
    );
});

Deno.test('a stamp keeps a doubled-slash address same-origin', () => {
    assertEquals(
        stampOrganization(
            'http://local//ideas/index.html?x=1', STARK,
        ),
        '/ideas/index.html?x=1&organization=' + STARK,
    );
});
