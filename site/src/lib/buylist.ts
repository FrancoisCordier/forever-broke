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

export interface Sections {
  buyNow: BuyListItem[];
  cheapOther: BuyListItem[];
  watch: BuyListItem[];
}

/** Split the buy list into the three sections of docs/ui.md. */
export function sections(items: BuyListItem[]): Sections {
  const byChange = (a: BuyListItem, b: BuyListItem) => (a.change ?? 0) - (b.change ?? 0);
  return {
    buyNow: items.filter((x) => x.cheap && isRaid(x)).sort(byChange),
    cheapOther: items.filter((x) => x.cheap && !isRaid(x)).sort(byChange),
    watch: items.filter((x) => !x.cheap && isRaid(x)).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Watchlist group keys (config.yaml) → display names, in display order. */
export const GROUPS: [string, string][] = [
  ["forever_raid", "New in Forever"],
  ["flasks", "Flasks"],
  ["potions", "Potions"],
  ["elixirs", "Elixirs"],
  ["food", "Food"],
  ["herbs", "Herbs"],
  ["elemental", "Elementals"],
  ["other", "Other materials"],
];
