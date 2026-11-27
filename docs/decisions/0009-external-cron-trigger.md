# ADR-0009: Cloudflare Worker cron starts the collector

Status: **Accepted** (2026-11-26). Amended 2026-11-27 (owner): no GitHub `schedule` backup; Worker slots
moved from `:29`/`:54` to `:24`/`:39`, to get each snapshot as early as possible.

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

- A **Cloudflare Worker** (`worker/`, free plan) with Cron Triggers at `:24` and `:39` UTC (first `:29`/`:54`) calls
  `POST /repos/FrancoisCordier/forever-broke/actions/workflows/collect.yml/dispatches` on `main`.
- Auth: a **fine-grained PAT** scoped to this repo only, permission _Actions: Read and write_, stored as the
  Worker secret `GITHUB_TOKEN`.
- ~~`collect.yml` keeps its `schedule` as a **backup**.~~ **Amended 2026-11-27 (owner):** the `schedule` is
  removed. The Worker has fired reliably, and the duplicate runs only spent free Actions minutes the owner
  needs for other projects. `workflow_dispatch` is the only trigger; if the Worker stops, the data goes stale
  (the site's "Data … ago" chip shows it) until it's fixed or `pnpm collect:remote` is run by hand.
- `worker/` is a **pnpm workspace** package (`pnpm-workspace.yaml` at the root): one lockfile, one pnpm pin,
  `pnpm -r update` updates everything. CI installs only the root package (`--filter forever-broke`), so
  `wrangler` and the workerd runtime aren't downloaded on every hourly run.
  The trigger logic (`worker/src/trigger.ts`) has no Cloudflare dependency and is tested by the root Vitest.

## Consequences

- One more account to own (Cloudflare) and one manual deploy (`worker/README.md`). Changing the cron times
  means editing `worker/wrangler.jsonc` and redeploying.
- If the PAT expires or is revoked, dispatches fail with 401: visible in the Worker's logs
  (`pnpm worker:logs`), and the site's "Data … ago" chip goes stale. Make a new token, then rerun
  `pnpm worker:secret`. A non-expiring token is acceptable: it can only touch this repo's Actions.
- Runs started by `workflow_dispatch` show up as "Manually run" by the PAT's owner in the Actions tab.
- Unverified: whether GitHub's 60-day inactivity rule (ADR-0005) also blocks `workflow_dispatch` on a
  workflow it has disabled. If it does, the Worker's 4xx errors will show it.
