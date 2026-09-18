# Skill trigger evals

Reproducible routing benchmarks for the skills in this repo, across GPT (5.4/5.5, low+medium reasoning via `codex exec`) and Claude (sonnet-5, opus-4.8, fable-5 via `claude -p`).

- Per-skill fixtures: `<mirror>/skills/<skill>/evals/trigger-eval.json` — 20 queries each (10 should-trigger, 10 should-not, near-miss heavy).
- Harness: `evals/run-eval.ts` (bun). `build` assembles a routing prompt from the live skill descriptions + all fixtures; `grade` scores strict JSON output. `build-variant`/`grade-variant` run catalog ablations that test whether sibling skills absorb a removed skill's traffic.
- Results: `evals/BENCHMARK.md` — full-catalog matrix, both ablations, and the v2 matrix after the description narrowing that the eval itself motivated.

Headline (2026-07-16): full catalog 79–80/80 on 6 of 7 configs after eval-driven description fixes; ablations show clean bidirectional absorption (install any subset — routing degrades gracefully).

## Mirror check (CI)

`.claude/skills/` is canonical; `.cursor/`, `.codex/` and `.gemini/` must be byte-identical copies. `bun run check` (`scripts/check-skills.ts`) fails on any drift, on a `trigger-eval.json` that is not 20 entries / 10 positives / unique queries, or on a `SKILL.md` whose frontmatter `name` is not its directory or whose `description` is empty or over 1024 chars. `.github/workflows/skills-check.yml` runs it on every PR.

After editing anything under `.claude/skills/`, regenerate the mirrors and re-check:

```bash
for m in .cursor .codex .gemini; do rm -rf $m/skills && cp -R .claude/skills $m/skills; done && bun run check
```
