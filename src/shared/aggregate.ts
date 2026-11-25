import type { Listing, Stats } from "./types.ts";

/**
 * Group listings by item and compute quantity-weighted stats.
 * A listing of 200 units at price X counts as 200 units at X.
 */
export function aggregate(listings: readonly Listing[]): Map<number, Stats> {
  const byItem = new Map<number, Listing[]>();
  for (const l of listings) {
    if (!l || typeof l.unit_price !== "number" || typeof l.quantity !== "number" || l.quantity <= 0) continue;
    const id = l.item?.id;
    if (typeof id !== "number") continue;
    let arr = byItem.get(id);
    if (!arr) {
      arr = [];
      byItem.set(id, arr);
    }
    arr.push(l);
  }
  const out = new Map<number, Stats>();
  for (const [id, arr] of byItem) out.set(id, statsFor(arr));
  return out;
}

export function statsFor(listings: Listing[]): Stats {
  const sorted = [...listings].sort((a, b) => a.unit_price - b.unit_price);
  const qty = sorted.reduce((s, l) => s + l.quantity, 0);
  return {
    min: sorted[0].unit_price,
    p10: weightedPercentile(sorted, qty, 0.1),
    median: weightedPercentile(sorted, qty, 0.5),
    qty,
    listings: sorted.length,
  };
}

/** Price of the unit at rank ceil(p × total) in the price-sorted unit list. `sorted` must be ascending. */
export function weightedPercentile(sorted: Listing[], total: number, p: number): number {
  const target = Math.max(1, Math.ceil(p * total));
  let cum = 0;
  for (const l of sorted) {
    cum += l.quantity;
    if (cum >= target) return l.unit_price;
  }
  return sorted[sorted.length - 1].unit_price;
}
