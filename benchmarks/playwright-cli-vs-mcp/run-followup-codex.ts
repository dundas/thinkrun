// Follow-up tests on Codex.
// Step-by-step, both arms: CODEX_CLI_FULL_ACCESS=1 bun run-followup-codex.ts <model> smoke | stepwise
// MCP with a shell: bun run-followup-codex.ts <model> smoke-mcpshell | mcpshell | stepwise-mcpshell
// The CLI arm needs full access because Chrome can't launch inside the macOS sandbox. The plain MCP arm has no shell.
// The MCP-with-shell arm keeps Codex's default workspace-write sandbox, with the same shell tools the CLI arm has.
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, appendFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { disabledSkills } from "./codex-flags.ts";

const HERE = dirname(new URL(import.meta.url).pathname);
const MODEL = process.argv[2];
const mode = process.argv[3];
const CLI_BIN = join(HERE, "cli/node_modules/.bin");
const CLI_SKILL = join(HERE, "cli/node_modules/playwright-core/lib/tools/skills/playwright-cli");
const MCP_VERSION = "0.0.84";
const MCP_SHELL = mode === "mcpshell" || mode === "smoke-mcpshell" || mode === "stepwise-mcpshell";
if (!MCP_SHELL && process.env.CODEX_CLI_FULL_ACCESS !== "1") throw new Error("Set CODEX_CLI_FULL_ACCESS=1: the CLI arm can't start Chrome inside the sandbox");
const RESULTS = join(HERE, MCP_SHELL ? `results-followup-codex-mcpshell-${MODEL}.jsonl` : `results-followup-codex-${MODEL}.jsonl`);
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
const COMMON_OFF = ["browser_use", "browser_use_external", "computer_use", "apps", "plugins", "multi_agent", "image_generation"];

