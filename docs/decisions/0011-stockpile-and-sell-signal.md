# ADR-0011: Stockpile in the browser, and the sell signal

Status: **Accepted** (2026-11-26)

## Context

Phase 3 (docs/overview.md): record what the owner buys ahead of the 9 Dec raid opening, value it, and say when to
sell. Lots are personal and small (tens of rows). There's no backend (ADR-0008), and the repo is public (ADR-0005),
so lots can't go in the repo or the data branch. The owner buys for three different reasons: to resell, for their
own raids, and (2026-11-26) herbs held for levelling an alt's Alchemy, which can't be used before the alt is level 35.

## Decision

- **Lots live in `localStorage`** (`forever-broke.stockpile`), one browser only. "Copy backup" puts the JSON on the
  clipboard and "Restore" replaces the lots from a pasted backup: that's how they move between devices.
  A lot = item, qty (edited down when part is sold), unit cost, purpose (`resell` / `own` / `alt`), date.
- **Any item** can be a lot, not only watchlist items. Market data: watchlist items use the buy list (hourly
  normal, ADR-0007). Others use `latest.json` for the market price and their daily file for the normal price
  (median of the last 7 daily p10).
- **Value** = qty × market price × 0.95 (AH cut). P/L = value − qty × unit cost.
- **Sell flag** (resell and alt lots only), both rules:
  1. market × 0.95 ≥ unit cost × (1 + `sellAboveCostPct`) (default 30%), so it's worth the effort, and
  2. market ≥ normal × (1 + `sellAboveNormalPct`) (default 15%): a spike, not a new normal price.
     Normal is a 7-day median, so it lags a spike by design.
- Thresholds live in `config.yaml` → `thresholds` and are copied into `buylist.json` (`sell`).
- Own-use lots are never flagged. The page shows what they're worth; selling them is the owner's call.

## Consequences

- No accounts, no server, nothing personal in the public repo. Clearing site data loses the lots unless backed up.
- After 9 Dec the same page is the sell list. It doesn't change by date: the flag appears when the numbers say so.
- "Sell at" (the price that meets rule 1) is shown even when the spike rule isn't met, so the owner can list there
  if they choose.
- No realized P/L yet: selling part of a lot means lowering its quantity.
