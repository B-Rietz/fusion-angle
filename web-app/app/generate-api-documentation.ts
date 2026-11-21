// Derive API.svg, the catalog, and a replayed sample per
// endpoint and per step of the guided start from the live
// route table. The table is the surface: if it is not on
// routes[], it does not exist.
// Output is deterministic — the pins fix the day, the
// clock, and randomness before this module loads, and the
// ordering is stable — so `--check` can gate staleness.
import { dirname, join } from '@std/path';
import { routes } from '../../api/routes.ts';
import type { Route } from '../../api/routes.ts';
import {
    HTTP_VERBS,
    offeredVerbs,
    uriOf,
} from '../../api/route-surface.ts';
import {
    STATUS_DOCUMENTS,
} from '../../api/http-status-documents.ts';
import { FAMILY_REGISTRY } from
    '../../api/family-registry.ts';
import { INVITATION_STATES } from
    '../../shared/types.ts';
import { credentialFindingsOf } from
    './api-documentation-credentials.ts';
import {
    openReplayStage,
    succeeded,
} from './api-documentation-replay.ts';
import {
    castOf,
    endpointsOf,
    NO_SAMPLE,
    planOf,
    sendPlan,
    sentPathIdsOf,
} from './api-documentation-story.ts';
import type { Endpoint } from './api-documentation-story.ts';
import {
    CURL_ADDS,
    sampleOf,
    SecretLedger,
} from './api-documentation-exchange.ts';
import {
    replayStep,
    STEPS,
} from './api-documentation-guided-start.ts';
import { roomHashOf } from './api-documentation-hash.ts';
import { tierOf } from './api-documentation-tier.ts';
import {
    answersFor,
    GENERIC_ANSWERS,
} from './api-documentation-answers.ts';
import type { AnswerRule } from
    './api-documentation-answers.ts';
import {
    headerSetsOf,
    TRANSPORT_HEADERS,
} from './api-documentation-headers.ts';
import {
    queryParametersOf,
    relatedOf,
} from './api-documentation-related.ts';
import type {
    ApiDocAnswer,
    ApiDocHeaderSet,
    ApiDocQueryParameter,
    ApiDocRoom,
    ApiDocSample,
    ApiDocSampleRef,
    ApiDocStatus,
    ApiDocStep,
    ApiDocTier,
} from '../api-documentation/shapes.ts';

const OUT_ROOT = 'web-app/api-documentation';
const LINE_MAX = 78;
const KEPT_ROOT_NAMES = new Set([
    'index.html',
    'index.ts',
    'presenter.ts',
    'shapes.ts',
]);
const enc = new TextEncoder();

export { roomHashOf, roomPathOf } from
    './api-documentation-hash.ts';

