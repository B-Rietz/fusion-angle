import {
    assertStrictEquals,
    assertStringIncludes,
} from '@std/assert';
import { sha256Hex } from '../shared/digest.ts';
import { buildDesignSystemPage }
    from '../web-app/design-system/index.ts';

// Pins the showcase render byte-exact through the F-023
// de-splice. Paint edits move this fingerprint on purpose;
// an accidental splice still fails the pin.
Deno.test('design-system render is byte-stable',
async () => {
    const rendered = buildDesignSystemPage().toString();
    const digest = await sha256Hex(rendered);
    assertStrictEquals(rendered.length, 57850);
    assertStrictEquals(
        digest,
        '7a1dceeddb192f88b49f168cf32d380b9de40ea5'
        + '034d8ec1e4b8ca2f3a809ffe',
    );
});

Deno.test('the showcase shows the organization screens',
() => {
    const rendered = buildDesignSystemPage().toString();
    assertStringIncludes(
        rendered, 'data-switch-organization-btn');
    assertStringIncludes(
        rendered, 'This page is in Wayne Enterprises');
    assertStringIncludes(
        rendered, "You don't have access to this page");
});
