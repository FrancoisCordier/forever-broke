import { describe, expect, it } from "vitest";
import {
  addTurnover,
  emptyTurnover,
  pickMarket,
  TURNOVER_DAYS,
  tradedValue,
  turnoverSales,
} from "../src/shared/market.ts";

const est = (entries: [number, number, number][]) =>
  new Map(entries.map(([id, units, value]) => [id, { units, value }]));

describe("turnover", () => {
  it("sums snapshot pairs per day and item, skipping nothing sold", () => {
    let t = addTurnover(emptyTurnover(), "2026-11-27", est([[1, 2, 100]]), 3600);
    t = addTurnover(
      t,
      "2026-11-27",
      est([
        [1, 3, 150],
        [2, 0, 0],
      ]),
      3600,
    );
    expect(t.days["2026-11-27"]).toEqual({ 1: [5, 250] });
    expect(t.covered).toEqual({ "2026-11-27": 7200 });
  });

  it("keeps the last TURNOVER_DAYS days", () => {
    let t = emptyTurnover();
    for (let d = 1; d <= TURNOVER_DAYS + 2; d++)
      t = addTurnover(t, `2026-12-${String(d).padStart(2, "0")}`, est([[1, 1, 10]]), 3600);
    expect(Object.keys(t.days)).toHaveLength(TURNOVER_DAYS);
    expect(Object.keys(t.days)[0]).toBe("2026-12-03");
    expect(Object.keys(t.covered ?? {})).toEqual(Object.keys(t.days));
    expect(tradedValue(t).get(1)).toBe(10 * TURNOVER_DAYS);
  });

  it("leaves a day written before coverage existed without one", () => {
    const old = { days: { "2026-11-27": { 1: [4, 40] as [number, number] } } };
    const t = addTurnover(old, "2026-11-27", est([[1, 1, 10]]), 3600);
    expect(t.days["2026-11-27"]).toEqual({ 1: [5, 50] });
    expect(t.covered).toEqual({});
    expect(turnoverSales(t, 1, "2026-11-27")).toBeNull();
    // the next day starts with coverage
    const next = addTurnover(t, "2026-11-28", est([[1, 2, 20]]), 3600);
    expect(next.covered).toEqual({ "2026-11-28": 3600 });
  });
});

describe("turnoverSales", () => {
  let t = emptyTurnover();
  for (const day of ["2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27"])
    t = addTurnover(t, day, est([[1, 6, 600]]), 6 * 3600);

  it("gives a rate over the last 3 covered days, up to today", () => {
    // 18 units in 18 h → 24 a day, at 100 each
    expect(turnoverSales(t, 1, "2026-11-27")).toEqual({ perDay: 24, avgPrice: 100, hours: 18 });
    expect(turnoverSales(t, 1, "2026-11-25")).toEqual({ perDay: 24, avgPrice: 100, hours: 12 });
  });

  it("counts an item missing from covered days as nothing sold", () => {
    expect(turnoverSales(t, 2, "2026-11-27")).toEqual({ perDay: 0, avgPrice: null, hours: 18 });
    expect(turnoverSales(emptyTurnover(), 1, "2026-11-27")).toBeNull();
  });
});

describe("pickMarket", () => {
  const traded = new Map([
    [1, 900],
    [2, 800],
    [3, 700],
    [4, 600],
    [5, 500],
    [6, 0],
  ]);

  it("takes the most traded, leaving out the watchlist and items that never sold", () => {
    expect(pickMarket(traded, [], new Set([1]), 2)).toEqual([2, 3]);
    expect(pickMarket(traded, [], new Set(), 10)).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps a tracked item while it's in the top 2n, and drops it below", () => {
    // n = 2: item 4 ranks 4th (inside the top 4), so it stays; the best new one fills the other place.
    expect(pickMarket(traded, [4], new Set(), 2)).toEqual([1, 4]);
    // Item 5 ranks 5th, outside the top 4: replaced.
    expect(pickMarket(traded, [5], new Set(), 2)).toEqual([1, 2]);
  });
});
