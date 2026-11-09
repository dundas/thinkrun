// Recomputes every published number from the results files in this folder. Run from this folder: bun verify-claims.ts
const load=async(p:string)=>(await Bun.file(p).text()).split("\n").filter(Boolean).map(l=>JSON.parse(l)).filter(r=>typeof r.run==="number");
const med=(a:number[])=>{const s=[...a].sort((x,y)=>x-y);return s[(s.length-1)>>1]};
const P:any={"gpt-6-luna":{i:.10,c:.01,o:.50},"gpt-6.1-sol":{i:2,c:.10,o:10}};
const cc=(m:string)=>(r:any)=>((r.inputAll-r.cached)*P[m].i+r.cached*P[m].c+r.output*P[m].o)/1e6;
const first=(await load("results.jsonl")).filter(r=>r.arm==="mcp"),rer=await load("results-cli-open-bash.jsonl"),fu=await load("results-followup-claude.jsonl");
const m=["gpt-6-luna","gpt-6.1-sol"];const pub:any={},ter:any={},sh:any={},dt:any={};for(const x of m){pub[x]=await load(`results-codex-v2-${x}.jsonl`);ter[x]=await load(`results-followup-codex-${x}.jsonl`);sh[x]=await load(`results-followup-codex-mcpshell-${x}.jsonl`);dt[x]=await load(`results-demotask-${x}.jsonl`);}
const dc=await load("results-demotask-claude.jsonl");
const shop=[...first,...rer,...fu,...m.flatMap(x=>[...pub[x],...ter[x],...sh[x]])];const demo=[...dc,...m.flatMap(x=>dt[x])];
const pass=(a:any[])=>a.filter(r=>r.success).length;
console.log("shop runs",shop.length,"pass",pass(shop),"| demo runs",demo.length,"pass",pass(demo),"| total",shop.length+demo.length,"pass",pass(shop)+pass(demo));
console.log("\n# demo medians (tok, $)");for(const [n,R,c] of [["claude",dc,(r:any)=>r.costUsd],...m.map(x=>[x,dt[x],cc(x)])] as any)for(const a of ["cli","mcp-shell","mcp"]){const r=R.filter((x:any)=>x.arm===a);const t=r.map((x:any)=>x.inputAll);console.log(n,a,med(t),Math.min(...t),Math.max(...t),med(r.map(c)).toFixed(4),n==="claude"?"final "+med(r.map((x:any)=>x.finalContext)):"");}
console.log("\n# shop, mcp+shell vs cli (tok,$)");const tk=["simple","dense","long"];
for(const t of tk){const a=fu.filter(r=>r.variant==="mcpshell"&&r.task===t),b=rer.filter(r=>r.task===t);console.log("claude",t,med(a.map(r=>r.inputAll)),med(b.map(r=>r.inputAll)),"fewer",(1-med(b.map(r=>r.inputAll))/med(a.map(r=>r.inputAll))).toFixed(3),"$",med(a.map(r=>r.costUsd)).toFixed(4),med(b.map(r=>r.costUsd)).toFixed(4),"ratio",(med(b.map(r=>r.costUsd))/med(a.map(r=>r.costUsd))).toFixed(3));}
for(const x of m)for(const t of tk){const a=sh[x].filter((r:any)=>r.task===t),b=pub[x].filter((r:any)=>r.arm==="cli"&&r.task===t);const c=cc(x);console.log(x,t,med(a.map((r:any)=>r.inputAll)),med(b.map((r:any)=>r.inputAll)),"mcp/cli",(med(a.map((r:any)=>r.inputAll))/med(b.map((r:any)=>r.inputAll))).toFixed(2),"$",med(a.map(c)).toFixed(4),med(b.map(c)).toFixed(4));}
console.log("\n# luna 8 item mcp+shell, per run");for(const r of sh["gpt-6-luna"].filter((r:any)=>r.task==="long"))console.log(r.inputAll,cc("gpt-6-luna")(r).toFixed(4),"calls",r.toolCalls,"script",r.scriptCalls,r.success);
console.log("\n# step-by-step vs standard 8-item (passing step runs)");
const ratio=(n:string,a:string,st:any[],sc:any[],c:any)=>{const p=st.filter(r=>r.success);console.log(n,a,"step",med(p.map((r:any)=>r.inputAll)),"std",med(sc.map((r:any)=>r.inputAll)),"tok x",(med(p.map((r:any)=>r.inputAll))/med(sc.map((r:any)=>r.inputAll))).toFixed(1),"$",med(p.map(c)).toFixed(4),med(sc.map(c)).toFixed(4),"cost x",(med(p.map(c))/med(sc.map(c))).toFixed(1));};
const cu=(r:any)=>r.costUsd;
ratio("claude","mcp+shell",fu.filter(r=>r.variant==="stepwise-mcpshell"),fu.filter(r=>r.variant==="mcpshell"&&r.task==="long"),cu);ratio("claude","cli",fu.filter(r=>r.variant==="stepwise"&&r.arm==="cli"),rer.filter(r=>r.task==="long"),cu);
for(const x of m){ratio(x,"mcp+shell",sh[x].filter((r:any)=>r.task==="stepwise"),sh[x].filter((r:any)=>r.task==="long"),cc(x));ratio(x,"cli",ter[x].filter((r:any)=>r.arm==="cli"),pub[x].filter((r:any)=>r.arm==="cli"&&r.task==="long"),cc(x));}
const lu=[...ter["gpt-6-luna"],...sh["gpt-6-luna"].filter((r:any)=>r.task==="stepwise")];console.log("\nluna step runs",lu.length,"stopped",lu.filter((r:any)=>!r.success).map((r:any)=>`${r.arm}:${r.adds}`).join(","));
const cs=[...fu.filter(r=>r.variant?.startsWith("stepwise")),...rer];console.log("claude cached share stepwise",(fu.filter(r=>r.variant==="stepwise").reduce((s,r)=>s+r.cacheRead,0)/fu.filter(r=>r.variant==="stepwise").reduce((s,r)=>s+r.inputAll,0)).toFixed(3));

