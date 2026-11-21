export function roomHashOf(
    verb: string,
    segments: readonly string[],
): string {
    const parts = [verb.toLowerCase()];
    for (const seg of segments) {
        if (seg === '') continue;
        parts.push(
            seg.startsWith(':') ? seg.slice(1) : seg,
        );
    }
    return parts.join('/');
}
