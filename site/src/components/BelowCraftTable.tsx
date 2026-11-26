import { Link } from "react-router";
import type { BuyListItem } from "../../../src/shared/signals.ts";
import { formatGold, formatPct, qualityColor } from "../lib/format.ts";
import { sortRows, useSort } from "../lib/sort.ts";
import { CopyButton } from "./CopyButton.tsx";
import { SortHeader } from "./SortHeader.tsx";

type Col = "name" | "now" | "cost" | "craftChange" | "qty";

const VALUE: Record<Col, (x: BuyListItem) => number | string | null> = {
  name: (x) => x.name,
  now: (x) => x.now,
  cost: (x) => x.craftCost,
  craftChange: (x) => x.craftChange,
  qty: (x) => x.qty,
};

/** Consumables selling under the cost of their reagents (ADR-0010). */
export function BelowCraftTable({ items }: { items: BuyListItem[] }) {
  const { sort, toggle } = useSort<Col>({ key: "craftChange", dir: "asc" }, { now: "desc", cost: "desc", qty: "desc" });
  const rows = sortRows(items, VALUE[sort.key], sort.dir);

  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <SortHeader label="Item" col="name" sort={sort} onSort={toggle} />
            <SortHeader label="Now" col="now" sort={sort} onSort={toggle} />
            <SortHeader label="Reagents cost" col="cost" sort={sort} onSort={toggle} />
            <SortHeader label="vs reagents" col="craftChange" sort={sort} onSort={toggle} />
            <SortHeader label="Units" col="qty" sort={sort} onSort={toggle} />
            <th scope="col">Recipe</th>
            <th scope="col">
              <span className="sr-only">Copy</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x.id}>
              <td>
                <Link to={`/item/${x.id}`} className="item-link" style={{ color: qualityColor(x.quality) }}>
                  {x.name}
                </Link>
              </td>
              <td className="gold">{x.now === null ? "—" : formatGold(x.now)}</td>
              <td className="soft">{x.craftCost === null ? "—" : formatGold(x.craftCost)}</td>
              <td className="cheap">{formatPct(x.craftChange)}</td>
              <td className="soft">{x.qty.toLocaleString("en-GB")}</td>
              <td className="note recipe">{x.recipe?.reagents.map((r) => `${r.qty} ${r.name}`).join(", ")}</td>
              <td>
                <CopyButton
                  text={x.name}
                  ariaLabel={`Copy item name ${x.name}`}
                  done={`Copied “${x.name}”. Paste it in the AH search box`}
                  variant="secondary"
                  small
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
