// Summarizes the Playwright demo-task retest. Usage: bun analyze-demotask.ts
import { existsSync } from "node:fs";
const P: any = { "gpt-6-luna": { i: 0.10, c: 0.01, o: 0.50 }, "gpt-6.1-sol": { i: 2.00, c: 0.10, o: 10.00 } };
const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[(s.length - 1) >> 1] : NaN; };
const rng = (a: number[], d = 0) => a.length ? `${Math.min(...a).toFixed(d)}-${Math.max(...a).toFixed(d)}` : "-";
for (const who of ["claude", "gpt-6-luna", "gpt-6.1-sol"]) {
  const f = `results-demotask-${who}.jsonl`; if (!existsSync(f)) { console.log(`\n# ${who}: no results`); continue; }
  const R = (await Bun.file(f).text()).split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => typeof r.run === "number");
  const cost = (r: any) => who === "claude" ? r.costUsd : ((r.inputAll - r.cached) * P[who].i + r.cached * P[who].c + r.output * P[who].o) / 1e6;
  console.log(`\n# ${who} (${R.length} of 15)`);
  for (const a of ["cli", "mcp-shell", "mcp"]) { const r = R.filter((x) => x.arm === a); if (!r.length) continue;
    const search = r.filter((x) => x.commands.some((c: string) => /browser_type|browser_fill|search|DocSearch/i.test(c))).length;
    console.log(a.padEnd(10), "pass", `${r.filter((x) => x.success).length}/${r.length}`, "tok", med(r.map((x) => x.inputAll)), `[${rng(r.map((x) => x.inputAll))}]`, "$", med(r.map(cost)).toFixed(3), `[${rng(r.map(cost), 3)}]`, who === "claude" ? `final ${med(r.map((x) => x.finalContext))} [${rng(r.map((x) => x.finalContext))}] first ${med(r.map((x) => x.firstContext))}` : `uncached ${med(r.map((x) => x.inputAll - x.cached))}`, "calls", r.map((x) => x.toolCalls).join(","), "script", r.map((x) => x.scriptCalls).join(","), "searchedRuns", search, "shots", r.map((x) => x.distinctShots).join(","), "urls", r.filter((x) => x.urlsOk).length);
    for (const x of r.filter((y) => !y.success)) console.log("   FAIL", x.run, "urls", x.urlsOk, "shots", x.distinctShots, "fetched", x.fetched, "to", x.timedOut, JSON.stringify(x.answer ?? x.finalText).slice(0, 220)); }
}
