import { useState } from "react";

export type Dir = "asc" | "desc";

export interface Sort<K extends string> {
  key: K;
  dir: Dir;
}

/** Sort state for a table. Clicking the active column flips direction; a new column starts at its default. */
export function useSort<K extends string>(initial: Sort<K>, defaults: Partial<Record<K, Dir>> = {}) {
  const [sort, setSort] = useState<Sort<K>>(initial);
  const toggle = (key: K) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: defaults[key] ?? "asc" },
    );
  return { sort, toggle };
}

/** Stable sort by a value; nulls always go last, whatever the direction. */
export function sortRows<T>(rows: T[], get: (row: T) => number | string | null, dir: Dir): T[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1;
    if (typeof va === "string" && typeof vb === "string") return sign * va.localeCompare(vb);
    return sign * (Number(va) - Number(vb));
  });
}
