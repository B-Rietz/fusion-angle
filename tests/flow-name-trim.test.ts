import {
    assertStrictEquals,
} from '@std/assert';
import {
    caretAfterTrim,
    writeTrimmedName,
    type NameField,
} from '../web-app/flows/detail.ts';

function field(
    value: string,
    start: number | null,
    end: number | null = start,
): NameField & { calls: number } {
    return {
        value,
        selectionStart: start,
        selectionEnd: end,
        calls: 0,
        setSelectionRange(
            this: NameField & { calls: number },
            selectionStart: number,
            selectionEnd: number,
        ): void {
            this.calls += 1;
            this.selectionStart = selectionStart;
            this.selectionEnd = selectionEnd;
        },
    };
}

Deno.test(
    'caretAfterTrim parks a caret in the cut ends'
    + ' and keeps one inside the text',
    () => {
        const raw = '  Hello  ';
        assertStrictEquals(caretAfterTrim(raw, 0), 0);
        assertStrictEquals(caretAfterTrim(raw, 1), 0);
        assertStrictEquals(caretAfterTrim(raw, 2), 0);
        assertStrictEquals(caretAfterTrim(raw, 4), 2);
        assertStrictEquals(caretAfterTrim(raw, 7), 5);
        assertStrictEquals(caretAfterTrim(raw, 9), 5);
        assertStrictEquals(
            caretAfterTrim('Hello ', 6), 5,
        );
        assertStrictEquals(
            caretAfterTrim('   ', 2), 0,
        );
        assertStrictEquals(
            caretAfterTrim('Hello', 3), 3,
        );
    },
);

Deno.test(
    'writeTrimmedName writes the trimmed name and'
    + ' the mapped caret',
    () => {
        const input = field('  Hello  ', 1, 8);
        writeTrimmedName(input, '  Hello  ');
        assertStrictEquals(input.value, 'Hello');
        assertStrictEquals(input.selectionStart, 0);
        assertStrictEquals(input.selectionEnd, 5);
        assertStrictEquals(input.calls, 1);
    },
);

Deno.test(
    'writeTrimmedName leaves a name that is already'
    + ' trimmed, and a field the user has since'
    + ' changed',
    () => {
        const kept = field('Hello', 2);
        writeTrimmedName(kept, 'Hello');
        assertStrictEquals(kept.value, 'Hello');
        assertStrictEquals(kept.selectionStart, 2);
        assertStrictEquals(kept.calls, 0);
        const newer = field('Hello!', 6);
        writeTrimmedName(newer, 'Hello ');
        assertStrictEquals(newer.value, 'Hello!');
        assertStrictEquals(newer.calls, 0);
    },
);

Deno.test(
    'writeTrimmedName treats a missing caret as the'
    + ' end of the raw name',
    () => {
        const input = field('Hello ', null, null);
        writeTrimmedName(input, 'Hello ');
        assertStrictEquals(input.value, 'Hello');
        assertStrictEquals(input.selectionStart, 5);
        assertStrictEquals(input.selectionEnd, 5);
    },
);
