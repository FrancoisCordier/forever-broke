import { describe, expect, it } from "vitest";
import { appendHourly, emptyHourly } from "../src/shared/series.ts";
import { buyable, computeSignal, ladderOf, median } from "../src/shared/signals.ts";
import type { Listing, Stats } from "../src/shared/types.ts";

const H = 3600;
const T0 = Date.UTC(2026, 10, 25, 0) / 1000;
const st = (p10: number, qty = 100): Stats => ({ min: p10 - 1, p10, median: p10 + 1, qty, listings: 5 });
const opt = { cheapPct: 20, minUnitsListed: 20, minNormalDays: 1 };

function series(prices: number[], qtys?: number[]) {
  let h = emptyHourly();
  prices.forEach((p, i) => {
    h = appendHourly(h, T0 + i * H, st(p, qtys?.[i] ?? 100));
  });
  return h;
}

describe("median", () => {
  it("handles odd, even and empty", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(3); // rounded mean of 2 and 3
    expect(median([])).toBeNull();
  });
});

describe("ladder", () => {
  const ls: Listing[] = [
    { item: { id: 1 }, unit_price: 200, quantity: 5 },
    { item: { id: 1 }, unit_price: 100, quantity: 2 },
    { item: { id: 1 }, unit_price: 100, quantity: 3 },
  ];
  it("groups by price, ascending", () =>
    expect(ladderOf(ls)).toEqual([
      [100, 5],
      [200, 5],
    ]));
  it("sums units and cost up to a price", () => {
    expect(buyable(ladderOf(ls), 150)).toEqual({ units: 5, cost: 500 });
    expect(buyable(ladderOf(ls), 200)).toEqual({ units: 10, cost: 1500 });
  });
});

describe("computeSignal", () => {
  it("flags cheap when p10 is ≥ 20% under the 7-day median", () => {
    const prices = Array(48).fill(1000);
    prices[47] = 750;
    const s = computeSignal(
      1,
      series(prices),
      [
        [750, 30],
        [900, 50],
      ],
      opt,
    );
    expect(s?.normal).toBe(1000);
    expect(s?.change).toBeCloseTo(-0.25);
    expect(s?.upTo).toBe(800);
    expect(s?.unitsUpTo).toBe(30);
    expect(s?.costUpTo).toBe(22500);
    expect(s?.cheap).toBe(true);
  });

  it("does not flag cheap with less than a day of history", () => {
    const s = computeSignal(1, series([1000, 1000, 700]), [[700, 50]], opt);
    expect(s?.cheap).toBe(false);
    expect(s?.normalDays).toBeLessThan(1);
  });

  it("does not flag thin markets", () => {
    const prices = Array(48).fill(1000);
    prices[47] = 700;
    const qtys = Array(48).fill(5);
    expect(computeSignal(1, series(prices, qtys), [[700, 5]], opt)?.cheap).toBe(false);
  });

  it("measures supply change against the previous 3 days", () => {
    const qtys = Array(24).fill(200);
    qtys[23] = 150;
    const s = computeSignal(1, series(Array(24).fill(1000), qtys), [], opt);
    expect(s?.supplyChange).toBeCloseTo(-0.25);
  });

  it("downsamples the spark to one point per 3 hours", () => {
    const s = computeSignal(1, series(Array(24).fill(1000)), [], opt);
    expect(s?.spark.length).toBe(8);
  });
});
