/**
 * Deals (ADR-0014 step 1): one ranked list of what to do on the AH right now.
 *   BUY  = a good buy for your kit (cheap vs normal, under reagent cost, under what buyers paid): what you need.
 *   FLIP = anything bought to resell (ADR-0015): see planFlip.
 *   SELL = a stockpile lot that meets both sell rules of ADR-0011.
 * Pure functions: the page feeds them the buy list, the chosen kit and the valued lots.
 */
import { AH_CUT, type BuyListItem, type Kit, type Ladder } from "../../../src/shared/signals.ts";
import type { Lot, LotValue, Market } from "../../../src/shared/stockpile.ts";
import { isVendor } from "./buylist.ts";
import { formatPct } from "./format.ts";
import { goodBuy, type KitPrefs, kitRows } from "./kit.ts";

export type Verdict = "buy" | "flip" | "sell";

/** Hours of sales data before a sales rate is trusted (same as config.yaml flipMinSalesHours). */
export const MIN_SALES_HOURS = 12;
/** A flip must sell out within this many days at the measured sales rate (ADR-0015). */
export const FLIP_DAYS = 3;
/** Rows under this profit are noise ("+0g"), in copper. */
export const MIN_PROFIT = 10000;

export interface Deal {
  key: string;
  verdict: Verdict;
  id: number;
  /** Watchlist entry, when the item is on it (a SELL row can be any item you hold). */
  x: BuyListItem | null;
  /** Why now, e.g. "−24% vs normal". */
  reasons: string[];
  /** Highest unit price to pay (BUY, FLIP). */
  buyUpTo: number | null;
  /** Unit price to sell at: relist price (FLIP), market (SELL). Null for a kit buy. */
  sellAt: number | null;
  /** Units to buy (within the budget), or the lot's units (SELL). */
  units: number;
  /** What buying them costs, or what the lot cost (SELL). */
  cost: number;
  /** Profit after the cut (FLIP, SELL), or what buying now saves vs the reference (kit BUY). */
  value: number;
  valueKind: "profit" | "saves";
  /** Biggest discount vs its reference price, e.g. −0.24 (BUY, FLIP). */
  discount: number | null;
  /** Estimated units sold per day (ADR-0012), null when there are no sales data. */
  perDay: number | null;
  /** Days until the units sell: FLIP counts every unit listed under the relist price, since ours sell last. */
  daysToSell: number | null;
  /** Hours of sales data behind perDay. */
  salesHours: number;
  /** Units listed right now. */
  listed: number;
  /** The item is the chosen option of a slot in your kit. */
  inKit: boolean;
  /** Kit slot it fills (kit BUY). */
  slot?: string;
  /** Fewer units than wanted because of the budget. */
  capped: boolean;
  /** Stockpile lot (SELL). */
  lot?: Lot;
}

export interface LotRow {
  lot: Lot;
  v: LotValue;
  m?: Market;
}

export interface DealInput {
  items: BuyListItem[];
  /** Copper; 0 = no limit. */
  budget: number;
  belowCraftPct: number;
  kit?: Kit;
  prefs: KitPrefs;
  soulbound: ReadonlySet<number>;
  lots: LotRow[];
}

/** Walk the ladder cheapest first: at most `want` units at ≤ `upTo`, spending at most `budget` (0 = no limit). */
export function take(ladder: Ladder, upTo: number, want: number, budget: number) {
  let units = 0;
  let cost = 0;
  let capped = false;
  for (const [p, q] of ladder) {
    if (p > upTo || units >= want) break;
    let n = Math.min(q, want - units);
    if (budget > 0) {
      const afford = Math.floor((budget - cost) / p);
      if (afford < n) {
        capped = true;
        n = afford;
      }
    }
    if (n <= 0) break;
    units += n;
    cost += n * p;
  }
  return { units, cost, capped };
}

export interface FlipPlan {
  /** The price buyers have proven they pay: the lower of the average paid and normal. */
  proven: number;
  /** Price to relist at: `proven`, or lower when more is listed under it than sells in FLIP_DAYS. */
  relist: number;
  /** Highest unit price that still profits after the cut at `relist`. */
  buyUpTo: number;
  units: number;
  cost: number;
  capped: boolean;
  /** Revenue after the cut minus cost. */
  profit: number;
  /** Everything listed under `relist` (ours included) ÷ sold per day: ours are the last to sell. */
  days: number;
}

/**
 * Buy to resell (ADR-0015). No margin is required: every unit that profits is taken, but the numbers are the
 * cautious ones the data supports.
 * - Resale price: what buyers paid (the sales estimate), or normal when that's lower. A price nobody paid is
 *   never assumed. No flip without MIN_SALES_HOURS of sales data and some sales.
 * - Queue: we buy the cheapest units and relist above them, so every unit listed under our price sells first.
 *   The relist price drops under the first listing that would push that queue past FLIP_DAYS of sales.
 */
export function planFlip(x: BuyListItem, budget: number): FlipPlan | null {
  const s = x.sales;
  if (!s || s.hours < MIN_SALES_HOURS || !(s.perDay > 0) || !s.avgPrice) return null;
  const proven = x.normal ? Math.min(s.avgPrice, x.normal) : s.avgPrice;
  const cap = s.perDay * FLIP_DAYS;
  let relist = proven;
  let under = 0;
  for (const [p, q] of x.ladder) {
    if (p >= relist) break;
    if (under + q > cap) {
      relist = p - 1;
      break;
    }
    under += q;
  }
  const net = Math.floor(relist * (1 - AH_CUT));
  const buyUpTo = net - 1;
  const t = take(x.ladder, buyUpTo, Number.POSITIVE_INFINITY, budget);
  return { proven, relist, buyUpTo, ...t, profit: t.units * net - t.cost, days: under / s.perDay };
}

