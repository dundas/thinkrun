---
name: prove-it
description: "Prove that a change works with captured evidence — named test targets in, a pass/fail table with a screenshot, console output and network requests per target out, posted to the PR. Use when: prove this works, attach evidence to the PR, verify the feature we shipped, show it working before merge, 'did the agent actually test this?', a numeric before/after for a perf fix, the prove step of a software-factory workflow. Do NOT use for: an open-ended UX review or 'find what looks wrong' (ux-audit); checking whether a page loads with no change under test (web-browse); when the user names the thinkrun CLI or MCP and wants raw control (thinkbrowse-cli / thinkbrowse-mcp); writing unit or E2E tests."
category: evidence
sync: all
---

# Prove It

You are the quality-control step. A change has been made — a feature, a fix, a
perf improvement — and someone is about to trust a sentence like "tested, works".
Your job is to replace that sentence with evidence: for each named claim, a
captured result from a real browser, and a verdict of `pass`, `fail`, or
`not-exercised`. If anything is not `pass`, the change goes back to build. You do
not summarise, soften, or open the PR on a non-pass.

Two things this skill is not: it is not a UX review (no opinions, no fix list —
that is `ux-audit`), and it is not "have a look at the page" (that is `web-browse`).
It needs a change under test and claims about it.

---

## Inputs

- **Test targets** (required). One or more behaviours phrased as testable
  statements: "the coupon field rejects expired codes", "the dashboard loads in
  under 300 ms", "the empty state shows the import CTA". If the user gives none,
  derive them from the diff or PR title, list them back, and proceed.
  **Out of scope for this skill:** anything the browser session cannot observe —
  a downloaded file's contents, an email that was sent, a row written to a
  database. Say so and prove it another way (a script, a query) rather than
  passing a target a screenshot cannot support.
- **Revision under test**: `git rev-parse --short HEAD` and the branch, or the
  deployment URL. It goes in the report header.
- **Where to post** (optional): a PR or issue number for `gh`.

---

## Step 0 — Doctor, then choose a mode

```bash
thinkrun doctor
```

Read three lines of the output before anything else:

- `Server acceptance: accepted` — an API key is accepted. The Activity Feed
  session, the share link, and cloud mode all depend on this. Without it, local
  mode still works and the report says `session: none (no API key)`.
- `Bridge health` — the extension + native host are up; local mode is available.
- If neither local nor cloud is available, **stop and paste the doctor output.**
  Do not fall back to "I verified by reading the code". That is the failure this
  skill exists to prevent.

**Local mode** — the app needs the user's login or cookies, or runs on localhost.

```bash
thinkrun tabs
TAB_ID=<a clean tab from the list>
thinkrun attach $TAB_ID --audit      # --audit: best-effort screenshot after each state change
```

**Pin the target on every command.** The CLI's "active tab" is machine-wide
state; another agent or terminal attaching a different tab moves it under
you, and your captures land in a different session than the one you share.
Set one variable and use it everywhere below:

```bash
T="--tab $TAB_ID"      # local mode
trap 'thinkrun audit off --tab '"$TAB_ID"' >/dev/null 2>&1' EXIT   # audit mode never outlives this run, even on abort
```

**Cloud mode** — no display, no extension, or a public URL. The cloud browser
cannot reach your machine's `localhost`: a localhost target needs local mode,
or a tunnel (ngrok, cloudflared) and the tunnel URL as `$URL`. (Command surface
verified against CLI 0.1.37; the end-to-end cloud path was not smoke-tested
when this skill shipped — a session-provisioning incident on 2026-09-18.)

```bash
SID=$(thinkrun cloud start --json | jq -er .data.sessionId) || { echo "cloud start failed"; exit 1; }   # needs an accepted API key
T="--mode cloud"        # cloud mode: no --tab; commands run against the active cloud session
trap 'thinkrun cloud stop -s "$SID" >/dev/null 2>&1' EXIT   # stops THIS session by id, never whatever is active
# the active cloud session is also machine-wide state (`cloud use`, another `cloud start`).
# There is no per-command session flag, so assert it before every target's captures:
same_session() { [ "$(thinkrun cloud status --json | jq -r .data.sessionId)" = "$SID" ] || { echo "active cloud session changed; stop"; exit 1; }; }
```

If the target is on localhost (local mode only), confirm the port answers
*your* process before capturing anything — another service may be squatting
it. In cloud mode, confirm reachability from the cloud browser instead:
`thinkrun navigate "$URL" $T` and check the returned title.

