import type { BuyListItem } from "../../../src/shared/signals.ts";
import { raidLabel } from "../lib/buylist.ts";
import { formatGold, formatWholeGold } from "../lib/format.ts";
import { CopyButton } from "./CopyButton.tsx";
import { ItemName } from "./ItemName.tsx";

const perDay = (n: number) => (n >= 10 ? Math.round(n).toLocaleString("en-GB") : n.toFixed(1));

/** ADR-0012: listed under what buyers have been paying, by enough to profit after the cut, and it sells. */
export function ResellList({ items }: { items: BuyListItem[] }) {
  return (
    <div className="card-grid">
      {items.map((x) => {
        const r = x.resale;
        if (!r || !x.sales) return null;
        const raid = raidLabel(x);
        return (
          <article key={x.id} className="card buy-card">
            <div className="buy-card-head">
              <div className="buy-card-title">
                <ItemName item={x} className="item-name" />
                <div className="tags">
                  <span className="tag tag-sell">≈ +{formatWholeGold(r.profit)} after the cut</span>
                  {raid ? <span className="tag tag-raid">{raid}</span> : null}
                </div>
              </div>
              <CopyButton
                text={x.name}
                ariaLabel={`Copy item name ${x.name}`}
                done={`Copied “${x.name}”. Paste it in the AH search box`}
              />
            </div>
            <dl className="stats3">
              <div>
                <dt>Buy</dt>
                <dd className="gold">
                  {r.units} up to {formatGold(r.buyUpTo)}
                </dd>
              </div>
              <div>
                <dt>Relist at</dt>
                <dd className="text">{formatGold(r.price)}</dd>
              </div>
              <div>
                <dt>Sells</dt>
                <dd className="soft">~{perDay(x.sales.perDay)} / day</dd>
              </div>
            </dl>
            <p className="muted small">
              Costs ≈ {formatWholeGold(r.cost)}. Buyers paid {formatGold(r.price)} on average over the last{" "}
              {x.sales.hours} h of sales data. The quantity is capped at what sells in a couple of days.
            </p>
          </article>
        );
      })}
    </div>
  );
}
