import type { RequestContext } from '../../client/request-context.ts';
import { getFlowWithGraph } from
    '../../client/flow-queries.ts';
import { getWorkOrderEntities } from
    '../../client/work-orders-queries.ts';
import { getRecordForFlow } from
    '../../client/flow-records.ts';
import {
    postWorkOrderCreation,
    type WorkOrderCreationInput,
} from '../../client/work-orders-mutations.ts';
import {
    formatFlowProblem,
    validateFlowForCreation,
} from './flow-publish.ts';
import { nextPosition } from './drag-reorder-positions.ts';
import { generateIdentifier } from
    '../../shared/identifier.ts';

// A work order starts from a flow the app judges ready, at
// the end of the list, bound to a fresh instance of the
// record type its flow names: read all three, judge, place,
// mint, then post.
export async function createWorkOrderFromFlow(
    ctx: RequestContext,
    input: WorkOrderCreationInput,
): Promise<void> {
    const [flow, existing, recordTypeId] = await Promise.all([
        getFlowWithGraph(ctx, input.flowId),
        getWorkOrderEntities(ctx),
        getRecordForFlow(ctx, input.flowId),
    ]);
    const readiness = validateFlowForCreation(flow);
    if (!readiness.ready) {
        throw new Error(
            'flow not ready: '
            + readiness.problems
                .map(formatFlowProblem)
                .join('; '),
        );
    }
    await postWorkOrderCreation(ctx, {
        ...input,
        flow,
        position: nextPosition(
            existing.map((w) => w.body().toValue().position),
        ),
        instance: recordTypeId === null
            ? { kind: 'none' }
            : {
                kind: 'minted',
                instanceId: generateIdentifier(),
                recordTypeId,
            },
    });
}