```bash
PORT=<port>; lsof -iTCP:$PORT -sTCP:LISTEN | head -3; curl -sI http://localhost:$PORT | head -1
```

Set up the evidence folder (gitignored — evidence is posted, never committed):

```bash
TASK=<short-slug>; mkdir -p .artifacts/$TASK
REV="$(git rev-parse --short HEAD) $(git branch --show-current)"
```

---

## Step 1 — Before state (fixes only)

If a target is a bug fix, capture the failure **before** applying the fix. It is
the cheapest moment to prove the bug existed, and the after-shot means nothing
without it.

The before capture must come from the **pre-fix build**: the previous
deployment URL, or the base revision in a **separate worktree**
(`git worktree add /tmp/before origin/main` and run it on another port) — never
by stashing or checking out over the user's working tree. Capturing the
current (fixed) build and calling it "before" is mislabelled evidence. If no
pre-fix build is reachable, write `before: unavailable` in the report — do not
fabricate one.

```bash
BEFORE_URL=<the pre-fix build — e.g. http://localhost:4001 for the base worktree, or the previous deploy>
thinkrun clear-logs $T
thinkrun navigate "$BEFORE_URL" $T; sleep 2
# perform the SAME interaction the target describes (fill, click, …) — a screenshot of
# the untouched page is not evidence of the bug; the failure has to be on screen
thinkrun screenshot --output .artifacts/$TASK/before-01-<target-slug>.png --caption "before: <target>" $T
thinkrun console --json $T | jq '.data.logs' > .artifacts/$TASK/before-01-console.json
thinkrun network --json $T | jq '.data.requests' > .artifacts/$TASK/before-01-network.json
```

---

## Step 2 — One pass per target

For each target, in order:

1. Navigate to the starting state (logged in, right page). Setup is not evidence
   unless setup is the target.
2. **Bound the window:** `thinkrun clear-logs $T` — console and network
   buffers are cumulative; without this, an earlier target's error or request
   gets attributed to this one. In cloud mode run `same_session` first.
3. Perform the interaction: `thinkrun click`, `fill`, `type`, `press`, `select`,
   `scroll` — each with `$T`.
4. **Wait for the state the target names.** A capture taken the instant after a
   click records the page mid-flight: the request has not landed, the message
   has not rendered, and you get a false `fail` — or a false `pass` from the
   previous state. Pick the condition from the target itself:
   ```bash
   thinkrun wait-for-text "This code has expired" $T        # the text the target names
   thinkrun wait "<css-that-appears>" $T                    # or the element
   # or poll until the expected request reaches a terminal status:
   deadline=$((SECONDS+15))
   until thinkrun network --json $T | jq -e '[.data.requests[] | select(.url|test("/api/coupons")) | select(.status != null)] | length > 0' >/dev/null; do
     [ $SECONDS -lt $deadline ] || { echo "request never reached a terminal status"; break; }   # -> not-exercised
     sleep 0.3
   done
   ```
   A bare `sleep` is a last resort; if you use one, say so in the Evidence cell.
5. Capture — this is the evidence, not the audit-mode screenshot:
   ```bash
   N=01; SLUG=<target-slug>
   thinkrun screenshot --output .artifacts/$TASK/$N-$SLUG.png --caption "$N $SLUG" $T
   thinkrun console --json $T | jq '.data.logs' > .artifacts/$TASK/$N-$SLUG-console.json
   thinkrun network --json $T | jq '.data.requests' > .artifacts/$TASK/$N-$SLUG-network.json
   # console entries are {level, message, args, timestamp}; requests are {url, method, status, duration, startTime, endTime}
   jq '[.[] | select(.level=="error") | .message]' .artifacts/$TASK/$N-$SLUG-console.json
   ```
   `--caption` is what syncs a local screenshot into the Activity Feed session
   (as a screenshot action); without it the file is local only.
6. Look at the screenshot with the Read tool. Check the console for errors and
   the network list for failed or slow requests — after step 2, everything in
   the buffers belongs to this target.
7. If `click` returns `"category": "no_op_click"`, the click did not change
   page state. That is evidence. Record it against the target; do not reach
   for `thinkrun evaluate` to call the handler directly and then call the
   button "working".
8. Record the verdict and the reason:
   - `pass` — the statement holds and the capture shows it.
   - `fail` — the statement does not hold. Say what happened instead.
   - `not-exercised` — you could not reach the state (blocked login, missing
     fixture, flaky page). This is not a pass and blocks the same way.