function wrapLine(line: string): string[] {
    if (line.length <= LINE_MAX) return [line];
    const lines: string[] = [];
    let rest = line;
    while (rest.length > LINE_MAX) {
        let cut = rest.lastIndexOf(' ', LINE_MAX);
        if (cut < 1) cut = LINE_MAX;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut).replace(/^ /u, '');
    }
    if (rest !== '') lines.push(rest);
    return lines;
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeXml(s: string): string {
    return escapeHtml(s).replace(/"/g, '&quot;');
}

function formatJson(value: unknown): string {
    const raw = JSON.stringify(value, null, 2);
    return raw.split('\n').flatMap((line) => {
        if (line.length <= LINE_MAX) return [line];
        const m = /^(\s*"[^"]+":\s*)(.*)$/.exec(line);
        if (m && m[1]!.length < LINE_MAX) {
            return [
                m[1]!.trimEnd(),
                '  ' + m[2]!,
            ].flatMap(wrapLine);
        }
        return wrapLine(line);
    }).join('\n');
}

function wireUriOf(resourceUri: string): string {
    return '/api' + resourceUri;
}

function wingNameOf(row: Route): string {
    return row.segments[0] ?? '';
}

function compareUri(a: Route, b: Route): number {
    const left = uriOf(a);
    const right = uriOf(b);
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
}

const VERB_W = 36;
const VERB_GAP = 4;
const PAD = 16;
const ROW_H = 18;
const WING_H = 24;
const LEGEND_H = 22;
const HEADER_H = 16;
const CIRCLE_R = 5;
// Half the diamond's diagonal: about a circle's area.
const DIAMOND_R = 6;
// An open circle's ring, wide enough to read its colour.
const RING_W = 1.5;
const EMPTY = 10;
const URI_SIZE = 8.5;
const CHAR_W = 5.2;
const LEGEND_SIZE = 11;
const WING_SIZE = 12;
const WING_WEIGHT = 700;
const COL_SIZE = 8;
const SANS_FONT = 'ui-sans-serif, system-ui, sans-serif';
const MONO_FONT =
    'ui-monospace, SFMono-Regular, Menlo, monospace';
// CHAR_W budgets a URI_SIZE glyph in MONO_FONT; the
// page's inherited font draws each glyph wider.
const LEGEND_ATTRIBUTES = ' font-family="' + SANS_FONT
    + '" font-size="' + LEGEND_SIZE + '"';
const COL_ATTRIBUTES = ' font-family="' + SANS_FONT
    + '" font-size="' + COL_SIZE + '"'
    + ' text-anchor="middle"';
const WING_ATTRIBUTES = ' font-family="' + SANS_FONT
    + '" font-size="' + WING_SIZE + '"'
    + ' font-weight="' + WING_WEIGHT + '"';
const URI_ATTRIBUTES = ' font-family="' + MONO_FONT
    + '" font-size="' + URI_SIZE + '"';

function verbColumnX(index: number): number {
    return PAD + index * (VERB_W + VERB_GAP);
}

function uriX(): number {
    return verbColumnX(HTTP_VERBS.length) + 8;
}

// An organization-nested family's documents live
// under the organizations wing, which the route
// table already draws. A global family with no wing
// of its own has no route: no verb and no room.
function backingFamiliesOf(
    routeWings: ReadonlySet<string>,
): string[] {
    const families: string[] = [];
    for (const entry of FAMILY_REGISTRY) {
        const first = entry.organizationNested
            ? 'organizations'
            : entry.family;
        if (!routeWings.has(first)) {
            families.push(entry.family);
        }
    }
    families.sort();
    return families;
}

function backingRowText(family: string): string {
    const uri = '/api/' + family + '/';
    if (family !== 'invitations') return uri;
    return uri + ' organization_id identity_id '
        + INVITATION_STATES.join(' ');
}

// Each tier's shape and colour on the grid, so a role
// never rests on colour alone. The legend's glyph draws
// the same shape, as a character reference: the SVG stays
// ASCII, so the generated module's lines measure in bytes
// as they do in characters.
interface TierPaint {
    readonly paint: string;
    readonly glyph: string;
    readonly label: string;
}

const TIER_PAINTS: Readonly<Record<ApiDocTier, TierPaint>> = {
    member: {
        paint: 'hsl(var(--primary))',
        glyph: '&#x25CF;',
        label: 'member and organization admin',
    },
    admin: {
        paint: 'hsl(var(--accent))',
        glyph: '&#x25C6;',
        label: 'organization admin only',
    },
    none: {
        paint: 'hsl(var(--success))',
        glyph: '&#x25CB;',
        label: 'no token',
    },
};

const TIERS: readonly ApiDocTier[] = ['member', 'admin', 'none'];

const OWN_DATA_NOTE =
    "Some member endpoints act only on the caller's own data.";

// An open circle is filled with the surface, so a click
// inside its ring still lands on its link.
function tierShapeOf(
    tier: ApiDocTier,
    cx: number,
    cy: number,
    surface: string,
): string {
    const { paint } = TIER_PAINTS[tier];
    const tierClass = ' class="tier-' + tier + '"';
    switch (tier) {
        case 'member':
            return '<circle' + tierClass + ' fill="' + paint
                + '" cx="' + cx + '" cy="' + cy + '" r="' + CIRCLE_R
                + '"/>';
        case 'admin':
            return '<polygon' + tierClass + ' fill="' + paint
                + '" points="' + [
                    [cx, cy - DIAMOND_R],
                    [cx + DIAMOND_R, cy],
                    [cx, cy + DIAMOND_R],
                    [cx - DIAMOND_R, cy],
                ].map((point) => point.join(',')).join(' ')
                + '"/>';
        case 'none':
            return '<circle' + tierClass + ' fill="' + surface
                + '" stroke="' + paint + '" stroke-width="'
                + RING_W + '" cx="' + cx + '" cy="' + cy
                + '" r="' + CIRCLE_R + '"/>';
    }
}

function tierLegendOf(): string {
    return TIERS.map((tier) => {
        const { paint, glyph, label } = TIER_PAINTS[tier];
        return '<tspan fill="' + paint + '">' + glyph
            + '</tspan> ' + escapeXml(label);
    }).join(' ');
}

export function svgOf(rows: readonly Route[]): string {
    // The page CSP drops this <style> block
    // (style-src 'self'), so each paint and font is
    // also a presentation attribute. hsl(var(--token))
    // resolves on the inline SVG, as on the flow
    // canvas. The style block keeps a standalone
    // API.svg on the same tokens.
    const ink = 'hsl(var(--foreground))';
    const muted = 'hsl(var(--muted-foreground))';
    const surface = 'hsl(var(--background))';
    const wings = new Map<string, Route[]>();
    for (const row of rows) {
        offeredVerbs(row);
        const name = wingNameOf(row);
        const list = wings.get(name);
        if (list) list.push(row);
        else wings.set(name, [row]);
    }
    const wingNames = [...wings.keys()].sort();
    for (const name of wingNames) {
        wings.get(name)!.sort(compareUri);
    }
    const backingFamilies = backingFamiliesOf(
        new Set(wingNames),
    );
    let longest = 0;
    for (const row of rows) {
        longest = Math.max(
            longest,
            wireUriOf(uriOf(row)).length,
        );
    }
    for (const family of backingFamilies) {
        longest = Math.max(
            longest,
            backingRowText(family).length,
        );
    }
    const width = Math.ceil(
        uriX() + longest * CHAR_W + PAD,
    );
    let y = PAD + 12;
    const parts: string[] = [];
    parts.push(
        '  <text class="legend" fill="' + muted
        + '"' + LEGEND_ATTRIBUTES
        + ' x="' + PAD + '" y="'
        + y + '">' + tierLegendOf() + '</text>',
    );
    y += LEGEND_H;
    parts.push(
        '  <text class="legend" fill="' + muted
        + '"' + LEGEND_ATTRIBUTES
        + ' x="' + PAD + '" y="'
        + y + '">' + escapeXml(OWN_DATA_NOTE) + '</text>',
    );
    y += LEGEND_H;
    HTTP_VERBS.forEach((verb, i) => {
        const cx = verbColumnX(i) + VERB_W / 2;
        parts.push(
            '  <text class="col" fill="' + muted
            + '"' + COL_ATTRIBUTES
            + ' x="' + cx + '" y="'
            + y + '">'
            + escapeXml(verb.toUpperCase())
            + '</text>',
        );
    });
    y += HEADER_H;
    for (const name of wingNames) {
        y += 6;
        parts.push(
            '  <text class="wing" fill="' + ink
            + '"' + WING_ATTRIBUTES
            + ' x="' + PAD + '" y="'
            + y + '">' + escapeXml(name) + '</text>',
        );
        y += WING_H - 8;
        for (const row of wings.get(name)!) {
            const verbs = new Set(offeredVerbs(row));
            const uri = wireUriOf(uriOf(row));
            const cy = y;
            HTTP_VERBS.forEach((verb, i) => {
                const cx = verbColumnX(i) + VERB_W / 2;
                if (verbs.has(verb)) {
                    const href = '#' + roomHashOf(
                        verb, row.segments,
                    );
                    const tier = tierOf(row, verb);
                    parts.push(
                        '  <a href="'
                        + escapeXml(href) + '" data-tier="'
                        + tier + '">',
                        '    ' + tierShapeOf(
                            tier, cx, cy, surface,
                        ),
                        '  </a>',
                    );
                } else {
                    const rx = cx - EMPTY / 2;
                    const ry = cy - EMPTY / 2;
                    parts.push(
                        '  <rect class="empty" x="'
                        + rx + '" y="' + ry
                        + '" width="' + EMPTY
                        + '" height="' + EMPTY
                        + '" fill="none"'
                        + ' stroke="' + muted + '"/>',
                    );
                }
            });
            parts.push(
                '  <text class="uri" fill="' + ink
                + '"' + URI_ATTRIBUTES
                + ' x="' + uriX()
                + '" y="' + (cy + 3) + '">'
                + escapeXml(uri) + '</text>',
            );
            y += ROW_H;
        }
        y += 8;
    }
    if (backingFamilies.length > 0) {
        y += 6;
        parts.push(
            '  <text class="wing" fill="' + ink
            + '"' + WING_ATTRIBUTES
            + ' x="' + PAD + '" y="'
            + y + '">' + escapeXml('backing')
            + '</text>',
        );
        y += WING_H - 8;
        for (const family of backingFamilies) {
            const label = backingRowText(family);
            const cy = y;
            for (
                let index = 0;
                index < HTTP_VERBS.length;
                index += 1
            ) {
                const cx = verbColumnX(index)
                    + VERB_W / 2;
                const rx = cx - EMPTY / 2;
                const ry = cy - EMPTY / 2;
                parts.push(
                    '  <rect class="empty" x="'
                    + rx + '" y="' + ry
                    + '" width="' + EMPTY
                    + '" height="' + EMPTY
                    + '" fill="none"'
                    + ' stroke="' + muted + '"/>',
                );
            }
            parts.push(
                '  <text class="uri" fill="' + ink
                + '"' + URI_ATTRIBUTES
                + ' x="' + uriX()
                + '" y="' + (cy + 3) + '">'
                + escapeXml(label) + '</text>',
            );
            y += ROW_H;
        }
        y += 8;
    }
    const height = y + PAD;
    const style = [
        '    <style>',
        '      .legend, .wing, .col { font-family:',
        '        ' + SANS_FONT + ';',
        '      }',
        '      .legend { fill: ' + muted + ';',
        '        font-size: ' + LEGEND_SIZE + 'px; }',
        '      .wing { fill: ' + ink + ';',
        '        font-size: ' + WING_SIZE + 'px;'
        + ' font-weight: ' + WING_WEIGHT + '; }',
        '      .col { fill: ' + muted + ';',
        '        font-size: ' + COL_SIZE + 'px;'
        + ' text-anchor: middle;',
        '      }',
        '      .uri { font-family:',
        '        ' + MONO_FONT + ';',
        '        font-size: ' + URI_SIZE + 'px;',
        '        fill: ' + ink + '; }',
        '      .tier-member { fill: '
        + TIER_PAINTS.member.paint + '; }',
        '      .tier-admin { fill: '
        + TIER_PAINTS.admin.paint + '; }',
        '      .tier-none { fill: ' + surface + ';',
        '        stroke: ' + TIER_PAINTS.none.paint + ';',
        '        stroke-width: ' + RING_W + '; }',
        '      .empty { fill: none;',
        '        stroke: ' + muted + ';',
        '        stroke-width: 1; }',
        '    </style>',
    ];
    return [
        '<svg xmlns="http://www.w3.org/2000/svg" '
        + 'viewBox="0 0 ' + width + ' ' + height
        + '" width="' + width + '" height="'
        + height + '">',
        '  <defs>',
        ...style,
        '  </defs>',
        '  <rect x="0" y="0" width="' + width
        + '" height="' + height
        + '" fill="' + surface + '"/>',
        ...parts,
        '</svg>',
        '',
    ].join('\n');
}

function answerOf({ code, line }: AnswerRule): ApiDocAnswer {
    return { code: String(code), line };
}

// The gate judges a route's query string on its GET and
// its QUERY alone (api/api.ts), so only a read's room
// names the parameters.
function queryOf(
    endpoint: Endpoint,
): readonly ApiDocQueryParameter[] {
    return endpoint.verb === 'get' || endpoint.verb === 'query'
        ? queryParametersOf(endpoint.row)
        : [];
}

// One endpoint's room. `witnessed` is the status its
// sample answered. A room with no sample has none, and
// answersFor lists its verb's class default.
function roomOf(
    endpoint: Endpoint,
    all: readonly Endpoint[],
    sample: ApiDocSampleRef,
    witnessed: number | undefined,
): ApiDocRoom {
    const { row, verb, hash } = endpoint;
    return {
        hash,
        verb: verb.toUpperCase(),
        uri: wireUriOf(uriOf(row)),
        tier: tierOf(row, verb),
        headerSets: headerSetsOf(endpoint),
        query: queryOf(endpoint),
        answers: answersFor(endpoint, witnessed).map(answerOf),
        related: relatedOf(endpoint, all),
        sample,
    };
}

function catalogStatusesOf(): ApiDocStatus[] {
    return STATUS_DOCUMENTS.map((doc) => ({
        hash: 'statuses/' + String(doc.code),
        code: String(doc.code),
        body: doc.body === null
            ? 'empty'
            : formatJson(doc.body),
    }));
}

// Lint measures a line in bytes, so a generated module
// stays ASCII: any other character is written as its \u
// escape, one per UTF-16 code unit.
const NOT_PRINTABLE_ASCII = /[^\x20-\x7e]/g;
const HEXADECIMAL = 16;
const UNICODE_ESCAPE_DIGITS = 4;

function unicodeEscapeOf(unit: string): string {
    return '\\u' + unit.charCodeAt(0).toString(HEXADECIMAL)
        .padStart(UNICODE_ESCAPE_DIGITS, '0');
}

function tsQuoted(chunk: string): string {
    return "'"
        + chunk
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(NOT_PRINTABLE_ASCII, unicodeEscapeOf)
        + "'";
}

function emitConcatLines(
    value: string,
    indent: string,
    trailer = '',
): string[] {
    const lines: string[] = [];
    let offset = 0;
    let first = true;
    const reserve = trailer.length;
    if (value.length === 0) {
        return [indent + tsQuoted('') + trailer];
    }
    while (offset < value.length) {
        const prefix = first ? indent : indent + '+ ';
        let take = Math.min(
            LINE_MAX - prefix.length - 2 - reserve,
            value.length - offset,
        );
        if (take < 1) take = 1;
        let chunk = value.slice(offset, offset + take);
        let quoted = tsQuoted(chunk);
        while (
            prefix.length + quoted.length + reserve
                > LINE_MAX
            && take > 1
        ) {
            take -= 1;
            chunk = value.slice(
                offset, offset + take,
            );
            quoted = tsQuoted(chunk);
        }
        lines.push(prefix + quoted);
        offset += take;
        first = false;
    }
    const last = lines.length - 1;
    lines[last] = lines[last] + trailer;
    return lines;
}

const INDENT = '    ';

function isList(value: unknown): value is readonly unknown[] {
    return Array.isArray(value);
}

function isRecord(
    value: unknown,
): value is Readonly<Record<string, unknown>> {
    return typeof value === 'object' && value !== null;
}

// Text that fits its line stays on it. Longer text is
// folded: a field's below its name, a list item's from
// its own indent.
function emitText(
    text: string,
    indent: string,
    lead: string,
): string[] {
    const one = indent + lead + tsQuoted(text) + ',';
    if (one.length <= LINE_MAX) return [one];
    if (lead === '') return emitConcatLines(text, indent, ',');
    return [
        indent + lead.trimEnd(),
        ...emitConcatLines(text, indent + INDENT, ','),
    ];
}

function notCatalogValue(value: unknown): Error {
    return new Error(
        'the catalog holds a ' + typeof value
            + ', which is no text, list, or record',
    );
}

// One catalog value as the lines of a TypeScript literal,
// closed by a comma: text, a list, or a record, the only
// kinds the catalog's shapes hold. `lead` opens the first
// line: a field's `name: `, or nothing for a list's item.
function emitLiteral(
    value: unknown,
    indent: string,
    lead: string,
): string[] {
    if (typeof value === 'string') {
        return emitText(value, indent, lead);
    }
    if (isList(value)) {
        if (value.length === 0) return [indent + lead + '[],'];
        return [
            indent + lead + '[',
            ...value.flatMap(
                (item) => emitLiteral(item, indent + INDENT, ''),
            ),
            indent + '],',
        ];
    }
    if (isRecord(value)) {
        return [
            indent + lead + '{',
            ...Object.entries(value).flatMap(
                ([name, field]) => emitLiteral(
                    field, indent + INDENT, name + ': ',
                ),
            ),
            indent + '},',
        ];
    }
    throw notCatalogValue(value);
}

// The shapes the catalog's constants are declared with:
// rooms.ts imports them and exports them again.
const CATALOG_TYPES = [
    'ApiDocAnswer',
    'ApiDocHeaderSet',
    'ApiDocRoom',
    'ApiDocStatus',
    'ApiDocStep',
] as const;

type CatalogType = (typeof CATALOG_TYPES)[number];

function emitConstant(
    name: string,
    type: CatalogType | 'string',
    items: readonly unknown[],
): string[] {
    return [
        'export const ' + name + ': readonly ' + type + '[] = [',
        ...items.flatMap((item) => emitLiteral(item, INDENT, '')),
        '];',
        '',
    ];
}

// Everything rooms.ts holds, by the constant that holds it.
export interface Catalog {
    readonly rooms: readonly ApiDocRoom[];
    readonly statuses: readonly ApiDocStatus[];
    readonly steps: readonly ApiDocStep[];
    readonly transport: readonly ApiDocHeaderSet[];
    readonly genericAnswers: readonly ApiDocAnswer[];
    readonly curlAdds: readonly string[];
}

function catalogOf(
    rooms: readonly ApiDocRoom[],
    steps: readonly ApiDocStep[],
): Catalog {
    return {
        rooms,
        statuses: catalogStatusesOf(),
        steps,
        transport: TRANSPORT_HEADERS,
        genericAnswers: GENERIC_ANSWERS.map(answerOf),
        curlAdds: CURL_ADDS,
    };
}

export function roomsTsOf(catalog: Catalog): string {
    const types = CATALOG_TYPES.map((name) => INDENT + name + ',');
    return [
        'import type {',
        ...types,
        "} from './shapes.ts';",
        '',
        'export type {',
        ...types,
        '};',
        '',
        ...emitConstant('API_DOC_ROOMS', 'ApiDocRoom', catalog.rooms),
        ...emitConstant(
            'API_DOC_STATUSES', 'ApiDocStatus', catalog.statuses,
        ),
        ...emitConstant('API_DOC_STEPS', 'ApiDocStep', catalog.steps),
        ...emitConstant(
            'API_DOC_TRANSPORT', 'ApiDocHeaderSet', catalog.transport,
        ),
        ...emitConstant(
            'API_DOC_GENERIC_ANSWERS', 'ApiDocAnswer',
            catalog.genericAnswers,
        ),
        ...emitConstant(
            'API_DOC_CURL_ADDS', 'string', catalog.curlAdds,
        ),
    ].join('\n');
}

function elevationTsOf(svg: string): string {
    const chunks = emitConcatLines(svg, '    ', ';');
    return 'export const API_ELEVATION_SVG: string =\n'
        + chunks.join('\n') + '\n';
}

const ROOMS_TS = 'rooms.ts';

// Every file the run writes, by its path under the tree.
function treeOf(
    samples: Map<string, string>,
    catalog: Catalog,
): Map<string, string> {
    const svg = svgOf(routes);
    return new Map([
        ['API.svg', svg],
        ['elevation.ts', elevationTsOf(svg)],
        [ROOMS_TS, roomsTsOf(catalog)],
        ...samples,
    ]);
}

function exists(path: string): boolean {
    try {
        Deno.statSync(path);
        return true;
    } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
            return false;
        }
        throw error;
    }
}

