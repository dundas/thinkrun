# Prove-it report template

Copy this into `.artifacts/<task>/report.md`. Every Evidence cell is a file
path, a measured value, or a share-link step. No prose in the table.

```markdown
## Proof — <task title>

- revision: `<sha> <branch>` (or deployment URL)
- mode: local | cloud
- session: https://thinkrun.ai/s/<token> (password-protected)  |  not shared  |  none (no API key)
- captured: <YYYY-MM-DD HH:MM>

| # | Target | Result | Evidence |
|---|--------|--------|----------|
| 1 | <testable statement> | pass | 01-<slug>.png; 01-<slug>-console.json clean; POST /api/x 200 |
| 2 | <testable statement> | fail | 02-<slug>.png shows <what happened instead> |
| 3 | <numeric statement, e.g. dashboard loads in < 300 ms> | pass | before: 615 ms (before-02-network.json) → after: 61 ms (03-<slug>-network.json) |
| 4 | <testable statement> | not-exercised | <why the state was unreachable> |
```

## Worked example — one failing row

```markdown
## Proof — coupon validation (PR #212)

- revision: `a1b2c3d feat/coupon-validation`
- mode: local
- session: https://thinkrun.ai/s/BxFg…mss (password-protected)
- captured: 2026-09-18 14:02

| # | Target | Result | Evidence |
|---|--------|--------|----------|
| 1 | expired coupon shows "This code has expired" | pass | 01-expired.png; POST /api/coupons/validate 422 in 01-expired-network.json |
| 2 | valid coupon updates the order total | pass | 02-valid.png (total 48.00 → 43.20); console clean |
| 3 | coupon field is disabled while validating | fail | 03-disabled.png: field stays enabled; two POSTs fired in 03-disabled-network.json |

**Back to build.** Row 3 did not pass. Fix, then run `/prove-it` again for
that target. Do not open or update the PR with this report as "tested".
```

The last paragraph is mandatory whenever any row is not `pass`, and it must
be the final thing in the report.
