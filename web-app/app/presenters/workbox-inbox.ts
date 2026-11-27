import {
    html, SafeHtml,
    trusted, escapeForHtml,
} from '../safe-html.ts';
import { DISPLAY_ABSENT } from '../format.ts';
import { idLabel } from './id-label.ts';
import { buildPageUrl } from '../navigation.ts';
import {
    type WorkOrder,
} from '../../../client/index.ts';
import {
    SECONDS_PER_DAY,
    MS_PER_SECOND,
} from '../../../shared/types.ts';
import type { Id } from '../../../shared/types.ts';
import type { PressedPill } from './workbox-pills.ts';

const DAY_MS = SECONDS_PER_DAY * MS_PER_SECOND;

function relativeTime(iso: string): string {
    const ms = Date.now()
        - new Date(iso).getTime();
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    const d = Math.floor(ms / DAY_MS);
    if (d > 0) return d + 'd ago';
    if (hr > 0) return hr + 'h ago';
    if (min > 0) return min + 'm ago';
    return 'just now';
}

// Whole days without a transition after which a row is
// marked, so work that has stopped moving stands out.
export const WAIT_SOON_DAYS = 14;
export const WAIT_LATE_DAYS = 30;

export type WaitLevel = 'none' | 'soon' | 'late';

export function waitLevelOf(
    lastTransitionedAt: string | null,
    nowMs: number,
): WaitLevel {
    if (lastTransitionedAt === null) return 'none';
    const days = Math.floor(
        (nowMs - new Date(lastTransitionedAt).getTime())
        / DAY_MS,
    );
    if (days >= WAIT_LATE_DAYS) return 'late';
    if (days >= WAIT_SOON_DAYS) return 'soon';
    return 'none';
}

interface PlacedInboxItem {
    kind: 'placed';
    id: string;
    flowName: string;
    stateName: string;
    transitionerName: string | null;
    claimedByName: string | null;
    lastTransitionedAt: string | null;
    completed: boolean;
    taskInstructions: string;
}

// Completed work is not waiting on anyone.
function waitOf(item: InboxItem, nowMs: number): WaitLevel {
    if (item.kind === 'placed' && item.completed) {
        return 'none';
    }
    return waitLevelOf(item.lastTransitionedAt, nowMs);
}

// The available list's groups, longest waiting first. That
// is the order the list already sorts in, so grouping moves
// no row.
const WAIT_GROUPS: readonly {
    readonly level: WaitLevel;
    readonly title: string;
    readonly hint: string;
}[] = [
    {
        level: 'late',
        title: 'Needs you',
        hint: `Waiting ${WAIT_LATE_DAYS}+ days`,
    },
    {
        level: 'soon',
        title: 'Review when ready',
        hint: `Waiting ${WAIT_SOON_DAYS}–`
            + `${WAIT_LATE_DAYS - 1} days`,
    },
    {
        level: 'none',
        title: 'Routine',
        hint: `Under ${WAIT_SOON_DAYS} days`,
    },
];

// A head whose node its flow graph no longer holds: it has
// no state to name, no completion, and no instructions.
interface UnplacedInboxItem {
    kind: 'unplaced';
    id: string;
    flowName: string;
    transitionerName: string | null;
    claimedByName: string | null;
    lastTransitionedAt: string | null;
}

export type InboxItem = PlacedInboxItem | UnplacedInboxItem;

export type InboxListKind =
    | 'available'
    | 'claimed'
    | 'archivedByMe';

const EMPTY_COPY: Record<InboxListKind, string> = {
    available: 'No work orders available to me',
    claimed: 'No work orders claimed by me',
    archivedByMe: 'No work orders archived by me',
};

const LIST_TITLE: Record<InboxListKind, string> = {
    available: 'Work Orders available to me',
    claimed: 'Work Orders claimed by me',
    archivedByMe: 'Work Orders archived by me',
};

const LIST_ID: Record<InboxListKind, string> = {
    available: 'available-list',
    claimed: 'claimed-list',
    archivedByMe: 'archived-list',
};

// What narrows a painted list: nothing, or the search
// text whose QUERY answer the list holds.
export type InboxFilter =
    | { readonly kind: 'none' }
    | { readonly kind: 'matched'; readonly text: string };

export interface InboxLists {
    available: InboxItem[];
    claimed: InboxItem[];
    archivedByMe: InboxItem[];
}

// A work order's claim that is live now: the head's claim,
// judged against its expiresAt by the page that reads the
// twin. The inbox names the claim-holder on the item it
// renders — a claimed work order is shown, never hidden.
export interface ActiveClaim {
    memberId: Id;
    at: string;
}

