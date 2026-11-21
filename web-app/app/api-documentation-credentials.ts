// The documentation's credential guard (spec, The hard
// rule): nothing generated or committed carries a real
// credential. A credential position shows a named
// placeholder, and every file the generator writes or
// compares is searched for credential-shaped text before
// it lands. A finding names its kind and offset, never
// the text, so no message or log repeats a secret.

// Each role's shell variable (spec, Placeholders; plan
// D10).
export const PLACEHOLDERS: Readonly<Record<string, string>> = {
    origin: '$ORIGIN',
    token: '$TOKEN',
    operationId: '$OPERATION_ID',
    etag: '$ETAG',
    code: '$CODE',
    verifier: '$VERIFIER',
    challenge: '$CHALLENGE',
    username: '$USERNAME',
    password: '$PASSWORD',
    clientAssertion: '$CLIENT_ASSERTION',
    refreshToken: '$REFRESH_TOKEN',
    jwkX: '$JWK_X',
    jwkY: '$JWK_Y',
};

// The body fields that hold a secret, each with its
// placeholder. Enumerated from the gate validators a body
// passes on a credential, token, registration, or
// authentication route:
//
// - `secret`: validateIdentityCredentialEntity
//   (api/validators.ts), the PUT body of
//   identities/:id/credentials/:cid; the one key
//   CREDENTIAL_KEY_READ_ROLES (api/family-registry.ts)
//   withholds from every reader.
//
// None of the others holds one. Token documents
// (validateIdentityTokenEntity) carry jti and chain ids,
// not tokens. A registration (validateClientRegistration-
// Entity) carries the client's public JWKS. A provider
// link (validateIdentityProviderEntity) carries the
// provider's subject. The two authentication routes
// refuse every credential field in the body
// (AUTHORIZATION_BODY_FIELDS and refresh_token,
// api/authentication.ts): each rides the Authorization or
// Cookie line, which the credential header names cover.
// Their bodies keep grant_type, client_id, method,
// organization, and the PKCE challenge, whose placeholder
// is the `challenge` role above.
export const BODY_SECRET_FIELDS: Readonly<Record<string, string>> = {
    secret: '$SECRET',
};

export type CredentialKind = 'jwt' | 'phc' | 'known';

export interface CredentialFinding {
    readonly kind: CredentialKind;
    // An offset into the text; never the text.
    readonly at: number;
}

// A JWS or JWE in compact form: a base64url JSON header,
// which always opens `eyJ` (`{"`), then dot-separated
// base64url segments. The last may be empty (alg none).
const JWT_SHAPE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g;

// A PHC string, `$<id>$<params>$<salt>$<digest>`: the four
// fields shared/password-hash.ts parses before it
// dispatches on the id. Any id matches, so a hash under an
// algorithm added later is found too.
const PHC_SHAPE = /\$[a-z0-9-]+(?:\$[A-Za-z0-9+/.=,_-]+){3}/g;

// A shorter value means the wrong value was registered; a
// seeded password is 22 characters.
const MIN_KNOWN_SECRET_LENGTH = 16;

const KIND_ORDER: readonly CredentialKind[] = ['jwt', 'phc', 'known'];

// Every credential-shaped place in the text, by offset.
// `known` is the run's own secrets, each searched for
// verbatim.
export function credentialFindingsOf(
    text: string,
    known: readonly string[],
): readonly CredentialFinding[] {
    const findings: CredentialFinding[] = [];
    for (const match of text.matchAll(JWT_SHAPE)) {
        findings.push({ kind: 'jwt', at: match.index });
    }
    for (const match of text.matchAll(PHC_SHAPE)) {
        findings.push({ kind: 'phc', at: match.index });
    }
    for (const secret of known) {
        if (secret.length < MIN_KNOWN_SECRET_LENGTH) {
            throw new Error(
                'a known secret is shorter than '
                    + MIN_KNOWN_SECRET_LENGTH + ' characters',
            );
        }
        let at = text.indexOf(secret);
        while (at !== -1) {
            findings.push({ kind: 'known', at });
            at = text.indexOf(secret, at + 1);
        }
    }
    return findings.sort((a, b) => a.at - b.at
        || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
}
