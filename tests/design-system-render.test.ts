import {
    assertStrictEquals,
    assertStringIncludes,
} from '@std/assert';
import { sha256Hex } from '../shared/digest.ts';
import { computeEdgeLabelWidth } from '../web-app/app/flow-graph.ts';
import { buildDesignSystemPage }
    from '../web-app/design-system/index.ts';

// Pins the showcase render byte-exact through the F-023
// de-splice. Paint edits move this fingerprint on purpose;
// an accidental splice still fails the pin.
Deno.test('design-system render is byte-stable',
async () => {
    const rendered = buildDesignSystemPage().toString();
    const digest = await sha256Hex(rendered);
    assertStrictEquals(rendered.length, 58295);
    assertStrictEquals(
        digest,
        '5aa456c0c7186974d5f1a13294eaa172666c52ff'
        + 'a12f857f9ef4f30d4a330a06',
    );
});

Deno.test('the showcase boxes each edge label as the designer does',
() => {
    const rendered = buildDesignSystemPage().toString();
    for (const label of ['submit', 'needs revision', 'approve']) {
        const textAt = rendered.indexOf(`>${label}</text>`);
        const rectAt = rendered.lastIndexOf('<rect', textAt);
        const rect = rendered.slice(
            rectAt, rendered.indexOf('/>', rectAt));
        assertStringIncludes(
            rect, ` width="${computeEdgeLabelWidth(label)}"`);
    }
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

Deno.test('the showcase shows the status history tokens',
() => {
    const rendered = buildDesignSystemPage().toString();
    assertStringIncludes(rendered, '<p class="text-xsm">');
    assertStringIncludes(
        rendered,
        'color-swatch-block bg-soft-foreground',
    );
    assertStringIncludes(
        rendered, '--soft-foreground</code>',
    );
    const css = Deno.readTextFileSync(
        'web-app/app/styles/pages-design-system.css',
    );
    assertStringIncludes(
        css,
        '.bg-soft-foreground {\n'
        + '    background-color:'
        + ' hsl(var(--soft-foreground));\n}',
    );
});