// One headed list the left box draws: which list, and the
// rows the pressed pill leaves in it.
export interface InboxSection {
    readonly kind: InboxListKind;
    readonly items: readonly InboxItem[];
}

// Static: no data-work-order-card and no link, so the page
// never opens it in the box, which could not place it.
function buildUnplacedRow(
    item: UnplacedInboxItem,
    wait: WaitLevel,
): SafeHtml {
    return html`
        <div class="card p-4" data-wait="${wait}">
            <div class="flex-fill">
                <div class="${
                    'flex items-center'
                    + ' gap-2 mb-1'
                }">
                    <span class="${
                        'font-semibold'
                    }">${
                        item.flowName
                    }</span>
                    <span class="${
                        'text-xs text-muted min-w-0'
                    }">${
                        idLabel('Work order', item.id)
                    }</span>
                </div>
                <div class="${
                    'flex items-center'
                    + ' gap-2 text-sm'
                    + ' text-muted'
                }">
                    <span
                        class="badge badge-warning"
                        >State unknown</span>
                    <span class="inbox-age ml-auto"
                        >${
                            item.lastTransitionedAt
                                ? relativeTime(
                                    item.lastTransitionedAt,
                                )
                                : DISPLAY_ABSENT
                        }</span>
                </div>
            </div>
        </div>`;
}

// A row: its title links to its work order, its state
// badge and age below.
function buildInboxRow(
    item: InboxItem,
    nowMs: number,
): SafeHtml {
    const wait = waitOf(item, nowMs);
    if (item.kind === 'unplaced')
        return buildUnplacedRow(item, wait);
    const titleAttr = item.taskInstructions
        ? trusted(' title="'
            + escapeForHtml(
                item.taskInstructions,
            )
            + '"')
        : trusted('');
    const badge = item.completed
        ? html`<span
            class="badge badge-success"
            >Complete</span>`
        : html`<span
            class="badge badge-info"${
            titleAttr}
            >${item.stateName}</span>`;
    const age = item.lastTransitionedAt
        ? relativeTime(item.lastTransitionedAt)
        : DISPLAY_ABSENT;
    return html`
    <div
        class="card p-4 cursor-pointer workbox-row"
        data-wait="${wait}"
        data-work-order-card="${item.id}">
        <div class="flex items-start gap-3 mb-2">
            <a href="${
                buildPageUrl('workbox', { id: item.id })
            }" class="flex-fill font-semibold"
                aria-label="${item.flowName}, work order ${
                    item.id
                }">${
                item.flowName
            }</a>
            <span class="inbox-age text-sm text-muted"
                >${age}</span>
        </div>
        <div class="${
            'flex flex-wrap items-center'
            + ' gap-2 text-sm text-muted'
        }">
            ${badge}
            <span class="text-xs min-w-0">${
                idLabel('Work order', item.id)
            }</span>
        </div>
    </div>`;
}

// What the left box draws for the pressed pill: both
// lists, claimed first; the claimed list alone; the
// archive alone; or both lists narrowed to one flow.
export function inboxSectionsOf(
    lists: InboxLists,
    pressed: PressedPill,
): InboxSection[] {
    if (pressed.kind === 'claimed') {
        return [{ kind: 'claimed', items: lists.claimed }];
    }
    if (pressed.kind === 'archivedByMe') {
        return [{
            kind: 'archivedByMe', items: lists.archivedByMe,
        }];
    }
    if (pressed.kind === 'flow') {
        return [
            {
                kind: 'claimed',
                items: inFlow(lists.claimed, pressed.flowName),
            },
            {
                kind: 'available',
                items: inFlow(
                    lists.available, pressed.flowName,
                ),
            },
        ];
    }
    return [
        { kind: 'claimed', items: lists.claimed },
        { kind: 'available', items: lists.available },
    ];
}

function inFlow(
    items: readonly InboxItem[],
    flowName: string,
): InboxItem[] {
    return items.filter((item) => item.flowName === flowName);
}

// The headed lists; an empty one keeps its heading and
// says so.
export function buildInboxLists(
    sections: readonly InboxSection[],
    filter: InboxFilter,
    pressed: PressedPill,
): SafeHtml {
    return html`${sections.map(
        (section, index) => buildInboxSection(
            section, index === 0, filter, pressed,
        ),
    )}`;
}

