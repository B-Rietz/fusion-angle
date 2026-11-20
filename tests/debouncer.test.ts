import { assertEquals, assertStrictEquals } from '@std/assert';
import { FakeTime } from '@std/testing/time';
import { withLocalStorage } from
    './fixtures/local-storage.ts';
import {
    Debouncer,
} from '../web-app/app/debouncer.ts';

// debouncer.ts -> logger.ts -> preferences.ts reads
// localStorage lazily, only when a log.* call fires.
const NULL_STORAGE: Partial<Storage> = {
    getItem: (_key: string) => null,
    setItem: () => {},
};

Deno.test(
    'schedule waits the delay; the last scheduled'
    + ' save wins the burst',
    () => withLocalStorage(NULL_STORAGE, () => {
        using time = new FakeTime();
        const d = new Debouncer(800);
        const ran: string[] = [];
        d.schedule('name', () => ran.push('first'));
        d.schedule('name', () => ran.push('second'));
        time.tick(799);
        assertEquals(ran, []);
        time.tick(1);
        assertEquals(ran, ['second']);
    }),
);

Deno.test(
    'flush runs the pending save immediately and'
    + ' cancels the timer — no double fire',
    () => withLocalStorage(NULL_STORAGE, () => {
        using time = new FakeTime();
        const d = new Debouncer(800);
        let runs = 0;
        d.schedule('name', () => { runs += 1; });
        d.flush();
        assertStrictEquals(runs, 1);
        time.tick(800);
        assertStrictEquals(runs, 1);
    }),
);

Deno.test(
    'flush with nothing pending is a no-op',
    () => withLocalStorage(NULL_STORAGE, () => {
        using time = new FakeTime();
        const d = new Debouncer(800);
        let runs = 0;
        // Empty flush invents no save and leaves the
        // debouncer ready for a later schedule.
        d.flush();
        assertStrictEquals(runs, 0);
        d.schedule('name', () => { runs += 1; });
        time.tick(800);
        assertStrictEquals(runs, 1);
    }),
);

Deno.test(
    'a fired save clears pending — a later flush'
    + ' does not replay it',
    () => withLocalStorage(NULL_STORAGE, () => {
        using time = new FakeTime();
        const d = new Debouncer(800);
        let runs = 0;
        d.schedule('name', () => { runs += 1; });
        time.tick(800);
        assertStrictEquals(runs, 1);
        d.flush();
        assertStrictEquals(runs, 1);
    }),
);

Deno.test(
    'schedule after a fire starts a fresh burst',
    () => withLocalStorage(NULL_STORAGE, () => {
        using time = new FakeTime();
        const d = new Debouncer(800);
        const ran: string[] = [];
        d.schedule('name', () => ran.push('a'));
        time.tick(800);
        d.schedule('name', () => ran.push('b'));
        time.tick(800);
        assertEquals(ran, ['a', 'b']);
    }),
);

Deno.test(
    'isPending tracks a scheduled save until fire'
    + ' or flush',
    () => withLocalStorage(NULL_STORAGE, () => {
        using time = new FakeTime();
        const d = new Debouncer(800);
        assertStrictEquals(d.isPending(), false);
        d.schedule('name', () => {});
        assertStrictEquals(d.isPending(), true);
        time.tick(800);
        assertStrictEquals(d.isPending(), false);
        d.schedule('name', () => {});
        assertStrictEquals(d.isPending(), true);
        d.flush();
        assertStrictEquals(d.isPending(), false);
    }),
);

// A burst keeps only its latest save, so a second field
// sharing the burst would drop the first field's edit.
Deno.test(
    'a save for another field first runs the one'
    + ' pending',
    () => withLocalStorage(NULL_STORAGE, () => {
        using time = new FakeTime();
        const d = new Debouncer(800);
        const ran: string[] = [];
        d.schedule('name', () => ran.push('name'));
        d.schedule(
            'instructions', () => ran.push('instructions'),
        );
        assertEquals(ran, ['name']);
        time.tick(800);
        assertEquals(ran, ['name', 'instructions']);
    }),
);
