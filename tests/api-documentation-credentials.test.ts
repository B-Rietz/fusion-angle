import { assertEquals, assertThrows } from '@std/assert';
import { join } from '@std/path';
import type {
    ApiDocSample,
} from '../web-app/api-documentation/shapes.ts';
import { readSample } from
    '../web-app/api-documentation/shapes.ts';
import {
    credentialFindingsOf,
} from '../web-app/app/api-documentation-credentials.ts';
import {
    type Catalog,
    guardCatalog,
    roomsTsOf,
} from '../web-app/app/generate-api-documentation.ts';
import { memoryDbAdapter } from '../api/db-memory.ts';
import { postMockDataLoad } from '../api/mock-data.ts';
import { testHashPassword } from './mock-seed.ts';

const PLANTED_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.c2ln';
const PLANTED_PHC = '$scrypt$ln=17,r=8,p=1$c2FsdA$aGFzaA';
const OUTPUT_ROOT = 'web-app/api-documentation';
const BIN_SCRIPT = 'bin/generate-api-documentation';
const MAIN_ENTRY = 'web-app/app/generate-api-documentation-main.ts';
const PINS_MODULE = 'web-app/app/api-documentation-pins.ts';
const KEY_PROBE = 'tests/fixtures/replay-pins-key-probe.ts';
const PROBE_TIMEOUT_MS = 60_000;
const FLOWS = '/api/organizations/stark/flows/';

// A sample whose request header and response body take the
// planted values, so each test plants into one place.
function sampleWith(
    headerValue: string,
    bodyText: string,
): ApiDocSample {
    return {
        hash: 'get/organizations/id/flows/id',
        pathIds: [
            { name: ':id', value: 'stark', source: '' },
            { name: ':id', value: 'assembly', source: '' },
        ],
        exchanges: [{
            caller: 'member',
            request: {
                method: 'GET',
                target: FLOWS + 'assembly',
                headers: [
                    ['authorization', headerValue],
                    ['operation-id', '$OPERATION_ID'],
                ],
                body: { kind: 'empty' },
            },
            response: {
                status: 200,
                headers: [
                    ['content-type', 'application/json'],
                    ['etag', '"v1"'],
                ],
                body: {
                    kind: 'text',
                    mediaType: 'application/json',
                    text: bodyText,
                },
            },
            curl: 'curl -i -X GET "$ORIGIN' + FLOWS + 'assembly"'
                + ' \\\n  -H "authorization: Bearer $TOKEN"',
        }],
    };
}

const CLEAN = sampleWith(
    'Bearer $TOKEN', '{\n  "title": "Assembly"\n}',
);

function kindsOf(text: string, known: readonly string[]): string[] {
    return credentialFindingsOf(text, known).map((f) => f.kind);
}

Deno.test('a planted JWT is found', () => {
    assertEquals(readSample(JSON.parse(JSON.stringify(CLEAN))).kind,
        'sample');
    assertEquals(kindsOf(JSON.stringify(CLEAN), []), []);
    const planted = sampleWith(
        'Bearer ' + PLANTED_JWT, '{\n  "title": "Assembly"\n}',
    );
    assertEquals(kindsOf(JSON.stringify(planted), []), ['jwt']);
});

Deno.test('a planted PHC string is found', () => {
    const planted = sampleWith(
        'Bearer $TOKEN', '{\n  "secret": "' + PLANTED_PHC + '"\n}',
    );
    assertEquals(kindsOf(JSON.stringify(planted), []), ['phc']);
});

Deno.test('a planted seeded password is found', async () => {
    const { identities } = await postMockDataLoad(
        memoryDbAdapter(), { hashPassword: testHashPassword },
    );
    const passwords = identities.map((i) => i.password);
    const planted = sampleWith(
        'Bearer $TOKEN',
        '{\n  "note": "' + identities[0]!.password + '"\n}',
    );
    // Only kinds reach the assertion, never the text.
    assertEquals(kindsOf(JSON.stringify(CLEAN), passwords), []);
    assertEquals(
        kindsOf(JSON.stringify(planted), passwords), ['known'],
    );
});