function readTree(root: string): Map<string, string> {
    const out = new Map<string, string>();
    if (!exists(root)) return out;
    const walk = (abs: string, rel: string): void => {
        const names = [...Deno.readDirSync(abs)]
            .map((e) => e.name)
            .sort();
        for (const name of names) {
            if (name.startsWith('.')) continue;
            if (
                rel === ''
                && KEPT_ROOT_NAMES.has(name)
            ) {
                continue;
            }
            const childRel = rel === ''
                ? name
                : rel + '/' + name;
            const childAbs = join(abs, name);
            if (Deno.statSync(childAbs).isDirectory) {
                walk(childAbs, childRel);
            } else {
                out.set(
                    childRel,
                    Deno.readTextFileSync(childAbs),
                );
            }
        }
    };
    walk(root, '');
    return out;
}

// The paths whose bytes on disk differ from the run's:
// new, rewritten, or no longer generated.
function changedPathsOf(
    next: Map<string, string>,
    disk: Map<string, string>,
): string[] {
    const rewritten = [...next.keys()].filter(
        (path) => disk.get(path) !== next.get(path),
    );
    const removed = [...disk.keys()].filter(
        (path) => !next.has(path),
    );
    return [...rewritten, ...removed].sort();
}

// dirname's answer for a path with no directory.
const TREE_ROOT = '.';

