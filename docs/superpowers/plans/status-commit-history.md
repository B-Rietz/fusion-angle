# Status Commit History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** `/status` shows the deployed commit as one
`age • sha` line over its subject, then a rule, then the
ten commits before it on its first-parent line, all inside
the verdict card; an open tab reloads when the page names
a new status script; the card keeps `--space-8` above and
below at every height.

**Architecture:** The list is renamed from `merges` to
`history` end to end, then `--merges` drops from both git
reads (TS and shell twin). Two design-system tokens and one
status rule land in CSS and on the showcase page. The
server renders the deployed commit and every history entry
through one `commitLines` with two class "looks", inside
`statusCard`, so the live card and the timeout template
match. The page script drops its second replacement path
and reloads when the answered page's script name differs
from its own.

**Tech Stack:** Deno 2.9.8, TypeScript (`strict`,
`noUncheckedIndexedAccess`, `erasableSyntaxOnly`), bash /
POSIX sh, plain CSS, `deno bundle`, Chrome over CDP for
`tests/browser/`.

**Spec:** `docs/superpowers/specs/status-commit-history-design.md`.
Read it before any task. Line numbers below are as of
`b58fb916c`; trust the quoted text over the number.

## Questions

1. **Gap: the sha rides above the age's baseline.**
   `.git-sha` (`web-app/app/styles/base.css:74`) is
   `display: inline-block; overflow: hidden`. CSS 2.1
   §10.8.1 puts the baseline of such an inline-block at its
   bottom margin edge. Until now the sha sat alone in its
   own `<p>`, so this never showed. The design puts it
   inline after the age, where it will sit high and make
   the line taller. **Proposed resolution:** Task 7 pins
   in Chrome that each commit line is exactly one
   line-height tall. Then it adds `vertical-align: bottom`
   to `.git-sha`. The rule keeps the clip, and the page has
   no other `.git-sha` element.
2. **Brief vs design: "light and dark" tokens.**
   `palette.css` has one `:root` and no light theme, as the
   design says, so `--soft-foreground` is defined once.
   **Resolution:** follow the design.
3. **Showcase grid.** The design-system page's "UI Colors"
   grid is `ds-grid-6` with six swatches. A seventh, Soft
   Foreground, wraps onto a second row. **Proposed
   resolution:** accept the wrap and place the swatch
   directly after Foreground. The grid stays as it is.
4. **Already done.** `DESIGN-SYSTEM.md` already documents
   `xsm` and `soft-foreground` (commit `b58fb916c`), so no
   task touches it.

## Global Constraints

- Before every `deno`, `./test`, or `./deploy` command:
  `export DENO_DIR="$TMPDIR/deno-dir"`.
- Each commit passes `./test validate --syntax` (prints
  nothing on success; check `echo exit=$?` is `exit=0`).
- `./test browser` needs Chrome, so run it **outside the
  Claude Code sandbox** (`dangerouslyDisableSandbox: true`
  on that one Bash call). It runs every
  `tests/browser/*.test.ts` file. No filter exists.
- One memory test file runs with `./test`'s own flags and
  preloads. Set `ONE` in the same Bash call that uses it,
  because shell state does not persist between calls:

```bash
export DENO_DIR="$TMPDIR/deno-dir"
ONE="env TZ=UTC JWT_HMAC_SIGNING_KEY=test-hmac-signing-key
 deno test --frozen --no-check --sanitize-ops
 --sanitize-resources --allow-all
 --preload ./tests/hmac-test-key.ts
 --preload ./tests/local-storage-stub.ts
 --preload ./tests/session-storage-stub.ts
 --preload ./tests/worker-name-prefix.ts"
$ONE tests/status-page.test.ts
```
- 78-char max line in every `.ts`, `.css`, `.html` under
  `api client shared server tests web-app`, and in `bin/`
  scripts. 4-space indent. No inline styles (`style=` never
  appears in page markup).
- `noUncheckedIndexedAccess`: index reads need a guard
  or `!`.
- Names: JSON key `git-history`, `RunningCommit.history`,
  `SystemStatus['git-history']`, `HISTORY_SHOWN = 10`,
  list `aria-label="Recent commits"`.
- Commit subjects are one present-tense imperative line,
  about 50 chars or fewer. After a blank line, add exactly
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  Write no other body. Never move and change a file in
  one commit.
- Do not create a worktree, and never run
  `./deploy --render`.

## Review Focus

1. A history entry with no commit time or no subject
   renders the sha alone, with no `•` and no subject line.
   Task 5 pins this.
2. A reloaded page whose script matches the served one
   never reloads again (no loop). Task 6 pins this.
3. An unanswered refresh (timeout card) never reloads.
   Task 6 pins this.
4. A card taller than a short viewport keeps at least
   32px above and below. Task 5 pins this.
5. The sha inline beside the age keeps its line one
   line-height tall. Task 7 pins this.

## File Map

