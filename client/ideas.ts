import type {
    IdeaEntity,
    IdeaState,
    Member,
    MemberId,
    IdeaSubmissionEntity,
    ObjectiveId,
    ProjectEntity,
    ProjectState,
} from '../shared/types.ts';
import {
    Idea, nowUtc,
    ideaIsVisible,
    assertIdeaState,
    documentFieldsOf,
} from '../shared/types.ts';
import type { HttpMessage } from
    '../shared/http-message/http-message.ts';
import type { RequestContext } from './request-context.ts';
import {
    organizationCollection,
    organizationItem,
} from './request-context.ts';
import {
    getCurrentHumanMember,
} from './members.ts';
import {
    getMemberMap,
    memberName,
} from './members-union.ts';
import {
    notifyProjectChange,
} from './projects.ts';
import {
    notifyProjectScoreChange,
} from './project-scoring.ts';
import {
    generateIdentifier,
} from '../shared/identifier.ts';
import {
    createSubscriptionChannel,
} from './channels.ts';

const ideaChanges =
    createSubscriptionChannel();

export function subscribeIdeaChanges(
    fn: () => void,
): () => void {
    return ideaChanges.subscribe(fn);
}

export function getIdeaEntities(
    ctx: RequestContext,
): Promise<HttpMessage<IdeaEntity>[]> {
    return ctx.GETCollection<IdeaEntity>(
        organizationCollection(ctx, 'ideas'),
    );
}

export function getIdeaEntity(
    ctx: RequestContext,
    id: string,
): Promise<HttpMessage<IdeaEntity>> {
    return ctx.GET<IdeaEntity>(
        organizationItem(ctx, 'ideas', id),
    );
}

// The submissions for ONE idea — the server filters the nested
// collection to the parent idea, so no client filter is needed.
async function getIdeaSubmissionsForIdea(
    ctx: RequestContext,
    ideaId: string,
): Promise<IdeaSubmissionEntity[]> {
    return (await ctx.GETCollection<IdeaSubmissionEntity>(
        organizationItem(ctx, 'ideas', ideaId)
            + '/submissions/',
    )).map((m) => m.body().toValue());
}

// The idea is the document; its submission is a
// sub-document written after it. A create that lost the
// second write leaves the idea with no submission, which
// reads as missing, never as a failed idea.
export type IdeaSubmission =
    | {
        readonly kind: 'recorded';
        readonly submitterName: string;
        readonly at: string;
    }
    | { readonly kind: 'missing' };

export interface IdeaWithSubmission {
    readonly idea: Idea;
    readonly submission: IdeaSubmission;
}

// Domain state rides the IdeaEntity GET row; narrow it once,
// at the wire.
function ideaStateOf(row: IdeaEntity): IdeaState {
    return assertIdeaState(row.state, 'idea ' + row.id);
}

export function ideaOf(message: HttpMessage<IdeaEntity>): Idea {
    return new Idea(
        message, ideaStateOf(message.body().toValue()),
    );
}

function ideaSubmissionOf(
    rows: readonly IdeaSubmissionEntity[],
    memberMap: Map<MemberId, Member>,
): IdeaSubmission {
    const [found] = rows;
    if (!found) return { kind: 'missing' };
    return {
        kind: 'recorded',
        submitterName: memberName(memberMap, found.member_id),
        at: found.at,
    };
}

async function getIdeaSubmission(
    ctx: RequestContext,
    ideaId: string,
    memberMap: Promise<Map<MemberId, Member>>,
): Promise<IdeaSubmission> {
    const rows = await getIdeaSubmissionsForIdea(ctx, ideaId);
    return ideaSubmissionOf(rows, await memberMap);
}

// The visible idea documents alone: one read, so the list
// paints before any submission lands.
export async function getIdeas(
    ctx: RequestContext,
): Promise<Idea[]> {
    return (await getIdeaEntities(ctx))
        .map(ideaOf)
        .filter(idea => ideaIsVisible(idea.stateValue()));
}

// One pending submission per idea, settling independently
// over one shared member map, so each card fills as its
// own read lands.
export function getIdeaSubmissions(
    ctx: RequestContext,
    ideaIds: readonly string[],
): ReadonlyMap<string, Promise<IdeaSubmission>> {
    const memberMap = getMemberMap(ctx);
    // A submission read that fails before awaiting the
    // map, or an empty id list, leaves no one to hear the
    // map's rejection but this guard.
    memberMap.catch(() => {});
    return new Map(ideaIds.map(id => [
        id, getIdeaSubmission(ctx, id, memberMap),
    ]));
}

