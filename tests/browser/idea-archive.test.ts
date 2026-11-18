import { assertStrictEquals } from '@std/assert';
import { handleRequest } from '../../api/api.ts';
import { STARK_ORGANIZATION } from
    '../../api/mock-data/seed-constants.ts';
import { generateIdentifier } from
    '../../shared/identifier.ts';
import { apiRequest } from '../http-fixtures.ts';
import {
    adminToken, useBrowser, withAdminPage,
    type Origin,
} from './fixtures.ts';
import { registryUrl } from
    '../../web-app/app/browser-drive.ts';

const browser = useBrowser();

function ideaPath(ideaId: string): string {
    return `/organizations/${STARK_ORGANIZATION}`
        + `/ideas/${ideaId}`;
}

async function putActiveIdea(
    origin: Origin, token: string,
): Promise<string> {
    const ideaId = generateIdentifier();
    const res = await handleRequest(origin.db, apiRequest({
        method: 'PUT',
        path: ideaPath(ideaId),
        token,
        body: {
            title: 'Archive me',
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

async function ideaState(
    origin: Origin, token: string, ideaId: string,
): Promise<string> {
    const res = await handleRequest(origin.db, apiRequest({
        method: 'GET', path: ideaPath(ideaId), token,
    }));
    const body = await res.json() as { state: string };
    return body.state;
}

// Archive asks first, then the idea leaves the list.
Deno.test(
    'archiving an idea takes it off the ideas list',
    async () => {
        await withAdminPage(
            browser.get(),
            async (page, origin) => {
                const token = await adminToken();
                const ideaId = await putActiveIdea(
                    origin, token,
                );
                await page.navigate(registryUrl(
                    origin.baseUrl, 'idea-detail',
                    'ideaId=' + ideaId,
                ));
                await page.waitFor('#idea-archive-btn');
                await page.evaluate(
                    `document.querySelector('#idea-archive-btn')`
                    + `.click()`,
                );
                await page.until(
                    `document.querySelector(`
                    + `'#idea-archive-dialog')?.open`,
                    'archive dialog',
                );
                await page.evaluate(
                    `document.querySelector(`
                    + `'#idea-archive-confirm').click()`,
                );
                await page.ready('ideas');
                await page.until(
                    `!document.querySelector(`
                    + `'[data-idea-card="${ideaId}"]')`
                    + ` && !!document.querySelector(`
                    + `'[data-idea-card]')`,
                    'list without the archived idea',
                );
                assertStrictEquals(
                    await ideaState(origin, token, ideaId),
                    'archived',
                );
            },
        );
    },
);
