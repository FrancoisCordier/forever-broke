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

## Home: "Deals" (ADR-0014 step 1)

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ Deals                                              Budget per deal [800]  [⧉ Copy names] │
│ 4 to buy, 2 to flip and 1 to sell. Best: Flask of Chromatic Resistance, +232g profit.  │
│ Show [All 7|Buy 4|Flip 2|Sell 1]  Off [Any|20+|30+|50+|70+]  Sells/day [Any|1+|5+|20+] │
│ [Item name]  [☆ Starred only]  [My kit only]                                          │
├───────────────────────────────────────────────────────────────────────────────────────┤
│ Item          Verdict · why          Profit   Do                      Sold/day  Days │
│ ☆ Flask of…   FLIP −54% vs paid      +232g    Buy 19 up to 22g 57s    9.6       2.0  │
│                                      after    ≈ 262g · resell at 27g  70 listed      │
│ ☆ Elixir of…  BUY −11% vs reagents   +3g      Buy 24 up to 83s 81c    1,245     —    │
│ Your kit ·                           saved    ≈ 20g · for your raids                 │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

One ranked list replaces the old Buy list sections (For your raids, To resell, Cheap raid items, Under craft
cost). Logic is in `site/src/lib/deals.ts` (pure, tested in `test/deals.test.ts`). Each row is one of:

- **BUY, for your kit**: an item of the kit chosen on My kit that is a good buy now (cheap vs normal, ≥ 10% under
  its reagents' cost, or ≥ 10% under what buyers paid with ≥ 12 h of sales data). Buys what the chosen nights
  need, up to the best of those limits; the value is what that **saves** vs the reference price.
- **BUY, to stock** (not in the kit, not a flip): the same reasons, but to resell at its normal price. Only
  units that beat normal × 0.95 by 15% (`STOCK_MARGIN`, as the flip margin), at most 7 days of sales
  (`STOCK_DAYS`), at least 5g profit after the cut (`MIN_PROFIT`, as `flipMinProfitGold`). Skipped when nothing
  sold over ≥ 12 h of data.
- **FLIP**: the collector's `resale` (ADR-0012), cut to the budget.
- **SELL**: a stockpile lot that meets both sell rules (ADR-0011), with its P/L.

A kit item that is also a flip gets both rows. Vendor and soulbound items never appear.

- **Columns**: item (with kit slot or lot date), verdict and reasons (discount vs normal / reagents / what buyers
  paid), profit (after the cut) or saved, what to do (buy N up to X ≈ cost · resell at Y; sell N at the market),
  sold per day with units listed, days to sell (units ÷ sold per day), 7-day sparkline with hours of sales data
  (amber under 12 h), copy name (icon). Sortable on profit, discount, sold per day, days to sell and name;
  starred items come first on the default profit sort.
- **Filters** (kept in localStorage): verdict with counts, % off (hides SELL rows), sells per day, item name,
  starred only, my kit only. "Clear" resets them.
- **Budget per deal** (default 800g, 0 = no limit) caps each row, not the total: units are taken cheapest first
  until the price limit or the budget; "budget limit" shows when it cut a row.
- **Copy names** copies every listed name, one per line. A notice says when "normal" has under 7 days of history
  or sales data under 12 h.
- **Item page** also shows "Sold per day (estimate)" with the average price paid and hours of data.
- **Copy name** copies the exact English item name (what the AH search box expects). A toast confirms.
- **Vendor items are hidden everywhere** (owner, 2026-11-25): anything in `config.yaml` → `vendorPrices`
  (Crystal Vial, Imbued Vial). Their AH price is capped by the vendor, so they're noise. They still count in craft
  costs (at the cheaper of AH and vendor price). To hide another vendor item, add it to `vendorPrices`.
- Raid prep keeps the browse-everything view (every watchlist group, with search, group filter and sortable columns).

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
- **Stars** (ADR-0014): a ☆ before every item name (and on the item page) follows it; Deals and Raid prep
  have a "Starred only" filter, and Deals shows starred items first. Kept in localStorage, synced between open tabs.
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
