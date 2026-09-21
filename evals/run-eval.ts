// Trigger-eval harness: skill-routing judgment across models.
//
// Usage:
//   bun run-eval.ts build                                  -> prompt.txt (+ manifest.json, informational)
//   bun run-eval.ts build-variant <name>                   -> prompt-<name>.txt
//   bun run-eval.ts grade <config> <rawfile>               -> results/<config>.json
//   bun run-eval.ts grade-variant <name> <config> <rawfile>-> results/<name>--<config>.json
//
// Grading always derives expectations directly from the fixture files (sorted,
// deterministic ids), so grade runs never depend on a previously written manifest.
import { readdirSync, readFileSync, existsSync } from "node:fs";

const BASE = import.meta.dir;
// Fixtures live per-skill next to each SKILL.md; the .claude mirror is canonical.
const SKILLS_DIR = `${BASE}/../.claude/skills`;

// The catalog is the live frontmatter of each .claude/skills/<name>/SKILL.md —
// never a copy. A copy here would let the eval measure text that no longer
// ships (it did, until 2026-09-18).
import { parseFrontmatter } from "../scripts/check-skills";

function loadCatalog(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of readdirSync(SKILLS_DIR).sort()) {
    const path = `${SKILLS_DIR}/${name}/SKILL.md`;
    if (!existsSync(path)) continue;
    const fm = parseFrontmatter(readFileSync(path, "utf8"));
    if (!fm?.description) throw new Error(`${path}: no description in frontmatter`);
    out[name] = fm.description;
  }
  return out;
}
const CATALOG = loadCatalog();

// Catalog ablations: `exclude` removes skills from the prompt; `absorb` maps a
// removed skill's fixture to the sibling(s) expected to take over its traffic.
// An EMPTY absorb list means the skill is a gap, not a duplicate: its positives
// must route to "none" (no sibling over-captures) and its negatives must not
// name the removed skill (no hallucinated routing).
const VARIANTS: Record<string, { exclude: string[]; absorb: Record<string, string[]> }> = {
  "no-web-browse": { exclude: ["web-browse"], absorb: { "web-browse": ["thinkbrowse-cli", "thinkbrowse-mcp"] } },
  "no-cli-mcp": { exclude: ["thinkbrowse-cli", "thinkbrowse-mcp"], absorb: { "thinkbrowse-cli": ["web-browse"], "thinkbrowse-mcp": ["web-browse"] } },
  "no-prove-it": { exclude: ["prove-it"], absorb: { "prove-it": [] } },
  "no-before-after": { exclude: ["before-after"], absorb: { "before-after": ["prove-it", "web-browse"] } },
};

type Row = { id: number; fixture: string; query: string; should_trigger: boolean };

async function loadRows(): Promise<Row[]> {
  const rows: Row[] = [];
  let id = 0;
  for (const fixture of readdirSync(SKILLS_DIR).sort()) {
    const file = Bun.file(`${SKILLS_DIR}/${fixture}/evals/trigger-eval.json`);
    if (!(await file.exists())) continue;
    const items = await file.json();
    for (const it of items) rows.push({ id: ++id, fixture, query: it.query, should_trigger: it.should_trigger });
  }
  return rows;
}

function buildPrompt(rows: Row[], exclude: string[] = []): string {
  const skills = Object.entries(CATALOG)
    .filter(([n]) => !exclude.includes(n))
    .map(([n, d]) => `- ${n}: ${d}`)
    .join("\n");
  const messages = rows.map((r) => `${r.id}. ${r.query}`).join("\n");
  return `You are the skill-routing layer of an AI coding agent (like Claude Code or Codex CLI). The agent has exactly these skills installed:

${skills}

The agent also has generic built-in tools (read/write files, run shell commands, a simple WebFetch for plain HTTP GETs, web search). For each numbered user message below, decide which ONE skill you would invoke first to handle it, or "none" if no installed skill applies (because the request is better served by generic tools or plain knowledge).

Respond with STRICT JSON only — a single array, one entry per message, no prose, no markdown fences:
[{"id": 1, "skill": "web-browse"}, {"id": 2, "skill": "none"}, ...]

User messages:
${messages}`;
}

