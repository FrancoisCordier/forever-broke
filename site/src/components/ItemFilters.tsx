import { useId } from "react";
import { GROUPS, type ItemFilter } from "../lib/buylist.ts";
import { btn, field, label, select, small, textInput } from "../lib/ui.ts";

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
    <div className="flex flex-wrap items-end gap-3">
      <div className={field}>
        <label htmlFor={`${id}-q`} className={label}>
          Search
        </label>
        <input
          id={`${id}-q`}
          type="search"
          className={textInput}
          placeholder="Item name"
          value={value.query}
          onChange={(e) => onChange({ ...value, query: e.target.value })}
        />
      </div>
      <div className={field}>
        <label htmlFor={`${id}-g`} className={label}>
          Group
        </label>
        <select
          id={`${id}-g`}
          className={select}
          value={value.group}
          onChange={(e) => onChange({ ...value, group: e.target.value })}
        >
          <option value="">All groups</option>
          {options.map(([key, title]) => (
            <option key={key} value={key}>
              {title}
            </option>
          ))}
        </select>
      </div>
      {active ? (
        <button type="button" className={btn("ghost")} onClick={() => onChange({ query: "", group: "" })}>
          Clear
        </button>
      ) : null}
      {summary ? <span className={`${small} ml-auto self-center text-muted`}>{summary}</span> : null}
    </div>
  );
}
