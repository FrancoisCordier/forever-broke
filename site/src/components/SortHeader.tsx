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
    <th scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className="sort-btn" onClick={() => onSort(col)}>
        {label}
        <span className="sort-arrow" aria-hidden="true">
          {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}