// Removes each directory that removing `path` left empty,
// from the file's own up to the tree's root.
function removeEmptied(root: string, path: string): void {
    for (
        let directory = dirname(path);
        directory !== TREE_ROOT;
        directory = dirname(directory)
    ) {
        const abs = join(root, directory);
        if ([...Deno.readDirSync(abs)].length > 0) return;
        Deno.removeSync(abs);
    }
}

function writeTree(
    root: string,
    files: Map<string, string>,
    changed: readonly string[],
): void {
    for (const path of changed) {
        const abs = join(root, path);
        const bytes = files.get(path);
        if (bytes === undefined) {
            Deno.removeSync(abs);
            removeEmptied(root, path);
            continue;
        }
        Deno.mkdirSync(dirname(abs), { recursive: true });
        Deno.writeTextFileSync(abs, bytes);
    }
}

// Plan D7: a sample is its JSON indented two spaces, with
// a final newline, at samples/<hash>.json. The catalog
// names it by that path, relative to the page.
const SAMPLES = 'samples/';
const SAMPLE_INDENT = 2;

function putSample(
    files: Map<string, string>,
    sample: ApiDocSample,
): ApiDocSampleRef {
    const path = SAMPLES + sample.hash + '.json';
    files.set(
        path,
        JSON.stringify(sample, null, SAMPLE_INDENT) + '\n',
    );
    return { kind: 'sample', path };
}

