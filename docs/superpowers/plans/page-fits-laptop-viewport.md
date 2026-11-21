# Page fits a laptop viewport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** The API documentation elevation
(`/api-documentation/index.html`, no hash) draws every
label inside its own svg, so nothing it draws reaches past
the right edge of a full-screen laptop browser.

**Architecture:** The generator already budgets URI width
honestly for 8.5px monospace. The page CSP drops the svg's
`<style>` block, so that font never applies and the labels
draw in the page's 16px Inter. The fix carries each text
class's font (family, size, and, where the block sets them,
weight and anchor) as SVG presentation attributes. The
generator already does this for every `fill`. Nothing is
hand-edited: `./bin/generate-api-documentation` rewrites
`elevation.ts` and `API.svg`.

**Tech Stack:** Deno 2.9.8, TypeScript under `deno.json`
(`strict`, `noUncheckedIndexedAccess`,
`verbatimModuleSyntax`, `erasableSyntaxOnly`),
`@std/assert`, Chrome over CDP for `tests/browser/`.

**Spec:** none. This is a defect fix. The finder's
measurement and the root cause below are the spec, and
neither is reopened.

## Root cause (measured, Chrome over CDP, desktop emulation)

At 1440x900, before the fix:

| Measure | Value |
|---|---|
| svg client rect | 288 → 1408 (1120px; viewBox `0 0 811 1822`, scale 1.381) |
| widest `text.uri` | 102 chars, `/api/organizations/:organization-id/record-types/:record-type-id/instances/:instance-id/versions/:etag` |
| its `x` / `text-anchor` | `264` (= `uriX()`) / `start` |
| computed `font-size` / `font-family` | `16px` / `Inter, -apple-system, "system-ui", "Segoe UI", sans-serif` |
| `getComputedTextLength()` | 774.18 units = **7.59 units/char** |
| `getBBox()` right | 264 + 774.18 = **1038.18** units against width 811 |
| client right edge | 1721.73px (313.73px past the svg, 281.73px past the viewport) |
| `svg style` `.sheet` | **none**: the `<style>` element has no stylesheet |
| `text.col` | `text-anchor: start`, `16px` (block says `middle`, `8px`) |
| `text.wing` | `font-weight: 400`, `16px` (block says `700`, `12px`) |
| `text.uri` past 811 units | 9 of 90 |

This settles the finder's two readings. "Starts at about
x=1038" is the bbox RIGHT edge in viewBox units; the text
starts at `x=264`. The 7.6 units/char is the page's 16px
Inter, not a wrong `CHAR_W`.

The cause is `server/http-server.ts:59`, the CSP
`style-src 'self'`, which blocks the inline `<style>`
element. `generate-api-documentation.ts` already says so
in its comment at the head of `svgOf`: "each paint is also
a presentation attribute". Only `fill` and `stroke` were
carried that way; `font-family`, `font-size`,
`font-weight`, and `text-anchor` were not. So every text
inherits the page's `body` font.

After the fix (prototyped, then reverted), at 1440x900:
`text.uri` computes `8.5px`,
`ui-monospace, SFMono-Regular, Menlo, monospace`, at
**5.114 units/char**, inside the 5.2 `CHAR_W` budget. The
widest bbox right edge is **785.61** units (≤ 811 − 16 PAD).
Its client right edge is 1372.93 < svg right 1408.
`text.col` is `middle` and `8px`; `text.wing` is `700` and
`12px`. Also measured at 1280x800, 1512x982, and 1366x768:
max text right edge 785.9 units, document scroll overflow
0. **`CHAR_W` and the width formula are correct and stay
unchanged.**

## Decisions (marked: the planner's call)

- **Fix the generator's output, not the layout or the
  page CSS.** The generator owns the font its width
  budget assumes, so the font must ride in what the
  generator draws. A rule in
  `pages-api-documentation.css` would split that
  ownership across two files. Wrapping or eliding URIs
  would fix a width that is not wrong. Loosening the CSP
  is out of the question. *Planner's call.*
- **Presentation attributes, per text, as `fill`
  already is.** These are SVG attributes, not `style`
  attributes. The CSP does not govern them, and the "no
  inline styles" rule is about `style=`. *Planner's
  call.*
- **Carry every text property the dropped block sets,
  not only the URI font.** These are the legend, col,
  and wing font-family and size, the wing's weight, and
  the col's `text-anchor: middle`. One root cause, one
  commit. Fixing only `.uri` would leave the column
  headers left-anchored at their circle centres and the
  wing names in regular 16px. That is the same defect on
  sibling texts. No other drawing changes. *Planner's
  call.*
- **Name the numbers once.** The style block reads the
  same constants as the attributes, so the standalone
  `API.svg` style and the in-page attributes cannot
  drift. It is not a helper: four attribute-string
  constants beside the existing `URI_SIZE` / `CHAR_W`.
  *Planner's call.*
