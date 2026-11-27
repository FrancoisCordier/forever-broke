# ADR-0014: A fast decision tool: Deals, class kits, custom kits, stars

Status: **Steps 1–4 Accepted** (owner, 2026-11-27: Deals page, class picker, kits for every spec with a source,
custom kits, stars). The rest **Proposed**.

## Context

The owner wants a fast buy/flip/sell decision tool in the spirit of goldcapped.com and forever-ah.com, without
an addon (ADR-0001 still holds: the site advises, it never acts in game). Today's answers are spread over
Buy list, For your raids, Resell, Raid prep and My kit, and only the watchlist is priced.

What we take from those sites, and what we don't:

- **Taken:** one ranked deals list with a verdict, days to sell, discount and sales-rate filters (forever-ah
  "Deals"), auctions under the vendor sell price, craft profit per day over all recipes, movers with a noise
  floor (≥ 20 units and ≥ 3 auctions), price by hour of day, stars, alerts.
- **Not taken:** region value. Commodities are per auction house on Forever (A9) and the ruleset doesn't split
  them (A7), so house 110's own history stays the reference price. Also guides, farm routes, sniping (one
  snapshot an hour can't snipe), and stacks that can't be split (A20: they can).
- **Our own collector stays the source of truth.** forever-ah's free API can be used to cross-check our
  numbers, never as an input (it would be a new dependency we can't vet).

## Decision

Phased; each phase is one PR, and ui.md is updated as each lands.

1. **Deals page as the home page.** One list; each row is BUY (cheap vs normal, under craft cost, for your
   kit), FLIP (resell rule of ADR-0012) or SELL (stockpile lot, ADR-0011) with: buy up to, sell at, profit
   per unit, sold per day, **days to sell** (units you'd buy ÷ sold per day), and confidence (hours of sales
   data, units listed). Sorted by expected profit within the budget. Filters: verdict, % off (20/30/50/70),
   sells per day (1+/5+/20+), starred only, my kit only. Buy list, For your raids and Resell become filters
   of it; Raid prep's per-group tables go (the item page covers one item); "Craft or buy?" moves to step 4.
   **As built (2026-11-27):**
   - BUY for your kit buys the nights' need up to the best limit of its reasons (cheap: the collector's
     `upTo`; under craft cost: reagents × 0.9; under what buyers paid: × 0.9 with ≥ 12 h of data), and shows
     what that **saves**, not a profit.
   - BUY to stock (any other good buy that isn't a flip) resells at normal, so it follows the flip rule against
     normal instead of what buyers paid: units ≤ normal × 0.95 / 1.15, at most 7 days of sales, ≥ 5g profit.
     Under craft cost alone (at its normal price) is never a stock buy: it can't profit.
   - The budget is **per deal** (one number, default 800g, 0 = none), not a total spread over the list.
   - Raid prep stays as the browse-all page with its tables, since Deals only shows rows that act. The Buy
     list's Under craft cost table and Watch table are gone; under craft cost lives on as a BUY reason.
2. **Class picker and kits.**
   - Kits are grouped by class, then spec: the My kit page shows the class (with its icon) and a spec choice;
     each spec has a default kit, "Raid consumables", with raid nights as today. Kit ids stay `class_spec`.
   - **Sources:** hunter specs from the owner's guide (toxickevinferm.github.io/hunter-guide, WoWSims Forever
     values per playstyle: weave, turret, melee); other specs from Wowhead's WoW: Forever pages
     (`/forever/guide/classes/<class>/<spec>/enchants-consumables-pve-<dps|tank|healer>`), rendered in a
     headless browser. Every item ID and its duration is checked against the item API before it goes into
     `config.yaml`, and each kit carries `source: {name, url, date}`. `dps` stays optional: only kits backed by
     a sim have it; the others keep the guide's order.
   - **Coverage on 2026-11-27:** Hunter (Marksmanship, Beast Mastery, Survival weave and melee), Mage (Fire,
     Arcane), Druid (Balance, Feral tank), Paladin (Retribution). Every other Wowhead page was still the
     level-30 beta's leveling list ("will be updated for level 60"), and Frost Mage had no page: no kit until
     those pages get a raid list. Re-check by rendering the same URLs.
   - **Units per night** come from each item's duration over a ~3 h raid: 2 h flask 2, 1 h buff 3, 30 min
     buff 6, 15 min food 12; potions, runes and short buffs 6 (about one per boss).
   - **Soulbound** kit items (A22: Scorpok, Juju, R.O.I.D.S., Demonic Rune…) are listed in
     `config.yaml` → `soulbound`: the page shows "farm it" and leaves them out of the cost, the shopping list
     and "For your raids". A slot starts on its first tradeable option (so Dark Rune before Demonic Rune).
   - `cheapest: true` on a slot whose options are interchangeable (Wowhead's "pick the cheapest" crit
     elixirs for mages) starts it on the cheapest listed one.
   - Every default-kit item joins the watchlist (`loadConfig` enforces it, and rejects unknown slot keys: an
     unquoted comma in a flow-style note would otherwise split it silently).
3. **Custom kits.** "Customise" copies the current kit into the viewer's own kit: remove a slot or an item
   option, add a slot, add an item by searching the watchlist (the only items with full prices until step 5;
   `items.json` once it is), change units per night. "Reset to default"
   drops it. Several custom kits can exist next to the defaults. Kept in localStorage (as ADR-0011), so they
   are per browser; **"Copy link"** puts the kit in the URL hash so it can move to another device or a
   guildmate.
4. **Stars.** A ☆ button next to every item name, in every list and on the item page. Starred ids are kept in
   localStorage (one store shared by every list, synced between tabs); Raid prep and the Buy list's watch table
   have a "Starred only" filter now, Deals gets one (and shows starred items first) when it exists.
5. **Whole-market scan on house 110.** Hourly points and listings for the ~200 commodities that sell the most
   (by the daily files), on top of the watchlist, so Deals, custom kits and stars aren't limited to what we
   thought of. Plus crafting profit per day over all recipes, filtered on "every reagent priced".
6. **Under vendor price.** Listings below what a vendor pays: buy, sell to the NPC, guaranteed profit. Needs
   the vendor sell price from the item API, not yet verified on Forever (new api-notes entry first).
7. **Later:** movers (24 h / 7 d, with the noise floor), price by hour of day (for raid-night peaks), posting
   help for stockpile lots, thin walls (a few cheap units in front of a big price jump), Discord alerts from
   the collector (a webhook, not a browser that has to stay open).

## Consequences

- Custom kits can only add watchlist items until step 5, and stars only show where watchlist items are listed.
- Custom kits and stars don't follow the viewer across devices except by link.
- Step 5 grows the `data` branch (about 200 more hourly and sales files, and a bigger `book.json`); to be
  measured before it's accepted.
- Wowhead guides for Forever render in JavaScript, so a plain fetch gets only the header: they're read in a
  headless browser, then entered by hand and verified against the item API. Nothing scrapes them on a schedule.
- Kits written before this ADR (label only) still load: the site splits the label into class and spec.
