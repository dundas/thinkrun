---
name: ux-audit
description: "Walk through a product as a user and audit the UI/UX for quality, flow, and experience. Use when: review UI or UX, test a user flow or onboarding, audit the design, check how a feature looks and behaves, walk through a journey, verify the user experience"
category: ux
sync: all
---

# UX Audit Skill

You are a world-class UX designer and QA engineer. Your job is to walk through a
user journey on any portfolio product using a browser session, take screenshots
at every meaningful step, produce a structured UX report, and send findings to the
Portfolio GM (`decisive.gm`) via brain messaging.

---

## Mode Selection

**Local mode** — use when the product requires auth/cookies (portfolio apps):
- Controls your actual Chrome via the ThinkRun extension + bridge
- All commands operate on the tab you attach to
- Best for: decisive-chat, derivative-admin, signal, teleportation, etc.

**Cloud mode** — use for public-facing URLs, headless scraping, no auth needed:
- Provisions an isolated Playwright browser on Fly.io
- Driven with `thinkrun cloud start` + `--mode cloud` (see the web-browse skill)
- Best for: marketing pages, public APIs, pre-auth flows

---

## Step 0 — Configure the Audit

```bash
PRODUCT="Decisive"
PRODUCT_URL="http://localhost:3000"   # or https://decisive-chat.pages.dev
AUDIT_DATE=$(date +%Y-%m-%d)
JOURNEY="User login through Round Tables view"
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
PRODUCT_CLI="thinkrun"   # or "decisive", etc. — leave empty to skip

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

---

## Step 7 — Send Findings to decisive.gm

```bash
bun .claude/skills/cross-brain-message/brain-msg.ts send \
  --to decisive.gm \
  --type notification \
  --subject "UX Audit: $PRODUCT — $AUDIT_DATE" \
  --body "$(python3 -c "
import json
print(json.dumps({
  'product': '$PRODUCT',
  'url': '$PRODUCT_URL',
  'date': '$AUDIT_DATE',
  'journey': '$JOURNEY',
  'summary': {
    'critical_issues': 0,
    'moderate_issues': 0,
    'passes': 0,
    'overall': 'good'
  },
  'critical_issues': [],
  'top_3_fixes': [],
  'full_report': 'See memory/daily/$AUDIT_DATE.md'
}))
")"
```

For critical/strategic issues, escalate via work order:

```bash
bun .claude/skills/cross-brain-message/brain-msg.ts work-order \
  --to decisive.gm \
  --subject "CRITICAL UX issues in $PRODUCT — action needed" \
  --body '{"message":"Critical UX issues found","action":"read memory/UX_AUDIT_PLAN.md","file":"memory/UX_AUDIT_PLAN.md","priority":"critical"}'
```

---

## Step 8 — Save to Daily Log

```bash
cat >> memory/daily/$AUDIT_DATE.md << 'EOF'

## UX Audit — <PRODUCT>
- Journey: <JOURNEY>
- Critical issues: N
- Moderate issues: N
- Top fix: <FIX_1>
- Sent to decisive.gm: yes
- Screenshots: /tmp/ux_*.png
EOF
```

---

## Known Gotchas

- **`fill` doesn't trigger React `onChange`** — use `type` instead for React-controlled inputs; `fill` works for plain HTML inputs
- **Screenshot returns a local file path** — `{"data": {"path": "/tmp/thinkrun-xxx.png"}}`. Use the Read tool on that path to view it. There is no `--label` flag.
- **`thinkrun url` returns a plain string** — `{"data": "http://..."}` not `{"data": {"url": "..."}}`. Parse as `d['data']`.
- **Scroll syntax** — `thinkrun scroll --down 500` (not `scroll down 500`)
- **Never use a generic `button` selector when multiple buttons exist** — use `button[type=submit]` or `click_text` helper
- **`evaluate` can timeout** — keep scripts short. Avoid `document.body.innerText` on large SPAs; use targeted selectors instead
- **CSRF-protected forms** — auth forms need CSRF token. The React auth-client handles this automatically, but the CSRF fetch must complete before submit. Use `sleep 2` after navigation before filling.
- **Tab becoming unresponsive** — if commands timeout, use `thinkrun tabs` to find a responsive tab, then `thinkrun attach <newTabId>` to switch
- **`switch-tab` ≠ `attach`** — `switch-tab` changes Chrome's active tab for visual focus; `attach` changes which tab receives CLI commands. You need both when switching tabs.
- **Cloud mode screenshot** — `thinkrun screenshot --output /tmp/sc.png --mode cloud` saves the file directly; read the path with the Read tool
