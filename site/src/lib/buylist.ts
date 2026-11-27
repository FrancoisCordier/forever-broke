import type { BuyListItem } from "../../../src/shared/signals.ts";

/** Used for the raid: a raid consumable itself, or a reagent of one. */
export const isRaid = (x: BuyListItem) => x.raidProduct || x.uses.some((u) => u.raid);

/** Short "why it matters for raids" label, e.g. "Raid · Flask of Natural Accuracy + 3 more". */
export function raidLabel(x: BuyListItem): string | null {
  if (x.raidProduct) return "Raid consumable";
  const raidUses = x.uses.filter((u) => u.raid).map((u) => u.name);
  if (raidUses.length === 0) return null;
  if (raidUses.length <= 2) return `Raid · ${raidUses.join(" & ")}`;
  return `Raid · ${raidUses[0]} + ${raidUses.length - 1} more`;
}

/** Item is sold by an NPC and the AH price is at (or near) that vendor price. */
export const atVendorPrice = (x: BuyListItem) =>
  x.vendorPrice !== null && x.now !== null && x.now >= x.vendorPrice * 0.98;

/**
 * An NPC sells it (config.yaml vendorPrices), so its AH price is capped and it's never worth stockpiling.
 * Hidden from every list. Still used for craft costs.
 */
export const isVendor = (x: BuyListItem) => x.vendorPrice !== null;

export interface ItemFilter {
  /** Case-insensitive substring of the item name. */
  query: string;
  /** Watchlist group key, or "" for all. */
  group: string;
  /** Only starred items (ADR-0014). */
  starred: boolean;
}

export const NO_FILTER: ItemFilter = { query: "", group: "", starred: false };

export function applyFilter<T extends { id: number; name: string; group: string }>(
  items: T[],
  f: ItemFilter,
  stars: ReadonlySet<number> = new Set(),
): T[] {
  const q = f.query.trim().toLowerCase();
  return items.filter(
    (x) =>
      (!q || x.name.toLowerCase().includes(q)) && (!f.group || x.group === f.group) && (!f.starred || stars.has(x.id)),
  );
}

/** Watchlist group keys (config.yaml) → display names, in display order. */
export const GROUPS: [string, string][] = [
  ["forever_raid", "New in Forever"],
  ["flasks", "Flasks"],
  ["potions", "Potions"],
  ["elixirs", "Elixirs"],
  ["food", "Food"],
  ["buffs", "Other buffs"],
  ["weapon", "Oils, stones, scrolls"],
  ["utility", "Stones, explosives, bandages"],
  ["herbs", "Herbs"],
  ["elemental", "Elementals"],
  ["other", "Other materials"],
];
