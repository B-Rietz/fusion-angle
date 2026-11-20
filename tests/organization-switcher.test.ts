import {
    assert,
    assertMatch,
    assertStrictEquals,
} from '@std/assert';
import {
    STORAGE_KEY_PENDING_TOAST,
} from '../web-app/app/storage-keys.ts';
import { captureConsole } from './fixtures/console-capture.ts';
import { withLocalStorage } from './fixtures/local-storage.ts';

// The switcher moves through window.location.href
// (putLocation) and paints toasts into document and
// sessionStorage. Stub them before the module loads.
const fakeLocation = { href: '' };
// @ts-expect-error — browser global stub
globalThis.window = { location: fakeLocation };

const {
    organizationSwitcherHtml,
    switchToOrganization,
    chooseOrganization,
} = await import(
    '../web-app/app/organization-switcher.ts'
);

const TWO = [
    { id: 'AjdvjuECVZEgZoFajaIEkg', name: 'Stark' },
    { id: 'BBjWJsjYIDkTRKIIPrzWRw', name: 'Wayne' },
];

Deno.test(
    'organizationSwitcherHtml renders the switcher',
    () => {
        const out = organizationSwitcherHtml(TWO)
            .toString();
        assertMatch(out, /class="org-switcher"/);
        assertMatch(
            out,
            /aria-label="Switch organization"/,
        );
        assertStrictEquals(
            out.includes('org-set-default'),
            false,
        );
        assertStrictEquals(
            out.includes('Set as default'),
            false,
        );
        assertStrictEquals(
            out.includes('org-switcher-group'),
            false,
        );
    },
);

Deno.test(
    'the switcher module does not set a default',
    () => {
        const src = Deno.readTextFileSync(
            'web-app/app/organization-switcher.ts',
        );
        assertStrictEquals(
            src.includes('org-set-default'),
            false,
        );
        assertStrictEquals(
            src.includes('Set as default'),
            false,
        );
        assertStrictEquals(
            src.includes(
                'putIdentityDefaultOrganization',
            ),
            false,
        );
        assertMatch(src, /\$\$\('\.org-switcher'/);
        const css = Deno.readTextFileSync(
            'web-app/app/styles/'
            + 'components-organization-switcher.css',
        );
        assertStrictEquals(
            css.includes('org-set-default'),
            false,
        );
        assertStrictEquals(
            css.includes('org-switcher-group'),
            false,
        );
    },
);

Deno.test('organizationSwitcherHtml renders an option per org', () => {
    const out = organizationSwitcherHtml(TWO).toString();
    assertMatch(out, /value="AjdvjuECVZEgZoFajaIEkg"/);
    assertMatch(out, /value="BBjWJsjYIDkTRKIIPrzWRw"/);
});

Deno.test('organizationSwitcherHtml is empty below two orgs', () => {
    assertStrictEquals(
        organizationSwitcherHtml([{ id: 'AjdvjuECVZEgZoFajaIEkg'
            , name: 'Stark' }])
            .toString(),
        '');
});

const WAYNE = 'BBjWJsjYIDkTRKIIPrzWRw';
const ACTIVE_KEY = 'fusion-angle:active-organization-id';

function installToastDom(): Map<string, string> {
    const store = new Map<string, string>();
    const g = globalThis as Record<string, unknown>;
    g.sessionStorage = {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
            store.set(k, v);
        },
        removeItem: (k: string) => { store.delete(k); },
    };
    function el(): Record<string, unknown> {
        const node: Record<string, unknown> = {
            className: '',
            children: [] as unknown[],
            lastElementChild: null,
            style: {},
            textContent: '',
            classList: { add: () => {} },
            setAttribute: () => {},
            addEventListener: () => {},
            prepend: () => {},
            appendChild: (child: unknown) => child,
            remove: () => {},
        };
        return node;
    }
    let container: unknown = null;
    g.document = {
        getElementById: () => container,
        createElement: () => el(),
        body: {
            appendChild(child: unknown) {
                container = child;
                return child;
            },
        },
    };
    return store;
}

function withToastDom(
    body: (store: Map<string, string>) => void,
): void {
    const g = globalThis as Record<string, unknown>;
    const previousTimeout = g.setTimeout;
    g.setTimeout = () => 0;
    const store = installToastDom();
    fakeLocation.href = '';
    try {
        body(store);
    } finally {
        g.setTimeout = previousTimeout;
        delete g.sessionStorage;
        delete g.document;
    }
}

Deno.test(
    'a confirmed switch persists, then enters from'
    + ' the root',
    () => {
        withToastDom(() => {
            const recorded = new Map<string, string>();
            withLocalStorage({
                setItem: (k: string, v: string) => {
                    recorded.set(k, v);
                },
            }, () => {
                chooseOrganization(WAYNE);
            });
            assertStrictEquals(
                recorded.get(ACTIVE_KEY),
                WAYNE,
            );
            assertStrictEquals(fakeLocation.href, '/');
        });
    },
);

Deno.test(
    'a refused switch toasts and stays',
    async () => {
        const { calls } = await captureConsole('warn', () => {
            withToastDom((session) => {
                withLocalStorage({
                    getItem: () => null,
                    setItem: () => {
                        throw new DOMException(
                            'full',
                            'QuotaExceededError',
                        );
                    },
                }, () => {
                    chooseOrganization(WAYNE);
                });
                assertStrictEquals(fakeLocation.href, '');
                const raw = session.get(
                    STORAGE_KEY_PENDING_TOAST,
                );
                assert(raw);
                assertMatch(
                    raw!,
                    /Could not switch organization — please try again\./,
                );
            });
        });
        assertStrictEquals(calls.length, 1);
    },
);

Deno.test(
    'switchToOrganization moves only after the persist',
    () => {
        withToastDom(() => {
            const recorded = new Map<string, string>();
            let moves = 0;
            let seen: string | undefined;
            withLocalStorage({
                setItem: (k: string, v: string) => {
                    recorded.set(k, v);
                },
            }, () => {
                switchToOrganization(WAYNE, () => {
                    moves += 1;
                    seen = recorded.get(ACTIVE_KEY);
                });
            });
            assertStrictEquals(seen, WAYNE);
            assertStrictEquals(moves, 1);
        });
    },
);
