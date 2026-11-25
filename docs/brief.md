# Project brief: WoW Forever AH Opportunity Scanner (original, unedited)

> How to use: put this file in an empty folder, open it in VS Code, and tell Claude Code:
> "Read BRIEF.md and build the project phase by phase. Ask me before anything you can't verify."

## Goal
A personal tool that tracks **World of Warcraft: Forever** auction house prices (EU) and flags buying/selling
opportunities, with a special focus on stockpiling raid consumable materials before the first raids open
on **Wednesday 9 December 2026** (Barrow Deeps 10p, Hyjal Summit 20p, Onyxia's Lair 40p) and selling into
the demand spike in the following weeks.

It is a decision aid, not a bot: nothing buys or posts automatically.

## Architecture (keep it free and simple)
1. **Collector** – Python 3.12 script run **hourly by GitHub Actions** (cron). Pulls AH data from the
   Battle.net Game Data API, aggregates it, and commits compact JSON to a `data` branch.
2. **Website** – static site (Vite + TypeScript, plain or Preact; no backend) on **GitHub Pages**, reading the
   JSON files. Personal data (stockpile) lives in `localStorage` with JSON export/import.
3. **Addon (phase 4, optional)** – Lua addon that shows the same signals in tooltips, fed by a generated
   data file.

API secrets live only in GitHub Actions secrets (`BNET_CLIENT_ID`, `BNET_CLIENT_SECRET`). Never in the site.

## Battle.net API facts (community-documented, VERIFY each one before relying on it)
- Token: `POST https://oauth.battle.net/token` with `grant_type=client_credentials` (basic auth with client id/secret).
- Host: `https://eu.api.blizzard.com`
- Namespaces: `dynamic-forever-eu` (auctions), `static-forever-eu` (items). Ask for the short name.
- Forever uses **rulesets instead of connected realms**:
  - `GET /data/wow/ruleset/index`
  - `GET /data/wow/ruleset/{id}` (lists auction houses)
  - `GET /data/wow/ruleset/{id}/auctions/{ahId}`
  - `GET /data/wow/ruleset/{id}/auctions/{ahId}/commodities`
- Reported: all 4 rulesets list the **same 15 house IDs** (5 sets × Alliance / Horde / Blackwater), the
  ruleset in the path is ignored, and one set is always empty. **Nobody has confirmed what the 5 sets are.**
- Prices are in copper. Responses can exceed 10 MB. Data refreshes roughly hourly; respect
  rate limits and use `Last-Modified` / `If-Modified-Since` to skip unchanged snapshots.

**Phase 0 task:** write `scripts/explore_api.py` that prints the ruleset index, each house ID, its
listing count, and the min price of a few well-known items, so I can work out which house is mine
(I'll compare with in-game prices). Make the tracked houses a config list, not hardcoded.

## Config (`config.yaml`)
- region: `eu`
- houses: list of `{id, label}` (filled after phase 0)
- watchlist: groups of item IDs (see below)
- thresholds for signals (defaults below)

## Data model
Per house, per item, per hourly snapshot: `min`, `p10`, `median` (quantity-weighted), `quantity`, `listings`.
- `data/{house}/hourly/{item}.json` – last 30 days of hourly points
- `data/{house}/daily/{item}.json` – daily rollups, kept forever
- `data/{house}/latest.json` – one row per item with current values + computed signals (what the site loads first)
- `data/items.json` – item ID → name, icon, quality, stack size (cached from the static namespace)
Use only the commodities endpoint for consumables/mats; include non-commodity auctions as a later option.

## Signals (computed in the collector, shown on the site)
- **Below median**: current `p10` ≥ 20% below 7-day median → buy candidate.
- **Supply squeeze**: quantity down ≥ 30% vs 3-day average while price up → watch / sell.
- **Spike**: current `min` ≥ 40% above 14-day median → sell candidate.
- **Cross-faction gap**: same item ≥ 25% cheaper in another tracked house (Alliance/Horde/Blackwater).
- **Craft margin**: (product market price × 0.95 AH cut) − sum of reagent costs; flag positive margins.
Every signal shows the numbers behind it. No "predictions", just the evidence.

## Raid prep watchlist (resolve every item ID from the API, don't trust names alone)
Recipes need verifying in the Forever item/recipe data; these come from guides:
- Flask of the Titans: 30 Gromsblood, 10 Stonescale Oil, 1 Black Lotus, 1 Crystal Vial (Alchemy 300)
- Greater Fire Protection Potion: 1 Elemental Fire, 1 Dreamfoil, 1 Crystal Vial (Alchemy 290)
- Other Classic flasks: Distilled Wisdom, Supreme Power, Chromatic Resistance
- The 4 new Forever flasks at Alchemy 300 (Flask of Natural Accuracy / Aggression / Precision / Swiftness)
- Other greater protection potions (frost, nature, shadow, arcane), major healing/mana potions
- High-end herbs: Black Lotus, Gromsblood, Dreamfoil, Mountain Silversage, Plaguebloom, Golden Sansam,
  Icecap, Sungrass; Elemental Fire/Water/Earth/Air; Crystal Vial; raid food and elixirs
Recipes go in `recipes.yaml` (product → reagents + quantities) so I can edit them.

## Website pages
1. **Opportunities** – sortable table of active signals, filter by house and signal type.
2. **Raid prep** – watchlist grouped (flasks, potions, herbs, other), each with price now vs 7d/14d median,
   sparkline, and a countdown to 9 Dec. Craft-margin table: sell mats raw vs craft.
3. **Item page** – price + quantity chart (hourly 30d, daily all-time), raid date marked on the chart.
4. **Stockpile** – I enter item, quantity, unit cost, house; shows current value, P/L per item and total,
   and highlights lots that are ≥ X% in profit. Export/import JSON.
Gold formatting: `12g 34s 56c`. Dark theme, readable on mobile.

## Phases
- **Phase 0** – repo setup, API exploration script, I pick my houses. *(Do first, ASAP: history before 9 Dec matters.)*
- **Phase 1** – collector + GitHub Actions hourly workflow + item metadata cache. Unit tests for aggregation
  and signals with fixture data.
- **Phase 2** – website pages 1–3, deployed to GitHub Pages.
- **Phase 3** – stockpile tracker and craft margins.
- **Phase 4 (optional)** – addon: `ForeverScanner` Lua addon reading a generated `Data.lua`; tooltip lines
  with 7d median and signal badges; a script `tools/update_addon.py` that downloads `latest.json` and writes
  `Data.lua` into my AddOns folder (I'll run it before logging in, then `/reload`).

## Rules and constraints
- Respect Blizzard's rules: no automated buying/posting, no memory reading, no input automation.
  Addon only uses permitted UI APIs; purchases always need my own click.
- Keep the repo small: don't commit raw snapshots; rotate hourly files.
- Handle API failures gracefully (retry once, then skip the hour and log).
- README with setup: creating a client at develop.battle.net, adding secrets, enabling Pages.

## Done when
Hourly data is flowing for my houses, the site shows signals and the raid-prep view with real numbers,
and I can log my stockpile and see P/L.
