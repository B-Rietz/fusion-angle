import {
    $, $required, getRequiredAttribute,
    populateIcons,
} from '../app/dom.ts';
import { createPageAbort } from '../app/page-lifecycle.ts';
import { html, setHtml } from '../app/safe-html.ts';
import { reportFault } from '../app/error-helpers.ts';
import {
    buildSkeleton,
    loadInto,
} from '../app/loading-states.ts';
import {
    bindCrossTab,
    subscribeOnce,
} from '../../client/channels.ts';
import { handlePageLoadError } from '../app/page-loader.ts';
import {
    ICON_SIZE,
    iconPlus, iconLightbulb,
} from '../app/icons.ts';
import { navigateTo } from '../app/navigation.ts';
import {
    getIdeas,
    getIdeaSubmissions,
    ideaOf,
    putIdea,
    subscribeIdeaChanges,
    type IdeaSubmission,
} from '../../client/index.ts';
import { sessionContext } from '../app/client.ts';
import {
    isIdeaState, documentFieldsOf, type Idea,
} from '../../shared/types.ts';
import {
    IdeaListPresenter,
    buildInitialIdeaListState,
    applyIdeaListUpdate,
    applyIdeaFilterToggle,
    applyIdeaSubmission,
    buildIdeaReadinessSlot,
    buildIdeaSubmitterSlot,
    type IdeaListState,
} from '../app/presenters/index.ts';
import {
    initDragReorder,
} from '../app/drag-reorder.ts';

const { signal } = createPageAbort();

let ideaState: IdeaListState | null = null;
let listEl: HTMLElement | null = null;
let badgesEl: HTMLElement | null = null;

export async function init(): Promise<void> {
    const listen = bindCrossTab();
    const teamListEl = $required(
        '#ideas-list', document,
    );

    const ctx = sessionContext();
    await loadInto({
        container: teamListEl,
        skeleton: buildSkeleton('card-list', 4),
        fetch: () => getIdeas(ctx),
        retry: init,
        emptyState: {
            icon: iconLightbulb(ICON_SIZE['2xl'], ''),
            title: 'No Ideas Yet',
            description:
                'Start innovating by creating'
                + ' your first idea.',
            action: {
                label: html`${iconPlus(ICON_SIZE.base, '')}
                    Create Your First Idea`,
                href: 'create.html',
            },
            onEmpty: () => {
                $(
                    '#create-idea-btn', document,
                )?.classList.add('hidden');
                // Same-tab notify() paints subscribers of
                // subscribeIdeaChanges. An empty list
                // waits for another tab's bell instead,
                // so a write in this tab does not wake it.
                subscribeOnce(
                    listen, init,
                    err => handlePageLoadError(
                        'ideas', err,
                    ),
                );
            },
        },
        onData: ideas => onIdeasLoaded(
            ideas, teamListEl,
        ),
    });

    populateIcons([
        ['#create-btn-icon', iconPlus(ICON_SIZE.base, '')],
    ]);

    $('#create-idea-btn', document)
        ?.addEventListener(
            'click',
            () => navigateTo('idea-create'),
            { signal },
        );
}

// Each card's submission lands on its own read after the
// list paints; an idea already holding one keeps it.
function fillSubmissions(ideas: readonly Idea[]): void {
    if (!ideaState) return;
    const known = ideaState.submissions;
    const ctx = sessionContext();
    const pending = getIdeaSubmissions(
        ctx,
        ideas.map(idea => idea.idForLink())
            .filter(id => !known.has(id)),
    );
    let faulted = false;
    for (const [id, submission] of pending) {
        submission.then(
            settled => {
                if (!ideaState) return;
                ideaState = applyIdeaSubmission(
                    ideaState, id, settled,
                );
                paintSubmission(id, settled);
            },
            err => {
                if (faulted) return;
                faulted = true;
                reportFault(
                    ctx, 'Failed to load idea submissions', err,
                );
            },
        );
    }
}

