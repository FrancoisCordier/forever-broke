import { segment } from "../lib/ui.ts";

/** A legend on the same line as its buttons (as on My kit): floated, since a legend ignores the fieldset's flex. */
const LEGEND = "float-left mr-1.5 text-xs font-medium text-muted";
const FIELDSET = "m-0 flex flex-wrap items-center gap-1.5 border-0 p-0";

/** A row of toggle buttons, one pressed: e.g. "Sells / day [Any|1+|5+|20+]". */
export function Segments<T extends string | number>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: [T, string][];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className={FIELDSET}>
      <legend className={LEGEND}>{legend}</legend>
      {options.map(([v, text]) => (
        <button
          key={String(v)}
          type="button"
          aria-pressed={v === value}
          className={segment}
          onClick={() => onChange(v)}
        >
          {text}
        </button>
      ))}
    </fieldset>
  );
}