- **One product commit.** The red tests, the generator
  change, and the regenerated files land together.
  `elevation module matches svgOf` and `./test api-docs`
  are red on any commit that splits them. Subject:
  `Carry the elevation's fonts on its text`. *Planner's
  call.*

## Global Constraints

- Never hand-edit `web-app/api-documentation/elevation.ts`
  or `API.svg`. Run `./bin/generate-api-documentation`,
  then `./test api-docs` must print
  `api-documentation is up to date`.
- Never loosen an existing test or a `--check` golden.
- `CHAR_W`, `URI_SIZE`, `uriX()`, the width formula, and
  the CSP stay as they are.
- 78-char lines in linted files (not `.md`), 4-space
  indent, no inline styles, no `any`, no defaulted
  values (`?? []`, `|| …`). The `org` identifier ban
  holds.
- Under the sandbox: `export DENO_DIR="$TMPDIR/deno-dir"`
  before any `deno` or `./test`. Chrome cannot start
  inside the sandbox ("Chrome DevToolsActivePort timed
  out after 15000ms"), so rerun only the browser command
  with the sandbox disabled.
- Out of scope, follow-ups only (do not touch): the
  dashboard sparkline clipping and the flow-stats `h1`
  clipping the finder also noticed.

## Review Focus

1. **The covenant is visual, so the pin is in Chrome.**
   The Layer-2 test reads each `text`'s client rect
   against the svg's (and the viewport's) right edge at
   1440x900 and 1280x800. Task 1 pins it.
2. **The Layer-1 pin is the cause, not the symptom.**
   Every `<text>` in `svgOf(routes)` carries
   `font-family` and `font-size`. It is decidable in
   pure TS and red today. It cannot see a glyph's
   advance. Task 1 pins it.
3. **Generated files are generated.** A reviewer diffs
   `elevation.ts` / `API.svg` against a fresh
   `./bin/generate-api-documentation`, and `./test
   api-docs` agrees.

---

## Subagent brief (every task's brief starts here)

Each task's brief begins with the literal line
`Go to Medium Church!`, then carries this block, then the
task text (Files, Steps) verbatim:

> Work in `/Users/tmornini/code/fusion-angle/.worktrees/page-fits-laptop-viewport`
> (branch `page-fits-laptop-viewport`). Never edit the
> main checkout, and never pass the Agent tool
> `isolation`. Read `AGENTS.md`, then this plan's Root
> cause section. Under the sandbox,
> `export DENO_DIR="$TMPDIR/deno-dir"` first. Voice:
> 78-char max line in linted files, 4-space indent, no
> inline styles (CSS custom properties + classes per
> DESIGN-SYSTEM.md). Spell `organization`, never `org`.
> No untyped `any`. Name opaque numbers. Test first:
> write the red test, watch it fail for the reason
> given, then write the code. Tests assert behaviour,
> not implementation. Commit with the exact subject
> given, one line, then a blank line and exactly these
> two trailer lines, in this order, no other body:
> `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
> `Claude-Session: https://claude.ai/code/session_018VpGTMctWRV6ZFdDw8ZwiH`
> If `git commit` fails with "Operation not permitted"
> on `.git/worktrees`, rerun it outside the sandbox.
> Abominations to refuse: test weakening (never loosen
> an assertion or a `--check` golden), unbidden helper
> code, premature generalization, default values,
> scope creep beyond this plan.

---

### Task 1: Carry the elevation's fonts on its text

Role: `coder`.
Commandments: I Reliability, IV Logic (measured, not
asserted), III Uniformity (fonts ride as `fill` already
rides). Risks: test weakening, hand-editing generated
files, unbidden helper code, scope creep.

**Files:**
- Test: `tests/browser/api-documentation.test.ts` (append)
- Test: `tests/api-documentation-generator.test.ts`
  (append)
- Modify: `web-app/app/generate-api-documentation.ts`
  (constants after `CHAR_W`, the `svgOf` head comment,
  six `<text>` sites, the style block)
- Regenerate (never hand-edit):
  `web-app/api-documentation/elevation.ts`,
  `web-app/api-documentation/API.svg`

- [ ] **Step 1: Write the red Layer-2 test.** Append to
  the end of `tests/browser/api-documentation.test.ts`.
  It reuses that file's `openDocs` / `closeDocs` and
  its existing `assert` import:

