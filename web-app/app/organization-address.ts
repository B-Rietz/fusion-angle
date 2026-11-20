// `resolvePageArrival` and `resolveOrganizationMismatch` decide
// the boot decision table. The first needs no I/O. Only a
// mismatch fetches rows, and the fresh rows decide the second.

export const ORGANIZATION_PARAM = 'organization';

export type PageArrival =
    | { readonly kind: 'proceed' }
    | { readonly kind: 'mismatch';
        readonly organization: string };

export type OrganizationMismatch =
    | 'switch-offer'
    | 'no-access';

export function resolvePageArrival(
    urlOrganization: string | null,
    activeOrganization: string,
): PageArrival {
    if (
        urlOrganization === null ||
        urlOrganization === activeOrganization
    ) {
        return { kind: 'proceed' };
    }
    return {
        kind: 'mismatch',
        organization: urlOrganization,
    };
}

export function resolveOrganizationMismatch(
    organization: string,
    reachable: readonly string[],
): OrganizationMismatch {
    return reachable.includes(organization)
        ? 'switch-offer'
        : 'no-access';
}

export function stampOrganization(
    href: string,
    organization: string,
): string {
    const url = new URL(href);
    url.searchParams.set(ORGANIZATION_PARAM, organization);
    // A leading '//' reads as a protocol-relative URL to another
    // host, which history.replaceState refuses.
    url.pathname = url.pathname.replace(/^\/{2,}/, '/');
    return url.pathname + url.search + url.hash;
}
