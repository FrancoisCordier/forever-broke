import type { Sort } from "../lib/sort.ts";

interface Props<K extends string> {
  label: string;
  col: K;
  sort: Sort<K>;
  onSort: (key: K) => void;
}

/** A clickable column header. Announces the sort state through aria-sort. */
export function SortHeader<K extends string>({ label, col, sort, onSort }: Props<K>) {
  const active = sort.key === col;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className="aria-[sort=ascending]:text-fg aria-[sort=descending]:text-fg"
    >
      <button type="button" className="inline-flex cursor-pointer items-center gap-1 py-1" onClick={() => onSort(col)}>
        {label}
        <span className="text-[10px] text-muted" aria-hidden="true">
          {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}
