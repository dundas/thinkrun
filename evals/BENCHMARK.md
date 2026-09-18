# Trigger-eval benchmark — public thinkrun skills (2026-07-16)

Harness: skill-routing judgment. One prompt = 4-skill catalog (live public descriptions from dundas/thinkrun) + 80 queries (4 fixtures x 20, 10 should / 10 should-not each) -> strict JSON, graded programmatically. 1 rep/config.
GPT via codex exec (ChatGPT account); Claude via claude -p. gpt-5.6 requested but NOT supported on this account (probed: gpt-5.6, gpt-5.6-codex, gpt-6.6 all 400).

| Config | Overall | thinkbrowse-cli | thinkbrowse-mcp | ux-audit | web-browse |
|---|---|---|---|---|---|
| gpt-5.4 low | 69/80 (86.3%) | 11/20 | 19/20 | 20/20 | 19/20 |
| gpt-5.4 medium | 70/80 (87.5%) | 11/20 | 19/20 | 20/20 | 20/20 |
| gpt-5.5 low | 69/80 (86.3%) | 11/20 | 19/20 | 20/20 | 19/20 |
| gpt-5.5 medium | 69/80 (86.3%) | 11/20 | 19/20 | 20/20 | 19/20 |
| claude-sonnet-5 | 71/80 (88.8%) | 12/20 | 19/20 | 20/20 | 20/20 |
| claude-opus-4-8 | 71/80 (88.8%) | 12/20 | 19/20 | 20/20 | 20/20 |
| claude-fable-5 | 71/80 (88.8%) | 12/20 | 19/20 | 20/20 | 20/20 |

## Findings
1. ux-audit: 20/20 on every config — today's scrub/description refresh routes perfectly, including near-misses (bug-fix, scraper, deploy asks all correctly rejected).
2. thinkbrowse-cli 11-12/20 is NOT a model failure — every miss is the model choosing web-browse for a generic browse ask ("go to reddit and find the top post", "scrape the pricing table"). All 7 configs, both families, made the SAME choices. The catalog has genuine overlap: web-browse's description claims the same territory and models correctly prefer the general skill. The cli fixture predates web-browse being in the catalog.
3. Query 24 ("use your browser tools to go to docs.python.org...") -> web-browse on all 7 configs (fixture says thinkbrowse-mcp). "browser tools" is honestly ambiguous; either fixture relabel or mcp description needs explicit-mention narrowing.
4. Query 67 ("verify the new blog post renders correctly live") -> ux-audit on 3 of 4 GPT configs; all Claude configs got it right. Only real family divergence in the whole run; "verify ... live" straddles both descriptions.
5. Effort barely matters (max delta 1/80 between low and medium). Family barely matters (Claude +1-2 over GPT). Description quality dominates everything.

## Recommendations
- Narrow thinkbrowse-cli/-mcp descriptions to explicit-tool-mention triggers ("Use ONLY when the user explicitly names the thinkbrowse CLI / MCP tools; otherwise prefer web-browse") — or fold both into web-browse and retire them.
- Re-point the thinkbrowse-cli fixture at catalog-aware expectations (its generic queries now belong to web-browse).
- Sharpen web-browse vs ux-audit boundary on "verify X live" phrasing (GPT-only confusion).

# Ablation eval — do the skills cover for each other? (2026-07-16)

Same 80 queries, two reduced catalogs. Grading: the removed skill's should-trigger queries pass if a sibling absorbs them; its should-NOT queries fail if a sibling over-captures.

| Config | no-web-browse (cli/mcp absorb?) | no-cli-mcp (web-browse absorbs?) |
|---|---|---|
| gpt-5.4 low | 78/80 | 78/80 |
| gpt-5.4 medium | 78/80 | 77/80 |
| gpt-5.5 low | 77/80 | 78/80 |
| gpt-5.5 medium | 76/80 | 77/80 |
| claude-sonnet-5 | 78/80 | 79/80 |
| claude-opus-4-8 | **80/80** | **80/80** |
| claude-fable-5 | 78/80 | **80/80** |

## Findings
1. Absorption works both directions: remove web-browse and cli/mcp catch its traffic; remove cli/mcp and web-browse catches theirs. Zero systematic over-capture of negatives (plain WebFetch asks stayed "none").
2. Reduced catalogs OUTSCORE the full catalog (76-80 vs 69-71). This confirms the full-matrix finding from the other side: the only weakness in the 4-skill set is cli/mcp vs web-browse redundancy. Fewer overlapping skills = crisper routing.
3. Residual misses are honest ambiguity, not defects: "click through the onboarding and review the UX" -> ux-audit (arguably correct; fixture label debatable), "verify the blog post renders live" -> ux-audit on GPT, "use your browser tools" -> cli vs mcp coin-flip.
4. claude-opus-4-8 was the only config to go perfect on both ablations.

