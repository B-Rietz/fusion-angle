import { assertEquals } from '@std/assert';
import {
    ASSERTION_ALGORITHMS,
    ASSERTION_CLAIMS,
} from '../api/client-assertion.ts';
import { authParam } from '../client/authentication.ts';
import { bytesToBase64Url } from '../shared/base64url.ts';
import { sha256Bytes } from '../shared/digest.ts';
import { isIdentifier } from '../shared/identifier.ts';
import type {
    ApiDocExchange,
    ApiDocHeaderLine,
    ApiDocSample,
} from '../web-app/api-documentation/shapes.ts';
import { readSample } from '../web-app/api-documentation/shapes.ts';
import {
    GENERIC_ANSWERS,
} from '../web-app/app/api-documentation-answers.ts';
import {
    credentialFindingsOf,
} from '../web-app/app/api-documentation-credentials.ts';
import {
    CURL_ADDS,
    SecretLedger,
} from '../web-app/app/api-documentation-exchange.ts';
import {
    replayStep,
    STEPS,
    type StepPlan,
} from '../web-app/app/api-documentation-guided-start.ts';
import {
    TRANSPORT_HEADERS,
} from '../web-app/app/api-documentation-headers.ts';
import {
    openReplayStage,
    type RecordedResponse,
} from '../web-app/app/api-documentation-replay.ts';
import { castOf } from '../web-app/app/api-documentation-story.ts';

// Every assertion on a credential compares a boolean or a
// finding (a kind and an offset), so a failure never
// prints one.

const SLUGS = [
    'sign-in', 'operation-id', 'read', 'list', 'change', 'unattended',
];
// RFC 9110 §15.3: the successful class is 2xx.
const SUCCESSFUL_FROM = 200;
const SUCCESSFUL_BELOW = 300;
const ETAG = 'etag';
const IF_MATCH = 'if-match';
const OPERATION_ID = 'operation-id';
// What the HTTP layer sets on the wire (plan D5).
const FRAMING = ['content-length', 'date'];

// A curl that prints the body it was handed, then a
// newline, and sends nothing.
const CURL_STUB = 'curl() { while [ "$#" -gt 0 ]; do'
    + ' if [ "$1" = -d ]; then printf \'%s\\n\' "$2"; fi;'
    + ' shift; done; }';
// What a reader sets before the curl text runs.
const CURL_PRELUDE = [
    'ORIGIN=http://localhost',
    'USERNAME=reader',
    'PASSWORD=reader-password',
];
const JWK_X = 'reader-x-coordinate';
const JWK_Y = 'reader-y-coordinate';

function fieldOf(value: unknown, name: string): unknown {
    return typeof value === 'object' && value !== null
        ? Object.getOwnPropertyDescriptor(value, name)?.value
        : undefined;
}

function stepOf(slug: string): StepPlan {
    const step = STEPS.find((candidate) => candidate.slug === slug);
    if (step === undefined) throw new Error('no step ' + slug);
    return step;
}

// The shell line of a step that sets `variable`.
function lineSetting(slug: string, variable: string): string {
    const line = stepOf(slug).shell.find(
        (candidate) => candidate.startsWith(variable + '='),
    );
    if (line === undefined) {
        throw new Error(slug + ' sets no ' + variable);
    }
    return line;
}

// Runs the lines through sh with `stdin`, then prints the
// variables, space-separated.
async function shellOf(
    lines: readonly string[],
    variables: readonly string[],
    stdin: string,
): Promise<string> {
    const printed = 'printf "%s" '
        + variables.map((name) => '"$' + name + '"').join(' " " ');
    const child = new Deno.Command('sh', {
        args: ['-c', [...lines, printed].join('\n')],
        stdin: 'piped',
        stdout: 'piped',
        stderr: 'piped',
    }).spawn();
    const writer = child.stdin.getWriter();
    await writer.write(new TextEncoder().encode(stdin));
    await writer.close();
    const output = await child.output();
    if (!output.success) {
        throw new Error('sh exited ' + output.code);
    }
    return new TextDecoder().decode(output.stdout);
}