| File | Change | Task |
|---|---|---|
| `shared/system-status.ts` | `merges`→`history`, `git-merges`→`git-history` (1); comment (2) | 1, 2 |
| `server/git-sha.ts` | rename; drop `--merges`; comments | 1, 2 |
| `server/status-page.ts` | rename (1); card markup, drop `mergesSection` and label, `py-8` (5) | 1, 5 |
| `bin/build-lib` | `commit_log` drops `--merges`; comments | 2 |
| `web-app/app/styles/tokens.css` | `--text-xsm` | 3 |
| `web-app/app/styles/base.css` | `.text-xsm` (3); `.git-sha` `vertical-align` (7) | 3, 7 |
| `web-app/app/styles/palette.css` | `--soft-foreground` | 3 |
| `web-app/app/styles/utilities.css` | `.text-soft` | 3 |
| `web-app/app/styles/components-cards.css` | `.status-rule` | 3 |
| `web-app/design-system/index.ts` | type row + swatch | 4 |
| `web-app/app/styles/pages-design-system.css` | `.bg-soft-foreground` | 4 |
| `web-app/app/status-refresh.ts` | drop `showMerges`; reload on script change | 6 |
| `API.md`, `TODO.md` | `git-history`, first-parent wording | 2 |
| `tests/git-sha.test.ts` | rename (1); no `--merges`, direct-commit test (2) | 1, 2 |
| `tests/server-zip-metafile.test.ts` | rename | 1 |
| `tests/http-server.test.ts` | rename (1); HTML class asserts (5) | 1, 5 |
| `tests/status-page.test.ts` | rename (1); CSS pins (3); markup (5); sha pin (7) | 1, 3, 5, 7 |
| `tests/build-commit.test.ts` | two-commit repo, first-parent lines | 2 |
| `tests/design-system-render.test.ts` | new pin + fingerprint | 4 |
| `tests/browser/status-refresh.test.ts` | rename (1); layout (5); reload (6); line (7) | 1, 5, 6, 7 |

Unaffected (verified): `tests/develop-cli.test.ts` pins
only `commit_log . HEAD`; `api/http-status-documents.ts`'s
`EXAMPLE_COMMIT` carries no list; `api/system-status.ts`
and `server/http-server.ts` pass the commit through
`systemStatusOf`/`statusPageHtml` unchanged.

---

### Task 1: Rename the merges to history (mechanical)

**Files:**
- Modify: `shared/system-status.ts:22-26, 36-39, 70-86`
- Modify: `server/git-sha.ts` (every `merges`/`MERGES`)
- Modify: `server/status-page.ts:246-270` (`commit.merges`
  only; `mergesSection` and `#status-merges` stay until
  Task 5)
- Test: `tests/git-sha.test.ts`,
  `tests/server-zip-metafile.test.ts:264-276`,
  `tests/http-server.test.ts:658-698`,
  `tests/status-page.test.ts:359-398`,
  `tests/browser/status-refresh.test.ts:236-256`

**Interfaces:**
- Produces: `RunningCommit = Commit & { readonly history?:
  readonly Commit[] }`; `SystemStatus<K>` key
  `'git-history'?: readonly CommitDocument[]`;
  `export const HISTORY_SHOWN = 10` in `server/git-sha.ts`.

This is an identifier rename. Behavior does not change:
`--merges` stays until Task 2.

- [ ] **Step 1: Rename in the tests.** In every test file
  above: the property `merges:` becomes `history:`,
  `.merges` becomes `.history`, `MERGES_SHOWN` becomes
  `HISTORY_SHOWN`, and `'git-merges'` becomes
  `'git-history'`. In `tests/git-sha.test.ts` the helpers
  `mergeSha`, `mergeLine`, and `mergeOf` become
  `historySha`, `historyLine`, and `historyOf`. The test
  `'commitLogOf reads the commit then its merges'` becomes
  `'commitLogOf reads the commit then its history'`, and
  `'commitLogOf keeps ten merges, never the head'` becomes
  `'commitLogOf keeps ten, never the head'`. Leave the
  `'--merges'` argument in `'runningCommitFor reads HEAD
  when given nothing'` alone; Task 2 drops it. In
  `tests/status-page.test.ts` rename `MERGE_SHA` to
  `HISTORY_SHA`. The browser test
  `'the merges sit below the live card'` keeps its name and
  its `#status-merges` body for now. Only the `agingStatus`
  key changes there.

- [ ] **Step 2: Watch the check fail**

  Run: `export DENO_DIR="$TMPDIR/deno-dir"; ./test validate --syntax; echo exit=$?`
  Expected: type errors naming `history` / `HISTORY_SHOWN`
  / `'git-history'`, `exit=1`.

- [ ] **Step 3: Rename in the code.** In
  `shared/system-status.ts`: `merges` becomes `history`,
  `'git-merges'` becomes `'git-history'`, and the lambda
  `merge` becomes `entry`. Leave comment prose for
  Task 2. In `server/git-sha.ts`: `MERGES_SHOWN` becomes
  `HISTORY_SHOWN`, and the locals `merges` and `merge`
  become `history` and `entry`. In
  `server/status-page.ts`: `commit.merges` becomes
  `commit.history`, and the lambda `merge` becomes
  `entry`.

