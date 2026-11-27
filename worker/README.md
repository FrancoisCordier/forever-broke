# forever-broke-trigger

Cloudflare Worker that starts the `collect` workflow at `:24` and `:39` UTC through `workflow_dispatch`,
because GitHub's own `schedule` drops most runs ([ADR-0009](../docs/decisions/0009-external-cron-trigger.md)).

It's a package in the root pnpm workspace: a plain `pnpm install` at the root installs `wrangler` too,
while CI installs only the root package. All commands below run **from the repo root**.

## One-time setup

1. **GitHub token**: <https://github.com/settings/personal-access-tokens/new>
   - Repository access: _Only select repositories_ → `forever-broke`
   - Permissions → Repository → **Actions: Read and write** (Metadata: read-only is added automatically)
   - Expiration: no expiration is acceptable (the token can only touch this repo's Actions).
     With an expiry date, set a reminder: runs stop when it expires.
2. **Cloudflare account**: free plan, <https://dash.cloudflare.com/sign-up>. Then open **Workers & Pages** in the
   dashboard once: that creates the account's workers.dev subdomain, which Cloudflare requires before it accepts
   Cron Triggers (even though this Worker has no URL). Without it, `worker:deploy` uploads the code but fails on
   the schedules with error 10063.
3. From the repo root:

   ```sh
   pnpm install
   pnpm worker:login    # opens the browser
   pnpm worker:deploy   # should end by listing the schedules 24 * * * * and 39 * * * *
   pnpm worker:secret   # paste the GitHub token when asked
   ```

## Checking it works

- Actions tab: a `collect` run appears within a minute of `:24` / `:39`, labelled "Manually run"
  (first one: 2026-11-26 10:29:45Z, 45 s after the slot).
- `pnpm worker:logs` streams the Worker's logs live; a failed dispatch logs `workflow_dispatch failed: <status> …`.
  The Cloudflare dashboard (_Workers → forever-broke-trigger → Logs_) shows past runs.
- **401**: token expired or revoked → make a new one, `pnpm worker:secret`. **403/404**: token lacks _Actions: write_ on this repo.

## Updating

- Packages: `pnpm -r update` at the root updates the root and the Worker together, then `pnpm worker:deploy`.
- Schedule: edit `crons` in `wrangler.jsonc` and `pnpm worker:deploy`. The Worker is the only trigger: there's no
  GitHub `schedule` backup in `collect.yml` (ADR-0009, amended 2026-11-27).
