import { describe, expect, it } from "vitest";
import { appendSales, type BookRow, bookRows, emptySales, estimateSales, summarizeSales } from "../src/shared/sales.ts";
import { resaleOf } from "../src/shared/signals.ts";

const row = (id: number, qty: number, price: number, short: 0 | 1 = 0): BookRow => [id, qty, price, short];

describe("estimateSales (ADR-0012)", () => {
  const prev = [row(1, 5, 100), row(2, 10, 110), row(3, 20, 150), row(4, 7, 300)];

  it("counts units gone from the bottom of the ladder, at the prices paid", () => {
    // 1 bought out, 2 bought down to 4, 3 untouched: 4 vanishing too is not a purchase.
    const cur = [row(2, 4, 110), row(3, 20, 150)];
    expect(estimateSales(prev, cur)).toEqual({ units: 5 + 6, value: 5 * 100 + 6 * 110 });
  });

  it("ignores listings that vanished above an untouched one", () => {
    expect(estimateSales(prev, [row(1, 5, 100), row(2, 10, 110), row(3, 20, 150)])).toEqual({ units: 0, value: 0 });
  });

  it("skips expiries and reposts but keeps walking up the ladder", () => {
    const p = [row(1, 3, 90, 1), row(2, 8, 100), row(3, 5, 120), row(4, 9, 200)];
    // 1 expired (SHORT), 2 reposted cheaper as a new listing of 8, 3 bought, 4 still there.
    const cur = [row(10, 8, 95), row(4, 9, 200)];
    expect(estimateSales(p, cur)).toEqual({ units: 5, value: 600 });
  });

  it("builds book rows from raw listings", () => {
    expect(
      bookRows([
        { id: 7, item: { id: 1 }, quantity: 2, unit_price: 50, time_left: "SHORT" },
        { id: 8, item: { id: 1 }, quantity: 3, unit_price: 60, time_left: "LONG" },
        { item: { id: 1 }, quantity: 1, unit_price: 1 },
      ]),
    ).toEqual([row(7, 2, 50, 1), row(8, 3, 60)]);
  });
});

describe("sales series", () => {
  const H = 3600;
  it("appends, drops repeats and summarizes per day", () => {
    let s = emptySales();
    s = appendSales(s, 10 * H, H, { units: 10, value: 1000 });
    s = appendSales(s, 11 * H, H, { units: 14, value: 1520 });
    expect(appendSales(s, 11 * H, H, { units: 99, value: 1 })).toBe(s);
    const sum = summarizeSales(s, 11 * H);
    expect(sum.hours).toBe(2);
    expect(sum.perDay).toBe(24 * 12); // 24 units in 2 hours
    expect(sum.avgPrice).toBe(Math.round(2520 / 24));
  });

  it("only looks at the window", () => {
    const s = appendSales(emptySales(), 1000, 3600, { units: 5, value: 50 });
    expect(summarizeSales(s, 1000 + 4 * 86400)).toEqual({ perDay: 0, avgPrice: null, hours: 0 });
  });
});

describe("resaleOf (ADR-0012)", () => {
  const opt = { flipMarginPct: 15, flipHoldDays: 2, flipMinSalesHours: 12, flipMinProfit: 50000 };
  const sales = { perDay: 10, avgPrice: 100000, hours: 24 }; // 10/day at 10g

  it("buys what's under the margin, capped at 2 days of sales", () => {
    // buyUpTo = floor(10g × 0.95 / 1.15) = 82608
    const ladder: [number, number][] = [
      [70000, 15],
      [80000, 30],
      [95000, 50],
    ];
    const { resale, flip } = resaleOf(ladder, sales, opt);
    expect(resale?.buyUpTo).toBe(82608);
    expect(resale?.units).toBe(20); // 45 listed under it, 2 days × 10 sold
    expect(resale?.cost).toBe(15 * 70000 + 5 * 80000);
    expect(resale?.profit).toBe(20 * 95000 - (15 * 70000 + 5 * 80000));
    expect(flip).toBe(true);
  });

  it("needs enough hours of evidence, a cheap listing and enough profit", () => {
    const ladder: [number, number][] = [[80000, 30]];
    expect(resaleOf(ladder, { ...sales, hours: 6 }, opt).flip).toBe(false);
    expect(resaleOf([[90000, 30]], sales, opt).flip).toBe(false); // nothing under buyUpTo
    expect(resaleOf([[82000, 1]], sales, opt).flip).toBe(false); // 1 unit: ~1.3g profit
    expect(resaleOf(ladder, null, opt)).toEqual({ resale: null, flip: false });
    expect(resaleOf(ladder, { ...sales, avgPrice: null }, opt).resale).toBeNull();
  });
});
