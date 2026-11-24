// The verdict on how long a tool took, against how long
// it recently took. Pure: no I/O, no clock, no load
// reading. Every input is a sample, so the verdict is
// derived from the ledger each time and stored nowhere.
// tool-duration.ts reads the machine and the ledger.

import { median } from './measure-core.ts';

// "Fairly recently": a baseline run started at most this
// many days before the run it is compared with.
export const BASELINE_WINDOW_DAYS = 14;

// Fewer baseline runs than this give no median to trust.
export const BASELINE_MINIMUM_RUNS = 3;

// A slow run took at least this many times the median of
// its baseline. Load readings cannot bound what a busy
// machine does to a run, so the ratio rests on what was
// measured: runs that read quiet at both ends stayed
// within about 1.4 times the quiet duration, and the one
// that ran 2.1 times read contended at its end. The
// design names the runs.
export const SLOWDOWN_RATIO = 3;

// A slow run also took at least this many milliseconds
// longer than the median: three times 200 ms is nothing.
// Half a minute also keeps a step with a cache under it:
// `./bin/test check` takes 0.2 s on a hit and seconds on a
// miss, and both are honest.
export const SLOWDOWN_FLOOR_MS = 30_000;

// A run is contended when the one-minute load average per
// core had reached 1 as it began: the run queue was
// already as long as the machine is wide.
export const CONTENDED_LOAD_PER_CORE_AT_START = 1;

// Or had reached 1.5 as it ended. The end reading holds
// the step's own jobs too, so its bound is higher; it
// sees what the start reading cannot, load that arrived
// after the step began.
export const CONTENDED_LOAD_PER_CORE_AT_END = 1.5;

const MS_PER_DAY = 86_400_000;

// One completed execution of one timed step: a line of
// the ledger.
export type DurationSample = {
    readonly tool: string;
    // The words that fix the step's work, chosen at the
    // call site. Never a secret, a port, or a path.
    readonly arguments: readonly string[];
    readonly sha: string;
    readonly tree: 'clean' | 'dirty';
    readonly worktree: string;
    // RFC 3339, zulu, to the millisecond or finer.
    readonly startedAt: string;
    readonly durationMs: number;
    readonly exitStatus: number;
    readonly machine: {
        readonly platform: string;
        readonly arch: string;
        readonly cpuCount: number;
    };
    // The one-minute load average as the step began, and
    // as it ended.
    readonly loadAtStart: number;
    readonly loadAtEnd: number;
};

export type DurationVerdict =
    | {
        readonly kind: 'no-baseline';
        readonly baselineRuns: number;
    }
    | {
        readonly kind: 'steady' | 'slower' | 'regression';
        readonly thenMs: number;
        readonly baselineRuns: number;
    };

// A value that is not a sample, and why. A caller that
// knows where the value came from adds that and throws on.
export class NotASample extends Error {}

const SHA = /^[0-9a-f]{40}$/;
// RFC 3339, zulu, with three to nine fractional digits.
const INSTANT =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3,9}Z$/;

export function isRecord(
    value: unknown,
): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
        && !Array.isArray(value);
}

function isNamed(value: unknown): value is string {
    return typeof value === 'string' && value !== '';
}

function isWholeNumber(
    value: unknown,
    least: number,
): value is number {
    return typeof value === 'number'
        && Number.isInteger(value) && value >= least;
}

function isAmount(value: unknown): value is number {
    return typeof value === 'number'
        && Number.isFinite(value) && value >= 0;
}