- [ ] **Step 4: Verify**

  Run: `export DENO_DIR="$TMPDIR/deno-dir"; ./test validate --syntax; echo exit=$?` → `exit=0`.
  Run: `./test; echo exit=$?` → `exit=0`.
  Run: `grep -rn "merges\|MERGES" shared/system-status.ts server/git-sha.ts tests/git-sha.test.ts tests/server-zip-metafile.test.ts`
  Expected: only `'--merges'` in `server/git-sha.ts`, in
  `tests/git-sha.test.ts`, and in comment prose that
  Task 2 rewrites.

- [ ] **Step 5: Commit**

```bash
git add shared/system-status.ts server/git-sha.ts \
    server/status-page.ts tests/git-sha.test.ts \
    tests/server-zip-metafile.test.ts \
    tests/http-server.test.ts tests/status-page.test.ts \
    tests/browser/status-refresh.test.ts
git commit -m "Rename the status merges to history" \
    -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: List first-parent commits in the history (small judgment: git harness)

**Files:**
- Modify: `server/git-sha.ts:1-7` (header), `:64-69`
  (`commitLogOf` comment), `:126-131` (`readWorktreeCommit`)
- Modify: `bin/build-lib:133-143` (`commit_log` and its
  comment), `:148-150` (`fetched_commit` comment)
- Modify: `shared/system-status.ts:22-23` (comment only)
- Modify: `API.md:32-45`, `TODO.md:356-359`
- Test: `tests/git-sha.test.ts`, `tests/build-commit.test.ts`

**Interfaces:**
- Consumes: `HISTORY_SHOWN`, `runningCommitFor`,
  `commitLogOf` from Task 1.
- Produces: both readers emit the head line, then
  `git log --first-parent -n 11 --format='%H %ct %s' REV`.
  The head is line 1 of that second log, and
  `commitLogOf` drops it.

- [ ] **Step 1: Write the failing tests.**

  `tests/git-sha.test.ts`:
  - In `'runningCommitFor reads HEAD when given nothing'`,
    delete `'--merges', ` from the second `gitOutput`.
  - Add `'a direct commit on the first-parent line joins
    the history'`. It builds a scratch repo in
    `Deno.makeTempDir({ prefix: 'fusion-git-history-' })`
    (removed in `finally`). Run every git call with env
    `{ GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM:
    '1' }` and `-c user.name=Test -c
    user.email=test@example.com`, as
    `tests/build-commit.test.ts` does. The history:
    `init --quiet -b main`. An `--allow-empty` commit
    `Base`. `checkout --quiet -b side`, then an
    `--allow-empty` commit `Side`. `checkout --quiet main`,
    then `merge --quiet --no-ff side -m 'Merge side'`. An
    `--allow-empty` commit `Direct`. Then run a child the
    way `'an env log does not ask git'` does: `deno eval
    --frozen --config <absolute deno.json>`, `clearEnv`,
    PATH/HOME/DENO_DIR plus the two `GIT_CONFIG_*` vars, no
    `GIT_COMMIT_LOG`, **`cwd` set to the scratch repo**, and
    a 60 s `AbortSignal.timeout`. The child prints
    `JSON.stringify(await runningCommitFor(undefined))`.
    For the absolute config path, use
    `fromFileUrl(import.meta.resolve('../deno.json'))`
    from `@std/path`. Assert:

```ts
assertStrictEquals(result.code, 0);
const commit = JSON.parse(stdout);
assertEquals(commit.subject, 'Direct');
assertEquals(
    commit.history.map(
        (entry: { subject: string }) => entry.subject,
    ),
    ['Merge side', 'Base'],
);
```

  `tests/build-commit.test.ts`, in `'fetched_commit reads
  the commit a URL holds'`: before the `SUBJECT` commit,
  make an `--allow-empty` commit `-m First`. Read its sha
  and time with `rev-parse HEAD~1` and `log -1
  --format=%ct HEAD~1`. The held stdout becomes:

```ts
sha + ' ' + time + ' ' + SUBJECT + '\n'
+ sha + ' ' + time + ' ' + SUBJECT + '\n'
+ firstSha + ' ' + firstTime + ' First\n'
```

- [ ] **Step 2: Watch them fail**

  Run: `$ONE tests/git-sha.test.ts tests/build-commit.test.ts` (`ONE` as in Global Constraints)
  Expected: the new git-sha test FAILS, because the history
  is `['Merge side']` without `Base`. `fetched_commit`
  FAILS, because the output is the single head line.

