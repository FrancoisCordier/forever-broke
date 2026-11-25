import { Link } from "react-router";
import type { BuyListItem } from "../../../src/shared/signals.ts";
import { raidLabel } from "../lib/buylist.ts";
import { formatGold, formatPct, qualityColor } from "../lib/format.ts";
import { sortRows, useSort } from "../lib/sort.ts";
import { CopyButton } from "./CopyButton.tsx";
import { SortHeader } from "./SortHeader.tsx";
import { Sparkline } from "./Sparkline.tsx";

type Col = "name" | "now" | "normal" | "change" | "qty";

const VALUE: Record<Col, (x: BuyListItem) => number | string | null> = {
  name: (x) => x.name,
  now: (x) => x.now,
  normal: (x) => x.normal,
  change: (x) => x.change,
  qty: (x) => x.qty,
};

/** Columns that make most sense biggest-first on the first click. */
const DEFAULT_DIRS = { now: "desc", normal: "desc", qty: "desc" } as const;

interface Props {
  items: BuyListItem[];
  highlightCheap?: boolean;
}

/** Sortable table of items: watch list, cheap-but-not-raid, raid prep groups. */
export function ItemTable({ items, highlightCheap }: Props) {
  const { sort, toggle } = useSort<Col>({ key: "name", dir: "asc" }, DEFAULT_DIRS);
  const rows = sortRows(items, VALUE[sort.key], sort.dir);

  if (items.length === 0) return <p className="empty">No items match.</p>;

  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <SortHeader label="Item" col="name" sort={sort} onSort={toggle} />
            <SortHeader label="Now" col="now" sort={sort} onSort={toggle} />
            <SortHeader label="Normal (7d)" col="normal" sort={sort} onSort={toggle} />
            <SortHeader label="vs normal" col="change" sort={sort} onSort={toggle} />
            <SortHeader label="Units" col="qty" sort={sort} onSort={toggle} />
            <th scope="col">7 days</th>
            <th scope="col">Used for</th>
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
              <td className="gold">{x.now === null ? "not listed" : formatGold(x.now)}</td>
              <td className="soft">{x.normal === null ? "—" : formatGold(x.normal)}</td>
              <td className={highlightCheap && x.cheap ? "cheap" : "soft"}>{formatPct(x.change)}</td>
              <td className="soft">{x.qty.toLocaleString("en-GB")}</td>
              <td>
                <Sparkline
                  points={x.spark}
                  reference={x.normal}
                  width={96}
                  height={28}
                  label={`${x.name} price over 7 days`}
                />
              </td>
              <td className="note">{raidLabel(x)?.replace(/^Raid · /, "") ?? ""}</td>
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
