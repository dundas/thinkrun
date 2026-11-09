// Two extra tests for the video. Each run gets a fresh site and temp workspace.
// Write once:   bun run-extras.ts claude writeonce-smoke|writeonce
//               CODEX_CLI_FULL_ACCESS=1 bun run-extras.ts gpt-6-luna|gpt-6.1-sol writeonce-smoke|writeonce
// agent-browser (needs ./ab installed): same pattern with ab-smoke|ab
// Write once: the agent writes and checks a saved Playwright script, then we rerun it 5 times on fresh sites with no agent.
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, appendFileSync, existsSync, readFileSync, readdirSync, statSync, symlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, dirname, extname } from "node:path";
import { disabledSkills } from "./codex-flags.ts";

const HERE = dirname(new URL(import.meta.url).pathname);
const WHO = process.argv[2], MODE = process.argv[3];
const CLAUDE = WHO === "claude";
if (!["claude", "gpt-6-luna", "gpt-6.1-sol"].includes(WHO) || !["writeonce-smoke", "writeonce", "ab-smoke", "ab"].includes(MODE)) throw new Error("usage: bun run-extras.ts <claude|gpt-6-luna|gpt-6.1-sol> <writeonce-smoke|writeonce|ab-smoke|ab>");
if (!CLAUDE && process.env.CODEX_CLI_FULL_ACCESS !== "1") throw new Error("Set CODEX_CLI_FULL_ACCESS=1: Chrome can't start inside the Codex sandbox");
const AB = MODE.startsWith("ab");
const AB_BIN = join(HERE, "ab/node_modules/.bin"), AB_SKILL = join(HERE, "ab/node_modules/agent-browser/skills/agent-browser");
if (AB && !existsSync(join(AB_BIN, "agent-browser"))) throw new Error("agent-browser isn't installed in ./ab");
const CLI_BIN = join(HERE, "cli/node_modules/.bin"), CLI_SKILL = join(HERE, "cli/node_modules/playwright-core/lib/tools/skills/playwright-cli");
const RESULTS = join(HERE, `results-extras-${WHO}.jsonl`);
const REPLY_ONE = `Then reply with only this JSON: {"items": [{"product": "<product name>", "quantity": <quantity>}], "total": "<cart total>"}`;
const LONG: [string, number][] = [["Lantern", 1], ["Backpack", 2], ["Kettle", 1], ["Notebook", 3], ["Speaker", 1], ["Thermos", 2], ["Headset", 1], ["Keyboard", 2]];
const ONE = (u: string) => `Open ${u} in the browser. Search for "liquid". Open the first result. Set the quantity to 2 and add it to the cart. Open the cart and check the total. ${REPLY_ONE}`;
const DEMO = `Open https://playwright.dev. Search for locators and check that the doc is available for each language: JavaScript, Python, Java and .NET. Take a screenshot of the doc for each language and save it as a file. Then reply with only this JSON: {"languages": [{"language": "<language>", "url": "<doc url>", "available": <true or false>, "screenshot": "<file name>"}]}`;
const WANT = [/^https:\/\/playwright\.dev\/docs\/locators\/?(#.*)?$/, /^https:\/\/playwright\.dev\/python\/docs\/locators\/?(#.*)?$/, /^https:\/\/playwright\.dev\/java\/docs\/locators\/?(#.*)?$/, /^https:\/\/playwright\.dev\/dotnet\/docs\/locators\/?(#.*)?$/];
const WRITE = (u: string) => `The shop is at ${u}. For each item below, the task is to go back to the home page, use the search box to search for its term, open the first result, set the quantity and add it to the cart, in this order: ${LONG.map(([q, n]) => `"${q}" quantity ${n}`).join(", ")}. Add each item exactly once. Then open the cart and read the total. Write a Playwright script saved as shop.mjs that does this whole task in a fresh headless browser when run as: node shop.mjs <shop url>. It must use import { chromium } from "playwright", launch with channel "chrome", and print only this JSON: {"items": [{"product": "<product name>", "quantity": <quantity>}], "total": "<cart total>"}. Use the browser to inspect the shop if you need to, and run the script once to check it works. The shop's cart is not reset between runs, so a checking run may leave items behind; the script will be judged on an empty cart. When you're finished, reply with only the word done.`;
const TASKS: Record<string, any> = { simple: { products: 20, plan: [["liquid", 2]], prompt: ONE }, dense: { products: 400, plan: [["liquid", 2]], prompt: ONE }, demo: { prompt: () => DEMO }, writeonce: { products: 400, plan: LONG, prompt: WRITE } };
const scrub = (c: string) => c.replace(/\/(private|var|Users|tmp)[^\s"']*/g, "<path>").slice(0, 400);
const parse = (t: unknown) => { try { return JSON.parse(String(t ?? "").match(/\{[\s\S]*\}/)?.[0] ?? "null"); } catch { return null; } };
const images = (d: string): string[] => readdirSync(d).flatMap((n) => { if ([".claude", ".agents", ".zdot", "node_modules", ".playwright"].includes(n)) return []; const p = join(d, n); return statSync(p).isDirectory() ? images(p) : [".png", ".jpg", ".jpeg"].includes(extname(n).toLowerCase()) ? [p] : []; });

async function site(t: any) { const f = Bun.spawn(["bun", join(HERE, "fixture.ts")], { stdout: "pipe", stderr: "ignore", env: { ...process.env, PRODUCTS: String(t.products), PLAN: JSON.stringify(t.plan) } }); const { value } = await f.stdout.getReader().read(); return { f, ...JSON.parse(new TextDecoder().decode(value)) }; }
function workspace() {
  const cwd = mkdtempSync(join(tmpdir(), `pw-extra-`)); const env: Record<string, string | undefined> = { ...process.env, DISABLE_AUTOUPDATER: "1", PLAYWRIGHT_CLI_SESSION: `x${Date.now()}`, AGENT_BROWSER_SESSION: `x${Date.now()}` };
  env.PATH = `${AB ? AB_BIN : CLI_BIN}:${process.env.PATH}`;
  const skills = join(cwd, CLAUDE ? ".claude/skills" : ".agents/skills"); mkdirSync(skills, { recursive: true });
  if (AB) cpSync(AB_SKILL, join(skills, "agent-browser"), { recursive: true });
  else { cpSync(CLI_SKILL, join(skills, "playwright-cli"), { recursive: true }); mkdirSync(join(cwd, ".playwright")); writeFileSync(join(cwd, ".playwright/cli.config.json"), JSON.stringify({ browser: { browserName: "chromium", launchOptions: { channel: "chrome", headless: true } } })); symlinkSync(join(HERE, "cli/node_modules"), join(cwd, "node_modules")); }
  return { cwd, env };
}
async function agent(prompt: string, cwd: string, env: any) {
  let flags: string[], cmd: string[];
  if (CLAUDE) cmd = ["claude", "-p", prompt, "--model", "claude-sonnet-5-5", "--effort", "medium", "--output-format", "stream-json", "--verbose", "--no-session-persistence", "--setting-sources", "project", "--strict-mcp-config", "--tools", "Bash,Read,Grep,Skill,Write,Edit", "--allowedTools", "Bash,Read,Grep,Skill,Write,Edit"];
  else { mkdirSync(join(cwd, ".zdot")); writeFileSync(join(cwd, ".zdot/.zshenv"), `export PATH=${JSON.stringify(env.PATH)}\n`);
    flags = ["exec", "--json", "--ephemeral", "--ignore-user-config", "--ignore-rules", "--skip-git-repo-check", "-m", WHO, "-c", "model_reasoning_effort=medium", "-c", 'web_search="disabled"', "-c", disabledSkills, "-c", `projects.${JSON.stringify(cwd)}.trust_level="trusted"`, "-c", "allow_login_shell=false", "-c", 'shell_environment_policy.inherit="all"', "-c", `shell_environment_policy.set.PATH=${JSON.stringify(env.PATH)}`, "-c", `shell_environment_policy.set.ZDOTDIR=${JSON.stringify(join(cwd, ".zdot"))}`, "--dangerously-bypass-approvals-and-sandbox"];
    for (const f of ["browser_use", "browser_use_external", "computer_use", "apps", "plugins", "multi_agent", "image_generation", "shell_snapshot"]) flags.push("-c", `features.${f}=false`); cmd = ["codex", ...flags, prompt]; }
  const started = Date.now(); const proc = Bun.spawn(cmd, { cwd, env, stdin: "ignore", stdout: "pipe", stderr: "pipe" }); let timedOut = false; const k = setTimeout(() => { timedOut = true; proc.kill(); }, 900_000);
  const stdout = await new Response(proc.stdout).text(); const stderr = await new Response(proc.stderr).text(); const exit = await proc.exited; clearTimeout(k);
  const ev = stdout.split("\n").filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } }); const wallMs = Date.now() - started;
  if (CLAUDE) { const result = ev.findLast((e) => e.type === "result"); const turns = new Map<string, any>(); for (const e of ev) if (e.type === "assistant" && e.message?.usage) turns.set(e.message.id, e.message.usage); const ctx = (u: any) => (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0); const cs = [...turns.values()].map(ctx); const uses = ev.filter((e) => e.type === "assistant").flatMap((e) => e.message.content ?? []).filter((c: any) => c.type === "tool_use");
    return { stdout, text: result?.result, inputAll: cs.reduce((a, b) => a + b, 0), finalContext: cs.at(-1), firstContext: cs[0], output: [...turns.values()].reduce((n, u) => n + (u.output_tokens ?? 0), 0), costUsd: result?.total_cost_usd, toolCalls: uses.length, commands: uses.map((u: any) => u.name === "Bash" ? scrub(String(u.input?.command)) : u.name), exit, timedOut, wallMs, stderrTail: stderr.slice(-200) }; }
  const items = ev.filter((e) => e.type === "item.completed").map((e) => e.item); const usage = ev.findLast((e) => e.type === "turn.completed")?.usage ?? null; const calls = items.filter((i: any) => ["command_execution", "mcp_tool_call", "file_change"].includes(i.type));
  return { stdout, text: items.findLast((i: any) => i.type === "agent_message")?.text, inputAll: usage?.input_tokens ?? null, cached: usage?.cached_input_tokens ?? null, output: usage?.output_tokens ?? null, toolCalls: calls.length, commands: calls.map((i: any) => i.type === "command_execution" ? scrub(String(i.command)) : i.type), exit, timedOut, wallMs, stderrTail: stderr.slice(-200) };
}
async function runAb(task: string, run: number | string) {
  const t = TASKS[task]; const { cwd, env } = workspace(); const s = task === "demo" ? null : await site(t); const a = await agent(t.prompt(s ? `http://127.0.0.1:${s.port}/` : ""), cwd, env); const answer = parse(a.text); let ok: any = {};
  const used = a.commands.some((c: string) => /agent-browser/.test(c));
  if (s) { const st = await (await fetch(`http://127.0.0.1:${s.port}/__state`)).json(); const answerOk = !!answer && answer.total === s.expected.total && JSON.stringify(answer.items) === JSON.stringify(s.expected.items); ok = { answerOk, adds: st.addEvents, nonBrowserRequests: st.nonBrowserRequests, success: answerOk && st.addEvents === s.expected.adds && st.nonBrowserRequests === 0 && used }; s.f.kill(); }
  else { const langs = Array.isArray(answer?.languages) ? answer.languages : []; const urlsOk = WANT.every((re) => langs.some((l: any) => re.test(String(l.url)) && l.available === true)); const files = images(cwd); const distinct = new Set(files.map((f) => createHash("sha256").update(readFileSync(f)).digest("hex"))).size; const fetched = a.commands.filter((c: string) => /\b(curl|wget)\b/.test(c)).length; ok = { urlsOk, distinctShots: distinct, fetched, success: urlsOk && distinct >= 4 && fetched === 0 && used }; const to = join(HERE, "demotask-shots", `${WHO}-ab-${run}`); mkdirSync(to, { recursive: true }); for (const f of files) cpSync(f, join(to, f.split("/").pop()!)); }
  // The skill's guide has agents make a session named from the working directory, so close that one too.
  const idp = Bun.spawn([join(AB_BIN, "agent-browser"), "session", "id", "--scope", "worktree", "--prefix", "task"], { cwd, env, stdout: "pipe", stderr: "ignore" }); const sid = (await new Response(idp.stdout).text()).trim(); await idp.exited;
  if (sid) await Bun.spawn([join(AB_BIN, "agent-browser"), "--session", sid, "close"], { cwd, env, stdout: "ignore", stderr: "ignore" }).exited;
  await Bun.spawn([join(AB_BIN, "agent-browser"), "close"], { cwd, env, stdout: "ignore", stderr: "ignore" }).exited;
  return { cwd, a, rec: { variant: "agent-browser", task, usedTool: used, answer, ...ok } };
}
async function runWrite(run: number | string) {
  const t = TASKS.writeonce; const { cwd, env } = workspace(); const s = await site(t); const a = await agent(t.prompt(`http://127.0.0.1:${s.port}/`), cwd, env); s.f.kill();
  await Bun.spawn(["playwright-cli", "close-all"], { cwd, env, stdout: "ignore", stderr: "ignore" }).exited;
  const exists = existsSync(join(cwd, "shop.mjs")); const reruns: any[] = [];
  if (exists) for (let i = 0; i < 5; i++) { const fresh = await site(t); const started = Date.now(); const p = Bun.spawn(["node", "shop.mjs", `http://127.0.0.1:${fresh.port}/`], { cwd, env, stdout: "pipe", stderr: "pipe" }); const k = setTimeout(() => p.kill(), 120_000); const out = await new Response(p.stdout).text(); const err = await new Response(p.stderr).text(); const exit = await p.exited; clearTimeout(k); const st = await (await fetch(`http://127.0.0.1:${fresh.port}/__state`)).json(); const answer = parse(out); const answerOk = !!answer && answer.total === fresh.expected.total && JSON.stringify(answer.items) === JSON.stringify(fresh.expected.items); reruns.push({ exit, ms: Date.now() - started, answerOk, adds: st.addEvents, ok: answerOk && st.addEvents === fresh.expected.adds, err: err.slice(0, 200), out: answerOk ? undefined : out.slice(0, 200) }); fresh.f.kill(); }
  const passed = reruns.filter((r) => r.ok).length;
  const dir = join(HERE, "writeonce-scripts"); mkdirSync(dir, { recursive: true }); if (exists) cpSync(join(cwd, "shop.mjs"), join(dir, `${WHO}-${run}.mjs`));
  return { cwd, a, rec: { variant: "writeonce", task: "writeonce", scriptExists: exists, reruns, rerunPass: passed, success: passed === 5, scriptChars: exists ? readFileSync(join(cwd, "shop.mjs"), "utf8").length : 0 } };
}
async function one(fn: () => Promise<any>, label: string, run: number | string) {
  const { a, rec } = await fn(); const { stdout, text, ...usage } = a; const row = { at: new Date().toISOString(), who: WHO, run, ...rec, ...usage };
  appendFileSync(RESULTS, JSON.stringify(row) + "\n"); mkdirSync(join(HERE, "events"), { recursive: true }); await Bun.write(join(HERE, `events/extras-${WHO}-${label}-${run}.jsonl`), stdout);
  console.log(`${WHO} ${label} #${run} success=${row.success} tokens=${row.inputAll} tools=${row.toolCalls} rerunPass=${row.rerunPass ?? "-"} ${Math.round(row.wallMs / 1000)}s`);
}
const done = existsSync(RESULTS) ? readFileSync(RESULTS, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).map((r) => `${r.variant}-${r.task}-${r.run}`) : [];
const go = async (variant: string, task: string, run: number | string) => { if (done.includes(`${variant}-${task}-${run}`)) return; if (variant === "writeonce") await one(() => runWrite(run), "writeonce", run); else await one(() => runAb(task, run), `ab-${task}`, run); };
if (MODE === "writeonce-smoke") await go("writeonce", "writeonce", "smoke");
else if (MODE === "writeonce") for (let r = 1; r <= 5; r++) await go("writeonce", "writeonce", r);
else if (MODE === "ab-smoke") for (const t of ["demo", "simple"]) await go("agent-browser", t, "smoke");
else for (let r = 1; r <= 5; r++) for (const t of ["demo", "simple", "dense"]) await go("agent-browser", t, r);
