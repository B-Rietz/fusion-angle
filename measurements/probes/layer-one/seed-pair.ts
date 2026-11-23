// Interleaved pairs of seededMockDb() between two source
// trees, A and B, loaded side by side in one process. Each
// round seeds once from each tree, the order alternating,
// so both halves of a pair run under the same machine load.
// Prints wall and process CPU (user + system) milliseconds
// and the median of the per-round B / A ratios. A tree
// where a test file seeds once copies its seed after the
// first call, so this times a seed only in trees before
// that change.
//
// Roots are file: URLs of two checkouts or snapshots:
//
//   deno run --frozen --no-check --allow-env --allow-read \
//       measurements/probes/layer-one/seed-pair.ts \
//       file:///tmp/base file://$PWD 11

const [rootA, rootB, roundsText] = Deno.args;
if (rootA === undefined || rootB === undefined) {
    throw new Error('usage: seed-pair.ts A_ROOT B_ROOT [ROUNDS]');
}
const ROUNDS = Number(roundsText ?? '11');
const MICROS_PER_MILLISECOND = 1000;

type Seeder = () => Promise<unknown>;
type Sample = { readonly wallMs: number, readonly cpuMs: number };

// The preload registers the tree's own throwaway hasher.
async function seederOf(root: string): Promise<Seeder> {
    await import(root + '/tests/hmac-test-key.ts');
    const harness = await import(root + '/tests/mock-seed.ts');
    return harness.seededMockDb;
}

// Deno 2.9.8 runs Deno.cpuUsage() but does not declare it;
// the cast is to its one shape, microseconds since start.
const runtime = Deno as unknown as {
    cpuUsage(): { readonly user: number, readonly system: number },
};

function cpuMs(): number {
    const usage = runtime.cpuUsage();
    return (usage.user + usage.system) / MICROS_PER_MILLISECOND;
}

async function sampleOf(seed: Seeder): Promise<Sample> {
    const wallStarted = performance.now();
    const cpuStarted = cpuMs();
    await seed();
    return {
        wallMs: performance.now() - wallStarted,
        cpuMs: cpuMs() - cpuStarted,
    };
}

function medianOf(values: readonly number[]): number {
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.floor(sorted.length / 2)]!;
}

function spreadOf(values: readonly number[]): {
    readonly min: number,
    readonly median: number,
    readonly max: number,
} {
    return {
        min: Math.round(Math.min(...values)),
        median: Math.round(medianOf(values)),
        max: Math.round(Math.max(...values)),
    };
}

const seedA = await seederOf(rootA);
const seedB = await seederOf(rootB);
// One unmeasured seed each: module load and JIT warm-up.
await seedA();
await seedB();

const a: Sample[] = [];
const b: Sample[] = [];
for (let round = 0; round < ROUNDS; round++) {
    if (round % 2 === 0) {
        a.push(await sampleOf(seedA));
        b.push(await sampleOf(seedB));
    } else {
        b.push(await sampleOf(seedB));
        a.push(await sampleOf(seedA));
    }
}

console.log(JSON.stringify({
    rounds: ROUNDS,
    aWallMs: spreadOf(a.map((sample) => sample.wallMs)),
    bWallMs: spreadOf(b.map((sample) => sample.wallMs)),
    aCpuMs: spreadOf(a.map((sample) => sample.cpuMs)),
    bCpuMs: spreadOf(b.map((sample) => sample.cpuMs)),
    wallRatio: Number(medianOf(a.map(
        (sample, round) => b[round]!.wallMs / sample.wallMs,
    )).toFixed(3)),
    cpuRatio: Number(medianOf(a.map(
        (sample, round) => b[round]!.cpuMs / sample.cpuMs,
    )).toFixed(3)),
}));
