import { assertEquals } from '@std/assert';

// No file under api/ or server/ reads a request header but
// through requestHeaderOf or requestFieldOf, the accessors in
// api/request-header-names.ts, which is exempt whole. Every
// .ts file in both trees is scanned, so a file added tomorrow
// is covered the day it lands; an unreadable one fails the
// walk. Lines whose trimmed start is // or * are dropped, and
// the rest is scanned joined, so a call split across lines
// still matches. A read is one of three shapes:
// 1. a receiver ending in headers, then .get(, .has(,
//    .forEach(, .entries(, .keys(, .values(, or .getSetCookie,
//    with ?. allowed;
// 2. such a receiver iterated, spread, or copied: of …,
//    ..., new Headers(…, or Object.fromEntries(…;
// 3. a field line compared by name, as equality only:
//    .name === or === x.name.
// A receiver read off a binding named response is a response
// read and never counts: response headers are read off
// `response`. Shape 3 sees any .name equality, header or not;
// a new one is rewritten or exempted with a reason.
// apiRequest (server/http-server.ts) is the second whole
// pass: it hands the Headers on as a value, which no shape
// matches.
// Blind spots, which the accessors' declared-header type and
// review cover; the scanner sees none of them:
// - a Headers bound to a name that does not end in headers;
// - a by-name read written as an inequality;
// - a name transformed before ===, as in
//   field.name.toLowerCase() === 'cookie';
// - a destructured or bare name binding, as in
//   fields.find(({ name }) => name === 'cookie');
// - a switch on a name: switch (field.name) { case … };
// - a Headers read as Array.from(request.headers);
// - bracket access: request.headers['get'](…).

interface DirectRead {
    readonly line: number;
    readonly text: string;
    readonly enclosing: string;
}

// A dotted chain, or a bare name, ending in headers. Group 1.
const RECEIVER = String.raw`(?<![\w$])`
    + String.raw`((?:[\w$]+\s*\??\.\s*)*[\w$]*[hH]eaders)`
    + String.raw`(?![\w$])`;

// Iterated, spread, or copied: the receiver is the operand,
// not the head of a member access.
const OPERAND = RECEIVER + String.raw`(?!\s*\??\.)`;

const READ_SHAPES: readonly RegExp[] = [
    new RegExp(RECEIVER + String.raw`\s*\??\.\s*`
        + String.raw`(?:(?:get|has|forEach|entries|keys|values)`
        + String.raw`\s*\(|getSetCookie\b)`, 'g'),
    new RegExp(String.raw`(?:\bof\s+|\.\.\.\s*`
        + String.raw`|\bnew\s+Headers\s*\(\s*`
        + String.raw`|\bObject\.fromEntries\s*\(\s*)` + OPERAND,
    'g'),
    new RegExp(String.raw`\.name\s*===`
        + String.raw`|===\s*(?:[\w$]+\s*\??\.\s*)+name\b`, 'g'),
];

const RESPONSE_RECEIVER = /\bresponse\s*\??\.\s*headers$/;

const FUNCTION_START =
    /^(?:export\s+)?(?:async\s+)?function\s+([\w$]+)/;

// The top-level function each line sits in: from a column-0
// function line to the next column-0 }. '' at module level.
function enclosingByLine(lines: readonly string[]): string[] {
    const names: string[] = [];
    let current = '';
    for (const line of lines) {
        const start = FUNCTION_START.exec(line);
        if (start) current = start[1]!;
        names.push(current);
        if (line.startsWith('}')) current = '';
    }
    return names;
}

function isComment(line: string): boolean {
    const trimmed = line.trimStart();
    return trimmed.startsWith('//') || trimmed.startsWith('*');
}

function directReadsIn(source: string): readonly DirectRead[] {
    const lines = source.split('\n');
    const enclosing = enclosingByLine(lines);
    const scanned = lines
        .map((line) => isComment(line) ? '' : line)
        .join('\n');
    const reads: DirectRead[] = [];
    for (const shape of READ_SHAPES) {
        for (const match of scanned.matchAll(shape)) {
            const receiver = match[1];
            if (receiver && RESPONSE_RECEIVER.test(receiver)) {
                continue;
            }
            const lineIndex = scanned.slice(0, match.index)
                .split('\n').length - 1;
            reads.push({
                line: lineIndex + 1,
                text: lines[lineIndex]!.trim(),
                enclosing: enclosing[lineIndex]!,
            });
        }
    }
    return reads.sort((a, b) => a.line - b.line);
}

