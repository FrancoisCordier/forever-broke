import { describe, expect, it } from "vitest";
import { appendHourly, emptyHourly } from "../src/shared/series.ts";
import {
  belowCraft,
  buyable,
  computeSignal,
  costOfUnits,
  craftCost,
  ladderOf,
  median,
  notListed,
} from "../src/shared/signals.ts";
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

  it("returns null without history; notListed stands in for it", () => {
    expect(computeSignal(1, series([]), [], opt)).toBeNull();
    const s = notListed(1, 100);
    expect(s.now).toBeNull();
    expect(s.cheap).toBe(false);
    expect(s.qty).toBe(0);
  });
});

describe("costOfUnits", () => {
  const ladder: [number, number][] = [
    [100, 2],
    [150, 3],
    [400, 10],
  ];
  it("walks the ladder cheapest first", () => {
    expect(costOfUnits(ladder, 4)).toEqual({ units: 4, cost: 2 * 100 + 2 * 150 });
    expect(costOfUnits(ladder, 0)).toEqual({ units: 0, cost: 0 });
  });
  it("stops when the ladder runs out", () => {
    expect(costOfUnits(ladder, 50)).toEqual({ units: 15, cost: 200 + 450 + 4000 });
  });
});

describe("craft cost (ADR-0010)", () => {
  const recipe = {
    profession: "Alchemy",
    makes: 1,
    reagents: [
      { id: 1, name: "Silversage", qty: 2 },
      { id: 2, name: "Plaguebloom", qty: 2 },
      { id: 3, name: "Crystal Vial", qty: 1 },
    ],
  };
  const prices: Record<number, number> = { 1: 1200, 2: 4900, 3: 500 };
  const priceOf = (id: number) => prices[id] ?? null;

  it("sums reagents per crafted unit", () => {
    expect(craftCost(recipe, priceOf)).toEqual({ cost: 12700, missing: [] });
    expect(craftCost({ ...recipe, makes: 2 }, priceOf).cost).toBe(6350);
  });

  it("is null when a reagent isn't listed", () => {
    expect(craftCost(recipe, (id) => (id === 2 ? null : priceOf(id)))).toEqual({
      cost: null,
      missing: ["Plaguebloom"],
    });
  });

  const craftOpt = { belowCraftPct: 10, minUnitsListed: 20 };

  it("flags a product selling well under its reagents", () => {
    const r = belowCraft(8600, 932, 12700, craftOpt);
    expect(r.craftChange).toBeCloseTo(-0.323, 3);
    expect(r.belowCraft).toBe(true);
  });

  it("ignores small gaps, thin markets and missing prices", () => {
    expect(belowCraft(9900, 300, 10000, craftOpt).belowCraft).toBe(false); // −1%
    expect(belowCraft(5000, 5, 10000, craftOpt).belowCraft).toBe(false); // 5 units listed
    expect(belowCraft(null, 0, 10000, craftOpt)).toEqual({ craftChange: null, belowCraft: false });
    expect(belowCraft(5000, 100, null, craftOpt)).toEqual({ craftChange: null, belowCraft: false });
  });
});