function filesUnder(root: string): string[] {
    const files: string[] = [];
    const names = [...Deno.readDirSync(root)]
        .map((entry) => entry.name)
        .sort();
    for (const name of names) {
        const path = join(root, name);
        if (Deno.statSync(path).isDirectory) {
            files.push(...filesUnder(path));
        } else {
            files.push(path);
        }
    }
    return files;
}

Deno.test('the committed tree carries no credential shape', () => {
    for (const path of filesUnder(OUTPUT_ROOT)) {
        assertEquals(
            kindsOf(Deno.readTextFileSync(path), []), [], path,
        );
    }
});

Deno.test('the generator sets its own signing key', async () => {
    const result = await new Deno.Command('deno', {
        args: [
            'run', '--frozen', '--allow-read',
            '--allow-env=JWT_HMAC_SIGNING_KEY', KEY_PROBE,
        ],
        env: { JWT_HMAC_SIGNING_KEY: 'operator-key-sentinel' },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    }).output();
    const decoder = new TextDecoder();
    assertEquals(
        result.code, 0, decoder.decode(result.stderr),
    );
    assertEquals(decoder.decode(result.stdout), 'replaced\n');
});

Deno.test('the generator may read only its own key', () => {
    const script = Deno.readTextFileSync(BIN_SCRIPT);
    assertEquals(
        script.match(/--allow-env\S*/g),
        ['--allow-env=JWT_HMAC_SIGNING_KEY'],
    );
    assertEquals(script.includes('POSTGRES_URL'), false);
    assertEquals(
        script.includes('generate-api-documentation-main.ts'),
        true,
    );
});

// Every specifier a module imports statically: each
// statement that begins a line with `import `, through
// its quoted specifier.
function staticImportsOf(path: string): string[] {
    const text = Deno.readTextFileSync(path);
    return [...text.matchAll(
        /^import\s(?:[^'"]*?\sfrom\s)?['"]([^'"]+)['"]/gm,
    )].map((match) => match[1]!);
}

Deno.test('pins load before product code', () => {
    assertEquals(
        staticImportsOf(MAIN_ENTRY),
        ['./api-documentation-pins.ts'],
    );
    assertEquals(
        staticImportsOf(PINS_MODULE), ['@std/testing/time'],
    );
});

// Longer than a line of rooms.ts, so a fold must cut it.
const OVER_A_LINE = 'A'.repeat(80);
const LONG_JWT = ['eyJ' + OVER_A_LINE, OVER_A_LINE, OVER_A_LINE].join('.');
const LONG_PHC = ['', 'scrypt', OVER_A_LINE, OVER_A_LINE, OVER_A_LINE]
    .join('$');
const LONG_SECRET = 'known-secret-'.repeat(8);

// A catalog whose one answer line takes the planted text.
function catalogWith(line: string): Catalog {
    return {
        rooms: [],
        statuses: [],
        steps: [],
        transport: [],
        genericAnswers: [{ code: '400', line }],
        curlAdds: [],
    };
}

Deno.test('the catalog is guarded before rooms.ts folds it', () => {
    const plants = [
        { planted: LONG_JWT, known: [], kind: 'jwt' },
        { planted: LONG_PHC, known: [], kind: 'phc' },
        { planted: LONG_SECRET, known: [LONG_SECRET], kind: 'known' },
    ];
    for (const { planted, known, kind } of plants) {
        const catalog = catalogWith('Send ' + planted + ' again.');
        // The fold cuts it, so rooms.ts as written hides it.
        assertEquals(kindsOf(roomsTsOf(catalog), known), [], kind);
        // The refusal names the file and the kind, never the
        // text.
        const refusal = assertThrows(
            () => guardCatalog(catalog, known), Error,
        );
        assertEquals(
            refusal.message,
            'credential-shaped text in rooms.ts (' + kind + ')',
        );
    }
    guardCatalog(catalogWith('Send it again.'), [LONG_SECRET]);
});
