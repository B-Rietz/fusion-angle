import {
    assertEquals,
    assertMatch,
    assertThrows,
} from '@std/assert';
import {
    type DurationSample,
    durationLine,
    durationVerdict,
    parseLedger,
    sampleFrom,
} from '../web-app/app/tool-duration-core.ts';

// Every sample here is crafted: no test reads a clock or
// this machine's load, so none moves with either.
const NOW = '2026-11-23T12:00:00.000Z';
const MS_PER_DAY = 86_400_000;

function daysBefore(days: number): string {
    return new Date(
        Date.parse(NOW) - days * MS_PER_DAY,
    ).toISOString();
}

// A quiet green `./bin/test memory` run of two minutes, a day
// before NOW, on a 16-core machine: load 2 when it began
// and 16, its own sixteen jobs, when it ended.
function sample(
    overrides: Partial<DurationSample> = {},
): DurationSample {
    return {
        tool: './bin/test',
        arguments: ['memory'],
        sha: '0123456789abcdef0123456789abcdef01234567',
        tree: 'clean',
        worktree: '/repository',
        startedAt: daysBefore(1),
        durationMs: 120_000,
        exitStatus: 0,
        machine: {
            platform: 'darwin',
            arch: 'arm64',
            cpuCount: 16,
        },
        loadAtStart: 2,
        loadAtEnd: 16,
        ...overrides,
    };
}

function current(
    overrides: Partial<DurationSample> = {},
): DurationSample {
    return sample({ startedAt: NOW, ...overrides });
}

const BASELINE = [sample(), sample(), sample()];
const TEN_MINUTES_MS = 600_000;

Deno.test('two slow quiet runs in a row are a regression',
() => {
    const now = current({ durationMs: TEN_MINUTES_MS });
    const verdict = durationVerdict(now, [
        ...BASELINE,
        sample({ durationMs: TEN_MINUTES_MS }),
    ]);
    assertEquals(verdict, {
        kind: 'regression',
        thenMs: 120_000,
        baselineRuns: 4,
    });
    assertEquals(
        durationLine(now, verdict),
        'DURATION REGRESSION: ./bin/test memory took 600.0 s;'
        + ' its recent median is 120.0 s'
        + ' (4 runs in the last 14 days);'
        + ' 5.0× slower, two quiet runs in a row',
    );
});

Deno.test('the first slow run is not yet a regression',
() => {
    const now = current({ durationMs: TEN_MINUTES_MS });
    const verdict = durationVerdict(now, BASELINE);
    assertEquals(verdict, {
        kind: 'slower',
        thenMs: 120_000,
        baselineRuns: 3,
    });
    assertEquals(
        durationLine(now, verdict),
        'duration: ./bin/test memory took 600.0 s,'
        + ' 5.0× its recent median of 120.0 s'
        + ' (3 runs in the last 14 days);'
        + ' a second quiet run this slow here'
        + ' is a regression',
    );
});

Deno.test('a slow run under machine load is no regression',
() => {
    const now = current({
        durationMs: TEN_MINUTES_MS,
        loadAtStart: 54.4,
    });
    const verdict = durationVerdict(now, [
        ...BASELINE,
        sample({ durationMs: TEN_MINUTES_MS }),
    ]);
    assertEquals(verdict.kind, 'slower');
    assertEquals(
        durationLine(now, verdict),
        'duration: ./bin/test memory took 600.0 s,'
        + ' 5.0× its recent median of 120.0 s'
        + ' (4 runs in the last 14 days);'
        + ' load was 3.4 per core as it began,'
        + ' so this run is not counted',
    );
});

Deno.test('a slow run that ended under load is no regression',
() => {
    const now = current({
        durationMs: TEN_MINUTES_MS,
        loadAtEnd: 40,
    });
    const verdict = durationVerdict(now, [
        ...BASELINE,
        sample({ durationMs: TEN_MINUTES_MS }),
    ]);
    assertEquals(verdict.kind, 'slower');
    assertEquals(
        durationLine(now, verdict),
        'duration: ./bin/test memory took 600.0 s,'
        + ' 5.0× its recent median of 120.0 s'
        + ' (4 runs in the last 14 days);'
        + ' load was 2.5 per core as it ended,'
        + ' so this run is not counted',
    );
});

Deno.test('a slow run elsewhere does not confirm this one',
() => {
    const verdict = durationVerdict(
        current({ durationMs: TEN_MINUTES_MS }),
        [
            ...BASELINE,
            sample({
                durationMs: TEN_MINUTES_MS,
                worktree: '/another-worktree',
            }),
        ],
    );
    assertEquals(verdict.kind, 'slower');
});

