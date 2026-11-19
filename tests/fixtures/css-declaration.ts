// Read one declaration's value from a stylesheet's text —
// the shared voice for tests that pin a CSS rule. The rule
// is the block that opens with `selector {` on a line of
// its own, and the value is undefined when the rule holds
// no such property.

export function cssDeclaration(
    css: string,
    selector: string,
    property: string,
): string | undefined {
    const open = css.indexOf(`\n${selector} {\n`);
    const close = css.indexOf('\n}', open);
    const body = css.slice(open, close);
    const match = body.match(
        new RegExp(`^\\s*${property}: (.+);$`, 'm'),
    );
    return match?.[1];
}
