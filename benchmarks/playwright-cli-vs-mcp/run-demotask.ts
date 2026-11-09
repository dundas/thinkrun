// Runs the task from Playwright's "Playwright CLI vs MCP" demo on the live docs site, with all setups interleaved.
// Usage: bun run-demotask.ts claude smoke|batch
//        CODEX_CLI_FULL_ACCESS=1 bun run-demotask.ts gpt-6-luna|gpt-6.1-sol smoke|batch
// The prompt is written from the video's narration, plus a reply format so each run can be scored.
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, appendFileSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, dirname, extname } from "node:path";
import { disabledSkills } from "./codex-flags.ts";

const HERE = dirname(new URL(import.meta.url).pathname);
const WHO = process.argv[2], MODE = process.argv[3];
const CLAUDE = WHO === "claude";
const CLI_BIN = join(HERE, "cli/node_modules/.bin");
const CLI_SKILL = join(HERE, "cli/node_modules/playwright-core/lib/tools/skills/playwright-cli");
const MCP_VERSION = "0.0.84";
if (!["claude", "gpt-6-luna", "gpt-6.1-sol"].includes(WHO) || !["smoke", "batch"].includes(MODE)) throw new Error("usage: bun run-demotask.ts <claude|gpt-6-luna|gpt-6.1-sol> <smoke|batch>");
if (!CLAUDE && process.env.CODEX_CLI_FULL_ACCESS !== "1") throw new Error("Set CODEX_CLI_FULL_ACCESS=1: the Codex CLI arm can't start Chrome inside the sandbox");
const RESULTS = join(HERE, `results-demotask-${WHO}.jsonl`);
const PROMPT = `Open https://playwright.dev. Search for locators and check that the doc is available for each language: JavaScript, Python, Java and .NET. Take a screenshot of the doc for each language and save it as a file. Then reply with only this JSON: {"languages": [{"language": "<language>", "url": "<doc url>", "available": <true or false>, "screenshot": "<file name>"}]}`;
const WANT = [/^https:\/\/playwright\.dev\/docs\/locators\/?(#.*)?$/, /^https:\/\/playwright\.dev\/python\/docs\/locators\/?(#.*)?$/, /^https:\/\/playwright\.dev\/java\/docs\/locators\/?(#.*)?$/, /^https:\/\/playwright\.dev\/dotnet\/docs\/locators\/?(#.*)?$/];
const scrub = (c: string) => c.replace(/\/(private|var|Users|tmp)[^\s"']*/g, "<path>").slice(0, 400);
const isScript = (c: string) => /run-code|\b(for|while)\b.*\bdo\b|playwright-cli[^|]*(&&|;)[^|]*playwright-cli|\.(sh|js|mjs|ts|py)\b|\b(node|python3?|bun)\s/.test(c);
const isFetch = (c: string) => /\b(curl|wget)\b/.test(c);
const images = (dir: string): string[] => readdirSync(dir).flatMap((n) => { if ([".claude", ".agents", ".zdot", "node_modules"].includes(n)) return []; const p = join(dir, n); return statSync(p).isDirectory() ? images(p) : [".png", ".jpg", ".jpeg"].includes(extname(n).toLowerCase()) ? [p] : []; });
const parse = (text: string) => { try { return JSON.parse(String(text ?? "").match(/\{[\s\S]*\}/)?.[0] ?? "null"); } catch { return null; } };

function score(cwd: string, answer: any, cmds: string[]) {
  const langs = Array.isArray(answer?.languages) ? answer.languages : [];
  const urlsOk = WANT.every((re) => langs.some((l: any) => re.test(String(l.url)) && l.available === true));
  const files = images(cwd);
  const distinctShots = new Set(files.map((f) => createHash("sha256").update(readFileSync(f)).digest("hex"))).size;
  const fetched = cmds.filter(isFetch).length;
  return { urlsOk, shots: files.length, distinctShots, fetched, success: urlsOk && distinctShots >= 4 && fetched === 0, files };
}
function keep(files: string[], arm: string, run: number | string) { const to = join(HERE, "demotask-shots", `${WHO}-${arm}-${run}`); mkdirSync(to, { recursive: true }); for (const f of files) cpSync(f, join(to, f.split("/").pop()!)); }

function workspace(arm: string) {
  const cwd = mkdtempSync(join(tmpdir(), `pw-demo-${arm}-`));
  const env: Record<string, string | undefined> = { ...process.env, DISABLE_AUTOUPDATER: "1", PLAYWRIGHT_CLI_SESSION: `d${Date.now()}` };
  if (arm === "cli") {
    env.PATH = `${CLI_BIN}:${process.env.PATH}`;
    mkdirSync(join(cwd, CLAUDE ? ".claude/skills" : ".agents/skills"), { recursive: true });
    cpSync(CLI_SKILL, join(cwd, CLAUDE ? ".claude/skills/playwright-cli" : ".agents/skills/playwright-cli"), { recursive: true });
    mkdirSync(join(cwd, ".playwright"), { recursive: true });
    writeFileSync(join(cwd, ".playwright/cli.config.json"), JSON.stringify({ browser: { browserName: "chromium", launchOptions: { channel: "chrome", headless: true } } }));
  }
  return { cwd, env };
}
const mcpArgs = (cwd: string) => ["-y", `@playwright/mcp@${MCP_VERSION}`, "--headless", "--isolated", "--browser", "chrome", "--output-dir", join(cwd, "out")];

async function collect(proc: any) {
  let timedOut = false; const killer = setTimeout(() => { timedOut = true; proc.kill(); }, 900_000);
  const stdout = await new Response(proc.stdout).text(), stderr = await new Response(proc.stderr).text(), exit = await proc.exited; clearTimeout(killer);
  return { stdout, stderr, exit, timedOut, events: stdout.split("\n").filter(Boolean).flatMap((l: string) => { try { return [JSON.parse(l)]; } catch { return []; } }) };
}

async function runClaude(arm: string, run: number | string) {
  const { cwd, env } = workspace(arm);
  const flags = ["--model", process.env.BENCH_MODEL ?? "claude-sonnet-5-5", "--effort", process.env.BENCH_EFFORT ?? "medium", "--output-format", "stream-json", "--verbose", "--no-session-persistence", "--setting-sources", "project", "--strict-mcp-config"];
  if (arm === "cli") flags.push("--tools", "Bash,Read,Grep,Skill", "--allowedTools", "Bash,Read,Grep,Skill");
  else { const cfg = join(cwd, "mcp.json"); writeFileSync(cfg, JSON.stringify({ mcpServers: { playwright: { command: "npx", args: mcpArgs(cwd) } } })); const shell = arm === "mcp-shell"; flags.push("--mcp-config", cfg, "--tools", shell ? "Bash,Read,Grep" : "", "--allowedTools", shell ? "mcp__playwright,Bash,Read,Grep" : "mcp__playwright"); }
  const started = Date.now();
  const r = await collect(Bun.spawn(["claude", "-p", PROMPT, ...flags], { cwd, env, stdout: "pipe", stderr: "pipe" }));
  const result = r.events.findLast((e: any) => e.type === "result");
  const turns = new Map<string, any>(); for (const e of r.events) if (e.type === "assistant" && e.message?.usage) turns.set(e.message.id, e.message.usage);
  const ctx = (u: any) => (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
  const contexts = [...turns.values()].map(ctx); const sum = (k: string) => [...turns.values()].reduce((n, u) => n + (u[k] ?? 0), 0);
  const uses = r.events.filter((e: any) => e.type === "assistant").flatMap((e: any) => e.message.content ?? []).filter((c: any) => c.type === "tool_use");
  const commands = uses.map((u: any) => u.name === "Bash" ? scrub(String(u.input?.command)) : u.name);
  const answer = parse(result?.result); const s = score(cwd, answer, commands); keep(s.files, arm, run);
  const rec = { at: new Date().toISOString(), who: WHO, arm, run, success: s.success, urlsOk: s.urlsOk, shots: s.shots, distinctShots: s.distinctShots, fetched: s.fetched, answer, inputAll: contexts.reduce((a, b) => a + b, 0), firstContext: contexts[0], finalContext: contexts.at(-1), cacheRead: sum("cache_read_input_tokens"), cacheWrite: sum("cache_creation_input_tokens"), uncachedInput: sum("input_tokens"), output: sum("output_tokens"), costUsd: result?.total_cost_usd, turns: turns.size, toolCalls: uses.length, scriptCalls: uses.filter((u: any) => /browser_run_code/.test(u.name) || (u.name === "Bash" && isScript(String(u.input?.command)))).length, commands, exit: r.exit, timedOut: r.timedOut, wallMs: Date.now() - started, finalText: answer ? undefined : String(result?.result ?? "").slice(0, 500), stderrTail: r.stderr.slice(-200) };
  return { rec, stdout: r.stdout, cwd, env };
}

async function runCodex(arm: string, run: number | string) {
  const { cwd, env } = workspace(arm);
  const off = ["browser_use", "browser_use_external", "computer_use", "apps", "plugins", "multi_agent", "image_generation"];
  const flags = ["exec", "--json", "--ephemeral", "--ignore-user-config", "--ignore-rules", "--skip-git-repo-check", "-m", WHO, "-c", "model_reasoning_effort=medium", "-c", 'web_search="disabled"', "-c", disabledSkills, "-c", `projects.${JSON.stringify(cwd)}.trust_level="trusted"`];
  mkdirSync(join(cwd, ".zdot"));
  if (arm === "cli") {
    writeFileSync(join(cwd, ".zdot/.zshenv"), `export PATH=${JSON.stringify(env.PATH)}\n`); off.push("shell_snapshot");
    flags.push("-c", "allow_login_shell=false", "-c", 'shell_environment_policy.inherit="all"', "-c", `shell_environment_policy.set.PATH=${JSON.stringify(env.PATH)}`, "-c", `shell_environment_policy.set.ZDOTDIR=${JSON.stringify(join(cwd, ".zdot"))}`, "--dangerously-bypass-approvals-and-sandbox");
  } else {
    if (arm === "mcp-shell") { off.push("shell_snapshot"); flags.push("-s", "workspace-write", "-c", 'approval_policy="never"', "-c", "allow_login_shell=false", "-c", 'shell_environment_policy.inherit="all"', "-c", `shell_environment_policy.set.ZDOTDIR=${JSON.stringify(join(cwd, ".zdot"))}`); }
    else { off.push("shell_tool", "unified_exec"); flags.push("-s", "read-only"); }
    flags.push("-c", 'mcp_servers.playwright.command="npx"', "-c", `mcp_servers.playwright.args=${JSON.stringify(mcpArgs(cwd))}`, "-c", 'mcp_servers.playwright.default_tools_approval_mode="approve"', "-c", "mcp_servers.playwright.startup_timeout_sec=60");
  }
  for (const f of off) flags.push("-c", `features.${f}=false`);
  const started = Date.now();
  const r = await collect(Bun.spawn(["codex", ...flags, PROMPT], { cwd, env, stdin: "ignore", stdout: "pipe", stderr: "pipe" }));
  const items = r.events.filter((e: any) => e.type === "item.completed").map((e: any) => e.item);
  const usage = r.events.findLast((e: any) => e.type === "turn.completed")?.usage ?? null;
  const calls = items.filter((i: any) => ["command_execution", "mcp_tool_call"].includes(i.type));
  const commands = calls.map((i: any) => i.type === "mcp_tool_call" ? String(i.tool) : scrub(String(i.command)));
  const answer = parse(items.findLast((i: any) => i.type === "agent_message")?.text); const s = score(cwd, answer, commands); keep(s.files, arm, run);
  const rec = { at: new Date().toISOString(), who: WHO, arm, run, success: s.success, urlsOk: s.urlsOk, shots: s.shots, distinctShots: s.distinctShots, fetched: s.fetched, answer, inputAll: usage?.input_tokens ?? null, cached: usage?.cached_input_tokens ?? null, output: usage?.output_tokens ?? null, toolCalls: calls.length, shellCalls: calls.filter((i: any) => i.type === "command_execution").length, scriptCalls: calls.filter((i: any) => i.type === "mcp_tool_call" ? /browser_run_code/.test(String(i.tool)) : isScript(String(i.command))).length, commands, exit: r.exit, timedOut: r.timedOut, wallMs: Date.now() - started, failed: r.events.filter((e: any) => e.type === "turn.failed" || e.type === "error").map((e: any) => e.message ?? e.error?.message).slice(0, 2), stderrTail: r.stderr.slice(-200) };
  return { rec, stdout: r.stdout, cwd, env };
}

async function one(arm: string, run: number | string) {
  const { rec, stdout, cwd, env } = await (CLAUDE ? runClaude : runCodex)(arm, run);
  appendFileSync(RESULTS, JSON.stringify(rec) + "\n");
  mkdirSync(join(HERE, "events"), { recursive: true }); await Bun.write(join(HERE, `events/demotask-${WHO}-${arm}-${run}.jsonl`), stdout);
  if (arm === "cli") await Bun.spawn(["playwright-cli", "close-all"], { cwd, env, stdout: "ignore", stderr: "ignore" }).exited;
  console.log(`${WHO} ${arm} #${run} success=${rec.success} urls=${rec.urlsOk} shots=${rec.distinctShots}/${rec.shots} tokens=${rec.inputAll} tools=${rec.toolCalls} ${Math.round(rec.wallMs / 1000)}s`);
}
const done = existsSync(RESULTS) ? readFileSync(RESULTS, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).map((r) => `${r.arm}-${r.run}`) : [];
const go = async (arm: string, run: number | string) => { if (!done.includes(`${arm}-${run}`)) await one(arm, run); };
const ARMS = ["cli", "mcp-shell", "mcp"];
if (MODE === "smoke") for (const a of ARMS) await go(a, "smoke");
else for (let run = 1; run <= 5; run++) for (let i = 0; i < 3; i++) await go(ARMS[(i + run - 1) % 3], run); // Rotates which setup runs first.
