import { html, type SafeHtml } from '../app/safe-html.ts';

// Colour for reading, with no library. Each token is
// wrapped in a span whose class names its kind, and every
// character of the text stays, in order, so the text
// content is the text given. Every token is escaped.

// The class that paints a token as the text around it.
const PLAIN = '';

const STRING_CLASS = 'tok-string';
const VARIABLE_CLASS = 'tok-var';

function spanHtml(className: string, text: string): SafeHtml | string {
    return className === PLAIN
        ? text
        : html`<span class="${className}">${text}</span>`;
}

// Each pattern below names its kinds as groups, and a
// match fills exactly one.
function kindOf(match: RegExpExecArray): string {
    const [kind] = Object.entries(match.groups!)
        .find(([, text]) => text !== undefined)!;
    return kind;
}

// JSON's tokens, once `JSON.parse` has accepted the text:
// a string followed by a colon is a key, and white space
// paints plain.
const JSON_TOKENS = new RegExp([
    '(?<plain>\\s+)',
    '(?<key>"(?:[^"\\\\]|\\\\.)*"(?=\\s*:))',
    '(?<string>"(?:[^"\\\\]|\\\\.)*")',
    '(?<number>-?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)',
    '(?<literal>true|false|null)',
    '(?<punct>[{}\\[\\],:])',
].join('|'), 'gy');

const JSON_CLASSES: Readonly<Record<string, string>> = {
    plain: PLAIN,
    key: 'tok-key',
    string: STRING_CLASS,
    number: 'tok-number',
    literal: 'tok-literal',
    punct: 'tok-punct',
};

function isJson(text: string): boolean {
    try {
        JSON.parse(text);
    } catch {
        return false;
    }
    return true;
}

// A JSON body coloured by token; text that is not JSON
// stays plain.
export function jsonHtml(text: string): SafeHtml {
    if (!isJson(text)) return html`${text}`;
    return html`${[...text.matchAll(JSON_TOKENS)].map((match) =>
        spanHtml(JSON_CLASSES[kindOf(match)]!, match[0])
    )}`;
}

// A placeholder the reader sets in their shell.
const SHELL_VARIABLE = /\$[A-Z_][A-Z0-9_]*/g;

// The curl text's shell tokens. A double-quoted string
// expands the placeholders inside it; a single-quoted one
// expands nothing. A backslash keeps the next character
// out of any quote, a flag opens a word, and anything
// else, an unclosed quote included, paints plain.
const CURL_TOKENS = new RegExp([
    '(?<double>"(?:[^"\\\\]|\\\\[\\s\\S])*")',
    '(?<single>\'[^\']*\')',
    '(?<escape>\\\\[\\s\\S])',
    '(?<variable>\\$[A-Z_][A-Z0-9_]*)',
    '(?<flag>(?<!\\S)--?[A-Za-z][A-Za-z0-9-]*)',
    '(?<plain>[^"\'\\\\$\\s]+|\\s+|[\\s\\S])',
].join('|'), 'gy');

const CURL_CLASSES: Readonly<Record<string, string>> = {
    single: STRING_CLASS,
    escape: PLAIN,
    variable: VARIABLE_CLASS,
    flag: 'tok-flag',
    plain: PLAIN,
};

// A double-quoted string with each placeholder in it
// marked.
function doubleQuotedHtml(text: string): SafeHtml {
    const pieces: (SafeHtml | string)[] = [];
    let from = 0;
    for (const variable of text.matchAll(SHELL_VARIABLE)) {
        pieces.push(text.slice(from, variable.index));
        pieces.push(spanHtml(VARIABLE_CLASS, variable[0]));
        from = variable.index + variable[0].length;
    }
    pieces.push(text.slice(from));
    return html`<span class="${STRING_CLASS}">${pieces}</span>`;
}

// A curl command coloured by shell token.
export function curlHtml(text: string): SafeHtml {
    return html`${[...text.matchAll(CURL_TOKENS)].map((match) => {
        const kind = kindOf(match);
        return kind === 'double'
            ? doubleQuotedHtml(match[0])
            : spanHtml(CURL_CLASSES[kind]!, match[0]);
    })}`;
}
