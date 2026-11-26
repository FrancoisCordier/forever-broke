/**
 * Sales estimated from consecutive snapshots (ADR-0012). Listing ids are stable between snapshots (A20), and a
 * commodity buyer always gets the cheapest listings first. So between two snapshots, units bought are the ones
 * that disappeared (or shrank) from the bottom of the price ladder, up to the first listing still fully there.
 *
 * Not counted: a listing that vanished while about to expire anyway (SHORT), and one that looks reposted (a new
 * listing of the same item with exactly the same quantity appeared). Listings posted and bought between two
 * snapshots are invisible. So this is a lower bound on what sold, at the prices actually paid.
 */
import type { Listing } from "./types.ts";

/** Compact listing kept from one snapshot to the next: [listing id, quantity, unit price, short time left]. */
export type BookRow = [id: number, qty: number, price: number, short: 0 | 1];

/** {house}/book.json: the previous snapshot's listings, watchlist items only. */
export interface Book {
  t: number;
  items: Record<string, BookRow[]>;
}

export function bookRows(listings: readonly Listing[]): BookRow[] {
  return listings
    .filter((l) => typeof l.id === "number")
    .map((l) => [l.id as number, l.quantity, l.unit_price, l.time_left === "SHORT" ? 1 : 0]);
}

export interface SaleEstimate {
  units: number;
  /** Total copper paid for those units. */
  value: number;
}

export function estimateSales(prev: readonly BookRow[], cur: readonly BookRow[]): SaleEstimate {
  const now = new Map(cur.map((r) => [r[0], r]));
  const prevIds = new Set(prev.map((r) => r[0]));
  // New listings by quantity: a vanished listing matched by one of these was probably cancelled and reposted.
  const reposts = new Map<number, number>();
  for (const r of cur) if (!prevIds.has(r[0])) reposts.set(r[1], (reposts.get(r[1]) ?? 0) + 1);

  let units = 0;
  let value = 0;
  for (const [id, qty, price, short] of [...prev].sort((a, b) => a[2] - b[2])) {
    const after = now.get(id);
    if (after && after[1] === qty) break; // still fully there: nothing pricier was bought
    if (!after) {
      if (short) continue; // expired
      const n = reposts.get(qty) ?? 0;
      if (n > 0) {
        reposts.set(qty, n - 1);
        continue; // cancelled and reposted
      }
    }
    const bought = qty - (after?.[1] ?? 0);
    units += bought;
    value += bought * price;
  }
  return { units, value };
}

/** {house}/sales/{item}.json: one point per pair of consecutive snapshots, rolling 30 days. */
export interface SalesSeries {
  /** Snapshot time of the later snapshot (unix s). */
  t: number[];
  /** Seconds covered (time since the previous snapshot). */
  dt: number[];
  units: number[];
  value: number[];
}

export const emptySales = (): SalesSeries => ({ t: [], dt: [], units: [], value: [] });

const KEEP_S = 30 * 86400;

export function appendSales(s: SalesSeries, t: number, dt: number, e: SaleEstimate): SalesSeries {
  if (s.t.length && s.t[s.t.length - 1] >= t) return s;
  const keep = (xs: number[]) => xs.filter((_, i) => s.t[i] > t - KEEP_S);
  return {
    t: [...keep(s.t), t],
    dt: [...keep(s.dt), dt],
    units: [...keep(s.units), e.units],
    value: [...keep(s.value), e.value],
  };
}

export interface SalesSummary {
  /** Units sold per day over the window (scaled by the time actually covered). */
  perDay: number;
  /** Average price paid per unit, null if nothing sold. */
  avgPrice: number | null;
  /** Hours of snapshot pairs behind these numbers. */
  hours: number;
}

export const SALES_WINDOW_S = 3 * 86400;

export function summarizeSales(s: SalesSeries, now: number, window = SALES_WINDOW_S): SalesSummary {
  let covered = 0;
  let units = 0;
  let value = 0;
  for (let i = 0; i < s.t.length; i++) {
    if (s.t[i] <= now - window) continue;
    covered += s.dt[i];
    units += s.units[i];
    value += s.value[i];
  }
  return {
    perDay: covered ? (units / covered) * 86400 : 0,
    avgPrice: units ? Math.round(value / units) : null,
    hours: Math.round((covered / 3600) * 10) / 10,
  };
}