## Content angle (marketing)
The story: "Install any subset — routing degrades gracefully." Full data supports a blog/README section showing the same 80 real-world asks routed under 3 catalog configurations across 7 models, with the ablation tables as proof the skill family is designed, not accidental. Honest caveat to include: the full catalog's cli/web-browse overlap and the planned description narrowing.

# Matrix v2 — narrowed cli/mcp descriptions + catalog-aware fixtures (2026-07-16)

Change under test: thinkbrowse-cli/-mcp descriptions narrowed to explicit-tool-mention ("Use ONLY when the user explicitly names..."), cli fixture rewritten so positives name the CLI and generic browse asks moved to negatives (they belong to web-browse in a full catalog).

| Config | Overall | cli | mcp | ux-audit | web-browse |
|---|---|---|---|---|---|
| gpt-5.4 low | **80/80** | 20 | 20 | 20 | 20 |
| gpt-5.4 medium | 79/80 | 19 | 20 | 20 | 20 |
| gpt-5.5 low | 79/80 | 19 | 20 | 20 | 20 |
| gpt-5.5 medium | **80/80** | 20 | 20 | 20 | 20 |
| claude-sonnet-5 | 72/80 | 19 | 13 | 20 | 20 |
| claude-opus-4-8 | **80/80** | 20 | 20 | 20 | 20 |
| claude-fable-5 | **80/80** | 20 | 20 | 20 | 20 |

Full catalog went 69-71/80 -> 79-80/80 (except sonnet-5, see below). The redundancy fix closed the gap exactly as the ablations predicted.

## The sonnet-5 "outlier" is principled, not broken
All 7 of its mcp misses route generic-"MCP"-flavored asks ("via MCP, attach to my tab...") to web-browse — whose description explicitly claims "from the CLI or any MCP client". Sonnet applied "ONLY when the user explicitly names the thinkbrowse/thinkrun MCP server" strictly; the queries name MCP but not thinkbrowse. Functionally correct routing (user gets a working browser skill either way). We document rather than over-tune: chasing 80/80 here would be overfitting the fixture, and the umbrella skill absorbing interface-generic asks is the designed behavior the ablation eval validated.

# Matrix v2 addendum — gpt-5.6 variants (sol / luna / terra), 2026-07-16

Same v2 catalog (narrowed descriptions). Note: the bare `gpt-5.6` id is rejected on our Codex account; only the named variants resolve.

| Config | low | medium | high |
|---|---|---|---|
| gpt-5.6-sol | 79/80 | 79/80 | 79/80 |
| gpt-5.6-luna | 77/80 | 77/80 | 72/80 |
| gpt-5.6-terra | **80/80** | **80/80** | 79/80 |

## Findings
1. terra matches the best of the board (perfect at low+medium); sol is flat 79 at every effort — its only miss is the known "verify the blog post renders correctly live" boundary query (-> ux-audit), at all three efforts.
2. luna-high (72/80) fails the identical 7 thinkbrowse-mcp query ids as claude-sonnet-5 (22, 23, 25, 27, 28, 29, 30 — the generic-"MCP" asks, all routed to web-browse). The strict-MCP reading is therefore cross-family (a strictness disposition, not a Claude quirk), reinforcing the decision to document rather than tune: web-browse legitimately claims "any MCP client".
3. Within luna, the strict reading correlates with effort: 1 of the 7 strict-MCP queries misses at low (id 22), 1 at medium (id 28), all 7 at high. Effort does not straightforwardly improve routing; luna-low also shows the run's only true over-capture (a "best headless browser library" knowledge question -> web-browse).

> **Reproducing a matrix.** `run-eval.ts` builds the prompt from the *live* `SKILL.md`
> frontmatter, so each matrix below is reproducible only at the commit that shipped it —
> checking out a later revision measures the later catalog. v1/v2 correspond to the repo
> state before `prove-it` landed; v3 to the commit that added it.

# Matrix v3 — 5-skill catalog with `prove-it`, 2026-09-18

`prove-it` (the prove / quality-control step of a software-factory workflow: named test targets → pass/fail table with captured evidence) joins the catalog. Two sibling descriptions were edited to draw the boundary — see **Boundary rules** below. 100 queries (5 fixtures × 20). Descriptions are now read from the live `SKILL.md` frontmatter at build time (the harness previously carried a copy).