- [ ] **Step 3: Drop `--merges`.** In
  `readWorktreeCommit`, the second `gitLog` call becomes
  `['--first-parent', '-n', String(HISTORY_SHOWN + 1),
  'HEAD']`. Rename its local from `merges` to `history`.
  In `commit_log`, the second call becomes `git -C "$dir"
  log --first-parent -n 11 --format='%H %ct %s' "$rev"`.
  Rewrite the comments with these meanings:
  - `commit_log`: "REV's line, then REV's first-parent
    line from REV itself, newest first; server/git-sha.ts
    drops REV and keeps ten."
  - `fetched_commit`: "a commit past it is absent."
  - `git-sha.ts` header: "its history, the commits before
    it on its first-parent line".
  - `commitLogOf`: "A history line that is no commit drops
    the history: absent beats wrong. The second log starts
    at the running commit, which is not its own history."
  - `runningCommitFor`: "An entry that fails judgment
    drops the history, as a bad history line does in the
    log."
  - `shared/system-status.ts`, above `RunningCommit`:
    "The history is the commits before the running commit
    on its first-parent line, newest first."

- [ ] **Step 4: Update the docs.** In `API.md`, `"git-merges" }` becomes `"git-history" }`. The
  `git-merges` sentence becomes: "`git-history` lists up
  to ten commits before the commit on its first-parent
  line, newest first, each with the same four commit
  keys, and is absent when the commit carries none." In
  `TODO.md:358`, "then the ten merges before it" becomes
  "then the ten commits before it on its first-parent
  line". Keep both files wrapped as they are.

- [ ] **Step 5: Verify**

  Run the Step 2 command → both files PASS.
  Run: `./test validate --syntax; echo exit=$?` → `exit=0`;
  `./test; echo exit=$?` → `exit=0`.
  Run: `grep -n "\-\-merges" server/git-sha.ts bin/build-lib tests/git-sha.test.ts` → no output.

- [ ] **Step 6: Commit**

```bash
git add server/git-sha.ts shared/system-status.ts \
    bin/build-lib API.md TODO.md \
    tests/git-sha.test.ts tests/build-commit.test.ts
git commit -m "List first-parent commits in the status history" \
    -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Add the history's type, tone, and rule (mechanical)

**Files:**
- Modify: `web-app/app/styles/tokens.css:108-109`
- Modify: `web-app/app/styles/base.css:82-83`
- Modify: `web-app/app/styles/palette.css:28-30` (Muted
  block)
- Modify: `web-app/app/styles/utilities.css:91-92`
- Modify: `web-app/app/styles/components-cards.css` (after
  `.status-name:hover`)
- Test: `tests/status-page.test.ts`

**Interfaces:**
- Produces: classes `.text-xsm`, `.text-soft`, and
  `.status-rule`, which Tasks 4 and 5 use.

- [ ] **Step 1: Write the failing test** in
  `tests/status-page.test.ts`:

```ts
Deno.test('the status history has its type, tone, and rule',
() => {
    const read = (name: string): string =>
        Deno.readTextFileSync(
            'web-app/app/styles/' + name,
        );
    assertStringIncludes(
        read('tokens.css'), '--text-xsm: 0.8125rem;',
    );
    assertStringIncludes(
        read('base.css'),
        '.text-xsm { font-size: var(--text-xsm);'
        + ' line-height: 1.125rem; }',
    );
    assertStringIncludes(
        read('palette.css'),
        '--soft-foreground: var(--gray-300);',
    );
    assertStringIncludes(
        read('utilities.css'),
        '.text-soft { color: hsl(var(--soft-foreground)); }',
    );
    const cards = read('components-cards.css');
    assertEquals(
        cssDeclaration(cards, '.status-rule', 'border'),
        'none',
    );
    assertEquals(
        cssDeclaration(cards, '.status-rule', 'border-top'),
        '1px solid',
    );
    assertEquals(
        cssDeclaration(
            cards, '.status-rule', 'border-top-color',
        ),
        'inherit',
    );
});
```

- [ ] **Step 2: Watch it fail**

  Run: `$ONE tests/status-page.test.ts` (`ONE` as in Global Constraints)
  Expected: FAIL on `--text-xsm`.

- [ ] **Step 3: Add the CSS.**
  - `tokens.css`: put `--text-xsm: 0.8125rem;` between
    `--text-xs` and `--text-sm`.
  - `base.css`: put the `.text-xsm` one-liner, exactly as
    the test quotes it, between `.text-xs` and `.text-sm`.
  - `palette.css`: under `/* Semantic: Muted */`, after
    `--muted-foreground`, add `--soft-foreground:
    var(--gray-300);`, with a one-line comment: "Between
    muted and foreground: the status history's subject."
  - `utilities.css`: put the `.text-soft` one-liner between
    `.text-foreground` and `.text-muted`.
  - `components-cards.css`: add this rule after
    `.status-name:hover`:

```css
/* The rule takes the card's own border colour, so it
   tints with each tone. It must be a direct child of
   .status-card for inherit to reach the card. */
.status-rule {
    border: none;
    border-top: 1px solid;
    border-top-color: inherit;
}
```

- [ ] **Step 4: Verify**

  Run the Step 2 command → PASS. Run `./test validate
  --syntax; echo exit=$?` → `exit=0`. Run `./test lint;
  echo exit=$?` → `exit=0`.

- [ ] **Step 5: Commit**

```bash
git add web-app/app/styles tests/status-page.test.ts
git commit -m "Add the status history type and tone tokens" \
    -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Show the new tokens on the design-system page (mechanical)

