import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { valueLot } from "../../../src/shared/stockpile.ts";
import type { ItemMeta, Latest } from "../../../src/shared/types.ts";
import { CopyButton } from "../components/CopyButton.tsx";
import { type ItemLike, ItemName } from "../components/ItemName.tsx";
import { SortHeader } from "../components/SortHeader.tsx";
import { Sparkline } from "../components/Sparkline.tsx";
import { Status } from "../components/Status.tsx";
import { useCustomKits } from "../lib/customKits.ts";
import { HOUSE, useBuyList, useJson } from "../lib/data.ts";
import {
  ALL_DEALS,
  type Deal,
  type DealFilter,
  filterDeals,
  findDeals,
  MIN_PROFIT,
  MIN_SALES_HOURS,
  STOCK_DAYS,
  STOCK_MARGIN,
  starredFirst,
  type Verdict,
} from "../lib/deals.ts";
import { formatGold, formatWholeGold } from "../lib/format.ts";
import { pickKit, useKitPrefs, withClass } from "../lib/kit.ts";
import { sortRows, useSort } from "../lib/sort.ts";
import { useStars } from "../lib/stars.ts";
import { useLots, useMarkets } from "../lib/stockpile.ts";
import {
  btn,
  empty,
  field,
  gold,
  headControls,
  label,
  lead,
  notice,
  numberInput,
  pageFoot,
  pageHead,
  segment,
  subline,
  tableNarrow,
  tableWrap,
  tag,
  tags,
  textInput,
} from "../lib/ui.ts";

const BUDGET_KEY = "forever-broke.budget";
const FILTER_KEY = "forever-broke.dealFilter";

const VERDICTS: [Verdict, string][] = [
  ["buy", "Buy"],
  ["flip", "Flip"],
  ["sell", "Sell"],
];
const VERDICT_TAG: Record<Verdict, string> = { buy: tag.cheap, flip: tag.flip, sell: tag.sell };
const OFF = [0, 20, 30, 50, 70];
const PER_DAY = [0, 1, 5, 20];

/** A legend on the same line as its buttons (as on My kit): floated, since a legend ignores the fieldset's flex. */
const LEGEND = "float-left mr-1.5 text-xs font-medium text-muted";
const FIELDSET = "m-0 flex flex-wrap items-center gap-1.5 border-0 p-0";

type SortKey = "value" | "discount" | "perDay" | "days" | "name";

/** A value kept in this browser; storage may be blocked (private window), then it lasts until the tab closes. */
function useStored<T>(key: string, initial: T, parse: (raw: string) => T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : parse(raw);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    } catch {
      // storage blocked
    }
  }, [key, value]);
  return [value, setValue];
}

const parseFilter = (raw: string): DealFilter => ({ ...ALL_DEALS, ...JSON.parse(raw), query: "" });

const perDayText = (n: number | null) =>
  n === null ? "—" : n >= 10 ? Math.round(n).toLocaleString("en-GB") : n.toFixed(1);
const daysText = (d: number | null) =>
  d === null ? "—" : d < 1 ? "< 1 day" : d < 10 ? `${d.toFixed(1)} days` : `${Math.round(d)} days`;

