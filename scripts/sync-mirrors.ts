// Mirror generator + validator for the harness skill directories.
//
// `.claude/skills/` is canonical. `.cursor/`, `.codex/` and `.gemini/` are
// byte-for-byte copies so every harness sees the same skill text and the same
// trigger-eval fixture. Nothing ever writes to `.claude/`.
//
// Usage:
//   bun scripts/sync-mirrors.ts                regenerate the mirrors from .claude
//   bun scripts/sync-mirrors.ts --check        validate; exit 1 on any violation
//   ... --root <dir>                           operate on another tree (tests); the
//                                              default is this checkout, never cwd
//
// --check enforces:
//   1. every mirror equals .claude/skills (both directions, byte compare)
//   2. every evals/trigger-eval.json is a 20-entry array of
//      {query: string, should_trigger: boolean}, exactly 10 true, unique queries
//   3. every SKILL.md opens with YAML frontmatter whose `name` is kebab-case and
//      equals its directory, and whose `description` is non-empty and <= 1024 chars

import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, relative, dirname, resolve } from "node:path";

export const CANONICAL = ".claude";
export const MIRRORS = [".cursor", ".codex", ".gemini"];
export const FIXTURE_SIZE = 20;
export const FIXTURE_POSITIVES = 10;
export const DESCRIPTION_MAX = 1024;

type Violation = string;

function walk(dir: string, base = dir): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, base));
    else out.push(relative(base, full));
  }
  return out;
}

function skillDirs(root: string): string[] {
  const dir = join(root, CANONICAL, "skills");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .sort()
    .filter((d) => statSync(join(dir, d)).isDirectory());
}

export function checkMirrors(root: string): Violation[] {
  const v: Violation[] = [];
  const canonDir = join(root, CANONICAL, "skills");
  const canonFiles = walk(canonDir);
  for (const mirror of MIRRORS) {
    const mirrorDir = join(root, mirror, "skills");
    const mirrorFiles = walk(mirrorDir);
    for (const f of canonFiles) {
      const target = join(mirrorDir, f);
      if (!existsSync(target)) {
        v.push(`${mirror}/skills/${f}: missing (present in ${CANONICAL})`);
        continue;
      }
      if (!readFileSync(join(canonDir, f)).equals(readFileSync(target))) {
        v.push(`${mirror}/skills/${f}: differs from ${CANONICAL}/skills/${f}`);
      }
    }
    for (const f of mirrorFiles) {
      if (!existsSync(join(canonDir, f))) v.push(`${mirror}/skills/${f}: extra file (not in ${CANONICAL})`);
    }
  }
  return v;
}

export function checkFixture(path: string, raw: string): Violation[] {
  const v: Violation[] = [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return [`${path}: invalid JSON (${(e as Error).message})`];
  }
  if (!Array.isArray(data)) return [`${path}: must be a JSON array`];
  if (data.length !== FIXTURE_SIZE) v.push(`${path}: expected ${FIXTURE_SIZE} entries, found ${data.length}`);
  const seen = new Set<string>();
  let positives = 0;
  data.forEach((entry, i) => {
    const e = entry as Record<string, unknown>;
    if (typeof e?.query !== "string" || e.query.trim() === "") v.push(`${path}[${i}]: query must be a non-empty string`);
    if (typeof e?.should_trigger !== "boolean") v.push(`${path}[${i}]: should_trigger must be a boolean`);
    if (typeof e?.query === "string") {
      const key = e.query.trim().toLowerCase();
      if (seen.has(key)) v.push(`${path}[${i}]: duplicate query "${e.query}"`);
      seen.add(key);
    }
    if (e?.should_trigger === true) positives++;
  });
  if (data.length === FIXTURE_SIZE && positives !== FIXTURE_POSITIVES) {
    v.push(`${path}: expected ${FIXTURE_POSITIVES} should_trigger=true entries, found ${positives}`);
  }
  return v;
}