export async function getIdea(
    ctx: RequestContext,
    ideaId: string,
): Promise<IdeaWithSubmission> {
    // Every read settles before this call does: a rejection
    // must not leave its siblings running past the caller.
    const [messageRead, rowsRead, memberRead] =
        await Promise.allSettled([
            getIdeaEntity(ctx, ideaId),
            getIdeaSubmissionsForIdea(ctx, ideaId),
            getMemberMap(ctx),
        ]);
    if (messageRead.status === 'rejected') {
        throw messageRead.reason;
    }
    if (rowsRead.status === 'rejected') throw rowsRead.reason;
    if (memberRead.status === 'rejected') {
        throw memberRead.reason;
    }
    return {
        idea: ideaOf(messageRead.value),
        submission: ideaSubmissionOf(
            rowsRead.value, memberRead.value,
        ),
    };
}

// Every stored version of one idea, oldest first.
export function getIdeaVersions(
    ctx: RequestContext,
    ideaId: string,
): Promise<HttpMessage<IdeaEntity>[]> {
    return ctx.GETCollection<IdeaEntity>(
        organizationItem(ctx, 'ideas', ideaId) + '/versions/',
    );
}

// The wire document PUT /ideas/:id takes today's entity
// fields plus state, snake_case as the wire carries them.
// organization_id is EXCLUDED too — the client never
// supplies it (the organization fence stamps it downstream):
// postIdeaCreation's fresh entity lacks it by type, and an
// edit/transition builds its body with documentFieldsOf,
// which strips the held read's id and organization_id. A
// state-UNCHANGED save (title/position/etc. edited, state
// echoed back unchanged) converges to a no-op event write at
// the op; a genuine transition (postIdeaStateChange below)
// sends a new state. Genesis (postIdeaCreation below) is just
// the head-absent case of this SAME PUT — one shape serves
// create, edit, and transition.
export type IdeaDocumentFields =
    Omit<
        IdeaEntity,
        | 'id'
        | 'organization_id'
    >;

// A save from the held idea names the head it replaces, so
// a write over a newer head is refused rather than lost.
export async function putIdea(
    ctx: RequestContext,
    held: HttpMessage<IdeaEntity>,
    document: IdeaDocumentFields,
): Promise<HttpMessage<IdeaEntity>> {
    const saved = await ctx.PUT<IdeaEntity>(
        organizationItem(ctx, 'ideas', held.body().toValue().id),
        document,
        [held],
    );
    ideaChanges.notify();
    return saved;
}

// Idea creation: genesis is head-presence-defined — the FIRST
// document version at this document IS the birth, so create
// is the SAME PUT ideas/:id that putIdea drives for edits and
// transitions, with no head to latch: the id is fresh. The id
// and state are minted ONCE here, before the single ctx.PUT
// hop — a retry resends the identical bytes, which the
// statement matches against the head and stores nothing.
// Use only at the create call site;
// transitions of an existing idea go through
// postIdeaStateChange; putIdea remains for entity edits
// (title, position) that do not change state.
export async function postIdeaCreation(
    ctx: RequestContext,
    id: string,
    entity: Omit<
        IdeaEntity,
        | 'id'
        | 'organization_id'
        | 'state'
    >,
    initialState: IdeaState,
): Promise<HttpMessage<IdeaEntity>> {
    const created = await ctx.PUT<IdeaEntity>(
        organizationItem(ctx, 'ideas', id),
        { ...entity, state: initialState },
    );
    ideaChanges.notify();
    return created;
}

// A transition: composes the document PUT with a FRESH state
// (mint-once-reuse — a retry of the SAME transition resends
// this same pinned pair, converging at the op) over the
// held idea's entity fields — hop count 1 → 1 (one ctx.PUT,
// via putIdea, latched on the held idea). The new state
// replaces the held one, so it is the only lifecycle value in
// the PUT body.
export function postIdeaStateChange(
    ctx: RequestContext,
    held: HttpMessage<IdeaEntity>,
    state: IdeaState,
): Promise<HttpMessage<IdeaEntity>> {
    return putIdea(ctx, held, { ...documentFieldsOf(held), state });
}