// The gate every sample passes, whether it was just
// composed or read back from the ledger.
export function sampleFrom(value: unknown): DurationSample {
    if (!isRecord(value)) {
        throw new NotASample('a sample must be an object');
    }
    const {
        tool, sha, tree, worktree, startedAt,
        durationMs, exitStatus, machine,
        loadAtStart, loadAtEnd,
    } = value;
    const words = value.arguments;
    if (!isNamed(tool)) {
        throw new NotASample('tool must be a non-empty string');
    }
    if (
        !Array.isArray(words)
        || !words.every(
            (word): word is string => typeof word === 'string',
        )
    ) {
        throw new NotASample(
            'arguments must be an array of strings',
        );
    }
    if (typeof sha !== 'string' || !SHA.test(sha)) {
        throw new NotASample(
            'sha must be 40 lowercase hex digits',
        );
    }
    if (tree !== 'clean' && tree !== 'dirty') {
        throw new NotASample('tree must be clean or dirty');
    }
    if (!isNamed(worktree)) {
        throw new NotASample(
            'worktree must be a non-empty string',
        );
    }
    if (
        typeof startedAt !== 'string'
        || !INSTANT.test(startedAt)
        || Number.isNaN(Date.parse(startedAt))
    ) {
        throw new NotASample(
            'startedAt must be an RFC 3339 zulu instant'
            + ' with fractional seconds',
        );
    }
    if (!isAmount(durationMs)) {
        throw new NotASample(
            'durationMs must be a number, zero or more',
        );
    }
    if (!isWholeNumber(exitStatus, 0)) {
        throw new NotASample(
            'exitStatus must be a whole number, zero or more',
        );
    }
    if (!isRecord(machine)) {
        throw new NotASample('machine must be an object');
    }
    const { platform, arch, cpuCount } = machine;
    if (!isNamed(platform)) {
        throw new NotASample(
            'machine.platform must be a non-empty string',
        );
    }
    if (!isNamed(arch)) {
        throw new NotASample(
            'machine.arch must be a non-empty string',
        );
    }
    if (!isWholeNumber(cpuCount, 1)) {
        throw new NotASample(
            'machine.cpuCount must be a whole number,'
            + ' one or more',
        );
    }
    if (!isAmount(loadAtStart)) {
        throw new NotASample(
            'loadAtStart must be a number, zero or more',
        );
    }
    if (!isAmount(loadAtEnd)) {
        throw new NotASample(
            'loadAtEnd must be a number, zero or more',
        );
    }
    return {
        tool,
        arguments: words,
        sha,
        tree,
        worktree,
        startedAt,
        durationMs,
        exitStatus,
        machine: { platform, arch, cpuCount },
        loadAtStart,
        loadAtEnd,
    };
}

function sampleFromLine(line: string): DurationSample {
    let value: unknown;
    try {
        value = JSON.parse(line);
    } catch (error) {
        if (!(error instanceof SyntaxError)) {
            throw error;
        }
        throw new NotASample('it is not JSON');
    }
    return sampleFrom(value);
}

// The ledger's text as its samples, oldest first. A line
// that is not a sample is never skipped: a ledger that
// ignores its own bad lines lies about its baseline.
export function parseLedger(text: string): DurationSample[] {
    const lines = text.split('\n');
    // The text ends with a newline, so the last piece is
    // empty and is no line.
    if (lines.at(-1) === '') {
        lines.pop();
    }
    return lines.map((line, index) => {
        try {
            return sampleFromLine(line);
        } catch (error) {
            if (!(error instanceof NotASample)) {
                throw error;
            }
            throw new NotASample(
                `duration ledger line ${index + 1}`
                + ` is not a sample: ${error.message}`,
            );
        }
    });
}

function beganContended(sample: DurationSample): boolean {
    return sample.loadAtStart / sample.machine.cpuCount
        >= CONTENDED_LOAD_PER_CORE_AT_START;
}

function endedContended(sample: DurationSample): boolean {
    return sample.loadAtEnd / sample.machine.cpuCount
        >= CONTENDED_LOAD_PER_CORE_AT_END;
}

// A contended run is recorded, is never a baseline run,
// and never raises the alarm.
function isContended(sample: DurationSample): boolean {
    return beganContended(sample) || endedContended(sample);
}

// One series is one tool run one way in one worktree on
// one machine. A worktree is its own series because its
// code is its own: a speed-up in one is no regression in
// another. SHA and tree state are not part of the series:
// comparing across commits is the point.
function isSameSeries(
    one: DurationSample,
    other: DurationSample,
): boolean {
    return one.tool === other.tool
        && one.arguments.length === other.arguments.length
        && one.arguments.every(
            (word, index) => word === other.arguments[index],
        )
        && one.worktree === other.worktree
        && one.machine.platform === other.machine.platform
        && one.machine.arch === other.machine.arch
        && one.machine.cpuCount === other.machine.cpuCount;
}

