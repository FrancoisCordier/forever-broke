/**
 * "Used in raids" tags, derived from recipes.json (verified recipe data, A16) and item classes.
 * A raid product = a watchlist item whose item class is Consumable (flask, potion, elixir, food, bomb…).
 * An item is raid-relevant if it is a raid product, or a reagent in a recipe that makes one.
 */
import { readFile } from "node:fs/promises";
import type { Use } from "../shared/signals.ts";
import type { ItemMeta } from "../shared/types.ts";

interface Recipe {
  name: string;
  profession: string;
  category: string;
  item: { id: number; name: string } | null;
  reagents: { id: number; name: string; qty: number }[];
}

export interface RaidInfo {
  /** The item itself is a raid consumable. */
  product: boolean;
  /** Recipes using it, raid products first. */
  uses: Use[];
}

export async function loadRecipes(path = "recipes.json"): Promise<Recipe[]> {
  try {
    return (JSON.parse(await readFile(path, "utf8")) as { recipes: Recipe[] }).recipes;
  } catch {
    return [];
  }
}

export function raidInfo(
  watch: Set<number>,
  items: Record<string, ItemMeta>,
  recipes: Recipe[],
): Map<number, RaidInfo> {
  const products = new Set([...watch].filter((id) => items[id]?.cls === "Consumable"));
  const out = new Map<number, RaidInfo>();
  for (const id of watch) out.set(id, { product: products.has(id), uses: [] });
  for (const r of recipes) {
    // Season of Discovery recipes exist in the data but nothing shows they're live in Forever,
    // and some items are literally named "… NYI" (not yet implemented).
    // Enchants have no crafted item: use the recipe name.
    const name = r.item?.name ?? r.name;
    if (/season of discovery/i.test(r.category) || /\bNYI\b/.test(name)) continue;
    const raid = r.item !== null && products.has(r.item.id);
    for (const g of r.reagents) {
      const info = out.get(g.id);
      if (!info || info.uses.some((u) => u.name === name)) continue;
      info.uses.push({ name, profession: r.profession, qty: g.qty, raid });
    }
  }
  for (const info of out.values())
    info.uses.sort((a, b) => Number(b.raid) - Number(a.raid) || a.name.localeCompare(b.name));
  return out;
}
