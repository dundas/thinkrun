// Summarizes the follow-up tests against the published runs. Usage: bun analyze-followup.ts
import { existsSync } from "node:fs";
const load = async (p: string) => existsSync(p) ? (await Bun.file(p).text()).split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[(s.length - 1) >> 1] : NaN; };
const range = (a: number[], d = 0) => a.length ? `${Math.min(...a).toFixed(d)}-${Math.max(...a).toFixed(d)}` : "-";
const f = await load("results-followup-claude.jsonl");
const numbered = (r: any) => typeof r.run === "number";

console.log("# Claude step-by-step");
for (const arm of ["mcp", "cli"]) {
  const r = f.filter((x) => x.variant === "stepwise" && x.arm === arm && numbered(x));
  console.log(arm, "n", r.length, "pass", r.filter((x) => x.success).length, "tokens med", med(r.map((x) => x.inputAll)), range(r.map((x) => x.inputAll)), "cost med", med(r.map((x) => x.costUsd)).toFixed(3), range(r.map((x) => x.costUsd), 3), "final ctx", med(r.map((x) => x.finalContext)), "calls", r.map((x) => x.toolCalls).join(","), "script", r.map((x) => x.scriptCalls).join(","), "evaluate", r.map((x) => x.tools.filter((t: string) => /browser_evaluate/.test(t)).length).join(","), "write/read", med(r.map((x) => x.cacheWrite)), med(r.map((x) => x.cacheRead)), "sec", med(r.map((x) => x.wallMs / 1000)).toFixed(0));
}

console.log("\n# Claude MCP with a shell, against no-shell MCP and CLI re-run");
const noShell = (await load("results.jsonl")).concat().filter((x) => x.arm === "mcp" && numbered(x));
const rerun = (await load("results-cli-open-bash.jsonl")).filter(numbered);
for (const t of ["simple", "dense", "long"]) {
  const s = f.filter((x) => x.variant === "mcpshell" && x.task === t && numbered(x)), n = noShell.filter((x) => x.task === t), c = rerun.filter((x) => x.task === t);
  const fmt = (r: any[]) => `n${r.length} pass${r.filter((x) => x.success).length} tok ${med(r.map((x) => x.inputAll))} [${range(r.map((x) => x.inputAll))}] $${med(r.map((x) => x.costUsd)).toFixed(3)} [${range(r.map((x) => x.costUsd), 3)}]`;
  console.log(t, "\n  mcp+shell", fmt(s), "bashRuns", s.filter((x) => x.tools.some((n: string) => n.startsWith("Bash"))).length, "script", s.map((x) => x.scriptCalls).join(","), "nonBrowser", s.map((x) => x.nonBrowserRequests).join(","), "\n  mcp alone", fmt(n), "\n  cli rerun", fmt(c));
}
console.log("bash commands in MCP+shell runs:", [...new Set(f.filter((x) => x.variant === "mcpshell").flatMap((x) => x.tools.filter((n: string) => n.startsWith("Bash"))))].join(" | ").slice(0, 400));

for (const m of ["gpt-6-luna", "gpt-6.1-sol"]) {
  const r = (await load(`results-followup-codex-${m}.jsonl`)).filter(numbered);
  console.log(`\n# ${m} step-by-step (${r.length} of 10 done)`);
  for (const arm of ["mcp", "cli"]) {
    const a = r.filter((x) => x.arm === arm);
    console.log(arm, "n", a.length, "pass", a.filter((x) => x.success).length, "tokens med", med(a.map((x) => x.inputAll)), range(a.map((x) => x.inputAll)), "uncached", med(a.map((x) => x.inputAll - x.cached)), "output", med(a.map((x) => x.output)), "calls", a.map((x) => x.toolCalls).join(","), "script", a.map((x) => x.scriptCalls).join(","), "browser", a.filter((x) => x.usedBrowser).length);
  }
}

console.log("\n# Claude step-by-step MCP with a shell");
{ const r = f.filter((x) => x.variant === "stepwise-mcpshell" && numbered(x));
  console.log("n", r.length, "pass", r.filter((x) => x.success).length, "tokens med", med(r.map((x) => x.inputAll)), range(r.map((x) => x.inputAll)), "cost med", med(r.map((x) => x.costUsd)).toFixed(3), range(r.map((x) => x.costUsd), 3), "final ctx", med(r.map((x) => x.finalContext)), "calls", r.map((x) => x.toolCalls).join(","), "script", r.map((x) => x.scriptCalls).join(","), "bash", r.map((x) => x.tools.filter((n: string) => n.startsWith("Bash")).length).join(",")); }

for (const m of ["gpt-6-luna", "gpt-6.1-sol"]) {
  const s = (await load(`results-followup-codex-mcpshell-${m}.jsonl`)).filter(numbered), pub = (await load(`results-codex-v2-${m}.jsonl`)).filter(numbered);
  console.log(`\n# ${m} MCP with a shell (${s.length} of 20 done), against no-shell MCP and CLI`);
  const fmt = (r: any[]) => `n${r.length} pass${r.filter((x) => x.success).length} tok ${med(r.map((x) => x.inputAll))} [${range(r.map((x) => x.inputAll))}] uncached ${med(r.map((x) => x.inputAll - x.cached))} out ${med(r.map((x) => x.output))}`;
  for (const t of ["simple", "dense", "long"]) console.log(t, "\n  mcp+shell", fmt(s.filter((x) => x.task === t)), "shellCalls", s.filter((x) => x.task === t).map((x) => x.shellCalls).join(","), "script", s.filter((x) => x.task === t).map((x) => x.scriptCalls).join(","), "\n  mcp alone", fmt(pub.filter((x) => x.arm === "mcp" && x.task === t)), "\n  cli", fmt(pub.filter((x) => x.arm === "cli" && x.task === t)));
  const st = s.filter((x) => x.task === "stepwise");
  console.log("stepwise mcp+shell", fmt(st), "calls", st.map((x) => x.toolCalls).join(","), "shellCalls", st.map((x) => x.shellCalls).join(","), "script", st.map((x) => x.scriptCalls).join(","));
}
