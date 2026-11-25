import { describe, expect, it } from "vitest";
import { aggregate, weightedPercentile } from "../src/shared/aggregate.ts";
import type { Listing } from "../src/shared/types.ts";

const l = (item: number, unit_price: number, quantity: number): Listing => ({ item: { id: item }, unit_price, quantity });

describe("aggregate", () => {
  it("weights percentiles by quantity, not by listing", () => {
    // 1 unit at 100, 99 units at 200 → p10 and median are 200, min is 100
    const s = aggregate([l(1, 200, 99), l(1, 100, 1)]).get(1)!;
    expect(s).toEqual({ min: 100, p10: 200, median: 200, qty: 100, listings: 2 });
  });

  it("finds p10 and median on a spread of prices", () => {
    // 10 listings of 10 units at 100..1000
    const ls = Array.from({ length: 10 }, (_, i) => l(5, (i + 1) * 100, 10));
    const s = aggregate(ls).get(5)!;
    expect(s.min).toBe(100);
    expect(s.p10).toBe(100); // unit #10 of 100
    expect(s.median).toBe(500); // unit #50 of 100
    expect(s.qty).toBe(100);
  });

  it("separates items and handles a single listing", () => {
    const m = aggregate([l(1, 50, 3), l(2, 70, 1)]);
    expect(m.get(1)).toEqual({ min: 50, p10: 50, median: 50, qty: 3, listings: 1 });
    expect(m.get(2)?.median).toBe(70);
  });

  it("skips malformed listings", () => {
    const bad = [{ item: { id: 1 }, quantity: 0, unit_price: 5 }, { item: {}, quantity: 1, unit_price: 5 }] as unknown as Listing[];
    expect(aggregate(bad).size).toBe(0);
  });
});

describe("weightedPercentile", () => {
  it("returns the price of the unit at rank ceil(p*total)", () => {
    const sorted = [l(1, 10, 1), l(1, 20, 1), l(1, 30, 1)];
    expect(weightedPercentile(sorted, 3, 0.5)).toBe(20);
    expect(weightedPercentile(sorted, 3, 0.1)).toBe(10);
  });
});