function paintSubmission(
    id: string, submission: IdeaSubmission,
): void {
    const idea = ideaState?.ideas
        .find(i => i.idForLink() === id);
    if (!listEl || !idea) return;
    const submitter = $(
        `[data-idea-submitter="${id}"]`, listEl,
    );
    if (submitter) {
        setHtml(submitter, buildIdeaSubmitterSlot(submission));
    }
    const readiness = $(
        `[data-idea-readiness="${id}"]`, listEl,
    );
    if (readiness) {
        setHtml(
            readiness,
            buildIdeaReadinessSlot(idea, submission),
        );
    }
}

function onIdeasLoaded(
    ideas: Idea[],
    teamListEl: HTMLElement,
): void {
    // The button is static markup: the empty render hides it
    // (onEmpty) and a populated one shows it again, so the
    // empty→populated re-init keeps its CTA.
    $('#create-idea-btn', document)
        ?.classList.remove('hidden');
    ideaState = buildInitialIdeaListState(ideas);
    listEl = teamListEl;
    badgesEl = $(
        '#status-badges', document,
    );

    rerenderIdeas();
    fillSubmissions(ideas);
    if (badgesEl) {
        badgesEl.addEventListener(
            'click', onBadgeClick,
            { signal },
        );
    }
    listEl.addEventListener(
        'click', onCardClick,
        { signal },
    );

    subscribeIdeaChanges(async () => {
        if (!ideaState || !listEl) return;
        const updated = await getIdeas(
            sessionContext(),
        );
        ideaState = applyIdeaListUpdate(
            ideaState, updated,
        );
        rerenderIdeas();
        fillSubmissions(updated);
    });

    initDragReorder(
        listEl,
        '[data-idea-card]',
        'data-idea-card',
        async (id, newPosition) => {
            if (!ideaState) return;
            const held = ideaState.ideas
                .find(idea => idea.idForLink() === id);
            if (!held) return;
            const saved = await putIdea(
                sessionContext(), held.message,
                {
                    ...documentFieldsOf(held.message),
                    position: newPosition,
                },
            );
            // The next drag of this card latches the head this
            // save made, not the one it replaced.
            if (!ideaState) return;
            ideaState = applyIdeaListUpdate(
                ideaState,
                ideaState.ideas.map(idea =>
                    idea.idForLink() === id
                        ? ideaOf(saved)
                        : idea),
            );
        },
    );
}

function rerenderIdeas(): void {
    if (!ideaState || !listEl) return;
    const presenter =
        new IdeaListPresenter(ideaState);
    if (badgesEl) {
        presenter.renderBadges(badgesEl);
    }
    presenter.renderList(listEl);
}

function onBadgeClick(e: MouseEvent): void {
    if (
        !ideaState || !badgesEl || !listEl
    ) return;
    if (
        !(e.target instanceof HTMLElement)
    ) return;
    const badge = e.target.closest<HTMLElement>(
        '[data-state]',
    );
    if (!badge) return;
    const s = getRequiredAttribute(badge, 'data-state');
    if (!isIdeaState(s)) return;
    ideaState = applyIdeaFilterToggle(
        ideaState, s,
    );
    rerenderIdeas();
}

function onCardClick(e: MouseEvent): void {
    if (
        !(e.target instanceof Element)
    ) return;
    // Real links navigate themselves, and
    // the reorder handle is not navigation.
    if (e.target.closest(
        'a[href], .drag-handle',
    )) return;
    const convertBtn = e.target
        .closest<HTMLElement>(
            '[data-idea-convert]',
        );
    if (convertBtn) {
        navigateTo('idea-convert', {
            ideaId: getRequiredAttribute(
                convertBtn,
                'data-idea-convert',
            ),
            from: 'list',
        });
        return;
    }
    const card = e.target.closest<HTMLElement>(
        '[data-idea-card]',
    );
    if (card) {
        navigateTo('idea-detail', {
            ideaId: getRequiredAttribute(
                card, 'data-idea-card',
            ),
        });
    }
}