Audit mode (`--audit`) *attempts* an extra screenshot after state-changing
actions so the Activity Feed shows a trail. Treat it as a convenience for the
reviewer's timeline; the named captures above are the record.

### Non-visual targets

Performance, API, and CLI claims get numbers or output pairs, not screenshots
of a terminal.

```bash
# page load (ms) — the navigation entry, not an individual request
thinkrun clear-logs $T; thinkrun navigate "$URL" $T; sleep 2
thinkrun evaluate "Math.round(performance.getEntriesByType('navigation')[0].duration)" $T
# a specific request's duration (ms) — only when the target names that request
thinkrun network --json $T | jq '[.data.requests[] | select(.url|test("/api/dashboard")) | {url, status, ms: .duration}]'
# a value from the page
thinkrun evaluate "document.querySelectorAll('table tbody tr').length" $T
```

State which of these the target means. "Loads in < 300 ms" is the navigation
entry; "the dashboard request returns in < 300 ms" is that request's duration.

Record the measured value and the threshold: `615 ms → 61 ms (target < 300 ms)`.
For a perf fix the before measurement comes from Step 1.

---

## Step 3 — Write the report

`.artifacts/$TASK/report.md`, from `references/report-template.md`. The table
is the product; every Evidence cell is a file path or a share-link step, never
a sentence.

```markdown
| # | Target | Result | Evidence |
|---|--------|--------|----------|
| 1 | coupon field rejects expired codes | pass | 01-coupon-expired.png; console clean; POST /api/coupons 422 |
| 2 | dashboard loads in < 300 ms | fail | 02-dashboard-network.json: 615 ms |
| 3 | export downloads a 3-column CSV | not-exercised | export button disabled on staging (no data fixture) |
```

**Session line.** With an accepted API key, the session is recorded to the
Activity Feed. The page for it is owner-only; a reviewer needs a **share**.

A share of a session recorded on a logged-in tab can expose the user's
authenticated pages, API responses, console output and request details to
anyone with the link. So:

- **Ask before sharing.** Never create a share without the user's explicit
  yes for this run. Default is `session: not shared`.
- **Password-protect it by default** (`password` in the request). Choose the
  password yourself, never echo it, and give it to the user in your reply to
  them — never in the report, the PR, a commit, or shell output. Without that
  handoff the link is unusable, so do it in the same message as the link.
- **Leave console and network out of the share** unless the user asks
  (`includeConsoleLogs` / `includeNetworkRequests` default false here); the
  per-target JSON files already hold that evidence locally.
- Prefer a test account and non-production data for anything that will be
  shared.

With the user's yes:

```bash
CFG=$(thinkrun config show | sed -n 's/^Config file: //p'); CFG=${CFG:-$HOME/.config/thinkrun/config.json}
API=$(jq -r .apiUrl "$CFG"); KEY=$(jq -r .apiKey "$CFG")   # read once, used once, never echoed
# local mode: the Activity Feed session for the tab you pinned (NOT the id from `session debug`)
[ "$T" = "--mode cloud" ] || SID=$(jq -r .sessionId ~/.thinkrun/local-session-$TAB_ID.json)
# cloud mode: SID is the one you captured in Step 0; if lost, `thinkrun cloud status --json | jq -r .data.sessionId`
# never start a new cloud session here — it would be empty
# the key goes to curl via a config on stdin, never as an argument (argv is visible to `ps`)
# The password never appears in command text (shell history, transcripts, `ps`).
# Choose it yourself, write it with your FILE tool (not a shell echo) to a file only
# you can read, and let the shell read the file. Fail closed: no password, no share.
#   <file tool>: write ".artifacts/$TASK/.share-pw" containing the password, then
PWFILE=".artifacts/$TASK/.share-pw"; chmod 600 "$PWFILE"
PW=$(cat "$PWFILE") && rm -f "$PWFILE"; [ -n "$PW" ] || { echo "no password — not sharing"; TOKEN=""; }
# body built by a JSON encoder (never string-interpolated) into a 0600 file; key and
# body both reach curl through the stdin config, so neither is in argv
if [ -n "$PW" ]; then
  BODY=".artifacts/$TASK/.share-body.json"; umask 077
  jq -n --arg sid "$SID" --arg pw "$PW" '{sourceType:"session", sourceId:$sid, password:$pw, includeConsoleLogs:false, includeNetworkRequests:false}' > "$BODY"
  TOKEN=$(printf 'header = "x-api-key: %s"\nheader = "content-type: application/json"\ndata = "@%s"\n' "$KEY" "$BODY" \
    | curl -sf -K - -X POST "$API/api/share" | jq -er '.token // empty') || { echo "share creation failed — report 'session: not shared', do not post a link"; TOKEN=""; }
  rm -f "$BODY"; unset PW
fi
[ -n "$TOKEN" ] && echo "session: https://thinkrun.ai/s/$TOKEN (password-protected)"
```