Deno.test('a fast run elsewhere does not hide a regression',
() => {
    const verdict = durationVerdict(
        current({ durationMs: TEN_MINUTES_MS }),
        [
            ...BASELINE,
            sample({ durationMs: TEN_MINUTES_MS }),
            sample({ worktree: '/another-worktree' }),
        ],
    );
    assertEquals(verdict.kind, 'regression');
});

Deno.test('a run under three times the median is steady',
() => {
    const now = current({ durationMs: 348_000 });
    const verdict = durationVerdict(now, BASELINE);
    assertEquals(verdict, {
        kind: 'steady',
        thenMs: 120_000,
        baselineRuns: 3,
    });
    assertEquals(
        durationLine(now, verdict),
        'duration: ./bin/test memory took 348.0 s;'
        + ' recent median 120.0 s'
        + ' (3 runs in the last 14 days)',
    );
});

function threeRunsOf(durationMs: number): DurationSample[] {
    return [
        sample({ durationMs }),
        sample({ durationMs }),
        sample({ durationMs }),
    ];
}

Deno.test('three times slower by under thirty seconds is steady',
() => {
    assertEquals(
        durationVerdict(
            current({ durationMs: 42_000 }),
            threeRunsOf(14_000),
        ).kind,
        'steady',
    );
    assertEquals(
        durationVerdict(
            current({ durationMs: 43_999 }),
            threeRunsOf(14_000),
        ).kind,
        'steady',
    );
});

Deno.test('exactly three times and thirty seconds is slow',
() => {
    assertEquals(
        durationVerdict(
            current({ durationMs: 45_000 }),
            threeRunsOf(15_000),
        ).kind,
        'slower',
    );
    assertEquals(
        durationVerdict(
            current({ durationMs: 44_999 }),
            threeRunsOf(15_000),
        ).kind,
        'steady',
    );
});

// Load only adds time. A run that was fast under load
// shows the tool is still fast; one that was slow under
// load shows nothing either way.
Deno.test('a fast run under load refutes the slow one before',
() => {
    const verdict = durationVerdict(
        current({ durationMs: TEN_MINUTES_MS }),
        [
            ...BASELINE,
            sample({ durationMs: TEN_MINUTES_MS }),
            sample({ loadAtStart: 54.4 }),
        ],
    );
    assertEquals(verdict.kind, 'slower');
});

Deno.test('a slow run under load neither confirms nor refutes',
() => {
    const loaded = sample({
        durationMs: TEN_MINUTES_MS,
        loadAtStart: 54.4,
    });
    assertEquals(
        durationVerdict(
            current({ durationMs: TEN_MINUTES_MS }),
            [
                ...BASELINE,
                sample({ durationMs: TEN_MINUTES_MS }),
                loaded,
            ],
        ).kind,
        'regression',
    );
    assertEquals(
        durationVerdict(
            current({ durationMs: TEN_MINUTES_MS }),
            [...BASELINE, loaded],
        ).kind,
        'slower',
    );
});

// A speed-up in one worktree is no regression in another:
// each worktree is compared with its own runs.
Deno.test('a faster worktree raises no alarm in this one',
() => {
    const faster = sample({
        durationMs: 30_000,
        worktree: '/another-worktree',
    });
    const elsewhere = Array.from({ length: 10 }, () => faster);
    assertEquals(
        durationVerdict(current(), [...elsewhere, ...BASELINE]),
        { kind: 'steady', thenMs: 120_000, baselineRuns: 3 },
    );
});

// Each of these is recorded and none is a baseline run.
const NOT_BASELINE: Record<string, Partial<DurationSample>> = {
    'a red run': { exitStatus: 1 },
    'a run that began at a load of one per core': {
        loadAtStart: 16,
    },
    'a run that ended at a load of 1.5 per core': {
        loadAtEnd: 24,
    },
    'a run in another worktree': {
        worktree: '/another-worktree',
    },
    'a run older than the window': {
        startedAt: daysBefore(15),
    },
    'other arguments': { arguments: ['lint'] },
    'another tool': { tool: './bin/build' },
    'another machine': {
        machine: {
            platform: 'darwin',
            arch: 'arm64',
            cpuCount: 32,
        },
    },
};

for (const [name, overrides] of Object.entries(NOT_BASELINE)) {
    Deno.test(`${name} is no baseline`, () => {
        assertEquals(
            durationVerdict(current(), [
                sample(overrides),
                sample(overrides),
                sample(overrides),
            ]),
            { kind: 'no-baseline', baselineRuns: 0 },
        );
    });
}

Deno.test('a run inside the window is a baseline run', () => {
    const recent = sample({ startedAt: daysBefore(13.9) });
    assertEquals(
        durationVerdict(current(), [recent, recent, recent]),
        { kind: 'steady', thenMs: 120_000, baselineRuns: 3 },
    );
});

