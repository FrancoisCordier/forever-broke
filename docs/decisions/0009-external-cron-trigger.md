# ADR-0009: Cloudflare Worker cron starts the collector

Status: **Accepted** (2026-11-26)

## Context

The `collect` workflow's GitHub `schedule` (`:29`, `:54`) barely fires. The cron was added on 2026-11-25 ~17:25Z.
By 2026-11-26 09:18Z, about 32 slots had passed and only 2 had produced a run (03:14Z, 03:42Z, each 13–20 min
late). Nothing was wrong with the setup: the workflow is on the default branch and active, the repo is public
and not a fork, and the commit authors are linked to the owner's account. Disabling and re-enabling the
workflow didn't help either. GitHub documents `schedule` as best-effort ("may be delayed… some queued jobs may
be dropped"), and a paid plan doesn't change that. Hourly price history needs most hours captured.

Options: an outside cron calling the `workflow_dispatch` API, either cron-job.org (configured in a web form)
or a Cloudflare Worker with a Cron Trigger (code in the repo).

## Decision

- A **Cloudflare Worker** (`worker/`, free plan) with Cron Triggers at `:29` and `:54` UTC calls
  `POST /repos/FrancoisCordier/forever-broke/actions/workflows/collect.yml/dispatches` on `main`.
- Auth: a **fine-grained PAT** scoped to this repo only, permission _Actions: Read and write_, stored as the
  Worker secret `GITHUB_TOKEN`.
- `collect.yml` keeps its `schedule` as a **backup**. Duplicate runs are harmless: the `collect` concurrency
  group runs them one at a time, and an unchanged snapshot is a 304 that writes nothing.
- `worker/` has its own `package.json`, so `wrangler` isn't added to the root install that CI runs every hour.
  The trigger logic (`worker/src/trigger.ts`) has no Cloudflare dependency and is tested by the root Vitest.

## Consequences

- One more account to own (Cloudflare) and one manual deploy (`worker/README.md`). Changing the cron times
  means editing `worker/wrangler.jsonc` and redeploying, in addition to `collect.yml`.
- The PAT expires. When it does, dispatches fail with 401: visible in the Worker's logs
  (`pnpm logs` in `worker/`), and the site's "Data … ago" chip goes stale. Renew the token, then rerun
  `pnpm secret`.
- Runs started by `workflow_dispatch` show up as "Manually run" by the PAT's owner in the Actions tab.
- Unverified: whether GitHub's 60-day inactivity rule (ADR-0005) also blocks `workflow_dispatch` on a
  workflow it has disabled. If it does, the Worker's 4xx errors will show it.
