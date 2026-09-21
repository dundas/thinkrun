---
name: before-after
description: "Produce a | Before | After | screenshot table for a pull request — two revisions, two URLs, or two existing PNGs, captured at the same viewport with ThinkRun and attached without a public paste host. Use when: before/after screenshots, show the visual diff of this change, the PR needs a before-and-after table, the ship step of a software-factory workflow for a change with a visible surface. Do NOT use for: proving that behaviour works with pass/fail evidence (that is prove-it); a UX review or fix list (ux-audit); an ad-hoc screenshot of a page with no change under test (web-browse); changes with no visible surface."
category: evidence
sync: all
---

# Before / After

One job: a reviewer opens the PR and sees, side by side, what the surface
looked like before the change and after it. Same page, same viewport, same
element. Two images and one line of what changed. Nothing else.

This is not proof that the change *works* — that is `prove-it`, and the two
share captures: if `prove-it` already produced PNGs, reuse them.

---

## Inputs

- **What to capture**: a URL, optionally narrowed to a selector (`--selector`)
  for a component-level shot, or `--full-page` for the whole page.
- **Before source** (one of): the base revision running somewhere; a previous
  deployment URL; an existing PNG.
- **After source**: the change under test, running; or an existing PNG.
- **PR number** (optional): where the table goes.

---

## Step 0 — Doctor, mode, target

**Already have both PNGs?** Skip to "Reusing existing PNGs" at the end — no
browser, no `doctor`, no session. Everything in Steps 0–2 exists to *produce*
the two images.

```bash
thinkrun doctor
```

Local mode for anything behind login or on localhost; cloud mode for public
URLs with no display (cloud browsers cannot reach your `localhost`). (Cloud path: command surface verified against CLI 0.1.37; not smoke-tested
when this skill shipped — a session-provisioning incident on 2026-09-18.)

Run exactly one of the two blocks.

**Local** (behind login, or localhost):

```bash
# open your OWN window. A capture needs the tab visible; on a shared machine another
# agent's window can be in front, and Chrome returns "image readback failed" for a hidden tab.
TAB_ID=$(thinkrun new-window "about:blank" --json | jq -er .data.tabId) || exit 1; T="--tab $TAB_ID"
visible() { [ "$(thinkrun evaluate 'document.visibilityState' $T --json | jq -r .data)" = "visible" ] || { echo "tab is hidden; bring the window forward and retake"; exit 1; }; }
same_session() { :; }
```

**Cloud** (public URL, no display):

```bash
SID=$(thinkrun cloud start --json | jq -er .data.sessionId) || exit 1; T="--mode cloud"
trap 'thinkrun cloud stop -s "$SID" >/dev/null 2>&1' EXIT      # stops THIS session, never whatever is active
# the active cloud session is machine-wide state; there is no per-command session flag,
# so assert it before every navigate and capture:
same_session() { [ "$(thinkrun cloud status --json | jq -r .data.sessionId)" = "$SID" ] || { echo "active cloud session changed; stop"; exit 1; }; }
visible() { [ "$(thinkrun evaluate 'document.visibilityState' $T --json | jq -r .data)" = "visible" ] || { echo "tab is hidden; retake"; exit 1; }; }
```

Then, for either:

```bash
TASK=<short-slug>; mkdir -p .artifacts/$TASK        # gitignored; evidence is posted, never committed
```

---

## Step 1 — Before

The before shot comes from the **pre-change build**: the previous deployment
URL, or the base revision in a separate worktree on its own port
(`git worktree add /tmp/before origin/main`). Never stash or check out over
the user's working tree. If no pre-change build is reachable and no PNG
exists, say so — a "before" of the current build is a lie.

The cheapest moment to take it is while reproducing the issue, before any
fix exists. If you are also running `prove-it`, its `before-*.png` is this.

