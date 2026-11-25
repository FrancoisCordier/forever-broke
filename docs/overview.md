# Overview

## Goal
A personal decision aid for the **WoW Forever (EU)** auction house. It records price and supply history
and flags buy and sell opportunities, with a focus on raid consumables around the first raid opening on
**Wed 9 Dec 2026**.

## Non-goals
- No automated buying or posting, no memory reading, no input automation (see [ADR-0001](decisions/0001-decision-aid-only.md)).
- No predictions or ML. Signals are rules applied to observed data, and each one shows the numbers behind it.
- No multi-user features or accounts. One user, one browser.

## Timeline (as of 2026-11-25)
| Date | Milestone |
|---|---|
| Wed 25 Nov | Docs, repo, Phase 0 exploration |
| **ASAP, target Thu 26 Nov** | Collector running hourly. **Every hour without it is history we can never get back.** |
| ~2 Dec | 7-day signal windows become meaningful |
| Wed 9 Dec | Raids open. 14-day windows only just filled. |
| Dec → Jan | Sell-side signals (spike, squeeze) matter most |

The order of work follows from the timeline ([ADR-0002](decisions/0002-collect-first.md)): the collector
has to be running before anything else gets polish. The website can be built afterwards on top of data
that's already being recorded.

## Phases (revised from the brief)
- **Phase 0**: repo, docs, `scripts/explore-api.ts`, verify the API facts in [api-notes.md](api-notes.md).
- **Phase 1**: collector + hourly workflow, **collecting broadly from day one** ([ADR-0004](decisions/0004-collect-broadly.md)). Unit tests for aggregation.
- **Phase 2**: website: Opportunities, Raid prep, Item page. Signals can land here (they're computed from stored history, so they don't block collection).
- **Phase 3**: stockpile tracker + craft margins (`recipes.yaml`).
- **Phase 4 (optional)**: `ForeverScanner` addon + `tools/update_addon.ts`.
