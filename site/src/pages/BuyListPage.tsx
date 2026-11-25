import { useEffect, useState } from "react";
import type { BuyListItem } from "../../../src/shared/signals.ts";
import { BuyCard } from "../components/BuyCard.tsx";
import { CopyButton } from "../components/CopyButton.tsx";
import { ItemFilters } from "../components/ItemFilters.tsx";
import { ItemTable } from "../components/ItemTable.tsx";
import { Status } from "../components/Status.tsx";
import { applyFilter, NO_FILTER, sections } from "../lib/buylist.ts";
import { useBuyList } from "../lib/data.ts";
import { formatWholeGold } from "../lib/format.ts";
import { sortRows } from "../lib/sort.ts";

const BUDGET_KEY = "forever-broke.budget";

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

  if (list.state !== "ok") return <Status value={list} />;
  const { buyNow, cheapOther, watch } = sections(list.data.items);
  const watchShown = applyFilter(watch, watchFilter);
  const cards = sortCards(buyNow, cardSort);
  const total = buyNow.reduce((s, x) => s + x.costUpTo, 0);
  const history = Math.max(0, ...list.data.items.map((x) => x.normalDays));

  return (
    <div className="stack-xl">
      <section className="page-head">
        <div className="stack-xs grow">
          <h1>Buy list</h1>
          <p className="muted lead">
            {buyNow.length === 0 ? (
              "Nothing used in raids is cheap right now."
            ) : (
              <>
                {buyNow.length} {buyNow.length === 1 ? "item is" : "items are"} cheap right now <strong>and</strong>{" "}
                used in raid consumables. Buying all of them up to the listed price costs about{" "}
                <strong className="gold">{formatWholeGold(total)}</strong>.
              </>
            )}
          </p>
        </div>
        <div className="head-controls">
          <div className="field">
            <label htmlFor="budget">Budget (gold)</label>
            <input
              id="budget"
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
        <p className="notice">
          “Normal” prices are based on {history < 1 ? "less than a day" : `${history} days`} of history so far (7 days
          when complete). Nothing is flagged as cheap until there's at least a day of data.
        </p>
      ) : null}

      <section aria-labelledby="buy-now" className="stack-md">
        <div className="section-head">
          <h2 id="buy-now">Buy now</h2>
          <span className="muted">
            At least {list.data.cheapPct}% under its normal price, and used in raid consumables
          </span>
          {buyNow.length > 1 ? (
            <>
              <div className="spacer" />
              <div className="field field-inline">
                <label htmlFor="card-sort">Sort</label>
                <select id="card-sort" value={cardSort} onChange={(e) => setCardSort(e.target.value as CardSort)}>
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
          <div className="card-grid">
            {cards.map((x) => (
              <BuyCard key={x.id} x={x} budget={budget} />
            ))}
          </div>
        ) : (
          <p className="empty">
            No raid item is {list.data.cheapPct}% under its normal price right now. Check back later.
          </p>
        )}
      </section>

      <section aria-labelledby="watch" className="stack-md">
        <div className="section-head">
          <h2 id="watch">Watch</h2>
          <span className="muted">Raid items at their normal price. Check these daily.</span>
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
        <section aria-labelledby="cheap-other" className="stack-md">
          <div className="section-head">
            <h2 id="cheap-other">Cheap, no raid link</h2>
            <span className="muted">Under normal price, but not used in raid consumables</span>
            <div className="spacer" />
            <button
              type="button"
              className="btn btn-ghost btn-small"
              aria-expanded={showCheap}
              onClick={() => setShowCheap(!showCheap)}
            >
              {showCheap ? "Hide" : `Show ${cheapOther.length}`}
            </button>
          </div>
          {showCheap ? <ItemTable items={cheapOther} highlightCheap /> : null}
        </section>
      ) : null}

      <footer className="page-foot muted">
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
