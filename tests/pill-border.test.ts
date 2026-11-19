import { assertEquals } from '@std/assert';
import { cssDeclaration } from './fixtures/css-declaration.ts';

// A pill sits beside state badges (the idea list's
// Incomplete pill next to Active), so it wears the
// badge's border: the same base line and, per tone, the
// same border color.

const src = Deno.readTextFileSync(
    'web-app/app/styles/components-badges.css',
);

Deno.test('a pill wears the badge border', () => {
    assertEquals(
        cssDeclaration(src, '.pill', 'border'),
        cssDeclaration(src, '.badge', 'border'),
    );
});

for (const tone of ['success', 'warning', 'error']) {
    Deno.test(`a ${tone} pill borders like a ${tone} badge`,
    () => {
        assertEquals(
            cssDeclaration(
                src, `.pill[data-tone="${tone}"]`,
                'border-color',
            ),
            cssDeclaration(
                src, `.badge-${tone}`, 'border-color',
            ),
        );
    });
}
