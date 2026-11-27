import { useEffect, useState } from "react";
import type { BuyListItem } from "../../../src/shared/signals.ts";
import { BelowCraftTable } from "../components/BelowCraftTable.tsx";
import { BuyCard } from "../components/BuyCard.tsx";
import { CopyButton } from "../components/CopyButton.tsx";
import { ForYourRaids, raidDeals } from "../components/ForYourRaids.tsx";
import { ItemFilters } from "../components/ItemFilters.tsx";
import { ItemTable } from "../components/ItemTable.tsx";
import { ResellList } from "../components/ResellList.tsx";
import { Status } from "../components/Status.tsx";
import { applyFilter, isVendor, NO_FILTER, sections } from "../lib/buylist.ts";
import { useCustomKits } from "../lib/customKits.ts";
import { useBuyList } from "../lib/data.ts";
import { pickKit, useKitPrefs } from "../lib/kit.ts";
import { sortRows } from "../lib/sort.ts";
import { useStars } from "../lib/stars.ts";
import {
  btn,
  cardGrid,
  empty,
  field,
  headControls,
  label,
  lead,
  notice,
  numberInput,
  pageFoot,
  pageHead,
  sectionHead,
  select,
} from "../lib/ui.ts";

const SECTION = "flex flex-col gap-3.5";

const BUDGET_KEY = "forever-broke.budget";
/** Same as config.yaml thresholds.flipMinSalesHours (shown while sales data builds up). */
const MIN_SALES_HOURS = 12;

type CardSort = "change" | "cost" | "units" | "name";
const CARD_SORTS: [CardSort, string][] = [
  ["change", "Biggest discount"],
  ["cost", "Cheapest to buy out"],
  ["units", "Most units available"],
  ["name", "Name"],
];

function sortCards(items: BuyListItem[], by: CardSort): BuyListItem[] {
  if (by === "change") return sortRows(items, (x) => x.change, "asc");
  if (by === "cost") return sortRows(items, (x) => x.costUpTo, "asc");
  if (by === "units") return sortRows(items, (x) => x.unitsUpTo, "desc");
  return sortRows(items, (x) => x.name, "asc");
}

function useBudget(): [number, (n: number) => void] {
  const [budget, setBudget] = useState(() => Number(localStorage.getItem(BUDGET_KEY) ?? 800) || 0);
  useEffect(() => localStorage.setItem(BUDGET_KEY, String(budget)), [budget]);
  return [budget, setBudget];
}

