# UI design (phase 2)

Status: **Accepted** (2026-11-25) and implemented in `site/`. App name: **Forever Broke**.
Visual mockup: <https://claude.ai/artifact/C43TYnZUn2FhDpM87uiJbC> (private to the owner).

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
  1. _For your raids_ (ADR-0012): items of the kit chosen on My kit that are a good buy now (cheap vs normal,
     under craft cost, or under what buyers paid). Need for the chosen nights, buy-up-to price, how many are listed
     under it and what they cost.
  2. _To resell_ (ADR-0012): cards with buy N up to X, relist at the average price paid, sells ~N/day, profit after
     the cut. Until 12 h of sales data exist, a note says how many hours there are so far.
  3. _Cheap raid items_: cheap (ADR-0007) **and** raid-relevant (watchlist groups flasks/potions/elixirs/forever_raid/herbs…).
  4. _Under craft cost_ (ADR-0010): raid consumables selling ≥ 10% under their reagents' cost. Table with the recipe.
  5. _Watch_: raid items at normal price.
  6. _Cheap, no raid link_ (collapsed).
- **Item page** also shows "Sold per day (estimate)" with the average price paid and hours of data.
- **Card**: market vs normal, discount, a 7-day sparkline, and why the item is flagged (badges).
  "Buy up to" price and **units available below it** come from order-book depth (see "Collector changes").
- **Copy name** copies the exact English item name (what the AH search box expects). A toast confirms.
- **Copy all** at the top copies every _Buy now_ name, one per line. That makes it easy to paste into a list, or into an addon later.
- Budget field (default 800g): cards show how many units the budget buys. Nothing more clever than that.
- **Vendor items are hidden everywhere** (owner, 2026-11-25): anything in `config.yaml` → `vendorPrices`
  (Crystal Vial, Imbued Vial). Their AH price is capped by the vendor, so they're noise. They still count in craft
  costs (at the cheaper of AH and vendor price). To hide another vendor item, add it to `vendorPrices`.
- **Lists have search, a group filter and sortable columns**: the Watch table and Raid prep (one filter for the
  whole page). Buy-now cards have a sort menu (biggest discount, cheapest to buy out, most units, name).

## Other pages

- **Item**: chart (hourly 30 d, daily all-time), raid date marker, recipes using it (from `recipes.json`), current depth.
- **My kit** (`#/kit`, ADR-0014): pick a class, then a spec; each spec has a default kit from `config.yaml` →
  `kits`, with a link to the guide it comes from. One row per slot: pick the item when there are options, units
  per night (editable), need = per night × raid nights, cost from walking today's listings cheapest first, and
  "why buy now" tags (cheap, under craft cost, under what buyers paid). Unlisted items are named but not priced.
  Soulbound items (`config.yaml` → `soulbound`) say "farm it" and stay out of the cost and the shopping list.
  "Customise" copies the kit into the viewer's own (★ in the spec row): rename, remove a slot or an option, add
  a watchlist item as a new slot or an alternative, "Copy link" to share it (`#/kit?share=…` offers "Add to my
  kits"), delete. Choices and custom kits are kept in localStorage. "Copy shopping list" copies the item names.
- **Stars** (ADR-0014): a ☆ before every item name (and on the item page) follows it; Raid prep and the Buy list's
  watch table have a "Starred only" filter. Kept in localStorage, synced between open tabs.
- **Raid prep**: every watchlist group with now vs normal and the countdown. Craft table: flask cost from reagents vs flask price, when one is listed.
- **Stockpile** (`#/stockpile`, ADR-0011): add a lot (any item seen on the AH, qty, price paid typed as `11g 55s`
  or `11.55`, why: to resell / for my raids / alt's levelling mats). Header: paid, worth after the 5% cut, P/L.
  _Sell now_ cards on top when a resell or alt lot meets both sell rules. One table per purpose: qty (edit it down
  after selling part), paid, now, normal, sell-at price, worth, P/L, status (Sell / At target, not a spike / Hold /
  Keep / Not listed). Copy backup / Restore moves lots between browsers. The item page has "Add to stockpile".
  There's no date switch: the Sell flag appears whenever the numbers meet the rules.

## Data: `{focusHouse}/buylist.json`

Written by the collector for the focus house only (see architecture.md). One entry per watchlist item:
the ADR-0007 signal (now, normal, change, buy-up-to, units and cost up to it, supply change, 7-day spark),
the current **ladder** (units per price, cheapest first, ≤ 25 rows), recipes that use it (`uses`, raid ones flagged),
its own recipe if crafted, and vendor price. `reagentPrices` gives the current p10 of every reagent of those recipes.

## Tech

See [ADR-0008](decisions/0008-site-stack.md): Vite + React + TypeScript on GitHub Pages, hash routing, Recharts.
