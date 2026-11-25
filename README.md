# forever-broke

Personal auction house tracker for **WoW Forever (EU)**: hourly price and supply history, with
buy and sell signals focused on raid consumables. A decision aid only: nothing buys or posts automatically.

Design decisions and verified API facts live in [`docs/`](docs/README.md), which is the source of truth.

## Setup
1. **Battle.net API client**: create one at <https://develop.battle.net/access/clients>
   (service URL can be this repo's URL; the redirect URL is unused).
2. **Local**: `pnpm install`, then `cp .env.example .env` and fill in the client ID and secret.
3. **GitHub secrets**: in the repo's *Settings → Secrets and variables → Actions*, add
   `BNET_CLIENT_ID` and `BNET_CLIENT_SECRET`.
4. The `collect` workflow runs twice an hour (`:17`, `:47`) and force-pushes the aggregated data to the
   `data` branch. Run it by hand from the Actions tab (*collect → Run workflow*).
5. *(Phase 2)* GitHub Pages for the website.

## Commands
| Command | What it does |
|---|---|
| `pnpm explore` | Phase 0 API exploration; raw responses saved to `explore-output/` |
| `pnpm resolve-items <ids…>` / `--search "<name>"` | Verify item IDs against the Forever item database |
| `pnpm collect` | Run the collector locally (`DATA_DIR` defaults to `out/data`) |
| `pnpm test` / `pnpm typecheck` | Unit tests / type check |

## Configuration
- `config.yaml`: houses, watchlist (hourly history), signal thresholds.
- Every commodity on every configured house gets daily history, whether or not it's on the watchlist.
