import {
    assert,
    assertMatch,
    assertNotMatch,
    assertStrictEquals,
} from '@std/assert';
import { fromFileUrl, join } from '@std/path';
import {
    FUSION_EVENTS_CHANNEL,
    PG_NOTIFY_PAYLOAD_MAX_BYTES,
    POOL_MAX,
    notifyPayload,
} from '../api/advisory-lock.ts';

Deno.test('lock and notify constants stay named', () => {
    assertStrictEquals(FUSION_EVENTS_CHANNEL, 'fusion_events');
    assertStrictEquals(PG_NOTIFY_PAYLOAD_MAX_BYTES, 8000);
    assertStrictEquals(POOL_MAX, 10);
});

Deno.test('notifyPayload emits full when over 8000 bytes',
() => {
    const small = {
        kind: 'scoped' as const,
        organizationIds: ['AjdvjuECVZEgZoFajaIEkg'],
        identityIds: ['XXZruirZyAOoRpNxaDnpSA'],
    };
    assertStrictEquals(
        notifyPayload(small),
        JSON.stringify(small),
    );
    const ids = [];
    for (let i = 0; i < 400; i++) {
        ids.push('organization-' + String(i).padStart(8, '0'));
    }
    const large = {
        kind: 'scoped' as const,
        organizationIds: ids,
        identityIds: [],
    };
    assert(
        new TextEncoder().encode(JSON.stringify(large))
            .length > PG_NOTIFY_PAYLOAD_MAX_BYTES,
    );
    assertStrictEquals(notifyPayload(large), '{"kind":"full"}');
});

const repoRoot = fromFileUrl(
    new URL('..', import.meta.url),
);

Deno.test('postgres notify is issued; server never LISTENs',
() => {
    const postgresPath = join(
        repoRoot, 'api/backend-postgres.ts',
    );
    const postgres = Deno.readTextFileSync(postgresPath);
    assertMatch(postgres, /pg_notify/);
    assertNotMatch(postgres, /\bLISTEN\b/);
    const serverDir = join(repoRoot, 'server');
    const files: string[] = [];
    const walk = (dir: string): void => {
        for (const entry of Deno.readDirSync(dir)) {
            const path = join(dir, entry.name);
            if (entry.isDirectory) {
                walk(path);
            } else if (entry.name.endsWith('.ts')) {
                files.push(path);
            }
        }
    };
    walk(serverDir);
    assert(files.length >= 8);
    for (const path of files) {
        const src = Deno.readTextFileSync(path);
        assertNotMatch(
            src,
            /\bLISTEN\b/,
            path + ' contains LISTEN',
        );
    }
});
