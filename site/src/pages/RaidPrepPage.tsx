import { useState } from "react";
import { Link } from "react-router";
import type { BuyListItem } from "../../../src/shared/signals.ts";
import { ItemFilters } from "../components/ItemFilters.tsx";
import { ItemTable } from "../components/ItemTable.tsx";
import { SortHeader } from "../components/SortHeader.tsx";
import { Status } from "../components/Status.tsx";
import { applyFilter, GROUPS, isVendor, NO_FILTER } from "../lib/buylist.ts";
import { useBuyList } from "../lib/data.ts";
import { formatGold, formatPct, qualityColor } from "../lib/format.ts";
import { sortRows, useSort } from "../lib/sort.ts";

/** Selling on the AH costs a 5% cut. */
const AH_CUT = 0.05;

interface Craft {
  x: BuyListItem;
  name: string;
  group: string;
  /** Reagent cost per crafted unit at current prices, or null if a reagent has no price. */
  cost: number | null;
  /** AH price after the cut, minus cost. */
  margin: number | null;
  missing: string[];
}

/**
 * Cost of crafting each watchlist consumable from reagents bought at today's "Now" price
 * (or the vendor price, when an NPC sells the reagent for less).
 */
function crafts(items: BuyListItem[], prices: Record<string, number>): Craft[] {
  const vendor = new Map(items.filter(isVendor).map((x) => [x.id, x.vendorPrice as number]));
  const watched = new Map(items.map((x) => [x.id, x.now]));
  const priceOf = (id: number): number | null => {
    // reagentPrices covers every reagent; watchlist prices are the fallback.
    const ah = prices[id] ?? watched.get(id) ?? null;
    const npc = vendor.get(id) ?? null;
    if (ah === null) return npc;
    return npc === null ? ah : Math.min(ah, npc);
  };
  return items
    .filter((x) => x.raidProduct && x.recipe)
    .map((x) => {
      let total = 0;
      const missing: string[] = [];
      for (const r of x.recipe?.reagents ?? []) {
        const price = priceOf(r.id);
        if (price === null) missing.push(r.name);
        else total += price * r.qty;
      }
      const cost = missing.length ? null : Math.round(total / (x.recipe?.makes || 1));
      const margin = cost !== null && x.now !== null ? Math.round(x.now * (1 - AH_CUT)) - cost : null;
      return { x, name: x.name, group: x.group, cost, margin, missing };
    });
}

type CraftCol = "name" | "cost" | "now" | "margin";
const CRAFT_VALUE: Record<CraftCol, (c: Craft) => number | string | null> = {
  name: (c) => c.name,
  cost: (c) => c.cost,
  now: (c) => c.x.now,
  margin: (c) => c.margin,
};

function CraftTable({ rows }: { rows: Craft[] }) {
  const { sort, toggle } = useSort<CraftCol>({ key: "margin", dir: "desc" }, { margin: "desc", now: "desc" });
  if (rows.length === 0) return <p className="empty">No consumables match.</p>;
  const sorted = sortRows(rows, CRAFT_VALUE[sort.key], sort.dir);
  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <SortHeader label="Consumable" col="name" sort={sort} onSort={toggle} />
            <SortHeader label="Reagents cost" col="cost" sort={sort} onSort={toggle} />
            <SortHeader label="AH price" col="now" sort={sort} onSort={toggle} />
            <SortHeader label="Margin after 5% cut" col="margin" sort={sort} onSort={toggle} />
            <th scope="col">Recipe</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ x, cost, margin, missing }) => (
            <tr key={x.id}>
              <td>
                <Link to={`/item/${x.id}`} className="item-link" style={{ color: qualityColor(x.quality) }}>
                  {x.name}
                </Link>
              </td>
              {cost !== null ? (
                <td className="gold">{formatGold(cost)}</td>
              ) : (
                <td className="note">not listed: {missing.join(", ")}</td>
              )}
              <td className={x.now === null ? "muted" : "gold"}>{x.now === null ? "not listed" : formatGold(x.now)}</td>
              <td className={margin === null ? "muted" : margin > 0 ? "cheap" : "soft"}>
                {margin === null ? "—" : `${margin > 0 ? "+" : "−"}${formatGold(Math.abs(margin))}`}
              </td>
              <td className="note recipe">
                {x.recipe?.reagents.map((r) => `${r.qty} ${r.name}`).join(", ")}
                {x.recipe && x.recipe.makes !== 1 ? ` → ${x.recipe.makes}` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RaidPrepPage() {
  const list = useBuyList();
  const [filter, setFilter] = useState(NO_FILTER);
  if (list.state !== "ok") return <Status value={list} />;

  const all = list.data.items;
  const listed = all.filter((x) => !isVendor(x));
  const shown = applyFilter(listed, filter);
  const craftRows = applyFilter(crafts(all, list.data.reagentPrices ?? {}), filter);

  return (
    <div className="stack-xl">
      <section className="stack-xs">
        <h1>Raid prep</h1>
        <p className="muted lead">
          Every watchlist item, grouped. Prices are for house {list.data.house}. Items sold by vendors are left out.
        </p>
      </section>

      <ItemFilters
        value={filter}
        onChange={setFilter}
        groups={[...new Set(listed.map((x) => x.group))]}
        summary={`${shown.length} of ${listed.length} items`}
      />

      <section aria-labelledby="crafts" className="stack-md">
        <div className="section-head">
          <h2 id="crafts">Craft or buy?</h2>
          <span className="muted">
            Reagent cost at today's prices (vendor price when cheaper) vs the AH price, after the 5% AH cut.
          </span>
        </div>
        <CraftTable rows={craftRows} />
      </section>

      {GROUPS.map(([key, title]) => {
        const group = shown.filter((x) => x.group === key);
        if (group.length === 0) return null;
        const cheap = group.filter((x) => x.cheap).length;
        return (
          <section key={key} aria-labelledby={`g-${key}`} className="stack-md">
            <div className="section-head">
              <h2 id={`g-${key}`}>{title}</h2>
              <span className="muted">
                {group.length} items
                {cheap ? ` · ${cheap} cheap now (${formatPct(-list.data.cheapPct / 100)} or more)` : ""}
              </span>
            </div>
            <ItemTable items={group} highlightCheap />
          </section>
        );
      })}
      {shown.length === 0 ? <p className="empty">No items match.</p> : null}
    </div>
  );
}
