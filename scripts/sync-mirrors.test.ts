import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { check, sync, checkFixture, checkSkill, parseFrontmatter, CANONICAL, MIRRORS, FIXTURE_SIZE, REPO_ROOT } from "./sync-mirrors";

let root: string;

function fixture(positives = 10, total = FIXTURE_SIZE): string {
  const arr = Array.from({ length: total }, (_, i) => ({
    query: `query number ${i}`,
    should_trigger: i < positives,
  }));
  return JSON.stringify(arr, null, 1);
}

function skillMd(name: string, description = "Do a thing. Use when: asked to do the thing."): string {
  return `---\nname: ${name}\ndescription: "${description}"\ncategory: test\nsync: all\n---\n\n# ${name}\n`;
}

function writeSkill(base: string, name: string, opts: { md?: string; fixture?: string } = {}) {
  const dir = join(base, "skills", name);
  mkdirSync(join(dir, "evals"), { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), opts.md ?? skillMd(name));
  writeFileSync(join(dir, "evals", "trigger-eval.json"), opts.fixture ?? fixture());
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "sync-mirrors-"));
  writeSkill(join(root, CANONICAL), "alpha");
  writeSkill(join(root, CANONICAL), "beta-two");
  sync(root);
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

test("identical mirrors pass", () => {
  expect(check(root)).toEqual([]);
});

test("sync never writes to the canonical tree", () => {
  const before = readFileSync(join(root, CANONICAL, "skills/alpha/SKILL.md"), "utf8");
  writeFileSync(join(root, ".cursor/skills/alpha/SKILL.md"), "garbage");
  sync(root);
  expect(readFileSync(join(root, CANONICAL, "skills/alpha/SKILL.md"), "utf8")).toBe(before);
  expect(readFileSync(join(root, ".cursor/skills/alpha/SKILL.md"), "utf8")).toBe(before);
});

test("(i) one changed byte in a mirror fails and names the file", () => {
  const p = join(root, ".codex/skills/alpha/SKILL.md");
  writeFileSync(p, readFileSync(p, "utf8").replace("# alpha", "# alphA"));
  const v = check(root);
  expect(v).toHaveLength(1);
  expect(v[0]).toContain(".codex/skills/alpha/SKILL.md");
  expect(v[0]).toContain("differs");
});

test("(ii) extra file in a mirror fails", () => {
  writeFileSync(join(root, ".gemini/skills/alpha/notes.md"), "stray");
  const v = check(root);
  expect(v).toHaveLength(1);
  expect(v[0]).toContain("extra file");
});

test("missing file in a mirror fails", () => {
  rmSync(join(root, ".cursor/skills/beta-two/evals/trigger-eval.json"));
  const v = check(root);
  expect(v).toHaveLength(1);
  expect(v[0]).toContain("missing");
});

test("(iii) 19-entry fixture fails", () => {
  const v = checkFixture("f", fixture(10, 19));
  expect(v.some((x) => x.includes("expected 20 entries, found 19"))).toBe(true);
});

test("(iv) 11/9 split fails", () => {
  const v = checkFixture("f", fixture(11));
  expect(v).toEqual(["f: expected 10 should_trigger=true entries, found 11"]);
});

test("(v) duplicate query fails (case-insensitive)", () => {
  const arr = JSON.parse(fixture());
  arr[5].query = "Query Number 3";
  const v = checkFixture("f", JSON.stringify(arr));
  expect(v).toEqual(['f[5]: duplicate query "Query Number 3"']);
});

test("fixture with wrong shape fails", () => {
  expect(checkFixture("f", "{}")).toEqual(["f: must be a JSON array"]);
  expect(checkFixture("f", "not json")[0]).toContain("invalid JSON");
  const arr = JSON.parse(fixture());
  arr[0].should_trigger = "yes";
  arr[1].query = "";
  const v = checkFixture("f", JSON.stringify(arr));
  expect(v).toContain("f[0]: should_trigger must be a boolean");
  expect(v).toContain("f[1]: query must be a non-empty string");
});

test("(vi) description over 1024 chars fails", () => {
  const v = checkSkill("alpha", "p", skillMd("alpha", "x".repeat(1025)));
  expect(v).toEqual(["p: description is 1025 chars (max 1024)"]);
  expect(checkSkill("alpha", "p", skillMd("alpha", "x".repeat(1024)))).toEqual([]);
});

test("(vii) name not matching directory fails; non-kebab fails", () => {
  expect(checkSkill("alpha", "p", skillMd("beta"))).toEqual(['p: name "beta" does not match directory "alpha"']);
  const v = checkSkill("Alpha_1", "p", skillMd("Alpha_1"));
  expect(v).toEqual(['p: name "Alpha_1" is not kebab-case']);
});

