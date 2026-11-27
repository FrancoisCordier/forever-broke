import { Link } from "react-router";
import { type BuyListItem, costOfUnits, type Kit } from "../../../src/shared/signals.ts";
import { formatGold, formatWholeGold } from "../lib/format.ts";
import { type GoodBuy, goodBuy, type KitPrefs, kitRows } from "../lib/kit.ts";
import { CopyButton } from "./CopyButton.tsx";
import { ItemName } from "./ItemName.tsx";

interface Deal {
  key: string;
  slot: string;
  x: BuyListItem;
  why: GoodBuy;
  need: number;
  /** Units to buy now: what you need, as far as listings under the price allow. */
  buy: number;
  cost: number;
}

/** Kit items that are a good buy right now, with how many you need (My kit settings). */
export function raidDeals(kit: Kit, items: BuyListItem[], prefs: KitPrefs, belowCraftPct: number): Deal[] {
  const deals: Deal[] = [];
  for (const r of kitRows(kit, items, prefs)) {
    if (!r.item || r.need <= 0) continue;
    const why = goodBuy(r.item, belowCraftPct);
    if (!why) continue;
    const { units: buy, cost } = costOfUnits(
      r.item.ladder.filter(([p]) => p <= why.upTo),
      r.need,
    );
    if (buy > 0) deals.push({ key: r.key, slot: r.slot, x: r.item, why, need: r.need, buy, cost });
  }
  return deals;
}

export function ForYourRaids({ kit, deals, nights }: { kit: Kit; deals: Deal[]; nights: number }) {
  if (deals.length === 0)
    return (
      <p className="empty">
        Nothing in your kit ({kit.label}) is cheap right now: everything is at its usual price or above. Change items or
        quantities on <Link to="/kit">My kit</Link>.
      </p>
    );
  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Why now</th>
            <th scope="col">Now</th>
            <th scope="col">Buy up to</th>
            <th scope="col">Need ({nights} nights)</th>
            <th scope="col">Buy now</th>
            <th scope="col">
              <span className="sr-only">Copy</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {deals.map((d) => (
            <tr key={d.key}>
              <td>
                <ItemName item={d.x} />
                <span className="note lot-date">{d.slot}</span>
              </td>
              <td>
                <div className="tags">
                  {d.why.reasons.map((r) => (
                    <span key={r} className="tag tag-cheap">
                      {r}
                    </span>
                  ))}
                </div>
              </td>
              <td className="gold">{d.x.now === null ? "—" : formatGold(d.x.now)}</td>
              <td className="soft">{formatGold(d.why.upTo)}</td>
              <td className="soft">{d.need}</td>
              <td>
                <strong className="text">{d.buy}</strong>{" "}
                <span className="note">
                  ≈ {formatWholeGold(d.cost)}
                  {d.buy < d.need ? ` (only ${d.buy} listed under the price)` : ""}
                </span>
              </td>
              <td>
                <CopyButton
                  text={d.x.name}
                  ariaLabel={`Copy item name ${d.x.name}`}
                  done={`Copied “${d.x.name}”. Paste it in the AH search box`}
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
