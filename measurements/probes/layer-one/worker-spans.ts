// A fifth --preload for one profiling run of the memory
// suite. Every test file is a worker; this writes one JSON
// line per worker to FA_PROBE_SPANS: when the preloads began
// (the preload graph was loaded by then), when the first
// test began (the file's own graph was loaded and evaluated
// by then), and when the last test ended, each in
// milliseconds since the worker started.
//
//   FA_PROBE_SPANS=$TMPDIR/spans.jsonl deno test … \
//       --preload ./measurements/probes/layer-one/worker-spans.ts \
//       --parallel tests/*.test.ts

const log = Deno.env.get('FA_PROBE_SPANS');
if (log !== undefined) {
    const preloadMs = performance.now();
    let firstTestMs = -1;
    Deno.test.beforeAll(() => {
        firstTestMs = performance.now();
    });
    Deno.test.afterAll(() => {
        Deno.writeTextFileSync(log, JSON.stringify({
            kind: 'worker',
            file: Deno.mainModule.replace(/^.*\/tests\//, 'tests/'),
            preloadMs: Math.round(preloadMs),
            firstTestMs: Math.round(firstTestMs),
            endMs: Math.round(performance.now()),
        }) + '\n', { append: true });
    });
}

export {};
