import type { CraftRow } from "../../../src/shared/crafts.ts";
import { ItemName } from "../components/ItemName.tsx";
import { Segments } from "../components/Segments.tsx";
import { SortHeader } from "../components/SortHeader.tsx";
import { Status } from "../components/Status.tsx";
import { ALL_CRAFTS, type CraftFilter, filterCrafts, professions } from "../lib/crafts.ts";
import { useCrafts } from "../lib/data.ts";
import { MIN_SALES_HOURS } from "../lib/deals.ts";
import { formatGold, formatPct, formatWholeGold, perDayText } from "../lib/format.ts";
import { sortRows, useSort } from "../lib/sort.ts";
import { useStars } from "../lib/stars.ts";
import { useStored } from "../lib/stored.ts";
import {
  btn,
  empty,
  gold,
  lead,
  loss,
  note,
  notice,
  pageFoot,
  pageHead,
  select,
  subline,
  tableNarrow,
  tableWrap,
  tag,
  textInput,
} from "../lib/ui.ts";

const FILTER_KEY = "forever-broke.craftFilter";
const PER_DAY = [0, 1, 5, 20];
/** Rows drawn at once: the full list is ~500 recipes. */
const PAGE = 100;

type SortKey = "profit" | "margin" | "pct" | "cost" | "perDay" | "name";

const parseFilter = (raw: string): CraftFilter => ({ ...ALL_CRAFTS, ...JSON.parse(raw), query: "" });

function Filters({ value, onChange, all }: { value: CraftFilter; onChange: (f: CraftFilter) => void; all: string[] }) {
  const set = (patch: Partial<CraftFilter>) => onChange({ ...value, ...patch });
  const toggle = "aria-pressed:border-gold aria-pressed:text-gold";
  const changed =
    value.query !== "" ||
    value.profession !== ALL_CRAFTS.profession ||
    value.minPerDay !== ALL_CRAFTS.minPerDay ||
    value.profitOnly !== ALL_CRAFTS.profitOnly ||
    value.starred;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        aria-label="Profession"
        className={select}
        value={value.profession}
        onChange={(e) => set({ profession: e.target.value })}
      >
        <option value="">All professions</option>
        {all.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <Segments
        legend="Sells / day"
        value={value.minPerDay}
        onChange={(minPerDay) => set({ minPerDay })}
        options={PER_DAY.map((n): [number, string] => [n, n ? `${n}+` : "Any"])}
      />
      <input
        type="search"
        aria-label="Search crafts by item or recipe name"
        className={textInput}
        placeholder="Item or recipe"
        value={value.query}
        onChange={(e) => set({ query: e.target.value })}
      />
      <button
        type="button"
        aria-pressed={value.profitOnly}
        className={`${btn("ghost")} ${toggle}`}
        onClick={() => set({ profitOnly: !value.profitOnly })}
      >
        Profitable only
      </button>
      <button
        type="button"
        aria-pressed={value.starred}
        className={`${btn("ghost")} ${toggle}`}
        onClick={() => set({ starred: !value.starred })}
      >
        {value.starred ? "★" : "☆"} Starred only
      </button>
      {changed ? (
        <button type="button" className={btn("ghost")} onClick={() => onChange(ALL_CRAFTS)}>
          Reset
        </button>
      ) : null}
    </div>
  );
}

