import { assertStrictEquals } from '@std/assert';
import { handleRequest } from '../../api/api.ts';
import { buildMembers } from
    '../../api/mock-data/members.ts';
import { STARK_ORGANIZATION } from
    '../../api/mock-data/seed-constants.ts';
import { generateIdentifier } from
    '../../shared/identifier.ts';
import { apiRequest } from '../http-fixtures.ts';
import { organizationToken } from '../token-fixtures.ts';
import {
    adminToken, SECOND_EMAIL, useBrowser, withAdminPage,
    type Origin, type Page,
} from './fixtures.ts';
import { registryUrl } from
    '../../web-app/app/browser-drive.ts';

const browser = useBrowser();

// The idea is the document and its submission a
// sub-document. A create that lost its submission
// write leaves the idea alone; it reads as Incomplete
// and takes no page down with it.
async function putIdeaWithoutSubmission(
    origin: Origin, token: string,
): Promise<string> {
    const ideaId = generateIdentifier();
    const res = await handleRequest(origin.db, apiRequest({
        method: 'PUT',
        path: `/organizations/${STARK_ORGANIZATION}`
            + `/ideas/${ideaId}`,
        token,
        body: {
            title: 'Lost submission',
            position: 1,
            problem_statement: 'p',
            target_users: 't',
            proposed_solution: 's',
            expected_outcome: 'o',
            success_metrics: 'm',
            state: 'active',
        },
    }));
    assertStrictEquals(res.status, 201);
    return ideaId;
}

async function secondMemberToken(): Promise<string> {
    const second = buildMembers().find(
        (m) => m.email === SECOND_EMAIL,
    );
    if (second === undefined) {
        throw new Error('mock seed has no second member');
    }
    return organizationToken(second.id, STARK_ORGANIZATION);
}

async function openDetail(
    page: Page, origin: Origin, ideaId: string,
): Promise<void> {
    await page.navigate(
        registryUrl(
            origin.baseUrl, 'idea-detail',
            'ideaId=' + ideaId,
        ),
    );
}

// Markup indentation rides textContent, so whitespace
// runs collapse before the match.
function detailIncludes(text: string): string {
    return `document.querySelector('#idea-detail-content')`
        + `?.textContent.replace(/\\s+/g, ' ')`
        + `.includes(${JSON.stringify(text)})`;
}

Deno.test(
    'the ideas list shows an idea with no submission'
    + ' as incomplete',
    async () => {
        await withAdminPage(
            browser.get(),
            async (page, origin) => {
                const ideaId = await putIdeaWithoutSubmission(
                    origin, await adminToken(),
                );
                await page.navigate(
                    registryUrl(origin.baseUrl, 'ideas'),
                );
                await page.ready('ideas');
                await page.until(
                    `document.querySelector(`
                    + `'[data-idea-readiness="${ideaId}"]')`
                    + `?.textContent.includes('Incomplete')`,
                    'incomplete card',
                );
            },
        );
    },
);

Deno.test(
    'an idea with no submission opens as incomplete',
    async () => {
        await withAdminPage(
            browser.get(),
            async (page, origin) => {
                const ideaId = await putIdeaWithoutSubmission(
                    origin, await adminToken(),
                );
                await openDetail(page, origin, ideaId);
                await page.until(
                    detailIncludes('No submission recorded'),
                    'incomplete detail',
                );
            },
        );
    },
);

// Whoever saves it, the submission names the member who
// created the idea.
Deno.test(
    'saving an incomplete idea records its creator',
    async () => {
        await withAdminPage(
            browser.get(),
            async (page, origin) => {
                const ideaId = await putIdeaWithoutSubmission(
                    origin, await secondMemberToken(),
                );
                await openDetail(page, origin, ideaId);
                await page.until(
                    detailIncludes('No submission recorded'),
                    'incomplete detail',
                );
                await page.evaluate(
                    `document.querySelector('#idea-edit-btn')`
                    + `.click()`,
                );
                await page.until(
                    `!!document.querySelector('#idea-save-btn')`,
                    'edit mode',
                );
                await page.evaluate(
                    `document.querySelector('#idea-save-btn')`
                    + `.click()`,
                );
                await page.until(
                    detailIncludes('Submitted by Sarah Chen'),
                    'recorded submission',
                );
            },
        );
    },
);
