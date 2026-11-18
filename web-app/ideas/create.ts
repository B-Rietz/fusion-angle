import {
    $input, $required, $textarea,
    bindEnterToClick,
} from '../app/dom.ts';
import {
    setHtml,
} from '../app/safe-html.ts';
import { showToast } from '../app/toast.ts';
import { navigateTo } from '../app/navigation.ts';
import {
    getIdeaEntities,
    postIdeaCreation,
    putIdeaSubmission,
} from '../../client/index.ts';
import { sessionContext } from '../app/client.ts';
import { reportFault } from '../app/error-helpers.ts';
import type {
    RequestContext,
} from '../../client/request-context.ts';
import { generateIdentifier } from '../../shared/identifier.ts';
import {
    nextPosition,
} from '../app/drag-reorder-positions.ts';
import {
    IdeaCreatePresenter,
    EMPTY_IDEA_CREATE_DRAFT,
    ideaCreateDraftIsComplete,
} from '../app/presenters/index.ts';
import type {
    IdeaCreateDraft,
} from '../app/presenters/index.ts';

async function createIdea(
    ctx: RequestContext,
    ideaId: string,
    draft: IdeaCreateDraft,
): Promise<void> {
    const existing = await getIdeaEntities(ctx);
    const position = nextPosition(
        existing.map(m => m.body().toValue().position),
    );
    await postIdeaCreation(
        ctx,
        ideaId,
        {
            title: draft.title,
            problem_statement: draft.problemStatement,
            target_users: draft.targetUsers,
            proposed_solution: draft.proposedSolution,
            expected_outcome: draft.expectedOutcome,
            success_metrics: draft.successMetrics,
            position,
        },
        'active',
    );
}

export async function init():
    Promise<void> {
    let formState: IdeaCreateDraft = {
        ...EMPTY_IDEA_CREATE_DRAFT,
    };

    function renderPage(): void {
        const root = $required(
            '#create-content', document,
        );
        setHtml(
            root,
            new IdeaCreatePresenter(formState)
                .render(),
        );
        bindEvents();
    }

    function readFormFromDom(
    ): IdeaCreateDraft {
        return {
            title:
                $input(
                    '#idea-create'
                    + '-field-title',
                    document,
                )!.value.trim(),
            problemStatement:
                $textarea(
                    '#idea-create'
                    + '-field'
                    + '-problem',
                    document,
                )!.value.trim(),
            targetUsers:
                $input(
                    '#idea-create'
                    + '-field'
                    + '-target',
                    document,
                )!.value.trim(),
            proposedSolution:
                $textarea(
                    '#idea-create'
                    + '-field'
                    + '-solution',
                    document,
                )!.value.trim(),
            expectedOutcome:
                $textarea(
                    '#idea-create'
                    + '-field'
                    + '-outcome',
                    document,
                )!.value.trim(),
            successMetrics:
                $textarea(
                    '#idea-create'
                    + '-field'
                    + '-metrics',
                    document,
                )!.value.trim(),
        };
    }

    function bindEvents(): void {
        const goBack = () => {
            navigateTo('ideas');
        };

        $required(
            '#idea-create-back-btn',
            document,
        ).addEventListener(
            'click', goBack,
        );
        $required(
            '#idea-create-step-back',
            document,
        ).addEventListener(
            'click', goBack,
        );

        $required(
            '#idea-create-step-next',
            document,
        ).addEventListener(
            'click',
            async () => {
                formState = readFormFromDom();
                if (
                    !ideaCreateDraftIsComplete(
                        formState,
                    )
                ) {
                    showToast(
                        'Title, problem,'
                            + ' solution, and'
                            + ' outcome are'
                            + ' required',
                        'error',
                    );
                    return;
                }
                const ctx = sessionContext();
                const ideaId =
                    generateIdentifier();
                // Two writes, so each failure names its
                // step: a lost submission leaves the idea.
                try {
                    await createIdea(ctx, ideaId, formState);
                } catch (err) {
                    reportFault(
                        ctx, 'Failed to create idea', err,
                    );
                    return;
                }
                try {
                    await putIdeaSubmission(
                        ctx,
                        generateIdentifier(),
                        ideaId,
                    );
                } catch (err) {
                    reportFault(
                        ctx,
                        'Idea ' + ideaId + ' created, but'
                            + ' failed to record its'
                            + ' submission',
                        err,
                    );
                    return;
                }
                navigateTo('ideas');
            },
        );

        const nextSel =
            '#idea-create-step-next';
        bindEnterToClick(
            '#idea-create-field-title',
            nextSel,
            document,
        );
    }

    renderPage();
}
