/** All prices are integer copper. Times are unix seconds (UTC). */

/** One commodity listing as returned by the API (A10). */
export interface Listing {
  /** Stable across snapshots: same id = same listing (A20). Optional only so tests can omit it. */
  id?: number;
  item: { id: number };
  quantity: number;
  unit_price: number;
  time_left?: "SHORT" | "MEDIUM" | "LONG" | "VERY_LONG";
}

/** Aggregated state of one item in one snapshot. Percentiles are quantity-weighted. */
export interface Stats {
  min: number;
  p10: number;
  median: number;
  qty: number;
  listings: number;
}

/** Columnar hourly series (rolling 30 days). Null prices = item absent from that snapshot (qty 0). */
export interface HourlySeries {
  t: number[];
  min: (number | null)[];
  p10: (number | null)[];
  median: (number | null)[];
  qty: number[];
  listings: number[];
}

/**
 * Columnar daily rollup, kept forever. One entry per UTC day in which the item was listed.
 * min = lowest min seen that day; p10/median/qty/listings = mean over the snapshots where the item was present;
 * n = number of those snapshots (compare with meta snapshot count for the day to see presence).
 */
export interface DailySeries {
  d: string[];
  min: number[];
  p10: number[];
  median: number[];
  qty: number[];
  listings: number[];
  n: number[];
}

/** latest.json: current snapshot for every item in a house. Row = [min, p10, median, qty, listings]. */
export interface Latest {
  house: number;
  t: number;
  items: Record<string, [number, number, number, number, number]>;
}

export interface ItemMeta {
  name: string | null;
  quality?: string;
  cls?: string;
  sub?: string;
  level?: number;
}

export interface HouseMeta {
  lastModified?: string;
  t?: number;
  status: "updated" | "unchanged" | "error" | "rejected";
  listings?: number;
  items?: number;
  error?: string;
  checkedAt: number;
}

export interface Meta {
  version: number;
  lastRun: number;
  houses: Record<string, HouseMeta>;
  /** house → UTC date → number of distinct snapshots collected that day. */
  snapshotsPerDay: Record<string, Record<string, number>>;
}
