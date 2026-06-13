---
name: web-browse
description: Browse the web programmatically with ThinkRun — drive a real or cloud browser to navigate, interact, extract, and screenshot, from the CLI or any MCP client
category: browse
sync: all
tags: [browsing, automation, scraping, testing]
---

# Web Browse

Drive a browser programmatically with **ThinkRun**. Two interfaces, same capabilities:

- **`thinkrun` CLI** — for shell scripts and terminal use. `npm install -g @thinkrun/cli` (bin: `thinkrun`).
- **`@thinkrun/mcp`** — for MCP clients (Claude Code, Cursor, Cline, Windsurf). `npx @thinkrun/mcp`.

Both support two execution modes:

- **Local mode** — controls your real Chrome via the ThinkRun extension + native host. Best for sites needing your login/cookies, or visual work on the browser you already have open.
- **Cloud mode** — provisions an isolated Playwright browser on Fly.io. Best for headless/autonomous scraping, multi-agent work, and anti-detection (stealth).

Mode is auto-detected; override per-command with `--mode local|cloud` (CLI) or the `set_mode` tool (MCP).

## When to use which

| Scenario | Mode | Why |
|----------|------|-----|
| Site needs your login cookies | **Local** | Uses your real Chrome session |
| Visual/interactive work on an open tab | **Local** | Attach to the tab you're looking at |
| Headless autonomous scraping | **Cloud** | No Chrome needed, runs detached |
| Multi-agent / parallel sessions | **Cloud** | Isolated browser per session |
| Anti-detection needed | **Cloud** | Built-in stealth (no `navigator.webdriver`) |

> See [references/details.md](references/details.md) for the full CLI command + MCP tool reference, common patterns, and error codes.

## Setup

### Install

```bash
# CLI (shell use)
npm install -g @thinkrun/cli        # provides the `thinkrun` command

# MCP (Claude Code / Cursor / Cline / Windsurf)
npx @thinkrun/mcp                    # or add to your MCP config (see below)
```

MCP config:

```json
{ "mcpServers": { "thinkrun": { "command": "npx", "args": ["@thinkrun/mcp"] } } }
```

### Cloud mode

Set an API key (get one at thinkrun.ai):

```bash
thinkrun config set-key <api-key>     # or: export THINKRUN_API_KEY=<api-key>
```

The CLI talks to the ThinkRun API (default host `https://api.thinkbrowse.io`). `THINKBROWSE_API_KEY` is still honored as a legacy fallback.

### Local mode

```bash
thinkrun setup        # installs the native host binary and configures the API key
thinkrun doctor       # verify: endpoint, auth, extension connectivity, native host
```

Local mode also requires the ThinkRun extension installed in Chrome (Web Store, or load-unpacked from `extension/` for dev). `thinkrun doctor` reports whether the extension is connected.

## Quick start (CLI)

```bash
# Cloud: start an isolated browser (becomes the active session)
thinkrun cloud start

# Navigate + observe
thinkrun navigate "https://example.com"
thinkrun snapshot                       # accessibility tree — best for LLMs
thinkrun extract "body" --format text   # text content (extract takes a SELECTOR)
thinkrun screenshot --output /tmp/page.png

# Interact
thinkrun click "button.submit"
thinkrun fill "#email" "user@example.com"
thinkrun type "#search" "query"
thinkrun press Enter
thinkrun scroll --down 600

# Page info + logs
thinkrun url
thinkrun console
thinkrun network

# Cloud cleanup (local mode has no session to stop)
thinkrun cloud stop
```

Local mode is the same commands, against your real Chrome — attach to a tab first:

```bash
thinkrun tabs                 # list open Chromium tabs
thinkrun attach <tabId>       # route subsequent commands to that tab
thinkrun navigate "https://app.example.com"
```

## Quick start (MCP)

Tool names are unprefixed and underscore-style (e.g. `navigate`, `click`, `type_text`, `snapshot`, `screenshot`, `extract`, `get_url`). Cloud sessions use `session_create` / `session_use` / `session_delete`; local tabs use `tab_list` / `tab_attach`. Set mode with `set_mode`. Full list in [references/details.md](references/details.md).

## Stateless one-shots (no session)

For a single fetch with no interaction, skip session setup entirely:

```bash
thinkrun cache html  "https://example.com"
thinkrun cache text  "https://example.com"
thinkrun cache screenshot "https://example.com" --output /tmp/x.png
```

## Always clean up

In cloud mode, `thinkrun cloud stop` when done (sessions auto-expire after 30 min). In local mode, `thinkrun release` frees the working-location lock for the current process/group.
