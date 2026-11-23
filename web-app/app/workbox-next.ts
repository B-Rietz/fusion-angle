import type { WorkOrder } from '../../client/index.ts';
import type { Id } from '../../shared/types.ts';
import type { InboxSection } from
    './presenters/workbox-inbox.ts';

// Where the work order box goes after a transition. The
// roster decides only this; the lists still show the
// organization's whole pool (TODO.md item 11a).

// The node the work order now sits at is a step I can do:
// not an archive node, and its roster names me. A head
// whose node its graph no longer holds is no one's step.
export function stepIsMine(
    workOrder: Pick<WorkOrder, 'flowGraph' | 'nodeId'>,
    memberId: Id,
): boolean {
    const node = workOrder.flowGraph.nodes.find(
        (n) => n.id === workOrder.nodeId,
    );
    return node !== undefined
        && !node.isArchive
        && node.memberIds.includes(memberId);
}

export type NextWorkOrder =
    | { readonly kind: 'open'; readonly id: string }
    | { readonly kind: 'close' };

// The topmost row that can be opened, as the left box
// draws its lists: the claimed list's first, else the
// available list's first, never the work order just sent
// on. An unplaced row cannot be opened. Under Archived by
// Me neither list is drawn, so the box closes.
export function nextWorkOrder(
    sections: readonly InboxSection[],
    sentOn: string,
): NextWorkOrder {
    for (const kind of ['claimed', 'available'] as const) {
        const next = sections
            .find((section) => section.kind === kind)
            ?.items.find(
                (item) => item.kind === 'placed'
                    && item.id !== sentOn,
            );
        if (next !== undefined) {
            return { kind: 'open', id: next.id };
        }
    }
    return { kind: 'close' };
}
