# Battle.net API notes

Every fact starts as `UNVERIFIED` and only becomes `VERIFIED` once we've observed it ourselves,
with the date and how we checked. Code must not depend on an `UNVERIFIED` fact without a fallback.

| # | Fact | Status | Evidence |
|---|---|---|---|
| A1 | Token: `POST https://oauth.battle.net/token`, `grant_type=client_credentials`, basic auth | VERIFIED | explore-api 2026-11-25 |
| A2 | Host `https://eu.api.blizzard.com` | VERIFIED | 2026-11-25 |
| A3 | Namespaces `dynamic-forever-eu`, `static-forever-eu` (as `?namespace=` query param) | VERIFIED | 2026-11-25 |
| A4 | `GET /data/wow/ruleset/index` → `rulesets: [{id, key}]` (no names). IDs: 1, 2, 3, 15 | VERIFIED | 2026-11-25 |
| A5 | ~~ruleset detail lists houses~~ **Corrected:** `GET /data/wow/ruleset/{id}` → `{id, name, status:{type}, auctions:{href}}`. Houses are at `GET /data/wow/ruleset/{id}/auctions/` → `auctions: [{id, name, key}]` | VERIFIED | 2026-11-25 |
| A5b | Ruleset names: 1 = PvP, 2 = Normal, 3 = Roleplay, 15 = Roleplay PvP | VERIFIED | 2026-11-25 |
| A6 | `GET /data/wow/ruleset/{id}/auctions/{ahId}/commodities` works | VERIFIED | 2026-11-25 (`/auctions/{ahId}` non-commodity not yet tested) |
| A7 | All 4 rulesets list the same 15 houses (110–121, 123–125; no 122). Ruleset in path is ignored: house 110 via ruleset 1 and 15 returned identical listing counts | VERIFIED | 2026-11-25 |
| A7b | Empty houses: 112 (Alliance), 115 (Horde), 118 (Blackwater). Response is just `{_links}`, **no `auctions` key** | VERIFIED | 2026-11-25 |
| A8 | What the 5 sets are. Hypothesis: (110,113,116), (111,114,117), (112,115,118)=empty, (119,120,121), (123,124,125), grouped by ID pattern. The 110/111 ↔ 113/114 ↔ 116/117 pairing is a **guess**. Possibly realm groups or language regions | HYPOTHESIS | |
| A9 | Commodities are per house (different contents per house), not region-wide like retail | VERIFIED | 2026-11-25 |
| A10 | Commodity listing: `{id, item:{id}, quantity, unit_price, time_left}` | VERIFIED | 2026-11-25 |
| A11 | Prices in copper | VERIFIED | Black Lotus ≈ 90,000 = 9g, plausible |
| A12 | Largest response ≈ 11 MB (Horde 114, ~128k listings), fetched in ~300 ms. Snapshots updated ~hourly (Last-Modified times cluster per run) | VERIFIED (size), UNVERIFIED (cadence) | 2026-11-25 |
| A13 | `If-Modified-Since` → `304 Not Modified` | VERIFIED | house 110, 2026-11-25 |
| A14 | Rate limits (retail: 36,000/h, 100/s) apply to Forever namespaces | UNVERIFIED | ~30 calls per run, no throttling seen |
| A15 | `GET /data/wow/item/{id}` in `static-forever-eu` returns item with name; Classic IDs carry over | VERIFIED | 8/8 probe IDs matched, 2026-11-25 (media/icons not yet tested) |
| A16 | Profession data: `/profession/index` → `/profession/{id}` → `skill_tiers[]` → `/profession/{id}/skill-tier/{tier}` (categories → recipes) → `/recipe/{id}` = `{crafted_item, crafted_quantity.value, reagents[{reagent, quantity}]}`. 2,494 recipes | VERIFIED | `pnpm fetch-recipes`, 2026-11-25 |
| A17 | New Forever flasks: 274273 Accuracy, 274274 Aggression, 274275 Precision, 274276 Swiftness | VERIFIED | item search + recipe data, 2026-11-25 |
| A18 | Item search: `/data/wow/search/item?name.en_GB=…` works in static-forever-eu | VERIFIED | 2026-11-25 |
| A19 | Item `purchase_price` is per `purchase_quantity` units (Imbued Vial 30000 / 5 = 60s, matching AH) | PLAUSIBLE | Not every item with a purchase_price is actually vendor-sold |

## Log
- **2026-11-25** First `pnpm explore` run. 12 non-empty houses, 1.3k–139k listings each.
  Alliance candidates for the owner: 110, 111 (big, ~127k listings), 119, 123 (smaller, ~22–27k).
