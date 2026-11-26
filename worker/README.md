# forever-broke-trigger

Cloudflare Worker that starts the `collect` workflow at `:29` and `:54` UTC through `workflow_dispatch`,
because GitHub's own `schedule` drops most runs ([ADR-0009](../docs/decisions/0009-external-cron-trigger.md)).

This folder has its own `package.json`, so `wrangler` stays out of the root install that CI runs.

## One-time setup

1. **GitHub token**: <https://github.com/settings/personal-access-tokens/new>
   - Repository access: _Only select repositories_ → `forever-broke`
   - Permissions → Repository → **Actions: Read and write** (Metadata: read-only is added automatically)
   - Note the expiry date: when the token expires, runs stop (see "Checking it works").
2. **Cloudflare account**: free plan, <https://dash.cloudflare.com/sign-up>.
3. From this folder:

   ```sh
   cd worker
   pnpm install
   pnpm exec wrangler login   # opens the browser
   pnpm secret                # paste the GitHub token when asked
   pnpm deploy
   ```

   `pnpm deploy` should end by listing the two schedules (`29 * * * *`, `54 * * * *`).
   If `pnpm secret` says the Worker doesn't exist yet, run `pnpm deploy` first, then `pnpm secret`.

## Checking it works

- Actions tab: a `collect` run appears within a minute of `:29` / `:54`, labelled "Manually run".
- `pnpm logs` streams the Worker's logs live; a failed dispatch logs `workflow_dispatch failed: <status> …`.
  The Cloudflare dashboard (_Workers → forever-broke-trigger → Logs_) shows past runs.
- **401**: token expired or revoked → make a new one, `pnpm secret`. **403/404**: token lacks _Actions: write_ on this repo.

## Changing the schedule

Edit `crons` in `wrangler.jsonc` and `pnpm deploy`. Keep `.github/workflows/collect.yml`'s backup `schedule` in step.