interface ShapeCase {
    readonly snippet: string;
    readonly reads: number;
}

const SHAPE_CASES: readonly ShapeCase[] = [
    { snippet: "request.headers.get('x-new')", reads: 1 },
    { snippet: "const v = request.headers\n    .get('x-new');", reads: 1 },
    { snippet: "request.headers?.get('x-new')", reads: 1 },
    { snippet: 'headers.has(REQUEST_ID_HEADER)', reads: 1 },
    { snippet: 'for (const [n] of request.headers) {}', reads: 1 },
    { snippet: 'const copy = new Headers(request.headers);', reads: 1 },
    { snippet: "fields.find((f) => f.name === 'x-new')", reads: 1 },
    { snippet: "if (slot.name !== '') {}", reads: 0 },
    { snippet: 'if (next.id !== pair.name) {}', reads: 0 },
    {
        snippet:
            'requestHeaderOf(request.headers, REQUEST_HEADERS.xNew)',
        reads: 0,
    },
    { snippet: "response.headers.get('request-id')", reads: 0 },
    { snippet: "response?.headers.has('cache-control')", reads: 0 },
    { snippet: 'new Headers(response.headers)', reads: 0 },
    { snippet: "response.headers.set('ETag', tag)", reads: 0 },
    { snippet: "// request.headers.get('x-new')", reads: 0 },
];

Deno.test('the scanner sees each read shape', () => {
    for (const { snippet, reads } of SHAPE_CASES) {
        assertEquals(directReadsIn(snippet).length, reads, snippet);
    }
});

Deno.test('a read names its enclosing function', () => {
    const source = [
        'function f() {',
        "    return request.headers.get('x-new');",
        '}',
    ].join('\n');
    assertEquals(directReadsIn(source), [{
        line: 2,
        text: "return request.headers.get('x-new');",
        enclosing: 'f',
    }]);
});

const SCANNED_TREES: readonly string[] = ['api', 'server'];

const NAMES_MODULE = 'api/request-header-names.ts';

interface Exemption {
    readonly file: string;
    readonly enclosing: string;
    readonly reason: string;
}

const EXEMPT: readonly Exemption[] = [
    {
        file: 'api/message-pair.ts',
        enclosing: 'requestHeaderFields',
        reason: 'the whole pass: every field line, stored as sent',
    },
    {
        file: 'api/message-pair.ts',
        enclosing: 'currentRequestId',
        reason: "the stored response's own request-id",
    },
];

interface FileRead {
    readonly file: string;
    readonly read: DirectRead;
}

function sourceFiles(dir: string): string[] {
    const files: string[] = [];
    for (const entry of Deno.readDirSync(dir)) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory) {
            files.push(...sourceFiles(path));
        } else if (entry.name.endsWith('.ts')) {
            files.push(path);
        }
    }
    return files;
}

function treeReads(): FileRead[] {
    const files = SCANNED_TREES.flatMap(sourceFiles)
        .filter((file) => file !== NAMES_MODULE)
        .sort();
    return files.flatMap((file) =>
        directReadsIn(Deno.readTextFileSync(file))
            .map((read) => ({ file, read }))
    );
}

function covers(exemption: Exemption, { file, read }: FileRead) {
    return exemption.file === file
        && exemption.enclosing === read.enclosing;
}

Deno.test('no file under api/ or server/ reads a request header '
    + 'directly', () => {
    const direct = treeReads()
        .filter((fileRead) =>
            !EXEMPT.some((exemption) => covers(exemption, fileRead))
        )
        .map(({ file, read }) => `${file}:${read.line} ${read.text}`);
    assertEquals(direct, []);
});

Deno.test('every exemption still reads', () => {
    const reads = treeReads();
    const stale = EXEMPT
        .filter((exemption) =>
            !reads.some((fileRead) => covers(exemption, fileRead))
        )
        .map((exemption) => `${exemption.file} ${exemption.enclosing}`);
    assertEquals(stale, []);
});