// What curl -i prints: the status line, the headers, and
// the body.
function curlOutputOf(
    status: number,
    headers: readonly ApiDocHeaderLine[],
    body: string,
): string {
    return ['HTTP/1.1 ' + status, ...headers.map(
        ([name, value]) => name + ': ' + value,
    )].join('\r\n') + '\r\n\r\n' + body;
}

function responseCurlOutputOf(response: RecordedResponse): string {
    return curlOutputOf(response.status, response.headers, response.body);
}

function headerOf(
    headers: readonly ApiDocHeaderLine[],
    name: string,
): string {
    const line = headers.find(([held]) => held === name);
    if (line === undefined) throw new Error('no ' + name);
    return line[1];
}

function isSuccessful(exchange: ApiDocExchange): boolean {
    const { status } = exchange.response;
    return status >= SUCCESSFUL_FROM && status < SUCCESSFUL_BELOW;
}

function textOf(exchange: ApiDocExchange): string {
    const { body } = exchange.response;
    if (body.kind !== 'text') throw new Error('no text body');
    return body.text;
}

Deno.test('the steps are the six the spec names', () => {
    assertEquals(STEPS.map(({ slug }) => slug), SLUGS);
});

// The catalog holds the transport headers, the headers
// curl adds, and the answers any request may get, each
// once and as its own constant. Step 2's prose repeats
// none of them: it keeps the framing, which no constant
// holds.
Deno.test('step 2 states the framing and leaves its three tables'
    + ' to the catalog', () => {
    const prose = stepOf('operation-id').prose.join('\n');
    for (const framing of FRAMING) {
        assertEquals(prose.includes(framing), true, framing);
    }
    const tabled = [
        ...TRANSPORT_HEADERS.flatMap(
            (set) => set.headers.map((header) => header.name),
        ),
        ...CURL_ADDS,
    ].filter((name) => !FRAMING.includes(name));
    for (const name of tabled) {
        assertEquals(prose.includes(name), false, name);
    }
    for (const { when } of TRANSPORT_HEADERS) {
        if (when === '') continue;
        assertEquals(prose.includes(when), false, when);
    }
    for (const { line } of GENERIC_ANSWERS) {
        assertEquals(prose.includes(line), false, line);
    }
});

Deno.test('step 6 lists the algorithms and the claims', () => {
    const prose = stepOf('unattended').prose.join('\n');
    assertEquals(prose.includes('organization admin'), true);
    for (const algorithm of ASSERTION_ALGORITHMS) {
        assertEquals(prose.includes(algorithm), true, algorithm);
    }
    for (const { name, rule } of ASSERTION_CLAIMS) {
        assertEquals(prose.includes(name + ' ('), true, name);
        assertEquals(prose.includes(rule), true, rule);
    }
});

Deno.test('the OPERATION_ID line mints an identifier', async () => {
    const minted = await shellOf(
        [lineSetting('operation-id', 'OPERATION_ID')],
        ['OPERATION_ID'], '',
    );
    assertEquals(isIdentifier(minted), true, minted);
});

Deno.test('the sign-in lines sign the member in', async () => {
    const [verifier, challenge] = (await shellOf(
        [
            lineSetting('sign-in', 'VERIFIER'),
            lineSetting('sign-in', 'CHALLENGE'),
        ],
        ['VERIFIER', 'CHALLENGE'], '',
    )).split(' ');
    if (verifier === undefined || challenge === undefined) {
        throw new Error('the lines printed no pair');
    }
    assertEquals(
        challenge === bytesToBase64Url(await sha256Bytes(verifier)),
        true,
    );
    const stage = await openReplayStage();
    const cast = await castOf(stage);
    const seeded = stage.credentials.identities.find(
        (identity) => identity.identityId === cast.member.identityId,
    );
    if (seeded === undefined) throw new Error('no member sign-in');
    const signedIn = await stage.signIn(
        stage.copy(), seeded.username, seeded.password, verifier,
    );
    const [authorized, granted] = signedIn.exchanges;
    if (authorized === undefined || granted === undefined) {
        throw new Error('the sign-in made no two calls');
    }
    const code = authParam(
        headerOf(authorized.response.headers, 'authentication-info'),
        'code',
    );
    assertEquals(code === null, false);
    const readCode = await shellOf(
        [lineSetting('sign-in', 'CODE')], ['CODE'],
        responseCurlOutputOf(authorized.response),
    );
    assertEquals(readCode === code, true);
    const readToken = await shellOf(
        [lineSetting('sign-in', 'TOKEN')], ['TOKEN'],
        responseCurlOutputOf(granted.response),
    );
    assertEquals(readToken === signedIn.bearer, true);
});

