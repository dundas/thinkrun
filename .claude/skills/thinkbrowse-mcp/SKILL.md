---
name: thinkbrowse-mcp
description: Control browsers via ThinkBrowse MCP tools — navigate pages, interact with elements, extract content, take screenshots. Use ONLY when the user explicitly references the thinkbrowse/thinkrun MCP server or its MCP tools. For general browse, scrape, or automation asks that don't name MCP, prefer the web-browse skill. Do NOT use for simple URL fetching (use WebFetch tool instead).
category: browse
sync: all
tags: [browsing, automation, mcp, testing]
compatibility: Requires @thinkbrowse/mcp npm package installed and configured as MCP server. Cloud mode requires THINKBROWSE_API_KEY.
metadata:
  author: ThinkBrowse
  version: 1.0.0
  mcp-server: thinkbrowse
---

# ThinkBrowse MCP

Control browsers using ThinkBrowse MCP tools (`mcp__thinkbrowse__*`). 35 tools. Three modes: `auto` (default), `local`, `cloud`.

Every tool call MUST include a `thought` parameter explaining your reasoning.

## Quick Start

```
1. session_create          → get a session
2. session_wait_ready      → wait for provisioning (cloud)
3. navigate                → go to URL
4. snapshot                → read page structure (best for AI)
5. screenshot              → visual capture
6. click / type_text       → interact
7. session_delete          → clean up
```

## Top 5 Patterns

### 1. Navigate → Snapshot → Act

```
snapshot  {thought: "Read page structure before interacting"}
click  {selector: "button[type=submit]", thought: "Click submit — confirmed via snapshot"}
```

Always `snapshot` before clicking to find the right selector.

### 2. Click by Text (When Selectors Are Ambiguous)

```
evaluate  {
  script: "[...document.querySelectorAll('button,a,[role=button]')].find(el=>el.textContent.trim()==='Sign In')?.click()",
  thought: "Multiple buttons — clicking by visible text"
}
```

### 3. React Forms (type_text, NOT fill)

```
click  {selector: "input[name=email]", thought: "Focus email field"}
type_text  {selector: "input[name=email]", text: "user@example.com", thought: "React input — using type_text"}
click  {selector: "button[type=submit]", thought: "Submit form"}
```

`fill` uses native DOM value setting — React won't detect the change. `type_text` uses keyboard events.

### 4. List Interactive Elements

```
evaluate  {
  script: "[...document.querySelectorAll('button,[role=tab],a')].map(b=>({label:b.getAttribute('aria-label'),text:b.textContent.trim().slice(0,50),tag:b.tagName})).filter(b=>b.text||b.label)",
  thought: "Find all clickable elements"
}
```

### 5. Cloud Session Lifecycle

```
session_create  {thought: "Create cloud session"}
session_wait_ready  {sessionId: "...", thought: "Wait for provisioning (60-90s)"}
navigate  {url: "https://example.com", thought: "Go to target"}
...
session_delete  {sessionId: "...", thought: "Clean up"}
```

Always `session_wait_ready` after `session_create` in cloud mode. Always `session_delete` when done.

For all 10+ patterns, see `references/patterns.md`.

## Top 5 Anti-Patterns

### 1. Clicking without observing first
```
# BAD — may click wrong element or get ELEMENT_NOT_FOUND
click  {selector: "button", thought: "Click the button"}

# GOOD — observe first
snapshot  {thought: "Find correct selector"}
click  {selector: "button[aria-label='Submit']", thought: "Click submit confirmed via snapshot"}
```

### 2. Using `fill` for React inputs
```
# BAD — React won't detect value change
fill  {selector: "#search", value: "query"}

# GOOD — keyboard events trigger React onChange
type_text  {selector: "#search", text: "query", thought: "React input"}
```

### 3. Skipping session_wait_ready in cloud mode
```
# BAD — session still provisioning, actions fail
session_create → navigate  # ERROR

# GOOD
session_create → session_wait_ready → navigate
```

### 4. Expecting evaluate to return async values
```
# BAD — returns null/empty
evaluate  {script: "fetch('/api/data').then(r => r.json())"}

# GOOD — use network_requests instead
network_requests  {thought: "Check API calls the page made"}
```

### 5. Missing `thought` parameter
```
# BAD — no audit trail
click  {selector: "#delete"}

# GOOD
click  {selector: "#delete", thought: "Delete draft post as requested"}
```

## Essential Gotchas

| Gotcha | Details |
|--------|---------|
| `fill` vs `type_text` | `fill` = native DOM (plain HTML). `type_text` = keyboard events (React). |
| `evaluate` async | Returns empty for Promises. Use `network_requests` for API data. |
| Cloud provisioning | 60-90s. Always `session_wait_ready` after `session_create`. |
| Click by text | CSS selectors only. Use `evaluate` with `querySelectorAll().find()` for text. |
| Click ≠ navigation | Click returns immediately. `wait_for_element` after clicking links. |
| `no_op_click` | Element exists but click has no effect. Use `evaluate` to click programmatically. |
| Protected flows | Stripe/OAuth return `blocked: true, handoffRequired: true`. Stop automation. |

## Observation Strategy

**Always prefer `snapshot` over `screenshot` for decision-making:**

| Method | Best For | Size | Speed |
|--------|----------|------|-------|
| `snapshot` | Finding selectors, understanding structure | ~2KB text | Fast |
| `screenshot` | Visual verification, showing user | ~100KB+ | Slower |
| `extract` | Getting specific text/attributes | Varies | Fast |
| `evaluate` | Custom DOM queries, clicking by text | Varies | Fast |

**Recommended flow:** snapshot → evaluate → screenshot

## Mode Comparison

| Feature | Local | Cloud |
|---------|-------|-------|
| Auth cookies | Yes | No |
| Provisioning | Instant | 60-90s |
| Cost | Free | Credits |
| Tab management | Yes | No |
| Stealth mode | No | Yes |
| Session lifetime | Until release | 30min auto-timeout |

**Local**: auth-required sites, WebSockets, interactive dev, free.
**Cloud**: headless scraping, anti-detection, multi-agent, no Chrome needed.

## Config

Install: `npx @thinkbrowse/mcp` or `npm install -g @thinkbrowse/mcp`
Environment: `THINKBROWSE_API_KEY` for cloud mode.
Config: `~/.config/thinkbrowse/config.json` — `{"apiKey": "...", "apiUrl": "https://api.thinkbrowse.io"}`

## References

- For complete tool reference (all 35 tools), see `references/tool-reference.md`
- For all 10+ patterns and additional gotchas, see `references/patterns.md`
- For error codes and recovery playbooks, see `references/error-recovery.md`