| Config | Overall | prove-it | cli | mcp | ux-audit | web-browse |
|---|---|---|---|---|---|---|
| gpt-5.6-terra (codex exec) | **100/100** | 20 | 20 | 20 | 20 | 20 |
| claude-fable-5 | **100/100** | 20 | 20 | 20 | 20 | 20 |
| claude-sonnet-5 | 94/100 | 20 | 20 | 14 | 20 | 20 |

sonnet-5's six misses are the documented strict-MCP reading (generic "MCP" asks routed to web-browse; same query ids as v2, renumbered +20). On the four pre-existing fixtures it scored 74/80 vs 72/80 in v2 — no regression from the boundary edits; the +2 is within single-run variance and is not claimed as an improvement.

## Ablation — `no-prove-it` (gap semantics)

Removing `prove-it` and asking where its traffic goes:

| Config | prove-it positives → | prove-it negatives → | Graded |
|---|---|---|---|
| gpt-5.6-terra | `none` ×10 | ux-audit 4, web-browse 2, cli 1, mcp 1, none 2 | 100/100 |
| claude-sonnet-5 | `none` ×10 | ux-audit 4, web-browse 2, cli 1, mcp 1, none 2 | 94/100 |

Both families send every positive to `none` — no sibling absorbs "prove this change works" — and every negative lands exactly on the sibling it was written to test. `prove-it` is a **gap**, not a duplicate. For a gap skill the routing table above is the result; the graded 100/94 under gap semantics is true by construction and adds nothing beyond it. The harness gained empty-absorb semantics for this case (positives must route to `none`, negatives must not name the removed skill); the redundancy-style ablations from v2 are unchanged.

**Contamination caught on the first run:** the first boundary edits said "(use prove-it)" inside the `ux-audit` and `web-browse` descriptions. With `prove-it` removed, both models still answered `prove-it` for all 10 positives — routing to a skill that was not installed. A description must not name a skill that may not be installed. The parentheticals were removed; the do-not phrasing carries the boundary on its own (20/20 on all three configs).

## Boundary rules (principled, do not tune away)

Three skills can plausibly claim "verify …":

| Ask shape | Skill |
|---|---|
| Exploratory — "walk through it, tell me what's wrong", a fix list, opinions | `ux-audit` |
| No change under test — "go check whether the page loads", "screenshot X" | `web-browse` |
| A change under test **and** named claims — "prove the fix works", "attach evidence to the PR", "did the agent actually test this" | `prove-it` |

Applied to the fixtures: `ux-audit` #2 became exploratory ("walk through the new checkout redesign as a first-time buyer and flag everything that looks off"); the confirmatory phrasing moved to `prove-it`; `web-browse` #7 dropped the word "verify" ("load the new blog post live and screenshot it — do the images and code blocks render?"). The descriptions lost "verify something works live" (web-browse) and "verify the feature we shipped" (ux-audit).

Reproduce: `bun evals/run-eval.ts build` → `codex exec --model gpt-5.6-terra --skip-git-repo-check -o out.txt - < evals/prompt.txt` / `claude -p --model <id> --output-format text "$(cat evals/prompt.txt)"` → `bun evals/run-eval.ts grade <config> out.txt`. Raw outputs under `evals/results/raw/`.

# Matrix v4 — 6-skill catalog with `before-after`, 2026-09-18

`before-after` (the ship-step proof table: two captures at the same viewport → `| Before | After |`) joins the catalog. 120 queries.

| Config | Overall | before-after | prove-it | cli | mcp | ux-audit | web-browse |
|---|---|---|---|---|---|---|---|
| gpt-5.6-terra | **120/120** | 20 | 20 | 20 | 20 | 20 | 20 |
| claude-fable-5 | **120/120** | 20 | 20 | 20 | 20 | 20 | 20 |
| claude-sonnet-5 | 113/120 | 19 | 20 | 20 | 14 | 20 | 20 |

sonnet-5's `before-after` miss (id 8: "compare staging and production homepage screenshots side by side for the release notes" → web-browse) is a strict reading — no change under test is named — and is documented, not tuned. Its MCP misses are the known set.

## Ablation — `no-before-after`

| Config | positives → | negatives → |
|---|---|---|
| gpt-5.6-terra | prove-it ×10 | prove-it 4, web-browse 3, ux-audit 2, none 1 |
| claude-sonnet-5 | none 9, web-browse 1 | prove-it 4, web-browse 3, ux-audit 2, none 1 |

With the skill absent, terra treats a before/after table as part of `prove-it` (which does document `before-*` captures); sonnet mostly routes to `none`. Every negative lands on the sibling it was written to test. No over-capture. The graded score under the absorb map (113/120 terra, 97/120 sonnet) is an artifact of negatives that were deliberately written as prove-it / web-browse near-misses; the routing table is the result.

Reproduce as for v3.