Deno.test('an empty history is no baseline yet', () => {
    const now = current();
    const verdict = durationVerdict(now, []);
    assertEquals(
        verdict,
        { kind: 'no-baseline', baselineRuns: 0 },
    );
    assertEquals(
        durationLine(now, verdict),
        'duration: ./bin/test memory took 120.0 s;'
        + ' no baseline yet (0 of 3 quiet green runs'
        + ' in the last 14 days)',
    );
});

Deno.test('two baseline runs are no baseline yet', () => {
    const now = current({ durationMs: TEN_MINUTES_MS });
    const verdict = durationVerdict(
        now,
        [sample(), sample()],
    );
    assertEquals(
        verdict,
        { kind: 'no-baseline', baselineRuns: 2 },
    );
    assertMatch(
        durationLine(now, verdict),
        /no baseline yet \(2 of 3 quiet green runs/,
    );
});

Deno.test('a contended run says it is not counted', () => {
    const now = current({ loadAtStart: 54.4 });
    assertEquals(
        durationLine(now, durationVerdict(now, [])),
        'duration: ./bin/test memory took 120.0 s;'
        + ' no baseline yet (0 of 3 quiet green runs'
        + ' in the last 14 days);'
        + ' load was 3.4 per core as it began,'
        + ' so this run is not counted',
    );
    assertEquals(
        durationLine(now, durationVerdict(now, BASELINE)),
        'duration: ./bin/test memory took 120.0 s;'
        + ' recent median 120.0 s'
        + ' (3 runs in the last 14 days);'
        + ' load was 3.4 per core as it began,'
        + ' so this run is not counted',
    );
});

Deno.test('a tool with no arguments is named alone', () => {
    const now = current({
        tool: './bin/build',
        arguments: [],
    });
    assertMatch(
        durationLine(now, durationVerdict(now, [])),
        /^duration: \.\/bin\/build took 120\.0 s;/,
    );
});

Deno.test('an empty ledger holds no samples', () => {
    assertEquals(parseLedger(''), []);
});

Deno.test('the ledger parses to its samples in order', () => {
    const first = sample({ durationMs: 1 });
    const second = sample({ durationMs: 2 });
    assertEquals(
        parseLedger(
            JSON.stringify(first) + '\n'
            + JSON.stringify(second) + '\n',
        ),
        [first, second],
    );
});

Deno.test('an instant may carry microseconds', () => {
    const fine = sample({
        startedAt: '2026-11-22T12:00:00.123456Z',
    });
    assertEquals(sampleFrom(fine), fine);
});

Deno.test('a ledger line that is not JSON is named', () => {
    const error = assertThrows(() =>
        parseLedger(
            JSON.stringify(sample()) + '\n'
            + 'not json\n',
        )
    ) as Error;
    assertMatch(
        error.message,
        /^duration ledger line 2 is not a sample: /,
    );
});

Deno.test('a blank ledger line is named', () => {
    const error = assertThrows(() =>
        parseLedger('\n' + JSON.stringify(sample()) + '\n')
    ) as Error;
    assertMatch(
        error.message,
        /^duration ledger line 1 is not a sample: /,
    );
});

// One field wrong at a time; the reason names the field.
const NOT_A_SAMPLE: Record<string, unknown> = {
    tool: '',
    arguments: 'memory',
    sha: 'c360201',
    tree: 'stale',
    worktree: '',
    startedAt: '2026-11-23 12:00:00',
    durationMs: -1,
    exitStatus: 1.5,
    machine: { platform: 'darwin', arch: 'arm64' },
    loadAtStart: 'busy',
    loadAtEnd: -1,
};

for (const [field, value] of Object.entries(NOT_A_SAMPLE)) {
    Deno.test(`a sample with a bad ${field} is refused`, () => {
        const error = assertThrows(() =>
            sampleFrom({ ...sample(), [field]: value })
        ) as Error;
        assertMatch(error.message, new RegExp(field));
    });
}

Deno.test('a sample missing a field is refused', () => {
    const { durationMs: _dropped, ...rest } = sample();
    const error = assertThrows(() => sampleFrom(rest)) as Error;
    assertMatch(error.message, /durationMs/);
});

Deno.test('a ledger line names what is wrong with it', () => {
    const { loadAtEnd: _dropped, ...rest } = sample();
    const error = assertThrows(() =>
        parseLedger(JSON.stringify(rest) + '\n')
    ) as Error;
    assertEquals(
        error.message,
        'duration ledger line 1 is not a sample:'
        + ' loadAtEnd must be a number, zero or more',
    );
});
