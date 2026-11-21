// The commit the process is running: its sha, subject, and
// commit time, and the merges before it on its first-parent
// line. Every source speaks one commit log: a line per
// commit, `%H %ct %s`, the running commit first and its
// merges after, newest first. Callers pass a commit
// captured at start. A missing one is read here. The
// compiled binary has no git and no run permission, so a
// failed read is absence, not a crash.

import type {
    Commit,
    RunningCommit,
} from '../shared/system-status.ts';

const GIT_SHA = /^[0-9a-f]{40}$/;
const COMMIT_LINE = /^([0-9a-f]{40}) ([0-9]{1,12}) ?(.*)$/;
const SECOND_MS = 1_000;

export const MERGES_SHOWN = 10;

// The shell twin is commit_log in bin/build-lib.
const LOG_FORMAT = '--format=%H %ct %s';

export function parseGitSha(
    text: string,
): string | undefined {
    const sha = text.trim();
    if (!GIT_SHA.test(sha)) return undefined;
    return sha;
}

export function parseGitSubject(
    text: string,
): string | undefined {
    const subject = text.trim();
    if (subject === '' || /[\r\n]/.test(subject)) {
        return undefined;
    }
    return subject;
}

// RFC 3339 zulu, or absent for text no clock can hold.
export function parseCommittedAt(
    text: string,
): string | undefined {
    const ms = Date.parse(text);
    if (Number.isNaN(ms)) return undefined;
    return new Date(ms).toISOString();
}

function commitOfLine(line: string): Commit | undefined {
    const match = COMMIT_LINE.exec(line);
    if (match === null) return undefined;
    const committedAt = new Date(
        Number(match[2]) * SECOND_MS,
    ).toISOString();
    const subject = parseGitSubject(match[3]!);
    return {
        sha: match[1]!,
        ...(subject !== undefined ? { subject } : {}),
        committedAt,
    };
}

// A log whose first line is no commit has none to report.
// A merge line that is no commit drops the merges: absent
// beats wrong. The running commit, a merge itself, is not
// one of its own merges.
export function commitLogOf(
    text: string,
): RunningCommit | undefined {
    const lines = text.split('\n').filter((line) => line !== '');
    const first = lines[0];
    if (first === undefined) return undefined;
    const head = commitOfLine(first);
    if (head === undefined) return undefined;
    const merges: Commit[] = [];
    for (const line of lines.slice(1)) {
        const merge = commitOfLine(line);
        if (merge === undefined) return head;
        if (merge.sha !== head.sha) merges.push(merge);
    }
    return { ...head, merges: merges.slice(0, MERGES_SHOWN) };
}

// The build carries the log as base64, so no byte of a
// commit message is ever source.
export function embeddedCommit(
    logBase64: string,
): RunningCommit | undefined {
    const bytes = Uint8Array.from(
        atob(logBase64),
        (char) => char.charCodeAt(0),
    );
    return commitLogOf(new TextDecoder().decode(bytes));
}

export function envCommit(
    read: (name: string) => string | undefined,
): RunningCommit | undefined {
    const log = read('GIT_COMMIT_LOG');
    if (log === undefined) return undefined;
    return commitLogOf(log);
}

async function gitLog(
    args: readonly string[],
): Promise<string | undefined> {
    const output = await new Deno.Command('git', {
        args: ['log', LOG_FORMAT, ...args],
        stdout: 'piped',
        stderr: 'null',
    }).output();
    if (!output.success) return undefined;
    return new TextDecoder().decode(output.stdout);
}

// An env log is never paired with git's: git may name
// another commit.
export async function readWorktreeCommit(): Promise<
    RunningCommit | undefined
> {
    const fromEnv = envCommit((name) => Deno.env.get(name));
    if (fromEnv !== undefined) return fromEnv;
    try {
        const head = await gitLog(['-1', 'HEAD']);
        if (head === undefined) return undefined;
        const merges = await gitLog([
            '--merges', '--first-parent',
            '-n', String(MERGES_SHOWN + 1), 'HEAD',
        ]);
        return commitLogOf(head + (merges ?? ''));
    } catch {
        return undefined;
    }
}

function judgedCommit(commit: Commit): Commit | undefined {
    const sha = parseGitSha(commit.sha);
    if (sha === undefined) return undefined;
    const subject = commit.subject === undefined
        ? undefined
        : parseGitSubject(commit.subject);
    const committedAt = commit.committedAt === undefined
        ? undefined
        : parseCommittedAt(commit.committedAt);
    return {
        sha,
        ...(subject !== undefined ? { subject } : {}),
        ...(committedAt !== undefined ? { committedAt } : {}),
    };
}

// A merge that fails judgment drops the merges, as a bad
// merge line does in the log.
export async function runningCommitFor(
    given: RunningCommit | undefined,
): Promise<RunningCommit | undefined> {
    const commit = given ?? await readWorktreeCommit();
    if (commit === undefined) return undefined;
    const head = judgedCommit(commit);
    if (head === undefined) return undefined;
    if (commit.merges === undefined) return head;
    const merges: Commit[] = [];
    for (const candidate of commit.merges) {
        const merge = judgedCommit(candidate);
        if (merge === undefined) return head;
        merges.push(merge);
    }
    return { ...head, merges: merges.slice(0, MERGES_SHOWN) };
}
