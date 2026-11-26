# ADR-0012: Estimate sales from listing ids; "To resell" and "For your raids"

Status: **Accepted** (2026-11-26)

## Context

The owner wants two clear answers: _buy this, it's cheap, you can resell it for more_ and _buy this, it's cheap,
you need it for your raids_. Recording trades by hand (ADR-0011 stockpile) is impractical without an addon.
"Cheap vs normal" (ADR-0007) compares listing prices with listing prices. It doesn't say whether anything sells,
or at what price, which is what reselling depends on.

Listing ids are stable between hourly snapshots (A20, checked on two house 110 snapshots: 76k listings in both,
none changed price or grew, 422 shrank from partial purchases). And a commodity buyer always gets the cheapest
listings first.

## Decision

- **Sales estimate** (`src/shared/sales.ts`), watchlist items on the focus house, each pair of snapshots ≤ 3 h
  apart: walk the previous snapshot's listings cheapest first. Units gone or reduced count as bought, at their
  price, until the first listing that is still fully there. A vanished listing doesn't count if it was SHORT
  (expired) or a new listing with the same quantity appeared (cancelled and reposted).
  This is a **lower bound**: a listing posted and bought within the hour is invisible.
- Storage on the data branch: `{house}/book.json` (the previous snapshot's listings, watchlist only) and
  `{house}/sales/{item}.json` (`t`, `dt`, `units`, `value`, rolling 30 days). Summary over the last 3 days in
  `buylist.json`: units per day and average price paid.
- **To resell** (`flip`): relist price R = average price paid over the last 3 days. Buy up to
  R × 0.95 / (1 + `flipMarginPct`) (15%). Quantity = units listed under that, capped at `flipHoldDays` (2) days of
  sales. Flagged only with ≥ `flipMinSalesHours` (12) hours of sales data and ≥ `flipMinProfitGold` (5g) profit.
  Vendor items are never flagged.
- **For your raids**: items in the viewer's kit (My kit, localStorage) for which now is a good time to buy:
  cheap vs normal (ADR-0007), under the cost of its reagents (ADR-0010), or ≥ 10% under the average price paid
  (with 12 h of sales data). Shows how many you need for the chosen raid nights and what that costs under the price.
- These two sections lead the Buy list. The older sections (cheap raid items, under craft cost, watch) stay below.

## Consequences

- "You can resell it for more" rests on measured sales, not on listing prices. It still assumes the next days
  look like the last 3: the raid-opening spike can't be measured before it happens, and the page says nothing
  about it until it shows up in sales.
- Undercounting makes the "sells ~N/day" cap conservative.
- `book.json` adds roughly 100–300 KB to the data branch (watchlist listings of one house). That's fine with
  the squashed branch (ADR-0003).
- The stockpile page (ADR-0011) stays, but it's no longer what the buy decisions depend on.