function Segments<T extends string | number>({
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

function Filters({
  value,
  onChange,
  counts,
  hasKit,
}: {
  value: DealFilter;
  onChange: (f: DealFilter) => void;
  counts: Record<Verdict | "", number>;
  hasKit: boolean;
}) {
  const set = (patch: Partial<DealFilter>) => onChange({ ...value, ...patch });
  const toggle = "aria-pressed:border-gold aria-pressed:text-gold";
  const active =
    value.verdict !== "" ||
    value.minOff > 0 ||
    value.minPerDay > 0 ||
    value.starred ||
    value.kitOnly ||
    value.query !== "";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Segments
          legend="Show"
          value={value.verdict}
          onChange={(verdict) => set({ verdict })}
          options={[
            ["", `All ${counts[""]}`],
            ...VERDICTS.map(([v, t]): [Verdict, string] => [v, `${t} ${counts[v]}`]),
          ]}
        />
        <Segments
          legend="Off"
          value={value.minOff}
          onChange={(minOff) => set({ minOff })}
          options={OFF.map((n): [number, string] => [n, n ? `${n}%+` : "Any"])}
        />
        <Segments
          legend="Sells / day"
          value={value.minPerDay}
          onChange={(minPerDay) => set({ minPerDay })}
          options={PER_DAY.map((n): [number, string] => [n, n ? `${n}+` : "Any"])}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          aria-label="Search deals by item name"
          className={textInput}
          placeholder="Item name"
          value={value.query}
          onChange={(e) => set({ query: e.target.value })}
        />
        <button
          type="button"
          aria-pressed={value.starred}
          className={`${btn("ghost")} ${toggle}`}
          onClick={() => set({ starred: !value.starred })}
        >
          {value.starred ? "★" : "☆"} Starred only
        </button>
        {hasKit ? (
          <button
            type="button"
            aria-pressed={value.kitOnly}
            className={`${btn("ghost")} ${toggle}`}
            onClick={() => set({ kitOnly: !value.kitOnly })}
          >
            My kit only
          </button>
        ) : null}
        {active ? (
          <button type="button" className={btn("ghost")} onClick={() => onChange(ALL_DEALS)}>
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DealRow({ d, item }: { d: Deal; item: ItemLike }) {
  const thin = d.salesHours < MIN_SALES_HOURS;
  return (
    <tr>
      <td>
        <ItemName item={item} />
        <span className={subline}>
          {d.slot ? `Your kit · ${d.slot}` : d.lot ? `Your lot · bought ${d.lot.added}` : d.inKit ? "In your kit" : ""}
        </span>
      </td>
      <td>
        <div className={tags}>
          <span className={VERDICT_TAG[d.verdict]}>{d.verdict.toUpperCase()}</span>
          {d.reasons.map((r) => (
            <span key={r} className={tag.plain}>
              {r}
            </span>
          ))}
        </div>
      </td>
      <td className="text-right">
        <strong className={d.value > 0 ? "text-sell" : "text-soft"}>
          {d.value > 0 ? "+" : ""}
          {formatWholeGold(d.value)}
        </strong>
        <span className={subline}>{d.valueKind === "saves" ? "saved now" : "after the cut"}</span>
      </td>
      <td>
        {d.verdict === "sell" ? (
          <>
            Sell <strong className="text-fg">{d.units}</strong> at{" "}
            <span className={gold}>{d.sellAt === null ? "—" : formatGold(d.sellAt)}</span>
          </>
        ) : (
          <>
            Buy <strong className="text-fg">{d.units}</strong> up to{" "}
            <span className={gold}>{d.buyUpTo === null ? "—" : formatGold(d.buyUpTo)}</span>
          </>
        )}
        <span className={subline}>
          {d.verdict === "sell" ? `market now · paid ${formatWholeGold(d.cost)}` : `≈ ${formatWholeGold(d.cost)}`}
          {d.verdict !== "sell" && d.sellAt !== null ? ` · resell at ${formatGold(d.sellAt)}` : ""}
          {d.verdict === "buy" && d.sellAt === null ? " · for your raids" : ""}
          {d.capped ? " · budget limit" : ""}
        </span>
      </td>
      <td className="text-soft">
        {perDayText(d.perDay)}
        <span className={subline}>{d.listed.toLocaleString("en-GB")} listed</span>
      </td>
      <td className="text-soft">{d.verdict === "buy" && d.slot ? "—" : daysText(d.daysToSell)}</td>
      <td>
        {d.x ? (
          <Sparkline points={d.x.spark} reference={d.x.normal} width={90} height={28} label={`${item.name}, 7 days`} />
        ) : null}
        <span className={`${subline} ${thin ? "text-raid!" : ""}`}>{d.salesHours} h of sales</span>
      </td>
      <td>
        <CopyButton
          text={item.name}
          label=""
          ariaLabel={`Copy item name ${item.name}`}
          done={`Copied “${item.name}”. Paste it in the AH search box`}
          variant="secondary"
          small
        />
      </td>
    </tr>
  );
}

export function DealsPage() {
  const list = useBuyList();
  const [budgetGold, setBudgetGold] = useStored(BUDGET_KEY, 800, (raw) => Number(raw) || 0);
  const [filter, setFilter] = useStored(FILTER_KEY, ALL_DEALS, parseFilter);
  const { sort, toggle } = useSort<SortKey>(
    { key: "value", dir: "desc" },
    { value: "desc", discount: "asc", perDay: "desc", days: "asc", name: "asc" },
  );
  const [kitPrefs] = useKitPrefs();
  const [customKits] = useCustomKits();
  const stars = useStars();
  const [lots] = useLots();

  const items = list.state === "ok" ? list.data.items : [];
  const watched = useMemo(() => new Set(items.map((x) => x.id)), [items]);
  const ids = useMemo(() => lots.map((l) => l.item), [lots]);
  // Lots of items off the watchlist need latest.json for a price and items.json for a name.
  const others = list.state === "ok" && lots.some((l) => !watched.has(l.item));
  const latest = useJson<Latest>(others ? `${HOUSE}/latest.json` : null);
  const meta = useJson<Record<string, ItemMeta>>(others ? "items.json" : null);
  const markets = useMarkets(ids, items, latest.state === "ok" ? latest.data : null);

  if (list.state !== "ok") return <Status value={list} />;
  const data = list.data;
  const opt = data.sell ?? { sellAboveCostPct: 30, sellAboveNormalPct: 15 };
  const kit = pickKit(withClass([...(data.kits ?? []), ...customKits]), kitPrefs);
  const deals = findDeals({
    items,
    budget: budgetGold * 10000,
    belowCraftPct: data.belowCraftPct ?? 10,
    kit,
    prefs: kitPrefs,
    soulbound: new Set(data.soulbound ?? []),
    lots: lots.map((lot) => ({ lot, m: markets.get(lot.item), v: valueLot(lot, markets.get(lot.item), opt) })),
  });

  const names = meta.state === "ok" ? meta.data : {};
  const itemOf = (d: Deal): ItemLike =>
    d.x ?? {
      id: d.id,
      name: names[d.id]?.name ?? `Item ${d.id}`,
      quality: names[d.id]?.quality ?? null,
      icon: names[d.id]?.icon,
    };
  const nameOf = (d: Deal) => itemOf(d).name;

  const counts: Record<Verdict | "", number> = { "": 0, buy: 0, flip: 0, sell: 0 };
  for (const d of filterDeals(deals, { ...filter, verdict: "" }, stars, nameOf)) {
    counts[""]++;
    counts[d.verdict]++;
  }
  const shown = filterDeals(deals, filter, stars, nameOf);
  const sorted =
    sort.key === "value"
      ? starredFirst(
          sortRows(shown, (d) => d.value, sort.dir),
          stars,
        )
      : sort.key === "discount"
        ? sortRows(shown, (d) => d.discount, sort.dir)
        : sort.key === "perDay"
          ? sortRows(shown, (d) => d.perDay, sort.dir)
          : sort.key === "days"
            ? sortRows(shown, (d) => d.daysToSell, sort.dir)
            : sortRows(shown, nameOf, sort.dir);

  const history = Math.max(0, ...items.map((x) => x.normalDays));
  const salesHours = Math.max(0, ...items.map((x) => x.sales?.hours ?? 0));
  const best = deals[0];
  const header = (text: string, col: SortKey) => <SortHeader label={text} col={col} sort={sort} onSort={toggle} />;

  return (
    <div className="flex flex-col gap-8">
      <section className={pageHead}>
        <div className="flex flex-[1_1_420px] flex-col gap-1.5">
          <h1>Deals</h1>
          <p className={lead}>
            {deals.length === 0 ? (
              "Nothing stands out right now: nothing is cheap, nothing is listed under what buyers pay, and no lot is ready to sell."
            ) : (
              <>
                <strong className="text-fg">{counts.buy}</strong> to buy,{" "}
                <strong className="text-fg">{counts.flip}</strong> to flip and{" "}
                <strong className="text-fg">{counts.sell}</strong> to sell
                {best ? (
                  <>
                    . Best: <strong className="text-fg">{nameOf(best)}</strong>,{" "}
                    <strong className="text-sell">+{formatWholeGold(best.value)}</strong>
                    {best.valueKind === "saves" ? " saved" : " profit"}
                  </>
                ) : null}
                .
              </>
            )}
          </p>
        </div>
        <div className={headControls}>
          <div className={field}>
            <label htmlFor="budget" className={label}>
              Budget per deal (gold)
            </label>
            <input
              id="budget"
              className={numberInput}
              type="number"
              min="0"
              step="50"
              value={budgetGold}
              onChange={(e) => setBudgetGold(Math.max(0, Number(e.target.value) || 0))}
            />
          </div>
          {sorted.length > 0 ? (
            <CopyButton
              text={[...new Set(sorted.map(nameOf))].join("\n")}
              label="Copy names"
              done={`Copied ${new Set(sorted.map(nameOf)).size} item names, one per line`}
              variant="secondary"
            />
          ) : null}
        </div>
      </section>

      {history < 7 || salesHours < MIN_SALES_HOURS ? (
        <p className={notice}>
          {history < 7
            ? `“Normal” prices are based on ${history < 1 ? "less than a day" : `${history} days`} of history so far (7 when complete). `
            : ""}
          {salesHours < MIN_SALES_HOURS
            ? `Flips need ${MIN_SALES_HOURS} hours of sales data: ${salesHours} h so far.`
            : ""}
        </p>
      ) : null}

      <Filters value={filter} onChange={setFilter} counts={counts} hasKit={kit !== undefined} />

      {sorted.length > 0 ? (
        <div className={tableWrap}>
          <table className={`${tableNarrow} min-w-[960px]`}>
            <thead>
              <tr>
                {header("Item", "name")}
                {header("Verdict · why", "discount")}
                {header("Profit", "value")}
                <th scope="col">Do</th>
                {header("Sold / day", "perDay")}
                {header("Days to sell", "days")}
                <th scope="col">7 days</th>
                <th scope="col">
                  <span className="sr-only">Copy</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d) => (
                <DealRow key={d.key} d={d} item={itemOf(d)} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={empty}>
          {deals.length === 0
            ? "No deal right now. Check back after the next snapshot (about every hour)."
            : "No deal matches these filters."}
        </p>
      )}

      <footer className={pageFoot}>
        <span>
          <strong>Buy</strong>: cheap vs its normal price, under what its reagents cost, or 10% under what buyers paid.
          For your kit (<Link to="/kit">My kit</Link>) it buys what your nights need and shows what that saves;
          otherwise it buys to stock and resell at the normal price: only units that beat it by {STOCK_MARGIN * 100}%
          after the 5% cut, at most {STOCK_DAYS} days of sales, at least {formatWholeGold(MIN_PROFIT)} profit.
        </span>
        <span>
          <strong>Flip</strong>: listed under what buyers paid over the last 3 days, relist at that price, at most 2
          days of sales. <strong>Sell</strong>: a <Link to="/stockpile">stockpile</Link> lot {opt.sellAboveCostPct}%
          over what you paid after the cut, with the market {opt.sellAboveNormalPct}% over normal.
        </span>
        <span>
          <strong>Budget</strong> caps each deal, not the total; 0 = no limit. <strong>Normal</strong> = median of the
          cheapest-10% price over 7 days. Nothing here predicts prices.
        </span>
      </footer>
    </div>
  );
}
