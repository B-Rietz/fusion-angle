# The status card's commit history

Branch and worktree `status-commit-history`. Builds on
master's `8631b61c5` ("Show commit ages and recent merges
on /status").

## Intent

`8631b61c5` gave `/status` commit ages and the ten merges
before the running commit, but laid them out as labelled
rows: a "git sha" caption, the sha, the subject, the age,
and a second card, `#status-merges`, below the verdict.
The operator wants the deployed commit read as one line
and the history read as its quieter tail, all in the one
card. They chose mockup "B — same layout, quieter
history", and later, from three type mockups, option C
for the history's sizes and color.

Two more faults surfaced with that deploy. An open
status tab kept running the script it loaded, so it
swapped in the new card but never showed the merges: the
old script knew nothing of `#status-merges`. And a card
that now holds ten merges outgrows a short viewport,
where vertical centering leaves it flush against the top
edge.

## Decisions

The operator decided these:

- Drop the "git sha" label.
- Show the deployed commit as one centered line,
  `time-ago • short-sha` (for example `2 minutes ago •
  8631b61`), with its subject centered beneath.
- Under it, a horizontal rule with generous whitespace
  above and below.
- Under the rule, the history: the ten commits before the
  deployed commit on its first-parent line, newest first.
  Each one reads the same way, an age-and-sha line with
  its subject beneath, and the entries have comfortable
  space between them. The deployed commit may or may not
  be a merge.
- Mockup B: the history is a step smaller and muted, so
  the deployed commit stays the focus. All of it sits
  inside the verdict card, under the current commit.
  `#status-merges` goes away.
- Option C for the type, from three mockups the operator
  reviewed. The deployed commit's `time • sha` line is 14px
  (`text-sm`) muted, the sha mono in the foreground color,
  and its subject 16px (`text-base`) in the normal
  foreground color. Each history entry's `time • sha` line
  is 13px muted with the sha mono, a new size step the
  design system lacks. Its subject is 14px (`text-sm`) in
  a softer tone between muted and foreground, a new
  semantic color. The gap between entries stays 20px and
  the rule's margins stay 32px.
- The "git sha unavailable" page also gets the top and
  bottom padding (`py-8`), and the file name follows
  AGENTS.md's slug rule: the spec is `<slug>-design.md`.
- A commit that lands on master without a merge commit
  must also appear in the history list. It should not
  happen, but hope is not a plan.
- Leave comfortable whitespace above and below the card
  at every viewport height. A short page may still sit
  centered.

The coordinator decided these, and the operator did not
object:

- When the answered page names a different
  status-refresh script (a new hashed asset name) from
  the one the running script loaded under, the page
  calls `location.reload()` instead of patching itself.
- The history becomes the ten commits before the deployed
  one on its first-parent line, not only merges. The
  coordinator proposed the name `history`, and the
  operator may correct it. The change drops `--merges`
  from `git log --merges --first-parent -n 11` in
  `bin/build-lib`'s `commit_log` and in
  `server/git-sha.ts`'s `readWorktreeCommit`. On master
  the first-parent chain is exactly every merge plus any
  direct commit, and branch-internal commits stay hidden.
  `-n 11` stays, and `commitLogOf` still drops the head
  line: with `--first-parent` and no `--merges` the head
  is always line 1 of the second log, so it is always
  dropped, and the generic dedupe stays. Render's fetch
  depth of 32 still covers 11 first-parent steps.
- The names follow: JSON key `git-merges` becomes
  `git-history`, `RunningCommit.merges` becomes `history`,
  `MERGES_SHOWN` becomes `HISTORY_SHOWN`, and the list's
  `aria-label` "Recent merges" becomes "Recent commits".

## Goals

- The card reads, top to bottom: the name, the rating,
  the pills when down, the deployed commit's line and
  subject, a rule, and the history list.
- A commit with no time shows the sha alone, with no
  separator. A commit with no subject shows no subject
  line. With no history there is no rule and no list.
- The timeout template's card carries the same history,
  so a timeout keeps the history on screen.
- After a deploy, an open tab picks up the new page and
  script without a manual reload.
- At every viewport height the card has at least
  `--space-8` of whitespace above and below it.

## Non-goals

- The JSON document changes in one way only: `git-merges`
  is renamed `git-history`. It keeps `git-sha`,
  `git-subject`, `git-committed-at`, `git-age`, `up`, and
  `components`, with no new data. The rename is breaking
  for any consumer of `git-merges`; none exists in-repo
  besides tests.
- `statusUnavailableHtml`'s "git sha unavailable" message
  stays. It is an error message, not the label being
  removed. Its `<main>` does take the same vertical
  padding, so both `/status` bodies speak one layout.
- No change to the backoff table or the API probe. The
  git read changes only as the Decisions say: no
  `--merges`.