The operator asked for this: the living showcase at
`/design-system/` must show the 13px step and the soft
foreground.

**Files:**
- Modify: `web-app/design-system/index.ts:434-437` (UI
  Colors swatches), `:500-509` (type rows)
- Modify: `web-app/app/styles/pages-design-system.css:234`
  (swatch fills)
- Test: `tests/design-system-render.test.ts`

**Interfaces:**
- Consumes: `.text-xsm` and `--soft-foreground` from
  Task 3.
- `buildColorSwatch(name, variable)` builds the class
  `'bg' + variable.replace('--', '-')`, so the swatch
  needs `.bg-soft-foreground`.

- [ ] **Step 1: Write the failing test** in
  `tests/design-system-render.test.ts`:

```ts
Deno.test('the showcase shows the status history tokens',
() => {
    const rendered = buildDesignSystemPage().toString();
    assertStringIncludes(rendered, '<p class="text-xsm">');
    assertStringIncludes(
        rendered,
        'color-swatch-block bg-soft-foreground',
    );
    assertStringIncludes(
        rendered, '--soft-foreground</code>',
    );
    const css = Deno.readTextFileSync(
        'web-app/app/styles/pages-design-system.css',
    );
    assertStringIncludes(
        css,
        '.bg-soft-foreground {\n'
        + '    background-color:'
        + ' hsl(var(--soft-foreground));\n}',
    );
});
```

- [ ] **Step 2: Watch it fail**

  Run: `$ONE tests/design-system-render.test.ts` (`ONE` as in Global Constraints)
  Expected: the new test FAILS on `text-xsm`.

- [ ] **Step 3: Add the entries.**
  - In the Typography card, between the `text-sm` and
    `text-xs` rows, add `buildTypographyRow('text-xsm',
    'text-xsm', 'Status history lines')`.
  - In UI Colors, directly after the Foreground swatch,
    add `buildColorSwatch('Soft Foreground',
    '--soft-foreground')`.
  - In `pages-design-system.css`, after `.bg-foreground`,
    add the rule exactly as the test quotes it, on three
    lines.

- [ ] **Step 4: Re-pin the fingerprint.** Run the Step 2
  command again. The new test PASSES. `'design-system
  render is byte-stable'` now FAILS, because the paint
  changed on purpose, and the failure prints the actual
  length and digest. Copy both into that test's
  `assertStrictEquals` pair. Keep the digest split across
  two string lines, as now. Run the command again →
  all PASS.

- [ ] **Step 5: Verify**

  Run: `./test validate --syntax; echo exit=$?` →
  `exit=0`; `./test lint; echo exit=$?` → `exit=0`.

- [ ] **Step 6: Commit**

```bash
git add web-app/design-system/index.ts \
    web-app/app/styles/pages-design-system.css \
    tests/design-system-render.test.ts
git commit -m "Show the status history tokens on the showcase" \
    -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Lay the history inside the verdict card (judgment)

**Files:**
- Modify: `server/status-page.ts` (`statusPageHtml`
  `:128-188`, `statusUnavailableHtml` `:190-212`,
  `statusCard` `:216-244`, delete `mergesSection`
  `:246-270`, rewrite `commitLines` `:272-286`, fold
  `ageLines` `:288-305` into it)
- Test: `tests/status-page.test.ts`,
  `tests/http-server.test.ts:718-721, 899-901`,
  `tests/browser/status-refresh.test.ts:221-299`

**Interfaces:**
- Consumes: `RunningCommit.history`, `commitDocumentOf`,
  `NO_DURATION`, and the CSS classes from Task 3.
- Produces: the markup Tasks 6 and 7 read.
  `#status-card` holds `p.text-muted > .git-sha`, then
  `.git-subject`, then optionally `hr.status-rule` and
  `ol[aria-label="Recent commits"] > li`. There is no
  `#status-merges`.

Module-private in `server/status-page.ts`. The design fixes
these class strings:

```ts
interface CommitLook {
    readonly line: string;
    readonly sha: string;
    readonly subject: string;
}
const DEPLOYED_LOOK: CommitLook = {
    line: 'text-muted text-sm',
    sha: 'git-sha font-mono text-foreground',
    subject: 'git-subject text-base',
};
const HISTORY_LOOK: CommitLook = {
    line: 'text-muted text-xsm',
    sha: 'git-sha font-mono',
    subject: 'git-subject text-sm text-soft',
};
```

`commitLines(commit: CommitDocument, look: CommitLook):
readonly string[]` returns these array elements, which the
page joins with `'\n'`:
1. `<p class="{look.line}">`.
2. Only when both `git-age` and `git-committed-at` are
   present: `<time class="git-age" aria-live="off"
   datetime="{at}">{age === NO_DURATION ? age : age + '
   ago'}</time>`, then `<span aria-hidden="true">•</span>`.
3. `<span class="{look.sha}">{sha}</span>`, then `</p>`.
4. Only when a subject is present: `<p
   class="{look.subject}">{subject}</p>`.

