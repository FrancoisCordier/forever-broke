# ADR-0003: Data lives on a `data` branch, rewritten as one commit each run

Status: **Accepted** (2026-11-25)

## Context
The brief puts JSON on a `data` branch with hourly commits. The hourly files are rewritten every hour.
Rough estimate: ~100 watchlist items × 2–3 houses × ~30 KB per 30-day hourly file ≈ several MB changed
every run. With normal commits, git history grows by hundreds of MB to GBs per month, which breaks the
"keep the repo small" rule and GitHub's soft repo limits.

## Decision
Each run builds the full data tree and **force-pushes the `data` branch as a single orphan commit**,
so the branch has no history. The source of truth for history is the content of the files themselves:
30 days of hourly points, daily rollups forever.

## Alternatives considered
- Normal commits on `data`: simple, but the repo grows without limit.
- Commit only daily files, keep hourly in Actions cache: the cache is evicted unpredictably, and it's hard for the site to read.
- External storage (R2/S3): more moving parts and a second set of secrets.

## Consequences
- A bad run can overwrite good data. Mitigations: the collector validates its output before pushing
  (e.g. refuses to drop more than X% of items vs previous), and raw snapshots are kept as artifacts (ADR-0004).
- Concurrent runs must not race: use a `concurrency` group in the workflow.