## Anti-goals

- A ticking age must never announce in the `aria-live`
  region, and must never reset the refresh backoff. The
  history now sits inside `#status-live`, so this covers
  every age in the history too.
- No inline styles. Every size, color, and space comes
  from a token through a utility class or one named
  status class.
- No reload loop. The page reloads only when two script
  names differ, and the reloaded document runs the script
  it names.

## Approaches

**Where the history lives.**
(a) Inside the verdict card, under the current commit.
(b) A separate card below, as `8631b61c5` built it.
The operator picked (a). It also simplifies the script:
the history becomes part of the card, so the one ageless
comparison and `copyAges` cover it, and `showMerges`, the
`MERGES_ID` constant, and the second replacement path all
go. The cost is that a change of history now announces
through the live region along with the card. That only
happens on a deploy, which changes the deployed commit,
so the announcement is due anyway.

**What the history lists.**
(a) Merges plus direct commits, by two queries: one for
merges and one for non-merge commits, then joined.
(b) The first-parent history: one `git log --first-parent
-n 11`, no `--merges`.
We picked (b). One query yields exactly the set wanted,
since on master the first-parent chain is every merge plus
any direct commit, with no join or ordering to get wrong.

**A stale script after a deploy.**
(a) Reload when the answered page's
`<script src="/assets/status-refresh.<hash>.js">` differs
from the name the running script loaded under.
(b) Version the script's contract, for example with a
`data-` version on the card that the script checks before
it patches.
(c) Keep the script ignorant of layout, so any card is
patchable.
We picked (a). The hashed name is already a content
version that the build maintains, so (a) needs no new
field and nothing a person has to bump. (b) adds a second
version that someone must remember to change. The script
already holds no markup. The `#status-merges` fault was
a new element outside the card, and (c) cannot prevent
that shape of change.

The running name is read once, when the script starts,
from `document.currentScript`'s `src` attribute. The
bundle is a classic deferred script, so `currentScript`
is set. It is an immutable value, not a live DOM read. A
page answered with no script (no manifest entry) also
differs, so the tab reloads into the server's script-less
page, which is the honest result. A reload schedules no
further refresh.

**Whitespace around the card.**
(a) Add `py-8` to `<main>`.
(b) Remove `justify-center` and give the card
`margin-block: auto` (safe centering).
We picked (a). `<main>` is `min-h-screen`, a minimum
height, so a tall card grows the flex container rather
than overflowing it, and `justify-center` never clips the
top. The fault is only the missing padding.
`box-sizing: border-box` keeps a short page at exactly
one viewport, still centered. `py-8` is an existing
utility on `--space-8`, so no CSS is added. (b) fixes a
clipping problem that min-height does not have, and it
needs a new utility.

## Markup

The card as `statusCard` renders it, up, with one history entry
shown. Each line below is one element of the joined
array. The newline between the inline elements collapses
to the space either side of `•`.

```html
<section id="status-card"
 class="card status-card max-w-md p-8 text-center"
 data-tone="success">
<h1 class="font-display text-3xl font-bold mb-6">
<a class="status-name" href="/">Fusion Angle</a>
</h1>
<p class="status-rating text-xl font-semibold mb-6">UP</p>
<p class="text-muted text-sm">
<time class="git-age" aria-live="off" datetime="…">2 minutes ago</time>
<span aria-hidden="true">•</span>
<span class="git-sha font-mono text-foreground">8631b61c5…</span>
</p>
<p class="git-subject text-base">Show commit ages and recent merges on /status</p>
<hr class="status-rule mt-8 mb-8">
<ol class="flex flex-col gap-5" aria-label="Recent commits">
<li>
<p class="text-muted text-xsm">
<time class="git-age" aria-live="off" datetime="…">3 hours ago</time>
<span aria-hidden="true">•</span>
<span class="git-sha font-mono">25b4773d9…</span>
</p>
<p class="git-subject text-sm text-soft">Show commit ages and recent merges on /status</p>
</li>
</ol>
</section>
```

`<main>` becomes `flex min-h-screen flex-col items-center
justify-center bg-background py-8`. In the unavailable
page it is `flex min-h-screen items-center justify-center
bg-background py-8`.

These are the mockup's values mapped to tokens:

| Mockup | Token / class |
|---|---|
| current line 14px muted, sha foreground mono | `text-sm text-muted`; sha `font-mono text-foreground` |
| subject 15px | `text-base` (16px; no 15px step) |
| rule 1px, card border tone, ~32px above and below | `.status-rule`, `mt-8 mb-8` (`--space-8`) |
| entries ~20px apart | `gap-5` (1.25rem) |
| history line 13px | `text-xsm` (13px, new) `text-muted`; sha `font-mono` |
| history subject 14px, softer | `text-sm text-soft` (new color) |

