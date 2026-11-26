import { describe, expect, it } from "vitest";
import { parseGold } from "../src/shared/gold.ts";
import { type Lot, normalFromDaily, valueLot } from "../src/shared/stockpile.ts";

describe("parseGold", () => {
  it("reads g/s/c in any combination", () => {
    expect(parseGold("11g 55s")).toBe(115500);
    expect(parseGold("11g55s20c")).toBe(115520);
    expect(parseGold("55s")).toBe(5500);
    expect(parseGold("80c")).toBe(80);
    expect(parseGold(" 1G 2S 3C ")).toBe(10203);
  });

  it("reads plain numbers as gold", () => {
    expect(parseGold("11.55")).toBe(115500);
    expect(parseGold("3")).toBe(30000);
    expect(parseGold("0,86")).toBe(8600);
  });

  it("rejects junk", () => {
    for (const s of ["", "g", "abc", "-3", "1g 2x", "1.2.3"]) expect(parseGold(s)).toBeNull();
  });
});

describe("valueLot (ADR-0011)", () => {
  const opt = { sellAboveCostPct: 30, sellAboveNormalPct: 15 };
  const lot: Lot = { id: "a", item: 1, qty: 10, unitCost: 60000, purpose: "resell", added: "2026-11-26" };

  it("values at market price after the 5% cut", () => {
    const v = valueLot(lot, { now: 80000, min: 79000, normal: 78000, qty: 50 }, opt);
    expect(v.cost).toBe(600000);
    expect(v.value).toBe(760000);
    expect(v.pl).toBe(160000);
    expect(v.plPct).toBeCloseTo(0.2667, 3);
    expect(v.sellAt).toBe(Math.ceil((60000 * 1.3) / 0.95)); // 82106
  });

  it("flags sell only when both the cost and the spike rules are met", () => {
    const market = (now: number, normal: number) => ({ now, min: now, normal, qty: 50 });
    expect(valueLot(lot, market(90000, 70000), opt).sell).toBe(true); // +45% net, +29% vs normal
    expect(valueLot(lot, market(90000, 85000), opt).sell).toBe(false); // not a spike: normal has caught up
    expect(valueLot(lot, market(80000, 50000), opt).sell).toBe(false); // spike, but under the cost target
  });

  it("never flags own-use lots, and handles unlisted items", () => {
    expect(valueLot({ ...lot, purpose: "own" }, { now: 200000, min: 1, normal: 60000, qty: 5 }, opt).sell).toBe(false);
    expect(valueLot({ ...lot, purpose: "alt" }, { now: 200000, min: 1, normal: 60000, qty: 5 }, opt).sell).toBe(true);
    const v = valueLot(lot, { now: null, min: null, normal: null, qty: 0 }, opt);
    expect(v).toMatchObject({ value: null, pl: null, sell: false });
    expect(valueLot(lot, undefined, opt).value).toBeNull();
  });
});

describe("normalFromDaily", () => {
  it("takes the median of the last 7 daily p10", () => {
    const p10 = [1, 2, 3, 100, 100, 100, 5, 6, 7, 8];
    const d = { d: p10.map(String), min: p10, p10, median: p10, qty: p10, listings: p10, n: p10 };
    expect(normalFromDaily(d)).toBe(8); // median of [100,100,100,5,6,7,8]
    expect(normalFromDaily({ ...d, p10: [] })).toBeNull();
  });
});
