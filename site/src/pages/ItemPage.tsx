import { useState } from "react";
import { Link, useParams } from "react-router";
import type { BuyListItem } from "../../../src/shared/signals.ts";
import { type DailySeries, type HourlySeries, iconUrl } from "../../../src/shared/types.ts";
import { CopyButton } from "../components/CopyButton.tsx";
import { type Point, PriceChart } from "../components/PriceChart.tsx";
import { Status } from "../components/Status.tsx";
import { atVendorPrice, raidLabel } from "../lib/buylist.ts";
import { type Loadable, useBuyList, useDaily, useHourly } from "../lib/data.ts";
import { formatGold, formatPct, formatWholeGold, qualityColor } from "../lib/format.ts";

type Range = "7d" | "30d" | "all";
const RANGES: [Range, string][] = [
  ["7d", "7 days"],
  ["30d", "30 days"],
  ["all", "All (daily)"],
];
const DAY = 86400;

function chartPoints(range: Range, hourly: Loadable<HourlySeries>, daily: Loadable<DailySeries>): Point[] | null {
  if (range === "all") {
    if (daily.state !== "ok") return null;
    const d = daily.data;
    return d.d.map((day, i) => ({ t: Date.parse(`${day}T12:00:00Z`) / 1000, price: d.p10[i], qty: d.qty[i] }));
  }
  if (hourly.state !== "ok") return null;
  const h = hourly.data;
  const from = (h.t.at(-1) ?? 0) - (range === "7d" ? 7 : 30) * DAY;
  const out: Point[] = [];
  for (let i = 0; i < h.t.length; i++) if (h.t[i] > from) out.push({ t: h.t[i], price: h.p10[i], qty: h.qty[i] });
  return out;
}

