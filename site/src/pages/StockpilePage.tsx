import { type FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { parseGold } from "../../../src/shared/gold.ts";
import type { BuyListItem } from "../../../src/shared/signals.ts";
import { type Lot, type LotValue, type Market, type Purpose, valueLot } from "../../../src/shared/stockpile.ts";
import type { ItemMeta } from "../../../src/shared/types.ts";
import { CopyButton } from "../components/CopyButton.tsx";
import { ItemName } from "../components/ItemName.tsx";
import { Status } from "../components/Status.tsx";
import { useToast } from "../components/Toast.tsx";
import { useBuyList, useItems, useLatest } from "../lib/data.ts";
import { formatGold, formatPct, formatWholeGold, qualityColor } from "../lib/format.ts";
import { backupOf, newLotId, PURPOSE_LABEL, parseLots, useLots, useMarkets } from "../lib/stockpile.ts";
import {
  btn,
  card,
  cellInput,
  cheap,
  field,
  gold,
  headControls,
  label,
  lead,
  loss,
  numberInput,
  pageFoot,
  pageHead,
  sectionHead,
  select,
  small,
  subline,
  type TagKind,
  table,
  tableWrap,
  tag,
  textInput,
} from "../lib/ui.ts";

const SECTION = "flex flex-col gap-3.5";

const today = () => new Date().toISOString().slice(0, 10);
const NO_ITEMS: BuyListItem[] = [];
const NO_META: Record<string, ItemMeta> = {};

interface Row {
  lot: Lot;
  name: string;
  quality: string | null;
  icon: number | null;
  tip: string[] | undefined;
  m: Market | undefined;
  v: LotValue;
}

function AddLot({
  names,
  options,
  initialItem,
  onAdd,
}: {
  /** Lower-case name → item id. */
  names: Map<string, number>;
  /** Display names for the suggestion list. */
  options: string[];
  initialItem: string;
  onAdd: (lot: Lot) => void;
}) {
  const [item, setItem] = useState(initialItem);
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [purpose, setPurpose] = useState<Purpose>("resell");
  const [error, setError] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const id = names.get(item.trim().toLowerCase());
    const n = Number(qty);
    const unitCost = parseGold(price);
    if (id === undefined)
      return setError("Pick an item from the list (it must have been listed on the AH at least once).");
    if (!Number.isInteger(n) || n <= 0) return setError("Quantity must be a whole number above 0.");
    if (unitCost === null) return setError("Price per unit: e.g. 11g 55s, 86s, or 11.55 (gold).");
    onAdd({ id: newLotId(), item: id, qty: n, unitCost, purpose, added: today() });
    setItem("");
    setQty("");
    setPrice("");
    setError("");
  };

  return (
    <form className={`${card} flex flex-wrap items-end gap-x-4 gap-y-3`} onSubmit={submit}>
      <div className={`${field} flex-[1_1_260px]`}>
        <label htmlFor="lot-item" className={label}>
          Item
        </label>
        <input
          id="lot-item"
          className={`${textInput} w-full`}
          list="lot-items"
          value={item}
          onChange={(e) => setItem(e.target.value)}
          placeholder="Start typing a name"
          autoComplete="off"
        />
        <datalist id="lot-items">
          {options.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>
      <div className={field}>
        <label htmlFor="lot-qty" className={label}>
          Quantity
        </label>
        <input
          id="lot-qty"
          className={numberInput}
          type="number"
          min="1"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
      </div>
      <div className={field}>
        <label htmlFor="lot-price" className={label}>
          Paid per unit
        </label>
        <input
          id="lot-price"
          className={numberInput}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="11g 55s"
        />
      </div>
      <div className={field}>
        <label htmlFor="lot-purpose" className={label}>
          Why
        </label>
        <select
          id="lot-purpose"
          className={select}
          value={purpose}
          onChange={(e) => setPurpose(e.target.value as Purpose)}
        >
          {(Object.keys(PURPOSE_LABEL) as Purpose[]).map((p) => (
            <option key={p} value={p}>
              {PURPOSE_LABEL[p]}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className={btn("primary")}>
        Add lot
      </button>
      {error ? (
        <p className={`${small} basis-full text-loss`} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function statusOf(r: Row, normalPct: number): { label: string; kind: TagKind } {
  if (r.v.value === null) return { label: "Not listed", kind: "plain" };
  if (r.lot.purpose === "own") return { label: "Keep", kind: "plain" };
  if (r.v.sell) return { label: "Sell", kind: "sell" };
  if ((r.m?.now ?? 0) >= r.v.sellAt) return { label: `At target, not ${normalPct}% over normal`, kind: "raid" };
  return { label: "Hold", kind: "plain" };
}

function LotTable({
  rows,
  normalPct,
  onQty,
  onDelete,
}: {
  rows: Row[];
  normalPct: number;
  onQty: (id: string, qty: number) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={tableWrap}>
      <table className={table}>
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Qty</th>
            <th scope="col">Paid / unit</th>
            <th scope="col">Now</th>
            <th scope="col">Normal</th>
            <th scope="col">Sell at</th>
            <th scope="col">Worth (after 5%)</th>
            <th scope="col">P/L</th>
            <th scope="col">Status</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const s = statusOf(r, normalPct);
            return (
              <tr key={r.lot.id} className={r.v.sell ? "bg-within" : undefined}>
                <td>
                  <ItemName item={{ id: r.lot.item, name: r.name, quality: r.quality, icon: r.icon, tip: r.tip }} />
                  <span className={subline}>bought {r.lot.added}</span>
                </td>
                <td>
                  <input
                    className={cellInput}
                    type="number"
                    min="0"
                    aria-label={`${r.name}: quantity left`}
                    value={r.lot.qty}
                    onChange={(e) => onQty(r.lot.id, Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                  />
                </td>
                <td className="text-soft">{formatGold(r.lot.unitCost)}</td>
                <td className={r.m?.now == null ? "text-muted" : gold}>
                  {r.m?.now == null ? "not listed" : formatGold(r.m.now)}
                </td>
                <td className="text-soft">{r.m?.normal == null ? "—" : formatGold(r.m.normal)}</td>
                <td className="text-soft">{r.lot.purpose === "own" ? "—" : formatGold(r.v.sellAt)}</td>
                <td className={gold}>{r.v.value === null ? "—" : formatWholeGold(r.v.value)}</td>
                <td className={r.v.pl === null ? "text-muted" : r.v.pl >= 0 ? cheap : loss}>
                  {r.v.pl === null ? "—" : `${r.v.pl >= 0 ? "+" : "−"}${formatWholeGold(Math.abs(r.v.pl))}`}
                  {r.v.plPct === null ? null : (
                    <span className="text-[13.5px] font-normal text-muted"> {formatPct(r.v.plPct)}</span>
                  )}
                </td>
                <td>
                  <span className={tag[s.kind]}>{s.label}</span>
                </td>
                <td>
                  <button
                    type="button"
                    className={btn("ghost", true)}
                    aria-label={`Delete lot: ${r.lot.qty} ${r.name}`}
                    onClick={() => window.confirm(`Delete the lot of ${r.lot.qty} ${r.name}?`) && onDelete(r.lot.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Restore({ onRestore }: { onRestore: (lots: Lot[]) => void }) {
  const [text, setText] = useState("");
  const toast = useToast();
  return (
    <details>
      <summary className="cursor-pointer py-2 text-soft">Restore from a backup</summary>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="restore-text" className={`${small} text-muted`}>
          Paste what “Copy backup” copied on another device. It replaces the lots in this browser.
        </label>
        <textarea
          id="restore-text"
          className="w-full max-w-160 rounded-ctl border border-line-strong bg-bar px-3 py-2.5 font-mono text-[13px] text-fg"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div>
          <button
            type="button"
            className={btn("secondary", true)}
            onClick={() => {
              const lots = parseLots(text);
              if (!lots) return toast("That isn't a stockpile backup");
              if (!window.confirm(`Replace the lots in this browser with ${lots.length} lots from the backup?`)) return;
              onRestore(lots);
              setText("");
              toast(`Restored ${lots.length} lots`);
            }}
          >
            Restore
          </button>
        </div>
      </div>
    </details>
  );
}

export function StockpilePage() {
  const list = useBuyList();
  const latest = useLatest();
  const items = useItems();
  const [lots, setLots] = useLots();
  const [params] = useSearchParams();
  const ids = useMemo(() => lots.map((l) => l.item), [lots]);
  const buyList = list.state === "ok" ? list.data : null;
  const latestData = latest.state === "ok" ? latest.data : null;
  const markets = useMarkets(ids, buyList?.items ?? NO_ITEMS, latestData);

  // Item search: every commodity seen on the AH (items.json). Keys are lower-case names.
  const meta: Record<string, ItemMeta> = items.state === "ok" ? items.data : NO_META;
  const names = useMemo(() => {
    const out = new Map<string, number>();
    const listed = latestData?.items ?? {};
    for (const [id, m] of Object.entries(meta)) {
      if (!m.name) continue;
      const key = m.name.toLowerCase();
      // Same name twice: prefer the one listed right now.
      if (!out.has(key) || listed[id]) out.set(key, Number(id));
    }
    return out;
  }, [meta, latestData]);
  const options = useMemo(
    () =>
      [...names.values()]
        .map((id) => meta[id]?.name ?? "")
        .filter(Boolean)
        .sort(),
    [names, meta],
  );

  if (list.state !== "ok" || !buyList) return <Status value={list} />;
  const opt = buyList.sell ?? { sellAboveCostPct: 30, sellAboveNormalPct: 15 };
  const nameOf = (id: number) => meta[id]?.name ?? buyList.items.find((x) => x.id === id)?.name ?? `Item ${id}`;

  const rows: Row[] = lots.map((lot) => {
    const m = markets.get(lot.item);
    const listed = buyList.items.find((x) => x.id === lot.item);
    return {
      lot,
      name: nameOf(lot.item),
      quality: meta[lot.item]?.quality ?? listed?.quality ?? null,
      icon: meta[lot.item]?.icon || listed?.icon || null,
      tip: meta[lot.item]?.tip ?? listed?.tip,
      m,
      v: valueLot(lot, m, opt),
    };
  });
  const sell = rows.filter((r) => r.v.sell);
  const cost = rows.reduce((s, r) => s + r.v.cost, 0);
  const priced = rows.filter((r) => r.v.value !== null);
  const value = priced.reduce((s, r) => s + (r.v.value ?? 0), 0);
  const pricedCost = priced.reduce((s, r) => s + r.v.cost, 0);
  const pl = value - pricedCost;

  const addParam = params.get("add");
  const initialItem = addParam ? (meta[addParam]?.name ?? "") : "";
  const ready = items.state === "ok" && latest.state === "ok";

  return (
    <div className="flex flex-col gap-10">
      <section className={pageHead}>
        <div className="flex flex-[1_1_420px] flex-col gap-1.5">
          <h1>Stockpile</h1>
          <p className={lead}>
            {lots.length === 0 ? (
              "Record what you buy to see what it's worth and when to sell."
            ) : (
              <>
                Paid <strong className="text-fg">{formatWholeGold(cost)}</strong> · worth{" "}
                <strong className={gold}>{formatWholeGold(value)}</strong> after the 5% AH cut ·{" "}
                <strong className={pl >= 0 ? cheap : loss}>
                  {pl >= 0 ? "+" : "−"}
                  {formatWholeGold(Math.abs(pl))}
                </strong>
                {priced.length < rows.length ? ` (${rows.length - priced.length} lots not listed, not counted)` : ""}
              </>
            )}
          </p>
        </div>
        {lots.length > 0 ? (
          <div className={headControls}>
            <CopyButton
              text={backupOf(lots)}
              label="Copy backup"
              done="Backup copied. Paste it under “Restore” on another device"
              variant="secondary"
            />
          </div>
        ) : null}
      </section>

      {sell.length > 0 ? (
        <section aria-labelledby="sell-now" className={SECTION}>
          <div className={sectionHead}>
            <h2 id="sell-now">Sell now</h2>
            <span className="text-muted">
              At least {opt.sellAboveCostPct}% over what you paid after the AH cut, and {opt.sellAboveNormalPct}% over
              its normal price
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {sell.map((r) => (
              <div
                key={r.lot.id}
                className="flex flex-wrap items-center gap-3 rounded-card border border-mint/35 bg-surface p-[18px]"
              >
                <div className="flex flex-[1_1_420px] flex-col gap-1.5">
                  <strong style={{ color: qualityColor(r.quality) }}>
                    {r.lot.qty} × {r.name}
                  </strong>
                  <span className={`${small} text-muted`}>
                    {formatGold(r.m?.now ?? 0)} now ({formatPct(r.m?.normal ? (r.m.now ?? 0) / r.m.normal - 1 : null)}{" "}
                    vs normal) · paid {formatGold(r.lot.unitCost)} · lowest listing {formatGold(r.m?.min ?? 0)} ·{" "}
                    {formatWholeGold(r.v.value ?? 0)} after the cut
                    {r.lot.purpose === "alt" && r.m?.normal
                      ? ` · rebuy for levelling once it's back near ${formatGold(r.m.normal)}`
                      : ""}
                  </span>
                </div>
                <CopyButton
                  text={r.name}
                  ariaLabel={`Copy item name ${r.name}`}
                  done={`Copied “${r.name}”. Paste it in the AH search box`}
                  small
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="add" className={SECTION}>
        <h2 id="add">Add a lot</h2>
        {ready ? (
          <AddLot
            key={initialItem}
            names={names}
            options={options}
            initialItem={initialItem}
            onAdd={(lot) => setLots([...lots, lot])}
          />
        ) : (
          <p className="text-muted">Loading item names…</p>
        )}
      </section>

      {(Object.keys(PURPOSE_LABEL) as Purpose[]).map((p) => {
        const group = rows.filter((r) => r.lot.purpose === p);
        if (group.length === 0) return null;
        return (
          <section key={p} aria-labelledby={`p-${p}`} className={SECTION}>
            <div className={sectionHead}>
              <h2 id={`p-${p}`}>{PURPOSE_LABEL[p]}</h2>
              <span className="text-muted">
                {p === "own"
                  ? "Never flagged for sale: shown so you know what your stock is worth."
                  : `Flagged “Sell” at ${opt.sellAboveCostPct}% over cost (after the cut) and ${opt.sellAboveNormalPct}% over normal.`}
              </span>
            </div>
            <LotTable
              rows={group}
              normalPct={opt.sellAboveNormalPct}
              onQty={(id, qty) => setLots(lots.map((l) => (l.id === id ? { ...l, qty } : l)))}
              onDelete={(id) => setLots(lots.filter((l) => l.id !== id))}
            />
          </section>
        );
      })}

      <Restore onRestore={setLots} />

      <footer className={pageFoot}>
        <span>
          Lots are saved in this browser only. Use <strong>Copy backup</strong> and <strong>Restore</strong> to move
          them to another device. Sold part of a lot? Lower its quantity.
        </span>
        <span>
          <strong>Normal</strong> = 7-day median price (hourly for watchlist items, daily for the rest).{" "}
          <strong>Sell at</strong> = the unit price that clears your cost target after the cut. Nothing here predicts
          prices.
        </span>
      </footer>
    </div>
  );
}
