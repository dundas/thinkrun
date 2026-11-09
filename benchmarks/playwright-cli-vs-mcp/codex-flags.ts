import { readdirSync, existsSync } from "node:fs"; import { homedir } from "node:os"; import { join } from "node:path";
const skillPaths: string[] = [];
const walk = (d: string, depth = 0) => { if (!existsSync(d) || depth > 3) return; for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.name === "SKILL.md") skillPaths.push(p); else if (e.isDirectory() || e.isSymbolicLink()) { try { walk(p, depth + 1); } catch {} } } };
walk(join(homedir(), ".codex/skills")); walk(join(homedir(), ".agents/skills"));
export const disabledSkills = `skills.config=[${skillPaths.map((p) => `{path=${JSON.stringify(p)},enabled=false}`).join(",")}]`;
if (import.meta.main) console.log(skillPaths.length);
