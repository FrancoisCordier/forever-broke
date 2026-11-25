import { useId } from "react";
import { GROUPS, type ItemFilter } from "../lib/buylist.ts";

interface Props {
  value: ItemFilter;
  onChange: (f: ItemFilter) => void;
  /** Group keys that have items; others aren't offered. */
  groups: string[];
  /** e.g. "12 of 77 items". */
  summary?: string;
}

/** Name search + watchlist-group filter. */
export function ItemFilters({ value, onChange, groups, summary }: Props) {
  const id = useId();
  const options = GROUPS.filter(([key]) => groups.includes(key));
  const active = value.query !== "" || value.group !== "";
  return (
    <div className="filters">
      <div className="field">
        <label htmlFor={`${id}-q`}>Search</label>
        <input
          id={`${id}-q`}
          type="search"
          className="input-wide"
          placeholder="Item name"
          value={value.query}
          onChange={(e) => onChange({ ...value, query: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-g`}>Group</label>
        <select id={`${id}-g`} value={value.group} onChange={(e) => onChange({ ...value, group: e.target.value })}>
          <option value="">All groups</option>
          {options.map(([key, title]) => (
            <option key={key} value={key}>
              {title}
            </option>
          ))}
        </select>
      </div>
      {active ? (
        <button type="button" className="btn btn-ghost" onClick={() => onChange({ query: "", group: "" })}>
          Clear
        </button>
      ) : null}
      {summary ? <span className="muted small filters-summary">{summary}</span> : null}
    </div>
  );
}
