/**
 * Buy-list signals (ADR-0007). Pure functions shared by the collector and the site.
 *   market = current p10 · normal = median of hourly p10 over 7 days · cheap = market ≤ normal × (1 − pct)
 */
import type { HourlySeries, Listing } from "./types.ts";

export const NORMAL_WINDOW_S = 7 * 24 * 3600;
export const SUPPLY_WINDOW_S = 3 * 24 * 3600;

/** Price → units at that exact price, ascending. */
export type Ladder = [price: number, units: number][];

export interface ItemSignal {
  id: number;
  /** Snapshot time (unix s). */
  t: number;
  now: number | null;
  min: number | null;
  qty: number;
  normal: number | null;
  /** How much history `normal` is based on, in days (≤ 7). */
  normalDays: number;
  /** now / normal − 1, e.g. −0.21. */
  change: number | null;
  /** Highest unit price still counted as cheap. */
  upTo: number | null;
  /** Units listed at ≤ upTo, and what buying all of them costs. */
  unitsUpTo: number;
  costUpTo: number;
  /** qty now vs mean qty over the previous 3 days, e.g. −0.18. */
  supplyChange: number | null;
  cheap: boolean;
  /** 7-day p10, one point per 3 hours: [t, p10|null]. */
  spark: [number, number | null][];
}

/** A recipe that uses an item as a reagent. */
export interface Use {
  /** Name of the crafted item. */
  name: string;
  profession: string;
  /** Units of this reagent per craft. */
  qty: number;
  /** The crafted item is a raid consumable on the watchlist. */
  raid: boolean;
}

/** One watchlist item in {house}/buylist.json. */
export interface BuyListItem extends ItemSignal {
  name: string;
  quality: string | null;
  group: string;
  /** The item itself is a raid consumable. */
  raidProduct: boolean;
  uses: Use[];
  vendorPrice: number | null;
  /** Current listings by price, cheapest first (truncated). */
  ladder: Ladder;
  /** How this item is crafted, if it is (from recipes.json). */
  recipe: CraftRecipe | null;
}

export interface CraftRecipe {
  profession: string;
  /** Units produced per craft. */
  makes: number;
  reagents: { id: number; name: string; qty: number }[];
}

/** {house}/buylist.json, written by the collector for the focus house. */
export interface BuyList {
  house: number;
  t: number;
  raidOpens: string;
  cheapPct: number;
  items: BuyListItem[];
  /** Current p10 of every reagent used by a watchlist recipe (item id → copper), for craft costs. */
  reagentPrices: Record<string, number>;
}

export interface SignalOptions {
  cheapPct: number; // e.g. 20
  minUnitsListed: number; // ignore thinner markets
  minNormalDays: number; // e.g. 1: don't call anything cheap on a few hours of history
}

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** Group one item's listings by unit price. */
export function ladderOf(listings: readonly Listing[]): Ladder {
  const by = new Map<number, number>();
  for (const l of listings) by.set(l.unit_price, (by.get(l.unit_price) ?? 0) + l.quantity);
  return [...by.entries()].sort((a, b) => a[0] - b[0]);
}

/** Units and total cost of everything listed at or below `maxPrice`. */
export function buyable(ladder: Ladder, maxPrice: number): { units: number; cost: number } {
  let units = 0;
  let cost = 0;
  for (const [p, n] of ladder) {
    if (p > maxPrice) break;
    units += n;
    cost += p * n;
  }
  return { units, cost };
}

export function computeSignal(id: number, h: HourlySeries, ladder: Ladder, opt: SignalOptions): ItemSignal | null {
  const n = h.t.length;
  if (n === 0) return null;
  const t = h.t[n - 1];
  const now = h.p10[n - 1];
  const qty = h.qty[n - 1];

  const week: number[] = [];
  let first = t;
  for (let i = n - 1; i >= 0 && h.t[i] > t - NORMAL_WINDOW_S; i--) {
    const p = h.p10[i];
    if (p !== null) week.push(p);
    first = h.t[i];
  }
  const normal = median(week);
  const normalDays = Math.round(((t - first) / 86400) * 10) / 10;

  const prevQty: number[] = [];
  for (let i = n - 2; i >= 0 && h.t[i] > t - SUPPLY_WINDOW_S; i--) prevQty.push(h.qty[i]);
  const prevMean = prevQty.length ? prevQty.reduce((a, b) => a + b, 0) / prevQty.length : null;
  const supplyChange = prevMean ? qty / prevMean - 1 : null;

  const upTo = normal === null ? null : Math.floor(normal * (1 - opt.cheapPct / 100));
  const { units: unitsUpTo, cost: costUpTo } = upTo === null ? { units: 0, cost: 0 } : buyable(ladder, upTo);
  const change = now !== null && normal ? now / normal - 1 : null;
  const cheap =
    change !== null &&
    change <= -opt.cheapPct / 100 &&
    qty >= opt.minUnitsListed &&
    normalDays >= opt.minNormalDays &&
    unitsUpTo > 0;

  return {
    id,
    t,
    now,
    min: h.min[n - 1],
    qty,
    normal,
    normalDays,
    change,
    upTo,
    unitsUpTo,
    costUpTo,
    supplyChange,
    cheap,
    spark: downsample(h, t - NORMAL_WINDOW_S, 3 * 3600),
  };
}

/** Last p10 in each `step`-second bucket from `from` onwards. */
export function downsample(h: HourlySeries, from: number, step: number): [number, number | null][] {
  const out = new Map<number, [number, number | null]>();
  for (let i = 0; i < h.t.length; i++) {
    if (h.t[i] <= from) continue;
    const b = Math.floor(h.t[i] / step) * step;
    out.set(b, [h.t[i], h.p10[i]]);
  }
  return [...out.values()];
}
