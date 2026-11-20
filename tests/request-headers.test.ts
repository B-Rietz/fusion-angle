import { assertEquals, assertStrictEquals } from '@std/assert';
import { REQUEST_HEADERS } from '../api/request-header-names.ts';
import { REQUEST_HEADER_DECLARATIONS } from '../api/request-headers.ts';
import { AUTHENTICATION_ROUTES } from '../api/request-auth.ts';
import { routePatternOf } from '../api/route-surface.ts';
import { routes } from '../api/routes.ts';
import { isAuthThrottlePath } from '../server/throttle.ts';

// The declarations copy each name and surface from
// REQUEST_HEADERS; the states are the only thing they add.

Deno.test(
    'the declarations are REQUEST_HEADERS, once each, in order',
    () => {
        assertEquals(
            REQUEST_HEADER_DECLARATIONS.map((declaration) => [
                declaration.name,
                declaration.surface,
            ]),
            Object.values(REQUEST_HEADERS).map((header) => [
                header.name,
                header.surface,
            ]),
        );
    },
);

// The proxy headers' states borrow AUTHENTICATION_ROUTES as
// the throttle's paths, because api/ cannot import server/.
Deno.test("the throttle's paths are the bearer-exempt routes", () => {
    for (const row of routes) {
        const routePattern = routePatternOf(row);

        assertStrictEquals(
            isAuthThrottlePath('/' + routePattern),
            AUTHENTICATION_ROUTES.has(routePattern),
            routePattern,
        );
    }
});
