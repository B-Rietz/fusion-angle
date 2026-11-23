// Reads the JSON lines worker-spans.ts and seed-spans.patch
// wrote during one run of the memory suite and prints where
// the workers' time went: loading against testing, the
// seed's share, the longest workers, and the run's length
// replayed on SLOTS slots in file order, as `deno test
// --parallel` starts files, with the longest worker whole
// and then split into parts. SLOTS is the worker count to
// replay; the spec's replays used 16, 12, 8, and 4.
//
//   deno run --allow-read \
//       measurements/probes/layer-one/spans.ts \
//       $TMPDIR/spans.jsonl 16

const MS_PER_SECOND = 1000;
const LONGEST_SHOWN = 12;
const PARTS = [2, 3, 4];

type WorkerSpan = {
    readonly kind: 'worker',
    readonly file: string,
    readonly preloadMs: number,
    readonly firstTestMs: number,
    readonly endMs: number,
};
type SeedSpan = {
    readonly kind: 'seededMockDb' | 'rehearse' | 'landing',
    readonly file: string,
    readonly ms: number,
};
type Span = WorkerSpan | SeedSpan;

const USAGE = 'usage: spans.ts SPANS_JSONL SLOTS';
const [path, slots] = Deno.args;
if (path === undefined || slots === undefined) {
    throw new Error(USAGE);
}
if (!/^[1-9][0-9]*$/.test(slots)) {
    throw new Error(USAGE + ': SLOTS is a positive count');
}
const JOBS = Number(slots);
const spans: Span[] = Deno.readTextFileSync(path)
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line));

const workers = spans
    .filter((span): span is WorkerSpan => span.kind === 'worker')
    .sort((left, right) => left.file < right.file ? -1 : 1);
const seconds = (ms: number): string =>
    (ms / MS_PER_SECOND).toFixed(0) + ' s';
const sumOf = (values: readonly number[]): number =>
    values.reduce((sum, value) => sum + value, 0);

const loadMs = sumOf(workers.map((worker) => worker.firstTestMs));
const testMs = sumOf(workers.map(
    (worker) => worker.endMs - worker.firstTestMs,
));
console.log(`workers ${workers.length}`);
console.log(`load, summed ${seconds(loadMs)}`);
console.log(`tests, summed ${seconds(testMs)}`);

for (const kind of ['seededMockDb', 'rehearse', 'landing']) {
    const times = spans
        .filter((span): span is SeedSpan => span.kind === kind)
        .map((span) => span.ms)
        .sort((left, right) => left - right);
    if (times.length === 0) continue;
    console.log(
        `${kind} ${times.length} calls, summed`
        + ` ${seconds(sumOf(times))}, median`
        + ` ${times[Math.floor(times.length / 2)]} ms`,
    );
}

const seedsOf = new Map<string, number>();
for (const span of spans) {
    if (span.kind !== 'seededMockDb') continue;
    seedsOf.set(span.file, (seedsOf.get(span.file) ?? 0) + 1);
}
console.log(`files that seed ${seedsOf.size}`);
console.log('longest workers:');
const byLength = [...workers].sort(
    (left, right) => right.endMs - left.endMs,
);
for (const worker of byLength.slice(0, LONGEST_SHOWN)) {
    console.log(
        `  ${seconds(worker.endMs).padStart(6)}`
        + ` ${String(seedsOf.get(worker.file) ?? 0).padStart(3)}`
        + ` seeds  ${worker.file}`,
    );
}

// Each file takes the slot that frees first, in file order.
function replayedMs(durations: readonly number[]): number {
    const free: number[] = new Array(JOBS).fill(0);
    let end = 0;
    for (const duration of durations) {
        const slot = free.indexOf(Math.min(...free));
        free[slot] = free[slot]! + duration;
        end = Math.max(end, free[slot]!);
    }
    return end;
}

const longest = byLength[0]!;
const whole = workers.map((worker) => worker.endMs);
console.log(`floor, summed spans / ${JOBS}: `
    + seconds(sumOf(whole) / JOBS));
console.log(`replayed as run: ${seconds(replayedMs(whole))}`);
for (const parts of PARTS) {
    const split = workers.flatMap((worker) => worker === longest
        ? new Array<number>(parts).fill(worker.endMs / parts)
        : [worker.endMs]);
    console.log(
        `replayed with ${longest.file} in ${parts} parts: `
        + seconds(replayedMs(split)),
    );
}
