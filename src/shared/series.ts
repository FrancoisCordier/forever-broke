import type { DailySeries, HourlySeries, Stats } from "./types.ts";

export const HOURLY_RETENTION_S = 30 * 24 * 3600;

export const emptyHourly = (): HourlySeries => ({ t: [], min: [], p10: [], median: [], qty: [], listings: [] });
export const emptyDaily = (): DailySeries => ({ d: [], min: [], p10: [], median: [], qty: [], listings: [], n: [] });

export const utcDate = (t: number): string => new Date(t * 1000).toISOString().slice(0, 10);

/**
 * Append a snapshot point (stats undefined = item absent → qty 0, null prices) and drop points
 * older than 30 days before `t`. Points with t ≤ the last stored t are ignored (dedupe).
 * Returns a new series; the input is not mutated.
 */
export function appendHourly(series: HourlySeries, t: number, s: Stats | undefined): HourlySeries {
  const last = series.t.at(-1);
  if (last !== undefined && t <= last) return series;
  const cutoff = t - HOURLY_RETENTION_S;
  let start = 0;
  while (start < series.t.length && series.t[start] < cutoff) start++;
  return {
    t: [...series.t.slice(start), t],
    min: [...series.min.slice(start), s?.min ?? null],
    p10: [...series.p10.slice(start), s?.p10 ?? null],
    median: [...series.median.slice(start), s?.median ?? null],
    qty: [...series.qty.slice(start), s?.qty ?? 0],
    listings: [...series.listings.slice(start), s?.listings ?? 0],
  };
}

/**
 * Fold one snapshot into the daily rollup for its UTC day. Caller guarantees each snapshot is
 * folded at most once (the collector dedupes on Last-Modified). Means are rounded to whole copper.
 */
export function foldDaily(series: DailySeries, t: number, s: Stats): DailySeries {
  const day = utcDate(t);
  const out: DailySeries = {
    d: [...series.d], min: [...series.min], p10: [...series.p10], median: [...series.median],
    qty: [...series.qty], listings: [...series.listings], n: [...series.n],
  };
  const i = out.d.length - 1;
  if (i >= 0 && out.d[i] === day) {
    const n = out.n[i];
    const mean = (old: number, x: number) => Math.round((old * n + x) / (n + 1));
    out.min[i] = Math.min(out.min[i], s.min);
    out.p10[i] = mean(out.p10[i], s.p10);
    out.median[i] = mean(out.median[i], s.median);
    out.qty[i] = mean(out.qty[i], s.qty);
    out.listings[i] = mean(out.listings[i], s.listings);
    out.n[i] = n + 1;
  } else if (i < 0 || out.d[i] < day) {
    out.d.push(day); out.min.push(s.min); out.p10.push(s.p10); out.median.push(s.median);
    out.qty.push(s.qty); out.listings.push(s.listings); out.n.push(1);
  }
  // A snapshot older than the last stored day is ignored (should not happen).
  return out;
}