async function runOne(arm: "mcp" | "cli", task: string, run: number | string) {
  const t = TASKS[task];
  const fixture = Bun.spawn(["bun", join(HERE, "fixture.ts")], { stdout: "pipe", stderr: "ignore", env: { ...process.env, PRODUCTS: String(t.products), PLAN: JSON.stringify(t.plan) } });
  const { value } = await fixture.stdout.getReader().read();
  const { port, expected } = JSON.parse(new TextDecoder().decode(value));
  const cwd = mkdtempSync(join(tmpdir(), `pw-bench-codex-${arm}-`));
  const env: Record<string, string | undefined> = { ...process.env, PLAYWRIGHT_CLI_SESSION: `c${Date.now()}` };
  const off = [...COMMON_OFF];
  const flags = ["exec", "--json", "--ephemeral", "--ignore-user-config", "--ignore-rules", "--skip-git-repo-check", "-m", MODEL, "-c", "model_reasoning_effort=medium", "-c", 'web_search="disabled"', "-c", disabledSkills, "-c", `projects.${JSON.stringify(cwd)}.trust_level="trusted"`];
  if (arm === "mcp") {
    if (MCP_SHELL) {
      mkdirSync(join(cwd, ".zdot"));
      off.push("shell_snapshot");
      flags.push("-s", "workspace-write", "-c", 'approval_policy="never"', "-c", "allow_login_shell=false", "-c", 'shell_environment_policy.inherit="all"', "-c", `shell_environment_policy.set.ZDOTDIR=${JSON.stringify(join(cwd, ".zdot"))}`);
    } else {
      off.push("shell_tool", "unified_exec");
      flags.push("-s", "read-only");
    }
    flags.push("-c", 'mcp_servers.playwright.command="npx"', "-c", `mcp_servers.playwright.args=["-y","@playwright/mcp@${MCP_VERSION}","--headless","--isolated","--browser","chrome","--output-dir",${JSON.stringify(join(cwd, "out"))}]`, "-c", 'mcp_servers.playwright.default_tools_approval_mode="approve"', "-c", "mcp_servers.playwright.startup_timeout_sec=60");
  } else {
    env.PATH = `${CLI_BIN}:${process.env.PATH}`;
    mkdirSync(join(cwd, ".agents/skills"), { recursive: true });
    cpSync(CLI_SKILL, join(cwd, ".agents/skills/playwright-cli"), { recursive: true });
    mkdirSync(join(cwd, ".playwright"), { recursive: true });
    writeFileSync(join(cwd, ".playwright/cli.config.json"), JSON.stringify({ browser: { browserName: "chromium", launchOptions: { channel: "chrome", headless: true } } }));
    mkdirSync(join(cwd, ".zdot"));
    writeFileSync(join(cwd, ".zdot/.zshenv"), `export PATH=${JSON.stringify(env.PATH)}\n`);
    off.push("shell_snapshot");
    flags.push("-c", "allow_login_shell=false", "-c", 'shell_environment_policy.inherit="all"', "-c", `shell_environment_policy.set.PATH=${JSON.stringify(env.PATH)}`, "-c", `shell_environment_policy.set.ZDOTDIR=${JSON.stringify(join(cwd, ".zdot"))}`);
    // Chrome cannot launch inside the macOS workspace sandbox. Full access is opt-in and must be set by whoever starts the run.
    if (process.env.CODEX_CLI_FULL_ACCESS === "1") flags.push("--dangerously-bypass-approvals-and-sandbox");
    else flags.push("-s", "workspace-write", "-c", 'approval_policy="never"', "-c", "sandbox_workspace_write.network_access=true");
  }
  for (const f of off) flags.push("-c", `features.${f}=false`);
  const started = Date.now();
  const proc = Bun.spawn(["codex", ...flags, t.prompt(`http://127.0.0.1:${port}/`)], { cwd, env, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  let timedOut = false;
  const killer = setTimeout(() => { timedOut = true; proc.kill(); }, 900_000);
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exit = await proc.exited;
  clearTimeout(killer);
  const wallMs = Date.now() - started;
  const events = stdout.split("\n").filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
  const items = events.filter((e) => e.type === "item.completed").map((e) => e.item);
  const usage = events.findLast((e) => e.type === "turn.completed")?.usage ?? null;
  const calls = items.filter((i) => ["command_execution", "mcp_tool_call"].includes(i.type));
  const label = (i: any) => i.type === "mcp_tool_call" ? String(i.tool) : `shell:${String(i.command).replace(/^\S*\/?(zsh|bash) -\S+ /, "").replace(/^['"]/, "").split(/\s+/).slice(0, 2).join(" ").replace(/\/(private|var|Users|tmp)[^\s"]*/g, "<path>")}`;
  const last = items.findLast((i) => i.type === "agent_message");
  const state = await (await fetch(`http://127.0.0.1:${port}/__state`)).json();
  let answer: any = null;
  try { answer = JSON.parse(String(last?.text ?? "").match(/\{[\s\S]*\}/)?.[0] ?? "null"); } catch {}
  const answerOk = !!answer && answer.total === expected.total && JSON.stringify(answer.items) === JSON.stringify(expected.items);
  const usedBrowser = state.nonBrowserRequests === 0 && (arm === "mcp" ? calls.some((i) => i.type === "mcp_tool_call") : calls.some((i) => /playwright-cli/.test(String(i.command))));
  const success = answerOk && state.addEvents === expected.adds && usedBrowser;
  const setupBroken = arm === "cli" && /command not found: playwright-cli/.test(stdout);
  const skillUsed = calls.some((i) => /SKILL\.md/.test(String(i.command)));
  const commands = calls.map((i: any) => i.type === "mcp_tool_call" ? String(i.tool) : scrub(String(i.command)));
  const scriptCalls = calls.filter((i: any) => i.type === "mcp_tool_call" ? /browser_run_code/.test(String(i.tool)) : isScript(String(i.command))).length;
  const shellCalls = calls.filter((i: any) => i.type === "command_execution").length;
  const rec = { at: new Date().toISOString(), variant: mode, mcpShell: MCP_SHELL, shellCalls, scriptCalls, commands, harness: "codex", model: MODEL, arm, task, run, exit, timedOut, success, answerOk, usedBrowser, nonBrowserRequests: state.nonBrowserRequests, setupBroken, adds: state.addEvents, expectedAdds: expected.adds, cart: state.cart, expected, answer, finalText: answer ? undefined : String(last?.text ?? "").slice(0, 600), wallMs, toolCalls: calls.length, tools: calls.map(label), skillUsed, inputAll: usage?.input_tokens ?? null, cached: usage?.cached_input_tokens ?? null, output: usage?.output_tokens ?? null, reasoning: usage?.reasoning_output_tokens ?? null, failed: events.filter((e) => e.type === "turn.failed" || e.type === "error").map((e) => e.message ?? e.error?.message).slice(0, 2), stderrTail: stderr.slice(-300) };
  appendFileSync(RESULTS, JSON.stringify(rec) + "\n");
  mkdirSync(join(HERE, "events"), { recursive: true });
  await Bun.write(join(HERE, `events/followup-codex-${MODEL}-${MCP_SHELL ? "mcpshell-" : ""}${arm}-${task}-${run}.jsonl`), stdout);
  if (arm === "cli") { const c = Bun.spawn(["playwright-cli", "close-all"], { cwd, env, stdout: "ignore", stderr: "ignore" }); await c.exited; }
  fixture.kill();
  if (setupBroken) { console.error("STOP: playwright-cli was not on PATH. Results so far are in " + RESULTS); process.exit(2); }
  console.log(`${MODEL} ${task} ${arm} #${run} success=${success} ${Math.round(wallMs / 1000)}s tools=${rec.toolCalls} input=${rec.inputAll} cached=${rec.cached} out=${rec.output} adds=${rec.adds} browser=${usedBrowser} skill=${skillUsed} ${rec.failed.join(";").slice(0, 120)}`);
}
const done = existsSync(RESULTS) ? readFileSync(RESULTS, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).map((r) => `${r.arm}-${r.task}-${r.run}`) : [];
const go = async (arm: "mcp" | "cli", task: string, run: number | string) => { if (!done.includes(`${arm}-${task}-${run}`)) await runOne(arm, task, run); };
if (mode === "smoke") { await go("mcp", "stepwise", "smoke"); await go("cli", "stepwise", "smoke"); }
else if (mode === "stepwise") { for (let run = 1; run <= 5; run++) for (const arm of (run % 2 ? ["cli", "mcp"] : ["mcp", "cli"]) as ("mcp" | "cli")[]) await go(arm, "stepwise", run); }
else if (mode === "smoke-mcpshell") await go("mcp", "simple", "smoke");
else if (mode === "mcpshell") { for (let run = 1; run <= 5; run++) for (const task of ["simple", "dense", "long"]) await go("mcp", task, run); }
else if (mode === "stepwise-mcpshell") { for (let run = 1; run <= 5; run++) await go("mcp", "stepwise", run); }
else throw new Error("mode must be smoke, stepwise, smoke-mcpshell, mcpshell or stepwise-mcpshell");