Before pasting the link, confirm your captures are in it — the share is only
evidence if it contains your steps:

```bash
curl -s "$API/api/share/$TOKEN/meta" | jq '[.data.actions[] | select(.type=="screenshot") | .details.caption]'
# (public endpoint, no key needed) expect your "01 …", "02 …" captions; if missing, you shared the wrong session
```

**Key handling.** `$KEY` is the user's durable API key. It is read once, sent
to `curl` on stdin (never in argv), and used for that one request. Do not
print it, do not put it in the report, the PR, or a log line. If the harness
records shell output, prefer a short-lived key for this step.

Write exactly one of: `session: https://thinkrun.ai/s/<token> (password-protected)`,
`session: not shared`, or `session: none (no API key)`. Never paste
`/sessions/<id>` — it is a login wall. Images are inlined or attached
regardless; the share is supplementary.

In cloud mode, `thinkrun cloud artifacts` lists the session's screenshots with
presigned URLs; there is no equivalent for local sessions, so the named captures
are the record there.

---

## Step 4 — The rule

If any row is `fail` or `not-exercised`, clean up first — `thinkrun audit off $T`
(local) or `thinkrun cloud stop -s "$SID"` (cloud) — so nothing keeps capturing or
billing, then end with:

> **Back to build.** Rows N, M did not pass. Fix, then run `/prove-it` again for
> those targets. Do not open or update the PR with this report as "tested".

That sentence is the last thing you write. Not a summary, not "mostly works",
not the PR. If every row is `pass`, continue.

---

## Step 5 — Post

**Only post evidence a reviewer can open.** `.artifacts/` is gitignored, so a
report whose Evidence cells are local paths proves nothing to anyone but you.
Before commenting, check what the reviewer will be able to see:

- **Share created** (the user said yes) → the captures are in the session
  timeline; post the report with the link.
- **No share** → do **not** post the table to the PR as proof. Give the report
  and the file paths to the user in your reply and say what to attach. If they
  want something on the PR now, post a short comment that names the targets and
  their results and states that the captures are local and pending attachment —
  never a table of paths nobody can open.

```bash
gh pr comment <n> --body-file .artifacts/$TASK/report.md      # only when the evidence is reachable
gh issue comment <n> --body-file .artifacts/$TASK/report.md   # when the destination is an issue
```

`gh` cannot attach images from the CLI. The screenshots reach the reviewer
through the share link (they are in the session timeline). When there is no
API key and therefore no share, say so in the comment and leave the PNGs in
`.artifacts/$TASK/` for the human to drag into the PR. Never upload evidence to
a third-party paste host.

Clean up: `thinkrun audit off $T` (local); the cloud trap stops `$SID` by id.

---

## What this skill does not claim

- Local mode produces **per-step captures**, not a video. Do not call it a
  recording.
- `thinkrun cloud artifacts` exists for cloud sessions only.
- ThinkRun does not judge the claims. The `pass` / `fail` in the table is your
  adjudication, backed by the captures. Say so if asked.
- The `--audit` screenshot is best-effort. If it is missing for a step, the
  named capture you took is still the evidence.
- Cloud mode has no per-command session flag; `same_session` checks the
  active session before each target, and another process can still switch it
  between that check and a capture. Local mode with `--tab` has no such gap.
- The localhost check confirms a listener answers on the port, not that it is
  the exact process for the revision under test; if that matters, expose a
  build id on the app and read it before capturing.
- A share is revocable (`DELETE /api/share/<token>` with the key), not
  secret-for-life; revoke it when the PR merges.

---

## Do NOT use for

- "Walk through the app and tell me what's confusing / broken" → `ux-audit`
- "Go check whether the pricing page loads" (no change under test) → `web-browse`
- "Use the thinkrun CLI to click X" / "use the ThinkRun MCP tools" → `thinkbrowse-cli` / `thinkbrowse-mcp`
- Writing Jest / Playwright / Cypress tests
- Reading the diff and reasoning about whether it should work