function putIdeaSubmissionOf(
    ctx: RequestContext,
    submissionId: string,
    ideaId: string,
    memberId: MemberId,
    at: string,
): Promise<HttpMessage<IdeaSubmissionEntity>> {
    return ctx.PUT<IdeaSubmissionEntity>(
        organizationItem(ctx, 'ideas', ideaId)
            + '/submissions/' + submissionId,
        { idea_id: ideaId, member_id: memberId, at },
    );
}

export async function putIdeaSubmission(
    ctx: RequestContext,
    submissionId: string,
    ideaId: string,
): Promise<HttpMessage<IdeaSubmissionEntity>> {
    const member = await getCurrentHumanMember(ctx);
    return putIdeaSubmissionOf(
        ctx, submissionId, ideaId, member.id, nowUtc(),
    );
}

// A create whose submission write was lost is finished
// later: the idea's first version names who created it,
// and when, whoever records it now.
export async function putIdeaGenesisSubmission(
    ctx: RequestContext,
    ideaId: string,
): Promise<HttpMessage<IdeaSubmissionEntity>> {
    const [genesis] = await getIdeaVersions(ctx, ideaId);
    if (genesis === undefined) {
        throw new Error('Idea has no versions: ' + ideaId);
    }
    const saved = await putIdeaSubmissionOf(
        ctx, generateIdentifier(), ideaId,
        genesis.query('header.requester-identity-id').toText(),
        genesis.query('header.response-at').toText(),
    );
    ideaChanges.notify();
    return saved;
}

function assertConversionFullyScored(
    activeObjectiveIds: readonly ObjectiveId[],
    scoredObjectiveIds: readonly ObjectiveId[],
): void {
    const scored = new Set(scoredObjectiveIds);
    const missing = activeObjectiveIds.filter(
        id => !scored.has(id),
    );
    if (missing.length > 0) {
        throw new Error(
            'idea conversion requires a baseline'
            + ' score for every active objective;'
            + ' ' + missing.length + ' missing',
        );
    }
}

// Idea conversion (idea→project promotion): the LONE
// cross-aggregate write, composed by the named POST
// /ideas/:id/conversion into ONE statement. A
// new project row, the promoted idea row, two state events
// (the idea moves to 'promoted', the new project enters at
// its initial state), and the N per-objective baseline
// scores all commit together — a new project never exists
// without its initial baselines, nor an idea promoted
// without its project. The web-app derives the bodies and
// mints every id (project, the two events, each baseline);
// authorship of both events is stamped server-side from the
// verified token. The project body OMITS organization_id —
// the org fence stamps it before the store re-validates.
export async function postIdeaConversion(
    ctx: RequestContext,
    held: HttpMessage<IdeaEntity>,
    projectId: string,
    project: Omit<
        ProjectEntity,
        | 'id'
        | 'organization_id'
        | 'state'
    >,
    projectState: ProjectState,
    promotedIdea: Omit<
        IdeaEntity,
        | 'id'
        | 'organization_id'
        | 'state'
    >,
    baselines: readonly {
        objectiveId: ObjectiveId;
        score: number;
    }[],
    activeObjectiveIds: readonly ObjectiveId[],
): Promise<void> {
    assertConversionFullyScored(
        activeObjectiveIds,
        baselines.map(b => b.objectiveId),
    );
    type AnyBody = Record<string, unknown>;
    // Mint idea at FIRST so it is strictly less than project at
    // (nowUtc is monotonic — the second call is always greater).
    // The ledger's latest-wins total order requires distinct values.
    const ideaStateAt = nowUtc();
    const projectStateAt = nowUtc();
    const member = await getCurrentHumanMember(ctx);
    // The conversion is an operation on the held idea: it
    // names the head the page holds, so a 412 surfaces as
    // RequestError.
    await ctx.POST(
        organizationItem(ctx, 'ideas', held.body().toValue().id)
            + '/conversion',
        {
        projectId,
        project: project as unknown as AnyBody,
        idea: promotedIdea as unknown as AnyBody,
        ideaStateEventId: generateIdentifier(),
        ideaState: 'promoted',
        ideaStateAt,
        projectStateEventId: generateIdentifier(),
        projectState,
        projectStateAt,
        baselines: baselines.map(b => ({
            id: generateIdentifier(),
            fields: {
                project_id: projectId,
                objective_id: b.objectiveId,
                score: b.score,
                member_id: member.id,
                at: ideaStateAt,
            },
        })),
    }, [held]);
    notifyProjectChange();
    notifyProjectScoreChange();
    ideaChanges.notify();
}
