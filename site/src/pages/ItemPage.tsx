import { useState } from "react";
import { Link, useParams } from "react-router";
import type { BuyListItem } from "../../../src/shared/signals.ts";
import { type DailySeries, type HourlySeries, iconUrl } from "../../../src/shared/types.ts";
import { CopyButton } from "../components/CopyButton.tsx";
import { TipLines } from "../components/ItemName.tsx";
import { type Point, PriceChart } from "../components/PriceChart.tsx";
import { StarButton } from "../components/StarButton.tsx";
import { Status } from "../components/Status.tsx";
import { atVendorPrice, raidLabel } from "../lib/buylist.ts";
import { type Loadable, useBuyList, useDaily, useHourly } from "../lib/data.ts";
import { formatGold, formatPct, formatWholeGold, qualityColor } from "../lib/format.ts";
import {
  btn,
  card,
  empty,
  gold,
  headControls,
  pageHead,
  sectionHead,
  segment,
  small,
  tableNarrow,
  tag,
  tags,
} from "../lib/ui.ts";

/** Number tile: muted caption, big value, optional muted detail in <small>. */
const TILE =
  "flex flex-col gap-1 rounded-xl border border-line bg-surface px-4 py-3.5 [&>span]:text-xs [&>span]:text-muted [&>strong]:text-[22px] [&_small]:text-[13px] [&_small]:font-medium [&_small]:text-muted";

/** Chart legend swatches, matching the line styles in PriceChart. */
const LEGEND: [string, string][] = [
  ["Now", "w-[18px] border-t-2 border-accent"],
  ["Normal", "w-[18px] border-t-2 border-dashed border-[#7d8696]"],
  ["Buy up to", "w-[18px] border-t-2 border-dotted border-mint"],
  ["Raids open", "h-3.5 border-l-2 border-[#f6a64c]"],
];

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
    <div className="overflow-x-auto">
      <table className={tableNarrow}>
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
              <tr key={price} className={within ? "bg-within" : undefined}>
                <td className={within ? gold : "text-soft"}>{formatGold(price)}</td>
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
    <div className="flex flex-col gap-7">
      <Link to="/" className="self-start py-2.5 text-soft no-underline">
        ← Buy list
      </Link>

      <section className={pageHead}>
        <div className="flex flex-[1_1_420px] flex-col gap-1.5">
          <h1 className="flex items-center gap-3" style={{ color: qualityColor(x.quality) }}>
            {x.icon ? (
              <img
                className="flex-none rounded-lg border border-line-strong"
                src={iconUrl(x.icon, 56)}
                alt=""
                width={40}
                height={40}
              />
            ) : null}
            {x.name}
            <span className="text-[26px]">
              <StarButton id={x.id} name={x.name} />
            </span>
          </h1>
          {x.tip?.length ? (
            <div className="max-w-[60ch] text-sm leading-normal text-soft">
              <TipLines lines={x.tip} />
            </div>
          ) : null}
          <div className={tags}>
            {x.cheap ? <span className={tag.cheap}>Cheap · {formatPct(x.change)} vs normal</span> : null}
            {raid ? <span className={tag.raid}>{raid}</span> : null}
            {x.vendorPrice !== null ? (
              <span className={tag.plain}>
                Vendor price {formatGold(x.vendorPrice)}
                {atVendorPrice(x) ? " · AH is at vendor price" : ""}
              </span>
            ) : null}
          </div>
        </div>
        <div className={headControls}>
          <Link to={`/stockpile?add=${x.id}`} className={btn("secondary")}>
            Add to stockpile
          </Link>
          <CopyButton
            text={x.name}
            ariaLabel={`Copy item name ${x.name}`}
            done={`Copied “${x.name}”. Paste it in the AH search box`}
          />
        </div>
      </section>

      <section aria-label="Current numbers" className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        <div className={TILE}>
          <span>Now (cheapest 10%)</span>
          <strong className={gold}>{x.now === null ? "not listed" : formatGold(x.now)}</strong>
        </div>
        <div className={TILE}>
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
        <div className={TILE}>
          <span>Cheapest listing</span>
          <strong>{x.min === null ? "—" : formatGold(x.min)}</strong>
        </div>
        <div className={TILE}>
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
              <small>measuring…</small>
            )}
          </strong>
        </div>
        <div className={TILE}>
          <span>Units listed</span>
          <strong>
            {x.qty.toLocaleString("en-GB")}{" "}
            {x.supplyChange !== null ? <small>{formatPct(x.supplyChange)} vs 3 days</small> : null}
          </strong>
        </div>
      </section>

      <section aria-labelledby="chart-h" className={`${card} flex flex-col gap-2.5`}>
        <div className={sectionHead}>
          <h2 id="chart-h">Price</h2>
          <div className="flex flex-wrap gap-3.5 text-[13px] text-soft">
            {LEGEND.map(([label, swatch]) => (
              <span key={label} className="inline-flex items-center gap-1.5">
                <span className={swatch} aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>
          <div className="flex-auto" />
          <fieldset className="flex gap-1">
            <legend className="sr-only">Range</legend>
            {RANGES.map(([r, label]) => (
              <button key={r} type="button" aria-pressed={range === r} className={segment} onClick={() => setRange(r)}>
                {label}
              </button>
            ))}
          </fieldset>
        </div>
        {points === null ? (
          <Status value={range === "all" ? daily : hourly} />
        ) : points.length < 2 ? (
          <p className="text-muted">Not enough history yet for this range.</p>
        ) : (
          <PriceChart points={points} normal={x.normal} upTo={x.upTo} raidT={raidT} until={raidT + 3 * DAY} />
        )}
      </section>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(360px,100%),1fr))] items-start gap-5">
        <section aria-labelledby="ladder-h" className={`${card} flex flex-col gap-2.5`}>
          <h2 id="ladder-h">What's listed right now</h2>
          <p className={`${small} text-muted`}>
            Same order as the in-game AH.
            {x.upTo !== null ? ` Highlighted rows are at or under the buy-up-to price (${formatGold(x.upTo)}).` : ""}
          </p>
          {x.ladder.length > 0 ? (
            <Ladder x={x} />
          ) : (
            <p className="text-muted">
              {x.qty > 0 ? "Listing details arrive with the next auction house snapshot." : "Nothing listed."}
            </p>
          )}
          {x.unitsUpTo > 0 ? (
            <p>
              Buying the {x.unitsUpTo.toLocaleString("en-GB")} highlighted units costs{" "}
              <strong className={gold}>≈ {formatWholeGold(x.costUpTo)}</strong>.
            </p>
          ) : null}
        </section>

        <section aria-labelledby="uses-h" className={`${card} flex flex-col gap-2.5`}>
          <h2 id="uses-h">Used in {x.uses.length} recipes</h2>
          <p className={`${small} text-muted`}>From Forever's recipe data. Raid consumables first.</p>
          <ul>
            {x.uses.map((u) => (
              <li key={u.name} className="flex items-center justify-between gap-3 border-b border-line-soft py-[9px]">
                <span className="flex flex-col">
                  <strong>{u.name}</strong>
                  <small className="text-[12.5px] text-muted">
                    {u.qty} per craft{u.raid ? " · raid consumable" : ""}
                  </small>
                </span>
                <span className={`${small} text-soft`}>{u.profession}</span>
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
      <p className={empty}>
        Item {id} isn't on the watchlist, so there's no detail page for it. <Link to="/">Back to the buy list</Link>
      </p>
    );
  return <ItemDetail x={x} raidOpens={list.data.raidOpens} />;
}