export function BuyListPage() {
  const list = useBuyList();
  const [budget, setBudget] = useBudget();
  const [showCheap, setShowCheap] = useState(false);
  const [cardSort, setCardSort] = useState<CardSort>("change");
  const [watchFilter, setWatchFilter] = useState(NO_FILTER);
  const [kitPrefs] = useKitPrefs();
  const [customKits] = useCustomKits();
  const stars = useStars();

  if (list.state !== "ok") return <Status value={list} />;
  const { buyNow, belowCraft, cheapOther, watch } = sections(list.data.items);
  const watchShown = applyFilter(watch, watchFilter, stars);
  const cards = sortCards(buyNow, cardSort);
  const history = Math.max(0, ...list.data.items.map((x) => x.normalDays));

  const kit = pickKit([...(list.data.kits ?? []), ...customKits], kitPrefs);
  const soulbound = new Set(list.data.soulbound ?? []);
  const deals = kit ? raidDeals(kit, list.data.items, kitPrefs, list.data.belowCraftPct ?? 10, soulbound) : [];
  const flips = sortRows(
    list.data.items.filter((x) => x.flip && !isVendor(x)),
    (x) => x.resale?.profit ?? 0,
    "desc",
  );
  const salesHours = Math.max(0, ...list.data.items.map((x) => x.sales?.hours ?? 0));

  return (
    <div className="flex flex-col gap-10">
      <section className={pageHead}>
        <div className="flex flex-[1_1_420px] flex-col gap-1.5">
          <h1>Buy list</h1>
          <p className={lead}>
            {deals.length === 0 && flips.length === 0 ? (
              "Nothing stands out right now: nothing in your kit is cheap, and nothing is listed under what buyers pay."
            ) : (
              <>
                <strong className="text-fg">{deals.length}</strong> {deals.length === 1 ? "item" : "items"} for your
                raids and <strong className="text-fg">{flips.length}</strong> to resell are worth buying right now.
              </>
            )}
          </p>
        </div>
        <div className={headControls}>
          <div className={field}>
            <label htmlFor="budget" className={label}>
              Budget (gold)
            </label>
            <input
              id="budget"
              className={numberInput}
              type="number"
              min="0"
              step="50"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value) || 0)}
            />
          </div>
          {buyNow.length > 0 ? (
            <CopyButton
              text={buyNow.map((x) => x.name).join("\n")}
              label="Copy all names"
              done={`Copied ${buyNow.length} item names, one per line`}
              variant="secondary"
            />
          ) : null}
        </div>
      </section>

      {history < 7 ? (
        <p className={notice}>
          “Normal” prices are based on {history < 1 ? "less than a day" : `${history} days`} of history so far (7 days
          when complete). Nothing is flagged as cheap until there's at least a day of data.
        </p>
      ) : null}

      {kit ? (
        <section aria-labelledby="for-raids" className={SECTION}>
          <div className={sectionHead}>
            <h2 id="for-raids">For your raids</h2>
            <span className="text-muted">
              Items in your kit that are cheap right now: under their normal price, under what buyers have been paying,
              or under the cost of their reagents
            </span>
          </div>
          <ForYourRaids kit={kit} deals={deals} nights={kitPrefs.nights} />
        </section>
      ) : null}

      <section aria-labelledby="resell" className={SECTION}>
        <div className={sectionHead}>
          <h2 id="resell">To resell</h2>
          <span className="text-muted">
            Listed under what buyers have actually paid over the last 3 days, by enough to profit after the 5% cut. The
            quantity is capped at what sells.
          </span>
        </div>
        {flips.length > 0 ? (
          <ResellList items={flips} />
        ) : (
          <p className={empty}>
            {salesHours < MIN_SALES_HOURS
              ? `Needs ${MIN_SALES_HOURS} hours of sales data before suggesting anything. ${salesHours} h so far: sales are measured hour to hour from the AH listings.`
              : "Nothing is listed cheaply enough to resell at a profit right now."}
          </p>
        )}
      </section>

      <section aria-labelledby="buy-now" className={SECTION}>
        <div className={sectionHead}>
          <h2 id="buy-now">Cheap raid items</h2>
          <span className="text-muted">
            At least {list.data.cheapPct}% under its normal price, and used in raid consumables
          </span>
          {buyNow.length > 1 ? (
            <>
              <div className="flex-auto" />
              <div className="flex items-center gap-2">
                <label htmlFor="card-sort" className={label}>
                  Sort
                </label>
                <select
                  id="card-sort"
                  className={select}
                  value={cardSort}
                  onChange={(e) => setCardSort(e.target.value as CardSort)}
                >
                  {CARD_SORTS.map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : null}
        </div>
        {buyNow.length > 0 ? (
          <div className={cardGrid}>
            {cards.map((x) => (
              <BuyCard key={x.id} x={x} budget={budget} />
            ))}
          </div>
        ) : (
          <p className={empty}>
            No raid item is {list.data.cheapPct}% under its normal price right now. Check back later.
          </p>
        )}
      </section>

      {belowCraft.length > 0 ? (
        <section aria-labelledby="below-craft" className={SECTION}>
          <div className={sectionHead}>
            <h2 id="below-craft">Under craft cost</h2>
            <span className="text-muted">
              Raid consumables selling at least {list.data.belowCraftPct ?? 10}% under what their reagents cost today.
              Cheaper to buy than to craft; no history needed.
            </span>
          </div>
          <BelowCraftTable items={belowCraft} />
        </section>
      ) : null}

      <section aria-labelledby="watch" className={SECTION}>
        <div className={sectionHead}>
          <h2 id="watch">Watch</h2>
          <span className="text-muted">Raid items at their normal price. Check these daily.</span>
        </div>
        <ItemFilters
          value={watchFilter}
          onChange={setWatchFilter}
          groups={[...new Set(watch.map((x) => x.group))]}
          summary={`${watchShown.length} of ${watch.length} items`}
        />
        <ItemTable items={watchShown} />
      </section>

      {cheapOther.length > 0 ? (
        <section aria-labelledby="cheap-other" className={SECTION}>
          <div className={sectionHead}>
            <h2 id="cheap-other">Cheap, no raid link</h2>
            <span className="text-muted">Under normal price, but not used in raid consumables</span>
            <div className="flex-auto" />
            <button
              type="button"
              className={btn("ghost", true)}
              aria-expanded={showCheap}
              onClick={() => setShowCheap(!showCheap)}
            >
              {showCheap ? "Hide" : `Show ${cheapOther.length}`}
            </button>
          </div>
          {showCheap ? <ItemTable items={cheapOther} highlightCheap /> : null}
        </section>
      ) : null}

      <footer className={pageFoot}>
        <span>
          <strong>Now</strong> = price of the cheapest 10% of units listed. <strong>Normal</strong> = median of “Now”
          over the last 7 days.
        </span>
        <span>
          Nothing here predicts prices. A raid tag means the item is used in a raid consumable (from Forever's recipe
          data), not that its price will rise.
        </span>
      </footer>
    </div>
  );
}
