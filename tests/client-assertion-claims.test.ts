import { assertEquals } from '@std/assert';
import {
    ASSERTION_ALGORITHMS,
    ASSERTION_CLAIMS,
    verifyClientAssertion,
} from '../api/client-assertion.ts';
import type {
    ClientRegistrationEntity,
} from '../shared/types.ts';
import {
    makeAssertionSigner,
} from './client-assertion-fixtures.ts';

// The claims and algorithms the guided start lists, held
// to the verifier that judges them.

const NOW = 1_700_000_000;
const CLIENT_ID = 'uYaHKbNeVUcsFjuooOjMew';
const AUDIENCE = 'fusion-angle';
const LIFETIME_SECONDS = 300;

function clientWith(jwks: string): ClientRegistrationEntity {
    return {
        id: CLIENT_ID,
        grant_types: 'client_credentials',
        redirect_uris: '',
        jwks,
        aud: AUDIENCE,
        status: 'active',
    };
}

// Every listed claim, each valid.
function everyClaim(): Record<string, unknown> {
    return {
        iss: CLIENT_ID,
        sub: CLIENT_ID,
        aud: AUDIENCE,
        exp: NOW + LIFETIME_SECONDS,
        nbf: NOW,
        jti: 'assert-1',
    };
}

// One value per claim that breaks its rule. That a jti is
// spent once is the grant's to hold, not the verifier's
// (api-authentication-token.test.ts, the same jti twice).
const VIOLATIONS: Readonly<Record<string, unknown>> = {
    iss: 'AnotherClientIdentifier',
    sub: 'AnotherClientIdentifier',
    aud: 'another-audience',
    exp: NOW - 1,
    nbf: NOW + LIFETIME_SECONDS,
    jti: 'not an id',
};

function without(name: string): Record<string, unknown> {
    const { [name]: _omitted, ...rest } = everyClaim();
    return rest;
}

async function validityOf(
    alg: 'RS256' | 'ES256',
    claims: Record<string, unknown>,
): Promise<boolean> {
    const signer = await makeAssertionSigner(alg);
    const verdict = await verifyClientAssertion(
        await signer.sign(claims), clientWith(signer.jwks), NOW,
    );
    return verdict.valid;
}

Deno.test('the listed algorithms are RS256 and ES256', () => {
    assertEquals(ASSERTION_ALGORITHMS, ['RS256', 'ES256']);
});

Deno.test('an assertion under each listed algorithm verifies',
    async () => {
        for (const alg of ASSERTION_ALGORITHMS) {
            if (alg !== 'RS256' && alg !== 'ES256') {
                throw new Error('no signer for ' + alg);
            }
            assertEquals(await validityOf(alg, everyClaim()), true, alg);
        }
    });

Deno.test('the listed claims are the ones the verifier reads', () => {
    assertEquals(
        ASSERTION_CLAIMS.map(({ name }) => name),
        ['iss', 'sub', 'aud', 'exp', 'nbf', 'jti'],
    );
    for (const claim of ASSERTION_CLAIMS) {
        assertEquals(claim.rule.length > 0, true, claim.name);
    }
});

Deno.test('an assertion without a required claim fails', async () => {
    const required = ASSERTION_CLAIMS.filter((claim) => claim.required);
    assertEquals(required.length > 0, true);
    for (const { name } of required) {
        assertEquals(await validityOf('ES256', without(name)), false, name);
    }
});

Deno.test('an assertion without an optional claim verifies',
    async () => {
        const optional = ASSERTION_CLAIMS
            .filter((claim) => !claim.required)
            .map(({ name }) => name);
        assertEquals(optional, ['nbf']);
        for (const name of optional) {
            assertEquals(
                await validityOf('ES256', without(name)), true, name,
            );
        }
    });

Deno.test('an assertion that breaks a claim\'s rule fails',
    async () => {
        for (const { name } of ASSERTION_CLAIMS) {
            assertEquals(name in VIOLATIONS, true, name);
            const claims = { ...everyClaim(), [name]: VIOLATIONS[name] };
            assertEquals(await validityOf('ES256', claims), false, name);
        }
    });