Escape every value with `escapeText`. `statusCard(tone,
rating, pills, commit, history: readonly
CommitDocument[])` drops the `<p class="text-muted
text-sm">git sha</p>` line. After the pills it emits
`commitLines(commit, DEPLOYED_LOOK)`. Then, only when
`history.length > 0`, it emits `<hr class="status-rule
mt-8 mb-8">`, `<ol class="flex flex-col gap-5"
aria-label="Recent commits">`, each entry as `<li>` +
`commitLines(entry, HISTORY_LOOK)` + `</li>`, and `</ol>`.
`statusPageHtml` maps `commit.history` (an absent one
renders as none) through `commitDocumentOf(…, nowMs)` once.
It passes the same array to the live card and to the
timeout card. Both `<main>` class lists end in `
bg-background py-8">`.

- [ ] **Step 1: Write the failing unit tests** in
  `tests/status-page.test.ts`:
  - `'the status sha clips to seven digits'`: expect
    `'class="git-sha font-mono text-foreground"'`.
  - `'the status card names the commit by its subject'`:
    `named` includes:

```ts
'<p class="text-muted text-sm">\n'
+ '<span class="git-sha font-mono text-foreground">'
+ sha + '</span>\n'
+ '</p>\n'
+ '<p class="git-subject text-base">'
+ '&lt;b&gt;&quot;it\'s&quot; \\ ${x} é</p>\n'
+ '</section>'
```

    It also asserts `assertNotMatch(named, />git sha</)`
    and `assertNotMatch(named, /•/)`, because there is no
    time and so no separator.
  - `'the status page refreshes only with its script'`:
    the `timeout` slice includes the same deployed lines
    with subject `Keep the &quot;card&quot; &amp;
    &lt;sha&gt;`.
  - `'the status card ages the commit'`: `aged` includes
    `'<p class="text-muted text-sm">\n' +
    ageTag('2 minutes ago') + '\n<span
    aria-hidden="true">•</span>\n<span class="git-sha
    font-mono text-foreground">' + SHA + '</span>\n</p>'`.
    The ordering pin flips to `ageAt <
    aged.indexOf('class="git-sha')`.
  - Replace `'the merges list below the card'` with
    `'the history follows the commit inside the card'`.
    Call `statusPageHtml({ sha: SHA, subject: 'Head',
    history: [{ sha: HISTORY_SHA, subject: 'Land <the>
    commit', committedAt: COMMITTED_AT }, { sha: OLDER_SHA
    }] }, { api: 'up' }, { script:
    '/assets/status-refresh.0123abcd.js' }, COMMITTED_MS +
    3 * 60 * 60 * 1_000)`, where `OLDER_SHA =
    'abcdefabcdefabcdefabcdefabcdefabcdefabcd'`. Assert
    that it includes:

```ts
'<p class="git-subject text-base">Head</p>\n'
+ '<hr class="status-rule mt-8 mb-8">\n'
+ '<ol class="flex flex-col gap-5"'
+ ' aria-label="Recent commits">\n'
+ '<li>\n<p class="text-muted text-xsm">\n'
+ ageTag('3 hours ago') + '\n'
+ '<span aria-hidden="true">•</span>\n'
+ '<span class="git-sha font-mono">' + HISTORY_SHA
+ '</span>\n</p>\n'
+ '<p class="git-subject text-sm text-soft">'
+ 'Land &lt;the&gt; commit</p>\n</li>\n'
+ '<li>\n<p class="text-muted text-xsm">\n'
+ '<span class="git-sha font-mono">' + OLDER_SHA
+ '</span>\n</p>\n</li>\n'
+ '</ol>\n</section>'
```

    Also assert `html.match(/aria-label="Recent
    commits"/g)?.length === 2`, because the timeout
    template carries the list too. Assert
    `assertNotMatch(html, /status-merges|Recent merges/)`
    and `assertNotMatch(html, /style=/)`. For `history`
    of `undefined` and `[]`, the page has no `<hr` and no
    `<ol`.
  - New `'both status pages pad the main'`: an up page
    and `statusUnavailableHtml()` each include `'
    bg-background py-8">'`.

  In `tests/http-server.test.ts`, line 720's expectation
  becomes `'<p class="git-subject text-base">' +
  '&lt;b&gt;&quot;it\'s&quot; \\ ${x} é</p>'`, and line
  900's becomes `'class="git-sha font-mono
  text-foreground"'`.

- [ ] **Step 2: Watch them fail**

  Run: `$ONE tests/status-page.test.ts` (`ONE` as in Global Constraints)
  Expected: the rewritten tests FAIL on the old markup.

- [ ] **Step 3: Implement** `CommitLook`, the two looks,
  `commitLines`, the new `statusCard` signature, the
  `statusPageHtml` wiring, and `py-8` as specified above.
  Delete `mergesSection` and `ageLines`, and move the
  "never announced" comment onto `commitLines`. Every
  line stays ≤ 78 chars.

