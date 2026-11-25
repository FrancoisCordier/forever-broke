import { Link } from "react-router";
import type { BuyListItem } from "../../../src/shared/signals.ts";
import { atVendorPrice, raidLabel } from "../lib/buylist.ts";
import { formatGold, formatPct, qualityColor } from "../lib/format.ts";
import { CopyButton } from "./CopyButton.tsx";
import { Sparkline } from "./Sparkline.tsx";

function note(x: BuyListItem): string {
  if (x.vendorPrice !== null && atVendorPrice(x))
    return `Vendor sells it at ${formatGold(x.vendorPrice)}, so no point stockpiling`;
  return raidLabel(x)?.replace(/^Raid · /, "") ?? "";
}

/** Compact table of items: watch list, cheap-but-not-raid, raid prep groups. */
export function ItemTable({ items, highlightCheap }: { items: BuyListItem[]; highlightCheap?: boolean }) {
  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Now</th>
            <th scope="col">Normal (7d)</th>
            <th scope="col">vs normal</th>
            <th scope="col">Units</th>
            <th scope="col">7 days</th>
            <th scope="col">Note</th>
            <th scope="col">
              <span className="sr-only">Copy</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((x) => (
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
              <td className="note">{note(x)}</td>
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