interface Replayed {
    // Each sample file, by its path under the tree.
    readonly files: Map<string, string>;
    readonly rooms: readonly ApiDocRoom[];
    readonly steps: readonly ApiDocStep[];
    // Every credential the replay carried or a sample
    // replaced, and the seeded passwords, for the guard.
    readonly known: readonly string[];
}

// Every endpoint, replayed by hash on a copy of its own,
// then each step of the guided start: the sample each
// writes, and the room or step that names it. A room's
// answers take the status its own replay witnessed (plan
// D16). planOf fails the run on an endpoint with no sample
// and no NO_SAMPLE entry; every NO_SAMPLE entry must name
// such an endpoint (plan D15).
// A replay answered with anything but 2xx fails the run.
async function replayedOf(): Promise<Replayed> {
    const stage = await openReplayStage();
    const cast = await castOf(stage);
    const ledger = new SecretLedger();
    const files = new Map<string, string>();
    const endpoints = endpointsOf(routes);
    const rooms: ApiDocRoom[] = [];
    const unsampled = new Set<string>();
    for (const endpoint of endpoints) {
        const plan = await planOf(endpoint, cast, stage);
        if (plan.kind === 'none') {
            unsampled.add(endpoint.hash);
            rooms.push(roomOf(
                endpoint,
                endpoints,
                { kind: 'none', reason: plan.reason },
                undefined,
            ));
            continue;
        }
        const exchange = succeeded(
            await sendPlan(stage, plan, (request) => request),
        );
        const sample = putSample(files, sampleOf(
            endpoint.hash,
            sentPathIdsOf(plan, exchange),
            [{ caller: plan.caller, exchange }],
            ledger,
        ));
        rooms.push(roomOf(
            endpoint, endpoints, sample, exchange.response.status,
        ));
    }
    for (const hash of NO_SAMPLE.keys()) {
        if (!unsampled.has(hash)) {
            throw new Error(
                'NO_SAMPLE names ' + hash
                    + ', which is no endpoint left without a'
                    + ' sample',
            );
        }
    }
    const steps: ApiDocStep[] = [];
    for (const step of STEPS) {
        const sample = await replayStep(
            step.slug, cast, stage, ledger,
        );
        steps.push({
            hash: sample.hash,
            title: step.title,
            prose: step.prose,
            shell: step.shell,
            sample: putSample(files, sample),
        });
    }
    return {
        files,
        rooms,
        steps,
        known: [
            ...ledger.known(),
            ...cast.member.secrets,
            ...cast.admin.secrets,
            ...stage.credentials.identities.map(
                ({ password }) => password,
            ),
        ],
    };
}