async function grade(rows: Row[], rawFile: string, absorb: Record<string, string[]>, outName: string, meta: Record<string, string>) {
  const raw = await Bun.file(rawFile).text();
  const m = raw.match(/\[\s*\{[\s\S]*\}\s*\]/g);
  if (!m) throw new Error(`no JSON array found in ${rawFile}`);
  const answers: { id: number; skill: string }[] = JSON.parse(m[m.length - 1]);
  const byId = new Map(answers.map((a) => [a.id, (a.skill || "none").trim()]));
  const perFixture: Record<string, { pass: number; total: number; fails: any[] }> = {};
  for (const r of rows) {
    const got = byId.get(r.id) ?? "MISSING";
    const absorbers = absorb[r.fixture];
    const isGap = Array.isArray(absorbers) && absorbers.length === 0;
    const acceptable = isGap ? ["none"] : (absorbers ?? [r.fixture]);
    // Negatives must avoid the absorbing siblings AND the original fixture skill —
    // answering a skill that isn't in the ablated catalog is a hallucination, not a pass.
    // For a gap skill the only forbidden answer on a negative is the removed skill itself.
    const forbidden = isGap ? [r.fixture] : absorbers ? [...acceptable, r.fixture] : acceptable;
    const pass = r.should_trigger ? acceptable.includes(got) : !forbidden.includes(got);
    const pf = (perFixture[r.fixture] ??= { pass: 0, total: 0, fails: [] });
    pf.total++;
    if (pass) pf.pass++;
    else pf.fails.push({ id: r.id, expected: r.should_trigger ? acceptable.join("|") : `NOT ${forbidden.join("|")}`, got, q: r.query.slice(0, 70) });
  }
  const overall = Object.values(perFixture).reduce((a, p) => a + p.pass, 0);
  const out = { ...meta, overall: `${overall}/${rows.length}`, pct: +((overall / rows.length) * 100).toFixed(1), perFixture };
  await Bun.write(`${BASE}/results/${outName}.json`, JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ ...meta, overall: out.overall, perFixture: Object.fromEntries(Object.entries(perFixture).map(([k, v]) => [k, `${v.pass}/${v.total}`])) }));
}

const cmd = process.argv[2];
const rows = await loadRows();

if (cmd === "build") {
  const prompt = buildPrompt(rows);
  await Bun.write(`${BASE}/prompt.txt`, prompt);
  await Bun.write(`${BASE}/manifest.json`, JSON.stringify(rows, null, 1));
  console.log(`built: ${rows.length} queries, prompt ${prompt.length} chars`);
} else if (cmd === "build-variant") {
  const v = VARIANTS[process.argv[3]];
  if (!v) throw new Error(`unknown variant: ${process.argv[3]} (have: ${Object.keys(VARIANTS).join(", ")})`);
  const prompt = buildPrompt(rows, v.exclude);
  await Bun.write(`${BASE}/prompt-${process.argv[3]}.txt`, prompt);
  console.log(`built variant ${process.argv[3]}: prompt ${prompt.length} chars`);
} else if (cmd === "grade") {
  const [config, rawFile] = [process.argv[3], process.argv[4]];
  await grade(rows, rawFile, {}, config, { config });
} else if (cmd === "grade-variant") {
  const vname = process.argv[3];
  const v = VARIANTS[vname];
  if (!v) throw new Error(`unknown variant: ${vname} (have: ${Object.keys(VARIANTS).join(", ")})`);
  const [config, rawFile] = [process.argv[4], process.argv[5]];
  await grade(rows, rawFile, v.absorb, `${vname}--${config}`, { variant: vname, config });
} else {
  console.log("usage: build | build-variant <name> | grade <config> <rawfile> | grade-variant <name> <config> <rawfile>");
}
