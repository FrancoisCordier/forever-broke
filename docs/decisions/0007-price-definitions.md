# ADR-0007: Definitions of "market price" and "normal price"

Status: **Proposed** (2026-11-25)

## Context

The UI says things like "price is low compared to normal". Those words need one precise meaning,
used the same way everywhere (site, signals, stockpile P/L, craft margins).

## Decision

- **Market price** = current **p10** (quantity-weighted 10th percentile).
  It's what you'd actually pay for a meaningful quantity. The single cheapest listing (`min`) is often
  1 unit and easy to manipulate, so it's shown but never used for decisions.
- **Normal price** = **median of hourly p10 over the last 7 days**.
  Before 7 days of history exist, use what there is and show "based on N days".
- **Discount** = `1 − market / normal`. "Cheap" = discount ≥ `thresholds.belowMedianPct` (20%).
- **Buy-up-to price** = `normal × (1 − belowMedianPct)`: the highest unit price still counted as cheap.
- Stockpile value and craft margins use market price; selling applies the 5% AH cut.

## Consequences

- Everything the user sees can be explained with two numbers: market and normal.
- Needs hourly history, so only watchlist items get "cheap" signals. Other items only get daily-based info.
