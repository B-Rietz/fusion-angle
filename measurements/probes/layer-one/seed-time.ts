// seededMockDb() alone in one process: one unmeasured seed,
// then RUNS timed ones. Runs against any checkout or
// snapshot that has tests/mock-seed.ts, so one script times
// the seed across history:
//
//   deno run --frozen --no-check --allow-env --allow-read \
//       --config deno.json \
//       measurements/probes/layer-one/seed-time.ts file://$PWD 7

const [root, runsText] = Deno.args;
if (root === undefined) {
    throw new Error('usage: seed-time.ts ROOT [RUNS]');
}
const RUNS = Number(runsText ?? '7');

await import(root + '/tests/hmac-test-key.ts');
const { seededMockDb } = await import(root + '/tests/mock-seed.ts');

const coldStarted = performance.now();
await seededMockDb();
const coldMs = performance.now() - coldStarted;

const times: number[] = [];
for (let run = 0; run < RUNS; run++) {
    const started = performance.now();
    await seededMockDb();
    times.push(performance.now() - started);
}
times.sort((left, right) => left - right);

console.log(JSON.stringify({
    coldMs: Math.round(coldMs),
    minMs: Math.round(times[0]!),
    medianMs: Math.round(times[Math.floor(RUNS / 2)]!),
    maxMs: Math.round(times[RUNS - 1]!),
}));
