import { Link } from "react-router";
import type { BuyListItem } from "../../../src/shared/signals.ts";
import { isBelowCraft, raidLabel } from "../lib/buylist.ts";
import { formatGold, formatPct, formatWholeGold, qualityColor } from "../lib/format.ts";
import { CopyButton } from "./CopyButton.tsx";
import { Sparkline } from "./Sparkline.tsx";

/** A "Buy now" card: what it costs now, what's normal, and how far down the AH list to buy. */
export function BuyCard({ x, budget }: { x: BuyListItem; budget: number }) {
  const raid = raidLabel(x);
  const avg = x.unitsUpTo ? x.costUpTo / x.unitsUpTo : 0;
  const affordable = avg ? Math.min(x.unitsUpTo, Math.floor((budget * 10000) / avg)) : 0;

  return (
    <article className="card buy-card">
      <div className="buy-card-head">
        <div className="buy-card-title">
          <Link to={`/item/${x.id}`} className="item-name" style={{ color: qualityColor(x.quality) }}>
            {x.name}
          </Link>
          <div className="tags">
            {raid ? <span className="tag tag-raid">{raid}</span> : null}
            {isBelowCraft(x) ? <span className="tag tag-cheap">{formatPct(x.craftChange)} vs reagents</span> : null}
            {x.supplyChange !== null ? <span className="tag">Supply {formatPct(x.supplyChange)} vs 3 days</span> : null}
          </div>
        </div>
        <CopyButton
          text={x.name}
          ariaLabel={`Copy item name ${x.name}`}
          done={`Copied “${x.name}”. Paste it in the AH search box`}
        />
      </div>

      <div className="buy-card-numbers">
        <dl className="stats3">
          <div>
            <dt>Now</dt>
            <dd className="gold">{x.now === null ? "—" : formatGold(x.now)}</dd>
          </div>
          <div>
            <dt>Normal ({x.normalDays < 7 ? `${x.normalDays}d` : "7d"})</dt>
            <dd className="soft">{x.normal === null ? "—" : formatGold(x.normal)}</dd>
          </div>
          <div>
            <dt>vs normal</dt>
            <dd className="cheap">{formatPct(x.change)}</dd>
          </div>
        </dl>
        <Sparkline points={x.spark} reference={x.normal} label={`${x.name} price over 7 days vs normal`} />
      </div>

      {x.upTo !== null ? (
        <div className="buy-box">
          <span>
            Buy up to <strong className="gold">{formatGold(x.upTo)}</strong> each
          </span>
          <span className="muted">
            {x.unitsUpTo.toLocaleString("en-GB")} units listed at or below that · ≈{" "}
            <strong className="text">{formatWholeGold(x.costUpTo)}</strong> total ·{" "}
            {affordable >= x.unitsUpTo ? "budget covers all" : `budget covers ${affordable.toLocaleString("en-GB")}`}
          </span>
        </div>
      ) : null}
    </article>
  );
}
