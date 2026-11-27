import type { BuyListItem } from "../../../src/shared/signals.ts";
import { isBelowCraft, raidLabel } from "../lib/buylist.ts";
import { formatGold, formatPct, formatWholeGold } from "../lib/format.ts";
import { card, cardHead, cheap, gold, stats3, tag, tags } from "../lib/ui.ts";
import { CopyButton } from "./CopyButton.tsx";
import { ItemName } from "./ItemName.tsx";
import { Sparkline } from "./Sparkline.tsx";

/** A "Buy now" card: what it costs now, what's normal, and how far down the AH list to buy. */
export function BuyCard({ x, budget }: { x: BuyListItem; budget: number }) {
  const raid = raidLabel(x);
  const avg = x.unitsUpTo ? x.costUpTo / x.unitsUpTo : 0;
  const affordable = avg ? Math.min(x.unitsUpTo, Math.floor((budget * 10000) / avg)) : 0;

  return (
    <article className={`${card} flex flex-col gap-4`}>
      <div className={cardHead}>
        <div className="flex min-w-0 flex-col gap-2">
          <ItemName item={x} size="title" />
          <div className={tags}>
            {raid ? <span className={tag.raid}>{raid}</span> : null}
            {isBelowCraft(x) ? <span className={tag.cheap}>{formatPct(x.craftChange)} vs reagents</span> : null}
            {x.supplyChange !== null ? (
              <span className={tag.plain}>Supply {formatPct(x.supplyChange)} vs 3 days</span>
            ) : null}
          </div>
        </div>
        <CopyButton
          text={x.name}
          ariaLabel={`Copy item name ${x.name}`}
          done={`Copied “${x.name}”. Paste it in the AH search box`}
        />
      </div>

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end sm:justify-between">
        <dl className={stats3}>
          <div>
            <dt>Now</dt>
            <dd className={gold}>{x.now === null ? "—" : formatGold(x.now)}</dd>
          </div>
          <div>
            <dt>Normal ({x.normalDays < 7 ? `${x.normalDays}d` : "7d"})</dt>
            <dd className="text-soft">{x.normal === null ? "—" : formatGold(x.normal)}</dd>
          </div>
          <div>
            <dt>vs normal</dt>
            <dd className={cheap}>{formatPct(x.change)}</dd>
          </div>
        </dl>
        <Sparkline points={x.spark} reference={x.normal} label={`${x.name} price over 7 days vs normal`} />
      </div>

      {x.upTo !== null ? (
        <div className="flex flex-col gap-1 rounded-ctl border border-line bg-inset px-3.5 py-3 text-sm">
          <span>
            Buy up to <strong className={gold}>{formatGold(x.upTo)}</strong> each
          </span>
          <span className="text-[13.5px] text-muted">
            {x.unitsUpTo.toLocaleString("en-GB")} units listed at or below that · ≈{" "}
            <strong className="text-fg">{formatWholeGold(x.costUpTo)}</strong> total ·{" "}
            {affordable >= x.unitsUpTo ? "budget covers all" : `budget covers ${affordable.toLocaleString("en-GB")}`}
          </span>
        </div>
      ) : null}
    </article>
  );
}
