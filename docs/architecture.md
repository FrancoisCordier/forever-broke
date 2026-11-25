# Architecture

Status: **Draft.** Sections marked *(proposed)* depend on ADRs that aren't accepted yet.

```
GitHub Actions (cron, hourly)
  └─ collector (TypeScript, Node 22+)
       ├─ OAuth token ──► oauth.battle.net
       ├─ commodities per house ──► eu.api.blizzard.com (dynamic-forever-eu)
       ├─ item metadata (new IDs only) ──► static-forever-eu
       ├─ aggregate → hourly points, daily rollups, latest + signals
       ├─ raw snapshot (gzip) ──► workflow artifact (short retention)      (proposed, ADR-0004)
       └─ commit JSON ──► `data` branch (single squashed commit)            (proposed, ADR-0003)

GitHub Pages (static)
  └─ site (Vite + TS + Preact) ── fetches JSON from the `data` branch
       └─ stockpile in localStorage (+ JSON export/import)

Optional: tools/update_addon.ts ── latest.json ──► Data.lua ──► ForeverScanner addon
```

## Components
| Component | Tech | Notes |
|---|---|---|
| Collector | TypeScript on Node 22+, built-in `fetch`, `yaml`, Vitest *(proposed, ADR-0006)* | Stateless: reads the previous JSON from the `data` branch, writes the new JSON. |
| Scheduler | GitHub Actions `schedule` | Cron is best-effort: runs are often late and sometimes dropped. Schedule at an odd minute (e.g. `:17`). The collector never assumes a run happened on the hour (see "Time" below). |
| Site | Vite + TypeScript + Preact, uPlot for charts *(proposed)* | No backend. Dark theme, mobile-friendly. |
| Addon | Lua, Classic-style UI API *(unverified for Forever)* | Phase 4. |

## Data model
Per house, per item, per snapshot: `min`, `p10`, `median` (both quantity-weighted), `quantity`, `listings`.
All prices are integer copper.

- **Percentiles are quantity-weighted**: a listing of 200 at price X counts 200 times.
- **Time**: each point carries the API snapshot time (from `Last-Modified`), not the job start time.
  If the snapshot is unchanged since the last run, nothing is written.

### Layout on the `data` branch
```
data/
  meta.json                  # last run, per-house last snapshot time, collector version, errors
  items.json                 # id → {name, icon, quality, stackSize}
  {house}/latest.json        # one row per item: current values + signals (site loads this first)
  {house}/hourly/{item}.json # rolling 30 days
  {house}/daily/{item}.json  # daily rollup, kept forever
```
Compact JSON: columnar arrays (`{"t":[...],"min":[...],...}`) rather than an array of objects.
Whether hourly history covers every item or only the watchlist is in [ADR-0004](decisions/0004-collect-broadly.md).

## Signals
Computed in the collector and written into `latest.json`. Thresholds live in `config.yaml`.
A signal **only fires once its window has enough data** (e.g. at least 5 of the 7 days for a 7-day median).
Otherwise the signal reads "insufficient history" rather than firing on two days of data.

| Signal | Rule (defaults from brief) |
|---|---|
| Below median | `p10` ≤ 0.80 × 7-day median |
| Supply squeeze | quantity ≤ 0.70 × 3-day avg **and** price above 3-day avg |
| Spike | `min` ≥ 1.40 × 14-day median |
| Cross-faction gap | ≥ 25% cheaper in another tracked house |
| Craft margin | product × 0.95 − Σ reagents > 0 |

Signals will need a minimum-volume guard (e.g. ignore items with < N units listed), or a single listing
will trigger them all the time. See open questions.

## Config files
- `config.yaml`: region, houses `[{id, label}]`, watchlist groups, thresholds.
- `recipes.yaml`: product → reagents + quantities (+ source/verified flag).

## Failure handling
- Retry once with backoff. If it still fails, skip that house for this run, record it in `meta.json`, and exit non-zero only if *every* house failed.
- The site shows data age prominently ("last snapshot 3h ago").