Two additions to the design system carry option C, both
documented in DESIGN-SYSTEM.md. `--text-xsm: 0.8125rem` in
`tokens.css` (13px, between `--text-xs` and `--text-sm`)
with `.text-xsm { font-size: var(--text-xsm); line-height:
1.125rem; }` in `base.css` beside the other steps. And
`--soft-foreground: var(--gray-300)` in `palette.css`
(between `--muted-foreground` and `--foreground`) with
`.text-soft { color: hsl(var(--soft-foreground)); }` in
`utilities.css`. The palette has the one `:root` and no
separate light theme, so the token is defined once.

One new rule, in `components-cards.css` beside the other
status rules:

```css
.status-rule {
    border: none;
    border-top: 1px solid;
    border-top-color: inherit;
}
```

`inherit` takes the card's own `border-top-color`, so the
rule matches the success and error tints with no per-tone
selector. It depends on the `<hr>` being a direct child
of `.status-card`. A short comment in the stylesheet
should say so.

`commitLines(commit, sizes)` renders one entry, the line
and then the subject, for both the deployed commit and
the history. The two differ only in their classes, so
either a two-member size choice or two small renderers
will do. `ageLines` folds into the line: the `<time>` and
the `•` appear only when `git-age` and `git-committed-at`
are both present. `statusCard` takes the history,
`readonly CommitDocument[]`, so the live card and the
template card render it the same way.

## Accessibility

- The history is an `<ol>`: its order (newest first) is
  meaning. `aria-label="Recent commits"` names the list
  now that the visible heading is gone.
- The `•` is `aria-hidden="true"`, so a screen reader
  reads "2 minutes ago, 8631b61c5…" and not "bullet".
- The sha keeps the full 40 characters in the markup and
  CSS clips it to 7ch, as `.git-sha` does today. Copy,
  search, and screen readers get the whole id, as the
  displayed-id rule in DESIGN-SYSTEM.md has it.
- Every `<time>` keeps `aria-live="off"`. The region
  announces only a changed card. A reload announces
  nothing, and a screen reader reads the fresh page.
- The `<hr>` keeps its separator role. It divides the
  deployed commit from its history.

## Tests

`tests/status-page.test.ts`:

- Replace the expected commit strings: the line comes
  before the subject, the age before the sha, and the
  separator is aria-hidden. Flip the `ageAt > shaAt`
  ordering pin.
- Assert no `>git sha<` and no `status-merges`.
- With history, the card holds `<hr class="status-rule`
  then `<ol` after the deployed commit's subject, with
  newest first. With none, there is no `<hr` and no
  `<ol`. Rename the fixtures from merges to history.
- With no time, the line is the sha alone, with no `•`.
- The template card holds the same `<ol>`.
- `<main>` carries `py-8`. `style=` stays absent.
- A `cssDeclaration` pin for `.status-rule`'s
  `border-top-color: inherit`.

`tests/git-sha.test.ts`: update for `history`, and add a
test that a non-merge first-parent commit appears in the
history.

`tests/build-commit.test.ts`: `fetched_commit`'s output is
now the head plus 11 first-parent lines.

`tests/server-zip-metafile.test.ts`: update for the rename.

`tests/http-server.test.ts`: the `git-merges` key becomes
`git-history`, and update the `/status` HTML
asserts (around lines 720, 900, and 1081) that quote the
old `git-sha` and `git-subject` classes.

`tests/browser/status-refresh.test.ts`:

- Replace "the merges sit below the live card" with "the
  history sits inside the live card". `#status-card ol` is
  under `#status-live`, its first subject and age read
  as before, and `#status-merges` is absent.
- "a ticking age keeps the card and backs off" also
  checks that the history's age ticks in place.
- New: "a new status script reloads the page". Mark the
  window (`window.kept = true`). Wrap `window.fetch`, as
  "an unchanged status" does, so the answered HTML names
  `status-refresh.<other hash>.js`. Wait until
  `window.kept` is gone and `#status-card` is back. The
  reloaded page runs the real script, so it settles.
- New: "the card keeps whitespace at a short height".
  `setViewport` to a height below the card's. At
  scroll 0, the card's top is at least 32px
  (`--space-8`), and the document's height minus the
  card's bottom is at least 32px.

## Left to the builder

- Whether `commitLines` takes a size choice or splits
  into two renderers.
- The exact top-of-file comment in `status-refresh.ts`:
  drop the merges sentence and add the reload sentence.
- A visual check against option C in the develop session.
- Update any doc prose that describes the old layout
  (`API.md`'s `/status` notes and `TODO.md`, for the
  `git-history` rename and the first-parent history). `docs/superpowers/plans/api-status.md` is
  history and stays.