```ts

const LAPTOP_VIEWPORTS = [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
] as const;

// The widest reach of any elevation label past the
// svg's right edge, or past the viewport's if that is
// nearer, in CSS pixels; zero or less means it fits.
const ELEVATION_TEXT_OVERRUN = `(() => {
    const svg = document.querySelector(
        '#api-elevation svg');
    const edge = Math.min(
        svg.getBoundingClientRect().right, innerWidth);
    let worst = { overrun: -Infinity, text: '' };
    for (const text of svg.querySelectorAll('text')) {
        const overrun =
            text.getBoundingClientRect().right - edge;
        if (overrun > worst.overrun) {
            worst = { overrun, text: text.textContent };
        }
    }
    return worst;
})()`;

for (const viewport of LAPTOP_VIEWPORTS) {
    Deno.test(
        `the elevation fits a ${viewport.width}px laptop`,
    async () => {
        const { origin, page } = await openDocs('');
        try {
            // Desktop emulation, as a laptop browser
            // full screen draws it.
            await page.setViewport(
                viewport.width, viewport.height, false,
            );
            await page.until(
                `innerWidth === ${viewport.width}`,
                'laptop viewport width',
            );
            const worst = await page.evaluate<{
                overrun: number;
                text: string;
            }>(ELEVATION_TEXT_OVERRUN);
            assert(
                worst.overrun <= 0,
                `"${worst.text}" runs ${worst.overrun}px`
                + ` past the elevation's right edge`,
            );
        } finally {
            await closeDocs(origin, page);
        }
    });
}
```

- [ ] **Step 2: Watch it fail.** `bin/test-browser` runs
  every file. To run one, write this runner once to
  `$TMPDIR/run-one-browser.sh` (outside the worktree):

```bash
#!/bin/bash
# usage: run-one-browser.sh <test file> [deno test args]
set -euo pipefail
cd /Users/tmornini/code/fusion-angle/.worktrees/page-fits-laptop-viewport
export DENO_DIR="$TMPDIR/deno-dir"
source bin/build-lib
export JWT_HMAC_SIGNING_KEY=test-hmac-signing-key
export CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
B=$(mktemp -d "$TMPDIR/fb.XXXX")
trap 'rm -rf "$B"' EXIT
bundle_client "$B" >/dev/null
export FUSION_ANGLE_STATIC_ROOT="$B"
TZ=UTC deno test --frozen --no-check --sanitize-resources \
    --allow-env --allow-read --allow-write --allow-net \
    --allow-run --preload ./tests/hmac-test-key.ts \
    --preload ./tests/local-storage-stub.ts "$@"
```

  Run it with the sandbox disabled (Chrome):
  `bash "$TMPDIR/run-one-browser.sh" tests/browser/api-documentation.test.ts --filter laptop`.
  Expected: FAIL, 0 passed | 2 failed | 6 filtered out,
  and the planner observed exactly this:

```text
the elevation fits a 1440px laptop => ./tests/browser/api-documentation.test.ts:337:10
error: AssertionError: "/api/organizations/:organization-id/record-types/:record-type-id/instances/:instance-id/versions/:etag" runs 313.72869873046875px past the elevation's right edge

the elevation fits a 1280px laptop => ./tests/browser/api-documentation.test.ts:337:10
error: AssertionError: "/api/organizations/:organization-id/record-types/:record-type-id/instances/:instance-id/versions/:etag" runs 268.70703125px past the elevation's right edge
```

  A failure for any other reason (a `null` svg, a
  timeout) means the test is wrong. Fix the test, not
  the expectation.

- [ ] **Step 3: Write the red Layer-1 test.** Append to
  the end of `tests/api-documentation-generator.test.ts`
  (it already imports `assert`, `assertMatch`, `routes`,
  `svgOf`):

```ts