Deno.test('each step replays a sample that reads back', async () => {
    const stage = await openReplayStage();
    const cast = await castOf(stage);
    const ledger = new SecretLedger();
    const samples = new Map<string, ApiDocSample>();
    for (const { slug } of STEPS) {
        const sample = await replayStep(slug, cast, stage, ledger);
        const json = JSON.stringify(sample);
        const read = readSample(JSON.parse(json));
        assertEquals(read.kind, 'sample', slug);
        assertEquals(sample.hash, 'start/' + slug);
        for (const exchange of sample.exchanges) {
            assertEquals(isSuccessful(exchange), true, slug);
        }
        samples.set(slug, sample);
    }
    const json = JSON.stringify([...samples.values()]);
    assertEquals(credentialFindingsOf(json, ledger.known()), []);
    assertEquals(
        credentialFindingsOf(json, [
            ...cast.member.secrets, ...cast.admin.secrets,
        ]),
        [],
    );
    const callers = (slug: string) =>
        samples.get(slug)!.exchanges.map(({ caller }) => caller);
    assertEquals(callers('sign-in'), ['none', 'none']);
    for (const slug of ['operation-id', 'read', 'list']) {
        assertEquals(callers(slug), ['member'], slug);
    }
    assertEquals(callers('change'), ['member', 'member']);
    assertEquals(callers('unattended'), ['admin', 'admin', 'none']);
});

Deno.test('step 3 reads the organization step 2 names', async () => {
    const stage = await openReplayStage();
    const cast = await castOf(stage);
    const ledger = new SecretLedger();
    const named = await replayStep('operation-id', cast, stage, ledger);
    const read = await replayStep('read', cast, stage, ledger);
    const [answer] = named.exchanges;
    const [organization] = read.exchanges;
    if (answer === undefined || organization === undefined) {
        throw new Error('a step made no call');
    }
    const body: unknown = JSON.parse(textOf(answer));
    const organizationId = typeof body === 'object' && body !== null
        ? Object.getOwnPropertyDescriptor(body, 'organization_id')?.value
        : undefined;
    assertEquals(typeof organizationId, 'string');
    assertEquals(
        organization.request.target,
        '/api/organizations/' + String(organizationId),
    );
});

Deno.test('step 5 writes back what it read under its etag',
    async () => {
        const stage = await openReplayStage();
        const cast = await castOf(stage);
        const sample = await replayStep(
            'change', cast, stage, new SecretLedger(),
        );
        const [read, write] = sample.exchanges;
        if (read === undefined || write === undefined) {
            throw new Error('the step made no two calls');
        }
        assertEquals(read.request.method, 'GET');
        assertEquals(write.request.method, 'PUT');
        assertEquals(write.request.target, read.request.target);
        const etag = headerOf(read.response.headers, ETAG);
        assertEquals(headerOf(write.request.headers, IF_MATCH), etag);
        assertEquals(headerOf(write.response.headers, ETAG) === etag, false);
        // The write carries its Operation-ID back; the read
        // names the write that made the flow.
        assertEquals(
            headerOf(write.response.headers, OPERATION_ID),
            headerOf(write.request.headers, OPERATION_ID),
        );
        assertEquals(
            headerOf(read.response.headers, OPERATION_ID)
                === headerOf(read.request.headers, OPERATION_ID),
            false,
        );
        const sent: unknown = JSON.parse(
            write.request.body.kind === 'text' ? write.request.body.text : '',
        );
        const held: unknown = JSON.parse(textOf(read));
        assertEquals(
            sent,
            {
                ...held as Record<string, unknown>,
                name: (held as Record<string, unknown>)['name'] + ' (draft)',
            },
        );
        const readEtag = await shellOf(
            [lineSetting('change', 'ETAG')], ['ETAG'],
            curlOutputOf(
                read.response.status, read.response.headers, textOf(read),
            ),
        );
        assertEquals(readEtag, etag);
    });

