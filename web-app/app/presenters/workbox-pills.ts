import { html, type SafeHtml } from '../safe-html.ts';
import type {
    InboxItem,
    InboxLists,
} from './workbox-inbox.ts';

// The pill the person pressed: at most one is, or none.
export type PressedPill =
    | { readonly kind: 'none' }
    | { readonly kind: 'claimed' }
    | { readonly kind: 'archivedByMe' }
    | { readonly kind: 'flow'; readonly flowName: string };

type WorkboxPill = Exclude<PressedPill, { kind: 'none' }>;

export const NO_PILL: PressedPill = { kind: 'none' };

// A flow pill's two numbers: of that flow's work orders in
// the claimed and available lists, how many are mine and
// how many there are.
export interface FlowPill {
    readonly flowName: string;
    readonly claimed: number;
    readonly total: number;
}

// Every number the pills show.
export interface WorkboxPills {
    readonly claimed: number;
    readonly archivedByMe: number;
    readonly flows: readonly FlowPill[];
}

export function samePill(
    a: PressedPill,
    b: PressedPill,
): boolean {
    if (a.kind === 'flow' && b.kind === 'flow') {
        return a.flowName === b.flowName;
    }
    return a.kind === b.kind;
}

// One pill per flow name among the work orders in the
// claimed and available lists, by name. The page passes its
// last full read's lists, so a search moves no pill.
export function pillFlowNamesOf(lists: InboxLists): string[] {
    const names = new Set(
        [...lists.claimed, ...lists.available].map(
            (item) => item.flowName,
        ),
    );
    return [...names].toSorted((a, b) => a.localeCompare(b));
}

// The numbers come from the lists before any pill narrows
// them: the full read's, or a search's answer.
export function workboxPillsOf(
    flowNames: readonly string[],
    lists: InboxLists,
): WorkboxPills {
    return {
        claimed: lists.claimed.length,
        archivedByMe: lists.archivedByMe.length,
        flows: flowNames.map((flowName) => {
            const claimed = countInFlow(
                lists.claimed, flowName,
            );
            return {
                flowName,
                claimed,
                total: claimed
                    + countInFlow(lists.available, flowName),
            };
        }),
    };
}

function countInFlow(
    items: readonly InboxItem[],
    flowName: string,
): number {
    return items.filter(
        (item) => item.flowName === flowName,
    ).length;
}

// A pressed flow pill whose flow no longer has a pill is
// un-pressed.
export function pressedAmong(
    pressed: PressedPill,
    flowNames: readonly string[],
): PressedPill {
    return pressed.kind === 'flow'
        && !flowNames.includes(pressed.flowName)
        ? NO_PILL
        : pressed;
}

export function buildWorkboxPills(
    pills: WorkboxPills,
    pressed: PressedPill,
): SafeHtml {
    return html`${buildPill(
        { kind: 'claimed' },
        'Claimed by Me',
        String(pills.claimed),
        workOrdersBy(pills.claimed, 'claimed by me'),
        pressed,
    )}${buildPill(
        { kind: 'archivedByMe' },
        'Archived by Me',
        String(pills.archivedByMe),
        workOrdersBy(pills.archivedByMe, 'archived by me'),
        pressed,
    )}<span
        class="header-stat-divider"
        aria-hidden="true"></span>${pills.flows.map(
        (flow) => buildPill(
            { kind: 'flow', flowName: flow.flowName },
            flow.flowName,
            flow.claimed + '/' + flow.total,
            flow.flowName + ': ' + flow.claimed
                + ' claimed by me of ' + flow.total,
            pressed,
        ),
    )}`;
}

// "5 work orders claimed by me", "1 work order archived by
// me": DESIGN-SYSTEM.md's plural rule.
function workOrdersBy(count: number, by: string): string {
    return count + ' '
        + (count === 1 ? 'work order' : 'work orders')
        + ' ' + by;
}

// A filter chip: the badge look and dimming of the state
// chips on Ideas, Projects, and Records. Its name says
// what its numbers mean.
function buildPill(
    pill: WorkboxPill,
    label: string,
    count: string,
    name: string,
    pressed: PressedPill,
): SafeHtml {
    const isPressed = samePill(pill, pressed);
    const dimmed = pressed.kind !== 'none' && !isPressed;
    const flowAttr = pill.kind === 'flow'
        ? html` data-flow-name="${pill.flowName}"`
        : html``;
    return html`<button type="button" class="${
        'badge text-xs cursor-pointer '
        + (isPressed ? 'badge-primary' : 'badge-secondary')
    }" data-workbox-pill="${pill.kind}"${flowAttr} aria-pressed="${
        isPressed ? 'true' : 'false'
    }" data-dimmed="${
        dimmed ? 'true' : 'false'
    }" aria-label="${name}" title="${name}">${label} ${
        buildCount(count)
    }</button>`;
}

function buildCount(count: string): SafeHtml {
    return html`<span class="workbox-pill-count">${count}</span>`;
}