function CraftLine({ r }: { r: CraftRow }) {
  const thin = r.salesHours !== null && r.salesHours < MIN_SALES_HOURS;
  return (
    <tr>
      <td>
        <ItemName item={r.item} />
        <span className={subline}>
          {r.name}
          {r.makes > 1 ? ` · makes ${r.makes}` : ""}
        </span>
      </td>
      <td className={note}>
        {r.reagents.map((g, i) => (
          <span key={g.id}>
            {i > 0 ? ", " : ""}
            {g.qty}× {g.name} <span className="text-soft">{formatGold(g.price)}</span>
          </span>
        ))}
      </td>
      <td className="text-muted">{r.profession}</td>
      <td className={gold}>{formatGold(r.cost)}</td>
      <td className={gold}>{formatGold(r.sellAt)}</td>
      <td>
        <span className={r.margin > 0 ? "font-bold text-sell" : loss}>
          {r.margin > 0 ? "+" : ""}
          {formatGold(r.margin)}
        </span>
        <span className={subline}>{formatPct(r.marginPct)}</span>
      </td>
      <td>
        <span
          className={thin ? "text-gold" : undefined}
          title={thin ? `Only ${r.salesHours} h of sales so far: not ranked until ${MIN_SALES_HOURS} h` : undefined}
        >
          {perDayText(r.perDay)}
        </span>
        <span className={subline}>{r.listed.toLocaleString("en-GB")} listed</span>
      </td>
      <td>
        {r.cooldown ? (
          <span className={tag.plain} title="Limited by a cooldown: the sales rate says nothing about your share">
            Cooldown
          </span>
        ) : r.profitPerDay !== null ? (
          <span className="font-bold text-sell">{formatWholeGold(r.profitPerDay)}</span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
    </tr>
  );
}

export function CraftsPage() {
  const crafts = useCrafts();
  const [filter, setFilter] = useStored(FILTER_KEY, ALL_CRAFTS, parseFilter);
  const [showAll, setShowAll] = useStored(`${FILTER_KEY}.all`, false, (raw) => raw === "true");
  const { sort, toggle } = useSort<SortKey>(
    { key: "profit", dir: "desc" },
    { profit: "desc", margin: "desc", pct: "desc", cost: "asc", perDay: "desc", name: "asc" },
  );
  const stars = useStars();

  if (crafts.state !== "ok") return <Status value={crafts} />;
  const data = crafts.data;
  const shown = filterCrafts(data.rows, filter, stars);
  // Rows come ranked by profit per day then margin (craftRows); the filter keeps that order.
  const sorted =
    sort.key === "profit"
      ? sort.dir === "desc"
        ? shown
        : sortRows(shown, (r) => r.profitPerDay, sort.dir)
      : sort.key === "margin"
        ? sortRows(shown, (r) => r.margin, sort.dir)
        : sort.key === "pct"
          ? sortRows(shown, (r) => r.marginPct, sort.dir)
          : sort.key === "cost"
            ? sortRows(shown, (r) => r.cost, sort.dir)
            : sort.key === "perDay"
              ? sortRows(shown, (r) => r.perDay, sort.dir)
              : sortRows(shown, (r) => r.item.name, sort.dir);
  const rows = showAll ? sorted : sorted.slice(0, PAGE);
  const salesHours = Math.max(0, ...data.rows.map((r) => r.salesHours ?? 0));
  const ranked = data.rows.filter((r) => r.profitPerDay !== null);
  const best = ranked[0];
  const header = (text: string, col: SortKey) => <SortHeader label={text} col={col} sort={sort} onSort={toggle} />;

  return (
    <div className="flex flex-col gap-8">
      <section className={pageHead}>
        <div className="flex flex-[1_1_420px] flex-col gap-1.5">
          <h1>Crafts</h1>
          <p className={lead}>
            {data.rows.length.toLocaleString("en-GB")} recipes priced from the auction house,{" "}
            <strong className="text-fg">{data.rows.filter((r) => r.margin > 0).length}</strong> with a profit at today's
            prices
            {best ? (
              <>
                . Best seller: <strong className="text-fg">{best.item.name}</strong>,{" "}
                <strong className="text-sell">+{formatGold(best.margin)}</strong> each, up to{" "}
                <strong className="text-sell">{formatWholeGold(best.profitPerDay ?? 0)}</strong> a day across the AH
              </>
            ) : null}
            .
          </p>
        </div>
      </section>

      {salesHours < MIN_SALES_HOURS ? (
        <p className={notice}>
          Profit per day needs {MIN_SALES_HOURS} hours of sales data: {salesHours} h so far. Until then crafts are
          ranked by margin.
        </p>
      ) : null}

      <Filters value={filter} onChange={setFilter} all={professions(data.rows)} />

      {rows.length > 0 ? (
        <div className={tableWrap}>
          <table className={`${tableNarrow} min-w-[1040px]`}>
            <thead>
              <tr>
                {header("Makes", "name")}
                <th scope="col">Reagents</th>
                <th scope="col">Profession</th>
                {header("Cost", "cost")}
                <th scope="col">Sells at</th>
                {header("Margin", "margin")}
                {header("Sold / day", "perDay")}
                {header("Profit / day", "profit")}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <CraftLine key={r.recipe} r={r} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={empty}>No recipe matches these filters.</p>
      )}
      {sorted.length > PAGE ? (
        <button type="button" className={`${btn("secondary")} self-start`} onClick={() => setShowAll(!showAll)}>
          {showAll ? `Show the first ${PAGE}` : `Show all ${sorted.length}`}
        </button>
      ) : null}

      <footer className={pageFoot}>
        <span>
          <strong>Cost</strong>: reagents at the cheapest-10% price on the AH, or the vendor price when lower, per unit
          made. <strong>Sells at</strong>: the product's cheapest-10% price, or what buyers paid if lower (with{" "}
          {MIN_SALES_HOURS} h of sales). <strong>Margin</strong> is after the 5% AH cut.
        </span>
        <span>
          <strong>Profit / day</strong> = margin × units the whole AH sells a day: the ceiling of what crafting it could
          make, shared with every other crafter. Not shown for cooldown crafts (transmutes, Mooncloth).
        </span>
        <span>
          Left out: enchants, {data.unlisted.toLocaleString("en-GB")} recipes whose product isn't listed as a commodity
          (gear is sold one item at a time) and {data.unpriced} with a reagent nobody sells. Skill levels aren't in the
          data: check you can learn the recipe.
        </span>
      </footer>
    </div>
  );
}
