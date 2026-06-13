# Web Browse — Full Reference

Two interfaces over the same engine: the **`thinkrun` CLI** and the **`@thinkrun/mcp`** server. Both drive **local** (your real Chrome) or **cloud** (isolated Playwright on Fly.io) browsers. Mode is auto-detected; override per call with `--mode local|cloud` (CLI) or `set_mode` (MCP).

There is **no positional session id**. In cloud mode you start/switch sessions with `thinkrun cloud start` / `cloud use <id>`; in local mode you attach to a tab with `thinkrun attach <tabId>`. Subsequent commands act on the active session/tab. Target a specific tab with `-t/--tab <tabId>`.

## CLI command reference (`thinkrun`)

### Setup & diagnostics
| Command | Description |
|---------|-------------|
| `thinkrun setup` | Install native host + configure API key |
| `thinkrun install` | Download/verify/register the native host binary |
| `thinkrun config set-key <key>` · `config show` | Manage API key / config |
| `thinkrun doctor` | Diagnose endpoint, auth, extension connectivity, session |
| `thinkrun session` | Session and mode diagnostics |
| `thinkrun reset-connection` | Re-arm the extension circuit breaker |
| `thinkrun agent-init` | Persist a stable agent identity for the cloud activity feed |

### Cloud sessions
| Command | Description |
|---------|-------------|
| `thinkrun cloud start` | Start a new cloud session (becomes active) |
| `thinkrun cloud use <sessionId>` | Switch the active session |
| `thinkrun cloud status` · `cloud list` | Inspect sessions |
| `thinkrun cloud artifacts` | List screenshots/recordings for a session |
| `thinkrun cloud stop` | Stop the active session (`--all` for all) |

### Stateless one-shots (no session)
| Command | Description |
|---------|-------------|
| `thinkrun cache html <url>` | Rendered HTML for a URL |
| `thinkrun cache text <url>` | Plain text for a URL |
| `thinkrun cache screenshot <url> [--output <path>]` | Screenshot a URL |

### Navigation
| Command | Description |
|---------|-------------|
| `thinkrun navigate <url>` | Navigate to a URL |
| `thinkrun back` · `forward` | History back/forward |
| `thinkrun scroll --down <px>` / `--up <px>` / `--to <selector>` | Scroll (or `--direction up\|down --amount <px>`) |

### Observation
| Command | Description |
|---------|-------------|
| `thinkrun snapshot` | Accessibility tree (recommended for LLMs) |
| `thinkrun screenshot [--output <path>] [--full-page]` | Capture screenshot |
| `thinkrun extract <selector> [--all] [--attr <name>] [--format text\|json\|html]` | Extract from element(s). **Requires a selector** (e.g. `body` for full-page text) |
| `thinkrun evaluate [script] [--file <path>] [--stdin]` | Run JS in page context |
| `thinkrun url` · `title` · `html` | Current page URL / title / full HTML |
| `thinkrun console` · `network` · `clear-logs` | Console messages / network requests / clear |

### Interaction
| Command | Description |
|---------|-------------|
| `thinkrun click <selector>` | Click element |
| `thinkrun fill <selector> <value>` | Clear field, then set value (plain HTML inputs) |
| `thinkrun type <selector> <text>` | Type text (use for React-controlled inputs) |
| `thinkrun press <key>` | Press key (Enter, Tab, Escape, ArrowDown, …) |
| `thinkrun hover <selector>` · `select <selector> <value>` | Hover / choose dropdown option |
| `thinkrun wait <selector> [--visible\|--hidden] [--timeout <ms>]` | Wait for element (default 30000ms) |
| `thinkrun wait-for-text <text> [--timeout <ms>]` | Wait for text to appear |
| `thinkrun dialog get \| accept [text] \| dismiss` | Handle alert/confirm/prompt |

