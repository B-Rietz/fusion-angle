import { assertEquals } from '@std/assert';
import { cssDeclaration } from './fixtures/css-declaration.ts';

// A switch disabled while its write is in flight looks
// disabled, as a disabled button and a disabled input do:
// dimmed, and offering no pointer.

const controls = Deno.readTextFileSync(
    'web-app/app/styles/components-controls.css',
);
const buttons = Deno.readTextFileSync(
    'web-app/app/styles/components-buttons.css',
);

Deno.test('a disabled switch dims as a disabled button does', () => {
    assertEquals(
        cssDeclaration(controls, '.switch:disabled', 'opacity'),
        cssDeclaration(buttons, '.btn:disabled', 'opacity'),
    );
});

Deno.test('a disabled switch offers no pointer', () => {
    assertEquals(
        cssDeclaration(controls, '.switch:disabled', 'cursor'),
        'not-allowed',
    );
});