Deno.test('step 6 shows its key and assertion as placeholders',
    async () => {
        const stage = await openReplayStage();
        const cast = await castOf(stage);
        const ledger = new SecretLedger();
        const sample = await replayStep(
            'unattended', cast, stage, ledger,
        );
        const json = JSON.stringify(sample);
        for (const placeholder of [
            '$JWK_X', '$JWK_Y', '$CLIENT_ASSERTION', '$TOKEN',
        ]) {
            assertEquals(json.includes(placeholder), true, placeholder);
        }
        const [, registered, exchanged] = sample.exchanges;
        if (registered === undefined || exchanged === undefined) {
            throw new Error('the step made no three calls');
        }
        assertEquals(registered.request.target.endsWith('/registration'),
            true);
        assertEquals(
            headerOf(exchanged.request.headers, 'authorization')
                === 'Bearer $CLIENT_ASSERTION',
            true,
        );
        assertEquals(credentialFindingsOf(json, ledger.known()), []);
        const sent = await shellOf(
            [CURL_STUB, ...CURL_PRELUDE, 'JWK_X=' + JWK_X, 'JWK_Y=' + JWK_Y,
                registered.curl],
            [], '',
        );
        const keySet: unknown = JSON.parse(String(fieldOf(
            JSON.parse(sent), 'jwks',
        )));
        const keys = fieldOf(keySet, 'keys');
        const [key] = Array.isArray(keys) ? keys : [];
        assertEquals(fieldOf(key, 'x'), JWK_X);
        assertEquals(fieldOf(key, 'y'), JWK_Y);
    });

Deno.test("step 1's curl text sends the challenge the shell made",
    async () => {
        const stage = await openReplayStage();
        const cast = await castOf(stage);
        const sample = await replayStep(
            'sign-in', cast, stage, new SecretLedger(),
        );
        const [authorize] = sample.exchanges;
        if (authorize === undefined) throw new Error('no first call');
        const output = await shellOf(
            [
                lineSetting('sign-in', 'VERIFIER'),
                lineSetting('sign-in', 'CHALLENGE'),
                CURL_STUB,
                ...CURL_PRELUDE,
                authorize.curl,
            ],
            ['CHALLENGE'], '',
        );
        const split = output.lastIndexOf('\n');
        const sent: unknown = JSON.parse(output.slice(0, split));
        const challenge = output.slice(split + 1);
        assertEquals(challenge.length > 0, true);
        assertEquals(fieldOf(sent, 'code_challenge') === challenge, true);
    });

// A shell variable a curl names: `$` then a name, never
// `$(`, the start of a command substitution.
const SHELL_VARIABLE = /\$([A-Z_][A-Z0-9_]*)/g;
// What the reader brings to step 1: their own sign-in, and
// the origin every curl names.
const READER_SETS = ['ORIGIN', 'USERNAME', 'PASSWORD'];

Deno.test("step 1's lines set every variable its curls send",
    async () => {
        const stage = await openReplayStage();
        const cast = await castOf(stage);
        const sample = await replayStep(
            'sign-in', cast, stage, new SecretLedger(),
        );
        const set = stepOf('sign-in').shell.map(
            (line) => line.slice(0, line.indexOf('=')),
        );
        const sent = new Set(sample.exchanges.flatMap(({ curl }) =>
            [...curl.matchAll(SHELL_VARIABLE)].map((match) => match[1]!)
        ));
        assertEquals(sent.size > 0, true);
        for (const name of sent) {
            assertEquals(
                set.includes(name) || READER_SETS.includes(name), true, name,
            );
        }
    });