```bash
BEFORE_URL=<pre-change build>
same_session
thinkrun navigate "$BEFORE_URL" $T; sleep 2; visible; same_session
thinkrun screenshot --output .artifacts/$TASK/before.png --selector "<css>" --max-dimension 1280 --caption "before" $T
```

---

## Step 2 — After

Same URL path, same selector, same `--max-dimension`, same window. If the
viewport changed between the two shots (a resized window, a different
device emulation), the pair is not comparable — retake both.

```bash
AFTER_URL=<the change under test>
same_session
thinkrun navigate "$AFTER_URL" $T; sleep 2; visible; same_session
thinkrun screenshot --output .artifacts/$TASK/after.png --selector "<css>" --max-dimension 1280 --caption "after" $T
```

Look at both with the Read tool before writing anything. If they are
identical, the change has no visible surface here — say that instead of
posting two identical images.

**Check the capture honoured the flags.** `--selector` and `--max-dimension`
are applied by the extension; an older installed extension (one that does
not report its version in `thinkrun doctor`) returns the full viewport
regardless. If both images came back full-size, crop both with the *same*
box locally (`sips -c H W --cropOffset Y X`, or ImageMagick `-crop`) and say
so in the caption. Never crop one and not the other.

---

## Step 3 — The table

```markdown
| Before | After |
|--------|-------|
| ![before](<before-image>) | ![after](<after-image>) |

<one line: what changed, e.g. "Empty-state copy replaced with the import CTA; button moved above the fold.">
```

Where the images live:

- **Repo-hosted (preferred).** Commit the two PNGs to the PR branch under a
  path the repo already uses for docs/screenshots (`docs/img/`, `.github/`),
  or, if the repo has no such path, ask the user before adding one. Reference
  them with the raw GitHub URL for the branch. This keeps the evidence with
  the code and behind the repo's own access control.
- **ThinkRun share (optional, with the user's explicit yes).** A share of the
  session exposes what the browser saw — on a logged-in tab, that can be the
  user's data. Password-protect it, hand the password to the user out of
  band, and exclude console/network. See `prove-it` for the request.
- **Never a public paste host.** No 0x0.st, no imgur, no anonymous gists.

If neither is possible, **do not post the table** — local paths render as
broken images and prove nothing. Give the user the table and the two paths in
your reply and say they are in `.artifacts/$TASK/` to drag into the PR. If
they want a placeholder on the PR now, post one line stating the before/after
pair is captured and pending attachment.

---

## Step 4 — Post

Save the Step 3 table as `.artifacts/$TASK/before-after.md` (the two image
references and the one-line caption). Post it only when both images are
reachable by the reviewer (repo-hosted URLs or a share):

```bash
gh pr comment <n> --body-file .artifacts/$TASK/before-after.md
```

Clean up: the `trap` stops your cloud session by id. Local: `thinkrun release`
(it releases the attached tab; it takes no `--tab`).

---

## Reusing existing PNGs

Both sources can be files, and then ThinkRun is not involved at all:

```bash
TASK=<short-slug>; mkdir -p .artifacts/$TASK
cp <existing-before>.png .artifacts/$TASK/before.png
cp <existing-after>.png  .artifacts/$TASK/after.png
```

Then Step 3 (table) and Step 4 (post). Check the two images are the same
size before pairing them; if not, say so in the caption. State where each came from in the one-line caption.

---

## Known limitations

- Cloud mode has no per-command session flag; `same_session` runs before each
  navigate and capture, and another process can still switch the active
  session in between. Local mode with `--tab` has no such gap.
- `--selector` / `--max-dimension` depend on the installed extension; see
  Step 2 for the local-crop fallback.

## Do NOT use for

- "Prove the coupon field rejects expired codes" → `prove-it`
- "Walk through the flow and tell me what's off" → `ux-audit`
- "Screenshot the pricing page" (no change under test) → `web-browse`
- API, CLI, or performance changes — nothing to look at; use `prove-it` with
  output pairs or measured numbers
