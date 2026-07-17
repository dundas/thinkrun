// Trigger-eval harness: skill-routing judgment across models.
// Usage: bun run-eval.ts build   -> writes prompt.txt + manifest.json
//        bun run-eval.ts grade <config-name> <raw-output-file>
import { readdirSync } from "node:fs";

const BASE = import.meta.dir;
const FIXDIR = `${BASE}/fixtures`;

const CATALOG: Record<string, string> = {
  "thinkbrowse-cli":
    "Control browsers via the ThinkBrowse CLI (the thinkbrowse / thinkrun command) — navigate pages, interact with elements, extract content, take screenshots. Use ONLY when the user explicitly names the thinkbrowse or thinkrun CLI, or asks to drive the browser from shell scripts / terminal commands. For general browse, scrape, or automation asks that don't name the CLI, prefer the web-browse skill. Do NOT use for simple URL fetching (use WebFetch tool instead).",
  "thinkbrowse-mcp":
    "Control browsers via ThinkBrowse MCP tools — navigate pages, interact with elements, extract content, take screenshots. Use ONLY when the user explicitly references the thinkbrowse/thinkrun MCP server or its MCP tools. For general browse, scrape, or automation asks that don't name MCP, prefer the web-browse skill. Do NOT use for simple URL fetching (use WebFetch tool instead).",
  "ux-audit":
    "Walk through a product UI as a real user — take screenshots, find broken flows, and produce a structured report with every fix listed. Use when: audit the UI or UX, do a UX review, QA a feature, check if something looks right, verify a user flow or onboarding, walk through a journey, 'is X broken?', 'check how X works', 'verify the feature we shipped'. Do NOT use for: fixing a specific known bug, reading a component's code, deploying, writing tests, or answering questions about code structure.",
  "web-browse":
    "Browse the web programmatically with ThinkRun — drive a real or cloud browser to navigate, interact, extract, and screenshot, from the CLI or any MCP client. Use when: visit or open a URL, check a webpage, interact with a browser, verify something works live, take screenshots of a page, scrape or extract content, automate a browser task. Do NOT use for structured UX audits with scoring and fix reports — use ux-audit for that.",
};

type Row = { id: number; fixture: string; query: string; should_trigger: boolean };

async function loadRows(): Promise<Row[]> {
  const rows: Row[] = [];
  let id = 0;
  for (const f of readdirSync(FIXDIR).sort()) {
    const fixture = f.replace(/\.json$/, "");
    const items = await Bun.file(`${FIXDIR}/${f}`).json();
    for (const it of items) rows.push({ id: ++id, fixture, query: it.query, should_trigger: it.should_trigger });
  }
  return rows;
}

const cmd = process.argv[2];

if (cmd === "build") {
  const rows = await loadRows();
  const skills = Object.entries(CATALOG)
    .map(([n, d]) => `- ${n}: ${d}`)
    .join("\n");
  const messages = rows.map((r) => `${r.id}. ${r.query}`).join("\n");
  const prompt = `You are the skill-routing layer of an AI coding agent (like Claude Code or Codex CLI). The agent has exactly these skills installed:

${skills}

The agent also has generic built-in tools (read/write files, run shell commands, a simple WebFetch for plain HTTP GETs, web search). For each numbered user message below, decide which ONE skill you would invoke first to handle it, or "none" if no installed skill applies (because the request is better served by generic tools or plain knowledge).

Respond with STRICT JSON only — a single array, one entry per message, no prose, no markdown fences:
[{"id": 1, "skill": "web-browse"}, {"id": 2, "skill": "none"}, ...]

User messages:
${messages}`;
  await Bun.write(`${BASE}/prompt.txt`, prompt);
  await Bun.write(`${BASE}/manifest.json`, JSON.stringify(rows, null, 1));
  console.log(`built: ${rows.length} queries, prompt ${prompt.length} chars`);
} else if (cmd === "grade") {
  const [config, rawFile] = [process.argv[3], process.argv[4]];
  const rows: Row[] = await Bun.file(`${BASE}/manifest.json`).json();
  const raw = await Bun.file(rawFile).text();
  const m = raw.match(/\[\s*\{[\s\S]*\}\s*\]/g);
  if (!m) throw new Error(`no JSON array found in ${rawFile}`);
  const answers: { id: number; skill: string }[] = JSON.parse(m[m.length - 1]);
  const byId = new Map(answers.map((a) => [a.id, (a.skill || "none").trim()]));
  const perFixture: Record<string, { pass: number; total: number; fails: any[] }> = {};
  for (const r of rows) {
    const got = byId.get(r.id) ?? "MISSING";
    const pass = r.should_trigger ? got === r.fixture : got !== r.fixture;
    const pf = (perFixture[r.fixture] ??= { pass: 0, total: 0, fails: [] });
    pf.total++;
    if (pass) pf.pass++;
    else pf.fails.push({ id: r.id, expected: r.should_trigger ? r.fixture : `NOT ${r.fixture}`, got, q: r.query.slice(0, 70) });
  }
  const overall = Object.values(perFixture).reduce((a, p) => a + p.pass, 0);
  const total = rows.length;
  const out = { config, overall: `${overall}/${total}`, pct: +((overall / total) * 100).toFixed(1), perFixture };
  await Bun.write(`${BASE}/results/${config}.json`, JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ config, overall: out.overall, pct: out.pct, perFixture: Object.fromEntries(Object.entries(perFixture).map(([k, v]) => [k, `${v.pass}/${v.total}`])) }));
} else {
  console.log("usage: build | grade <config> <rawfile>");
}