const perDayOf = (x: BuyListItem | null) => (x?.sales && x.sales.hours > 0 ? x.sales.perDay : null);
const daysOf = (units: number, perDay: number | null) => (perDay ? units / perDay : null);

function base(x: BuyListItem, inKit: boolean) {
  return { id: x.id, x, perDay: perDayOf(x), salesHours: x.sales?.hours ?? 0, listed: x.qty, inKit };
}

export function findDeals(input: DealInput): Deal[] {
  const { items, budget, belowCraftPct, kit, prefs, soulbound } = input;
  const deals: Deal[] = [];
  const rows = kit ? kitRows(kit, items, prefs, soulbound) : [];
  const kitIds = new Set(rows.flatMap((r) => (r.item && !r.soulbound ? [r.item.id] : [])));

  // BUY for your kit: what the chosen nights need, as far as listings under the price (and the budget) allow.
  for (const r of rows) {
    if (!r.item || r.soulbound || r.need <= 0 || isVendor(r.item)) continue;
    const why = goodBuy(r.item, belowCraftPct);
    if (!why) continue;
    const t = take(r.item.ladder, why.upTo, r.need, budget);
    if (t.units === 0) continue;
    const b = base(r.item, true);
    deals.push({
      ...b,
      key: `buy:${r.key}`,
      verdict: "buy",
      reasons: why.reasons,
      buyUpTo: why.upTo,
      sellAt: null,
      units: t.units,
      cost: t.cost,
      value: Math.round(t.units * why.ref) - t.cost,
      valueKind: "saves",
      discount: why.discount,
      daysToSell: null,
      slot: r.slot,
      capped: t.capped,
    });
  }

  for (const x of items) {
    if (isVendor(x) || soulbound.has(x.id)) continue;
    const inKit = kitIds.has(x.id);

    // FLIP (ADR-0015): anything bought to resell, whatever the margin.
    const f = planFlip(x, budget);
    if (!f || f.units === 0 || f.profit < MIN_PROFIT || !x.sales?.avgPrice) continue;
    const cheapest = x.ladder[0][0];
    const reasons = [`${formatPct(cheapest / x.sales.avgPrice - 1)} vs what buyers paid`];
    if (x.normal && x.normal < x.sales.avgPrice) reasons.push(`${formatPct(cheapest / x.normal - 1)} vs normal`);
    if (f.relist < f.proven) reasons.push(`relist lower to sell in ${FLIP_DAYS} days`);
    deals.push({
      ...base(x, inKit),
      key: `flip:${x.id}`,
      verdict: "flip",
      reasons,
      buyUpTo: f.buyUpTo,
      sellAt: f.relist,
      units: f.units,
      cost: f.cost,
      value: f.profit,
      valueKind: "profit",
      discount: cheapest / f.relist - 1,
      daysToSell: f.days,
      capped: f.capped,
    });
  }

  // SELL (ADR-0011): stockpile lots that meet both rules.
  const byId = new Map(items.map((x) => [x.id, x]));
  for (const { lot, v, m } of input.lots) {
    if (!v.sell || v.pl === null) continue;
    const x = byId.get(lot.item) ?? null;
    const perDay = perDayOf(x);
    const now = m?.now ?? null;
    const reasons = [`${formatPct(v.plPct)} on what you paid`];
    if (now !== null && m?.normal) reasons.push(`${formatPct(now / m.normal - 1)} vs normal`);
    deals.push({
      key: `sell:${lot.id}`,
      verdict: "sell",
      id: lot.item,
      x,
      reasons,
      buyUpTo: null,
      sellAt: now,
      units: lot.qty,
      cost: v.cost,
      value: v.pl,
      valueKind: "profit",
      discount: null,
      perDay,
      daysToSell: daysOf(lot.qty, perDay),
      salesHours: x?.sales?.hours ?? 0,
      listed: m?.qty ?? 0,
      inKit: kitIds.has(lot.item),
      capped: false,
      lot,
    });
  }

  return deals.sort((a, b) => b.value - a.value);
}

export interface DealFilter {
  verdict: Verdict | "";
  /** Minimum discount in %, e.g. 30. BUY and FLIP only: SELL rows are hidden while it's set. */
  minOff: number;
  /** Minimum units sold per day; rows without sales data are hidden while it's set. */
  minPerDay: number;
  starred: boolean;
  kitOnly: boolean;
  query: string;
}

export const ALL_DEALS: DealFilter = {
  verdict: "",
  minOff: 0,
  minPerDay: 0,
  starred: false,
  kitOnly: false,
  query: "",
};

export function filterDeals(
  deals: Deal[],
  f: DealFilter,
  stars: ReadonlySet<number>,
  nameOf: (d: Deal) => string,
): Deal[] {
  const q = f.query.trim().toLowerCase();
  return deals.filter(
    (d) =>
      (!f.verdict || d.verdict === f.verdict) &&
      (!f.minOff || (d.discount !== null && d.discount <= -f.minOff / 100)) &&
      (!f.minPerDay || (d.perDay ?? 0) >= f.minPerDay) &&
      (!f.starred || stars.has(d.id)) &&
      (!f.kitOnly || d.inKit) &&
      (!q || nameOf(d).toLowerCase().includes(q)),
  );
}

/** Starred items first, then the given order (most valuable first). */
export const starredFirst = (deals: Deal[], stars: ReadonlySet<number>) =>
  [...deals].sort((a, b) => Number(stars.has(b.id)) - Number(stars.has(a.id)));
