// The commit the process is running: its sha and its
// subject, read together from one commit. Callers pass a
// commit captured at start. A missing one is read here.
// The compiled binary has no git and no run
// permission, so a failed read is absence, not a crash.

import type { RunningCommit } from '../shared/system-status.ts';

const GIT_SHA = /^[0-9a-f]{40}$/;

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

// The build carries the subject as base64, so no byte of a
// commit message is ever source. runningCommitFor judges it.
export function embeddedCommit(
    sha: string,
    subjectBase64: string,
): RunningCommit {
    const bytes = Uint8Array.from(
        atob(subjectBase64),
        (char) => char.charCodeAt(0),
    );
    return { sha, subject: new TextDecoder().decode(bytes) };
}

export function envCommit(
    read: (name: string) => string | undefined,
): RunningCommit | undefined {
    const sha = read('GIT_SHA');
    if (sha === undefined || sha === '') return undefined;
    const subject = read('GIT_SUBJECT');
    return subject === undefined ? { sha } : { sha, subject };
}

// An env sha is never paired with git's subject: git may
// name another commit.
export async function readWorktreeCommit(): Promise<
    RunningCommit | undefined
> {
    const fromEnv = envCommit((name) => Deno.env.get(name));
    if (fromEnv !== undefined) return fromEnv;
    try {
        const output = await new Deno.Command('git', {
            args: ['log', '-1', '--format=%H%n%s'],
            stdout: 'piped',
            stderr: 'null',
        }).output();
        if (!output.success) return undefined;
        const text = new TextDecoder().decode(output.stdout);
        const lineEnd = text.indexOf('\n');
        if (lineEnd === -1) return { sha: text };
        return {
            sha: text.slice(0, lineEnd),
            subject: text.slice(lineEnd + 1),
        };
    } catch {
        return undefined;
    }
}

export async function runningCommitFor(
    given: RunningCommit | undefined,
): Promise<RunningCommit | undefined> {
    const commit = given ?? await readWorktreeCommit();
    if (commit === undefined) return undefined;
    const sha = parseGitSha(commit.sha);
    if (sha === undefined) return undefined;
    const subject = commit.subject === undefined
        ? undefined
        : parseGitSubject(commit.subject);
    return subject === undefined ? { sha } : { sha, subject };
}
