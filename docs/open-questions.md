# Open questions

Each one is resolved into an ADR, or turned into a fact in `api-notes.md`, then removed from here.

## Owner context (answered)

- Plays on the **PvP ruleset, Alliance** (2026-11-25). Phase 0 must find which house IDs that maps to.
  Note the community report (A7) says the ruleset in the URL path is ignored and all rulesets list
  the same houses, so "PvP" may not map directly to a house set. To be checked against in-game prices.
  → Verified (A7): rulesets are not separate markets.
- **Owner house = 110 (Alliance), high confidence** (2026-11-25). In-game Black Lotus: 9g 70s 96c, 685 available;
  API house 110 snapshot 16:22 GMT: 9g 75s 95c, 713 units. Other Alliance houses: 188 / 50 / 53 units.
  Re-confirm against a later snapshot. Same-set Horde/Blackwater houses are probably 113/116 (A8 hypothesis).
- Character gold on 2026-11-25: ~806g (indicative stockpile budget).

- **Scope: house 110 only** for UI and signals (2026-11-25). Other houses keep being collected (ADR-0004), at no cost.
- **No addon for now**, maybe later (2026-11-25).

## Need your answer

1. **UI proposal** in [ui.md](ui.md) and price definitions in [ADR-0007](decisions/0007-price-definitions.md): OK?

## Technical, to resolve during Phase 0/1

- Hourly history for every commodity, or only for the watchlist? (ADR-0004 proposes: aggregates for all, hourly files for watchlist + anything that moves.)
- Min-volume guard defaults for signals.
- How the site reads data: raw.githubusercontent.com from the `data` branch, or copy data into the Pages deploy on each run? (CORS and caching are different for each.)