function buildInboxSection(
    section: InboxSection,
    first: boolean,
    filter: InboxFilter,
    pressed: PressedPill,
): SafeHtml {
    const rows = section.items.length === 0
        ? html`<p class="text-muted">${
            emptyCopyOf(section.kind, filter, pressed)
        }</p>`
        : buildRows(section, filter, Date.now());
    return html`<h2 class="${
        first
            ? 'workbox-section-title mb-3'
            : 'workbox-section-title mt-6 mb-3'
    }" data-section="${section.kind}">${
        LIST_TITLE[section.kind]
    } <span class="text-muted">${section.items.length}</span></h2>
    <div
        id="${LIST_ID[section.kind]}"
        class="flex flex-col gap-3"
        data-inbox-list="${section.kind}">${rows}</div>`;
}

// Available work reads in groups by how long it has
// waited. A search keeps its best-match order, so its
// answer is not grouped.
function buildRows(
    section: InboxSection,
    filter: InboxFilter,
    nowMs: number,
): SafeHtml {
    const rows = (items: readonly InboxItem[]) => html`${
        items.map((item) => buildInboxRow(item, nowMs))
    }`;
    if (section.kind !== 'available' || filter.kind !== 'none') {
        return rows(section.items);
    }
    return html`${WAIT_GROUPS.map((group) => {
        const items = section.items.filter(
            (item) => waitOf(item, nowMs) === group.level,
        );
        return items.length === 0
            ? html``
            : html`<h3 class="workbox-group-title"
                data-group="${group.level}"><span
                class="workbox-group-name">${group.title}</span>
                <span>${items.length}</span> <span
                class="workbox-group-hint">${group.hint}</span></h3>${
                rows(items)
            }`;
    })}`;
}

// A search's empty line names its text; under a flow pill
// a list's own line names the flow.
function emptyCopyOf(
    kind: InboxListKind,
    filter: InboxFilter,
    pressed: PressedPill,
): string {
    if (filter.kind === 'matched') {
        return 'No work orders match “' + filter.text + '”';
    }
    if (pressed.kind === 'flow') {
        return EMPTY_COPY[kind] + ' in ' + pressed.flowName;
    }
    return EMPTY_COPY[kind];
}

function archiveNode(
    wo: WorkOrder,
): boolean {
    const node = wo.flowGraph.nodes.find(
        n => n.id === wo.nodeId,
    );
    return node?.isArchive === true;
}

function toItem(wo: WorkOrder): InboxItem {
    const fg = wo.flowGraph;
    const curNode = fg.nodes.find(
        n => n.id === wo.nodeId,
    );
    const row = {
        id: wo.id,
        flowName: fg.name,
        transitionerName: null as string | null,
        claimedByName: null as string | null,
        lastTransitionedAt: wo.transition.at,
    };
    return curNode
        ? {
            kind: 'placed',
            ...row,
            stateName: curNode.name,
            completed: curNode.isArchive,
            taskInstructions:
                curNode.taskInstructions,
        }
        : { kind: 'unplaced', ...row };
}

function byAtAsc(
    a: InboxItem, b: InboxItem,
): number {
    return (a.lastTransitionedAt ?? '')
        .localeCompare(
            b.lastTransitionedAt ?? '',
        );
}

function byAtDesc(
    a: InboxItem, b: InboxItem,
): number {
    return byAtAsc(b, a);
}

// Each work order into the list its membership rules name,
// in the order given: a QUERY answer keeps its best match
// first.
export function partitionInboxItems(
    workOrders: readonly WorkOrder[],
    activeClaimsByWo:
        ReadonlyMap<Id, ActiveClaim>,
    currentMemberId: Id,
): InboxLists {
    const available: InboxItem[] = [];
    const claimed: InboxItem[] = [];
    const archivedByMe: InboxItem[] = [];
    for (const wo of workOrders) {
        if (archiveNode(wo)) {
            if (
                wo.transition.memberId
                    === currentMemberId
            ) {
                archivedByMe.push(toItem(wo));
            }
            continue;
        }
        const live = activeClaimsByWo.get(wo.id);
        if (live) {
            if (live.memberId === currentMemberId) {
                claimed.push(toItem(wo));
            }
            continue;
        }
        available.push(toItem(wo));
    }
    return { available, claimed, archivedByMe };
}

export function buildInboxItems(
    workOrders: readonly WorkOrder[],
    activeClaimsByWo:
        ReadonlyMap<Id, ActiveClaim>,
    currentMemberId: Id,
): InboxLists {
    const lists = partitionInboxItems(
        workOrders, activeClaimsByWo, currentMemberId,
    );
    return {
        available: lists.available.toSorted(byAtAsc),
        claimed: lists.claimed.toSorted(byAtAsc),
        archivedByMe:
            lists.archivedByMe.toSorted(byAtDesc),
    };
}