// Every file the run writes or compares, searched before
// it lands (spec, The hard rule). A finding names the
// file and the kind, never the text.
function guardTree(
    files: Map<string, string>,
    known: readonly string[],
): void {
    for (const [path, text] of files) {
        const findings = credentialFindingsOf(text, known);
        if (findings.length > 0) {
            throw new Error(
                'credential-shaped text in ' + path
                    + ' (' + findings[0]!.kind + ')',
            );
        }
    }
}

// Every text a catalog value holds, whole.
function textsOf(value: unknown): readonly string[] {
    if (typeof value === 'string') return [value];
    if (isList(value)) return value.flatMap(textsOf);
    if (isRecord(value)) {
        return Object.values(value).flatMap(textsOf);
    }
    throw notCatalogValue(value);
}

// rooms.ts folds long text at LINE_MAX, and a fold can cut
// a credential in two, past guardTree. So the catalog's
// texts are searched whole, before they are folded.
export function guardCatalog(
    catalog: Catalog,
    known: readonly string[],
): void {
    guardTree(
        new Map([[ROOMS_TS, textsOf(catalog).join('\n')]]),
        known,
    );
}

const CHECK_FLAG = '--check';
const OUT_FLAG = '--out';

// The tree the run writes or checks: OUT_ROOT unless
// `--out DIR` names another.
function outRootOf(args: readonly string[]): string {
    const at = args.indexOf(OUT_FLAG);
    if (at < 0) return OUT_ROOT;
    const root = args[at + 1];
    if (root === undefined) {
        throw new Error(OUT_FLAG + ' names no directory');
    }
    return root;
}

export async function runCli(
    args: readonly string[],
): Promise<void> {
    const root = outRootOf(args);
    const replayed = await replayedOf();
    const catalog = catalogOf(replayed.rooms, replayed.steps);
    guardCatalog(catalog, replayed.known);
    const next = treeOf(replayed.files, catalog);
    guardTree(next, replayed.known);
    const changed = changedPathsOf(next, readTree(root));
    if (args.includes(CHECK_FLAG)) {
        if (changed.length > 0) {
            Deno.stderr.writeSync(enc.encode(
                'api-documentation is stale — run'
                + ' ./generate-api-documentation\n',
            ));
            Deno.exit(1);
        }
        Deno.stdout.writeSync(enc.encode(
            'api-documentation is up to date\n',
        ));
        return;
    }
    if (changed.length === 0) {
        Deno.stdout.writeSync(enc.encode(root + ' unchanged\n'));
        return;
    }
    writeTree(root, next, changed);
    Deno.stdout.writeSync(enc.encode(
        'wrote ' + root + ' (' + String(changed.length)
            + ' files changed)\n',
    ));
}
