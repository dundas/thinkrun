// Summarizes the write-once and agent-browser tests. Usage: bun analyze-extras.ts
const load = async (p: string) => (await Bun.file(p).text()).split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => typeof r.run === "number");
const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[(s.length - 1) >> 1] : NaN; };
const rng = (a: number[], d = 0) => a.length ? `${Math.min(...a).toFixed(d)}-${Math.max(...a).toFixed(d)}` : "-";
const P: any = { "gpt-6-luna": { i: 0.1, c: 0.01, o: 0.5 }, "gpt-6.1-sol": { i: 2, c: 0.1, o: 10 } };
for (const w of ["claude", "gpt-6-luna", "gpt-6.1-sol"]) {
  const R = await load(`results-extras-${w}.jsonl`);
  const c = (r: any) => w === "claude" ? r.costUsd : ((r.inputAll - r.cached) * P[w].i + r.cached * P[w].c + r.output * P[w].o) / 1e6;
  const W = R.filter((r) => r.variant === "writeonce");
  console.log(`\n# ${w} write-once n${W.length}: pass ${W.filter((r) => r.success).length}, reruns ${W.reduce((n, r) => n + r.rerunPass, 0)}/${W.reduce((n, r) => n + r.reruns.length, 0)}, tok ${med(W.map((r) => r.inputAll))} [${rng(W.map((r) => r.inputAll))}], $${med(W.map(c)).toFixed(4)} [${rng(W.map(c), 4)}], rerun sec ${(med(W.flatMap((r) => r.reruns.map((x: any) => x.ms))) / 1000).toFixed(1)}, per-run ${W.map((r) => r.rerunPass).join(",")}, calls ${W.map((r) => r.toolCalls).join(",")}`);
  for (const r of W.filter((x) => !x.success)) console.log("  FAIL", r.run, "exists", r.scriptExists, JSON.stringify(r.reruns?.[0]).slice(0, 240));
  for (const t of ["demo", "simple", "dense"]) {
    const A = R.filter((r) => r.variant === "agent-browser" && r.task === t);
    console.log(`ab ${t}: n${A.length} pass ${A.filter((r) => r.success).length} tok ${med(A.map((r) => r.inputAll))} [${rng(A.map((r) => r.inputAll))}] $${med(A.map(c)).toFixed(4)} [${rng(A.map(c), 4)}]`, w === "claude" ? `final ${med(A.map((r) => r.finalContext))} first ${med(A.map((r) => r.firstContext))}` : "", `calls ${A.map((r) => r.toolCalls).join(",")} guideLoads ${A.map((r) => r.commands.filter((x: string) => x.includes("skills get")).length).join(",")} usedTool ${A.filter((r) => r.usedTool).length}`);
    for (const r of A.filter((x) => !x.success)) console.log("  FAIL", r.run, "urls", r.urlsOk, "shots", r.distinctShots, "fetched", r.fetched, "adds", r.adds, "nonBrowser", r.nonBrowserRequests, "used", r.usedTool, "ans", JSON.stringify(r.answer).slice(0, 170));
  }
}
