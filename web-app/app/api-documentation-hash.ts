export function roomPathOf(
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
    return parts.join('/') + '/index.html';
}

export function roomHashOf(
    verb: string,
    segments: readonly string[],
): string {
    const path = roomPathOf(verb, segments);
    const suffix = '/index.html';
    if (path.endsWith(suffix)) {
        return path.slice(0, -suffix.length);
    }
    return path;
}
