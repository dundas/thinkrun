// Playwright CLI vs MCP benchmark runner. One fresh fixture, browser session and temp workspace per run.
// Follow-up tests. Usage: bun run-followup.ts smoke-stepwise | smoke-mcpshell | stepwise | mcpshell | stepwise-mcpshell
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, appendFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

const HERE = dirname(new URL(import.meta.url).pathname);
const CLI_BIN = join(HERE, "cli/node_modules/.bin");
const CLI_SKILL = join(HERE, "cli/node_modules/playwright-core/lib/tools/skills/playwright-cli");
const MODEL = "claude-sonnet-5-5";
const EFFORT = "medium";
const MCP_VERSION = "0.0.84";
const OPEN = true;
const MODE = process.argv[2];
const MCP_SHELL = MODE === "mcpshell" || MODE === "smoke-mcpshell" || MODE === "stepwise-mcpshell";
const RESULTS = join(HERE, "results-followup-claude.jsonl");
const REPLY_ONE = `Then reply with only this JSON: {"items": [{"product": "<product name>", "quantity": <quantity>}], "total": "<cart total>"}`;
const STEP = "Work one browser action at a time: make each navigation, search, click, fill and add to cart its own separate tool call, and read the result before choosing the next action. Don't write scripts or loops, don't chain browser commands together, and don't run code in the page.";
const scrub = (c: string) => c.replace(/\/(private|var|Users|tmp)[^\s"']*/g, "<path>").slice(0, 400);
const isScript = (c: string) => /run-code|\b(for|while)\b.*\bdo\b|playwright-cli[^|]*(&&|;)[^|]*playwright-cli|\.(sh|js|mjs|ts|py)\b|\b(node|python3?|bun)\s/.test(c);
const LONG: [string, number][] = [["Lantern", 1], ["Backpack", 2], ["Kettle", 1], ["Notebook", 3], ["Speaker", 1], ["Thermos", 2], ["Headset", 1], ["Keyboard", 2]];
const TASKS: Record<string, { products: number; plan: [string, number][]; prompt: (u: string) => string }> = {
  simple: { products: 20, plan: [["liquid", 2]], prompt: (u) => `Open ${u} in the browser. Search for "liquid". Open the first result. Set the quantity to 2 and add it to the cart. Open the cart and check the total. ${REPLY_ONE}` },
  dense: { products: 400, plan: [["liquid", 2]], prompt: (u) => `Open ${u} in the browser. Search for "liquid". Open the first result. Set the quantity to 2 and add it to the cart. Open the cart and check the total. ${REPLY_ONE}` },
  long: { products: 400, plan: LONG, prompt: (u) => `Open ${u} in the browser. For each item below, go back to the home page, use the search box to search for its term, open the first result, set the quantity and add it to the cart, in this order: ${LONG.map(([q, n]) => `"${q}" quantity ${n}`).join(", ")}. Add each item exactly once. Then open the cart and check the total. ${REPLY_ONE}` },
  stepwise: { products: 400, plan: LONG, prompt: (u) => TASKS.long.prompt(u).replace(REPLY_ONE, `${STEP} ${REPLY_ONE}`) },
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
    flags.push("--mcp-config", cfg, "--tools", MCP_SHELL ? "Bash,Read,Grep" : "", "--allowedTools", MCP_SHELL ? "mcp__playwright,Bash,Read,Grep" : "mcp__playwright");
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
  const success = answerOk && state.addEvents === expected.adds && state.nonBrowserRequests === 0;
  const sum = (k: string) => [...turns.values()].reduce((n, u) => n + (u[k] ?? 0), 0);
  const commands = uses.map((u: any) => u.name === "Bash" ? scrub(String(u.input?.command)) : u.name);
  const scriptCalls = uses.filter((u: any) => /browser_run_code/.test(u.name) || (u.name === "Bash" && isScript(String(u.input?.command)))).length;
  const rec = { at: new Date().toISOString(), variant: MODE, mcpShell: MCP_SHELL, nonBrowserRequests: state.nonBrowserRequests, cacheRead: sum("cache_read_input_tokens"), cacheWrite: sum("cache_creation_input_tokens"), uncachedInput: sum("input_tokens"), scriptCalls, commands, arm, task, run, exit, timedOut, success, answerOk, adds: state.addEvents, expectedAdds: expected.adds, cart: state.cart, expected, answer, wallMs, apiMs: result?.duration_api_ms, turns: turns.size, toolCalls: uses.length, tools: uses.map((c: any) => c.name === "Bash" ? `Bash:${String(c.input?.command).split(" ").slice(0, 2).join(" ")}` : c.name), skillUsed, firstContext: contexts[0] ?? 0, finalContext: contexts.at(-1) ?? 0, peakContext: Math.max(0, ...contexts), inputAll: result?.usage ? ctx(result.usage) : null, output: result?.usage?.output_tokens ?? null, costUsd: result?.total_cost_usd ?? null, costBasis: result?.modelUsage?.[MODEL]?.costBasis, denials: result?.permission_denials?.length ?? 0, subtype: result?.subtype, stderr: stderr.slice(0, 300) };
  appendFileSync(RESULTS, JSON.stringify(rec) + "\n");
  mkdirSync(join(HERE, "events"), { recursive: true });
  await Bun.write(join(HERE, `events/followup-${MODE}-${arm}-${task}-${run}.jsonl`), stdout);
  if (arm === "cli") { const c = Bun.spawn(["playwright-cli", "close-all"], { cwd, env, stdout: "ignore", stderr: "ignore" }); await c.exited; }
  fixture.kill();
  console.log(`${task} ${arm} #${run} success=${success} ${Math.round(wallMs / 1000)}s turns=${rec.turns} tools=${rec.toolCalls} final=${rec.finalContext} $${rec.costUsd} adds=${rec.adds} denials=${rec.denials} skill=${skillUsed}`);
}

const ORDER = (i: number): ("mcp" | "cli")[] => i % 2 ? ["cli", "mcp"] : ["mcp", "cli"];
const done = existsSync(RESULTS) ? readFileSync(RESULTS, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).map((r) => `${r.variant}-${r.arm}-${r.task}-${r.run}`) : [];
const go = async (arm: "mcp" | "cli", task: string, run: number | string) => { if (!done.includes(`${MODE}-${arm}-${task}-${run}`)) await runOne(arm, task, run); };
if (MODE === "smoke-stepwise") await go("cli", "stepwise", "smoke");
else if (MODE === "smoke-mcpshell") await go("mcp", "simple", "smoke");
else if (MODE === "stepwise") { for (let run = 1; run <= 5; run++) for (const arm of ORDER(run)) await go(arm, "stepwise", run); }
else if (MODE === "mcpshell") { for (let run = 1; run <= 5; run++) for (const task of ["simple", "dense", "long"]) await go("mcp", task, run); }
else if (MODE === "stepwise-mcpshell") { for (let run = 1; run <= 5; run++) await go("mcp", "stepwise", run); }
else throw new Error("mode must be smoke-stepwise, smoke-mcpshell, stepwise, mcpshell or stepwise-mcpshell");
