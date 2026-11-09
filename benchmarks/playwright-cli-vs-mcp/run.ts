// Playwright CLI vs MCP benchmark runner. One fresh fixture, browser session and temp workspace per run.
// Usage: bun run.ts smoke | bun run.ts batch
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, appendFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { cartMatches } from "./cart-check"; // added after publication; see cart-check.ts

const HERE = dirname(new URL(import.meta.url).pathname);
const CLI_BIN = join(HERE, "cli/node_modules/.bin");
const CLI_SKILL = join(HERE, "cli/node_modules/playwright-core/lib/tools/skills/playwright-cli");
const MODEL = process.env.BENCH_MODEL ?? "claude-sonnet-5-5"; // published runs: claude-sonnet-5-5
const EFFORT = process.env.BENCH_EFFORT ?? "medium"; // published runs: medium
const MCP_VERSION = "0.0.84";
const OPEN = process.argv[2] === "cliopen";
const RESULTS = join(HERE, OPEN ? "results-cli-open-bash.jsonl" : "results.jsonl");
const REPLY_ONE = `Then reply with only this JSON: {"items": [{"product": "<product name>", "quantity": <quantity>}], "total": "<cart total>"}`;
const LONG: [string, number][] = [["Lantern", 1], ["Backpack", 2], ["Kettle", 1], ["Notebook", 3], ["Speaker", 1], ["Thermos", 2], ["Headset", 1], ["Keyboard", 2]];
const TASKS: Record<string, { products: number; plan: [string, number][]; prompt: (u: string) => string }> = {
  simple: { products: 20, plan: [["liquid", 2]], prompt: (u) => `Open ${u} in the browser. Search for "liquid". Open the first result. Set the quantity to 2 and add it to the cart. Open the cart and check the total. ${REPLY_ONE}` },
  dense: { products: 400, plan: [["liquid", 2]], prompt: (u) => `Open ${u} in the browser. Search for "liquid". Open the first result. Set the quantity to 2 and add it to the cart. Open the cart and check the total. ${REPLY_ONE}` },
  long: { products: 400, plan: LONG, prompt: (u) => `Open ${u} in the browser. For each item below, go back to the home page, use the search box to search for its term, open the first result, set the quantity and add it to the cart, in this order: ${LONG.map(([q, n]) => `"${q}" quantity ${n}`).join(", ")}. Add each item exactly once. Then open the cart and check the total. ${REPLY_ONE}` },
};

