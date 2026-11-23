// Self time by function and by file in a V8 .cpuprofile,
// as `deno run --cpu-prof` writes one.
//
//   deno run --frozen --no-check --allow-env --allow-read \
//       --config deno.json --cpu-prof --cpu-prof-dir=$TMPDIR/prof \
//       measurements/probes/layer-one/seed-time.ts file://$PWD 5
//   deno run --allow-read \
//       measurements/probes/layer-one/profile-self.ts \
//       $TMPDIR/prof/*.cpuprofile

const SHOWN = 30;
const MICROS_PER_MILLISECOND = 1000;

type ProfileNode = {
    readonly id: number,
    readonly callFrame: {
        readonly functionName: string,
        readonly url: string,
        readonly lineNumber: number,
    },
};
type Profile = {
    readonly nodes: readonly ProfileNode[],
    readonly samples: readonly number[],
    readonly timeDeltas: readonly number[],
};

const path = Deno.args[0];
if (path === undefined) {
    throw new Error('usage: profile-self.ts PROFILE');
}
const profile: Profile = JSON.parse(Deno.readTextFileSync(path));

const selfMicros = new Map<number, number>();
profile.samples.forEach((id, index) => {
    selfMicros.set(
        id,
        (selfMicros.get(id) ?? 0) + profile.timeDeltas[index]!,
    );
});

const byFunction = new Map<string, number>();
const byFile = new Map<string, number>();
let totalMicros = 0;
for (const node of profile.nodes) {
    const micros = selfMicros.get(node.id) ?? 0;
    totalMicros += micros;
    const file = node.callFrame.url.replace(
        /^.*\/(api|shared|server|tests|client|web-app)\//, '$1/',
    );
    const named = (node.callFrame.functionName || '(anonymous)')
        + ' ' + file + ':' + (node.callFrame.lineNumber + 1);
    byFunction.set(named, (byFunction.get(named) ?? 0) + micros);
    const home = file === '' ? '(native)' : file;
    byFile.set(home, (byFile.get(home) ?? 0) + micros);
}

function show(title: string, times: Map<string, number>): void {
    console.log(
        `${title}, of `
        + `${(totalMicros / MICROS_PER_MILLISECOND).toFixed(0)} ms`,
    );
    [...times]
        .sort((left, right) => right[1] - left[1])
        .slice(0, SHOWN)
        .forEach(([name, micros]) => console.log(
            (micros / MICROS_PER_MILLISECOND).toFixed(0).padStart(7)
            + ' ms '
            + (100 * micros / totalMicros).toFixed(1).padStart(5)
            + '%  ' + name,
        ));
}

show('self time by function', byFunction);
show('self time by file', byFile);
