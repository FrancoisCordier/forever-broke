# ADR-0004: Collect broadly from day one and keep raw snapshots briefly

Status: **Accepted** (2026-11-25)

## Context

- The commodities endpoint returns a house's whole commodity market in one response anyway.
  Aggregating every item costs almost nothing extra.
- Phase 0 might not identify "my house" with certainty right away, and we can't backfill.
- The watchlist will change (new Forever flasks, recipes we discover). Items added later would have no history.

## Decision

1. Until the houses are confirmed, collect **every non-empty house**. Then narrow `config.yaml` to the chosen ones (keeping the history already collected).
2. Store **daily rollups + latest for every commodity item**, and **hourly files for watchlist items** (plus a configurable "also hourly" list).
3. Upload each run's **raw commodity responses (gzipped) as a GitHub Actions artifact** with short retention (e.g. 14–30 days),
   so the aggregates can be rebuilt if we find a bug. Raw data is never committed.

## Consequences

- More files on the `data` branch (daily files for possibly thousands of items). That's acceptable, since the branch has no history (ADR-0003).
- Artifact storage counts against quota on private repos. On public repos it's free (ADR-0005).
- 15 houses × 1 request (+ token + occasional item lookups) per hour is far below known rate limits (to verify, A14).
