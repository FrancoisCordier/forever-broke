# ADR-0002: Collector first, everything else later

Status: **Accepted** (2026-11-25)

## Context

Today is 25 Nov 2026. Raids open 9 Dec, 14 days from now. History can't be backfilled: an hour that
isn't collected is lost for good. A 14-day spike baseline only fills the day raids open.

## Decision

Work in this order: (1) verify the API, (2) get a minimal collector running hourly in production,
(3) everything else. Signals, website and addon are built afterwards, on top of stored history.
Signals are pure functions of stored history, so they can be added or changed later and recomputed.

## Consequences

- The first version of the collector may be crude. That's fine, as long as the data it stores is
  correct and complete enough to recompute from.
- Because aggregation bugs would corrupt irreplaceable data, we also keep raw snapshots for a while (ADR-0004).
