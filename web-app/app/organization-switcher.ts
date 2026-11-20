import { html, type SafeHtml } from './safe-html.ts';
import { $$ } from './dom.ts';
import {
    shouldShowOrganizationSwitcher,
    ACTIVE_ORGANIZATION_ID,
} from '../../client/organization-session.ts';
import { putPreference } from './adapters/preferences.ts';
import { putLocation } from './adapters/location.ts';
import { showToast } from './toast.ts';

interface OrganizationOption {
    readonly id: string;
    readonly name: string;
}

// The current-organization select. Empty unless there
// are two or more reachable organizations. The active
// organization is selected after render in
// wireOrganizationSwitcher, so options carry no
// selected attribute. This menu switches and enters from the root.
// It does not set the default organization.
export function organizationSwitcherHtml(
    organizations: readonly OrganizationOption[],
): SafeHtml {
    if (!shouldShowOrganizationSwitcher(
        organizations,
    )) {
        return html``;
    }
    const options = organizations.map(
        organization => html`<option value="${
            organization.id
        }">${organization.name}</option>`,
    );
    return html`<select
        class="org-switcher"
        aria-label="Switch organization">${
        options
    }</select>`;
}

// Persist the chosen organization, then move. Boot
// re-exchanges a scoped token from the persisted id,
// so no mixed view survives. A false return means the
// id never landed, so the toast fires and the page
// never moves.
export function switchToOrganization(
    organization: string,
    move: () => void,
): void {
    if (!putPreference(ACTIVE_ORGANIZATION_ID, organization)) {
        showToast(
            'Could not switch organization —'
            + ' please try again.',
            'error',
        );
        return;
    }
    move();
}

// The switcher's choice: switch, then enter from the
// top at '/', which lands on the Dashboard.
export function chooseOrganization(
    organization: string,
): void {
    switchToOrganization(
        organization,
        () => putLocation('/'),
    );
}

// Select the active organization and wire every
// .org-switcher. A change enters through
// chooseOrganization.
export function wireOrganizationSwitcher(
    activeOrganizationId: string,
): void {
    for (const el of $$('.org-switcher', document)) {
        if (!(el instanceof HTMLSelectElement)) {
            continue;
        }
        el.value = activeOrganizationId;
        el.addEventListener('change', () => {
            chooseOrganization(el.value);
        });
    }
}