- [ ] **Step 4: Verify the units**

  Run the Step 2 command → PASS. Run `./test validate
  --syntax; echo exit=$?` → `exit=0`. Run `./test; echo
  exit=$?` → `exit=0`.

- [ ] **Step 5: Write the browser tests** in
  `tests/browser/status-refresh.test.ts`:
  - In `agingStatus`, the history entry becomes `{ sha:
    'fedcba9876543210fedcba9876543210fedcba98', subject:
    'Land the commit before', committedAt: new
    Date(committedMs - 1_000).toISOString() }`. It is
    seconds old, so its age ticks.
  - Add `const HISTORY_AGE = \`document.querySelector('#status-card
    ol .git-age').textContent\`;`. In `'a ticking age
    keeps the card and backs off'`, read it first, then
    `page.until` it differs, before the `kept` check.
  - Replace `'the merges sit below the live card'` with
    `'the history sits inside the live card'`. Its
    evaluate returns `[!!ol.closest('#status-live'),
    ol.querySelector('.git-subject').textContent,
    /^\d+ seconds ago$/.test(ol.querySelector('.git-age')
    .textContent), document.getElementById('status-merges')
    === null].join('|')`, where `ol = document
    .querySelector('#status-card ol')`. Assert `'true|Land
    the commit before|true|true'`.
  - Add `'the card keeps whitespace at a short height'`.
    Use a status whose commit carries ten history entries,
    `{ sha: (index + 1).toString(16).padStart(40, '0'),
    subject: 'Land commit ' + (index + 1) }`, which makes
    the card taller than 400px. Call `await
    page.setViewport(1280, 400, false)`, then evaluate
    `scrollTo(0, 0)` and return `[card.height >
    innerHeight, card.top >= 32,
    document.documentElement.scrollHeight - card.bottom >=
    32].join('|')` from `document.getElementById(
    'status-card').getBoundingClientRect()`. Wrap it in
    `page.until` until it equals `'true|true|true'`.

- [ ] **Step 6: Run the browser suite (outside the
  sandbox)**

  Run: `export DENO_DIR="$TMPDIR/deno-dir"; ./test browser; echo exit=$?`
  Expected: `exit=0`. The three status tests above pass,
  and the rest stay green.

- [ ] **Step 7: Commit**

