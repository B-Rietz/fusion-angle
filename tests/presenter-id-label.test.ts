import { assertEquals, assertStringIncludes } from '@std/assert';
import { idLabel } from '../web-app/app/presenters/id-label.ts';
import { cssDeclaration } from './fixtures/css-declaration.ts';

Deno.test('idLabel renders the thing and the whole id', () => {
    assertEquals(
        idLabel('Work order', 'wrVS6q_Zsd8ILhGFyG1-zg')
            .toString(),
        'Work order <code class="displayed-id">'
        + 'wrVS6q_Zsd8ILhGFyG1-zg</code>',
    );
});

Deno.test('idLabel escapes the id', () => {
    const out = idLabel('Token', '<x>').toString();
    assertStringIncludes(out, '&lt;x&gt;');
    assertEquals(out.includes('<x>'), false);
});

// A displayed id clips by CSS alone: the markup keeps the
// whole id for copy, search, and screen readers, and the
// rule draws the ellipsis.

const src = Deno.readTextFileSync(
    'web-app/app/styles/components-badges.css',
);

for (const [property, value] of [
    ['font-family', 'var(--font-mono)'],
    ['overflow', 'hidden'],
    ['text-overflow', 'ellipsis'],
    ['white-space', 'nowrap'],
    ['display', 'inline-block'],
    ['max-width', '100%'],
    ['font-weight', 'var(--font-weight-regular)'],
    ['letter-spacing', 'normal'],
] as const) {
    Deno.test(`a displayed id sets ${property}: ${value}`,
    () => {
        assertEquals(
            cssDeclaration(src, '.displayed-id', property),
            value,
        );
    });
}
