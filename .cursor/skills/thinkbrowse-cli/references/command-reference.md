# ThinkBrowse CLI — Complete Command Reference

## Session Management

```bash
thinkbrowse tabs                          # List Chrome tabs (local only)
thinkbrowse attach <tabId> [--audit]      # Attach to a tab — all commands route here; --audit = screenshot after each state change (best-effort)
thinkbrowse audit on|off|status [--tab <tabId>]   # Toggle/inspect audit mode for the attached local tab
thinkbrowse release [--group <name>]      # Release tab lock + close CLI session
thinkbrowse new-window [url] [--no-focus] # Open new Chrome window (local)

thinkbrowse cloud start [url] [--stealth] [--no-wait]  # Create cloud session
thinkbrowse cloud list                    # List cloud sessions
thinkbrowse cloud status [-s <id>]        # Session status
thinkbrowse cloud stop [-s <id>] [--all]  # Terminate session(s)
thinkbrowse cloud use <id>                # Set default session
thinkbrowse cloud artifacts [-s <id>]     # List screenshots/recordings
```

## Navigation

```bash
thinkbrowse navigate <url> [--wait-until load|domcontentloaded|networkidle] [--timeout <ms>]
thinkbrowse back [--tab <tabId>]
thinkbrowse forward [--tab <tabId>]
thinkbrowse scroll --direction up|down [--amount <px>]  # default: down 500
```

## Interaction

```bash
thinkbrowse click <selector> [--tab <tabId>]
thinkbrowse type <selector> <text> [--tab <tabId>]       # Keyboard events (React-safe)
thinkbrowse fill <selector> <value> [--tab <tabId>]      # Native value set (plain HTML)
thinkbrowse press <key> [--tab <tabId>]                  # Enter, Tab, Escape, ArrowDown, etc.
thinkbrowse hover <selector> [--tab <tabId>]
thinkbrowse select <selector> <value> [--tab <tabId>]    # <select> dropdown
thinkbrowse wait <selector|ms> [--visible] [--hidden] [--timeout <ms>]
thinkbrowse wait-for-text <text> [--timeout <ms>]
```

## Observation

```bash
thinkbrowse snapshot [--tab <tabId>]                     # Accessibility tree (best for AI)
thinkbrowse screenshot [--output <path>] [--full-page] [--selector <sel>] [--caption <text>] [--max-dimension <px>]
                                                          # PNG capture; --caption syncs a local screenshot into the Activity Feed session
thinkbrowse extract <selector> [--all] [--attribute <attr>]
thinkbrowse evaluate <javascript> [--tab <tabId>]        # Execute JS, return value
thinkbrowse url [--tab <tabId>]                          # Current URL (plain string)
thinkbrowse title [--tab <tabId>]                        # Page title
thinkbrowse html [--tab <tabId>]                         # Full page HTML
thinkbrowse console [--tab <tabId>]                      # Console log messages
thinkbrowse network [--tab <tabId>]                      # Network request log
thinkbrowse clear-logs [--tab <tabId>] [--mode local|cloud]   # Reset console/network buffers (local and cloud)
```

## Dialog Handling

```bash
thinkbrowse dialog get                    # Check for pending dialog
thinkbrowse dialog accept [text]          # Accept (optional prompt text)
thinkbrowse dialog dismiss                # Dismiss
```

## Mode override

Every browser command accepts `--mode local|cloud` to override the persisted context for that one call. `--tab <tabId>` targets a specific local tab and bypasses the machine-wide "active tab", which another agent or terminal can move.

## Tab Targeting (Multi-Agent)

```bash
thinkbrowse navigate <url> --tab <tabId>  # Target specific tab
export THINKBROWSE_TAB_ID=<id>            # Env var override
# Priority: --tab flag > env > working-location.json
```

## Agent Identity

```bash
thinkbrowse agent-init [--name <name>] [--reset] [--show]
```

## Configuration

```bash
thinkbrowse config set apiKey|apiUrl|defaultBrowser <value>
thinkbrowse config show|reset [-y]
thinkbrowse doctor                        # Check bridge, extension, config
```

## JSON Envelope

```json
// Success (exit 0)
{"success": true, "command": "...", "durationMs": N, "data": {...}}

// Error (exit 1, stderr)
{"success": false, "error": "...", "code": "...", "hint": "...", "retryable": bool}
```

- `--json` flag forces JSON output (auto-enabled when piped)
- `--quiet` suppresses non-essential output
- `--verbose` shows debug information
