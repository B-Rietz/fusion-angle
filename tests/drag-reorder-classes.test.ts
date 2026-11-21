import { assertEquals, assertStrictEquals } from '@std/assert';
import { cssDeclaration } from './fixtures/css-declaration.ts';
import { initDragReorder } from
    '../web-app/app/drag-reorder.ts';

const SHEET = Deno.readTextFileSync(
    'web-app/app/styles/components-drag.css',
);

Deno.test(
    'the drop line and dragged card use'
    + ' shared classes',
    () => {
        assertEquals(
            cssDeclaration(
                SHEET, '.drag-drop-indicator', 'height',
            ),
            '3px',
        );
        assertEquals(
            cssDeclaration(
                SHEET, '.drag-drop-indicator', 'margin',
            ),
            '2px 0',
        );
        assertEquals(
            cssDeclaration(
                SHEET,
                '.drag-drop-indicator',
                'pointer-events',
            ),
            'none',
        );
        assertEquals(
            cssDeclaration(
                SHEET,
                '.drag-drop-indicator',
                'border-radius',
            ),
            '2px',
        );
        assertEquals(
            cssDeclaration(
                SHEET,
                '.drag-drop-indicator',
                'background',
            ),
            'hsl(var(--primary))',
        );
        assertEquals(
            cssDeclaration(
                SHEET, '.is-dragging', 'opacity',
            ),
            '0.4',
        );
    },
);

type FakeEvent = {
    type: string;
    target: Fake;
    button: number;
    pointerId: number;
    clientX: number;
    clientY: number;
    preventDefault(): void;
    stopImmediatePropagation(): void;
};

type Fake = {
    parent: Fake | null;
    children: Fake[];
    attrs: Record<string, string>;
    classes: Set<string>;
    style: Record<string, string>;
    className: string;
    classList: {
        add(name: string): void;
        remove(name: string): void;
    };
    getAttribute(name: string): string | null;
    setAttribute(name: string, value: string): void;
    closest(selector: string): Fake | null;
    querySelectorAll(selector: string): Fake[];
    getBoundingClientRect(): { top: number; height: number };
    addEventListener(
        type: string,
        fn: (e: FakeEvent) => void,
    ): void;
    insertBefore(node: Fake, ref: Fake): void;
    appendChild(node: Fake): Fake;
    insertAdjacentElement(where: string, el: Fake): Fake;
    remove(): void;
    setPointerCapture(_id: number): void;
    fire(type: string, target: Fake, y: number): void;
};

function matches(node: Fake, selector: string): boolean {
    if (selector.startsWith('.')) {
        return node.classes.has(selector.slice(1));
    }
    const attr = /^\[([^\]]+)\]$/.exec(selector);
    if (!attr) return false;
    return Object.hasOwn(node.attrs, attr[1]!);
}

function detach(node: Fake): void {
    const parent = node.parent;
    if (!parent) return;
    const i = parent.children.indexOf(node);
    if (i >= 0) parent.children.splice(i, 1);
    node.parent = null;
}

function fake(
    top = 0,
    height = 0,
): Fake {
    const classes = new Set<string>();
    const listeners = new Map<
        string,
        Array<(e: FakeEvent) => void>
    >();
    const node: Fake = {
        parent: null,
        children: [],
        attrs: {},
        classes,
        style: { transform: '' },
        get className() {
            return [...classes].join(' ');
        },
        set className(value: string) {
            classes.clear();
            for (const name of value.split(/\s+/)) {
                if (name) classes.add(name);
            }
        },
        classList: {
            add(name) { classes.add(name); },
            remove(name) { classes.delete(name); },
        },
        getAttribute(name) {
            return node.attrs[name] ?? null;
        },
        setAttribute(name, value) {
            node.attrs[name] = value;
        },
        closest(selector) {
            let cur: Fake | null = node;
            while (cur) {
                if (matches(cur, selector)) return cur;
                cur = cur.parent;
            }
            return null;
        },
        querySelectorAll(selector) {
            const out: Fake[] = [];
            for (const child of node.children) {
                if (matches(child, selector)) {
                    out.push(child);
                }
                out.push(
                    ...child.querySelectorAll(selector),
                );
            }
            return out;
        },
        getBoundingClientRect() {
            return { top, height };
        },
        addEventListener(type, fn) {
            const fns = listeners.get(type);
            if (fns === undefined) {
                listeners.set(type, [fn]);
                return;
            }
            fns.push(fn);
        },
        insertBefore(child, ref) {
            detach(child);
            const i = node.children.indexOf(ref);
            if (i < 0) node.children.push(child);
            else node.children.splice(i, 0, child);
            child.parent = node;
        },
        appendChild(child) {
            detach(child);
            node.children.push(child);
            child.parent = node;
            return child;
        },
        insertAdjacentElement(_where, el) {
            return el;
        },
        remove() { detach(node); },
        setPointerCapture() {},
        fire(type, target, y) {
            const event: FakeEvent = {
                type,
                target,
                button: 0,
                pointerId: 1,
                clientX: 0,
                clientY: y,
                preventDefault() {},
                stopImmediatePropagation() {},
            };
            for (const fn of listeners.get(type) ?? []) {
                fn(event);
            }
        },
    };
    return node;
}

