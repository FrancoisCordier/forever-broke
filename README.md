# Forever Broke

Personal auction house tracker for **WoW Forever (EU)**: hourly price and supply history, with
buy and sell signals focused on raid consumables. A decision aid only: nothing buys or posts automatically.

**Site:** <https://francoiscordier.github.io/forever-broke/>. The buy list for house 110 shows what's cheap now and how far down the AH list to buy, with one-click "copy name" for the AH search box.

Design decisions and verified API facts live in [`docs/`](docs/README.md), which is the source of truth.

## Setup

1. **Battle.net API client**: create one at <https://develop.battle.net/access/clients>
   (service URL can be this repo's URL; the redirect URL is unused).
2. **Local**: `pnpm install`, then `cp .env.example .env` and fill in the client ID and secret.
3. **GitHub secrets**: in the repo's _Settings → Secrets and variables → Actions_, add
   `BNET_CLIENT_ID` and `BNET_CLIENT_SECRET`.
4. The `collect` workflow runs twice an hour (`:29`, `:54`, just after the API refreshes at ~:22) and force-pushes the aggregated data to the
   `data` branch. Run it by hand from the Actions tab (_collect → Run workflow_).
   GitHub's own `schedule` drops most runs, so a Cloudflare Worker starts it on time: deploy it once with
   [`worker/README.md`](worker/README.md) (ADR-0009).
5. **GitHub Pages**: _Settings → Pages → Source: GitHub Actions_. The `pages` workflow builds and deploys
   the site whenever site code changes on `main`. The site reads data live from the `data` branch.

## Commands

| Command                                                | What it does                                                                                                |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `pnpm explore`                                         | Phase 0 API exploration; raw responses saved to `explore-output/`                                           |
| `pnpm resolve-items <ids…>` / `--search "<name>"`      | Verify item IDs against the Forever item database                                                           |
| `pnpm fetch-recipes`                                   | Download all profession recipes + reagents into `recipes.json`                                              |
| `pnpm collect`                                         | Run the collector locally (`DATA_DIR` defaults to `out/data`)                                               |
| `pnpm dev`                                             | Site dev server (reads live data; override with `VITE_DATA_BASE`)                                           |
| `pnpm build` / `pnpm preview`                          | Build the site into `dist/` / serve the build locally                                                       |
| `pnpm test` / `pnpm typecheck` / `pnpm lint`           | Unit tests / type check (collector + site) / Biome                                                          |
| `pnpm worker:deploy` / `worker:secret` / `worker:logs` | Deploy the Cloudflare trigger / set its GitHub token / tail its logs ([worker/README.md](worker/README.md)) |

## Configuration

- `config.yaml`: focus house, raid date, houses, watchlist (hourly history), vendor prices, thresholds.
- Every commodity on every configured house gets daily history, whether or not it's on the watchlist.
