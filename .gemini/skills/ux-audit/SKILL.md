---
name: ux-audit
description: "Walk through a product UI as a real user — take screenshots, find broken flows, and produce a structured report with every fix listed. Use when: audit the UI or UX, do a UX review, QA a feature, check if something looks right, verify a user flow or onboarding, walk through a journey, 'is X broken?', 'check how X works', 'verify the feature we shipped'. Do NOT use for: fixing a specific known bug, reading a component's code, deploying, writing tests, or answering questions about code structure."
category: ux
sync: all
---

# UX Audit Skill

You are a world-class UX designer and QA engineer. Your job is to walk through a
user journey on a product using a browser session, take screenshots at every
meaningful step, and produce a structured UX report with a complete fix list.

---

## Mode Selection

**Local mode** — use when the product requires auth/cookies (your real logged-in session):
- Controls your actual Chrome via the ThinkRun extension + native host
- All commands operate on the tab you attach to
- Best for: apps behind login, staging environments with your cookies

**Cloud mode** — use for public-facing URLs, headless scraping, no auth needed:
- Provisions an isolated cloud browser
- Driven with `thinkrun cloud start` + `--mode cloud` (see the web-browse skill)
- Best for: marketing pages, public flows, pre-auth journeys

---

## Step 0 — Configure the Audit

```bash
PRODUCT="<product name>"
PRODUCT_URL="<http://localhost:PORT or https://your-app.example.com>"
AUDIT_DATE=$(date +%Y-%m-%d)
JOURNEY="<one-line description of the journey to test>"
```

If testing against localhost, check what's actually on the port before assuming
the right app is there — other services may be squatting the default port:

```bash
lsof -iTCP:$PORT -sTCP:LISTEN 2>/dev/null | head -3
```

---

## Step 1 — Start Session

### Local Mode (auth required)

```bash
# List available Chrome tabs
thinkrun tabs

# Attach to an existing tab (use a clean one — New Tab, or any non-critical tab)
# TAB_ID comes from the tabs output above
TAB_ID=656847550
thinkrun attach $TAB_ID

# Navigate to the product
thinkrun navigate "$PRODUCT_URL"
sleep 2
```

The attached tab is now the active session. All subsequent commands route to it automatically — no session ID needed.

### Cloud Mode (no auth required)

```bash
# Start an isolated cloud browser; it becomes the active session.
thinkrun cloud start
# Subsequent commands run against it. Force cloud per-command with --mode cloud.
thinkrun navigate "$PRODUCT_URL" --mode cloud
# When done: thinkrun cloud stop
```

---

## Step 2 — Helper Functions (Local Mode)

```bash
# Navigate and wait for page load
nav() {
  thinkrun navigate "$1"
  sleep 2
}

# Screenshot — saves to /tmp, read the path with the Read tool
shot() {
  local label="$1"
  local result=$(thinkrun screenshot --output "/tmp/ux_${label}.png")
  echo "Screenshot: /tmp/ux_${label}.png"
  # Then use Read tool on that path to observe the image
}

# Click by CSS selector
click_sel() {
  thinkrun click "$1"
  sleep 1
}

# Click by visible button/link text (safe evaluate — avoids ambiguous selectors)
click_text() {
  thinkrun evaluate "[...document.querySelectorAll('button,a,[role=button]')].find(el=>el.textContent.trim()==='$1')?.click()"
  sleep 1
}

# Type into a React-controlled input (triggers onChange via keyboard events)
# Use `type` for React apps, `fill` for plain HTML inputs
type_react() {
  local selector="$1"
  local value="$2"
  thinkrun click "$selector"
  thinkrun type "$selector" "$value"
}

# Get current URL
current_url() {
  thinkrun url
  # Returns: {"data": "http://..."} — data is a plain string
}

# Scroll the page
scroll_down() {
  thinkrun scroll --down "${1:-500}"
}

scroll_up() {
  thinkrun scroll --up "${1:-500}"
}

# Extract visible text
read_text() {
  thinkrun evaluate "([...document.querySelectorAll('h1,h2,h3,p,label,span')].map(e=>e.textContent.trim()).filter(t=>t.length>4).join('\n')).slice(0,2000)"
}
```

---

## Step 3 — Walk the Journey

For each step:
1. Perform the action (navigate, click, type, scroll)
2. Wait for state to settle (`sleep 1` or `sleep 2`)
3. Take a screenshot: `thinkrun screenshot --output "/tmp/ux_NN_label.png"`
4. Read the screenshot file with the **Read tool** to observe it
5. Note: **what you see** vs **what you expected**

### Standard Journey Template

