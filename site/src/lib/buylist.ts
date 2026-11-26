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

/** Sells well under what its reagents cost (ADR-0010). `=== true`: buy lists from before ADR-0010 lack the field. */
export const isBelowCraft = (x: BuyListItem) => x.belowCraft === true;

export interface Sections {
  buyNow: BuyListItem[];
  /** Raid consumables selling under their reagent cost, most under first. */
  belowCraft: BuyListItem[];
  cheapOther: BuyListItem[];
  watch: BuyListItem[];
}

/** Split the buy list into the sections of docs/ui.md. Vendor items are left out. */
export function sections(items: BuyListItem[]): Sections {
  const byChange = (a: BuyListItem, b: BuyListItem) => (a.change ?? 0) - (b.change ?? 0);
  const listed = items.filter((x) => !isVendor(x));
  return {
    buyNow: listed.filter((x) => x.cheap && isRaid(x)).sort(byChange),
    belowCraft: listed
      .filter((x) => isBelowCraft(x) && isRaid(x))
      .sort((a, b) => (a.craftChange ?? 0) - (b.craftChange ?? 0)),
    cheapOther: listed.filter((x) => x.cheap && !isRaid(x)).sort(byChange),
    watch: listed.filter((x) => !x.cheap && isRaid(x)),
  };
}

export interface ItemFilter {
  /** Case-insensitive substring of the item name. */
  query: string;
  /** Watchlist group key, or "" for all. */
  group: string;
}

export const NO_FILTER: ItemFilter = { query: "", group: "" };

export function applyFilter<T extends { name: string; group: string }>(items: T[], f: ItemFilter): T[] {
  const q = f.query.trim().toLowerCase();
  return items.filter((x) => (!q || x.name.toLowerCase().includes(q)) && (!f.group || x.group === f.group));
}

/** Watchlist group keys (config.yaml) → display names, in display order. */
export const GROUPS: [string, string][] = [
  ["forever_raid", "New in Forever"],
  ["flasks", "Flasks"],
  ["potions", "Potions"],
  ["elixirs", "Elixirs"],
  ["food", "Food"],
  ["utility", "Stones, explosives, bandages"],
  ["herbs", "Herbs"],
  ["elemental", "Elementals"],
  ["other", "Other materials"],
];
