import { describe, expect, it } from "vitest";
import {
  ALL_DEALS,
  type DealInput,
  filterDeals,
  findDeals,
  planFlip,
  starredFirst,
  take,
} from "../site/src/lib/deals.ts";
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

/** 25% under a 4g normal, cheap up to 3g20s; buyers paid 3g (so no flip). */
const cheap = (id: number, extra: Partial<BuyListItem> = {}) =>
  item(id, 3 * G, { normal: 4 * G, cheap: true, upTo: 3.2 * G, change: -0.25, ...extra });

/** Buyers paid 4g (20 a day), normal 5g; listed 10 at 3g, 10 at 3g70s, 5 at 3g90s. */
const flippable = (id: number, extra: Partial<BuyListItem> = {}) =>
  item(id, 3 * G, {
    normal: 5 * G,
    sales: { perDay: 20, avgPrice: 4 * G, hours: 24 },
    ladder: [
      [3 * G, 10],
      [3.7 * G, 10],
      [3.9 * G, 5],
    ],
    ...extra,
  });

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

describe("planFlip (ADR-0015)", () => {
  it("relists at what buyers paid and buys every unit that profits after the cut, with no margin", () => {
    const f = planFlip(flippable(1), 0);
    // 4g × 0.95 = 3g80s net: the 3g and 3g70s units profit, the 3g90s ones don't.
    expect(f).toMatchObject({ proven: 4 * G, relist: 4 * G, buyUpTo: 3.8 * G - 1, units: 20, cost: 67 * G });
    expect(f?.profit).toBe(20 * 3.8 * G - 67 * G);
    // Ours sell after the 5 units left at 3g90s: 25 units ÷ 20 a day.
    expect(f?.days).toBe(1.25);
  });

  it("never assumes more than normal when buyers paid above it", () => {
    const f = planFlip(flippable(1, { normal: 3.5 * G }), 0);
    expect(f).toMatchObject({ relist: 3.5 * G, units: 10, profit: 10 * 3.325 * G - 30 * G });
    expect(f?.days).toBe(0.5);
  });

  it("relists under the listing that would make the queue longer than FLIP_DAYS", () => {
    // 5 a day × 3 days = 15: the 3g70s level (10 + 10 units) is too much, so relist just under it.
    const f = planFlip(flippable(1, { sales: { perDay: 5, avgPrice: 4 * G, hours: 24 } }), 0);
    expect(f).toMatchObject({ relist: 3.7 * G - 1, units: 10, days: 2 });
    expect(f?.profit).toBe(10 * Math.floor((3.7 * G - 1) * 0.95) - 30 * G);
  });

  it("needs enough sales data and some sales", () => {
    expect(planFlip(flippable(1, { sales: { perDay: 20, avgPrice: 4 * G, hours: 6 } }), 0)).toBeNull();
    expect(planFlip(flippable(1, { sales: { perDay: 0, avgPrice: null, hours: 24 } }), 0)).toBeNull();
  });

  it("the budget cuts the units, not the days: what we leave sells first", () => {
    expect(planFlip(flippable(1), 10 * G)).toMatchObject({ units: 3, cost: 9 * G, capped: true, days: 1.25 });
  });
});

describe("findDeals (ADR-0014 step 1)", () => {
  it("a cheap kit item: buys what the nights need, and shows what that saves", () => {
    const [d] = findDeals(input([cheap(1)], { kit }));
    expect(d).toMatchObject({ verdict: "buy", valueKind: "saves", units: 4, cost: 12 * G, slot: "Flask", inKit: true });
    expect(d.value).toBe(4 * 4 * G - 12 * G);
    expect(d.discount).toBeCloseTo(-0.25);
  });

  it("anything bought to resell is a FLIP, with why and what to do", () => {
    const [d] = findDeals(input([flippable(2)]));
    expect(d).toMatchObject({ verdict: "flip", units: 20, sellAt: 4 * G, buyUpTo: 3.8 * G - 1, daysToSell: 1.25 });
    expect(d.reasons).toEqual(["−25% vs what buyers paid"]);
    // Cheap vs normal but buyers paid what it costs now: no profit to make, so no row.
    expect(findDeals(input([cheap(3)]))).toEqual([]);
  });

  it("skips small profits, vendor and soulbound items", () => {
    const small = flippable(4, { ladder: [[3.7 * G, 1]] }); // 3g80s net − 3g70s = 10s, under 1g
    const vendor = flippable(5, { vendorPrice: 3 * G });
    expect(findDeals(input([small, vendor, flippable(6)], { soulbound: new Set([6]) }))).toEqual([]);
  });

  it("a kit item that is also a flip gets both rows", () => {
    // Normal 4g caps the relist; 20 listed sell in 2 days at 10 a day.
    const x = cheap(1, { sales: { perDay: 10, avgPrice: 5 * G, hours: 24 }, ladder: [[3 * G, 20]] });
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
    const small = flippable(10, { ladder: [[3 * G, 10]] });
    const big = flippable(11);
    expect(findDeals(input([small, big])).map((d) => d.id)).toEqual([11, 10]);
  });
});

describe("filterDeals", () => {
  const big = item(2, 3 * G, { normal: 10 * G, sales: { perDay: 100, avgPrice: 10 * G, hours: 24 } });
  const deals = findDeals(input([cheap(1), big], { kit }));
  const name = (d: { id: number }) => `Item ${d.id}`;

  it("% off, sells per day, kit only, starred, search", () => {
    expect(filterDeals(deals, { ...ALL_DEALS, minOff: 50 }, new Set(), name).map((d) => d.id)).toEqual([2]);
    expect(filterDeals(deals, { ...ALL_DEALS, minPerDay: 200 }, new Set(), name)).toEqual([]);
    expect(filterDeals(deals, { ...ALL_DEALS, kitOnly: true }, new Set(), name).map((d) => d.id)).toEqual([1]);
    expect(filterDeals(deals, { ...ALL_DEALS, starred: true }, new Set([2]), name).map((d) => d.id)).toEqual([2]);
    expect(filterDeals(deals, { ...ALL_DEALS, query: "item 1" }, new Set(), name).map((d) => d.id)).toEqual([1]);
  });

  it("starred first keeps the order otherwise", () => {
    expect(starredFirst(deals, new Set([1])).map((d) => d.id)[0]).toBe(1);
  });
});