// The page CSP (style-src 'self') drops the svg's own
// <style> block, so a font the width budget assumes
// must ride on the text itself, as each fill does.
Deno.test('every elevation text carries its own font',
() => {
    const texts = svgOf(routes).match(/<text [^>]*>/g);
    assert(texts);
    for (const text of texts) {
        assertMatch(text, / font-family="[^"]+"/);
        assertMatch(text, / font-size="[^"]+"/);
    }
});
```

- [ ] **Step 4: Watch it fail.**
  `JWT_HMAC_SIGNING_KEY=test-hmac-signing-key deno test --frozen --no-check --allow-env --allow-read tests/api-documentation-generator.test.ts --filter "own font"`.
  Expected, as observed:

```text
every elevation text carries its own font => ./tests/api-documentation-generator.test.ts:517:6
error: AssertionError: Expected actual: "<text class="legend" fill="hsl(var(--muted-foreground))" x="16" y="28">" to match: "/ font-family="[^"]+"/".
FAILED | 0 passed | 1 failed | 25 filtered out
```

- [ ] **Step 5: Name the fonts.** In
  `web-app/app/generate-api-documentation.ts`, directly
  after `const CHAR_W = 5.2;`, insert:

```ts
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
```

- [ ] **Step 6: Say why in `svgOf`'s head comment.**
  Replace

```ts
    // (style-src 'self'), so each paint is also a
    // presentation attribute. hsl(var(--token))
```

  with

```ts
    // (style-src 'self'), so each paint and font is
    // also a presentation attribute. hsl(var(--token))
```

- [ ] **Step 7: Carry the attributes at the six `<text>`
  sites.** At each site, replace the `+ '" x="'` line
  that follows the `fill` with two lines. The `x` value
  at each site stays exactly what it is (`PAD`, `cx`, or
  `uriX()`):

  - legend (`'  <text class="legend" fill="' + muted`):
    ```ts
            + '"' + LEGEND_ATTRIBUTES
            + ' x="' + PAD + '" y="'
    ```
  - col (`'  <text class="col" fill="' + muted`):
    ```ts
                + '"' + COL_ATTRIBUTES
                + ' x="' + cx + '" y="'
    ```
  - both wing sites (`'  <text class="wing" fill="' + ink`,
    the route wing and the `backing` wing):
    ```ts
                + '"' + WING_ATTRIBUTES
                + ' x="' + PAD + '" y="'
    ```
  - both uri sites (`'  <text class="uri" fill="' + ink`,
    the route row and the backing row):
    ```ts
                    + '"' + URI_ATTRIBUTES
                    + ' x="' + uriX()
    ```

  Keep each site's existing indentation. Each emitted
  tag then reads, for example,
  `<text class="uri" fill="hsl(var(--foreground))" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="8.5" x="264" y="…">`.

- [ ] **Step 8: Read the style block from the same
  constants.** In the `style` array, replace

```ts
        '      .legend, .wing, .col { font-family:',
        '        ui-sans-serif, system-ui, sans-serif;',
        '      }',
        '      .legend { fill: ' + muted + ';',
        '        font-size: 11px; }',
        '      .wing { fill: ' + ink + ';',
        '        font-size: 12px; font-weight: 700; }',
        '      .col { fill: ' + muted + ';',
        '        font-size: 8px; text-anchor: middle;',
        '      }',
        '      .uri { font-family: ui-monospace,',
        "        SFMono-Regular, Menlo, monospace;",
        '        font-size: ' + URI_SIZE + 'px;',
```

  with

```ts
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
```

  The emitted block is unchanged except the `.uri`
  `font-family` line break moves
  (`.uri { font-family:` / `ui-monospace, SFMono-Regular,
  Menlo, monospace;`).

- [ ] **Step 9: Regenerate.**
  `./bin/generate-api-documentation`. Expected:
  `wrote web-app/api-documentation`, and `git status
  --short` shows `elevation.ts` and `API.svg` modified
  (about 2.2k and 0.2k changed lines). `rooms.ts` and the
  room pages are untouched. Then `./test api-docs`.
  Expected: `api-documentation is up to date`.
- [ ] **Step 10: Watch both go green.**
  - The Step 4 command. Expected: 1 passed. Then the
    same command without `--filter`. Expected: `ok | 26
    passed | 0 failed` (`elevation module matches
    svgOf` included).
  - The Step 2 command (sandbox disabled), without
    `--filter`. Expected: `ok | 8 passed | 0 failed`.
    Observed on the prototype: the widest `text.uri`
    computes `8.5px` monospace at 5.114 units/char, and
    its bbox right edge is 785.61 of 811 units.
- [ ] **Step 11: Gate.** `./test lint` (exit 0, no
  output), `./test validate --syntax` (PASS), `./test`
  (PASS).
- [ ] **Step 12: Commit** the two test files, the
  generator, and the two regenerated files with the
  subject `Carry the elevation's fonts on its text`.

---

### Task 2: Review and gate the branch

Role: `architect` for the review. The master session runs
the gates.

- [ ] **Step 1: Review.** Dispatch `architect` with a
  brief that begins `Go to Medium Church!`. Give it this
  plan and `git diff master...page-fits-laptop-viewport`.
  Ask it to confirm four things. First, `CHAR_W`, the
  width formula, `uriX()`, and the CSP are unchanged.
  Second, the regenerated files equal a fresh
  `./bin/generate-api-documentation`. Third, no
  existing assertion is loosened. Fourth, the dashboard
  and flow-stats are untouched. Fix findings in new
  commits, each gated by `./test validate --syntax`.
- [ ] **Step 2: Squash.** Keep the plan commit. If Step 1
  added commits, squash them into
  `Carry the elevation's fonts on its text` with the
  two trailer lines.
- [ ] **Step 3: Layer 1.** `./test validate`. Expected:
  PASS.
- [ ] **Step 4: Layer 2.** `./test validate browser`
  (sandbox disabled for Chrome). Expected: PASS.
- [ ] **Step 5: Report** the branch name
  `page-fits-laptop-viewport` to the operator. Do not
  merge; the operator initiates every merge.

## Follow-ups (out of scope here)

- The dashboard sparkline clipping the finder noticed.
- The flow-stats `h1` clipping the finder noticed.
