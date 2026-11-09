// Speed check behind "MCP was as quick or quicker almost every time": median wall-clock time (wallMs) per setup,
// CLI vs MCP with a shell, for each model on the three shop tasks and the docs task (3 models x 4 tasks = 12
// comparisons). Same arms as the token comparisons in verify-claims.ts. Run from this folder: bun speed.ts
const load = async (p: string) => (await Bun.file(p).text()).split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => typeof r.run === "number");
const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[(s.length - 1) >> 1]; };
const s = (ms: number) => (ms / 1000).toFixed(1) + " s";

const rows: { model: string; task: string; cli: number; mcp: number }[] = [];
const add = (model: string, task: string, cli: any[], mcp: any[]) => rows.push({ model, task, cli: med(cli.map((r) => r.wallMs)), mcp: med(mcp.map((r) => r.wallMs)) });

// Claude Code: CLI arm with an open Bash tool vs MCP + shell (follow-up round, variant mcpshell).
const cliClaude = await load("results-cli-open-bash.jsonl");
const mcpShellClaude = (await load("results-followup-claude.jsonl")).filter((r) => r.variant === "mcpshell");
for (const t of ["simple", "dense", "long"]) add("claude-sonnet-5-5", t, cliClaude.filter((r) => r.task === t), mcpShellClaude.filter((r) => r.task === t));
// Codex: CLI arm (v2 round) vs MCP + shell (follow-up round).
for (const m of ["gpt-6-luna", "gpt-6.1-sol"]) {
  const cli = (await load(`results-codex-v2-${m}.jsonl`)).filter((r) => r.arm === "cli");
  const mcpShell = (await load(`results-followup-codex-mcpshell-${m}.jsonl`)).filter((r) => r.variant === "mcpshell");
  for (const t of ["simple", "dense", "long"]) add(m, t, cli.filter((r) => r.task === t), mcpShell.filter((r) => r.task === t));
}
// Docs task (Playwright's demo): cli vs mcp-shell arms.
for (const [m, f] of [["claude-sonnet-5-5", "results-demotask-claude.jsonl"], ["gpt-6-luna", "results-demotask-gpt-6-luna.jsonl"], ["gpt-6.1-sol", "results-demotask-gpt-6.1-sol.jsonl"]]) {
  const d = await load(f);
  add(m, "docs", d.filter((r) => r.arm === "cli"), d.filter((r) => r.arm === "mcp-shell"));
}

console.log("model".padEnd(20), "task".padEnd(7), "CLI".padStart(8), "MCP+shell".padStart(10), "  faster");
for (const r of rows) console.log(r.model.padEnd(20), r.task.padEnd(7), s(r.cli).padStart(8), s(r.mcp).padStart(10), "  " + (r.mcp <= r.cli ? "MCP" : `CLI by ${s(r.mcp - r.cli)}`));
const mcpWins = rows.filter((r) => r.mcp <= r.cli).length;
console.log(`\nMCP as quick or quicker in ${mcpWins} of ${rows.length} comparisons; CLI faster in ${rows.length - mcpWins}.`);
console.log("Note: the Claude and Codex shop arms come from different rounds (CLI v2 / open-bash vs the follow-up round), so most shop pairs were not run side by side.");
