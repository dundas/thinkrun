# ThinkRun — Screen Recorder for AI Coding Agents

Stop screenshotting bugs and typing paragraphs to explain them. ThinkRun records any browser session — or lets your agent record what it built — and turns it into **structured context your AI coding agent can act on**: every click, the console, network requests, your voice narration, and screenshots, all time-synced. Not just a screenshot. Not just a video.

Works with **Claude Code**, **Cursor**, **Cline**, **Windsurf**, and any MCP client.

## Install

```bash
npx @thinkrun/mcp
```

Or install the CLI globally:

```bash
npm install -g @thinkrun/cli
```

The CLI automatically installs the native host binary, which lets AI tools control Chrome.

## Add to your MCP config

```json
{
  "mcpServers": {
    "thinkrun": {
      "command": "npx",
      "args": ["@thinkrun/mcp"]
    }
  }
}
```

Config location:
- **Claude Code**: `~/.claude/settings.json`
- **Cursor**: `.cursor/mcp.json`
- **Cline**: VS Code settings → Cline MCP Servers

Then ask your agent: *"navigate to localhost:3000 and screenshot the checkout page"* — or record the bug yourself and hand the agent the result.

## Why ThinkRun

Other tools give your agent eyes. ThinkRun gives it **structured sight** — context it can parse in one pass instead of you re-explaining the page.

| | ThinkRun | Playwright MCP |
|---|---|---|
| Records a session into structured, replayable context | ✅ | ❌ drive-only |
| Turns a recording into an AI-ready report (clicks, console, network) | ✅ | ❌ |
| Shareable link, also as LLM-ready Markdown / JSON | ✅ | ❌ |
| Uses your real Chrome — your cookies & sessions | ✅ | ❌ headless only |
| Runs alongside your browser, no profile conflict | ✅ | ❌ fights for Chrome profile |

## Agent skills

Skills for Claude Code, Cursor, Codex, and Gemini CLI are in `.claude/skills/`, `.cursor/skills/`, `.codex/skills/`, and `.gemini/skills/`.

## Manual binary install

If you need to install the native host without the CLI, download the binary for your platform from the [latest release](https://github.com/dundas/thinkrun/releases/latest) and run:

```bash
chmod +x thinkbrowse-host-* && ./thinkbrowse-host-* --install
```

> The native host binary keeps the `thinkbrowse-host` filename for now — it's the same signed binary, unchanged by the rename.

## More

- [thinkrun.ai](https://thinkrun.ai)
- [Privacy Policy](https://thinkrun.ai/privacy)
