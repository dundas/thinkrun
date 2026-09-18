// Validator for the harness skill directories. Read-only.
//
// `.claude/skills/` is canonical. `.cursor/`, `.codex/` and `.gemini/` are
// byte-for-byte copies so every harness sees the same skill text and the same
// trigger-eval fixture. This script never writes anything; regenerating the
// mirrors is the plain copy in package.json (`bun run sync`).
//
// Usage:
//   bun scripts/check-skills.ts                validate this checkout; exit 1 on any violation
//   bun scripts/check-skills.ts --root <dir>   validate another tree (tests)
//
// The check enforces:
//   1. every mirror equals .claude/skills (both directions, byte compare)
//   2. every evals/trigger-eval.json is a 20-entry array of
//      {query: string, should_trigger: boolean}, exactly 10 true, unique queries
//   3. every SKILL.md opens with YAML frontmatter whose `name` is kebab-case and
//      equals its directory, and whose `description` is non-empty and <= 1024 chars

import { readdirSync, readFileSync, lstatSync, existsSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

export const CANONICAL = ".claude";
export const MIRRORS = [".cursor", ".codex", ".gemini"];
export const FIXTURE_SIZE = 20;
export const FIXTURE_POSITIVES = 10;
export const DESCRIPTION_MAX = 1024;

type Violation = string;

// The single symlink rule. Returns the first path component, from `root`
// down to `path` inclusive, that is a symlink — or null.
//
// This script only reads. The rule exists so a mirror made of links, or a
// link leading out of the checkout, is reported as "not a copy" instead of
// being followed and compared by content. Only components that
// exist are inspected (a not-yet-created file has no link to be). Every read
// root and every write destination in this script goes through this, so a
// harness directory, a skills directory, a file, or a dangling link at any
// level is caught the same way: named, never followed.
function symlinkInPath(root: string, path: string): string | null {
  const rel = relative(root, path);
  if (rel === "" || rel.startsWith("..")) return null;
  let cur = root;
  for (const part of rel.split(sep)) {
    cur = join(cur, part);
    if (!existsSync(cur) && !isSymlink(cur)) return null; // nothing further exists
    if (isSymlink(cur)) return relative(root, cur);
  }
  return null;
}

function isSymlink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

// Symlinks are never followed: a mirror made of links to the canonical files
// would compare equal by content while not being a copy, and a dangling link
// would crash the read. They are collected and reported as violations.
function walk(dir: string, base = dir, symlinks: string[] = []): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    const st = lstatSync(full);
    if (st.isSymbolicLink()) symlinks.push(relative(base, full));
    else if (st.isDirectory()) out.push(...walk(full, base, symlinks));
    else out.push(relative(base, full));
  }
  return out;
}

function walkDirs(dir: string, base = dir): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (lstatSync(full).isDirectory()) {
      out.push(relative(base, full));
      out.push(...walkDirs(full, base));
    }
  }
  return out;
}

function skillDirs(root: string): string[] {
  const dir = join(root, CANONICAL, "skills");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .sort()
    .filter((d) => lstatSync(join(dir, d)).isDirectory());
}

// Read a regular file, or return null for anything else (directory, socket…)
// so the caller reports a violation instead of throwing EISDIR.
function readRegular(root: string, path: string): Buffer | null {
  if (symlinkInPath(root, path)) return null; // never read through a link at any level
  if (!existsSync(path)) return null;
  const st = lstatSync(path);
  return st.isFile() ? readFileSync(path) : null;
}