async function runOne(arm: "mcp" | "cli", task: string, run: number | string) {
  const t = TASKS[task];
  const fixture = Bun.spawn(["bun", join(HERE, "fixture.ts")], { stdout: "pipe", stderr: "ignore", env: { ...process.env, PRODUCTS: String(t.products), PLAN: JSON.stringify(t.plan) } });
  const { value } = await fixture.stdout.getReader().read();
  const { port, expected } = JSON.parse(new TextDecoder().decode(value));
  const cwd = mkdtempSync(join(tmpdir(), `pw-bench-${arm}-`));
  const session = `b${Date.now()}`;
  const env: Record<string, string | undefined> = { ...process.env, DISABLE_AUTOUPDATER: "1", PLAYWRIGHT_CLI_SESSION: session };
  const flags = ["--model", MODEL, "--effort", EFFORT, "--output-format", "stream-json", "--verbose", "--no-session-persistence", "--setting-sources", "project", "--strict-mcp-config"];
  if (arm === "mcp") {
    const cfg = join(cwd, "mcp.json");
    writeFileSync(cfg, JSON.stringify({ mcpServers: { playwright: { command: "npx", args: ["-y", `@playwright/mcp@${MCP_VERSION}`, "--headless", "--isolated", "--browser", "chrome", "--output-dir", join(cwd, "out")] } } }));
    flags.push("--mcp-config", cfg, "--tools", "", "--allowedTools", "mcp__playwright");
  } else {
    env.PATH = `${CLI_BIN}:${process.env.PATH}`;
    mkdirSync(join(cwd, ".claude/skills"), { recursive: true });
    cpSync(CLI_SKILL, join(cwd, ".claude/skills/playwright-cli"), { recursive: true });
    mkdirSync(join(cwd, ".playwright"), { recursive: true });
    writeFileSync(join(cwd, ".playwright/cli.config.json"), JSON.stringify({ browser: { browserName: "chromium", launchOptions: { channel: "chrome", headless: true } } }));
    flags.push("--tools", "Bash,Read,Grep,Skill", "--allowedTools", OPEN ? "Bash,Read,Grep,Skill" : "Bash(playwright-cli:*),Bash(grep:*),Bash(head:*),Bash(tail:*),Bash(cat:*),Bash(wc:*),Bash(ls:*),Read,Grep,Skill");
  }
  const started = Date.now();
  const proc = Bun.spawn(["claude", "-p", t.prompt(`http://127.0.0.1:${port}/`), ...flags], { cwd, env, stdout: "pipe", stderr: "pipe" });
  let timedOut = false;
  const killer = setTimeout(() => { timedOut = true; proc.kill(); }, 900_000);
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exit = await proc.exited;
  clearTimeout(killer);
  const wallMs = Date.now() - started;
  const events = stdout.split("\n").filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
  const result = events.findLast((e) => e.type === "result");
  const turns = new Map<string, any>();
  for (const e of events) if (e.type === "assistant" && e.message?.usage) turns.set(e.message.id, e.message.usage);
  const ctx = (u: any) => (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
  const contexts = [...turns.values()].map(ctx);
  const uses = events.filter((e) => e.type === "assistant").flatMap((e) => e.message.content ?? []).filter((c: any) => c.type === "tool_use");
  const skillUsed = uses.some((c: any) => c.name === "Skill");
  const state = await (await fetch(`http://127.0.0.1:${port}/__state`)).json();
  let answer: any = null;
  try { answer = JSON.parse(String(result?.result ?? "").match(/\{[\s\S]*\}/)?.[0] ?? "null"); } catch {}
  const answerOk = !!answer && answer.total === expected.total && JSON.stringify(answer.items) === JSON.stringify(expected.items);
  const success = answerOk && state.addEvents === expected.adds && cartMatches(state.cart, expected.items);
  const rec = { at: new Date().toISOString(), arm, task, run, exit, timedOut, success, answerOk, adds: state.addEvents, expectedAdds: expected.adds, cart: state.cart, expected, answer, wallMs, apiMs: result?.duration_api_ms, turns: turns.size, toolCalls: uses.length, tools: uses.map((c: any) => c.name === "Bash" ? `Bash:${String(c.input?.command).split(" ").slice(0, 2).join(" ")}` : c.name), skillUsed, firstContext: contexts[0] ?? 0, finalContext: contexts.at(-1) ?? 0, peakContext: Math.max(0, ...contexts), inputAll: result?.usage ? ctx(result.usage) : null, output: result?.usage?.output_tokens ?? null, costUsd: result?.total_cost_usd ?? null, costBasis: result?.modelUsage?.[MODEL]?.costBasis, denials: result?.permission_denials?.length ?? 0, subtype: result?.subtype, stderr: stderr.slice(0, 300) };
  appendFileSync(RESULTS, JSON.stringify(rec) + "\n");
  mkdirSync(join(HERE, "events"), { recursive: true });
  await Bun.write(join(HERE, `events/${OPEN ? "open-" : ""}${arm}-${task}-${run}.jsonl`), stdout);
  if (arm === "cli") { const c = Bun.spawn(["playwright-cli", "close-all"], { cwd, env, stdout: "ignore", stderr: "ignore" }); await c.exited; }
  fixture.kill();
  console.log(`${task} ${arm} #${run} success=${success} ${Math.round(wallMs / 1000)}s turns=${rec.turns} tools=${rec.toolCalls} final=${rec.finalContext} $${rec.costUsd} adds=${rec.adds} denials=${rec.denials} skill=${skillUsed}`);
}

const mode = process.argv[2];
if (mode === "smoke") await runOne("cli", "simple", "smoke");
else if (mode === "cliopen") {
  for (let run = 1; run <= 5; run++) for (const task of Object.keys(TASKS)) await runOne("cli", task, run);
} else if (mode === "batch") {
  const done = existsSync(RESULTS) ? readFileSync(RESULTS, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => typeof r.run === "number").map((r) => `${r.arm}-${r.task}-${r.run}`) : [];
  for (let run = 1; run <= 5; run++) for (const task of Object.keys(TASKS)) {
    const order: ("mcp" | "cli")[] = (run + Object.keys(TASKS).indexOf(task)) % 2 ? ["cli", "mcp"] : ["mcp", "cli"];
    for (const arm of order) if (!done.includes(`${arm}-${task}-${run}`)) await runOne(arm, task, run);
  }
}
