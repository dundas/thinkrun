---
name: browser-tool-benchmark
description: "Run ThinkRun's open Playwright CLI vs MCP benchmark on your own machine, agent and model — a seeded test shop that records what really happened, plus Playwright's own docs demo — and report tokens, cost, speed and pass rate per setup next to the published results (285 tests on Claude Sonnet 5.5, GPT-6 Luna, GPT-6.1 Sol). Use when: which is cheaper for my agent, Playwright CLI or Playwright MCP; benchmark playwright-cli vs @playwright/mcp on my model; reproduce or rerun the ThinkRun CLI vs MCP tests; measure browser-tool token usage for Claude Code or Codex; compare MCP with a shell, step-by-step prompting, write-a-script-once or agent-browser. Do NOT use for: driving a browser to do a task (web-browse); proving a change works (prove-it); a UX review (ux-audit); writing Playwright tests for your app; benchmarking LLMs on non-browser tasks."
category: evidence
sync: all
---

# Browser tool benchmark

One job: find out which way of giving a coding agent a browser costs least **on your model and your agent**, with a
test you can trust, and put your numbers next to ThinkRun's published ones.

The benchmark is open: <https://github.com/dundas/thinkrun/tree/main/benchmarks/playwright-cli-vs-mcp>
(video: <https://youtu.be/7MiJN2htFtE>, write-up: <https://thinkrun.ai/blog/playwright-cli-vs-mcp>). Each run gets a
fresh local test shop that records every add-to-cart, so a run passes only if the cart is right **and** the agent's
reply matches it: check the result, not the reply.

---

## Inputs (ask once, up front)

- **Agent and model**: Claude Code (any Claude model, default `claude-sonnet-5-5`) and/or Codex (any model, e.g.
  `gpt-6-luna`).
- **Which comparison** (pick one to start; each is 5 runs per setup per task):

| Comparison | What it answers | Claude Code | Codex |
|---|---|---|---|
| A. CLI vs plain MCP | The headline question | `bun run.ts batch` then `bun run.ts cliopen` | `bun run-codex.ts <model> batch` |
| B. CLI vs MCP + shell | Both can script; is the tool still the difference? | A, plus `bun run-followup.ts mcpshell` | A, plus `bun run-followup-codex.ts <model> mcpshell` |
| C. How the agent works | Step-by-step prompting, write-once scripts, agent-browser | `bun run-followup.ts stepwise`, `bun run-extras.ts claude writeonce` / `ab` | same with `<model>` |
| D. Playwright's own demo | The docs task from Playwright's video, on live playwright.dev | `bun run-demotask.ts claude batch` | `bun run-demotask.ts <model> batch` |

- **Budget**: before any model run, the smoke test included, say the expected cost and get a yes. The smoke test is
  one run, about $0.10 on Claude Code (`claude-sonnet-5-5`) and under $0.10 on Codex. Published reference for a batch,
  15 runs per setup:
  - Claude Code with `claude-sonnet-5-5`: about $2.80 for `run.ts batch` (30 runs) and $1.35 for `cliopen` (15).
  - Codex with `gpt-6-luna`: about $0.20 for 30 runs.
  - Codex with `gpt-6.1-sol`: about $2.10 for 30 runs.

  Runs take 15–60 s each; a 30-run batch is roughly 15–25 minutes.

---

## Step 0 — Requirements

```bash
bun --version && node --version && npm --version          # Bun 1.x, Node 18+
ls "/Applications/Google Chrome.app" >/dev/null && echo chrome-ok   # macOS; the runners launch channel "chrome"
claude --version   # if benchmarking Claude Code (signed in)
codex --version    # if benchmarking Codex (signed in)
```

Stop and tell the user what's missing; don't install agents or sign in for them.

**Codex + Chrome needs full access.** Chrome can't start inside Codex's macOS sandbox, so the Codex runs that launch it
from the shell (the CLI arm, step-by-step, the docs task, write-once, agent-browser) need `CODEX_CLI_FULL_ACCESS=1`,
which passes `--dangerously-bypass-approvals-and-sandbox`. Explain that and get an explicit yes before setting it.
The Codex MCP-only and MCP + shell arms don't need it.

## Step 1 — Get the benchmark (just this folder)

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/dundas/thinkrun.git thinkrun-bench
cd thinkrun-bench && git sparse-checkout set benchmarks/playwright-cli-vs-mcp
cd benchmarks/playwright-cli-vs-mcp
(cd cli && npm ci)                 # @playwright/cli + its skill
(cd ab && npm ci)                  # only for the agent-browser runs
mkdir -p published && mv results*.jsonl published/   # REQUIRED: runners skip runs already recorded
```

Without the last line a batch does nothing: the runners append to `results*.jsonl` and skip any run already in it.

## Step 2 — Smoke test

One run, to prove the setup before spending on a batch. It is a paid model run: only start it after the user's yes
to the cost (Inputs).

```bash
bun run.ts smoke                                              # Claude Code
CODEX_CLI_FULL_ACCESS=1 bun run-codex.ts <model> smoke        # Codex (after the user's yes)
```

Read the last row: `tail -1 results.jsonl` (Codex: `results-codex-v2-<model>.jsonl`). It must show
`"success":true`. If not, read `stderr`/`stderrTail` and the run's log in `events/`, fix the setup, and smoke again.
Common causes:
- `playwright-cli: command not found`: `cli/` isn't installed.
- Chrome won't start under Codex: full access isn't set.
- The agent isn't signed in.

## Step 3 — Run the chosen comparison

Use the commands from the table. Claude runners take `BENCH_MODEL` / `BENCH_EFFORT` (defaults `claude-sonnet-5-5` /
`medium`), e.g. `BENCH_MODEL=claude-opus-5-5 bun run.ts batch`. Codex runners take the model as the first argument.
Batches resume: rerunning a command skips runs already recorded. Run in the background, and report progress from the
result files, not from guesses.

In comparison A, `bun run.ts batch` runs Claude's MCP arm plus a CLI arm whose shell allow-list blocks loops and
scripts (as in the published first batch). `cliopen` is the fair CLI arm with a normal shell. Compare MCP with
`cliopen`.

## Step 4 — Analyse

```bash
bun analyze.ts                                  # Claude: MCP (and restricted CLI) from results.jsonl
bun analyze.ts results-cli-open-bash.jsonl      # Claude: CLI with a normal shell
bun analyze-codex.ts <model> && bun cost-codex.ts   # Codex tokens; cost estimate (edit its price table for new models)
bun analyze-followup.ts      # MCP + shell, step by step
bun analyze-demotask.ts      # docs task
bun analyze-extras.ts        # write-once, agent-browser
bun check-carts.ts           # confirms every passed shop run left exactly the expected cart
```

`analyze-followup.ts`, `analyze-demotask.ts`, `analyze-extras.ts` and `cost-codex.ts` expect the published model set.
For other models, read the rows directly: each `results*.jsonl` row has `arm`, `task`, `success`, `inputAll` (tokens
sent), `costUsd` (Claude) or `cached`/`output` (Codex), and `wallMs`.

## Step 5 — Report

One table per comparison: median, with min–max, over the 5 runs.

| Task | Setup | Passed | Tokens sent (median, range) | Cost | Wall time |
|---|---|---|---|---|---|

Then three lines:
1. **The answer for this model:** which setup used fewer tokens, by how much, on which tasks, and whether that held on
   every task.
2. **Next to the published results:** the same comparison from `published/` (`cd published && bun ../verify-claims.ts`,
   or the numbers in the folder's README).
3. **Pass rate and failures:** any run where the agent's reply didn't match the shop's record. The reply can say "done"
   when the cart isn't.

State the limits plainly:
- five runs per setup show large gaps, not small ones;
- the docs task uses the live playwright.dev, so it can drift;
- Codex costs are estimates from list prices.

Don't present a gap under about 10% as a winner.

Offer, don't push: if the user wants their own task benchmarked, the pattern to copy is `fixture.ts` (a local page
that records what really happened) plus a runner's `success` check.
