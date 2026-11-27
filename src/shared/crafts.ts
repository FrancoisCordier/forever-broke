/**
 * Crafting profit over every recipe (ADR-0014 step 5): what the reagents cost at today's prices vs what the product
 * sells for, after the AH cut, and how much of it sells per day.
 */
import type { SalesSummary } from "./sales.ts";
import { AH_CUT } from "./signals.ts";

/** One entry of recipes.json (A16). */
export interface Recipe {
  id: number;
  name: string;
  profession: string;
  category: string;
  /** Null for enchants: they make no item. */
  item: { id: number; name: string } | null;
  makes: number;
  reagents: { id: number; name: string; qty: number }[];
}

/**
 * Season of Discovery recipes exist in the data but nothing shows they're live in Forever,
 * and some items are literally named "… NYI" (not yet implemented).
 */
export const isLiveRecipe = (r: Recipe) =>
  !/season of discovery/i.test(r.category) && !/\bNYI\b/.test(r.item?.name ?? r.name);

/**
 * Crafts limited by a cooldown, so their sales rate says nothing about what one crafter can make: transmutes and
 * Mooncloth. Game knowledge, not in the API data, and UNVERIFIED on Forever.
 */
export const hasCooldown = (r: Recipe) => /transmut/i.test(r.category) || r.item?.name === "Mooncloth";

export interface CraftReagent {
  id: number;
  name: string;
  qty: number;
  /** Unit price used: AH p10, or the vendor price when an NPC sells it for less. */
  price: number;
}

/** One recipe in {house}/crafts.json. All prices are copper per crafted unit unless said otherwise. */
export interface CraftRow {
  recipe: number;
  /** Recipe name, e.g. "Transmute: Fire to Earth" (several recipes can make the same item). */
  name: string;
  profession: string;
  category: string;
  item: { id: number; name: string; quality: string | null; icon: number | null };
  makes: number;
  reagents: CraftReagent[];
  /** Reagent cost per crafted unit. */
  cost: number;
  /** Price to post at: the product's p10 now, or what buyers paid when that's lower (with enough sales data). */
  sellAt: number;
  /** sellAt after the 5% cut, minus cost. */
  margin: number;
  /** margin / cost. */
  marginPct: number;
  /** Product units listed now (the queue you'd post behind). */
  listed: number;
  /** Product units sold per day, when the product is tracked (watchlist or market set); null otherwise. */
  perDay: number | null;
  /** Hours of sales data behind perDay. */
  salesHours: number | null;
  /**
   * margin × perDay: what the whole AH makes on it per day, the ceiling of one crafter's share. Null without
   * enough sales data (minSalesHours), with no margin, or on a cooldown craft.
   */
  profitPerDay: number | null;
  /** Limited by a cooldown (hasCooldown). */
  cooldown: boolean;
}

export interface Crafts {
  house: number;
  t: number;
  rows: CraftRow[];
  /** Recipes left out because a reagent isn't listed (and no vendor sells it). */
  unpriced: number;
  /** Recipes left out because the product isn't listed as a commodity (gear, or nobody sells it now). */
  unlisted: number;
}

export interface CraftInputs {
  /** A reagent's unit price (already the cheaper of AH and vendor), or null when it can't be bought. */
  priceOf: (id: number) => number | null;
  /** The product's p10 and units listed now, or null when it isn't listed. */
  productOf: (id: number) => { p10: number; qty: number } | null;
  /** Sales summary of a tracked product, or null. */
  salesOf: (id: number) => SalesSummary | null;
  meta: (id: number) => { quality: string | null; icon: number | null };
  /** Products an NPC sells: their price is capped, so crafting them can't profit. */
  vendor: ReadonlySet<number>;
  /** Hours of sales data before what buyers paid can lower the sell price. */
  minSalesHours: number;
}

export function craftRows(recipes: readonly Recipe[], inp: CraftInputs): Omit<Crafts, "house" | "t"> {
  const rows: CraftRow[] = [];
  let unpriced = 0;
  let unlisted = 0;
  for (const r of recipes) {
    if (!r.item || !isLiveRecipe(r) || inp.vendor.has(r.item.id)) continue;
    const product = inp.productOf(r.item.id);
    if (!product) {
      unlisted++;
      continue;
    }
    const reagents: CraftReagent[] = [];
    let total = 0;
    for (const g of r.reagents) {
      const price = inp.priceOf(g.id);
      if (price === null) break;
      reagents.push({ ...g, price });
      total += price * g.qty;
    }
    if (reagents.length < r.reagents.length) {
      unpriced++;
      continue;
    }
    const makes = r.makes || 1;
    const cost = Math.round(total / makes);
    const sales = inp.salesOf(r.item.id);
    // A few hours of sales are mostly reposts and undercuts: don't price or rank on them.
    const trusted = sales !== null && sales.hours >= inp.minSalesHours;
    const paid = trusted ? sales.avgPrice : null;
    const sellAt = paid === null ? product.p10 : Math.min(product.p10, paid);
    const margin = Math.round(sellAt * (1 - AH_CUT)) - cost;
    const cooldown = hasCooldown(r);
    rows.push({
      recipe: r.id,
      name: r.name,
      profession: r.profession,
      category: r.category,
      item: { id: r.item.id, name: r.item.name, ...inp.meta(r.item.id) },
      makes,
      reagents,
      cost,
      sellAt,
      margin,
      marginPct: cost ? margin / cost : 0,
      listed: product.qty,
      perDay: sales ? sales.perDay : null,
      salesHours: sales ? sales.hours : null,
      profitPerDay: trusted && margin > 0 && !cooldown ? Math.round(margin * sales.perDay) : null,
      cooldown,
    });
  }
  rows.sort((a, b) => (b.profitPerDay ?? -1) - (a.profitPerDay ?? -1) || b.margin - a.margin);
  return { rows, unpriced, unlisted };
}
