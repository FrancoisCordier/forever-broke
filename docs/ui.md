# UI design (phase 2)

Status: **Proposed** (2026-11-25), awaiting owner feedback.

## Principles

1. **One market**: house 110 only, for now (owner, 2026-11-25). Other houses are still collected (ADR-0004) but hidden.
2. **Answer "what should I buy right now, and up to what price?"** in under 10 seconds, on a phone.
3. **Evidence, not predictions.** We never say "price will rise". We say _why_ an item is interesting:
   it's cheap compared to normal (measured), and it's a raid consumable or reagent (a known demand event on 9 Dec).
   The owner makes the bet.
4. **Built for copy/paste into the WoW AH**: one click copies the exact item name for the AH search box.

## Home: "Buy list"

```
┌────────────────────────────────────────────────────────────┐
│ Raids open in 13d 6h          house 110 · data 23 min old  │
├────────────────────────────────────────────────────────────┤
│ BUY NOW (cheap + raid demand)                               │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Death Lotus                         [⧉ Copy name]       │ │
│ │ 5g 40s now · normal 6g 10s · −11%   ▁▂▃▅▄▃▂▁ 7d         │ │
│ │ Buy up to 4g 88s → 37 units available (~176g)           │ │
│ │ 🏷 Raid: 4 Forever flasks   ↓ supply −18% vs 3d          │ │
│ └────────────────────────────────────────────────────────┘ │
│ ┌ Gromsblood … ┐                                           │
│                                                            │
│ CHEAP, NO RAID LINK (collapsed)                            │
│ WATCH: raid items at normal price (collapsed)              │
└────────────────────────────────────────────────────────────┘
```

- **Sections**, in order:
  1. _Buy now_: cheap (ADR-0007) **and** raid-relevant (watchlist groups flasks/potions/elixirs/forever_raid/herbs…).
  2. _Cheap, no raid link_.
  3. _Watch_: raid items at normal price. This list is the one to check every day.
- **Card**: market vs normal, discount, a 7-day sparkline, and why the item is flagged (badges).
  "Buy up to" price and **units available below it** come from order-book depth (see "Collector changes").
- **Copy name** copies the exact English item name (what the AH search box expects). A toast confirms.
- **Copy all** at the top copies every _Buy now_ name, one per line. That makes it easy to paste into a list, or into an addon later.
- Budget field (default 800g): cards show how many units the budget buys. Nothing more clever than that.

## Other pages

- **Item**: chart (hourly 30 d, daily all-time), raid date marker, recipes using it (from `recipes.json`), current depth.
- **Raid prep**: every watchlist group with now vs normal and the countdown. Craft table: flask cost from reagents vs flask price, when one is listed.
- **Stockpile** (phase 3): lots with qty, unit cost, value at market price, P/L after the 5% cut.
  After 9 Dec this page flips to _Sell_: lots whose market price is ≥ X% above cost and above normal.

## Collector changes needed

- **Depth for watchlist items**: per item, cumulative units at increasing prices, e.g. `[[price, cumQty], …]`
  up to 2× normal, capped at ~20 steps. Stored in `latest-depth.json` (house 110 only).
  This powers "37 units available below 4g 88s".
- Signals computed in the collector per ADR-0007 → `110/signals.json`.

## Tech

Vite + TypeScript + Preact + uPlot, hosted on GitHub Pages. It reads JSON from the `data` branch. Dark theme, mobile-first.
`src/shared` provides the gold formatting and signal logic.
