# ADR-0015: A flip is any buy to resell; cautious resale price, queue-aware volume

Status: **Accepted** (owner, 2026-11-27: "buying to resell is a flip, whatever is the % of benefits", and make
it "the most accurate about the gold making probability").

## Context

ADR-0014 step 1 had two ways to buy for resale on the Deals page:

- **FLIP**: the collector's `resale` (ADR-0012). It relists at what buyers paid, needs a 15% margin after the
  cut, and caps the buy at 2 days of sales.
- **BUY to stock**: relists at the 7-day normal, needs the same 15% margin, caps at 7 days, and needs at least
  5g profit.

Thorium Grenade showed both problems. It was 12% under what buyers paid, too little for the flip margin, so it
became a stock BUY at "+16g". But that assumed resale at its 27g normal while buyers were paying 23g. The margin
hid real (small) flips and let optimistic ones through. The day caps also ignored the units listed between our
buy limit and our relist price, which sell before ours.

## Decision

Everything bought to resell is a **FLIP** (`planFlip` in `site/src/lib/deals.ts`). BUY means only "buy for your
kit". The site computes the flip from `sales`, `normal` and the ladder, and no longer reads `flip` / `resale`.

- **Resale price**: the price buyers have proven they pay, `min(avg paid over 3 days, normal)`. A price nobody
  paid is never assumed. A flip needs ≥ 12 h of sales data and some sales.
- **Queue**: we buy the cheapest units and relist above them, so every unit listed under our price sells first.
  If the units listed under the relist price come to more than **3 days of sales** (`FLIP_DAYS`), the relist
  price drops to just under the first listing that breaks that limit.
- **Buy limit**: every unit whose price is under the relist price × 0.95 (after the AH cut). There is no margin
  %. Each unit bought profits at the relist price.
- **Days to sell**: everything listed under the relist price (ours included, net of what we buy) ÷ sold per day.
  The budget cuts our units, not the queue.
- Rows under **1g** profit are dropped as noise. The Profit column shows the return on the gold spent
  (profit ÷ cost), so a thin flip reads as thin.

ADR-0012's collector rule stays in the data (`flip`, `resale`) and its sales estimate is unchanged. Only the
site's use of its margin and hold days is superseded.

## Consequences

- More flips show up, many with low returns. The return % and days to sell say how good each one is.
- Profits are lower and more believable than the stock BUY's normal-price resale.
- Still a lower bound and a snapshot. New listings posted after ours, undercuts and price moves aren't modelled.
  ADR-0001 holds: the site advises, it doesn't predict.