// ---- Ablation variants ----
// build-variant <name>: writes prompt-<name>.txt + manifest-<name>.json
// grade-variant <name> <config> <rawfile>: grades with absorption expectations.
const VARIANTS: Record<string, { exclude: string[]; absorb: Record<string, string[]> }> = {
  "no-web-browse": { exclude: ["web-browse"], absorb: { "web-browse": ["thinkbrowse-cli", "thinkbrowse-mcp"] } },
  "no-cli-mcp": { exclude: ["thinkbrowse-cli", "thinkbrowse-mcp"], absorb: { "thinkbrowse-cli": ["web-browse"], "thinkbrowse-mcp": ["web-browse"] } },
};

if (cmd === "build-variant") {
  const v = VARIANTS[process.argv[3]];
  const rows = await loadRows();
  const skills = Object.entries(CATALOG)
    .filter(([n]) => !v.exclude.includes(n))
    .map(([n, d]) => `- ${n}: ${d}`)
    .join("\n");
  const messages = rows.map((r) => `${r.id}. ${r.query}`).join("\n");
  const prompt = `You are the skill-routing layer of an AI coding agent (like Claude Code or Codex CLI). The agent has exactly these skills installed:

${skills}

The agent also has generic built-in tools (read/write files, run shell commands, a simple WebFetch for plain HTTP GETs, web search). For each numbered user message below, decide which ONE skill you would invoke first to handle it, or "none" if no installed skill applies (because the request is better served by generic tools or plain knowledge).

Respond with STRICT JSON only — a single array, one entry per message, no prose, no markdown fences:
[{"id": 1, "skill": "web-browse"}, {"id": 2, "skill": "none"}, ...]

User messages:
${messages}`;
  await Bun.write(`${BASE}/prompt-${process.argv[3]}.txt`, prompt);
  console.log(`built variant ${process.argv[3]}: prompt ${prompt.length} chars`);
} else if (cmd === "grade-variant") {
  const vname = process.argv[3];
  const v = VARIANTS[vname];
  const [config, rawFile] = [process.argv[4], process.argv[5]];
  const rows: Row[] = await Bun.file(`${BASE}/manifest.json`).json();
  const raw = await Bun.file(rawFile).text();
  const m = raw.match(/\[\s*\{[\s\S]*\}\s*\]/g);
  if (!m) throw new Error(`no JSON array found in ${rawFile}`);
  const answers: { id: number; skill: string }[] = JSON.parse(m[m.length - 1]);
  const byId = new Map(answers.map((a) => [a.id, (a.skill || "none").trim()]));
  const perFixture: Record<string, { pass: number; total: number; fails: any[] }> = {};
  for (const r of rows) {
    const got = byId.get(r.id) ?? "MISSING";
    const acceptable = v.absorb[r.fixture] ?? [r.fixture];
    const pass = r.should_trigger ? acceptable.includes(got) : !acceptable.includes(got);
    const pf = (perFixture[r.fixture] ??= { pass: 0, total: 0, fails: [] });
    pf.total++;
    if (pass) pf.pass++;
    else pf.fails.push({ id: r.id, expected: r.should_trigger ? acceptable.join("|") : `NOT ${acceptable.join("|")}`, got, q: r.query.slice(0, 70) });
  }
  const overall = Object.values(perFixture).reduce((a, p) => a + p.pass, 0);
  const out = { variant: vname, config, overall: `${overall}/${rows.length}`, pct: +((overall / rows.length) * 100).toFixed(1), perFixture };
  await Bun.write(`${BASE}/results/${vname}--${config}.json`, JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ variant: vname, config, overall: out.overall, perFixture: Object.fromEntries(Object.entries(perFixture).map(([k, x]) => [k, `${x.pass}/${x.total}`])) }));
}
