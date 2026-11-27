import { describe, expect, it } from "vitest";
import { addTurnover, emptyTurnover, pickMarket, TURNOVER_DAYS, tradedValue } from "../src/shared/market.ts";

const est = (entries: [number, number, number][]) =>
  new Map(entries.map(([id, units, value]) => [id, { units, value }]));

describe("turnover", () => {
  it("sums snapshot pairs per day and item, skipping nothing sold", () => {
    let t = addTurnover(emptyTurnover(), "2026-11-27", est([[1, 2, 100]]));
    t = addTurnover(
      t,
      "2026-11-27",
      est([
        [1, 3, 150],
        [2, 0, 0],
      ]),
    );
    expect(t.days["2026-11-27"]).toEqual({ 1: [5, 250] });
  });

  it("keeps the last TURNOVER_DAYS days", () => {
    let t = emptyTurnover();
    for (let d = 1; d <= TURNOVER_DAYS + 2; d++)
      t = addTurnover(t, `2026-12-${String(d).padStart(2, "0")}`, est([[1, 1, 10]]));
    expect(Object.keys(t.days)).toHaveLength(TURNOVER_DAYS);
    expect(Object.keys(t.days)[0]).toBe("2026-12-03");
    expect(tradedValue(t).get(1)).toBe(10 * TURNOVER_DAYS);
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
