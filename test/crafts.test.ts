import { describe, expect, it } from "vitest";
import { ALL_CRAFTS, filterCrafts, professions } from "../site/src/lib/crafts.ts";
import { type CraftInputs, craftRows, type Recipe } from "../src/shared/crafts.ts";
import type { SalesSummary } from "../src/shared/sales.ts";

const G = 10000;

const recipe = (
  id: number,
  item: number | null,
  reagents: [number, number][],
  extra: Partial<Recipe> = {},
): Recipe => ({
  id,
  name: `Recipe ${id}`,
  profession: "Alchemy",
  category: "Potions",
  item: item === null ? null : { id: item, name: `Item ${item}` },
  makes: 1,
  reagents: reagents.map(([rid, qty]) => ({ id: rid, name: `Reagent ${rid}`, qty })),
  ...extra,
});

function inputs(over: Partial<CraftInputs> = {}): CraftInputs {
  const prices: Record<number, number> = { 1: 1 * G, 2: 2 * G };
  const products: Record<number, { p10: number; qty: number }> = { 100: { p10: 10 * G, qty: 50 } };
  return {
    priceOf: (id) => prices[id] ?? null,
    productOf: (id) => products[id] ?? null,
    salesOf: () => null,
    meta: () => ({ quality: "COMMON", icon: null }),
    vendor: new Set(),
    minSalesHours: 12,
    ...over,
  };
}

const sales = (perDay: number, avgPrice: number | null, hours: number): SalesSummary => ({ perDay, avgPrice, hours });

describe("craftRows", () => {
  it("prices reagents and the product after the cut", () => {
    const { rows } = craftRows(
      [
        recipe(1, 100, [
          [1, 2],
          [2, 1],
        ]),
      ],
      inputs(),
    );
    expect(rows).toHaveLength(1);
    // cost 2×1g + 1×2g = 4g; sell 10g × 0.95 = 9.5g
    expect(rows[0]).toMatchObject({ cost: 4 * G, sellAt: 10 * G, margin: 5.5 * G, listed: 50, perDay: null });
    expect(rows[0].marginPct).toBeCloseTo(1.375);
    expect(rows[0].profitPerDay).toBeNull();
  });

  it("divides by units made", () => {
    const { rows } = craftRows([recipe(1, 100, [[2, 3]], { makes: 2 })], inputs());
    expect(rows[0].cost).toBe(3 * G);
  });

  it("counts recipes it can't price, and skips enchants, vendor products and SoD", () => {
    const out = craftRows(
      [
        recipe(1, 100, [[9, 1]]), // reagent not listed
        recipe(2, 200, [[1, 1]]), // product not listed
        recipe(3, null, [[1, 1]]), // enchant
        recipe(4, 100, [[1, 1]], { category: "SEASON OF DISCOVERY" }),
        recipe(5, 300, [[1, 1]]),
      ],
      inputs({
        vendor: new Set([300]),
        productOf: (id) => (id === 300 ? { p10: G, qty: 1 } : id === 100 ? { p10: G, qty: 1 } : null),
      }),
    );
    expect(out.rows).toEqual([]);
    expect(out.unpriced).toBe(1);
    expect(out.unlisted).toBe(1);
  });

  it("needs enough sales data before using what buyers paid or a profit per day", () => {
    const few = craftRows([recipe(1, 100, [[1, 1]])], inputs({ salesOf: () => sales(40, 8 * G, 3) })).rows[0];
    expect(few).toMatchObject({ sellAt: 10 * G, perDay: 40, salesHours: 3, profitPerDay: null });

    const enough = craftRows([recipe(1, 100, [[1, 1]])], inputs({ salesOf: () => sales(40, 8 * G, 24) })).rows[0];
    // sell at what buyers paid (8g < 10g p10): 7.6g − 1g = 6.6g × 40/day
    expect(enough).toMatchObject({ sellAt: 8 * G, margin: 6.6 * G, profitPerDay: 264 * G });
  });

  it("gives no profit per day to a cooldown craft or a loss", () => {
    const inp = inputs({ salesOf: () => sales(40, null, 24) });
    const [t] = craftRows([recipe(1, 100, [[1, 1]], { category: "Lesser Transmutations" })], inp).rows;
    expect(t).toMatchObject({ cooldown: true, profitPerDay: null });
    const [loss] = craftRows([recipe(2, 100, [[2, 5]])], inp).rows;
    expect(loss.margin).toBeLessThan(0);
    expect(loss.profitPerDay).toBeNull();
  });

  it("ranks by profit per day, then margin", () => {
    const products = { 100: { p10: 10 * G, qty: 5 }, 101: { p10: 20 * G, qty: 5 }, 102: { p10: 5 * G, qty: 5 } };
    const { rows } = craftRows(
      [recipe(1, 100, [[1, 1]]), recipe(2, 101, [[1, 1]]), recipe(3, 102, [[1, 1]])],
      inputs({
        productOf: (id) => products[id as keyof typeof products] ?? null,
        salesOf: (id) => (id === 102 ? sales(1000, null, 24) : null),
      }),
    );
    expect(rows.map((r) => r.item.id)).toEqual([102, 101, 100]);
  });
});

describe("filterCrafts", () => {
  const rows = craftRows(
    [recipe(1, 100, [[1, 1]]), recipe(2, 101, [[2, 9]], { profession: "Blacksmithing", name: "Smelt Thing" })],
    inputs({
      productOf: (id) => (id === 100 || id === 101 ? { p10: 10 * G, qty: 1 } : null),
      salesOf: (id) => (id === 100 ? sales(6, null, 24) : null),
    }),
  ).rows;

  it("hides losses by default and filters by profession, sales, name and stars", () => {
    expect(filterCrafts(rows, ALL_CRAFTS, new Set()).map((r) => r.recipe)).toEqual([1]);
    const all = { ...ALL_CRAFTS, profitOnly: false };
    expect(filterCrafts(rows, all, new Set())).toHaveLength(2);
    expect(filterCrafts(rows, { ...all, profession: "Blacksmithing" }, new Set()).map((r) => r.recipe)).toEqual([2]);
    expect(filterCrafts(rows, { ...all, minPerDay: 5 }, new Set()).map((r) => r.recipe)).toEqual([1]);
    expect(filterCrafts(rows, { ...all, query: "smelt" }, new Set()).map((r) => r.recipe)).toEqual([2]);
    expect(filterCrafts(rows, { ...all, starred: true }, new Set([101])).map((r) => r.recipe)).toEqual([2]);
    expect(professions(rows)).toEqual(["Alchemy", "Blacksmithing"]);
  });
});
