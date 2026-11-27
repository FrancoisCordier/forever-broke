# ADR-0014: A fast decision tool: Deals, class kits, custom kits, stars

Status: **Proposed** (2026-11-27)

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
2. **Class picker and kits.**
   - Kits are grouped by class, then spec: the My kit page shows the class (with its icon) and a spec choice;
     each spec has a default kit, "Raid consumables", with raid nights as today. Kit ids stay `class_spec`.
   - **Sources:** hunter specs from the owner's own source (as for `hunter_mm`); other specs from the
     Wowhead WoW: Forever class guides (`/forever/guide/classes/<class>/<spec>/overview-pve-dps`). Every item
     ID is checked with `pnpm resolve-items` before it goes into `config.yaml`, and the source and date are
     written next to each kit. `dps` stays optional: only kits backed by a sim have it; the others keep the
     guide's priority order.
   - Every default-kit item joins the watchlist (`loadConfig` already enforces it).
3. **Custom kits.** "Customise" copies the current kit into the viewer's own kit: remove a slot or an item
   option, add a slot, add an item by searching `items.json`, change units per night. "Reset to default"
   drops it. Several custom kits can exist next to the defaults. Kept in localStorage (as ADR-0011), so they
   are per browser; **"Copy link"** puts the kit in the URL hash so it can move to another device or a
   guildmate.
4. **Stars.** A ☆ button next to every item name, in every list and on the item page. Starred ids are kept in
   localStorage; Deals, Raid prep and item lists get a "Starred only" filter, and starred items show first on
   Deals.
5. **Whole-market scan on house 110.** Hourly points and listings for the ~200 commodities that sell the most
   (by the daily files), on top of the watchlist, so Deals, custom kits and stars aren't limited to what we
   thought of. Plus crafting profit per day over all recipes, filtered on "every reagent priced".
6. **Under vendor price.** Listings below what a vendor pays: buy, sell to the NPC, guaranteed profit. Needs
   the vendor sell price from the item API, not yet verified on Forever (new api-notes entry first).
7. **Later:** movers (24 h / 7 d, with the noise floor), price by hour of day (for raid-night peaks), posting
   help for stockpile lots, thin walls (a few cheap units in front of a big price jump), Discord alerts from
   the collector (a webhook, not a browser that has to stay open).

## Consequences

- An item added to a custom kit or starred that isn't in `buylist.json` only has `latest.json`'s numbers
  (min, p10, median, units) until step 5: no history signals, and its cost is need × p10, marked "estimate".
- Custom kits and stars don't follow the viewer across devices except by link.
- Step 5 grows the `data` branch (about 200 more hourly and sales files, and a bigger `book.json`); to be
  measured before it's accepted.
- Wowhead guides for Forever render in JavaScript, so their consumables can't be scraped reliably: they are
  read and entered by hand (or pasted by the owner), then verified.