```bash
# 1. Landing / Homepage
thinkrun navigate "$PRODUCT_URL"
sleep 2
thinkrun screenshot --output "/tmp/ux_01_homepage.png"
# → Read tool: /tmp/ux_01_homepage.png
# Observe: CTA clarity, value proposition, onboarding path

# 2. Auth / Login (if required)
thinkrun navigate "${PRODUCT_URL}/login"
sleep 1
thinkrun screenshot --output "/tmp/ux_02_login.png"
# → Read tool: /tmp/ux_02_login.png

# Fill login form (use type for React-controlled inputs, fill for plain HTML)
thinkrun click "input[type=email]"
thinkrun type "input[type=email]" "test@example.com"
thinkrun click "input[type=password]"
thinkrun type "input[type=password]" "testpassword"
thinkrun click "button[type=submit]"
sleep 3
thinkrun screenshot --output "/tmp/ux_03_post_login.png"
# → Read tool: /tmp/ux_03_post_login.png
# Check: Did login succeed? What URL are we on?
thinkrun url

# 3. Core Action
thinkrun screenshot --output "/tmp/ux_04_core_action_start.png"
# ... perform the action ...
sleep 2
thinkrun screenshot --output "/tmp/ux_05_core_action_result.png"

# 4. Scroll to see full content
thinkrun scroll --down 600
thinkrun screenshot --output "/tmp/ux_06_scrolled.png"

# 5. Error Path (submit empty form, invalid input, etc.)
# navigate back, try invalid actions...
thinkrun screenshot --output "/tmp/ux_07_error_state.png"

# 6. Accessibility snapshot (reveals element structure, roles, text)
thinkrun snapshot
```

---

## Step 4 — Observation Framework

At each screenshot, read the image and score against these dimensions:

| Dimension | Questions to Ask |
|-----------|-----------------|
| **Clarity** | Is it immediately obvious what to do next? |
| **Feedback** | Does the UI communicate what's happening? |
| **Progress** | Can the user tell how far along they are? |
| **Output** | Is the result visible and readable? |
| **Error visibility** | Are failures explained clearly, with a recovery path? |
| **Navigation** | Easy to go back, forward, or to related sections? |
| **Performance feel** | Does it feel fast or sluggish? Is there a loading indicator? |
| **Empty states** | What does a new user see before any data exists? |
| **Mobile** | Does the layout hold at 375px? |

Rate each: ✅ Good / 🟡 Needs work / 🔴 Broken

---

## Step 5 — CLI DX Checklist (if product has a CLI)

```bash
PRODUCT_CLI="<cli-binary>"   # leave empty to skip

if [ -n "$PRODUCT_CLI" ]; then
  $PRODUCT_CLI --help
  $PRODUCT_CLI --version
fi
```

---

## Step 6 — Report Format

```
## UX Audit: <PRODUCT> — <YYYY-MM-DD>

### Journey Tested
<one-line description>

### Journey Map
| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| 1. Homepage | Clear CTA | ... | ✅/🟡/🔴 |

### Critical Issues 🔴
- **Issue title**: Description. Screenshot: `ux_07_error_state.png`. Impact: ...

### Moderate Issues 🟡
- **Issue title**: Description. Screenshot: `ux_03_post_login.png`. Impact: ...

### What Works Well ✅
- Feature and why it works well.

### Scores by Dimension
| Dimension | Score | Notes |
|-----------|-------|-------|
| Clarity | ✅ | ... |
| Feedback | 🔴 | ... |

### Top 3 Fixes (Priority Order)
1. **Fix title** — rationale and expected impact
2. **Fix title** — rationale and expected impact
3. **Fix title** — rationale and expected impact
```

Deliver the report wherever your team tracks findings — a Markdown file in the
repo, an issue per critical finding, or your task tracker. Keep the screenshot
files referenced by the report so findings stay verifiable.

---

## Known Gotchas

- **`fill` doesn't trigger React `onChange`** — use `type` instead for React-controlled inputs; `fill` works for plain HTML inputs
- **Screenshot returns a local file path** — `{"data": {"path": "/tmp/thinkrun-xxx.png"}}`. Use the Read tool on that path to view it. There is no `--label` flag.
- **`thinkrun url` returns a plain string** — `{"data": "http://..."}` not `{"data": {"url": "..."}}`. Parse as `d['data']`.
- **Scroll syntax** — `thinkrun scroll --down 500` (not `scroll down 500`)
- **Never use a generic `button` selector when multiple buttons exist** — use `button[type=submit]` or `click_text` helper
- **`evaluate` can timeout** — keep scripts short. Avoid `document.body.innerText` on large SPAs; use targeted selectors instead
- **CSRF-protected forms** — auth forms need CSRF token. If the app fetches one after load, the fetch must complete before submit. Use `sleep 2` after navigation before filling.
- **Tab becoming unresponsive** — if commands timeout, use `thinkrun tabs` to find a responsive tab, then `thinkrun attach <newTabId>` to switch
- **`switch-tab` ≠ `attach`** — `switch-tab` changes Chrome's active tab for visual focus; `attach` changes which tab receives CLI commands. You need both when switching tabs.
- **Cloud mode screenshot** — `thinkrun screenshot --output /tmp/sc.png --mode cloud` saves the file directly; read the path with the Read tool
