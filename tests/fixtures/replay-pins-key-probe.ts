// Install the replay's pins under the operator's signing
// key and print one word: `replaced` when the pins set a
// throwaway key of 64 hex characters in its place, `kept`
// otherwise. It never prints a key.

import {
    installReplayPins,
} from '../../web-app/app/api-documentation-pins.ts';

const SIGNING_KEY_ENV = 'JWT_HMAC_SIGNING_KEY';
const THROWAWAY_KEY_SHAPE = /^[0-9a-f]{64}$/;

const operatorKey = Deno.env.get(SIGNING_KEY_ENV);
await installReplayPins();
const runKey = Deno.env.get(SIGNING_KEY_ENV);
console.log(
    runKey !== undefined
        && runKey !== operatorKey
        && THROWAWAY_KEY_SHAPE.test(runKey)
        ? 'replaced'
        : 'kept',
);