test("malformed frontmatter is a violation, not a pass", () => {
  // unterminated quoted value
  expect(checkSkill("alpha", "p", '---\nname: alpha\ndescription: "unterminated\n---\n')).toEqual(["p: missing or malformed YAML frontmatter (must open and close with --- on its own line)"]);
  // closing marker that is not exactly ---
  expect(checkSkill("alpha", "p", "---\nname: alpha\ndescription: ok\n---invalid\n")).toEqual(["p: missing or malformed YAML frontmatter (must open and close with --- on its own line)"]);
  // frontmatter that is a list, not a map
  expect(checkSkill("alpha", "p", "---\n- a\n- b\n---\n")).toEqual(["p: missing or malformed YAML frontmatter (must open and close with --- on its own line)"]);
});

test("CLI rejects a bare --root instead of resolving it to cwd", async () => {
  for (const argv of [["--check", "--root"], ["--root", "--check"]]) {
    const proc = Bun.spawn(["bun", join(import.meta.dir, "sync-mirrors.ts"), ...argv], { cwd: root, stdout: "pipe", stderr: "pipe" });
    expect(await proc.exited).toBe(2);
    expect(await new Response(proc.stderr).text()).toContain("--root requires a directory argument");
  }
});

test("missing frontmatter / description fails", () => {
  expect(checkSkill("alpha", "p", "# no frontmatter")).toEqual(["p: missing or malformed YAML frontmatter (must open and close with --- on its own line)"]);
  expect(checkSkill("alpha", "p", "---\nname: alpha\n---\n")).toEqual(["p: frontmatter missing description"]);
});

test("parseFrontmatter strips one layer of double quotes and keeps unquoted values", () => {
  const fm = parseFrontmatter('---\nname: x\ndescription: "Use when: \\"quoted\\" thing"\ncategory: ux\n---\n');
  expect(fm?.description).toBe('Use when: "quoted" thing');
  expect(fm?.category).toBe("ux");
});

test("REPO_ROOT is this checkout, not cwd", () => {
  expect(REPO_ROOT).toBe(join(import.meta.dir, ".."));
  expect(REPO_ROOT).not.toBe(root);
});

test("frontmatter block scalars (> and |) are read in full, so a folded description is measured", () => {
  const folded = parseFrontmatter("---\nname: x\ndescription: >\n  Records visual proof\n  while testing.\ncategory: ux\n---\n");
  expect(folded?.description).toBe("Records visual proof while testing.");
  expect(folded?.category).toBe("ux");
  const literal = parseFrontmatter("---\ndescription: |\n  line one\n  line two\n---\n");
  expect(literal?.description).toBe("line one\nline two");
  const long = "---\nname: x\ndescription: >\n  " + "y".repeat(1025) + "\n---\n";
  expect(checkSkill("x", "p", long)).toEqual(["p: description is 1025 chars (max 1024)"]);
});

test("real repo fixtures and skills pass the checks", () => {
  const repo = join(import.meta.dir, "..");
  expect(existsSync(join(repo, CANONICAL, "skills"))).toBe(true);
  expect(check(repo)).toEqual([]);
});

test("CLI --check exits 1 with the violation text on drift", async () => {
  const p = join(root, ".cursor/skills/alpha/SKILL.md");
  writeFileSync(p, readFileSync(p, "utf8") + "\n");
  const proc = Bun.spawn(["bun", join(import.meta.dir, "sync-mirrors.ts"), "--check", "--root", root], { cwd: tmpdir(), stderr: "pipe", stdout: "pipe" });
  const code = await proc.exited;
  const err = await new Response(proc.stderr).text();
  expect(code).toBe(1);
  expect(err).toContain("1 violation(s)");
  expect(err).toContain(".cursor/skills/alpha/SKILL.md: differs");
  expect(MIRRORS).toContain(".cursor");
});

test("CLI without --root checks this checkout even when cwd is elsewhere", async () => {
  const proc = Bun.spawn(["bun", join(import.meta.dir, "sync-mirrors.ts"), "--check"], { cwd: root, stdout: "pipe", stderr: "pipe" });
  expect(await proc.exited).toBe(0);
  expect(await new Response(proc.stdout).text()).toMatch(/skills-check: ok \(\d+ skills, 3 mirrors\)/);
});

test("CLI --check exits 0 on a clean tree", async () => {
  const proc = Bun.spawn(["bun", join(import.meta.dir, "sync-mirrors.ts"), "--check", "--root", root], { cwd: tmpdir(), stdout: "pipe", stderr: "pipe" });
  expect(await proc.exited).toBe(0);
  expect(await new Response(proc.stdout).text()).toContain("skills-check: ok (2 skills, 3 mirrors)");
});
