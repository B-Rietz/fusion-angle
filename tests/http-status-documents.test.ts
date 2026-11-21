import {
    assertEquals,
    assertMatch,
    assertStrictEquals,
} from '@std/assert';
import { STATUS_DOCUMENTS } from
    '../api/http-status-documents.ts';

Deno.test('401 is the one invalid_token shape', () => {
    const row = STATUS_DOCUMENTS.find((d) => d.code === 401);
    assertEquals(row?.body, { error: 'invalid_token' });
});

Deno.test('codes are unique and sorted', () => {
    const codes = STATUS_DOCUMENTS.map((d) => d.code);
    assertEquals(codes, [...codes].sort((a, b) => a - b));
    assertStrictEquals(new Set(codes).size, codes.length);
});

Deno.test('410 is the one Gone shape', () => {
    const row = STATUS_DOCUMENTS.find((d) => d.code === 410);
    assertEquals(row?.body, { error: 'Gone: table/id' });
});

Deno.test('500 is the status route handed no commit', () => {
    const row = STATUS_DOCUMENTS.find((d) => d.code === 500);
    assertEquals(row?.body, { error: 'git sha unavailable' });
});

Deno.test('503 is the system status with postgres down', () => {
    const row = STATUS_DOCUMENTS.find((d) => d.code === 503);
    const body = row?.body as Record<string, unknown>;
    assertMatch(String(body['git-sha']), /^[0-9a-f]{40}$/);
    assertStrictEquals(body['up'], false);
    assertEquals(body['components'], { postgres: 'down' });
});