```bash
git add server/status-page.ts tests/status-page.test.ts \
    tests/http-server.test.ts \
    tests/browser/status-refresh.test.ts
git commit -m "Lay the status history inside the verdict card" \
    -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Reload the status page when its script changes (judgment)

**Files:**
- Modify: `web-app/app/status-refresh.ts` (header comment
  `:1-14`, `MERGES_ID` `:22`, `showMerges` `:112-124`,
  `showAnswer` `:126-140`, `refresh` `:145-154`)
- Test: `tests/browser/status-refresh.test.ts`

**Interfaces:**
- Consumes: the server page from Task 5. The page has one
  `<script src="/assets/status-refresh.<hash>.js"
  defer>` in `<head>` and none when the manifest has no
  entry.
- Produces, all module-private:
  - `type RefreshOutcome = 'shown' | 'reloading'`.
  - `runningScript(): string` returns
    `document.currentScript`'s `src` **attribute**
    (`getAttribute('src')`, not `.src`, which is
    absolute). It throws `Error('the status script cannot
    name itself')` when `currentScript` or the attribute
    is null.
  - `servedScript(answer: Document): string | undefined`
    returns the first `script[src]`'s `src` attribute, or
    `undefined`.
  - `showAnswer(): Promise<RefreshOutcome>`.

- [ ] **Step 1: Write the failing browser tests** in
  `tests/browser/status-refresh.test.ts`:
  - A narrow helper, because a reload can destroy the
    context an in-flight evaluate runs in:

```ts
// A reload destroys the context an evaluate may be
// in; that one error means "not yet", any other fails.
async function untilAcrossReload(
    page: Page, expression: string, label: string,
): Promise<void> {
    const deadline = Date.now() + RELOAD_MS;
    while (Date.now() < deadline) {
        try {
            if (await page.evaluate<boolean>(expression)) {
                return;
            }
        } catch (error) {
            if (!(error instanceof Error)
                || !/context/i.test(error.message)) {
                throw error;
            }
        }
        await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(label + ' timed out');
}
```

    Use `const RELOAD_MS = 10_000;`.
  - `'a new status script reloads the page'`: first
    `cardReads(page, 'success|UP|')`. Then evaluate a
    snippet that sets `window.kept = true` and wraps
    `window.fetch`, as `'an unchanged status'` does. The
    wrapper awaits the real response, reads `.text()`,
    and returns `new Response(html.replace(
    /status-refresh\.[0-9a-f]+\.js/,
    'status-refresh.0000000000000000.js'), { status:
    response.status, headers: response.headers })`. Then
    `untilAcrossReload(page, "window.kept === undefined &&
    !!document.getElementById('status-card')", 'the
    reloaded page')`. Then evaluate `window.settled =
    true`, and `await stays(page, 'window.settled ===
    true', UNCHANGED_MS)`, which pins that no second
    reload happens.
  - In `'no answer shows the timeout card'`, evaluate
    `window.kept = true` before `withHeldRequests`. After
    the final `cardReads(page, 'success|UP|')`, assert
    `window.kept === true`, since an unanswered refresh
    never reloads.

- [ ] **Step 2: Watch them fail (outside the sandbox)**

  Run: `export DENO_DIR="$TMPDIR/deno-dir"; ./test browser; echo exit=$?`
  Expected: `'a new status script reloads the page'`
  FAILS with "the reloaded page timed out". The rest
  pass.

- [ ] **Step 3: Implement.**
  - Delete `MERGES_ID`, `showMerges`, and the
    `showMerges(answer)` call.
  - At the top of the `refreshStatus` IIFE, before any
    `await`, call `const running = runningScript();`.
  - In `showAnswer`, right after `answeredPage()`: when
    `answer !== undefined` and `servedScript(answer) !==
    running`, call `location.reload()` and return
    `'reloading'`. Otherwise do the existing template and
    card work, then return `'shown'`.
  - In `refresh`, call `schedule()` in `finally` unless
    the outcome was `'reloading'`. A thrown error still
    shows the timeout card, rethrows, and schedules.
  - Header comment: delete the sentence "The merges below
    the card are replaced when they differ." Add: "When
    the answered page names another status script, the
    page reloads instead, so a deploy's new card never
    meets an old script; the reloaded page runs the
    script it names, so it cannot loop."

- [ ] **Step 4: Verify (browser outside the sandbox)**

  Run: `./test validate --syntax; echo exit=$?` →
  `exit=0`; `./test lint; echo exit=$?` → `exit=0`;
  `./test browser; echo exit=$?` → `exit=0`.
  Run: `grep -n "merges\|MERGES" web-app/app/status-refresh.ts` → no output.

- [ ] **Step 5: Commit**

```bash
git add web-app/app/status-refresh.ts \
    tests/browser/status-refresh.test.ts
git commit -m "Reload the status page when its script changes" \
    -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Keep the sha on its line (judgment; see Question 1)

**Files:**
- Modify: `web-app/app/styles/base.css:71-80` (`.git-sha`)
- Test: `tests/browser/status-refresh.test.ts`,
  `tests/status-page.test.ts:112-142`

- [ ] **Step 1: Write the failing browser test**
  `'each commit line is one line tall'`, with
  `withStatusPage(…, agingStatus())`. It has one history
  entry, so there are two lines. Assert that this
  evaluates to `'true,true'`:

```ts
`[...document.querySelectorAll(
    '#status-card p:has(> .git-sha)')]
    .map((line) => Math.abs(
        line.getBoundingClientRect().height
        - parseFloat(getComputedStyle(line).lineHeight),
    ) < 0.5).join(',')`
```

  In `'the status sha clips to seven digits'`, add
  `assertMatch(css, /\.git-sha \{[^}]*vertical-align:
  bottom;[^}]*\}/)`.

- [ ] **Step 2: Watch them fail.** Run `$ONE
  tests/status-page.test.ts` (`ONE` as in Global
  Constraints) → FAIL on `vertical-align`.
  Run `./test browser` outside the sandbox → the new test
  FAILS, because a line is taller than its line-height.
  If the browser test already passes, report it, keep the
  test, and skip the CSS step.

- [ ] **Step 3: Implement.** Add `vertical-align:
  bottom;` to `.git-sha` in `base.css`. Extend its
  comment: "An inline-block that clips sits on the
  baseline by its bottom edge; bottom alignment keeps the
  line one line-height tall."

- [ ] **Step 4: Verify.** Run the Step 2 commands → PASS
  and `exit=0`. Run `./test validate --syntax; echo
  exit=$?` → `exit=0`.

- [ ] **Step 5: Commit**

```bash
git add web-app/app/styles/base.css \
    tests/status-page.test.ts \
    tests/browser/status-refresh.test.ts
git commit -m "Keep the status sha on its line" \
    -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Run Layers 1 and 2 (mechanical; browser outside the sandbox)

- [ ] **Step 1: Sweep for leftovers**

  Run: `grep -rn "git-merges\|status-merges\|Recent merges\|MERGES_SHOWN\|\.merges\b" api client shared server web-app tests bin API.md TODO.md`
  Expected: no output.

- [ ] **Step 2: Layer 1**

  Run: `export DENO_DIR="$TMPDIR/deno-dir"; ./test validate; echo exit=$?`
  Expected: `exit=0`. This includes `generate-api-documentation
  --check`, and the status example carries no history, so
  it holds.

- [ ] **Step 3: Layer 2 (outside the sandbox; needs
  Chrome)**

  Run: `export DENO_DIR="$TMPDIR/deno-dir"; ./test validate browser; echo exit=$?`
  Expected: `exit=0`.

- [ ] **Step 4: Report.** This task makes no commit.
  Squashing to one commit per feature, the visual check
  against option C in the develop session, and the merge
  all belong to the coordinator and the operator.