### Local mode (your real Chrome)
| Command | Description |
|---------|-------------|
| `thinkrun tabs` | List open Chromium tabs |
| `thinkrun attach <tabId>` | Route subsequent commands to that tab |
| `thinkrun switch-tab <tabId>` | Change Chrome's visually-focused tab |
| `thinkrun new-tab [url]` · `new-window [url]` | Open tab / isolated window |
| `thinkrun close-tab [tabId]` · `focus` · `release` | Close / foreground / release the working-location lock |
| `thinkrun resume` | Re-read page state after a human handoff |

### AI task (local mode)
| Command | Description |
|---------|-------------|
| `thinkrun task <instruction>` | Run an AI task in the active tab |
| `thinkrun task-status <taskId>` · `task-cancel <taskId>` | Poll / cancel a task |

**Global flags:** `--json` (default for non-TTY), `--quiet`, `--verbose`. **Per-command:** `--mode local\|cloud`, `-t/--tab <tabId>`.

## MCP tool reference (`@thinkrun/mcp`)

Tool names are underscore-style and differ from CLI verbs:

- **Sessions:** `session_create`, `session_status`, `session_list`, `session_use`, `session_wait_ready`, `session_artifacts`, `session_delete`, `session_release`, `set_mode`
- **Stateless:** `page_cache_html`, `page_cache_text`, `page_cache_screenshot`
- **Navigate:** `navigate`, `go_back`, `go_forward`, `scroll`, `sleep`
- **Observe:** `snapshot`, `screenshot`, `extract`, `evaluate`, `get_url`, `get_title`, `get_html`, `console_messages`, `network_requests`, `clear_logs`
- **Interact:** `click`, `type_text`, `fill`, `press_key`, `hover`, `select_option`, `wait_for_element`, `wait_for_text`, `get_dialog`, `handle_dialog`
- **Local:** `tab_list`, `tab_new`, `tab_close`, `tab_attach`, `tab_switch`, `focus`, `window_new`, `local_diagnostics`, `local_reset_connection`, `local_action_run`, `local_action_status`, `local_action_cancel`
- **AI task:** `task_create`, `task_execute`, `task_status`

## Common patterns (CLI)

### Research / scrape
```bash
thinkrun cloud start
thinkrun navigate "https://news.ycombinator.com"
thinkrun extract "body" --format text > /tmp/hn.txt
thinkrun cloud stop
```

### Form login
```bash
thinkrun cloud start
thinkrun navigate "https://app.example.com/login"
thinkrun fill "#email" "user@example.com"
thinkrun fill "#password" "secret"
thinkrun click "button[type=submit]"
thinkrun wait ".dashboard" --timeout 10000
thinkrun screenshot --output /tmp/logged-in.png
thinkrun cloud stop
```

### Wait for dynamic content
```bash
thinkrun navigate "https://example.com/search?q=widgets"
thinkrun wait-for-text "results found" --timeout 15000
thinkrun extract ".results" --all --format text
```

### Dialog handling
```bash
thinkrun click "#delete-account"
thinkrun dialog get        # check for a pending dialog
thinkrun dialog accept     # or: thinkrun dialog dismiss
```

### Local mode (your logged-in Chrome)
```bash
thinkrun tabs
thinkrun attach <tabId>
thinkrun navigate "https://app.example.com"
thinkrun screenshot --output /tmp/state.png
```

## Output & errors

Commands emit a JSON envelope on stdout (`--json`, the default when piped); failures go to stderr with a non-zero exit. Inspect the `error`/`code`/`hint` fields and retry transient failures (timeouts, provisioning) with backoff. Fatal conditions — invalid API key, extension not connected, a closed cloud session, or a lost/owned-elsewhere local tab — require fixing setup or starting a fresh session/attach rather than retrying. Run `thinkrun doctor` to diagnose local/auth issues.

## Notes

- **React inputs:** prefer `type` over `fill` for React-controlled fields; `fill` sets the value natively and may not fire `onChange`.
- **Cloud provisioning:** a cold cloud session takes ~60–90s; sessions auto-expire after 30 min.
- **Stealth:** cloud browsers run with anti-detection (no `navigator.webdriver`).
