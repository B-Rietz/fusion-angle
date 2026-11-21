// A component's state, as the hop that waited on it saw
// it. `timeout` is a kind of down: the wait expired with
// no answer. The system is up only when every component
// is `up`.

export type ComponentState = 'up' | 'down' | 'timeout';

export type ComponentStates<K extends string> =
    Readonly<Record<K, ComponentState>>;

// A subject, when present, was read from the commit its sha
// names: absent beats stale.
export interface RunningCommit {
    readonly sha: string;
    readonly subject?: string;
}

export interface SystemStatus<K extends string> {
    readonly 'git-sha': string;
    readonly 'git-subject'?: string;
    readonly up: boolean;
    readonly components: ComponentStates<K>;
}

export function everyComponentUp(
    components: ComponentStates<string>,
): boolean {
    return Object.values(components).every(
        (state) => state === 'up',
    );
}

export function systemStatusOf<K extends string>(
    commit: RunningCommit,
    components: ComponentStates<K>,
): SystemStatus<K> {
    return {
        'git-sha': commit.sha,
        ...(commit.subject !== undefined
            ? { 'git-subject': commit.subject }
            : {}),
        up: everyComponentUp(components),
        components,
    };
}