export function checkMirrors(root: string): Violation[] {
  const v: Violation[] = [];
  const canonDir = join(root, CANONICAL, "skills");
  const canonRootLink = symlinkInPath(root, canonDir);
  if (canonRootLink) return [`${canonRootLink}: symlink (the canonical tree must be a real directory)`];
  const canonLinks: string[] = [];
  const canonFiles = walk(canonDir, canonDir, canonLinks);
  for (const l of canonLinks) v.push(`${CANONICAL}/skills/${l}: symlink (not allowed in the skill tree)`);
  for (const mirror of MIRRORS) {
    const mirrorDir = join(root, mirror, "skills");
    const rootLink = symlinkInPath(root, mirrorDir);
    if (rootLink) {
      v.push(`${rootLink}: symlink (mirrors must be real directories)`);
      continue; // never walk through it
    }
    const mirrorLinks: string[] = [];
    const mirrorFiles = walk(mirrorDir, mirrorDir, mirrorLinks);
    for (const l of mirrorLinks) v.push(`${mirror}/skills/${l}: symlink (mirrors must be copies)`);
    for (const f of canonFiles) {
      const target = join(mirrorDir, f);
      if (!existsSync(target)) {
        v.push(`${mirror}/skills/${f}: missing (present in ${CANONICAL})`);
        continue;
      }
      const mirrorBytes = readRegular(root, target);
      if (mirrorBytes === null) {
        v.push(`${mirror}/skills/${f}: expected a regular file`);
        continue;
      }
      const canonBytes = readRegular(root, join(canonDir, f));
      if (canonBytes === null) continue; // already reported as a symlink / non-file on the canonical side
      if (!canonBytes.equals(mirrorBytes)) {
        v.push(`${mirror}/skills/${f}: differs from ${CANONICAL}/skills/${f}`);
      }
    }
    for (const f of mirrorFiles) {
      if (!existsSync(join(canonDir, f))) v.push(`${mirror}/skills/${f}: extra file (not in ${CANONICAL})`);
    }
    // Directories too: git can't carry an empty directory, but a local tree can,
    // and "identical in both directions" should mean the tree, not just the files.
    const canonDirs = new Set(walkDirs(canonDir));
    const mirrorDirs = new Set(walkDirs(mirrorDir));
    for (const d of canonDirs) if (!mirrorDirs.has(d)) v.push(`${mirror}/skills/${d}/: missing directory (present in ${CANONICAL})`);
    for (const d of mirrorDirs) if (!canonDirs.has(d)) v.push(`${mirror}/skills/${d}/: extra directory (not in ${CANONICAL})`);
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
  // Exact delimiters: the document must open with "---" on its own line and
  // the block must close with "---" on its own line (not "---anything").
  // Accept CRLF checkouts (.gitattributes pins LF, but a local tree may differ).
  const text = raw.replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) return null;
  const close = text.slice(4).match(/^---[ \t]*$/m);
  if (!close || close.index === undefined) return null;
  const block = text.slice(4, 4 + close.index);
  let doc: unknown;
  try {
    doc = Bun.YAML.parse(block);
  } catch {
    return null; // malformed YAML (unterminated quote, bad indentation) is a violation, not a pass
  }
  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(doc as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v.trim();
    else if (typeof v === "number" || typeof v === "boolean") out[k] = String(v);
  }
  return out;
}

export function checkSkill(dirName: string, path: string, raw: string): Violation[] {
  const v: Violation[] = [];
  const fm = parseFrontmatter(raw);
  if (!fm) return [`${path}: missing or malformed YAML frontmatter (must open and close with --- on its own line)`];
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
  const canonLink = symlinkInPath(root, join(root, CANONICAL, "skills"));
  if (canonLink) return [`${canonLink}: symlink (the canonical tree must be a real directory)`];
  const skills = skillDirs(root);
  if (skills.length === 0) v.push(`${CANONICAL}/skills: no skills found`);
  for (const skill of skills) {
    const dir = join(root, CANONICAL, "skills", skill);
    const skillMd = join(dir, "SKILL.md");
    const skillBytes = readRegular(root, skillMd);
    if (skillBytes === null) v.push(`${CANONICAL}/skills/${skill}/SKILL.md: missing or not a regular file`);
    else v.push(...checkSkill(skill, `${CANONICAL}/skills/${skill}/SKILL.md`, skillBytes.toString("utf8")));
    const fixture = join(dir, "evals", "trigger-eval.json");
    const fixtureBytes = readRegular(root, fixture);
    if (fixtureBytes === null) v.push(`${CANONICAL}/skills/${skill}/evals/trigger-eval.json: missing or not a regular file`);
    else v.push(...checkFixture(`${CANONICAL}/skills/${skill}/evals/trigger-eval.json`, fixtureBytes.toString("utf8")));
  }
  v.push(...checkMirrors(root));
  return v;
}

// The repo root is derived from this file's location, never from cwd, so the
// script can't be pointed at another checkout's .cursor/.codex/.gemini by
// accident (mech-browse, for one, has all three).
export const REPO_ROOT = resolve(import.meta.dir, "..");

if (import.meta.main) {
  const args = process.argv.slice(2);
  const rootIdx = args.indexOf("--root");
  let root = REPO_ROOT;
  if (rootIdx !== -1) {
    const value = args[rootIdx + 1];
    if (!value || value.startsWith("-")) {
      console.error("check-skills: --root requires a directory argument");
      process.exit(2);
    }
    root = resolve(value);
  }
  const violations = check(root);
  if (violations.length) {
    console.error(`skills-check: ${violations.length} violation(s)`);
    for (const line of violations) console.error(`  - ${line}`);
    process.exit(1);
  }
  console.log(`skills-check: ok (${skillDirs(root).length} skills, ${MIRRORS.length} mirrors)`);
}
