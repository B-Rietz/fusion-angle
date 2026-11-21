// A component's state, as the hop that waited on it saw
// it. `timeout` is a kind of down: the wait expired with
// no answer. The system is up only when every component
// is `up`.

import { durationText } from './duration-text.ts';

export type ComponentState = 'up' | 'down' | 'timeout';

export type ComponentStates<K extends string> =
    Readonly<Record<K, ComponentState>>;

// A subject and a commit time, when present, were read
// from the commit its sha names: absent beats stale.
// `committedAt` is RFC 3339, zulu.
export interface Commit {
    readonly sha: string;
    readonly subject?: string;
    readonly committedAt?: string;
}

// The merges are the ones before the running commit on its
// first-parent line, newest first.
export type RunningCommit = Commit & {
    readonly merges?: readonly Commit[];
};

export interface CommitDocument {
    readonly 'git-sha': string;
    readonly 'git-subject'?: string;
    readonly 'git-committed-at'?: string;
    readonly 'git-age'?: string;
}

export type SystemStatus<K extends string> = CommitDocument & {
    readonly up: boolean;
    readonly components: ComponentStates<K>;
    readonly 'git-merges'?: readonly CommitDocument[];
};

export function everyComponentUp(
    components: ComponentStates<string>,
): boolean {
    return Object.values(components).every(
        (state) => state === 'up',
    );
}

export function commitDocumentOf(
    commit: Commit,
    nowMs: number,
): CommitDocument {
    return {
        'git-sha': commit.sha,
        ...(commit.subject !== undefined
            ? { 'git-subject': commit.subject }
            : {}),
        ...(commit.committedAt !== undefined
            ? {
                'git-committed-at': commit.committedAt,
                'git-age': durationText(
                    nowMs - Date.parse(commit.committedAt),
                ),
            }
            : {}),
    };
}

export function systemStatusOf<K extends string>(
    commit: RunningCommit,
    components: ComponentStates<K>,
    nowMs: number,
): SystemStatus<K> {
    return {
        ...commitDocumentOf(commit, nowMs),
        up: everyComponentUp(components),
        components,
        ...(commit.merges !== undefined
            ? {
                'git-merges': commit.merges.map(
                    (merge) => commitDocumentOf(merge, nowMs),
                ),
            }
            : {}),
    };
}