// Draft 3 additions: write-once, agent-browser, grand total, every failure.
const ex:any={claude:await load("results-extras-claude.jsonl")};for(const x of m)ex[x]=await load(`results-extras-${x}.jsonl`);
const who=["claude",...m];const cof=(w:string)=>w==="claude"?cu:cc(w);const all=who.flatMap(w=>ex[w]);
console.log("\n# grand total: extras",all.length,"pass",pass(all),"| total",shop.length+demo.length+all.length,"pass",pass(shop)+pass(demo)+pass(all));
console.log("\n# write once vs normal 8-item, medians (tok,$): writeonce | cli | mcp+shell");let rp=0,rn=0;
const norm:any={claude:[rer.filter(r=>r.task==="long"),fu.filter(r=>r.variant==="mcpshell"&&r.task==="long")]};for(const x of m)norm[x]=[pub[x].filter((r:any)=>r.arm==="cli"&&r.task==="long"),sh[x].filter((r:any)=>r.task==="long")];
for(const w of who){const W=ex[w].filter((r:any)=>r.variant==="writeonce"),c=cof(w);rp+=W.reduce((n:number,r:any)=>n+r.rerunPass,0);rn+=W.reduce((n:number,r:any)=>n+r.reruns.length,0);const [a,b]=norm[w];console.log(w,"pass",pass(W),"/",W.length,"tok",med(W.map((r:any)=>r.inputAll)),med(a.map((r:any)=>r.inputAll)),med(b.map((r:any)=>r.inputAll)),"$",med(W.map(c)).toFixed(4),med(a.map(c)).toFixed(4),med(b.map(c)).toFixed(4),"rerun s",(med(W.flatMap((r:any)=>r.reruns.map((x:any)=>x.ms)))/1000).toFixed(1));}
console.log("reruns correct",rp,"of",rn);
console.log("\n# agent-browser medians vs cli vs mcp+shell (tok)");
for(const w of who){const A=ex[w].filter((r:any)=>r.variant==="agent-browser"),D=w==="claude"?dc:dt[w];const ab=(t:string)=>med(A.filter((r:any)=>r.task===t).map((r:any)=>r.inputAll));
console.log(w,"pass",pass(A),"/",A.length,"demo",ab("demo"),med(D.filter((r:any)=>r.arm==="cli").map((r:any)=>r.inputAll)),med(D.filter((r:any)=>r.arm==="mcp-shell").map((r:any)=>r.inputAll)));
for(const t of ["simple","dense"]){const a=w==="claude"?rer.filter(r=>r.task===t):pub[w].filter((r:any)=>r.arm==="cli"&&r.task===t),b=w==="claude"?fu.filter(r=>r.variant==="mcpshell"&&r.task===t):sh[w].filter((r:any)=>r.task===t);console.log(" ",t,ab(t),med(a.map((r:any)=>r.inputAll)),med(b.map((r:any)=>r.inputAll)));}}
console.log("\n# every failure");for(const r of [...shop,...demo,...all].filter(r=>!r.success))console.log(r.variant||r.arm,r.task,"run",r.run,"adds",r.adds,"rerunPass",r.rerunPass??"-","cart",JSON.stringify(r.cart??"").slice(0,70));