function attach(parent: Fake, child: Fake): void {
    parent.appendChild(child);
}

const CARD = '[data-idea-card]';

function list(): {
    root: Fake;
    card: Fake;
    handle: Fake;
} {
    const root = fake();
    const card = fake(0, 100);
    card.setAttribute('data-idea-card', 'idea-1');
    card.setAttribute('data-position', '1');
    const handle = fake();
    handle.className = 'drag-handle';
    const next = fake(100, 100);
    next.setAttribute('data-idea-card', 'idea-2');
    next.setAttribute('data-position', '2');
    const grip = fake();
    grip.className = 'drag-handle';
    attach(card, handle);
    attach(next, grip);
    attach(root, card);
    attach(root, next);
    return { root, card, handle };
}

function withDom(body: () => void): void {
    const g = globalThis as Record<string, unknown>;
    const previousDocument = g.document;
    const previousObserver = g['MutationObserver'];
    g.document = {
        createElement: () => fake(),
    };
    g['MutationObserver'] = class {
        observe(): void {}
    };
    try {
        body();
    } finally {
        if (previousDocument === undefined) {
            delete g.document;
        } else {
            g.document = previousDocument;
        }
        if (previousObserver === undefined) {
            delete g['MutationObserver'];
        } else {
            g['MutationObserver'] = previousObserver;
        }
    }
}

function indicator(root: Fake): Fake | undefined {
    return root.children.find((child) =>
        child.classes.has('drag-drop-indicator'),
    );
}

Deno.test(
    'a drag classes the line and the card,'
    + ' and the pointer slide stays',
    () => {
        withDom(() => {
            const { root, card, handle } = list();
            const landed: number[] = [];
            initDragReorder(
                root as unknown as HTMLElement,
                CARD,
                'data-idea-card',
                (_id, position) => {
                    landed.push(position);
                },
            );
            root.fire('pointerdown', handle, 10);
            assertEquals(
                card.classes.has('is-dragging'), true,
            );
            assertEquals(card.style.opacity, undefined);
            root.fire('pointermove', handle, 120);
            const line = indicator(root);
            if (!line) {
                throw new Error(
                    'drop line missing',
                );
            }
            assertEquals(root.children[1], line);
            assertEquals(line.style.height, undefined);
            assertEquals(
                line.style.background, undefined,
            );
            assertEquals(
                card.style.transform,
                'translateY(110px)',
            );
            root.fire('pointerup', handle, 120);
            assertEquals(indicator(root), undefined);
            assertEquals(
                card.classes.has('is-dragging'), false,
            );
            assertEquals(card.style.transform, '');
            assertEquals(landed, [1.5]);
        });
    },
);

Deno.test(
    'a cancelled drag clears the class'
    + ' and the line',
    () => {
        withDom(() => {
            const { root, card, handle } = list();
            let landed = 0;
            initDragReorder(
                root as unknown as HTMLElement,
                CARD,
                'data-idea-card',
                () => { landed += 1; },
            );
            root.fire('pointerdown', handle, 10);
            root.fire('pointermove', handle, 120);
            root.fire('pointercancel', handle, 120);
            assertEquals(indicator(root), undefined);
            assertEquals(
                card.classes.has('is-dragging'), false,
            );
            assertEquals(card.style.transform, '');
            assertStrictEquals(landed, 0);
        });
    },
);
