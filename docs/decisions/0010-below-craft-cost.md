# ADR-0010: "Under craft cost" signal

Status: **Accepted** (2026-11-26)

## Context

The ADR-0007 "cheap" signal compares an item with its own history, so it needs at least a day of data and says
nothing about whether that history is itself high or low. On 2026-11-26 several raid consumables on house 110
were listed well under what their reagents cost (Elixir of the Mongoose 86s vs 1g 27s of herbs). Alchemists
levelling the profession sell their skill-up crafts at a loss. That's a measured fact on one snapshot, it needs
no history, and it puts a floor under the item: if listings dry up, crafters won't restock below reagent cost.

## Decision

- **Craft cost** = Σ reagent qty × reagent price, divided by units made. Reagent price = current p10 from
  `latest.json` (ADR-0007 market price), or the vendor price (`vendorPrices`) when that's lower. Null if any
  reagent isn't listed. Recipe = the first non-Season-of-Discovery recipe in `recipes.json` (as in `raid.ts`).
- **Under craft cost** = market price ≤ craft cost × (1 − `thresholds.belowCraftPct`) (default 10%), with at least
  `minUnitsListed` units listed. Vendor items are never flagged.
- Computed in the collector (`craftCost`, `belowCraft` in `src/shared/signals.ts`) and written per item into
  `buylist.json` (`craftCost`, `craftChange`, `belowCraft`). The site's Raid prep craft table uses the same function.
- Shown as its own Buy list section ("Under craft cost", raid items only) and as a tag on cards and on My kit.
  It is not merged into "Buy now": the reason to buy is different, and the UI says which one applies.

## Consequences

- Works from the first snapshot, unlike "cheap".
- Says nothing about where the price goes. A product can stay under craft cost for weeks while players level
  Alchemy. It means "cheaper to buy than to craft, and unlikely to fall far", not "will rise".
- Craft cost moves with reagent prices: a reagent spike (e.g. Plaguebloom 27s → 49s on 26 Nov) can flag a product
  without the product getting cheaper. The table shows the recipe so that's visible.
