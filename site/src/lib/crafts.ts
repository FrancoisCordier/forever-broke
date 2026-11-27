import type { CraftRow } from "../../../src/shared/crafts.ts";

export interface CraftFilter {
  /** Case-insensitive substring of the product or recipe name. */
  query: string;
  /** Profession name, or "" for all. */
  profession: string;
  /** Minimum units of the product sold per day; recipes without sales data are hidden when > 0. */
  minPerDay: number;
  /** Only recipes that make a profit at today's prices. */
  profitOnly: boolean;
  /** Only starred products. */
  starred: boolean;
}

export const ALL_CRAFTS: CraftFilter = { query: "", profession: "", minPerDay: 0, profitOnly: true, starred: false };

export function filterCrafts(rows: readonly CraftRow[], f: CraftFilter, stars: ReadonlySet<number>): CraftRow[] {
  const q = f.query.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!q || r.item.name.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)) &&
      (!f.profession || r.profession === f.profession) &&
      (!f.minPerDay || (r.perDay ?? 0) >= f.minPerDay) &&
      (!f.profitOnly || r.margin > 0) &&
      (!f.starred || stars.has(r.item.id)),
  );
}

/** Professions that have rows, by number of rows. */
export function professions(rows: readonly CraftRow[]): string[] {
  const n = new Map<string, number>();
  for (const r of rows) n.set(r.profession, (n.get(r.profession) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([p]) => p);
}
