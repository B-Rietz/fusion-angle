// The generator's command-line entry. The pins load first,
// statically, and set the throwaway signing key, the day,
// the clock, and randomness; the generator and every
// product module load after them, by dynamic import.

import { installReplayPins } from './api-documentation-pins.ts';

await installReplayPins();
const { runCli } = await import('./generate-api-documentation.ts');
await runCli(Deno.args);
