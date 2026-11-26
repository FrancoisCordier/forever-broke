/**
 * Stockpile valuation and the sell signal (ADR-0011). Pure functions; lots live in the browser (localStorage).
 *   value = qty × market × (1 − 5% AH cut) · sell = net ≥ cost × (1 + costPct) and market ≥ normal × (1 + normalPct)
 */
import { median } from "./signals.ts";
import type { DailySeries } from "./types.ts";

/** Selling on the AH costs a 5% cut. */
export const AH_CUT = 0.05;

/**
 * Why a lot was bought. Only resale and the alt's levelling mats get sell flags:
 * selling your own raid consumables at a profit is still possible, but it's your call, so it isn't flagged.
 */
export type Purpose = "resell" | "own" | "alt";

export interface Lot {
  id: string;
  item: number;
  qty: number;
  /** Copper per unit paid. */
  unitCost: number;
  purpose: Purpose;
  /** UTC date bought, YYYY-MM-DD. */
  added: string;
  note?: string;
}

/** What the market says about one item right now (focus house). */
export interface Market {
  /** Market price (current p10, ADR-0007), null when not listed. */
  now: number | null;
  /** Lowest single listing. */
  min: number | null;
  /** Normal price: 7-day median of p10 (hourly for watchlist items, daily otherwise). */
  normal: number | null;
  qty: number;
}

export interface SellOptions {
  /** Net of the AH cut, at least this much above cost, e.g. 30. */
  sellAboveCostPct: number;
  /** Market at least this much above its normal price (a spike, not just a good price), e.g. 15. */
  sellAboveNormalPct: number;
}

export interface LotValue {
  cost: number;
  /** What selling it all at market price would bring, after the AH cut. Null when not listed. */
  value: number | null;
  pl: number | null;
  plPct: number | null;
  /** Lowest unit price that meets the cost rule (after the cut). */
  sellAt: number;
  /** Both rules met (only for resell / alt lots). */
  sell: boolean;
}

export function valueLot(lot: Lot, m: Market | undefined, opt: SellOptions): LotValue {
  const cost = lot.qty * lot.unitCost;
  const sellAt = Math.ceil((lot.unitCost * (1 + opt.sellAboveCostPct / 100)) / (1 - AH_CUT));
  const now = m?.now ?? null;
  if (now === null) return { cost, value: null, pl: null, plPct: null, sellAt, sell: false };
  const value = Math.round(lot.qty * now * (1 - AH_CUT));
  const pl = value - cost;
  const spike = m?.normal ? now >= m.normal * (1 + opt.sellAboveNormalPct / 100) : false;
  return {
    cost,
    value,
    pl,
    plPct: cost ? pl / cost : null,
    sellAt,
    sell: lot.purpose !== "own" && lot.qty > 0 && now >= sellAt && spike,
  };
}

/** Normal price from daily rollups: median of the last `days` daily p10 values, for items without hourly history. */
export function normalFromDaily(d: DailySeries, days = 7): number | null {
  return median(d.p10.slice(-days));
}
