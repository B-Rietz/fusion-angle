// The response headers the product sets for a reader to
// use, each declared here once by its lower-case field
// name. The code that sets one takes its name from this
// declaration, and the API documentation marks each on the
// answers it shows.

import {
    OPERATION_ID_HEADER,
    REQUEST_ID_HEADER,
} from '../shared/message-id-fields.ts';

export const RESPONSE_HEADERS = {
    // The strong validator of the version answered; a
    // conditional write sends it back in If-Match.
    etag: 'etag',
    // When the version answered was written.
    lastModified: 'last-modified',
    // The document a POST created.
    location: 'location',
    // The path a part's own document answers at, in a
    // collection over several families.
    contentLocation: 'content-location',
    // The write that made the version answered.
    operationId: OPERATION_ID_HEADER,
    // This answer's own id, minted by the server.
    requestId: REQUEST_ID_HEADER,
} as const;
