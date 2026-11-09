// Estimated cost from OpenAI standard short-context list prices read 2026-11-05 (USD per 1M tokens).
const P:any={"gpt-6-luna":{i:0.10,c:0.01,o:0.50},"gpt-6.1-sol":{i:2.00,c:0.10,o:10.00}};
const med=(a:number[])=>{const s=[...a].sort((x,y)=>x-y);return s[(s.length-1)/2]};
const out:any[]=[];
for(const m of Object.keys(P)){const R=(await Bun.file(`results-codex-v2-${m}.jsonl`).text()).split("\n").filter(Boolean).map(l=>JSON.parse(l)).filter(r=>typeof r.run==="number");
const cost=(r:any)=>((r.inputAll-r.cached)*P[m].i+r.cached*P[m].c+r.output*P[m].o)/1e6;
console.log(`## ${m} total ${R.reduce((s,r)=>s+cost(r),0).toFixed(3)} cachedShare ${(R.reduce((s,r)=>s+r.cached,0)/R.reduce((s,r)=>s+r.inputAll,0)).toFixed(3)}`);
for(const t of ["simple","dense","long"]){const a=R.filter(r=>r.task===t&&r.arm==="mcp").map(cost),b=R.filter(r=>r.task===t&&r.arm==="cli").map(cost);console.log(t,"mcp",med(a).toFixed(4),`(${Math.min(...a).toFixed(4)}-${Math.max(...a).toFixed(4)})`,"cli",med(b).toFixed(4),`(${Math.min(...b).toFixed(4)}-${Math.max(...b).toFixed(4)})`,"cli/mcp",(med(b)/med(a)).toFixed(2));}
}
