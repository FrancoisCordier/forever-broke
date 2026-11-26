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
  /** Reagent cost per crafted unit at today's prices (ADR-0010), or null if not crafted / a reagent isn't listed. */
  craftCost: number | null;
  /** now / craftCost − 1, e.g. −0.32 when it sells 32% under what its reagents cost. */
  craftChange: number | null;
  /** Market price at least `belowCraftPct` under craft cost, on a market that isn't thin (ADR-0010). */
  belowCraft: boolean;
}

/** One slot of a raid kit (config.yaml `kits`): pick one of `options`, `perNight` units per raid night. */
export interface KitSlot {
  slot: string;
  perNight: number;
  options: number[];
  note?: string;
}

export interface Kit {
  id: string;
  label: string;
  slots: KitSlot[];
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
  /** Optional only so the site still reads buy lists written before ADR-0010. */
  belowCraftPct?: number;
  kits?: Kit[];
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

/**
 * What buying `n` units costs, cheapest listings first. `units` < n when the ladder runs out
 * (it's truncated to the cheapest rows, so that can mean "more listed, at higher prices").
 */
export function costOfUnits(ladder: Ladder, n: number): { units: number; cost: number } {
  let units = 0;
  let cost = 0;
  for (const [p, q] of ladder) {
    if (units >= n) break;
    const take = Math.min(q, n - units);
    units += take;
    cost += p * take;
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

/**
 * Reagent cost per crafted unit (ADR-0010). `priceOf` gives a reagent's unit price (already the cheaper of AH and
 * vendor), or null when it isn't listed; those reagents are returned in `missing` and the cost is null.
 */
export function craftCost(
  recipe: CraftRecipe,
  priceOf: (id: number) => number | null,
): { cost: number | null; missing: string[] } {
  let total = 0;
  const missing: string[] = [];
  for (const r of recipe.reagents) {
    const p = priceOf(r.id);
    if (p === null) missing.push(r.name);
    else total += p * r.qty;
  }
  return { cost: missing.length ? null : Math.round(total / (recipe.makes || 1)), missing };
}

export interface BelowCraftOptions {
  belowCraftPct: number; // e.g. 10
  minUnitsListed: number;
}

/** The ADR-0010 rule: market price ≤ craft cost × (1 − pct), with enough units listed to matter. */
export function belowCraft(
  now: number | null,
  qty: number,
  cost: number | null,
  opt: BelowCraftOptions,
): { craftChange: number | null; belowCraft: boolean } {
  if (now === null || !cost) return { craftChange: null, belowCraft: false };
  const craftChange = now / cost - 1;
  return { craftChange, belowCraft: craftChange <= -opt.belowCraftPct / 100 && qty >= opt.minUnitsListed };
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
