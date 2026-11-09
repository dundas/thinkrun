# Playwright CLI vs MCP: benchmark data, prompts and runners

The test data behind ThinkRun's Playwright CLI vs MCP comparison. Every number in the video and the blog post can be
recomputed from the files in this folder, and the runners let you repeat the test on your own machine.

- **Video:** [Playwright CLI vs MCP (285 Tests): Which Should You Use?](https://youtu.be/7MiJN2htFtE)
- **Blog post:** [Playwright CLI vs MCP](https://thinkrun.ai/blog/playwright-cli-vs-mcp)
- **ThinkRun's analysis of the video:** [share page](https://thinkrun.ai/s/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA)
  ([Markdown](https://thinkrun.ai/s/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA.md),
  [JSON](https://thinkrun.ai/s/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA.json)). It has a summary, key moments,
  transcript and screenshots. A checked snapshot is in [video-analysis.md](video-analysis.md), with our corrections at the
  top.
- **Tested:** November 5–7, 2026. Models and tools change quickly; check the dates before relying on these results.

## What we tested

Three models, each driving a real Chrome browser through Playwright:

| Agent | Model | Effort |
|---|---|---|
| Claude Code 2.1.318 (`claude -p`) | Claude Sonnet 5.5 (`claude-sonnet-5-5`) | medium |
| Codex CLI 0.165.0 (`codex exec`) | GPT-6 Luna (`gpt-6-luna`) | medium |
| Codex CLI 0.165.0 (`codex exec`) | GPT-6.1 Sol (`gpt-6.1-sol`) | medium |

Three ways to drive the browser:

- **CLI:** `@playwright/cli` 0.1.23 with its official skill, used through the shell.
- **MCP:** `@playwright/mcp` 0.0.84 with no shell, so the agent can only use the MCP tools.
- **MCP + shell:** the same MCP server plus Bash, Read and Grep, so both setups can script.

Two kinds of task, with the exact prompts in [PROMPTS.md](PROMPTS.md):

- **A test shop** (`fixture.ts`). A local, seeded, deterministic shop. It records what really happened (every
  add-to-cart, the cart and any non-browser requests) at `/__state`, so a run passes only if the cart is right **and**
  the agent's reply matches it. Tasks:
  - buy one item with 20 products (`simple`) or 400 (`dense`);
  - an eight-item job (`long`).
- **Playwright's own demo task.** On the live playwright.dev, find the locators doc for four languages and screenshot each.

Extra experiments: the eight-item job told to work step by step; writing a Playwright script once and rerunning it
with no agent; and the `agent-browser` CLI.

Five runs per setup per task. Smoke runs (`"run": "smoke"`) were setup checks and are excluded from every number.

## Two comparisons, two write-ups

- **The blog post** compares the CLI with **plain MCP** (no shell): 90 runs on the shop.
  - Claude MCP rows: `results.jsonl` (`arm: "mcp"`).
  - Claude CLI rows: `results-cli-open-bash.jsonl` (the re-run with normal shell access).
  - Codex: `results-codex-v2-<model>.jsonl`.
  - The CLI rows in `results.jsonl` are the first Claude batch, whose shell allow-list blocked loops and scripts. The
    blog reports them separately.
- **The video** compares the CLI with **MCP + shell**, so both setups can script, and adds the docs task and the
  extra experiments: 285 runs in total.

## Reproduce the published numbers

Requires [Bun](https://bun.sh). From this folder:

| Claim | Command | Output |
|---|---|---|
| Every number in the video: 285 tests, 277 passed; docs-task and shop token gaps; 97K vs 2.9M in 51 calls; step by step 6–27×; Luna stopping early in 5 of 15; write-once 70 of 75 at ~2.5 s with zero tokens; agent-browser 45/45 | `bun verify-claims.ts` | [verify-claims-output.txt](verify-claims-output.txt) |
| "MCP was as quick or quicker": 9 of 12 comparisons | `bun speed.ts` | [speed-output.txt](speed-output.txt) |
| Every passed shop run left exactly the expected cart (188 checked, 0 mismatches) | `bun check-carts.ts` | [check-carts-output.txt](check-carts-output.txt) |
| Blog, Claude MCP and the first CLI batch | `bun analyze.ts` | — |
| Blog, Claude CLI re-run | `bun analyze.ts results-cli-open-bash.jsonl` | — |
| Blog, GPT-6 Luna / GPT-6.1 Sol tokens | `bun analyze-codex.ts gpt-6-luna` (or `gpt-6.1-sol`) | — |
| Blog, Codex cost estimates | `bun cost-codex.ts` | — |
| Follow-ups, docs task, extras in detail | `bun analyze-followup.ts`, `bun analyze-demotask.ts`, `bun analyze-extras.ts` | — |

Codex costs are estimates from token counts at OpenAI list prices on November 5, 2026: GPT-6 Luna $0.10 / $0.01 / $0.50 and
GPT-6.1 Sol $2.00 / $0.10 / $10.00 per 1M input / cached / output tokens. Claude costs are what Claude Code reported.

## Files

| File | What it is |
|---|---|
| `fixture.ts` | The test shop. `PRODUCTS` and `PLAN` env vars; prints its port and expected answer, then serves `/__state` |
| `run.ts` | Claude Code shop runs: `bun run.ts smoke` / `batch` (CLI + MCP) / `cliopen` (CLI with normal shell access) |
| `run-codex.ts` | Codex shop runs: `CODEX_CLI_FULL_ACCESS=1 bun run-codex.ts <model> smoke` / `batch` |
| `run-followup.ts` | Claude follow-ups: `stepwise`, `mcpshell`, `stepwise-mcpshell` (plus `smoke-*`) |
| `run-followup-codex.ts` | Codex follow-ups: `CODEX_CLI_FULL_ACCESS=1 bun run-followup-codex.ts <model> stepwise`; `… mcpshell` / `stepwise-mcpshell` |
| `run-demotask.ts` | Playwright's docs task, all setups interleaved: `bun run-demotask.ts claude batch`; Codex needs `CODEX_CLI_FULL_ACCESS=1` |
| `run-extras.ts` | Write-once (`writeonce`) and agent-browser (`ab`) experiments, same pattern |
| `codex-flags.ts` | Codex settings helper: disables user skills, web search and user config |
| `verify-claims.ts`, `speed.ts`, `analyze*.ts`, `cost-codex.ts` | Analysis (see above) |
| `results*.jsonl` | One JSON row per run: setup, task, pass/fail, the shop's record, tokens, cost, wall time, tool calls |
| `writeonce-scripts/` | Every `shop.mjs` the agents wrote in the write-once experiment |
| `screenshots/docs-task/` | One passing docs-task run per model (the agents' own screenshots) |
| `cli/`, `ab/` | `package.json` + lock files for `@playwright/cli` and `agent-browser` (run `npm ci` in each) |
| `PROMPTS.md` | Every prompt, verbatim |
| `video-analysis.md` | ThinkRun's analysis of the video (share-page Markdown export, 2026-11-09), with our corrections note |
| `events/` | Where the runners write each run's full agent event log (not published; see below) |

## Run it yourself

1. Install Bun, Google Chrome, Claude Code and/or the Codex CLI, signed in.
2. `cd cli && npm ci && cd ..`, plus `cd ab && npm ci && cd ..` for the agent-browser runs. The MCP server is fetched
   with `npx -y @playwright/mcp@0.0.84`.
3. **Move the published results aside first:** `mkdir -p published && mv results*.jsonl published/`. The runners
   append to the matching `results*.jsonl` and skip any run already recorded there, so with the published files in
   place a batch would do nothing. (`cd published && bun ../verify-claims.ts` still recomputes the published numbers.)
4. Run a smoke test first, e.g. `bun run.ts smoke`, then a batch. Each run's event log goes to `events/`. The Claude
   runners use the published model and effort unless you set `BENCH_MODEL` / `BENCH_EFFORT`, e.g.
   `BENCH_MODEL=claude-opus-5-5 bun run.ts batch`; the Codex runners take the model as their first argument.
5. The Codex runs that start Chrome from the shell need `CODEX_CLI_FULL_ACCESS=1`
   (`--dangerously-bypass-approvals-and-sandbox`), because Chrome can't launch inside Codex's macOS sandbox. Run them
   only on a machine you're comfortable giving the agent full access to.

We ran everything on macOS (Apple Silicon) with Bun 1.4. Each run gets a fresh shop, browser session and temp workspace.

## Caveats

- Five runs per setup show large gaps, not small ones.
- When these results were recorded, a shop run passed when the agent's reply matched the expected items and total
  and the shop recorded the expected number of add-to-cart events; the shop's recorded cart itself wasn't compared.
  We audited that afterwards rather than rescoring: `check-carts.ts` compares every passed run's recorded cart with the
  expected items (a product listed twice counts as a mismatch), and all 188 match. The runners here now also require
  that match (`cart-check.ts`), so any rerun uses the stricter rule.
- The Claude CLI runs with a normal shell (`run.ts cliopen`) didn't check that the agent stayed in the browser; the
  Codex, follow-up and extras runners did (`nonBrowserRequests`, `usedBrowser`). We audited the 15 published runs'
  agent logs for direct HTTP calls to the shop: one run (8-item, run 1) used `curl` once to read a product page, and it
  is one of the two failed runs, so no passed run is affected. `run.ts` now also requires zero non-browser requests.
- Four changes to the runners since the published runs:
  - the cart check;
  - the browser-only check in `run.ts`;
  - `run.ts cliopen` now skips runs already recorded, like every other batch mode;
  - the optional `BENCH_MODEL` / `BENCH_EFFORT` settings for the Claude runners (defaults are the published
    `claude-sonnet-5-5` at `medium`).
- The Claude and Codex shop arms compared in the video (CLI vs MCP + shell) come from different rounds, so most of those
  pairs were not run side by side.
- Our first Codex attempt had a `PATH` bug in the runner, and one agent ordered through `curl` instead of the browser;
  that round was discarded, and the Codex runs here use stricter scoring (`usedBrowser`, `nonBrowserRequests`).
- The docs task runs against the live playwright.dev, so it can drift as the site changes.

## What's not here, and why

- **Raw agent event logs (~47 MB).** They hold local paths, session IDs and machine details. No published number
  depends on them; every number comes from the results files.
- **The full screenshot set (186 MB).** One passing run per model is included.
- **Installed `node_modules`.** Use the lock files.
- **Results text fields.** Local home paths are shown as `~` and temp folders as `<tmp>`, mostly in Codex's
  `stderrTail`. No numbers were changed: `verify-claims.ts` gives identical output before and after.