function Ladder({ x }: { x: BuyListItem }) {
  let cum = 0;
  let cost = 0;
  return (
    <div className="table-scroll">
      <table className="table ladder">
        <thead>
          <tr>
            <th scope="col">Unit price</th>
            <th scope="col">Units</th>
            <th scope="col">Running total</th>
            <th scope="col">Cost so far</th>
          </tr>
        </thead>
        <tbody>
          {x.ladder.map(([price, units]) => {
            cum += units;
            cost += price * units;
            const within = x.upTo !== null && price <= x.upTo;
            return (
              <tr key={price} className={within ? "within" : undefined}>
                <td className={within ? "gold" : "soft"}>{formatGold(price)}</td>
                <td>{units.toLocaleString("en-GB")}</td>
                <td>{cum.toLocaleString("en-GB")}</td>
                <td>{formatWholeGold(cost)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ItemDetail({ x, raidOpens }: { x: BuyListItem; raidOpens: string }) {
  const [range, setRange] = useState<Range>("7d");
  const hourly = useHourly(x.id);
  const daily = useDaily(x.id);
  const points = chartPoints(range, hourly, daily);
  const raidT = Date.parse(raidOpens) / 1000;
  const raid = raidLabel(x);

  return (
    <div className="stack-lg">
      <Link to="/" className="back">
        ← Buy list
      </Link>

      <section className="page-head">
        <div className="stack-xs grow">
          <h1 className="item-title" style={{ color: qualityColor(x.quality) }}>
            {x.icon ? <img src={iconUrl(x.icon, 56)} alt="" width={40} height={40} /> : null}
            {x.name}
          </h1>
          {x.tip?.length ? (
            <div className="item-tip-inline">
              {x.tip.map((line) => (
                <p key={line} className={line.startsWith("Use:") ? "item-tip-use" : undefined}>
                  {line}
                </p>
              ))}
            </div>
          ) : null}
          <div className="tags">
            {x.cheap ? <span className="tag tag-cheap">Cheap · {formatPct(x.change)} vs normal</span> : null}
            {raid ? <span className="tag tag-raid">{raid}</span> : null}
            {x.vendorPrice !== null ? (
              <span className="tag">
                Vendor price {formatGold(x.vendorPrice)}
                {atVendorPrice(x) ? " · AH is at vendor price" : ""}
              </span>
            ) : null}
          </div>
        </div>
        <div className="head-controls">
          <Link to={`/stockpile?add=${x.id}`} className="btn btn-secondary">
            Add to stockpile
          </Link>
          <CopyButton
            text={x.name}
            ariaLabel={`Copy item name ${x.name}`}
            done={`Copied “${x.name}”. Paste it in the AH search box`}
          />
        </div>
      </section>

      <section aria-label="Current numbers" className="tiles">
        <div className="tile">
          <span>Now (cheapest 10%)</span>
          <strong className="gold">{x.now === null ? "not listed" : formatGold(x.now)}</strong>
        </div>
        <div className="tile">
          <span>
            Normal (
            {x.normalDays >= 7
              ? "7-day median"
              : x.normalDays < 1
                ? "under a day of data"
                : `${x.normalDays} days of data`}
            )
          </span>
          <strong>{x.normal === null ? "—" : formatGold(x.normal)}</strong>
        </div>
        <div className="tile">
          <span>Cheapest listing</span>
          <strong>{x.min === null ? "—" : formatGold(x.min)}</strong>
        </div>
        <div className="tile">
          <span>Sold per day (estimate)</span>
          <strong>
            {x.sales?.hours ? (
              <>
                {x.sales.perDay >= 10 ? Math.round(x.sales.perDay).toLocaleString("en-GB") : x.sales.perDay.toFixed(1)}{" "}
                <small>
                  {x.sales.avgPrice ? `@ ${formatGold(x.sales.avgPrice)} · ` : ""}
                  {x.sales.hours} h of data
                </small>
              </>
            ) : (
              <small className="muted">measuring…</small>
            )}
          </strong>
        </div>
        <div className="tile">
          <span>Units listed</span>
          <strong>
            {x.qty.toLocaleString("en-GB")}{" "}
            {x.supplyChange !== null ? <small>{formatPct(x.supplyChange)} vs 3 days</small> : null}
          </strong>
        </div>
      </section>

      <section aria-labelledby="chart-h" className="card stack-sm">
        <div className="section-head">
          <h2 id="chart-h">Price</h2>
          <div className="legend">
            <span className="lg lg-now">Now</span>
            <span className="lg lg-normal">Normal</span>
            <span className="lg lg-upto">Buy up to</span>
            <span className="lg lg-raid">Raids open</span>
          </div>
          <div className="spacer" />
          <fieldset className="segmented">
            <legend className="sr-only">Range</legend>
            {RANGES.map(([r, label]) => (
              <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>
                {label}
              </button>
            ))}
          </fieldset>
        </div>
        {points === null ? (
          <Status value={range === "all" ? daily : hourly} />
        ) : points.length < 2 ? (
          <p className="muted">Not enough history yet for this range.</p>
        ) : (
          <PriceChart points={points} normal={x.normal} upTo={x.upTo} raidT={raidT} until={raidT + 3 * DAY} />
        )}
      </section>

      <div className="two-col">
        <section aria-labelledby="ladder-h" className="card stack-sm">
          <h2 id="ladder-h">What's listed right now</h2>
          <p className="muted small">
            Same order as the in-game AH.
            {x.upTo !== null ? ` Highlighted rows are at or under the buy-up-to price (${formatGold(x.upTo)}).` : ""}
          </p>
          {x.ladder.length > 0 ? (
            <Ladder x={x} />
          ) : (
            <p className="muted">
              {x.qty > 0 ? "Listing details arrive with the next auction house snapshot." : "Nothing listed."}
            </p>
          )}
          {x.unitsUpTo > 0 ? (
            <p>
              Buying the {x.unitsUpTo.toLocaleString("en-GB")} highlighted units costs{" "}
              <strong className="gold">≈ {formatWholeGold(x.costUpTo)}</strong>.
            </p>
          ) : null}
        </section>

        <section aria-labelledby="uses-h" className="card stack-sm">
          <h2 id="uses-h">Used in {x.uses.length} recipes</h2>
          <p className="muted small">From Forever's recipe data. Raid consumables first.</p>
          <ul className="uses">
            {x.uses.map((u) => (
              <li key={u.name}>
                <span>
                  <strong>{u.name}</strong>
                  <small>
                    {u.qty} per craft{u.raid ? " · raid consumable" : ""}
                  </small>
                </span>
                <span className="soft small">{u.profession}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

export function ItemPage() {
  const { id } = useParams();
  const list = useBuyList();
  if (list.state !== "ok") return <Status value={list} />;
  const x = list.data.items.find((i) => i.id === Number(id));
  if (!x)
    return (
      <p className="empty">
        Item {id} isn't on the watchlist, so there's no detail page for it. <Link to="/">Back to the buy list</Link>
      </p>
    );
  return <ItemDetail x={x} raidOpens={list.data.raidOpens} />;
}
