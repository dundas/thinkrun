---
name: thinkbrowse-cli
description: Control browsers via the ThinkBrowse CLI (the thinkbrowse / thinkrun command) — navigate pages, interact with elements, extract content, take screenshots. Use ONLY when the user explicitly names the thinkbrowse or thinkrun CLI, or asks to drive the browser from shell scripts / terminal commands. For general browse, scrape, or automation asks that don't name the CLI, prefer the web-browse skill. Do NOT use for simple URL fetching (use WebFetch tool instead).
category: browse
sync: all
tags: [browsing, automation, scraping, testing, cli]
compatibility: Requires thinkbrowse CLI installed (npm install -g @thinkbrowse/cli). Local mode requires Chrome + ThinkBrowse extension.
metadata:
  author: ThinkBrowse
  version: 1.0.0
---

# ThinkBrowse CLI

Control real browsers from Claude Code using the `thinkbrowse` CLI. Two modes:

- **Local mode** — drives your actual Chrome via the ThinkBrowse extension (free, auth cookies available)
- **Cloud mode** — provisions isolated Playwright browsers on Fly.io (credits, headless, stealth)

## Quick Start

```bash
# Local mode — list tabs, attach, navigate, observe
thinkbrowse tabs
thinkbrowse attach <tabId>
thinkbrowse navigate "https://example.com"
thinkbrowse snapshot              # accessibility tree (best for AI)
thinkbrowse screenshot --output /tmp/page.png

# Cloud mode — create session, navigate, observe, clean up
thinkbrowse cloud start "https://example.com"
thinkbrowse snapshot
thinkbrowse screenshot --output /tmp/page.png
thinkbrowse cloud stop --all
```

## Mode Detection

| Signal | Mode |
|--------|------|
| Bridge running + extension connected | Local |
| `THINKBROWSE_API_KEY` set | Cloud |
| Neither | Error |

Priority: `--tab` flag > `THINKBROWSE_TAB_ID` env > working-location.json > API key (cloud).

## Top 5 Patterns

### 1. Navigate and Observe

```bash
thinkbrowse navigate "https://example.com"
sleep 2                                    # Wait for page load + CSRF tokens
thinkbrowse snapshot                       # Read structure before interacting
thinkbrowse screenshot --output /tmp/page.png
# Then use Read tool on /tmp/page.png to view it
```

### 2. Click by Text Content (RECOMMENDED)

Direct CSS selectors often fail when elements lack unique selectors. Use `evaluate`:

```bash
thinkbrowse evaluate "[...document.querySelectorAll('button,a,[role=button]')].find(el=>el.textContent.trim()==='Sign In')?.click()"
sleep 1
```

### 3. Fill React Forms

```bash
# React inputs need keyboard events — use `type`, NOT `fill`
thinkbrowse click "input[type=email]"
thinkbrowse type "input[type=email]" "user@example.com"
thinkbrowse click "input[type=password]"
thinkbrowse type "input[type=password]" "password123"
thinkbrowse click "button[type=submit]"
sleep 3
```

### 4. List All Interactive Elements

```bash
thinkbrowse evaluate "[...document.querySelectorAll('button,[role=tab],[role=button]')].map(b=>({label:b.getAttribute('aria-label'),text:b.textContent.trim(),class:b.className.slice(0,50)})).filter(b=>b.text||b.label)"
```

### 5. Wait Then Act

```bash
thinkbrowse navigate "https://app.example.com"
thinkbrowse wait "button[type=submit]" --timeout 10000
thinkbrowse click "button[type=submit]"
```

For all 10+ patterns, see `references/patterns.md`.

## Top 5 Anti-Patterns

### 1. Using text as a CSS selector

```bash
# BAD — "Timeline & Logs" is not a CSS selector
thinkbrowse click "Timeline & Logs"     # ELEMENT_NOT_FOUND

# GOOD — find by text via evaluate
thinkbrowse evaluate "[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Timeline'))?.click()"
```

### 2. Using `fill` on React inputs

```bash
# BAD — fill uses native DOM, React won't detect the change
thinkbrowse fill "#search" "query text"

# GOOD — type uses keyboard events, triggers React onChange
thinkbrowse type "#search" "query text"
```

### 3. Screenshotting immediately after attach

```bash
# BAD — screenshot fails with "fetch failed"
thinkbrowse attach <tabId>
thinkbrowse screenshot --output /tmp/page.png   # ERROR

# GOOD — wait for connection
thinkbrowse attach <tabId>
sleep 2
thinkbrowse screenshot --output /tmp/page.png
```

### 4. Clicking a link without waiting for navigation

```bash
# BAD — extract runs before new page loads
thinkbrowse click "a[href='/next-page']"
thinkbrowse extract ".content"           # OLD page content!

# GOOD — wait for new page element
thinkbrowse click "a[href='/next-page']"
thinkbrowse wait "h1" --timeout 5000
thinkbrowse extract ".content"
```

### 5. Not cleaning up sessions

```bash
# ALWAYS release/stop when done
thinkbrowse release                # local mode
thinkbrowse cloud stop --all       # cloud mode
```

## Output Format

All commands return JSON:

```json
{"success": true, "command": "navigate", "durationMs": 1234, "data": {...}}
{"success": false, "error": "...", "code": "ELEMENT_NOT_FOUND", "hint": "...", "retryable": true}
```

**Key gotchas:**
- `thinkbrowse url` returns `{"data": "https://..."}` — plain string, NOT nested object
- `thinkbrowse screenshot --output /tmp/x.png` returns `{"data": {"path": "/tmp/x.png"}}` — use **Read tool** on that path to view it
- `evaluate` auto-wraps single expressions; multi-statement needs IIFE: `(()=>{const x=5; return x*2})()`
- `evaluate` does NOT await Promises — async operations return `{}`
- Scroll has no effect on fixed-layout pages — screenshot after to verify
- Protected iframes (Stripe, OAuth) return `{"blocked": true, "handoffRequired": true}` — stop automation

## Timing Guidelines

| Action | Wait After |
|--------|-----------|
| `navigate` | `sleep 2` (page load + CSRF) |
| `click` | `sleep 1` (state change) |
| `type` / `fill` | No wait needed |
| `attach` (new tab) | `sleep 2` (connection) |
| `evaluate` (click) | `sleep 1` |
| `scroll` | `sleep 1` (rendering) |

## Multi-Agent Coordination

Use `--tab <tabId>` on every command to prevent tab contention:

```bash
thinkbrowse navigate "https://site-a.com" --tab 12345
thinkbrowse navigate "https://site-b.com" --tab 67890
```

Or: `export THINKBROWSE_TAB_ID=12345`

## Setup & Diagnostics

```bash
thinkbrowse doctor                        # Check bridge, extension, config
thinkbrowse config show                   # Show current config
thinkbrowse config set apiKey <key>       # Set API key for cloud mode
thinkbrowse agent-init [--name <name>]    # Set agent identity
```

## References

- For complete command reference, see `references/command-reference.md`
- For all 10+ patterns and additional gotchas, see `references/patterns.md`
- For error codes and recovery playbooks, see `references/error-recovery.md`
