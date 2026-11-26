# Architecture

Status: **Collector, buy-list signals and site implemented (phases 1–2, 2026-11-25).** Stockpile (phase 3) not yet built.

```
Cloudflare Worker cron (:29, :54) ── workflow_dispatch ──┐            (ADR-0009)
GitHub Actions `collect` workflow ◄─────────────────────┘  (+ GitHub `schedule` as backup)
  └─ collector (TypeScript, Node 22+)
       ├─ OAuth token ──► oauth.battle.net
       ├─ commodities per house ──► eu.api.blizzard.com (dynamic-forever-eu)
       ├─ item metadata (new IDs only) ──► static-forever-eu
       ├─ aggregate → hourly points, daily rollups, latest
       ├─ focus house only: buylist.json (signals, AH depth, raid tags)   (ADR-0007)
       ├─ raw snapshot (gzip) ──► workflow artifact (short retention)      (ADR-0004)
       └─ commit JSON ──► `data` branch (single squashed commit)            (ADR-0003)

GitHub Pages (static, redeployed only when site code changes)
  └─ site (Vite + React + TS) ── fetches JSON live from the `data` branch   (ADR-0008)
       └─ budget (later: stockpile) in localStorage

Later, maybe: tools/update_addon.ts ── buylist.json ──► Data.lua ──► addon
```

## Components

| Component | Tech                                                                | Notes                                                                                                                                                                                                                                                                                                                                                                                |
| --------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Collector | TypeScript on Node 22+, built-in `fetch`, `yaml`, Vitest (ADR-0006) | Stateless: reads the previous JSON from the `data` branch, writes the new JSON.                                                                                                                                                                                                                                                                                                      |
| Scheduler | Cloudflare Worker Cron Trigger → `workflow_dispatch` (ADR-0009)     | GitHub's `schedule` stays as a backup but barely fired (2 of ~32 slots on day one). Runs at `:29` and `:54` UTC. Worker in `worker/`. API snapshots refresh at ~:22 past the hour, so `:29` catches the new one and `:54` is a safety net that costs almost nothing (304) when the snapshot is unchanged. The collector never assumes a run happened on the hour (see "Time" below). |
| Site      | Vite + React + TypeScript, Recharts (ADR-0008)                      | No backend. Dark theme, mobile-friendly. `site/`; deployed by `.github/workflows/pages.yml`.                                                                                                                                                                                                                                                                                         |
| Addon     | Lua, Classic-style UI API _(unverified for Forever)_                | Not planned for now (owner, 2026-11-25).                                                                                                                                                                                                                                                                                                                                             |

## Data model

Per house, per item, per snapshot: `min`, `p10`, `median` (both quantity-weighted), `quantity`, `listings`.
All prices are integer copper.

- **Percentiles are quantity-weighted**: a listing of 200 at price X counts 200 times.
- **Time**: each point carries the API snapshot time (from `Last-Modified`), not the job start time.
  If the snapshot is unchanged since the last run, nothing is written.

### Layout on the `data` branch

```
data/
  meta.json                  # last run, per-house status/Last-Modified/errors, snapshots per day
  config.json                # copy of config.yaml for the site
  items.json                 # id → {name, quality, cls, sub, level}
  {house}/latest.json        # one row per item: current values
  {house}/hourly/{item}.json # rolling 30 days
  {house}/daily/{item}.json  # daily rollup, kept forever
  {focusHouse}/buylist.json  # what the site loads: signals + depth + recipes per watchlist item (docs/ui.md)
```
Compact JSON: columnar arrays (`{"t":[...],"min":[...],...}`) rather than an array of objects.

- Hourly files: **watchlist items only**. When an item is absent from a snapshot, it gets a point with `qty 0` and `null` prices.
- Daily files: **every commodity item** on every house. `min` is the lowest min of the day. `p10`/`median`/`qty`/`listings` are the mean over the snapshots where the item was present, and `n` counts them. `meta.snapshotsPerDay` gives the denominator, so presence = `n / snapshotsPerDay`.
- `latest.json` rows: `[min, p10, median, qty, listings]`.
- `config.json` on the data branch mirrors `config.yaml` (houses, watchlist, thresholds), so the site doesn't have to parse YAML.
- Measured on 2026-11-25: ~13k files, ~1.7 MB total. One run takes ~5 s for 12 houses (item metadata is a one-time ~80 s).

## Signals

Computed in the collector (`src/shared/signals.ts`) for the focus house and written into `buylist.json`.
Thresholds live in `config.yaml`.

| Signal           | Rule                                                                                        | Status      |
| ---------------- | ------------------------------------------------------------------------------------------- | ----------- |
| Cheap            | `p10` ≤ (1 − 20%) × 7-day median of `p10`, ≥ 20 units listed, ≥ 1 day of history (ADR-0007) | Implemented |
| Supply change    | quantity now vs mean over the previous 3 days (shown, not a signal by itself)               | Implemented |
| Craft margin     | product × 0.95 − Σ reagents (site, Raid prep page)                                          | Implemented |
| Under craft cost | market ≤ (1 − 10%) × reagent cost, ≥ 20 units listed; no history needed (ADR-0010)          | Implemented |
| Spike / sell     | for the stockpile phase                                                                     | Not yet     |
| Cross-faction    | dropped for now: owner trades on house 110 only                                             | Not planned |

**Raid relevance** (`src/collector/raid.ts`): an item is a raid consumable if it's on the watchlist and its item
class is Consumable. An item is raid-relevant if it is one, or is a reagent in a recipe that makes one.
Season of Discovery recipes and items named "NYI" are ignored.

When house 110's snapshot is unchanged (304), the buy list is rebuilt from the stored hourly files and the previous
ladders, so config or recipe changes apply on the next run.

## Config files

- `config.yaml`: region, focus house, raid date, houses, watchlist groups, vendor prices, thresholds, raid kits.
  Kits (per class/spec: slots of "pick one of these items", units per raid night) are copied into `buylist.json`
  for the My kit page. Every kit item must be on the watchlist; `loadConfig` rejects the file otherwise.
- `recipes.json`: every profession recipe with reagents, generated from the API (`pnpm fetch-recipes`). Don't edit by hand.

## Failure handling

- Retry once (5 s delay) on network error, 429 or 5xx.
- If it still fails, skip that house for this run, record it in `meta.json`, and exit non-zero only if _every_ house failed.
- A house that previously had ≥ 1000 listings and returns none is **rejected** (previous data kept).
- A snapshot whose `Last-Modified` equals the stored one is skipped, whether it comes back as a 304 or a 200.
- The site shows data age prominently ("last snapshot 3h ago").
