/**
 * Whole-market scan on the focus house (ADR-0014 step 5). Sales are estimated for every commodity each run
 * (ADR-0012), summed per UTC day into a rolling turnover file, and the commodities with the most gold traded
 * get the same tracking as the watchlist: hourly points, price ladder, sales history, a buy list entry.
 */
import type { SaleEstimate } from "./sales.ts";

/** {house}/turnover.json: per UTC day, item id → [units sold, copper traded]. */
export interface Turnover {
  days: Record<string, Record<string, [units: number, value: number]>>;
}

/** {house}/market.json: the commodities tracked on top of the watchlist, most traded first. */
export interface MarketSet {
  t: number;
  ids: number[];
}

export const TURNOVER_DAYS = 7;

export const emptyTurnover = (): Turnover => ({ days: {} });

/** Add one snapshot pair's estimates to `day`, keeping the last TURNOVER_DAYS days. */
export function addTurnover(t: Turnover, day: string, sales: ReadonlyMap<number, SaleEstimate>): Turnover {
  const today = { ...(t.days[day] ?? {}) };
  for (const [id, e] of sales) {
    if (e.units <= 0) continue;
    const [u, v] = today[id] ?? [0, 0];
    today[id] = [u + e.units, v + e.value];
  }
  const days = { ...t.days, [day]: today };
  const keep = Object.keys(days).sort().slice(-TURNOVER_DAYS);
  return { days: Object.fromEntries(keep.map((d) => [d, days[d]])) };
}

/** Copper traded per item over the whole file. */
export function tradedValue(t: Turnover): Map<number, number> {
  const out = new Map<number, number>();
  for (const day of Object.values(t.days))
    for (const [id, [, v]] of Object.entries(day)) out.set(Number(id), (out.get(Number(id)) ?? 0) + v);
  return out;
}

/**
 * The `n` most traded items, not in `exclude`. Sticky, so history isn't cut by small rank changes: an item
 * already tracked stays while it ranks in the top 2n, and new ones fill the free places, best first.
 */
export function pickMarket(
  traded: ReadonlyMap<number, number>,
  prev: readonly number[],
  exclude: ReadonlySet<number>,
  n: number,
): number[] {
  const ranked = [...traded]
    .filter(([id, v]) => v > 0 && !exclude.has(id))
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([id]) => id);
  const top2n = new Set(ranked.slice(0, 2 * n));
  const kept = new Set(prev.filter((id) => top2n.has(id)));
  for (const id of ranked) {
    if (kept.size >= n) break;
    kept.add(id);
  }
  return ranked.filter((id) => kept.has(id));
}