export function parseFrontmatter(raw: string): Record<string, string> | null {
  if (!raw.startsWith("---\n")) return null;
  const end = raw.indexOf("\n---", 4);
  if (end === -1) return null;
  const block = raw.slice(4, end);
  const out: Record<string, string> = {};
  const lines = block.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    // YAML block scalar (`>` folded / `|` literal): gather the indented lines
    if (/^[>|][+-]?$/.test(val)) {
      const parts: string[] = [];
      while (i + 1 < lines.length && (/^\s+\S/.test(lines[i + 1]) || lines[i + 1].trim() === "")) {
        parts.push(lines[++i].trim());
      }
      out[m[1]] = parts.join(val.startsWith(">") ? " " : "\n").trim();
      continue;
    }
    // frontmatter values may be double-quoted; strip one layer
    if (val.length >= 2 && val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/\\"/g, '"');
    out[m[1]] = val;
  }
  return out;
}

export function checkSkill(dirName: string, path: string, raw: string): Violation[] {
  const v: Violation[] = [];
  const fm = parseFrontmatter(raw);
  if (!fm) return [`${path}: missing YAML frontmatter (must start with ---)`];
  if (!fm.name) v.push(`${path}: frontmatter missing name`);
  else {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fm.name)) v.push(`${path}: name "${fm.name}" is not kebab-case`);
    if (fm.name !== dirName) v.push(`${path}: name "${fm.name}" does not match directory "${dirName}"`);
  }
  if (!fm.description || fm.description.trim() === "") v.push(`${path}: frontmatter missing description`);
  else if (fm.description.length > DESCRIPTION_MAX) {
    v.push(`${path}: description is ${fm.description.length} chars (max ${DESCRIPTION_MAX})`);
  }
  return v;
}

export function check(root: string): Violation[] {
  const v: Violation[] = [];
  const skills = skillDirs(root);
  if (skills.length === 0) v.push(`${CANONICAL}/skills: no skills found`);
  for (const skill of skills) {
    const dir = join(root, CANONICAL, "skills", skill);
    const skillMd = join(dir, "SKILL.md");
    if (!existsSync(skillMd)) v.push(`${CANONICAL}/skills/${skill}/SKILL.md: missing`);
    else v.push(...checkSkill(skill, `${CANONICAL}/skills/${skill}/SKILL.md`, readFileSync(skillMd, "utf8")));
    const fixture = join(dir, "evals", "trigger-eval.json");
    if (!existsSync(fixture)) v.push(`${CANONICAL}/skills/${skill}/evals/trigger-eval.json: missing`);
    else v.push(...checkFixture(`${CANONICAL}/skills/${skill}/evals/trigger-eval.json`, readFileSync(fixture, "utf8")));
  }
  v.push(...checkMirrors(root));
  return v;
}

export function sync(root: string): string[] {
  const canonDir = join(root, CANONICAL, "skills");
  if (!existsSync(canonDir)) throw new Error(`${canonDir} does not exist; refusing to sync`);
  const written: string[] = [];
  for (const mirror of MIRRORS) {
    const mirrorDir = join(root, mirror, "skills");
    rmSync(mirrorDir, { recursive: true, force: true });
    for (const f of walk(canonDir)) {
      const target = join(mirrorDir, f);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, readFileSync(join(canonDir, f)));
      written.push(`${mirror}/skills/${f}`);
    }
  }
  return written;
}

// The repo root is derived from this file's location, never from cwd, so the
// script can't be pointed at another checkout's .cursor/.codex/.gemini by
// accident (mech-browse, for one, has all three).
export const REPO_ROOT = resolve(import.meta.dir, "..");

if (import.meta.main) {
  const args = process.argv.slice(2);
  const rootIdx = args.indexOf("--root");
  const root = rootIdx === -1 ? REPO_ROOT : resolve(args[rootIdx + 1] ?? "");
  const mode = args.includes("--check") ? "check" : "sync";
  if (mode === "check") {
    const violations = check(root);
    if (violations.length) {
      console.error(`skills-check: ${violations.length} violation(s)`);
      for (const line of violations) console.error(`  - ${line}`);
      process.exit(1);
    }
    console.log(`skills-check: ok (${skillDirs(root).length} skills, ${MIRRORS.length} mirrors)`);
  } else {
    const written = sync(root);
    console.log(`sync-mirrors: wrote ${written.length} files across ${MIRRORS.join(", ")}`);
    const violations = check(root);
    if (violations.length) {
      console.error("sync-mirrors: canonical tree has violations; mirrors were synced but fix these:");
      for (const line of violations) console.error(`  - ${line}`);
      process.exit(1);
    }
  }
}
