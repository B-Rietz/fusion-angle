// The two ends of one timed step, for bin/duration-lib.
//
//   begin LABEL SHA TREE WORKTREE
//     prints the begun sample, one line of JSON, on
//     stdout: everything known before the step runs.
//   end BEGUN EXIT_STATUS LEDGER
//     completes the sample and appends it to LEDGER. For
//     a green run it prints on stderr how the run
//     compares with the samples recorded before it; a
//     failure is its own news and gets no line.
//
// bash 3.2 has no sub-second clock and the timed step is
// a shell function, which nothing outside its shell can
// wrap, so each end is its own short run and the duration
// is the difference between their two wall-clock
// instants.
//
// Permissions, named: both ends read the load average
// (sys); end reads and appends the ledger (read, write).

import {
    durationLine,
    durationVerdict,
    isRecord,
    parseLedger,
    sampleFrom,
} from './tool-duration-core.ts';

// The machine vocabulary measurements/history.jsonl
// already records, so the repo's two ledgers name one
// architecture one way. Keyed by Deno.build.arch, so a new
// architecture fails `deno check` instead of recording an
// unknown word.
const RECORDED_ARCH: Record<typeof Deno.build.arch, string> = {
    aarch64: 'arm64',
    x86_64: 'x64',
};

const USAGE = 'usage: tool-duration.ts'
    + ' begin LABEL SHA TREE WORKTREE'
    + ' | end BEGUN EXIT_STATUS LEDGER';

function begin(
    label: string,
    sha: string,
    tree: string,
    worktree: string,
): void {
    const [tool, ...words] = label.split(' ');
    const [oneMinuteLoad] = Deno.loadavg();
    console.log(JSON.stringify({
        tool,
        arguments: words,
        sha,
        tree,
        worktree,
        machine: {
            platform: Deno.build.os,
            arch: RECORDED_ARCH[Deno.build.arch],
            cpuCount: navigator.hardwareConcurrency,
        },
        loadAtStart: oneMinuteLoad,
        // Read last: nothing of this run's own follows it.
        // Temporal reads the wall clock to the microsecond,
        // where Date stops at the millisecond.
        startedAt: Temporal.Now.instant().toString({
            fractionalSecondDigits: 6,
        }),
    }));
}

// An absent ledger is an empty history, not a failure.
function ledgerText(ledger: string): string {
    try {
        return Deno.readTextFileSync(ledger);
    } catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) {
            throw error;
        }
        return '';
    }
}

function end(
    begunText: string,
    exitStatusText: string,
    ledger: string,
): void {
    // Read first: nothing of this run's own precedes them.
    const endedAtMs = Date.now();
    const [oneMinuteLoad] = Deno.loadavg();
    const begun: unknown = JSON.parse(begunText);
    if (!isRecord(begun)) {
        throw new Error('the begun sample is not an object');
    }
    const current = sampleFrom({
        ...begun,
        durationMs:
            endedAtMs - Date.parse(String(begun.startedAt)),
        exitStatus: Number(exitStatusText),
        loadAtEnd: oneMinuteLoad,
    });
    const text = ledgerText(ledger);
    const priors = parseLedger(text);
    // A ledger whose last line lost its newline gets one
    // first, so no sample is ever glued onto another.
    const lineBreak = text === '' || text.endsWith('\n')
        ? ''
        : '\n';
    Deno.writeTextFileSync(
        ledger,
        lineBreak + JSON.stringify(current) + '\n',
        { append: true },
    );
    if (current.exitStatus === 0) {
        console.error(durationLine(
            current,
            durationVerdict(current, priors),
        ));
    }
}

function main(): void {
    const [verb, ...rest] = Deno.args;
    if (verb === 'begin' && rest.length === 4) {
        begin(rest[0]!, rest[1]!, rest[2]!, rest[3]!);
    } else if (verb === 'end' && rest.length === 3) {
        end(rest[0]!, rest[1]!, rest[2]!);
    } else {
        throw new Error(USAGE);
    }
}

if (import.meta.main) {
    try {
        main();
    } catch (error) {
        if (!(error instanceof Error)) {
            throw error;
        }
        console.error(`duration: ${error.message}`);
        Deno.exitCode = 1;
    }
}
