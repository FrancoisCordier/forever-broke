import { describe, expect, it } from "vitest";
import { ALL_DEALS, type DealInput, filterDeals, findDeals, starredFirst, take } from "../site/src/lib/deals.ts";
import type { KitPrefs } from "../site/src/lib/kit.ts";
import type { BuyListItem, Kit } from "../src/shared/signals.ts";
import type { Lot, LotValue } from "../src/shared/stockpile.ts";

const G = 10000;

/** A watchlist item listed at `now` (qty units), with defaults that trigger nothing. */
function item(id: number, now: number, extra: Partial<BuyListItem> = {}): BuyListItem {
  return {
    id,
    name: `Item ${id}`,
    now,
    qty: 100,
    normal: now,
    normalDays: 7,
    cheap: false,
    upTo: null,
    belowCraft: false,
    craftCost: null,
    vendorPrice: null,
    ladder: [[now, 100]],
    sales: { perDay: 10, avgPrice: now, hours: 24 },
    flip: false,
    resale: null,
    spark: [],
    ...extra,
  } as unknown as BuyListItem;
}

/** 25% under a 4g normal, cheap up to 3g20s. */
const cheap = (id: number, extra: Partial<BuyListItem> = {}) =>
  item(id, 3 * G, { normal: 4 * G, cheap: true, upTo: 3.2 * G, change: -0.25, ...extra });

const prefs: KitPrefs = { kit: "k", nights: 2, choice: {}, perNight: {} };
const kit: Kit = {
  id: "k",
  label: "Hunter · MM",
  class: "Hunter",
  spec: "MM",
  slots: [{ slot: "Flask", perNight: 2, options: [1] }],
};
const input = (items: BuyListItem[], extra: Partial<DealInput> = {}): DealInput => ({
  items,
  budget: 0,
  belowCraftPct: 10,
  prefs,
  soulbound: new Set(),
  lots: [],
  ...extra,
});

describe("take", () => {
  it("walks the ladder cheapest first under the price", () => {
    expect(
      take(
        [
          [1, 5],
          [2, 5],
          [9, 5],
        ],
        2,
        100,
        0,
      ),
    ).toEqual({ units: 10, cost: 15, capped: false });
  });
  it("stops at the budget and says so", () => {
    expect(take([[10, 5]], 10, 5, 35)).toEqual({ units: 3, cost: 30, capped: true });
  });
});

