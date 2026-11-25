# Docs — source of truth

This folder is the reference for the project. If code and docs disagree, either the code
is wrong or a decision changed and the doc wasn't updated. Fix whichever is wrong.

| File | What it holds |
|---|---|
| [brief.md](brief.md) | The original brief, kept unchanged. Historical input, not the spec. |
| [overview.md](overview.md) | Goal, scope, non-goals, timeline. |
| [architecture.md](architecture.md) | Components, data flow, storage layout, data model. |
| [api-notes.md](api-notes.md) | Battle.net API facts, each with a verification status. |
| [open-questions.md](open-questions.md) | Things not yet decided. Each one becomes an ADR once it's decided. |
| [decisions/](decisions/) | ADRs (architecture decision records), one per decision, numbered. |

## ADR conventions
- File: `decisions/NNNN-short-title.md`. Status is one of `Proposed`, `Accepted`, `Superseded by NNNN`.
- Never rewrite an accepted ADR's decision. Write a new one that supersedes it.
- Keep each ADR short: context, decision, consequences.
