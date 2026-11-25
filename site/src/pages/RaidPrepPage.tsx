import { Link } from "react-router";
import type { BuyListItem } from "../../../src/shared/signals.ts";
import { ItemTable } from "../components/ItemTable.tsx";
import { Status } from "../components/Status.tsx";
import { GROUPS } from "../lib/buylist.ts";
import { useBuyList } from "../lib/data.ts";
import { formatGold, formatPct, qualityColor } from "../lib/format.ts";

interface Craft {
  x: BuyListItem;
  /** Reagent cost per crafted unit at current prices, or null if a reagent has no price. */
  cost: number | null;
  missing: string[];
}

/**
 * Cost of crafting each watchlist consumable from reagents bought at today's "Now" price
 * (or the vendor price, when an NPC sells the reagent for less).
 */
function crafts(items: BuyListItem[], prices: Record<string, number>): Craft[] {
  const vendor = new Map(items.filter((x) => x.vendorPrice !== null).map((x) => [x.id, x.vendorPrice as number]));
  const priceOf = (id: number): number | null => {
    const ah = prices[id] ?? null;
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
      const makes = x.recipe?.makes || 1;
      return { x, cost: missing.length ? null : Math.round(total / makes), missing };
    })
    .sort((a, b) => a.x.name.localeCompare(b.x.name));
}

export function RaidPrepPage() {
  const list = useBuyList();
  if (list.state !== "ok") return <Status value={list} />;
  const items = list.data.items;

  return (
    <div className="stack-xl">
      <section className="stack-xs">
        <h1>Raid prep</h1>
        <p className="muted lead">Every watchlist item, grouped. Prices are for house {list.data.house}.</p>
      </section>

      <section aria-labelledby="crafts" className="stack-md">
        <div className="section-head">
          <h2 id="crafts">Craft or buy?</h2>
          <span className="muted">
            Reagent cost at today's prices vs the AH price. Selling on the AH costs a 5% cut.
          </span>
        </div>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Consumable</th>
                <th scope="col">Reagents cost</th>
                <th scope="col">AH price</th>
                <th scope="col">Margin after 5% cut</th>
                <th scope="col">Recipe</th>
              </tr>
            </thead>
            <tbody>
              {crafts(items, list.data.reagentPrices ?? {}).map(({ x, cost, missing }) => {
                const margin = cost !== null && x.now !== null ? Math.round(x.now * 0.95) - cost : null;
                return (
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
                    <td className={x.now === null ? "muted" : "gold"}>
                      {x.now === null ? "not listed" : formatGold(x.now)}
                    </td>
                    <td className={margin === null ? "muted" : margin > 0 ? "cheap" : "soft"}>
                      {margin === null ? "—" : `${margin > 0 ? "+" : "−"}${formatGold(Math.abs(margin))}`}
                    </td>
                    <td className="note recipe">
                      {x.recipe?.reagents.map((r) => `${r.qty} ${r.name}`).join(", ")}
                      {x.recipe && x.recipe.makes !== 1 ? ` → ${x.recipe.makes}` : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {GROUPS.map(([key, title]) => {
        const group = items.filter((x) => x.group === key).sort((a, b) => a.name.localeCompare(b.name));
        if (group.length === 0) return null;
        const cheap = group.filter((x) => x.cheap).length;
        return (
          <section key={key} aria-labelledby={`g-${key}`} className="stack-md">
            <div className="section-head">
              <h2 id={`g-${key}`}>{title}</h2>
              <span className="muted">
                {group.length} items{cheap ? ` · ${cheap} cheap now` : ""}
                {cheap ? ` (${formatPct(-list.data.cheapPct / 100)} or more)` : ""}
              </span>
            </div>
            <ItemTable items={group} highlightCheap />
          </section>
        );
      })}
    </div>
  );
}