describe("findDeals (ADR-0014 step 1)", () => {
  it("a cheap kit item: buys what the nights need, and shows what that saves", () => {
    const [d] = findDeals(input([cheap(1)], { kit }));
    expect(d).toMatchObject({ verdict: "buy", valueKind: "saves", units: 4, cost: 12 * G, slot: "Flask", inKit: true });
    expect(d.value).toBe(4 * 4 * G - 12 * G);
    expect(d.discount).toBeCloseTo(-0.25);
  });

  it("a cheap item off the kit: stock to resell at normal, capped at a week of sales, only if it profits", () => {
    const [d] = findDeals(input([cheap(2, { sales: { perDay: 5, avgPrice: 4 * G, hours: 24 } })]));
    expect(d).toMatchObject({ verdict: "buy", valueKind: "profit", units: 35, sellAt: 4 * G });
    expect(d.value).toBe(Math.round(35 * 4 * G * 0.95) - 35 * 3 * G);
    expect(d.daysToSell).toBe(7);
    // Under craft cost only: at its normal price, so stocking it can't profit.
    expect(findDeals(input([item(3, 3 * G, { belowCraft: true, craftCost: 5 * G })]))).toEqual([]);
  });

  it("never stocks a unit that can't resell at normal with the margin, nor a tiny profit", () => {
    // Under reagent cost up to 9g, but it resells at 4g: only units ≤ 4g × 0.95 / 1.15 ≈ 3g30s qualify.
    const x = cheap(12, {
      belowCraft: true,
      craftCost: 10 * G,
      ladder: [
        [3 * G, 10],
        [3.5 * G, 10],
      ],
    });
    const [d] = findDeals(input([x]));
    expect(d).toMatchObject({ units: 10, buyUpTo: Math.floor((4 * G * 0.95) / 1.15) });
    expect(findDeals(input([cheap(13, { ladder: [[3 * G, 3]] })]))).toEqual([]); // 3 units: +2g40s
  });

  it("skips what nobody bought over enough hours, vendor and soulbound items", () => {
    const dead = cheap(4, { sales: { perDay: 0, avgPrice: null, hours: 24 } });
    const vendor = cheap(5, { vendorPrice: 3 * G });
    expect(findDeals(input([dead, vendor, cheap(6)], { soulbound: new Set([6]) }))).toEqual([]);
  });

  it("a flip uses the collector's resale, cut to the budget", () => {
    const x = item(7, 2 * G, {
      flip: true,
      resale: { price: 3 * G, buyUpTo: 2.4 * G, units: 20, cost: 40 * G, profit: 17 * G },
    });
    const [d] = findDeals(input([x], { budget: 10 * G }));
    expect(d).toMatchObject({ verdict: "flip", units: 5, cost: 10 * G, capped: true, sellAt: 3 * G });
    expect(d.value).toBe(Math.round(5 * 3 * G * 0.95) - 10 * G);
    expect(d.daysToSell).toBe(0.5);
  });

  it("a kit item that is also a flip gets both rows", () => {
    const x = cheap(1, { flip: true, resale: { price: 5 * G, buyUpTo: 4 * G, units: 10, cost: 30 * G, profit: 1 } });
    expect(
      findDeals(input([x], { kit }))
        .map((d) => d.verdict)
        .sort(),
    ).toEqual(["buy", "flip"]);
  });

  it("a lot that meets the sell rules is a SELL row with its P/L", () => {
    const lot: Lot = { id: "l1", item: 9, qty: 10, unitCost: G, purpose: "resell", added: "2026-11-26" };
    const v: LotValue = { cost: 10 * G, value: 19 * G, pl: 9 * G, plPct: 0.9, sellAt: 1.4 * G, sell: true };
    const [d] = findDeals(input([], { lots: [{ lot, v, m: { now: 2 * G, min: 2 * G, normal: 1.5 * G, qty: 40 } }] }));
    expect(d).toMatchObject({ verdict: "sell", units: 10, value: 9 * G, sellAt: 2 * G, x: null, listed: 40 });
    expect(findDeals(input([], { lots: [{ lot, v: { ...v, sell: false } }] }))).toEqual([]);
  });

  it("ranks by value", () => {
    const small = cheap(10, { qty: 10, ladder: [[3 * G, 10]] });
    const big = cheap(11);
    expect(findDeals(input([small, big])).map((d) => d.id)).toEqual([11, 10]);
  });
});

describe("filterDeals", () => {
  const deals = findDeals(input([cheap(1), cheap(2, { normal: 10 * G, change: -0.7 })], { kit }));
  const name = (d: { id: number }) => `Item ${d.id}`;

  it("% off, sells per day, kit only, starred, search", () => {
    expect(filterDeals(deals, { ...ALL_DEALS, minOff: 50 }, new Set(), name).map((d) => d.id)).toEqual([2]);
    expect(filterDeals(deals, { ...ALL_DEALS, minPerDay: 20 }, new Set(), name)).toEqual([]);
    expect(filterDeals(deals, { ...ALL_DEALS, kitOnly: true }, new Set(), name).map((d) => d.id)).toEqual([1]);
    expect(filterDeals(deals, { ...ALL_DEALS, starred: true }, new Set([2]), name).map((d) => d.id)).toEqual([2]);
    expect(filterDeals(deals, { ...ALL_DEALS, query: "item 1" }, new Set(), name).map((d) => d.id)).toEqual([1]);
  });

  it("starred first keeps the order otherwise", () => {
    expect(starredFirst(deals, new Set([1])).map((d) => d.id)[0]).toBe(1);
  });
});