// How a green run compares with the samples recorded
// before it. A regression is a slow quiet run whose
// predecessor was slow and quiet too: one slow run can be
// a cold cache, or load the readings missed.
//
// Load only adds time, so the predecessor is found by
// stepping back over runs that were slow under load,
// which show nothing either way. A run that was fast,
// under load or not, shows the tool is still fast.
export function durationVerdict(
    current: DurationSample,
    priors: readonly DurationSample[],
): DurationVerdict {
    const windowStartMs = Date.parse(current.startedAt)
        - BASELINE_WINDOW_DAYS * MS_PER_DAY;
    const recent = priors.filter((prior) =>
        isSameSeries(prior, current)
        && prior.exitStatus === 0
        && Date.parse(prior.startedAt) >= windowStartMs
    );
    const baseline = recent.filter(
        (run) => !isContended(run),
    );
    if (baseline.length < BASELINE_MINIMUM_RUNS) {
        return {
            kind: 'no-baseline',
            baselineRuns: baseline.length,
        };
    }
    const thenMs = median(
        baseline.map((run) => run.durationMs),
    );
    const isSlow = (run: DurationSample): boolean =>
        run.durationMs >= SLOWDOWN_RATIO * thenMs
        && run.durationMs - thenMs >= SLOWDOWN_FLOOR_MS;
    const compared = { thenMs, baselineRuns: baseline.length };
    if (!isSlow(current)) {
        return { kind: 'steady', ...compared };
    }
    const predecessor = recent.findLast(
        (run) => !isContended(run) || !isSlow(run),
    );
    if (
        isContended(current)
        || predecessor === undefined
        || !isSlow(predecessor)
    ) {
        return { kind: 'slower', ...compared };
    }
    return { kind: 'regression', ...compared };
}

function seconds(durationMs: number): string {
    return `${(durationMs / 1000).toFixed(1)} s`;
}

// The one line a green step ends with. It names the tool,
// now, then, and the ratio. A load reading is stated as
// read: at the end it holds the step's own jobs too.
export function durationLine(
    current: DurationSample,
    verdict: DurationVerdict,
): string {
    const step = [current.tool, ...current.arguments].join(' ');
    const took = seconds(current.durationMs);
    const cores = current.machine.cpuCount;
    const load = beganContended(current)
        ? `${(current.loadAtStart / cores).toFixed(1)}`
            + ' per core as it began'
        : `${(current.loadAtEnd / cores).toFixed(1)}`
            + ' per core as it ended';
    const notCounted = isContended(current)
        ? `; load was ${load}, so this run is not counted`
        : '';
    const window = `in the last ${BASELINE_WINDOW_DAYS} days`;
    if (verdict.kind === 'no-baseline') {
        return `duration: ${step} took ${took};`
            + ` no baseline yet (${verdict.baselineRuns}`
            + ` of ${BASELINE_MINIMUM_RUNS} quiet green runs`
            + ` ${window})${notCounted}`;
    }
    const then = seconds(verdict.thenMs);
    const runs = `(${verdict.baselineRuns} runs ${window})`;
    const ratio =
        `${(current.durationMs / verdict.thenMs).toFixed(1)}×`;
    switch (verdict.kind) {
        case 'steady':
            return `duration: ${step} took ${took};`
                + ` recent median ${then} ${runs}${notCounted}`;
        case 'slower':
            return `duration: ${step} took ${took},`
                + ` ${ratio} its recent median of ${then}`
                + ` ${runs}`
                + (isContended(current)
                    ? notCounted
                    : '; a second quiet run this slow here'
                        + ' is a regression');
        case 'regression':
            return `DURATION REGRESSION: ${step} took ${took};`
                + ` its recent median is ${then} ${runs};`
                + ` ${ratio} slower, two quiet runs in a row`;
    }
}
