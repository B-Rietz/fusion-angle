// A conditional PUT or PATCH names its head: If-Match carries
// the strong ETag. Not a credential — stored verbatim so two
// writes differing only in If-Match are different messages
// for replay identity.
export const IF_MATCH_HEADER = 'if-match';

export const IF_NONE_MATCH_HEADER = 'if-none-match';
