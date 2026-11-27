/**
 * Deals (ADR-0014 step 1): one ranked list of what to do on the AH right now.
 *   BUY  = a good buy (cheap vs normal, under reagent cost, under what buyers paid): for your kit (what you need),
 *          or to stock and resell at its normal price later (must profit after the cut).
 *   FLIP = the resell rule of ADR-0012 (buy under what buyers pay, relist at it).
 *   SELL = a stockpile lot that meets both sell rules of ADR-0011.
 * Pure functions: the page feeds them the buy list, the chosen kit and the valued lots.
 */
import { AH_CUT, type BuyListItem, type Kit, type Ladder } from "../../../src/shared/signals.ts";
import type { Lot, LotValue, Market } from "../../../src/shared/stockpile.ts";
import { isVendor } from "./buylist.ts";
import { formatPct } from "./format.ts";
import { goodBuy, type KitPrefs, kitRows } from "./kit.ts";

export type Verdict = "buy" | "flip" | "sell";

/** Never suggest stocking more than this many days of sales (when sales are known). */
export const STOCK_DAYS = 7;
/** Hours of sales data before "nothing sold" is believed (same as config.yaml flipMinSalesHours). */
export const MIN_SALES_HOURS = 12;
/** Stocking to resell at normal: each unit must beat its price by this much after the cut (as flipMarginPct). */
export const STOCK_MARGIN = 0.15;
/** Not worth the trip below this profit, in copper (as flipMinProfitGold). */
export const MIN_PROFIT = 5 * 10000;

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
  /** Unit price to sell at: relist price (FLIP), normal (BUY to stock), market (SELL). Null for a kit buy. */
  sellAt: number | null;
  /** Units to buy (within the budget), or the lot's units (SELL). */
  units: number;
  /** What buying them costs, or what the lot cost (SELL). */
  cost: number;
  /** Profit after the cut (FLIP, SELL, BUY to stock), or what buying now saves vs the reference (kit BUY). */
  value: number;
  valueKind: "profit" | "saves";
  /** Biggest discount vs its reference price, e.g. −0.24 (BUY, FLIP). */
  discount: number | null;
  /** Estimated units sold per day (ADR-0012), null when there are no sales data. */
  perDay: number | null;
  /** units ÷ perDay. */
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

    // FLIP (ADR-0012): the collector's numbers, cut down to the budget.
    const rs = x.resale;
    if (x.flip && rs) {
      const t = take(x.ladder, rs.buyUpTo, rs.units, budget);
      const value = Math.round(t.units * rs.price * (1 - AH_CUT)) - t.cost;
      if (t.units > 0 && value > 0) {
        const b = base(x, inKit);
        deals.push({
          ...b,
          key: `flip:${x.id}`,
          verdict: "flip",
          reasons: [`${formatPct((x.now ?? rs.buyUpTo) / rs.price - 1)} vs what buyers paid`],
          buyUpTo: rs.buyUpTo,
          sellAt: rs.price,
          units: t.units,
          cost: t.cost,
          value,
          valueKind: "profit",
          discount: x.now === null ? null : x.now / rs.price - 1,
          daysToSell: daysOf(t.units, b.perDay),
          capped: t.capped,
        });
      }
    }

    // BUY to stock: cheap now, resell at its normal price later. Kit items are covered above, flips by FLIP.
    if (inKit || x.flip || !x.normal) continue;
    const why = goodBuy(x, belowCraftPct);
    if (!why) continue;
    const perDay = perDayOf(x);
    // Nothing sold over enough hours of data: no one to resell to.
    if (perDay === 0 && (x.sales?.hours ?? 0) >= MIN_SALES_HOURS) continue;
    const want = perDay ? Math.floor(perDay * STOCK_DAYS) : Number.POSITIVE_INFINITY;
    // Every unit bought must resell at normal with the margin left after the cut.
    const upTo = Math.min(why.upTo, Math.floor((x.normal * (1 - AH_CUT)) / (1 + STOCK_MARGIN)));
    const t = take(x.ladder, upTo, want, budget);
    const value = Math.round(t.units * x.normal * (1 - AH_CUT)) - t.cost;
    if (t.units === 0 || value < MIN_PROFIT) continue;
    deals.push({
      ...base(x, false),
      key: `buy:${x.id}`,
      verdict: "buy",
      reasons: why.reasons,
      buyUpTo: upTo,
      sellAt: x.normal,
      units: t.units,
      cost: t.cost,
      value,
      valueKind: "profit",
      discount: why.discount,
      daysToSell: daysOf(t.units, perDay),
      capped: t.capped,
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
